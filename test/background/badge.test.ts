import { describe, it, expect } from "vitest";
import { updateBadge } from "../../src/background/badge";
import { DEFAULT_CONFIG } from "../../src/types/config";

describe("updateBadge", () => {
  it("sets ON badge when enabled", () => {
    updateBadge({ ...DEFAULT_CONFIG, enabled: true });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "ON" });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: "#2e7d32",
    });
  });

  it("sets OFF badge when disabled", () => {
    updateBadge({ ...DEFAULT_CONFIG, enabled: false });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "OFF" });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: "#757575",
    });
  });

  it("handles null config", () => {
    updateBadge(null);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "OFF" });
  });
});
