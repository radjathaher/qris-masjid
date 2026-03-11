import { describe, expect, it } from "vitest";
import { normalizeStructuredExportItems } from "./nominatim-bootstrap.normalize";

function makeItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    osm_type: "w",
    osm_id: Math.floor(Math.random() * 1000000),
    lat: -6.2,
    lon: 106.8,
    name: "Masjid Test",
    display_name: "Masjid Test, Indonesia",
    class: "amenity",
    type: "place_of_worship",
    category: "amenity",
    importance: 0.1,
    city: undefined,
    province: undefined,
    religion: "muslim",
    source_query: "nominatim-db-export",
    ...overrides,
  };
}

describe("normalizeStructuredExportItems", () => {
  it("infers province from a canonicalized regency city label", () => {
    const result = normalizeStructuredExportItems({
      sourceVersion: "test-v1",
      fetchedAt: "2026-03-12T00:00:00.000Z",
      items: [
        makeItem({
          osm_id: 1,
          name: "Masjid Seed Bekasi",
          display_name: "Masjid Seed Bekasi, Bekasi, Jawa Barat, Indonesia",
          city: "Bekasi",
          province: "Jawa Barat",
        }),
        makeItem({
          osm_id: 2,
          name: "Masjid Al Ikhlas",
          display_name: "Masjid Al Ikhlas, Bekasi Regency, Indonesia",
          city: "Bekasi Regency",
        }),
      ],
    });

    expect(result.accepted[1]).toMatchObject({
      city: "Bekasi",
      province: "Jawa Barat",
    });
  });

  it("replaces noisy city labels with the canonical trailing admin token", () => {
    const result = normalizeStructuredExportItems({
      sourceVersion: "test-v1",
      fetchedAt: "2026-03-12T00:00:00.000Z",
      items: [
        makeItem({
          osm_id: 3,
          name: "Masjid Seed Jakarta Barat",
          display_name: "Masjid Seed Jakarta Barat, Jakarta Barat, DKI Jakarta, Indonesia",
          city: "Jakarta Barat",
          province: "DKI Jakarta",
        }),
        makeItem({
          osm_id: 4,
          name: "Masjid Baiturrahman",
          display_name: "Masjid Baiturrahman, Kebon Jeruk, West Jakarta, Indonesia",
          city: "Kebon Jeruk, West Jakarta",
        }),
      ],
    });

    expect(result.accepted[1]).toMatchObject({
      city: "Jakarta Barat",
      province: "DKI Jakarta",
    });
  });

  it("strips trailing province names from city labels before inferring province", () => {
    const result = normalizeStructuredExportItems({
      sourceVersion: "test-v1",
      fetchedAt: "2026-03-12T00:00:00.000Z",
      items: [
        makeItem({
          osm_id: 5,
          name: "Masjid Seed Lamongan",
          display_name: "Masjid Seed Lamongan, Lamongan, Jawa Timur, Indonesia",
          city: "Lamongan",
          province: "Jawa Timur",
        }),
        makeItem({
          osm_id: 6,
          name: "Masjid Baitul Huda",
          display_name: "Masjid Baitul Huda, Lamongan Jawa Timur, Indonesia",
          city: "Lamongan Jawa Timur",
        }),
      ],
    });

    expect(result.accepted[1]).toMatchObject({
      city: "Lamongan",
      province: "Jawa Timur",
    });
  });
});
