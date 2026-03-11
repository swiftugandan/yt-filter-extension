import type { FilterRules } from "../types/config";
import type { FilterLogEntry } from "../types/video";
import { DASHBOARD_POLL_MS } from "../shared/constants";
import { escapeHtml } from "../shared/escape-html";
import { $ } from "../shared/dom";
import { loadConfig, getCurrentConfig } from "./config-ui";

let dashInterval: ReturnType<typeof setInterval> | null = null;

export async function refreshDashboard(): Promise<void> {
  const cfg = await loadConfig();

  $("#statAllTime").textContent = (
    cfg.stats?.totalHidden || 0
  ).toLocaleString();
  renderRulesSummary(cfg.filters, cfg.filterMode);

  try {
    const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
    if (tabs.length > 0) {
      const names = tabs.map((t) => {
        try {
          return new URL(t.url!).pathname;
        } catch {
          return "?";
        }
      });
      $("#liveStatus").textContent =
        `connected — ${tabs.length} tab${tabs.length > 1 ? "s" : ""} (${names.join(", ")})`;

      let totalAll = 0,
        hiddenAll = 0,
        responded = 0;
      const done = () => {
        responded++;
        if (responded === tabs.length) {
          $("#statHidden").textContent = String(hiddenAll);
          $("#statTotal").textContent = String(totalAll);
          $("#statVisible").textContent = String(totalAll - hiddenAll);
        }
      };
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id!, { type: "GET_LIVE_STATS" }, (resp) => {
          if (!chrome.runtime.lastError && resp) {
            totalAll += resp.total || 0;
            hiddenAll += resp.hidden || 0;
          }
          done();
        });
      }
    } else {
      $("#liveStatus").textContent = "no youtube tabs open";
      $("#statHidden").textContent = "—";
      $("#statTotal").textContent = "—";
      $("#statVisible").textContent = "—";
    }
  } catch {
    $("#liveStatus").textContent = "unable to query tabs";
  }

  // Recent log entries
  chrome.runtime.sendMessage({ type: "GET_LOG" }, (log: FilterLogEntry[]) => {
    if (chrome.runtime.lastError || !log) return;
    const recent = log.slice(-5).reverse();
    const body = $("#recentHitsBody");
    if (recent.length === 0) {
      body.innerHTML = '<div class="log-empty">no recent activity</div>';
      return;
    }
    body.innerHTML = recent
      .map((e) => {
        const time = new Date(e.ts).toLocaleTimeString();
        const reasons = (e.reasons || [])
          .map((r) => `<span class="reason-tag">${escapeHtml(r)}</span>`)
          .join("");
        return `<div style="padding:4px 0;border-bottom:1px solid #161616;font-size:11px">
        <span style="color:#555;width:70px;display:inline-block">${time}</span>
        <span style="color:#d4d4d4">${escapeHtml(e.title?.slice(0, 60) || "—")}</span>
        <span style="color:#555"> · </span>
        <span style="color:#00bcd4">${escapeHtml(e.channel || "—")}</span>
        <div style="margin-top:2px">${reasons}</div>
      </div>`;
      })
      .join("");
  });
}

function renderRulesSummary(
  f: FilterRules | undefined,
  mode: string | undefined,
): void {
  const list = $("#rulesSummary");
  const rules: string[] = [];

  const modeLabel = mode === "blur" ? "Blur" : "Hide";
  rules.push(
    `<span class="rl">Mode:</span> <span class="rv">${modeLabel}</span>`,
  );
  const backend = getCurrentConfig()?.classifierBackend;
  if (backend && backend !== "off") {
    const label = backend === "local" ? "Local ML" : "Server";
    rules.push(
      `<span class="rl">Smart detection:</span> <span class="rv">${label}</span>`,
    );
  }

  if (f?.titleKeywords?.length) {
    rules.push(
      `<span class="rl">Keywords:</span> <span class="rv">${f.titleKeywords.map(escapeHtml).join(", ")}</span>`,
    );
  }
  if (f?.channelNames?.length) {
    rules.push(
      `<span class="rl">Channels:</span> <span class="rv">${f.channelNames.map(escapeHtml).join(", ")}</span>`,
    );
  }
  if (f?.titleRegex) {
    rules.push(
      `<span class="rl">Pattern:</span> <span class="rv">${escapeHtml(f.titleRegex)}</span>`,
    );
  }
  if (f?.minDuration != null || f?.maxDuration != null) {
    const parts: string[] = [];
    if (f.minDuration != null) parts.push(`at least ${f.minDuration}s`);
    if (f.maxDuration != null) parts.push(`at most ${f.maxDuration}s`);
    rules.push(
      `<span class="rl">Video length:</span> <span class="rv">${parts.join(", ")}</span>`,
    );
  }
  if (f?.hideShorts)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Shorts</span>`,
    );
  if (f?.hideLive)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Live streams</span>`,
    );
  if (f?.hideWatched)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Watched videos</span>`,
    );
  if (f?.hideMixes)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Mixes</span>`,
    );
  if (f?.hidePlayables)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Playables</span>`,
    );
  if (f?.hideAds)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Ads</span>`,
    );
  if (f?.hideClickbait)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Clickbait</span>`,
    );
  if (f?.hideToxic)
    rules.push(
      `<span class="rl">Filtering:</span> <span class="rv">Toxic content</span>`,
    );

  if (rules.length === 0) {
    list.innerHTML = '<div class="no-rules">No active filters</div>';
  } else {
    list.innerHTML = rules.map((r) => `<li>${r}</li>`).join("");
  }
}

export function startDashPoll(): void {
  if (dashInterval) clearInterval(dashInterval);
  dashInterval = setInterval(() => {
    if ($("#panel-dashboard").classList.contains("active")) refreshDashboard();
  }, DASHBOARD_POLL_MS);
}
