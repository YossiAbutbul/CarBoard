import { initializeApp } from 'firebase/app'
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check'
import { delMany, keys } from 'idb-keyval'
import { GoogleAuthProvider, getAuth, signInWithPopup, signInWithRedirect, signOut as fbSignOut } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
}

/** Without Firebase settings the app runs in local mode (data stays in this browser). */
export const cloudEnabled = Boolean(config.apiKey && config.projectId && config.appId)

const app = cloudEnabled ? initializeApp(config) : null

// App Check: Firebase answers only this app (verified by reCAPTCHA in the background), not scripts
// using the API key. On when VITE_RECAPTCHA_ENTERPRISE_KEY is set (a reCAPTCHA key in this Google
// Cloud project). On localhost it uses a debug token registered in Firebase → App Check.
const siteKey = env.VITE_RECAPTCHA_ENTERPRISE_KEY as string | undefined
if (app && siteKey) {
  if (location.hostname === 'localhost') {
    ;(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      (env.VITE_APPCHECK_DEBUG_TOKEN as string | undefined) || true
  }
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true })
}
export const auth = app ? getAuth(app) : null
// Offline cache: the app opens and works without a connection, and syncs when it is back.
export const db = app
  ? initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  : null

export async function signInWithGoogle() {
  if (!auth) return
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    // installed apps and some phones block popups: go by redirect instead
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, provider)
    else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') throw e
  }
}

/** Sign out, and clear this account's files cached on the device. */
export async function signOut() {
  const stale = (await keys().catch(() => [])).filter(k => String(k).startsWith('file-cache:'))
  await delMany(stale).catch(() => {})
  if (auth) await fbSignOut(auth)
}
