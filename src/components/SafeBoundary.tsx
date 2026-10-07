import { Component, type ReactNode } from 'react'

/** Shows `fallback` instead of crashing the screen when a part fails (e.g. 3D or a lazy chunk). */
export class SafeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
