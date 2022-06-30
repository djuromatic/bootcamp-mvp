import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";

export const testCampaign = () => {
  describe("Campaigns", function () {
    let contract;
    let donations: any;
    let createDonationTx: any;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addr3: SignerWithAddress;
    const nullPointer =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    let CAMPAIGN_CLOSED: string;
    let CAMPAIGN_ACTIVE: string;
    let expTime: any;
    const oneEth = utils.parseEther("1.0");
    const campaignId = 1;

    beforeEach(async () => {
      contract = await ethers.getContractFactory("Donations");
      [owner, addr1, addr2, addr3] = await ethers.getSigners();

      // To deploy our contract, we just have to call Token.deploy() and await
      // for it to be deployed(), which happens once its transaction has been
      // mined.
      donations = await contract.deploy();
      await donations.deployed();

      CAMPAIGN_CLOSED = await donations.CAMPAIGN_CLOSED();
      CAMPAIGN_ACTIVE = await donations.CAMPAIGN_ACTIVE();

      await donations.addAdminRole(owner.address);

      const blockTime = BigNumber.from(await donations.getBlockTime());
      const oneEth = utils.parseEther("1.0");
      expTime = blockTime.add(10);
      createDonationTx = await donations.createCampaign(
        addr3.address,
        "test",
        "test",
        expTime,
        oneEth
      );
    });

    it("Should create campaign", async () => {
      await expect(createDonationTx)
        .to.emit(donations, "CampaignCreated")
        .withArgs(
          owner.address,
          addr3.address,
          1,
          oneEth,
          CAMPAIGN_ACTIVE,
          "test"
        );
    });

    it("Should fail to create Campaign if user not Admin", async () => {
      await donations.removeAdmin(owner.address);
      await expect(
        donations.createCampaign(addr3.address, "test", "test", expTime, oneEth)
      ).to.be.revertedWith("Administrator role required");
    });

    it("Should close after founds are collected", async () => {
      let campaign;
      const donationFirstTx = await donations
        .connect(addr2)
        .donateToCampaign(campaignId, {
          value: utils.parseEther("0.3"),
        });
      campaign = await donations.getCampaign(campaignId);
      expect(campaign.status).to.be.equal(CAMPAIGN_ACTIVE);
      await expect(donationFirstTx)
        .to.emit(donations, "DonationDeposited")
        .withArgs(addr2.address, utils.parseEther("0.3"));

      const donationSecondTx = await donations
        .connect(addr2)
        .donateToCampaign(campaignId, {
          value: utils.parseEther("0.2"),
        });
      campaign = await donations.getCampaign(campaignId);
      expect(campaign.status).to.be.equal(CAMPAIGN_ACTIVE);
      await expect(donationSecondTx)
        .to.emit(donations, "DonationDeposited")
        .withArgs(addr2.address, utils.parseEther("0.2"));

      const lastDonationTx = await donations
        .connect(addr2)
        .donateToCampaign(campaignId, {
          value: utils.parseEther("0.6"),
        });
      campaign = await donations.getCampaign(campaignId);
      expect(campaign.status).to.be.equal(CAMPAIGN_CLOSED);
      await expect(lastDonationTx)
        .to.emit(donations, "DonationDeposited")
        .withArgs(addr2.address, utils.parseEther("0.5"));

      await expect(lastDonationTx)
        .to.emit(donations, "FundsCollected")
        .withArgs(1, utils.parseEther("1.0"));
    });

    it("Should return exeeded amout after overpaid donation", async () => {
      const balance = await addr2.getBalance();
      const donationTx = await donations
        .connect(addr2)
        .donateToCampaign(campaignId, {
          value: utils.parseEther("2.0"),
        });

      const balanceAfterDonation = await addr2.getBalance();
      const spendedAmount = balance.sub(balanceAfterDonation);
      await expect(donationTx)
        .to.emit(donations, "DonationAmountReturned")
        .withArgs(addr2.address, utils.parseEther("1.0"));
      expect(spendedAmount)
        .to.be.above(utils.parseEther("1.0"))
        .and.to.be.below(utils.parseEther("1.001"));
    });

    it("Should expire after some time", async () => {
      await donations.connect(addr2).donateToCampaign(campaignId, {
        value: utils.parseEther("0.1"),
      });

      await new Promise((resolve) => setTimeout(resolve, 12000));
      await expect(
        donations.connect(addr2).donateToCampaign(campaignId, {
          value: utils.parseEther("0.1"),
        })
      ).to.be.revertedWith("campaign has ended");
    }).timeout(20000);

    it("Should withdrawal funds from campaign", async () => {
      await donations.connect(addr2).donateToCampaign(campaignId, {
        value: utils.parseEther("2"),
      });

      const contractBallance = await donations.getBalance();
      expect(contractBallance).to.be.equal(utils.parseEther("1.0"));
      const campaignWalletBalance = await addr3.getBalance();

      const wdTx = await donations.connect(addr3).withdrawal(campaignId);
      const campaignWalletBalanceAfter = await addr3.getBalance();
      expect(campaignWalletBalance).to.be.below(campaignWalletBalanceAfter);
      await expect(wdTx)
        .to.emit(donations, "FundsWithdrawed")
        .withArgs(addr3.address, utils.parseEther("1.0"));
    });

    it("Should fail to withdrawal if campaign not over", async () => {
      await expect(
        donations.connect(addr3).withdrawal(campaignId)
      ).to.be.revertedWith("Campaign is still active");
    });

    it("Should fail to withdrawal user is not owner of campaign", async () => {
      await donations.connect(addr2).donateToCampaign(campaignId, {
        value: utils.parseEther("2"),
      });
      await expect(
        donations.connect(addr1).withdrawal(campaignId)
      ).to.be.revertedWith("No access to withdrawal");
    });
  });
};
