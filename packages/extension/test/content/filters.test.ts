import { describe, it, expect } from "vitest";
import { matchReasons } from "../../src/content/filters";
import type { YTFilterConfig } from "../../src/types/config";
import type { VideoMetadata } from "../../src/types/video";
import { DEFAULT_CONFIG } from "../../src/types/config";

function makeMeta(overrides: Partial<VideoMetadata> = {}): VideoMetadata {
  return {
    title: "Some Normal Video Title",
    channel: "SomeChannel",
    duration: 300,
    durationText: "5:00",
    isShort: false,
    isLive: false,
    isWatched: false,
    isMix: false,
    isPlayable: false,
    isAd: false,
    url: "https://www.youtube.com/watch?v=abc123",
    ...overrides,
  };
}

function makeConfig(overrides: Partial<YTFilterConfig> = {}): YTFilterConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

describe("matchReasons", () => {
  it("returns empty for disabled config", () => {
    const meta = makeMeta();
    const config = makeConfig({ enabled: false });
    expect(matchReasons(meta, config, null)).toEqual([]);
  });

  it("returns empty for null config", () => {
    expect(matchReasons(makeMeta(), null, null)).toEqual([]);
  });

  it("matches title keyword (case-insensitive)", () => {
    const meta = makeMeta({ title: "Check out this #Sponsored video" });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, titleKeywords: ["#sponsored"] },
    });
    const reasons = matchReasons(meta, config, null);
    expect(reasons).toContain('keyword: "#sponsored"');
  });

  it("matches channel name (exact, case-insensitive)", () => {
    const meta = makeMeta({ channel: "BadChannel" });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, channelNames: ["badchannel"] },
    });
    const reasons = matchReasons(meta, config, null);
    expect(reasons).toContain('channel: "badchannel"');
  });

  it("matches title regex", () => {
    const meta = makeMeta({ title: "[AD] Buy this product" });
    const config = makeConfig();
    const regex = new RegExp(config.filters.titleRegex, "i");
    const reasons = matchReasons(meta, config, regex);
    expect(reasons.some((r) => r.startsWith("regex:"))).toBe(true);
  });

  it("detects shorts", () => {
    const meta = makeMeta({ isShort: true });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideShorts: true },
    });
    expect(matchReasons(meta, config, null)).toContain("type: short");
  });

  it("detects live streams", () => {
    const meta = makeMeta({ isLive: true });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideLive: true },
    });
    expect(matchReasons(meta, config, null)).toContain("type: live");
  });

  it("detects watched videos", () => {
    const meta = makeMeta({ isWatched: true });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideWatched: true },
    });
    expect(matchReasons(meta, config, null)).toContain("type: watched");
  });

  it("detects mixes", () => {
    const meta = makeMeta({ isMix: true });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideMixes: true },
    });
    expect(matchReasons(meta, config, null)).toContain("type: mix");
  });

  it("detects playables", () => {
    const meta = makeMeta({ isPlayable: true });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hidePlayables: true },
    });
    expect(matchReasons(meta, config, null)).toContain("type: playable");
  });

  it("detects ads", () => {
    const meta = makeMeta({ isAd: true });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideAds: true },
    });
    expect(matchReasons(meta, config, null)).toContain("type: ad");
  });

  // Clickbait detection
  it("detects ALL CAPS clickbait", () => {
    const meta = makeMeta({ title: "THIS IS ABSOLUTELY INSANE YOU GUYS" });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideClickbait: true },
    });
    expect(matchReasons(meta, config, null)).toContain("clickbait: ALL CAPS");
  });

  it("detects excessive punctuation clickbait", () => {
    const meta = makeMeta({ title: "OMG what just happened???" });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideClickbait: true },
    });
    expect(matchReasons(meta, config, null)).toContain(
      "clickbait: excessive punctuation",
    );
  });

  it("detects clickbait phrases", () => {
    const meta = makeMeta({ title: "You won't believe what happens next" });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideClickbait: true },
    });
    expect(matchReasons(meta, config, null)).toContain("clickbait: phrase");
  });

  // Toxic detection
  it("detects toxic rage bait", () => {
    const meta = makeMeta({ title: "Celebrity gets DESTROYED in debate" });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideToxic: true },
    });
    expect(matchReasons(meta, config, null)).toContain(
      "toxic: rage/outrage bait",
    );
  });

  it("detects toxic drama bait", () => {
    const meta = makeMeta({ title: "Drama alert: the feud continues" });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideToxic: true },
    });
    expect(matchReasons(meta, config, null)).toContain("toxic: drama bait");
  });

  it("detects fear mongering", () => {
    const meta = makeMeta({ title: "This changes everything for the economy" });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideToxic: true },
    });
    expect(matchReasons(meta, config, null)).toContain("toxic: fear mongering");
  });

  it("detects scam content", () => {
    const meta = makeMeta({ title: "I made $5000 in one day with this trick" });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideToxic: true },
    });
    expect(matchReasons(meta, config, null)).toContain("toxic: scam/hustle");
  });

  it("detects false urgency dark pattern", () => {
    const meta = makeMeta({ title: "Watch NOW before this gets deleted" });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideToxic: true },
    });
    expect(matchReasons(meta, config, null)).toContain(
      "dark pattern: false urgency",
    );
  });

  it("detects engagement bait dark pattern", () => {
    const meta = makeMeta({
      title: "Like and subscribe or bad luck for 7 years",
    });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, hideToxic: true },
    });
    expect(matchReasons(meta, config, null)).toContain(
      "dark pattern: engagement bait",
    );
  });

  // Duration
  it("filters videos below min duration", () => {
    const meta = makeMeta({ duration: 30 });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, minDuration: 60 },
    });
    expect(matchReasons(meta, config, null)).toContain("duration < 60s");
  });

  it("filters videos above max duration", () => {
    const meta = makeMeta({ duration: 7200 });
    const config = makeConfig({
      filters: { ...DEFAULT_CONFIG.filters, maxDuration: 3600 },
    });
    expect(matchReasons(meta, config, null)).toContain("duration > 3600s");
  });

  it("does not filter duration when null", () => {
    const meta = makeMeta({ duration: null });
    const config = makeConfig({
      filters: {
        ...DEFAULT_CONFIG.filters,
        minDuration: 60,
        maxDuration: 3600,
      },
    });
    expect(matchReasons(meta, config, null)).toEqual([]);
  });

  it("returns no reasons for clean normal video", () => {
    const meta = makeMeta({ title: "How to bake sourdough bread at home" });
    const config = makeConfig({
      filters: {
        ...DEFAULT_CONFIG.filters,
        titleKeywords: [],
        titleRegex: "",
        hideClickbait: true,
        hideToxic: true,
      },
    });
    expect(matchReasons(meta, config, null)).toEqual([]);
  });
});
