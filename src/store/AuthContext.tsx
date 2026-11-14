import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { isFirebaseConfigured } from '../db/firebase/config';
import type { AuthUser } from '../db/firebase/auth';
import type { Repository } from '../db/types';

/**
 * 로그인 상태
 *  - local      : Firebase 설정이 없어 로그인 없이 이 기기에만 저장
 *  - signed-out : Firebase 모드인데 로그인 전
 *  - signed-in  : 로그인 완료. repository가 준비돼 있다
 */
export type AuthState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'local'; repository: Repository }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AuthUser; repository: Repository };

interface AuthActions {
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(name: string, email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
}

type AuthValue = { state: AuthState } & AuthActions;

const AuthContext = createContext<AuthValue | null>(null);

// Firebase SDK는 설정이 있을 때만 내려받는다
const loadAuth = () => import('../db/firebase/auth');
const loadRepository = () => import('../db/firebase/firebaseRepository');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    if (!isFirebaseConfigured) {
      import('../db/localRepository').then(
        ({ localRepository }) => !cancelled && setState({ status: 'local', repository: localRepository }),
        (e: unknown) => !cancelled && setState({ status: 'error', error: String(e) }),
      );
    } else {
      Promise.all([loadAuth(), loadRepository()]).then(
        ([authModule, repoModule]) => {
          if (cancelled) return;
          let currentUid: string | null = null;
          unsubscribe = authModule.watchAuth((user) => {
            if (user && user.uid === currentUid) return; // 같은 사용자면 저장소를 새로 만들지 않는다
            currentUid = user?.uid ?? null;
            setState(user ? { status: 'signed-in', user, repository: repoModule.createFirebaseRepository(user) } : { status: 'signed-out' });
          });
        },
        (e: unknown) => !cancelled && setState({ status: 'error', error: `Firebase를 불러오지 못했어요. ${String(e)}` }),
      );
    }
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      state,
      signInWithEmail: async (email, password) => (await loadAuth()).signInWithEmail(email, password),
      signUpWithEmail: async (name, email, password) => (await loadAuth()).signUpWithEmail(name, email, password),
      signInWithGoogle: async () => (await loadAuth()).signInWithGoogle(),
      resetPassword: async (email) => (await loadAuth()).resetPassword(email),
      signOut: async () => {
        if (isFirebaseConfigured) await (await loadAuth()).signOut();
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider 안에서 사용해야 해요.');
  return value;
}
