import { escapeHtml } from "../shared/escape-html";
import { getConfig, setConfig } from "../shared/storage";
import { $ } from "../shared/dom";

async function init(): Promise<void> {
  const cfg = await getConfig();

  ($("#toggle") as HTMLInputElement).checked = cfg.enabled;

  const f = cfg.filters || {};
  const mode = cfg.filterMode || "hide";
  const rules: string[] = [];
  rules.push(
    `<span class="rl">Mode:</span> <span class="rv">${mode === "blur" ? "Blur" : "Hide"}</span>`,
  );
  if (cfg.classifierBackend !== "off") {
    const backendLabel =
      cfg.classifierBackend === "local" ? "Local ML" : "Server";
    rules.push(
      `<span class="rl">Smart detection:</span> <span class="rv">${backendLabel}</span>`,
    );
  }
  if (f.titleKeywords?.length)
    rules.push(
      `<span class="rl">Keywords:</span> <span class="rv">${f.titleKeywords.map(escapeHtml).join(", ")}</span>`,
    );
  if (f.channelNames?.length)
    rules.push(
      `<span class="rl">Channels:</span> <span class="rv">${f.channelNames.map(escapeHtml).join(", ")}</span>`,
    );
  if (f.titleRegex)
    rules.push(
      `<span class="rl">Pattern:</span> <span class="rv">${escapeHtml(f.titleRegex)}</span>`,
    );
  if (f.hideShorts)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Shorts</span>`,
    );
  if (f.hideLive)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Live streams</span>`,
    );
  if (f.hideWatched)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Watched</span>`,
    );
  if (f.hideMixes)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Mixes</span>`,
    );
  if (f.hidePlayables)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Playables</span>`,
    );
  if (f.hideAds)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Ads</span>`,
    );
  if (f.hideClickbait)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Clickbait</span>`,
    );
  if (f.hideToxic)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Toxic content</span>`,
    );
  if (f.minDuration != null)
    rules.push(
      `<span class="rl">Min length:</span> <span class="rv">${f.minDuration}s</span>`,
    );
  if (f.maxDuration != null)
    rules.push(
      `<span class="rl">Max length:</span> <span class="rv">${f.maxDuration}s</span>`,
    );

  const rulesEl = $("#rules");
  rulesEl.innerHTML = rules.length
    ? rules.map((r) => `<div class="r">${r}</div>`).join("")
    : '<div style="color:#555">No active filters</div>';

  try {
    let tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
      url: "*://*.youtube.com/*",
    });
    if (tabs.length === 0) {
      tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
    }
    let totalAll = 0,
      hiddenAll = 0;
    let pending = tabs.length;
    if (pending === 0) return;
    const update = () => {
      pending--;
      if (pending <= 0) {
        $("#hidden").textContent = String(hiddenAll);
        $("#visible").textContent = String(totalAll - hiddenAll);
      }
    };
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id!, { type: "GET_LIVE_STATS" }, (resp) => {
        if (!chrome.runtime.lastError && resp) {
          totalAll += resp.total || 0;
          hiddenAll += resp.hidden || 0;
        }
        update();
      });
    }
  } catch {
    /* no tab */
  }
}

// Toggle handler
($("#toggle") as HTMLInputElement).addEventListener("change", async () => {
  const cfg = await getConfig();
  cfg.enabled = ($("#toggle") as HTMLInputElement).checked;
  await setConfig(cfg);
  chrome.runtime.sendMessage({ type: "UPDATE_BADGE", config: cfg });
});

// Open full options page
$("#openPanel").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
  window.close();
});

document.addEventListener("DOMContentLoaded", init);
