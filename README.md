# Palace KBART Exporter

A lightweight React app for exporting KBART-formatted title lists from Palace
Manager collections. It uses the public OPDS feeds to locate libraries and
collections, then downloads a KBART CSV with Palace reader URLs.

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

The app runs at `http://localhost:5173` and proxies:
- `/public` → `http://localhost:8080`

**Environment Variables**
- `VITE_API_BASE` (default `/cm`): Admin API base.
- `VITE_FEED_BASE` (default `/public`): Public OPDS base.
- `VITE_REGISTRY_BASE` (optional): Palace registry base for library sync
  (defaults to `https://registry.palaceproject.io/libraries`).
- `VITE_BASE_URL` (optional): Fallback Palace base URL for `/works/...` if
  discovery services do not provide one.
- `VITE_WEB_CLIENT_URL` (optional): Fallback Palace web client URL if discovery
  services do not provide one.

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

Title URLs are constructed using the Palace reader URL pattern from the MARC
annotator logic.

This app uses TypeScript components and a registry-sync hook to keep the UI
maintainable and testable.
