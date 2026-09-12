// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PlanAnchor} from "../src/PlanAnchor.sol";

/// @dev Only the two cheatcodes these tests need. No forge-std here on purpose,
///      it is not vendored.
interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

/// @notice The lifecycle DEMO.md step 5 depends on: a plan is anchored before
///         the wallet policy opens and settled once the transaction lands.
///         Plain require, no forge-std.
contract PlanAnchorTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function test_anchorThenSettle() external {
        PlanAnchor planAnchor = new PlanAnchor();

        bytes32 planHash = keccak256("detent.v1|coupon|296|2026-Q3");
        address token = address(uint160(uint256(keccak256("detent.bmeq.token"))));
        bytes4 selector = bytes4(keccak256("distributeCoupon(bytes32,address[],uint256[])"));

        planAnchor.anchor(planHash, token, selector);

        require(planAnchor.anchoredCount() == 1, "anchoredCount should be 1");
        require(
            planAnchor.planOf(planHash).status == PlanAnchor.Status.Anchored,
            "status should be Anchored"
        );
        require(planAnchor.planOf(planHash).token == token, "token should be recorded");
        require(planAnchor.planOf(planHash).selector == selector, "selector should be recorded");

        planAnchor.settle(planHash, keccak256("detent.v1|receipt"));

        require(
            planAnchor.planOf(planHash).status == PlanAnchor.Status.Settled,
            "status should be Settled"
        );
    }

    /// @notice The money path: nobody but the deploying operator may write to the
    ///         register, whichever address tries.
    function testFuzz_anchorRejectsNonOperator(address caller) external {
        if (caller == address(this)) return;

        PlanAnchor planAnchor = new PlanAnchor();
        bytes32 planHash = keccak256("detent.v1|fuzz|not-operator");
        bytes4 selector = bytes4(keccak256("distributeCoupon(bytes32,address[],uint256[])"));

        vm.prank(caller);
        vm.expectRevert(PlanAnchor.NotOperator.selector);
        planAnchor.anchor(planHash, address(planAnchor), selector);
    }

    /// @notice The status transition and the recorded call hold for any plan hash.
    function testFuzz_anchorThenSettle(bytes32 planHash) external {
        PlanAnchor planAnchor = new PlanAnchor();

        address token = address(uint160(uint256(keccak256("detent.bmeq.token"))));
        bytes4 selector = bytes4(keccak256("distributeCoupon(bytes32,address[],uint256[])"));

        require(
            planAnchor.planOf(planHash).status == PlanAnchor.Status.Unknown,
            "status should start Unknown"
        );

        planAnchor.anchor(planHash, token, selector);

        require(
            planAnchor.planOf(planHash).status == PlanAnchor.Status.Anchored,
            "status should be Anchored"
        );
        require(planAnchor.planOf(planHash).token == token, "token should be recorded");
        require(planAnchor.planOf(planHash).selector == selector, "selector should be recorded");
        require(planAnchor.anchoredCount() == 1, "anchoredCount should be 1");

        planAnchor.settle(planHash, keccak256("detent.v1|fuzz|receipt"));

        require(
            planAnchor.planOf(planHash).status == PlanAnchor.Status.Settled,
            "status should be Settled"
        );
        require(planAnchor.planOf(planHash).settledAt != 0, "settledAt should be written");
    }
}
