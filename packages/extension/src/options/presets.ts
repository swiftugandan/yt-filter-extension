import type { YTFilterConfig, FilterRules } from "../types/config";
import type { UserPreset } from "../shared/storage";
import { escapeHtml } from "../shared/escape-html";
import { $ } from "../shared/dom";
import { getUserPresets, setUserPresets, setConfig } from "../shared/storage";
import { loadConfig, populateUI, setCurrentConfig } from "./config-ui";

/** Apply a preset's filters to the current config, update UI and badge. */
export async function applyPresetFilters(
  filters: FilterRules,
): Promise<YTFilterConfig> {
  const cfg = await loadConfig();
  cfg.filters = { ...cfg.filters, ...filters };
  await setConfig(cfg);
  setCurrentConfig(cfg);
  populateUI(cfg);
  chrome.runtime.sendMessage({ type: "UPDATE_BADGE", config: cfg });
  return cfg;
}

export const BUILTIN_PRESETS: Array<{
  id: string;
  name: string;
  desc: string;
  filters: FilterRules;
}> = [
  {
    id: "clean-feed",
    name: "Clean Feed",
    desc: "Remove Shorts, mixes, playables, and live streams. Just regular videos.",
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
    name: "No Sponsored Content",
    desc: "Filter out videos with sponsorship markers like #ad or #sponsored in the title.",
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
    name: "Long Videos Only",
    desc: "Only show videos longer than 10 minutes. Great for in-depth content.",
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
    name: "Quick Watch",
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
    name: "Fresh Only",
    desc: "Hide videos you've already watched. Only show new content.",
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
    name: "No Clickbait",
    desc: "Filter out ALL CAPS titles, excessive punctuation, and common bait phrases.",
    filters: {
      titleKeywords: [
        "gone wrong",
        "you won't believe",
        "shocking",
        "not clickbait",
      ],
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
    name: "Focus Mode",
    desc: "Maximum distraction reduction. Only shows 10-60 min videos you haven't watched yet.",
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
    name: "Reset Everything",
    desc: "Turn off all filters and start fresh.",
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

function describeFilters(
  f: FilterRules,
): Array<{ label: string; value: string }> {
  const lines: Array<{ label: string; value: string }> = [];
  if (f.titleKeywords?.length)
    lines.push({ label: "Keywords", value: f.titleKeywords.join(", ") });
  if (f.channelNames?.length)
    lines.push({ label: "Channels", value: f.channelNames.join(", ") });
  if (f.titleRegex) lines.push({ label: "Pattern", value: f.titleRegex });
  if (f.minDuration != null)
    lines.push({ label: "Min length", value: `${f.minDuration}s` });
  if (f.maxDuration != null)
    lines.push({ label: "Max length", value: `${f.maxDuration}s` });
  if (f.hideShorts) lines.push({ label: "Filtering", value: "Shorts" });
  if (f.hideLive) lines.push({ label: "Filtering", value: "Live streams" });
  if (f.hideWatched) lines.push({ label: "Filtering", value: "Watched" });
  if (f.hideMixes) lines.push({ label: "Filtering", value: "Mixes" });
  if (f.hidePlayables) lines.push({ label: "Filtering", value: "Playables" });
  if (f.hideAds) lines.push({ label: "Filtering", value: "Ads" });
  if (f.hideClickbait) lines.push({ label: "Filtering", value: "Clickbait" });
  if (f.hideToxic) lines.push({ label: "Filtering", value: "Toxic content" });
  return lines;
}

function filtersMatch(current: FilterRules, preset: FilterRules): boolean {
  const norm = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v))
      return v.length === 0 ? null : JSON.stringify(v.slice().sort());
    if (v === "" || v === false) return null;
    return JSON.stringify(v);
  };

  const keys: Array<keyof FilterRules> = [
    "titleKeywords",
    "channelNames",
    "titleRegex",
    "hideShorts",
    "hideLive",
    "hideWatched",
    "hideMixes",
    "hidePlayables",
    "hideAds",
    "hideClickbait",
    "hideToxic",
    "minDuration",
    "maxDuration",
  ];

  for (const k of keys) {
    if (norm(current[k]) !== norm(preset[k])) return false;
  }
  return true;
}

