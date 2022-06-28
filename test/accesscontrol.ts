import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

export const testAccessControl = () => {
  describe("AccessControl", function () {
    let contract;
    let donations: any;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addr3: SignerWithAddress;
    const nullPointer =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    let CAMPAIN_CLOSED: string;
    let CAMPAIN_ACTIVE: string;
    beforeEach(async () => {
      contract = await ethers.getContractFactory("Donations");
      [owner, addr1, addr2, addr3] = await ethers.getSigners();

      // To deploy our contract, we just have to call Token.deploy() and await
      // for it to be deployed(), which happens once its transaction has been
      // mined.
      donations = await contract.deploy();
      await donations.deployed();

      CAMPAIN_CLOSED = await donations.CAMPAIN_CLOSED();
      CAMPAIN_ACTIVE = await donations.CAMPAIN_ACTIVE();
    });

    it("Should set to right owner", async () => {
      const ownerOfContract = await donations._owner();
      expect(owner.address).to.be.equal(ownerOfContract);
    });

    it("Should check if adminstrator created and removed", async function () {
      await donations.addAdminRole(addr1.address);
      const adminRoleBytes = await donations.ADMIN_ROLE();
      const getAdminStatus = await donations.checkIfAdministrator(
        addr1.address
      );
      expect(adminRoleBytes).to.be.equal(getAdminStatus);

      const removeAdminTx = await donations.removeAdmin(addr1.address);
      await removeAdminTx.wait();

      const getRemovedAdmin = await donations.checkIfAdministrator(
        addr1.address
      );
      expect(getRemovedAdmin).to.be.equal(nullPointer);
    });

    it("Should revert creating of admin", async () => {
      await expect(
        donations.connect(addr2).addAdminRole(addr1.address)
      ).to.be.revertedWith("Only for owner");
    });
  });
};
