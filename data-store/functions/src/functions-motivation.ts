import { GoogleGenerativeAI } from '@google/generative-ai';
import { normalizeReminderLocale } from '@pu-stats/models';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './firebase-app';
import {
  buildTieredPrompt,
  extractTieredQuotes,
  flattenTiers,
  getFallbackTieredQuotes,
  QUOTE_CACHE_HOURS,
  type TieredQuotes,
} from './motivation';

interface CachedTiered {
  uid: string;
  lang: string;
  generatedAt: string;
  tiers: TieredQuotes;
  /** Flat array kept for legacy clients that only read `quotes`. */
  quotes: string[];
  totalToday: number;
  dailyGoal: number;
}

export const generateMotivationQuotes = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }

    const uid = request.auth.uid;
    const language = normalizeReminderLocale(request.data?.language);
    const totalToday = Number(request.data?.totalToday ?? 0);
    const dailyGoal = Number(request.data?.dailyGoal ?? 100);
    const rawName = String(request.data?.displayName || '').trim();
    const displayName =
      rawName
        .replace(/[^a-zA-Z0-9À-ɏЀ-ӿ .,'!?-]/g, '')
        .slice(0, 50)
        .trim() || 'Champ';

    const cacheRef = db
      .collection('motivationQuotes')
      .doc(`${uid}__${language}`);
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      const cached = (cacheSnap.data() ?? {}) as {
        generatedAt?: string;
        tiers?: TieredQuotes;
        quotes?: ReadonlyArray<unknown>;
      };
      const generatedAt = cached.generatedAt
        ? new Date(cached.generatedAt)
        : null;
      if (generatedAt) {
        const ageHours =
          (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
        if (ageHours < QUOTE_CACHE_HOURS) {
          // Prefer the tiered shape; fall back to legacy flat `quotes`
          // so older cache docs keep working until the next refresh.
          if (cached.tiers) {
            return {
              quotes: flattenTiers(cached.tiers),
              tiers: cached.tiers,
            };
          }
          const flat = (cached.quotes ?? []).map((q) =>
            typeof q === 'string'
              ? q
              : typeof q === 'object' && q !== null && 'text' in q
                ? String((q as { text?: unknown }).text ?? '')
                : String(q ?? '')
          );
          return { quotes: flat };
        }
      }
    }

    let tiers: TieredQuotes = getFallbackTieredQuotes(language);

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-lite',
      });

      const prompt = buildTieredPrompt(
        language,
        totalToday,
        dailyGoal,
        displayName
      );
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const parsed = extractTieredQuotes(text);
      if (parsed) tiers = parsed;
    } catch (err) {
      logger.warn(
        'generateMotivationQuotes: Gemini call failed, using fallback',
        { err }
      );
    }

    const flat = flattenTiers(tiers);
    const generatedAt = new Date().toISOString();
    const docPayload: CachedTiered = {
      uid,
      lang: language,
      tiers,
      quotes: flat,
      generatedAt,
      totalToday,
      dailyGoal,
    };
    await cacheRef.set(docPayload);

    return { quotes: flat, tiers };
  }
);
