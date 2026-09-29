import InterviewWorkspace from '@/components/interview';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <InterviewWorkspace id={(await params).id} />;
}
