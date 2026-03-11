import { NextRequest, NextResponse } from "next/server";
import type { ClassifyResult, ClassifyResponse } from "@ytf/shared";
import { getOpenAI, getModel } from "../../../lib/llm-client";
import { SYSTEM_PROMPT } from "../../../lib/prompt";
import { getCached, setCached } from "../../../lib/cache";
import { classifyRequestSchema, llmOutputSchema } from "../../../lib/schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = classifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { titles } = parsed.data;
    const results = new Array<ClassifyResult>(titles.length);
    const uncachedTitles: string[] = [];
    const uncachedIndices: number[] = [];
    let cachedCount = 0;

    // Check cache
    for (let i = 0; i < titles.length; i++) {
      const cached = getCached(titles[i]);
      if (cached) {
        results[i] = cached;
        cachedCount++;
      } else {
        uncachedTitles.push(titles[i]);
        uncachedIndices.push(i);
      }
    }

    // Classify uncached titles via LLM
    if (uncachedTitles.length > 0) {
      const llmResults = await classifyWithLLM(uncachedTitles);
      for (let j = 0; j < uncachedIndices.length; j++) {
        const idx = uncachedIndices[j];
        const result = llmResults[j] || {
          title: uncachedTitles[j],
          flagged: false,
          categories: [],
        };
        results[idx] = result;
        setCached(result.title, result);
      }
    }

    const response: ClassifyResponse = {
      results,
      cached: cachedCount,
      model: getModel(),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[YTF Server] Classification error:", err);
    return NextResponse.json(
      { error: "Classification failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}

async function classifyWithLLM(titles: string[]): Promise<ClassifyResult[]> {
  const userMessage = `Classify these ${titles.length} YouTube video titles:\n${JSON.stringify(titles)}`;

  const completion = await getOpenAI().chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return titles.map((t) => ({ title: t, flagged: false, categories: [] }));
  }

  try {
    const parsed = JSON.parse(raw);
    // LLM might wrap in { "results": [...] } or return array directly
    const arr = Array.isArray(parsed) ? parsed : parsed.results;
    const validated = llmOutputSchema.safeParse(arr);

    if (validated.success) {
      return validated.data;
    }

    console.warn(
      "[YTF Server] LLM output validation failed:",
      validated.error.issues,
    );
    return titles.map((t) => ({ title: t, flagged: false, categories: [] }));
  } catch {
    console.warn("[YTF Server] Failed to parse LLM JSON output");
    return titles.map((t) => ({ title: t, flagged: false, categories: [] }));
  }
}
