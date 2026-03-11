import type { WorkerInMessage } from "../types/messages";
import { POSITIVE_ARCHETYPES, NEGATIVE_ARCHETYPES } from "./archetypes";
import { openIDB, trimIDBCache } from "./idb-cache";
import { classifyBatch } from "./classifier";
import { initExtractor, embedTexts } from "./pipeline";

declare const self: Worker & typeof globalThis;

let modelReady = false;
let positiveEmbeddings: Record<string, Float32Array[]> | null = null;
let negativeEmbeddings: Float32Array[] | null = null;
let singletonPromise: Promise<void> | null = null;

function getSingleton(): Promise<void> {
  if (!singletonPromise) {
    singletonPromise = initPipeline().catch((err) => {
      singletonPromise = null;
      throw err;
    });
  }
  return singletonPromise;
}

async function initPipeline(): Promise<void> {
  console.log("[YTF Worker] initPipeline() — singleton");

  await initExtractor(() => {});

  console.log("[YTF Worker] Pipeline created, embedding archetypes...");

  self.postMessage({
    type: "ML_STATUS",
    status: "loading",
    detail: "embedding positive archetypes...",
  });
  positiveEmbeddings = {};
  const categories = Object.keys(POSITIVE_ARCHETYPES);
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    self.postMessage({
      type: "ML_STATUS",
      status: "loading",
      detail: `embedding: ${cat} (${i + 1}/${categories.length})`,
    });
    positiveEmbeddings[cat] = await embedTexts(POSITIVE_ARCHETYPES[cat]);
  }

  self.postMessage({
    type: "ML_STATUS",
    status: "loading",
    detail: "embedding negative archetypes...",
  });
  negativeEmbeddings = await embedTexts(NEGATIVE_ARCHETYPES);

  console.log("[YTF Worker] Archetypes embedded. Opening IDB cache...");
  await openIDB();
  trimIDBCache();

  modelReady = true;
  console.log("[YTF Worker] Model ready!");
  self.postMessage({
    type: "ML_STATUS",
    status: "ready",
    detail: "model ready",
  });
}

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  console.log("[YTF Worker] Received:", msg.type);
  switch (msg.type) {
    case "INIT":
      getSingleton();
      break;
    case "CLASSIFY":
      getSingleton().then(async () => {
        if (!modelReady || !positiveEmbeddings || !negativeEmbeddings) {
          self.postMessage({
            type: "ML_RESULTS",
            requestId: msg.requestId,
            results: msg.titles.map(() => null),
          });
          return;
        }
        try {
          const results = await classifyBatch(
            msg.titles,
            msg.requestId,
            positiveEmbeddings,
            negativeEmbeddings,
            embedTexts,
          );
          self.postMessage({
            type: "ML_RESULTS",
            requestId: msg.requestId,
            results,
          });
        } catch (err) {
          console.error("[YTF Worker] classifyBatch error:", err);
          self.postMessage({
            type: "ML_RESULTS",
            requestId: msg.requestId,
            results: msg.titles.map(() => null),
            error: (err as Error).message,
          });
        }
      });
      break;
    case "PING":
      self.postMessage({ type: "PONG", ready: modelReady });
      break;
  }
};
