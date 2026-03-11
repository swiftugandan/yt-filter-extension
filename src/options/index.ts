import { loadConfig, populateUI, saveConfig, setupTagInput } from "./config-ui";
import { getOnboarded, setOnboarded } from "../shared/storage";
import { refreshDashboard, startDashPoll } from "./dashboard";
import { loadLog, setupLogPanel } from "./log-panel";
import {
  applyPresetFilters,
  BUILTIN_PRESETS,
  renderPresets,
  setupPresetModal,
  setToast as setPresetToast,
} from "./presets";
import {
  populateExport,
  setupImportExport,
  setToast as setIOToast,
} from "./import-export";
import { $, $$ } from "../shared/dom";

// ── Toast ──
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function toast(msg: string, isError = false): void {
  const el = $("#toast");
  el.textContent = msg;
  el.className = isError ? "toast error show" : "toast show";
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2500);
}

// Share toast with sub-modules
setPresetToast(toast);
setIOToast(toast);

// ── Tab navigation ──
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    $$(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $(`#panel-${(tab as HTMLElement).dataset.tab}`).classList.add("active");

    if ((tab as HTMLElement).dataset.tab === "dashboard") refreshDashboard();
    if ((tab as HTMLElement).dataset.tab === "log") loadLog();
    if ((tab as HTMLElement).dataset.tab === "presets") renderPresets();
    if ((tab as HTMLElement).dataset.tab === "io") populateExport();
  });
});

// ── Log panel ──
setupLogPanel(toast);

// ── Presets modal ──
setupPresetModal();

// ── Import/Export ──
setupImportExport();

// ── Advanced toggle ──
const advToggle = $("#advancedToggle");
const advSections = $("#advancedSections");
advToggle.addEventListener("click", () => {
  const isOpen = advSections.classList.toggle("open");
  advToggle.classList.toggle("open", isOpen);
  (advToggle.querySelector("span:last-child") as HTMLElement).textContent =
    isOpen ? "Hide advanced options" : "Show advanced options";
});

// ── Init ──
document.addEventListener("DOMContentLoaded", async () => {
  const cfg = await loadConfig();
  populateUI(cfg);

  setupTagInput("kwInput", "kwWrap");
  setupTagInput("chInput", "chWrap");

  ($("#enableToggle") as HTMLInputElement).addEventListener(
    "change",
    saveConfig,
  );
  ($("#mlEnabled") as HTMLInputElement).addEventListener("change", saveConfig);

  $$("#filterModeControl .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("#filterModeControl .seg-btn").forEach((b) =>
        b.classList.remove("active"),
      );
      btn.classList.add("active");
      saveConfig();
    });
  });

  ($("#hideShorts") as HTMLInputElement).addEventListener("change", saveConfig);
  ($("#hideLive") as HTMLInputElement).addEventListener("change", saveConfig);
  ($("#hideWatched") as HTMLInputElement).addEventListener(
    "change",
    saveConfig,
  );
  ($("#hideMixes") as HTMLInputElement).addEventListener("change", saveConfig);
  ($("#hidePlayables") as HTMLInputElement).addEventListener(
    "change",
    saveConfig,
  );
  ($("#hideAds") as HTMLInputElement).addEventListener("change", saveConfig);
  ($("#hideClickbait") as HTMLInputElement).addEventListener(
    "change",
    saveConfig,
  );
  ($("#hideToxic") as HTMLInputElement).addEventListener("change", saveConfig);
  ($("#regexInput") as HTMLInputElement).addEventListener("change", saveConfig);
  ($("#minDur") as HTMLInputElement).addEventListener("change", saveConfig);
  ($("#maxDur") as HTMLInputElement).addEventListener("change", saveConfig);

  renderPresets();
  startDashPoll();
  populateExport();

  // ── Onboarding (first run) ──
  const onboarded = await getOnboarded();
  if (!onboarded) {
    const overlay = $("#onboarding");
    overlay.classList.add("show");

    const dismiss = async () => {
      overlay.classList.remove("show");
      await setOnboarded();
    };

    $("#onboardingSkip").addEventListener("click", dismiss);

    overlay.querySelectorAll(".onb-pick").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const presetId = (btn as HTMLElement).dataset.preset;
        const preset = BUILTIN_PRESETS.find((p) => p.id === presetId);
        if (!preset) {
          toast("Preset not found", true);
          return;
        }
        await applyPresetFilters(preset.filters);
        toast(`Applied: ${preset.name}`);
        renderPresets();
        await dismiss();
      });
    });
  }
});
