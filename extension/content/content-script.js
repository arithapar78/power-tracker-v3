// content/content-script.js
// Role: collect lightweight page metrics and push them to the service worker.
// Safety rules:
//   - No repeated full-DOM traversals; node count is sampled once per send cycle
//     using a single cheap property (document.all.length) instead of querySelectorAll.
//   - MutationObserver only watches childList (structural changes), not attributes,
//     to avoid firing on every class/style tweak in reactive frameworks.
//   - Element-type flags (video, canvas, WebGL) are resolved once at startup and
//     updated only when structure actually changes, not on every timer tick.
//   - Network bytes accumulate passively via PerformanceObserver — no active polling.
//   - All sends are fire-and-forget; errors are silently ignored.

(function () {

  // ── Mutation tracking ──────────────────────────────────────────────────────
  // Track structural DOM changes only (childList). Skipping attribute observation
  // avoids a flood of callbacks on pages that animate via class/style changes.

  let mutationCount = 0;
  let mutationsPerSec = 0;

  const mutationObserver = new MutationObserver((records) => {
    mutationCount += records.length;

    // Re-check element-type flags only when the structure actually changed.
    scheduleElementCheck();
  });

  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    // attributes: false — intentionally omitted; cuts callback volume dramatically
    //   on reactive frameworks that update dozens of attributes per render cycle.
  });

  // Flush mutation count once per second. Simple counter reset — no iteration.
  setInterval(() => {
    mutationsPerSec = mutationCount;
    mutationCount = 0;
  }, 1000);

  // ── Element-type flags ────────────────────────────────────────────────────
  // Resolved once at startup, then refreshed only after structural DOM changes.
  // querySelector is O(n) but called at most once per mutation batch, not per tick.

  let hasVideo = false;
  let hasCanvas = false;
  let hasWebGL = false;

  let elementCheckScheduled = false;

  function scheduleElementCheck() {
    if (elementCheckScheduled) return;
    elementCheckScheduled = true;
    // Defer to next microtask so multiple mutations in one batch cost one check.
    Promise.resolve().then(updateElementFlags);
  }

  function updateElementFlags() {
    elementCheckScheduled = false;

    // Video: only care if one is actually playing.
    const videoEl = document.querySelector('video');
    hasVideo = videoEl !== null && !videoEl.paused;

    // Canvas: presence is enough to flag potential 2D rendering work.
    const canvasEl = document.querySelector('canvas');
    hasCanvas = canvasEl !== null;

    // WebGL: check only the first canvas to avoid iterating all of them.
    // getContext() on an existing canvas is cheap; creating a new context is not.
    if (canvasEl) {
      try {
        hasWebGL = !!(canvasEl.getContext('webgl') || canvasEl.getContext('webgl2'));
      } catch (_) {
        hasWebGL = false;
      }
    } else {
      hasWebGL = false;
    }
  }

  // Run once at startup.
  updateElementFlags();

  // ── Network tracking ──────────────────────────────────────────────────────
  // PerformanceObserver accumulates bytes passively as resources load.
  // No polling needed — the observer fires only when new resources complete.

  let transferKB = 0;

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const perfObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // encodedBodySize is compressed wire size; 0 means served from cache.
          if (entry.encodedBodySize > 0) {
            transferKB += entry.encodedBodySize / 1024;
          }
        }
      });
      perfObserver.observe({ type: 'resource', buffered: true });
    } catch (_) {
      // Some contexts (e.g. sandboxed iframes) may reject the observe call.
    }
  }

  // ── Collect and send ──────────────────────────────────────────────────────

  function collectMetrics() {
    return {
      // document.all.length is a cheap O(1) browser-internal counter —
      // faster than querySelectorAll('*').length which does a full tree walk.
      domNodes: document.all.length,

      // Mutations per second from the rolling counter above.
      mutationsPerSec,

      // Cumulative KB transferred since page load (passive accumulation).
      transferKB: Math.round(transferKB * 10) / 10,

      // Element-type flags maintained by the mutation-driven checker above.
      hasVideo,
      hasCanvas,
      hasWebGL,
    };
  }

  function sendMetrics() {
    // Guard against the extension being reloaded/updated while this content
    // script is still alive — chrome.runtime.sendMessage throws synchronously
    // with "Extension context invalidated" in that case.
    if (!chrome.runtime?.id) return;
    const metrics = collectMetrics();
    try {
      chrome.runtime.sendMessage({ type: 'PAGE_METRICS', metrics }).catch(() => {});
    } catch (_) {}
  }

  // Send once on load (after a short delay so the page has started rendering),
  // then every 10 seconds. 10 s is frequent enough for a live display while
  // being far below any perceptible performance impact.
  setTimeout(sendMetrics, 1500);
  setInterval(sendMetrics, 10000);

})();
