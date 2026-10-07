import { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import type { Car, CarDocument, Item, ItemKind, ServiceRecord } from './types'
import { AppDataProvider, useApp } from './data/AppData'
import { localStore } from './data/localStore'
import { firebaseStore } from './data/firebaseStore'
import { auth, cloudEnabled, signInWithGoogle } from './data/firebase'
import { Icon, type IconName } from './components/Icon'
import { Splash } from './components/Chrome'
import { GoogleMark } from './components/GoogleMark'
import { Scene } from './components/Scene'
import { isGuest, moveGuestData, setGuest } from './data/guest'
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
import { Intro, Tour, isOnboarded, markOnboarded } from './screens/Onboarding'

export type SheetState =
  | { t: 'odo' }
  | { t: 'service'; kind?: ItemKind; record?: ServiceRecord }
  | { t: 'item'; item?: Item }
  | { t: 'doc'; doc?: CarDocument }
  | { t: 'car'; car?: Car }
export type OpenSheet = (s: SheetState) => void
type Tab = 'home' | 'services' | 'docs'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!cloudEnabled)
  const [guest, setGuestState] = useState(isGuest)
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, u => {
      setUser(u)
      setAuthReady(true)
    })
  }, [])

  const userId = user?.uid ?? null
  const store = useMemo(() => (cloudEnabled ? (userId ? firebaseStore(userId) : null) : localStore), [userId])

  // A guest who signs in takes their cars along to the account.
  useEffect(() => {
    if (!userId || !isGuest()) return
    setMoving(true)
    moveGuestData(firebaseStore(userId))
      .catch(e => console.error('moving guest data failed', e))
      .finally(() => {
        setGuestState(false)
        setMoving(false)
      })
  }, [userId])

  if (!authReady || moving) return <Splash />
  if (!store && guest) {
    return (
      <AppDataProvider key="guest" store={localStore}>
        <Main email={null} accountName={null} guest />
      </AppDataProvider>
    )
  }
  if (!store)
    return (
      <Login
        onGuest={() => {
          setGuest(true)
          setGuestState(true)
        }}
      />
    )
  return (
    <AppDataProvider key={userId ?? 'local'} store={store}>
      <Main email={user?.email ?? null} accountName={user?.displayName ?? null} />
    </AppDataProvider>
  )
}

function Main({ email, accountName, guest = false }: { email: string | null; accountName: string | null; guest?: boolean }) {
  const [localName, setLocalName] = useState(getLocalName)
  const userName = localName.trim() || accountName?.split(' ')[0] || null
  const saveName = (n: string) => {
    setLocalName(n)
    storeLocalName(n.trim())
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

  // First run: name and car (Intro), then a walk over the home screen (Tour).
  const [guide, setGuide] = useState<'intro' | 'tour' | 'done'>(() => (isOnboarded() ? 'done' : 'intro'))
  const addingFromIntro = useRef(false)
  useEffect(() => {
    if (loading || guide !== 'intro' || !car) return
    // a car added from the intro starts the tour; someone who already has cars skips the guide
    if (addingFromIntro.current) setGuide('tour')
    else {
      markOnboarded()
      setGuide('done')
    }
  }, [car, loading, guide])
  const endTour = () => {
    markOnboarded()
    setGuide('done')
  }
  const startTour = () => {
    setDrawer(null)
    setTab('home')
    window.scrollTo({ top: 0 })
    setTimeout(() => setGuide('tour'), 450) // let the drawer close and the page arrive
  }

  if (loading || !splashDone) return <Splash />

  return (
    <div className="shell">
      {error && <div className="banner">שגיאה בטעינת הנתונים: {error}</div>}
      <div className="page" key={car ? tab : 'empty'}>
        {!car && guide === 'intro' ? (
          <Intro
            name={userName ?? ''}
            onName={saveName}
            onAddCar={() => {
              addingFromIntro.current = true
              setSheet({ t: 'car' })
            }}
          />
        ) : tab === 'home' || !car ? (
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
        <nav className="nav" data-tour="nav">
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
      {drawer === 'settings' && <SettingsDrawer email={email} guest={guest} name={localName} onName={saveName} onTour={startTour} onClose={() => setDrawer(null)} />}
      {guide === 'tour' && car && tab === 'home' && !sheet && <Tour name={userName ?? ''} onDone={endTour} />}
    </div>
  )
}


function Login({ onGuest }: { onGuest(): void }) {
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="shell">
      <div className="welcome login reveal">
        <Scene />
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
          onClick={() => signInWithGoogle().catch(e => setErr(e instanceof Error ? e.message : String(e)))}
        >
          <GoogleMark />
          התחברות עם Google
        </button>
        <button className="btn guest-btn" onClick={onGuest}>
          כניסה כאורח
        </button>
        <div className="guest-hint">כאורח, הנתונים נשמרים רק במכשיר הזה. אפשר להתחבר אחר כך ולהעביר אותם.</div>
        {err && <div className="banner">{err}</div>}
      </div>
    </div>
  )
}
