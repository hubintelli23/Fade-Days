import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from './app';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/**
 * 회원가입 직후에는 onAuthStateChanged가 updateProfile보다 먼저 불릴 수 있다.
 * 그래서 가입할 때 입력한 이름을 잠시 보관해 두고, 프로필 문서를 처음 만들 때 사용한다.
 */
let pendingDisplayName: string | null = null;
export function consumePendingDisplayName() {
  const name = pendingDisplayName;
  pendingDisplayName = null;
  return name;
}

export function watchAuth(callback: (user: AuthUser | null) => void) {
  return onAuthStateChanged(auth, (u) => callback(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null));
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUpWithEmail(displayName: string, email: string, password: string) {
  pendingDisplayName = displayName.trim();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(credential.user, { displayName: displayName.trim() });
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOut() {
  await firebaseSignOut(auth);
}
