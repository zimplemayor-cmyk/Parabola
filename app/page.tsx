import Link from "next/link";
import { CurveChart } from "@/components/CurveChart";

const differentiators = [
  {
    title: "USDC-denominated, start to finish",
    body:
      "Arc's gas token is USDC itself. Every price, fee, and chart on Parabola is quoted in dollars — no separate volatile gas token to think about before you can even buy.",
  },
  {
    title: "Nothing can rug the curve",
    body:
      "Graduation to a DEX pool runs permissionlessly, inside the same contract, the moment a launch qualifies. There's no off-chain admin key in the loop — the exact weak point that let an attacker drain ~$2M from a well-known launchpad in 2024.",
  },
  {
    title: "One platform, two tracks",
    body:
      "Fair-launch a meme with 100% of supply on the curve, or ship a real project with a vested team allocation — capped on-chain at 20%, never adjustable after launch.",
  },
];

const steps = [
  { n: "01", title: "Create", body: "Name it, describe it, pick meme or builder track. Costs gas, nothing else." },
  { n: "02", title: "Trade", body: "Anyone buys or sells against the curve in USDC. Price moves with every trade." },
  { n: "03", title: "Graduate", body: "Cross the threshold and liquidity locks permanently into a public DEX pool." },
];

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 md:pt-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="label-caps mb-4">Live on Arc</p>
            <h1 className="font-display text-4xl font-semibold leading-[1.1] text-paper md:text-5xl">
              Launch on the <span className="text-ignite">curve</span>.
              <br />
              Graduate to the <span className="text-stable">pool</span>.
            </h1>
            <p className="mt-5 max-w-md text-paper-dim">
              Parabola is a USDC-native launchpad for memes and builder projects on Arc. Every launch trades on a
              bonding curve until it earns real liquidity — then it graduates itself, permissionlessly, to a public
              DEX pool. No presale, no admin key, no custody.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/launch" className="btn-primary">
                Launch a token
              </Link>
              <Link href="/explore" className="btn-secondary">
                Explore launches
              </Link>
            </div>
          </div>
          <div className="card p-6">
            <CurveChart progress={0.42} height={260} />
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-ignite-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-ignite" /> Bonding curve
              </span>
              <span className="flex items-center gap-1.5 text-stable">
                <span className="h-1.5 w-1.5 rounded-full bg-stable" /> Graduation
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-ink-border/60 bg-ink-soft/50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n}>
                <p className="font-mono text-sm text-ignite">{step.n}</p>
                <h3 className="mt-2 font-display text-xl font-medium text-paper">{step.title}</h3>
                <p className="mt-2 text-sm text-paper-dim">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl font-semibold text-paper">Built for Arc, not ported to it</h2>
        <p className="mt-2 max-w-2xl text-paper-dim">
          Most launchpads are ETH- or SOL-quoted templates. Parabola is designed around what&apos;s actually
          different about Arc.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {differentiators.map((d) => (
            <div key={d.title} className="card p-6">
              <h3 className="font-display text-lg font-medium text-paper">{d.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper-dim">{d.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
