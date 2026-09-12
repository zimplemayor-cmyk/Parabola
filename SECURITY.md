# Security

This document is the actual audit trail for Parabola's contracts, written honestly: what was checked, what was found, what was fixed, and — just as important — what this process cannot substitute for.

**This is a self-audit by an AI, not a professional third-party audit.** Treat everything below as a strong starting point, not a certification. See "Before mainnet with real funds" at the end before this ever touches value someone can't afford to lose.

## Methodology

Three passes, in order:

1. **Design review** — before any Solidity was written, the architecture was chosen specifically to eliminate whole *categories* of bug (see "Design principles" below) rather than relying only on catching individual bugs later.
2. **Adversarial pass** — for each function, the question asked was "how would I drain this, brick this, or steal from another user of this, if I were trying to." Every attack considered is listed below, whether or not it turned out to be exploitable.
3. **Executable verification** — 21 automated tests, run against the actual compiled bytecode on a real EVM (Hardhat Network), not just reasoned about. See "Test coverage."

## Design principles

These are load-bearing decisions, not defaults:

- **Graduation is permissionless and atomic.** No off-chain account, keeper, or admin function moves a curve's funds to the DEX. The buy transaction that crosses the graduation threshold triggers it, in the same call; if that automatic attempt can't complete, `executeGraduation()` is callable by anyone, forever, until it succeeds. This is a direct, specific response to a real incident — see "Case study" below.
- **The owner cannot touch a live launch's funds.** Enumerated exactly in "What the owner can and cannot do."
- **Fixed supply, no hooks, ever.** `LaunchToken` has no function added after construction that didn't ship in OpenZeppelin's audited `ERC20` base. No mint, no pause, no blacklist, no fee-on-transfer.
- **Team allocations are vested on-chain, not promised off-chain**, capped at 20% of supply (`MAX_TEAM_BPS`), a constant, not an owner-adjustable parameter.
- **Pricing never trusts `balanceOf()`.** Every quote is derived from tracked `tokensSold`/`realQuoteReserve` state, specifically so a direct token donation to a curve contract can't skew pricing (see finding SEC-4).

## Case study this was built against

In May 2024, an attacker stole approximately $2M from a widely-used bonding-curve launchpad by compromising the centralized off-chain "service account" responsible for migrating curve liquidity to the DEX. The attacker used flash loans to rapidly fill several curves, then used the compromised account to redirect the migrating funds instead of letting them reach the DEX pool.

Parabola has no equivalent account. There is no code path, anywhere in `BondingCurve.sol` or `LaunchFactory.sol`, where an off-chain-signed transaction from a privileged key can move a curve's raised funds or remaining tokens. The owner's entire capability surface is enumerated below, and none of it includes fund custody.

## What the owner can and cannot do

**Can:**
- Change `protocolFeeBps` / `creatorFeeBps` (hard-capped combined at 5%, `MAX_TOTAL_FEE_BPS`)
- Change the `treasury` address fees are sent to
- Change `dexRouter` / `dexFactory` (what new *and pending* graduations use)
- Change default curve parameters for *future* launches (virtual reserve, graduation threshold, anti-snipe window) within hard bounds
- Pause *new* launch creation

**Cannot, under any circumstance in this codebase:**
- Withdraw, freeze, or redirect a single curve's raised USDC or remaining tokens
- Change the terms (fee rate, graduation threshold, etc.) of an *already-deployed* curve — every `BondingCurve` immutable is fixed at construction
- Touch a vesting wallet's schedule or beneficiary once created
- Stop trading on an already-live curve (`setPaused` only blocks new launch creation — see the dedicated test for this)
- Mint additional token supply for any already-launched token

Read this yourself: every owner-gated function in the codebase is `onlyOwner`-annotated and grouped together at the bottom of `LaunchFactory.sol`. If a function outside that block can move funds, that's a bug — please report it.

## Findings

