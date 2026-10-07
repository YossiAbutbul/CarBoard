# CarBoard · הרכב שלי

A Hebrew (RTL) PWA that keeps everything about your cars in one place: km, services, test (טסט), insurance and documents, with reminders by km or by date.

- **Smart km.** The app estimates today's km from your last reading and your own daily average. A weekly card asks “is it about right?”.
- **Plate lookup.** Type the plate number and make, model, year, colour and the test expiry come from the Ministry of Transport open data (data.gov.il).
- **Reminders.** Each item (service, test, insurance, tyres, brakes, battery, custom) is due at a km limit or a date, whichever comes first. You can export them to the phone calendar (.ics) with an alert 7 days before.
- **Cloud.** Firebase on the free Spark plan: Google login and Firestore (works offline and syncs), which also holds the photos and receipts, compressed. Each user can reach only their own data. Without Firebase settings the app runs in local mode, with the data in the browser.

The plan this was built from: [docs/PLAN.html](docs/PLAN.html).

## Run locally

```bash
npm install
npm run dev
```

With no `.env`, the app runs in **local mode**. That is enough to try everything.

## Connect the cloud (Firebase + Google login)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Build → Authentication → Sign-in method:** enable **Google**.
3. **Build → Firestore Database:** create a database (production mode, a region near you, e.g. `eur3`).
4. **Project settings → Your apps → Web (`</>`):** register an app and copy its config into `.env` (see [`.env.example`](.env.example)).
5. Deploy the security rules:

   ```bash
   firebase use --add
   firebase deploy --only firestore:rules
   ```

Data layout: `users/<uid>/<table>/<id>`, and files in `users/<uid>/files/<id>` (base64, up to 700 KB each; photos are compressed to WebP first). No Storage, so no Blaze plan. [`firestore.rules`](firestore.rules) lets each user reach only their own folder.

## Deploy (Vercel)

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new). [`vercel.json`](vercel.json) sets the Vite build.
2. **Settings → Environment Variables:** add the six `VITE_FIREBASE_*` values.
3. In Firebase, **Authentication → Settings → Authorized domains:** add your Vercel domain (e.g. `car-records.vercel.app`).

## Stack

React 19 + TypeScript + Vite, `vite-plugin-pwa`, Firebase (Auth, Firestore), plain CSS with Noto Sans Hebrew, Lucide icons (`lucide-react`).

```
src/
  domain/    km estimate, due logic, reminders, default items
  data/      Store interface: localStore (IndexedDB) and firebaseStore
  lib/       plate lookup, .ics export, Hebrew formatting
  screens/   Home, Services, Documents, Settings + sheets
firestore.rules   per-user access
```
