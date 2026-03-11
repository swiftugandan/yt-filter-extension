export type CategoryName =
  | "clickbait"
  | "toxic"
  | "dark_pattern"
  | "fear"
  | "scam";

export interface ClassifyRequest {
  titles: string[];
}

export interface CategoryMatch {
  category: CategoryName;
  confidence: number;
  reason: string;
}

export interface ClassifyResult {
  title: string;
  flagged: boolean;
  categories: CategoryMatch[];
}

export interface ClassifyResponse {
  results: ClassifyResult[];
  cached: number;
  model: string;
}
