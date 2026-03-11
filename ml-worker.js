// ml-worker.js — Similarity-based classification for YT Video Filter
//
// Architecture:
//   1. Singleton Pipeline — Xenova/all-MiniLM-L6-v2 (23MB, q8)
//   2. Pre-computed L2-normalized archetype embeddings (positive + negative)
//   3. For each title: embed → dot product against all archetypes → score
//   4. A title is flagged only if: bestPositiveScore - bestNegativeScore > margin
//   5. IndexedDB inference cache (5000 entries, survives restarts)
//   6. Cache API for model blobs (handled by transformers.js)
//
// Adding new categories = adding archetype strings. No retraining.

import { pipeline, env } from "./transformers.min.js";

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = "./";
env.backends.onnx.wasm.numThreads = 1;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const IDB_NAME = "ytf-ml-cache";
const IDB_STORE = "inferences";
const IDB_VERSION = 3;
const IDB_MAX_ENTRIES = 5000;

// Per-category thresholds (empirically calibrated for MiniLM + short titles)
const CATEGORY_THRESHOLDS = {
  clickbait:    0.35,
  toxic:        0.33,
  dark_pattern: 0.32,
  fear:         0.33,
  scam:         0.33,
};
const MARGIN = 0.05; // positive must beat negative by at least this much

// ═══════════════════════════════════════════════════════════════════════════
// ARCHETYPES — Positive (toxic) and Negative (neutral/educational)
// ═══════════════════════════════════════════════════════════════════════════
const POSITIVE_ARCHETYPES = {
  clickbait: [
    "You won't believe what happens next!",
    "7 secrets they don't want you to know",
    "Is this the end for everything?",
    "This one trick will change your life forever",
    "Watch before it gets deleted!",
    "I can't believe this actually worked",
    "Nobody expected this to happen",
    "The results will shock you",
    "What they're hiding from you",
    "You NEED to see this right now",
    "Everyone was wrong about this",
    "This changes everything you thought you knew",
    "I tried this and was completely shocked",
    "The truth finally revealed",
  ],
  toxic: [
    "Haha, you guys are a bunch of losers",
    "Go back to where you came from",
    "I'm going to find you and make you pay",
    "Celebrity completely destroyed in heated argument",
    "Gets absolutely humiliated on live TV",
    "EXPOSED as a fraud and total liar",
    "Savage takedown brutal response gets owned",
    "Public meltdown breakdown caught on camera",
    "Tears apart opponent's credibility",
    "The complete downfall and cancellation",
    "Claps back at haters and trolls",
    "Fires back with devastating comeback",
  ],
  dark_pattern: [
    "Only 2 items left at this price!",
    "Hurry, offer expires in 10 minutes!",
    "Join 50,000 others who already bought this",
    "Watch NOW before this gets taken down",
    "URGENT you need to act immediately",
    "Last chance you'll ever have to see this",
    "They're deleting this video tomorrow",
    "Like and subscribe or bad things will happen",
    "Only 1% of people can solve this",
    "Bet you can't watch without reacting",
    "Share with friends or you'll miss out forever",
    "Time is running out act fast now",
  ],
  fear: [
    "Economic collapse is coming prepare yourself now",
    "We're all doomed and here's the proof",
    "Get out while you still can",
    "The crisis nobody saw coming",
    "Point of no return for humanity",
    "Everything is about to change drastically",
    "Terrifying new threat nobody talks about",
    "Why everyone should be worried right now",
    "The world as we know it is ending",
    "Prepare for the worst case scenario",
  ],
  scam: [
    "Make thousands of dollars per day easy money",
    "Secret passive income method nobody knows",
    "Quit your job get rich quick with this trick",
    "Free money hack that actually works guaranteed",
    "Millionaire reveals secret wealth building method",
    "This one investment will make you rich overnight",
    "I made ten thousand dollars doing nothing",
    "Work from home earn six figures easily",
    "Financial freedom overnight no experience needed",
  ],
};

