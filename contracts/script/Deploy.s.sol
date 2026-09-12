// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PlanAnchor} from "../src/PlanAnchor.sol";

/// @dev Only the cheatcodes this script needs. No forge-std here on purpose, it
///      is not vendored.
interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @dev forge's console. The address has no code on a real network, on anvil or in
///      a test, so a call through a typed interface reverts on Solidity's extcodesize
///      check before it is ever made. That is how this script used to revert on every
///      network after the deployment. A low-level staticcall skips the check: forge
///      intercepts it and prints, and anywhere else it returns without effect.
address constant CONSOLE = 0x000000000000000000636F6e736F6c652e6c6f67;

/// @title Deploy
/// @notice Deploys `PlanAnchor` and prints the address to wire into
///         `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS`.
/// @dev The no-argument `startBroadcast()` is deliberate: it signs with whatever
///      sender `forge script` was given, so the key stays in an encrypted
///      keystore (`--account`) and never reaches a command line argument, a shell
///      history entry or this source file. `contracts/README.md` documents that
///      flow. Do not add a `vm.envUint("PRIVATE_KEY")` variant here, it would put
///      the raw key back into the process environment.
contract Deploy {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    /// @notice Broadcasts the deployment.
    /// @dev The broadcasting sender becomes the immutable `operator`, so it must
    ///      be the same key the app later uses as `OPERATOR_PRIVATE_KEY`.
    /// @return anchor The deployed register.
    function run() external returns (PlanAnchor anchor) {
        vm.startBroadcast();
        anchor = new PlanAnchor();
        vm.stopBroadcast();

        _log("PlanAnchor deployed at", address(anchor));
        _log("Operator pinned to", anchor.operator());
    }

    /// @dev Best effort print through forge's console, see `CONSOLE`.
    function _log(string memory label, address value) private view {
        bytes memory payload = abi.encodeWithSignature("log(string,address)", label, value);
        address sink = CONSOLE;
        assembly {
            pop(staticcall(gas(), sink, add(payload, 32), mload(payload), 0, 0))
        }
    }
}
