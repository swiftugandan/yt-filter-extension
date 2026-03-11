import { describe, it, expect, beforeEach } from "vitest";
import { appendLogEntries } from "../../src/background/log-store";
import { localStore } from "../setup";
import { STORAGE_LOG_KEY } from "../../src/shared/constants";
import type { FilterLogEntry } from "../../src/types/video";

function makeEntry(title: string): FilterLogEntry {
  return {
    ts: Date.now(),
    title,
    channel: "TestChannel",
    duration: "5:00",
    url: "https://youtube.com/watch?v=test",
    reasons: ["test"],
    page: "/",
  };
}

describe("appendLogEntries", () => {
  beforeEach(() => {
    delete localStore[STORAGE_LOG_KEY];
  });

  it("appends entries to empty log", async () => {
    await appendLogEntries([makeEntry("Video 1"), makeEntry("Video 2")]);
    const log = localStore[STORAGE_LOG_KEY] as FilterLogEntry[];
    expect(log).toHaveLength(2);
    expect(log[0].title).toBe("Video 1");
  });

  it("appends to existing log", async () => {
    localStore[STORAGE_LOG_KEY] = [makeEntry("Existing")];
    await appendLogEntries([makeEntry("New")]);
    const log = localStore[STORAGE_LOG_KEY] as FilterLogEntry[];
    expect(log).toHaveLength(2);
    expect(log[1].title).toBe("New");
  });

  it("caps log at 500 entries", async () => {
    const existing: FilterLogEntry[] = [];
    for (let i = 0; i < 499; i++) {
      existing.push(makeEntry(`Entry ${i}`));
    }
    localStore[STORAGE_LOG_KEY] = existing;

    await appendLogEntries([makeEntry("New 1"), makeEntry("New 2")]);
    const log = localStore[STORAGE_LOG_KEY] as FilterLogEntry[];
    expect(log).toHaveLength(500);
    // Oldest entry should be trimmed
    expect(log[0].title).toBe("Entry 1");
    expect(log[log.length - 1].title).toBe("New 2");
  });
});
