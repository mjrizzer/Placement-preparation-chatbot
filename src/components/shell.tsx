'use client';
import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Command,
  LayoutDashboard,
  AudioLines,
  BrainCircuit,
  Braces,
  GitBranch,
  History,
  UserRound,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { api, ErrorNotice, Loading } from './ui';
export type Student = {
  id: string;
  email: string;
  profile: null | {
    name: string;
    college: string;
    degree: string;
    branch: string;
    graduationYear: number;
    level: string;
    role: string;
    languages: string[];
    areas: string[];
    resumeText: string | null;
  };
};
const StudentContext = createContext<{ user: Student; refresh: () => Promise<void> } | null>(null);
export const useStudent = () => useContext(StudentContext)!;
const links = [
  ['Dashboard', '/dashboard', LayoutDashboard],
  ['AI Interview', '/interview', AudioLines],
  ['Aptitude', '/aptitude', BrainCircuit],
  ['Coding', '/coding', Braces],
  ['DSA', '/dsa', GitBranch],
  ['History', '/history', History],
] as const;
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Student | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: Student | null }>('auth/me');
      if (!data.user) {
        router.replace('/login');
        return;
      }
      setUser(data.user);
      if (!data.user.profile && path !== '/onboarding') router.replace('/onboarding');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [router, path]);
  useEffect(() => {
    void refresh();
    const selected = localStorage.getItem('placement-theme') === 'dark';
    setDark(selected);
    document.documentElement.dataset.theme = selected ? 'dark' : 'light';
  }, [refresh]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setOpen(false);
  }, [path]);
  function theme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('placement-theme', next ? 'dark' : 'light');
  }
  async function signout() {
    try {
      await api('auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!user)
    return (
      <div className="page">
        <ErrorNotice message={error} />
        {error ? (
          <button onClick={refresh} className="button">
            Retry connection
          </button>
        ) : (
          <Loading />
        )}
      </div>
    );
  return (
    <StudentContext.Provider value={{ user, refresh }}>
      <div className="app-shell">
        {open && (
          <button
            className="sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
        )}
        <aside className={'sidebar ' + (open ? 'is-open' : '')}>
          <Link href="/dashboard" className="brand">
            <span className="brand-mark">
              <Command size={21} />
            </span>
            <span>
              AI Placement<small>PREPARE. PRACTICE. PROGRESS.</small>
            </span>
          </Link>
          <button
            className="mobile-close icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </button>
          <div className="workspace-label">YOUR WORKSPACE</div>
          <nav>
            {links.map(([name, href, Icon], i) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={
                  'nav-link ' +
                  (path === href || (href === '/interview' && path.startsWith('/session/'))
                    ? 'active'
                    : '') +
                  (i === 5 ? ' nav-separator' : '')
                }
              >
                <Icon size={18} />
                <span>{name}</span>
                {name === 'AI Interview' && <span className="tiny-label">AI</span>}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-tip">
              <Sparkles size={20} />
              <strong>Ready to practise?</strong>
              <p>Choose a subject and answer a few questions.</p>
              <Link href="/practice">
                Let’s practice <ArrowUpRight size={15} />
              </Link>
            </div>
            <Link className={'nav-link ' + (path === '/profile' ? 'active' : '')} href="/profile">
              <UserRound size={18} />
              Profile
            </Link>
            <Link className={'nav-link ' + (path === '/settings' ? 'active' : '')} href="/settings">
              <Settings size={18} />
              Settings
            </Link>
            <button className="nav-link logout" onClick={signout}>
              <LogOut size={18} />
              Sign out
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setOpen(true)}
              >
                <Menu size={21} />
              </button>
              <span>Workspace</span>
              <span>/</span>
              <strong>
                {links.find((l) => l[1] === path)?.[0] ||
                  (path.startsWith('/session/')
                    ? 'Interview session'
                    : path === '/onboarding'
                      ? 'Welcome'
                      : path === '/profile'
                        ? 'Profile'
                        : 'Settings')}
              </strong>
            </div>
            <div className="topbar-right">
              <span className="focus-label">
                <span className="live-dot" /> Placement practice
              </span>
              <button className="icon-button" onClick={theme} aria-label="Toggle color theme">
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <Link className="avatar" href="/profile" aria-label="Open profile">
                {(user.profile?.name || user.email).slice(0, 2).toUpperCase()}
              </Link>
            </div>
          </header>
          <main className="page">
            <ErrorNotice message={error} />
            {children}
          </main>
          <footer className="app-footer">
            <span>AI Placement Prep</span>
            <span>Placement preparation project.</span>
          </footer>
        </div>
      </div>
    </StudentContext.Provider>
  );
}
