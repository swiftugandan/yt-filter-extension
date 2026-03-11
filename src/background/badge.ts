import type { YTFilterConfig } from "../types/config";

export function updateBadge(config: YTFilterConfig | null): void {
  if (config?.enabled) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#2e7d32" });
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#757575" });
  }
}
