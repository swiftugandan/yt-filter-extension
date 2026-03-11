// options.js — YT Video Filter control panel logic

"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ═══════════════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════════════════════════════════
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    $$(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $(`#panel-${tab.dataset.tab}`).classList.add("active");

    if (tab.dataset.tab === "dashboard") refreshDashboard();
    if (tab.dataset.tab === "log") loadLog();
    if (tab.dataset.tab === "presets") renderPresets();
    if (tab.dataset.tab === "io") populateExport();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════
let toastTimer = null;
function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = isError ? "toast error show" : "toast show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); }, 2500);
}

// ═══════════════════════════════════════════════════════════════════════
// CONFIG LOAD / SAVE
// ═══════════════════════════════════════════════════════════════════════
let currentConfig = null;

async function loadConfig() {
  const result = await chrome.storage.sync.get("ytFilterConfig");
  currentConfig = result.ytFilterConfig || { enabled: true, filters: {}, stats: {} };
  return currentConfig;
}

async function saveConfig() {
  currentConfig.enabled = $("#enableToggle").checked;
  updateStatusText();

  // Filter mode
  const activeMode = document.querySelector("#filterModeControl .seg-btn.active");
  currentConfig.filterMode = activeMode?.dataset.mode || "hide";

  // ML toggle
  currentConfig.mlEnabled = $("#mlEnabled").checked;

  const f = currentConfig.filters || {};
  f.titleKeywords = collectTags("kwWrap");
  f.channelNames = collectTags("chWrap");
  f.titleRegex = ($("#regexInput").value || "").trim();
  f.hideShorts = $("#hideShorts").checked;
  f.hideLive = $("#hideLive").checked;
  f.hideWatched = $("#hideWatched").checked;
  f.hideMixes = $("#hideMixes").checked;
  f.hidePlayables = $("#hidePlayables").checked;
  f.hideAds = $("#hideAds").checked;
  f.hideClickbait = $("#hideClickbait").checked;
  f.hideToxic = $("#hideToxic").checked;

  const minVal = ($("#minDur").value || "").trim();
  const maxVal = ($("#maxDur").value || "").trim();
  f.minDuration = minVal !== "" ? Number(minVal) : null;
  f.maxDuration = maxVal !== "" ? Number(maxVal) : null;

  currentConfig.filters = f;
  await chrome.storage.sync.set({ ytFilterConfig: currentConfig });
  chrome.runtime.sendMessage({ type: "UPDATE_BADGE", config: currentConfig });
}

function updateStatusText() {
  const on = $("#enableToggle").checked;
  const el = $("#statusText");
  el.textContent = on ? "ACTIVE" : "INACTIVE";
  el.className = on ? "status on" : "status off";
}

function populateUI(cfg) {
  $("#enableToggle").checked = cfg.enabled;
  updateStatusText();

  // Filter mode segmented control
  const mode = cfg.filterMode || "hide";
  document.querySelectorAll("#filterModeControl .seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  // ML toggle
  $("#mlEnabled").checked = cfg.mlEnabled || false;

  const f = cfg.filters || {};
  renderTags("kwWrap", f.titleKeywords || []);
  renderTags("chWrap", f.channelNames || []);
  $("#regexInput").value = f.titleRegex || "";
  $("#minDur").value = f.minDuration ?? "";
  $("#maxDur").value = f.maxDuration ?? "";
  $("#hideShorts").checked = f.hideShorts || false;
  $("#hideLive").checked = f.hideLive || false;
  $("#hideWatched").checked = f.hideWatched || false;
  $("#hideMixes").checked = f.hideMixes || false;
  $("#hidePlayables").checked = f.hidePlayables || false;
  $("#hideAds").checked = f.hideAds ?? true;
  $("#hideClickbait").checked = f.hideClickbait ?? true;
  $("#hideToxic").checked = f.hideToxic ?? true;
}

// ═══════════════════════════════════════════════════════════════════════
// TAG INPUTS
// ═══════════════════════════════════════════════════════════════════════
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function renderTags(wrapId, items) {
  const wrap = document.getElementById(wrapId);
  wrap.querySelectorAll(".tag").forEach((t) => t.remove());
  const input = wrap.querySelector(".tag-input");
  items.forEach((item) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.innerHTML = `${esc(item)}<span class="x" data-v="${esc(item)}">×</span>`;
    wrap.insertBefore(tag, input);
  });
  wrap.onclick = (e) => { if (!e.target.classList.contains("x")) input.focus(); };
}

