// What the shell links to, as plain data. The rail, the mobile sheet, the
// command palette and the footer all read these lists, so a route is renamed in
// one place and tests/shell.test.ts checks the lists against the contract.

export interface NavItem {
  href: string;
  label: string;
}

/** Primary navigation, in the order docs/frontend/05_IA.md lists it. */
export const PRIMARY_NAV = [
  { href: "/", label: "Console" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/security", label: "Security" },
  { href: "/faucet", label: "Faucet" },
] as const satisfies readonly NavItem[];

/**
 * The five console sections. The ids are asserted by the end to end suite and
 * owned by the console page; the shell only links to them.
 */
export const CONSOLE_SECTIONS = [
  { id: "register", label: "Register" },
  { id: "plan", label: "Plan" },
  { id: "policy", label: "Policy" },
  { id: "send", label: "Send" },
  { id: "ledger", label: "Audit record" },
] as const;

export type ConsoleSectionId = (typeof CONSOLE_SECTIONS)[number]["id"];

export const SOURCE_URL = "https://github.com/mericcintosun/detent";
export const ETHONLINE_URL = "https://ethglobal.com/events/ethonline2026";

/** Internal footer links. The two external ones are rendered separately. */
export const FOOTER_NAV = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/security", label: "Security" },
] as const satisfies readonly NavItem[];

/**
 * Whether a primary item is the page being read. The console is exact; every
 * other route also owns its children. The record route matches nothing, because
 * it is not the console and a wrong aria-current is worse than none.
 */
export function isCurrentRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
