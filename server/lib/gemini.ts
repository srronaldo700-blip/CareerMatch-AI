import { GoogleGenAI } from '@google/genai';

export const GEMINI_TEXT_MODEL = 'gemini-4-hydrogen';
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-2';

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 450
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const isTransient =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('fetch failed');
      if (!isTransient || attempt === maxAttempts) {
        throw error;
      }
      const jitter = Math.floor(Math.random() * 150);
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt + jitter));
    }
  }
  throw lastError;
}

export async function embedText(text: string): Promise<number[]> {
  const cleaned = text.trim().slice(0, 6000);
  if (!cleaned) {
    return [];
  }
  const ai = getGeminiClient();
  const result = await withRetry(() =>
    ai.models.embedContent({
      model: GEMINI_EMBEDDING_MODEL,
      contents: [cleaned],
    })
  );
  const values = result.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error('Embedding model returned an empty vector.');
  }
  return values;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}
