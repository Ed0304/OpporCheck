"use client";

// Protected workspace shell: redirects signed-out visitors to login,
// then renders the top header, collapsible sidebar (drawer on mobile),
// and the main content landmark.
//
// Route protection here is a UX guard. Data protection is enforced by
// Firestore security rules; see firestore.rules at the repo root.

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

// Isolated so the pathname hook streams inside Suspense during prerender.
function LoginRedirect({ user, loading }: { user: unknown; loading: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, pathname, router]);
  return null;
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { language } = useLang();
  const t = getStrings(language);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (loading || !user) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <Suspense fallback={null}>
          <LoginRedirect user={user} loading={loading} />
        </Suspense>
        <AppHeader links={[]} />
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
          <Spinner label={loading ? t.wsCheckingSignIn : t.wsRedirecting} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={null}>
        <LoginRedirect user={user} loading={loading} />
      </Suspense>
      <AppHeader links={[]} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-haspopup="dialog"
          className="cursor-pointer rounded-md border border-edge bg-card px-3 py-2 text-sm font-medium hover:bg-brand-soft"
        >
          {t.wsMenuButton}
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-5 px-4 py-4 sm:px-6 lg:py-6">
        <WorkspaceSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
