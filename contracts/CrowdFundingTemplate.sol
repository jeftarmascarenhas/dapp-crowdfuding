// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract CrowdFundingTemplate is ERC721 {
    using Strings for uint256;

    Campaign public campaign;
    bool canceled = false;
    uint256 public constant PERIOD = 30 days;
    string public baseUri = "";
    uint256 private tokendIds;

    mapping(address => Donor) public donorsAmount;
    mapping(address => uint256) public donorsBadges;

    struct Campaign {
        uint256 id;
        address owner;
        string name;
        uint256 goal;
        uint256 pledged;
        uint32 startAt;
        uint32 endAt;
        bool claimed;
    }

    struct Donor {
        address donor;
        uint256 amount;
    }

    event Pledge(uint256 indexed campaignId, address donor, uint256 amount);
    event Refund(uint256 indexed campaignId, address donor, uint256 amount);

    constructor(
        uint256 _id,
        address _owner,
        string memory _name,
        uint256 _goal,
        uint32 _startAt,
        uint32 _endAt
    ) ERC721(_name, "CDF") {
        require(_startAt >= block.timestamp, "start at < now");
        require(_endAt >= _startAt, "end at < start at");
        require(_endAt <= block.timestamp + PERIOD, "end at > max duration");

        campaign = Campaign({
            id: _id,
            owner: _owner,
            name: _name,
            goal: _goal,
            pledged: 0,
            startAt: _startAt,
            endAt: _endAt,
            claimed: false
        });
    }

    modifier onlyOwner() {
        require(campaign.owner == msg.sender, "only owner");
        _;
    }

    function mintNFT(address _donor) internal virtual {
        tokendIds++;
        _mint(_donor, tokendIds);
    }

    function createBadges() internal {
        uint256 totalAmount = donorsAmount[msg.sender].amount;
        uint256 totalBadges = donorsBadges[msg.sender];
        uint256 amountSize = totalAmount - (totalBadges * 1000000000000000000);

        while (amountSize >= 1000000000000000000) {
            mintNFT(msg.sender);
            donorsBadges[msg.sender] += 1;
            amountSize -= 1000000000000000000;
        }
    }

    function pledge() public payable {
        require(!canceled, "canceled");
        require(msg.value >= 0.01 ether, "must be at least 0.01 ETH");
        require(block.timestamp >= campaign.startAt, "not started");
        require(block.timestamp <= campaign.endAt, "ended");
        require(
            campaign.endAt <= block.timestamp + PERIOD,
            "campaign finished"
        );

        require(!canceled, "campaign canceled");

        campaign.pledged += msg.value;
        donorsAmount[msg.sender].donor = msg.sender;
        donorsAmount[msg.sender].amount += msg.value;

        createBadges();

        emit Pledge(campaign.id, msg.sender, msg.value);
    }

    function setCanceled() external onlyOwner {
        require(
            campaign.endAt <= block.timestamp + PERIOD,
            "greater than 30 days"
        );
        canceled = true;
    }

    function claim() external onlyOwner {
        require(!campaign.claimed, "campaign claimed");
        require(!canceled, "canceled");
        require(
            campaign.pledged >= campaign.goal &&
                block.timestamp > campaign.endAt,
            "campaign not finish"
        );

        campaign.claimed = true;
        uint256 totalBalance = address(this).balance;

        (bool success, ) = msg.sender.call{value: totalBalance}("");
        require(success, "fail claim");
    }

    function refund() external {
        require(
            canceled ||
                (campaign.pledged < campaign.goal &&
                    campaign.endAt > block.timestamp + PERIOD),
            "cannot refund"
        );

        require(donorsAmount[msg.sender].donor == msg.sender, "not donor");
        require(donorsAmount[msg.sender].amount > 0, "not fund");

        uint256 amount = donorsAmount[msg.sender].amount;
        donorsAmount[msg.sender].amount = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "fail refund");

        emit Refund(campaign.id, msg.sender, amount);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseUri;
    }

    function setTokenURI(string memory _uri) external onlyOwner {
        baseUri = _uri;
    }

    function tokenURI(uint256 _tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        string memory currentBaseURI = _baseURI();
        return
            bytes(currentBaseURI).length > 0
                ? string(
                    abi.encodePacked(
                        currentBaseURI,
                        _tokenId.toString(),
                        ".json"
                    )
                )
                : "";
    }
}
