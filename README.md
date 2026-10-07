# הרכב שלי · Car Records

A Hebrew (RTL) PWA that keeps everything about your cars in one place: km, services, test (טסט), insurance and documents, with reminders by km or by date.

- **Smart km.** The app estimates today's km from your last reading and your own daily average. A weekly card asks “is it about right?”. You can also photograph the dashboard and AI reads the number.
- **Plate lookup.** Type the plate number and make, model, year, colour and the test expiry come from the Ministry of Transport open data (data.gov.il).
- **Car photo with no background.** A model photo (imagin.studio, optional key), or your own photo with the background removed on the phone.
- **Reminders.** Each item (service, test, insurance, tyres, brakes, battery, custom) is due at a km limit or a date, whichever comes first. You can export them to the phone calendar (.ics) with an alert 7 days before.
- **Cloud.** Supabase with Google login and row level security. Without Supabase settings the app runs in local demo mode, with the data in the browser.

The plan this was built from: [docs/PLAN.html](docs/PLAN.html).

## Run locally

```bash
npm install
npm run dev
```

With no `.env`, the app runs in **local mode**. That is enough to try everything except reading km from a photo.

## Connect the cloud (Supabase + Google login)

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in the SQL editor, or use `supabase db push`.
3. **Authentication → Providers → Google:** enable it and paste a Google OAuth client ID and secret. In Google Cloud, add `https://<project>.supabase.co/auth/v1/callback` as a redirect URI.
4. **Authentication → URL configuration:** add your site URL, for example `http://localhost:5173`.
5. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Km from a dashboard photo

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy read-odometer
```

The function sends the photo to Claude (`claude-opus-5-5`, low effort, structured JSON output) and returns `{ km }`. The photo is not stored.

### Studio renders of the car (recommended)

The home screen shows a studio render of each car, built from the make, model, year and colour that the plate lookup returns.

1. Get a customer key from [imagin.studio](https://www.imagin.studio) (contact sales for a trial).
2. Put it in `.env` as `VITE_IMAGIN_KEY=...`.

The licence says images must load from their CDN and must never be stored, so the app builds the URL each time and keeps no copy. Each image load counts as one licence use. Without a key the app shows the user's own photo (background removed on the phone), or a drawing of the car in its colour.

## Stack

React 19 + TypeScript + Vite, `vite-plugin-pwa`, Supabase (Postgres, Auth, Storage, Edge Functions), `@imgly/background-removal` (runs on the device), plain CSS with the Assistant font.

```
src/
  domain/    km estimate, due logic, reminders, default items
  data/      Store interface: localStore (IndexedDB) and supabaseStore
  lib/       plate lookup, car image, cutout, .ics export, Hebrew formatting
  screens/   Home, Services, Documents, Settings + sheets
supabase/
  migrations/0001_init.sql
  functions/read-odometer/
```
