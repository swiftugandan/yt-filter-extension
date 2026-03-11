// ml-offscreen.js — Runs inside the offscreen document (extension origin).
// Spawns ml-worker.js as a Web Worker and relays messages to/from the
// background service worker via chrome.runtime messaging.

"use strict";

console.log("[YTF Offscreen] Creating module worker...");
const worker = new Worker("ml-worker.js", { type: "module" });
console.log("[YTF Offscreen] Worker created");

// Relay worker messages → background
worker.onmessage = (e) => {
  console.log("[YTF Offscreen] Worker →", e.data.type, e.data.status || "", e.data.detail || "");
  chrome.runtime.sendMessage({ target: "background", ...e.data });
};

worker.onerror = (err) => {
  console.error("[YTF Offscreen] Worker error:", err.message, err);
  chrome.runtime.sendMessage({
    target: "background",
    type: "ML_STATUS",
    status: "error",
    error: err.message || "Worker error",
  });
};

// Listen for messages from background → relay to worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target === "offscreen") {
    console.log("[YTF Offscreen] Background → Worker:", msg.type);
    worker.postMessage(msg);
  }
});
