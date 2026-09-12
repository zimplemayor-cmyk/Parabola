import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { ContractTransactionReceipt } from "ethers";

const USDC = (n: number | string) => ethers.parseUnits(n.toString(), 6);

function findEvent(iface: any, receipt: ContractTransactionReceipt | null, name: string) {
  for (const log of receipt!.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === name) return parsed;
    } catch {
      /* log from a different contract in the same tx — ignore */
    }
  }
  throw new Error(`event ${name} not found`);
}

async function deployFactory() {
  const [owner, treasury, alice, bob, carol] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("LaunchFactory");
  const factory = await Factory.deploy(owner.address, treasury.address);
  await factory.waitForDeployment();
  // Most tests below aren't exercising the anti-snipe window and use buy
  // sizes well above its default 500 USDC-equivalent cap. Disable it here;
  // the dedicated "launch-window anti-snipe cap" suite re-enables it
  // explicitly with its own factory.setCurveDefaults call.
  const virtualReserve = await factory.defaultVirtualQuoteReserve();
  const graduationThreshold = await factory.defaultGraduationThreshold();
  await factory.connect(owner).setCurveDefaults(virtualReserve, graduationThreshold, 0, 0);
  return { factory, owner, treasury, alice, bob, carol };
}

async function launch(factory: any, creator: any, value = 0n) {
  const tx = await factory.connect(creator).createMemeLaunch("Test Token", "TST", "ipfs://meta", 0, { value });
  const receipt = await tx.wait();
  const evt = findEvent(factory.interface, receipt, "LaunchCreated");
  const curve = await ethers.getContractAt("BondingCurve", evt.args.curve);
  const token = await ethers.getContractAt("LaunchToken", evt.args.token);
  return { curve, token, receipt };
}

describe("LaunchFactory", () => {
  it("mints the full fixed supply to the curve and registers the launch", async () => {
    const { factory, alice } = await deployFactory();
    const { curve, token } = await launch(factory, alice);
    const totalSupply = await factory.TOTAL_SUPPLY();

    expect(await token.totalSupply()).to.equal(totalSupply);
    expect(await token.balanceOf(await curve.getAddress())).to.equal(totalSupply);
    expect(await curve.creator()).to.equal(alice.address);
    expect(await factory.totalLaunches()).to.equal(1n);
    expect(await factory.curveForToken(await token.getAddress())).to.equal(await curve.getAddress());
  });

  it("performs the creator's first buy atomically in the same transaction", async () => {
    const { factory, alice } = await deployFactory();
    const { curve, token } = await launch(factory, alice, USDC(1000));
    expect(await token.balanceOf(alice.address)).to.be.gt(0n);
    expect(await curve.tokensSold()).to.equal(await token.balanceOf(alice.address));
  });

  it("rejects an oversized name or symbol", async () => {
    const { factory, alice } = await deployFactory();
    await expect(
      factory.connect(alice).createMemeLaunch("x".repeat(33), "OK", "", 0)
    ).to.be.revertedWith("Parabola: bad name length");
    await expect(
      factory.connect(alice).createMemeLaunch("OK", "x".repeat(13), "", 0)
    ).to.be.revertedWith("Parabola: bad symbol length");
  });

  it("caps builder-track team allocation at MAX_TEAM_BPS", async () => {
    const { factory, alice } = await deployFactory();
    const maxBps = await factory.MAX_TEAM_BPS();
    await expect(
      factory.connect(alice).createBuilderLaunch("B", "B", "", maxBps + 1n, 90n * 86400n, 0)
    ).to.be.revertedWith("Parabola: team allocation too high");
  });

  it("enforces a minimum vesting duration on builder-track launches", async () => {
    const { factory, alice } = await deployFactory();
    await expect(
      factory.connect(alice).createBuilderLaunch("B", "B", "", 1000n, 86400n, 0) // 1 day, below 90-day minimum
    ).to.be.revertedWith("Parabola: vesting too short");
  });

  it("splits supply correctly between the vesting wallet and the curve on a builder launch", async () => {
    const { factory, alice } = await deployFactory();
    const totalSupply = await factory.TOTAL_SUPPLY();
    const teamBps = 1500n; // 15%
    const tx = await factory.connect(alice).createBuilderLaunch("B", "B", "", teamBps, 180n * 86400n, 0);
    const receipt = await tx.wait();
    const evt = findEvent(factory.interface, receipt, "LaunchCreated");
    expect(evt.args.isBuilderLaunch).to.equal(true);

    const token = await ethers.getContractAt("LaunchToken", evt.args.token);
    const vesting = await ethers.getContractAt("VestingWallet", evt.args.vestingWallet);
    const curveBal = await token.balanceOf(evt.args.curve);
    const vestingBal = await token.balanceOf(evt.args.vestingWallet);

    expect(vestingBal).to.equal((totalSupply * teamBps) / 10_000n);
    expect(curveBal).to.equal(totalSupply - vestingBal);
    expect(await vesting.owner()).to.equal(alice.address);

    // Nothing releasable immediately...
    expect(await vesting["releasable(address)"](await token.getAddress())).to.equal(0n);
    // ...but roughly half is releasable at the schedule's halfway point.
    await time.increase(90n * 86400n);
    const releasable = await vesting["releasable(address)"](await token.getAddress());
    expect(releasable).to.be.closeTo(vestingBal / 2n, vestingBal / 50n);
  });

  describe("owner configuration", () => {
    it("blocks non-owner calls to every admin setter", async () => {
      const { factory, alice, treasury } = await deployFactory();
      await expect(factory.connect(alice).setTreasury(treasury.address)).to.be.revertedWithCustomError(
        factory,
        "OwnableUnauthorizedAccount"
      );
      await expect(factory.connect(alice).setFees(0, 0)).to.be.revertedWithCustomError(
        factory,
        "OwnableUnauthorizedAccount"
      );
      await expect(factory.connect(alice).setDexConfig(alice.address, alice.address)).to.be.revertedWithCustomError(
        factory,
        "OwnableUnauthorizedAccount"
      );
      await expect(factory.connect(alice).setPaused(true)).to.be.revertedWithCustomError(
        factory,
        "OwnableUnauthorizedAccount"
      );
    });

    it("rejects a combined fee above the hard 5% ceiling", async () => {
      const { factory, owner } = await deployFactory();
      await expect(factory.connect(owner).setFees(400, 101)).to.be.revertedWith("Parabola: fee too high");
      await expect(factory.connect(owner).setFees(300, 200)).to.not.be.reverted; // exactly 500 is fine
    });

    it("pauses new launches without touching trading on already-live curves", async () => {
      const { factory, owner, alice, bob } = await deployFactory();
      const { curve } = await launch(factory, alice);

      await factory.connect(owner).setPaused(true);
      await expect(factory.connect(alice).createMemeLaunch("X", "X", "", 0)).to.be.revertedWith(
        "Parabola: launches paused"
      );
      // Existing curve is completely unaffected.
      await expect(curve.connect(bob).buy(bob.address, 0, { value: USDC(10) })).to.not.be.reverted;
    });
  });
});

