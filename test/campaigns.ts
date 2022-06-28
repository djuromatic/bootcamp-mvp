import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";

export const testCampaign = () => {
  describe("Campains", function () {
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
    let expTime: any;
    const oneEth = utils.parseEther("1.0");

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

      await donations.addAdminRole(owner.address);

      const blockTime = BigNumber.from(await donations.getBlockTime());
      const oneEth = utils.parseEther("1.0");
      expTime = blockTime.add(10);
      await donations.createCampaign(
        addr3.address,
        "test",
        "test",
        expTime,
        oneEth
      );
    });

    it("Should create campain", async () => {
      const getCampainForAddress = await donations.getCampain(addr3.address);

      const status = await donations.CAMPAIN_ACTIVE();

      /*
      If not converted to String it is failing
      AssertionError: expected [ 'test', 'test', …(4), …(6) ] to equal [ 'test', 'test', …(4) ]
      + expected - actual
    */
      expect(getCampainForAddress.toString()).to.be.equal(
        ["test", "test", expTime, addr3.address, oneEth, status].toString()
      );
    });
    it("Should fail to create Campain if user not Admin", async () => {
      await donations.removeAdmin(owner.address);
      await expect(
        donations.createCampaign(addr3.address, "test", "test", expTime, oneEth)
      ).to.be.revertedWith("Administrator role required");
    });
    it("Should fail to create two campains active for same address", async () => {
      await expect(
        donations.createCampaign(addr3.address, "test", "test", expTime, oneEth)
      ).to.be.revertedWith("Campain already exists on this address");
    });
    it("Should close after founds are collected", async () => {
      let campain;
      await donations.connect(addr2).donateToCampain(addr3.address, {
        value: utils.parseEther("0.3"),
      });
      campain = await donations.getCampain(addr3.address);
      expect(campain.status).to.be.equal(CAMPAIN_ACTIVE);

      await donations.connect(addr2).donateToCampain(addr3.address, {
        value: utils.parseEther("0.2"),
      });
      campain = await donations.getCampain(addr3.address);
      expect(campain.status).to.be.equal(CAMPAIN_ACTIVE);

      await donations.connect(addr2).donateToCampain(addr3.address, {
        value: utils.parseEther("0.6"),
      });
      campain = await donations.getCampain(addr3.address);
      expect(campain.status).to.be.equal(CAMPAIN_CLOSED);
    });

    it("Should return exeeded amout after overpaid donation", async () => {
      const balance = await addr2.getBalance();
      await donations.connect(addr2).donateToCampain(addr3.address, {
        value: utils.parseEther("2.0"),
      });

      const balanceAfterDonation = await addr2.getBalance();
      const spendedAmount = balance.sub(balanceAfterDonation);

      expect(spendedAmount)
        .to.be.above(utils.parseEther("1.0"))
        .and.to.be.below(utils.parseEther("1.001"));
    });

    it("Should expire after some time", async () => {
      await donations.connect(addr2).donateToCampain(addr3.address, {
        value: utils.parseEther("0.1"),
      });

      await new Promise((resolve) => setTimeout(resolve, 12000));
      await expect(
        donations.connect(addr2).donateToCampain(addr3.address, {
          value: utils.parseEther("0.1"),
        })
      ).to.be.revertedWith("campain has been expired");
    }).timeout(20000);
  });
};
