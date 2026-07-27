import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { TangazaRewards } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const ZERO_FORWARDER = "0x0000000000000000000000000000000000000000";
const CREDIT_VALUE_KES = 500n;
const MILESTONE = 20n;

const ActivityType = { REFERRAL: 0, SOCIAL_POST: 1, EVENT_HOSTED: 2 } as const;
const RewardType = { AIRTIME: 0, DATA_BUNDLE: 1, VOUCHER: 2 } as const;

const proof = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("TangazaRewards", () => {
  let rewards: TangazaRewards;
  let owner: HardhatEthersSigner;
  let approver: HardhatEthersSigner;
  let advocate: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let orgId: bigint;

  /** Approve `n` activities for `who`, each on its own day so the streak grows. */
  async function approveMany(n: number, who = advocate, dailyGap = true) {
    for (let i = 0; i < n; i++) {
      await rewards
        .connect(approver)
        .approveActivity(orgId, who.address, ActivityType.REFERRAL, proof(`a${i}`));
      if (dailyGap) await time.increase(24 * 60 * 60);
    }
  }

  beforeEach(async () => {
    [owner, approver, advocate, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("TangazaRewards");
    rewards = (await Factory.deploy(ZERO_FORWARDER)) as unknown as TangazaRewards;
    await rewards.waitForDeployment();

    // Cap of 2,000 KES = exactly 4 credits, so exhaustion is reachable in tests.
    await rewards.registerOrg("Blockchain Centre Kenya", approver.address, 2000);
    orgId = 1n;
  });

  describe("deployment", () => {
    it("deploys with a zero trusted forwarder and no real forwarder trusted", async () => {
      // address(0) compares equal to the stored forwarder, but no live sender can BE
      // address(0), so meta-tx decoding is unreachable — see the ERC2771 block below.
      expect(await rewards.isTrustedForwarder(other.address)).to.equal(false);
      expect(await rewards.owner()).to.equal(owner.address);
    });

    it("exposes the fixed reward model as constants", async () => {
      expect(await rewards.CREDIT_VALUE_KES()).to.equal(CREDIT_VALUE_KES);
      expect(await rewards.MILESTONE_ACTIVITIES()).to.equal(MILESTONE);
    });
  });

  describe("org registration", () => {
    it("records the org and emits OrgRegistered", async () => {
      await expect(rewards.registerOrg("Second Org", other.address, 5000))
        .to.emit(rewards, "OrgRegistered")
        .withArgs(2n, "Second Org", other.address, 5000n);

      const org = await rewards.getOrg(2n);
      expect(org.name).to.equal("Second Org");
      expect(org.approver).to.equal(other.address);
      expect(org.emissionCapKES).to.equal(5000n);
      expect(org.issuedKES).to.equal(0n);
      expect(org.redeemedKES).to.equal(0n);
      expect(org.active).to.equal(true);
    });

    it("only the owner can register an org", async () => {
      await expect(
        rewards.connect(other).registerOrg("Rogue", other.address, 1_000_000)
      ).to.be.revertedWithCustomError(rewards, "OwnableUnauthorizedAccount");
    });

    it("rejects a zero cap or zero approver", async () => {
      await expect(
        rewards.registerOrg("No cap", approver.address, 0)
      ).to.be.revertedWithCustomError(rewards, "InvalidCap");
      await expect(
        rewards.registerOrg("No approver", ethers.ZeroAddress, 1000)
      ).to.be.revertedWithCustomError(rewards, "InvalidApprover");
    });

    it("reverts on an unknown org", async () => {
      await expect(rewards.getOrg(99n))
        .to.be.revertedWithCustomError(rewards, "OrgNotFound")
        .withArgs(99n);
    });
  });

  // -------------------------------------------------------------------------
  // INVARIANT 1: the cap is written once and can never be raised.
  // -------------------------------------------------------------------------
  describe("INVARIANT: emissionCapKES is immutable", () => {
    it("exposes no function that writes emissionCapKES after registration", () => {
      const writable = rewards.interface.fragments.filter(
        (f) =>
          f.type === "function" &&
          (f as any).stateMutability !== "view" &&
          (f as any).stateMutability !== "pure"
      );
      const names = writable.map((f) => (f as any).name).sort();

      // Any new state-changing function must be reviewed against this list.
      expect(names).to.deep.equal([
        "approveActivity",
        "approveActivityBatch",
        "redeem",
        "registerOrg",
        "renounceOwnership",
        "setApprover",
        "setOrgActive",
        "transferOwnership",
      ]);

      // Nothing cap-shaped is settable.
      expect(names.some((n) => /cap|emission|budget|limit/i.test(n))).to.equal(false);
      expect((rewards as any).setEmissionCap).to.equal(undefined);
    });

    it("keeps the cap constant across the full earn -> redeem lifecycle", async () => {
      const capBefore = (await rewards.getOrg(orgId)).emissionCapKES;

      await approveMany(20);
      await rewards.connect(advocate).redeem(1n, RewardType.AIRTIME);
      await rewards.connect(owner).setApprover(orgId, other.address);
      await rewards.connect(owner).setOrgActive(orgId, false);
      await rewards.connect(owner).setOrgActive(orgId, true);

      expect((await rewards.getOrg(orgId)).emissionCapKES).to.equal(capBefore);
    });

    it("re-registering the same business creates a separate org, never mutating the first", async () => {
      await rewards.registerOrg("Blockchain Centre Kenya", approver.address, 999_999);
      expect((await rewards.getOrg(1n)).emissionCapKES).to.equal(2000n);
      expect((await rewards.getOrg(2n)).emissionCapKES).to.equal(999_999n);
    });

    it("setApprover and setOrgActive do not touch the budget fields", async () => {
      await approveMany(20);
      const before = await rewards.getOrg(orgId);

      await rewards.setApprover(orgId, other.address);
      await rewards.setOrgActive(orgId, false);

      const after = await rewards.getOrg(orgId);
      expect(after.emissionCapKES).to.equal(before.emissionCapKES);
      expect(after.issuedKES).to.equal(before.issuedKES);
      expect(after.redeemedKES).to.equal(before.redeemedKES);
    });
  });

  // -------------------------------------------------------------------------
  // Milestone accounting
  // -------------------------------------------------------------------------
  describe("approveActivity", () => {
    it("records the activity and bumps the advocate's count", async () => {
      await expect(
        rewards
          .connect(approver)
          .approveActivity(orgId, advocate.address, ActivityType.SOCIAL_POST, proof("x"))
      )
        .to.emit(rewards, "ActivityApproved")
        .withArgs(
          orgId,
          advocate.address,
          ActivityType.SOCIAL_POST,
          proof("x"),
          1n,
          1n,
          (t: bigint) => t > 0n
        );

      const a = await rewards.getAdvocate(orgId, advocate.address);
      expect(a.approvedActivities).to.equal(1n);
      expect(a.streak).to.equal(1n);
      expect(a.creditsEarned).to.equal(0n);
    });

    it("mints nothing for the first 19 approvals", async () => {
      await approveMany(19);

      const a = await rewards.getAdvocate(orgId, advocate.address);
      expect(a.approvedActivities).to.equal(19n);
      expect(a.creditsEarned).to.equal(0n);
      expect(await rewards.creditCount()).to.equal(0n);
      expect((await rewards.getOrg(orgId)).issuedKES).to.equal(0n);
      expect(await rewards.activitiesToNextCredit(orgId, advocate.address)).to.equal(1n);
    });

    it("mints exactly one 500 KES credit on the 20th approval", async () => {
      await approveMany(19);

      await expect(
        rewards
          .connect(approver)
          .approveActivity(orgId, advocate.address, ActivityType.REFERRAL, proof("20"))
      )
        .to.emit(rewards, "RewardEarned")
        .withArgs(orgId, advocate.address, 1n, CREDIT_VALUE_KES, CREDIT_VALUE_KES, (t: bigint) => t > 0n);

      expect(await rewards.creditCount()).to.equal(1n);
      expect((await rewards.getOrg(orgId)).issuedKES).to.equal(CREDIT_VALUE_KES);
      expect(await rewards.creditsOf(advocate.address)).to.deep.equal([1n]);

      const credit = await rewards.getCredit(1n);
      expect(credit.holder).to.equal(advocate.address);
      expect(credit.valueKES).to.equal(CREDIT_VALUE_KES);
      expect(credit.redeemed).to.equal(false);
      expect(await rewards.activitiesToNextCredit(orgId, advocate.address)).to.equal(MILESTONE);
    });

    it("mints again at 40, not in between", async () => {
      await approveMany(39);
      expect(await rewards.creditCount()).to.equal(1n);

      await approveMany(1);
      expect(await rewards.creditCount()).to.equal(2n);
      expect((await rewards.getOrg(orgId)).issuedKES).to.equal(1000n);
      expect((await rewards.getAdvocate(orgId, advocate.address)).creditsEarned).to.equal(2n);
    });

    it("tracks milestones per advocate, not per org", async () => {
      await approveMany(19, advocate);
      await approveMany(19, other);
      expect(await rewards.creditCount()).to.equal(0n);
      expect((await rewards.getOrg(orgId)).approvedActivities).to.equal(38n);
    });

    it("only the org's approver (or the owner) can approve", async () => {
      await expect(
        rewards
          .connect(other)
          .approveActivity(orgId, advocate.address, ActivityType.REFERRAL, proof("x"))
      )
        .to.be.revertedWithCustomError(rewards, "NotApprover")
        .withArgs(orgId, other.address);

      await expect(
        rewards.connect(owner).approveActivity(orgId, advocate.address, ActivityType.REFERRAL, proof("x"))
      ).to.emit(rewards, "ActivityApproved");
    });

    it("rejects unknown orgs, paused orgs and zero advocates", async () => {
      await expect(
        rewards.connect(approver).approveActivity(99n, advocate.address, 0, proof("x"))
      ).to.be.revertedWithCustomError(rewards, "OrgNotFound");

      await expect(
        rewards.connect(approver).approveActivity(orgId, ethers.ZeroAddress, 0, proof("x"))
      ).to.be.revertedWithCustomError(rewards, "InvalidAdvocate");

      await rewards.setOrgActive(orgId, false);
      await expect(
        rewards.connect(approver).approveActivity(orgId, advocate.address, 0, proof("x"))
      )
        .to.be.revertedWithCustomError(rewards, "OrgInactive")
        .withArgs(orgId);
    });
  });

  describe("approveActivityBatch", () => {
    /** Batch of n approvals for one advocate. */
    const batchFor = (who: string, n: number) =>
      rewards
        .connect(approver)
        .approveActivityBatch(
          orgId,
          Array(n).fill(who),
          Array(n).fill(ActivityType.REFERRAL),
          Array.from({ length: n }, (_, i) => proof(`batch${i}`))
        );

    it("is equivalent to calling approveActivity in a loop", async () => {
      await batchFor(advocate.address, 20);

      const a = await rewards.getAdvocate(orgId, advocate.address);
      expect(a.approvedActivities).to.equal(20n);
      expect(a.creditsEarned).to.equal(1n);
      expect(await rewards.creditCount()).to.equal(1n);
      expect((await rewards.getOrg(orgId)).issuedKES).to.equal(CREDIT_VALUE_KES);
      expect((await rewards.getOrg(orgId)).approvedActivities).to.equal(20n);
    });

    it("emits one ActivityApproved per entry and mints at the milestone", async () => {
      const tx = await batchFor(advocate.address, 20);
      const receipt = await tx.wait();

      const approved = receipt!.logs.filter(
        (l) => "fragment" in l && (l as never as { fragment: { name: string } }).fragment?.name === "ActivityApproved"
      );
      expect(approved.length).to.equal(20);
      await expect(tx).to.emit(rewards, "RewardEarned");
    });

    it("returns the credit id per entry, zero where none minted", async () => {
      const ids = await rewards
        .connect(approver)
        .approveActivityBatch.staticCall(
          orgId,
          Array(20).fill(advocate.address),
          Array(20).fill(ActivityType.REFERRAL),
          Array.from({ length: 20 }, (_, i) => proof(`s${i}`))
        );

      expect(ids.length).to.equal(20);
      expect(ids.slice(0, 19).every((id) => id === 0n)).to.equal(true);
      expect(ids[19]).to.equal(1n);
    });

    it("handles several advocates in one call", async () => {
      await rewards
        .connect(approver)
        .approveActivityBatch(
          orgId,
          [advocate.address, other.address, advocate.address],
          [ActivityType.REFERRAL, ActivityType.SOCIAL_POST, ActivityType.EVENT_HOSTED],
          [proof("a"), proof("b"), proof("c")]
        );

      expect(
        (await rewards.getAdvocate(orgId, advocate.address)).approvedActivities
      ).to.equal(2n);
      expect(
        (await rewards.getAdvocate(orgId, other.address)).approvedActivities
      ).to.equal(1n);
    });

    it("respects the cap without reverting, mid-batch", async () => {
      // Cap is 2000 = 4 credits. Drive 5 milestones through in one call.
      await rewards
        .connect(approver)
        .approveActivityBatch(
          orgId,
          Array(100).fill(advocate.address),
          Array(100).fill(ActivityType.REFERRAL),
          Array.from({ length: 100 }, (_, i) => proof(`cap${i}`))
        );

      const org = await rewards.getOrg(orgId);
      expect(org.issuedKES).to.equal(org.emissionCapKES);
      expect(await rewards.creditCount()).to.equal(4n);
      expect(
        (await rewards.getAdvocate(orgId, advocate.address)).approvedActivities
      ).to.equal(100n);
      expect(
        (await rewards.getAdvocate(orgId, advocate.address)).creditsEarned
      ).to.equal(4n);
    });

    it("rejects mismatched array lengths and empty batches", async () => {
      await expect(
        rewards
          .connect(approver)
          .approveActivityBatch(orgId, [advocate.address], [], [proof("x")])
      ).to.be.revertedWithCustomError(rewards, "LengthMismatch");

      await expect(
        rewards.connect(approver).approveActivityBatch(orgId, [], [], [])
      ).to.be.revertedWithCustomError(rewards, "EmptyBatch");
    });

    it("enforces the same approver check as the single version", async () => {
      await expect(
        rewards
          .connect(other)
          .approveActivityBatch(
            orgId,
            [advocate.address],
            [ActivityType.REFERRAL],
            [proof("x")]
          )
      )
        .to.be.revertedWithCustomError(rewards, "NotApprover")
        .withArgs(orgId, other.address);
    });

    it("rejects a zero advocate anywhere in the batch", async () => {
      await expect(
        rewards
          .connect(approver)
          .approveActivityBatch(
            orgId,
            [advocate.address, ethers.ZeroAddress],
            [ActivityType.REFERRAL, ActivityType.REFERRAL],
            [proof("a"), proof("b")]
          )
      ).to.be.revertedWithCustomError(rewards, "InvalidAdvocate");
    });
  });

  describe("streak", () => {
    it("increments on consecutive days", async () => {
      await approveMany(3);
      expect((await rewards.getAdvocate(orgId, advocate.address)).streak).to.equal(3n);
    });

    it("does not double-count two approvals on the same day", async () => {
      await approveMany(2, advocate, false);
      const a = await rewards.getAdvocate(orgId, advocate.address);
      expect(a.approvedActivities).to.equal(2n);
      expect(a.streak).to.equal(1n);
    });

    it("resets after a missed day", async () => {
      await approveMany(3);
      await time.increase(3 * 24 * 60 * 60);
      await rewards.connect(approver).approveActivity(orgId, advocate.address, 0, proof("gap"));
      expect((await rewards.getAdvocate(orgId, advocate.address)).streak).to.equal(1n);
    });
  });

  // -------------------------------------------------------------------------
  // INVARIANT 2: minting halts at the cap, and approval never reverts for it.
  // -------------------------------------------------------------------------
  describe("INVARIANT: minting halts at the cap without reverting", () => {
    /** Cap is 2000 KES = 4 credits. Drive the org to exactly the cap. */
    async function fillToCap() {
      for (const signer of [advocate, other]) {
        await approveMany(40, signer);
      }
      expect((await rewards.getOrg(orgId)).issuedKES).to.equal(2000n);
      expect(await rewards.remainingBudgetKES(orgId)).to.equal(0n);
    }

    it("emits BudgetExhausted instead of reverting once the cap is reached", async () => {
      await fillToCap();
      await approveMany(19);

      await expect(
        rewards.connect(approver).approveActivity(orgId, advocate.address, 0, proof("over"))
      )
        .to.emit(rewards, "BudgetExhausted")
        .withArgs(orgId, advocate.address, 2000n, 2000n)
        .and.to.emit(rewards, "ActivityApproved");
    });

    it("still records the activity when the budget is exhausted", async () => {
      await fillToCap();
      await approveMany(20);

      const a = await rewards.getAdvocate(orgId, advocate.address);
      expect(a.approvedActivities).to.equal(60n);
      expect(a.creditsEarned).to.equal(2n); // credits 1 and 2 only; the 3rd was capped
    });

    it("never issues more than the cap", async () => {
      await fillToCap();
      await approveMany(60);
      await approveMany(60, other);

      const org = await rewards.getOrg(orgId);
      expect(org.issuedKES).to.equal(org.emissionCapKES);
      expect(org.issuedKES).to.be.lessThanOrEqual(2000n);
      expect(await rewards.creditCount()).to.equal(4n);
    });

    it("does not reopen minting after redemptions free up liability", async () => {
      await fillToCap();
      await rewards.connect(advocate).redeem(1n, RewardType.AIRTIME);
      await rewards.connect(advocate).redeem(2n, RewardType.AIRTIME);

      // Liability dropped, but the cap is on ISSUED value — minting stays closed.
      await approveMany(20);
      expect(await rewards.creditCount()).to.equal(4n);
      expect((await rewards.getOrg(orgId)).issuedKES).to.equal(2000n);
    });
  });

  // -------------------------------------------------------------------------
  // INVARIANT 3: redeem burns the credit and shrinks outstanding liability.
  // -------------------------------------------------------------------------
  describe("INVARIANT: redeem shrinks outstanding liability", () => {
    beforeEach(async () => {
      await approveMany(40); // two credits
    });

    it("burns the credit, raises redeemedKES and emits Redeemed", async () => {
      expect(await rewards.outstandingLiabilityKES(orgId)).to.equal(1000n);

      await expect(rewards.connect(advocate).redeem(1n, RewardType.AIRTIME))
        .to.emit(rewards, "Redeemed")
        .withArgs(
          orgId,
          advocate.address,
          1n,
          RewardType.AIRTIME,
          CREDIT_VALUE_KES,
          CREDIT_VALUE_KES,
          (t: bigint) => t > 0n
        );

      const credit = await rewards.getCredit(1n);
      expect(credit.redeemed).to.equal(true);
      expect(credit.rewardType).to.equal(RewardType.AIRTIME);
      expect(credit.redeemedAt).to.be.greaterThan(0n);

      const org = await rewards.getOrg(orgId);
      expect(org.redeemedKES).to.equal(CREDIT_VALUE_KES);
      expect(await rewards.outstandingLiabilityKES(orgId)).to.equal(500n);
      expect(await rewards.unredeemedCreditCount(advocate.address)).to.equal(1n);
      expect(
        (await rewards.getAdvocate(orgId, advocate.address)).creditsRedeemed
      ).to.equal(1n);
    });

    it("outstanding always equals issued minus redeemed and only shrinks on redemption", async () => {
      const outstanding = async () => rewards.outstandingLiabilityKES(orgId);
      const check = async () => {
        const org = await rewards.getOrg(orgId);
        expect(await outstanding()).to.equal(org.issuedKES - org.redeemedKES);
      };

      await check();
      const before = await outstanding();

      await rewards.connect(advocate).redeem(1n, RewardType.DATA_BUNDLE);
      await check();
      const mid = await outstanding();
      expect(mid).to.be.lessThan(before);

      await rewards.connect(advocate).redeem(2n, RewardType.VOUCHER);
      await check();
      expect(await outstanding()).to.equal(0n);
      expect(await outstanding()).to.be.lessThan(mid);
    });

    it("only the credit holder can redeem", async () => {
      await expect(rewards.connect(other).redeem(1n, RewardType.AIRTIME))
        .to.be.revertedWithCustomError(rewards, "NotCreditHolder")
        .withArgs(1n, other.address);

      await expect(rewards.connect(owner).redeem(1n, RewardType.AIRTIME))
        .to.be.revertedWithCustomError(rewards, "NotCreditHolder")
        .withArgs(1n, owner.address);
    });

    it("cannot redeem the same credit twice", async () => {
      await rewards.connect(advocate).redeem(1n, RewardType.AIRTIME);
      await expect(rewards.connect(advocate).redeem(1n, RewardType.AIRTIME))
        .to.be.revertedWithCustomError(rewards, "CreditAlreadyRedeemed")
        .withArgs(1n);

      expect((await rewards.getOrg(orgId)).redeemedKES).to.equal(CREDIT_VALUE_KES);
    });

    it("reverts on an unknown credit", async () => {
      await expect(rewards.connect(advocate).redeem(99n, RewardType.AIRTIME))
        .to.be.revertedWithCustomError(rewards, "CreditNotFound")
        .withArgs(99n);
    });

    it("redeemed value never exceeds issued value", async () => {
      await rewards.connect(advocate).redeem(1n, RewardType.AIRTIME);
      await rewards.connect(advocate).redeem(2n, RewardType.AIRTIME);
      const org = await rewards.getOrg(orgId);
      expect(org.redeemedKES).to.be.lessThanOrEqual(org.issuedKES);
    });
  });

  // -------------------------------------------------------------------------
  // ERC2771 with a zero forwarder (the AA smart-account setup)
  // -------------------------------------------------------------------------
  describe("ERC2771Context with a zero forwarder", () => {
    it("treats the real msg.sender as the caller", async () => {
      // approver is authorised purely by msg.sender, with no forwarder in play.
      await expect(
        rewards.connect(approver).approveActivity(orgId, advocate.address, 0, proof("x"))
      ).to.emit(rewards, "ActivityApproved");

      // A spoofed 20-byte suffix must NOT be honoured, since address(0) is not trusted.
      const data =
        rewards.interface.encodeFunctionData("approveActivity", [
          orgId,
          advocate.address,
          0,
          proof("spoof"),
        ]) + approver.address.slice(2).toLowerCase();

      await expect(
        other.sendTransaction({ to: await rewards.getAddress(), data })
      ).to.be.revertedWithCustomError(rewards, "NotApprover");
    });

    it("trusts no address that can actually send a transaction", async () => {
      for (const s of [owner, approver, advocate, other]) {
        expect(await rewards.isTrustedForwarder(s.address)).to.equal(false);
      }
      // The contract itself is not a forwarder either.
      expect(await rewards.isTrustedForwarder(await rewards.getAddress())).to.equal(false);
    });
  });
});
