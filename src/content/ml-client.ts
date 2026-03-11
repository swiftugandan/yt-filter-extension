import type { YTFilterConfig } from "../types/config";
import type { VideoMetadata } from "../types/video";
import type { MLClassifyResult } from "../types/messages";
import {
  ATTR_HIDDEN,
  ATTR_ML_DONE,
  ATTR_REASON,
  ML_BATCH_INTERVAL,
  ML_CACHE_MAX,
} from "../shared/constants";
import { createLogEntry, queueLogEntry } from "./logging";

let mlWorker: true | null = null;
let mlStatus = "idle";
let mlRequestId = 0;
const mlCache = new Map<string, MLClassifyResult | null>();
const mlPendingElements = new Map<
  number,
  Array<{ el: Element; meta: VideoMetadata }>
>();
let mlBatchTimer: ReturnType<typeof setTimeout> | null = null;
let mlBatchQueue: Array<{ el: Element; meta: VideoMetadata }> = [];
let mlDetail = "";

let hiddenCountRef = { value: 0 };

export function setHiddenCountRef(ref: { value: number }): void {
  hiddenCountRef = ref;
}

export function initMLWorker(config: YTFilterConfig | null): void {
  if (mlWorker || !config?.mlEnabled) return;
  try {
    chrome.runtime.sendMessage({ type: "ML_INIT" });
    mlWorker = true;
    mlStatus = "loading";
    injectMLStatusBadge();
  } catch (err) {
    console.error("[YT Filter ML] Failed to init:", err);
    mlStatus = "error";
    injectMLStatusBadge();
  }
}

export function terminateMLWorker(): void {
  if (mlWorker) {
    chrome.runtime.sendMessage({ type: "ML_TERMINATE" });
    mlWorker = null;
  }
  mlStatus = "idle";
  mlBatchQueue = [];
  mlPendingElements.clear();
  removeMLStatusBadge();
}

export function isMLWorkerActive(): boolean {
  return mlWorker !== null;
}

export function setupMLMessageListener(): void {
  chrome.runtime.onMessage.addListener((msg: Record<string, unknown>) => {
    if (msg.target !== "content") return undefined;
    console.log(
      "[YTF Content] ML message:",
      msg.type,
      msg.status || "",
      msg.detail || "",
    );
    if (msg.type === "ML_STATUS") {
      mlStatus = msg.status as string;
      mlDetail = (msg.detail || "") as string;
      if (msg.status === "ready") {
        flushMLBatch();
      }
      injectMLStatusBadge();
    } else if (msg.type === "ML_RESULTS") {
      applyMLResults(
        msg.requestId as number,
        msg.results as (MLClassifyResult | null)[],
      );
    }
    return undefined;
  });
}

export function queueForML(el: Element, meta: VideoMetadata): void {
  const cached = mlCache.get(meta.title);
  if (cached !== undefined) {
    if (cached) {
      console.log(
        "[YTF Content] ML cache hit:",
        cached.category,
        "—",
        meta.title.slice(0, 50),
      );
      applyMLHit(el, meta, cached);
    }
    return;
  }

  mlBatchQueue.push({ el, meta });
  if (!mlBatchTimer) {
    mlBatchTimer = setTimeout(flushMLBatch, ML_BATCH_INTERVAL);
  }
}

function flushMLBatch(): void {
  mlBatchTimer = null;
  if (mlStatus !== "ready" || mlBatchQueue.length === 0) {
    if (mlStatus !== "ready")
      console.log("[YTF Content] ML flush skipped: model not ready");
    return;
  }

  const batch = mlBatchQueue.splice(0);
  const titles = batch.map((b) => b.meta.title);
  const reqId = ++mlRequestId;
  mlPendingElements.set(reqId, batch);

  console.log(
    `[YTF Content] ML sending batch ${reqId}: ${titles.length} titles`,
  );
  if (mlWorker) {
    chrome.runtime.sendMessage({
      type: "ML_CLASSIFY",
      titles,
      requestId: reqId,
    });
  }
}

function applyMLResults(
  requestId: number,
  results: (MLClassifyResult | null)[],
): void {
  const batch = mlPendingElements.get(requestId);
  if (!batch) {
    console.log(
      "[YTF Content] ML_RESULTS: no pending batch for requestId",
      requestId,
    );
    return;
  }
  mlPendingElements.delete(requestId);

  let hits = 0;
  let clean = 0;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const { el, meta } = batch[i];
    const title = meta.title;

    if (mlCache.size >= ML_CACHE_MAX) {
      const oldest = mlCache.keys().next().value;
      if (oldest !== undefined) mlCache.delete(oldest);
    }
    mlCache.set(title, result);

    if (result) {
      hits++;
      console.log(
        "[YTF Content] ML HIT:",
        result.category,
        result.confidence + "%",
        "—",
        title.slice(0, 60),
      );
      applyMLHit(el, meta, result);
    } else {
      clean++;
    }
  }
  console.log(
    `[YTF Content] ML batch ${requestId}: ${hits} hits, ${clean} clean, ${results.length} total`,
  );
}

