'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTabSubmit } from './use-tab-submit';
const CodeEditor = dynamic(() => import('./code-editor'), { ssr: false });
const samples = [
  {
    topic: 'Aptitude',
    question: 'A notebook costs ₹80. Its price increases by 25%. What is the new price?',
    answer: '₹100. The increase is 80 × 25/100 = ₹20.',
    check: (v: string) => /(^|\D)100(\D|$)/.test(v),
  },
  {
    topic: 'DSA',
    question: 'Which data structure follows First In, First Out (FIFO)?',
    answer: 'A queue. The first item added is the first item removed.',
    check: (v: string) => /\bqueue\b/i.test(v),
  },
];
export default function Demo() {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState('');
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState<
    { answer: string; automatic: boolean; correct: boolean | null }[]
  >([]);
  const finished = step === 3;
  const submitted = !!saved[step];
  const coding = step === 2;
  async function submit(automatic = false) {
    if (submitted || finished) return true;
    const value = coding ? code : answer;
    setSaved((s) =>
      s[step]
        ? s
        : [...s, { answer: value, automatic, correct: coding ? null : samples[step].check(value) }],
    );
    return true;
  }
  const tab = useTabSubmit(String(step), !submitted && !finished, false, () => submit(true));
  function next() {
    setStep((s) => s + 1);
    setAnswer('');
  }
  return (
    <main className="demo-page">
      <nav className="demo-nav">
        <Link href="/">← Placement Prep</Link>
        <Link href="/login">Sign in</Link>
      </nav>
      <div className="demo-label">SAMPLE WALKTHROUGH · NO ACCOUNT NEEDED</div>
      <h1>{finished ? 'Sample session complete' : 'Try a short practice session'}</h1>
      <p>
        This walkthrough uses two preset questions and a coding exercise. It demonstrates the
        interface and tab-switch rules; it does not call AI or execute code.
      </p>
      {tab.notice && (
        <div className="info-notice" role="status">
          {tab.notice}
        </div>
      )}
      {!finished ? (
        <section className="panel">
          <span className="tag">
            Question {step + 1} of 3 · {coding ? 'Coding' : samples[step].topic}
          </span>
          <h2 style={{ marginTop: 24 }}>
            {coding
              ? 'Write a Python program that prints the sum of two integers read from input.'
              : samples[step].question}
          </h2>
          <p className="small">
            Switching tabs submits your current work. Copy and paste are disabled in the code
            editor.
          </p>
          {coding ? (
            <CodeEditor
              language="Python"
              value={code}
              onChange={setCode}
              readOnly={submitted || tab.pending}
            />
          ) : (
            <label>
              Your answer
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={submitted || tab.pending}
                placeholder="Enter your answer"
              />
            </label>
          )}
          {submitted ? (
            <div className="demo-feedback" role="status">
              <h3>
                {coding
                  ? 'Code saved for review'
                  : saved[step].correct
                    ? 'Correct'
                    : 'Review the answer'}
              </h3>
              <p>
                {coding
                  ? 'Your code has been captured. No execution or correctness score is claimed in this sample.'
                  : samples[step].answer}
              </p>
              <p className="small">
                {saved[step].automatic
                  ? 'Submitted automatically after switching tabs.'
                  : 'Submitted manually.'}
              </p>
              <button className="button" onClick={next}>
                {coding ? 'View summary' : 'Next question'}
              </button>
            </div>
          ) : (
            <button className="button" style={{ marginTop: 18 }} onClick={() => submit()}>
              Submit {coding ? 'code' : 'answer'}
            </button>
          )}
        </section>
      ) : (
        <section className="panel">
          <h2>{saved.filter((s) => s.correct).length} / 2 practice answers correct</h2>
          {saved.map((s, i) => (
            <div className="demo-result" key={i}>
              <h3>{i === 2 ? 'Coding exercise' : samples[i].topic}</h3>
              <pre>{s.answer || '(Blank answer)'}</pre>
              <p>
                {s.automatic ? 'Auto-submitted on tab switch' : 'Submitted manually'} ·{' '}
                {s.correct === null ? 'Saved, not executed' : s.correct ? 'Correct' : 'Incorrect'}
              </p>
            </div>
          ))}
          <button
            className="button"
            onClick={() => {
              setStep(0);
              setSaved([]);
              setAnswer('');
              setCode('');
            }}
          >
            Try again
          </button>
        </section>
      )}
    </main>
  );
}
