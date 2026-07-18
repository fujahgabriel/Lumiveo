import { describe, expect, it } from "vitest";
import { durationFor, presetDimensions } from "./config";

describe("video config", () => {
  it("sums scene durations for the composition length", () => {
    expect(
      durationFor({
        scenes: [
          { durationInFrames: 90 },
          { durationInFrames: 60 },
        ] as never,
      }),
    ).toBe(150);
  });

  it("exposes the three export aspect ratios", () => {
    expect(presetDimensions.portrait).toEqual({ width: 1080, height: 1920 });
    expect(presetDimensions.landscape).toEqual({ width: 1920, height: 1080 });
    expect(presetDimensions.square).toEqual({ width: 1080, height: 1080 });
  });
});