describe("BondingCurve — trading", () => {
  it("lets a buyer purchase tokens, priced by the quote view, and the price rises", async () => {
    const { factory, alice, bob } = await deployFactory();
    const { curve, token } = await launch(factory, alice);

    const priceBefore = await curve.getCurrentPrice();
    const amount = USDC(100);
    const quoted = await curve.quoteBuy(amount);

    await expect(curve.connect(bob).buy(bob.address, 0, { value: amount })).to.emit(curve, "Buy");
    expect(await token.balanceOf(bob.address)).to.equal(quoted);
    expect(await curve.getCurrentPrice()).to.be.gt(priceBefore);
  });

  it("enforces slippage protection on buy and sell", async () => {
    const { factory, alice, bob } = await deployFactory();
    const { curve, token } = await launch(factory, alice);
    const amount = USDC(100);
    const quoted = await curve.quoteBuy(amount);

    await expect(curve.connect(bob).buy(bob.address, quoted + 1n, { value: amount })).to.be.revertedWith(
      "Parabola: slippage"
    );

    await curve.connect(bob).buy(bob.address, 0, { value: amount });
    const bal = await token.balanceOf(bob.address);
    await token.connect(bob).approve(await curve.getAddress(), bal);
    const quotedSell = await curve.quoteSell(bal);
    await expect(curve.connect(bob).sell(bal, quotedSell + 1n, bob.address)).to.be.revertedWith(
      "Parabola: slippage"
    );
  });

  it("round-trips buy-then-sell-everything back to ~= amount paid minus both-way fees", async () => {
    const { factory, alice, bob } = await deployFactory();
    const { curve, token } = await launch(factory, alice);
    const amount = USDC(1000);

    await curve.connect(bob).buy(bob.address, 0, { value: amount });
    const bought = await token.balanceOf(bob.address);
    await token.connect(bob).approve(await curve.getAddress(), bought);

    const before = await ethers.provider.getBalance(bob.address);
    const tx = await curve.connect(bob).sell(bought, 0, bob.address);
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;
    const after = await ethers.provider.getBalance(bob.address);
    const netReceived = after - before + gasCost;

    // protocolFeeBps=100 + creatorFeeBps=50 = 1.5% each way => ~3% total round-trip cost.
    expect(netReceived).to.be.closeTo((amount * 97n) / 100n, amount / 100n);
  });

  it("never lets tokensSold underflow — you can't sell back more than the curve ever sold", async () => {
    const { factory, alice, bob } = await deployFactory();
    const { curve, token } = await launch(factory, alice);
    await curve.connect(bob).buy(bob.address, 0, { value: USDC(100) });
    const bal = await token.balanceOf(bob.address);
    await token.connect(bob).approve(await curve.getAddress(), bal + 1n);
    await expect(curve.connect(bob).sell(bal + 1n, 0, bob.address)).to.be.revertedWith("Parabola: bad amount");
  });

  it("is immune to a direct token donation — pricing uses tracked state, not balanceOf()", async () => {
    const { factory, alice, bob, carol } = await deployFactory();
    const { curve, token } = await launch(factory, alice);

    const quoteBefore = await curve.quoteBuy(USDC(100));

    // Bob buys, then donates the tokens directly to the curve contract —
    // NOT through sell(). If pricing read token.balanceOf(curve), this
    // would inflate the apparent token reserve and skew every quote after it.
    await curve.connect(bob).buy(bob.address, 0, { value: USDC(500) });
    const bobBal = await token.balanceOf(bob.address);
    await token.connect(bob).transfer(await curve.getAddress(), bobBal);

    const quoteAfter = await curve.quoteBuy(USDC(100));
    // quoteAfter reflects the real state change from bob's *buy* (less token
    // reserve left => higher price => fewer tokens for the same 100 USDC),
    // but must be completely unaffected by the extra donated balance sitting
    // in the contract on top of that.
    expect(quoteAfter).to.be.lt(quoteBefore);

    const carolQuote1 = await curve.quoteBuy(USDC(10));
    // Donate again with no intervening buy/sell — quote must not move at all.
    await token.connect(alice).transfer(bob.address, 0); // no-op, keeps alice untouched
    const carolQuote2 = await curve.quoteBuy(USDC(10));
    expect(carolQuote2).to.equal(carolQuote1);
    void carol;
  });

  it("rejects trading once graduated", async () => {
    const { factory, owner, alice, bob } = await deployFactory();
    await factory.connect(owner).setCurveDefaults(
      USDC(100), // virtual reserve
      USDC(1000), // graduation threshold (minimum allowed)
      0, // no launch window for this test
      0
    );
    const { curve } = await launch(factory, alice);
    // Threshold is compared against realQuoteReserve, which is net of the
    // 1.5% combined fee — buy comfortably past 1000 USDC gross to actually
    // clear it net.
    await curve.connect(bob).buy(bob.address, 0, { value: USDC(1100) });
    expect(await curve.graduated()).to.equal(true);
    await expect(curve.connect(bob).buy(bob.address, 0, { value: USDC(10) })).to.be.revertedWith(
      "Parabola: graduated"
    );
  });
});

