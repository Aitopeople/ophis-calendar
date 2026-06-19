import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// 라이브러리 빌드: src/index.ts 진입점, react/react-dom/rrule는 외부(번들 제외)
export default defineConfig({
  plugins: [react()],
  build: {
    copyPublicDir: false, // 라이브러리 빌드에는 public/ 에셋 복사 안 함
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'OphisCalendar',
      formats: ['es', 'cjs'],
      // ESM=.js(패키지 type:module), CJS=.cjs 확장자로 분리해야 Node가 올바르게 해석
      fileName: (format) => `ophis-calendar.${format === 'es' ? 'js' : 'cjs'}`,
    },
    cssCodeSplit: false,
    rollupOptions: {
      // react만 외부(peer). rrule은 번들에 포함시켜 자체 완결 + Node ESM interop 문제 회피
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        // 추출된 단일 CSS를 dist/style.css 로 고정
        assetFileNames: (asset) =>
          asset.names?.some((n) => n.endsWith('.css')) ? 'style.css' : (asset.names?.[0] ?? 'asset'),
      },
    },
  },
})
