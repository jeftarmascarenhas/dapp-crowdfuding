import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

const utils = {
  parseDateToSolidity(timestamp: number) {
    return Math.floor(timestamp / 1000);
  },
  parseDateToJs(timestamp: number) {
    return timestamp * 1000;
  },
  tenMinutes: 10 * 60,
  delay(time = 1000) {
    return new Promise((resolve) => {
      setTimeout(() => resolve("Finish"), time);
    });
  },
};

describe("CrowdFunding", () => {
  async function deployCrowdFundingFactory() {
    const goal = ethers.utils.parseEther("2");
    const accounts = await ethers.getSigners();
    const owner = accounts[0];
    const users = [...accounts];
    users.shift();

    const CrowdFundingFactory = await ethers.getContractFactory(
      "CrowdFundingFactory"
    );

    const crowdFundingFactory = await CrowdFundingFactory.deploy();

    return { crowdFundingFactory, owner, users, goal };
  }

  it("Should create a crowdfunding project", async function () {
    const { crowdFundingFactory, users, goal } = await loadFixture(
      deployCrowdFundingFactory
    );
    const [ownerProject] = users;

    const today = new Date();
    const startAt =
      utils.parseDateToSolidity(today.getTime()) + utils.tenMinutes;
    const endAt =
      utils.parseDateToSolidity(
        new Date(today.setDate(new Date(today).getDate() + 30)).getTime()
      ) - utils.tenMinutes;

    const createCrowdFund = await crowdFundingFactory
      .connect(ownerProject)
      .createCrowdFund(
        ownerProject.address,
        "My Crowding Funding",
        goal,
        startAt,
        endAt
      );

    const campaignId = await crowdFundingFactory.campaignId();

    expect(campaignId).to.equal(1);

    await expect(createCrowdFund)
      .to.emit(crowdFundingFactory, "CreateCrowdFund")
      .withArgs(
        1,
        ownerProject.address,
        "My Crowding Funding",
        goal,
        startAt,
        endAt
      );
  });

  it("Should pledge, goal and claimed", async function () {
    const { crowdFundingFactory, users, goal } = await loadFixture(
      deployCrowdFundingFactory
    );
    const [ownerProject, donor1, donor2] = users;

    const today = new Date();
    const startAt = utils.parseDateToSolidity(
      new Date(today.setSeconds(today.getSeconds() + 1)).getTime()
    );

    const endAt = utils.parseDateToSolidity(
      new Date(today.setSeconds(today.getSeconds() + 2)).getTime()
    );

    await crowdFundingFactory
      .connect(ownerProject)
      .createCrowdFund(
        ownerProject.address,
        "PC Crowd Fund",
        goal,
        startAt,
        endAt
      );

    const contractAddress = await crowdFundingFactory.crowdFunds(0);

    const project = await ethers.getContractAt(
      "CrowdFundingTemplate",
      contractAddress
    );

    const balanceBeforeClaimed = await ethers.provider.getBalance(
      project.address
    );

    expect(balanceBeforeClaimed.toString()).to.equal("0");

    const amount1 = ethers.utils.parseEther("1.2");
    const amount2 = ethers.utils.parseEther("0.9");

    await project.connect(donor1).pledge(amount1, {
      value: amount1,
    });

    await project.connect(donor2).pledge(amount2, {
      value: amount2,
    });

    console.log("campaign running");

    await utils.delay(2000);

    console.log("campaign finished");

    const balanceAfterPledge = await ethers.provider.getBalance(
      project.address
    );

    expect(balanceAfterPledge.toString()).to.equal(
      amount1.add(amount2).toString()
    );

    await project.connect(ownerProject).claim();

    const balanceAfterClaimed = await ethers.provider.getBalance(
      project.address
    );

    expect(balanceAfterClaimed.toString()).to.equal("0");

    const donor1Amount = await project.donorsAmount(donor1.address);
    const donor1Badges = await project.donorsBadges(donor1.address);

    const campaign = await project.campaign();

    expect(donor1Amount.amount.toString()).to.equal(amount1.toString());
    expect(donor1Badges.toNumber()).to.equal(1);
    expect(campaign.pledged).greaterThanOrEqual(campaign.goal);
    expect(campaign.claimed).to.true;
  });

  it("Should refund when campaign is canceled", async function () {
    const { crowdFundingFactory, users, goal } = await loadFixture(
      deployCrowdFundingFactory
    );
    const [ownerProject, donor1, donor2, fakeDonor] = users;

    const today = new Date();
    const startAt = utils.parseDateToSolidity(today.getTime());

    const endAt = utils.parseDateToSolidity(
      new Date(today.setSeconds(today.getSeconds() + 20)).getTime()
    );

    await crowdFundingFactory
      .connect(ownerProject)
      .createCrowdFund(
        ownerProject.address,
        "PC Crowd Fund",
        goal,
        startAt,
        endAt
      );

    const contractAddress = await crowdFundingFactory.crowdFunds(0);

    const project = await ethers.getContractAt(
      "CrowdFundingTemplate",
      contractAddress
    );

    const campaign = await project.campaign();

    const amount1 = ethers.utils.parseEther("1.2");
    const amount2 = ethers.utils.parseEther("1.2");

    console.log("starting campaign");
    await utils.delay(6000);
    console.log("campaign started");

    await project.connect(donor1).pledge(amount1, {
      value: amount1,
    });

    await project.connect(donor1).pledge(amount1, {
      value: amount1,
    });

    await project.connect(donor2).pledge(amount2, {
      value: amount2,
    });

    await project.connect(ownerProject).toggleCanceled();

    await expect(project.connect(fakeDonor).refund()).to.be.rejectedWith(
      "not donor"
    );

    await expect(project.connect(donor1).refund())
      .to.emit(project, "Refund")
      .withArgs(campaign.id, donor1.address, amount1.mul(2));

    await expect(project.connect(donor1).refund()).to.be.revertedWith(
      "not fund"
    );

    await expect(project.connect(donor2).refund())
      .to.emit(project, "Refund")
      .withArgs(campaign.id, donor2.address, amount2);
  });
});