function renderPresetCard(
  preset: {
    id: string;
    name: string;
    desc?: string;
    filters: FilterRules;
    savedAt?: number;
  },
  isUser: boolean,
  currentFilters: FilterRules | null,
): string {
  const rules = describeFilters(preset.filters);
  const rulesHtml =
    rules.length > 0
      ? rules
          .map(
            (r) =>
              `<div class="pc-rule"><span class="rl">${escapeHtml(r.label)}</span> <span class="rv">${escapeHtml(r.value)}</span></div>`,
          )
          .join("")
      : '<div style="color:#333;font-size:10px"># no rules (clears all filters)</div>';

  const tsHtml = preset.savedAt
    ? `<div class="pc-ts">${new Date(preset.savedAt).toLocaleDateString()}</div>`
    : "";

  const deleteBtn = isUser
    ? `<button class="btn btn-accent btn-sm" data-delete="${escapeHtml(preset.id)}">delete</button>`
    : "";

  const isActive = currentFilters
    ? filtersMatch(currentFilters, preset.filters)
    : false;
  const activeBadge = isActive
    ? '<span class="pc-badge active">ACTIVE</span>'
    : '<span class="pc-badge inactive">INACTIVE</span>';
  const activeClass = isActive ? " pc-active" : "";

  return `<div class="preset-card${isUser ? " user" : ""}${activeClass}">
    ${tsHtml}
    <div class="pc-name">${escapeHtml(preset.name)} ${activeBadge}</div>
    <div class="pc-desc">${escapeHtml(preset.desc || "")}</div>
    <div class="pc-rules">${rulesHtml}</div>
    <div class="pc-actions">
      <button class="btn btn-green btn-sm" data-apply="${escapeHtml(preset.id)}" data-source="${isUser ? "user" : "builtin"}">apply</button>
      ${deleteBtn}
    </div>
  </div>`;
}

export async function renderPresets(): Promise<void> {
  const cfg = await loadConfig();
  const currentFilters = cfg.filters;

  const builtinEl = $("#builtinPresets");
  builtinEl.innerHTML = BUILTIN_PRESETS.map((p) =>
    renderPresetCard(p, false, currentFilters),
  ).join("");

  const userPresets = await getUserPresets();
  const userEl = $("#userPresets");
  const emptyEl = $("#noUserPresets");

  if (userPresets.length === 0) {
    userEl.innerHTML = "";
    emptyEl.style.display = "";
  } else {
    emptyEl.style.display = "none";
    userEl.innerHTML = userPresets
      .map((p) => renderPresetCard(p, true, currentFilters))
      .join("");
  }

  // Wire apply buttons (delegated)
  document.getElementById("panel-presets")!.onclick = async (e) => {
    const applyBtn = (e.target as HTMLElement).closest(
      "[data-apply]",
    ) as HTMLElement | null;
    const deleteBtn = (e.target as HTMLElement).closest(
      "[data-delete]",
    ) as HTMLElement | null;

    if (applyBtn) {
      const id = applyBtn.dataset.apply!;
      const source = applyBtn.dataset.source;
      let preset:
        | { id: string; name: string; filters: FilterRules }
        | undefined;

      if (source === "builtin") {
        preset = BUILTIN_PRESETS.find((p) => p.id === id);
      } else {
        const ups = await getUserPresets();
        preset = ups.find((p) => p.id === id);
      }

      if (!preset) {
        toast("Preset not found", true);
        return;
      }

      await applyPresetFilters(preset.filters);
      toast(`Applied: ${preset.name}`);
      renderPresets();
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.delete!;
      let ups = await getUserPresets();
      ups = ups.filter((p) => p.id !== id);
      await setUserPresets(ups);
      renderPresets();
      toast("preset deleted");
    }
  };
}

let toast: (msg: string, isError?: boolean) => void = () => {};

export function setToast(fn: (msg: string, isError?: boolean) => void): void {
  toast = fn;
}

export function setupPresetModal(): void {
  $("#savePresetBtn").addEventListener("click", () => {
    ($("#presetNameInput") as HTMLInputElement).value = "";
    ($("#presetDescInput") as HTMLInputElement).value = "";
    $("#saveModal").classList.add("show");
    setTimeout(() => ($("#presetNameInput") as HTMLInputElement).focus(), 100);
  });

  $("#cancelSaveBtn").addEventListener("click", () => {
    $("#saveModal").classList.remove("show");
  });

  $("#saveModal").addEventListener("click", (e) => {
    if (e.target === $("#saveModal")) {
      $("#saveModal").classList.remove("show");
    }
  });

  $("#confirmSaveBtn").addEventListener("click", async () => {
    const name = (
      ($("#presetNameInput") as HTMLInputElement).value || ""
    ).trim();
    if (!name) {
      toast("name required", true);
      return;
    }

    const cfg = await loadConfig();
    const preset: UserPreset = {
      id: "user-" + Date.now().toString(36),
      name: name,
      desc: (($("#presetDescInput") as HTMLInputElement).value || "").trim(),
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

  $("#presetNameInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ($("#confirmSaveBtn") as HTMLButtonElement).click();
    }
  });
  $("#presetDescInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ($("#confirmSaveBtn") as HTMLButtonElement).click();
    }
  });
}
