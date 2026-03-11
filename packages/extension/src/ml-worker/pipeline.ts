// @ts-expect-error — external runtime import preserved by bundler
import { pipeline, env } from "./transformers.min.js";

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = "./";
env.backends.onnx.wasm.numThreads = 1;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let extractor:
  | ((
      texts: string[],
      opts: { pooling: string; normalize: boolean },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) => Promise<any>)
  | null = null;

export async function initExtractor(
  onProgress: (detail: string | null) => void,
): Promise<void> {
  const ctx = self as unknown as { postMessage: (msg: unknown) => void };
  ctx.postMessage({
    type: "ML_STATUS",
    status: "loading",
    detail: "loading embedding model...",
  });

  extractor = await pipeline("feature-extraction", MODEL_ID, {
    progress_callback: (p: Record<string, unknown>) => {
      const detail = formatProgress(p);
      if (detail)
        ctx.postMessage({ type: "ML_STATUS", status: "loading", detail });
      onProgress(detail);
    },
  });
}

export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  if (!extractor) throw new Error("Extractor not initialized");
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const results: Float32Array[] = [];
  for (let i = 0; i < texts.length; i++) {
    results.push(new Float32Array(output[i].data));
  }
  return results;
}

export function formatProgress(p: Record<string, unknown>): string | null {
  if (!p) return null;
  const file = p.file ? String(p.file).split("/").pop() : "";
  switch (p.status) {
    case "initiate":
      return `preparing ${file}`;
    case "download":
      return `downloading ${file}...`;
    case "progress": {
      const pct =
        p.progress !== undefined ? Math.round(p.progress as number) : "?";
      if (p.loaded && p.total) {
        const mb = (n: number) => (n / 1048576).toFixed(1);
        return `downloading ${file}: ${mb(p.loaded as number)}/${mb(p.total as number)} MB (${pct}%)`;
      }
      return `downloading ${file}: ${pct}%`;
    }
    case "done":
      return `loaded ${file}`;
    case "ready":
      return "pipeline ready";
    default:
      return p.status ? `${p.status} ${file}` : null;
  }
}
