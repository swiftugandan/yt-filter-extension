import type { ClassifyResult } from "@ytf/shared";

const MAX_SIZE = 5000;
const cache = new Map<string, ClassifyResult>();

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function getCached(title: string): ClassifyResult | undefined {
  const key = normalizeTitle(title);
  const result = cache.get(key);
  if (result) {
    // Move to end for LRU behavior
    cache.delete(key);
    cache.set(key, result);
  }
  return result;
}

export function setCached(title: string, result: ClassifyResult): void {
  const key = normalizeTitle(title);
  if (cache.size >= MAX_SIZE) {
    // Evict oldest entry
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, result);
}

export function getCacheStats(): { size: number; maxSize: number } {
  return { size: cache.size, maxSize: MAX_SIZE };
}
