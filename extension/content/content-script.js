// content/content-script.js
// Role: collect page-level context (URL only) and make it available to the popup

// TODO: listen for a message from popup.js requesting page context
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'GET_PAGE_URL') {
    sendResponse({ pageUrl: window.location.href });
  }
});
