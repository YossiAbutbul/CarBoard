import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Car, CarDocument, Item, ItemKind } from './types'
import { AppDataProvider, useApp } from './data/AppData'
import { localStore } from './data/localStore'
import { supabaseStore } from './data/supabaseStore'
import { cloudEnabled, supabase } from './data/supabase'
import { CarArt } from './components/ui'
import { HomeScreen } from './screens/HomeScreen'
import { ServicesScreen } from './screens/ServicesScreen'
import { DocumentsScreen } from './screens/DocumentsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { OdometerSheet } from './screens/OdometerSheet'
import { ServiceSheet } from './screens/ServiceSheet'
import { ItemSheet } from './screens/ItemSheet'
import { DocumentSheet } from './screens/DocumentSheet'
import { CarSheet } from './screens/CarSheet'

export type SheetState =
  | { t: 'odo'; photo?: boolean }
  | { t: 'service'; kind?: ItemKind }
  | { t: 'item'; item?: Item }
  | { t: 'doc'; doc?: CarDocument }
  | { t: 'car'; car?: Car }
export type OpenSheet = (s: SheetState) => void
type Tab = 'home' | 'services' | 'docs' | 'settings'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!cloudEnabled)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null
  const store = useMemo(() => (cloudEnabled ? (userId ? supabaseStore(userId) : null) : localStore), [userId])

  if (!authReady) return <Splash />
  if (!store) return <Login />
  return (
    <AppDataProvider key={userId ?? 'local'} store={store}>
      <Main email={session?.user.email ?? null} />
    </AppDataProvider>
  )
}

function Main({ email }: { email: string | null }) {
  const { car, loading, error } = useApp()
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const close = () => setSheet(null)

  if (loading) return <Splash />

  return (
    <div className="shell">
      {error && <div className="banner">שגיאה בטעינת הנתונים: {error}</div>}
      {tab === 'home' || !car ? (
        <HomeScreen open={setSheet} />
      ) : tab === 'services' ? (
        <ServicesScreen open={setSheet} />
      ) : tab === 'docs' ? (
        <DocumentsScreen open={setSheet} />
      ) : (
        <SettingsScreen open={setSheet} email={email} />
      )}

      {car && tab === 'services' && (
        <button className="fab" onClick={() => setSheet({ t: 'service' })} aria-label="טיפול חדש">＋</button>
      )}
      {car && tab === 'docs' && (
        <button className="fab" onClick={() => setSheet({ t: 'doc' })} aria-label="מסמך חדש">＋</button>
      )}

      {car && (
        <nav className="nav">
          {(
            [
              ['home', '⌂', 'בית'],
              ['services', '🔧', 'טיפולים'],
              ['docs', '📄', 'מסמכים'],
              ['settings', '⚙️', 'הגדרות'],
            ] as [Tab, string, string][]
          ).map(([id, icon, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <b>{icon}</b>
              {label}
            </button>
          ))}
        </nav>
      )}

      {sheet?.t === 'odo' && <OdometerSheet onClose={close} startWithPhoto={sheet.photo} />}
      {sheet?.t === 'service' && <ServiceSheet onClose={close} kind={sheet.kind} />}
      {sheet?.t === 'item' && (
        <ItemSheet item={sheet.item} onClose={close} onDone={it => setSheet({ t: 'service', kind: it.kind })} />
      )}
      {sheet?.t === 'doc' && <DocumentSheet doc={sheet.doc} onClose={close} />}
      {sheet?.t === 'car' && <CarSheet car={sheet.car} onClose={close} />}
    </div>
  )
}

function Splash() {
  return (
    <div className="login">
      <span className="spin dark" />
    </div>
  )
}

function Login() {
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="login">
      <div className="box">
        <CarArt className="art" color="אדום" />
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '18px 0 6px' }}>הרכב שלי</h1>
        <p className="hint" style={{ fontSize: 15, marginBottom: 26 }}>טיפולים, ק״מ, טסט וביטוח. הכל במקום אחד, מסונכרן בין המכשירים.</p>
        <button
          className="btn google"
          onClick={async () => {
            const { error } = await supabase!.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.origin },
            })
            if (error) setErr(error.message)
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
          </svg>
          התחברות עם Google
        </button>
        {err && <div className="err">{err}</div>}
      </div>
    </div>
  )
}
