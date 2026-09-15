export const AI_CONFIG = {
  GEMINI_MODEL: 'gemini-3.6-flash',
  get GEMINI_API_URL(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.GEMINI_MODEL}:generateContent`;
  },
  OPENAI_CHAT_MODEL: 'gpt-4o-mini',
  OPENAI_CHAT_URL: 'https://api.openai.com/v1/chat/completions',
  OPENAI_VISION_MODEL: 'gpt-4o-mini',
} as const;

export const APP_UPDATE_CONFIG = {
  // Endpoint que responde con un JSON: { "latestVersion": "1.1.0", "downloadUrl": "https://.../app.apk", "notes": "..." }
  // TODO: reemplaza por tu URL real (GitHub Releases / backend).
  MANIFEST_URL: 'https://example.com/anjuroela-fit/latest.json',
  FETCH_TIMEOUT_MS: 10000,
} as const;
