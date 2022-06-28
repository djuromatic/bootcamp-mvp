// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0 <0.9.0;
import "hardhat/console.sol";

contract Donations {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CAMPAIN_ACTIVE = keccak256("CAMPAIN_ACTIVE");
    bytes32 public constant CAMPAIN_CLOSED = keccak256("CAMPAIN_CLOSED");

    constructor() {
        _owner = msg.sender;
    }

    struct Campain {
        string name;
        string description;
        uint256 timeToRise;
        address addr;
        uint256 fundsToRaise;
        bytes32 status;
    }

    mapping(address => Campain) private campains;
    mapping(address => bytes32) private administrators;
    mapping(address => Campain[]) private archivedCampains;
    address public _owner;

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

    modifier checkIfExpired(address campain) {
        require(
            block.timestamp < campains[campain].timeToRise,
            "campain has been expired"
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
        require(
            isMappingObjectExists(campaignAddress),
            "Campain already exists on this address"
        );
        campains[campaignAddress] = Campain(
            name,
            description,
            timeToRise,
            campaignAddress,
            fundsToRaise,
            CAMPAIN_ACTIVE
        );
    }

    function donateToCampain(address payable _to)
        public
        payable
        checkIfExpired(_to)
    {
        Campain memory camp = campains[_to];
        require(
            camp.status == CAMPAIN_ACTIVE,
            "There is no active campain on this address"
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
        (bool sent, ) = payable(_to).call{value: amount}("");
        require(sent, "Failed to send Ether");

        if (camp.fundsToRaise == 0) {
            camp.status = CAMPAIN_CLOSED;
            archivedCampains[_to].push(camp);
        }
        campains[_to] = camp;
    }

    function getCampain(address campain) public view returns (Campain memory) {
        return campains[campain];
    }

    function isMappingObjectExists(address key) private view returns (bool) {
        if (campains[key].status == CAMPAIN_ACTIVE) {
            return false;
        } else {
            return true;
        }
    }

    function getBlockTime() public view returns (uint256) {
        return block.timestamp;
    }
}
