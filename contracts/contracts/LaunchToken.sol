// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title LaunchToken
/// @notice The token every creator launches through Parabola. Deliberately
///         minimal: fixed supply minted once at construction, no owner, no
///         mint/pause/blacklist function of any kind, no transfer hooks.
///
/// @dev Trust property: once deployed, NOTHING — not the creator, not
///      Parabola, not a compromised admin key — can inflate supply, freeze
///      transfers, or touch a holder's balance. The entire attack surface
///      of "the token contract itself" is the standard, audited
///      OpenZeppelin ERC20 implementation and nothing else. This is a
///      deliberate simplicity choice: every extra feature (blacklist,
///      pause, fee-on-transfer) is also an extra way to rug holders, so
///      Parabola tokens have none of them.
contract LaunchToken is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        address mintTo_
    ) ERC20(name_, symbol_) {
        _mint(mintTo_, totalSupply_);
    }
}
