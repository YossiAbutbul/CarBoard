/**
 * The top bar's two buttons, as icons that turn into an X when their drawer opens, both the same way:
 * first the icon gathers to the centre (the menu's lines meet, the gear spins down to a point), then
 * two lines swing out into the X. `open` drives it (CSS transitions).
 */
export function MorphIcon({ kind, open }: { kind: 'menu' | 'gear'; open: boolean }) {
  return (
    <span className={`morph ${kind} ${open ? 'open' : ''}`} aria-hidden="true">
      {kind === 'menu' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          {/* drawn on the centre line and moved apart, so the X turns around the true centre */}
          <line className="l1" x1="4" y1="12" x2="20" y2="12" />
          <line className="l2" x1="4" y1="12" x2="20" y2="12" />
        </svg>
      ) : (
        <>
          {/* the gear (Lucide's settings icon) */}
          <svg className="gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {/* the same two lines as the menu's, swinging out of the centre into the same X */}
          <svg className="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <line className="l1" x1="4" y1="12" x2="20" y2="12" />
            <line className="l2" x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </>
      )}
    </span>
  )
}
