import type { MLClassifyResult } from "../types/messages";
import { POSITIVE_ARCHETYPES, CATEGORY_THRESHOLDS, MARGIN } from "./archetypes";
import { getCachedResult, setCachedResult } from "./idb-cache";

export function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export async function classifyBatch(
  titles: string[],
  requestId: number,
  positiveEmbeddings: Record<string, Float32Array[]>,
  negativeEmbeddings: Float32Array[],
  embedTexts: (texts: string[]) => Promise<Float32Array[]>,
): Promise<(MLClassifyResult | null)[]> {
  const results = new Array<MLClassifyResult | null>(titles.length);
  const uncachedIndices: number[] = [];
  const uncachedTitles: string[] = [];

  // Check IDB cache
  for (let i = 0; i < titles.length; i++) {
    const cached = await getCachedResult(titles[i]);
    if (cached !== undefined) {
      results[i] = cached as MLClassifyResult | null;
    } else {
      uncachedIndices.push(i);
      uncachedTitles.push(titles[i]);
    }
  }

  if (uncachedIndices.length > 0) {
    const cacheHits = titles.length - uncachedTitles.length;
    if (cacheHits > 0) {
      console.log(
        `[YTF Worker] Batch ${requestId}: ${cacheHits} cached, ${uncachedTitles.length} new`,
      );
    }

    const titleEmbeddings = await embedTexts(uncachedTitles);

    for (let ui = 0; ui < uncachedTitles.length; ui++) {
      const emb = titleEmbeddings[ui];

      let bestPosCat: string | null = null;
      let bestPosScore = -1;
      let bestPosPhrase = "";

      for (const cat of Object.keys(positiveEmbeddings)) {
        const archEmbeds = positiveEmbeddings[cat];
        const archPhrases = POSITIVE_ARCHETYPES[cat];
        for (let a = 0; a < archEmbeds.length; a++) {
          const sim = dotProduct(emb, archEmbeds[a]);
          if (sim > bestPosScore) {
            bestPosScore = sim;
            bestPosCat = cat;
            bestPosPhrase = archPhrases[a];
          }
        }
      }

      let bestNegScore = -1;
      for (const negEmb of negativeEmbeddings) {
        const sim = dotProduct(emb, negEmb);
        if (sim > bestNegScore) bestNegScore = sim;
      }

      const threshold = CATEGORY_THRESHOLDS[bestPosCat!] || 0.35;
      const gap = bestPosScore - bestNegScore;
      const flagged = bestPosScore >= threshold && gap >= MARGIN;

      if (requestId <= 2 && ui < 12) {
        const flag = flagged ? "🚩" : "✓ ";
        console.log(
          `[YTF Worker] ${flag} "${uncachedTitles[ui].slice(0, 50)}" ` +
            `pos=${bestPosScore.toFixed(3)}(${bestPosCat}) neg=${bestNegScore.toFixed(3)} gap=${gap.toFixed(3)}`,
        );
      }

      let result: MLClassifyResult | null = null;
      if (flagged) {
        result = {
          category: bestPosCat!,
          confidence: Math.round(bestPosScore * 100),
          gap: Math.round(gap * 100),
          matchedArchetype: bestPosPhrase,
        };
      }

      results[uncachedIndices[ui]] = result;
      setCachedResult(uncachedTitles[ui], result);
    }
  }

  return results;
}
