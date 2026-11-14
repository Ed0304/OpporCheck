// Client-only Firebase initialization for the AI Logic hybrid demo.
//
// Runs entirely in the browser: Firebase App -> App Check -> AI Logic
// (Gemini Developer API backend with replay protection).
// All configuration comes from NEXT_PUBLIC_* environment variables.

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";
import { getAuth, type Auth } from "firebase/auth";

export type AppCheckStatus = "configured" | "missing-site-key";

export interface FirebaseClientState {
  app: FirebaseApp;
  ai: AI;
  appCheckStatus: AppCheckStatus;
  /** Config keys that are missing or empty. Empty means configured. */
  missingConfigKeys: string[];
  cloudModelName: string;
}

const REQUIRED_CONFIG: Array<[key: string, value: string | undefined]> = [
  ["NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY],
  ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN],
  ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID],
  ["NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID],
];

let cached: FirebaseClientState | null = null;
let appCheckInitAttempted = false;

function readEnv(): { missing: string[]; cloudModelName: string } {
  const missing = REQUIRED_CONFIG.filter(([, value]) => !value || value.trim() === "").map(
    ([key]) => key,
  );
  const cloudModelName =
    process.env.NEXT_PUBLIC_AILOGIC_CLOUD_MODEL?.trim() || "gemini-3.5-flash-lite";
  return { missing, cloudModelName };
}

function initAppCheck(app: FirebaseApp): AppCheckStatus {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY?.trim();
  if (!siteKey) {
    return "missing-site-key";
  }
  if (!appCheckInitAttempted) {
    appCheckInitAttempted = true;
    if (process.env.NODE_ENV === "development" && typeof self !== "undefined") {
      // Debug token for localhost: stable token from env, else auto-generate.
      // Never hardcode a token string here; the console-registered value
      // lives only in a gitignored .env.local.
      (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
        process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN?.trim() || true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  return "configured";
}

/**
 * Returns the shared Firebase client state. Must only be called in the
 * browser (client components / event handlers), never during SSR.
 */
export function getFirebaseClient(): FirebaseClientState {
  if (typeof window === "undefined") {
    throw new Error("Firebase AI Logic must run in the browser, not on the server.");
  }
  if (cached) {
    return cached;
  }
  const { missing, cloudModelName } = readEnv();
  if (missing.length > 0) {
    throw new Error(`Missing Firebase configuration: ${missing.join(", ")}.`);
  }
  const app =
    getApps().length > 0
      ? getApps()[0]!
      : initializeApp({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
        });
  const appCheckStatus = initAppCheck(app);
  // Limited-use App Check tokens are required for replay protection on
  // generative models; without this, cloud calls fail with HTTP 403.
  const ai = getAI(app, {
    backend: new GoogleAIBackend(),
    useLimitedUseAppCheckTokens: true,
  });
  cached = { app, ai, appCheckStatus, missingConfigKeys: [], cloudModelName };
  return cached;
}

let cachedAuth: Auth | null = null;

/**
 * Shared Firebase Auth instance for the workspace. Additive helper: it
 * reuses the app from getFirebaseClient and changes no existing behavior.
 */
export function getFirebaseAuth(): Auth {
  if (typeof window === "undefined") {
    throw new Error("Firebase Auth must run in the browser, not on the server.");
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseClient().app);
  }
  return cachedAuth;
}

/** Non-throwing config probe for rendering setup status in the UI. */
export function probeFirebaseConfig(): { missingConfigKeys: string[]; cloudModelName: string } {
  const { missing, cloudModelName } = readEnv();
  return { missingConfigKeys: missing, cloudModelName };
}
