// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PlanAnchor} from "../src/PlanAnchor.sol";

/// @dev Only the cheatcodes this script needs. No forge-std here on purpose, it
///      is not vendored.
interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

interface Console {
    function log(string memory, address) external view;
}

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
    Console constant console = Console(0x000000000000000000636F6e736F6c652e6c6f67);

    /// @notice Broadcasts the deployment.
    /// @dev The broadcasting sender becomes the immutable `operator`, so it must
    ///      be the same key the app later uses as `OPERATOR_PRIVATE_KEY`.
    /// @return anchor The deployed register.
    function run() external returns (PlanAnchor anchor) {
        vm.startBroadcast();
        anchor = new PlanAnchor();
        vm.stopBroadcast();

        console.log("PlanAnchor deployed at", address(anchor));
        console.log("Operator pinned to", anchor.operator());
    }
}
