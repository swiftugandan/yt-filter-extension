import { DEFAULT_CONFIG } from "../types/config";
import { getConfig, setConfig, getLog, setLog } from "../shared/storage";
import { ensureOffscreen, closeOffscreen } from "./offscreen";
import { updateBadge } from "./badge";
import { appendLogEntries } from "./log-store";

// ── Install handler ──
chrome.runtime.onInstalled.addListener(async () => {
  const cfg = await getConfig();
  if (cfg === DEFAULT_CONFIG) {
    await setConfig(DEFAULT_CONFIG);
  }
  const log = await getLog();
  if (!log.length) {
    await setLog([]);
  }
  updateBadge(cfg);
});

// ── Message router ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Messages from offscreen doc (ML results/status) → relay to all YT tabs
  if (
    msg.target === "background" &&
    (msg.type === "ML_STATUS" || msg.type === "ML_RESULTS")
  ) {
    console.log(
      "[YTF BG] Relaying to tabs:",
      msg.type,
      msg.status || "",
      msg.detail || "",
    );
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
      console.log("[YTF BG] Found", tabs.length, "YT tabs to relay to");
      for (const tab of tabs) {
        chrome.tabs
          .sendMessage(tab.id!, { ...msg, target: "content" })
          .catch(() => {});
      }
    });
    return;
  }

  switch (msg.type) {
    case "UPDATE_BADGE":
      updateBadge(msg.config);
      break;

    case "GET_CONFIG":
      getConfig().then((cfg) => {
        sendResponse(cfg);
      });
      return true;

    case "HIDDEN_COUNT":
      chrome.action.setBadgeText({
        text: msg.count > 0 ? String(msg.count) : "",
      });
      chrome.action.setBadgeBackgroundColor({ color: "#c62828" });
      break;

    case "FILTER_LOG_BATCH":
      appendLogEntries(msg.entries).then(() => {
        getConfig().then((cfg) => {
          cfg.stats = cfg.stats || { totalHidden: 0 };
          cfg.stats.totalHidden += msg.entries.length;
          setConfig(cfg);
        });
      });
      break;

    case "GET_LOG":
      getLog().then((log) => {
        sendResponse(log);
      });
      return true;

    case "CLEAR_LOG":
      setLog([]).then(() => {
        sendResponse({ ok: true });
      });
      return true;

    case "OPEN_OPTIONS":
      chrome.runtime.openOptionsPage();
      break;

    // ── ML lifecycle messages from content script ──
    case "ML_INIT":
      console.log("[YTF BG] ML_INIT received, creating offscreen doc...");
      ensureOffscreen()
        .then(() => {
          console.log(
            "[YTF BG] Offscreen doc ready, sending INIT to offscreen",
          );
          chrome.runtime.sendMessage({ target: "offscreen", type: "INIT" });
        })
        .catch((err: Error) => {
          console.error("[YTF BG] Offscreen creation failed:", err);
          if (sender.tab) {
            chrome.tabs
              .sendMessage(sender.tab.id!, {
                target: "content",
                type: "ML_STATUS",
                status: "error",
                error: err.message,
              })
              .catch(() => {});
          }
        });
      break;

    case "ML_TERMINATE":
      closeOffscreen().catch(() => {});
      break;

    case "ML_CLASSIFY":
      ensureOffscreen()
        .then(() => {
          chrome.runtime.sendMessage({
            target: "offscreen",
            type: "CLASSIFY",
            titles: msg.titles,
            requestId: msg.requestId,
          });
        })
        .catch(() => {});
      break;
  }
});
