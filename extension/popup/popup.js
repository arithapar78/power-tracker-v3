// popup/popup.js
// Role: handle user interactions and wire UI to lib modules

// TODO: get page URL from content script
// TODO: call optimizePrompt() on input
// TODO: display optimized prompt
// TODO: call saveEvent() and show status

document.getElementById('optimize-btn').addEventListener('click', async () => {
  const original = document.getElementById('original-prompt').value.trim();
  if (!original) return;

  // Optimize
  const optimized = optimizePrompt(original);
  const outputEl = document.getElementById('optimized-prompt');
  outputEl.textContent = optimized;
  outputEl.classList.remove('hidden');

  // TODO: get pageUrl from content script via chrome.tabs.sendMessage
  const pageUrl = null;

  // Save event
  const event = {
    originalPrompt: original,
    optimizedPrompt: optimized,
    timestamp: new Date().toISOString(),
    pageUrl,
  };

  const result = await saveEvent(event);

  const statusEl = document.getElementById('status');
  statusEl.textContent = result.success ? 'Saved.' : 'Error saving event.';
  statusEl.classList.remove('hidden');
});
