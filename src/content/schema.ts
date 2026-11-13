import { z } from "zod";

const weekRange = z.tuple([z.number().int().min(1).max(52), z.number().int().min(1).max(52)]);

export const weekdaySchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

export const daySchema = z.object({
  index: z.number().int(),
  weekday: weekdaySchema,
  reading: z.string().min(1),
  chapters: z.number().int().positive(),
});

export const weekSchema = z.object({
  week: z.number().int(),
  phase: z.number().int(),
  title: z.string().min(1),
  deepDive: z.string().min(1),
  memoryVerse: z.object({
    ref: z.string().min(1, "Every week needs a memory verse reference"),
    textKJV: z.string().min(1, "Every week needs a memory verse text"),
  }),
  days: z.array(daySchema),
});

export const phaseSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  weeks: weekRange,
});

export const eraSchema = z.object({
  title: z.string().min(1),
  when: z.string().min(1),
  empire: z.string().min(1),
  weeks: weekRange,
  keyPeople: z.string().min(1),
  summary: z.string().min(1),
});

export const peopleSchema = z.object({ name: z.string().min(1), desc: z.string().min(1) });

export const prophetSchema = z.object({
  name: z.string().min(1),
  when: z.string().min(1),
  audience: z.string().min(1),
  message: z.string().min(1),
});

export const WEEK_COUNT = 52;
export const DAYS_PER_WEEK = 6;
export const DAY_COUNT = WEEK_COUNT * DAYS_PER_WEEK;
export const CHAPTER_COUNT = 1189;

export const seedSchema = z
  .object({
    meta: z.object({ title: z.string(), readingDays: z.number(), totalChapters: z.number() }).loose(),
    phases: z.array(phaseSchema).min(1),
    weeks: z.array(weekSchema),
    eras: z.array(eraSchema),
    peoples: z.array(peopleSchema),
    prophets: z.array(prophetSchema),
  })
  .superRefine((seed, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });

    if (seed.weeks.length !== WEEK_COUNT) fail(`Expected ${WEEK_COUNT} weeks, found ${seed.weeks.length}`);

    seed.weeks.forEach((week, i) => {
      if (week.week !== i + 1) fail(`Expected week numbers 1–${WEEK_COUNT} in order; position ${i + 1} holds week ${week.week}`);
      if (week.days.length !== DAYS_PER_WEEK) {
        fail(`Week ${week.week} must have exactly ${DAYS_PER_WEEK} days, found ${week.days.length}`);
      }
      const phase = seed.phases.find((p) => week.week >= p.weeks[0] && week.week <= p.weeks[1]);
      if (!phase || phase.id !== week.phase) {
        fail(`Week ${week.week} says phase ${week.phase}, but the phase ranges put it in ${phase ? `phase ${phase.id}` : "no phase"}`);
      }
    });

    const days = seed.weeks.flatMap((week) => week.days);
    if (days.length !== DAY_COUNT) fail(`Expected ${DAY_COUNT} reading days, found ${days.length}`);
    const misplaced = days.findIndex((day, i) => day.index !== i);
    if (misplaced !== -1) fail(`Day indexes must be contiguous 0–${DAY_COUNT - 1}; position ${misplaced} holds ${days[misplaced].index}`);

    const chapters = days.reduce((sum, day) => sum + day.chapters, 0);
    if (chapters !== CHAPTER_COUNT) fail(`Reading days must cover 1,189 chapters, found ${chapters.toLocaleString("en-US")}`);
  });

export type Seed = z.infer<typeof seedSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type Week = z.infer<typeof weekSchema>;
export type Day = z.infer<typeof daySchema>;
export type Era = z.infer<typeof eraSchema>;
export type People = z.infer<typeof peopleSchema>;
export type Prophet = z.infer<typeof prophetSchema>;

export function parseSeed(input: unknown): Seed {
  return seedSchema.parse(input);
}