function collectTags(wrapId) {
  return Array.from(document.getElementById(wrapId).querySelectorAll(".tag")).map(
    (t) => t.textContent.replace("×", "").trim()
  );
}

function setupTagInput(inputId, wrapId) {
  const input = document.getElementById(inputId);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      e.preventDefault();
      const val = input.value.trim();
      const existing = collectTags(wrapId);
      if (!existing.map((s) => s.toLowerCase()).includes(val.toLowerCase())) {
        existing.push(val);
        renderTags(wrapId, existing);
        saveConfig();
      }
      input.value = "";
    }
    if (e.key === "Backspace" && !input.value) {
      const tags = document.getElementById(wrapId).querySelectorAll(".tag");
      if (tags.length) { tags[tags.length - 1].remove(); saveConfig(); }
    }
  });
  document.getElementById(wrapId).addEventListener("click", (e) => {
    if (e.target.classList.contains("x")) {
      e.target.parentElement.remove();
      saveConfig();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
let dashInterval = null;

async function refreshDashboard() {
  const cfg = await loadConfig();

  // All-time stat
  $("#statAllTime").textContent = (cfg.stats?.totalHidden || 0).toLocaleString();

  // Active rules summary
  renderRulesSummary(cfg.filters, cfg.filterMode);

  // Query ALL YouTube tabs (not just active — options page is the active tab)
  try {
    const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
    if (tabs.length > 0) {
      const names = tabs.map((t) => { try { return new URL(t.url).pathname; } catch { return "?"; } });
      $("#liveStatus").textContent = `connected — ${tabs.length} tab${tabs.length > 1 ? "s" : ""} (${names.join(", ")})`;

      // Aggregate stats from all YT tabs
      let totalAll = 0, hiddenAll = 0, responded = 0;
      const done = () => {
        responded++;
        if (responded === tabs.length) {
          $("#statHidden").textContent = hiddenAll;
          $("#statTotal").textContent = totalAll;
          $("#statVisible").textContent = totalAll - hiddenAll;
        }
      };
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: "GET_LIVE_STATS" }, (resp) => {
          if (!chrome.runtime.lastError && resp) {
            totalAll += resp.total || 0;
            hiddenAll += resp.hidden || 0;
          }
          done();
        });
      }
    } else {
      $("#liveStatus").textContent = "no youtube tabs open";
      $("#statHidden").textContent = "—";
      $("#statTotal").textContent = "—";
      $("#statVisible").textContent = "—";
    }
  } catch {
    $("#liveStatus").textContent = "unable to query tabs";
  }

  // Recent log entries
  chrome.runtime.sendMessage({ type: "GET_LOG" }, (log) => {
    if (chrome.runtime.lastError || !log) return;
    const recent = log.slice(-5).reverse();
    const body = $("#recentHitsBody");
    if (recent.length === 0) {
      body.innerHTML = '<div class="log-empty">no recent activity</div>';
      return;
    }
    body.innerHTML = recent.map((e) => {
      const time = new Date(e.ts).toLocaleTimeString();
      const reasons = (e.reasons || []).map((r) => `<span class="reason-tag">${esc(r)}</span>`).join("");
      return `<div style="padding:4px 0;border-bottom:1px solid #161616;font-size:11px">
        <span style="color:#555;width:70px;display:inline-block">${time}</span>
        <span style="color:#d4d4d4">${esc(e.title?.slice(0, 60) || "—")}</span>
        <span style="color:#555"> · </span>
        <span style="color:#00bcd4">${esc(e.channel || "—")}</span>
        <div style="margin-top:2px">${reasons}</div>
      </div>`;
    }).join("");
  });
}

