import type { YTFilterConfig } from "../types/config";
import { escapeHtml } from "../shared/escape-html";
import { getConfig, setConfig } from "../shared/storage";
import { $, $$ } from "../shared/dom";

let currentConfig: YTFilterConfig | null = null;

export function getCurrentConfig(): YTFilterConfig | null {
  return currentConfig;
}

export function setCurrentConfig(cfg: YTFilterConfig): void {
  currentConfig = cfg;
}

export async function loadConfig(): Promise<YTFilterConfig> {
  currentConfig = await getConfig();
  return currentConfig;
}

export async function saveConfig(): Promise<void> {
  if (!currentConfig) return;
  currentConfig.enabled = ($("#enableToggle") as HTMLInputElement).checked;
  updateStatusText();

  const activeMode = document.querySelector(
    "#filterModeControl .seg-btn.active",
  ) as HTMLElement | null;
  currentConfig.filterMode =
    (activeMode?.dataset.mode as "hide" | "blur") || "hide";

  currentConfig.mlEnabled = ($("#mlEnabled") as HTMLInputElement).checked;

  const f = currentConfig.filters;
  f.titleKeywords = collectTags("kwWrap");
  f.channelNames = collectTags("chWrap");
  f.titleRegex = (($("#regexInput") as HTMLInputElement).value || "").trim();
  f.hideShorts = ($("#hideShorts") as HTMLInputElement).checked;
  f.hideLive = ($("#hideLive") as HTMLInputElement).checked;
  f.hideWatched = ($("#hideWatched") as HTMLInputElement).checked;
  f.hideMixes = ($("#hideMixes") as HTMLInputElement).checked;
  f.hidePlayables = ($("#hidePlayables") as HTMLInputElement).checked;
  f.hideAds = ($("#hideAds") as HTMLInputElement).checked;
  f.hideClickbait = ($("#hideClickbait") as HTMLInputElement).checked;
  f.hideToxic = ($("#hideToxic") as HTMLInputElement).checked;

  const minVal = (($("#minDur") as HTMLInputElement).value || "").trim();
  const maxVal = (($("#maxDur") as HTMLInputElement).value || "").trim();
  f.minDuration = minVal !== "" ? Number(minVal) : null;
  f.maxDuration = maxVal !== "" ? Number(maxVal) : null;

  currentConfig.filters = f;
  await setConfig(currentConfig);
  chrome.runtime.sendMessage({ type: "UPDATE_BADGE", config: currentConfig });
}

function updateStatusText(): void {
  const on = ($("#enableToggle") as HTMLInputElement).checked;
  const el = $("#statusText");
  el.textContent = on ? "ACTIVE" : "INACTIVE";
  el.className = on ? "status on" : "status off";
}

export function populateUI(cfg: YTFilterConfig): void {
  ($("#enableToggle") as HTMLInputElement).checked = cfg.enabled;
  updateStatusText();

  const mode = cfg.filterMode || "hide";
  $$("#filterModeControl .seg-btn").forEach((btn) => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.mode === mode);
  });

  ($("#mlEnabled") as HTMLInputElement).checked = cfg.mlEnabled || false;

  const f = cfg.filters || ({} as YTFilterConfig["filters"]);
  renderTags("kwWrap", f.titleKeywords || []);
  renderTags("chWrap", f.channelNames || []);
  ($("#regexInput") as HTMLInputElement).value = f.titleRegex || "";
  ($("#minDur") as HTMLInputElement).value =
    f.minDuration != null ? String(f.minDuration) : "";
  ($("#maxDur") as HTMLInputElement).value =
    f.maxDuration != null ? String(f.maxDuration) : "";
  ($("#hideShorts") as HTMLInputElement).checked = f.hideShorts || false;
  ($("#hideLive") as HTMLInputElement).checked = f.hideLive || false;
  ($("#hideWatched") as HTMLInputElement).checked = f.hideWatched || false;
  ($("#hideMixes") as HTMLInputElement).checked = f.hideMixes || false;
  ($("#hidePlayables") as HTMLInputElement).checked = f.hidePlayables || false;
  ($("#hideAds") as HTMLInputElement).checked = f.hideAds ?? true;
  ($("#hideClickbait") as HTMLInputElement).checked = f.hideClickbait ?? true;
  ($("#hideToxic") as HTMLInputElement).checked = f.hideToxic ?? true;
}

// ── Tag inputs ──
function renderTags(wrapId: string, items: string[]): void {
  const wrap = document.getElementById(wrapId)!;
  wrap.querySelectorAll(".tag").forEach((t) => t.remove());
  const input = wrap.querySelector(".tag-input") as HTMLInputElement;
  items.forEach((item) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.innerHTML = `${escapeHtml(item)}<span class="x" data-v="${escapeHtml(item)}">×</span>`;
    wrap.insertBefore(tag, input);
  });
  wrap.onclick = (e) => {
    if (!(e.target as HTMLElement).classList.contains("x")) input.focus();
  };
}

export function collectTags(wrapId: string): string[] {
  return Array.from(
    document.getElementById(wrapId)!.querySelectorAll(".tag"),
  ).map((t) => t.textContent!.replace("×", "").trim());
}

export function setupTagInput(inputId: string, wrapId: string): void {
  const input = document.getElementById(inputId) as HTMLInputElement;
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
      const tags = document.getElementById(wrapId)!.querySelectorAll(".tag");
      if (tags.length) {
        tags[tags.length - 1].remove();
        saveConfig();
      }
    }
  });
  document.getElementById(wrapId)!.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("x")) {
      (e.target as HTMLElement).parentElement!.remove();
      saveConfig();
    }
  });
}
