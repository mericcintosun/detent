// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// TEMPLATE: rename and reshape for the idea. Kept minimal and correct:
/// checks-effects-interactions, access control, events for every state change.
contract App {
    address public owner;
    mapping(address => uint256) public records;

    event RecordSet(address indexed who, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setRecord(uint256 value) external {
        records[msg.sender] = value;
        emit RecordSet(msg.sender, value);
    }
}
