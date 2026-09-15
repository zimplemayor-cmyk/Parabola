const faq = [
  {
    q: "What happens to my money if I buy and the token never graduates?",
    a: "You can sell back into the curve at any time before graduation. The same constant-product formula prices you out as it priced you in, minus fees, and there's no lockup on the buy side.",
  },
  {
    q: "Can the Parabola team take the money in a curve?",
    a: "No. The owner account can change the platform-wide fee rate (capped at 5%), the treasury address fees are sent to, and which DEX router new graduations use, and it can pause new launches. It has no function that can withdraw, freeze, or redirect a single curve's raised funds or tokens. Read BondingCurve.sol and LaunchFactory.sol yourself: every owner-only function is listed together at the bottom of LaunchFactory.sol.",
  },
  {
    q: "What stops the creator from dumping their whole allocation immediately?",
    a: "On a meme launch, there is no team allocation. The creator buys on the open curve exactly like anyone else. On a builder launch, the team's tokens sit in an OpenZeppelin VestingWallet that releases linearly over the schedule fixed at creation (minimum 90 days), and nobody, including the creator, can accelerate it.",
  },
  {
    q: "Why USDC instead of a native gas token?",
    a: "Arc's native gas token is USDC itself. Parabola prices every curve directly in it, so there's no separate volatile token standing between what you pay and what you see.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold text-paper">How Parabola works</h1>

      <div className="mt-10 space-y-10">
        <section>
          <h2 className="font-display text-xl font-medium text-paper">The curve</h2>
          <p className="mt-2 leading-relaxed text-paper-dim">
            Every launch mints a fixed token supply and puts it entirely into a bonding-curve contract. Buying moves
            the price up along a constant-product curve, the same math Uniswap uses, and selling moves it back
            down. Price is set entirely by supply and demand on the curve; nobody sets it manually.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-medium text-paper">Graduation</h2>
          <p className="mt-2 leading-relaxed text-paper-dim">
            Once a curve raises enough real USDC, it graduates: the contract itself, not a person and not an admin
            script, adds the remaining tokens and raised USDC as liquidity to a public DEX pool, and sends the LP
            position to a burn address. From that point the curve stops trading and the token lives entirely on the
            open market.
          </p>
        </section>

        <section id="security">
          <h2 className="font-display text-xl font-medium text-paper">Why graduation is permissionless</h2>
          <p className="mt-2 leading-relaxed text-paper-dim">
            In May 2024, an attacker stole roughly $2M from a well-known launchpad by compromising the centralized
            off-chain account responsible for moving bonding-curve funds to the DEX during migration. Parabola has
            no equivalent account. The buy transaction that crosses the graduation threshold triggers graduation
            itself, automatically, in the same call. If that automatic attempt can&apos;t complete (for example, the
            DEX router isn&apos;t configured yet), anyone can permissionlessly retry it later with{" "}
            <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-xs">executeGraduation()</code>. There is no
            step in between where funds sit under anyone&apos;s discretionary control.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-medium text-paper">FAQ</h2>
          <div className="mt-4 divide-y divide-ink-border">
            {faq.map((item) => (
              <div key={item.q} className="py-5">
                <p className="font-medium text-paper">{item.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-paper-dim">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-ignite/25 bg-ignite/5 p-5 text-sm text-paper-dim">
          Parabola&apos;s contracts have been self-audited and tested against common attack patterns (see SECURITY.md in
          the repository), but this is not a substitute for an independent third-party audit. Trading is
          irreversible and risky. Only risk funds you can afford to lose.
        </section>
      </div>
    </div>
  );
}
