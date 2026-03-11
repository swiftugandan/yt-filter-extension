export interface VideoMetadata {
  title: string;
  channel: string;
  duration: number | null;
  durationText: string;
  isShort: boolean;
  isLive: boolean;
  isWatched: boolean;
  isMix: boolean;
  isPlayable: boolean;
  isAd: boolean;
  url: string;
}

export interface FilterLogEntry {
  ts: number;
  title: string;
  channel: string;
  duration: string | null;
  url: string;
  reasons: string[];
  page: string;
}
