/**
 * Optional Express server for serving the search app with gzip-compressed index files.
 *
 * When the pipeline is built with --compress=gzip (the default), index shards are
 * stored as .json.gz files. Static file servers (GitHub Pages, python -m http.server)
 * cannot serve these with proper Content-Encoding: gzip headers. This server handles
 * .json.gz requests by setting Content-Type: application/json and Content-Encoding: gzip
 * so the browser decompresses them transparently.
 *
 * For static hosting (GitHub Pages), run the pipeline with --compress=none instead.
 *
 * Usage: npm run serve
 * Env vars: PORT (default 3000), DIST_DIR (default ../dist), DATA_DIR (default ../data)
 */
import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 3000)
const DIST_DIR = path.resolve(__dirname, process.env.DIST_DIR ?? '../dist')
const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR ?? '../data')

const app = express()

// Serve .json.gz files with correct headers so the browser decompresses them
app.use((req, res, next) => {
  if (req.path.endsWith('.json.gz')) {
    res.set('Content-Type', 'application/json')
    res.set('Content-Encoding', 'gzip')
    res.set('Cache-Control', 'public, max-age=86400') // 1 day cache
  }
  next()
})

// Serve the built Vite app from dist/
app.use(express.static(DIST_DIR))

// Serve data/ directory (index files, manifest.json, etc.)
// This allows the app to reference ?manifest=data/prwp/manifest.json
app.use('/data', express.static(DATA_DIR))

// Fallback: serve index.html for client-side routing (SPA)
app.get('*', (_req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html')
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    res.status(404).send('dist/index.html not found. Run `npm run build` first.')
  }
})

app.listen(PORT, () => {
  console.log(`Search server running at http://localhost:${PORT}`)
  console.log(`  App:  ${DIST_DIR}`)
  console.log(`  Data: ${DATA_DIR}`)
  console.log(`  Pass ?manifest=data/prwp/manifest.json to select a collection`)
})
