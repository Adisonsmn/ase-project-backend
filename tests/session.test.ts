import { describe, expect, test } from "bun:test";
import { REFRESH_GRACE_MS, isWithinRotationGrace } from "../src/utils/session";

const now = new Date("2026-10-23T10:00:00Z");
const secondsAgo = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe("isWithinRotationGrace", () => {
  test("sesi yang baru dirotasi masih dalam masa tenggang", () => {
    expect(
      isWithinRotationGrace({ revokedAt: secondsAgo(5), replacedById: "baru" }, now),
    ).toBe(true);
  });

  test("tepat di batas masa tenggang masih diterima", () => {
    expect(
      isWithinRotationGrace(
        { revokedAt: new Date(now.getTime() - REFRESH_GRACE_MS), replacedById: "baru" },
        now,
      ),
    ).toBe(true);
  });

  test("rotasi yang sudah lewat masa tenggang dianggap reuse", () => {
    expect(
      isWithinRotationGrace({ revokedAt: secondsAgo(31), replacedById: "baru" }, now),
    ).toBe(false);
  });

  test("sesi yang dicabut lewat logout tidak mendapat masa tenggang", () => {
    expect(
      isWithinRotationGrace({ revokedAt: secondsAgo(1), replacedById: null }, now),
    ).toBe(false);
  });

  test("sesi yang belum dicabut tidak termasuk", () => {
    expect(isWithinRotationGrace({ revokedAt: null, replacedById: null }, now)).toBe(false);
  });
});
