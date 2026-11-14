import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Field } from '../components/ui';
import { LIMITS } from '../lib/constants';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../store/AuthContext';

type Mode = 'sign-in' | 'sign-up' | 'reset';

export function LoginPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const invited = new URLSearchParams(window.location.search).has('invite');

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await work();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === 'sign-in') void run(() => auth.signInWithEmail(email, password));
    else if (mode === 'sign-up') void run(() => auth.signUpWithEmail(name || email.split('@')[0], email, password));
    else
      void run(async () => {
        await auth.resetPassword(email);
        setInfo('비밀번호를 다시 설정하는 메일을 보냈어요. 메일함을 확인해 주세요.');
      });
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-10 text-center">
        <div className="font-serif text-[34px] tracking-[0.04em]">Fade & Days</div>
        <div className="mt-2 text-[10px] tracking-[0.22em] text-muted">EVERY MOMENT LEAVES A LITTLE COLOR</div>
        <p className="mt-6 text-sm leading-relaxed text-muted">
          {invited ? '초대받은 앨범에 참여하려면 먼저 로그인해 주세요.' : '사진과 기록으로 소중한 순간을 보관하고, 소중한 사람과 함께 나눠요.'}
        </p>
      </div>

      <div className="rounded-3xl border border-line bg-paper p-6">
        {mode !== 'reset' && (
          <div className="mb-4 grid grid-cols-2 rounded-full bg-bg p-1 text-[13px]">
            {(
              [
                ['sign-in', '로그인'],
                ['sign-up', '회원가입'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => switchMode(id)}
                className={`rounded-full py-2 transition-colors ${mode === id ? 'bg-paper text-ink shadow-sm' : 'text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {mode === 'reset' && <h2 className="mb-2 font-serif text-xl">비밀번호 찾기</h2>}

        <form onSubmit={handleSubmit}>
          {mode === 'sign-up' && (
            <Field label="이름 (공유 앨범에서 보이는 이름)">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.displayName} placeholder="예) 지우" autoComplete="nickname" />
            </Field>
          )}
          <Field label="이메일">
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          {mode !== 'reset' && (
            <Field label="비밀번호" hint={mode === 'sign-up' ? '6자 이상' : undefined}>
              <input
                className="field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              />
            </Field>
          )}

          {error && <p className="mt-2 rounded-xl bg-danger/8 px-3 py-2.5 text-[13px] text-danger">{error}</p>}
          {info && <p className="mt-2 rounded-xl bg-accent/10 px-3 py-2.5 text-[13px] text-accent">{info}</p>}

          <Button type="submit" className="mt-4 w-full py-3" disabled={busy}>
            {busy ? '잠시만요…' : mode === 'sign-in' ? '로그인' : mode === 'sign-up' ? '가입하기' : '재설정 메일 보내기'}
          </Button>
        </form>

        {mode !== 'reset' ? (
          <>
            <div className="my-5 flex items-center gap-3 text-[11px] text-muted">
              <span className="h-px flex-1 bg-line" />
              또는
              <span className="h-px flex-1 bg-line" />
            </div>
            <Button variant="secondary" className="w-full py-3" disabled={busy} onClick={() => void run(() => auth.signInWithGoogle())}>
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Google로 계속하기
            </Button>
            {mode === 'sign-in' && (
              <button type="button" onClick={() => switchMode('reset')} className="mt-4 block w-full text-center text-xs text-muted underline-offset-2 hover:underline">
                비밀번호를 잊었어요
              </button>
            )}
          </>
        ) : (
          <button type="button" onClick={() => switchMode('sign-in')} className="mt-4 block w-full text-center text-xs text-muted">
            ← 로그인으로 돌아가기
          </button>
        )}
      </div>
    </div>
  );
}
