"use client";

// Sign-in: email/password plus Google. Honors ?next= for post-login routing.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import PublicShell from "@/components/PublicShell";
import { AuthArt } from "@/components/spot";
import { Button, Card, Field, Spinner, TextInput } from "@/components/ui";
import { friendlyAuthError, useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/workspace";
  const { user, loading, setupError, signIn, signInWithGoogle } = useAuth();
  const { language } = useLang();
  const t = getStrings(language);
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
      setError(friendlyAuthError(err, language));
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
      setError(friendlyAuthError(err, language));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl items-center gap-10 lg:grid-cols-2">
      <AuthArt />
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t.authSignInTitle}</h1>
      <div className="mt-5">
        <Card>
          {setupError && (
            <p role="alert" className="mb-3 text-sm font-medium text-danger">
              {t.authSetupPrefix} {setupError}
            </p>
          )}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label={t.authEmail} htmlFor="login-email">
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
            <Field label={t.authPassword} htmlFor="login-password">
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
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? t.authSigningIn : t.authSignInTitle}
            </Button>
          </form>
          <div className="mt-4 border-t border-edge pt-4">
            <Button type="button" variant="secondary" onClick={() => void google()} disabled={busy} className="w-full">
              {t.authGoogle}
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-brand underline">
              {t.authForgot}
            </Link>
            <Link
              href={`/register?next=${encodeURIComponent(next)}`}
              className="text-brand underline"
            >
              {t.authCreateAccount}
            </Link>
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}

function LoginFallback() {
  const { language } = useLang();
  const t = getStrings(language);
  return <Spinner label={t.authLoadingSignIn} />;
}

export default function LoginPage() {
  return (
    <PublicShell>
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </PublicShell>
  );
}
