// background/service-worker.js
// Role: receive metrics from content scripts, store latest per tab, persist watt history.
// Also detects AI sites and folds backend AI energy into the total watt reading.

importScripts(
  '../lib/energy-estimator.js',
  '../lib/storage.js',
  '../lib/ai-energy-database.js',
);

// ── State ──────────────────────────────────────────────────────────────────

// tabMetrics maps tabId -> latest raw metrics from content script (in-memory)
const tabMetrics = {};

// tabAI maps tabId -> { detection result, watts, modelKey } (in-memory)
const tabAI = {};

// tabTotalWatts maps tabId -> last computed totalWatts (frontend + backend AI)
const tabTotalWatts = {};

// Track when each tab was first seen so we can estimate session duration
const tabStartTime = {};

const aiManager = new AIEnergyManager();

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Look up the active tab's URL and title, run AI detection, and return AI
 * watts for that tab. Returns 0 if the site is not a known AI site.
 *
 * @param {number} tabId
 * @returns {Promise<{ aiWatts: number, modelKey: string|null, modelName: string|null }>}
 */
async function resolveAIWatts(tabId) {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (_) {
    return { aiWatts: 0, modelKey: null, modelName: null };
  }

  // Run detection using URL + page title (no DOM access needed)
  const detection = aiManager.detectAIModel(tab.url, tab.title);
  if (!detection) {
    console.log('[PowerTracker] No AI site detected for tab', tabId, tab.url);
    return { aiWatts: 0, modelKey: null, modelName: null };
  }

  console.log('[PowerTracker] AI detected:', detection.platform, detection.modelKey);

  // Duration since the tab was first seen in this session
  const startTime  = tabStartTime[tabId] || Date.now();
  const durationMs = Date.now() - startTime;

  // Compute energy; convert a single query's cost to watts (not the session total,
  // which would spike on first tick and decay to near-zero after a long session).
  const { queries, energyWh } = aiManager.computeEnergy(detection.modelKey, durationMs);
  const perQueryWh = energyWh / Math.max(1, queries);
  const aiWatts = aiManager.energyToWatts(perQueryWh, durationMs);

  console.log('[PowerTracker] queries:', queries, '| energyWh:', energyWh.toFixed(6), '| aiWatts:', aiWatts.toFixed(4));

  aiManager.updateTabUsage(tabId, {
    modelKey: detection.modelKey,
    queries,
    energyWh,
  });

  return {
    aiWatts,
    modelKey:  detection.modelKey,
    modelName: detection.model?.name ?? null,
    platform:  detection.platform,
  };
}

// ── Message handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Content script pushes page metrics.
  if (message.type === 'PAGE_METRICS' && sender.tab?.id != null) {
    const tabId = sender.tab.id;

    // Record first-seen time for duration estimation
    if (!tabStartTime[tabId]) tabStartTime[tabId] = Date.now();

    tabMetrics[tabId] = message.metrics;

    // Compute frontend watts, then fold in AI backend watts asynchronously.
    const frontendWatts = estimateWatts(message.metrics);

    resolveAIWatts(tabId).then(({ aiWatts, modelKey, modelName, platform }) => {
      const totalWatts = frontendWatts + aiWatts;

      console.log('[PowerTracker] frontendWatts:', frontendWatts.toFixed(4), '| aiWatts:', aiWatts.toFixed(4), '| totalWatts:', totalWatts.toFixed(4));

      // Cache AI info and total for GET_METRICS requests
      tabAI[tabId] = { aiWatts, modelKey, modelName, platform };
      tabTotalWatts[tabId] = totalWatts;

      // Persist total (frontend + backend) to history, tagged with platform
      appendWatts(totalWatts, platform ?? null);
    });

    sendResponse({ ok: true });
  }

  // Popup requests the latest metrics for a given tab.
  if (message.type === 'GET_METRICS') {
    const metrics     = tabMetrics[message.tabId] ?? null;
    const ai          = tabAI[message.tabId] ?? null;
    const totalWatts  = tabTotalWatts[message.tabId] ?? null;
    sendResponse({ metrics, ai, totalWatts });
  }

  // Options page requests full history.
  if (message.type === 'GET_HISTORY') {
    readHistory().then((history) => sendResponse({ history }));
    return true; // keep channel open for async response
  }

  // Options page requests history to be cleared.
  if (message.type === 'CLEAR_HISTORY') {
    clearHistory().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// ── Tab lifecycle ──────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabMetrics[tabId];
  delete tabAI[tabId];
  delete tabTotalWatts[tabId];
  delete tabStartTime[tabId];
  aiManager.removeTab(tabId);
});
