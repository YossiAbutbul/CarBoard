import { useEffect, useState } from 'react'
import { userMessage } from '../lib/errors'
import { createPortal } from 'react-dom'
import { ConfirmButton } from '../components/ConfirmButton'
import { ask, askText } from '../components/Dialog'
import { checkForUpdate } from '../lib/update'
import { track } from '../lib/activity'
import { disablePush, enablePush, loadPrefs, pushState, resavePush, savePrefs, testPush, type PushState } from '../lib/push'
import { DEFAULT_PREFS, type NotifyPrefs } from '../domain/notify'
import { Drawer } from '../components/ui'
import { Plate } from '../components/Chrome'
import { CarToy, carPaint } from '../components/CarAvatar'
import { Icon } from '../components/Icon'
import { useApp } from '../data/AppData'
import { cloudEnabled, signInWithGoogle, signOut } from '../data/firebase'
import { setGuest } from '../data/guest'
import { GoogleMark } from '../components/GoogleMark'
import { downloadIcs } from '../lib/ics'
import { fmtNum } from '../lib/i18n'
import type { OpenSheet } from '../App'
import type { Family } from '../data/store'
import { useBackLayer } from '../lib/back'

/** Car switcher: opens from the right, where its button is. */
export function CarsDrawer({ open, onClose }: { open: OpenSheet; onClose(): void }) {
  const { data, car, setCarId, actions, family, store } = useApp()
  const ownerName = (uid?: string) => (uid && uid !== store.userId ? family?.members.find(m => m.uid === uid)?.name || 'בן משפחה' : null)
  return (
    <Drawer title={family ? (family.title ? `הרכבים של מש' ${family.title.replace(/^(משפחת|מש['׳])\s*/, '')}` : 'רכבי המשפחה') : 'הרכבים שלי'} side="start" onClose={onClose}>
      <div className="car-list">
        {data.cars.map(c => (
          <div key={c.id} className={`car-row ${c.id === car?.id ? 'on' : ''}`}>
            <button
              className="car-row-main"
              onClick={() => {
                setCarId(c.id)
                onClose()
              }}
              aria-current={c.id === car?.id}
            >
              {/* the tile takes a faint wash of the car's own colour */}
              <span className="car-row-pic" style={{ '--tint': carPaint(c) } as React.CSSProperties}>
                <CarToy car={c} />
              </span>
              <span className="car-row-info">
                <span className="t">{c.name}</span>
                <span className="s">{[ownerName(c.owner) && `של ${ownerName(c.owner)}`, c.year, c.color].filter(Boolean).join(' · ')}</span>
                {c.plate && <Plate number={c.plate} size="sm" />}
              </span>
            </button>
            <span className="car-row-acts">
              <button
                className="icon-btn"
                onClick={() => {
                  onClose()
                  open({ t: 'car', car: c })
                }}
                aria-label={`עריכת ${c.name}`}
              >
                <Icon name="edit" />
              </button>
              {/* only the person who added a car can delete it */}
              {!ownerName(c.owner) && (
                <ConfirmButton icon label={`מחיקת ${c.name}`} question={`למחוק את ${c.name}?`} detail="הרכב וכל מה ששייך לו יימחקו: ק״מ, טיפולים, תזכורות ומסמכים." onConfirm={() => actions.deleteCar(c.id)} />
              )}
            </span>
          </div>
        ))}
      </div>
      <button
        className="btn pri"
        style={{ marginTop: 14 }}
        onClick={() => {
          onClose()
          open({ t: 'car' })
        }}
      >
        הוספת רכב <Icon name="plus" />
      </button>
    </Drawer>
  )
}

