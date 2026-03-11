import type { YTFilterConfig } from "../types/config";
import { ATTR_HIDDEN } from "../shared/constants";

const STYLE_ID = "ytf-style";

export function injectStyle(): void {
  updateModeCSS(null);
}

export function updateModeCSS(config: YTFilterConfig | null): void {
  let s = document.getElementById(STYLE_ID);
  if (!s) {
    s = document.createElement("style");
    s.id = STYLE_ID;
    document.head.appendChild(s);
  }

  const mode = config?.filterMode || "hide";

  if (mode === "blur") {
    s.textContent = `
      [${ATTR_HIDDEN}="true"] {
        position: relative !important;
        pointer-events: none !important;
      }
      [${ATTR_HIDDEN}="true"] > * {
        filter: blur(12px) saturate(0.2) !important;
        opacity: 0.35 !important;
        transition: filter 0.25s, opacity 0.25s !important;
        user-select: none !important;
      }
      [${ATTR_HIDDEN}="true"]::after {
        content: attr(data-ytf-reason);
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'JetBrains Mono', 'Cascadia Code', 'SF Mono', monospace;
        font-size: 11px;
        font-weight: 500;
        color: #ff5252;
        background: rgba(10, 10, 10, 0.55);
        border: 1px solid rgba(198, 40, 40, 0.2);
        border-radius: 8px;
        letter-spacing: 0.5px;
        pointer-events: auto;
        cursor: pointer;
        z-index: 10;
        text-align: center;
        padding: 8px;
      }
      [${ATTR_HIDDEN}="true"]:hover > * {
        filter: blur(3px) saturate(0.5) !important;
        opacity: 0.6 !important;
      }
      [${ATTR_HIDDEN}="true"]:hover::after {
        background: rgba(10, 10, 10, 0.3);
      }
    `;
  } else {
    s.textContent = `[${ATTR_HIDDEN}="true"] { display: none !important; }`;
  }
}

function toggleHideStyle(
  id: string,
  active: boolean,
  selectors: string[],
): void {
  const existing = document.getElementById(id);
  if (active) {
    if (!existing) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = selectors.join(",") + " { display: none !important; }";
      document.head.appendChild(s);
    }
  } else if (existing) {
    existing.remove();
  }
}

const PLAYABLES_SELECTORS = [
  'ytd-rich-shelf-renderer:has(a[href*="/playables"])',
  'ytd-rich-section-renderer:has(a[href*="/playables"])',
  'ytd-shelf-renderer:has(a[href*="/playables"])',
  'ytd-guide-entry-renderer:has(a[href="/playables"])',
  'ytd-guide-entry-renderer:has(a[href*="/playables"])',
  'ytd-mini-guide-entry-renderer:has(a[href*="/playables"])',
];

const ADS_SELECTORS = [
  "ytd-ad-slot-renderer",
  "ytd-in-feed-ad-layout-renderer",
  "ytd-display-ad-renderer",
  "ytd-promoted-sparkles-web-renderer",
  "ytd-promoted-video-renderer",
  "ytd-compact-promoted-video-renderer",
  "ytd-banner-promo-renderer",
  "ytd-statement-banner-renderer",
  "ytd-search-pyv-renderer",
  "ytd-masthead-ad-advertiser-info-renderer",
  "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
  '[layout*="display-ad-"]',
  "#masthead-ad",
  "#player-ads",
  "#merch-shelf",
  '[target-id="engagement-panel-ads"]',
  ".ytp-ad-overlay-container",
  ".ytp-ad-progress-list",
  "#companion",
  "#action-companion-ads",
];

export function updatePlayablesCSS(config: YTFilterConfig | null): void {
  toggleHideStyle(
    "ytf-playables-style",
    !!config?.filters?.hidePlayables,
    PLAYABLES_SELECTORS,
  );
}

export function updateAdsCSS(config: YTFilterConfig | null): void {
  toggleHideStyle("ytf-ads-style", !!config?.filters?.hideAds, ADS_SELECTORS);
}

// ── Page-level blocking overlay ──
const OVERLAY_ID = "ytf-page-block-overlay";

export function checkPageBlock(config: YTFilterConfig | null): void {
  if (!config?.enabled) {
    removeOverlay();
    return;
  }

  const path = location.pathname;
  let blocked = false;
  let reason = "";

  if (config.filters?.hideShorts && path.startsWith("/shorts")) {
    blocked = true;
    reason = "shorts";
  } else if (config.filters?.hidePlayables && path.startsWith("/playables")) {
    blocked = true;
    reason = "playables";
  }

  if (blocked) {
    showOverlay(reason);
  } else {
    removeOverlay();
  }
}

function showOverlay(reason: string): void {
  if (document.getElementById(OVERLAY_ID)) return;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <style>
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: #0a0a0a;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: 'JetBrains Mono', 'Cascadia Code', 'SF Mono', monospace;
        color: #b0b0b0;
        text-align: center;
      }
      #${OVERLAY_ID} .ytf-ob-icon { font-size: 48px; margin-bottom: 20px; opacity: 0.6; }
      #${OVERLAY_ID} .ytf-ob-title { font-size: 18px; font-weight: 600; color: #d4d4d4; margin-bottom: 8px; letter-spacing: -0.3px; }
      #${OVERLAY_ID} .ytf-ob-reason { font-size: 12px; color: #555; margin-bottom: 28px; line-height: 1.5; }
      #${OVERLAY_ID} .ytf-ob-reason code { display: inline-block; padding: 2px 8px; background: #1a1212; border: 1px solid #301515; border-radius: 3px; color: #ff5252; font-family: inherit; font-size: 11px; }
      #${OVERLAY_ID} .ytf-ob-actions { display: flex; gap: 10px; }
      #${OVERLAY_ID} .ytf-ob-btn { font-family: inherit; font-size: 12px; font-weight: 500; padding: 8px 20px; border-radius: 4px; border: 1px solid #222; background: #111; color: #b0b0b0; cursor: pointer; transition: all 0.15s; text-decoration: none; letter-spacing: 0.3px; }
      #${OVERLAY_ID} .ytf-ob-btn:hover { background: #181818; border-color: #333; color: #d4d4d4; }
      #${OVERLAY_ID} .ytf-ob-btn-primary { border-color: #1b5e20; color: #4caf50; }
      #${OVERLAY_ID} .ytf-ob-btn-primary:hover { background: #1b5e20; color: #fff; }
    </style>
    <div class="ytf-ob-icon">▶</div>
    <div class="ytf-ob-title">page blocked by yt video filter</div>
    <div class="ytf-ob-reason">
      your filter rule <code>hide ${reason}</code> is active<br>
      this ${reason === "shorts" ? "short" : "playable"} has been blocked
    </div>
    <div class="ytf-ob-actions">
      <a class="ytf-ob-btn ytf-ob-btn-primary" href="/" id="ytf-ob-home">go home</a>
      <button class="ytf-ob-btn" id="ytf-ob-back">go back</button>
      <button class="ytf-ob-btn" id="ytf-ob-dismiss">dismiss once</button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("ytf-ob-back")!.addEventListener("click", () => {
    if (history.length > 1) {
      history.back();
    } else {
      location.href = "/";
    }
  });

  document.getElementById("ytf-ob-dismiss")!.addEventListener("click", () => {
    removeOverlay();
  });
}

function removeOverlay(): void {
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.remove();
}
