export const ATTR_HIDDEN = "data-ytf-hidden";
export const ATTR_PROCESSED = "data-ytf-processed";
export const ATTR_ML_PENDING = "data-ytf-ml-pending";
export const ATTR_ML_DONE = "data-ytf-ml-done";
export const ATTR_REASON = "data-ytf-reason";

export const DEBOUNCE_MS = 200;
export const LOG_FLUSH_MS = 1000;
export const ML_BATCH_INTERVAL = 500;
export const ML_CACHE_MAX = 2000;
export const MAX_LOG_ENTRIES = 500;
export const SCAN_INTERVAL_MS = 3000;
export const DASHBOARD_POLL_MS = 2000;

export const VIDEO_CONTAINER_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-reel-item-renderer",
  "ytd-rich-grid-media",
  "ytd-playlist-renderer",
  "ytd-radio-renderer",
  "ytd-compact-radio-renderer",
].join(",");

export const STORAGE_CONFIG_KEY = "ytFilterConfig";
export const STORAGE_LOG_KEY = "ytFilterLog";
export const STORAGE_PRESETS_KEY = "ytFilterPresets";
