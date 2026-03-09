export type NominatimSearchResult = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number | string;
  lat?: string;
  lon?: string;
  class?: string;
  type?: string;
  category?: string;
  importance?: number;
  display_name?: string;
  name?: string;
  address?: Record<string, string | undefined>;
  extratags?: Record<string, string | undefined>;
};

export type BootstrapSubtype = "masjid" | "musholla" | "surau" | "langgar" | "unknown";

export type BootstrapPoi = {
  id: string;
  osmId: string | null;
  sourceSystem: "nominatim-http";
  sourceVersion: string;
  name: string;
  lat: number;
  lon: number;
  city: string | null;
  province: string | null;
  subtype: BootstrapSubtype;
  sourceClass: string | null;
  sourceType: string | null;
  sourceCategory: string | null;
  displayName: string | null;
  importance: number | null;
  lastSeenAt: string;
  sourceQuery: string;
};

export type ReverseGeocodeAddress = {
  city: string | null;
  province: string | null;
};

export type RejectedBootstrapItem = {
  queryLabel: string;
  queryText: string;
  name: string | null;
  displayName: string | null;
  sourceClass: string | null;
  sourceType: string | null;
  reason: string;
};

export type BootstrapQuery = {
  label: string;
  q: string;
  city?: string;
  province?: string;
};

export type QueryFileShape = {
  queries: BootstrapQuery[];
};

export type StructuredExportItem = {
  osm_type?: string;
  osm_id?: number | string;
  lat: number | string;
  lon: number | string;
  name: string;
  display_name?: string;
  class?: string;
  type?: string;
  category?: string;
  importance?: number;
  city?: string;
  province?: string;
  religion?: string;
  source_query?: string;
};

export type StructuredExportShape = {
  sourceVersion: string;
  items: StructuredExportItem[];
};

export type QueryRunResult =
  | {
      ok: true;
      query: BootstrapQuery;
      url: string;
      status: number;
      fetchedAt: string;
      items: NominatimSearchResult[];
    }
  | {
      ok: false;
      query: BootstrapQuery;
      url: string;
      status: number | null;
      fetchedAt: string;
      error: string;
      responseText: string | null;
    };
