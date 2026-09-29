import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/security', () => ({
  requireUser: vi.fn(async () => {
    const { AppError } = await import('@/lib/http');
    throw new AppError(401, 'Please sign in to continue.');
  }),
  currentUser: vi.fn(async () => null),
  rateLimit: vi.fn(),
  createSession: vi.fn(),
  logout: vi.fn(),
  withUserLock: vi.fn(),
}));
import { GET, POST } from '@/app/api/[...path]/route';
const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });
describe('API access boundaries', () => {
  it('rejects unauthenticated analytics access', async () => {
    const response = await GET(
      new Request('http://localhost:3000/api/analytics'),
      ctx('analytics'),
    );
    expect(response.status).toBe(401);
  });
  it('rejects cross-origin state changes before authentication', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/sessions', {
        method: 'POST',
        headers: { origin: 'https://attacker.example' },
      }),
      ctx('sessions'),
    );
    expect(response.status).toBe(403);
  });
  it('rejects a missing origin on mutation', async () =>
    expect(
      (
        await POST(
          new Request('http://localhost:3000/api/sessions', { method: 'POST' }),
          ctx('sessions'),
        )
      ).status,
    ).toBe(403));
  it('rejects invalid auth credentials', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad', password: 'tiny' }),
      }),
      ctx('auth', 'signup'),
    );
    expect(response.status).toBe(400);
  });
  it('exposes no service credentials through health', async () =>
    expect(
      await (await GET(new Request('http://localhost:3000/api/health'), ctx('health'))).json(),
    ).toEqual({ status: 'ok' }));
});
