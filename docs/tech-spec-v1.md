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
