// Seed register for the Detent console.
//
// This mirrors the shape of an Asset Tokenization Studio (ATS) equity token on
// Hedera testnet: an ERC-1400 security with a single partition, a holder set
// carrying compliance state, and a treasury account that funds coupon runs.
// lib/hedera.ts replaces every value here with a live read once the adapter seam
// is in real mode and NEXT_PUBLIC_ATS_TOKEN_ADDRESS is set.

import registerSeed from "@/fixtures/register.seed.json";

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

// The twelve holders live in fixtures/register.seed.json, so `npm run seed` can
// assert the invariants the demo depends on and the console cannot drift from
// what the seed script validates. The cast goes through unknown once because
// JSON widens the address and compliance literals to string.
export const holders: Holder[] = registerSeed.holders as unknown as Holder[];
