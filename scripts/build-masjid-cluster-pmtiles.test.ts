import { describe, expect, it } from "vitest";
import { buildClusterFeatures } from "./build-masjid-cluster-pmtiles";

describe("buildClusterFeatures", () => {
  it("emits aggregate and subtype cluster features for the same bucket", () => {
    const featureCollection = buildClusterFeatures(
      [
        {
          id: "masjid-1",
          name: "Masjid 1",
          lat: -6.2,
          lon: 106.8,
          subtype: "masjid",
        },
        {
          id: "musholla-1",
          name: "Musholla 1",
          lat: -6.2001,
          lon: 106.8001,
          subtype: "musholla",
        },
      ],
      4,
      4,
    );

    expect(featureCollection.features).toHaveLength(3);
    expect(featureCollection.features.map((feature) => feature.properties)).toEqual([
      expect.objectContaining({ clusterZoom: 4, pointCount: 2, subtype: "all" }),
      expect.objectContaining({ clusterZoom: 4, pointCount: 1, subtype: "masjid" }),
      expect.objectContaining({ clusterZoom: 4, pointCount: 1, subtype: "musholla" }),
    ]);
  });
});
