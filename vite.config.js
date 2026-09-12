import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  // 生产构建移除调试 console（log/debug/info/trace）与 debugger；保留 warn/error 以维持
  // main.jsx 全局错误兜底的可观测性。dev 模式 minify 关闭，console 不受影响。
  esbuild: {
    pure: ['console.log', 'console.debug', 'console.info', 'console.trace'],
    drop: ['debugger'],
  },
  plugins: [
    react(),
    legacy({
      // legacy 产物(es5 + 全量 polyfill)给不支持 module 的老浏览器；
      // modernPolyfills 给"支持 module 但缺新 API"的 Safari 14–15.3
      // (Object.hasOwn/.at()/Promise.any 需 15.4/15+) —— 这是修复白屏的关键开关。
      // 显式列出 core-js 模块替代全量 true（89KB → ~N KB）：
      // - src 实际用到的 ES2021+ API：matchAll/flatMap(Safari 13+ 原生，无需补)
      // - 宁多勿漏的保守项：未直接使用但三方库/未来代码常见（structuredClone、
      //   Promise.any、Array.fromAsync、error cause 等），逐项核对过
      //   node_modules/core-js/modules 存在对应模块文件
      targets: ['defaults', 'iOS >= 14', 'Safari >= 14'],
      modernPolyfills: [
        'es.array.at',
        'es.string.at-alternative',
        'es.object.has-own',
        'es.string.replace-all',
        'es.array.find-last',
        'es.array.find-last-index',
        'es.promise.any',
        'es.aggregate-error',
        'es.error.cause',
        'es.global-this',
        'web.queue-microtask',
        'web.structured-clone',
        'es.array.from-async',
      ],
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    // 现代产物语法降到 es2020：保留 async/await、?? 、?. 原生支持(Safari14 起原生支持)，
    // 覆盖支持 module 但仍缺部分 ES2021+ API 的 Safari 14–15.3。
    target: 'es2020',
    // 生成 sourcemap 但不在产物中引用（hidden）：便于把 .map 上传到错误监控平台后定位源码行。
    // 部署由 deploy.yml 的 rsync --exclude='*.map' 排除，避免源码泄露到生产。
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react'],
        }
      }
    }
  }
})
