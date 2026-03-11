import { describe, it, expect } from "vitest";
import { parseDuration, extractMeta } from "../../src/content/metadata";

describe("parseDuration", () => {
  it("parses HH:MM:SS", () => {
    expect(parseDuration("1:30:00")).toBe(5400);
  });

  it("parses MM:SS", () => {
    expect(parseDuration("5:00")).toBe(300);
  });

  it("parses SS", () => {
    expect(parseDuration("45")).toBe(45);
  });

  it("returns null for empty", () => {
    expect(parseDuration("")).toBe(null);
    expect(parseDuration(null)).toBe(null);
    expect(parseDuration(undefined)).toBe(null);
  });

  it("returns null for invalid", () => {
    expect(parseDuration("abc")).toBe(null);
    expect(parseDuration("1:ab")).toBe(null);
  });

  it("handles zero", () => {
    expect(parseDuration("0:00")).toBe(0);
  });

  it("handles whitespace", () => {
    expect(parseDuration("  3:45  ")).toBe(225);
  });
});

describe("extractMeta", () => {
  it("extracts title from #video-title", () => {
    document.body.innerHTML = `
      <ytd-video-renderer>
        <a id="video-title" title="Test Video">Test Video</a>
        <a id="thumbnail" href="https://www.youtube.com/watch?v=abc123"></a>
      </ytd-video-renderer>
    `;
    const container = document.querySelector("ytd-video-renderer")!;
    const meta = extractMeta(container);
    expect(meta.title).toBe("Test Video");
  });

  it("extracts channel name", () => {
    document.body.innerHTML = `
      <ytd-video-renderer>
        <a id="video-title">Some Video</a>
        <ytd-channel-name><yt-formatted-string><a>MyChannel</a></yt-formatted-string></ytd-channel-name>
        <a id="thumbnail" href="https://www.youtube.com/watch?v=abc"></a>
      </ytd-video-renderer>
    `;
    const container = document.querySelector("ytd-video-renderer")!;
    const meta = extractMeta(container);
    expect(meta.channel).toBe("MyChannel");
  });

  it("extracts URL from link", () => {
    document.body.innerHTML = `
      <ytd-video-renderer>
        <a id="video-title">Video</a>
        <a id="thumbnail" href="https://www.youtube.com/watch?v=xyz"></a>
      </ytd-video-renderer>
    `;
    const container = document.querySelector("ytd-video-renderer")!;
    const meta = extractMeta(container);
    expect(meta.url).toContain("xyz");
  });

  it("detects shorts via href", () => {
    document.body.innerHTML = `
      <ytd-video-renderer>
        <a id="video-title">Short Video</a>
        <a href="/shorts/abc123">link</a>
      </ytd-video-renderer>
    `;
    const container = document.querySelector("ytd-video-renderer")!;
    const meta = extractMeta(container);
    expect(meta.isShort).toBe(true);
  });

  it("detects reel items as shorts", () => {
    document.body.innerHTML = `
      <ytd-reel-item-renderer>
        <span id="video-title">A Reel</span>
      </ytd-reel-item-renderer>
    `;
    const container = document.querySelector("ytd-reel-item-renderer")!;
    const meta = extractMeta(container);
    expect(meta.isShort).toBe(true);
  });

  it("detects mix renderers", () => {
    document.body.innerHTML = `
      <ytd-radio-renderer>
        <a id="video-title">Mix - Best Hits</a>
      </ytd-radio-renderer>
    `;
    const container = document.querySelector("ytd-radio-renderer")!;
    const meta = extractMeta(container);
    expect(meta.isMix).toBe(true);
  });

  it("returns empty strings for missing elements", () => {
    document.body.innerHTML = `<ytd-video-renderer></ytd-video-renderer>`;
    const container = document.querySelector("ytd-video-renderer")!;
    const meta = extractMeta(container);
    expect(meta.title).toBe("");
    expect(meta.channel).toBe("");
    expect(meta.url).toBe("");
  });
});
