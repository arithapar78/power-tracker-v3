// lib/prompt-rules-db.js
// Internal database for the prompt generator.
// Two exports: FILLER_WORDS (list) and GENERATOR_GUIDANCE (object).

// ── Filler words & phrases to remove ──────────────────────────────────────
// Rules:
//  - Match whole words only (word boundaries) to avoid partial replacements
//  - Case-insensitive matching
//  - Listed roughly by category for easy editing

const FILLER_WORDS = [
  // Greetings / sign-offs
  "hi", "hey", "hello", "howdy", "greetings", "good morning", "good afternoon",
  "good evening", "good day", "dear", "dear sir", "dear madam",
  "thank you", "thanks", "thank you so much", "thanks so much",
  "many thanks", "thanks a lot", "thank you very much", "thanks a bunch",
  "thanks again", "thank you again", "bye", "goodbye", "cheers",
  "sincerely", "regards", "best regards", "kind regards", "warm regards",
  "yours truly", "with appreciation",

  // Softeners / hedgers
  "please", "kindly", "if you could", "if you can", "if possible",
  "if it's possible", "if that's okay", "if that is okay",
  "if you don't mind", "if you wouldn't mind", "whenever you get a chance",
  "at your convenience", "at your earliest convenience",
  "when you have time", "when you get a chance",
  "feel free to", "don't hesitate to",

  // Filler intensifiers
  "just", "simply", "basically", "essentially", "fundamentally",
  "really", "very", "quite", "pretty", "fairly", "rather",
  "somewhat", "slightly", "a little", "a bit", "kind of",
  "sort of", "in a way", "in some ways", "to some extent",
  "to a certain extent", "to a degree", "more or less",
  "more or less", "roughly speaking", "generally speaking",
  "broadly speaking",

  // Throat-clearing / meta-commentary
  "so", "well", "okay", "ok", "alright", "right",
  "you know", "you see", "i mean", "i think", "i believe",
  "i feel", "i suppose", "i guess", "i reckon", "i would say",
  "i would argue", "i would suggest", "it seems", "it appears",
  "it looks like", "it seems like", "it appears that",
  "as you know", "as we know", "as you may know",
  "as you probably know", "needless to say", "of course",
  "obviously", "clearly", "certainly", "definitely", "absolutely",
  "totally", "completely", "utterly", "entirely",

  // Redundant openers
  "i am writing to", "i am reaching out to", "i wanted to",
  "i wanted to ask", "i was wondering", "i was hoping",
  "i'd like to", "i would like to", "i would love to",
  "i need you to", "i want you to", "can you please",
  "could you please", "would you please", "could you kindly",
  "would you kindly", "could you", "would you",
  "can you", "will you", "do you think you could",

  // Padding phrases
  "in order to", "for the purpose of", "with the aim of",
  "with the goal of", "with the intention of", "in an effort to",
  "in a bid to", "is", "due to the fact that", "owing to the fact that",
  "in light of the fact that", "given the fact that",
  "the fact that", "as a matter of fact", "in point of fact",
  "it is worth noting that", "it is important to note that",
  "it should be noted that", "it is worth mentioning that",
  "it goes without saying", "suffice it to say",
  "at the end of the day", "all things considered",
  "when all is said and done", "on that note", "with that said",
  "that being said", "having said that", "that said",
  "all in all", "in any case", "in any event",
  "in the end", "at the end", "ultimately",
  "first of all", "first and foremost", "last but not least",
  "to begin with", "to start with", "to start off",
  "by the way", "incidentally", "in other words",
  "to put it another way", "to put it simply",
  "to put it differently", "long story short",
  "to make a long story short", "the bottom line is",
  "the thing is", "here's the thing", "the point is",

  // Weak qualifiers
  "a little bit", "just a little", "just a bit",
  "a tad", "ever so slightly", "marginally",
  "nominally", "arguably", "presumably", "supposedly",
  "allegedly", "reportedly", "apparently",

  // Filler connectors
  "and so", "and also", "and then", "as well as",
  "as well", "too", "also", "additionally", "furthermore",
  "moreover", "in addition", "in addition to that",
  "on top of that", "not only that", "along with that",

  // Empty courtesy phrases
  "no problem", "no worries", "sure thing", "of course",
  "absolutely", "certainly", "definitely", "go ahead",
  "feel free",
];

// ── Structural compression rules ──────────────────────────────────────────
// Applied BEFORE filler removal, in order.
// Each rule is { pattern: RegExp, replacement: string|Function, note: string }
// Patterns use capture groups; replacements can reference them via $1/$2 or
// a function for more control.
//
// Rules are conservative: they compress structure only when meaning survives
// intact. No synonym swaps, no creative rewrites.

