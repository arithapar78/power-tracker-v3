// lib/prompt-generator.js
// Role: optimize a user-supplied prompt in two passes:
//   Pass 1 — structural compression  (COMPRESSION_RULES from prompt-rules-db.js)
//   Pass 2 — filler word removal     (FILLER_WORDS from prompt-rules-db.js)
// Depends on: prompt-rules-db.js (must be loaded first)

// ── Pass 2: filler regex (built once at load time) ─────────────────────────

function buildFillerRegex() {
  // Sort longest-first so multi-word phrases match before their subwords
  const sorted = [...FILLER_WORDS].sort((a, b) => b.length - a.length);

  const flags = GENERATOR_GUIDANCE.caseInsensitive ? 'gi' : 'g';

  const parts = sorted.map(phrase => {
    const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Multi-word phrases: require a word boundary before, whitespace/punctuation after
    if (esc.includes(' ')) {
      return `(?<=\\s|^)${esc}(?=\\s|[,.!?;:]|$)`;
    }
    // Single words: standard word boundaries
    return `\\b${esc}\\b`;
  });

  return new RegExp(parts.join('|'), flags);
}

const _fillerRegex = buildFillerRegex();

// ── Pass 1: apply structural compression rules ─────────────────────────────

/**
 * Apply each COMPRESSION_RULES entry in order.
 * Rules run sequentially so later rules can act on the output of earlier ones.
 *
 * @param {string} text
 * @returns {string}
 */
function applyCompressionRules(text) {
  for (const rule of COMPRESSION_RULES) {
    text = text.replace(rule.pattern, rule.replacement);
  }
  return text;
}

// ── Pass 2: remove filler words ────────────────────────────────────────────

/**
 * Strip filler words and phrases using the pre-built regex.
 *
 * @param {string} text
 * @returns {string}
 */
function applyFillerRemoval(text) {
  return text.replace(_fillerRegex, ' ');
}

// ── Cleanup: whitespace and punctuation ────────────────────────────────────

/**
 * Normalise whitespace and fix punctuation artifacts left by removed text.
 *
 * @param {string} text
 * @returns {string}
 */
function cleanupText(text) {
  const guidance = GENERATOR_GUIDANCE;

  if (guidance.cleanupWhitespace) {
    // Collapse runs of spaces/tabs to a single space
    text = text.replace(/[ \t]{2,}/g, ' ');
    // Trim each line individually
    text = text.split('\n').map(l => l.trim()).join('\n');
  }

  if (guidance.collapseNewlines) {
    text = text.replace(/\n{3,}/g, '\n\n');
  }

  // Fix space-before-punctuation artifacts: "word ," → "word,"
  text = text.replace(/\s+([,.!?;:])/g, '$1');

  // Fix double punctuation artifacts: ",." or ".," → "."
  text = text.replace(/([,.!?;:]){2,}/g, '$1');

  // Remove a lone comma or semicolon at the start of a sentence
  text = text.replace(/(^|\.\s+)[,;]\s*/g, '$1');

  // Capitalise the first letter of each sentence if it was lowercased by compression
  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase());

  return text.trim();
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Optimize a prompt through two passes: structural compression then filler removal.
 *
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

  // Pass 1: structural compression (e.g. "the more X, the more Y" → "More X means more Y")
  result = applyCompressionRules(result);

  // Pass 2: filler word/phrase removal (e.g. "please", "just", "I would like to")
  result = applyFillerRemoval(result);

  // Cleanup: normalise spacing, fix punctuation, restore sentence capitalisation
  result = cleanupText(result);

  // Safety net: if the result is empty or over-compressed, return the trimmed original
  if (
    result.length === 0 ||
    result.length < originalPrompt.length * guidance.minRetainRatio
  ) {
    return originalPrompt.trim();
  }

  return result;
}
