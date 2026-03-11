# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that filters YouTube videos from the DOM based on configurable rules. Supports regex matching, content-type filters (shorts, live, ads, mixes, playables), built-in clickbait/toxic pattern detection, and optional ML-based classification using transformer embeddings.

## Development

TypeScript codebase with tsup bundler. Key commands:

- `npm run build` — Build to `dist/` (tsup + copy static/vendor files)
- `npm run typecheck` — Type-check with `tsc --noEmit` (strict mode)
- `npm test` — Run tests with vitest (jsdom environment)
- `npm run dev` — Watch mode for development

To test changes, run `npm run build` then load `dist/` as an unpacked extension at `chrome://extensions/`.

## Architecture

### Message Flow

Content script ↔ Background service worker ↔ Offscreen document ↔ Web Worker

- **src/content/**: Injected into YouTube pages. MutationObserver + periodic scan finds video containers, extracts metadata, applies filter rules, hides/blurs matched elements. Batched log entries (1s flush). ML mode queues titles for classification.
- **src/background/**: Service worker managing config defaults (`chrome.storage.sync`), badge state, filter log relay (`chrome.storage.local`, 500 entry cap), offscreen document lifecycle.
- **src/offscreen/**: Offscreen document spawning `ml-worker.js` as a module Worker, relaying messages between worker and background.
- **src/ml-worker/**: Runs `Xenova/all-MiniLM-L6-v2` via transformers.js. Embeds archetype phrases at startup, classifies titles by cosine similarity with per-category threshold + margin. IndexedDB cache (5000 entries).
- **src/popup/**: Toolbar popup — master toggle, live stats, active rule summary.
- **src/options/**: Full control panel with tabs: dashboard, filters config, filter log, presets, import/export.

### Build Output (6 bundles)

| Entry                     | Format | Output                 |
| ------------------------- | ------ | ---------------------- |
| `src/content/index.ts`    | IIFE   | `dist/content.js`      |
| `src/background/index.ts` | IIFE   | `dist/background.js`   |
| `src/popup/index.ts`      | IIFE   | `dist/popup.js`        |
| `src/options/index.ts`    | IIFE   | `dist/options.js`      |
| `src/offscreen/index.ts`  | IIFE   | `dist/ml-offscreen.js` |
| `src/ml-worker/index.ts`  | ESM    | `dist/ml-worker.js`    |

ML worker must be ESM (module Worker). `transformers.min.js` is marked external so the import is preserved at runtime.

### DOM Targeting Strategy

YouTube is a Web Components SPA — the extension targets stable custom element tag names (e.g., `ytd-rich-item-renderer`, `ytd-video-renderer`) rather than class names. Three detection layers: MutationObserver, `yt-navigate-finish` event, and a 3-second periodic scan.

### Storage

- **Config**: `chrome.storage.sync` (key: `ytFilterConfig`) — syncs across Chrome profile
- **Log**: `chrome.storage.local` (key: `ytFilterLog`) — device-local, 500 entry cap
- **User presets**: `chrome.storage.local` (key: `ytFilterPresets`)
- **ML cache**: IndexedDB (`ytf-ml-cache`) — 5000 entry cap with LRU eviction

### Filter Modes

- `hide`: `display: none !important` via data attribute
- `blur`: Blurred overlay with hover-to-peek and reason text

### Adding New Filters

Built-in pattern detection uses regex arrays in `src/content/filters.ts` (clickbait, toxic, fear, scam, dark pattern categories). ML archetypes are in `src/ml-worker/archetypes.ts` — adding new archetype strings requires no retraining.

## Directory Structure

```
src/
├── types/          # TypeScript interfaces (config, video, messages, chrome augmentations)
├── shared/         # Constants, typed storage wrappers, escapeHtml
├── content/        # Content script (metadata, filters, scanner, ml-client, ui, logging)
├── background/     # Service worker (offscreen, badge, log-store)
├── popup/          # Popup logic
├── options/        # Options page (config-ui, dashboard, log-panel, presets, import-export)
├── offscreen/      # Offscreen document (worker relay)
└── ml-worker/      # ML classifier (archetypes, classifier, idb-cache, pipeline)
static/             # manifest.json, HTML files, icons → copied to dist/
vendor/             # transformers.min.js, ort.* files → copied to dist/ (do not edit)
test/               # Vitest tests
```

## Key Files

- `static/manifest.json` — MV3 manifest, permissions: storage, activeTab, tabs, offscreen
- `src/content/filters.ts` — Regex pattern constants and matchReasons()
- `src/content/metadata.ts` — YouTube DOM metadata extraction
- `src/background/index.ts` — Service worker message router
- `src/ml-worker/classifier.ts` — Embedding-based classifier
- `src/types/config.ts` — YTFilterConfig interface and DEFAULT_CONFIG
- `vendor/transformers.min.js`, `vendor/ort.*` — Bundled ML runtime (do not edit)