const COMPRESSION_RULES = [
  // ── Comparative constructions ────────────────────────────────────────────

  // "the more X ..., the more Y ..." → "More X means more Y."
  // Handles: "the more tokens you use, the more you save"
  {
    pattern: /\bthe more ([^,\.]+?),\s*the more ([^,\.]+)/gi,
    replacement: 'More $1 means more $2',
    note: 'the-more...the-more compression',
  },
  // "the more X ..., the less Y ..."
  {
    pattern: /\bthe more ([^,\.]+?),\s*the less ([^,\.]+)/gi,
    replacement: 'More $1 means less $2',
    note: 'the-more...the-less compression',
  },
  // "the less X ..., the more Y ..."
  {
    pattern: /\bthe less ([^,\.]+?),\s*the more ([^,\.]+)/gi,
    replacement: 'Less $1 means more $2',
    note: 'the-less...the-more compression',
  },

  // ── Relative clause simplification ──────────────────────────────────────

  // "that you [verb]" → "[verb]ing"  e.g. "tokens that you use" → "tokens you use"
  // Conservative: just drop "that" when followed by "you"
  {
    pattern: /\bthat you\b/gi,
    replacement: 'you',
    note: 'drop redundant "that" before "you"',
  },

  // "which is [adj/noun]" → "that is [adj/noun]" → just the adjective
  // e.g. "a method which is effective" → "an effective method" is too risky;
  // instead just compress "which is" → "that is"? No — keep it to dropping "which is"
  // only when it immediately precedes an adjective at end of clause.
  {
    pattern: /\b(?:which|that) is (\w+)(?=[,\.\s]|$)/gi,
    replacement: '$1',
    note: 'drop "which/that is" before terminal adjective',
  },

  // ── Ability / modal verbosity ────────────────────────────────────────────

  // "is able to" → "can"
  {
    pattern: /\bis able to\b/gi,
    replacement: 'can',
    note: '"is able to" → "can"',
  },
  // "are able to" → "can"
  {
    pattern: /\bare able to\b/gi,
    replacement: 'can',
    note: '"are able to" → "can"',
  },
  // "was able to" → "could"
  {
    pattern: /\bwas able to\b/gi,
    replacement: 'could',
    note: '"was able to" → "could"',
  },
  // "will be able to" → "can"
  {
    pattern: /\bwill be able to\b/gi,
    replacement: 'can',
    note: '"will be able to" → "can"',
  },

  // ── Expletive "there is/are" ─────────────────────────────────────────────

  // "There is a X that" → "A X"  e.g. "There is a problem that needs solving" → "A problem needs solving"
  // Conservative: only when "there is/are a/an/the" + noun + "that/which"
  {
    pattern: /\bThere (?:is|are) (a|an|the) (\w+) that\b/gi,
    replacement: '$1 $2 that',
    note: 'collapse "there is/are [art] [noun] that" opener',
  },
  // "There is/are no" → "No"
  {
    pattern: /\bThere (?:is|are) no\b/gi,
    replacement: 'No',
    note: '"There is/are no" → "No"',
  },

  // ── Wordy prepositions & conjunctions ────────────────────────────────────

  // "in the event that" → "if"
  {
    pattern: /\bin the event that\b/gi,
    replacement: 'if',
    note: '"in the event that" → "if"',
  },
  // "in the event of" → "if"
  {
    pattern: /\bin the event of\b/gi,
    replacement: 'if',
    note: '"in the event of" → "if"',
  },
  // "prior to" → "before"
  {
    pattern: /\bprior to\b/gi,
    replacement: 'before',
    note: '"prior to" → "before"',
  },
  // "subsequent to" → "after"
  {
    pattern: /\bsubsequent to\b/gi,
    replacement: 'after',
    note: '"subsequent to" → "after"',
  },
  // "in spite of the fact that" → "although"
  {
    pattern: /\bin spite of the fact that\b/gi,
    replacement: 'although',
    note: '"in spite of the fact that" → "although"',
  },
  // "despite the fact that" → "although"
  {
    pattern: /\bdespite the fact that\b/gi,
    replacement: 'although',
    note: '"despite the fact that" → "although"',
  },
  // "at this point in time" → "now"
  {
    pattern: /\bat this point in time\b/gi,
    replacement: 'now',
    note: '"at this point in time" → "now"',
  },
  // "at the present time" → "now"
  {
    pattern: /\bat the present time\b/gi,
    replacement: 'now',
    note: '"at the present time" → "now"',
  },
  // "on a [adj] basis" → the adjective + "ly"  e.g. "on a daily basis" → "daily"
  {
    pattern: /\bon a (\w+) basis\b/gi,
    replacement: '$1',
    note: '"on a X basis" → "X"',
  },

  // ── Wordy verb constructions ─────────────────────────────────────────────

  // "make use of" → "use"
  {
    pattern: /\bmake use of\b/gi,
    replacement: 'use',
    note: '"make use of" → "use"',
  },
  // "make a decision" → "decide"
  {
    pattern: /\bmake a decision\b/gi,
    replacement: 'decide',
    note: '"make a decision" → "decide"',
  },
  // "come to a conclusion" → "conclude"
  {
    pattern: /\bcome to a conclusion\b/gi,
    replacement: 'conclude',
    note: '"come to a conclusion" → "conclude"',
  },
  // "take into consideration" → "consider"
  {
    pattern: /\btake into consideration\b/gi,
    replacement: 'consider',
    note: '"take into consideration" → "consider"',
  },
  // "give consideration to" → "consider"
  {
    pattern: /\bgive consideration to\b/gi,
    replacement: 'consider',
    note: '"give consideration to" → "consider"',
  },
  // "provide an explanation for" → "explain"
  {
    pattern: /\bprovide an explanation for\b/gi,
    replacement: 'explain',
    note: '"provide an explanation for" → "explain"',
  },
  // "conduct an investigation" → "investigate"
  {
    pattern: /\bconduct an investigation\b/gi,
    replacement: 'investigate',
    note: '"conduct an investigation" → "investigate"',
  },
  // "perform an analysis" → "analyze"
  {
    pattern: /\bperform an analysis\b/gi,
    replacement: 'analyze',
    note: '"perform an analysis" → "analyze"',
  },

  // ── Tautological pairs ───────────────────────────────────────────────────

  // "each and every" → "every"
  {
    pattern: /\beach and every\b/gi,
    replacement: 'every',
    note: '"each and every" → "every"',
  },
  // "any and all" → "all"
  {
    pattern: /\bany and all\b/gi,
    replacement: 'all',
    note: '"any and all" → "all"',
  },
  // "full and complete" → "complete"
  {
    pattern: /\bfull and complete\b/gi,
    replacement: 'complete',
    note: '"full and complete" → "complete"',
  },
  // "true and accurate" → "accurate"
  {
    pattern: /\btrue and accurate\b/gi,
    replacement: 'accurate',
    note: '"true and accurate" → "accurate"',
  },
  // "null and void" → "void"
  {
    pattern: /\bnull and void\b/gi,
    replacement: 'void',
    note: '"null and void" → "void"',
  },

  // ── Vague quantity phrases ───────────────────────────────────────────────

  // "a large number of" → "many"
  {
    pattern: /\ba large number of\b/gi,
    replacement: 'many',
    note: '"a large number of" → "many"',
  },
  // "a number of" → "several"
  {
    pattern: /\ba number of\b/gi,
    replacement: 'several',
    note: '"a number of" → "several"',
  },
  // "a small number of" → "a few"
  {
    pattern: /\ba small number of\b/gi,
    replacement: 'a few',
    note: '"a small number of" → "a few"',
  },
  // "a wide variety of" → "various"
  {
    pattern: /\ba wide variety of\b/gi,
    replacement: 'various',
    note: '"a wide variety of" → "various"',
  },
  // "a wide range of" → "various"
  {
    pattern: /\ba wide range of\b/gi,
    replacement: 'various',
    note: '"a wide range of" → "various"',
  },

  // ── Hollow intensifiers with structure ───────────────────────────────────

  // "the fact that" → "that"  (structural filler, not a data point)
  // Note: filler list already has "the fact that" but the regex needs word-boundary care
  {
    pattern: /\bthe fact that\b/gi,
    replacement: 'that',
    note: '"the fact that" → "that"',
  },
  // "it is X that" → "X:"  e.g. "it is important that you" → "importantly, you"
  // Conservative: only "it is X that" where X is a single adjective
  {
    pattern: /\bIt is (\w+) that\b/gi,
    replacement: '$1:',
    note: '"It is X that" → "X:"',
  },
  // "the reason why" → "why"
  {
    pattern: /\bthe reason why\b/gi,
    replacement: 'why',
    note: '"the reason why" → "why"',
  },
  // "the reason that" → "why"
  {
    pattern: /\bthe reason that\b/gi,
    replacement: 'why',
    note: '"the reason that" → "why"',
  },
  // "whether or not" → "whether"
  {
    pattern: /\bwhether or not\b/gi,
    replacement: 'whether',
    note: '"whether or not" → "whether"',
  },
];

// ── Generator guidance ─────────────────────────────────────────────────────
// These rules control HOW the generator applies the filler list.
// Edit these to tune conservatism vs. aggressiveness.

const GENERATOR_GUIDANCE = {
  // Match whole words only — never strip a filler that is mid-word
  wholeWordOnly: true,

  // Case insensitive matching
  caseInsensitive: true,

  // After removing fillers, collapse extra whitespace and fix punctuation
  cleanupWhitespace: true,

  // Minimum prompt length (chars) before any stripping is attempted.
  // Prevents mangling very short prompts.
  minLengthToOptimize: 5,

  // If the optimized result is shorter than this ratio of the original,
  // return the original unchanged. Guards against over-stripping.
  minRetainRatio: 0.3,

  // Collapse runs of 3+ newlines into 2, but preserve intentional line breaks
  collapseNewlines: true,
};
