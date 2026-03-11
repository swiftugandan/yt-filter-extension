import type { FilterLogEntry } from "../types/video";
import { escapeHtml } from "../shared/escape-html";
import { $ } from "../shared/dom";

export function loadLog(): void {
  chrome.runtime.sendMessage({ type: "GET_LOG" }, (log: FilterLogEntry[]) => {
    if (chrome.runtime.lastError || !log) {
      log = [];
    }
    const body = $("#logBody");
    const count = $("#logCount");
    count.textContent = `${log.length} entries`;

    if (log.length === 0) {
      body.innerHTML =
        '<tr><td colspan="5" class="log-empty">no entries yet — browse youtube to see filter hits</td></tr>';
      return;
    }

    const rows = log
      .slice()
      .reverse()
      .map((e) => {
        const time = new Date(e.ts).toLocaleTimeString();
        const reasons = (e.reasons || [])
          .map((r) => `<span class="reason-tag">${escapeHtml(r)}</span>`)
          .join(" ");
        const titleHtml = e.url
          ? `<a href="${escapeHtml(e.url)}" target="_blank" style="color:var(--text-hi);text-decoration:none" title="${escapeHtml(e.title || "")}">${escapeHtml(e.title?.slice(0, 60) || "—")}</a>`
          : escapeHtml(e.title?.slice(0, 60) || "—");
        return `<tr>
        <td class="time-col">${time}</td>
        <td class="title-col">${titleHtml}</td>
        <td class="channel-col">${escapeHtml(e.channel || "—")}</td>
        <td class="dur-col">${escapeHtml(e.duration || "—")}</td>
        <td class="reason-col">${reasons}</td>
      </tr>`;
      });

    body.innerHTML = rows.join("");
  });
}

export function setupLogPanel(
  toast: (msg: string, isError?: boolean) => void,
): void {
  $("#refreshLogBtn").addEventListener("click", loadLog);
  $("#clearLogBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_LOG" }, () => {
      loadLog();
      toast("log cleared");
    });
  });
}
