// lib/ai-energy-database.js
// AI model energy data and site detection patterns.
// Used by the service worker to identify AI sites and estimate backend energy.

// ── Model energy data ──────────────────────────────────────────────────────
// energyPerQuery: Wh consumed by one backend inference request (conservative estimates)

const AI_MODEL_DATABASE = {
  'gpt-4o': {
    name: 'GPT-4o',
    energyPerQuery: 0.0042,
    sites: ['chat.openai.com', 'chatgpt.com', 'openai.com', 'platform.openai.com'],
    detectionPatterns: [/gpt-?4o/i, /chatgpt/i],
    category: 'large-multimodal',
  },
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    energyPerQuery: 0.0021,
    sites: ['chat.openai.com', 'chatgpt.com'],
    detectionPatterns: [/gpt-?3\.?5/i, /turbo/i],
    category: 'medium-language',
  },
  'claude-3-sonnet': {
    name: 'Claude 3 Sonnet',
    energyPerQuery: 0.0051,
    sites: ['claude.ai', 'anthropic.com'],
    detectionPatterns: [/claude/i, /anthropic/i],
    category: 'large-language',
  },
  'claude-3-haiku': {
    name: 'Claude 3 Haiku',
    energyPerQuery: 0.0015,
    sites: ['claude.ai'],
    detectionPatterns: [/haiku/i],
    category: 'small-language',
  },
  'gemini-pro': {
    name: 'Gemini Pro',
    energyPerQuery: 0.0033,
    sites: ['gemini.google.com', 'bard.google.com', 'ai.google.dev', 'makersuite.google.com'],
    detectionPatterns: [/gemini/i, /bard/i, /ai\.google/i],
    category: 'large-multimodal',
  },
  'palm-2': {
    name: 'PaLM 2',
    energyPerQuery: 0.0039,
    sites: ['makersuite.google.com', 'ai.google.dev'],
    detectionPatterns: [/palm.*2/i, /makersuite/i],
    category: 'large-language',
  },
  'stability-ai': {
    name: 'Stable Diffusion',
    energyPerQuery: 0.0067,
    sites: ['stability.ai', 'dreamstudio.ai'],
    detectionPatterns: [/stable.*diffusion/i, /stability.*ai/i, /dreamstudio/i],
    category: 'image-generation',
  },
  'mistral-7b': {
    name: 'Mistral 7B',
    energyPerQuery: 0.0018,
    sites: ['mistral.ai'],
    detectionPatterns: [/mistral.*7b/i, /mistral\.ai/i],
    category: 'small-language',
  },
  'cohere-command': {
    name: 'Cohere Command',
    energyPerQuery: 0.0024,
    sites: ['cohere.com', 'cohere.ai'],
    detectionPatterns: [/cohere/i, /command/i],
    category: 'medium-language',
  },
  'llama-2-70b': {
    name: 'Llama 2 70B',
    energyPerQuery: 0.0048,
    sites: ['huggingface.co', 'together.ai', 'replicate.com'],
    detectionPatterns: [/llama.*2.*70b/i, /meta.*llama/i],
    category: 'large-language',
  },
};

// ── Platform site patterns ─────────────────────────────────────────────────
// Ordered from most-specific to least. Detection tries pathPatterns first,
// then falls back to defaultModel for the matched platform.

const AI_SITE_PATTERNS = {
  openai: {
    domains: ['chat.openai.com', 'chatgpt.com', 'openai.com', 'platform.openai.com'],
    defaultModel: 'gpt-4o',
    pathPatterns: [
      { pattern: /gpt-3\.5/i, model: 'gpt-3.5-turbo' },
      { pattern: /gpt-4/i,    model: 'gpt-4o' },
    ],
  },
  anthropic: {
    domains: ['claude.ai', 'anthropic.com'],
    defaultModel: 'claude-3-sonnet',
    pathPatterns: [
      { pattern: /haiku/i,  model: 'claude-3-haiku' },
      { pattern: /sonnet/i, model: 'claude-3-sonnet' },
    ],
  },
  google: {
    domains: ['gemini.google.com', 'bard.google.com', 'ai.google.dev', 'makersuite.google.com'],
    defaultModel: 'gemini-pro',
    pathPatterns: [
      { pattern: /palm/i,   model: 'palm-2' },
      { pattern: /gemini/i, model: 'gemini-pro' },
      { pattern: /bard/i,   model: 'gemini-pro' },
    ],
  },
  stability: {
    domains: ['stability.ai', 'dreamstudio.ai'],
    defaultModel: 'stability-ai',
    pathPatterns: [],
  },
  mistral: {
    domains: ['mistral.ai'],
    defaultModel: 'mistral-7b',
    pathPatterns: [],
  },
  cohere: {
    domains: ['cohere.com', 'cohere.ai'],
    defaultModel: 'cohere-command',
    pathPatterns: [],
  },
  huggingface: {
    domains: ['huggingface.co'],
    defaultModel: 'llama-2-70b',
    pathPatterns: [
      { pattern: /stable.*diffusion/i, model: 'stability-ai' },
      { pattern: /mistral.*7b/i,       model: 'mistral-7b' },
      { pattern: /llama.*2.*70b/i,     model: 'llama-2-70b' },
    ],
  },
  together: {
    domains: ['together.ai'],
    defaultModel: 'llama-2-70b',
    pathPatterns: [],
  },
  replicate: {
    domains: ['replicate.com'],
    defaultModel: 'llama-2-70b',
    pathPatterns: [],
  },
};

