import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { reportClientError } from './utils/reportError'
import './index.css'

// 兜底：把未捕获的 Promise rejection / 运行时错误打到控制台，避免完全静默。
// （渲染错误由 ErrorBoundary 处理；模块加载失败由 index.html 内联脚本处理。）
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason)
  reportClientError('unhandledrejection', event.reason)
})
window.addEventListener('error', (event) => {
  if (event.error || event.message) {
    console.error('[window error]', event.error || event.message)
    reportClientError('window', event.error || new Error(event.message))
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
