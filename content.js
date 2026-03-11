// content.js — YT Video Filter v2 content script
// DOM targeting engine + filter log emission.

"use strict";

(() => {
  const ATTR_HIDDEN = "data-ytf-hidden";
  const ATTR_PROCESSED = "data-ytf-processed";
  const ATTR_ML_PENDING = "data-ytf-ml-pending";
  const ATTR_ML_DONE = "data-ytf-ml-done";
  const DEBOUNCE_MS = 200;
  const LOG_FLUSH_MS = 1000;
  const ML_BATCH_INTERVAL = 500;
  const ML_CACHE_MAX = 2000;

  const VIDEO_CONTAINER_SELECTORS = [
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

  let config = null;
  let hiddenCount = 0;
  let compiledTitleRegex = null;

  // ── Built-in pattern sets for clickbait & toxic content ────────────────
  // Clickbait patterns
  const RE_CLICKBAIT_CAPS = /^[A-Z\s!?.,':]{20,}$/;                              // Mostly ALL CAPS title
  const RE_CLICKBAIT_PUNCT = /[!?]{3,}|\.{4,}/;                                   // Excessive !!! or ???
  const RE_CLICKBAIT_PHRASES = new RegExp([
    "you won'?t believe",
    "what happens next",
    "gone wrong",
    "gone sexual",
    "not clickbait",
    "must watch",
    "will shock you",
    "doctors hate",
    "scientists baffled",
    "one weird trick",
    "before it'?s deleted",
    "they don'?t want you to",
    "is finally over",
    "the truth about",
    "I can'?t believe",
    "you need to see this",
    "watch before",
    "last chance to see",
    "nobody expected",
    "everyone is wrong about",
    "why nobody talks about",
    "changed (my|everything) forever",
  ].join("|"), "i");
  const RE_CLICKBAIT_EMOJI_SPAM = /(\p{Emoji_Presentation}.*){4,}/u;              // 4+ emoji in title

  // Toxic / outrage / drama patterns
  const RE_TOXIC_RAGE = new RegExp([
    "\\bDESTROYED\\b",
    "\\bEXPOSED\\b",
    "\\bHUMILIATED\\b",
    "\\bOBLITERATED\\b",
    "\\bANNIHILATED\\b",
    "\\bOWNED\\b",
    "gets DESTROYED",
    "absolutely DESTROYS",
    "completely OWNED",
    "DEMOLISHED",
    "SLAMMED",
    "WRECKED",
    "DISMANTLED",
    "SHUT DOWN",
    "claps back",
    "fires back",
    "rips into",
    "tears apart",
    "loses it",
    "goes off on",
    "melts? down",
  ].join("|"), "i");

  const RE_TOXIC_DRAMA = new RegExp([
    "\\bdrama\\b.*\\b(alert|update|explained)\\b",
    "\\bfeud\\b",
    "\\bbeef\\b.*\\b(with|between|gets)\\b",
    "is OVER",
    "it'?s over for",
    "cancelled",
    "called out",
    "caught lying",
    "finally admits",
    "breaks silence",
    "apology video",
    "EXPOSED for",
    "the downfall of",
    "career is over",
  ].join("|"), "i");

  const RE_TOXIC_FEAR = new RegExp([
    "\\bcollapses?\\b",
    "this changes everything",
    "it'?s happening",
    "prepare yourself",
    "get out now",
    "while you still can",
    "the end of",
    "we'?re all doomed",
    "point of no return",
    "too late to",
    "crisis is here",
    "why I'?m leaving",
    "is (dying|dead|finished|doomed)",
    "no one is safe",
  ].join("|"), "i");

  const RE_TOXIC_SCAM = new RegExp([
    "\\$\\d+[kK].*\\b(per|a|every)\\s(day|week|month|hour)\\b",
    "make money (fast|now|easy|while you sleep)",
    "passive income.*secret",
    "free money",
    "get rich",
    "quit your (job|9.to.5)",
    "financial freedom.*secret",
    "this one (stock|coin|crypto|investment)",
    "millionaire.*secret",
    "I made \\$\\d+",
    "secret.*(they|nobody|no one)",
  ].join("|"), "i");

  // Dark patterns — false urgency, engagement manipulation
  const RE_DARK_URGENCY = new RegExp([
    "watch NOW before",
    "HURRY",
    "limited time",
    "act fast",
    "before it'?s (too late|gone|deleted|banned|removed)",
    "last chance",
    "ending (soon|today|tonight|tomorrow)",
    "going away forever",
    "won'?t be available",
    "they'?re (deleting|removing|banning) this",
    "emergency",
    "URGENT",
    "time.?sensitive",
    "do this (now|immediately|today|right now)",
  ].join("|"), "i");

  const RE_DARK_ENGAGEMENT = new RegExp([
    "like and subscribe or",
    "comment.*or.*bad luck",
    "share this or",
    "skip.*(and|=).*bad luck",
    "only \\d+% (of|will)",
    "most people (can'?t|won'?t|don'?t|fail)",
    "bet you can'?t",
    "prove me wrong",
    "I dare you",
    "tag (someone|a friend|3 friends)",
  ].join("|"), "i");

  // ── Filter log buffer (batched to reduce message overhead) ─────────────
  let logBuffer = [];
  let logFlushTimer = null;

  function queueLogEntry(entry) {
    logBuffer.push(entry);
    if (!logFlushTimer) {
      logFlushTimer = setTimeout(flushLog, LOG_FLUSH_MS);
    }
  }

  function flushLog() {
    logFlushTimer = null;
    if (logBuffer.length === 0) return;
    const batch = logBuffer.splice(0);
    try {
      chrome.runtime.sendMessage({ type: "FILTER_LOG_BATCH", entries: batch });
    } catch { /* extension context invalidated */ }
  }

  // ── ML Worker integration ──────────────────────────────────────────────
  // Second-pass classification: titles that pass regex get sent to the ML
  // worker for embedding-based similarity classification.

  let mlWorker = null;
  let mlReady = false;
  let mlStatus = "idle"; // idle | loading | ready | error
  let mlRequestId = 0;
  const mlCache = new Map(); // title -> { category, confidence } | null
  const mlPendingElements = new Map(); // requestId -> [{ el, meta }]
  let mlBatchTimer = null;
  let mlBatchQueue = []; // [{ el, meta }]
  let mlDetail = ""; // current progress detail string

  function initMLWorker() {
    if (mlWorker || !config?.mlEnabled) return;
    try {
      // Signal background to create offscreen document + init model
      chrome.runtime.sendMessage({ type: "ML_INIT" });
      mlWorker = true; // sentinel — actual worker lives in offscreen doc
      mlStatus = "loading";
      injectMLStatusBadge();
    } catch (err) {
      console.error("[YT Filter ML] Failed to init:", err);
      mlStatus = "error";
      injectMLStatusBadge();
    }
  }

  function terminateMLWorker() {
    if (mlWorker) {
      chrome.runtime.sendMessage({ type: "ML_TERMINATE" });
      mlWorker = null;
    }
    mlReady = false;
    mlStatus = "idle";
    mlBatchQueue = [];
    mlPendingElements.clear();
    removeMLStatusBadge();
  }

  // Listen for ML messages relayed from background ← offscreen ← worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.target !== "content") return;
    console.log("[YTF Content] ML message:", msg.type, msg.status || "", msg.detail || "");
    if (msg.type === "ML_STATUS") {
      mlStatus = msg.status;
      mlDetail = msg.detail || "";
      if (msg.status === "ready") {
        mlReady = true;
        flushMLBatch();
      }
      injectMLStatusBadge();
    } else if (msg.type === "ML_RESULTS") {
      applyMLResults(msg.requestId, msg.results);
    }
  });

  // Queue an element for ML classification (called from scanContainers)
  function queueForML(el, meta) {
    // Check cache first
    const cached = mlCache.get(meta.title);
    if (cached !== undefined) {
      if (cached) {
        console.log("[YTF Content] ML cache hit:", cached.category, "—", meta.title.slice(0, 50));
        applyMLHit(el, meta, cached);
      }
      return;
    }

    mlBatchQueue.push({ el, meta });
    if (!mlBatchTimer) {
      mlBatchTimer = setTimeout(flushMLBatch, ML_BATCH_INTERVAL);
    }
  }

  function flushMLBatch() {
    mlBatchTimer = null;
    if (!mlReady || mlBatchQueue.length === 0) {
      if (!mlReady) console.log("[YTF Content] ML flush skipped: model not ready");
      return;
    }

    const batch = mlBatchQueue.splice(0);
    const titles = batch.map((b) => b.meta.title);
    const reqId = ++mlRequestId;
    mlPendingElements.set(reqId, batch);

    console.log(`[YTF Content] ML sending batch ${reqId}: ${titles.length} titles`);
    mlWorker && chrome.runtime.sendMessage({
      type: "ML_CLASSIFY",
      titles,
      requestId: reqId,
    });
  }

  function applyMLResults(requestId, results) {
    const batch = mlPendingElements.get(requestId);
    if (!batch) {
      console.log("[YTF Content] ML_RESULTS: no pending batch for requestId", requestId);
      return;
    }
    mlPendingElements.delete(requestId);

    let hits = 0;
    let clean = 0;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const { el, meta } = batch[i];
      const title = meta.title;

      // Update cache (evict oldest if full)
      if (mlCache.size >= ML_CACHE_MAX) {
        const oldest = mlCache.keys().next().value;
        mlCache.delete(oldest);
      }
      mlCache.set(title, result);

      if (result) {
        hits++;
        console.log("[YTF Content] ML HIT:", result.category, result.confidence + "%", "—", title.slice(0, 60));
        applyMLHit(el, meta, result);
      } else {
        clean++;
      }
    }
    console.log(`[YTF Content] ML batch ${requestId}: ${hits} hits, ${clean} clean, ${results.length} total`);
  }

  function applyMLHit(el, meta, result) {
    // Don't override if already hidden by regex
    if (el.getAttribute(ATTR_HIDDEN) === "true") return;

    // result = { category: "toxic", confidence: 98, labels: ["toxic: 98%", "insult: 72%"] }
    const labelStr = Array.isArray(result.labels)
      ? result.labels.join(", ")
      : `${result.category}: ${result.confidence}%`;
    const reason = `ml:${result.category} (${result.confidence}%) [${labelStr}]`;
    el.setAttribute(ATTR_HIDDEN, "true");
    el.setAttribute(ATTR_ML_DONE, "true");
    el.setAttribute("data-ytf-reason", "filtered: " + reason);

    hiddenCount++;
    try {
      chrome.runtime.sendMessage({ type: "HIDDEN_COUNT", count: hiddenCount });
    } catch { /* ok */ }

    queueLogEntry({
      ts: Date.now(),
      title: meta.title.slice(0, 120),
      channel: meta.channel.slice(0, 60),
      duration: meta.durationText || null,
      url: meta.url.slice(0, 200),
      reasons: [reason],
      page: location.pathname,
    });
  }

  // ── ML status badge (small indicator on the page) ──────────────────────
  const ML_BADGE_ID = "ytf-ml-badge";

  function injectMLStatusBadge() {
    let badge = document.getElementById(ML_BADGE_ID);
    if (!badge) {
      badge = document.createElement("div");
      badge.id = ML_BADGE_ID;
      badge.style.cssText = `
        position: fixed; bottom: 12px; left: 12px; z-index: 99999;
        font-family: 'JetBrains Mono', 'Cascadia Code', monospace; font-size: 10px;
        padding: 8px 14px; border-radius: 4px;
        background: #111; border: 1px solid #222; color: #555;
        pointer-events: none; transition: opacity 0.3s;
        max-width: 420px; line-height: 1.4;
      `;
      badge.innerHTML = '<div class="ytf-ml-text"></div><div class="ytf-ml-bar-wrap"><div class="ytf-ml-bar"></div></div>';

      const style = document.createElement("style");
      style.textContent = `
        #${ML_BADGE_ID} .ytf-ml-text { margin-bottom: 4px; }
        #${ML_BADGE_ID} .ytf-ml-bar-wrap {
          height: 3px; background: #1a1a1a; border-radius: 2px;
          overflow: hidden; display: none;
        }
        #${ML_BADGE_ID} .ytf-ml-bar {
          height: 100%; background: #ffab00; border-radius: 2px;
          transition: width 0.3s; width: 0%;
        }
        #${ML_BADGE_ID}.ml-ready .ytf-ml-bar { background: #4caf50; }
      `;
      document.head.appendChild(style);
      document.body.appendChild(badge);
    }

    const textEl = badge.querySelector(".ytf-ml-text");
    const barWrap = badge.querySelector(".ytf-ml-bar-wrap");
    const bar = badge.querySelector(".ytf-ml-bar");
    badge.className = "";

    if (mlStatus === "loading") {
      textEl.textContent = `ytf:ml ${mlDetail || "loading..."}`;
      badge.style.color = "#ffab00";
      badge.style.borderColor = "#332800";
      badge.style.opacity = "1";
      barWrap.style.display = "block";
      // Try to extract percentage from detail
      const pctMatch = mlDetail.match(/(\d+)%/);
      bar.style.width = pctMatch ? pctMatch[1] + "%" : "30%";
      bar.style.background = "#ffab00";
    } else if (mlStatus === "computing_archetypes") {
      textEl.textContent = `ytf:ml ${mlDetail || "computing archetypes..."}`;
      badge.style.color = "#ffab00";
      badge.style.borderColor = "#332800";
      badge.style.opacity = "1";
      barWrap.style.display = "block";
      bar.style.width = "90%";
      bar.style.background = "#ffab00";
    } else if (mlStatus === "ready") {
      textEl.textContent = "ytf:ml ready";
      badge.style.color = "#4caf50";
      badge.style.borderColor = "#1b5e20";
      badge.style.opacity = "1";
      badge.className = "ml-ready";
      barWrap.style.display = "block";
      bar.style.width = "100%";
      bar.style.background = "#4caf50";
      setTimeout(() => { if (badge) badge.style.opacity = "0"; }, 4000);
    } else if (mlStatus === "error") {
      textEl.textContent = `ytf:ml error${mlDetail ? ": " + mlDetail : ""}`;
      badge.style.color = "#ff5252";
      badge.style.borderColor = "#c62828";
      badge.style.opacity = "1";
      barWrap.style.display = "none";
    }
  }

  function removeMLStatusBadge() {
    const badge = document.getElementById(ML_BADGE_ID);
    if (badge) badge.remove();
  }

  // ── Stylesheet injection ───────────────────────────────────────────────
  const STYLE_ID = "ytf-style";

  function injectStyle() {
    updateModeCSS();
  }

  function updateModeCSS() {
    let s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement("style");
      s.id = STYLE_ID;
      document.head.appendChild(s);
    }

    const mode = config?.filterMode || "hide";

    if (mode === "blur") {
      s.textContent = `
        [${ATTR_HIDDEN}="true"] {
          position: relative !important;
          pointer-events: none !important;
        }
        [${ATTR_HIDDEN}="true"] > * {
          filter: blur(12px) saturate(0.2) !important;
          opacity: 0.35 !important;
          transition: filter 0.25s, opacity 0.25s !important;
          user-select: none !important;
        }
        [${ATTR_HIDDEN}="true"]::after {
          content: attr(data-ytf-reason);
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'JetBrains Mono', 'Cascadia Code', 'SF Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          color: #ff5252;
          background: rgba(10, 10, 10, 0.55);
          border: 1px solid rgba(198, 40, 40, 0.2);
          border-radius: 8px;
          letter-spacing: 0.5px;
          pointer-events: auto;
          cursor: pointer;
          z-index: 10;
          text-align: center;
          padding: 8px;
        }
        [${ATTR_HIDDEN}="true"]:hover > * {
          filter: blur(3px) saturate(0.5) !important;
          opacity: 0.6 !important;
        }
        [${ATTR_HIDDEN}="true"]:hover::after {
          background: rgba(10, 10, 10, 0.3);
        }
      `;
    } else {
      s.textContent = `[${ATTR_HIDDEN}="true"] { display: none !important; }`;
    }
  }

  // Playables are also rendered as entire shelf sections and sidebar nav entries
  // that sit outside our per-card scanner. We inject/remove a dedicated rule.
  function updatePlayablesCSS() {
    const id = "ytf-playables-style";
    const existing = document.getElementById(id);
    if (config?.filters?.hidePlayables) {
      if (!existing) {
        const s = document.createElement("style");
        s.id = id;
        s.textContent = [
          'ytd-rich-shelf-renderer:has(a[href*="/playables"])',
          'ytd-rich-section-renderer:has(a[href*="/playables"])',
          'ytd-shelf-renderer:has(a[href*="/playables"])',
          'ytd-guide-entry-renderer:has(a[href="/playables"])',
          'ytd-guide-entry-renderer:has(a[href*="/playables"])',
          'ytd-mini-guide-entry-renderer:has(a[href*="/playables"])',
        ].join(",") + " { display: none !important; }";
        document.head.appendChild(s);
      }
    } else if (existing) {
      existing.remove();
    }
  }

  // Ad slot renderers sit outside our per-card scanner too.
  function updateAdsCSS() {
    const id = "ytf-ads-style";
    const existing = document.getElementById(id);
    if (config?.filters?.hideAds) {
      if (!existing) {
        const s = document.createElement("style");
        s.id = id;
        s.textContent = [
          // Feed ad containers
          'ytd-ad-slot-renderer',
          'ytd-in-feed-ad-layout-renderer',
          'ytd-display-ad-renderer',
          'ytd-promoted-sparkles-web-renderer',
          'ytd-promoted-video-renderer',
          'ytd-compact-promoted-video-renderer',
          'ytd-banner-promo-renderer',
          'ytd-statement-banner-renderer',
          'ytd-search-pyv-renderer',
          'ytd-masthead-ad-advertiser-info-renderer',
          // Rich items wrapping ad slots
          'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)',
          // Layout-based ad markers
          '[layout*="display-ad-"]',
          // Masthead / player / merch
          '#masthead-ad',
          '#player-ads',
          '#merch-shelf',
          '[target-id="engagement-panel-ads"]',
          // Video player ad overlays (not pre-roll)
          '.ytp-ad-overlay-container',
          '.ytp-ad-progress-list',
          // Sidebar/companion ads
          '#companion',
          '#action-companion-ads',
        ].join(",") + " { display: none !important; }";
        document.head.appendChild(s);
      }
    } else if (existing) {
      existing.remove();
    }
  }

  // ── Config loading ─────────────────────────────────────────────────────
  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get("ytFilterConfig");
      config = result.ytFilterConfig;
      if (!config) return;
      compileRegex();
    } catch (err) {
      console.error("[YT Filter] Config load failed:", err);
    }
  }

  // ── Page-level blocking overlay ────────────────────────────────────────
  // When the user navigates to a /shorts/ or /playables page and those
  // content types are filtered, we show a full-page overlay explaining why.
  const OVERLAY_ID = "ytf-page-block-overlay";

  function checkPageBlock() {
    if (!config?.enabled) { removeOverlay(); return; }

    const path = location.pathname;
    let blocked = false;
    let reason = "";

    if (config.filters?.hideShorts && path.startsWith("/shorts")) {
      blocked = true;
      reason = "shorts";
    } else if (config.filters?.hidePlayables && path.startsWith("/playables")) {
      blocked = true;
      reason = "playables";
    }

    if (blocked) {
      showOverlay(reason);
    } else {
      removeOverlay();
    }
  }

  function showOverlay(reason) {
    if (document.getElementById(OVERLAY_ID)) return;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <style>
        #${OVERLAY_ID} {
          position: fixed;
          inset: 0;
          z-index: 999999;
          background: #0a0a0a;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'JetBrains Mono', 'Cascadia Code', 'SF Mono', monospace;
          color: #b0b0b0;
          text-align: center;
        }
        #${OVERLAY_ID} .ytf-ob-icon {
          font-size: 48px;
          margin-bottom: 20px;
          opacity: 0.6;
        }
        #${OVERLAY_ID} .ytf-ob-title {
          font-size: 18px;
          font-weight: 600;
          color: #d4d4d4;
          margin-bottom: 8px;
          letter-spacing: -0.3px;
        }
        #${OVERLAY_ID} .ytf-ob-reason {
          font-size: 12px;
          color: #555;
          margin-bottom: 28px;
          line-height: 1.5;
        }
        #${OVERLAY_ID} .ytf-ob-reason code {
          display: inline-block;
          padding: 2px 8px;
          background: #1a1212;
          border: 1px solid #301515;
          border-radius: 3px;
          color: #ff5252;
          font-family: inherit;
          font-size: 11px;
        }
        #${OVERLAY_ID} .ytf-ob-actions {
          display: flex;
          gap: 10px;
        }
        #${OVERLAY_ID} .ytf-ob-btn {
          font-family: inherit;
          font-size: 12px;
          font-weight: 500;
          padding: 8px 20px;
          border-radius: 4px;
          border: 1px solid #222;
          background: #111;
          color: #b0b0b0;
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
          letter-spacing: 0.3px;
        }
        #${OVERLAY_ID} .ytf-ob-btn:hover {
          background: #181818;
          border-color: #333;
          color: #d4d4d4;
        }
        #${OVERLAY_ID} .ytf-ob-btn-primary {
          border-color: #1b5e20;
          color: #4caf50;
        }
        #${OVERLAY_ID} .ytf-ob-btn-primary:hover {
          background: #1b5e20;
          color: #fff;
        }
      </style>
      <div class="ytf-ob-icon">▶</div>
      <div class="ytf-ob-title">page blocked by yt video filter</div>
      <div class="ytf-ob-reason">
        your filter rule <code>hide ${reason}</code> is active<br>
        this ${reason === "shorts" ? "short" : "playable"} has been blocked
      </div>
      <div class="ytf-ob-actions">
        <a class="ytf-ob-btn ytf-ob-btn-primary" href="/" id="ytf-ob-home">go home</a>
        <button class="ytf-ob-btn" id="ytf-ob-back">go back</button>
        <button class="ytf-ob-btn" id="ytf-ob-dismiss">dismiss once</button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("ytf-ob-back").addEventListener("click", () => {
      if (history.length > 1) {
        history.back();
      } else {
        location.href = "/";
      }
    });

    document.getElementById("ytf-ob-dismiss").addEventListener("click", () => {
      removeOverlay();
    });
  }

  function removeOverlay() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
  }

  function compileRegex() {
    compiledTitleRegex = null;
    if (config?.filters?.titleRegex) {
      try {
        compiledTitleRegex = new RegExp(config.filters.titleRegex, "i");
      } catch {
        console.warn("[YT Filter] Bad regex:", config.filters.titleRegex);
      }
    }
  }

  // ── Duration parsing ───────────────────────────────────────────────────
  function parseDuration(text) {
    if (!text) return null;
    const parts = text.trim().split(":").map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return null;
  }

  // ── Metadata extraction ────────────────────────────────────────────────
  // YouTube uses different DOM structures for regular videos vs. Shorts
  // vs. newer "lockup" components. We try multiple strategies.

  function extractMeta(container) {
    const tag = container.tagName.toLowerCase();
    const isReelItem = tag === "ytd-reel-item-renderer";

    // ── Title ──
    let title = "";
    // Strategy 1: standard video title elements
    const titleEl =
      container.querySelector("#video-title") ||
      container.querySelector("yt-formatted-string#video-title") ||
      container.querySelector("[id='video-title']") ||
      container.querySelector("h3 a#video-title-link") ||
      container.querySelector("span#video-title") ||
      container.querySelector("#title-wrapper yt-formatted-string");
    if (titleEl) {
      title = (titleEl.textContent || titleEl.getAttribute("title") || "").trim();
    }
    // Strategy 2: Shorts reel items — #headline or h3 inside overlay-metadata
    if (!title) {
      const reelTitle =
        container.querySelector("#headline") ||
        container.querySelector("h3.shortsLockupViewModelHostOutsideMetadataTitle span") ||
        container.querySelector("h3 span") ||
        container.querySelector("[class*='shortsLockupViewModelHostOutsideMetadata'] span") ||
        container.querySelector("yt-formatted-string.shortsLockupViewModelHostMetadataTitle");
      if (reelTitle) title = (reelTitle.textContent || "").trim();
    }
    // Strategy 3: aria-label on any link (often contains title + channel + views)
    if (!title) {
      const ariaEl =
        container.querySelector("a[aria-label]") ||
        container.querySelector("[aria-label]");
      if (ariaEl) {
        const label = ariaEl.getAttribute("aria-label") || "";
        // aria-label is often "Title by Channel - views - duration" or just the title
        title = label.split(" by ")[0]?.trim() || label.split(" - ")[0]?.trim() || label.trim();
      }
    }

    // ── Channel ──
    let channel = "";
    const channelEl =
      container.querySelector("ytd-channel-name yt-formatted-string a") ||
      container.querySelector("ytd-channel-name yt-formatted-string") ||
      container.querySelector("#channel-name yt-formatted-string a") ||
      container.querySelector("#channel-name a") ||
      container.querySelector(".ytd-channel-name a");
    if (channelEl) {
      channel = (channelEl.textContent || "").trim();
    }
    // Shorts reel items: channel is in #channel-name or a separate text span
    if (!channel) {
      const reelChannel =
        container.querySelector(".ytd-reel-item-renderer #channel-name") ||
        container.querySelector("[class*='shortsLockupViewModelHostOutsideMetadata'] .yt-core-attributed-string") ||
        container.querySelector("span.shortsLockupViewModelHostMetadataSubhead span") ||
        container.querySelector("#channel-name");
      if (reelChannel) channel = (reelChannel.textContent || "").trim();
    }
    // Fallback: parse from aria-label "Title by ChannelName - ..."
    if (!channel) {
      const ariaEl = container.querySelector("a[aria-label]");
      if (ariaEl) {
        const label = ariaEl.getAttribute("aria-label") || "";
        const byMatch = label.match(/\sby\s(.+?)(?:\s-\s|\s\d)/);
        if (byMatch) channel = byMatch[1].trim();
      }
    }

    // ── Duration ──
    const durationEl =
      container.querySelector("ytd-thumbnail-overlay-time-status-renderer span") ||
      container.querySelector("span.ytd-thumbnail-overlay-time-status-renderer") ||
      container.querySelector("#overlays span");
    const durationText = (durationEl?.textContent || "").trim();
    const duration = parseDuration(durationText);

    // ── Flags ──
    const isShort =
      isReelItem ||
      durationText.toUpperCase() === "SHORTS" ||
      !!container.querySelector("a[href*='/shorts/']") ||
      !!container.querySelector("[is-short]") ||
      !!container.querySelector("ytd-reel-item-renderer") ||
      !!container.querySelector("[class*='shortsLockupViewModel']");

    const liveBadge =
      container.querySelector("ytd-badge-supported-renderer .badge-style-type-live-now") ||
      container.querySelector("[overlay-style='LIVE']") ||
      container.querySelector(".badge-style-type-live-now-alternate");
    const isLive = !!liveBadge || durationText.toUpperCase() === "LIVE";

    const isWatched = !!container.querySelector("ytd-thumbnail-overlay-resume-playback-renderer");

    const isMix =
      tag === "ytd-radio-renderer" ||
      tag === "ytd-compact-radio-renderer" ||
      title.toLowerCase().startsWith("mix -") ||
      !!container.querySelector("[overlay-style='MIX']");

    // ── URL (must be before isPlayable which depends on it) ──
    const linkEl =
      container.querySelector("a#video-title-link") ||
      container.querySelector("a#thumbnail") ||
      container.querySelector("a[href*='/watch']") ||
      container.querySelector("a[href*='/shorts/']") ||
      container.querySelector("a[href]");
    const url = linkEl?.href || "";

    // ── Playables (YouTube mini-games) ──
    const isPlayable =
      !!container.querySelector("mini-game-card-view-model") ||
      !!container.querySelector("[class*='mini-game-card']") ||
      !!container.querySelector("a[href*='/playables']") ||
      url.includes("/playables");

    // ── Ads / Promoted content ──
    const isAd =
      !!container.querySelector("[class*='badge-style-type-ad']") ||
      !!container.querySelector("ytd-ad-slot-renderer") ||
      !!container.querySelector("[id='ad-badge']") ||
      !!container.querySelector("[class*='ytd-promoted']") ||
      !!container.querySelector("span.ytd-badge-supported-renderer:not(:empty)") &&
        (container.querySelector("span.ytd-badge-supported-renderer")?.textContent || "").trim().toLowerCase() === "ad" ||
      !!container.closest("ytd-ad-slot-renderer") ||
      !!container.querySelector("[aria-label='Ad']") ||
      !!container.querySelector("[badge-style='BADGE_STYLE_TYPE_AD']") ||
      url.includes("&ad_") ||
      url.includes("/ad/");

    return { title, channel, duration, durationText, isShort, isLive, isWatched, isMix, isPlayable, isAd, url };
  }

  // ── Filter matching (returns array of reason strings) ──────────────────
  function matchReasons(meta) {
    if (!config?.enabled || !config.filters) return [];
    const f = config.filters;
    const reasons = [];

    if (f.titleKeywords?.length > 0) {
      const lower = meta.title.toLowerCase();
      const matched = f.titleKeywords.filter((kw) => lower.includes(kw.toLowerCase()));
      if (matched.length > 0) reasons.push(`keyword: "${matched[0]}"`);
    }

    if (f.channelNames?.length > 0) {
      const lowerCh = meta.channel.toLowerCase();
      const matched = f.channelNames.find((ch) => ch.toLowerCase() === lowerCh);
      if (matched) reasons.push(`channel: "${matched}"`);
    }

    if (compiledTitleRegex && compiledTitleRegex.test(meta.title)) {
      reasons.push(`regex: /${config.filters.titleRegex}/`);
    }

    if (f.hideShorts && meta.isShort) reasons.push("type: short");
    if (f.hideLive && meta.isLive) reasons.push("type: live");
    if (f.hideWatched && meta.isWatched) reasons.push("type: watched");
    if (f.hideMixes && meta.isMix) reasons.push("type: mix");
    if (f.hidePlayables && meta.isPlayable) reasons.push("type: playable");
    if (f.hideAds && meta.isAd) reasons.push("type: ad");

    // ── Built-in: clickbait detection ──
    if (f.hideClickbait) {
      const t = meta.title;
      if (RE_CLICKBAIT_CAPS.test(t)) reasons.push("clickbait: ALL CAPS");
      else if (RE_CLICKBAIT_PUNCT.test(t)) reasons.push("clickbait: excessive punctuation");
      else if (RE_CLICKBAIT_PHRASES.test(t)) reasons.push("clickbait: phrase");
      else if (RE_CLICKBAIT_EMOJI_SPAM.test(t)) reasons.push("clickbait: emoji spam");
    }

    // ── Built-in: toxic / dark pattern detection ──
    if (f.hideToxic) {
      const t = meta.title;
      if (RE_TOXIC_RAGE.test(t)) reasons.push("toxic: rage/outrage bait");
      else if (RE_TOXIC_DRAMA.test(t)) reasons.push("toxic: drama bait");
      else if (RE_TOXIC_FEAR.test(t)) reasons.push("toxic: fear mongering");
      else if (RE_TOXIC_SCAM.test(t)) reasons.push("toxic: scam/hustle");
      else if (RE_DARK_URGENCY.test(t)) reasons.push("dark pattern: false urgency");
      else if (RE_DARK_ENGAGEMENT.test(t)) reasons.push("dark pattern: engagement bait");
    }

    if (meta.duration !== null) {
      if (f.minDuration !== null && meta.duration < f.minDuration)
        reasons.push(`duration < ${f.minDuration}s`);
      if (f.maxDuration !== null && meta.duration > f.maxDuration)
        reasons.push(`duration > ${f.maxDuration}s`);
    }

    return reasons;
  }

  // ── DOM scanning ───────────────────────────────────────────────────────
  function scanContainers() {
    if (!config?.enabled) return;

    const containers = document.querySelectorAll(VIDEO_CONTAINER_SELECTORS);
    let newlyHidden = 0;

    for (const el of containers) {
      if (el.getAttribute(ATTR_PROCESSED) === _configHash) continue;

      const meta = extractMeta(el);
      const reasons = matchReasons(meta);
      const hide = reasons.length > 0;

      el.setAttribute(ATTR_HIDDEN, hide ? "true" : "false");
      el.setAttribute(ATTR_PROCESSED, _configHash);

      // Set reason text for blur overlay display
      if (hide) {
        el.setAttribute("data-ytf-reason", "filtered: " + reasons.join(", "));
      } else {
        el.removeAttribute("data-ytf-reason");
      }

      if (hide) {
        newlyHidden++;
        queueLogEntry({
          ts: Date.now(),
          title: meta.title.slice(0, 120),
          channel: meta.channel.slice(0, 60),
          duration: meta.durationText || null,
          url: meta.url.slice(0, 200),
          reasons: reasons,
          page: location.pathname,
        });
      } else if (config?.mlEnabled && mlWorker && meta.title &&
                 !el.getAttribute(ATTR_ML_DONE)) {
        // Second pass: queue for ML classification
        el.setAttribute(ATTR_ML_PENDING, "true");
        queueForML(el, meta);
      }
    }

    if (newlyHidden > 0) {
      hiddenCount += newlyHidden;
      try {
        chrome.runtime.sendMessage({ type: "HIDDEN_COUNT", count: hiddenCount });
      } catch { /* ok */ }
    }
  }

  let _configHash = "";
  function recomputeHash() {
    _configHash = (config?.filterMode || "hide") + ":" + JSON.stringify(config?.filters || {}).slice(0, 64);
  }

  // ── Debounced scanner ──────────────────────────────────────────────────
  let scanTimer = null;
  function debouncedScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => scanContainers(), DEBOUNCE_MS);
  }

  // ── MutationObserver ───────────────────────────────────────────────────
  let observer = null;
  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length > 0) { debouncedScan(); return; }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── SPA navigation ─────────────────────────────────────────────────────
  function onNavigate() {
    hiddenCount = 0;
    document.querySelectorAll(`[${ATTR_PROCESSED}]`).forEach((el) => {
      el.removeAttribute(ATTR_PROCESSED);
    });
    checkPageBlock();
    debouncedScan();
  }

  // ── Config change listener ─────────────────────────────────────────────
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.ytFilterConfig) {
      config = changes.ytFilterConfig.newValue;
      compileRegex();
      recomputeHash();
      updateModeCSS();
      updatePlayablesCSS();
      updateAdsCSS();
      checkPageBlock();
      // ML worker lifecycle
      if (config?.mlEnabled && !mlWorker) {
        initMLWorker();
      } else if (!config?.mlEnabled && mlWorker) {
        terminateMLWorker();
      }
      document.querySelectorAll(`[${ATTR_PROCESSED}]`).forEach((el) => {
        el.removeAttribute(ATTR_PROCESSED);
        el.removeAttribute(ATTR_ML_DONE);
        el.removeAttribute(ATTR_ML_PENDING);
      });
      hiddenCount = 0;
      scanContainers();
    }
  });

  // ── Message handler for dashboard queries ──────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_LIVE_STATS") {
      const total = document.querySelectorAll(VIDEO_CONTAINER_SELECTORS).length;
      const hidden = document.querySelectorAll(`[${ATTR_HIDDEN}="true"]`).length;
      sendResponse({ total, hidden, page: location.href });
      return true;
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────
  async function init() {
    injectStyle();
    await loadConfig();
    updateModeCSS();
    recomputeHash();
    updatePlayablesCSS();
    updateAdsCSS();
    checkPageBlock();
    scanContainers();
    startObserver();
    if (config?.mlEnabled) initMLWorker();
    window.addEventListener("yt-navigate-finish", onNavigate);
    setInterval(() => { if (config?.enabled) scanContainers(); }, 3000);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
