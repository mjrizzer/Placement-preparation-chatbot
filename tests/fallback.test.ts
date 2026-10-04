import { afterEach, describe, expect, it, vi } from 'vitest';
import { ai, GeminiProvider, getRemoteProvider } from '@/server/ai';
import { offlineBank, isBankQuestion } from '@/server/offline';
import { evaluationSchema, planSchema, reportSchema } from '@/lib/contracts';
import { AppError } from '@/lib/http';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function configuredFailure() {
  vi.stubEnv('PRACTICE_MODE', '');
  vi.stubEnv('GEMINI_API_KEY', 'invalid-test-key');
  return vi
    .spyOn(GeminiProvider.prototype, 'structured')
    .mockRejectedValue(new AppError(502, 'Provider failed'));
}

describe('standard practice fallback', () => {
  it('disables remote providers when standard practice is selected', () => {
    vi.stubEnv('PRACTICE_MODE', 'standard');
    vi.stubEnv('GEMINI_API_KEY', 'configured-key');
    expect(getRemoteProvider()).toBeNull();
  });
  it('checks bank answers without contacting the configured provider', async () => {
    const remote = configuredFailure();
    const question = offlineBank('Aptitude')[0];
    const result = await ai.structured(
      'evaluation',
      '',
      { question, answer: '230' },
      evaluationSchema,
    );
    expect(result.technicalAccuracy).toBe(10);
    expect(remote).not.toHaveBeenCalled();
  });
  it('falls back to labelled local feedback when evaluating an online question fails', async () => {
    configuredFailure();
    const question = { ...offlineBank('Technical')[0], title: 'Generated question' };
    const result = await ai.structured(
      'evaluation',
      '',
      { question, answer: 'A unique identifier that cannot be null.' },
      evaluationSchema,
    );
    expect(result.improve.join(' ')).toContain('keyword estimate');
    expect(result.correctAnswer).toBe(question.explanation);
  });
  it('produces a local report and study plan when the provider fails', async () => {
    configuredFailure();
    const report = await ai.structured(
      'interview_report',
      '',
      { answered: 2, total: 5 },
      reportSchema,
    );
    expect(report.summary).toContain('2 of 5');
    const plan = await ai.structured('improvement_plan', '', {}, planSchema);
    expect(plan.tasks).toHaveLength(7);
  });
  it('does not disguise unrelated programming errors as provider failures', async () => {
    const remote = configuredFailure();
    remote.mockRejectedValue(new TypeError('Unexpected bug'));
    await expect(ai.structured('improvement_plan', '', {}, planSchema)).rejects.toThrow(
      'Unexpected bug',
    );
  });
  it('keeps recognizing old bank questions after re-embedding their history', () => {
    const question = { ...offlineBank('Technical')[0], title: 'Offline practice - Databases' };
    expect(isBankQuestion(question)).toBe(true);
  });
});
