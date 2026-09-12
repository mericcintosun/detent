// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PlanAnchor} from "../src/PlanAnchor.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {Smoke} from "../script/Smoke.s.sol";

/// @dev Only the cheatcodes these tests need. No forge-std here on purpose.
interface ScriptVm {
    function setEnv(string calldata name, string calldata value) external;
    function toString(address value) external pure returns (string memory);
    function prank(address sender) external;
}

/// @notice The two broadcast scripts, executed the way `forge script` executes them.
///
///         `Deploy.run()` used to revert on every network: it printed through a
///         typed interface to forge's console address, and Solidity checks that a
///         call target has code before a high-level call. The console address has
///         none, so the script never finished. The unit tests never ran the scripts,
///         so nothing caught it. These tests run both scripts end to end and prove
///         the smoke run is safe to repeat.
contract ScriptsTest {
    ScriptVm constant vm = ScriptVm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    bytes4 internal constant SELECTOR = bytes4(keccak256("distributeCoupon(bytes32,address[],uint256[])"));

    function test_deployScriptDeploysARegisterWithAPinnedOperator() public {
        PlanAnchor anchor = new Deploy().run();
        require(address(anchor).code.length > 0, "no code at the deployed address");
        require(anchor.operator() != address(0), "operator not pinned");
    }

    function test_smokeAnchorsAndSettlesThenSendsNothingOnARepeat() public {
        PlanAnchor anchor = new Deploy().run();
        vm.setEnv("DEPLOYED_CONTRACT", vm.toString(address(anchor)));
        Smoke smoke = new Smoke();
        bytes32 planHash = smoke.PLAN_HASH();

        smoke.run();
        require(anchor.anchoredCount() == 1, "smoke did not anchor");
        require(anchor.planOf(planHash).status == PlanAnchor.Status.Settled, "smoke did not settle");

        smoke.run();
        require(anchor.anchoredCount() == 1, "a repeat wrote a second row");
        require(anchor.planOf(planHash).status == PlanAnchor.Status.Settled, "a repeat changed the closed plan");
    }

    function test_smokeFinishesAPlanAnInterruptedRunLeftAnchored() public {
        PlanAnchor anchor = new Deploy().run();
        vm.setEnv("DEPLOYED_CONTRACT", vm.toString(address(anchor)));
        Smoke smoke = new Smoke();
        bytes32 planHash = smoke.PLAN_HASH();
        address operator = anchor.operator();

        vm.prank(operator);
        anchor.anchor(planHash, address(anchor), SELECTOR);

        smoke.run();
        require(anchor.planOf(planHash).status == PlanAnchor.Status.Settled, "the anchored plan was not settled");
        require(anchor.anchoredCount() == 1, "a second row was written");
    }
}
