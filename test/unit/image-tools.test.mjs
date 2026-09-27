import { describe, expect, test } from "vitest";
import { calculateDimensions } from "../../web/lib/image-tools.mjs";

describe("image dimensions", () => {
  test("keeps original dimensions when limits are zero", () => {
    expect(calculateDimensions(4000, 3000, 0, 0)).toEqual({ width: 4000, height: 3000 });
  });

  test("fits inside bounds without changing aspect ratio", () => {
    expect(calculateDimensions(4000, 3000, 1920, 1080)).toEqual({ width: 1440, height: 1080 });
  });

  test("does not upscale by default", () => {
    expect(calculateDimensions(640, 480, 1920, 1080)).toEqual({ width: 640, height: 480 });
  });

  test("can upscale when explicitly requested", () => {
    expect(calculateDimensions(640, 480, 1280, 960, true)).toEqual({ width: 1280, height: 960 });
  });
});
