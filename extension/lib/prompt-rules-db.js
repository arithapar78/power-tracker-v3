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
  "in a bid to", "due to the fact that", "owing to the fact that",
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
