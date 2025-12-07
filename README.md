### High-level product goal
 The mid-term goal of this project is to **automate invoice generation** for warehouse operations:

 * Packers clock in/out and track breaks on `/app/dashboard`.
 * Managers see daily/hourly summaries on `/manager/shifts`.
 * Each shift row already stores `raw_hours`, `effective_hours`, and (with breaks) `break_duration_minutes`.
 * In a future phase, this shift data will be grouped by packer, client, and time period to produce invoice line items (e.g. hours worked × rate), exported as CSV/PDF or pushed into an invoicing system.

### Project context

* **Stack**: Next.js 14 App Router, TypeScript, TailwindCSS.
* **Backend**: Supabase (Postgres + Auth + RLS).
* **Auth roles**:

  * *Packer* – regular warehouse worker, manages their own shifts.
  * *Manager* – can see all shifts for a day.

### Core domain

Single main table (plus auth):

`public.shifts`

```sql
id                      bigserial PK
user_id                 uuid FK -> auth.users.id
date                    date
start_time              timestamptz
end_time                timestamptz null
break_start             timestamptz null
break_end               timestamptz null
break_duration_minutes  int default 0
raw_hours               numeric null
effective_hours         numeric null
packages                int null
notes                   text null
earnings                numeric null
status                  text not null default 'active'
created_at              timestamptz default now()
updated_at              timestamptz default now()
```

`public.profiles`

* Mirrors `auth.users` (id + role + full_name + etc.).
* Used for displaying names on the manager view.

**RLS** (current state, simplified):

* `profiles`:

  * Owner can `select` and `update` where `auth.uid() = id`.
  * We **removed** older policies that caused recursive lookups.
* `shifts`:

  * Packers:

    * `INSERT` / `SELECT` / `UPDATE` limited to `user_id = auth.uid()`.
  * Managers:

    * A `SELECT` policy that allows managers to see all shifts (manager page uses admin client anyway).

Important: for packer flows we always use the **user client** (RLS enforced). Manager flow uses an **admin client** on the server.

---

### Frontend routing overview

* `/login` – existing email/password login (unchanged).
* `/app/dashboard` – packer dashboard.
* `/manager/shifts` – manager daily overview.

Main files touched:

* `src/app/app/dashboard/actions.ts` – server actions for shifts & breaks.
* `src/app/app/dashboard/dashboard-feature.tsx` – packer dashboard UI (client component).
* `src/app/app/dashboard/page.tsx` – server component that fetches data and renders `DashboardFeature`.
* `src/app/manager/shifts/page.tsx` – manager overview (server component).

---

### Packer dashboard – current behaviour

**Definition of “active shift”**

* A shift is considered *active* if:

  * `user_id = current_user_id` and
  * `end_time IS NULL`.
* Status column is used as:

  * `'active'` – on shift, not on break.
  * `'on_break'` – currently on break.
  * `'completed'` – ended.

#### Server actions

All in `actions.ts`, using `createClient` (user client) and `revalidatePath('/app/dashboard')` at the end.

1. **`clockIn(prevState, formData)`**

* Gets current user via `supabase.auth.getUser()`.

* Checks for an active shift:

  ```ts
  .from('shifts')
  .select('id, start_time, end_time, status')
  .eq('user_id', user.id)
  .is('end_time', null)
  .maybeSingle()
  ```

* If a shift exists → returns `{ success: false, error: 'You already have an active shift.' }`.

* Otherwise:

  * Inserts a new row:

    ```ts
    {
      user_id: user.id,
      date: currentDateISO("YYYY-MM-DD"),
      start_time: now.toISOString(),
      status: 'active'
    }
    ```

* Returns `{ success: true, message: 'Clocked in successfully' }`.

2. **`startBreak(prevState, formData)`**  *(added later)*

* Only valid if there is an active (non-break) shift for the user.
* Finds that shift: same pattern as above but `status = 'active'`.
* Sets:

  * `break_start = now`
  * `status = 'on_break'`
* Does **not** touch `raw_hours` / `effective_hours` yet (those are finalised on `clockOut`).
* Revalidates dashboard.

3. **`endBreak(prevState, formData)`**

* Finds current `on_break` shift (`end_time IS NULL AND status = 'on_break'`).

* Computes additional break minutes:

  ```ts
  const diffMs = now.getTime() - new Date(break_start).getTime()
  const minutes = Math.max(0, Math.round(diffMs / 60000))
  ```

* Updates:

  * `break_duration_minutes = break_duration_minutes + minutes`
  * `break_start = null` (optionally set `break_end` to `now`)
  * `status = 'active'`

* Revalidates dashboard.

4. **`clockOut(shiftId, prevState, formData)`**

* Called with the active shift id bound in the client component.

  ```ts
  const clockOutWithId = clockOut.bind(null, activeShift.id)
  ```

