"use client";

// Global top navigation: brand wordmark, section links, theme switcher,
// account menu (or sign-in link). Mobile menu opens a navigation drawer.

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme, type ThemeChoice } from "@/lib/theme";

export interface NavLink {
  href: string;
  label: string;
}

const THEME_LABEL: Record<ThemeChoice, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const THEME_ORDER: ThemeChoice[] = ["light", "dark", "system"];

function ThemeSwitcher() {
  const { choice, setChoice } = useTheme();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(choice) + 1) % THEME_ORDER.length]!;
  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      aria-label={`Theme: ${THEME_LABEL[choice]}. Activate to switch to ${THEME_LABEL[next]}.`}
      title={`Theme: ${THEME_LABEL[choice]}`}
      className="inline-flex h-9 cursor-pointer items-center rounded-md border border-edge px-3 text-sm font-medium hover:bg-brand-soft"
    >
      {THEME_LABEL[choice]}
    </button>
  );
}

function AccountMenu() {
  const { user, signOutUser } = useAuth();
  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong"
      >
        Sign in
      </Link>
    );
  }
  const label = user.displayName || user.email || "Account";
  return (
    <details className="relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-md border border-edge px-3 text-sm font-medium hover:bg-brand-soft [&::-webkit-details-marker]:hidden">
        {label.length > 24 ? `${label.slice(0, 24)}…` : label}
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-52 rounded-md border border-edge bg-card p-1 shadow-[0_4px_12px_rgba(23,59,112,0.12)]">
        <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
        <Link
          href="/workspace"
          className="block rounded px-3 py-2 text-sm hover:bg-brand-soft"
        >
          Workspace
        </Link>
        <Link
          href="/workspace/settings"
          className="block rounded px-3 py-2 text-sm hover:bg-brand-soft"
        >
          Settings
        </Link>
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="block w-full cursor-pointer rounded px-3 py-2 text-left text-sm hover:bg-brand-soft"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}

export default function AppHeader({ links }: { links: NavLink[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-card">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-navy"
          aria-label="OpporCheck home"
        >
          OpporCheck
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-brand-soft"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ThemeSwitcher />
          <AccountMenu />
        </div>
        {links.length > 0 && (
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-edge px-3 text-sm font-medium md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        )}
      </div>
      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t border-edge bg-card px-4 py-3 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-brand-soft"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-2 border-t border-edge pt-3">
            <ThemeSwitcher />
            <AccountMenu />
          </div>
        </nav>
      )}
    </header>
  );
}
