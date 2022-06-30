import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";

export const testCampaign = () => {
  describe("Campaigns", function () {
    let contract;
    let donationsContract: any;
    let createDonationTx: any;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let contractOwner: SignerWithAddress;
    let CAMPAIGN_CLOSED: string;
    let CAMPAIGN_ACTIVE: string;
    let expTime: any;
    const oneEth = utils.parseEther("1.0");
    const campaignId = 1;

    beforeEach(async () => {
      contract = await ethers.getContractFactory("Donations");
      [owner, user1, user2, contractOwner] = await ethers.getSigners();

      donationsContract = await contract.deploy();
      await donationsContract.deployed();

      CAMPAIGN_CLOSED = await donationsContract.CAMPAIGN_CLOSED();
      CAMPAIGN_ACTIVE = await donationsContract.CAMPAIGN_ACTIVE();

      await donationsContract.addAdminRole(owner.address);

      const blockTime = BigNumber.from(await donationsContract.getBlockTime());
      const oneEth = utils.parseEther("1.0");
      expTime = blockTime.add(10);
      createDonationTx = await donationsContract.createCampaign(
        contractOwner.address,
        "test",
        "test",
        expTime,
        oneEth
      );
    });

    it("Should create campaign", async () => {
      await expect(createDonationTx)
        .to.emit(donationsContract, "CampaignCreated")
        .withArgs(
          owner.address,
          contractOwner.address,
          1,
          oneEth,
          CAMPAIGN_ACTIVE,
          "test"
        );
    });

    it("Should fail to create Campaign if user not Admin", async () => {
      await donationsContract.removeAdmin(owner.address);
      await expect(
        donationsContract.createCampaign(
          contractOwner.address,
          "test",
          "test",
          expTime,
          oneEth
        )
      ).to.be.revertedWith("Administrator role required");
    });

    it("Should close after founds are collected", async () => {
      let campaign;
      const donationFirstTx = await donationsContract
        .connect(user2)
        .donateToCampaign(campaignId, {
          value: utils.parseEther("0.3"),
        });
      campaign = await donationsContract.getCampaign(campaignId);
      expect(campaign.status).to.be.equal(CAMPAIGN_ACTIVE);
      await expect(donationFirstTx)
        .to.emit(donationsContract, "DonationDeposited")
        .withArgs(user2.address, utils.parseEther("0.3"));

      const donationSecondTx = await donationsContract
        .connect(user2)
        .donateToCampaign(campaignId, {
          value: utils.parseEther("0.2"),
        });
      campaign = await donationsContract.getCampaign(campaignId);
      expect(campaign.status).to.be.equal(CAMPAIGN_ACTIVE);
      await expect(donationSecondTx)
        .to.emit(donationsContract, "DonationDeposited")
        .withArgs(user2.address, utils.parseEther("0.2"));

      const lastDonationTx = await donationsContract
        .connect(user2)
        .donateToCampaign(campaignId, {
          value: utils.parseEther("0.6"),
        });
      campaign = await donationsContract.getCampaign(campaignId);
      expect(campaign.status).to.be.equal(CAMPAIGN_CLOSED);
      await expect(lastDonationTx)
        .to.emit(donationsContract, "DonationDeposited")
        .withArgs(user2.address, utils.parseEther("0.5"));

      await expect(lastDonationTx)
        .to.emit(donationsContract, "FundsCollected")
        .withArgs(1, utils.parseEther("1.0"));
    });

    it("Should return exeeded amout after overpaid donation", async () => {
      const balance = await user2.getBalance();
      const donationTx = await donationsContract
        .connect(user2)
        .donateToCampaign(campaignId, {
          value: utils.parseEther("2.0"),
        });

      const balanceAfterDonation = await user2.getBalance();
      const spendedAmount = balance.sub(balanceAfterDonation);
      await expect(donationTx)
        .to.emit(donationsContract, "DonationAmountReturned")
        .withArgs(user2.address, utils.parseEther("1.0"));
      expect(spendedAmount)
        .to.be.above(utils.parseEther("1.0"))
        .and.to.be.below(utils.parseEther("1.001"));
    });

    it("Should expire after some time", async () => {
      await donationsContract.connect(user2).donateToCampaign(campaignId, {
        value: utils.parseEther("0.1"),
      });

      await new Promise((resolve) => setTimeout(resolve, 12000));
      await expect(
        donationsContract.connect(user2).donateToCampaign(campaignId, {
          value: utils.parseEther("0.1"),
        })
      ).to.be.revertedWith("campaign expired");
    }).timeout(20000);

    it("Should withdrawal funds from campaign", async () => {
      await donationsContract.connect(user2).donateToCampaign(campaignId, {
        value: utils.parseEther("2"),
      });

      const contractBallance = await donationsContract.getBalance();
      expect(contractBallance).to.be.equal(utils.parseEther("1.0"));
      const campaignWalletBalance = await contractOwner.getBalance();

      const wdTx = await donationsContract
        .connect(contractOwner)
        .withdrawal(campaignId);
      const campaignWalletBalanceAfter = await contractOwner.getBalance();
      expect(campaignWalletBalance).to.be.below(campaignWalletBalanceAfter);
      await expect(wdTx)
        .to.emit(donationsContract, "FundsWithdrawed")
        .withArgs(contractOwner.address, utils.parseEther("1.0"));
    });

    it("Should fail to withdrawal if campaign not over", async () => {
      await expect(
        donationsContract.connect(contractOwner).withdrawal(campaignId)
      ).to.be.revertedWith("Campaign is still active");
    });

    it("Should fail to withdrawal user is not owner of campaign", async () => {
      await donationsContract.connect(user2).donateToCampaign(campaignId, {
        value: utils.parseEther("2"),
      });
      await expect(
        donationsContract.connect(user1).withdrawal(campaignId)
      ).to.be.revertedWith("No access to withdrawal");
    });
  });
};
