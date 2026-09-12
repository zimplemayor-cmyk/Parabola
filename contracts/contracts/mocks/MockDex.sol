// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// ---------------------------------------------------------------------------
// TEST FIXTURES ONLY. These simulate "some V2-style DEX" well enough to
// exercise BondingCurve's graduation path in tests. They are not audited,
// not gas-optimized, and must never be pointed at by LaunchFactory.setDexConfig
// on a real network. See test/BondingCurve.test.ts for usage.
// ---------------------------------------------------------------------------

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockLPToken is ERC20 {
    constructor() ERC20("Mock LP", "MLP") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockDexRouter {
    address public immutable lpToken;
    address public constant WETH_ADDR = address(0xBEEF0);
    bool public shouldRevert;

    constructor(address lpToken_) {
        lpToken = lpToken_;
    }

    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256,
        uint256,
        address to,
        uint256
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        require(!shouldRevert, "MockDexRouter: forced revert");
        IERC20(token).transferFrom(msg.sender, address(this), amountTokenDesired);
        liquidity = amountTokenDesired;
        MockLPToken(lpToken).mint(to, liquidity);
        return (amountTokenDesired, msg.value, liquidity);
    }

    function WETH() external pure returns (address) {
        return WETH_ADDR;
    }
}

contract MockDexFactory {
    address public immutable pair;

    constructor(address pair_) {
        pair = pair_;
    }

    function getPair(address, address) external view returns (address) {
        return pair;
    }
}
