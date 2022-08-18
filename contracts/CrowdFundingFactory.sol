// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "hardhat/console.sol";
import "./CrowdFundingTemplate.sol";

contract CrowdFundingFactory {
    event CreateCrowdFund(
        uint256 indexed id,
        address indexed owner,
        string name,
        uint256 goal,
        uint32 startAt,
        uint32 endAt
    );

    CrowdFundingTemplate[] public crowdFunds;
    uint256 public campaignId = 0;

    function createCrowdFund(
        address _owner,
        string memory _name,
        uint256 _goal,
        uint32 _startAt,
        uint32 _endAt
    ) external {
        campaignId++;
        CrowdFundingTemplate newCrowdFund = new CrowdFundingTemplate(
            campaignId,
            _owner,
            _name,
            _goal,
            _startAt,
            _endAt
        );

        crowdFunds.push(newCrowdFund);

        emit CreateCrowdFund(
            campaignId,
            msg.sender,
            _name,
            _goal,
            _startAt,
            _endAt
        );
    }
}
