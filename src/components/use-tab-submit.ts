'use client';
import { useEffect, useEffectEvent, useState } from 'react';

// Queue a submission when the page is hidden, including while a Run/Hint request is finishing.
export function useTabSubmit(
  questionId: string | undefined,
  active: boolean,
  busy: boolean,
  submit: () => Promise<boolean>,
) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const onHidden = useEffectEvent(() => {
    if (document.visibilityState === 'hidden' && active && !pending) {
      setPending(true);
      setNotice('You switched tabs. Submitting your current answer automatically…');
    }
  });
  const send = useEffectEvent(async () => {
    const success = await submit();
    setPending(false);
    setNotice(
      success
        ? 'Your answer was submitted automatically because you switched tabs.'
        : 'Automatic submission failed. Your answer is still here; please submit it again.',
    );
  });
  useEffect(() => {
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, []);
  useEffect(() => {
    if (pending && !busy) {
      if (active) void send();
      else setPending(false);
    }
  }, [pending, busy, active]);
  useEffect(() => {
    setPending(false);
    setNotice('');
  }, [questionId]);
  return { pending, notice };
}
