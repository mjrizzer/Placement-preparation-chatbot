import { createHash } from 'node:crypto';
import { difficulties, type Difficulty } from './catalog';
import type { Evaluation } from './contracts';
export const hashQuestion = (text: string) =>
  createHash('sha256')
    .update(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim(),
    )
    .digest('hex');
export function cosine(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
export function adaptDifficulty(current: Difficulty, scores: number[]): Difficulty {
  const i = difficulties.indexOf(current);
  if (scores.length >= 4 && scores.slice(-4).every((s) => s >= 80))
    return difficulties[Math.min(3, i + 1)];
  if (scores.length >= 2 && scores.slice(-2).every((s) => s < 45))
    return difficulties[Math.max(0, i - 1)];
  return current;
}
export function scoreEvaluation(e: Evaluation, tests?: { passed: number; total: number }) {
  const rubric =
    (e.technicalAccuracy * 0.3 +
      e.problemSolving * 0.25 +
      e.communication * 0.1 +
      e.completeness * 0.2 +
      e.reasoning * 0.15) *
    10;
  return Math.round(
    tests ? 0.7 * (tests.total ? (tests.passed / tests.total) * 100 : 0) + 0.3 * rubric : rubric,
  );
}
export const mean = (values: number[]) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
