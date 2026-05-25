import Groq from "groq-sdk";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  dangerouslyAllowBrowser: true // Bắt buộc khi chạy trên trình duyệt client-side
});

/**
 * Wrapper for Groq calls to automatically retry on rate limits or server errors.
 * Default to 2 retries (3 attempts total) with exponential backoff.
 */
export async function groqSafe<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (i === retries) throw e; // Max retries reached
      const errMsg = e?.message?.toString() || e?.toString() || '';
      // Check if it's a transient error (429 Rate Limit, 503 Server Error, timeout)
      if (/429|503|timeout|fetch failed/i.test(errMsg)) {
        console.warn(`Groq API error, retrying (${i + 1}/${retries})...`, errMsg);
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Backoff: 1s, 2s
      } else {
        throw e; // Unrecoverable error (e.g. 400 Bad Request, 401 Auth)
      }
    }
  }
  throw new Error('Unreachable');
}
