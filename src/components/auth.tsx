'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Command, Sparkles } from 'lucide-react';
import { api, ErrorNotice } from './ui';
export default function Auth({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      await api('auth/' + (signup ? 'signup' : 'login'), {
        method: 'POST',
        body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
      });
      router.push(signup ? '/onboarding' : '/dashboard');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-art">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Command />
          </span>
          AI Placement Prep
        </Link>
        <div>
          <span className="eyebrow">PLACEMENT PRACTICE</span>
          <h1>
            Prepare for your
            <br />
            next interview.
          </h1>
          <p>
            Aptitude, coding, and interview questions.
            <br />
            Keep your practice in one place.
          </p>
          <div className="auth-art-icon">
            <Sparkles size={64} strokeWidth={1} />
          </div>
        </div>
        <small>A student project for campus placement preparation.</small>
      </aside>
      <main className="auth-form">
        <div>
          <Link href="/" className="back-link">
            ← Back to home
          </Link>
          <span className="eyebrow">LET’S GET YOU READY</span>
          <h1>{signup ? 'Create your account' : 'Welcome back.'}</h1>
          <p>
            {signup
              ? 'Save your answers and keep track of your practice.'
              : 'Sign in to continue your practice.'}
          </p>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@college.edu"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={72}
                autoComplete={signup ? 'new-password' : 'current-password'}
                required
                placeholder="At least 12 characters"
              />
            </label>
            <ErrorNotice message={error} />
            <button className="button" disabled={busy}>
              {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {signup ? 'Already have an account?' : 'New here?'}{' '}
            <Link href={signup ? '/login' : '/signup'}>
              {signup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
