// background/service-worker.js
// Role: receive metrics from content scripts, store latest per tab, persist watt history.

importScripts('../lib/energy-estimator.js', '../lib/storage.js');

// tabMetrics maps tabId -> latest metrics object (in-memory only).
const tabMetrics = {};

chrome.runtime.onInstalled.addListener(() => {
  // Nothing to initialise yet.
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Content script pushes page metrics.
  if (message.type === 'PAGE_METRICS' && sender.tab?.id != null) {
    tabMetrics[sender.tab.id] = message.metrics;

    // Compute watts and persist to history so the options page has data.
    const watts = estimateWatts(message.metrics);
    appendWatts(watts); // fire-and-forget; storage.js handles the cap

    sendResponse({ ok: true });
  }

  // Popup requests the latest metrics for a given tab.
  if (message.type === 'GET_METRICS') {
    const metrics = tabMetrics[message.tabId] ?? null;
    sendResponse({ metrics });
  }

  // Options page requests full history.
  if (message.type === 'GET_HISTORY') {
    readHistory().then((history) => sendResponse({ history }));
    return true; // keep message channel open for async response
  }

  // Options page requests history to be cleared.
  if (message.type === 'CLEAR_HISTORY') {
    clearHistory().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Clean up in-memory metrics when a tab is closed.
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabMetrics[tabId];
});