describe("BondingCurve — launch-window anti-snipe cap", () => {
  it("caps per-wallet buys during the window and lifts it afterwards", async () => {
    const { factory, owner, alice, bob } = await deployFactory();
    await factory.connect(owner).setCurveDefaults(USDC(3000), USDC(30000), 600, USDC(500));
    const { curve } = await launch(factory, alice);

    await expect(curve.connect(bob).buy(bob.address, 0, { value: USDC(600) })).to.be.revertedWith(
      "Parabola: launch window cap"
    );
    await curve.connect(bob).buy(bob.address, 0, { value: USDC(500) }); // exactly at the cap
    await expect(curve.connect(bob).buy(bob.address, 0, { value: 1n })).to.be.revertedWith(
      "Parabola: launch window cap"
    );

    await time.increase(601);
    await expect(curve.connect(bob).buy(bob.address, 0, { value: USDC(500) })).to.not.be.reverted;
  });
});

describe("BondingCurve — reentrancy protection", () => {
  it("blocks a malicious creator's fee payout from reentering buy()", async () => {
    const { factory, bob } = await deployFactory();
    const Attacker = await ethers.getContractFactory("MaliciousReentrant");
    const attacker = await Attacker.deploy();
    await attacker.createEvilLaunch(await factory.getAddress());

    // Bob's honest buy pays the (malicious) creator its fee cut, which
    // tries to reenter buy() from receive(). The reentrant call must be
    // blocked by the ReentrancyGuard, which bubbles up as a failed
    // low-level send and reverts bob's whole transaction — no funds move.
    const curveAddr = await attacker.victim();
    const curve = await ethers.getContractAt("BondingCurve", curveAddr);
    await expect(curve.connect(bob).buy(bob.address, 0, { value: USDC(1000) })).to.be.revertedWith(
      "Parabola: transfer failed"
    );
  });

  it("blocks a malicious seller from reentering sell() via its payout", async () => {
    const { factory, alice, bob } = await deployFactory();
    const { curve, token } = await launch(factory, alice);

    const Attacker = await ethers.getContractFactory("MaliciousReentrant");
    const attacker = await Attacker.deploy();
    await attacker.setTarget(await curve.getAddress(), false);

    await attacker.attackViaBuy({ value: USDC(500) });
    const bal = await token.balanceOf(await attacker.getAddress());
    expect(bal).to.be.gt(0n);

    // The attacker contract approves the curve itself — no impersonation
    // needed, and this avoids tripping its own receive()-based attack logic
    // the way funding it with a plain ETH transfer would.
    await attacker.approveToken(await token.getAddress(), await curve.getAddress(), bal);

    await expect(attacker.attackViaSell(bal)).to.be.revertedWith("Parabola: transfer failed");
  });
});

