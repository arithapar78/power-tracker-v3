// popup/popup.js
// Role: handle view switching and wire UI to lib modules

// ── View switching ─────────────────────────────────────────────────────────

const viewDashboard = document.getElementById('view-dashboard');
const viewOptimizer = document.getElementById('view-optimizer');

document.getElementById('open-optimizer-btn').addEventListener('click', () => {
  viewDashboard.classList.add('hidden');
  viewOptimizer.classList.remove('hidden');
});

document.getElementById('back-btn').addEventListener('click', () => {
  viewOptimizer.classList.add('hidden');
  viewDashboard.classList.remove('hidden');
});

// ── Prompt optimizer ───────────────────────────────────────────────────────

document.getElementById('optimize-btn').addEventListener('click', async () => {
  const original = document.getElementById('original-prompt').value.trim();
  if (!original) return;

  // TODO: call real optimizePrompt() from prompt-generator.js
  const optimized = optimizePrompt(original);

  const resultCard = document.getElementById('result-card');
  document.getElementById('optimized-prompt').textContent = optimized;
  resultCard.classList.remove('hidden');

  // TODO: call saveEvent() from api.js
  // const result = await saveEvent({ ... });

  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Placeholder: backend not connected yet.';
  statusEl.classList.remove('hidden');
});
