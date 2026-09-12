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

/// @dev forge's console, reached with a low-level staticcall. See `Deploy.s.sol`
///      for why a typed interface call to this address reverts.
address constant CONSOLE = 0x000000000000000000636F6e736F6c652e6c6f67;

/// @title Smoke
/// @notice One safe real interaction with the deployed anchor: record a demo plan
///         hash and close it, which leaves two verifiable transactions on
///         HashScan.
/// @dev Like `Deploy`, the no-argument `startBroadcast()` signs with the sender
///      `forge script` was given, so the key lives in an encrypted keystore and
///      never appears on a command line. Only the contract address travels
///      through the environment, and that is public information.
///
///      The run is safe to repeat. It reads the smoke plan's state first: an
///      unknown plan is anchored and settled, a plan left anchored by an
///      interrupted run is only settled, and a closed plan sends nothing. A retry
///      after a relay error therefore finishes the job instead of reverting with
///      `AlreadyAnchored`, and it never writes a second row.
contract Smoke {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    /// @notice The plan hash the smoke run anchors, public so a test can read it back.
    bytes32 public constant PLAN_HASH = keccak256("detent.v1|smoke|coupon|2026-Q3");

    /// @notice The `DEPLOYED_CONTRACT` environment variable is unset or zero.
    error MissingDeployedContract();

    /// @notice There is no contract at `DEPLOYED_CONTRACT` on this network.
    error NotAContract(address target);

    /// @notice Anchors the smoke plan hash against the deployed register and
    ///         settles it, finishing whatever an earlier run left undone.
    /// @dev Reads `DEPLOYED_CONTRACT` from the environment and refuses to
    ///      broadcast against an empty address or an address with no code, so a
    ///      typo fails locally rather than burning a transaction. The sender must
    ///      be the operator that deployed the register.
    function run() external {
        address target = vm.envAddress("DEPLOYED_CONTRACT");
        if (target == address(0)) revert MissingDeployedContract();
        if (target.code.length == 0) revert NotAContract(target);

        PlanAnchor anchor = PlanAnchor(target);
        PlanAnchor.Status status = anchor.planOf(PLAN_HASH).status;
        if (status == PlanAnchor.Status.Settled || status == PlanAnchor.Status.Abandoned) {
            _log("Smoke plan already closed, nothing sent");
            return;
        }

        bytes4 selector = bytes4(keccak256("distributeCoupon(bytes32,address[],uint256[])"));

        // The register itself stands in for the security here: this is a smoke
        // row, not a real corporate action, and the address only has to be a real
        // non-zero contract on this network.
        vm.startBroadcast();
        if (status == PlanAnchor.Status.Unknown) anchor.anchor(PLAN_HASH, target, selector);
        anchor.settle(PLAN_HASH, keccak256("smoke-receipt"));
        vm.stopBroadcast();

        _log("Smoke plan anchored and settled");
    }

    /// @dev Best effort print through forge's console, see `CONSOLE`.
    function _log(string memory message) private view {
        bytes memory payload = abi.encodeWithSignature("log(string)", message);
        address sink = CONSOLE;
        assembly {
            pop(staticcall(gas(), sink, add(payload, 32), mload(payload), 0, 0))
        }
    }
}
