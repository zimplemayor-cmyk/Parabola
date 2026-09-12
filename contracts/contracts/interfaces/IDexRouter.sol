// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IDexRouter
/// @notice Minimal Uniswap-V2-style router interface — the single point
///         where Parabola talks to whatever AMM is live on Arc at
///         graduation time.
///
/// @dev WHY THIS INTERFACE, SPECIFICALLY: it is the most widely replicated
///      liquidity-provisioning interface in the EVM ecosystem; Aerodrome,
///      Velodrome, PancakeSwap, SushiSwap and dozens of others all ship a
///      router that implements this exact signature for backwards
///      compatibility, even when their own core pricing logic (V3/V4-style
///      concentrated liquidity, hooks, ve(3,3), etc.) is completely
///      different under the hood. That makes it the safest "lowest common
///      denominator" to build against before Arc's exact day-one DEX
///      addresses are public.
///
/// @dev UPGRADE PATH: Arc's confirmed day-one DEX set includes Uniswap v4,
///      Curve, Aerodrome/Velodrome, Euler and Fluid. Uniswap v4 in
///      particular does NOT implement this interface — v4 pools are
///      managed through a singleton PoolManager with hook contracts and an
///      unlock/callback pattern, not a router with addLiquidityETH. Treat
///      this interface as the MVP graduation path (compatible with any
///      V2-style router, including V2-compatibility shims many newer DEXs
///      ship), and see SECURITY.md → "Before mainnet with real funds" for
///      what's required to add a native v4 adapter.
interface IDexRouter {
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        payable
        returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

    function WETH() external pure returns (address);
}

/// @notice Minimal factory interface for looking up the pair/LP token
///         address created by a V2-style router, so it can be sent to the
///         burn address after graduation.
interface IDexFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}
