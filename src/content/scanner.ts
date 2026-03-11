import type { YTFilterConfig } from "../types/config";
import {
  ATTR_HIDDEN,
  ATTR_PROCESSED,
  ATTR_ML_DONE,
  ATTR_ML_PENDING,
  ATTR_REASON,
  VIDEO_CONTAINER_SELECTORS,
  DEBOUNCE_MS,
} from "../shared/constants";
import { extractMeta } from "./metadata";
import { matchReasons } from "./filters";
import { createLogEntry, queueLogEntry } from "./logging";
import { queueForML, isMLWorkerActive } from "./ml-client";

let configHash = "";
let scanTimer: ReturnType<typeof setTimeout> | null = null;

export function recomputeHash(config: YTFilterConfig | null): void {
  configHash =
    (config?.filterMode || "hide") +
    ":" +
    JSON.stringify(config?.filters || {}).slice(0, 64);
}

export function scanContainers(
  config: YTFilterConfig | null,
  compiledTitleRegex: RegExp | null,
  hiddenCount: { value: number },
): void {
  if (!config?.enabled) return;

  const containers = document.querySelectorAll(VIDEO_CONTAINER_SELECTORS);
  let newlyHidden = 0;

  for (const el of containers) {
    if (el.getAttribute(ATTR_PROCESSED) === configHash) continue;

    const meta = extractMeta(el);
    const reasons = matchReasons(meta, config, compiledTitleRegex);
    const hide = reasons.length > 0;

    el.setAttribute(ATTR_HIDDEN, hide ? "true" : "false");
    el.setAttribute(ATTR_PROCESSED, configHash);

    if (hide) {
      el.setAttribute(ATTR_REASON, "filtered: " + reasons.join(", "));
    } else {
      el.removeAttribute(ATTR_REASON);
    }

    if (hide) {
      newlyHidden++;
      queueLogEntry(createLogEntry(meta, reasons));
    } else if (
      config?.mlEnabled &&
      isMLWorkerActive() &&
      meta.title &&
      !el.getAttribute(ATTR_ML_DONE)
    ) {
      el.setAttribute(ATTR_ML_PENDING, "true");
      queueForML(el, meta);
    }
  }

  if (newlyHidden > 0) {
    hiddenCount.value += newlyHidden;
    try {
      chrome.runtime.sendMessage({
        type: "HIDDEN_COUNT",
        count: hiddenCount.value,
      });
    } catch {
      /* ok */
    }
  }
}

export function debouncedScan(
  config: YTFilterConfig | null,
  compiledTitleRegex: RegExp | null,
  hiddenCount: { value: number },
): void {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(
    () => scanContainers(config, compiledTitleRegex, hiddenCount),
    DEBOUNCE_MS,
  );
}

export function clearProcessedAttrs(includeML = false): void {
  document.querySelectorAll(`[${ATTR_PROCESSED}]`).forEach((el) => {
    el.removeAttribute(ATTR_PROCESSED);
    if (includeML) {
      el.removeAttribute(ATTR_ML_DONE);
      el.removeAttribute(ATTR_ML_PENDING);
    }
  });
}
