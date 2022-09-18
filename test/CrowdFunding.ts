import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
// import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

const newBaseURI =
  "https://ipfs.io/ipfs/QmdNw2KZNrdWLYFhjqu9v4d2cRqRRy5wsD6cF7TPVSvz4q/";

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

    const startAt = (await time.latest()) + 5;
    const endAt = (await time.latest()) + time.duration.days(30);

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

  it("Should have baseURI and change baseURI if is owner", async function () {
    const { crowdFundingFactory, users, goal } = await loadFixture(
      deployCrowdFundingFactory
    );
    const [ownerProject] = users;

    const startAt = (await time.latest()) + 5;
    const endAt = (await time.latest()) + time.duration.days(30);

    await crowdFundingFactory
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

    const contractAddress = await crowdFundingFactory.crowdFunds(0);

    const project = await ethers.getContractAt(
      "CrowdFundingTemplate",
      contractAddress
    );

    const baseURI = await project.baseUri();

    expect(baseURI).to.be.equal("");

    await project.connect(ownerProject).setTokenURI(newBaseURI);
    const baseURIUpdated = await project.baseUri();

    expect(baseURIUpdated).to.be.equal(newBaseURI);
    const tokenURI = await project.tokenURI(1);

    expect(tokenURI).to.be.equal(`${baseURIUpdated}1.json`);
  });

  it("Should pledge, goal and claimed", async function () {
    const { crowdFundingFactory, users, goal } = await loadFixture(
      deployCrowdFundingFactory
    );
    const [ownerProject, donor1, donor2] = users;

    const startAt = (await time.latest()) + 5;
    const endAt = (await time.latest()) + time.duration.days(30);

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

    await time.increase(time.duration.minutes(30));

    await project.connect(donor1).pledge({
      value: amount1,
    });

    await project.connect(donor2).pledge({
      value: amount2,
    });

    await time.increase(time.duration.days(30));

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

    const startAt = (await time.latest()) + 5;
    const endAt = (await time.latest()) + time.duration.days(30);

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

    await time.increase(time.duration.minutes(2));

    await project.connect(donor1).pledge({
      value: amount1,
    });

    await project.connect(donor1).pledge({
      value: amount1,
    });

    await project.connect(donor2).pledge({
      value: amount2,
    });

    await project.connect(ownerProject).setCanceled();

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
