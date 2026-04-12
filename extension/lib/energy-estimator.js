// lib/energy-estimator.js
// Role: estimate token count / energy cost of a prompt (keep minimal)

/**
 * Estimate token count for a given text.
 * Rough approximation: 1 token ≈ 4 characters.
 * @param {string} text
 * @returns {number} estimated token count
 * TODO: refine estimation if needed
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
