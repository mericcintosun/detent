// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {App} from "../src/App.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function run() external returns (App app) {
        vm.startBroadcast();
        app = new App();
        vm.stopBroadcast();
    }
}
