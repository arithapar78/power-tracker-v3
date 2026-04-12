// background/service-worker.js
// Role: receive metrics from content scripts and store the latest per tab.

// tabMetrics maps tabId -> latest metrics object.
const tabMetrics = {};

chrome.runtime.onInstalled.addListener(() => {
  // Nothing to initialise yet.
});

// Receive PAGE_METRICS from content scripts.
// sender.tab.id identifies which tab the metrics came from.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PAGE_METRICS' && sender.tab?.id != null) {
    tabMetrics[sender.tab.id] = message.metrics;
    sendResponse({ ok: true });
  }

  // Popup requests the latest metrics for a given tab.
  if (message.type === 'GET_METRICS') {
    const metrics = tabMetrics[message.tabId] ?? null;
    sendResponse({ metrics });
  }
});

// Clean up stored metrics when a tab is closed.
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabMetrics[tabId];
});