* Refetches that shift to get `start_time` and `break_duration_minutes`.

* Calculates:

  ```ts
  const rawHours = diffMs / 3600000
  const breakHours = break_duration_minutes / 60
  const effectiveHours = Math.max(0, rawHours - breakHours)

  // rounded to 2 decimals for storage
  ```

* Updates the row:

  ```ts
  {
    end_time: now.toISOString(),
    status: 'completed',
    raw_hours: rawHoursRounded,
    effective_hours: effectiveHoursRounded
  }
  ```

* Revalidates dashboard.

All actions return a uniform `ActionState`:

```ts
type ActionState = { error?: string; success?: boolean; message?: string }
```

Errors from Supabase are logged on the server and surfaced in a small alert on the dashboard.

---

### Packer dashboard – UI details

Implemented in `dashboard-feature.tsx` as a client component.

**Top header**

* Title: **Dashboard**
* Subtitle: user full name (from `profiles`) or email.

**Current status card**

* States:

  1. **Clocked out** (no active shift):

     * Pill: “Clocked Out” (grey).
     * Text: “Ready to start your shift?”
     * Single primary button: `Start Shift` → `clockIn` server action.

  2. **Clocked in, working** (`status === 'active'`):

     * Pill: “Clocked In” (green).
     * Big timer in the center: `hh:mm:ss` elapsed since `start_time`.
     * Subtext: “Started at HH:mm”.
     * Buttons:

       * Primary (red): `End Shift` → `clockOut`.
       * Secondary (outline): `Start Break` → `startBreak`.

  3. **On break** (`status === 'on_break'`):

     * Pill: “On Break” (yellow).
     * Big timer still shows *shift* elapsed time, not break time.
     * Subtexts:

       * “On break since HH:mm”
       * “Shift started at HH:mm”
     * Buttons:

       * Primary (amber): `End Break` → `endBreak`.
       * Secondary (outline): `End Shift` → `clockOut`.

* Timer implementation:

  * `useState(now)` + `useEffect` that sets `setInterval` at 1000ms when there is an active shift.
  * `useMemo` computes the elapsed string (`hh:mm:ss`) from `activeShift.start_time` and `now`.

**Recent activity card**

* Title: “Recent activity” (left) and “Last 10 shifts” (right, small grey).

* Today label: “TODAY – 7 DEC” (all caps, small, grey).

* For each shift:

  Layout (Tailwind-ish):

  ```html
  <li class="rounded-2xl bg-slate-50 px-4 py-3 flex items-center justify-between">
    <div>
      <div class="text-sm font-medium text-slate-900">
        18:39 – 18:41
      </div>
      <div class="text-xs text-slate-500">
        0.03h
      </div>
    </div>

    <span class="rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600">
      Completed
    </span>
  </li>
  ```

* Status pill colours:

  * `Active` – green pill.
  * `On Break` – yellow pill (currently only in main card / spec, can be extended to list later).
  * `Completed` – light grey pill.

Currently list shows time ranges using `HH:mm – HH:mm` and `0.00h` style durations (no seconds) for readability.

---

### Manager view – `/manager/shifts`

Server component that:

1. **Fetches all shifts for “today”** using the admin Supabase client:

   * Filter by `date = current_date` (based on server timezone).
   * Returns `id, user_id, start_time, end_time, status, effective_hours` etc.

2. **Fetches profiles for those user_ids** in a second query:

   * `select id, full_name from profiles where id in (...)`.
   * Builds a `Map<user_id, full_name>` in memory.
   * This avoids the earlier FK / policy recursion issues we had when trying to join directly.

3. **Derives summary stats**:

   * **Total shifts** – count of returned rows.
   * **Active** – count of shifts with `end_time IS NULL` and `status IN ('active', 'on_break')` (depending on how you want to represent “on break”).
   * **Total hours** – sum of `effective_hours` (or `raw_hours` as fallback).

4. **Renders UI**

* Header: “Manager shifts” + “Today’s overview” + “Log out” link.
* Summary card with 3 columns:

  * Total (count).
  * Active (count).
  * Hours (sum, e.g. `0.1h`).
* List of shift cards:

  ```html
  <article class="rounded-3xl bg-white px-6 py-4 shadow-lg">
    <header class="flex justify-between items-center mb-2">
      <h2 class="text-base font-semibold text-slate-900">João Silva</h2>
      <span class="rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600">
        Completed
      </span>
    </header>

    <div class="flex justify-between text-xs text-slate-500">
      <div>
        <div>Start</div>
        <div class="text-sm text-slate-900">04:15 PM</div>
      </div>
      <div>
        <div>End</div>
        <div class="text-sm text-slate-900">04:16 PM</div>
      </div>
      <div class="text-right">
        <div>Hours</div>
        <div class="text-sm text-slate-900">0.01</div>
      </div>
    </div>
  </article>
  ```

