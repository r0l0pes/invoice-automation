# User stories – v1

## P1 – Packer login

**Story**

As a packer, I want to log in with my email and password so that I can access my dashboard and shifts.

**Acceptance criteria**

- There is a login page with email + password fields and a "Sign in" button.
- Successful login redirects to the packer dashboard if the user role is `packer`.
- If the user role is `manager`, redirect to the manager view instead.
- Invalid credentials show an error message without leaking details.

---

## P2 – Packer clock in

**Story**

As a packer, I want to clock in with one tap so that my shift start time is recorded.

**Acceptance criteria**

- If I have no active shift today, the dashboard shows status "Not clocked in" and a "Clock in" button.
- When I tap "Clock in":
  - A new shift is created with:
    - `user_id = current user`
    - `date = today`
    - `start_time = now`
    - `status = 'active'`
  - The dashboard updates to show the active shift state.
- If I already have an active shift, the "Clock in" button is not visible.

---

## P3 – Packer break (one break per shift)

**Story**

As a packer, I want to start and end a single break during my shift so that break time is excluded from paid hours.

**Acceptance criteria**

- While the shift status is `active` and no break has been recorded yet:
  - I can see a "Start break" button.
- When I tap "Start break":
  - `break_start` is set to now.
  - Shift `status` becomes `on_break`.
- While the shift is `on_break`:
  - I see an "End break" button (no "Start break").
- When I tap "End break":
  - `break_end` is set to now.
  - `break_duration_minutes` is computed and stored.
  - Shift `status` returns to `active`.
- I cannot start a second break in the same shift (v1 limitation).

---

## P4 – Packer clock out with summary

**Story**

As a packer, I want to see a summary of my shift and confirm packages and notes when I clock out, so that the final working hours and earnings are saved correctly.

**Acceptance criteria**

- From an `active` shift, I can tap "Clock out".
- The app shows a summary screen with:
  - Clock in time
  - Clock out time (proposed as "now")
  - Total time
  - Break time
  - Working time
  - Estimated earnings (= working time rounded up * hourly rate)
- I can fill:
  - Packages packed (required)
  - Notes (optional)
- When I tap "Submit & clock out":
  - `end_time` is saved.
  - `raw_hours` is computed: (end_time – start_time – break_duration).
  - `effective_hours` is computed: `ceil(raw_hours * 2) / 2`.
  - `earnings = effective_hours * hourly_rate`.
  - `status = 'completed'`.
- After saving, I see a confirmation screen ("Shift completed") with the final data.

---

## P5 – Packer shift history

**Story**

As a packer, I want to see a list of my past shifts so that I can check what I worked this month.

**Acceptance criteria**

- There is a "Shift history" page accessible from the dashboard.
- By default, it shows shifts for the current month, sorted by date descending.
- Each shift in the list shows:
  - Date
  - Start time – end time
  - Working hours (effective)
  - Break duration
  - Packages
  - Earnings
- Only the current user's shifts are shown.

---

## P6 – Packer profile

**Story**

As a packer, I want to maintain my profile, including emergency contact and optional billing data, so that my information is up to date and ready for future invoices.

**Acceptance criteria**

- There is a "My profile" page.
- Required fields:
  - Full legal name
  - Employee ID
  - Emergency contact name
  - Emergency contact phone
- Optional fields:
  - Street address
  - City, postal code
  - Tax/VAT/Sozialversicherungsnummer
  - Bank name
  - IBAN
  - BIC
  - Account holder name
- I can update and save these fields.
- Validation errors are shown clearly (e.g. missing required fields, invalid phone format).

---

## M1 – Manager login & role routing

**Story**

As a manager, I want to log in and land on the manager view so that I can see all shifts.

**Acceptance criteria**

- Manager uses the same login form (email/password).
- If the user role is `manager`, they are redirected to `/manager/shifts` after login.
- Access to manager routes is restricted to `role = 'manager'`.

---

## M2 – Manager "All shifts" view

**Story**

As a manager, I want to see all shifts from all workers with basic details so that I have a consolidated view of hours worked.

**Acceptance criteria**

- There is a `/manager/shifts` page.
- The page shows:
  - A simple filter for worker (dropdown or search).
  - A filter for date/month (e.g., month picker or date range).
- The table shows the following columns:
  - Date
  - Worker name
  - Start time
  - End time
  - Working hours (effective_hours)
  - Break duration
  - Packages
  - Notes (truncated if long)
  - Earnings
- Only authenticated managers can access this page.

---

## M3 – Total hours today (manager)

**Story**

As a manager, I want to see the total hours worked today across all workers so that I understand today’s cost at a glance.

**Acceptance criteria**

- At the top of the manager "All shifts" page, there is a summary line like:
  - "Total hours today: XX.X h"
- This value is calculated as:
  - Sum of `effective_hours` for all shifts:
    - `status = 'completed'`
    - `date = today`
- If there are no shifts today, it shows "0 h" or a clear empty state.

---

## M4 – Export CSV

**Story**

As a manager, I want to export the current list of shifts as a CSV file so that I can use the data in accounting tools.

**Acceptance criteria**

- There is a button "Export CSV" on the manager "All shifts" page.
- When clicked:
  - The app generates a CSV file based on the current filters (worker, date/month).
  - The CSV contains at least the same columns as the table view.
  - The browser downloads the file.
- Only managers can trigger and download this CSV.