describe("BondingCurve — graduation", () => {
  async function deployMockDex() {
    const LP = await ethers.getContractFactory("MockLPToken");
    const lp = await LP.deploy();
    const Router = await ethers.getContractFactory("MockDexRouter");
    const router = await Router.deploy(await lp.getAddress());
    const Fac = await ethers.getContractFactory("MockDexFactory");
    const dexFactory = await Fac.deploy(await lp.getAddress());
    return { lp, router, dexFactory };
  }

  it("graduates automatically and burns the LP when the router is already configured", async () => {
    const { factory, owner, alice, bob } = await deployFactory();
    const { router, dexFactory, lp } = await deployMockDex();
    await factory.connect(owner).setDexConfig(await router.getAddress(), await dexFactory.getAddress());
    await factory.connect(owner).setCurveDefaults(USDC(100), USDC(1000), 0, 0);

    const { curve } = await launch(factory, alice);
    const tx = await curve.connect(bob).buy(bob.address, 0, { value: USDC(1100) });
    const receipt = await tx.wait();

    expect(await curve.graduated()).to.equal(true);
    expect(await curve.graduationExecuted()).to.equal(true);
    expect(findEvent(curve.interface, receipt, "GraduationExecuted")).to.not.be.undefined;

    const burnAddr = await curve.BURN_ADDRESS();
    expect(await lp.balanceOf(burnAddr)).to.be.gt(0n);
    expect(await ethers.provider.getBalance(await curve.getAddress())).to.equal(0n);
  });

  it("defers execution when no router is configured yet, then lets anyone retry it later", async () => {
    const { factory, owner, alice, bob, carol } = await deployFactory();
    await factory.connect(owner).setCurveDefaults(USDC(100), USDC(1000), 0, 0);
    const { curve } = await launch(factory, alice);

    await curve.connect(bob).buy(bob.address, 0, { value: USDC(1100) });
    expect(await curve.graduated()).to.equal(true);
    expect(await curve.graduationExecuted()).to.equal(false);

    // Router still unset — permissionless retry correctly refuses.
    await expect(curve.connect(carol).executeGraduation()).to.be.revertedWith("Parabola: router not configured");

    const { router, dexFactory } = await deployMockDex();
    await factory.connect(owner).setDexConfig(await router.getAddress(), await dexFactory.getAddress());

    // Anyone — not just the owner or the creator — can execute it now.
    await expect(curve.connect(carol).executeGraduation()).to.not.be.reverted;
    expect(await curve.graduationExecuted()).to.equal(true);
  });

  it("rolls back cleanly if the configured router reverts, and can be retried once fixed", async () => {
    const { factory, owner, alice, bob, carol } = await deployFactory();
    const { router, dexFactory } = await deployMockDex();
    await router.setShouldRevert(true);
    await factory.connect(owner).setDexConfig(await router.getAddress(), await dexFactory.getAddress());
    await factory.connect(owner).setCurveDefaults(USDC(100), USDC(1000), 0, 0);

    const { curve } = await launch(factory, alice);
    const tx = await curve.connect(bob).buy(bob.address, 0, { value: USDC(1100) });
    const receipt = await tx.wait();

    expect(await curve.graduated()).to.equal(true);
    expect(await curve.graduationExecuted()).to.equal(false);
    expect(findEvent(curve.interface, receipt, "GraduationExecutionFailed")).to.not.be.undefined;
    // Funds are still safely accounted for inside the curve.
    expect(await curve.realQuoteReserve()).to.equal(await ethers.provider.getBalance(await curve.getAddress()));

    await router.setShouldRevert(false);
    await expect(curve.connect(carol).executeGraduation()).to.not.be.reverted;
    expect(await curve.graduationExecuted()).to.equal(true);
  });
});
