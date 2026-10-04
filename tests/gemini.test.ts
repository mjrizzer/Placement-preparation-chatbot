import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from '@/server/ai';
import { questionSchema } from '@/lib/contracts';
import { question } from './fixtures';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Gemini transport', () => {
  it('sends a complete Zod 4 JSON schema and validates the generated question', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-only-key');
    const transport = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: { role: 'model', parts: [{ text: JSON.stringify(question) }] },
            finishReason: 'STOP',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', transport);
    expect(
      await new GeminiProvider().structured('question', 'Generate a question', {}, questionSchema),
    ).toEqual(question);
    const args = transport.mock.calls[0];
    const body = JSON.parse(args[1].body);
    expect(body.generationConfig.responseJsonSchema.properties.question.type).toBe('string');
    expect(body.generationConfig.responseJsonSchema.required).toContain('coding');
    expect(body.generationConfig.responseSchema).toBeUndefined();
  });

  it('rejects provider JSON that does not satisfy the question contract', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-only-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            {
              content: { role: 'model', parts: [{ text: '{"question":12}' }] },
              finishReason: 'STOP',
            },
          ],
        }),
      ),
    );
    await expect(
      new GeminiProvider().structured('question', '', {}, questionSchema),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('uses the replacement embedding model and validates its vector', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-only-key');
    vi.stubEnv('GEMINI_EMBEDDING_MODEL', '');
    const transport = vi
      .fn()
      .mockResolvedValue(Response.json({ embeddings: [{ values: [0.2, 0.5, 0.7] }] }));
    vi.stubGlobal('fetch', transport);
    expect(await new GeminiProvider().embed('A question')).toEqual([0.2, 0.5, 0.7]);
    expect(String(transport.mock.calls[0][0])).toContain('gemini-embedding-001');
  });

  it('rejects missing embedding vectors', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-only-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ embeddings: [{ values: [] }] })),
    );
    await expect(new GeminiProvider().embed('A question')).rejects.toMatchObject({ status: 502 });
  });
});
