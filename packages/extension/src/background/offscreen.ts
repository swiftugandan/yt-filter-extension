let offscreenCreating: Promise<void> | null = null;

export async function ensureOffscreen(): Promise<void> {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) return;

  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  offscreenCreating = chrome.offscreen.createDocument({
    url: "ml-offscreen.html",
    reasons: ["WORKERS"],
    justification:
      "ML inference for video title classification using transformers.js",
  });

  await offscreenCreating;
  offscreenCreating = null;
}

export async function closeOffscreen(): Promise<void> {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) {
    await chrome.offscreen.closeDocument();
  }
}