/** Settings: opens from the left, where its button is. */
export function SettingsDrawer({
  email,
  guest = false,
  name,
  onName,
  onTour,
  onSummary,
  onClose,
}: {
  email: string | null
  guest?: boolean
  name: string
  onName(n: string): void
  onTour(): void
  onSummary(): void // the monthly summary
  onClose(): void
}) {
  const { car, km, reminders, store, actions, data } = useApp()
  return (
    <Drawer title="הגדרות" side="end" onClose={onClose}>
      <section className="drawer-sec">
        <div className="drawer-label">השם שלך</div>
        <button
          className="name-row"
          onClick={async () => {
            const next = await askText({ title: 'השם שלך', text: 'מופיע בברכה במסך הבית.', input: { value: name, placeholder: 'למשל: יוסי' }, confirm: 'שמירה' })
            if (next !== null && next.trim() !== name.trim()) {
              onName(next)
              store.family?.rename(next).catch(() => {}) // the family sees the new name too
            }
          }}
        >
          <span>{name || 'בלי שם'}</span>
          <Icon name="edit" />
        </button>
      </section>
      {car && (
        <section className="drawer-sec">
          <button className="btn" style={{ background: 'var(--card)' }} onClick={onSummary}>
            <Icon name="calendar" /> סיכום חודשי
          </button>
          <button className="btn" style={{ background: 'var(--card)', marginTop: 8 }} onClick={onTour}>
            <Icon name="search" /> סיור באפליקציה
          </button>
        </section>
      )}
      {store.mode === 'cloud' && <FamilySection myName={name || email?.split('@')[0] || ''} />}
      {car && <PushSection cloud={store.mode === 'cloud'} />}
      {car && (
        <section className="drawer-sec">
          <div className="drawer-label">יומן</div>
          <div className="card">
            <div className="item" style={{ padding: 0 }}>
              <span className="ic">
                <Icon name="calendar" />
              </span>
              <div>
                <div className="t">הוספה ליומן של הטלפון</div>
                <div className="s">התראה 7 ימים לפני כל מועד. מועדי ק״מ לפי {fmtNum(km.perDay)} ק״מ ביום.</div>
              </div>
            </div>
            <button className="btn" style={{ marginTop: 14, background: '#fff' }} onClick={() => downloadIcs(car, reminders.filter(r => r.status !== 'unset'))}>
              ייצוא ליומן
            </button>
          </div>
        </section>
      )}

      <section className="drawer-sec">
        <div className="drawer-label">חשבון</div>
        <div className="card">
          <div className="item" style={{ padding: 0 }}>
            <span className="ic">
              <Icon name={store.mode === 'cloud' ? 'cloud' : 'device'} />
            </span>
            <div>
              <div className="t">{store.mode === 'cloud' ? 'מסונכרן לענן' : 'שמור במכשיר הזה'}</div>
              <div className="s">
                {store.mode === 'cloud' ? email : guest ? 'מצב אורח. התחברו כדי לגבות ולסנכרן בין מכשירים; הנתונים יעברו לחשבון.' : 'כדי לסנכרן בין מכשירים ולהתחבר עם Google, צריך לחבר Firebase (ראה README).'}
              </div>
            </div>
          </div>
          {store.mode === 'cloud' && (
            <button className="btn" style={{ marginTop: 14, background: '#fff' }} onClick={() => signOut()}>
              התנתקות
            </button>
          )}
          {guest && cloudEnabled && (
            <>
              <button className="btn" style={{ marginTop: 14, background: '#fff' }} onClick={() => signInWithGoogle()}>
                <GoogleMark /> התחברות עם Google
              </button>
              <button
                className="btn"
                style={{ marginTop: 8, background: 'none', color: 'var(--muted)', fontWeight: 500 }}
                onClick={() => {
                  setGuest(false)
                  location.reload()
                }}
              >
                יציאה ממצב אורח
              </button>
            </>
          )}
        </div>
      </section>
      {data.cars.length > 0 && (
        <section className="drawer-sec">
          <div className="drawer-label">איפוס</div>
          <div className="card">
            <div className="s" style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              מוחק את כל הרכבים, הטיפולים, המסמכים והקבצים{store.mode === 'cloud' ? ' מהחשבון' : ' מהמכשיר הזה'}, ומתחיל מההתחלה. אי אפשר לבטל.
            </div>
            <ConfirmButton
              className="btn danger"
              style={{ marginTop: 14 }}
              question="לאפס את כל הנתונים?" detail="כל הרכבים, הטיפולים, המסמכים והקבצים יימחקו. אי אפשר לבטל." confirmLabel="איפוס"
              onConfirm={async () => {
                await actions.resetAll()
                await store.wipeFiles?.().catch(() => {}) // a file that is already gone must not stop the reset
                try {
                  for (const k of Object.keys(localStorage)) if (k.startsWith('car-records:')) localStorage.removeItem(k)
                } catch {
                  // storage blocked
                }
                location.reload()
              }}
            >
              <Icon name="trash" /> איפוס כל הנתונים
            </ConfirmButton>
          </div>
        </section>
      )}
      <VersionLine />
      <div className="credit" dir="ltr">
        © {new Date().getFullYear()} Yossi Abutbul. All rights reserved.
      </div>
    </Drawer>
  )
}

