import { DEFAULT_CONFIG } from "../types/config";
import { getConfig, setConfig, getLog, setLog } from "../shared/storage";
import { ensureOffscreen, closeOffscreen } from "./offscreen";
import { updateBadge } from "./badge";
import { appendLogEntries } from "./log-store";
import { classifyViaServer, checkServerHealth } from "./server-classify";

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

// Helper: send message to all YouTube tabs
function relayToYTTabs(msg: Record<string, unknown>): void {
  chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs
        .sendMessage(tab.id!, { ...msg, target: "content" })
        .catch(() => {});
    }
  });
}

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
    relayToYTTabs(msg);
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
      getConfig().then((cfg) => {
        const backend = cfg.classifierBackend || "off";
        console.log("[YTF BG] ML_INIT received, backend:", backend);

        if (backend === "local") {
          ensureOffscreen()
            .then(() => {
              console.log(
                "[YTF BG] Offscreen doc ready, sending INIT to offscreen",
              );
              chrome.runtime.sendMessage({
                target: "offscreen",
                type: "INIT",
              });
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
        } else if (backend === "server") {
          checkServerHealth(cfg.serverUrl).then((health) => {
            const status = health.ok ? "ready" : "error";
            const detail = health.ok
              ? "server connected"
              : health.error || "server unreachable";
            relayToYTTabs({
              type: "ML_STATUS",
              status,
              detail,
              error: health.ok ? undefined : detail,
            });
          });
        }
      });
      break;

    case "ML_TERMINATE":
      closeOffscreen().catch(() => {});
      break;

    case "ML_CLASSIFY":
      getConfig().then((cfg) => {
        const backend = cfg.classifierBackend || "off";

        if (backend === "local") {
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
        } else if (backend === "server") {
          classifyViaServer(msg.titles, cfg.serverUrl)
            .then((results) => {
              relayToYTTabs({
                type: "ML_RESULTS",
                requestId: msg.requestId,
                results,
              });
            })
            .catch((err: Error) => {
              console.error("[YTF BG] Server classify failed:", err);
              relayToYTTabs({
                type: "ML_RESULTS",
                requestId: msg.requestId,
                results: msg.titles.map(() => null),
                error: err.message,
              });
            });
        }
      });
      break;
  }
});
