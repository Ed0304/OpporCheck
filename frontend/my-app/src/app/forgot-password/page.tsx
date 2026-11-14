"use client";

// Password reset: sends a Firebase reset email, then confirms (without
// revealing whether the address is registered, per Firebase behavior).

import Link from "next/link";
import { useState } from "react";
import PublicShell from "@/components/PublicShell";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { friendlyAuthError, useAuth } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const { sendReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendReset(email);
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-tight text-navy">Reset password</h1>
        <div className="mt-5">
          <Card>
            {sent ? (
              <div>
                <p className="leading-6">
                  If an account exists for <strong>{email}</strong>, a reset link is on
                  its way. Please check your inbox (and spam folder).
                </p>
                <p className="mt-3 text-sm">
                  <Link href="/login" className="text-brand underline">
                    Back to sign in
                  </Link>
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <Field label="Email" htmlFor="reset-email">
                  <TextInput
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy}
                  />
                </Field>
                {error && (
                  <p role="alert" className="text-sm font-medium text-red-700">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
                <p className="text-sm">
                  <Link href="/login" className="text-brand underline">
                    Back to sign in
                  </Link>
                </p>
              </form>
            )}
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
