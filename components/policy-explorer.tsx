"use client";

// DEMO.md step 3, made legible on camera.
//
// The compiled policy pins four things about one transaction. Before this the
// card listed them as four terms over truncated hex and left the reader to
// believe that `data eq 0x...` really was the call printed further up the page.
// Here the call is printed once, as one wrapped strip, and every condition is a
// control that points at the part of the strip it pins, on hover and on focus
// alike, with one sentence of plain English under it.
//
// Every value on screen comes from the live plan and the live policy: the
// conditions are the ones the server compiled, the strip is the plan's own
// target, selector and calldata. Nothing here is a literal.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PolicyCondition } from "@/lib/types";

/** Which part of the call a condition pins. */
type Fragment = "chain" | "to" | "selector" | "data";

function fragmentOf(condition: PolicyCondition): Fragment {
  if (condition.field === "chain_id") return "chain";
  if (condition.field === "to") return "to";
  return condition.operator === "starts_with" ? "selector" : "data";
}

/** One sentence per condition, in the operator's words rather than the wallet's. */
function glossOf(condition: PolicyCondition): string {
  switch (fragmentOf(condition)) {
    case "chain":
      return `Only chain ${condition.value}. The same bytes sent to any other network are refused before a signature exists.`;
    case "to":
      return "Only this contract. A payout aimed at any other address never reaches the key.";
    case "selector":
      return "Only this function. The first four bytes are the selector, so no other method the contract exposes can be called.";
    case "data":
      return "Only these exact bytes. Every address and every amount in the payout is pinned, so one edited digit falls through to DENY.";
  }
}

export interface PolicyExplorerProps {
  conditions: PolicyCondition[];
  target: string;
  selector: string;
  calldata: string;
  defaultAction: string;
}

export function PolicyExplorer({
  conditions,
  target,
  selector,
  calldata,
  defaultAction,
}: PolicyExplorerProps) {
  const [active, setActive] = useState<Fragment | null>(null);

  const chainCondition = conditions.find((c) => c.field === "chain_id");
  const body = calldata.startsWith(selector)
    ? calldata.slice(selector.length)
    : calldata;

  // Highlight with the surface the product already uses for a held row; dim the
  // rest to muted while something is active, so the strip reads as one call with
  // one part under the light. No new colour.
  function tone(fragment: Fragment, alsoWhen?: Fragment): string {
    if (active === null) return "";
    const lit =
      active === fragment || (alsoWhen !== undefined && active === alsoWhen);
    return lit ? "bg-secondary text-foreground" : "text-muted-foreground";
  }

  return (
    <div className="space-y-4">
      <div className="border border-border bg-background p-4">
        <p className="detent-label">The call, as the policy sees it</p>
        {/* The whole payload is on screen, which is the claim; a calldata for
            nine rows runs well over a thousand characters, so the strip is
            bounded and scrolls inside itself rather than stretching the card. */}
        {/* The strip scrolls inside itself, so it is its own focus stop:
            without a tabindex a keyboard reader can reach every condition below
            and never reach the call they point at. */}
        <p
          role="region"
          aria-label="The compiled call, chain, destination, selector and calldata"
          tabIndex={0}
          className="max-h-48 overflow-y-auto pt-2 text-sm leading-relaxed break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className={tone("chain")}>
            chain {chainCondition ? chainCondition.value : ""}
          </span>{" "}
          <span className="text-muted-foreground">to</span>{" "}
          <span className={tone("to")} title={target}>
            {target}
          </span>{" "}
          <span className="text-muted-foreground">data</span>{" "}
          <span className={tone("selector", "data")}>{selector}</span>
          <span className={tone("data")}>{body}</span>
        </p>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Four conditions, one ALLOW rule. Take any of them with the pointer or
        the keyboard and the part of the call it pins lights up above.
      </p>

      <ul className="divide-y divide-border border-y border-border">
        {conditions.map((condition) => {
          const fragment = fragmentOf(condition);
          const isActive = active === fragment;
          return (
            <li key={`${condition.field}:${condition.operator}`}>
              <Button
                type="button"
                variant="ghost"
                className={`h-auto w-full flex-col items-start justify-start gap-1 whitespace-normal border-l-2 px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive ? "border-hairline bg-accent" : "border-transparent"
                }`}
                onMouseEnter={() => setActive(fragment)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(fragment)}
                onBlur={() => setActive(null)}
              >
                <span className="detent-label">
                  {condition.field} {condition.operator}
                </span>
                <span className="w-full text-sm leading-relaxed break-all">
                  {condition.value}
                </span>
                {isActive ? (
                  <span className="w-full text-xs leading-relaxed text-muted-foreground">
                    {glossOf(condition)}
                  </span>
                ) : null}
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border pt-3">
        <p className="detent-label">default action</p>
        <p className="pt-1 text-sm text-bad">{defaultAction}</p>
      </div>
    </div>
  );
}
