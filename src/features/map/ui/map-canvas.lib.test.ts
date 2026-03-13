import { describe, expect, it } from "vitest";
import { computeClusterTargetZoom, RAW_POINT_MIN_ZOOM } from "./map-canvas.lib";

describe("computeClusterTargetZoom", () => {
  it("drills in gradually at broad zooms", () => {
    expect(computeClusterTargetZoom(4, 4)).toBe(6);
    expect(computeClusterTargetZoom(7.3, 7)).toBe(9.3);
  });

  it("slows down near city zooms", () => {
    expect(computeClusterTargetZoom(9.2, 9)).toBe(10.2);
    expect(computeClusterTargetZoom(10, 10)).toBe(11);
  });

  it("caps at raw-point zoom", () => {
    expect(computeClusterTargetZoom(11, 11)).toBe(RAW_POINT_MIN_ZOOM);
    expect(computeClusterTargetZoom(11.6, 11)).toBe(RAW_POINT_MIN_ZOOM);
  });
});
