// Bundles the server code (server/*.ts, which shares the reminder logic in src/domain) into
// self-contained Vercel functions in api/. Run by `npm run build:api`; the output is committed,
// because Vercel finds functions in api/ before it builds.
import { build } from 'esbuild'

await build({
  entryPoints: { reminders: 'server/reminders.ts', 'push-test': 'server/push-test.ts' },
  outdir: 'api',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external: ['firebase-admin', 'web-push'],
  banner: { js: '// Generated from server/ by scripts/build-api.mjs. Do not edit.' },
  logLevel: 'warning',
})
console.log('api built')