function renderRulesSummary(f, mode) {
  const list = $("#rulesSummary");
  const rules = [];

  const modeLabel = mode === "blur" ? "blur" : "hide";
  rules.push(`<span class="rl">mode</span> <span class="rv">${modeLabel}</span>`);
  if (currentConfig?.mlEnabled) {
    rules.push(`<span class="rl">ml</span> <span class="rv">enabled</span>`);
  }

  if (f?.titleKeywords?.length) {
    rules.push(`<span class="rl">keywords</span> <span class="rv">${f.titleKeywords.map(esc).join(", ")}</span>`);
  }
  if (f?.channelNames?.length) {
    rules.push(`<span class="rl">channels</span> <span class="rv">${f.channelNames.map(esc).join(", ")}</span>`);
  }
  if (f?.titleRegex) {
    rules.push(`<span class="rl">regex</span> <span class="rv">/${esc(f.titleRegex)}/i</span>`);
  }
  if (f?.minDuration != null || f?.maxDuration != null) {
    const parts = [];
    if (f.minDuration != null) parts.push(`min ${f.minDuration}s`);
    if (f.maxDuration != null) parts.push(`max ${f.maxDuration}s`);
    rules.push(`<span class="rl">duration</span> <span class="rv">${parts.join(", ")}</span>`);
  }
  if (f?.hideShorts) rules.push(`<span class="rl">hide</span> <span class="rv">shorts</span>`);
  if (f?.hideLive)   rules.push(`<span class="rl">hide</span> <span class="rv">live</span>`);
  if (f?.hideWatched) rules.push(`<span class="rl">hide</span> <span class="rv">watched</span>`);
  if (f?.hideMixes)  rules.push(`<span class="rl">hide</span> <span class="rv">mixes</span>`);
  if (f?.hidePlayables) rules.push(`<span class="rl">hide</span> <span class="rv">playables</span>`);
  if (f?.hideAds) rules.push(`<span class="rl">hide</span> <span class="rv">ads</span>`);
  if (f?.hideClickbait) rules.push(`<span class="rl">hide</span> <span class="rv">clickbait</span>`);
  if (f?.hideToxic) rules.push(`<span class="rl">hide</span> <span class="rv">toxic / dark patterns</span>`);

  if (rules.length === 0) {
    list.innerHTML = '<div class="no-rules">no active filters</div>';
  } else {
    list.innerHTML = rules.map((r) => `<li>${r}</li>`).join("");
  }
}

// Poll dashboard every 2s while visible
function startDashPoll() {
  if (dashInterval) clearInterval(dashInterval);
  dashInterval = setInterval(() => {
    if ($("#panel-dashboard").classList.contains("active")) refreshDashboard();
  }, 2000);
}

// ═══════════════════════════════════════════════════════════════════════
// LOG
// ═══════════════════════════════════════════════════════════════════════
function loadLog() {
  chrome.runtime.sendMessage({ type: "GET_LOG" }, (log) => {
    if (chrome.runtime.lastError) { log = []; }
    log = log || [];
    const body = $("#logBody");
    const count = $("#logCount");
    count.textContent = `${log.length} entries`;

    if (log.length === 0) {
      body.innerHTML = '<tr><td colspan="5" class="log-empty">no entries yet — browse youtube to see filter hits</td></tr>';
      return;
    }

    // Show newest first
    const rows = log.slice().reverse().map((e) => {
      const time = new Date(e.ts).toLocaleTimeString();
      const reasons = (e.reasons || []).map((r) => `<span class="reason-tag">${esc(r)}</span>`).join(" ");
      const titleHtml = e.url
        ? `<a href="${esc(e.url)}" target="_blank" style="color:var(--text-hi);text-decoration:none" title="${esc(e.title)}">${esc(e.title?.slice(0, 60) || "—")}</a>`
        : esc(e.title?.slice(0, 60) || "—");
      return `<tr>
        <td class="time-col">${time}</td>
        <td class="title-col">${titleHtml}</td>
        <td class="channel-col">${esc(e.channel || "—")}</td>
        <td class="dur-col">${esc(e.duration || "—")}</td>
        <td class="reason-col">${reasons}</td>
      </tr>`;
    });

    body.innerHTML = rows.join("");
  });
}

