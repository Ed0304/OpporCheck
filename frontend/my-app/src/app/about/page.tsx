import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";

export const metadata: Metadata = {
  title: "About — OpporCheck",
};

export default function AboutPage() {
  return (
    <PublicShell>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-navy">About OpporCheck</h1>
        <div className="mt-4 flex flex-col gap-4 leading-7 text-muted">
          <p>
            OpporCheck is an AI-powered overseas employment investigation workspace. It helps
            people understand job opportunities through evidence, official sources, and clear
            explanations — before signing anything or paying any fee.
          </p>
          <p>
            Many overseas job seekers first meet an opportunity as a short message or a
            photocopied offer: some details, many gaps, and no easy way to tell which is
            which. OpporCheck turns that text into a structured review — extracted facts,
            potential concerns with quoted evidence, missing information, and relevant
            official guidance — so the next conversation starts from facts.
          </p>
          <h2 className="text-xl font-semibold text-ink">What OpporCheck is not</h2>
          <ul className="list-disc pl-5">
            <li>Not an employer verification service — it never declares an employer genuine or fraudulent.</li>
            <li>Not a recruitment agency and not legal or immigration advice.</li>
            <li>Not a replacement for checking official government sources yourself.</li>
          </ul>
          <h2 className="text-xl font-semibold text-ink">How analysis works</h2>
          <p>
            Reviews run in your browser using on-device AI when your device supports it, with
            secure cloud fallback otherwise. Your postings and reports are stored in your own
            account and are never shared between users.
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
