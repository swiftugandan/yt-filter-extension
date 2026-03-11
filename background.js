// background.js — Service worker for YT Video Filter v2.1
// Manages: config defaults, badge, filter log relay, offscreen ML document.

const DEFAULT_CONFIG = {
  enabled: true,
  filterMode: "hide",
  mlEnabled: false,
  filters: {
    titleKeywords: ["#ad", "#sponsored", "paid promotion"],
    channelNames: [],
    hideShorts: false,
    hideLive: false,
    hideWatched: false,
    minDuration: null,
    maxDuration: null,
    titleRegex: "\\b(sponsor(ed)?|#ad|paid promoti?on)\\b|^\\[AD\\]",
    hideMixes: false,
    hidePlayables: false,
    hideAds: true,
    hideClickbait: true,
    hideToxic: true,
  },
  stats: {
    totalHidden: 0,
  },
};

const MAX_LOG_ENTRIES = 500;

// ── Offscreen document management ────────────────────────────────────────
let offscreenCreating = null;

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) return;

  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  offscreenCreating = chrome.offscreen.createDocument({
    url: "ml-offscreen.html",
    reasons: ["WORKERS"],
    justification: "ML inference for video title classification using transformers.js",
  });

  await offscreenCreating;
  offscreenCreating = null;
}

async function closeOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) {
    await chrome.offscreen.closeDocument();
  }
}

// ── Install handler ──────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get("ytFilterConfig");
  if (!existing.ytFilterConfig) {
    await chrome.storage.sync.set({ ytFilterConfig: DEFAULT_CONFIG });
  }
  const logStore = await chrome.storage.local.get("ytFilterLog");
  if (!logStore.ytFilterLog) {
    await chrome.storage.local.set({ ytFilterLog: [] });
  }
  updateBadge(existing.ytFilterConfig || DEFAULT_CONFIG);
});

// ── Message router ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Messages from offscreen doc (ML results/status) → relay to all YT tabs
  if (msg.target === "background" && (msg.type === "ML_STATUS" || msg.type === "ML_RESULTS")) {
    console.log("[YTF BG] Relaying to tabs:", msg.type, msg.status || "", msg.detail || "");
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
      console.log("[YTF BG] Found", tabs.length, "YT tabs to relay to");
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { ...msg, target: "content" }).catch(() => {});
      }
    });
    return;
  }

  switch (msg.type) {
    case "UPDATE_BADGE":
      updateBadge(msg.config);
      break;

    case "GET_CONFIG":
      chrome.storage.sync.get("ytFilterConfig").then((result) => {
        sendResponse(result.ytFilterConfig || DEFAULT_CONFIG);
      });
      return true;

    case "HIDDEN_COUNT":
      chrome.action.setBadgeText({ text: msg.count > 0 ? String(msg.count) : "" });
      chrome.action.setBadgeBackgroundColor({ color: "#c62828" });
      break;

    case "FILTER_LOG_BATCH":
      appendLogEntries(msg.entries).then(() => {
        chrome.storage.sync.get("ytFilterConfig").then((result) => {
          const cfg = result.ytFilterConfig || DEFAULT_CONFIG;
          cfg.stats = cfg.stats || { totalHidden: 0 };
          cfg.stats.totalHidden += msg.entries.length;
          chrome.storage.sync.set({ ytFilterConfig: cfg });
        });
      });
      break;

    case "GET_LOG":
      chrome.storage.local.get("ytFilterLog").then((result) => {
        sendResponse(result.ytFilterLog || []);
      });
      return true;

    case "CLEAR_LOG":
      chrome.storage.local.set({ ytFilterLog: [] }).then(() => {
        sendResponse({ ok: true });
      });
      return true;

    case "OPEN_OPTIONS":
      chrome.runtime.openOptionsPage();
      break;

    // ── ML lifecycle messages from content script ──
    case "ML_INIT":
      console.log("[YTF BG] ML_INIT received, creating offscreen doc...");
      ensureOffscreen().then(() => {
        console.log("[YTF BG] Offscreen doc ready, sending INIT to offscreen");
        chrome.runtime.sendMessage({ target: "offscreen", type: "INIT" });
      }).catch((err) => {
        console.error("[YTF BG] Offscreen creation failed:", err);
        if (sender.tab) {
          chrome.tabs.sendMessage(sender.tab.id, {
            target: "content",
            type: "ML_STATUS",
            status: "error",
            error: err.message,
          }).catch(() => {});
        }
      });
      break;

    case "ML_TERMINATE":
      closeOffscreen().catch(() => {});
      break;

    case "ML_CLASSIFY":
      // Relay classify request from content → offscreen
      ensureOffscreen().then(() => {
        chrome.runtime.sendMessage({
          target: "offscreen",
          type: "CLASSIFY",
          titles: msg.titles,
          requestId: msg.requestId,
        });
      }).catch(() => {});
      break;
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────
async function appendLogEntries(entries) {
  const result = await chrome.storage.local.get("ytFilterLog");
  let log = result.ytFilterLog || [];
  log = log.concat(entries);
  if (log.length > MAX_LOG_ENTRIES) {
    log = log.slice(log.length - MAX_LOG_ENTRIES);
  }
  await chrome.storage.local.set({ ytFilterLog: log });
}

function updateBadge(config) {
  if (config?.enabled) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#2e7d32" });
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#757575" });
  }
}
