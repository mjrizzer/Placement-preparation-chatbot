import { describe, it, expect } from 'vitest';
import { OpenAIProvider, QuestionGenerator, AnswerEvaluator } from '@/server/ai';
import { Judge0Executor } from '@/server/execution';
import { question } from './fixtures';
describe.skipIf(process.env.LIVE_AI_TESTS !== 'true')('live AI provider (billable)', () => {
  it('generates and evaluates a structured response with a real embedding', async () => {
    const provider = new OpenAIProvider();
    const q = await new QuestionGenerator(provider).generate({
      mode: 'Technical',
      difficulty: 'easy',
      role: 'Software Developer',
      language: 'Python',
      profile: { level: 'beginner' },
      previousQuestions: [],
    });
    expect(q.question.length).toBeGreaterThan(10);
    const vector = await provider.embed(q.question);
    expect(vector.length).toBeGreaterThan(100);
    const result = await new AnswerEvaluator(provider).evaluate({
      question,
      answer: 'I do not know yet.',
    });
    expect(result.technicalAccuracy).toBeLessThanOrEqual(5);
  }, 180000);
});
describe.skipIf(process.env.LIVE_SANDBOX_TESTS !== 'true')('live code sandbox', () => {
  it('executes real Python and tests output', async () => {
    const result = await new Judge0Executor().run(
      'print(sum(map(int, input().split())))',
      'Python',
      '2 3',
      '5',
    );
    expect(result.passed).toBe(true);
    expect(result.stdout.trim()).toBe('5');
  }, 60000);
});
