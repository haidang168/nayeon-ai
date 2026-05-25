import { groq, groqSafe } from './groq';

/**
 * Cache for lemmatized words to avoid repeated API calls.
 * Key = lowercase input, Value = lemmatized form.
 */
const lemmaCache = new Map<string, string>();

/**
 * Lemmatize a French word/phrase to its base dictionary form using AI.
 * 
 * Examples:
 *   "les" → "le"
 *   "mangeons" → "manger"
 *   "grandes" → "grand"
 *   "il a mauvaise mine" → "avoir mauvaise mine"
 *   "fait attention" → "faire attention"
 *   "belles" → "beau"
 *   "allés" → "aller"
 * 
 * Returns the original text if lemmatization fails.
 */
export async function lemmatizeFrench(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  
  // Check cache first
  const cacheKey = trimmed.toLowerCase();
  if (lemmaCache.has(cacheKey)) {
    return lemmaCache.get(cacheKey)!;
  }

  try {
    const result = await groqSafe(() =>
      groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are a French linguistics expert. Given a French word or phrase, return its BASE/DICTIONARY form (lemma).

Rules:
- Verbs → infinitive (mange → manger, a → avoir, fait → faire, allés → aller, mangeons → manger)
- Nouns → singular form (chats → chat, maisons → maison)
- Adjectives → masculine singular (grandes → grand, belles → beau, mauvaise → mauvais)
- Articles → base form (les → le, des → de, aux → à)
- Multi-word expressions: convert conjugated verbs back to infinitive but keep the rest (e.g., "a mauvaise mine" → "avoir mauvaise mine", "fait attention" → "faire attention", "va bien" → "aller bien")
- If it's already in base form, return it unchanged
- If it's a proper noun or you're unsure, return it unchanged

Return ONLY the lemmatized text, nothing else. No quotes, no explanation.`
          },
          { role: 'user', content: trimmed }
        ],
        temperature: 0,
        max_tokens: 100,
      })
    );

    const lemma = result.choices[0]?.message?.content?.trim();
    if (lemma && lemma.length > 0 && lemma.length < trimmed.length * 3) {
      // Sanity check: result shouldn't be wildly different in length
      lemmaCache.set(cacheKey, lemma);
      return lemma;
    }
  } catch (e) {
    console.error('Lemmatization failed:', e);
  }

  // Fallback: return original
  lemmaCache.set(cacheKey, trimmed);
  return trimmed;
}

/**
 * Quick local normalization (no AI call).
 * Strips accents, lowercases, basic plural/feminine removal.
 * Use this for COMPARISON, not for saving.
 */
export function normalizeFrenchLocal(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:'"«»\-–—()\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
