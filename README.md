# YT Video Filter v2.1 — Chrome Extension

A Chrome (MV3) extension that filters YouTube videos from the DOM based on configurable rules. Supports regex matching, content-type filters, built-in clickbait/toxic pattern detection, optional ML-based classification using transformer embeddings, and two filter modes (hide or blur).

## Features

### Filter Rules

| Filter             | Description                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Title Keywords** | Case-insensitive substring match against video titles                                                                                     |
| **Channel Names**  | Exact match (case-insensitive) against uploader name                                                                                      |
| **Title Regex**    | Custom regular expression (case-insensitive)                                                                                              |
| **Duration Range** | Min/max in seconds — hides videos outside range                                                                                           |
| **Hide Shorts**    | Remove all YouTube Shorts                                                                                                                 |
| **Hide Live**      | Remove live streams                                                                                                                       |
| **Hide Watched**   | Remove videos with watch progress bar                                                                                                     |
| **Hide Mixes**     | Remove Mix/playlist cards                                                                                                                 |
| **Hide Playables** | Remove YouTube Playables (mini-games)                                                                                                     |
| **Hide Ads**       | Remove promoted/ad video slots                                                                                                            |
| **Hide Clickbait** | Regex-based detection: ALL CAPS, excessive punctuation, emoji spam, common clickbait phrases                                              |
| **Hide Toxic**     | Regex-based detection: rage/outrage bait, drama bait, fear mongering, scam/hustle content, dark patterns (false urgency, engagement bait) |

### Filter Modes

- **Hide**: `display: none !important` via data attribute — videos are completely removed from view
- **Blur**: Blurred overlay with hover-to-peek and reason text — videos are obscured but accessible

### ML Classification (Optional)

When enabled, titles that pass rule-based filters are sent to an on-device ML classifier running `Xenova/all-MiniLM-L6-v2` via transformers.js in a Web Worker. Classifies titles by cosine similarity against archetype phrases across five categories: clickbait, toxic, dark pattern, fear, and scam. Each category has per-category thresholds with margin. Results are cached in IndexedDB (5000 entry cap with LRU eviction). Adding new archetype strings requires no retraining.

### Real-time Dashboard

Live stats from the active YouTube tab: videos on page, hidden count, visible count, all-time hidden total. Shows active filter rules and recent filter hits.

### Filter Log

Every hidden video is logged with: timestamp, title (clickable link), channel, duration, and the specific filter rule(s) that matched. Up to 500 entries, viewable/clearable from the log tab.

### Presets

Save and load named filter presets for quick switching between different filter configurations.

### Import / Export

Export your config as JSON (copy or download). Import by pasting JSON or loading a `.json` file.

### Compact Popup

Quick-access toolbar popup: master on/off toggle, live hidden/visible counts, active rule summary, and a button to open the full control panel.

## Install

### From Source

1. `npm install`
2. `npm run build`
3. Open `chrome://extensions/`
4. Enable **Developer mode**
5. Click **Load unpacked** → select the `dist/` folder
6. Pin the extension icon in the toolbar

### Development

```sh
npm run dev       # Watch mode — rebuilds on file changes
npm run typecheck # Type-check with tsc --noEmit (strict mode)
npm test          # Run tests with vitest (jsdom environment)
npm run lint      # ESLint
npm run format    # Prettier
```

After changes, reload the extension at `chrome://extensions/` to pick up the new build.

## Architecture

### Message Flow

```
Content script ↔ Background service worker ↔ Offscreen document ↔ Web Worker
```

- **Content script** (`src/content/`): Injected into YouTube pages. MutationObserver + periodic scan finds video containers, extracts metadata, applies filter rules, hides/blurs matched elements. Batched log entries (1s flush). ML mode queues titles for classification.
- **Background** (`src/background/`): Service worker managing config defaults (`chrome.storage.sync`), badge state, filter log relay (`chrome.storage.local`, 500 entry cap), offscreen document lifecycle.
- **Offscreen** (`src/offscreen/`): Offscreen document spawning `ml-worker.js` as a module Worker, relaying messages between worker and background.
- **ML Worker** (`src/ml-worker/`): Runs `Xenova/all-MiniLM-L6-v2` via transformers.js. Embeds archetype phrases at startup, classifies titles by cosine similarity. IndexedDB cache (5000 entries).
- **Popup** (`src/popup/`): Toolbar popup UI.
- **Options** (`src/options/`): Full control panel with tabs: dashboard, filters config, filter log, presets, import/export.

### DOM Targeting Strategy

YouTube is a Web Components SPA. Class names change; **custom element tag names don't**. Targeted elements:

```
ytd-rich-item-renderer      home/subscriptions grid
ytd-video-renderer           search results
ytd-compact-video-renderer   sidebar recommendations
ytd-grid-video-renderer      channel page grid
ytd-reel-item-renderer       Shorts shelf
ytd-rich-grid-media          newer home grid variant
ytd-playlist-renderer        playlist cards
ytd-radio-renderer           mix radio cards
```

Three detection layers handle dynamic content:

1. **MutationObserver** on `document.body` — catches AJAX-loaded content
2. **`yt-navigate-finish`** event — catches SPA page transitions
3. **3-second periodic scan** — catches scroll-based lazy load edge cases

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

### Storage

| Store        | API                    | Key               | Scope                        |
| ------------ | ---------------------- | ----------------- | ---------------------------- |
| Config       | `chrome.storage.sync`  | `ytFilterConfig`  | Syncs across Chrome profile  |
| Filter log   | `chrome.storage.local` | `ytFilterLog`     | Device-local, 500 cap        |
| User presets | `chrome.storage.local` | `ytFilterPresets` | Device-local                 |
| ML cache     | IndexedDB              | `ytf-ml-cache`    | Device-local, 5000 cap (LRU) |

## Directory Structure

```
src/
├── types/          # TypeScript interfaces (config, video, messages, chrome augmentations)
├── shared/         # Constants, typed storage wrappers, escapeHtml, DOM helpers
├── content/        # Content script (metadata, filters, scanner, ml-client, ui, logging)
├── background/     # Service worker (offscreen lifecycle, badge, log-store)
├── popup/          # Popup logic
├── options/        # Options page (config-ui, dashboard, log-panel, presets, import-export)
├── offscreen/      # Offscreen document (worker relay)
└── ml-worker/      # ML classifier (archetypes, classifier, idb-cache, pipeline)
static/             # manifest.json, HTML files, icons → copied to dist/
vendor/             # transformers.min.js, ort.* files → copied to dist/ (do not edit)
test/               # Vitest tests
```

## Configuration Tips

**Block sponsored content:**
Title regex: `#ad|#sponsored|\bsponsor(ed)?\b`

**Only show medium-length videos (2–20 min):**
Min duration: `120` / Max duration: `1200`

**Share your config:**
Export tab → Copy → send to someone → they paste in Import tab → Apply

## Browser Compatibility

- Chrome 88+ (Manifest V3)
- Edge 88+ (Chromium-based)
- Brave (Chromium-based)

## License

MIT
