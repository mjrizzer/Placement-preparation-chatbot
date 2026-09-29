import { describe, it, expect, vi, afterEach } from 'vitest';
import { Judge0Executor, executeTests, type CodeExecutor } from '@/server/execution';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('sandbox execution', () => {
  it('never falls back to local execution when unconfigured', async () => {
    vi.stubEnv('JUDGE0_URL', '');
    await expect(new Judge0Executor().run('print(1)', 'Python', '')).rejects.toMatchObject({
      status: 503,
    });
  });
  it('sends resource limits, disables network, and decodes output', async () => {
    vi.stubEnv('JUDGE0_URL', 'https://sandbox.example');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ token: 'test-token' }))
      .mockResolvedValueOnce(
        Response.json({
          status: { id: 3, description: 'Accepted' },
          stdout: Buffer.from('42\n').toString('base64'),
          time: '0.01',
          memory: 1000,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await new Judge0Executor().run('print(42)', 'Python', '', '42');
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.enable_network).toBe(false);
    expect(sent.cpu_time_limit).toBe(2);
    expect(sent.memory_limit).toBe(128000);
    expect(result).toMatchObject({ passed: true, stdout: '42\n', time: 0.01, memory: 1000 });
  });
  it('reports compilation errors without fabricating success', async () => {
    vi.stubEnv('JUDGE0_URL', 'https://sandbox.example');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ token: 'x' }))
        .mockResolvedValueOnce(
          Response.json({
            status: { id: 6, description: 'Compilation Error' },
            compile_output: Buffer.from('Syntax error').toString('base64'),
          }),
        ),
    );
    expect(await new Judge0Executor().run('bad', 'C', '')).toMatchObject({
      passed: false,
      stderr: 'Syntax error',
    });
  });
  it('runs every test and retains results in order', async () => {
    const runner: CodeExecutor = {
      run: vi.fn(async (_source, language, input, expected) => ({
        passed: input === expected,
        status: input === expected ? 'Accepted' : 'Wrong Answer',
        stdout: input,
        stderr: '',
        time: 0,
        memory: 0,
      })),
    };
    const results = await executeTests(
      'code',
      'Python',
      [
        { input: '1', output: '1' },
        { input: '2', output: '3' },
      ],
      runner,
    );
    expect(results.map((r) => r.passed)).toEqual([true, false]);
  });
  it('handles sandbox failure with a useful error', async () => {
    vi.stubEnv('JUDGE0_URL', 'https://sandbox.example');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(new Judge0Executor().run('code', 'Python', '')).rejects.toMatchObject({
      status: 502,
    });
  });
});
