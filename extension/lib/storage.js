// lib/storage.js
// Role: read and write watt history in chrome.storage.local.
//
// Storage format:
//   Key: 'wattsHistory'
//   Value: Array of { ts: number, watts: number }
//     ts    — Unix timestamp in milliseconds (Date.now())
//     watts — estimated watt value at that moment (float, 2 dp)
//
// The array is kept in chronological order (oldest first).
// It is capped at MAX_ENTRIES to bound storage size.
// At 10-second sampling: 120 entries ≈ 20 minutes of data, ~3 KB.

const STORAGE_KEY = 'wattsHistory';
const MAX_ENTRIES = 120;

/**
 * Append a watt reading to history, trimming oldest entries if over the cap.
 * @param {number} watts
 * @param {string} [site] - platform name (e.g. 'openai', 'anthropic') or null
 * @returns {Promise<void>}
 */
async function appendWatts(watts, site = null) {
  if (watts > MAX_SANE_WATTS) return;
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const history = data[STORAGE_KEY] ?? [];

  history.push({ ts: Date.now(), watts, site });

  // Trim from the front to stay within the cap.
  if (history.length > MAX_ENTRIES) {
    history.splice(0, history.length - MAX_ENTRIES);
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: history });
}

// Readings above this are physically impossible for a browser tab and indicate
// a bug in the old energyToWatts calculation (session-duration spike).
const MAX_SANE_WATTS = 100;

/**
 * Read the full watt history array, filtering out any corrupted spike entries
 * left over from a previous buggy energyToWatts calculation.
 * @returns {Promise<Array<{ ts: number, watts: number }>>}
 */
async function readHistory() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const history = data[STORAGE_KEY] ?? [];
  return history.filter(e => e.watts <= MAX_SANE_WATTS);
}

/**
 * Clear all stored history.
 * @returns {Promise<void>}
 */
async function clearHistory() {
  await chrome.storage.local.remove(STORAGE_KEY);
}