// Negative archetypes — legitimate educational/informational content
// that might share keywords with toxic content but isn't harmful
const NEGATIVE_ARCHETYPES = [
  "A comprehensive tutorial on web development",
  "How to learn programming step by step",
  "History documentary about ancient civilizations",
  "Scientific explanation of how the universe works",
  "Cooking recipe: how to make pasta from scratch",
  "Product review with honest pros and cons",
  "Educational lecture on economics and markets",
  "News analysis with multiple perspectives",
  "Music performance live concert recording",
  "Travel vlog visiting historical landmarks",
  "The 7 scariest dark patterns in e-commerce explained",
  "What is clickbait and how to recognize it",
  "Understanding toxic behavior in online communities",
  "How scams work and how to protect yourself",
  "Financial literacy basics for beginners",
  "Psychology of fear and how media uses it",
  "Critical thinking skills for evaluating content",
  "Documentary about the history of advertising",
  "Interview with an expert on social media",
  "Book review and discussion of key themes",
  "Workout routine for beginners at home",
  "DIY home improvement project walkthrough",
  "Software engineering best practices explained",
  "Math tutorial solving equations step by step",
];

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════
let singletonPromise = null;
let extractor = null;
let modelReady = false;

// Pre-computed embeddings (populated during init)
let positiveEmbeddings = null; // { category: [Float32Array, ...] }
let negativeEmbeddings = null; // [Float32Array, ...]

// ═══════════════════════════════════════════════════════════════════════════
// 1. SINGLETON PIPELINE
// ═══════════════════════════════════════════════════════════════════════════
function getSingleton() {
  if (!singletonPromise) {
    singletonPromise = initPipeline().catch((err) => {
      singletonPromise = null;
      throw err;
    });
  }
  return singletonPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. INDEXEDDB INFERENCE CACHE
// ═══════════════════════════════════════════════════════════════════════════
let idb = null;

function hashTitle(title) {
  let h = 5381;
  for (let i = 0; i < title.length; i++) {
    h = ((h << 5) + h + title.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

async function openIDB() {
  if (idb) return idb;
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (db.objectStoreNames.contains(IDB_STORE)) db.deleteObjectStore(IDB_STORE);
      const store = db.createObjectStore(IDB_STORE, { keyPath: "hash" });
      store.createIndex("ts", "ts");
    };
    req.onsuccess = () => { idb = req.result; resolve(idb); };
    req.onerror = () => resolve(null);
  });
}

async function getCachedResult(title) {
  const db = await openIDB();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(hashTitle(title));
      req.onsuccess = () => resolve(req.result?.data);
      req.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

async function setCachedResult(title, data) {
  const db = await openIDB();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({ hash: hashTitle(title), data, ts: Date.now() });
  } catch { /* ignore */ }
}

async function trimIDBCache() {
  const db = await openIDB();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > IDB_MAX_ENTRIES) {
        const toDelete = Math.floor(countReq.result * 0.2);
        const cursor = store.index("ts").openCursor();
        let deleted = 0;
        cursor.onsuccess = (e) => {
          const c = e.target.result;
          if (c && deleted < toDelete) { c.delete(); deleted++; c.continue(); }
        };
      }
    };
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DOT PRODUCT (cosine sim for L2-normalized vectors)
// ═══════════════════════════════════════════════════════════════════════════
function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. MODEL LOADING + ARCHETYPE EMBEDDING
// ═══════════════════════════════════════════════════════════════════════════
async function embedTexts(texts) {
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const results = [];
  for (let i = 0; i < texts.length; i++) {
    results.push(new Float32Array(output[i].data));
  }
  return results;
}

