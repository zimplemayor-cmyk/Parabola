import { LaunchForm } from "@/components/LaunchForm";
import { activeChain } from "@/lib/chains";

export default function LaunchPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold text-paper">Launch a token</h1>
      <p className="mt-2 text-paper-dim">
        Costs only gas. Your wallet submits the transaction directly to the contract, and Parabola never sees your
        funds.
      </p>
      {activeChain.testnet && (
        <p className="mt-3 text-sm text-stable">
          On {activeChain.name}, gas is paid in testnet USDC. Grab some free from{" "}
          <a href="https://faucet.circle.com" target="_blank" rel="noreferrer noopener" className="underline">
            faucet.circle.com
          </a>{" "}
          before launching if your wallet is empty.
        </p>
      )}
      <div className="mt-8">
        <LaunchForm />
      </div>
    </div>
  );
}
