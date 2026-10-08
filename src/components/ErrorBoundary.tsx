import { Component, type ReactNode } from 'react'
import { ErrorPage } from './ErrorPage'
import { recordError } from '../lib/errors'

/** If something on screen breaks: a friendly page and a way out, never a blank white one. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    recordError(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <ErrorPage
        title="משהו השתבש"
        text="הנתונים שלכם שמורים. טעינה מחדש בדרך כלל פותרת את זה."
        action={{ label: 'טעינה מחדש', onClick: () => location.reload() }}
      />
    )
  }
}
