// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PlanAnchor} from "../src/PlanAnchor.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
    function envAddress(string calldata) external view returns (address);
}

/// One safe real interaction with the deployed anchor: record a demo plan hash
/// and close it, which leaves two verifiable transactions on HashScan.
contract Smoke {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function run() external {
        PlanAnchor anchor = PlanAnchor(vm.envAddress("DEPLOYED_CONTRACT"));

        bytes32 planHash = keccak256("detent.v1|smoke|coupon|2026-Q3");
        bytes4 selector = bytes4(keccak256("distributeCoupon(bytes32,address[],uint256[])"));

        vm.startBroadcast();
        anchor.anchor(planHash, address(anchor), selector);
        anchor.settle(planHash, keccak256("smoke-receipt"));
        vm.stopBroadcast();
    }
}
