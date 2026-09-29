import { describe, it, expect } from 'vitest';
import { adaptDifficulty, cosine, hashQuestion, scoreEvaluation } from '@/lib/math';
import { sectionFor } from '@/lib/catalog';
import { profileSchema, evaluationSchema } from '@/lib/contracts';
import { question, evaluation, profile } from './fixtures';
import { publicQuestion } from '@/server/questions';
import type { Question } from '@prisma/client';
describe('adaptive difficulty', () => {
  it('raises difficulty after four strong answers', () =>
    expect(adaptDifficulty('easy', [80, 85, 90, 95])).toBe('medium'));
  it('does not raise after only three', () =>
    expect(adaptDifficulty('easy', [90, 90, 90])).toBe('easy'));
  it('reduces difficulty after repeated difficulty', () =>
    expect(adaptDifficulty('hard', [40, 20])).toBe('medium'));
  it('respects boundaries', () => {
    expect(adaptDifficulty('expert', [90, 90, 90, 90])).toBe('expert');
    expect(adaptDifficulty('easy', [10, 10])).toBe('easy');
  });
  it('does not reduce on a single mistake', () =>
    expect(adaptDifficulty('medium', [90, 30])).toBe('medium'));
});
describe('semantic matching primitives', () => {
  it('compares direction rather than vector magnitude', () =>
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1));
  it('handles zero and incompatible vectors', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
    expect(cosine([1], [1, 2])).toBe(0);
  });
  it('recognizes orthogonal concepts', () => expect(cosine([1, 0], [0, 1])).toBe(0));
  it('normalizes punctuation and capitalization', () =>
    expect(hashQuestion('Explain Java!')).toBe(hashQuestion('explain java')));
});
describe('scoring and validation', () => {
  it('uses a weighted, bounded score', () => expect(scoreEvaluation(evaluation)).toBe(73));
  it('weights real test performance over AI opinion', () => {
    expect(scoreEvaluation(evaluation, { passed: 0, total: 5 })).toBe(22);
    expect(scoreEvaluation(evaluation, { passed: 5, total: 5 })).toBe(92);
  });
  it('rejects invalid AI scores', () =>
    expect(evaluationSchema.safeParse({ ...evaluation, technicalAccuracy: 11 }).success).toBe(
      false,
    ));
  it('requires at least one language', () =>
    expect(profileSchema.safeParse({ ...profile, languages: [] }).success).toBe(false));
  it('protects private answers and hidden tests in the question DTO', () => {
    const payload = {
      ...question,
      coding: {
        inputFormat: 'n',
        outputFormat: 'n',
        constraints: ['n <= 9'],
        examples: [{ input: '1', output: '1' }],
        hiddenTests: [{ input: '9', output: '9' }],
        referencePython: 'print(input())',
        expectedComplexity: 'O(1)',
        tags: ['Arrays'],
      },
    };
    const result = publicQuestion({
      id: 'q',
      position: 0,
      hintsUsed: 0,
      payload,
    } as unknown as Question);
    expect(result).not.toHaveProperty('explanation');
    expect(result).not.toHaveProperty('expectedConcepts');
    expect(result.coding).not.toHaveProperty('hiddenTests');
    expect(result.coding).not.toHaveProperty('referencePython');
  });
  it('uses every mock section in the specified order', () => {
    expect([0, 19, 20, 34, 35, 44, 45, 59, 60, 69, 70, 71].map(sectionFor)).toEqual([
      'Quantitative Aptitude',
      'Quantitative Aptitude',
      'Logical Reasoning',
      'Logical Reasoning',
      'Verbal',
      'Verbal',
      'Technical',
      'Technical',
      'DSA',
      'DSA',
      'Coding',
      'Coding',
    ]);
  });
});