$("#refreshLogBtn").addEventListener("click", loadLog);
$("#clearLogBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CLEAR_LOG" }, () => {
    loadLog();
    toast("log cleared");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════════════════════
async function populateExport() {
  const cfg = await loadConfig();
  // Export only filters (not stats)
  const exportObj = {
    _ytf_version: "2.1.0",
    enabled: cfg.enabled,
    filterMode: cfg.filterMode || "hide",
    mlEnabled: cfg.mlEnabled || false,
    filters: cfg.filters,
  };
  $("#exportArea").value = JSON.stringify(exportObj, null, 2);
}

$("#copyExportBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#exportArea").value);
    toast("copied to clipboard");
  } catch {
    $("#exportArea").select();
    document.execCommand("copy");
    toast("copied");
  }
});

$("#downloadExportBtn").addEventListener("click", () => {
  const blob = new Blob([$("#exportArea").value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ytf-config-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("downloaded");
});

$("#applyImportBtn").addEventListener("click", async () => {
  const raw = ($("#importArea").value || "").trim();
  if (!raw) { toast("paste config JSON first", true); return; }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    toast("invalid JSON: " + e.message, true);
    return;
  }

  if (!parsed.filters || typeof parsed.filters !== "object") {
    toast("missing 'filters' object in config", true);
    return;
  }

  const cfg = await loadConfig();
  cfg.enabled = parsed.enabled ?? cfg.enabled;
  cfg.filterMode = parsed.filterMode ?? cfg.filterMode;
  cfg.mlEnabled = parsed.mlEnabled ?? cfg.mlEnabled;
  cfg.filters = { ...cfg.filters, ...parsed.filters };
  await chrome.storage.sync.set({ ytFilterConfig: cfg });
  currentConfig = cfg;
  populateUI(cfg);
  chrome.runtime.sendMessage({ type: "UPDATE_BADGE", config: cfg });
  toast("config imported successfully");
});

$("#loadFileBtn").addEventListener("click", () => { $("#fileInput").click(); });
$("#fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { $("#importArea").value = reader.result; };
  reader.readAsText(file);
  e.target.value = "";
});

// ═══════════════════════════════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════════════════════════════

