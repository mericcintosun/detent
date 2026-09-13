// The asset registry's own contract: every "present" row is a file that
// actually exists under public/, and every row (present or planned) carries a
// real, non-empty alt description. A "planned" row's path is intentionally
// not checked against disk, since the whole point of that status is that the
// file does not exist yet.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSETS,
  type AssetEntry,
  getAsset,
  plannedAssets,
  presentAssets,
} from "@/lib/assets";

function publicFile(path: string): string {
  return join(process.cwd(), "public", path.replace(/^\//, ""));
}

describe("asset registry", () => {
  it("has at least one present and one planned entry", () => {
    expect(presentAssets().length).toBeGreaterThan(0);
    expect(plannedAssets().length).toBeGreaterThan(0);
  });

  it("splits present and planned back into the full set with no overlap", () => {
    const present = presentAssets();
    const planned = plannedAssets();
    expect(present.length + planned.length).toBe(ASSETS.length);
    const presentIds = new Set(present.map((a) => a.id));
    for (const asset of planned) {
      expect(presentIds.has(asset.id)).toBe(false);
    }
  });

  it("has no duplicate ids or paths", () => {
    const ids = ASSETS.map((a) => a.id);
    const paths = ASSETS.map((a) => a.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it.each(presentAssets())(
    "present asset $id exists on disk at $path",
    (asset: AssetEntry) => {
      expect(existsSync(publicFile(asset.path))).toBe(true);
    },
  );

  it.each(plannedAssets())(
    "planned asset $id is not yet present on disk",
    (asset: AssetEntry) => {
      // Not a hard requirement of the registry, only a sanity check that a
      // row was not left as "planned" after its file actually landed: flip
      // status to "present" in lib/assets.ts once it has.
      expect(existsSync(publicFile(asset.path))).toBe(false);
    },
  );

  it.each(ASSETS)(
    "$id has a non-empty alt description",
    (asset: AssetEntry) => {
      expect(asset.alt.trim().length).toBeGreaterThan(0);
    },
  );

  it.each(ASSETS)("$id has a non-empty note", (asset: AssetEntry) => {
    expect(asset.note.trim().length).toBeGreaterThan(0);
  });

  it.each(ASSETS)(
    "$id declares positive width and height",
    (asset: AssetEntry) => {
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
    },
  );

  it.each(ASSETS)("$id names at least one consumer", (asset: AssetEntry) => {
    expect(asset.usedBy.length).toBeGreaterThan(0);
  });

  it("every path starts with a slash", () => {
    for (const asset of ASSETS) {
      expect(asset.path.startsWith("/")).toBe(true);
    }
  });

  it("getAsset finds a known id and returns undefined for an unknown one", () => {
    expect(getAsset("logo")?.path).toBe("/brand/logo.png");
    expect(getAsset("not-a-real-asset-id")).toBeUndefined();
  });
});
