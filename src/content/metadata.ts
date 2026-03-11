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
    container.querySelector("#video-title") ||
    container.querySelector("yt-formatted-string#video-title") ||
    container.querySelector("[id='video-title']") ||
    container.querySelector("h3 a#video-title-link") ||
    container.querySelector("span#video-title") ||
    container.querySelector("#title-wrapper yt-formatted-string");
  if (titleEl) {
    title = (titleEl.textContent || titleEl.getAttribute("title") || "").trim();
  }
  if (!title) {
    const reelTitle =
      container.querySelector("#headline") ||
      container.querySelector(
        "h3.shortsLockupViewModelHostOutsideMetadataTitle span",
      ) ||
      container.querySelector("h3 span") ||
      container.querySelector(
        "[class*='shortsLockupViewModelHostOutsideMetadata'] span",
      ) ||
      container.querySelector(
        "yt-formatted-string.shortsLockupViewModelHostMetadataTitle",
      );
    if (reelTitle) title = (reelTitle.textContent || "").trim();
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
  const channelEl =
    container.querySelector("ytd-channel-name yt-formatted-string a") ||
    container.querySelector("ytd-channel-name yt-formatted-string") ||
    container.querySelector("#channel-name yt-formatted-string a") ||
    container.querySelector("#channel-name a") ||
    container.querySelector(".ytd-channel-name a");
  if (channelEl) {
    channel = (channelEl.textContent || "").trim();
  }
  if (!channel) {
    const reelChannel =
      container.querySelector(".ytd-reel-item-renderer #channel-name") ||
      container.querySelector(
        "[class*='shortsLockupViewModelHostOutsideMetadata'] .yt-core-attributed-string",
      ) ||
      container.querySelector(
        "span.shortsLockupViewModelHostMetadataSubhead span",
      ) ||
      container.querySelector("#channel-name");
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
  const durationEl =
    container.querySelector(
      "ytd-thumbnail-overlay-time-status-renderer span",
    ) ||
    container.querySelector(
      "span.ytd-thumbnail-overlay-time-status-renderer",
    ) ||
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
    container.querySelector(
      "ytd-badge-supported-renderer .badge-style-type-live-now",
    ) ||
    container.querySelector("[overlay-style='LIVE']") ||
    container.querySelector(".badge-style-type-live-now-alternate");
  const isLive = !!liveBadge || durationText.toUpperCase() === "LIVE";

  const isWatched = !!container.querySelector(
    "ytd-thumbnail-overlay-resume-playback-renderer",
  );

  const isMix =
    tag === "ytd-radio-renderer" ||
    tag === "ytd-compact-radio-renderer" ||
    title.toLowerCase().startsWith("mix -") ||
    !!container.querySelector("[overlay-style='MIX']");

  // ── URL ──
  const linkEl =
    container.querySelector("a#video-title-link") ||
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
  const adBadgeSpan = container.querySelector(
    "span.ytd-badge-supported-renderer:not(:empty)",
  );
  const isAd =
    !!container.querySelector("[class*='badge-style-type-ad']") ||
    !!container.querySelector("ytd-ad-slot-renderer") ||
    !!container.querySelector("[id='ad-badge']") ||
    !!container.querySelector("[class*='ytd-promoted']") ||
    (!!adBadgeSpan &&
      (adBadgeSpan.textContent || "").trim().toLowerCase() === "ad") ||
    !!container.closest("ytd-ad-slot-renderer") ||
    !!container.querySelector("[aria-label='Ad']") ||
    !!container.querySelector("[badge-style='BADGE_STYLE_TYPE_AD']") ||
    url.includes("&ad_") ||
    url.includes("/ad/");

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
