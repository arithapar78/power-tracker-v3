// content/content-script.js
// Role: collect lightweight page metrics and push them to the service worker.

(function () {
  // ── Mutation tracking ────────────────────────────────────────────────────
  // Count DOM mutations over a rolling 1-second window to estimate page activity.

  let mutationCount = 0;
  let mutationsPerSec = 0;

  const mutationObserver = new MutationObserver((records) => {
    mutationCount += records.length;
  });

  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  // Flush the mutation count every second.
  setInterval(() => {
    mutationsPerSec = mutationCount;
    mutationCount = 0;
  }, 1000);

  // ── Network tracking ─────────────────────────────────────────────────────
  // Use PerformanceObserver to accumulate bytes transferred since page load.
  // encodedBodySize approximates compressed wire bytes.

  let transferKB = 0;

  if (typeof PerformanceObserver !== 'undefined') {
    const perfObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.encodedBodySize > 0) {
          transferKB += entry.encodedBodySize / 1024;
        }
      }
    });
    try {
      perfObserver.observe({ type: 'resource', buffered: true });
    } catch (_) {
      // PerformanceObserver may not support this entry type in all contexts.
    }
  }

  // ── Collect and send metrics ─────────────────────────────────────────────

  function collectMetrics() {
    return {
      // Total DOM nodes — proxy for rendering complexity.
      domNodes: document.querySelectorAll('*').length,

      // Mutations per second — proxy for page dynamism / reflow cost.
      mutationsPerSec,

      // Cumulative KB transferred — proxy for network radio activity.
      transferKB: Math.round(transferKB * 10) / 10,

      // Video: playing video is the largest single energy consumer on most pages.
      hasVideo: Array.from(document.querySelectorAll('video')).some((v) => !v.paused),

      // Canvas: implies continuous 2D rendering work.
      hasCanvas: document.querySelector('canvas') !== null,

      // WebGL: implies GPU involvement (check for existing WebGL contexts).
      hasWebGL: Array.from(document.querySelectorAll('canvas')).some((c) => {
        try {
          return !!(c.getContext('webgl') || c.getContext('webgl2'));
        } catch (_) {
          return false;
        }
      }),
    };
  }

  function sendMetrics() {
    const metrics = collectMetrics();
    chrome.runtime.sendMessage({ type: 'PAGE_METRICS', metrics });
  }

  // Send immediately on load, then every 5 seconds.
  sendMetrics();
  setInterval(sendMetrics, 5000);
})();
