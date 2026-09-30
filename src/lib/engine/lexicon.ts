import type { ServiceType, TimeWindow, Urgency } from "../domain/types";

/** Checked in this order; the first matching type wins, so more specific trades come first. */
export const SERVICE_PATTERNS: ReadonlyArray<[ServiceType, RegExp]> = [
  [
    "gas-line",
    /\bgas\s+(?:line|pipe|piping|meter|hook\s*up|connection)s?\b|\b(?:hook\s*up|install\w*|connect\w*|run)\s+(?:a\s+|the\s+|my\s+)?gas\b/,
  ],
  [
    "sewer",
    /\bsewer\w*|\bsewage\b|\bseptic\b|\bmain\s+(?:drain\s+)?line\b|\bclean\s*out\b|\btree\s+roots?\b|\broots\b|\b(?:all|every|multiple)\s+(?:the\s+)?drains\b/,
  ],
  ["water-heater", /\bwater\s+heater\b|\bhot\s+water\b|\btankless\b|\bpilot\b|\bheater\b/],
  [
    "clog",
    /\bclog\w*|\bblock(?:ed|age)\b|\bslow(?:ly)?\s+drain\w*|\bdrain\w*\s+(?:really\s+|very\s+|super\s+|so\s+)?slow\w*|\bwon'?t\s+(?:drain|flush|go\s+down)\b|\bnot\s+draining\b|\bback(?:ed|ing|s)?\s+up\b|\bstopped\s+up\b|\boverflow\w*/,
  ],
  [
    "leak",
    /\bleak\w*|\bdrip\w*|\bburst\w*|\bbroken\s+pipe|\bpipe\w*\s+(?:burst|broke\w*|split|cracked)|\bwater\s+(?:stain|spot|damage|everywhere|coming\s+through|running)\b|\bpuddle\w*|\bspray\w*|\bgush\w*|\bseep\w*|\bwet\s+(?:spot|wall|ceiling|floor)/,
  ],
  [
    "fixture-install",
    /\binstall\w*|\breplac\w*|\bput\s+in\b|\bswap\w*\s+out|\bupgrade\w*|\bnew\s+(?:faucet|toilet|sink|shower|tub|disposal|fixture|vanity)|\bgarbage\s+disposal\b|\bhook\s*up\b/,
  ],
];

export const OTHER_ANSWER = /\b(?:other|something else|none of (?:those|these|them)|not sure|dunno|don'?t know)\b/;

/** Phrases that sound urgent but deny it; removed before the urgent patterns run. */
export const URGENCY_DENIAL = /\bnot\s+(?:an?\s+|really\s+)?(?:urgent|emergency)\b/g;

/** Checked most urgent first; the first match wins. */
export const URGENCY_PATTERNS: ReadonlyArray<[Urgency, RegExp]> = [
  [
    "emergency",
    /\bemergenc\w*|\bflood\w*|\bburst\w*|\bgush\w*|\bwater\s+everywhere\b|\bpouring\b|\bwon'?t\s+(?:stop|shut\s+off|turn\s+off)\b|\bcan'?t\s+(?:stop|shut|turn)\b|\bsewage\s+(?:is\s+)?(?:coming|backing|pouring)\s+(?:up|in|out)|\bno\s+water\s+(?:at\s+all|coming\s+out)/,
  ],
  [
    "today",
    /\btoday\b|\btonight\b|\btonite\b|\bthis\s+(?:morning|afternoon|evening)\b|\basap\b|\bas\s+soon\s+as\b|\bright\s+(?:away|now)\b|\bimmediately\b|\burgent\w*|\bsame[\s-]day\b/,
  ],
  [
    "this-week",
    /\bthis\s+week\b|\btomorrow\b|\btmrw\b|\b(?:next\s+)?(?:few|couple(?:\s+of)?)\s+days\b|\b(?:this\s+)?weekend\b|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b|\bsoon\b|\bwithin\s+(?:the\s+|a\s+)?week\b/,
  ],
  [
    "flexible",
    /\bno\s+(?:rush|hurry)\b|\bnot\s+(?:urgent|an?\s+emergency|in\s+a\s+(?:rush|hurry)|a\s+big\s+deal)\b|\bwhenever\b|\bflexible\b|\bnext\s+(?:week|month)\b|\bsometime\b|\blow\s+priority\b|\bwhen\s+(?:you\s+can|convenient)\b|\bno\s+big\s+deal\b/,
  ],
];

/** The earliest match in the text wins, since customers usually lead with their preference. */
export const WINDOW_PATTERNS: ReadonlyArray<[TimeWindow, RegExp]> = [
  ["asap", /\basap\b|\bas\s+soon\s+as\b|\bright\s+(?:away|now)\b|\bimmediately\b/],
  ["morning", /\bmornings?\b|\bbefore\s+(?:noon|lunch|12)\b|\b(?:[7-9]|1[01])\s*(?:am|a\.m\.)/],
  ["afternoon", /\bafternoons?\b|\bafter\s+lunch\b|\bmidday\b|\b(?:12|[1-4])\s*(?:pm|p\.m\.)/],
  ["evening", /\bevenings?\b|\btonight\b|\btonite\b|\bafter\s+(?:work|5|five|6|six)\b|\b[5-8]\s*(?:pm|p\.m\.)/],
  ["anytime", /\bany\s*time\b|\ball\s+day\b|\bwhenever\b|\bdoesn'?t\s+matter\b|\bany\s+window\b/],
];

/** Extra time-window answers that only make sense right after we asked for a window. */
export const WINDOW_ANSWER_ANYTIME = /\b(?:flexible|no\s+preference|either|any|all\s+good|fine)\b/;

/** Words the typo corrector snaps toward. */
export const VOCAB: ReadonlySet<string> = new Set([
  "leak", "leaking", "leaky", "leaks", "dripping", "clogged", "blocked", "drain", "draining", "drains",
  "toilet", "faucet", "shower", "bathtub", "heater", "water", "sewer", "sewage", "septic", "install",
  "installed", "replace", "replacing", "disposal", "dishwasher", "flooding", "flooded", "burst",
  "emergency", "urgent", "tomorrow", "morning", "mornings", "afternoon", "afternoons", "evening",
  "evenings", "tonight", "anytime", "whenever", "flexible", "overflowing", "pilot", "tankless",
  "gushing", "spraying", "weekend", "monday", "tuesday", "wednesday", "thursday", "friday",
  "saturday", "sunday", "today", "sometime", "garbage", "plugged", "backing", "backed",
]);

/** Common words one edit away from a vocabulary word; never corrected. */
export const KEEP: ReadonlySet<string> = new Set([
  "floor", "floors", "later", "sick", "weak", "wall", "walls", "tile", "home", "hose", "hole", "time",
  "down", "does", "done", "drop", "drips", "fine", "five", "flow", "some", "soon", "sure", "that",
  "then", "there", "these", "this", "those", "today", "tone", "wait", "want", "warm", "wash", "were",
  "what", "when", "where", "which", "while", "will", "with", "work", "works", "would", "your", "heat",
  "heats", "heated", "leave", "least", "learn", "lead", "leaf", "leap", "burnt", "burns", "disposals",
  "draw", "drawn", "dream", "patio", "pilots", "shows", "shower", "blocks", "block", "backs",
]);
