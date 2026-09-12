// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PlanAnchor} from "../src/PlanAnchor.sol";

/// @dev Only the cheatcodes this script needs. No forge-std here on purpose, it
///      is not vendored.
interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
    function envAddress(string calldata) external view returns (address);
}

/// @title Smoke
/// @notice One safe real interaction with the deployed anchor: record a demo plan
///         hash and close it, which leaves two verifiable transactions on
///         HashScan.
/// @dev Like `Deploy`, the no-argument `startBroadcast()` signs with the sender
///      `forge script` was given, so the key lives in an encrypted keystore and
///      never appears on a command line. Only the contract address travels
///      through the environment, and that is public information.
///
///      The run is one-shot by design. `anchor` rejects a repeat of the same plan
///      hash with `AlreadyAnchored`, so a second run against the same deployment
///      reverts instead of writing a duplicate row.
contract Smoke {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    /// @notice The `DEPLOYED_CONTRACT` environment variable is unset or zero.
    error MissingDeployedContract();

    /// @notice There is no contract at `DEPLOYED_CONTRACT` on this network.
    error NotAContract(address target);

    /// @notice Anchors one demo plan hash against the deployed register and
    ///         settles it.
    /// @dev Reads `DEPLOYED_CONTRACT` from the environment and refuses to
    ///      broadcast against an empty address or an address with no code, so a
    ///      typo fails locally rather than burning a transaction. The sender must
    ///      be the operator that deployed the register.
    function run() external {
        address target = vm.envAddress("DEPLOYED_CONTRACT");
        if (target == address(0)) revert MissingDeployedContract();
        if (target.code.length == 0) revert NotAContract(target);

        PlanAnchor anchor = PlanAnchor(target);

        bytes32 planHash = keccak256("detent.v1|smoke|coupon|2026-Q3");
        bytes4 selector = bytes4(keccak256("distributeCoupon(bytes32,address[],uint256[])"));

        // The register itself stands in for the security here: this is a smoke
        // row, not a real corporate action, and the address only has to be a real
        // non-zero contract on this network.
        vm.startBroadcast();
        anchor.anchor(planHash, target, selector);
        anchor.settle(planHash, keccak256("smoke-receipt"));
        vm.stopBroadcast();
    }
}