### Contract-level findings (the actual audit)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| SEC-1 | Medium (design) | Naive graduation (call the router synchronously, revert-on-failure) would **permanently brick every future buy** on a curve the moment it crosses threshold, if the router isn't yet configured or reverts for any reason — since the failing graduation call is nested inside `buy()`. Concretely likely here: Arc's real DEX router address isn't public until mainnet launches days after this was written. | Split "mark graduated" (halts trading, always succeeds) from "execute graduation" (moves funds, best-effort via `try/catch`). A failed execution rolls back its own accounting and can be retried permissionlessly by anyone via `executeGraduation()`, indefinitely, with no fund loss in the meantime. Covered by 3 dedicated tests (happy path, deferred-then-retried, reverts-then-retried). |
| SEC-2 | Low/precision | `getCurrentPrice()`'s original scaling (`x * 1e18 / y`) truncated to a 1-2 digit integer at realistic reserve sizes (USDC's 6 decimals against an 18-decimal, billion-token supply), so the reported price barely moved between trades. Caught by a test asserting price strictly increases after a buy. Not a fund-safety issue — this view is never used in buy/sell accounting — but would have shipped a visibly broken price chart. | Rescaled to `Math.mulDiv(x, 1e36, y)` for enough fixed-point headroom that real trades move it measurably. |
| SEC-3 | Info | `graduationThreshold` compares against `realQuoteReserve`, which is net of the protocol+creator fee — not gross `msg.value` ever spent. Not a bug, but genuinely easy to misread as an operator tuning `setCurveDefaults`, and it broke my own first attempt at a graduation test before I accounted for it. | Documented explicitly in the NatSpec on `graduationThreshold` in `BondingCurve.sol`. |
| SEC-4 | Medium (verified via test) | Considered: could someone inflate the apparent token reserve by directly `transfer()`-ing tokens to the curve contract, bypassing `sell()`, to manipulate pricing (the same family of bug as ERC-4626 "donation attacks")? | Verified NOT exploitable, by construction: pricing reads tracked `tokensSold`/`realQuoteReserve` state, never `token.balanceOf(address(this))`. Covered by a dedicated test that performs exactly this donation and asserts quotes are unaffected. |
| SEC-5 | Would-be-Critical if missed | Considered: reentrancy on both `buy()` (creator fee payout) and `sell()` (seller payout) via a malicious contract's `receive()`. | `nonReentrant` (OpenZeppelin `ReentrancyGuard`) on every state-changing entry point, combined with checks-effects-interactions ordering as defense in depth (state updated before any external call). Verified with two dedicated attack-contract tests — one attacking through the creator-fee path, one through the seller-payout path — both correctly revert the whole transaction with no funds moved. |
| SEC-6 | Design constraint, verified | Considered: integer overflow/underflow in the curve math, or in fee-splitting arithmetic. | Solidity 0.8.24's built-in checked arithmetic reverts on any overflow/underflow rather than wrapping. The one deliberately-unchecked-by-construction case (`realQuoteReserve -= grossOut` in `sell()`) is proven safe by the invariant that `tokenAmountIn <= tokensSold` mathematically guarantees `grossOut <= realQuoteReserve` — walked through in code comments and confirmed by the round-trip test (buy fully, sell fully, get back input minus both-way fees). |
| SEC-7 | Info | A missing on-chain field: `metadataURI` was validated for length at creation but never actually stored anywhere retrievable (not in the `Launch` struct, not in the event) — every launch's description/image would have been unrecoverable after the creation transaction without parsing historical calldata. | Added to both the `Launch` struct and the `LaunchCreated` event. |
| SEC-8 | Low | `Ownable2Step` used instead of single-step `Ownable` for factory ownership transfer, specifically to prevent an accidental transfer to an unreachable address (a real, repeatedly-seen cause of "permanently un-owned contract" incidents). | Design choice, not a reactive fix. |

### Tooling/environment findings (not contract bugs, but part of the same "actually verify, don't assume" process)

These didn't affect contract correctness but would have affected whether this codebase actually runs for you:

