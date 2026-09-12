// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title BondingCurveMath
/// @notice Pure constant-product ("x*y=k") pricing math, isolated from all
///         state and token-transfer logic so it can be reasoned about and
///         tested on its own.
///
/// @dev Model
///   x = virtual quote reserve + real quote raised so far   (the "money" side)
///   y = tokens still held by the curve (curveSupply - tokensSold) (the "token" side)
///   k = x0 * y0, fixed at curve creation from the *initial* x and y.
///
///   Every quote is derived by holding k constant and solving for the new
///   reserve, exactly like Uniswap V2's core formula. There is no separate
///   "virtual token reserve" — the token side of the invariant is always the
///   literal number of tokens the curve contract has left, so the curve can
///   never be tricked into promising more tokens than it actually holds.
///
/// @dev Rounding policy (important for security, not just precision):
///   - getTokensOut floors the tokens paid to the buyer.
///   - getQuoteOut floors the quote currency paid to the seller.
///   Both round in the curve's favor, never the trader's. A trader can only
///   ever receive *at most* what perfect real-number math would give them,
///   never more. This is the same convention every constant-product AMM
///   uses and is what prevents rounding dust from being farmable.
library BondingCurveMath {
    /// @notice Tokens received for `netQuoteIn` additional quote currency,
    ///         given current reserves x (quote) and y (token).
    function getTokensOut(
        uint256 x,
        uint256 y,
        uint256 k,
        uint256 netQuoteIn
    ) internal pure returns (uint256 tokensOut) {
        if (netQuoteIn == 0) return 0;
        uint256 newX = x + netQuoteIn;
        // newY = k / newX, floored (Math.mulDiv rounds down by default)
        uint256 newY = Math.mulDiv(k, 1, newX);
        // y - newY: newY is strictly less than y whenever netQuoteIn > 0 and
        // k = x*y exactly, so this cannot underflow in the honest-input case;
        // callers still get Solidity's built-in underflow revert as a backstop.
        tokensOut = y - newY;
    }

    /// @notice Quote currency received for selling `tokenAmountIn` tokens
    ///         back into the curve, given current reserves x (quote) and y (token).
    function getQuoteOut(
        uint256 x,
        uint256 y,
        uint256 k,
        uint256 tokenAmountIn
    ) internal pure returns (uint256 quoteOut) {
        if (tokenAmountIn == 0) return 0;
        uint256 newY = y + tokenAmountIn;
        uint256 newX = Math.mulDiv(k, 1, newY, Math.Rounding.Ceil);
        // Ceil on newX => floor on (x - newX), i.e. we round the *payout*
        // down by rounding the post-trade reserve up. Same "curve-favored"
        // rounding direction as getTokensOut, just derived from the other side.
        if (newX >= x) return 0; // guards pathological/zero-liquidity edge cases
        quoteOut = x - newX;
    }
}
