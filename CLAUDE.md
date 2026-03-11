# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that filters YouTube videos from the DOM based on configurable rules. Supports regex matching, content-type filters (shorts, live, ads, mixes, playables), built-in clickbait/toxic pattern detection, and optional ML-based classification using transformer embeddings.

## Development

No build system — plain JavaScript, loaded directly as an unpacked Chrome extension. To test changes, reload the extension at `chrome://extensions/` after editing files.

## Architecture

### Message Flow

Content script ↔ Background service worker ↔ Offscreen document ↔ Web Worker

- **content.js**: Injected into YouTube pages. Runs a MutationObserver + periodic scan to find video containers, extracts metadata, applies filter rules, and hides/blurs matched elements via data attributes + injected CSS. Sends filter hits to background in batched log entries (1s flush). For ML mode, queues titles to background for classification.
- **background.js**: Service worker that manages config defaults (`chrome.storage.sync`), badge state, filter log relay (`chrome.storage.local`, capped at 500 entries), and offscreen document lifecycle for ML.
- **ml-offscreen.js / ml-offscreen.html**: Offscreen document that spawns `ml-worker.js` as a module Web Worker and relays messages between the worker and background.
- **ml-worker.js**: Runs `Xenova/all-MiniLM-L6-v2` via transformers.js. Embeds archetype phrases (positive=toxic, negative=educational) at startup, then classifies incoming titles by cosine similarity with a per-category threshold + margin system. Uses IndexedDB for inference caching (5000 entries).
- **popup.js / popup.html**: Toolbar popup — master toggle, live stats from YT tabs, active rule summary.
- **options.js / options.html**: Full control panel with tabs: dashboard (live stats, polling every 2s), filters config, filter log, presets (built-in + user-saved), and import/export.

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

Built-in pattern detection uses hardcoded regex arrays in `content.js` (clickbait, toxic, fear, scam, dark pattern categories). ML archetypes are defined in `ml-worker.js` — adding new archetype strings requires no retraining.

## Key Files

- `manifest.json` — MV3 manifest, permissions: storage, activeTab, tabs, offscreen
- `content.js` — Core filtering engine (~1065 lines)
- `background.js` — Service worker message router
- `ml-worker.js` — Embedding-based classifier
- `transformers.min.js`, `ort.bundle.min.mjs`, `ort-wasm-simd-threaded.*` — Bundled ML runtime (do not edit)
