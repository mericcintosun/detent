// Seed register for the Detent console.
//
// This mirrors the shape of an Asset Tokenization Studio (ATS) equity token on
// Hedera testnet: an ERC-1400 security with a single partition, a holder set
// carrying compliance state, and a treasury account that funds coupon runs.
// lib/hedera.ts replaces every value here with a live read once
// NEXT_PUBLIC_ATS_TOKEN_ADDRESS is set.

export type ComplianceState =
  | "clear"
  | "allowlist-expired"
  | "kyc-lapsed"
  | "sanctions-hold";

export interface Holder {
  id: string;
  legalName: string;
  jurisdiction: string;
  /** Hedera account id, shown because operators reconcile against HashScan. */
  accountId: string;
  /** EVM alias of the same account, which is what the calldata carries. */
  address: `0x${string}`;
  partition: string;
  /** Whole tokens held. The security carries 6 decimals on chain. */
  balance: number;
  compliance: ComplianceState;
  complianceNote: string;
  kycExpiresOn: string;
}

export interface SecurityToken {
  name: string;
  symbol: string;
  standard: string;
  address: `0x${string}`;
  hederaId: string;
  decimals: number;
  totalSupply: number;
  partition: string;
  issuedOn: string;
  verified: boolean;
}

export interface TreasuryAccount {
  label: string;
  walletId: string;
  address: `0x${string}`;
  accountId: string;
  /** Settlement asset balance in micro units (6 decimals). */
  balanceMicros: string;
  settlementAsset: string;
}

export interface Approver {
  id: string;
  name: string;
  role: string;
  keyId: string;
}

export type ActionKind = "coupon" | "forced-transfer";

export interface CorporateAction {
  kind: ActionKind;
  label: string;
  summary: string;
  /** Function actually called on the ATS token, used to derive the selector. */
  signature: string;
  authority: string;
}

export const security: SecurityToken = {
  name: "Bosphorus Mercantile Equity",
  symbol: "BMEQ",
  standard: "ERC-1400 equity (ATS)",
  address: "0x4b7d0e91c358af260d1e7b04c93f5a68d20e17bc",
  hederaId: "0.0.5842119",
  decimals: 6,
  totalSupply: 1_000_000,
  partition: "CLASS-A",
  issuedOn: "2026-09-04",
  verified: true,
};

export const treasury: TreasuryAccount = {
  label: "Issuer treasury (Privy server wallet)",
  walletId: "wlt_detent_treasury_01",
  address: "0x8b17f0a4c26e39d05b81f74a2c60e93d15b8027a",
  accountId: "0.0.5842204",
  balanceMicros: "36000000000",
  settlementAsset: "USDC (testnet)",
};

export const recoveryCustodian: `0x${string}` =
  "0xd52f907ab361c40e8d2905b7f31a6c8e240d97b5";

export const approvers: Approver[] = [
  {
    id: "ops-controller",
    name: "D. Ferrand",
    role: "Ops controller",
    keyId: "key_quorum_signer_a",
  },
  {
    id: "risk-officer",
    name: "N. Okonkwo",
    role: "Risk officer",
    keyId: "key_quorum_signer_b",
  },
];

/** Coupon rate for the current window, in micro-USDC per whole token. */
export const couponMicrosPerToken = 42_500;

export const couponWindow = {
  reference: "2026-Q3",
  recordDate: "2026-09-08",
  paymentDate: "2026-09-15",
};

export const actions: CorporateAction[] = [
  {
    kind: "coupon",
    label: "Distribute quarterly coupon",
    summary: `Pay the ${couponWindow.reference} coupon of 0.0425 USDC per token to the holders on record at ${couponWindow.recordDate}.`,
    signature: "distributeCoupon(bytes32,address[],uint256[])",
    authority: "Board resolution 2026-14",
  },
  {
    kind: "forced-transfer",
    label: "Court ordered forced transfer",
    summary:
      "Move the full position of the sanctioned holder to the recovery custodian named in the order.",
    signature:
      "operatorTransferByPartition(bytes32,address,address,uint256,bytes,bytes)",
    authority: "Istanbul 4th Commercial Court, file 2026/1188",
  },
];

