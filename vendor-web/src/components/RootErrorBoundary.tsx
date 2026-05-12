import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null; errorInfo: ErrorInfo | null }

/** Surfaces React render errors instead of a blank page (common when a route module throws). */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RootErrorBoundary:', error, errorInfo)
    this.setState({ errorInfo })
  }

  override render() {
    const { error, errorInfo } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans">
        <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-red-800">Vendor app failed to render</h1>
          <p className="mt-2 text-sm text-slate-600">
            Open DevTools (F12) → Console for details. If you just updated the repo, try stopping Vite, deleting{' '}
            <code className="rounded bg-slate-100 px-1">vendor-web/node_modules/.vite</code>, then{' '}
            <code className="rounded bg-slate-100 px-1">npm run dev</code> again.
          </p>
          <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100 whitespace-pre-wrap">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
            {errorInfo?.componentStack ? `\n\n${errorInfo.componentStack}` : ''}
          </pre>
          <button
            type="button"
            className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
