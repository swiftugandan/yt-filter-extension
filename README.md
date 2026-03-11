# YT Video Filter v2.0 — Chrome Extension

A production-ready Chrome (MV3) browser extension that removes YouTube video containers from the DOM based on configurable filter criteria. Features a terminal-aesthetic control panel with real-time dashboard, filter log, and config import/export.

## Features

### Real-time Dashboard
Live stats from the active YouTube tab: videos on page, hidden count, visible count, all-time hidden total. Polls every 2 seconds. Shows your active filter rules and the 5 most recent filter hits.

### Full Configuration
All filter settings in a dedicated options page (tab-based UI):

| Filter | Description |
|---|---|
| **Title Keywords** | Case-insensitive substring match against video titles |
| **Channel Names** | Exact match (case-insensitive) against uploader name |
| **Title Regex** | Custom regular expression (case-insensitive) |
| **Duration Range** | Min/max in seconds — hides videos outside range |
| **Hide Shorts** | Remove all YouTube Shorts |
| **Hide Live** | Remove live streams |
| **Hide Watched** | Remove videos with watch progress bar |
| **Hide Mixes** | Remove Mix/playlist cards |

### Filter Log
Every hidden video is logged with: timestamp, title (clickable link), channel, duration, and the specific filter rule(s) that matched. Up to 500 entries, viewable/clearable from the log tab.

### Import / Export
Export your config as JSON (copy or download). Import by pasting JSON or loading a `.json` file. Useful for sharing filter sets or backing up before experimenting.

### Compact Popup
Quick-access toolbar popup shows: master on/off toggle, live hidden/visible counts, active rule summary, and a button to open the full control panel.

## Install

1. Extract `yt-video-filter.tar.gz`
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `yt-filter-extension/` folder
5. Pin the extension icon in the toolbar

## How It Works

### DOM Targeting Strategy

YouTube is a Web Components SPA. Class names change; **custom element tag names don't**. We target:

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

1. **MutationObserver** on `document.body` → catches AJAX-loaded content
2. **`yt-navigate-finish`** event → catches SPA page transitions
3. **3-second periodic scan** → catches scroll-based lazy load edge cases

Hidden elements get `display: none !important` via a data attribute + injected stylesheet. YouTube's own JS stays intact.

### Metadata Extraction

Each video container is probed with multiple fallback selectors per field (title, channel, duration, badges). This multi-selector approach provides resilience across YouTube's different page layouts.

### Filter Log Pipeline

Content script batches filter hit entries (1s flush interval) → sends to background service worker → appended to `chrome.storage.local` (capped at 500 entries). Options page reads from the same store.

### Storage

- **Config**: `chrome.storage.sync` (syncs across Chrome profile)
- **Log**: `chrome.storage.local` (device-local, higher quota)

## File Structure

```
yt-filter-extension/
├── manifest.json       MV3 manifest
├── background.js       service worker: badge, log relay, config defaults
├── content.js          content script: DOM engine, metadata extraction, log emission
├── popup.html          compact toolbar popup
├── popup.js            popup logic
├── options.html        full control panel (dashboard, filters, log, import/export)
├── options.js          control panel logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
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

For Firefox, the manifest needs MV2 adjustment. Content script logic is browser-agnostic.

## License

MIT
