// popup.js — Compact quick-access popup

"use strict";

const $ = (s) => document.querySelector(s);

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function init() {
  // Load config
  const result = await chrome.storage.sync.get("ytFilterConfig");
  const cfg = result.ytFilterConfig || { enabled: true, filters: {} };

  $("#toggle").checked = cfg.enabled;

  // Render active rules
  const f = cfg.filters || {};
  const mode = cfg.filterMode || "hide";
  const rules = [];
  rules.push(`<span class="rl">mode</span> <span class="rv">${mode}</span>`);
  if (cfg.mlEnabled) rules.push(`<span class="rl">ml</span> <span class="rv">on</span>`);
  if (f.titleKeywords?.length)
    rules.push(`<span class="rl">kw</span> <span class="rv">${f.titleKeywords.map(esc).join(", ")}</span>`);
  if (f.channelNames?.length)
    rules.push(`<span class="rl">ch</span> <span class="rv">${f.channelNames.map(esc).join(", ")}</span>`);
  if (f.titleRegex)
    rules.push(`<span class="rl">rx</span> <span class="rv">/${esc(f.titleRegex)}/</span>`);
  if (f.hideShorts) rules.push(`<span class="rl">hide</span> <span class="rv">shorts</span>`);
  if (f.hideLive) rules.push(`<span class="rl">hide</span> <span class="rv">live</span>`);
  if (f.hideWatched) rules.push(`<span class="rl">hide</span> <span class="rv">watched</span>`);
  if (f.hideMixes) rules.push(`<span class="rl">hide</span> <span class="rv">mixes</span>`);
  if (f.hidePlayables) rules.push(`<span class="rl">hide</span> <span class="rv">playables</span>`);
  if (f.hideAds) rules.push(`<span class="rl">hide</span> <span class="rv">ads</span>`);
  if (f.hideClickbait) rules.push(`<span class="rl">hide</span> <span class="rv">clickbait</span>`);
  if (f.hideToxic) rules.push(`<span class="rl">hide</span> <span class="rv">toxic</span>`);
  if (f.minDuration != null) rules.push(`<span class="rl">dur</span> <span class="rv">≥${f.minDuration}s</span>`);
  if (f.maxDuration != null) rules.push(`<span class="rl">dur</span> <span class="rv">≤${f.maxDuration}s</span>`);

  const rulesEl = $("#rules");
  rulesEl.innerHTML = rules.length
    ? rules.map((r) => `<div class="r">${r}</div>`).join("")
    : '<div style="color:#333"># no active filters</div>';

  // Query YT tab for live stats — try active tab first, then any YT tab
  try {
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true, url: "*://*.youtube.com/*" });
    if (tabs.length === 0) {
      tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
    }
    let totalAll = 0, hiddenAll = 0;
    let pending = tabs.length;
    if (pending === 0) return;
    const update = () => {
      pending--;
      if (pending <= 0) {
        $("#hidden").textContent = hiddenAll;
        $("#visible").textContent = totalAll - hiddenAll;
      }
    };
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: "GET_LIVE_STATS" }, (resp) => {
        if (!chrome.runtime.lastError && resp) {
          totalAll += resp.total || 0;
          hiddenAll += resp.hidden || 0;
        }
        update();
      });
    }
  } catch { /* no tab */ }
}

// Toggle handler
$("#toggle").addEventListener("change", async () => {
  const result = await chrome.storage.sync.get("ytFilterConfig");
  const cfg = result.ytFilterConfig || {};
  cfg.enabled = $("#toggle").checked;
  await chrome.storage.sync.set({ ytFilterConfig: cfg });
  chrome.runtime.sendMessage({ type: "UPDATE_BADGE", config: cfg });
});

// Open full options page
$("#openPanel").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
  window.close();
});

document.addEventListener("DOMContentLoaded", init);
