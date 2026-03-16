import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import { createReadStream, existsSync, statSync } from 'node:fs'

const isLibMode = process.env.MODE === 'lib'

// https://vitejs.dev/config/
export default defineConfig({
  // Allow overriding the base URL for GitHub Pages project deployments.
  // Example: VITE_BASE_URL=/ai-for-data-blog/ npm run build
  base: process.env.VITE_BASE_URL ?? '/',

  plugins: [
    vue(),
    // Vuetify with autoImport tree-shakes unused components — much smaller than CDN bundle.
    vuetify({ autoImport: true }),
    // Dev only: serve the sibling ../data directory at /data so the default
    // manifest URL (data/prwp/manifest.json) works without a separate server.
    {
      name: 'serve-parent-data',
      configureServer(server: ViteDevServer) {
        // Use import.meta.url — __dirname is not reliable in ESM vite.config.ts
        const dataDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '../semantic-search/data')
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/data/')) { next(); return }
          const rel = req.url.slice('/data/'.length).split('?')[0]
          const filePath = resolve(dataDir, rel)
          // Security: reject path-traversal attempts
          if (!filePath.startsWith(dataDir)) { next(); return }
          if (!existsSync(filePath) || !statSync(filePath).isFile()) { next(); return }
          const ext = filePath.split('.').pop() ?? ''
          const ct =
            ext === 'json' ? 'application/json' :
            ext === 'gz'   ? 'application/gzip'  :
                             'application/octet-stream'
          res.setHeader('Content-Type', ct)
          createReadStream(filePath).pipe(res)
        })
      },
    },
  ],

  resolve: {
    // Use the extern-WASM build of onnxruntime-web so Rollup does NOT inline
    // the WASM binary as base64. The worker sets env.backends.onnx.wasm.wasmPaths
    // to load WASM from CDN at runtime instead.
    conditions: ['onnxruntime-web-use-extern-wasm'],
    alias: {
      '@': fileURLToPath(new URL('./demo', import.meta.url)),
    },
  },

  // Vite compiles TypeScript workers referenced via new URL('./workers/foo.ts', import.meta.url)
  // automatically when worker.format is 'es'.
  worker: {
    format: 'es',
  },

  css: {
    preprocessorOptions: {
      scss: {
        // Inject CSS variables into every component <style lang="scss"> block so
        // they can reference --primary-dark, etc. without a manual @use.
        additionalData: `@use "@/styles/variables" as *;\n`, // @ → demo/
      },
    },
  },

  build: isLibMode
    ? {
        // ── Library build: produces importable ES modules ──────────────────────
        // Run with: pnpm build:lib
        target: 'es2022',
        minify: 'esbuild',
        lib: {
          entry: {
            index: resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/index.ts'),
            // Worker bundled as a self-contained ES module for static hosting
            'search.worker': resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/workers/search.worker.ts'),
            'adapters/vue': resolve(fileURLToPath(new URL('.', import.meta.url)), 'adapters/vue.ts'),
            'adapters/react': resolve(fileURLToPath(new URL('.', import.meta.url)), 'adapters/react.ts'),
          },
          formats: ['es'],
        },
        rollupOptions: {
          // Don't bundle framework deps — consumers provide them
          external: ['vue', 'react', 'react/jsx-runtime'],
          output: {
            // Keep adapters in their own files matching the exports map
            entryFileNames: '[name].js',
            chunkFileNames: 'chunks/[name]-[hash].js',
          },
        },
      }
    : {
        // ── App build: produces the demo Vite app ──────────────────────────────
        // Run with: pnpm build
        target: 'es2022',
        rollupOptions: {
          output: {
            // Split large dependencies into separate chunks so the main bundle
            // doesn't block page load. The ONNX model itself is fetched at runtime
            // (not bundled), but the transformers.js library code is separate.
            manualChunks: {
              transformers: ['@huggingface/transformers'],
              vuetify: ['vuetify'],
            },
          },
        },
      },

  // Enable top-level await (needed by @huggingface/transformers in workers)
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
})
