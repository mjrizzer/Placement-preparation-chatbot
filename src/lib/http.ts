import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { Prisma } from '@prisma/client';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P1001', 'P1002', 'P1017'].includes(error.code))
  )
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'production'
            ? 'Cannot connect to the account database. Please contact the project administrator.'
            : 'The database is offline. Start the project with npm run local, then try signing in again.',
      },
      { status: 503 },
    );
  if (error instanceof AppError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') },
      { status: 400 },
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    return NextResponse.json(
      { error: 'This record already exists. Refresh and try again.' },
      { status: 409 },
    );
  console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return NextResponse.json(
    {
      error:
        'The service is temporarily unavailable. Your saved progress is safe. Please try again.',
    },
    { status: 503 },
  );
}
export async function body<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const text = new TextDecoder().decode(await boundedBody(request, 100_000));
  try {
    return schema.parse(JSON.parse(text));
  } catch (e) {
    if (e instanceof SyntaxError) throw new AppError(400, 'Invalid JSON.');
    throw e;
  }
}
export async function boundedBody(
  request: Request,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get('content-length') || 0) > limit)
    throw new AppError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new AppError(413, 'Request is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(process.env.APP_URL || 'http://localhost:3000').origin;
  if (origin !== expected) throw new AppError(403, 'Request origin is not allowed.');
}
