// SPDX-License-Identifier: MIT
// Pinned to the compiler `foundry.toml` selects, so the bytecode a judge builds
// is the bytecode that was tested.
pragma solidity 0.8.24;

/// @title PlanAnchor
/// @author Detent
/// @notice Detent compiles an approved corporate action into a single-use
///         wallet policy off chain. This contract is the on chain half of the
///         audit record: the operator anchors the plan hash before the treasury
///         key signs, and closes it with the resulting transaction reference.
///         Anyone reading HashScan can then check that the payout that landed
///         belongs to a plan that was anchored first.
/// @dev    The register holds no ether, declares no `payable` function and makes
///         no external call of any kind, so there is no reentrancy surface and no
///         value to rescue. Checks-effects-interactions still holds trivially:
///         every mutating function validates, then writes storage, then emits.
///         No guard, no pull-payment and no token rescue hook is added, because
///         with no call and no balance they would only be dead code.
contract PlanAnchor {
    /// @notice Lifecycle of a plan hash in the register.
    /// @dev `Unknown` is the zero value, so an unwritten mapping slot reads as
    ///      "never anchored". The machine is one way: Unknown to Anchored, then
    ///      Anchored to exactly one of Settled or Abandoned. Both terminal states
    ///      are final.
    enum Status {
        Unknown,
        Anchored,
        Settled,
        Abandoned
    }

    /// @notice One register row: what was approved, who anchored it, and when it
    ///         opened and closed.
    /// @dev Field order is chosen for storage packing, not for reading order.
    ///      Slot 0 is token (20) + selector (4) + anchoredAt (8) = 32 bytes
    ///      exactly. Slot 1 is anchoredBy (20) + closedAt (8) + status (1) = 29
    ///      bytes. Two slots instead of three, which is one cold SSTORE saved on
    ///      every `anchor`.
    struct Plan {
        // The security the approved call targets.
        address token;
        // The 4 byte selector of the approved call.
        bytes4 selector;
        // Unix seconds at which the plan was anchored.
        uint64 anchoredAt;
        // The operator address that anchored the plan.
        address anchoredBy;
        // Unix seconds at which the plan reached a terminal state, settled or
        // abandoned. Zero while the plan is still open.
        uint64 closedAt;
        // Where the plan sits in the lifecycle.
        Status status;
    }

    /// @notice The longest `reason` string `abandon` accepts, in bytes.
    /// @dev The reason is emitted as unindexed event data, so an unbounded string
    ///      is an unbounded gas cost on a function the operator pays for. A short
    ///      audit note fits comfortably.
    uint256 public constant MAX_REASON_BYTES = 256;

    /// @notice The only address allowed to write to the register. Set once, at
    ///         deployment, to the deployer.
    address public immutable operator;

    /// @notice While true, every write reverts with `Paused()`. Reads stay open.
    bool public paused;

    /// @dev Plan hash to register row. Private so the only read path is `planOf`,
    ///      which returns the whole struct rather than a positional tuple.
    mapping(bytes32 => Plan) private plans;

    /// @notice Every plan hash ever anchored, in the order it was anchored.
    /// @dev Append only. A hash appears here exactly once, because `anchor`
    ///      rejects a second write to the same hash.
    bytes32[] public anchoredHashes;

    /// @notice Emitted when a plan hash enters the register.
    /// @param planHash The keccak hash of the approved plan.
    /// @param token The security the approved call targets.
    /// @param selector The 4 byte selector of the approved call.
    /// @param anchoredBy The operator address that anchored the plan.
    event PlanAnchored(bytes32 indexed planHash, address indexed token, bytes4 selector, address anchoredBy);

    /// @notice Emitted when an anchored plan is closed as settled.
    /// @param planHash The plan hash that was closed.
    /// @param txReference The reference of the treasury transaction that landed.
    event PlanSettled(bytes32 indexed planHash, bytes32 txReference);

    /// @notice Emitted when an anchored plan is closed as abandoned.
    /// @param planHash The plan hash that was closed.
    /// @param reason Why the plan was refused or withdrawn.
    event PlanAbandoned(bytes32 indexed planHash, string reason);

    /// @notice Emitted whenever the operator sets the pause flag.
    /// @param paused The new value of the flag.
    event PauseSet(bool paused);

    /// @notice The caller is not the operator.
    error NotOperator();

    /// @notice The plan hash is already in the register.
    error AlreadyAnchored();

    /// @notice The plan hash is not currently open, so it cannot be closed.
    error NotAnchored();

    /// @notice Writes are paused.
    error Paused();

    /// @notice The plan hash is zero, which is not the hash of anything approved.
    error InvalidPlanHash();

    /// @notice The token address is zero, so the row would name no security.
    error InvalidToken();

    /// @notice The selector is zero, so the row would name no call.
    error InvalidSelector();

    /// @notice The transaction reference is zero, so the row would claim a
    ///         settlement it cannot identify.
    error InvalidTxReference();

    /// @notice The abandon reason is empty or longer than `MAX_REASON_BYTES`.
    error InvalidReason();

    /// @notice Restricts a function to the deploying operator.
    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    /// @notice Blocks a function while the register is paused.
    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    /// @notice Deploys the register and pins the operator to the deployer.
    /// @dev `operator` is immutable, so there is no transfer path and no way to
    ///      hand the register to a wrong address after deployment.
    constructor() {
        operator = msg.sender;
    }

    /// @notice The escape hatch: the operator can stop writes to the register
    ///         during a live demo without redeploying the contract. Reads stay
    ///         open either way, so a paused register still renders the record.
    /// @param value True to stop writes, false to resume them.
    function setPaused(bool value) external onlyOperator {
        paused = value;
        emit PauseSet(value);
    }

    /// @notice Record the hash of an approved plan before the wallet policy opens.
    /// @dev Reverts with `AlreadyAnchored` if the hash has any status other than
    ///      `Unknown`, which covers both a replay of an open plan and a rewrite
    ///      of a closed one.
    /// @param planHash The keccak hash of the approved plan. Must not be zero.
    /// @param token The security the approved call targets. Must not be zero.
    /// @param selector The 4 byte selector of the approved call. Must not be zero.
    function anchor(bytes32 planHash, address token, bytes4 selector) external onlyOperator whenNotPaused {
        if (planHash == bytes32(0)) revert InvalidPlanHash();
        if (token == address(0)) revert InvalidToken();
        if (selector == bytes4(0)) revert InvalidSelector();
        if (plans[planHash].status != Status.Unknown) revert AlreadyAnchored();

        plans[planHash] = Plan({
            token: token,
            selector: selector,
            anchoredAt: uint64(block.timestamp),
            anchoredBy: msg.sender,
            closedAt: 0,
            status: Status.Anchored
        });
        anchoredHashes.push(planHash);

        emit PlanAnchored(planHash, token, selector, msg.sender);
    }

    /// @notice Close a plan once the treasury transaction has landed.
    /// @param planHash The plan hash to close. Must currently be `Anchored`.
    /// @param txReference The reference of the transaction that landed. Must not
    ///        be zero.
    function settle(bytes32 planHash, bytes32 txReference) external onlyOperator whenNotPaused {
        if (txReference == bytes32(0)) revert InvalidTxReference();

        Plan storage plan = plans[planHash];
        if (plan.status != Status.Anchored) revert NotAnchored();

        plan.status = Status.Settled;
        plan.closedAt = uint64(block.timestamp);

        emit PlanSettled(planHash, txReference);
    }

    /// @notice Close a plan that was refused or withdrawn, so the record is complete.
    /// @param planHash The plan hash to close. Must currently be `Anchored`.
    /// @param reason Why the plan was refused or withdrawn. Must be between 1 and
    ///        `MAX_REASON_BYTES` bytes.
    function abandon(bytes32 planHash, string calldata reason) external onlyOperator whenNotPaused {
        uint256 reasonLength = bytes(reason).length;
        if (reasonLength == 0 || reasonLength > MAX_REASON_BYTES) revert InvalidReason();

        Plan storage plan = plans[planHash];
        if (plan.status != Status.Anchored) revert NotAnchored();

        plan.status = Status.Abandoned;
        plan.closedAt = uint64(block.timestamp);

        emit PlanAbandoned(planHash, reason);
    }

    /// @notice Read one register row.
    /// @dev A hash that was never anchored returns the zero struct, whose status
    ///      is `Unknown`. That is the documented answer, not an error.
    /// @param planHash The plan hash to read.
    /// @return The register row for that hash.
    function planOf(bytes32 planHash) external view returns (Plan memory) {
        return plans[planHash];
    }

    /// @notice How many distinct plan hashes have ever been anchored.
    /// @return The length of `anchoredHashes`.
    function anchoredCount() external view returns (uint256) {
        return anchoredHashes.length;
    }
}
