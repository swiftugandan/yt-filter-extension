import { $ } from "../shared/dom";
import { setConfig } from "../shared/storage";
import { loadConfig, populateUI, setCurrentConfig } from "./config-ui";

let toast: (msg: string, isError?: boolean) => void = () => {};

export function setToast(fn: (msg: string, isError?: boolean) => void): void {
  toast = fn;
}

export async function populateExport(): Promise<void> {
  const cfg = await loadConfig();
  const exportObj = {
    _ytf_version: "2.1.0",
    enabled: cfg.enabled,
    filterMode: cfg.filterMode || "hide",
    mlEnabled: cfg.mlEnabled || false,
    filters: cfg.filters,
  };
  ($("#exportArea") as HTMLTextAreaElement).value = JSON.stringify(
    exportObj,
    null,
    2,
  );
}

export function setupImportExport(): void {
  $("#copyExportBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(
        ($("#exportArea") as HTMLTextAreaElement).value,
      );
      toast("copied to clipboard");
    } catch {
      ($("#exportArea") as HTMLTextAreaElement).select();
      document.execCommand("copy");
      toast("copied");
    }
  });

  $("#downloadExportBtn").addEventListener("click", () => {
    const blob = new Blob([($("#exportArea") as HTMLTextAreaElement).value], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ytf-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("downloaded");
  });

  $("#applyImportBtn").addEventListener("click", async () => {
    const raw = (($("#importArea") as HTMLTextAreaElement).value || "").trim();
    if (!raw) {
      toast("paste config JSON first", true);
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      toast("invalid JSON: " + (e as Error).message, true);
      return;
    }

    if (!parsed.filters || typeof parsed.filters !== "object") {
      toast("missing 'filters' object in config", true);
      return;
    }

    const cfg = await loadConfig();
    cfg.enabled = (parsed.enabled as boolean) ?? cfg.enabled;
    cfg.filterMode = (parsed.filterMode as "hide" | "blur") ?? cfg.filterMode;
    cfg.mlEnabled = (parsed.mlEnabled as boolean) ?? cfg.mlEnabled;
    cfg.filters = {
      ...cfg.filters,
      ...(parsed.filters as Record<string, unknown>),
    } as typeof cfg.filters;
    await setConfig(cfg);
    setCurrentConfig(cfg);
    populateUI(cfg);
    chrome.runtime.sendMessage({ type: "UPDATE_BADGE", config: cfg });
    toast("config imported successfully");
  });

  $("#loadFileBtn").addEventListener("click", () => {
    ($("#fileInput") as HTMLInputElement).click();
  });
  ($("#fileInput") as HTMLInputElement).addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      ($("#importArea") as HTMLTextAreaElement).value = reader.result as string;
    };
    reader.readAsText(file);
    (e.target as HTMLInputElement).value = "";
  });
}
