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
        bytes32 status;
        bool fundsTransfered;
    }

    mapping(uint256 => Campaign) private campaigns;
    mapping(address => bytes32) private administrators;
    mapping(uint256 => uint256) private cBalances;

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
            campaigns[_id].fundsTransfered == false,
            "funds already transfered"
        );
        _;
    }

    function addAdminRole(address admin) public isOwner {
        administrators[admin] = ADMIN_ROLE;
    }

    function removeAdmin(address admin) public isOwner {
        administrators[admin] = 0;
    }

    function checkIfAdministrator(address admin) public view returns (bytes32) {
        return administrators[admin];
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
            CAMPAIGN_ACTIVE,
            false
        );
        campaignId.increment();
    }

    function donateToCampaign(uint256 id) public payable checkIfEnded(id) {
        Campaign memory camp = campaigns[id];
        require(
            camp.status == CAMPAIGN_ACTIVE,
            "There is no active campaign on this address"
        );
        uint256 amount = msg.value;
        if (camp.fundsToRaise < amount) {
            uint256 change = amount - camp.fundsToRaise;
            amount = amount - change;
            camp.fundsToRaise = 0;
            (bool success, ) = payable(msg.sender).call{value: change}("");
            require(success, "Failed to send Ether back");
        } else {
            camp.fundsToRaise -= msg.value;
        }
        (bool sent, ) = payable(address(this)).call{value: amount}("");
        require(sent, "Failed to send Ether");
        cBalances[id] += amount;
        if (camp.fundsToRaise == 0) {
            camp.status = CAMPAIGN_CLOSED;
        }
        campaigns[id] = camp;
    }

    function withdrawal(uint256 _id)
        public
        checkIfStatusClosed(_id)
        ownerOfCampaign(_id)
        fundsNotTransfered(_id)
    {
        uint256 balance = cBalances[_id];
        payable(msg.sender).transfer(balance);
        campaigns[_id].fundsTransfered = true;
        campaigns[_id].status = CAMPAIGN_CLOSED;
        cBalances[_id] = 0;
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
}
