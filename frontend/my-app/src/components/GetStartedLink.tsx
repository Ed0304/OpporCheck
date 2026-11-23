// Auth-aware primary call to action for public pages: signed-in
// visitors go straight to the Promise-to-Paper comparison instead of
// being asked to register again, and signed-out visitors continue
// there after creating an account. Destinations are existing routes.

"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function GetStartedLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  return (
    <Link
      href={user ? "/workspace/compare" : "/register?next=/workspace/compare"}
      className={className}
    >
      {children}
    </Link>
  );
}
