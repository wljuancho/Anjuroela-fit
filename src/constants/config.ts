export const AI_CONFIG = {
  GEMINI_MODEL: 'gemini-2.0-flash',
  get GEMINI_API_URL(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.GEMINI_MODEL}:generateContent`;
  },
  OPENAI_CHAT_MODEL: 'gpt-4o-mini',
  OPENAI_CHAT_URL: 'https://api.openai.com/v1/chat/completions',
  OPENAI_VISION_MODEL: 'gpt-4o-mini',
} as const;
