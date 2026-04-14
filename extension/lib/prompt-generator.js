// lib/prompt-generator.js
// Role: optimize a user-supplied prompt by removing filler words and phrases.
// Depends on: prompt-rules-db.js (must be loaded first)

/**
 * Build a single regex that matches all filler entries.
 * Entries are sorted longest-first so multi-word phrases are tried before
 * their component words.
 */
function buildFillerRegex() {
  const sorted = [...FILLER_WORDS].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(phrase =>
    phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const flags = GENERATOR_GUIDANCE.caseInsensitive ? 'gi' : 'g';
  // \b works for single-word entries; for multi-word phrases we rely on
  // surrounding non-word characters or string edges.
  const pattern = escaped
    .map(e => (e.includes('\\ ') ? `(?:^|\\s)${e}(?=\\s|[,.!?;:]|$)` : `\\b${e}\\b`))
    .join('|');
  return new RegExp(pattern, flags);
}

const _fillerRegex = buildFillerRegex();

/**
 * Optimize a prompt by stripping filler words/phrases.
 * @param {string} originalPrompt
 * @returns {string} optimizedPrompt
 */
function optimizePrompt(originalPrompt) {
  const guidance = GENERATOR_GUIDANCE;

  // Guard: too short to touch
  if (!originalPrompt || originalPrompt.length < guidance.minLengthToOptimize) {
    return originalPrompt.trim();
  }

  let result = originalPrompt;

  // Remove filler matches
  result = result.replace(_fillerRegex, ' ');

  if (guidance.cleanupWhitespace) {
    // Collapse multiple spaces to one
    result = result.replace(/[ \t]{2,}/g, ' ');
    // Trim leading/trailing space per line
    result = result
      .split('\n')
      .map(line => line.trim())
      .join('\n');
  }

  if (guidance.collapseNewlines) {
    result = result.replace(/\n{3,}/g, '\n\n');
  }

  result = result.trim();

  // Fix spacing before punctuation that can appear after a removed word
  result = result.replace(/\s+([,.!?;:])/g, '$1');

  // Safety check: if we stripped too much, return the original
  if (
    result.length < originalPrompt.length * guidance.minRetainRatio ||
    result.length === 0
  ) {
    return originalPrompt.trim();
  }

  return result;
}
