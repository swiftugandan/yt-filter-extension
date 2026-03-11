import type { YTFilterConfig } from "../types/config";
import type { VideoMetadata } from "../types/video";

// ── Clickbait patterns ──
export const RE_CLICKBAIT_CAPS = /^[A-Z\s!?.,':]{20,}$/;
export const RE_CLICKBAIT_PUNCT = /[!?]{3,}|\.{4,}/;
export const RE_CLICKBAIT_PHRASES = new RegExp(
  [
    "you won'?t believe",
    "what happens next",
    "gone wrong",
    "gone sexual",
    "not clickbait",
    "must watch",
    "will shock you",
    "doctors hate",
    "scientists baffled",
    "one weird trick",
    "before it'?s deleted",
    "they don'?t want you to",
    "is finally over",
    "the truth about",
    "I can'?t believe",
    "you need to see this",
    "watch before",
    "last chance to see",
    "nobody expected",
    "everyone is wrong about",
    "why nobody talks about",
    "changed (my|everything) forever",
  ].join("|"),
  "i",
);
export const RE_CLICKBAIT_EMOJI_SPAM = /(\p{Emoji_Presentation}.*){4,}/u;

// ── Toxic / outrage / drama patterns ──
export const RE_TOXIC_RAGE = new RegExp(
  [
    "\\bDESTROYED\\b",
    "\\bEXPOSED\\b",
    "\\bHUMILIATED\\b",
    "\\bOBLITERATED\\b",
    "\\bANNIHILATED\\b",
    "\\bOWNED\\b",
    "gets DESTROYED",
    "absolutely DESTROYS",
    "completely OWNED",
    "DEMOLISHED",
    "SLAMMED",
    "WRECKED",
    "DISMANTLED",
    "SHUT DOWN",
    "claps back",
    "fires back",
    "rips into",
    "tears apart",
    "loses it",
    "goes off on",
    "melts? down",
  ].join("|"),
  "i",
);

export const RE_TOXIC_DRAMA = new RegExp(
  [
    "\\bdrama\\b.*\\b(alert|update|explained)\\b",
    "\\bfeud\\b",
    "\\bbeef\\b.*\\b(with|between|gets)\\b",
    "is OVER",
    "it'?s over for",
    "cancelled",
    "called out",
    "caught lying",
    "finally admits",
    "breaks silence",
    "apology video",
    "EXPOSED for",
    "the downfall of",
    "career is over",
  ].join("|"),
  "i",
);

export const RE_TOXIC_FEAR = new RegExp(
  [
    "\\bcollapses?\\b",
    "this changes everything",
    "it'?s happening",
    "prepare yourself",
    "get out now",
    "while you still can",
    "the end of",
    "we'?re all doomed",
    "point of no return",
    "too late to",
    "crisis is here",
    "why I'?m leaving",
    "is (dying|dead|finished|doomed)",
    "no one is safe",
  ].join("|"),
  "i",
);

export const RE_TOXIC_SCAM = new RegExp(
  [
    "\\$\\d+[kK].*\\b(per|a|every)\\s(day|week|month|hour)\\b",
    "make money (fast|now|easy|while you sleep)",
    "passive income.*secret",
    "free money",
    "get rich",
    "quit your (job|9.to.5)",
    "financial freedom.*secret",
    "this one (stock|coin|crypto|investment)",
    "millionaire.*secret",
    "I made \\$\\d+",
    "secret.*(they|nobody|no one)",
  ].join("|"),
  "i",
);

// ── Dark patterns ──
export const RE_DARK_URGENCY = new RegExp(
  [
    "watch NOW before",
    "HURRY",
    "limited time",
    "act fast",
    "before it'?s (too late|gone|deleted|banned|removed)",
    "last chance",
    "ending (soon|today|tonight|tomorrow)",
    "going away forever",
    "won'?t be available",
    "they'?re (deleting|removing|banning) this",
    "emergency",
    "URGENT",
    "time.?sensitive",
    "do this (now|immediately|today|right now)",
  ].join("|"),
  "i",
);

export const RE_DARK_ENGAGEMENT = new RegExp(
  [
    "like and subscribe or",
    "comment.*or.*bad luck",
    "share this or",
    "skip.*(and|=).*bad luck",
    "only \\d+% (of|will)",
    "most people (can'?t|won'?t|don'?t|fail)",
    "bet you can'?t",
    "prove me wrong",
    "I dare you",
    "tag (someone|a friend|3 friends)",
  ].join("|"),
  "i",
);

// ── Adult content patterns ──
export const RE_ADULT_VIOLENCE = new RegExp(
  [
    "\\b(gore|gory|brutal|graphic)\\s+(violence|fight|death|murder)",
    "\\b(stabbing|shooting|massacre|execution|torture)\\b",
    "\\bbloodbath\\b",
    "\\bgraphic\\s+content\\b",
    "\\b(fight|brawl)\\s+(compilation|caught on camera)",
  ].join("|"),
  "i",
);

export const RE_ADULT_SEXUAL = new RegExp(
  [
    "\\b(18\\+|nsfw|xxx|porn|nude|naked)\\b",
    "\\b(sexy|seductive|sensual)\\s+(haul|try.?on|dance|challenge)",
    "\\bgone\\s+sexual\\b",
    "\\bhot\\s+(girls?|boys?|guys?|women|men)\\b",
    "\\b(strip|striptease|lingerie)\\s+(haul|try.?on|challenge)",
    "\\bonlyfans\\b",
    "\\badult\\s+only\\b",
    "\\bbikini\\s+haul\\b",
  ].join("|"),
  "i",
);

export const RE_ADULT_DRUGS = new RegExp(
  [
    "\\b(getting|got)\\s+(drunk|wasted|high|stoned|hammered|smashed|blazed)",
    "\\b(drug|acid|shroom|dmt|lsd|cocaine|meth|heroin)\\s+trip",
    "\\bsmoking\\s+(weed|crack|meth)\\b",
    "\\bdrinking\\s+game\\b",
    "\\bdrunk\\s+(challenge|prank|fails?)\\b",
  ].join("|"),
  "i",
);

export const RE_ADULT_HORROR = new RegExp(
  [
    "\\b(creepypasta|jumpscare|jump\\s+scare)\\b",
    "\\bnightmare\\s+fuel\\b",
    "\\b(real|actual)\\s+(ghost|paranormal|haunting|demon)",
    "\\bsleep\\s+paralysis\\b",
    "\\b(serial\\s+killer|crime\\s+scene|autopsy|dead\\s+body)\\b",
    "\\b(terrifying|traumatizing|disturbing)\\s+(true|real|footage)",
  ].join("|"),
  "i",
);

export const RE_ADULT_GAMBLING = new RegExp(
  [
    "\\b(gambling|betting|slot\\s+machine|poker|blackjack)\\b.*\\b(win|lost?e?|all.in)",
    "\\bcasino\\s+(challenge|stream|haul)",
  ].join("|"),
  "i",
);

export function matchReasons(
  meta: VideoMetadata,
  config: YTFilterConfig | null,
  compiledTitleRegex: RegExp | null,
): string[] {
  if (!config?.enabled || !config.filters) return [];
  const f = config.filters;
  const reasons: string[] = [];

  if (f.titleKeywords?.length > 0) {
    const lower = meta.title.toLowerCase();
    const matched = f.titleKeywords.filter((kw) =>
      lower.includes(kw.toLowerCase()),
    );
    if (matched.length > 0) reasons.push(`keyword: "${matched[0]}"`);
  }

  if (f.channelNames?.length > 0) {
    const lowerCh = meta.channel.toLowerCase();
    const matched = f.channelNames.find((ch) => ch.toLowerCase() === lowerCh);
    if (matched) reasons.push(`channel: "${matched}"`);
  }

  if (compiledTitleRegex && compiledTitleRegex.test(meta.title)) {
    reasons.push(`regex: /${config.filters.titleRegex}/`);
  }

  if (f.hideShorts && meta.isShort) reasons.push("type: short");
  if (f.hideLive && meta.isLive) reasons.push("type: live");
  if (f.hideWatched && meta.isWatched) reasons.push("type: watched");
  if (f.hideMixes && meta.isMix) reasons.push("type: mix");
  if (f.hidePlayables && meta.isPlayable) reasons.push("type: playable");
  if (f.hideAds && meta.isAd) reasons.push("type: ad");

  if (f.hideClickbait) {
    const t = meta.title;
    if (RE_CLICKBAIT_CAPS.test(t)) reasons.push("clickbait: ALL CAPS");
    else if (RE_CLICKBAIT_PUNCT.test(t))
      reasons.push("clickbait: excessive punctuation");
    else if (RE_CLICKBAIT_PHRASES.test(t)) reasons.push("clickbait: phrase");
    else if (RE_CLICKBAIT_EMOJI_SPAM.test(t))
      reasons.push("clickbait: emoji spam");
  }

  if (f.hideToxic) {
    const t = meta.title;
    if (RE_TOXIC_RAGE.test(t)) reasons.push("toxic: rage/outrage bait");
    else if (RE_TOXIC_DRAMA.test(t)) reasons.push("toxic: drama bait");
    else if (RE_TOXIC_FEAR.test(t)) reasons.push("toxic: fear mongering");
    else if (RE_TOXIC_SCAM.test(t)) reasons.push("toxic: scam/hustle");
    else if (RE_DARK_URGENCY.test(t))
      reasons.push("dark pattern: false urgency");
    else if (RE_DARK_ENGAGEMENT.test(t))
      reasons.push("dark pattern: engagement bait");
  }

  if (f.hideAdultContent) {
    const t = meta.title;
    if (RE_ADULT_VIOLENCE.test(t)) reasons.push("adult: violence/gore");
    else if (RE_ADULT_SEXUAL.test(t)) reasons.push("adult: sexual content");
    else if (RE_ADULT_DRUGS.test(t)) reasons.push("adult: drugs/alcohol");
    else if (RE_ADULT_HORROR.test(t)) reasons.push("adult: horror/disturbing");
    else if (RE_ADULT_GAMBLING.test(t)) reasons.push("adult: gambling");
  }

  if (meta.duration !== null) {
    if (f.minDuration !== null && meta.duration < f.minDuration)
      reasons.push(`duration < ${f.minDuration}s`);
    if (f.maxDuration !== null && meta.duration > f.maxDuration)
      reasons.push(`duration > ${f.maxDuration}s`);
  }

  return reasons;
}
