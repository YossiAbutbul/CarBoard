import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Car, CarDocument, Item, ItemKind, ServiceRecord } from './types'
import { AppDataProvider, useApp } from './data/AppData'
import { localStore } from './data/localStore'
import { supabaseStore } from './data/supabaseStore'
import { cloudEnabled, supabase } from './data/supabase'
import { Icon, type IconName } from './components/Icon'
import { Splash } from './components/Chrome'
import { HomeScreen } from './screens/HomeScreen'
import { ServicesScreen } from './screens/ServicesScreen'
import { DocumentsScreen } from './screens/DocumentsScreen'
import { CarsDrawer, SettingsDrawer } from './screens/Drawers'
import { getLocalName, storeLocalName } from './lib/profile'
import { OdometerSheet } from './screens/OdometerSheet'
import { ServiceSheet } from './screens/ServiceSheet'
import { ItemSheet } from './screens/ItemSheet'
import { DocumentSheet } from './screens/DocumentSheet'
import { CarSheet } from './screens/CarSheet'

export type SheetState =
  | { t: 'odo' }
  | { t: 'service'; kind?: ItemKind; record?: ServiceRecord }
  | { t: 'item'; item?: Item }
  | { t: 'doc'; doc?: CarDocument }
  | { t: 'car'; car?: Car }
export type OpenSheet = (s: SheetState) => void
type Tab = 'home' | 'services' | 'docs'

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
      <Main
        email={session?.user.email ?? null}
        accountName={(session?.user.user_metadata?.full_name ?? session?.user.user_metadata?.name ?? null) as string | null}
      />
    </AppDataProvider>
  )
}

function Main({ email, accountName }: { email: string | null; accountName: string | null }) {
  const [localName, setLocalName] = useState(getLocalName)
  const userName = localName || accountName?.split(' ')[0] || null
  const saveName = (n: string) => {
    setLocalName(n)
    storeLocalName(n)
  }
  const { car, loading, error } = useApp()
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [drawer, setDrawer] = useState<null | 'cars' | 'settings'>(null)
  const close = () => setSheet(null)
  // Let the loading animation play once, even when local data loads instantly.
  const [splashDone, setSplashDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1100)
    return () => clearTimeout(t)
  }, [])
  const openCars = () => setDrawer('cars')
  const openSettings = () => setDrawer('settings')

  if (loading || !splashDone) return <Splash />

  return (
    <div className="shell">
      {error && <div className="banner">שגיאה בטעינת הנתונים: {error}</div>}
      <div className="page" key={car ? tab : 'empty'}>
        {tab === 'home' || !car ? (
          <HomeScreen open={setSheet} openCars={openCars} openSettings={openSettings} userName={userName} />
        ) : tab === 'services' ? (
          <ServicesScreen open={setSheet} openCars={openCars} openSettings={openSettings} />
        ) : (
          <DocumentsScreen open={setSheet} openCars={openCars} openSettings={openSettings} />
        )}
      </div>

      {car && tab === 'services' && (
        <button className="fab" onClick={() => setSheet({ t: 'service' })} aria-label="טיפול חדש">
          <Icon name="plus" />
        </button>
      )}
      {car && tab === 'docs' && (
        <button className="fab" onClick={() => setSheet({ t: 'doc' })} aria-label="מסמך חדש">
          <Icon name="plus" />
        </button>
      )}

      {car && (
        <nav className="nav">
          <div>
          {(
            [
              ['home', 'car', 'הרכב'],
              ['services', 'service', 'טיפולים'],
              ['docs', 'docs', 'מסמכים'],
            ] as [Tab, IconName, string][]
          ).map(([id, icon, label]) => (
            <button
              key={id}
              className={tab === id ? 'on' : ''}
              onClick={() => {
                setTab(id)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              <span className="ico">
                <Icon name={icon} />
              </span>
              {label}
            </button>
          ))}
          </div>
        </nav>
      )}

      {sheet?.t === 'odo' && <OdometerSheet onClose={close} />}
      {sheet?.t === 'service' && <ServiceSheet onClose={close} kind={sheet.kind} record={sheet.record} />}
      {sheet?.t === 'item' && (
        <ItemSheet item={sheet.item} onClose={close} onDone={it => setSheet({ t: 'service', kind: it.kind })} />
      )}
      {sheet?.t === 'doc' && <DocumentSheet doc={sheet.doc} onClose={close} />}
      {sheet?.t === 'car' && <CarSheet car={sheet.car} onClose={close} />}
      {drawer === 'cars' && <CarsDrawer open={setSheet} onClose={() => setDrawer(null)} />}
      {drawer === 'settings' && <SettingsDrawer email={email} name={userName ?? ''} onName={saveName} onClose={() => setDrawer(null)} />}
    </div>
  )
}


function Login() {
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="shell">
      <div className="welcome reveal">
        <div className="eyebrow" style={{ color: 'rgba(255,255,255,.7)' }}>הרכב שלי</div>
        <div className="status">
          <span>כל</span>
          <span>הרכב.</span>
          <span>במקום</span>
          <span>אחד.</span>
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="btn"
          style={{ background: '#fff' }}
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
        {err && <div className="banner">{err}</div>}
      </div>
    </div>
  )
}
