"use client";

// Registration: email/password plus Google. New accounts land in /workspace.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PublicShell from "@/components/PublicShell";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { friendlyAuthError, useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, setupError, signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/workspace");
    }
  }, [loading, user, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signUp(email, password);
      router.replace("/workspace");
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
      router.replace("/workspace");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-tight text-navy">Create account</h1>
        <div className="mt-5">
          <Card>
                {setupError && (
                  <p role="alert" className="mb-3 text-sm font-medium text-red-700">
                    Firebase isn&apos;t configured: {setupError}
                  </p>
                )}
                <form onSubmit={submit} className="flex flex-col gap-4">
                  <Field label="Email" htmlFor="register-email">
                    <TextInput
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={busy}
                    />
                  </Field>
                  <Field
                    label="Password"
                    htmlFor="register-password"
                    hint="At least 6 characters."
                  >
                    <TextInput
                      id="register-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
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
                    {busy ? "Creating account…" : "Create account"}
                  </Button>
                </form>
                <div className="mt-4 border-t border-edge pt-4">
                  <Button type="button" variant="secondary" onClick={() => void google()} disabled={busy} className="w-full">
                    Continue with Google
                  </Button>
                </div>
                <p className="mt-4 text-sm">
                  Already have an account?{" "}
                  <Link href="/login" className="text-brand underline">
                    Sign in
                  </Link>
                </p>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