- **Next.js supply-chain currency.** The frontend was initially pinned to Next.js 14.2.15 out of habit. `npm install` itself flagged it as carrying a disclosed critical-severity vulnerability; there have been several more critical Next.js CVEs disclosed through 2026. Bumped to the current patched major (16.3.4) and confirmed the app still builds clean on it — including fixing the Next 15+ change where dynamic-route `params` became a Promise even for Client Component pages.
- **A wrong wagmi import** (`injected` imported from `wagmi` instead of `wagmi/connectors`) was caught by the production build, not by inspection.
- **A build-time external dependency that couldn't be verified.** `next/font/google` needs to reach Google's font CDN at build time; that domain wasn't reachable in the sandbox this was built in. Rather than ship something untestable end-to-end, the app was moved to a self-hosted system-font stack — zero build-time network dependency, verified working.
- **Missing O(1) token→curve lookup.** The frontend's token page needs to go from a token address to its curve; without an on-chain mapping this would mean scanning every launch on every page load. Added `curveForToken` to the factory before this became a real scalability problem.

## Test coverage

21 tests, `contracts/test/Parabola.test.ts`, run against real compiled bytecode (solc 0.8.24) on Hardhat Network:

- Fixed-supply and registration invariants, including the atomic creator-buy
- Input validation (name/symbol length limits)
- Builder-track team-allocation cap and minimum vesting duration, including actual vesting-schedule math at the halfway point
- Owner access control on every admin setter (rejected for non-owners)
- Hard fee cap enforcement (5% combined)
- Pausing blocks new launches only, verified NOT to affect an already-live curve's trading
- Price monotonicity, slippage protection (buy and sell), full round-trip economics
- Underflow protection (can't sell more than was ever bought)
- Donation-attack immunity (SEC-4)
- Two distinct reentrancy attacks (SEC-5), both blocked
- Three graduation scenarios: router pre-configured (happy path + LP burn verified), router configured later (deferred + permissionless retry), router configured but reverting (rollback + retry after fix)

Run it yourself: `cd contracts && npm test`.

## Known limitations / residual risks

Being direct about what this does **not** protect against:

- **Well-capitalized manipulation is still possible.** A single actor with enough capital can buy a large share of a curve and later sell it, same as on any public bonding curve (Pons and pump.fun included) — a launch-window anti-snipe cap limits early sniping but doesn't eliminate market manipulation by someone willing to spend real money. No launchpad design solves this; treat it as inherent to the category, not specific to Parabola.
- **Graduation targets a V2-style router interface**, not Uniswap v4's actual hook/PoolManager architecture that's confirmed live on Arc day one. This is the single most important thing to finish before real volume — see the checklist below.
- **No content moderation.** Anyone can launch a token with any name/symbol/metadata URI (within length limits). Fraudulent or offensive launches are a platform-policy problem, not something the contracts can or should solve.
- **The owner key itself is a single point of failure for the *fee configuration* surface** (not fund custody, per above, but still: a compromised owner key could redirect future fees or point new graduations at a malicious router). Transfer ownership to a multisig before this handles meaningful volume.

## Before mainnet with real funds

In order:

1. **Get an independent, professional audit.** This document is not one. Firms with public bonding-curve/launchpad experience are the right ones to ask.
2. **Verify USDC's decimals on Arc yourself** — read a known-funded address's balance on Arc mainnet directly and confirm the raw value matches 6-decimal formatting, given the one conflicting source noted in the README.
3. **Build (or commission) a real Uniswap v4 graduation adapter** once Arc's v4 periphery addresses are public, replacing the V2-style MVP path in `_doGraduate`.
4. **Transfer `LaunchFactory` ownership to a multisig** (with a timelock, ideally) before setting a real `dexRouter`/`treasury`.
5. **Run a testnet dry run end-to-end** — create a launch, trade it past graduation, confirm the pool and LP burn look right on `testnet.arcscan.app` — before doing the same on mainnet.
6. **Consider a bug bounty** before or alongside public launch.

If you find a real issue in this codebase, please don't wait for someone else to hit it first.
