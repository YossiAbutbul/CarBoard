import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * A delete button that asks in place instead of window.confirm (which some
 * browsers and installed apps block): the first tap arms it, the second deletes.
 * It disarms itself after 3 seconds.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmText = 'לחצו שוב למחיקה',
  icon = false,
  label,
  className = '',
  style,
}: {
  onConfirm(): void | Promise<void>
  children?: ReactNode
  confirmText?: string
  icon?: boolean // a small trash icon instead of a full button
  label?: string // aria-label for the icon form
  className?: string
  style?: React.CSSProperties
}) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  async function click(e: React.MouseEvent) {
    e.stopPropagation()
    if (!armed) return setArmed(true)
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
      setArmed(false)
    }
  }

  if (icon)
    return (
      <button className={`icon-btn confirm-icon ${armed ? 'armed' : ''} ${className}`} style={style} onClick={click} aria-label={armed ? confirmText : label} disabled={busy}>
        <Icon name="trash" />
        {/* a tooltip above the button, so arming it does not move anything around it */}
        {armed && (
          <span className="confirm-tip" role="status">
            לחצו שוב
          </span>
        )}
      </button>
    )
  return (
    <button className={`${className} ${armed ? 'armed' : ''}`} style={style} onClick={click} disabled={busy}>
      {armed ? confirmText : children}
    </button>
  )
}
