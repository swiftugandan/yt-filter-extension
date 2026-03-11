import { getCacheStats } from "../lib/cache";

export const dynamic = "force-dynamic";

export default function Home() {
  const stats = getCacheStats();

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 600,
        margin: "60px auto",
        padding: "0 20px",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
        YTF Classification Server
      </h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        LLM-powered video title classification for the YT Video Filter
        extension.
      </p>
      <div
        style={{
          background: "#f5f5f5",
          border: "1px solid #e0e0e0",
          borderRadius: 8,
          padding: 16,
          fontSize: 13,
        }}
      >
        <div>
          Status: <strong style={{ color: "#43a047" }}>Running</strong>
        </div>
        <div style={{ marginTop: 8 }}>
          Cache: {stats.size} / {stats.maxSize} entries
        </div>
        <div style={{ marginTop: 8 }}>
          Model: {process.env.LLM_MODEL || "llama-3.3-70b-versatile"}
        </div>
        <div style={{ marginTop: 8 }}>
          Provider:{" "}
          {process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1"}
        </div>
      </div>
      <p style={{ color: "#999", fontSize: 12, marginTop: 16 }}>
        POST /api/classify with {`{ "titles": ["..."] }`} to classify titles.
      </p>
    </div>
  );
}
