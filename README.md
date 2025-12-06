## v1 scope (MVP)

**Goal**

Build a mobile-first web app for warehouse packers to track worked hours and for the manager to see all shifts and total hours, as a first step towards full invoice automation.

**Who will use it in v1**

- **Packer** (employee at the fulfillment center)
  - Tracks their shifts (clock in, break, clock out)
  - Sees a simple dashboard and shift history
  - Manages their basic profile (incl. emergency contact, optional billing data for future invoices)

- **Manager**
  - Logs in with their own account
  - Sees all shifts from all workers
  - Sees total hours worked **today**
  - Can export all shifts to CSV

**What v1 includes**

- Email/password authentication (Supabase Auth)
- Roles:
  - `packer` – can only see and edit their own shifts
  - `manager` – can see all shifts
- Mobile-first UI inspired by the Figma screens (not pixel perfect, but close enough)
- Packer features:
  - Dashboard with:
    - Welcome message
    - Today’s date
    - Current shift status:
      - Not clocked in → button “Clock in”
      - Active shift → can start break, clock out
      - On break → can end break
    - Simple monthly cards:
      - Total hours this month
      - Estimated earnings this month (€13/h)
      - Total packages this month
  - Shift flow:
    - Clock in → creates active shift
    - Start break / End break (one break per shift in v1)
    - Clock out → summary screen (total time, break, working time, earnings) + fields for packages and notes, then “Submit & clock out”
  - Shift history:
    - List of past shifts (default: current month)
    - Each shift shows date, times, working hours, break, packages, earnings
  - Profile:
    - Required: full legal name, employee ID, emergency contact name & phone
    - Optional: billing & bank details (for future invoice generation)
- Manager features:
  - “All shifts” page with:
    - Filters: worker, date/month
    - Columns: date, worker name, start time, end time, working hours, break duration, packages, notes, earnings
    - Aggregate “Total hours today” at the top
    - Button “Export CSV”

**Explicitly NOT in v1**

- Any invoice generation (no PDF, no invoice emails)
- Any “manager dashboard” with productivity cards, trends, vs yesterday etc.
- Multi-break per shift (v1 supports one break per shift)
- Notifications or reminders
- Automations with n8n (could be added later for invoices)