const BUILTIN_PRESETS = [
  {
    id: "clean-feed",
    name: "clean feed",
    desc: "Remove shorts, mixes, playables, and live streams for a focused video-only feed.",
    filters: {
      titleKeywords: [],
      channelNames: [],
      titleRegex: "",
      hideShorts: true,
      hideLive: true,
      hideWatched: false,
      hideMixes: true,
      hidePlayables: true,
      hideAds: true,
      hideClickbait: true,
      hideToxic: true,
      minDuration: null,
      maxDuration: null,
    },
  },
  {
    id: "no-ads-sponsored",
    name: "anti-sponsored",
    desc: "Filter out videos with common sponsorship markers in the title.",
    filters: {
      titleKeywords: ["#ad", "#sponsored", "paid promotion"],
      channelNames: [],
      titleRegex: "\\b(sponsor(ed)?|#ad|ad\\b.*\\|)\\b",
      hideShorts: false,
      hideLive: false,
      hideWatched: false,
      hideMixes: false,
      hidePlayables: false,
      hideAds: true,
      hideClickbait: true,
      hideToxic: true,
      minDuration: null,
      maxDuration: null,
    },
  },
  {
    id: "deep-content",
    name: "deep content only",
    desc: "Only show videos longer than 10 minutes. Filters shorts, clips, and trailers.",
    filters: {
      titleKeywords: [],
      channelNames: [],
      titleRegex: "",
      hideShorts: true,
      hideLive: false,
      hideWatched: false,
      hideMixes: true,
      hidePlayables: true,
      hideAds: true,
      hideClickbait: true,
      hideToxic: true,
      minDuration: 600,
      maxDuration: null,
    },
  },
  {
    id: "quick-watch",
    name: "quick watch",
    desc: "Only show videos under 5 minutes. Perfect for a short break.",
    filters: {
      titleKeywords: [],
      channelNames: [],
      titleRegex: "",
      hideShorts: false,
      hideLive: true,
      hideWatched: false,
      hideMixes: true,
      hidePlayables: false,
      hideAds: true,
      hideClickbait: true,
      hideToxic: true,
      minDuration: null,
      maxDuration: 300,
    },
  },
  {
    id: "fresh-only",
    name: "fresh only",
    desc: "Hide everything you've already watched. Only unwatched content.",
    filters: {
      titleKeywords: [],
      channelNames: [],
      titleRegex: "",
      hideShorts: false,
      hideLive: false,
      hideWatched: true,
      hideMixes: false,
      hidePlayables: false,
      hideAds: true,
      hideClickbait: true,
      hideToxic: true,
      minDuration: null,
      maxDuration: null,
    },
  },
  {
    id: "no-clickbait",
    name: "anti-clickbait",
    desc: "Filter common clickbait patterns: ALL CAPS, excessive punctuation, rage-bait phrases.",
    filters: {
      titleKeywords: ["gone wrong", "you won't believe", "shocking", "not clickbait"],
      channelNames: [],
      titleRegex: "^[A-Z\\s!?]{15,}|!{3,}|\\?{3,}|GONE WRONG|EXPOSED|DESTROYED",
      hideShorts: false,
      hideLive: false,
      hideWatched: false,
      hideMixes: false,
      hidePlayables: false,
      hideAds: true,
      hideClickbait: true,
      hideToxic: true,
      minDuration: null,
      maxDuration: null,
    },
  },
  {
    id: "focus-mode",
    name: "focus mode",
    desc: "Maximum distraction reduction: no shorts, no live, no mixes, no playables, no watched, 10-60 min only.",
    filters: {
      titleKeywords: [],
      channelNames: [],
      titleRegex: "",
      hideShorts: true,
      hideLive: true,
      hideWatched: true,
      hideMixes: true,
      hidePlayables: true,
      hideAds: true,
      hideClickbait: true,
      hideToxic: true,
      minDuration: 600,
      maxDuration: 3600,
    },
  },
  {
    id: "reset",
    name: "reset / clear all",
    desc: "Disable all filters and start from scratch.",
    filters: {
      titleKeywords: [],
      channelNames: [],
      titleRegex: "",
      hideShorts: false,
      hideLive: false,
      hideWatched: false,
      hideMixes: false,
      hidePlayables: false,
      hideAds: false,
      hideClickbait: false,
      hideToxic: false,
      minDuration: null,
      maxDuration: null,
    },
  },
];

// ── Build rule description lines from a filters object ───────────────
function describeFilters(f) {
  const lines = [];
  if (f.titleKeywords?.length)
    lines.push({ label: "keywords", value: f.titleKeywords.join(", ") });
  if (f.channelNames?.length)
    lines.push({ label: "channels", value: f.channelNames.join(", ") });
  if (f.titleRegex)
    lines.push({ label: "regex", value: `/${f.titleRegex}/i` });
  if (f.minDuration != null)
    lines.push({ label: "min dur", value: `${f.minDuration}s` });
  if (f.maxDuration != null)
    lines.push({ label: "max dur", value: `${f.maxDuration}s` });
  if (f.hideShorts) lines.push({ label: "hide", value: "shorts" });
  if (f.hideLive) lines.push({ label: "hide", value: "live" });
  if (f.hideWatched) lines.push({ label: "hide", value: "watched" });
  if (f.hideMixes) lines.push({ label: "hide", value: "mixes" });
  if (f.hidePlayables) lines.push({ label: "hide", value: "playables" });
  if (f.hideAds) lines.push({ label: "hide", value: "ads" });
  if (f.hideClickbait) lines.push({ label: "hide", value: "clickbait" });
  if (f.hideToxic) lines.push({ label: "hide", value: "toxic / dark patterns" });
  return lines;
}

