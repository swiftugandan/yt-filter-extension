import type { FilterLogEntry } from "../types/video";
import type { VideoMetadata } from "../types/video";
import { LOG_FLUSH_MS } from "../shared/constants";

const logBuffer: FilterLogEntry[] = [];
let logFlushTimer: ReturnType<typeof setTimeout> | null = null;

export function createLogEntry(
  meta: VideoMetadata,
  reasons: string[],
): FilterLogEntry {
  return {
    ts: Date.now(),
    title: meta.title.slice(0, 120),
    channel: meta.channel.slice(0, 60),
    duration: meta.durationText || null,
    url: meta.url.slice(0, 200),
    reasons,
    page: location.pathname,
  };
}

export function queueLogEntry(entry: FilterLogEntry): void {
  logBuffer.push(entry);
  if (!logFlushTimer) {
    logFlushTimer = setTimeout(flushLog, LOG_FLUSH_MS);
  }
}

export function flushLog(): void {
  logFlushTimer = null;
  if (logBuffer.length === 0) return;
  const batch = logBuffer.splice(0);
  try {
    chrome.runtime.sendMessage({ type: "FILTER_LOG_BATCH", entries: batch });
  } catch {
    /* extension context invalidated */
  }
}
