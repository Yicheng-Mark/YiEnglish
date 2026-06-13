import { Component } from 'react'

/**
 * 全局错误边界：捕获子树渲染期错误，显示友好降级 UI 而非白屏。
 * 模块脚本加载/解析失败（发生在 React 之外）由 index.html 内联脚本处理，
 * 运行时渲染错误由这里处理。
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const msg = this.state.error?.message || String(this.state.error || '未知错误')
    const stack = this.state.info?.componentStack || ''

    // 使用内联样式 + CSS 变量（带兜底值），避免在样式未加载时也崩掉
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: 'var(--color-background, #ffffff)',
          color: 'var(--color-content, #111827)',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>😵</div>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 8px' }}>页面出错了</h2>
          <p style={{ fontSize: 14, opacity: 0.7, margin: '0 0 18px' }}>
            可能是版本更新导致的缓存问题，刷新通常可以恢复。
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 28px',
              border: 'none',
              borderRadius: 8,
              background: 'var(--color-primary, #2563eb)',
              color: '#ffffff',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            刷新页面
          </button>
          <details style={{ textAlign: 'left', marginTop: 16, fontSize: 12, opacity: 0.6 }}>
            <summary style={{ cursor: 'pointer' }}>错误详情（可截图反馈给开发者）</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 8 }}>
              {msg}
              {stack ? `\n${stack}` : ''}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
