'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowRight,
  AudioLines,
  Braces,
  Check,
  Clock,
  Lightbulb,
  Mic,
  Play,
  Send,
  Sparkles,
  Square,
  Volume2,
  Flag,
  ChevronDown,
} from 'lucide-react';
import { api, ErrorNotice, Loading, PageHeading } from './ui';
import { useTabSubmit } from './use-tab-submit';
import { codingLanguages } from '@/lib/catalog';
import type { Evaluation, PublicQuestion } from '@/lib/contracts';
const CodeEditor = dynamic(() => import('./code-editor'), {
  ssr: false,
  loading: () => <Loading label="Opening code editor…" />,
});
type Attempt = {
  id: string;
  answer: string;
  score: number;
  feedback: Evaluation;
  timeTaken: number;
  mistakes: { type: string; explanation: string; correction: string }[];
};
type TestResult = {
  hidden?: boolean;
  status: string;
  passed: boolean;
  stdout?: string;
  stderr?: string;
  time: number | null;
  memory: number | null;
};
type SessionQuestion = PublicQuestion & {
  submissionCount: number;
  attempt: Attempt | null;
  createdAt: string;
  submissions: {
    id: string;
    source: string;
    language: string;
    results: TestResult[];
    isFinal: boolean;
    passed: number;
    total: number;
  }[];
};
type Session = {
  offline?: boolean;
  id: string;
  mode: string;
  status: string;
  difficulty: string;
  language: string;
  targetCount: number;
  expiresAt: string | null;
  questions: SessionQuestion[];
  report: null | {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    nextSteps: string[];
    score: number;
    answered: number;
    total: number;
  };
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
export default function InterviewWorkspace({ id }: { id: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [source, setSource] = useState('');
  const [language, setLanguage] = useState('Python');
  const [results, setResults] = useState<TestResult[]>([]);
  const [custom, setCustom] = useState(false);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [remaining, setRemaining] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const inFlight = useRef(false);
  const question = session?.questions.at(-1);
  const completed = session?.status === 'completed';
  const allAnswered =
    !!session && session.questions.filter((q) => q.attempt).length >= session.targetCount;
  const expired = !!session?.expiresAt && remaining === '0:00';
  const tab = useTabSubmit(
    question?.id,
    !!question && !question.attempt && !completed && !expired,
    !!busy,
    () => (question?.coding ? run(true, true) : submit(true)),
  );
  async function load() {
    const data = await api<Session>('sessions/' + id);
    setSession(data);
    return data;
  }
  useEffect(() => {
    let live = true;
    api<Session>('sessions/' + id)
      .then((d) => {
        if (live) {
          setSession(d);
          setLanguage(d.language);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
      recognition.current?.stop();
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, [id]);
  useEffect(() => {
    if (!session?.expiresAt) return;
    const tick = () => {
      const ms = Math.max(0, new Date(session.expiresAt!).getTime() - Date.now());
      setRemaining(
        `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`,
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session?.expiresAt]);
  const draftQuestionId = question && !question.attempt ? question.id : null;
  useEffect(() => {
    if (draftQuestionId) {
      const draft = sessionStorage.getItem('draft:' + draftQuestionId);
      if (draft) {
        try {
          const d = JSON.parse(draft);
          setAnswer(d.answer || '');
          setSource(d.source || '');
        } catch {
          /* Invalid local draft is safely ignored. */
        }
      } else {
        setAnswer('');
        setSource('');
      }
      setResults([]);
    }
  }, [draftQuestionId]);
  function draft(a: string, s: string) {
    if (question)
      sessionStorage.setItem('draft:' + question.id, JSON.stringify({ answer: a, source: s }));
  }
  async function action(label: string, fn: () => Promise<void>) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(label);
    setError('');
    try {
      await fn();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy('');
      inFlight.current = false;
    }
  }
  async function next() {
    await action('Creating a fresh question…', async () => {
      await api('sessions/' + id + '/next', { method: 'POST' });
      await load();
    });
  }
  async function submit(autoSubmitted = false) {
    if (!question) return false;
    return action('Reviewing your answer…', async () => {
      await api('questions/' + question.id + '/answer', {
        method: 'POST',
        body: JSON.stringify({ answer, autoSubmitted }),
      });
      sessionStorage.removeItem('draft:' + question.id);
      await load();
    });
  }
  async function requestHint() {
    if (!question) return;
    await action('Finding a helpful hint…', async () => {
      await api<{ hint: string }>('questions/' + question.id + '/hint', {
        method: 'POST',
      });
      await load();
    });
  }
  async function run(final: boolean, autoSubmitted = false) {
    if (!question) return false;
    return action(
      final
        ? 'Running hidden tests and evaluating your code…'
        : 'Running your code in the sandbox…',
      async () => {
        const result = await api<{ results: TestResult[] }>('questions/' + question.id + '/code', {
          method: 'POST',
          body: JSON.stringify({
            source,
            language,
            final,
            autoSubmitted,
            ...(!final && custom ? { customInput: input } : {}),
          }),
        });
        setResults(result.results);
        if (final) {
          sessionStorage.removeItem('draft:' + question.id);
          await load();
        }
      },
    );
  }
  async function finish() {
    await action('Preparing your report and improvement plan…', async () => {
      await api('sessions/' + id + '/finish', { method: 'POST' });
      await load();
    });
  }
  function speak() {
    if (!question || !('speechSynthesis' in window)) {
      setError('Speech playback is not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(question.question));
  }
  function dictate() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!C) {
      setError('Voice input is not supported in this browser. Please type your answer.');
      return;
    }
    const r = new C();
    recognition.current = r;
    r.lang = 'en-US';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(' ');
      setAnswer((a) => {
        const value = a + (a ? ' ' : '') + text;
        draft(value, source);
        return value;
      });
    };
    r.onend = () => setListening(false);
    r.onerror = (e) => {
      setListening(false);
      setError('Voice input: ' + e.error + '. You can continue typing.');
    };
    setListening(true);
    r.start();
  }
  const answered = session?.questions.filter((q) => q.attempt).length || 0;
  if (!session)
    return (
      <>
        <ErrorNotice message={error} />
        {!error && <Loading />}
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow={completed ? 'ANOTHER STEP FORWARD' : 'YOUR FOCUSED PRACTICE SPACE'}
        title={
          completed
            ? 'Session results'
            : `${session.mode} ${session.mode === 'Mock' ? 'placement test' : 'interview'}`
        }
        description={
          completed
            ? 'Your answers, your insights, and your next steps.'
            : 'Answer each question, then review the feedback.'
        }
      >
        <span className="tag green">
          <span className="live-dot" />
          {completed ? 'Session completed' : 'Session in progress'}
        </span>
      </PageHeading>
      {session.offline && (
        <p className="mb-4 rounded-xl border p-4 text-sm">
          Offline practice: built-in beginner questions, basic answer checks and saved progress.
          Scores are estimates, not AI assessments. Advanced difficulty and AI follow-ups require an
          API key.
        </p>
      )}
      <ErrorNotice message={error} />
      {!completed && (
        <div className="info-notice">
          Switching to another tab automatically submits your current answer, even if it is
          unfinished or blank.
        </div>
      )}
      {tab.notice && (
        <div className="info-notice" role="status">
          {tab.notice}
        </div>
      )}
      {busy && (
        <div className="busy-banner" role="status">
          <span className="pulse-dot" />
          {busy} This can take a moment.
        </div>
      )}
      {completed && session.report && (
        <section className="report-card">
          <div>
            <span className="eyebrow">YOUR SESSION AT A GLANCE</span>
            <h2>
              {session.report.score}% <small>average score</small>
            </h2>
            <p>{session.report.summary}</p>
            <span className="muted">
              {session.report.answered} of {session.report.total} questions answered
            </span>
          </div>
          <div className="report-columns">
            <FeedbackList title="What’s working" items={session.report.strengths} />
            <FeedbackList title="Room to grow" items={session.report.weaknesses} />
            <FeedbackList title="Your next steps" items={session.report.nextSteps} />
          </div>
          <Link href="/plan" className="button">
            View my updated plan <ArrowRight size={17} />
          </Link>
        </section>
      )}
      <div className={'interview-grid ' + (question?.coding && !completed ? 'with-code' : '')}>
        <section className="conversation panel">
          <div className="conversation-header">
            <span className="ai-avatar">
              <AudioLines size={23} />
            </span>
            <div>
              <h3>Interviewer</h3>
              <p>Answer the question below.</p>
            </div>
            <Sparkles size={18} />
          </div>
          <div className="conversation-body">
            {session.questions.length === 0 ? (
              <div className="interview-welcome">
                <span className="icon-box mint">
                  <AudioLines size={32} />
                </span>
                <h2>Ready when you are.</h2>
                <p>
                  Your first question will be generated from your profile, selected focus, and
                  previous practice.
                </p>
                <button disabled={!!busy || expired} onClick={next} className="button">
                  Generate my first question <ArrowRight size={17} />
                </button>
              </div>
            ) : (
              session.questions.map((q, i) => (
                <article key={q.id} className="conversation-turn">
                  <div className="question-meta">
                    <span className="tag">QUESTION {i + 1}</span>
                    <span>
                      {q.topic} · {q.difficulty}
                    </span>
                  </div>
                  <h3>{q.title}</h3>
                  <div className="question-text">{q.question}</div>
                  {q.coding && (
                    <div className="problem-details">
                      <h4>Input format</h4>
                      <p>{q.coding.inputFormat}</p>
                      <h4>Output format</h4>
                      <p>{q.coding.outputFormat}</p>
                      <h4>Constraints</h4>
                      <ul>
                        {q.coding.constraints.map((c, j) => (
                          <li key={j}>{c}</li>
                        ))}
                      </ul>
                      {q.coding.examples.map((e, j) => (
                        <div className="example" key={j}>
                          <strong>Example {j + 1}</strong>
                          <div>
                            <span>Input</span>
                            <pre>{e.input}</pre>
                            <span>Output</span>
                            <pre>{e.output}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {q.attempt ? (
                    <>
                      <div className="student-answer">
                        <span>
                          Your {q.coding ? 'code' : 'answer'}{' '}
                          <small>
                            · {Math.floor(q.attempt.timeTaken / 60)}m {q.attempt.timeTaken % 60}s
                          </small>
                        </span>
                        <pre>{q.attempt.answer}</pre>
                      </div>
                      <details
                        className="feedback"
                        open={i === session.questions.length - 1 || completed}
                      >
                        <summary>
                          <span>
                            <Sparkles size={16} /> Your feedback
                          </span>
                          <strong>
                            {q.attempt.score}/100 <ChevronDown size={15} />
                          </strong>
                        </summary>
                        <div className="feedback-scores">
                          {[
                            ['Accuracy', q.attempt.feedback.technicalAccuracy],
                            ['Reasoning', q.attempt.feedback.reasoning],
                            ['Communication', q.attempt.feedback.communication],
                            ['Completeness', q.attempt.feedback.completeness],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <strong>{value}/10</strong>
                              <small>{label}</small>
                            </div>
                          ))}
                        </div>
                        <FeedbackList
                          title="What you did well"
                          items={q.attempt.feedback.wellDone}
                        />
                        <FeedbackList title="How to improve" items={q.attempt.feedback.improve} />
                        <h4>Explanation</h4>
                        <p className="preserve">{q.attempt.feedback.correctAnswer}</p>
                        {q.attempt.feedback.mistakes.map((m, j) => (
                          <div className="mistake" key={j}>
                            <strong>{m.type}</strong>
                            <p>{m.explanation}</p>
                            <p>
                              <b>Next time:</b> {m.correction}
                            </p>
                          </div>
                        ))}
                        {q.coding && (
                          <p>
                            Time: {q.attempt.feedback.timeComplexity}
                            <br />
                            Space: {q.attempt.feedback.spaceComplexity}
                          </p>
                        )}
                        <p className="muted small">
                          Observed communication: {q.attempt.feedback.confidenceEvidence}
                        </p>
                      </details>
                      {!!q.submissions.length && <SubmissionHistory question={q} />}
                    </>
                  ) : (
                    i === session.questions.length - 1 && (
                      <>
                        {(q.revealedHints || []).map((h, j) => (
                          <div className="hint" key={j}>
                            <Lightbulb size={18} />
                            <p>{h}</p>
                          </div>
                        ))}
                        {!completed && (
                          <div className="question-actions">
                            <button
                              disabled={!!busy || q.hintsUsed >= 2 || expired}
                              onClick={requestHint}
                            >
                              <Lightbulb size={16} /> Hint ({q.hintsUsed}/2)
                            </button>
                            <button onClick={speak}>
                              <Volume2 size={16} /> Read aloud
                            </button>
                          </div>
                        )}
                      </>
                    )
                  )}
                </article>
              ))
            )}
          </div>
          {question && !question.attempt && !question.coding && !completed && (
            <div className="answer-composer">
              <label htmlFor="answer">Your answer</label>
              <textarea
                id="answer"
                value={answer}
                maxLength={20000}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  draft(e.target.value, source);
                }}
                placeholder="Type your answer here..."
                rows={5}
                disabled={!!busy || tab.pending || expired}
              />
              <div>
                <span>Explain how you reached your answer.</span>
                <button
                  className={'icon-button ' + (listening ? 'recording' : '')}
                  aria-label={listening ? 'Stop recording' : 'Dictate answer'}
                  onClick={dictate}
                >
                  {listening ? <Square size={17} /> : <Mic size={18} />}
                </button>
                <button
                  className="button"
                  disabled={!!busy || !answer.trim() || expired}
                  onClick={() => submit()}
                >
                  Submit answer <Send size={16} />
                </button>
              </div>
              <small>Optional voice input uses your browser’s speech service.</small>
            </div>
          )}
          {!completed && question?.attempt && (
            <div className="next-question">
              <p>
                {allAnswered
                  ? 'You’ve completed every question. Let’s look at your progress.'
                  : 'Ready to build on that? Your next question adapts to your answer.'}
              </p>
              <button
                disabled={!!busy || (!allAnswered && expired)}
                onClick={allAnswered ? finish : next}
                className="button"
              >
                {allAnswered ? 'Get my report' : 'Next question'}
                <ArrowRight size={17} />
              </button>
            </div>
          )}
        </section>
        {question?.coding && !question.attempt && !completed ? (
          <aside className="coding-workspace">
            <div className="panel code-panel">
              <div className="code-heading">
                <span>
                  <Braces size={19} /> Code workspace
                </span>
                <select
                  aria-label="Code language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {codingLanguages.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <CodeEditor
                readOnly={!!busy || tab.pending || expired}
                language={language}
                value={source}
                onChange={(v) => {
                  setSource(v);
                  draft(answer, v);
                }}
              />
              <div className="code-controls">
                <label className="inline-label">
                  <input
                    type="checkbox"
                    checked={custom}
                    onChange={(e) => setCustom(e.target.checked)}
                  />{' '}
                  Custom input
                </label>
                <button
                  className="button secondary"
                  disabled={!!busy || !source.trim() || expired}
                  onClick={() => run(false)}
                >
                  <Play size={15} /> Run
                </button>
                <button
                  className="button"
                  disabled={!!busy || !source.trim() || expired}
                  onClick={() => run(true)}
                >
                  Submit <ArrowRight size={15} />
                </button>
              </div>
              {custom && (
                <label className="custom-input">
                  Standard input
                  <textarea
                    rows={3}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    maxLength={10000}
                  />
                </label>
              )}
              <div className="test-panel">
                <h3>Execution results</h3>
                {results.length ? (
                  <TestResults results={results} />
                ) : (
                  <p className="muted">
                    Run your code to check the examples, or submit to evaluate all test cases.
                  </p>
                )}
              </div>
            </div>
            <SessionInfo
              session={session}
              answered={answered}
              remaining={remaining}
              busy={busy}
              finish={finish}
            />
          </aside>
        ) : (
          <aside>
            <SessionInfo
              session={session}
              answered={answered}
              remaining={remaining}
              busy={busy}
              finish={finish}
            />
          </aside>
        )}
      </div>
    </>
  );
}
function SessionInfo({
  session,
  answered,
  remaining,
  busy,
  finish,
}: {
  session: Session;
  answered: number;
  remaining: string;
  busy: string;
  finish: () => void;
}) {
  return (
    <section className="panel session-info">
      <span className="eyebrow">YOUR SESSION</span>
      <h3>Session details</h3>
      <div className="session-stat">
        <span>Current topic</span>
        <strong>{session.questions.at(-1)?.topic || 'Personalized for you'}</strong>
      </div>
      <div className="session-stat">
        <span>Difficulty</span>
        <strong className="capitalize">{session.difficulty}</strong>
      </div>
      <div className="session-stat">
        <span>Questions answered</span>
        <strong>
          {answered} / {session.targetCount}
        </strong>
      </div>
      <div className="progress-track">
        <span style={{ width: (answered / session.targetCount) * 100 + '%' }} />
      </div>
      {remaining && (
        <div className="session-stat">
          <span>
            <Clock size={15} /> Time remaining
          </span>
          <strong>{remaining}</strong>
        </div>
      )}
      <div className="session-tip">
        <Lightbulb size={19} />
        <p>Break down your thinking. It’s okay to pause, explore an idea, or ask for a hint.</p>
      </div>
      {session.status !== 'completed' && (
        <button disabled={!!busy} className="button secondary full" onClick={finish}>
          <Flag size={16} /> Finish & get feedback
        </button>
      )}
      <Link href="/history" className="text-link">
        Your session is saved <Check size={15} />
      </Link>
    </section>
  );
}
function FeedbackList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="feedback-list">
      <h4>{title}</h4>
      {items.length ? (
        <ul>
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No findings recorded.</p>
      )}
    </div>
  );
}
function TestResults({ results }: { results: TestResult[] }) {
  return (
    <div className="test-results">
      {results.map((r, i) => (
        <details key={i}>
          <summary>
            <span className={'test-dot ' + (r.passed ? 'pass' : 'fail')} />
            <strong>
              {r.hidden ? 'Hidden test' : 'Test'} {i + 1}
            </strong>
            <span>{r.status}</span>
          </summary>
          <p>
            {r.time !== null ? `${r.time}s` : 'Time unavailable'} ·{' '}
            {r.memory !== null ? `${r.memory} KB` : 'Memory unavailable'}
          </p>
          {r.hidden ? (
            <p>Hidden test input and output are private.</p>
          ) : (
            <>
              <h4>Output</h4>
              <pre>{r.stdout || '(no output)'}</pre>
              {r.stderr && (
                <>
                  <h4>Error</h4>
                  <pre className="error-output">{r.stderr}</pre>
                </>
              )}
            </>
          )}
        </details>
      ))}
    </div>
  );
}
function SubmissionHistory({ question }: { question: SessionQuestion }) {
  const [items, setItems] = useState(question.submissions);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function more() {
    setBusy(true);
    try {
      const result = await api<{ submissions: SessionQuestion['submissions'] }>(
        `questions/${question.id}/submissions?page=${page + 1}`,
      );
      setItems((v) => [...v, ...result.submissions]);
      setPage((p) => p + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="submission-history">
      <summary>Code runs and submissions ({question.submissionCount || items.length})</summary>
      {items.map((s) => (
        <div key={s.id}>
          <h4>
            {s.isFinal ? 'Final submission' : 'Practice run'} · {s.language} · {s.passed}/{s.total}{' '}
            passed
          </h4>
          <pre>{s.source}</pre>
          <TestResults results={s.results} />
        </div>
      ))}
      <ErrorNotice message={error} />
      {items.length < question.submissionCount && (
        <button disabled={busy} className="button secondary" onClick={more}>
          {busy ? 'Loading…' : 'Load older submissions'}
        </button>
      )}
    </details>
  );
}
