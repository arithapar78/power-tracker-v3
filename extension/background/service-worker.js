// background/service-worker.js
// Role: background coordination (minimal)
// TODO: listen for messages from content script or popup if needed

chrome.runtime.onInstalled.addListener(() => {
  // TODO: initialize extension state on install
});
