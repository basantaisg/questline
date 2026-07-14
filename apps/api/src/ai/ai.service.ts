import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { and, desc, eq } from 'drizzle-orm';
import { RoadmapPlan } from '../common/roadmap';
import { Db, DB } from '../db/db.module';
import { aiUsageLogs, roadmaps } from '../db/schema';

/** How many past roadmaps a user can page through in the planner. */
const HISTORY_LIMIT = 20;

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
  async generateRoadmap(userId: string, goal: string, tier: string) {
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
    let plan: RoadmapPlan;
    try {
      plan = JSON.parse(text) as RoadmapPlan;
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

    const [saved] = await this.db
      .insert(roadmaps)
      .values({ userId, goal, plan })
      .returning();

    return {
      id: saved.id,
      goal: saved.goal,
      createdAt: saved.createdAt,
      plan: saved.plan,
    };
  }

  /** Newest first, so the planner can restore the last plan on load. */
  async listRoadmaps(userId: string) {
    return this.db
      .select({
        id: roadmaps.id,
        goal: roadmaps.goal,
        createdAt: roadmaps.createdAt,
        plan: roadmaps.plan,
      })
      .from(roadmaps)
      .where(eq(roadmaps.userId, userId))
      .orderBy(desc(roadmaps.createdAt))
      .limit(HISTORY_LIMIT);
  }

  async deleteRoadmap(userId: string, id: string) {
    const [deleted] = await this.db
      .delete(roadmaps)
      .where(and(eq(roadmaps.id, id), eq(roadmaps.userId, userId)))
      .returning({ id: roadmaps.id });
    if (!deleted) throw new NotFoundException('Roadmap not found');
  }
}
