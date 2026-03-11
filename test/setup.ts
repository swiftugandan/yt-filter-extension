import { vi } from "vitest";

// Mock chrome.storage
const syncStore: Record<string, unknown> = {};
const localStore: Record<string, unknown> = {};

const makeStorageArea = (store: Record<string, unknown>) => ({
  get: vi.fn(async (keys: string | string[]) => {
    if (typeof keys === "string") {
      return { [keys]: store[keys] };
    }
    const result: Record<string, unknown> = {};
    for (const k of keys) {
      result[k] = store[k];
    }
    return result;
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(store, items);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    const arr = typeof keys === "string" ? [keys] : keys;
    for (const k of arr) delete store[k];
  }),
});

const chromeMock = {
  storage: {
    sync: makeStorageArea(syncStore),
    local: makeStorageArea(localStore),
    onChanged: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    openOptionsPage: vi.fn(),
    lastError: undefined as { message?: string } | undefined,
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
  tabs: {
    query: vi.fn(async () => []),
    sendMessage: vi.fn(),
  },
  offscreen: {
    hasDocument: vi.fn(async () => false),
    createDocument: vi.fn(async () => {}),
    closeDocument: vi.fn(async () => {}),
  },
};

Object.defineProperty(globalThis, "chrome", {
  value: chromeMock,
  writable: true,
});

// Export for test access
export { chromeMock, syncStore, localStore };
