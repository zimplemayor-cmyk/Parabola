import Link from "next/link";
import { ParabolaMark } from "./ParabolaMark";

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
          <div className="grid grid-cols-2 gap-8 text-sm">
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
          </div>
        </div>
        <p className="mt-8 text-xs text-paper-faint">© {new Date().getFullYear()} Parabola. Built on Arc.</p>
      </div>
    </footer>
  );
}
