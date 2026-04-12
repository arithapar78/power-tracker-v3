// lib/api.js
// Role: send events to the backend

const API_BASE_URL = 'http://localhost:3000';

/**
 * Save a prompt event to the backend.
 * @param {{ originalPrompt: string, optimizedPrompt: string, timestamp: string, pageUrl?: string }} event
 * @returns {Promise<{ success: boolean }>}
 * TODO: add error handling for network failures
 */
async function saveEvent(event) {
  // Placeholder: returns success without hitting network
  console.log('[api] saveEvent (placeholder)', event);
  return { success: true };

  // Real implementation (uncomment when backend is ready):
  // const res = await fetch(`${API_BASE_URL}/events`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(event),
  // });
  // return res.json();
}
