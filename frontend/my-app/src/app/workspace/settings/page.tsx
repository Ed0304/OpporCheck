"use client";

// Account settings: account information, theme preference, sign out.

import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const THEME_OPTIONS: Array<{ value: ThemeChoice; label: string; hint: string }> = [
  { value: "light", label: "Light", hint: "Always use the light theme." },
  { value: "dark", label: "Dark", hint: "Always use the dark theme." },
  { value: "system", label: "System", hint: "Follow your device setting." },
];

export default function SettingsPage() {
  const { user, signOutUser } = useAuth();
  const { choice, setChoice } = useTheme();
  const router = useRouter();

  const signOut = async () => {
    await signOutUser();
    router.replace("/login");
  };

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card title="Account">
        <dl className="divide-y divide-edge text-sm">
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-muted">Email</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-muted">Display name</dt>
            <dd className="font-medium">{user?.displayName || "Not set"}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-muted">Sign-in method</dt>
            <dd className="font-medium">
              {user?.providerData.map((profile) => profile.providerId).join(", ") || "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Appearance" description="Choose how OpporCheck looks on this device.">
        <div role="radiogroup" aria-label="Theme preference" className="flex flex-col gap-2">
          {THEME_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-edge p-3 hover:bg-brand-soft"
            >
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={choice === option.value}
                onChange={() => setChoice(option.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-sm text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card title="Sign out">
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
