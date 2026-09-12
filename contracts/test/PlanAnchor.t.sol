// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PlanAnchor} from "../src/PlanAnchor.sol";

/// @notice The lifecycle DEMO.md step 5 depends on: a plan is anchored before
///         the wallet policy opens and settled once the transaction lands.
///         No forge-std here on purpose, it is not vendored: plain require.
contract PlanAnchorTest {
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
}
