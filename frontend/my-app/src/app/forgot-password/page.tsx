"use client";

// Password reset: sends a Firebase reset email, then confirms (without
// revealing whether the address is registered, per Firebase behavior).

import Link from "next/link";
import { useState } from "react";
import PublicShell from "@/components/PublicShell";
import { AuthArt } from "@/components/spot";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { friendlyAuthError, useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

export default function ForgotPasswordPage() {
  const { sendReset } = useAuth();
  const { language } = useLang();
  const t = getStrings(language);
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
      setError(friendlyAuthError(err, language));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <div className="mx-auto grid w-full max-w-4xl items-center gap-10 lg:grid-cols-2">
        <AuthArt />
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-3xl font-bold tracking-tight text-navy">{t.authResetTitle}</h1>
        <div className="mt-5">
          <Card>
            {sent ? (
              <div>
                <p className="leading-6">
                  {t.authResetSentBefore} <strong>{email}</strong>
                  {t.authResetSentAfter}
                </p>
                <p className="mt-3 text-sm">
                  <Link href="/login" className="text-brand underline">
                    {t.commonBackToSignIn}
                  </Link>
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <Field label={t.authEmail} htmlFor="reset-email">
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
                  {busy ? t.authSending : t.authSendReset}
                </Button>
                <p className="text-sm">
                  <Link href="/login" className="text-brand underline">
                    {t.commonBackToSignIn}
                  </Link>
                </p>
              </form>
            )}
          </Card>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
