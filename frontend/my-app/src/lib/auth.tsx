"use client";

// Firebase Authentication for the workspace: email/password, Google
// sign-in, password reset. Session persistence uses the Firebase web
// default (local persistence: the user stays signed in across restarts).
// Route protection is client-side; data protection is enforced by
// Firestore security rules (see firestore.rules), never by the UI alone.
//
// Error copy renders in the UI language (default English). The Indonesian
// messages are WORKING DRAFTS needing native-speaker review — never
// present them as final.

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
import type { UiLanguage } from "./strings";

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
export function friendlyAuthError(err: unknown, language: UiLanguage = "en"): string {
  const code = (err as { code?: unknown }).code;
  // Indonesian messages are WORKING DRAFTS needing native-speaker review.
  const fallback =
    language === "id" ? "Terjadi kesalahan. Silakan coba lagi." : "Something went wrong. Please try again.";
  if (typeof code !== "string") {
    return err instanceof Error ? err.message : fallback;
  }
  const id = language === "id";
  switch (code) {
    case "auth/email-already-in-use":
      return id
        ? "Email ini sudah terdaftar. Coba masuk sebagai gantinya."
        : "This email is already registered. Try signing in instead.";
    case "auth/invalid-email":
      return id ? "Alamat email itu tampak tidak valid." : "That email address doesn't look valid.";
    case "auth/weak-password":
      return id
        ? "Pilih kata sandi minimal 6 karakter."
        : "Please choose a password of at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return id ? "Email atau kata sandi salah." : "Email or password is incorrect.";
    case "auth/user-disabled":
      return id
        ? "Akun ini telah dinonaktifkan. Silakan hubungi dukungan."
        : "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return id
        ? "Terlalu banyak percobaan. Tunggu sebentar dan coba lagi."
        : "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return id
        ? "Masalah jaringan. Periksa koneksi Anda dan coba lagi."
        : "Network problem. Check your connection and try again.";
    case "auth/popup-closed-by-user":
      return id
        ? "Jendela masuk ditutup sebelum selesai."
        : "The sign-in window was closed before finishing.";
    case "auth/cancelled-popup-request":
      return id
        ? "Jendela masuk lain sudah terbuka."
        : "Another sign-in window is already open.";
    case "auth/account-exists-with-different-credential":
      return id
        ? "Email ini terdaftar dengan metode masuk lain. Coba email dan kata sandi."
        : "This email is registered with a different sign-in method. Try email and password.";
    case "auth/operation-not-allowed":
      return id
        ? "Metode masuk ini belum diaktifkan untuk proyek ini."
        : "This sign-in method isn't enabled for this project yet.";
    case "auth/unauthorized-domain":
      return id
        ? "Domain ini tidak diotorisasi untuk masuk. localhost berfungsi secara default."
        : "This domain isn't authorized for sign-in. localhost works by default.";
    default:
      return fallback;
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
