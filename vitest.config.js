import { defineConfig } from 'vitest/config'

// 独立测试配置 —— 故意不合并进 vite.config.js：
// 1) 避免 vitest 默认环境拖累（本配置显式 environment: 'node'）
// 2) 不引入 jsdom 依赖；将来需要 DOM 的测试在文件顶部用
//    // @vitest/environment jsdom 注释按文件覆盖
export default defineConfig({
  // 与 vite.config.js 里 @vitejs/plugin-react 的 automatic JSX runtime 对齐：
  // 独立测试配置没有 react 插件，esbuild 默认走 classic runtime，
  // 源码 .jsx（未 import React）在测试里会报 "React is not defined"
  esbuild: { jsx: 'automatic' },
  test: {
    // 默认 node 环境：现有 src/utils 与 server 测试均为纯函数/Node 侧逻辑
    environment: 'node',
    // 允许 describe/it/expect 全局写法（现有测试目前是显式 import，二者兼容）
    globals: true,
    // 排除构建产物等，保留 vitest 默认排除项（node_modules/dist 等）
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
    ],
    coverage: {
      provider: 'v8',
      // 起步阈值低，先跑通流水线，后续随用例增加再收紧
      thresholds: {
        statements: 15,
        branches: 15,
        functions: 15,
        lines: 15,
      },
      include: ['src/**/*.{js,jsx}', 'server/**/*.js'],
      exclude: ['**/*.test.js', '**/node_modules/**', '**/dist/**'],
    },
  },
})
