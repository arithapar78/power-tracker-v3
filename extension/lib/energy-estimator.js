// lib/energy-estimator.js
// Role: convert page metrics into an estimated watt value.
//
// This is a heuristic model, not a hardware measurement.
// Each metric contributes a weighted component to a baseline watt estimate.
// Weights are chosen to produce plausible relative values (0.1 W – ~5 W range).

/**
 * Estimate frontend energy usage in watts from page metrics.
 *
 * @param {{
 *   domNodes: number,        // total DOM node count
 *   mutationsPerSec: number, // DOM mutations observed per second
 *   transferKB: number,      // network bytes transferred (KB)
 *   hasVideo: boolean,       // true if a <video> element is present and playing
 *   hasCanvas: boolean,      // true if a <canvas> element is present
 *   hasWebGL: boolean        // true if a WebGL context is active
 * }} metrics
 * @returns {number} estimated watts, rounded to 2 decimal places
 */
function estimateWatts(metrics) {
  const {
    domNodes = 0,
    mutationsPerSec = 0,
    transferKB = 0,
    hasVideo = false,
    hasCanvas = false,
    hasWebGL = false,
  } = metrics;

  // Baseline cost every page pays just for being loaded
  const BASE = 0.1;

  // DOM complexity: large DOMs require more layout/paint work.
  // Contribution grows slowly — 1000 nodes ≈ +0.10 W.
  const domCost = (domNodes / 10000) * 1.0;

  // Mutation rate: frequent DOM changes drive reflows and repaints.
  // 10 mutations/sec ≈ +0.15 W.
  const mutationCost = (mutationsPerSec / 10) * 0.15;

  // Network: transferring data wakes up radios and keeps CPUs busy.
  // 1 MB transferred ≈ +0.20 W.
  const networkCost = (transferKB / 1024) * 0.20;

  // Video playback is the largest single consumer on most pages.
  const videoCost = hasVideo ? 1.5 : 0;

  // Canvas (2D) implies continuous rendering work.
  const canvasCost = hasCanvas ? 0.4 : 0;

  // WebGL implies GPU involvement.
  const webglCost = hasWebGL ? 0.8 : 0;

  const total = BASE + domCost + mutationCost + networkCost + videoCost + canvasCost + webglCost;

  return Math.round(total * 100) / 100;
}

// Keep the old token estimator in case it's needed later.
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
