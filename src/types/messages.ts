import type { YTFilterConfig } from "./config";
import type { FilterLogEntry } from "./video";

export interface MLClassifyResult {
  category: string;
  confidence: number;
  gap?: number;
  matchedArchetype?: string;
  labels?: string[];
}

export type ExtensionMessage =
  | { type: "UPDATE_BADGE"; config: YTFilterConfig }
  | { type: "GET_CONFIG" }
  | { type: "HIDDEN_COUNT"; count: number }
  | { type: "FILTER_LOG_BATCH"; entries: FilterLogEntry[] }
  | { type: "GET_LOG" }
  | { type: "CLEAR_LOG" }
  | { type: "OPEN_OPTIONS" }
  | { type: "GET_LIVE_STATS" }
  | { type: "ML_INIT" }
  | { type: "ML_TERMINATE" }
  | { type: "ML_CLASSIFY"; titles: string[]; requestId: number }
  | {
      type: "ML_STATUS";
      target?: string;
      status: string;
      detail?: string;
      error?: string;
    }
  | {
      type: "ML_RESULTS";
      target?: string;
      requestId: number;
      results: (MLClassifyResult | null)[];
      error?: string;
    };

export interface LiveStatsResponse {
  total: number;
  hidden: number;
  page: string;
}

// Worker messages (between offscreen <-> ml-worker)
export type WorkerInMessage =
  | { type: "INIT"; target?: string }
  | { type: "CLASSIFY"; target?: string; titles: string[]; requestId: number }
  | { type: "PING"; target?: string };

export type WorkerOutMessage =
  | { type: "ML_STATUS"; status: string; detail?: string; error?: string }
  | {
      type: "ML_RESULTS";
      requestId: number;
      results: (MLClassifyResult | null)[];
      error?: string;
    }
  | { type: "PONG"; ready: boolean };