// ── AIEnergyManager ────────────────────────────────────────────────────────

class AIEnergyManager {
  constructor() {
    // tabId -> { modelKey, queries, energy, timestamp }
    this.sessionUsage = new Map();
  }

  /**
   * Detect which AI model/platform the given URL belongs to.
   * Detection order:
   *   1. Match hostname against AI_SITE_PATTERNS domains
   *   2. Within the matched platform, try pathPatterns against path + title
   *   3. Fall back to the platform's defaultModel
   *   4. If no platform matched, return null
   *
   * @param {string} url
   * @param {string} [title]
   * @returns {{ platform: string, modelKey: string, model: object, confidence: number }|null}
   */
  detectAIModel(url, title = '') {
    if (!url) return null;

    let urlObj;
    try { urlObj = new URL(url); } catch (_) { return null; }

    const domain = urlObj.hostname.toLowerCase();
    const path   = urlObj.pathname.toLowerCase();

    // Step 1 — find matching platform by hostname
    for (const [platform, config] of Object.entries(AI_SITE_PATTERNS)) {
      const matched = config.domains.some(
        d => domain === d || domain.endsWith('.' + d)
      );
      if (!matched) continue;

      // Step 2 — try path patterns for a more specific model
      for (const { pattern, model: modelKey } of config.pathPatterns) {
        if (pattern.test(path) || pattern.test(title)) {
          return { platform, modelKey, model: AI_MODEL_DATABASE[modelKey], confidence: 0.9 };
        }
      }

      // Step 3 — use default model for the platform
      const modelKey = config.defaultModel;
      return { platform, modelKey, model: AI_MODEL_DATABASE[modelKey], confidence: 0.7 };
    }

    // Step 4 — no match
    return null;
  }

  /**
   * Estimate how many queries have been made based on time spent on the page.
   * Conservative: one query per 3 minutes of active tab time, capped at 20.
   *
   * @param {number} durationMs - Time the tab has been active (ms)
   * @returns {number}
   */
  estimateQueryCount(durationMs) {
    // Minimum 1 query: once an AI site is detected the user has already
    // made at least one request. After that, one more query per 3 minutes.
    const queries = 1 + Math.floor(durationMs / (3 * 60 * 1000));
    return Math.min(queries, 20);
  }

  /**
   * Compute backend AI energy (Wh) for a tab given its active duration.
   *
   * @param {string} modelKey
   * @param {number} durationMs
   * @returns {{ queries: number, energyWh: number }}
   */
  computeEnergy(modelKey, durationMs) {
    const model = AI_MODEL_DATABASE[modelKey];
    if (!model) return { queries: 0, energyWh: 0 };
    const queries  = this.estimateQueryCount(durationMs);
    const energyWh = queries * model.energyPerQuery;
    return { queries, energyWh };
  }

  /**
   * Convert Wh over a duration to an average watt value.
   * This lets backend AI energy be added directly to frontend watts.
   *
   * @param {number} energyWh
   * @param {number} durationMs
   * @returns {number} watts
   */
  energyToWatts(energyWh, durationMs) {
    if (durationMs <= 0) return 0;
    const durationHrs = durationMs / 3_600_000;
    return Math.max(0, energyWh / durationHrs);
  }

  /**
   * Record/update usage for a tab.
   * @param {number} tabId
   * @param {{ modelKey: string, queries: number, energyWh: number }} data
   */
  updateTabUsage(tabId, data) {
    this.sessionUsage.set(tabId, { ...data, timestamp: Date.now() });
  }

  /** Remove a tab's usage record (call when tab closes). */
  removeTab(tabId) {
    this.sessionUsage.delete(tabId);
  }
}
