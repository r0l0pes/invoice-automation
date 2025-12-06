# Invoice automation & hours tracking – PRD v1

## 1. Context

At a comic-books fulfillment center, packers currently track their hours manually and send monthly invoices based on those hours. The process is tedious, error-prone and not standardized. The goal of this project is to build a mobile-first web app to track shifts per worker and give the manager a unified view of all hours — as a first step towards full invoice automation.

## 2. Objectives (v1)

- Enable packers to:
  - Clock in, start a break, end a break, and clock out from their phone.
  - Review their past shifts and basic working stats.
  - Store the personal/billing info required for future invoice generation.

- Enable the manager to:
  - See all shifts from all workers in one place.
  - See **total hours worked today**.
  - Export all shifts to CSV for accounting.

- Prepare the data model and profile fields needed for v2:
  - Invoice generation based on shifts and hourly rate.
  - Optional automation via n8n or similar tools.

## 3. Users & roles

### Packer

- Works on the warehouse floor.
- Limited time/attention per interaction.
- Needs a very simple, tap-first UI on mobile.
- Sees only their own shifts & profile.

### Manager

- Oversees multiple workers and shifts.
- Needs a simple overview of "who worked when" and total hours today.
- Should be able to export data for accounting.
- Sees shifts from all workers.

## 4. Key user flows (v1)

### Packer

1. **Log in**
   - Opens app.
   - Enters email and password.
   - Lands on packer dashboard.

2. **Start a shift (clock in)**
   - On dashboard, sees status “Not clocked in”.
   - Taps “Clock in”.
   - App creates an active shift with start time = now.
   - Dashboard updates to show “Active shift” state.

3. **Break**
   - While shift is active, user can tap “Start break”.
   - App sets `break_start = now` and status = `on_break`.
   - While on break, user sees “On break” state and can tap “End break”.
   - App sets `break_end = now`, calculates break duration, sets status back to `active`.
   - v1 supports exactly **one break per shift**.

4. **End shift (clock out)**
   - From active state, user taps “Clock out”.
   - App shows a summary screen:
     - Clock in time, clock out time
     - Total time, break time, working time
     - Estimated earnings (working time rounded up to 0.5h * hourly rate)
   - User enters:
     - Packages packed (required)
     - Notes (optional)
   - Taps “Submit & clock out”.
   - App:
     - Saves end_time
     - Computes `raw_hours`, `effective_hours`, `earnings`
     - Sets status = `completed`
   - User sees a “Shift completed” confirmation screen.

5. **View shift history**
   - User opens “Shift history”.
   - Sees a list of shifts (default: current month).
   - Can tap an item to view details (optional for v1 if time allows).

6. **Update profile**
   - User opens “My profile”.
   - Can update:
     - Full legal name (required)
     - Employee ID (required)
     - Emergency contact name (required)
     - Emergency contact phone (required)
     - Billing details (optional in v1):
       - Address, tax/VAT/Sozialversicherungsnummer, bank data
   - Changes are saved to profile.

### Manager

1. **Log in**
   - Manager logs in with email/password.
   - Lands on “All shifts” view.

2. **View all shifts**
   - Sees a table of shifts with filters:
     - Worker
     - Date or month
   - Column set:
     - Date
     - Worker name
     - Start time
     - End time
     - Working hours (effective)
     - Break duration
     - Packages
     - Notes
     - Earnings

3. **See total hours today**
   - At the top of the screen, manager sees an aggregate “Total hours today”.
   - This is the sum of `effective_hours` for all completed shifts dated today.

4. **Export CSV**
   - Manager clicks “Export CSV”.
   - App downloads a CSV file with the same columns as the table, based on the current filters.

## 5. Functional requirements (v1)

- System must support two roles: `packer` and `manager`.
- Packers:
  - Can create exactly one active shift at a time.
  - Can have at most one break per shift in v1.
  - Can only access and edit their own shifts.
- Managers:
  - Can access all shifts.
  - Can filter by worker and by date/month.
  - Can export filtered data as CSV.
- Working hours calculation:
  - `raw_hours = (end_time - start_time - break_duration) in hours`
  - `effective_hours = ceil(raw_hours * 2) / 2` (round up to the next 0.5h)
  - `earnings = effective_hours * hourly_rate` (default 13 €/h)
- Profile fields:
  - Must store all the data needed for invoice generation in v2, but only some fields are required in v1.

## 6. Non-functional requirements

- Mobile-first layout (optimized for phones, but usable on desktop).
- 0 cost in terms of infrastructure:
  - Vercel (free tier) for hosting the Next.js app.
  - Supabase (free tier, EU region) for auth and Postgres.
- Basic security & privacy:
  - Supabase Row Level Security enabled.
  - Packers can only read/write their own data.
  - Managers can read all shifts.
  - No secrets (.env, Supabase keys) are committed to the repository.
- Code hosted on a public GitHub repository (MIT license).

## 7. Out of scope (v1)

- Invoice generation (HTML/PDF, emails).
- Multi-break per shift.
- Manager dashboards with productivity metrics and comparisons vs previous periods.
- Notification system (reminders to fill shifts).
- n8n or other automation tools.
