// Auth-aware primary call to action for public pages: signed-in
// visitors go straight to the review desk instead of being asked to
// register again. Destinations are the existing routes.

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
    <Link href={user ? "/workspace/review" : "/register"} className={className}>
      {children}
    </Link>
  );
}
