// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IParabolaFactory
/// @notice The slice of LaunchFactory that a BondingCurve needs to read.
///
/// @dev Router/factory addresses are looked up dynamically at graduation
///      time rather than frozen into each curve at creation. Arc mainnet
///      launches September 16, 2026 and this codebase is being finished
///      before that date — the exact live DEX router address will not be
///      knowable until launch day (or shortly after). Reading it live from
///      LaunchFactory means every already-deployed curve automatically
///      picks up the correct router the moment the owner configures it,
///      with no need to re-deploy or migrate anything.
interface IParabolaFactory {
    function dexRouter() external view returns (address);
    function dexFactory() external view returns (address);
}
