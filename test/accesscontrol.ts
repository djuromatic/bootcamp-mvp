import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

export const testAccessControl = () => {
  describe("AccessControl", function () {
    let contract;
    let donationsContract: any;
    let owner: SignerWithAddress;
    let admin: SignerWithAddress;
    let user: SignerWithAddress;
    const nullPointer =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    beforeEach(async () => {
      contract = await ethers.getContractFactory("Donations");
      [owner, admin, user] = await ethers.getSigners();

      donationsContract = await contract.deploy();
      await donationsContract.deployed();
    });

    it("Should set to right owner", async () => {
      const ownerOfContract = await donationsContract._owner();
      expect(owner.address).to.be.equal(ownerOfContract);
    });

    it("Should check if adminstrator created and removed", async function () {
      const adminTx = await donationsContract.addAdminRole(admin.address);
      const adminRoleBytes = await donationsContract.ADMIN_ROLE();
      const getAdminStatus = await donationsContract.checkIfAdministrator(
        admin.address
      );
      expect(adminRoleBytes).to.be.equal(getAdminStatus);

      expect(adminTx)
        .to.emit(donationsContract, "AdminCreated")
        .withArgs(admin.address);

      const removeAdminTx = await donationsContract.removeAdmin(admin.address);
      await removeAdminTx.wait();

      expect(adminTx)
        .to.emit(donationsContract, "AdminRemoved")
        .withArgs(admin.address);

      const getRemovedAdmin = await donationsContract.checkIfAdministrator(
        admin.address
      );
      expect(getRemovedAdmin).to.be.equal(nullPointer);
    });

    it("Should revert creating of admin", async () => {
      await expect(
        donationsContract.connect(user).addAdminRole(admin.address)
      ).to.be.revertedWith("Only for owner");
    });
  });
};