async function initPipeline() {
  console.log("[YTF Worker] initPipeline() — singleton");
  self.postMessage({ type: "ML_STATUS", status: "loading", detail: "loading embedding model..." });

  extractor = await pipeline("feature-extraction", MODEL_ID, {
    progress_callback: (p) => {
      const detail = formatProgress(p);
      if (detail) self.postMessage({ type: "ML_STATUS", status: "loading", detail });
    },
  });

  console.log("[YTF Worker] Pipeline created, embedding archetypes...");

  // Embed positive archetypes per category
  self.postMessage({ type: "ML_STATUS", status: "loading", detail: "embedding positive archetypes..." });
  positiveEmbeddings = {};
  const categories = Object.keys(POSITIVE_ARCHETYPES);
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    self.postMessage({
      type: "ML_STATUS", status: "loading",
      detail: `embedding: ${cat} (${i + 1}/${categories.length})`,
    });
    positiveEmbeddings[cat] = await embedTexts(POSITIVE_ARCHETYPES[cat]);
  }

  // Embed negative archetypes
  self.postMessage({ type: "ML_STATUS", status: "loading", detail: "embedding negative archetypes..." });
  negativeEmbeddings = await embedTexts(NEGATIVE_ARCHETYPES);

  console.log("[YTF Worker] Archetypes embedded. Opening IDB cache...");
  await openIDB();
  trimIDBCache();

  modelReady = true;
  console.log("[YTF Worker] Model ready!");
  self.postMessage({ type: "ML_STATUS", status: "ready", detail: "model ready" });
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════
async function classifyBatch(titles, requestId) {
  if (!modelReady || !extractor) {
    self.postMessage({ type: "ML_RESULTS", requestId, results: titles.map(() => null) });
    return;
  }

  try {
    const results = new Array(titles.length);
    const uncachedIndices = [];
    const uncachedTitles = [];

    // L2: Check IDB cache
    for (let i = 0; i < titles.length; i++) {
      const cached = await getCachedResult(titles[i]);
      if (cached !== undefined) {
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
        uncachedTitles.push(titles[i]);
      }
    }

    if (uncachedIndices.length > 0) {
      const cacheHits = titles.length - uncachedTitles.length;
      if (cacheHits > 0) {
        console.log(`[YTF Worker] Batch ${requestId}: ${cacheHits} cached, ${uncachedTitles.length} new`);
      }

      // Embed all uncached titles in one batch
      const titleEmbeddings = await embedTexts(uncachedTitles);

      for (let ui = 0; ui < uncachedTitles.length; ui++) {
        const emb = titleEmbeddings[ui];

        // Find best positive match (category + score)
        let bestPosCat = null;
        let bestPosScore = -1;
        let bestPosPhrase = "";

        for (const cat of Object.keys(positiveEmbeddings)) {
          const archEmbeds = positiveEmbeddings[cat];
          const archPhrases = POSITIVE_ARCHETYPES[cat];
          for (let a = 0; a < archEmbeds.length; a++) {
            const sim = dotProduct(emb, archEmbeds[a]);
            if (sim > bestPosScore) {
              bestPosScore = sim;
              bestPosCat = cat;
              bestPosPhrase = archPhrases[a];
            }
          }
        }

        // Find best negative match
        let bestNegScore = -1;
        for (const negEmb of negativeEmbeddings) {
          const sim = dotProduct(emb, negEmb);
          if (sim > bestNegScore) bestNegScore = sim;
        }

        // Decision: flag only if positive exceeds category threshold AND beats negative by margin
        const threshold = CATEGORY_THRESHOLDS[bestPosCat] || 0.35;
        const gap = bestPosScore - bestNegScore;
        const flagged = bestPosScore >= threshold && gap >= MARGIN;

        // Diagnostic logging (first 2 batches)
        if (requestId <= 2 && ui < 12) {
          const flag = flagged ? "🚩" : "✓ ";
          console.log(
            `[YTF Worker] ${flag} "${uncachedTitles[ui].slice(0, 50)}" ` +
            `pos=${bestPosScore.toFixed(3)}(${bestPosCat}) neg=${bestNegScore.toFixed(3)} gap=${gap.toFixed(3)}`
          );
        }

        let result = null;
        if (flagged) {
          result = {
            category: bestPosCat,
            confidence: Math.round(bestPosScore * 100),
            gap: Math.round(gap * 100),
            matchedArchetype: bestPosPhrase,
          };
        }

        results[uncachedIndices[ui]] = result;
        setCachedResult(uncachedTitles[ui], result);
      }
    }

    self.postMessage({ type: "ML_RESULTS", requestId, results });
  } catch (err) {
    console.error("[YTF Worker] classifyBatch error:", err);
    self.postMessage({
      type: "ML_RESULTS", requestId,
      results: titles.map(() => null),
      error: err.message,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function formatProgress(p) {
  if (!p) return null;
  const file = p.file ? p.file.split("/").pop() : "";
  switch (p.status) {
    case "initiate": return `preparing ${file}`;
    case "download": return `downloading ${file}...`;
    case "progress": {
      const pct = p.progress !== undefined ? Math.round(p.progress) : "?";
      if (p.loaded && p.total) {
        const mb = (n) => (n / 1048576).toFixed(1);
        return `downloading ${file}: ${mb(p.loaded)}/${mb(p.total)} MB (${pct}%)`;
      }
      return `downloading ${file}: ${pct}%`;
    }
    case "done": return `loaded ${file}`;
    case "ready": return "pipeline ready";
    default: return p.status ? `${p.status} ${file}` : null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════
self.onmessage = (e) => {
  const msg = e.data;
  console.log("[YTF Worker] Received:", msg.type);
  switch (msg.type) {
    case "INIT":
      getSingleton();
      break;
    case "CLASSIFY":
      getSingleton().then(() => classifyBatch(msg.titles, msg.requestId));
      break;
    case "PING":
      self.postMessage({ type: "PONG", ready: modelReady });
      break;
  }
};
