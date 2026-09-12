// HashScan URL helpers.
//
// These three functions are the only thing the console and the rail need from
// the Hedera side, and they read one client safe constant. Keeping them out of
// lib/hedera.ts keeps the client graph free of viem, the adapter and any secret.

import { HASHSCAN_BASE } from "@/lib/public-config";

export function hashscanToken(address: string): string {
  return `${HASHSCAN_BASE}/contract/${address}`;
}

export function hashscanTransaction(hash: string): string {
  return `${HASHSCAN_BASE}/transaction/${hash}`;
}

export function hashscanAccount(address: string): string {
  return `${HASHSCAN_BASE}/account/${address}`;
}
