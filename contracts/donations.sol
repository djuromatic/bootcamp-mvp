// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0 <0.9.0;
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Donations {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CAMPAIGN_ACTIVE = keccak256("CAMPAIGN_ACTIVE");
    bytes32 public constant CAMPAIGN_CLOSED = keccak256("CAMPAIGN_CLOSED");

    using Counters for Counters.Counter;
    Counters.Counter private campaignId;

    address public _owner;

    receive() external payable {}

    constructor() {
        _owner = msg.sender;
        campaignId.increment();
    }

    struct Campaign {
        string name;
        string description;
        uint256 timeToRise;
        address addr;
        uint256 fundsToRaise;
        uint256 balance;
        bytes32 status;
        bool fundsWithdrawed;
    }

    mapping(uint256 => Campaign) private campaigns;
    mapping(address => bytes32) private administrators;

    event AdminCreated(address admin);
    event AdminRemoved(address admin);
    event CampaignCreated(
        address indexed admin,
        address indexed campaignOwner,
        uint256 campaignId,
        uint256 fundsToRaise,
        bytes32 status,
        string name
    );
    event DonationDeposited(address indexed donator, uint256 amount);
    event DonationAmountReturned(address indexed donator, uint256 change);
    event FundsCollected(uint256 campaignId, uint256 fundsCollected);
    event FundsWithdrawed(address indexed receiver, uint256 amount);

    modifier isOwner() {
        require(msg.sender == _owner, "Only for owner");
        _;
    }

    modifier isAdmin() {
        require(
            administrators[msg.sender] == ADMIN_ROLE,
            "Administrator role required"
        );
        _;
    }

    modifier checkIfEnded(uint256 id) {
        require(
            block.timestamp < campaigns[id].timeToRise,
            "campaign has ended"
        );
        _;
    }

    modifier checkIfStatusClosed(uint256 _id) {
        require(
            campaigns[_id].status == CAMPAIGN_CLOSED,
            "Campaign is still active"
        );
        _;
    }

    modifier ownerOfCampaign(uint256 _id) {
        require(campaigns[_id].addr == msg.sender, "No access to withdrawal");
        _;
    }

    modifier fundsNotTransfered(uint256 _id) {
        require(
            campaigns[_id].fundsWithdrawed == false,
            "funds already transfered"
        );
        _;
    }

    function addAdminRole(address admin) public isOwner {
        administrators[admin] = ADMIN_ROLE;
        emit AdminCreated(admin);
    }

    function removeAdmin(address admin) public isOwner {
        administrators[admin] = 0;
        emit AdminRemoved(admin);
    }

    function createCampaign(
        address campaignAddress,
        string memory name,
        string memory description,
        uint256 timeToRise,
        uint256 fundsToRaise
    ) public isAdmin {
        campaigns[campaignId.current()] = Campaign(
            name,
            description,
            timeToRise,
            campaignAddress,
            fundsToRaise,
            0,
            CAMPAIGN_ACTIVE,
            false
        );
        emit CampaignCreated(
            msg.sender,
            campaignAddress,
            campaignId.current(),
            fundsToRaise,
            CAMPAIGN_ACTIVE,
            name
        );
        campaignId.increment();
    }

    function donateToCampaign(uint256 id) public payable checkIfEnded(id) {
        Campaign memory campaign = campaigns[id];
        require(
            campaign.status == CAMPAIGN_ACTIVE,
            "There is no active campaign on this address"
        );

        uint256 amount = returnIfExeededAmount(campaign);

        (bool sent, ) = payable(address(this)).call{value: amount}("");
        require(sent, "Failed to send Ether");
        campaign.balance += amount;
        if (msg.value != amount) {
            campaign.fundsToRaise = 0;
            campaign.status = CAMPAIGN_CLOSED;
            emit FundsCollected(id, campaign.balance);
        } else {
            campaign.fundsToRaise -= msg.value;
        }
        campaigns[id] = campaign;
        emit DonationDeposited(msg.sender, amount);
    }

    function withdrawal(uint256 _id)
        public
        checkIfStatusClosed(_id)
        ownerOfCampaign(_id)
        fundsNotTransfered(_id)
    {
        Campaign memory campaign = campaigns[_id];
        uint256 balance = campaign.balance;
        payable(msg.sender).transfer(balance);
        campaign.fundsWithdrawed = true;
        campaign.status = CAMPAIGN_CLOSED;
        campaign.balance = 0;
        emit FundsWithdrawed(msg.sender, balance);
    }

    function checkIfAdministrator(address admin) public view returns (bytes32) {
        return administrators[admin];
    }

    function getCampaign(uint256 id) public view returns (Campaign memory) {
        return campaigns[id];
    }

    function getBlockTime() public view returns (uint256) {
        return block.timestamp;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function returnIfExeededAmount(Campaign memory campaign)
        private
        returns (uint256)
    {
        uint256 amount = msg.value;
        if (campaign.fundsToRaise < amount) {
            uint256 change = amount - campaign.fundsToRaise;
            amount = amount - change;
            (bool success, ) = payable(msg.sender).call{value: change}("");
            require(success, "Failed to send Ether back");
            emit DonationAmountReturned(msg.sender, change);
        }
        return amount;
    }
}
