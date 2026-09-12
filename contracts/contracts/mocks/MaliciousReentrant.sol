// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// TEST FIXTURE ONLY. Simulates a malicious launch creator / seller whose
// receiving contract tries to re-enter BondingCurve the moment it is paid
// (creator fee on a buy, or sale proceeds on a sell) — exactly the shape of
// attack `nonReentrant` + checks-effects-interactions is there to stop.

interface IERC20ForAttack {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IBondingCurveForAttack {
    function buy(address recipient, uint256 minTokensOut) external payable returns (uint256);
    function sell(uint256 tokenAmountIn, uint256 minQuoteOut, address recipient) external returns (uint256);
}

interface IFactoryForAttack {
    function createMemeLaunch(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        uint256 minTokensOut
    ) external payable returns (address token, address curve);
}

contract MaliciousReentrant {
    IBondingCurveForAttack public victim;
    bool public attackOnBuy;
    bool public attacked;

    function setTarget(address target_, bool attackOnBuy_) external {
        victim = IBondingCurveForAttack(target_);
        attackOnBuy = attackOnBuy_;
    }

    function attackViaBuy() external payable {
        victim.buy{value: msg.value}(address(this), 0);
    }

    function attackViaSell(uint256 amount) external {
        victim.sell(amount, 0, address(this));
    }

    /// @dev Lets this contract approve its own token holdings directly,
    ///      instead of tests needing account impersonation — impersonating
    ///      this contract to call approve() would itself have to send a
    ///      transaction "from" it, which is unrealistic (a real attacker
    ///      controls their contract's code, not a magic impersonation) and
    ///      in practice tripped this contract's own receive()-based attack
    ///      logic when the test funded it with plain ETH first.
    function approveToken(address tokenAddr, address spender, uint256 amount) external {
        IERC20ForAttack(tokenAddr).approve(spender, amount);
    }

    /// @dev Becomes the `creator` of a brand-new launch (msg.sender from the
    ///      factory's point of view), so this contract is the one paid the
    ///      creator fee cut on every subsequent buy — the entry point an
    ///      attacker would actually use in the wild.
    function createEvilLaunch(address factoryAddr) external payable returns (address curveAddr) {
        (, curveAddr) = IFactoryForAttack(factoryAddr).createMemeLaunch{value: msg.value}(
            "Evil", "EVL", "", 0
        );
        victim = IBondingCurveForAttack(curveAddr);
        attackOnBuy = true;
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            if (attackOnBuy) {
                // Try to buy again with whatever we were just paid.
                victim.buy{value: msg.value}(address(this), 0);
            } else {
                victim.sell(1, 0, address(this));
            }
        }
    }
}
