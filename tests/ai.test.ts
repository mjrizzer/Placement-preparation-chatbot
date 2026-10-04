import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  QuestionGenerator,
  AnswerEvaluator,
  MistakeAnalyzer,
  ImprovementPlanner,
  equivalent,
  OpenAIProvider,
  GeminiProvider,
  getRemoteProvider,
  type AIProvider,
} from '@/server/ai';
import { question, evaluation, plan } from './fixtures';
import { z } from 'zod';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function provider(output: unknown) {
  const calls: unknown[][] = [];
  return {
    calls,
    async structured<T>(name: string, instructions: string, data: unknown, schema: z.ZodType<T>) {
      calls.push([name, instructions, data]);
      return schema.parse(output);
    },
    embed: vi.fn(async () => [1, 0]),
    embeddingModel: 'test-model',
  } satisfies AIProvider & { calls: unknown[][] };
}
describe('AI services', () => {
  it('integrates SDK structured parsing with the actual HTTP adapter', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-only-not-a-real-key');
    const transport = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          id: 'chat-test',
          object: 'chat.completion',
          created: 1,
          model: 'test',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: { role: 'assistant', content: JSON.stringify(question), refusal: null },
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', transport);
    expect(
      await new QuestionGenerator(new OpenAIProvider()).generate({ mode: 'Technical' }),
    ).toEqual(question);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('integrates SDK embedding transport and validates returned vectors', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-only-not-a-real-key');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            object: 'list',
            data: [{ object: 'embedding', index: 0, embedding: [0.2, 0.7, 0.1] }],
            model: 'text-embedding-3-small',
            usage: { prompt_tokens: 3, total_tokens: 3 },
          }),
        ),
    );
    expect(await new OpenAIProvider().embed('question')).toEqual([0.2, 0.7, 0.1]);
  });
  it('passes personalization and history into a structured generation service', async () => {
    const p = provider(question);
    const context = {
      role: 'Backend Developer',
      previousMistakes: ['Complexity mistake'],
      weakTopics: ['Trees'],
      previousQuestions: ['Old question'],
    };
    expect(await new QuestionGenerator(p).generate(context)).toEqual(question);
    expect(p.calls[0][2]).toEqual(context);
  });
  it('evaluates using the supplied answer', async () => {
    const p = provider(evaluation);
    await new AnswerEvaluator(p).evaluate({ answer: 'Indexed access' });
    expect(p.calls[0][2]).toEqual({ answer: 'Indexed access' });
  });
  it('rejects an invalid provider response', async () => {
    await expect(new QuestionGenerator(provider({ question: 12 })).generate({})).rejects.toThrow();
  });
  it('detects semantic paraphrases through the adjudicator', async () =>
    expect(
      await equivalent(
        question,
        [{ content: 'Describe lookup tradeoffs in collections.', concept: question.concept }],
        provider({ duplicate: true }),
      ),
    ).toBe(true));
  it('allows different applications when adjudicator confirms', async () =>
    expect(
      await equivalent(
        question,
        [{ content: 'Optimize an insertion-heavy workload.', concept: 'Insertion workload' }],
        provider({ duplicate: false }),
      ),
    ).toBe(false));
  it('extracts categorized actionable mistakes', () =>
    expect(new MistakeAnalyzer().analyze(evaluation)[0].type).toBe('Incomplete answer'));
  it('generates structured improvement tasks from observed performance', async () => {
    const result = await new ImprovementPlanner(provider(plan)).generate({
      weakTopics: ['Collections'],
    });
    expect(result.tasks).toHaveLength(7);
  });
  it('fails explicitly without an API key and never serves fixed questions', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    await expect(new OpenAIProvider().embed('test')).rejects.toMatchObject({ status: 503 });
    await expect(new GeminiProvider().embed('test')).rejects.toMatchObject({ status: 503 });
  });
  it('selects provider based on environment variables', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(getRemoteProvider()).toBeNull();
    
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    expect(getRemoteProvider()).toBeInstanceOf(OpenAIProvider);
    
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'AIza-test');
    expect(getRemoteProvider()).toBeInstanceOf(GeminiProvider);
    
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    expect(getRemoteProvider()).toBeInstanceOf(GeminiProvider); // Gemini takes precedence
  });
});
