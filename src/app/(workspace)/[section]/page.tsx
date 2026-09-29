import WorkspacePage from '@/components/workspace';
import { notFound } from 'next/navigation';
const sections = [
  'dashboard',
  'interview',
  'aptitude',
  'coding',
  'dsa',
  'mock',
  'practice',
  'history',
  'analytics',
  'plan',
  'profile',
  'settings',
  'onboarding',
];
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <WorkspacePage key={section} section={section} />;
}
