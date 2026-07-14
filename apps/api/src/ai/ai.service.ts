import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { Db, DB } from '../db/db.module';
import { aiUsageLogs } from '../db/schema';

export interface Roadmap {
  title: string;
  summary: string;
  days: { day: number; theme: string; tasks: string[] }[];
  suggestedHabits: { name: string; frequency: 'daily' | 'weekly'; xpReward: number }[];
}

@Injectable()
export class AiService {
  private client: GoogleGenAI | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (apiKey) this.client = new GoogleGenAI({ apiKey });
  }

  private get model(): string {
    return this.config.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  }

  /**
   * Parses the user's goal into a personalized 7-day roadmap with daily
   * checklists. Elite tier requests are flagged for priority execution.
   */
  async generateRoadmap(userId: string, goal: string, tier: string): Promise<Roadmap> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI engine is not configured yet (missing GEMINI_API_KEY).',
      );
    }

    const prompt = `You are QuestLine's habit coach inside a gamified habit tracker.
The user's goal: "${goal}"

Return STRICT JSON (no markdown) with this exact shape:
{
  "title": "short punchy roadmap title",
  "summary": "2-sentence motivational overview",
  "days": [
    { "day": 1, "theme": "...", "tasks": ["task 1", "task 2", "task 3"] }
    ... exactly 7 days ...
  ],
  "suggestedHabits": [
    { "name": "...", "frequency": "daily" | "weekly", "xpReward": 10-30 }
    ... 2 to 4 habits ...
  ]
}
Tasks must be small, concrete and checkable. Keep every string under 120 characters.`;

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        // Elite subscribers get priority execution.
        ...(tier === 'elite' ? { temperature: 0.9 } : { temperature: 0.7 }),
      },
    });

    const text = response.text ?? '';
    let roadmap: Roadmap;
    try {
      roadmap = JSON.parse(text) as Roadmap;
    } catch {
      throw new ServiceUnavailableException('AI returned an unreadable plan — try again.');
    }

    // Meter usage only after a successful generation.
    await this.db.insert(aiUsageLogs).values({
      userId,
      feature: 'roadmap',
      model: this.model,
      promptChars: goal.length,
    });

    return roadmap;
  }
}
