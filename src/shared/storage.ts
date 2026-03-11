import type { YTFilterConfig } from "../types/config";
import type { FilterLogEntry } from "../types/video";
import { DEFAULT_CONFIG } from "../types/config";
import {
  STORAGE_CONFIG_KEY,
  STORAGE_LOG_KEY,
  STORAGE_PRESETS_KEY,
} from "./constants";

export async function getConfig(): Promise<YTFilterConfig> {
  const result = await chrome.storage.sync.get(STORAGE_CONFIG_KEY);
  return result[STORAGE_CONFIG_KEY] || DEFAULT_CONFIG;
}

export async function setConfig(config: YTFilterConfig): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_CONFIG_KEY]: config });
}

export async function getLog(): Promise<FilterLogEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_LOG_KEY);
  return result[STORAGE_LOG_KEY] || [];
}

export async function setLog(log: FilterLogEntry[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_LOG_KEY]: log });
}

export interface UserPreset {
  id: string;
  name: string;
  desc: string;
  filters: YTFilterConfig["filters"];
  savedAt?: number;
}

export async function getUserPresets(): Promise<UserPreset[]> {
  const result = await chrome.storage.local.get(STORAGE_PRESETS_KEY);
  return result[STORAGE_PRESETS_KEY] || [];
}

export async function setUserPresets(presets: UserPreset[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_PRESETS_KEY]: presets });
}

const ONBOARDED_KEY = "ytfOnboarded";

export async function getOnboarded(): Promise<boolean> {
  const result = await chrome.storage.local.get(ONBOARDED_KEY);
  return !!result[ONBOARDED_KEY];
}

export async function setOnboarded(): Promise<void> {
  await chrome.storage.local.set({ [ONBOARDED_KEY]: true });
}
