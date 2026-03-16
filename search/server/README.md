# Optional Node.js Server

An Express server that serves the built search app together with
gzip-compressed index files. This is only needed when the pipeline was built
with `--compress=gzip` (the default).

---

## When to use this server

Use this server when:

- You built the pipeline with `--compress=gzip` (the default).
- You are running the app locally during development and want smaller index files.
- You are deploying to a Node.js host (Render, Railway, Fly.io, etc.) and want
  compressed transfers to the browser.

The server sets `Content-Encoding: gzip` and `Content-Type: application/json`
on all `.json.gz` requests so the browser decompresses them transparently — the
JavaScript fetch/worker code sees normal JSON without any changes.

---

## When NOT to use this server

**GitHub Pages**: GitHub Pages cannot set custom response headers, so it cannot
serve `.json.gz` files with `Content-Encoding: gzip`. Two alternatives:

1. Build the index with `--compress=none` and commit the plain `.json` files.
2. Build with `--compress=gzip`, then run `decompress_for_github_pages.py` to
   convert them back to `.json`, and commit those instead.

In both cases you do not need this server.

**nginx or Caddy with `gzip_static`**: If your reverse proxy supports static
gzip pre-compression, you can serve the `.json.gz` files directly without this
Node server. See the nginx configuration below.

---

## How to start

```bash
cd search

# Install deps (first time)
npm install

# Build the Vite app (required before serving)
npm run build

# Start the server
npm run serve

# With custom options
PORT=8080 DIST_DIR=../dist DATA_DIR=../data npm run serve
```

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | TCP port to listen on |
| `DIST_DIR` | `../dist` | Path to the built Vite app (`index.html`, assets) |
| `DATA_DIR` | `../data` | Path to the pipeline data directory |

The data directory is served under `/data`, so a manifest at
`data/prwp/manifest.json` is reachable as
`http://localhost:3000/data/prwp/manifest.json`. Pass it to the app via the
query string:

```
http://localhost:3000/?manifest=data/prwp/manifest.json
```

---

## nginx configuration equivalent

If you prefer nginx over this Node server, enable static gzip pre-compression
with `gzip_static on`. nginx will automatically serve `file.json.gz` when
`file.json.gz` exists and the client sends `Accept-Encoding: gzip`.

```nginx
server {
    listen 80;
    server_name search.example.com;

    root /var/www/search;

    # Serve pre-compressed .json.gz files transparently
    location ~* \.json$ {
        gzip_static on;
        add_header Cache-Control "public, max-age=86400";
        add_header Content-Type "application/json";
    }

    # Serve the Vite SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Serve data directory
    location /data/ {
        alias /var/www/search/data/;
        gzip_static on;
        add_header Cache-Control "public, max-age=86400";
    }
}
```

For `gzip_static` to work, `ngx_http_gzip_static_module` must be compiled in
(it is included in most nginx distributions). Both `file.json` and
`file.json.gz` must be present in the same directory — nginx picks `.gz`
automatically when the client supports it.

---

## TypeScript compilation

The server is written in TypeScript and compiled by `tsx` at runtime (no
separate build step). If you want a compiled JS bundle instead:

```bash
npx tsc server/server.ts --outDir server/dist --module esnext --target es2022
node server/dist/server.js
```
