// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PlanAnchor} from "../src/PlanAnchor.sol";

/// @dev Only the cheatcodes these tests need. No forge-std here on purpose, it is
///      not vendored and the suite must build from a bare clone.
interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function expectEmit(bool, bool, bool, bool) external;
    function warp(uint256) external;
    function assume(bool) external pure;
}

/// @notice The whole lifecycle of the register, closed on every edge.
///
///         The audit (M5) found the suite asserted the happy path and little
///         else: `abandon` was never called, `onlyOperator` was never asserted on
///         `settle` or `abandon`, and neither `AlreadyAnchored` nor `NotAnchored`
///         was ever produced. These tests walk the state machine exhaustively:
///         Unknown to Anchored to Settled, Unknown to Anchored to Abandoned, and
///         every illegal transition out of every state with the exact custom
///         error it must revert with. Access control is asserted on all four
///         mutating functions and the pause gate on all three it covers,
///         including the paused-then-unpaused path.
///
///         Plain require, no forge-std.
contract PlanAnchorTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    /// @dev Local copies of the contract events, so `vm.expectEmit` has something
    ///      to match against without importing forge-std.
    event PlanAnchored(bytes32 indexed planHash, address indexed token, bytes4 selector, address anchoredBy);
    event PlanSettled(bytes32 indexed planHash, bytes32 txReference);
    event PlanAbandoned(bytes32 indexed planHash, string reason);
    event PauseSet(bool paused);

    PlanAnchor internal planAnchor;

    bytes32 internal constant PLAN_HASH = keccak256("detent.v1|coupon|296|2026-Q3");
    bytes32 internal constant TX_REFERENCE = keccak256("detent.v1|receipt");
    bytes4 internal constant SELECTOR = bytes4(keccak256("distributeCoupon(bytes32,address[],uint256[])"));
    string internal constant REASON = "compliance hold, board withdrew the resolution";

    address internal token;

    function setUp() public {
        planAnchor = new PlanAnchor();
        token = address(uint160(uint256(keccak256("detent.bmeq.token"))));
    }

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    /// @notice The deployer is the operator, the register starts open and empty.
    function test_deploymentPinsOperatorAndStartsOpen() external view {
        require(planAnchor.operator() == address(this), "operator should be the deployer");
        require(!planAnchor.paused(), "register should start unpaused");
        require(planAnchor.anchoredCount() == 0, "register should start empty");
        require(planAnchor.MAX_REASON_BYTES() == 256, "reason bound should be 256 bytes");
    }

    /// @notice A hash nobody anchored reads as Unknown with an empty row, which is
    ///         the documented answer rather than a revert.
    function test_unknownPlanReadsAsZeroRow() external view {
        PlanAnchor.Plan memory plan = planAnchor.planOf(PLAN_HASH);

        require(plan.status == PlanAnchor.Status.Unknown, "status should be Unknown");
        require(plan.token == address(0), "token should be empty");
        require(plan.selector == bytes4(0), "selector should be empty");
        require(plan.anchoredBy == address(0), "anchoredBy should be empty");
        require(plan.anchoredAt == 0, "anchoredAt should be empty");
        require(plan.closedAt == 0, "closedAt should be empty");
    }

    // -------------------------------------------------------------------------
    // Unknown to Anchored to Settled
    // -------------------------------------------------------------------------

    /// @notice The lifecycle DEMO.md step 5 depends on: a plan is anchored before
    ///         the wallet policy opens and settled once the transaction lands.
    function test_anchorThenSettle() external {
        vm.warp(1_760_000_000);

        vm.expectEmit(true, true, true, true);
        emit PlanAnchored(PLAN_HASH, token, SELECTOR, address(this));
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        require(planAnchor.anchoredCount() == 1, "anchoredCount should be 1");
        require(planAnchor.anchoredHashes(0) == PLAN_HASH, "the hash should be in the register order");

        PlanAnchor.Plan memory anchored = planAnchor.planOf(PLAN_HASH);
        require(anchored.status == PlanAnchor.Status.Anchored, "status should be Anchored");
        require(anchored.token == token, "token should be recorded");
        require(anchored.selector == SELECTOR, "selector should be recorded");
        require(anchored.anchoredBy == address(this), "anchoredBy should be the operator");
        require(anchored.anchoredAt == 1_760_000_000, "anchoredAt should be the anchoring block");
        require(anchored.closedAt == 0, "closedAt should stay zero while the plan is open");

        vm.warp(1_760_000_600);

        vm.expectEmit(true, true, true, true);
        emit PlanSettled(PLAN_HASH, TX_REFERENCE);
        planAnchor.settle(PLAN_HASH, TX_REFERENCE);

        PlanAnchor.Plan memory settled = planAnchor.planOf(PLAN_HASH);
        require(settled.status == PlanAnchor.Status.Settled, "status should be Settled");
        require(settled.closedAt == 1_760_000_600, "closedAt should be the settling block");
        require(settled.anchoredAt == 1_760_000_000, "anchoredAt must not be overwritten");
        require(planAnchor.anchoredCount() == 1, "settling must not touch the register order");
    }

    // -------------------------------------------------------------------------
    // Unknown to Anchored to Abandoned
    // -------------------------------------------------------------------------

    /// @notice The other terminal state, which the audit found was never called:
    ///         a refused or withdrawn plan is closed so the record is complete.
    function test_anchorThenAbandon() external {
        vm.warp(1_760_000_000);
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        vm.warp(1_760_000_900);

        vm.expectEmit(true, true, true, true);
        emit PlanAbandoned(PLAN_HASH, REASON);
        planAnchor.abandon(PLAN_HASH, REASON);

        PlanAnchor.Plan memory abandoned = planAnchor.planOf(PLAN_HASH);
        require(abandoned.status == PlanAnchor.Status.Abandoned, "status should be Abandoned");
        require(abandoned.closedAt == 1_760_000_900, "closedAt should be the abandoning block");
        require(abandoned.anchoredAt == 1_760_000_000, "anchoredAt must not be overwritten");
        require(abandoned.token == token, "token must survive the close");
        require(abandoned.selector == SELECTOR, "selector must survive the close");
        require(planAnchor.anchoredCount() == 1, "abandoning must not touch the register order");
    }

    // -------------------------------------------------------------------------
    // Illegal transitions out of Unknown
    // -------------------------------------------------------------------------

    /// @notice A hash that was never anchored cannot be settled.
    function test_settleRevertsWhenUnknown() external {
        vm.expectRevert(PlanAnchor.NotAnchored.selector);
        planAnchor.settle(PLAN_HASH, TX_REFERENCE);
    }

    /// @notice A hash that was never anchored cannot be abandoned.
    function test_abandonRevertsWhenUnknown() external {
        vm.expectRevert(PlanAnchor.NotAnchored.selector);
        planAnchor.abandon(PLAN_HASH, REASON);
    }

    // -------------------------------------------------------------------------
    // Illegal transitions out of Anchored
    // -------------------------------------------------------------------------

    /// @notice An open plan cannot be anchored twice. This is the guard the
    ///         replayed `lock` call in the app depends on.
    function test_anchorRevertsWhenAlreadyAnchored() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        vm.expectRevert(PlanAnchor.AlreadyAnchored.selector);
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        require(planAnchor.anchoredCount() == 1, "the rejected anchor must not append");
    }

    /// @notice A second anchor of the same hash is rejected even with different
    ///         arguments, so a replay cannot rewrite what was approved.
    function test_anchorRevertsWhenAlreadyAnchoredWithDifferentArguments() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        vm.expectRevert(PlanAnchor.AlreadyAnchored.selector);
        planAnchor.anchor(PLAN_HASH, address(0xBEEF), bytes4(keccak256("transfer(address,uint256)")));

        PlanAnchor.Plan memory plan = planAnchor.planOf(PLAN_HASH);
        require(plan.token == token, "the original token must stand");
        require(plan.selector == SELECTOR, "the original selector must stand");
    }

    // -------------------------------------------------------------------------
    // Illegal transitions out of the terminal states
    // -------------------------------------------------------------------------

    /// @notice Settled is final: it cannot be settled again.
    function test_settleRevertsAfterSettled() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
        planAnchor.settle(PLAN_HASH, TX_REFERENCE);

        vm.expectRevert(PlanAnchor.NotAnchored.selector);
        planAnchor.settle(PLAN_HASH, keccak256("detent.v1|second-receipt"));
    }

    /// @notice Settled is final: it cannot be flipped to abandoned.
    function test_abandonRevertsAfterSettled() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
        planAnchor.settle(PLAN_HASH, TX_REFERENCE);

        vm.expectRevert(PlanAnchor.NotAnchored.selector);
        planAnchor.abandon(PLAN_HASH, REASON);
    }

    /// @notice Settled is final: the hash cannot be re-anchored.
    function test_anchorRevertsAfterSettled() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
        planAnchor.settle(PLAN_HASH, TX_REFERENCE);

        vm.expectRevert(PlanAnchor.AlreadyAnchored.selector);
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
    }

    /// @notice Abandoned is final: it cannot be abandoned again.
    function test_abandonRevertsAfterAbandoned() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
        planAnchor.abandon(PLAN_HASH, REASON);

        vm.expectRevert(PlanAnchor.NotAnchored.selector);
        planAnchor.abandon(PLAN_HASH, "second try");
    }

    /// @notice Abandoned is final: a withdrawn plan cannot be settled afterwards.
    ///         This is the transition that would let a refused payout be recorded
    ///         as if it had landed.
    function test_settleRevertsAfterAbandoned() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
        planAnchor.abandon(PLAN_HASH, REASON);

        vm.expectRevert(PlanAnchor.NotAnchored.selector);
        planAnchor.settle(PLAN_HASH, TX_REFERENCE);
    }

    /// @notice Abandoned is final: the hash cannot be re-anchored for a retry.
    function test_anchorRevertsAfterAbandoned() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
        planAnchor.abandon(PLAN_HASH, REASON);

        vm.expectRevert(PlanAnchor.AlreadyAnchored.selector);
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
    }

    // -------------------------------------------------------------------------
    // Access control on all four mutating functions
    // -------------------------------------------------------------------------

    /// @notice The money path: nobody but the deploying operator may write to the
    ///         register, whichever address tries.
    function testFuzz_anchorRejectsNonOperator(address caller) external {
        vm.assume(caller != address(this));

        vm.prank(caller);
        vm.expectRevert(PlanAnchor.NotOperator.selector);
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
    }

    /// @notice Closing an open plan as settled is operator only, the gap M5 named.
    function testFuzz_settleRejectsNonOperator(address caller) external {
        vm.assume(caller != address(this));
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        vm.prank(caller);
        vm.expectRevert(PlanAnchor.NotOperator.selector);
        planAnchor.settle(PLAN_HASH, TX_REFERENCE);

        require(planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Anchored, "the plan must still be open");
    }

    /// @notice Closing an open plan as abandoned is operator only, the other half
    ///         of the gap M5 named. A stranger must not be able to void a plan.
    function testFuzz_abandonRejectsNonOperator(address caller) external {
        vm.assume(caller != address(this));
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        vm.prank(caller);
        vm.expectRevert(PlanAnchor.NotOperator.selector);
        planAnchor.abandon(PLAN_HASH, REASON);

        require(planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Anchored, "the plan must still be open");
    }

    /// @notice The escape hatch is owner gated: nobody but the deploying operator
    ///         may pause or resume the register, whichever address tries.
    function testFuzz_setPausedRejectsNonOperator(address caller) external {
        vm.assume(caller != address(this));

        vm.prank(caller);
        vm.expectRevert(PlanAnchor.NotOperator.selector);
        planAnchor.setPaused(true);
    }

    // -------------------------------------------------------------------------
    // The pause gate, on every function that carries it
    // -------------------------------------------------------------------------

    /// @notice The escape hatch, the one gap the Phase 5 audit found: a wedged
    ///         register must not wedge the recorded demo. Paused stops the write
    ///         and unpausing lets the same anchor through.
    function test_pausedBlocksAnchorAndOperatorCanResume() external {
        vm.expectEmit(true, true, true, true);
        emit PauseSet(true);
        planAnchor.setPaused(true);
        require(planAnchor.paused(), "paused should be true");

        vm.expectRevert(PlanAnchor.Paused.selector);
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        planAnchor.setPaused(false);
        require(!planAnchor.paused(), "paused should be false again");

        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        require(
            planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Anchored,
            "status should be Anchored after resuming"
        );
        require(planAnchor.anchoredCount() == 1, "anchoredCount should be 1");
    }

    /// @notice Pausing mid lifecycle holds an open plan open, and unpausing lets
    ///         the same settlement through.
    function test_pausedBlocksSettleAndOperatorCanResume() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
        planAnchor.setPaused(true);

        vm.expectRevert(PlanAnchor.Paused.selector);
        planAnchor.settle(PLAN_HASH, TX_REFERENCE);

        planAnchor.setPaused(false);
        planAnchor.settle(PLAN_HASH, TX_REFERENCE);

        require(planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Settled, "status should be Settled");
    }

    /// @notice The same gate on the abandon path, so a paused register cannot be
    ///         used to void a plan either.
    function test_pausedBlocksAbandonAndOperatorCanResume() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
        planAnchor.setPaused(true);

        vm.expectRevert(PlanAnchor.Paused.selector);
        planAnchor.abandon(PLAN_HASH, REASON);

        planAnchor.setPaused(false);
        planAnchor.abandon(PLAN_HASH, REASON);

        require(planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Abandoned, "status should be Abandoned");
    }

    /// @notice Reads stay open while writes are paused, which is what keeps the
    ///         record route rendering during an incident.
    function test_pausedLeavesReadsOpen() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
        planAnchor.setPaused(true);

        require(planAnchor.anchoredCount() == 1, "anchoredCount should read while paused");
        require(planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Anchored, "planOf should read while paused");
        require(planAnchor.anchoredHashes(0) == PLAN_HASH, "the register order should read while paused");
    }

    // -------------------------------------------------------------------------
    // Input validation
    // -------------------------------------------------------------------------

    /// @notice L2: a register row that names no security is worse than no row.
    function test_anchorRejectsZeroToken() external {
        vm.expectRevert(PlanAnchor.InvalidToken.selector);
        planAnchor.anchor(PLAN_HASH, address(0), SELECTOR);

        require(planAnchor.anchoredCount() == 0, "the rejected anchor must not append");
    }

    /// @notice The zero hash is not the hash of anything that was approved.
    function test_anchorRejectsZeroPlanHash() external {
        vm.expectRevert(PlanAnchor.InvalidPlanHash.selector);
        planAnchor.anchor(bytes32(0), token, SELECTOR);
    }

    /// @notice A row with no selector names no call, so it witnesses nothing.
    function test_anchorRejectsZeroSelector() external {
        vm.expectRevert(PlanAnchor.InvalidSelector.selector);
        planAnchor.anchor(PLAN_HASH, token, bytes4(0));
    }

    /// @notice A settled row must identify the transaction it settled.
    function test_settleRejectsZeroTxReference() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        vm.expectRevert(PlanAnchor.InvalidTxReference.selector);
        planAnchor.settle(PLAN_HASH, bytes32(0));

        require(planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Anchored, "the plan must still be open");
    }

    /// @notice An abandoned row without a reason explains nothing to an auditor.
    function test_abandonRejectsEmptyReason() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        vm.expectRevert(PlanAnchor.InvalidReason.selector);
        planAnchor.abandon(PLAN_HASH, "");

        require(planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Anchored, "the plan must still be open");
    }

    /// @notice The exact upper boundary of the reason bound is accepted.
    function test_abandonAcceptsReasonAtMaxLength() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        planAnchor.abandon(PLAN_HASH, _reasonOfLength(planAnchor.MAX_REASON_BYTES()));

        require(planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Abandoned, "status should be Abandoned");
    }

    /// @notice One byte past the bound is refused, so the event payload an
    ///         operator pays for stays bounded.
    function test_abandonRejectsReasonOverMaxLength() external {
        planAnchor.anchor(PLAN_HASH, token, SELECTOR);
        // Built before `expectRevert`, because reading the bound is itself a call
        // and would consume the expectation.
        string memory overlong = _reasonOfLength(planAnchor.MAX_REASON_BYTES() + 1);

        vm.expectRevert(PlanAnchor.InvalidReason.selector);
        planAnchor.abandon(PLAN_HASH, overlong);

        require(planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Anchored, "the plan must still be open");
    }

    // -------------------------------------------------------------------------
    // Fuzz
    // -------------------------------------------------------------------------

    /// @notice The status transition and the recorded call hold for any plan hash.
    function testFuzz_anchorThenSettle(bytes32 planHash) external {
        vm.assume(planHash != bytes32(0));

        require(planAnchor.planOf(planHash).status == PlanAnchor.Status.Unknown, "status should start Unknown");

        planAnchor.anchor(planHash, token, SELECTOR);

        PlanAnchor.Plan memory anchored = planAnchor.planOf(planHash);
        require(anchored.status == PlanAnchor.Status.Anchored, "status should be Anchored");
        require(anchored.token == token, "token should be recorded");
        require(anchored.selector == SELECTOR, "selector should be recorded");
        require(anchored.closedAt == 0, "closedAt should be zero while open");
        require(planAnchor.anchoredCount() == 1, "anchoredCount should be 1");

        planAnchor.settle(planHash, keccak256("detent.v1|fuzz|receipt"));

        PlanAnchor.Plan memory settled = planAnchor.planOf(planHash);
        require(settled.status == PlanAnchor.Status.Settled, "status should be Settled");
        require(settled.closedAt != 0, "closedAt should be written");
    }

    /// @notice The abandon branch holds for any plan hash.
    function testFuzz_anchorThenAbandon(bytes32 planHash) external {
        vm.assume(planHash != bytes32(0));

        planAnchor.anchor(planHash, token, SELECTOR);
        planAnchor.abandon(planHash, REASON);

        PlanAnchor.Plan memory abandoned = planAnchor.planOf(planHash);
        require(abandoned.status == PlanAnchor.Status.Abandoned, "status should be Abandoned");
        require(abandoned.closedAt != 0, "closedAt should be written");
        require(planAnchor.anchoredCount() == 1, "anchoredCount should be 1");
    }

    /// @notice The zero token is refused for every hash and every selector, not
    ///         only for the one pair the unit test pins.
    function testFuzz_anchorRejectsZeroToken(bytes32 planHash, bytes4 selector) external {
        vm.assume(planHash != bytes32(0));
        vm.assume(selector != bytes4(0));

        vm.expectRevert(PlanAnchor.InvalidToken.selector);
        planAnchor.anchor(planHash, address(0), selector);
    }

    /// @notice Boundary fuzz over the reason bound: every length from 1 to
    ///         `MAX_REASON_BYTES` is accepted and every length above it reverts,
    ///         with the boundary itself approached from both sides.
    function testFuzz_abandonReasonLengthBound(uint16 rawLength) external {
        uint256 maximum = planAnchor.MAX_REASON_BYTES();
        uint256 length = uint256(rawLength) % (2 * maximum + 1);

        planAnchor.anchor(PLAN_HASH, token, SELECTOR);

        if (length == 0 || length > maximum) {
            vm.expectRevert(PlanAnchor.InvalidReason.selector);
            planAnchor.abandon(PLAN_HASH, _reasonOfLength(length));
            require(
                planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Anchored,
                "a refused reason must leave the plan open"
            );
        } else {
            planAnchor.abandon(PLAN_HASH, _reasonOfLength(length));
            require(
                planAnchor.planOf(PLAN_HASH).status == PlanAnchor.Status.Abandoned,
                "an accepted reason must close the plan"
            );
        }
    }

    /// @notice The register keeps every distinct hash, in order, once each.
    function testFuzz_registerKeepsOrder(bytes32 first, bytes32 second) external {
        vm.assume(first != bytes32(0));
        vm.assume(second != bytes32(0));
        vm.assume(first != second);

        planAnchor.anchor(first, token, SELECTOR);
        planAnchor.anchor(second, token, SELECTOR);

        require(planAnchor.anchoredCount() == 2, "anchoredCount should be 2");
        require(planAnchor.anchoredHashes(0) == first, "first hash should come first");
        require(planAnchor.anchoredHashes(1) == second, "second hash should come second");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /// @dev Builds a reason string of exactly `length` bytes.
    function _reasonOfLength(uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            buffer[i] = "x";
        }
        return string(buffer);
    }
}