function renderPresetCard(preset, isUser = false, currentFilters = null) {
  const rules = describeFilters(preset.filters);
  const rulesHtml = rules.length > 0
    ? rules.map((r) => `<div class="pc-rule"><span class="rl">${esc(r.label)}</span> <span class="rv">${esc(r.value)}</span></div>`).join("")
    : '<div style="color:#333;font-size:10px"># no rules (clears all filters)</div>';

  const tsHtml = preset.savedAt
    ? `<div class="pc-ts">${new Date(preset.savedAt).toLocaleDateString()}</div>`
    : "";

  const deleteBtn = isUser
    ? `<button class="btn btn-accent btn-sm" data-delete="${esc(preset.id)}">delete</button>`
    : "";

  const isActive = currentFilters ? filtersMatch(currentFilters, preset.filters) : false;
  const activeBadge = isActive ? '<span class="pc-badge active">ACTIVE</span>' : '<span class="pc-badge inactive">INACTIVE</span>';
  const activeClass = isActive ? " pc-active" : "";

  return `<div class="preset-card${isUser ? " user" : ""}${activeClass}">
    ${tsHtml}
    <div class="pc-name">${esc(preset.name)} ${activeBadge}</div>
    <div class="pc-desc">${esc(preset.desc || "")}</div>
    <div class="pc-rules">${rulesHtml}</div>
    <div class="pc-actions">
      <button class="btn btn-green btn-sm" data-apply="${esc(preset.id)}" data-source="${isUser ? "user" : "builtin"}">apply</button>
      ${deleteBtn}
    </div>
  </div>`;
}

// ── Compare current config filters against a preset's filters ────────
function filtersMatch(current, preset) {
  // Normalize for comparison: treat null, undefined, "", and [] as equivalent empty values
  const norm = (v) => {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return v.length === 0 ? null : JSON.stringify(v.slice().sort());
    if (v === "" || v === false) return null;
    return JSON.stringify(v);
  };

  const keys = [
    "titleKeywords", "channelNames", "titleRegex",
    "hideShorts", "hideLive", "hideWatched", "hideMixes", "hidePlayables", "hideAds",
    "hideClickbait", "hideToxic",
    "minDuration", "maxDuration"
  ];

  for (const k of keys) {
    if (norm(current[k]) !== norm(preset[k])) return false;
  }
  return true;
}

async function getUserPresets() {
  const result = await chrome.storage.local.get("ytFilterPresets");
  return result.ytFilterPresets || [];
}

async function setUserPresets(presets) {
  await chrome.storage.local.set({ ytFilterPresets: presets });
}

