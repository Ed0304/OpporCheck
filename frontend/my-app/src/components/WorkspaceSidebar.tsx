"use client";

// Contextual workspace sidebar: collapsible on desktop, drawer on mobile.
// Collapse state persists for the session; Escape closes the drawer.
// Labels follow the global website language preference. The two-letter
// collapsed-rail shorts stay fixed (decorative; the full localized label
// is always exposed to assistive technology).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useLang } from "@/lib/lang";
import { getStrings, type UiLanguage } from "@/lib/strings";

export interface WorkspaceNavItem {
  href: string;
  label: string;
  short: string;
}

export function getWorkspaceNav(language: UiLanguage): WorkspaceNavItem[] {
  const t = getStrings(language);
  return [
    { href: "/workspace", label: t.wsNavOverview, short: "Ov" },
    { href: "/workspace/review", label: t.wsNavReview, short: "Re" },
    { href: "/workspace/compare", label: t.wsNavCompare, short: "Co" },
    { href: "/workspace/investigations", label: t.wsNavInvestigations, short: "In" },
    { href: "/workspace/resources", label: t.wsNavResources, short: "Rs" },
    { href: "/workspace/settings", label: t.wsNavSettings, short: "Se" },
  ];
}

/** English default, kept for existing imports; UI code prefers getWorkspaceNav. */
export const WORKSPACE_NAV: WorkspaceNavItem[] = getWorkspaceNav("en");

function isActive(pathname: string, href: string): boolean {
  if (href === "/workspace") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function WorkspaceSidebar({
  collapsed,
  onToggleCollapse,
  drawerOpen,
  onCloseDrawer,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const pathname = usePathname();
  const { language } = useLang();
  const t = getStrings(language);
  const nav = getWorkspaceNav(language);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseDrawer();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, onCloseDrawer]);

  const list = (onNavigate?: () => void, slim = false) => (
    <ul className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={slim ? item.label : undefined}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                active ? "bg-brand-soft font-semibold text-navy" : "hover:bg-brand-soft"
              } ${slim ? "text-center" : ""}`}
            >
              {slim ? <span aria-hidden>{item.short}</span> : item.label}
              {slim && <span className="sr-only">{item.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Desktop: collapsible rail */}
      <aside
        aria-label={t.wsSidebarAria}
        className={`hidden shrink-0 flex-col gap-3 lg:flex ${collapsed ? "w-16" : "w-60"}`}
      >
        <nav aria-label={t.wsSectionsAria} className="rounded-lg border border-edge bg-card p-2">
          {list(undefined, collapsed)}
        </nav>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="cursor-pointer rounded-md border border-edge bg-card px-3 py-2 text-sm font-medium hover:bg-brand-soft"
        >
          {collapsed ? t.wsExpand : t.wsCollapse}
        </button>
      </aside>

      {/* Mobile: drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t.wsMenuButton}>
          <button
            type="button"
            aria-label={t.wsCloseMenuAria}
            onClick={onCloseDrawer}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col gap-3 overflow-y-auto bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{t.wsSidebarAria}</p>
              <button
                type="button"
                onClick={onCloseDrawer}
                autoFocus
                className="cursor-pointer rounded-md border border-edge px-3 py-1.5 text-sm font-medium hover:bg-brand-soft"
              >
                {t.commonClose}
              </button>
            </div>
            <nav aria-label={t.wsSectionsAria}>{list(onCloseDrawer)}</nav>
          </div>
        </div>
      )}
    </>
  );
}
