import React, { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[RootErrorBoundary] Caught unhandled runtime error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Smart Canteen OS Notice</h1>
            <p className="text-sm text-slate-300">
              An unexpected interface error occurred during startup.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-red-300 font-mono text-left break-words overflow-auto max-h-36">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Reload Interface
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const basename = window.location.pathname.startsWith('/canteen-module')
  ? '/canteen-module'
  : '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </RootErrorBoundary>
  </StrictMode>,
)

