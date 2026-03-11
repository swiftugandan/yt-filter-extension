import type { VideoMetadata } from "../types/video";

export function parseDuration(text: string | null | undefined): number | null {
  if (!text) return null;
  const parts = text.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

export function extractMeta(container: Element): VideoMetadata {
  const tag = container.tagName.toLowerCase();
  const isReelItem = tag === "ytd-reel-item-renderer";

  // ── Title ──
  let title = "";
  const titleEl =
    // New view-model (home, sidebar)
    container.querySelector("h3 a.yt-lockup-metadata-view-model__title") ||
    // Legacy (search results)
    container.querySelector("#video-title") ||
    // Shorts
    container.querySelector(
      "[class*='shortsLockupViewModelHostOutsideMetadata'] span",
    ) ||
    container.querySelector("h3 span");
  if (titleEl) {
    title = (titleEl.textContent || titleEl.getAttribute("title") || "").trim();
  }
  if (!title) {
    const ariaEl =
      container.querySelector("a[aria-label]") ||
      container.querySelector("[aria-label]");
    if (ariaEl) {
      const label = ariaEl.getAttribute("aria-label") || "";
      title =
        label.split(" by ")[0]?.trim() ||
        label.split(" - ")[0]?.trim() ||
        label.trim();
    }
  }

  // ── Channel ──
  let channel = "";
  // New view-model: first yt-core-attributed-string in content metadata
  const contentMeta = container.querySelector("yt-content-metadata-view-model");
  if (contentMeta) {
    const firstMeta = contentMeta.querySelector(
      "span.yt-core-attributed-string",
    );
    if (firstMeta) channel = (firstMeta.textContent || "").trim();
  }
  // Legacy (search results)
  if (!channel) {
    const channelEl =
      container.querySelector("ytd-channel-name yt-formatted-string a") ||
      container.querySelector("ytd-channel-name yt-formatted-string") ||
      container.querySelector("#channel-name a");
    if (channelEl) {
      channel = (channelEl.textContent || "").trim();
    }
  }
  // Shorts
  if (!channel) {
    const reelChannel = container.querySelector(
      "[class*='shortsLockupViewModelHostOutsideMetadata'] .yt-core-attributed-string",
    );
    if (reelChannel) channel = (reelChannel.textContent || "").trim();
  }
  if (!channel) {
    const ariaEl = container.querySelector("a[aria-label]");
    if (ariaEl) {
      const label = ariaEl.getAttribute("aria-label") || "";
      const byMatch = label.match(/\sby\s(.+?)(?:\s-\s|\s\d)/);
      if (byMatch) channel = byMatch[1].trim();
    }
  }

  // ── Duration ──
  // badge-shape works on both new view-model and legacy renderers
  const durationEl =
    container.querySelector("badge-shape .yt-badge-shape__text") ||
    container.querySelector("ytd-thumbnail-overlay-time-status-renderer span");
  const durationText = (durationEl?.textContent || "").trim();
  const duration = parseDuration(durationText);

  // ── Flags ──
  const isShort =
    isReelItem ||
    durationText.toUpperCase() === "SHORTS" ||
    !!container.querySelector("a[href*='/shorts/']") ||
    !!container.querySelector("[class*='shortsLockupViewModel']");

  const liveBadge =
    container.querySelector("[overlay-style='LIVE']") ||
    container.querySelector(
      "ytd-badge-supported-renderer .badge-style-type-live-now",
    );
  const isLive = !!liveBadge || durationText.toUpperCase() === "LIVE";

  const isWatched =
    !!container.querySelector("yt-thumbnail-overlay-progress-bar-view-model") ||
    !!container.querySelector("ytd-thumbnail-overlay-resume-playback-renderer");

  const isMix =
    tag === "ytd-radio-renderer" ||
    tag === "ytd-compact-radio-renderer" ||
    title.toLowerCase().startsWith("mix -") ||
    !!container.querySelector("[overlay-style='MIX']");

  // ── URL ──
  const linkEl =
    container.querySelector("a.yt-lockup-metadata-view-model__title") ||
    container.querySelector("a#thumbnail") ||
    container.querySelector("a[href*='/watch']") ||
    container.querySelector("a[href*='/shorts/']") ||
    container.querySelector("a[href]");
  const url = (linkEl as HTMLAnchorElement)?.href || "";

  // ── Playables ──
  const isPlayable =
    !!container.querySelector("mini-game-card-view-model") ||
    !!container.querySelector("[class*='mini-game-card']") ||
    !!container.querySelector("a[href*='/playables']") ||
    url.includes("/playables");

  // ── Ads ──
  const isAd =
    !!container.querySelector("ytd-ad-slot-renderer") ||
    !!container.querySelector("ytd-in-feed-ad-layout-renderer") ||
    !!container.closest("ytd-ad-slot-renderer");

  return {
    title,
    channel,
    duration,
    durationText,
    isShort,
    isLive,
    isWatched,
    isMix,
    isPlayable,
    isAd,
    url,
  };
}
