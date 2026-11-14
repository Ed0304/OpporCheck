"use client";

// Sign-in: email/password plus Google. Honors ?next= for post-login routing.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import PublicShell from "@/components/PublicShell";
import { Button, Card, Field, Spinner, TextInput } from "@/components/ui";
import { friendlyAuthError, useAuth } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/workspace";
  const { user, loading, setupError, signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(next);
    }
  }, [loading, user, next, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace(next);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.replace(next);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-3xl font-bold tracking-tight text-navy">Sign in</h1>
      <div className="mt-5">
        <Card>
          {setupError && (
            <p role="alert" className="mb-3 text-sm font-medium text-red-700">
              Firebase isn&apos;t configured: {setupError}
            </p>
          )}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Email" htmlFor="login-email">
              <TextInput
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <TextInput
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </Field>
            {error && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="mt-4 border-t border-edge pt-4">
            <Button type="button" variant="secondary" onClick={() => void google()} disabled={busy} className="w-full">
              Continue with Google
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-brand underline">
              Forgot password?
            </Link>
            <Link href="/register" className="text-brand underline">
              Create account
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PublicShell>
      <Suspense fallback={<Spinner label="Loading sign-in…" />}>
        <LoginForm />
      </Suspense>
    </PublicShell>
  );
}
