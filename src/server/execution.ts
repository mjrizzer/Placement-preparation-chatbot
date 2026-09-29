import { AppError } from '@/lib/http';
export type ExecutionResult = {
  status: string;
  passed: boolean;
  stdout: string;
  stderr: string;
  time: number | null;
  memory: number | null;
};
export interface CodeExecutor {
  run(source: string, language: string, input: string, expected?: string): Promise<ExecutionResult>;
}
const languageIds: Record<string, number> = {
  C: 50,
  'C++': 54,
  Java: 62,
  Python: 71,
  JavaScript: 63,
  TypeScript: 74,
  Go: 60,
  Rust: 73,
  'C#': 51,
  Kotlin: 78,
  PHP: 68,
};
type JudgeResult = {
  token?: string;
  status?: { id: number; description: string };
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: string;
  memory?: number;
};
export class Judge0Executor implements CodeExecutor {
  async run(
    source: string,
    language: string,
    input: string,
    expected?: string,
  ): Promise<ExecutionResult> {
    const base = process.env.JUDGE0_URL?.replace(/\/$/, '');
    if (!base)
      throw new AppError(
        503,
        'Code execution is not configured. Ask the administrator to connect a Judge0 sandbox.',
      );
    const ids = {
      ...languageIds,
      ...JSON.parse(process.env.JUDGE0_LANGUAGE_IDS || '{}'),
    } as Record<string, number>;
    if (!ids[language]) throw new AppError(400, 'This language is not supported by the sandbox.');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.JUDGE0_API_KEY)
      headers[process.env.JUDGE0_AUTH_HEADER || 'X-Auth-Token'] = process.env.JUDGE0_API_KEY;
    if (process.env.JUDGE0_RAPIDAPI_HOST)
      headers['X-RapidAPI-Host'] = process.env.JUDGE0_RAPIDAPI_HOST;
    const request = async (path: string, init: RequestInit = {}) => {
      try {
        const response = await fetch(base + path, {
          ...init,
          headers,
          signal: AbortSignal.timeout(15_000),
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Sandbox response failed');
        return (await response.json()) as JudgeResult;
      } catch {
        throw new AppError(502, 'The code sandbox is unavailable. Please try again.');
      }
    };
    const encode = (v: string) => Buffer.from(v).toString('base64');
    const decode = (v?: string) =>
      v ? Buffer.from(v, 'base64').toString('utf8').slice(0, 16000) : '';
    const job = await request('/submissions?base64_encoded=true&wait=false', {
      method: 'POST',
      body: JSON.stringify({
        source_code: encode(source),
        language_id: ids[language],
        stdin: encode(input),
        ...(expected !== undefined ? { expected_output: encode(expected) } : {}),
        cpu_time_limit: 2,
        wall_time_limit: 5,
        memory_limit: 128000,
        max_processes_and_or_threads: 32,
        max_file_size: 1024,
        enable_network: false,
      }),
    });
    if (!job.token) throw new AppError(502, 'The sandbox did not accept this run.');
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const result = await request(
        `/submissions/${encodeURIComponent(job.token)}?base64_encoded=true`,
      );
      if (result.status && result.status.id > 2) {
        if (result.status.id === 13)
          throw new AppError(502, 'The sandbox reported an internal error. Please retry.');
        return {
          status: result.status.description,
          passed: result.status.id === 3,
          stdout: decode(result.stdout),
          stderr: decode(result.stderr || result.compile_output),
          time: result.time ? Number(result.time) : null,
          memory: result.memory ?? null,
        };
      }
    }
    throw new AppError(504, 'Execution timed out. Please retry.');
  }
}
export const executor: CodeExecutor = new Judge0Executor();
export async function executeTests(
  source: string,
  language: string,
  tests: { input: string; output: string }[],
  runner: CodeExecutor = executor,
) {
  const results: ExecutionResult[] = [];
  for (let i = 0; i < tests.length; i += 3) {
    results.push(
      ...(await Promise.all(
        tests.slice(i, i + 3).map((t) => runner.run(source, language, t.input, t.output)),
      )),
    );
  }
  return results;
}
