"use client";

// Firebase Authentication for the workspace: email/password, Google
// sign-in, password reset. Session persistence uses the Firebase web
// default (local persistence: the user stays signed in across restarts).
// Route protection is client-side; data protection is enforced by
// Firestore security rules (see firestore.rules), never by the UI alone.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, probeFirebaseConfig } from "./firebaseClient";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** Set when Firebase itself is misconfigured (not a credentials error). */
  setupError: string | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Maps Firebase Auth error codes to plain-language messages. */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: unknown }).code;
  if (typeof code !== "string") {
    return err instanceof Error ? err.message : "Something went wrong. Please try again.";
  }
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Try signing in instead.";
    case "auth/invalid-email":
      return "That email address doesn't look valid.";
    case "auth/weak-password":
      return "Please choose a password of at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network problem. Check your connection and try again.";
    case "auth/popup-closed-by-user":
      return "The sign-in window was closed before finishing.";
    case "auth/cancelled-popup-request":
      return "Another sign-in window is already open.";
    case "auth/account-exists-with-different-credential":
      return "This email is registered with a different sign-in method. Try email and password.";
    case "auth/operation-not-allowed":
      return "This sign-in method isn't enabled for this project yet.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized for sign-in. localhost works by default.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Env-only probe: safe to run as initial state on server and client.
  const [envProbe] = useState(() => probeFirebaseConfig());
  const [user, setUser] = useState<User | null>(null);
  const [resolved, setResolved] = useState(false);

  // Missing Firebase config is derived during render, not set in an effect.
  const setupError =
    envProbe.missingConfigKeys.length === 0
      ? null
      : `Missing Firebase configuration: ${envProbe.missingConfigKeys.join(",")}.`;

  // Loading is derived: the effect below only subscribes, it never
  // sets state synchronously.
  const loading = setupError === null && !resolved;

  useEffect(() => {
    if (setupError) {
      return;
    }
    return onAuthStateChanged(getFirebaseAuth(), (next) => {
      setUser(next);
      setResolved(true);
    });
  }, [setupError]);

  const signUp = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(getFirebaseAuth(), provider);
  }, []);

  const sendReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, setupError, signUp, signIn, signInWithGoogle, sendReset, signOutUser }),
    [user, loading, setupError, signUp, signIn, signInWithGoogle, sendReset, signOutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return state;
}