---

### Bugs we hit & how we fixed them

1. **“Start shift” did nothing (button went to “Starting shift” then back)**

   * Root cause: the original server action wasn’t surfacing Supabase errors; UI just reset state.
   * Fix:

     * Added detailed logging in `clockIn`.
     * Returned structured `ActionState` instead of throwing.
     * Displayed error messages in the dashboard.

2. **Supabase error: `infinite recursion detected in policy for relation "profiles"`**

   * Caused by a misconfigured RLS policy on `public.profiles` that referenced itself in a way that recursed.
   * Although our query was on `shifts`, some underlying policy path or FK was pulling `profiles` in.
   * Fix:

     * Dropped all existing `profiles` policies.
     * Recreated two minimal policies:

       * `select` where `auth.uid() = id`.
       * `update` where `auth.uid() = id`.

3. **Error: “JSON object requested, multiple (or no) rows returned” on `.maybeSingle()`**

   * Triggered when the DB already had multiple active shifts for the same user.
   * Fix:

     * Temporarily disabled RLS.
     * Cleaned test data: `DELETE FROM public.shifts;`.
     * Kept the invariant: at most one active shift per user by checking before insert.

4. **Manager page: “Failed to load shifts” & FK join issues**

   * Attempted to join `shifts` → `profiles` directly, ran into foreign key / RLS combinations that caused errors.
   * Fix:

     * Switched to a two-step query (shifts first, then profiles by `IN` list).
     * Used the **admin** Supabase client on the server.

5. **Break tracking & hours calculation**

   * Needed to ensure `effective_hours` always accounts for breaks.
   * Fix:

     * `startBreak` and `endBreak` maintain `break_duration_minutes` per shift.
     * `clockOut` subtracts break hours from raw hours and rounds.

---

### Lessons learned so far

* **RLS will bite you if policies are too clever**
  Keep policies simple and composable. The recursive profiles policy cost us a lot of time until we reset it to “owner can read/update self”.

* **Always read the Supabase error body**
  Adding explicit logging in server actions (including `code`, `message`, `details`) made debugging much easier.

* **One source of truth for “active shift”**
  We now strictly define “active” as `end_time IS NULL` (plus optional status check). This is used consistently in both UI and actions.

* **Admin vs user clients**

  * Packer actions **must** use the user client so RLS enforces ownership.
  * Manager pages are a good place to use the admin client – but handle joins yourself.

* **AI codegen is powerful, but supervision matters**
  Antigravity did most of the mechanical work, but we had to:

  * Adjust prompts.
  * Inspect logs & DB state.
  * Fix schema/policy issues manually.

---

### How to run & verify (for the next dev)

1. **Setup**

   * Ensure `.env.local` has:

     * `NEXT_PUBLIC_SUPABASE_URL`
     * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     * `SUPABASE_SERVICE_ROLE_KEY`
   * Run migrations / apply the `shifts` table SQL and RLS policies if not present.

2. **Local commands**

   ```bash
   npm install
   npm run lint
   npm run build
   npm run dev
   ```

3. **Manual test (packer)**

   * Log in as `packer@example.com`.
   * Visit `/app/dashboard`.
   * Flow:

     1. See “Clocked Out”.
     2. Click **Start Shift** – should show timer + “Clocked In”, Recent activity first row “Active”.
     3. Click **Start Break** – card switches to “On Break”, break timer label correct.
     4. Click **End Break** – back to Clocked In.
     5. Click **End Shift** – card returns to “Clocked Out”, Recent activity now has a “Completed” row with non-zero `0.xx h`.

4. **Manual test (manager)**

   * Log in as `manager@example.com`.
   * Visit `/manager/shifts`.
   * Should see:

     * Summary stats.
     * List of shifts for today with names filled from `profiles`.
     * Active count reflecting current packer status.

---

### Next steps / open items

Short-term:

1. **Mobile QA**

   * Validate `/app/dashboard` and `/manager/shifts` on ~375px width.
   * Check card padding, timer line wraps, button sizes, “Recent activity” scroll behaviour.

2. **Recent activity UX**

   * Option: show HH:MM:SS on each shift instead of only 2 decimals of hours.
   * Option: highlight current active shift row (e.g. green border).

3. **On-break visibility in manager list**

   * Currently break status is emphasised only in the packer main card.
   * We might want a status pill “On Break” in manager cards as well.

4. **Data boundaries**

   * Manager page only shows “today”. Future: date filter or range picker.
   * Packer recent list is limited to last N shifts (10); might want pagination later.

Medium-term:

* Export shifts for payroll (CSV / API).
* Basic analytics (per packer total hours / packages, etc.).
* Graceful handling of timezones (warehouse local time vs server time).
