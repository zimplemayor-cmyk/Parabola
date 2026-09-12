import Link from "next/link";
import { ParabolaWordmark } from "./ParabolaMark";
import { WalletButton } from "./WalletButton";

const links = [
  { href: "/explore", label: "Explore" },
  { href: "/launch", label: "Launch" },
  { href: "/how-it-works", label: "How it works" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-border/60 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <ParabolaWordmark />
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-body text-sm text-paper-dim transition hover:text-paper"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
