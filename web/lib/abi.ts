// Generated from contracts/artifacts/contracts/TangazaRewards.sol/TangazaRewards.json
// Regenerate with: npm run sync:abi (from web/)

export const TANGAZA_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "trustedForwarder",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "creditId",
        "type": "uint256"
      }
    ],
    "name": "CreditAlreadyRedeemed",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "creditId",
        "type": "uint256"
      }
    ],
    "name": "CreditNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EmptyBatch",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidAdvocate",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidApprover",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidCap",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "LengthMismatch",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "caller",
        "type": "address"
      }
    ],
    "name": "NotApprover",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "creditId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "caller",
        "type": "address"
      }
    ],
    "name": "NotCreditHolder",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      }
    ],
    "name": "OrgInactive",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      }
    ],
    "name": "OrgNotFound",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "advocate",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "enum TangazaRewards.ActivityType",
        "name": "activityType",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "proofHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "advocateActivityCount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "streak",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "ActivityApproved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "approver",
        "type": "address"
      }
    ],
    "name": "ApproverUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "advocate",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "issuedKES",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "emissionCapKES",
        "type": "uint256"
      }
    ],
    "name": "BudgetExhausted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "active",
        "type": "bool"
      }
    ],
    "name": "OrgActiveSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "approver",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "emissionCapKES",
        "type": "uint256"
      }
    ],
    "name": "OrgRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "advocate",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "creditId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "enum TangazaRewards.RewardType",
        "name": "rewardType",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "valueKES",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "redeemedKES",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "Redeemed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "advocate",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "creditId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "valueKES",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "issuedKES",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "RewardEarned",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "CREDIT_VALUE_KES",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MILESTONE_ACTIVITIES",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "advocate",
        "type": "address"
      }
    ],
    "name": "activitiesToNextCredit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "advocate",
        "type": "address"
      },
      {
        "internalType": "enum TangazaRewards.ActivityType",
        "name": "activityType",
        "type": "uint8"
      },
      {
        "internalType": "bytes32",
        "name": "proofHash",
        "type": "bytes32"
      }
    ],
    "name": "approveActivity",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "creditId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "internalType": "address[]",
        "name": "advocates",
        "type": "address[]"
      },
      {
        "internalType": "enum TangazaRewards.ActivityType[]",
        "name": "activityTypes",
        "type": "uint8[]"
      },
      {
        "internalType": "bytes32[]",
        "name": "proofHashes",
        "type": "bytes32[]"
      }
    ],
    "name": "approveActivityBatch",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "creditIds",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "creditCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "holder",
        "type": "address"
      }
    ],
    "name": "creditsOf",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "advocate",
        "type": "address"
      }
    ],
    "name": "getAdvocate",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint64",
            "name": "approvedActivities",
            "type": "uint64"
          },
          {
            "internalType": "uint32",
            "name": "streak",
            "type": "uint32"
          },
          {
            "internalType": "uint32",
            "name": "lastActivityDay",
            "type": "uint32"
          },
          {
            "internalType": "uint32",
            "name": "creditsEarned",
            "type": "uint32"
          },
          {
            "internalType": "uint32",
            "name": "creditsRedeemed",
            "type": "uint32"
          }
        ],
        "internalType": "struct TangazaRewards.Advocate",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "creditId",
        "type": "uint256"
      }
    ],
    "name": "getCredit",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "holder",
            "type": "address"
          },
          {
            "internalType": "uint32",
            "name": "orgId",
            "type": "uint32"
          },
          {
            "internalType": "uint32",
            "name": "valueKES",
            "type": "uint32"
          },
          {
            "internalType": "enum TangazaRewards.RewardType",
            "name": "rewardType",
            "type": "uint8"
          },
          {
            "internalType": "bool",
            "name": "redeemed",
            "type": "bool"
          },
          {
            "internalType": "uint64",
            "name": "earnedAt",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "redeemedAt",
            "type": "uint64"
          }
        ],
        "internalType": "struct TangazaRewards.Credit",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      }
    ],
    "name": "getOrg",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "approver",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "emissionCapKES",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "issuedKES",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "redeemedKES",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "approvedActivities",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "active",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "exists",
            "type": "bool"
          }
        ],
        "internalType": "struct TangazaRewards.Org",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "forwarder",
        "type": "address"
      }
    ],
    "name": "isTrustedForwarder",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "orgCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      }
    ],
    "name": "outstandingLiabilityKES",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "creditId",
        "type": "uint256"
      },
      {
        "internalType": "enum TangazaRewards.RewardType",
        "name": "rewardType",
        "type": "uint8"
      }
    ],
    "name": "redeem",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "approver",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "emissionCapKES",
        "type": "uint256"
      }
    ],
    "name": "registerOrg",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      }
    ],
    "name": "remainingBudgetKES",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "approver",
        "type": "address"
      }
    ],
    "name": "setApprover",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "orgId",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "active",
        "type": "bool"
      }
    ],
    "name": "setOrgActive",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "trustedForwarder",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "holder",
        "type": "address"
      }
    ],
    "name": "unredeemedCreditCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
