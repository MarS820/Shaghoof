import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo })
    console.error('Runtime error:', error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '24px',
          margin: '24px',
          background: '#FEF2F2',
          border: '2px solid #DC2626',
          borderRadius: '8px',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          overflow: 'auto',
        }}>
          <h2 style={{ color: '#DC2626', marginBottom: '12px' }}>Runtime Error</h2>
          <p style={{ color: '#991B1B', fontWeight: 'bold' }}>{this.state.error?.message}</p>
          <details style={{ marginTop: '12px' }}>
            <summary style={{ cursor: 'pointer', color: '#991B1B' }}>Stack trace</summary>
            <pre style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              {this.state.error?.stack}
              {'\n\nComponent stack:\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
