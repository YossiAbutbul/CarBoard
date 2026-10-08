import { useState } from 'react'
import { Scene } from './Scene'
import { Brand } from './Brand'
import { copyText, errorDetails } from '../lib/errors'

/**
 * A full page for when the app cannot go on: a page that does not exist (404), a crash, or data that
 * would not load. Built like the sign-in screen; a friendly line and one way forward. The technical
 * part is never shown, only copied ("copy details") for the developer.
 */
export function ErrorPage({
  code,
  title,
  text,
  action,
  error,
}: {
  code?: string // shown big behind the title, e.g. 404; without it, the gauge with its needle down
  title: string
  text: string
  action: { label: string; onClick(): void }
  error?: unknown // kept out of sight; goes into the copied details
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="shell">
      <div className="welcome scenic login err-page">
        <Scene />
        <header className="login-top">
          <Brand />
        </header>
        <div className="err-art" aria-hidden="true">
          {code ? <span className="err-code">{code}</span> : <StalledGauge />}
        </div>
        <div className="login-hero">
          <h1 className="status">{title}</h1>
          <p className="login-sub">{text}</p>
          <div className="login-actions">
            <button className="btn" onClick={action.onClick}>
              {action.label}
            </button>
            <button
              className="err-copy"
              onClick={async () => {
                if (await copyText(errorDetails(error))) {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2500)
                }
              }}
            >
              {copied ? '✓ הפרטים הועתקו' : 'העתקת פרטים לתמיכה'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// the app's gauge, needle dropped to zero: something stalled
function StalledGauge() {
  return (
    <svg className="err-gauge" viewBox="0 0 512 512">
      <path d="M 144.6 360.0 A 136 136 0 1 1 367.4 360.0" fill="none" stroke="currentColor" strokeWidth="38" strokeLinecap="round" opacity="0.28" />
      <path d="M 144.6 360.0 A 136 136 0 0 1 120.5 266" fill="none" stroke="#f87171" strokeWidth="38" strokeLinecap="round" />
      <g className="err-needle">
        <line x1="256" y1="282" x2="183" y2="330" stroke="currentColor" strokeWidth="26" strokeLinecap="round" />
      </g>
      <circle cx="256" cy="282" r="30" fill="currentColor" />
      <circle cx="256" cy="282" r="10" fill="#08111f" />
    </svg>
  )
}

/** A line over the page when something failed but the app can go on (data from the device is shown). */
export function ErrorBanner({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="banner">
      {text}{' '}
      <button
        className="err-copy inline"
        onClick={async () => {
          if (await copyText(errorDetails())) {
            setCopied(true)
            setTimeout(() => setCopied(false), 2500)
          }
        }}
      >
        {copied ? 'הועתק' : 'העתקת פרטים'}
      </button>
    </div>
  )
}

/** Any address other than the app's own. */
export function NotFound() {
  return (
    <ErrorPage
      code="404"
      title="הדרך הזאת לא מובילה לשום מקום"
      text="הכתובת לא קיימת, או שהקישור ישן. כל מה שצריך מחכה בעמוד הראשי."
      action={{ label: 'לעמוד הראשי', onClick: () => location.replace('/') }}
      error={`404: ${location.pathname}`}
    />
  )
}