export const holders: Holder[] = [
  {
    id: "h-01",
    legalName: "Marmara Pension Fund II",
    jurisdiction: "TR",
    accountId: "0.0.5842311",
    address: "0x7a1f4c0b9e2d8a63c5b0e14f7d2c93ae6b085d41",
    partition: "CLASS-A",
    balance: 182_500,
    compliance: "clear",
    complianceNote: "Allowlist entry valid, professional investor.",
    kycExpiresOn: "2027-04-30",
  },
  {
    id: "h-02",
    legalName: "Adalar Family Office",
    jurisdiction: "TR",
    accountId: "0.0.5842318",
    address: "0x3c9d02b74e8f15a6d0c2b937e418fa6d05c2b8e7",
    partition: "CLASS-A",
    balance: 96_000,
    compliance: "clear",
    complianceNote: "Allowlist entry valid.",
    kycExpiresOn: "2027-01-19",
  },
  {
    id: "h-03",
    legalName: "Kestrel Bridge Capital",
    jurisdiction: "GB",
    accountId: "0.0.5842324",
    address: "0xb40e7f21c609da3b58e417c2f60ab9d38e51c704",
    partition: "CLASS-A",
    balance: 141_250,
    compliance: "clear",
    complianceNote: "Allowlist entry valid.",
    kycExpiresOn: "2026-12-02",
  },
  {
    id: "h-04",
    legalName: "Hanseatic Mutual Insurance",
    jurisdiction: "DE",
    accountId: "0.0.5842330",
    address: "0x5f8c1a09d3e26b47f018ca95d3702b6e14f8a0c3",
    partition: "CLASS-A",
    balance: 88_750,
    compliance: "clear",
    complianceNote: "Allowlist entry valid.",
    kycExpiresOn: "2027-06-11",
  },
  {
    id: "h-05",
    legalName: "Zeytin Sermaye Ortakligi",
    jurisdiction: "TR",
    accountId: "0.0.5842336",
    address: "0x91d47b0e5ca2f6031d847be09c25fa013d6b8e47",
    partition: "CLASS-A",
    balance: 64_500,
    compliance: "allowlist-expired",
    complianceNote:
      "Allowlist entry lapsed on 2026-08-31, the transfer hook will revert.",
    kycExpiresOn: "2026-08-31",
  },
  {
    id: "h-06",
    legalName: "Northline Endowment Trust",
    jurisdiction: "US",
    accountId: "0.0.5842342",
    address: "0x2e60fb95c1d4830a7e62f19b05d3ca84e720f16b",
    partition: "CLASS-A",
    balance: 120_000,
    compliance: "clear",
    complianceNote: "Allowlist entry valid, Reg S holder.",
    kycExpiresOn: "2027-03-08",
  },
  {
    id: "h-07",
    legalName: "Baltic Rim Credit Union",
    jurisdiction: "LT",
    accountId: "0.0.5842349",
    address: "0xc73a058e196d2fb04a8530e9c1d762f5a80b3492",
    partition: "CLASS-A",
    balance: 45_750,
    compliance: "clear",
    complianceNote: "Allowlist entry valid.",
    kycExpiresOn: "2027-02-14",
  },
  {
    id: "h-08",
    legalName: "Yildiz Varlik Yonetimi",
    jurisdiction: "TR",
    accountId: "0.0.5842355",
    address: "0x486bd0f7a215c3e908b64d70a2f9e35c81b06da4",
    partition: "CLASS-A",
    balance: 38_400,
    compliance: "kyc-lapsed",
    complianceNote:
      "KYC refresh overdue since 2026-07-15, compliance module blocks credits.",
    kycExpiresOn: "2026-07-15",
  },
  {
    id: "h-09",
    legalName: "Corvid Street Partners",
    jurisdiction: "GB",
    accountId: "0.0.5842361",
    address: "0xa05f3e814d7092c6b35f8e41d07a2cb963f508e1",
    partition: "CLASS-A",
    balance: 72_300,
    compliance: "clear",
    complianceNote: "Allowlist entry valid.",
    kycExpiresOn: "2027-05-27",
  },
  {
    id: "h-10",
    legalName: "Meridian Grain Cooperative",
    jurisdiction: "NL",
    accountId: "0.0.5842368",
    address: "0x6d2907c4fb8e150a3d9725b6ec08f14a70d3928c",
    partition: "CLASS-A",
    balance: 51_600,
    compliance: "clear",
    complianceNote: "Allowlist entry valid.",
    kycExpiresOn: "2026-11-30",
  },
  {
    id: "h-11",
    legalName: "Pera Kurumsal Emeklilik",
    jurisdiction: "TR",
    accountId: "0.0.5842374",
    address: "0xf31b8607ae4c05d29b716a3f80e5d2c917b40a68",
    partition: "CLASS-A",
    balance: 63_950,
    compliance: "sanctions-hold",
    complianceNote:
      "Screening hit on 2026-09-02, position frozen pending the court order.",
    kycExpiresOn: "2027-08-04",
  },
  {
    id: "h-12",
    legalName: "Falkirk Yard Holdings",
    jurisdiction: "GB",
    accountId: "0.0.5842380",
    address: "0x0c94e7a3d582f10b6c49e3d75a018f26b9c40e73",
    partition: "CLASS-A",
    balance: 35_000,
    compliance: "clear",
    complianceNote: "Allowlist entry valid.",
    kycExpiresOn: "2027-07-22",
  },
];
