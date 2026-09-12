// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PlanAnchor
/// @notice Detent compiles an approved corporate action into a single-use
///         wallet policy off chain. This contract is the on chain half of the
///         audit record: the operator anchors the plan hash before the treasury
///         key signs, and marks it settled with the resulting transaction hash.
///         Anyone reading HashScan can then check that the payout that landed
///         belongs to a plan that was anchored first.
contract PlanAnchor {
    enum Status {
        Unknown,
        Anchored,
        Settled,
        Abandoned
    }

    struct Plan {
        address token;
        bytes4 selector;
        address anchoredBy;
        uint64 anchoredAt;
        uint64 settledAt;
        Status status;
    }

    address public immutable operator;
    mapping(bytes32 => Plan) private plans;
    bytes32[] public anchoredHashes;

    event PlanAnchored(
        bytes32 indexed planHash,
        address indexed token,
        bytes4 selector,
        address anchoredBy
    );
    event PlanSettled(bytes32 indexed planHash, bytes32 txReference);
    event PlanAbandoned(bytes32 indexed planHash, string reason);

    error NotOperator();
    error AlreadyAnchored();
    error NotAnchored();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor() {
        operator = msg.sender;
    }

    /// @notice Record the hash of an approved plan before the wallet policy opens.
    function anchor(bytes32 planHash, address token, bytes4 selector) external onlyOperator {
        if (plans[planHash].status != Status.Unknown) revert AlreadyAnchored();

        plans[planHash] = Plan({
            token: token,
            selector: selector,
            anchoredBy: msg.sender,
            anchoredAt: uint64(block.timestamp),
            settledAt: 0,
            status: Status.Anchored
        });
        anchoredHashes.push(planHash);

        emit PlanAnchored(planHash, token, selector, msg.sender);
    }

    /// @notice Close a plan once the treasury transaction has landed.
    function settle(bytes32 planHash, bytes32 txReference) external onlyOperator {
        Plan storage plan = plans[planHash];
        if (plan.status != Status.Anchored) revert NotAnchored();

        plan.status = Status.Settled;
        plan.settledAt = uint64(block.timestamp);

        emit PlanSettled(planHash, txReference);
    }

    /// @notice Close a plan that was refused or withdrawn, so the record is complete.
    function abandon(bytes32 planHash, string calldata reason) external onlyOperator {
        Plan storage plan = plans[planHash];
        if (plan.status != Status.Anchored) revert NotAnchored();

        plan.status = Status.Abandoned;
        plan.settledAt = uint64(block.timestamp);

        emit PlanAbandoned(planHash, reason);
    }

    function planOf(bytes32 planHash) external view returns (Plan memory) {
        return plans[planHash];
    }

    function anchoredCount() external view returns (uint256) {
        return anchoredHashes.length;
    }
}
