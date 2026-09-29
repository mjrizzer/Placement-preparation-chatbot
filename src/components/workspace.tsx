'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  ArrowRight,
  AudioLines,
  Braces,
  BrainCircuit,
  GitBranch,
  Check,
  Target,
  Sparkles,
  Clock,
  BookOpen,
  TrendingUp,
  Upload,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { useStudent } from './shell';
import { api, Empty, ErrorNotice, Loading, PageHeading } from './ui';
import {
  languages,
  codingLanguages,
  roles,
  topics,
  modes,
  mockSections,
  type Mode,
} from '@/lib/catalog';
const ProgressChart = dynamic(() => import('./charts'), {
  ssr: false,
  loading: () => <Loading label="Loading chart…" />,
});
type Analytics = {
  readiness: number;
  questionsSolved: number;
  codingSolved: number;
  sessionsCompleted: number;
  streak: number;
  codingSuccessRate: number;
  scores: Record<string, { score: number; count: number }>;
  topics: { topic: string; score: number; count: number; trend: number; persistent: boolean }[];
  progress: { date: string; score: number; count: number }[];
  difficultyProgress: { date: string; difficulty: string; score: number }[];
  activeSessions: { id: string; mode: string; startedAt: string }[];
};
const preparation = [
  {
    title: 'AI Interview',
    mode: 'Technical',
    href: '/interview',
    icon: AudioLines,
    color: 'mint',
    description: 'Practise technical and HR questions.',
    meta: 'Technical · HR · Resume',
  },
  {
    title: 'Aptitude',
    mode: 'Aptitude',
    href: '/aptitude',
    icon: BrainCircuit,
    color: 'lavender',
    description: 'Practise quantitative and reasoning questions.',
    meta: 'Quantitative · Logical · Verbal',
  },
  {
    title: 'Coding Practice',
    mode: 'Coding',
    href: '/coding',
    icon: Braces,
    color: 'peach',
    description: 'Write code and check the result.',
    meta: '11 languages · Real execution',
  },
  {
    title: 'DSA Deep Dive',
    mode: 'DSA',
    href: '/dsa',
    icon: GitBranch,
    color: 'blue',
    description: 'Review data structures and algorithms.',
    meta: 'Concepts · Complexity · Optimization',
  },
];
export default function WorkspacePage({ section }: { section: string }) {
  if (section === 'dashboard') return <Dashboard />;
  if (section === 'profile' || section === 'onboarding')
    return <Profile onboarding={section === 'onboarding'} />;
  if (section === 'history') return <HistoryPage />;
  if (section === 'analytics') return <AnalyticsPage />;
  if (section === 'plan') return <Plan />;
  if (section === 'settings') return <Settings />;
  return <Practice section={section} />;
}
function useAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Analytics>('analytics')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return { data, error };
}
function Dashboard() {
  const { user } = useStudent();
  const { data, error } = useAnalytics();
  return (
    <>
      <PageHeading
        eyebrow="AI PLACEMENT PREP"
        title={`Welcome, ${user.profile?.name.split(' ')[0] || 'student'}.`}
        description="Choose a practice area, answer a few questions, and review your results."
      />
      <ErrorNotice message={error} />
      <div className="stat-grid">
        {[
          ['Questions answered', data?.questionsSolved ?? 0],
          ['Average score', data?.questionsSolved ? data.readiness + '%' : 'Not started'],
          ['Coding problems solved', data?.codingSolved ?? 0],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mode-grid">
        {preparation.map((p) => (
          <Link className="mode-card" href={p.href} key={p.title}>
            <span className={'icon-box ' + p.color}>
              <p.icon size={24} />
            </span>
            <h3 style={{ marginTop: 20 }}>{p.title}</h3>
            <p>{p.description}</p>
            <span className="text-link">
              Start practice <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
      <section className="panel" style={{ marginTop: 24 }}>
        <h3>Practice rules</h3>
        <p>
          Switching tabs submits your current answer automatically. In coding questions, type your
          solution yourself: copy and paste are disabled.
        </p>
        <Link href="/history" className="text-link">
          View previous results <ArrowRight size={16} />
        </Link>
      </section>
      {!!data?.activeSessions.length && (
        <section className="panel" style={{ marginTop: 20 }}>
          <h3>Continue a session</h3>
          {data.activeSessions.map((s) => (
            <Link key={s.id} className="list-row" href={'/session/' + s.id}>
              {s.mode} practice <ArrowRight size={16} />
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
function Practice({ section }: { section: string }) {
  const router = useRouter();
  const { user } = useStudent();
  const initial: Mode =
    section === 'coding'
      ? 'Coding'
      : section === 'dsa'
        ? 'DSA'
        : section === 'aptitude'
          ? 'Aptitude'
          : section === 'mock'
            ? 'Mock'
            : 'Technical';
  const [mode, setMode] = useState<Mode>(initial);
  const [difficulty, setDifficulty] = useState('medium');
  const [language, setLanguage] = useState(user.profile?.languages[0] || 'Python');
  const [topic, setTopic] = useState('');
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const requestedMode = query.get('mode');
    const requestedTopic = query.get('topic');
    if (requestedMode && modes.includes(requestedMode as Mode)) setMode(requestedMode as Mode);
    if (requestedTopic) {
      setTopic(requestedTopic.slice(0, 100));
      if (!requestedMode) {
        const category = Object.entries(topics).find(([, names]) =>
          names.includes(requestedTopic),
        )?.[0];
        if (category && modes.includes(category as Mode)) setMode(category as Mode);
      }
    }
  }, []);
  const [company, setCompany] = useState('');
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pool =
    mode === 'Coding' || mode === 'DSA'
      ? topics.DSA
      : mode === 'Aptitude'
        ? [...topics['Quantitative Aptitude'], ...topics['Logical Reasoning'], ...topics.Verbal]
        : topics[mode] || [];
  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const s = await api<{ id: string }>('sessions', {
        method: 'POST',
        body: JSON.stringify({ mode, difficulty, language, topic, company, targetCount: count }),
      });
      router.push('/session/' + s.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="PRACTICE WITH PURPOSE"
        title={
          section === 'coding'
            ? 'Coding practice'
            : section === 'dsa'
              ? 'DSA practice'
              : section === 'aptitude'
                ? 'Aptitude practice'
                : section === 'mock'
                  ? 'Your placement dress rehearsal.'
                  : 'Interview practice'
        }
        description="Choose a subject, language, and difficulty to get started."
      />
      <div className="practice-layout">
        <section className="panel setup-panel">
          <div className="panel-heading">
            <div>
              <h3>Session settings</h3>
              <p>Choose where you want to focus today.</p>
            </div>
            <Sparkles size={23} />
          </div>
          <form onSubmit={start}>
            <label>
              Preparation mode
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as Mode);
                  setTopic('');
                }}
              >
                {modes
                  .filter((m) => ['Technical', 'HR', 'Coding', 'DSA', 'Aptitude'].includes(m))
                  .map((m) => (
                    <option key={m} value={m}>
                      {m === 'Company'
                        ? 'Company simulation'
                        : m === 'Mock'
                          ? 'Full mock placement test'
                          : m === 'Resume'
                            ? 'Resume-based interview'
                            : m}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Difficulty
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  {['easy', 'medium', 'hard', 'expert'].map((d) => (
                    <option key={d} value={d}>
                      {d[0].toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Programming language
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {(['Coding', 'Mock'].includes(mode) ? codingLanguages : languages).map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
            </div>
            {mode !== 'Mock' && (
              <div className="form-row">
                <label>
                  Focus topic
                  <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                    <option value="">Let AI personalize it</option>
                    {pool.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Questions
                  <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                    {[5, 10, 15, 20].map((n) => (
                      <option key={n} value={n}>
                        {n} questions
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {mode === 'Company' && (
              <label>
                Target company
                <input
                  required
                  maxLength={100}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Microsoft"
                />
              </label>
            )}
            {mode === 'Resume' && (
              <div className="info-notice">
                {user.profile?.resumeText
                  ? 'Your uploaded resume will guide this interview.'
                  : 'Upload a resume in your Profile before starting.'}{' '}
                <Link href="/profile">Manage resume →</Link>
              </div>
            )}
            {mode === 'Company' && (
              <div className="info-notice">
                A simulation based on general interview patterns. These are AI-generated questions,
                not actual or confidential company questions.
              </div>
            )}
            {mode === 'Mock' && (
              <div className="mock-sections">
                {mockSections.map((s, i) => (
                  <div key={s.mode}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <strong>{s.mode}</strong>
                    <small>{s.count} questions</small>
                  </div>
                ))}
                <p>
                  <Clock size={15} /> 120 minutes · 72 questions · Progress saves after every answer
                </p>
              </div>
            )}
            <ErrorNotice message={error} />
            <button className="button full" disabled={busy}>
              {busy ? 'Preparing your session…' : 'Let’s get started'} <ArrowRight size={18} />
            </button>
          </form>
        </section>
        <aside className="practice-aside">
          <div className="practice-illustration">
            <AudioLines size={56} strokeWidth={1.3} />
            <span className="orbit-dot one" />
            <span className="orbit-dot two" />
          </div>
          <span className="eyebrow">A PRACTICE PARTNER THAT GETS YOU</span>
          <h2>
            More than questions.
            <br />A way forward.
          </h2>
          <div className="benefit">
            <Check />
            <div>
              <strong>Built around you</strong>
              <p>Your role, your skills, your past performance.</p>
            </div>
          </div>
          <div className="benefit">
            <Check />
            <div>
              <strong>Room to think</strong>
              <p>One question at a time. A hint when you need it.</p>
            </div>
          </div>
          <div className="benefit">
            <Check />
            <div>
              <strong>Feedback you can use</strong>
              <p>Understand the mistake. Learn the next step.</p>
            </div>
          </div>
        </aside>
      </div>
      <section className="panel topic-panel">
        <div className="panel-heading">
          <div>
            <h3>So much to explore</h3>
            <p>Choose a topic or let your progress guide you.</p>
          </div>
          <BookOpen size={20} />
        </div>
        <div className="topic-chips">
          {(pool.length ? pool : topics.Technical).map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={'chip ' + (topic === t ? 'selected' : '')}
            >
              {t}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
function Profile({ onboarding = false }: { onboarding?: boolean }) {
  const { user, refresh } = useStudent();
  const router = useRouter();
  const p = user.profile;
  const [selected, setSelected] = useState(p?.languages || ['Python']);
  const [areas, setAreas] = useState(p?.areas.join(', ') || '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const f = new FormData(e.currentTarget);
    try {
      await api('profile', {
        method: 'PUT',
        body: JSON.stringify({
          ...Object.fromEntries(f),
          languages: selected,
          areas: areas
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          graduationYear: Number(f.get('graduationYear')),
        }),
      });
      await refresh();
      setNotice('Your profile is saved.');
      if (onboarding) router.push('/dashboard');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    setBusy(true);
    setError('');
    const f = new FormData();
    f.set('file', file);
    try {
      await api('resume', { method: 'POST', body: f });
      await refresh();
      setNotice('Resume uploaded. You can now start a resume-based interview.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow={onboarding ? 'FIRST, A LITTLE ABOUT YOU' : 'YOUR PREPARATION, PERSONALIZED'}
        title={onboarding ? 'Set up your profile' : 'Your profile.'}
        description="Help your AI interviewer understand your background and where you want to go."
      />
      <div className="profile-layout">
        <section className="panel">
          <form onSubmit={save}>
            <h3>Your background</h3>
            <div className="form-row">
              <label>
                Full name
                <input name="name" required minLength={2} maxLength={100} defaultValue={p?.name} />
              </label>
              <label>
                College
                <input name="college" required maxLength={200} defaultValue={p?.college} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Degree
                <input name="degree" required defaultValue={p?.degree} placeholder="e.g. B.Tech" />
              </label>
              <label>
                Branch
                <input
                  name="branch"
                  required
                  defaultValue={p?.branch}
                  placeholder="e.g. Computer Science"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Graduation year
                <input
                  type="number"
                  name="graduationYear"
                  min={2000}
                  max={2050}
                  required
                  defaultValue={p?.graduationYear || 2027}
                />
              </label>
              <label>
                Current skill level
                <select name="level" defaultValue={p?.level || 'beginner'}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>
            <h3 className="form-subtitle">Where you want to go</h3>
            <label>
              Target role
              <select name="role" defaultValue={p?.role || roles[0]}>
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>
                Preferred languages <small>Select all that apply</small>
              </legend>
              <div className="topic-chips">
                {languages.map((l) => (
                  <button
                    type="button"
                    aria-pressed={selected.includes(l)}
                    key={l}
                    onClick={() =>
                      setSelected((s) => (s.includes(l) ? s.filter((x) => x !== l) : [...s, l]))
                    }
                    className={'chip ' + (selected.includes(l) ? 'selected' : '')}
                  >
                    {selected.includes(l) && <Check size={14} />} {l}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              Areas you want to improve
              <input
                value={areas}
                onChange={(e) => setAreas(e.target.value)}
                placeholder="Dynamic Programming, Probability, Communication"
              />
              <small>Separate topics with commas.</small>
            </label>
            <ErrorNotice message={error} />
            {notice && (
              <p role="status" className="success-notice">
                {notice}
              </p>
            )}
            <button className="button" disabled={busy || !selected.length}>
              {busy ? 'Saving…' : onboarding ? 'Create my workspace' : 'Save profile'}
              <ArrowRight size={17} />
            </button>
          </form>
        </section>
        <aside>
          <section className="panel resume-upload">
            <span className="icon-box lavender">
              <FileText size={23} />
            </span>
            <h3>
              Bring your experience
              <br />
              into the conversation.
            </h3>
            <p>Upload your resume for questions grounded in your projects and skills.</p>
            {p ? (
              <>
                <label className="upload-zone">
                  <Upload size={26} />
                  <strong>{busy ? 'Processing…' : 'Upload your resume'}</strong>
                  <span>Text-based PDF or TXT · Up to 2 MB</span>
                  <input
                    disabled={busy}
                    aria-label="Upload resume"
                    type="file"
                    accept=".pdf,.txt"
                    onChange={(e) => {
                      if (e.target.files?.[0]) void upload(e.target.files[0]);
                    }}
                  />
                </label>
                {p.resumeText && (
                  <>
                    <p className="success-notice">
                      <Check size={16} /> Resume is ready
                    </p>
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api('resume', { method: 'DELETE' });
                          await refresh();
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Remove resume
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="info-notice">Save your profile first to upload a resume.</div>
            )}
            <small>
              Only extracted text is stored. Relevant text is sent to the AI provider when you
              practice.
            </small>
          </section>
        </aside>
      </div>
    </>
  );
}
type HistorySession = {
  id: string;
  mode: string;
  difficulty: string;
  language: string;
  status: string;
  startedAt: string;
  questions: { attempt: { score: number } | null }[];
};
function HistoryPage() {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    setLoading(true);
    api<{ sessions: HistorySession[]; total: number }>(`sessions?page=${page}`)
      .then((d) => {
        setSessions(d.sessions);
        setTotal(d.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);
  return (
    <>
      <PageHeading
        eyebrow="EVERY SESSION IS A STEP FORWARD"
        title="Practice history"
        description="Revisit your answers, understand your mistakes, and see how far you’ve come."
      />
      <ErrorNotice message={error} />
      <section className="panel">
        {loading ? (
          <Loading />
        ) : !sessions.length ? (
          <Empty
            title="No sessions yet"
            description="Start an interview. Your questions, answers, and feedback will be saved here."
          >
            <Link className="button" href="/interview">
              Start your first interview <ArrowRight size={16} />
            </Link>
          </Empty>
        ) : (
          <>
            <div className="history-list">
              {sessions.map((s) => {
                const attempts = s.questions.flatMap((q) => (q.attempt ? [q.attempt] : []));
                const score = attempts.length
                  ? Math.round(attempts.reduce((n, a) => n + a.score, 0) / attempts.length)
                  : null;
                return (
                  <Link href={'/session/' + s.id} key={s.id} className="history-row">
                    <span className="icon-box mint">
                      {s.mode === 'Coding' ? <Braces size={21} /> : <AudioLines size={21} />}
                    </span>
                    <div className="history-main">
                      <h3>
                        {s.mode} {s.mode === 'Mock' ? 'placement test' : 'interview'}
                      </h3>
                      <p>
                        {new Date(s.startedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        · {s.language} · {s.difficulty}
                      </p>
                    </div>
                    <span className={'tag ' + (s.status === 'completed' ? 'green' : '')}>
                      {s.status === 'completed' ? 'Completed' : 'In progress'}
                    </span>
                    <div className="history-score">
                      <strong>{score === null ? '—' : score + '%'}</strong>
                      <small>{attempts.length} answered</small>
                    </div>
                    <ChevronRight size={19} />
                  </Link>
                );
              })}
            </div>
            <div className="pagination">
              <button
                className="button secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.ceil(total / 12)}
              </span>
              <button
                className="button secondary"
                disabled={page * 12 >= total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
function AnalyticsPage() {
  const { data, error } = useAnalytics();
  return (
    <>
      <PageHeading
        eyebrow="LET YOUR PROGRESS DO THE TALKING"
        title="A clearer picture of you."
        description="Real performance, useful patterns, and opportunities to grow."
      />
      <ErrorNotice message={error} />
      {!data ? (
        !error && <Loading />
      ) : !data.questionsSolved ? (
        <section className="panel">
          <Empty
            title="First, a little practice"
            description="Analytics will appear after you answer your first question."
          >
            <Link href="/practice" className="button">
              Choose a practice mode <ArrowRight size={17} />
            </Link>
          </Empty>
        </section>
      ) : (
        <>
          <div className="stat-grid">
            {[
              ['Overall readiness', data.readiness + '%'],
              ['Questions answered', data.questionsSolved],
              ['Coding success', data.codingSuccessRate + '%'],
              ['Current streak', data.streak + ' days'],
            ].map(([label, value]) => (
              <div className="stat-card" key={label}>
                <span className="icon-box mint">
                  <TrendingUp size={21} />
                </span>
                <div>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Score over time</h3>
                <p>Daily average across all practice modes</p>
              </div>
              <span className="tag">Last 90 days</span>
            </div>
            <ProgressChart data={data.progress} />
          </section>
          <div className="analytics-grid">
            <section className="panel">
              <h3>Topic performance</h3>
              {data.topics.map((t) => (
                <div className="topic-result" key={t.topic}>
                  <div>
                    <strong>{t.topic}</strong>
                    <small>
                      {t.count} attempts {t.persistent ? '· Persistent weakness' : ''}
                    </small>
                  </div>
                  <span className={'tag ' + (t.score >= 80 ? 'green' : '')}>{t.score}%</span>
                  {t.trend !== 0 && (
                    <small>
                      {t.trend > 0 ? '↑ Improving' : '↓ Declining'} {Math.abs(t.trend)} pts
                    </small>
                  )}
                </div>
              ))}
            </section>
            <section className="panel">
              <h3>Practice areas</h3>
              {Object.entries(data.scores).map(([name, s]) => (
                <div className="topic-result" key={name}>
                  <strong>{name}</strong>
                  <span>{s.count ? s.score + '%' : 'Not assessed'}</span>
                </div>
              ))}
              <h3 className="form-subtitle">Difficulty progression</h3>
              <div className="difficulty-timeline">
                {data.difficultyProgress.slice(-10).map((d, i) => (
                  <span className="tag" key={i}>
                    {d.difficulty} · {d.score}%
                  </span>
                ))}
              </div>
              <p className="muted small">
                Coding success counts final submissions passing every test. Trends compare earlier
                and recent attempts, with at least four attempts per topic.
              </p>
            </section>
          </div>
        </>
      )}
    </>
  );
}
type PlanData = {
  id: string;
  summary: string;
  createdAt: string;
  tasks: {
    id: string;
    day: number;
    title: string;
    topic: string;
    mode: string;
    minutes: number;
    completed: boolean;
  }[];
};
function Plan() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api<PlanData | null>('plans')
      .then(setPlan)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function generate() {
    setBusy(true);
    setError('');
    try {
      setPlan(await api<PlanData>('plans', { method: 'POST' }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(id: string, completed: boolean) {
    try {
      await api('tasks/' + id, { method: 'PATCH', body: JSON.stringify({ completed }) });
      setPlan((p) =>
        p ? { ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, completed } : t)) } : p,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="TURN INSIGHT INTO ACTION"
        title="Your path forward."
        description="Small, intentional steps. A plan that grows with your progress."
      >
        <button className="button" disabled={busy} onClick={generate}>
          <RefreshCw size={17} className={busy ? 'spin' : ''} />
          {busy ? 'Building your plan…' : plan ? 'Refresh my plan' : 'Create my plan'}
        </button>
      </PageHeading>
      <ErrorNotice message={error} />
      {loading ? (
        <Loading />
      ) : !plan ? (
        <section className="panel">
          <Empty
            title="Let’s give your practice a little direction"
            description="Create a personalized study plan. Each completed interview will also update it automatically."
          />
        </section>
      ) : (
        <>
          <div className="plan-summary">
            <span className="icon-box mint">
              <Target size={25} />
            </span>
            <div>
              <span className="eyebrow">YOUR PERSONAL ROADMAP</span>
              <h3>{plan.summary}</h3>
              <p>
                {plan.tasks.filter((t) => t.completed).length} of {plan.tasks.length} steps
                completed · Updated {new Date(plan.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="plan-days">
            {Array.from(new Set(plan.tasks.map((t) => t.day))).map((day) => (
              <section className="panel plan-day" key={day}>
                <div className="day-label">
                  <span>{String(day).padStart(2, '0')}</span>
                  <div>
                    <h3>Day {day}</h3>
                    <p>
                      {plan.tasks.filter((t) => t.day === day).reduce((n, t) => n + t.minutes, 0)}{' '}
                      minutes of focused growth
                    </p>
                  </div>
                </div>
                {plan.tasks
                  .filter((t) => t.day === day)
                  .map((t) => (
                    <div className={'plan-task ' + (t.completed ? 'done' : '')} key={t.id}>
                      <input
                        type="checkbox"
                        checked={t.completed}
                        aria-label={'Complete ' + t.title}
                        onChange={(e) => toggle(t.id, e.target.checked)}
                      />
                      <div>
                        <strong>{t.title}</strong>
                        <p>
                          {t.topic} · {t.minutes} min · {t.mode}
                        </p>
                      </div>
                      <Link
                        href={
                          '/practice?mode=' +
                          encodeURIComponent(t.mode) +
                          '&topic=' +
                          encodeURIComponent(t.topic)
                        }
                        aria-label={'Practice ' + t.topic}
                      >
                        <ArrowUpRight size={20} />
                      </Link>
                    </div>
                  ))}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
function Settings() {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await api('settings/password', {
        method: 'POST',
        body: JSON.stringify({ current: f.get('current'), password: f.get('password') }),
      });
      setNotice('Password updated. Other sessions have been signed out.');
      form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your settings."
        description="Keep your account secure and your workspace comfortable."
      />
      <section className="panel settings-panel">
        <h3>Change your password</h3>
        <form onSubmit={save}>
          <label>
            Current password
            <input required name="current" type="password" autoComplete="current-password" />
          </label>
          <label>
            New password
            <input
              required
              minLength={12}
              maxLength={72}
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 12 characters"
            />
          </label>
          <ErrorNotice message={error} />
          {notice && (
            <p role="status" className="success-notice">
              {notice}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
            <ShieldCheck size={17} />
          </button>
        </form>
        <div className="settings-note">
          <h3>Appearance</h3>
          <p>
            Use the sun or moon icon in the top bar to switch between light and dark themes. Your
            preference stays on this device.
          </p>
        </div>
        <div className="settings-note">
          <h3>Voice practice</h3>
          <p>
            Question playback is available in the interview workspace. Speech input is optional and
            depends on browser support. You can always type your answer.
          </p>
        </div>
      </section>
    </>
  );
}
