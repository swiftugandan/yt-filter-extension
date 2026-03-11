import type { FilterLogEntry } from "../types/video";
import { MAX_LOG_ENTRIES, STORAGE_LOG_KEY } from "../shared/constants";

export async function appendLogEntries(
  entries: FilterLogEntry[],
): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_LOG_KEY);
  let log: FilterLogEntry[] = result[STORAGE_LOG_KEY] || [];
  log = log.concat(entries);
  if (log.length > MAX_LOG_ENTRIES) {
    log = log.slice(log.length - MAX_LOG_ENTRIES);
  }
  await chrome.storage.local.set({ [STORAGE_LOG_KEY]: log });
}
