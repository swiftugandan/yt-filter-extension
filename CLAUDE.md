# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pnpm monorepo containing a Chrome extension (Manifest V3) that filters YouTube videos from the DOM, plus a Next.js server for LLM-based classification. Supports regex matching, content-type filters (shorts, live, ads, mixes, playables), built-in clickbait/toxic pattern detection, optional in-browser ML classification (transformers.js), and optional server-side LLM classification.

## Development

TypeScript codebase. Key commands:

- `pnpm install` — Install all dependencies
- `pnpm build` — Build all packages
- `pnpm build:ext` — Build extension to `packages/extension/dist/`
- `pnpm build:server` — Build Next.js server
- `pnpm typecheck` — Type-check all packages (strict mode)
- `pnpm test` — Run extension tests with vitest (jsdom environment)
- `pnpm dev` — Watch mode for extension development
- `pnpm dev:server` — Start Next.js dev server on :3000

To test extension changes, run `pnpm build:ext` then load `packages/extension/dist/` as an unpacked extension at `chrome://extensions/`.

## Monorepo Structure

```
yt-filter-extension/
├── pnpm-workspace.yaml
├── package.json              # Root: workspace scripts, shared devDeps
├── tsconfig.base.json        # Shared TS compiler options
├── eslint.config.js
├── packages/
│   ├── shared/               # @ytf/shared — types & constants used by both
│   │   └── src/
│   │       ├── types/        # config.ts, video.ts, messages.ts, api.ts
│   │       ├── constants.ts  # Storage keys
│   │       └── categories.ts # Archetype phrases (shared between local ML + server prompt)
│   ├── extension/            # @ytf/extension — Chrome extension
│   │   ├── src/              # content/, background/, popup/, options/, offscreen/, ml-worker/, shared/, types/
│   │   ├── static/           # manifest.json, HTML, icons
│   │   ├── vendor/           # transformers.min.js, ort.* (kept for local ML)
│   │   ├── test/
│   │   └── tsup.config.ts    # 6 bundles (IIFE + ESM for ml-worker)
│   └── server/               # @ytf/server — Next.js classification API
│       └── src/
│           ├── app/api/classify/route.ts
│           └── lib/          # llm-client.ts, prompt.ts, cache.ts, schema.ts
```

## Architecture

### Classifier Backends

Users choose in settings: Off / Local (in-browser ML) / Server (LLM API).

- **Off**: Only regex/keyword/content-type filters active
- **Local**: In-browser ML via offscreen doc → Web Worker → transformers.js
- **Server**: Background service worker POSTs to Next.js `/api/classify`

The content script is backend-agnostic — it sends `ML_CLASSIFY` messages to the background, which routes to the appropriate backend. Results come back as `ML_RESULTS` in the same format regardless of backend.

### Message Flow

Content script ↔ Background service worker ↔ Offscreen document ↔ Web Worker (local)
Content script ↔ Background service worker ↔ Next.js server (server)

### Extension Packages

- **packages/shared/**: Shared types (`YTFilterConfig`, `ClassifyRequest/Response`, `MLClassifyResult`), archetype phrases, storage key constants. Raw TS consumed via workspace protocol (no build step).
- **packages/extension/src/content/**: Injected into YouTube pages. MutationObserver + periodic scan finds video containers, extracts metadata, applies filter rules, hides/blurs matched elements.
- **packages/extension/src/background/**: Service worker managing config, badge state, filter log, offscreen lifecycle, and classifier backend routing (`server-classify.ts`).
- **packages/extension/src/offscreen/**: Offscreen document spawning `ml-worker.js` as a module Worker.
- **packages/extension/src/ml-worker/**: Runs `Xenova/all-MiniLM-L6-v2` via transformers.js. Imports archetypes from `@ytf/shared`.
- **packages/extension/src/popup/**: Toolbar popup — master toggle, live stats, active rule summary.
- **packages/extension/src/options/**: Full control panel with classifier backend selector (Off/Local/Server), server URL config, test connection button.

### Server Package

- **packages/server/**: Next.js app with `/api/classify` route. Uses OpenAI SDK (compatible with Groq, OpenAI, etc). Zod validation for requests and LLM output. In-memory LRU cache (5000 entries). CORS for chrome-extension origins.

### Build Output (6 extension bundles)

| Entry                     | Format | Output                 |
| ------------------------- | ------ | ---------------------- |
| `src/content/index.ts`    | IIFE   | `dist/content.js`      |
| `src/background/index.ts` | IIFE   | `dist/background.js`   |
| `src/popup/index.ts`      | IIFE   | `dist/popup.js`        |
| `src/options/index.ts`    | IIFE   | `dist/options.js`      |
| `src/offscreen/index.ts`  | IIFE   | `dist/ml-offscreen.js` |
| `src/ml-worker/index.ts`  | ESM    | `dist/ml-worker.js`    |

`@ytf/shared` is inlined via `noExternal` in tsup config. ML worker must be ESM (module Worker). `transformers.min.js` is marked external.

### Config

- `classifierBackend`: `"off" | "local" | "server"` (replaces old `mlEnabled` boolean)
- `serverUrl`: string (default `"http://localhost:3000"`)

### Storage

- **Config**: `chrome.storage.sync` (key: `ytFilterConfig`)
- **Log**: `chrome.storage.local` (key: `ytFilterLog`) — 500 entry cap
- **User presets**: `chrome.storage.local` (key: `ytFilterPresets`)
- **ML cache**: IndexedDB (`ytf-ml-cache`) — 5000 entry cap with LRU eviction

## Key Files

- `packages/shared/src/types/config.ts` — YTFilterConfig interface with classifierBackend
- `packages/shared/src/categories.ts` — Archetype phrases (used by local ML + server prompt)
- `packages/extension/src/background/index.ts` — Service worker message router with backend routing
- `packages/extension/src/background/server-classify.ts` — Server backend fetch + mapping
- `packages/extension/src/content/filters.ts` — Regex pattern constants and matchReasons()
- `packages/extension/src/options/config-ui.ts` — Options page with classifier backend selector
- `packages/extension/static/manifest.json` — MV3 manifest
- `packages/server/src/app/api/classify/route.ts` — LLM classification endpoint
- `packages/server/src/lib/prompt.ts` — System prompt with category definitions
