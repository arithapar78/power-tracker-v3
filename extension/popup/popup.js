// popup/popup.js
// Role: handle view switching and display live energy estimate from active tab.

// ── View switching ─────────────────────────────────────────────────────────

const viewDashboard = document.getElementById('view-dashboard');
const viewOptimizer = document.getElementById('view-optimizer');

document.getElementById('open-optimizer-btn').addEventListener('click', () => {
  viewDashboard.classList.add('hidden');
  viewOptimizer.classList.remove('hidden');
});

document.getElementById('open-history-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('back-btn').addEventListener('click', () => {
  viewOptimizer.classList.add('hidden');
  viewDashboard.classList.remove('hidden');
});

// ── Energy dashboard ───────────────────────────────────────────────────────

async function refreshDashboard() {
  // Get the active tab in the current window.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Ask the service worker for the latest metrics + AI info for this tab.
  const response = await chrome.runtime.sendMessage({
    type: 'GET_METRICS',
    tabId: tab.id,
  });

  const metrics    = response?.metrics;
  const ai         = response?.ai ?? null;
  const swTotal    = response?.totalWatts ?? null;

  // If no metrics yet (page hasn't sent any), show a loading state.
  if (!metrics) {
    setEnergyDisplay(null, null);
    return;
  }

  // Prefer the service worker's pre-computed total (frontendWatts + aiWatts).
  // Fall back to local estimation only if the SW hasn't cached a total yet
  // (e.g. the very first tick before resolveAIWatts has resolved).
  let totalWatts;
  if (swTotal !== null) {
    totalWatts = swTotal;
  } else {
    const frontendWatts = estimateWatts(metrics);
    const aiWatts = ai?.aiWatts ?? 0;
    totalWatts = frontendWatts + aiWatts;
  }

  console.log('[PowerTracker popup] totalWatts:', totalWatts.toFixed(4), '| aiWatts:', (ai?.aiWatts ?? 0).toFixed(4));

  setEnergyDisplay(totalWatts, ai);
}

function setEnergyDisplay(watts, ai) {
  const energyEl  = document.querySelector('.energy-value');
  const aiInfoEl  = document.getElementById('ai-info');
  const aiModelEl = document.getElementById('ai-model-label');
  const aiWattsEl = document.getElementById('ai-watts-label');

  if (watts === null) {
    energyEl.innerHTML = '… <span class="energy-unit">W</span>';
    aiInfoEl.classList.add('hidden');
    return;
  }

  energyEl.innerHTML = `${watts.toFixed(2)} <span class="energy-unit">W</span>`;

  // Show AI model badge if an AI site was detected
  if (ai?.modelName) {
    aiModelEl.textContent = ai.modelName;
    aiWattsEl.textContent = `+${(ai.aiWatts ?? 0).toFixed(3)} W backend`;
    aiInfoEl.classList.remove('hidden');
  } else {
    aiInfoEl.classList.add('hidden');
  }

  // Update comparison values using total watts.
  document.querySelector('.bulbs-value').textContent =
    (watts / 60).toFixed(3);

  // gallons/hr = (watts / 1000) * 0.13
  document.querySelector('.water-value').textContent =
    ((watts / 1000) * 0.13).toFixed(4);

  // g/hr = (watts / 1000) * 386
  document.querySelector('.co2-value').textContent =
    ((watts / 1000) * 386).toFixed(3);
}

// Refresh immediately when popup opens, then every 5 s.
refreshDashboard();
setInterval(refreshDashboard, 5000);

// ── Prompt optimizer ───────────────────────────────────────────────────────

// Live token counter while the user types
const originalPromptEl = document.getElementById('original-prompt');
const originalTokensEl = document.getElementById('original-tokens');

originalPromptEl.addEventListener('input', () => {
  const tokens = countTokens(originalPromptEl.value);
  originalTokensEl.textContent = tokens;
});

document.getElementById('optimize-btn').addEventListener('click', () => {
  const original = originalPromptEl.value.trim();
  if (!original) return;

  const optimized = optimizePrompt(original);
  const stats = getTokenStats(original, optimized);

  document.getElementById('optimized-prompt').textContent = optimized;
  document.getElementById('stat-original').textContent = stats.original;
  document.getElementById('stat-optimized').textContent = stats.optimized;
  document.getElementById('stat-saved').textContent = stats.saved;

  document.getElementById('result-card').classList.remove('hidden');
});
