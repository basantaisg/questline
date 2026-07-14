/** The plan the AI returns, and the shape stored in `roadmaps.plan`. */
export interface RoadmapPlan {
  title: string;
  summary: string;
  days: { day: number; theme: string; tasks: string[] }[];
  suggestedHabits: { name: string; frequency: 'daily' | 'weekly'; xpReward: number }[];
}
