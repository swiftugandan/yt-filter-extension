import { z } from "zod";

export const classifyRequestSchema = z.object({
  titles: z.array(z.string().min(1).max(500)).min(1).max(50),
});

const categoryNameSchema = z.enum([
  "clickbait",
  "toxic",
  "dark_pattern",
  "fear",
  "scam",
  "adult_content",
]);

const categoryMatchSchema = z.object({
  category: categoryNameSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

const classifyResultSchema = z.object({
  title: z.string(),
  flagged: z.boolean(),
  categories: z.array(categoryMatchSchema),
});

export const llmOutputSchema = z.array(classifyResultSchema);

export type ValidatedClassifyResult = z.infer<typeof classifyResultSchema>;
