import Link from 'next/link';
import { BookOpen, Code2, MessageSquare, ArrowRight, GraduationCap } from 'lucide-react';
export default function Landing() {
  return (
    <div className="student-site">
      <nav className="student-nav">
        <Link className="brand" href="/">
          <GraduationCap size={28} /> Placement Prep
        </Link>
        <Link href="/login" className="button secondary">
          Sign in
        </Link>
      </nav>
      <main className="student-main">
        <section className="student-intro">
          <span className="demo-label">FOR CAMPUS PLACEMENTS</span>
          <h1>
            A place to practise
            <br />
            before the interview.
          </h1>
          <p>
            Work through aptitude questions, brush up on data structures, and practise writing code.
            Review your answers when you finish.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/signup">
              Create an account <ArrowRight size={17} />
            </Link>
            <Link className="button secondary" href="/demo">
              Try the sample session
            </Link>
          </div>
          <p className="small" style={{ marginTop: 18 }}>
            The sample works without signing in. Regular sessions use the configured AI service.
          </p>
        </section>
        <section className="student-cards">
          {[
            {
              icon: MessageSquare,
              title: 'Interview practice',
              text: 'Answer technical and HR questions in short sessions.',
              href: '/interview',
            },
            {
              icon: BookOpen,
              title: 'Aptitude & DSA',
              text: 'Practise calculations, reasoning, and basic data structures.',
              href: '/aptitude',
            },
            {
              icon: Code2,
              title: 'Coding',
              text: 'Write your own solution and submit it for review.',
              href: '/coding',
            },
          ].map((c) => (
            <Link href={c.href} className="panel" key={c.title}>
              <c.icon size={26} />
              <h2>{c.title}</h2>
              <p>{c.text}</p>
              <span className="text-link">
                Open practice <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </section>
        <section className="student-rules">
          <h2>How a session works</h2>
          <ol>
            <li>Choose a subject and difficulty.</li>
            <li>Answer one question at a time.</li>
            <li>Check your feedback and saved results.</li>
          </ol>
          <p>
            Stay on the question tab: switching tabs submits your answer automatically. Copy and
            paste are disabled for coding.
          </p>
        </section>
      </main>
      <footer className="student-nav">
        <span>Placement Prep</span>
        <span>A student placement preparation project.</span>
      </footer>
    </div>
  );
}
