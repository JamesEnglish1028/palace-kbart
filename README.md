# KBART, MARC Exporter

A lightweight React app for exporting KBART Holdings and MARC Bibliographic
records from Palace Manager collections. It uses public OPDS feeds to locate
libraries and collections, then downloads KBART CSV or MARC (MARC21/MARCXML)
files with Palace web catalog URLs.

**Quick Start**
1. Install dependencies:

```bash
npm install
```

2. Create a `.env` from the example:

```bash
cp .env.example .env
```

3. Start the dev server:

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

**Environment Variables**
- `VITE_FEED_BASE` (default `/public`): OPDS base (optional when using absolute URLs).
- `VITE_REGISTRY_BASE` (optional): Palace registry base for library sync
  (defaults to `https://registry.palaceproject.io/libraries`).
- `VITE_BASE_URL` (optional): Fallback Palace base URL for `/works/...` if
  discovery services do not provide one.
- `VITE_WEB_CLIENT_URL` (optional): Fallback Palace web client URL if discovery
  services do not provide one.
- `VITE_BASE_PATH` (optional): Base path for static hosting (default `/`).
- `VITE_OPDS_PROXY_BASE` (optional): Proxy endpoint for OPDS requests when
  running on static hosting (e.g., `https://your-proxy.example.com/opds-proxy`).
- `VITE_WEB_PROXY_BASE` (optional): Proxy endpoint for web client lookup when
  running on static hosting (e.g., `https://your-proxy.example.com/web-proxy`).
- `VITE_REGISTRY_PROXY_BASE` (optional): Proxy endpoint for registry sync when
  running on static hosting (e.g., `https://your-proxy.example.com/registry-proxy`).
- `VITE_LOC_PROXY_BASE` (optional): Proxy endpoint for Library of Congress lookups
  (e.g., `https://your-proxy.example.com/loc-proxy`).
- `VITE_OL_PROXY_BASE` (optional): Proxy endpoint for Open Library lookups
  (e.g., `https://your-proxy.example.com/ol-proxy`).

**KBART Columns**
- `title_id`
- `publication_title`
- `title_url`
- `first_author`
- `online_identifier`
- `publisher_name`
- `publication_type`
- `date_monograph_published_online`
- `first_editor`
- `access_type`
- `source_id`
- `source_id_type`
- `vendor_id` (populated for DOI, CNRI Handle, UUID)
- `isbn` (enriched via Library of Congress when enabled)

MARC output supports:
- `MARC21 (ISO 2709)` and `MARCXML` formats
- Basic book mapping + audiobook mapping (when `metadata["@type"]` is
  `schema.org/Audiobook`)

Title URLs are constructed using the Palace web catalog URL pattern.

This app uses TypeScript components and a registry-sync hook to keep the UI
maintainable and testable.

**Render Deployment**
This repo includes a `render.yaml` that provisions:
1. A web service proxy for OPDS (`palace-kbart-proxy`)
2. A static site for the UI (`palace-kbart`)

After the first deploy, update the static site environment variables to point
at the proxy service URL, for example:

- `VITE_OPDS_PROXY_BASE=https://palace-kbart-proxy.onrender.com/opds-proxy`
- `VITE_WEB_PROXY_BASE=https://palace-kbart-proxy.onrender.com/web-proxy`
- `VITE_REGISTRY_PROXY_BASE=https://palace-kbart-proxy.onrender.com/registry-proxy`
- `VITE_LOC_PROXY_BASE=https://palace-kbart-proxy.onrender.com/loc-proxy`
- `VITE_OL_PROXY_BASE=https://palace-kbart-proxy.onrender.com/ol-proxy`
- `VITE_LOC_PROXY_BASE=https://palace-kbart-proxy.onrender.com/loc-proxy`
