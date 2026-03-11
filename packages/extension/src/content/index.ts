import type { YTFilterConfig } from "../types/config";
import type { LiveStatsResponse } from "../types/messages";
import {
  ATTR_HIDDEN,
  VIDEO_CONTAINER_SELECTORS,
  SCAN_INTERVAL_MS,
  STORAGE_CONFIG_KEY,
} from "../shared/constants";
import { getConfig } from "../shared/storage";
import {
  injectStyle,
  updateModeCSS,
  updatePlayablesCSS,
  updateAdsCSS,
  checkPageBlock,
} from "./ui";
import {
  scanContainers,
  debouncedScan,
  recomputeHash,
  clearProcessedAttrs,
} from "./scanner";
import {
  initMLWorker,
  terminateMLWorker,
  isMLWorkerActive,
  setupMLMessageListener,
  setHiddenCountRef,
} from "./ml-client";

let config: YTFilterConfig | null = null;
let compiledTitleRegex: RegExp | null = null;
const hiddenCount = { value: 0 };

setHiddenCountRef(hiddenCount);

function compileRegex(): void {
  compiledTitleRegex = null;
  if (config?.filters?.titleRegex) {
    try {
      compiledTitleRegex = new RegExp(config.filters.titleRegex, "i");
    } catch {
      console.warn("[YT Filter] Bad regex:", config.filters.titleRegex);
    }
  }
}

async function loadConfig(): Promise<void> {
  try {
    config = await getConfig();
    compileRegex();
  } catch (err) {
    console.error("[YT Filter] Config load failed:", err);
  }
}

// ── Config change listener ──
chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_CONFIG_KEY]) {
    config = changes[STORAGE_CONFIG_KEY].newValue;
    compileRegex();
    recomputeHash(config);
    updateModeCSS(config);
    updatePlayablesCSS(config);
    updateAdsCSS(config);
    checkPageBlock(config);
    const classifierOn = config?.classifierBackend !== "off";
    if (classifierOn && !isMLWorkerActive()) {
      initMLWorker(config);
    } else if (!classifierOn && isMLWorkerActive()) {
      terminateMLWorker();
    }
    clearProcessedAttrs(true);
    hiddenCount.value = 0;
    scanContainers(config, compiledTitleRegex, hiddenCount);
  }
});

// ── Message handler for dashboard queries ──
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_LIVE_STATS") {
    const total = document.querySelectorAll(VIDEO_CONTAINER_SELECTORS).length;
    const hidden = document.querySelectorAll(`[${ATTR_HIDDEN}="true"]`).length;
    sendResponse({
      total,
      hidden,
      page: location.href,
    } satisfies LiveStatsResponse);
    return true;
  }
});

// ── ML message listener ──
setupMLMessageListener();

// ── SPA navigation ──
function onNavigate(): void {
  hiddenCount.value = 0;
  clearProcessedAttrs();
  checkPageBlock(config);
  debouncedScan(config, compiledTitleRegex, hiddenCount);
}

// ── MutationObserver ──
let observer: MutationObserver | null = null;
function startObserver(): void {
  if (observer) observer.disconnect();
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        debouncedScan(config, compiledTitleRegex, hiddenCount);
        return;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ── Init ──
async function init(): Promise<void> {
  injectStyle();
  await loadConfig();
  updateModeCSS(config);
  recomputeHash(config);
  updatePlayablesCSS(config);
  updateAdsCSS(config);
  checkPageBlock(config);
  scanContainers(config, compiledTitleRegex, hiddenCount);
  startObserver();
  if (config?.classifierBackend !== "off") initMLWorker(config);
  window.addEventListener("yt-navigate-finish", onNavigate);
  setInterval(() => {
    if (config?.enabled)
      scanContainers(config, compiledTitleRegex, hiddenCount);
  }, SCAN_INTERVAL_MS);
}

if (document.body) init();
else document.addEventListener("DOMContentLoaded", init);