/** Push reminders on this phone: on/off, and a test notice. */
function PushSection({ cloud }: { cloud: boolean }) {
  const { family } = useApp()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<NotifyPrefs>(DEFAULT_PREFS)
  useEffect(() => {
    // the service worker may never come up (some private windows): give up after a while
    Promise.race([pushState(), new Promise<PushState>(r => setTimeout(() => r('unsupported'), 8000))])
      .then(s => {
        setState(s)
        if (s === 'on' && cloud) resavePush().catch(() => {}) // heals a phone whose earlier save failed
      })
      .catch(() => setState('unsupported'))
    if (cloud) loadPrefs().then(setPrefs).catch(() => {})
  }, [cloud])
  const toggle = (next: NotifyPrefs) => {
    setPrefs(next)
    track(savePrefs(next)).catch(e => setMsg(userMessage(e)))
  }
  const WHEN: [string, number | 'late'][] = [
    ['חודש לפני', 30],
    ['שבועיים', 14],
    ['שבוע', 7],
    ['יום לפני', 1],
    ['ביום עצמו', 0],
    ['כשעבר', 'late'],
  ]
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg(userMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const note = !cloud
    ? 'התראות זמינות לחשבון מחובר. במצב אורח הנתונים נשמרים רק במכשיר.'
    : state === 'needs-install'
      ? 'באייפון: שתפו ← "הוספה למסך הבית", ופתחו את CarBoard משם כדי להפעיל התראות.'
      : state === 'blocked'
        ? 'ההתראות חסומות בהגדרות הדפדפן או הטלפון. אפשרו אותן שם ונסו שוב.'
        : state === 'unsupported'
          ? 'הדפדפן הזה לא תומך בהתראות.'
          : 'תזכורת לפני כל מועד, כל בוקר ב־9:00.'
  return (
    <section className="drawer-sec">
      <div className="drawer-label">התראות</div>
      <div className="card">
        <div className="item" style={{ padding: 0 }}>
          <span className="ic">
            <Icon name="reminder" />
          </span>
          <div style={{ flex: 1 }}>
            <div className="t">התראות לטלפון</div>
            <div className="s">{note}</div>
          </div>
          {/* asking the phone and saving it takes a few seconds: the switch waits, dimmed and pulsing, so nothing moves */}
          {cloud && (state === null || state === 'on' || state === 'off') && (
            <button
              role="switch"
              aria-checked={state === 'on'}
              aria-busy={switching || state === null}
              aria-label="התראות לטלפון"
              className={`switch ${state === 'on' ? 'on' : ''} ${switching || state === null ? 'working' : ''}`}
              disabled={busy || state === null}
              onClick={async () => {
                setSwitching(true)
                await run(async () => setState(await track(state === 'on' ? disablePush() : enablePush())))
                setSwitching(false)
              }}
            />
          )}
        </div>
        {cloud && state === 'on' && (
          <>
            <div className="drawer-label" style={{ margin: '14px 0 6px' }}>
              מתי להזכיר
            </div>
            <div className="chips when-chips">
              {WHEN.map(([label, v]) => {
                const on = v === 'late' ? prefs.late : prefs.days.includes(v)
                return (
                  <button
                    key={label}
                    className={on ? 'on' : ''}
                    aria-pressed={on}
                    onClick={() =>
                      toggle(
                        v === 'late'
                          ? { ...prefs, late: !prefs.late }
                          : { ...prefs, days: on ? prefs.days.filter(d => d !== v) : [...prefs.days, v] },
                      )
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {family && family.members.length > 1 && (
              <div className="chips when-chips" style={{ marginTop: 8 }}>
                <button className={prefs.family ? 'on' : ''} aria-pressed={Boolean(prefs.family)} onClick={() => toggle({ ...prefs, family: !prefs.family })}>
                  <Icon name="family" /> גם רכבי המשפחה
                </button>
              </div>
            )}
          </>
        )}
        {cloud && state === 'on' && (
          <button
            className="test-link"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const n = await track(testPush())
                setMsg(n ? 'נשלחה התראת ניסיון.' : 'לא נמצא טלפון רשום. כבו והפעילו מחדש.')
              })
            }
          >
            {busy ? 'שולח…' : 'שליחת התראת ניסיון'}
          </button>
        )}
        {msg && <div className="hint" style={{ marginTop: 8 }}>{msg}</div>}
      </div>
    </section>
  )
}

/** The version and build time, with a button that checks for a newer version now. */
function VersionLine() {
  const [state, setState] = useState<'idle' | 'checking' | 'new' | 'latest' | 'offline'>('idle')
  const check = async () => {
    setState('checking')
    const r = await checkForUpdate().catch(() => 'offline' as const)
    setState(r)
    if (r !== 'new') setTimeout(() => setState('idle'), 3000)
  }
  const note = { new: 'נמצאה גרסה חדשה', latest: 'זו הגרסה האחרונה', offline: 'אין חיבור לבדיקה' } as Record<string, string>
  return (
    <div className="foot">
      <span dir="ltr">
        CarBoard · v{__APP_VERSION__} · {new Date(__APP_BUILD__).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </span>
      <button className={`update-check ${state === 'checking' ? 'spinning' : ''}`} onClick={check} disabled={state === 'checking'} aria-label="בדיקת עדכונים" title="בדיקת עדכונים">
        <Icon name="refresh" />
      </button>
      {/* a toast over everything, so the settings content does not move */}
      {note[state] && createPortal(<div className="toast" role="status">{note[state]}</div>, document.body)}
    </div>
  )
}

/** Share cars with family: make a family, invite by link or code, see who is in it, leave. */
function FamilySection({ myName }: { myName: string }) {
  const { store, family, reload } = useApp()
  const api = store.family
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const show = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(null), 2600)
  }
  if (!api) return null
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      show(userMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const sendInvite = () =>
    run(async () => {
      const code = await api.invite(myName || 'בן משפחה')
      const url = `${location.origin}/?join=${code}`
      const text = `${myName || 'הוזמנת'} מזמין/ה אותך לראות את רכבי המשפחה ב־CarBoard. קוד: ${code}`
      try {
        if (navigator.share) await navigator.share({ title: 'CarBoard', text, url })
        else {
          await navigator.clipboard.writeText(`${text}
${url}`)
          show('הקישור הועתק. אפשר להדביק בווטסאפ.')
        }
      } catch {
        // closed the share sheet
      }
    })
  const joinByCode = () =>
    run(async () => {
      const code = await askText({ title: 'הצטרפות למשפחה', text: 'הקוד מההזמנה (10 תווים).', input: { value: '', placeholder: 'ABCDE23456' }, confirm: 'המשך' })
      if (!code) return
      const inv = await api.peek(code)
      if (!inv) return show('ההזמנה לא נמצאה או שפג תוקפה')
      if (!(await ask({ title: `להצטרף למשפחה של ${inv.name}?`, text: 'תראו את כל רכבי המשפחה ותוכלו לעדכן אותם.', confirm: 'הצטרפות' }))) return
      await api.join(code, myName || 'בן משפחה')
      await reload()
      show('הצטרפת למשפחה')
    })

  return (
    <section className="drawer-sec">
      <div className="drawer-label">משפחה</div>
      <div className="card">
        {!family ? (
          <>
            <div className="item" style={{ padding: 0 }}>
              <span className="ic">
                <Icon name="family" />
              </span>
              <div>
                <div className="t">שיתוף עם המשפחה</div>
                <div className="s">אתם ובני המשפחה תראו את הרכבים של כולם, ותוכלו לעדכן אותם.</div>
              </div>
            </div>
            <button
              className="btn pri"
              style={{ marginTop: 12 }}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api.create(myName || 'אני')
                  await reload()
                  await sendInvite()
                })
              }
            >
              {busy ? <span className="spin" /> : 'יצירת משפחה והזמנה'}
            </button>
            <button className="test-link" disabled={busy} onClick={joinByCode}>
              יש לי קוד הזמנה
            </button>
          </>
        ) : (
          <>
            <div className="family-head">
              <span className="ic">
                <Icon name="family" />
              </span>
              <div className="t">{family.title || 'המשפחה שלי'}</div>
              <button
                className="icon-btn"
                aria-label="שינוי שם המשפחה"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const title = await askText({ title: 'שם המשפחה', input: { value: family.title, placeholder: 'משפחת ישראלי' }, confirm: 'שמירה' })
                    if (title == null || title.trim() === family.title) return
                    await api.retitle(title)
                    await reload()
                  })
                }
              >
                <Icon name="edit" />
              </button>
            </div>
            <MembersSummary family={family} />
            <button className="btn" style={{ marginTop: 12, background: '#fff' }} disabled={busy} onClick={sendInvite}>
              {busy ? <span className="spin" /> : (
                <>
                  <Icon name="link" /> הזמנת בן משפחה
                </>
              )}
            </button>
            <div className="hint" style={{ marginTop: 6 }}>הקישור תקף לשבוע.</div>
            <ConfirmButton
              className="test-link"
              question="לצאת מהמשפחה?"
              detail="לא תראו יותר את הרכבים של בני המשפחה, והם לא יראו את שלכם. הנתונים של כל אחד נשארים אצלו."
              confirmLabel="יציאה"
              onConfirm={() => run(async () => {
                await api.leave()
                await reload()
              })}
            >
              יציאה מהמשפחה
            </ConfirmButton>
          </>
        )}
      </div>
      {toast && createPortal(<div className="toast" role="status">{toast}</div>, document.body)}
    </section>
  )
}