async function renderPresets() {
  const cfg = await loadConfig();
  const currentFilters = cfg.filters || {};

  // Built-in
  const builtinEl = $("#builtinPresets");
  builtinEl.innerHTML = BUILTIN_PRESETS.map((p) => renderPresetCard(p, false, currentFilters)).join("");

  // User-saved
  const userPresets = await getUserPresets();
  const userEl = $("#userPresets");
  const emptyEl = $("#noUserPresets");

  if (userPresets.length === 0) {
    userEl.innerHTML = "";
    emptyEl.style.display = "";
  } else {
    emptyEl.style.display = "none";
    userEl.innerHTML = userPresets.map((p) => renderPresetCard(p, true, currentFilters)).join("");
  }

  // Wire apply buttons (delegated)
  document.getElementById("panel-presets").onclick = async (e) => {
    const applyBtn = e.target.closest("[data-apply]");
    const deleteBtn = e.target.closest("[data-delete]");

    if (applyBtn) {
      const id = applyBtn.dataset.apply;
      const source = applyBtn.dataset.source;
      let preset;

      if (source === "builtin") {
        preset = BUILTIN_PRESETS.find((p) => p.id === id);
      } else {
        const ups = await getUserPresets();
        preset = ups.find((p) => p.id === id);
      }

      if (!preset) { toast("preset not found", true); return; }

      const cfg = await loadConfig();
      cfg.filters = { ...cfg.filters, ...JSON.parse(JSON.stringify(preset.filters)) };
      await chrome.storage.sync.set({ ytFilterConfig: cfg });
      currentConfig = cfg;
      populateUI(cfg);
      chrome.runtime.sendMessage({ type: "UPDATE_BADGE", config: cfg });
      toast(`applied: ${preset.name}`);
      renderPresets(); // re-render to update active badges
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.delete;
      let ups = await getUserPresets();
      ups = ups.filter((p) => p.id !== id);
      await setUserPresets(ups);
      renderPresets();
      toast("preset deleted");
    }
  };
}

// ── Save current config as user preset ───────────────────────────────
$("#savePresetBtn").addEventListener("click", () => {
  $("#presetNameInput").value = "";
  $("#presetDescInput").value = "";
  $("#saveModal").classList.add("show");
  setTimeout(() => $("#presetNameInput").focus(), 100);
});

$("#cancelSaveBtn").addEventListener("click", () => {
  $("#saveModal").classList.remove("show");
});

// Close modal on overlay click
$("#saveModal").addEventListener("click", (e) => {
  if (e.target === $("#saveModal")) {
    $("#saveModal").classList.remove("show");
  }
});

$("#confirmSaveBtn").addEventListener("click", async () => {
  const name = ($("#presetNameInput").value || "").trim();
  if (!name) { toast("name required", true); return; }

  const cfg = await loadConfig();
  const preset = {
    id: "user-" + Date.now().toString(36),
    name: name,
    desc: ($("#presetDescInput").value || "").trim(),
    filters: JSON.parse(JSON.stringify(cfg.filters)),
    savedAt: Date.now(),
  };

  const ups = await getUserPresets();
  ups.push(preset);
  await setUserPresets(ups);

  $("#saveModal").classList.remove("show");
  renderPresets();
  toast(`saved: ${name}`);
});

// Enter key in modal
$("#presetNameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("#confirmSaveBtn").click(); }
});
$("#presetDescInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("#confirmSaveBtn").click(); }
});

// ═══════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  const cfg = await loadConfig();
  populateUI(cfg);

  // Wire up save-on-change
  setupTagInput("kwInput", "kwWrap");
  setupTagInput("chInput", "chWrap");

  $("#enableToggle").addEventListener("change", saveConfig);
  $("#mlEnabled").addEventListener("change", saveConfig);

  // Filter mode segmented control
  document.querySelectorAll("#filterModeControl .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#filterModeControl .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      saveConfig();
    });
  });

  $("#hideShorts").addEventListener("change", saveConfig);
  $("#hideLive").addEventListener("change", saveConfig);
  $("#hideWatched").addEventListener("change", saveConfig);
  $("#hideMixes").addEventListener("change", saveConfig);
  $("#hidePlayables").addEventListener("change", saveConfig);
  $("#hideAds").addEventListener("change", saveConfig);
  $("#hideClickbait").addEventListener("change", saveConfig);
  $("#hideToxic").addEventListener("change", saveConfig);
  $("#regexInput").addEventListener("change", saveConfig);
  $("#minDur").addEventListener("change", saveConfig);
  $("#maxDur").addEventListener("change", saveConfig);

  // Initial dashboard
  refreshDashboard();
  startDashPoll();
  populateExport();
});
