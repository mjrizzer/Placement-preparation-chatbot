import { z } from 'zod';
import { difficulties, languages, modes, roles } from './catalog';
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  college: z.string().trim().min(2).max(200),
  degree: z.string().trim().min(1).max(100),
  branch: z.string().trim().min(1).max(100),
  graduationYear: z.coerce.number().int().min(2000).max(2050),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  role: z.string().refine((v) => roles.includes(v), 'Select a supported role'),
  languages: z.array(z.enum(languages)).min(1).max(12),
  areas: z.array(z.string().trim().min(1).max(100)).max(20),
});
export const sessionSchema = z.object({
  mode: z.enum(modes),
  difficulty: z.enum(difficulties),
  language: z.enum(languages),
  company: z.string().trim().max(100).optional(),
  topic: z.string().trim().max(100).optional(),
  targetCount: z.number().int().min(3).max(20).default(10),
});
export const testCaseSchema = z.object({ input: z.string(), output: z.string() });
export const questionSchema = z.object({
  title: z.string(),
  question: z.string(),
  topic: z.string(),
  concept: z.string(),
  difficulty: z.enum(difficulties),
  kind: z.enum(['technical', 'aptitude', 'dsa', 'hr', 'coding', 'verbal']),
  expectedConcepts: z.array(z.string()),
  explanation: z.string(),
  hints: z.array(z.string()),
  followUpPossible: z.boolean(),
  coding: z
    .object({
      inputFormat: z.string(),
      outputFormat: z.string(),
      constraints: z.array(z.string()),
      examples: z.array(testCaseSchema),
      hiddenTests: z.array(testCaseSchema),
      expectedComplexity: z.string(),
      tags: z.array(z.string()),
      referencePython: z.string(),
    })
    .nullable(),
});
export const mistakeTypes = [
  'Conceptual mistake',
  'Syntax mistake',
  'Logic mistake',
  'Calculation mistake',
  'Misunderstanding',
  'Incomplete answer',
  'Complexity mistake',
  'Edge case missed',
  'Optimization mistake',
] as const;
export const evaluationSchema = z.object({
  technicalAccuracy: z.number().min(0).max(10),
  problemSolving: z.number().min(0).max(10),
  communication: z.number().min(0).max(10),
  completeness: z.number().min(0).max(10),
  reasoning: z.number().min(0).max(10),
  timeComplexity: z.string(),
  spaceComplexity: z.string(),
  confidenceEvidence: z.string(),
  wellDone: z.array(z.string()),
  improve: z.array(z.string()),
  correctAnswer: z.string(),
  followUp: z.string().nullable(),
  mistakes: z.array(
    z.object({
      type: z.enum(mistakeTypes),
      topic: z.string(),
      explanation: z.string(),
      correction: z.string(),
    }),
  ),
});
export const planSchema = z.object({
  summary: z.string(),
  tasks: z.array(
    z.object({
      day: z.number().int().min(1).max(7),
      title: z.string(),
      topic: z.string(),
      mode: z.enum(modes),
      minutes: z.number().int().min(5).max(120),
    }),
  ),
});
export const reportSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  nextSteps: z.array(z.string()),
});
export type GeneratedQuestion = z.infer<typeof questionSchema>;
export type Evaluation = z.infer<typeof evaluationSchema>;
export type PublicQuestion = Omit<
  GeneratedQuestion,
  'explanation' | 'hints' | 'expectedConcepts' | 'coding'
> & {
  id: string;
  position: number;
  hintsUsed: number;
  revealedHints: string[];
  coding: Omit<
    NonNullable<GeneratedQuestion['coding']>,
    'hiddenTests' | 'referencePython' | 'expectedComplexity'
  > | null;
};
