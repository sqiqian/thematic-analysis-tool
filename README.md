# Reflexive Thematic Analysis Tool

A local-first, minimalist qualitative data analysis (QDA) web app for **Reflexive Thematic Analysis**. All data is stored in your browser via IndexedDB (Dexie.js) — no server required.

## Features

- **Projects** — Dashboard to create and open recent projects
- **Rich text transcripts** — TipTap editor with comfortable reading layout (65ch max-width)
- **Overlapping highlights** — Multiple codes on the same text span; click highlights to manage codes
- **Hierarchical codebook** — Parent/child codes with frequency counts and search-to-assign
- **Reflexive memos** — Project, transcript, and code-level notes (markdown)
- **Retrieval view** — All excerpts for a code across transcripts
- **Export** — CSV/JSON thematic framework download

## Quick start

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Stack

- React + Vite + TypeScript
- Tailwind CSS v4
- Dexie.js (IndexedDB)
- TipTap (rich text)

## Data model

| Table | Purpose |
|---|---|
| `projects` | Research projects |
| `transcripts` | Interview/document text (HTML + plainText for offsets) |
| `codes` | Hierarchical codebook |
| `highlights` | Text spans (plain-text offsets) |
| `highlightCodes` | Many-to-many: codes ↔ highlights |
| `memos` | Reflexive notes at project/transcript/code level |

Data persists across browser refreshes. Clearing site data will remove projects.
