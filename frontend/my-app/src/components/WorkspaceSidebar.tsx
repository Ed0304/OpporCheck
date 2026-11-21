"use client";

// Contextual workspace sidebar: collapsible on desktop, drawer on mobile.
// Collapse state persists for the session; Escape closes the drawer.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export interface WorkspaceNavItem {
  href: string;
  label: string;
  short: string;
}

export const WORKSPACE_NAV: WorkspaceNavItem[] = [
  { href: "/workspace", label: "Overview", short: "Ov" },
  { href: "/workspace/review", label: "Review opportunity", short: "Re" },
  { href: "/workspace/compare", label: "Compare documents", short: "Co" },
  { href: "/workspace/investigations", label: "My investigations", short: "In" },
  { href: "/workspace/resources", label: "Resources", short: "Rs" },
  { href: "/workspace/settings", label: "Settings", short: "Se" },
];

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
      {WORKSPACE_NAV.map((item) => {
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
        aria-label="Workspace"
        className={`hidden shrink-0 flex-col gap-3 lg:flex ${collapsed ? "w-16" : "w-60"}`}
      >
        <nav aria-label="Workspace sections" className="rounded-lg border border-edge bg-card p-2">
          {list(undefined, collapsed)}
        </nav>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="cursor-pointer rounded-md border border-edge bg-card px-3 py-2 text-sm font-medium hover:bg-brand-soft"
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </aside>

      {/* Mobile: drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Workspace menu">
          <button
            type="button"
            aria-label="Close workspace menu"
            onClick={onCloseDrawer}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col gap-3 overflow-y-auto bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Workspace</p>
              <button
                type="button"
                onClick={onCloseDrawer}
                autoFocus
                className="cursor-pointer rounded-md border border-edge px-3 py-1.5 text-sm font-medium hover:bg-brand-soft"
              >
                Close
              </button>
            </div>
            <nav aria-label="Workspace sections">{list(onCloseDrawer)}</nav>
          </div>
        </div>
      )}
    </>
  );
}
