import type { MLClassifyResult } from "../types/messages";
import type { ClassifyResponse } from "@ytf/shared";

const SERVER_TIMEOUT_MS = 15000;

export async function classifyViaServer(
  titles: string[],
  serverUrl: string,
): Promise<(MLClassifyResult | null)[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

  try {
    const res = await fetch(`${serverUrl}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}: ${res.statusText}`);
    }

    const data: ClassifyResponse = await res.json();
    return mapServerResults(titles, data);
  } finally {
    clearTimeout(timer);
  }
}

function mapServerResults(
  titles: string[],
  data: ClassifyResponse,
): (MLClassifyResult | null)[] {
  return titles.map((title) => {
    const match = data.results.find((r) => r.title === title);
    if (!match || !match.flagged || match.categories.length === 0) {
      return null;
    }
    const top = match.categories[0];
    return {
      category: top.category,
      confidence: Math.round(top.confidence * 100),
      labels: match.categories.map(
        (c) => `${c.category}: ${Math.round(c.confidence * 100)}%`,
      ),
    };
  });
}

export async function checkServerHealth(
  serverUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${serverUrl}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles: ["health check"] }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `Server returned ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
