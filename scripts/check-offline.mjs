// Real local HTTP/database smoke test. Creates a uniquely named test account.
import assert from 'node:assert/strict';
const base = 'http://localhost:3000';
let cookie = '';
async function request(path, data, method = 'POST') {
  const response = await fetch(`${base}/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const result = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(result)}`);
  return result;
}
await request('auth/signup', {
  email: `offline-check-${Date.now()}@example.com`,
  password: 'LocalPracticeCheck123!',
});
await request(
  'profile',
  {
    name: 'Offline Check',
    college: 'Demo College',
    degree: 'BTech',
    branch: 'CSE',
    graduationYear: 2027,
    level: 'beginner',
    role: 'Software Developer',
    languages: ['Python'],
    areas: ['Databases'],
  },
  'PUT',
);
const session = await request('sessions', {
  mode: 'Technical',
  difficulty: 'easy',
  language: 'Python',
  targetCount: 3,
});
const ids = new Set();
for (let i = 0; i < 3; i++) {
  const q = await request(`sessions/${session.id}/next`, {});
  assert.ok(q.title.startsWith('Offline practice'));
  assert.ok(!ids.has(q.id));
  ids.add(q.id);
  assert.equal(q.explanation, undefined);
  await request(`questions/${q.id}/answer`, {
    answer: 'A primary key is unique and cannot be null.',
  });
}
const report = await request(`sessions/${session.id}/finish`, {});
assert.ok(report.summary.includes('Offline'));
const detail = await request(`sessions/${session.id}`, undefined, 'GET');
assert.equal(detail.status, 'completed');
assert.equal(detail.questions.filter((q) => q.attempt).length, 3);
const plan = await request('plans', undefined, 'GET');
assert.equal(plan.tasks.length, 7);
const second = await request('sessions', {
  mode: 'Technical',
  difficulty: 'easy',
  language: 'Python',
  targetCount: 3,
});
const next = await request(`sessions/${second.id}/next`, {});
assert.ok(!detail.questions.some((q) => q.question === next.question));
await request(`sessions/${second.id}/finish`, {});
console.log(
  'PASS: signup, profile, three offline questions, answers, persisted history, completed report, seven-day plan, cross-session non-repetition.',
);
