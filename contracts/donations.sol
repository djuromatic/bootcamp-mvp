// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

contract Donations{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CAMPAIN_ACTIVE = keccak256("CAMPAIN_ACTIVE");
    bytes32 public constant CAMPAIN_CLOSED = keccak256("CAMPAIN_CLOSED");
    constructor() {
        _owner = msg.sender;
    }

    struct Campain {
        string name;
        string description;
        uint timeToRise;
        address addr;
        uint fundsToRaise;
        bytes32 status;
    }

    mapping(address => Campain) private campains;
    mapping(address => bytes32) private administrators;
    mapping(address => Campain[]) private archivedCampains;
    address _owner;

    modifier isOwner() {
        require(msg.sender == _owner, "Only for owner");
        _;
    }

    modifier isAdmin() {
        require(administrators[msg.sender] == ADMIN_ROLE, "Administrator role required");
        _;
    }

    function addAdminRole(address admin) public isOwner {
            administrators[admin] = ADMIN_ROLE;
    }

    function removeAdmin(address admin) public isOwner{
        administrators[admin] = 0;
    }

     function createCampain(address campainAddress, string memory name, string memory description, uint  timeToRise,uint  fundsToRaise) public isAdmin  {
        require(isMappingObjectExists(campainAddress), "Campain already exists on this address");
        campains[campainAddress] = Campain(name, description, timeToRise, campainAddress, fundsToRaise, CAMPAIN_ACTIVE);
    }

    function donateToCampain(address payable _to) public payable {
        Campain memory camp  = campains[_to];
        require(camp.status == CAMPAIN_ACTIVE, "There is no active campain on this address");
        (bool sent, bytes memory data) = _to.call{value: msg.value}("");
        require(sent, "Failed to send Ether");
        data;
        camp.fundsToRaise -= msg.value;
        if(camp.fundsToRaise == 0 || block.timestamp > camp.timeToRise){
            camp.status = CAMPAIN_CLOSED;
            archivedCampains[_to].push(camp);
        }
        campains[_to] = camp;
    }

    function getCampains() public view returns(Campain memory){
        return campains[msg.sender];
    }

    function isMappingObjectExists(address key) private view returns (bool) {
        if(campains[key].status == CAMPAIN_ACTIVE){
            return false;
        }
        else{
            return true;
        }    
    }

    function getBlockTime() public view returns(uint256){
        return block.timestamp;
    }
}
