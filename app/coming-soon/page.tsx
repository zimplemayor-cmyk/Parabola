import Link from "next/link";
import { ParabolaMark } from "@/components/ParabolaMark";

export default function ComingSoonPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-28 text-center">
      <ParabolaMark className="h-10 w-10 text-ignite" />
      <h1 className="mt-6 font-display text-2xl font-semibold text-paper">Coming soon</h1>
      <p className="mt-3 text-sm leading-relaxed text-paper-dim">
        This link isn&apos;t live yet. We&apos;re setting it up, so check back shortly, or head back to the app in
        the meantime.
      </p>
      <Link href="/" className="btn-secondary mt-8">
        Back to Parabola
      </Link>
    </div>
  );
}
