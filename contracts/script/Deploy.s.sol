// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PlanAnchor} from "../src/PlanAnchor.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

interface Console {
    function log(string memory, address) external view;
}

contract Deploy {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    Console constant console = Console(0x000000000000000000636F6e736F6c652e6c6f67);

    function run() external returns (PlanAnchor anchor) {
        vm.startBroadcast();
        anchor = new PlanAnchor();
        vm.stopBroadcast();
        console.log("PlanAnchor deployed at", address(anchor));
    }
}
