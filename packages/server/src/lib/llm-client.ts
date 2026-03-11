import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.LLM_API_KEY;
    const baseURL =
      process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";

    if (!apiKey) {
      throw new Error(
        "LLM_API_KEY environment variable is not set. " +
          "Copy .env.example to .env.local and add your API key.",
      );
    }

    _openai = new OpenAI({ apiKey, baseURL });
  }
  return _openai;
}

export function getModel(): string {
  return process.env.LLM_MODEL || "llama-3.3-70b-versatile";
}