/**
 * The family in one line: "את/ה, דן ועוד 3", with the first letters stacked. Tapping it opens the
 * whole list.
 */
function MembersSummary({ family }: { family: Family }) {
  const [open, setOpen] = useState(false)
  const me = family.members.find(m => m.uid === family.me)
  const others = family.members.filter(m => m.uid !== family.me)
  const name = (m: Family['members'][number]) => m.name || 'בן משפחה'
  const shown = others.slice(0, 1).map(name)
  const more = others.length - shown.length
  const text = ['את/ה', ...shown].join(', ') + (more > 0 ? ` ועוד ${more}` : '')
  const people = [...(me ? [me] : []), ...others]
  return (
    <>
      <button className="members-sum" onClick={() => setOpen(true)} aria-label={`בני המשפחה: ${text}`}>
        <span className="faces" aria-hidden="true">
          {people.slice(0, 3).map(m => (
            <b key={m.uid} className={m.uid === family.me ? 'me' : ''}>
              {(m.name || '?').slice(0, 1)}
            </b>
          ))}
        </span>
        <span className="who">{text}</span>
        <Icon name="back" />
      </button>
      {open && <MembersList family={family} people={people} onClose={() => setOpen(false)} />}
    </>
  )
}

function MembersList({ family, people, onClose }: { family: Family; people: Family['members']; onClose(): void }) {
  useBackLayer(true, onClose)
  return createPortal(
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog members-dialog" role="dialog" aria-modal="true" aria-label="בני המשפחה" onClick={e => e.stopPropagation()}>
        <b>{family.title ? `משפחת ${family.title.replace(/^(משפחת|מש['׳])\s*/, '')}` : 'בני המשפחה'}</b>
        <p>{people.length} בני משפחה רואים ומעדכנים את הרכבים של כולם.</p>
        <ul className="members-list">
          {people.map(m => (
            <li key={m.uid}>
              <b className={m.uid === family.me ? 'me' : ''}>{(m.name || '?').slice(0, 1)}</b>
              <span>{m.name || 'בן משפחה'}</span>
              {m.uid === family.me && <small>את/ה</small>}
              {m.uid === family.owner && <small className="owner">יצר/ה את המשפחה</small>}
            </li>
          ))}
        </ul>
        <div className="dialog-btns one">
          <button className="dialog-ok" onClick={onClose}>
            סגירה
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
