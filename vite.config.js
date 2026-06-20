import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    react(),
    legacy({
      // legacy 产物(es5 + 全量 polyfill)给不支持 module 的老浏览器；
      // modernPolyfills 给"支持 module 但缺新 API"的 Safari 12–15.3
      // (structuredClone/Object.hasOwn 需 15.4+) —— 这是修复白屏的关键开关
      targets: ['defaults', 'iOS >= 12', 'Safari >= 12'],
      modernPolyfills: true,
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
    // 现代产物语法也降到 es2015，覆盖支持 module 但不支持 ?. / ?? 的 Safari 12–13.0
    target: 'es2015',
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
