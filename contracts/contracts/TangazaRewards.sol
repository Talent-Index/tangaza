// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/// @title TangazaRewards
/// @notice Proof-of-advocacy rewards with a hard, capped, shrinking reward budget.
/// @dev A credit only exists because an org approved a real activity. Proof submission
///      happens off-chain; the org's approval is the on-chain write.
///
///      Solvency invariants enforced here:
///        1. `emissionCapKES` is written once at registration and can never be raised
///           (there is deliberately no setter anywhere in this contract).
///        2. No credit is minted once `issuedKES + CREDIT_VALUE_KES` would exceed the cap.
///           The activity is still recorded and `BudgetExhausted` is emitted — approval
///           never reverts because the budget ran out.
///        3. `redeem` burns a credit and increases `redeemedKES`, so
///           `outstandingLiabilityKES = issuedKES - redeemedKES` shrinks monotonically
///           on redemption.
contract TangazaRewards is ERC2771Context, Ownable {
    enum RewardType {
        AIRTIME,
        DATA_BUNDLE,
        VOUCHER
    }

    enum ActivityType {
        REFERRAL,
        SOCIAL_POST,
        EVENT_HOSTED
    }

    /// @notice Cost to the org of a single reward credit, in KES.
    uint256 public constant CREDIT_VALUE_KES = 500;

    /// @notice Approved activities required to earn one credit.
    uint256 public constant MILESTONE_ACTIVITIES = 20;

    struct Org {
        string name;
        address approver;
        uint256 emissionCapKES;
        uint256 issuedKES;
        uint256 redeemedKES;
        uint256 approvedActivities;
        bool active;
        bool exists;
    }

    /// @dev Packed into a single 256-bit slot: every approval updates the count, the
    ///      streak and the last-active day together, so packing turns three SSTOREs
    ///      into one. Ranges are far beyond anything reachable (uint32 days ≈ year
    ///      11.7 million; uint64 activities ≈ 1.8e19).
    struct Advocate {
        uint64 approvedActivities;
        uint32 streak;
        uint32 lastActivityDay;
        uint32 creditsEarned;
        uint32 creditsRedeemed;
    }

    /// @dev Packed into two slots (holder+ids+flags, then the timestamps). Minting a
    ///      credit is the single most expensive thing this contract does, so the
    ///      cold-write count is what matters here.
    struct Credit {
        address holder;
        uint32 orgId;
        uint32 valueKES;
        RewardType rewardType;
        bool redeemed;
        uint64 earnedAt;
        uint64 redeemedAt;
    }

    uint256 public orgCount;
    uint256 public creditCount;

    mapping(uint256 => Org) private _orgs;
    mapping(uint256 => Credit) private _credits;
    mapping(uint256 => mapping(address => Advocate)) private _advocates;
    mapping(address => uint256[]) private _creditsOf;

    error OrgNotFound(uint256 orgId);
    error OrgInactive(uint256 orgId);
    error NotApprover(uint256 orgId, address caller);
    error InvalidApprover();
    error InvalidCap();
    error InvalidAdvocate();
    error CreditNotFound(uint256 creditId);
    error NotCreditHolder(uint256 creditId, address caller);
    error CreditAlreadyRedeemed(uint256 creditId);
    error LengthMismatch();
    error EmptyBatch();

    event OrgRegistered(
        uint256 indexed orgId,
        string name,
        address indexed approver,
        uint256 emissionCapKES
    );
    event ApproverUpdated(uint256 indexed orgId, address indexed approver);
    event OrgActiveSet(uint256 indexed orgId, bool active);
    event ActivityApproved(
        uint256 indexed orgId,
        address indexed advocate,
        ActivityType activityType,
        bytes32 proofHash,
        uint256 advocateActivityCount,
        uint256 streak,
        uint256 timestamp
    );
    event RewardEarned(
        uint256 indexed orgId,
        address indexed advocate,
        uint256 indexed creditId,
        uint256 valueKES,
        uint256 issuedKES,
        uint256 timestamp
    );
    event Redeemed(
        uint256 indexed orgId,
        address indexed advocate,
        uint256 indexed creditId,
        RewardType rewardType,
        uint256 valueKES,
        uint256 redeemedKES,
        uint256 timestamp
    );
    event BudgetExhausted(
        uint256 indexed orgId,
        address indexed advocate,
        uint256 issuedKES,
        uint256 emissionCapKES
    );

    /// @param trustedForwarder Pass address(0) when using ERC-4337 smart accounts —
    ///        `_msgSender()` then falls back to the real `msg.sender` (the smart account).
    constructor(address trustedForwarder)
        ERC2771Context(trustedForwarder)
        Ownable(msg.sender)
    {}

    // ---------------------------------------------------------------------
    // Org lifecycle
    // ---------------------------------------------------------------------

    /// @notice Register a business and fix its lifetime reward budget.
    /// @dev `emissionCapKES` is set here and nowhere else. There is no function in this
    ///      contract that writes `emissionCapKES` after registration, by design.
    function registerOrg(
        string calldata name,
        address approver,
        uint256 emissionCapKES
    ) external onlyOwner returns (uint256 orgId) {
        if (approver == address(0)) revert InvalidApprover();
        if (emissionCapKES == 0) revert InvalidCap();

        orgId = ++orgCount;
        Org storage org = _orgs[orgId];
        org.name = name;
        org.approver = approver;
        org.emissionCapKES = emissionCapKES;
        org.active = true;
        org.exists = true;

        emit OrgRegistered(orgId, name, approver, emissionCapKES);
    }

    /// @notice Rotate the address allowed to approve activities. Does not touch the cap.
    function setApprover(uint256 orgId, address approver) external onlyOwner {
        Org storage org = _orgs[orgId];
        if (!org.exists) revert OrgNotFound(orgId);
        if (approver == address(0)) revert InvalidApprover();

        org.approver = approver;
        emit ApproverUpdated(orgId, approver);
    }

    /// @notice Pause or resume approvals for an org. Does not touch the cap.
    function setOrgActive(uint256 orgId, bool active) external onlyOwner {
        Org storage org = _orgs[orgId];
        if (!org.exists) revert OrgNotFound(orgId);

        org.active = active;
        emit OrgActiveSet(orgId, active);
    }

    // ---------------------------------------------------------------------
    // Advocacy
    // ---------------------------------------------------------------------

    /// @notice The org attests that an advocate completed a real activity.
    /// @dev Every `MILESTONE_ACTIVITIES` approvals mints one credit — unless doing so
    ///      would push issued value past the cap, in which case the activity is still
    ///      recorded and `BudgetExhausted` is emitted instead of reverting.
    function approveActivity(
        uint256 orgId,
        address advocate,
        ActivityType activityType,
        bytes32 proofHash
    ) external returns (uint256 creditId) {
        Org storage org = _authorizeApproval(orgId);
        return _approveActivity(org, orgId, advocate, activityType, proofHash);
    }

    /// @notice Approve many activities for one org in a single transaction.
    /// @dev Identical semantics to calling `approveActivity` in a loop — each entry
    ///      emits its own `ActivityApproved` and can mint its own credit. The saving
    ///      is real but structural: the 21,000-gas base transaction cost and the
    ///      authorization checks are paid once instead of once per activity.
    /// @return creditIds Credit minted per entry, or 0 where none was (no milestone,
    ///         or the budget is exhausted).
    function approveActivityBatch(
        uint256 orgId,
        address[] calldata advocates,
        ActivityType[] calldata activityTypes,
        bytes32[] calldata proofHashes
    ) external returns (uint256[] memory creditIds) {
        uint256 len = advocates.length;
        if (len != activityTypes.length || len != proofHashes.length) {
            revert LengthMismatch();
        }
        if (len == 0) revert EmptyBatch();

        Org storage org = _authorizeApproval(orgId);
        creditIds = new uint256[](len);

        for (uint256 i = 0; i < len; ++i) {
            creditIds[i] = _approveActivity(
                org,
                orgId,
                advocates[i],
                activityTypes[i],
                proofHashes[i]
            );
        }
    }

    /// @dev Shared gate for both approval entry points.
    function _authorizeApproval(uint256 orgId) private view returns (Org storage org) {
        org = _orgs[orgId];
        if (!org.exists) revert OrgNotFound(orgId);
        if (!org.active) revert OrgInactive(orgId);

        address caller = _msgSender();
        if (caller != org.approver && caller != owner()) {
            revert NotApprover(orgId, caller);
        }
    }

    function _approveActivity(
        Org storage org,
        uint256 orgId,
        address advocate,
        ActivityType activityType,
        bytes32 proofHash
    ) private returns (uint256 creditId) {
        if (advocate == address(0)) revert InvalidAdvocate();

        Advocate storage a = _advocates[orgId][advocate];

        // Read once, mutate in memory, write once — the packed struct means this is a
        // single SSTORE for count + streak + lastActivityDay together.
        Advocate memory snapshot = a;
        unchecked {
            snapshot.approvedActivities += 1;
            org.approvedActivities += 1;
        }
        _bumpStreak(snapshot);

        bool milestone = snapshot.approvedActivities % MILESTONE_ACTIVITIES == 0;
        bool withinCap = org.issuedKES + CREDIT_VALUE_KES <= org.emissionCapKES;

        if (milestone && withinCap) {
            unchecked {
                snapshot.creditsEarned += 1;
            }
        }
        a.approvedActivities = snapshot.approvedActivities;
        a.streak = snapshot.streak;
        a.lastActivityDay = snapshot.lastActivityDay;
        a.creditsEarned = snapshot.creditsEarned;

        emit ActivityApproved(
            orgId,
            advocate,
            activityType,
            proofHash,
            snapshot.approvedActivities,
            snapshot.streak,
            block.timestamp
        );

        if (!milestone) return 0;

        if (!withinCap) {
            emit BudgetExhausted(orgId, advocate, org.issuedKES, org.emissionCapKES);
            return 0;
        }

        creditId = ++creditCount;
        Credit storage c = _credits[creditId];
        c.orgId = uint32(orgId);
        c.holder = advocate;
        c.valueKES = uint32(CREDIT_VALUE_KES);
        c.earnedAt = uint64(block.timestamp);

        _creditsOf[advocate].push(creditId);

        unchecked {
            org.issuedKES += CREDIT_VALUE_KES;
        }

        emit RewardEarned(
            orgId,
            advocate,
            creditId,
            CREDIT_VALUE_KES,
            org.issuedKES,
            block.timestamp
        );
    }

    /// @dev Streak counts consecutive calendar days (UTC) with at least one approval.
    ///      Operates on a memory copy so the caller can commit the packed slot once.
    function _bumpStreak(Advocate memory a) private view {
        uint32 today = uint32(block.timestamp / 1 days);
        uint32 last = a.lastActivityDay;

        if (last == today) {
            if (a.streak == 0) a.streak = 1;
            return;
        }

        unchecked {
            a.streak = (last != 0 && today == last + 1) ? a.streak + 1 : 1;
        }
        a.lastActivityDay = today;
    }

    // ---------------------------------------------------------------------
    // Redemption
    // ---------------------------------------------------------------------

    /// @notice Burn a credit for a real-world reward. Shrinks outstanding liability.
    function redeem(uint256 creditId, RewardType rewardType) external {
        Credit storage c = _credits[creditId];
        if (c.holder == address(0)) revert CreditNotFound(creditId);
        if (c.redeemed) revert CreditAlreadyRedeemed(creditId);

        address caller = _msgSender();
        if (caller != c.holder) revert NotCreditHolder(creditId, caller);

        c.redeemed = true;
        c.redeemedAt = uint64(block.timestamp);
        c.rewardType = rewardType;

        Org storage org = _orgs[c.orgId];
        unchecked {
            org.redeemedKES += c.valueKES;
            _advocates[c.orgId][caller].creditsRedeemed += 1;
        }

        emit Redeemed(
            c.orgId,
            caller,
            creditId,
            rewardType,
            c.valueKES,
            org.redeemedKES,
            block.timestamp
        );
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Value promised but not yet delivered. Shrinks on every redemption.
    function outstandingLiabilityKES(uint256 orgId) external view returns (uint256) {
        Org storage org = _orgs[orgId];
        if (!org.exists) revert OrgNotFound(orgId);
        return org.issuedKES - org.redeemedKES;
    }

    /// @notice Budget still available to mint new credits against.
    function remainingBudgetKES(uint256 orgId) external view returns (uint256) {
        Org storage org = _orgs[orgId];
        if (!org.exists) revert OrgNotFound(orgId);
        return org.emissionCapKES - org.issuedKES;
    }

    function getOrg(uint256 orgId) external view returns (Org memory) {
        Org storage org = _orgs[orgId];
        if (!org.exists) revert OrgNotFound(orgId);
        return org;
    }

    function getAdvocate(uint256 orgId, address advocate)
        external
        view
        returns (Advocate memory)
    {
        return _advocates[orgId][advocate];
    }

    /// @notice Approved activities still needed before this advocate's next credit.
    function activitiesToNextCredit(uint256 orgId, address advocate)
        external
        view
        returns (uint256)
    {
        uint256 done = _advocates[orgId][advocate].approvedActivities % MILESTONE_ACTIVITIES;
        return MILESTONE_ACTIVITIES - done;
    }

    function getCredit(uint256 creditId) external view returns (Credit memory) {
        Credit storage c = _credits[creditId];
        if (c.holder == address(0)) revert CreditNotFound(creditId);
        return c;
    }

    function creditsOf(address holder) external view returns (uint256[] memory) {
        return _creditsOf[holder];
    }

    function unredeemedCreditCount(address holder) external view returns (uint256 count) {
        uint256[] storage ids = _creditsOf[holder];
        uint256 len = ids.length;
        for (uint256 i = 0; i < len; ++i) {
            if (!_credits[ids[i]].redeemed) ++count;
        }
    }

    // ---------------------------------------------------------------------
    // Context resolution (ERC2771Context vs Ownable's Context)
    // ---------------------------------------------------------------------
    // With a zero trusted forwarder these all fall through to the plain Context
    // behaviour, so `_msgSender()` is the real caller — the ERC-4337 smart account.

    function _msgSender()
        internal
        view
        override(Context, ERC2771Context)
        returns (address)
    {
        return ERC2771Context._msgSender();
    }

    function _msgData()
        internal
        view
        override(Context, ERC2771Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength()
        internal
        view
        override(Context, ERC2771Context)
        returns (uint256)
    {
        return ERC2771Context._contextSuffixLength();
    }
}
