# Technical spec – v1

## 1. Stack

- **Frontend**: Next.js + React + TypeScript + Tailwind CSS
- **Backend / API**: Next.js API routes
- **Auth & Database**: Supabase (Postgres, EU region)
- **Hosting**: Vercel (free tier)

## 2. Data model

### 2.1. Profiles

We extend Supabase `auth.users` with a `profiles` table.

**Table: profiles**

- `id` (uuid, primary key, references `auth.users.id`)
- `role` (text, not null, one of `'packer' | 'manager'`)
- `full_name` (text, not null)
- `employee_id` (text, not null)
- `emergency_contact_name` (text, not null)
- `emergency_contact_phone` (text, not null)
- `billing_street` (text, nullable)
- `billing_city` (text, nullable)
- `billing_postal_code` (text, nullable)
- `tax_id` (text, nullable) — Tax/VAT/Sozialversicherungsnummer
- `bank_name` (text, nullable)
- `iban` (text, nullable)
- `bic` (text, nullable)
- `account_holder_name` (text, nullable)
- `hourly_rate` (numeric, not null, default 13.0)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

Example SQL for Supabase:

```sql
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('packer', 'manager')),
    full_name text not null,
    employee_id text not null,
    emergency_contact_name text not null,
    emergency_contact_phone text not null,
    billing_street text,
    billing_city text,
    billing_postal_code text,
    tax_id text,
    bank_name text,
    iban text,
    bic text,
    account_holder_name text,
    hourly_rate numeric not null default 13,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

2.2. Shifts

Table: shifts

- id (bigint, primary key, generated always as identity)
- user_id (uuid, not null, references profiles.id / auth.users.id)
- date (date, not null)
- start_time (timestamptz, not null)
- end_time (timestamptz, nullable while shift is active)
- break_start (timestamptz, nullable)
- break_end (timestamptz, nullable)
- break_duration_minutes (integer, default 0)
- raw_hours (numeric, nullable)
- effective_hours (numeric, nullable)
- packages (integer, nullable)
- notes (text, nullable)
- status (text, not null, default 'active', check in ('active','on_break','completed','cancelled'))
- earnings (numeric, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

Example SQL:

create table public.shifts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  start_time timestamptz not null,
  end_time timestamptz,
  break_start timestamptz,
  break_end timestamptz,
  break_duration_minutes integer default 0,
  raw_hours numeric,
  effective_hours numeric,
  packages integer,
  notes text,
  status text not null default 'active' check (status in ('active','on_break','completed','cancelled')),
  earnings numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

2.3. Business rules

- Only one active shift per user at a time.
- v1 supports at most one break per shift.
- raw_hours and effective_hours are only computed when the shift is completed.
- effective_hours rounding:
  effective_hours = ceil(raw_hours * 2) / 2
- earnings = effective_hours * hourly_rate (from profiles).

3. Security & privacy

3.1. Row Level Security
Enable RLS on both tables:
alter table public.profiles enable row level security;
alter table public.shifts enable row level security;

Profiles policies
- Packers and managers can read their own profile.
- Managers may also need to read profiles to see worker names.

Example:
create policy "Profiles are readable by owner"
on public.profiles
for select
using (auth.uid() = id);

create policy "Profiles are updatable by owner"
on public.profiles
for update
using (auth.uid() = id);

-- Manager can read all profiles (for names, etc.)
create policy "Managers can read all profiles"
on public.profiles
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'manager'
  )
);

Shifts policies
-- Packers: can see their own shifts
create policy "Packers can select their own shifts"
on public.shifts
for select
using (auth.uid() = user_id);

create policy "Packers can insert their own shifts"
on public.shifts
for insert
with check (auth.uid() = user_id);

create policy "Packers can update their own shifts"
on public.shifts
for update
using (auth.uid() = user_id);

-- Managers: can see all shifts
create policy "Managers can select all shifts"
on public.shifts
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'manager'
  )
);

3.2. Secrets & environment variables

- .env.local contains:
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
- .env.local must be in .gitignore.
- No Supabase service key or private keys are ever committed.
- Repository is public, but contains only code and no real data.

3.3. GDPR mini-guidelines
- Supabase project created in an EU region.
- Collect only required personal data in v1:
  Full name, employee ID, emergency contact.
- Billing/bank data are optional in v1 and clearly marked as “for future invoice generation”.
- No raw exports of the database are stored inside the repo.

4. Routes / pages
- /login
  Shared login form for packer and manager.
- /app/dashboard
  Packer dashboard (clock in / active shift / on break / completed).
- /app/shifts
  Packer shift history.
- /app/profile
  Packer profile edit page.
- /manager/shifts
  Manager “All shifts” view with:
    Filters (worker, date/month),
    Total hours today,
    Export CSV button.

API routes (Next.js):
- /api/manager/shifts/csv
  GET.
  Requires manager auth.
  Accepts query params for filters.
  Returns CSV download.