function applyMLHit(
  el: Element,
  meta: VideoMetadata,
  result: MLClassifyResult,
): void {
  if (el.getAttribute(ATTR_HIDDEN) === "true") return;

  const labelStr = Array.isArray(result.labels)
    ? result.labels.join(", ")
    : `${result.category}: ${result.confidence}%`;
  const reason = `ml:${result.category} (${result.confidence}%) [${labelStr}]`;
  el.setAttribute(ATTR_HIDDEN, "true");
  el.setAttribute(ATTR_ML_DONE, "true");
  el.setAttribute(ATTR_REASON, "filtered: " + reason);

  hiddenCountRef.value++;
  try {
    chrome.runtime.sendMessage({
      type: "HIDDEN_COUNT",
      count: hiddenCountRef.value,
    });
  } catch {
    /* ok */
  }

  queueLogEntry(createLogEntry(meta, [reason]));
}

// ── ML status badge ──
const ML_BADGE_ID = "ytf-ml-badge";

function injectMLStatusBadge(): void {
  let badge = document.getElementById(ML_BADGE_ID);
  if (!badge) {
    badge = document.createElement("div");
    badge.id = ML_BADGE_ID;
    badge.style.cssText = `
      position: fixed; bottom: 12px; left: 12px; z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      padding: 10px 16px; border-radius: 10px;
      background: #fff; border: 1px solid #e0e0e0; color: #888;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      pointer-events: none; transition: opacity 0.3s;
      max-width: 420px; line-height: 1.4;
    `;
    badge.innerHTML =
      '<div class="ytf-ml-text"></div><div class="ytf-ml-bar-wrap"><div class="ytf-ml-bar"></div></div>';

    const style = document.createElement("style");
    style.textContent = `
      #${ML_BADGE_ID} .ytf-ml-text { margin-bottom: 4px; }
      #${ML_BADGE_ID} .ytf-ml-bar-wrap {
        height: 3px; background: #eee; border-radius: 2px;
        overflow: hidden; display: none;
      }
      #${ML_BADGE_ID} .ytf-ml-bar {
        height: 100%; background: #f57f17; border-radius: 2px;
        transition: width 0.3s; width: 0%;
      }
      #${ML_BADGE_ID}.ml-ready .ytf-ml-bar { background: #43a047; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(badge);
  }

  const textEl = badge.querySelector(".ytf-ml-text") as HTMLElement;
  const barWrap = badge.querySelector(".ytf-ml-bar-wrap") as HTMLElement;
  const bar = badge.querySelector(".ytf-ml-bar") as HTMLElement;
  badge.className = "";

  if (mlStatus === "loading") {
    textEl.textContent = `Smart detection: ${mlDetail || "loading..."}`;
    badge.style.color = "#f57f17";
    badge.style.borderColor = "#ffe082";
    badge.style.opacity = "1";
    barWrap.style.display = "block";
    const pctMatch = mlDetail.match(/(\d+)%/);
    bar.style.width = pctMatch ? pctMatch[1] + "%" : "30%";
    bar.style.background = "#f57f17";
  } else if (mlStatus === "computing_archetypes") {
    textEl.textContent = `Smart detection: ${mlDetail || "preparing..."}`;
    badge.style.color = "#f57f17";
    badge.style.borderColor = "#ffe082";
    badge.style.opacity = "1";
    barWrap.style.display = "block";
    bar.style.width = "90%";
    bar.style.background = "#f57f17";
  } else if (mlStatus === "ready") {
    textEl.textContent = "Smart detection: ready";
    badge.style.color = "#43a047";
    badge.style.borderColor = "#a5d6a7";
    badge.style.opacity = "1";
    badge.className = "ml-ready";
    barWrap.style.display = "block";
    bar.style.width = "100%";
    bar.style.background = "#43a047";
    setTimeout(() => {
      if (badge) badge.style.opacity = "0";
    }, 4000);
  } else if (mlStatus === "error") {
    textEl.textContent = `Smart detection error${mlDetail ? ": " + mlDetail : ""}`;
    badge.style.color = "#e53935";
    badge.style.borderColor = "#ef9a9a";
    badge.style.opacity = "1";
    barWrap.style.display = "none";
  }
}

function removeMLStatusBadge(): void {
  const badge = document.getElementById(ML_BADGE_ID);
  if (badge) badge.remove();
}
