"use client";

import { useState } from "react";
import { HashText } from "@/components/design";
import {
  NumberTicker,
  Presence,
  Reveal,
  Stagger,
  StaggerItem,
} from "@/components/motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { VariantName } from "@/lib/motion";

export function ThemeSwitch() {
  return <ThemeToggle />;
}

const EXAMPLE_TX = `0x${"9be1".repeat(16)}`;

export function InteractiveDemos() {
  const [approved, setApproved] = useState(false);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <p className="detent-label">Dialog, sheet, menu, tooltip, toast</p>
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>
              Open dialog
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send the locked plan</DialogTitle>
                <DialogDescription>
                  The treasury key signs exactly the plan you approved and
                  nothing else.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <DialogClose render={<Button />}>Send</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>
              Open sheet
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription>
                  The mobile navigation sheet.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              Open menu
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Record</DropdownMenuLabel>
                <DropdownMenuItem>Download the record</DropdownMenuItem>
                <DropdownMenuItem>Copy the plan hash</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Open on HashScan</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" />}>
              Hover or focus
            </TooltipTrigger>
            <TooltipContent>Tooltips name, they never instruct.</TooltipContent>
          </Tooltip>
          <Button
            variant="secondary"
            onClick={() =>
              toast.add({
                title: "Copied the plan hash",
                description: "Paste it into the record page to read it back.",
                type: "success",
              })
            }
          >
            Show toast
          </Button>
        </div>
        <p className="text-body-sm">
          Hash with tooltip and copy, example:{" "}
          <HashText value={EXAMPLE_TX} label="example transaction hash" />
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <p className="detent-label">Command palette</p>
        <Command className="border border-border">
          <CommandInput
            placeholder="Search routes and actions"
            aria-label="Search routes and actions"
          />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            <CommandGroup heading="Go to">
              <CommandItem>Console</CommandItem>
              <CommandItem>How it works</CommandItem>
              <CommandItem>
                Toggle theme
                <CommandShortcut>⌘ J</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </div>

      <div className="flex flex-col gap-4">
        <p className="detent-label">Tabs</p>
        <Tabs defaultValue="plan">
          <TabsList>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="policy">Policy</TabsTrigger>
            <TabsTrigger value="send">Send</TabsTrigger>
          </TabsList>
          <TabsContent value="plan" className="pt-3 text-body-sm">
            Twelve rows, two held.
          </TabsContent>
          <TabsContent value="policy" className="pt-3 text-body-sm">
            Compiled from the approved plan.
          </TabsContent>
          <TabsContent value="send" className="pt-3 text-body-sm">
            Waiting for the lock.
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-col gap-4">
        <p className="detent-label">Switch, toggle group, progress</p>
        <div className="flex items-center gap-3">
          <Switch
            id="ds-switch"
            checked={approved}
            onCheckedChange={setApproved}
          />
          <Label htmlFor="ds-switch">{approved ? "Approved" : "Approve"}</Label>
        </div>
        <ToggleGroup defaultValue={["coupon"]} aria-label="Corporate action">
          <ToggleGroupItem value="coupon">Coupon</ToggleGroupItem>
          <ToggleGroupItem value="forced">Forced transfer</ToggleGroupItem>
        </ToggleGroup>
        <Progress value={50}>
          <ProgressLabel>Signatures collected</ProgressLabel>
          <ProgressValue />
        </Progress>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <p className="detent-label">Scroll area</p>
        <ScrollArea className="h-40 border border-border">
          <ul className="divide-y divide-border">
            {Array.from({ length: 12 }, (_, index) => (
              <li key={index} className="px-4 py-2 text-body-sm">
                Row {index + 1} of an example ledger
              </li>
            ))}
          </ul>
        </ScrollArea>
      </div>
    </div>
  );
}

const VARIANTS: VariantName[] = ["fade", "rise", "wipe", "scaleIn"];

export function MotionDemos() {
  const [run, setRun] = useState(0);
  const [shown, setShown] = useState(true);
  const [total, setTotal] = useState(1204550);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="detent-label">Entrance variants</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRun((value) => value + 1)}
          >
            Replay
          </Button>
        </div>
        <div key={run} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {VARIANTS.map((variant) => (
            <Reveal
              key={variant}
              variant={variant}
              trigger="mount"
              className="border border-border bg-card p-4"
            >
              <code className="font-mono text-caption">{variant}</code>
            </Reveal>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="detent-label">Stagger</p>
        <Stagger
          key={run}
          as="ul"
          trigger="mount"
          className="grid gap-2 sm:grid-cols-3"
        >
          {[
            "Register",
            "Plan",
            "Policy",
            "Send",
            "Audit record",
            "Why it exists",
          ].map((label) => (
            <StaggerItem
              key={label}
              as="li"
              className="border border-border bg-card px-3 py-2 text-body-sm"
            >
              {label}
            </StaggerItem>
          ))}
        </Stagger>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="detent-label">Presence</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShown((value) => !value)}
          >
            {shown ? "Hide the banner" : "Show the banner"}
          </Button>
        </div>
        <div className="min-h-14">
          <Presence show={shown} variant="rise">
            <p className="border-l-2 border-success bg-success-muted px-4 py-3 text-body-sm">
              Signed, nothing broadcast
            </p>
          </Presence>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="detent-label">Number ticker</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTotal((value) => value - 48250)}
          >
            Hold a row
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTotal((value) => value + 48250)}
          >
            Release a row
          </Button>
        </div>
        <p className="font-display text-title">
          <NumberTicker value={total} />{" "}
          <span className="text-body-sm text-muted-foreground">
            units, an example total
          </span>
        </p>
      </div>
    </div>
  );
}
