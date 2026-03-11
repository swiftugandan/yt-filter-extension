export interface FilterRules {
  titleKeywords: string[];
  channelNames: string[];
  titleRegex: string;
  hideShorts: boolean;
  hideLive: boolean;
  hideWatched: boolean;
  hideMixes: boolean;
  hidePlayables: boolean;
  hideAds: boolean;
  hideClickbait: boolean;
  hideToxic: boolean;
  minDuration: number | null;
  maxDuration: number | null;
}

export interface YTFilterConfig {
  enabled: boolean;
  filterMode: "hide" | "blur";
  mlEnabled: boolean;
  filters: FilterRules;
  stats: {
    totalHidden: number;
  };
}

export const DEFAULT_CONFIG: YTFilterConfig = {
  enabled: true,
  filterMode: "hide",
  mlEnabled: false,
  filters: {
    titleKeywords: ["#ad", "#sponsored", "paid promotion"],
    channelNames: [],
    hideShorts: false,
    hideLive: false,
    hideWatched: false,
    minDuration: null,
    maxDuration: null,
    titleRegex: "\\b(sponsor(ed)?|#ad|paid promoti?on)\\b|^\\[AD\\]",
    hideMixes: false,
    hidePlayables: false,
    hideAds: true,
    hideClickbait: true,
    hideToxic: true,
  },
  stats: {
    totalHidden: 0,
  },
};
