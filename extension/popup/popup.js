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

  // Ask the service worker for the latest metrics for this tab.
  const response = await chrome.runtime.sendMessage({
    type: 'GET_METRICS',
    tabId: tab.id,
  });

  const metrics = response?.metrics;

  // If no metrics yet (page hasn't sent any), show a loading state.
  if (!metrics) {
    setEnergyDisplay(null);
    return;
  }

  const watts = estimateWatts(metrics);
  setEnergyDisplay(watts);
}

function setEnergyDisplay(watts) {
  const energyEl = document.querySelector('.energy-value');

  if (watts === null) {
    energyEl.innerHTML = '… <span class="energy-unit">W</span>';
    return;
  }

  energyEl.innerHTML = `${watts.toFixed(2)} <span class="energy-unit">W</span>`;

  // Update comparison values.
  // Light bulbs: a standard 60 W bulb; watts here is per-tab estimate scaled to per hour.
  document.querySelector('.bulbs-value').textContent =
    (watts / 60).toFixed(3);

  // Water: ~0.5 L (0.13 gal) to produce 1 kWh; scale to per-hour at current watts.
  // gallons/hr = (watts / 1000) * 0.13
  document.querySelector('.water-value').textContent =
    ((watts / 1000) * 0.13).toFixed(4);

  // CO₂: average US grid emits ~386 g CO₂ per kWh.
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
