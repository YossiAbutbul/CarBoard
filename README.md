# הרכב שלי · Car Records

A Hebrew (RTL) PWA that keeps everything about your cars in one place: km, services, test (טסט), insurance and documents, with reminders by km or by date.

- **Smart km.** The app estimates today's km from your last reading and your own daily average. A weekly card asks “is it about right?”.
- **Plate lookup.** Type the plate number and make, model, year, colour and the test expiry come from the Ministry of Transport open data (data.gov.il).
- **Reminders.** Each item (service, test, insurance, tyres, brakes, battery, custom) is due at a km limit or a date, whichever comes first. You can export them to the phone calendar (.ics) with an alert 7 days before.
- **Cloud.** Supabase with Google login and row level security. Without Supabase settings the app runs in local demo mode, with the data in the browser.

The plan this was built from: [docs/PLAN.html](docs/PLAN.html).

## Run locally

```bash
npm install
npm run dev
```

With no `.env`, the app runs in **local mode**. That is enough to try everything.

## Connect the cloud (Supabase + Google login)

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in the SQL editor, or use `supabase db push`.
3. **Authentication → Providers → Google:** enable it and paste a Google OAuth client ID and secret. In Google Cloud, add `https://<project>.supabase.co/auth/v1/callback` as a redirect URI.
4. **Authentication → URL configuration:** add your site URL, for example `http://localhost:5173`.
5. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Car avatar columns

Also run [`supabase/migrations/0002_car_avatar.sql`](supabase/migrations/0002_car_avatar.sql). It adds the optional `body` and `paint` columns for the car avatar.

## Stack

React 19 + TypeScript + Vite, `vite-plugin-pwa`, Supabase (Postgres, Auth, Storage), plain CSS with Noto Sans Hebrew, Lucide icons (`lucide-react`).

```
src/
  domain/    km estimate, due logic, reminders, default items
  data/      Store interface: localStore (IndexedDB) and supabaseStore
  lib/       plate lookup, .ics export, Hebrew formatting
  screens/   Home, Services, Documents, Settings + sheets
supabase/
  migrations/0001_init.sql
  functions/read-odometer/
```
