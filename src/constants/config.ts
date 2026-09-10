export const AI_CONFIG = {
  GEMINI_MODEL: 'gemini-2.0-flash',
  get GEMINI_API_URL(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.GEMINI_MODEL}:generateContent`;
  },
} as const;
