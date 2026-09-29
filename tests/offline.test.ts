import { describe, expect, it } from 'vitest';
import { offlineBank, offlineResponse } from '@/server/offline';
import { questionSchema, evaluationSchema, planSchema, reportSchema } from '@/lib/contracts';

describe('offline practice', () => {
  it('has valid, distinct original questions for each basic mode', () => {
    for (const mode of ['Technical', 'HR', 'DSA', 'Aptitude', 'Logical Reasoning', 'Verbal']) {
      const bank = offlineBank(mode);
      expect(bank.length).toBeGreaterThanOrEqual(5);
      expect(new Set(bank.map((q) => q.concept)).size).toBe(bank.length);
      bank.forEach((q) => questionSchema.parse(q));
    }
  });
  it('checks exact aptitude answers and explains the limited scoring', () => {
    const question = offlineBank('Aptitude')[0];
    const check = (answer: string) =>
      evaluationSchema.parse(offlineResponse('evaluation', { question, answer }));
    expect(check('230').technicalAccuracy).toBe(10);
    expect(check('1230').technicalAccuracy).toBe(0);
    expect(check('wrong').correctAnswer).toBe('230');
    expect(check('wrong').mistakes).toHaveLength(1);
  });
  it('provides a report and all seven study days without a key', () => {
    const plan = planSchema.parse(
      offlineResponse('improvement_plan', { weakTopics: [{ topic: 'Queues' }] }),
    );
    expect(new Set(plan.tasks.map((t) => t.day)).size).toBe(7);
    expect(plan.tasks[0].topic).toBe('Queues');
    const report = reportSchema.parse(
      offlineResponse('interview_report', { answered: 3, total: 5 }),
    );
    expect(report.summary).toContain('3 of 5');
  });
});
