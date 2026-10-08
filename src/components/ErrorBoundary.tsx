import { Component, type ReactNode } from 'react'

/**
 * If something on screen breaks, show what broke and a way out, never a blank white page. The
 * message is kept short and readable, for a screenshot to the developer.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    const e = this.state.error
    if (!e) return this.props.children
    return (
      <div className="crash" dir="rtl">
        <b>משהו השתבש</b>
        <p>הנתונים שלכם שמורים. טעינה מחדש בדרך כלל פותרת את זה.</p>
        <button className="btn pri" onClick={() => location.reload()}>
          טעינה מחדש
        </button>
        <pre dir="ltr">
          {__APP_VERSION__} · {e.name}: {e.message}
          {'\n'}
          {(e.stack ?? '').split('\n').slice(1, 4).join('\n')}
        </pre>
      </div>
    )
  }
}
