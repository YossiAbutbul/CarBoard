import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { ask } from './Dialog'

/** A delete button that asks "are you sure?" in a dialog before it acts. */
export function ConfirmButton({
  onConfirm,
  children,
  question = 'למחוק?',
  detail,
  confirmLabel = 'מחיקה',
  icon = false,
  label,
  className = '',
  style,
}: {
  onConfirm(): void | Promise<void>
  children?: ReactNode
  question?: string // the dialog's title
  detail?: string // a line under it: what will be deleted
  confirmLabel?: string
  icon?: boolean // a small trash icon instead of a full button
  label?: string // aria-label for the icon form
  className?: string
  style?: React.CSSProperties
}) {
  const [busy, setBusy] = useState(false)

  async function click(e: React.MouseEvent) {
    e.stopPropagation()
    if (!(await ask({ title: question, text: detail, confirm: confirmLabel, danger: true }))) return
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  if (icon)
    return (
      <button className={`icon-btn confirm-icon ${className}`} style={style} onClick={click} aria-label={label} disabled={busy}>
        <Icon name="trash" />
      </button>
    )
  return (
    <button className={className} style={style} onClick={click} disabled={busy}>
      {children}
    </button>
  )
}
