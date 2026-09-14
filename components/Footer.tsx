import Link from "next/link";
import { ParabolaMark } from "./ParabolaMark";

/**
 * Point these at the real profiles the moment they exist — search for
 * "/coming-soon" in this repo, there's only this one place to change.
 */
const SOCIAL_LINKS = [
  { label: "X", href: "/coming-soon" },
  { label: "Telegram", href: "/coming-soon" },
];

function SocialIcon({ label }: { label: string }) {
  if (label === "X") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M18.9 2H22l-7.6 8.68L23.3 22h-6.9l-5.4-6.96L4.8 22H1.7l8.1-9.28L1 2h7.1l4.9 6.4L18.9 2Zm-1.2 18h1.7L7.4 3.9H5.6L17.7 20Z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.9 4.3 18.6 20c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9L18 6.8c.4-.4-.1-.6-.6-.3L6.4 13.4l-4.8-1.5c-1-.3-1-1 .2-1.5L20.5 3.5c.9-.3 1.6.2 1.4.8Z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-ink-border/60 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 text-paper-dim">
              <ParabolaMark className="h-5 w-5" />
              <span className="font-display text-sm">parabola</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-paper-faint">
              Parabola is non-custodial software. Your wallet signs every transaction directly with the smart
              contracts below — Parabola never holds your funds or your tokens. Nothing here is financial advice.
              Tokens created on this platform are not vetted or endorsed by Parabola. Trading is irreversible and
              risky; only use funds you can afford to lose.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div>
              <p className="label-caps mb-3">Product</p>
              <ul className="space-y-2 text-paper-dim">
                <li><Link href="/explore" className="hover:text-paper">Explore</Link></li>
                <li><Link href="/launch" className="hover:text-paper">Launch</Link></li>
                <li><Link href="/how-it-works" className="hover:text-paper">How it works</Link></li>
              </ul>
            </div>
            <div>
              <p className="label-caps mb-3">Transparency</p>
              <ul className="space-y-2 text-paper-dim">
                <li><Link href="/how-it-works#security" className="hover:text-paper">Security model</Link></li>
                <li>
                  <a
                    href="https://docs.arc.network"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-paper"
                  >
                    Arc network docs
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="label-caps mb-3">Community</p>
              <ul className="flex gap-3">
                {SOCIAL_LINKS.map((s) => (
                  <li key={s.label}>
                    <Link
                      href={s.href}
                      aria-label={s.label}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-border text-paper-dim transition hover:border-ignite/50 hover:text-ignite"
                    >
                      <SocialIcon label={s.label} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-8 text-xs text-paper-faint">© {new Date().getFullYear()} Parabola. Built on Arc.</p>
      </div>
    </footer>
  );
}
