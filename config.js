/**
 * config.js
 * --------------------------------------------------------
 * Central configuration for the AstroKundli backend.
 * --------------------------------------------------------
 */

module.exports = {
  // FreeAstroAPI — real ephemeris data (Vedic chart + Panchang)
  FREE_ASTRO_API_KEY: process.env.FREE_ASTRO_API_KEY || '',
  FREE_ASTRO_API_BASE: 'https://api.freeastroapi.com',

  // DivineAPI — Vedic calculations fallback/main data
  DIVINE_API_KEY: process.env.DIVINE_API_KEY || '',
  DIVINE_API_TOKEN: process.env.DIVINE_API_TOKEN || '',

  // Google Gemini API — AI Chat personality (AstroGuru)
  // Get your key at: https://aistudio.google.com/
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Server port
  PORT: 8000,

  // Coin economy settings
  KUNDLI_COST: 10,
  CHAT_COST: 1, // Chatting costs 1 coin per message
  AD_REWARD: 10,
  STARTING_COINS: 0,
};
