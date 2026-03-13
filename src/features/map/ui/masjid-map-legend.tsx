import type { MasjidSubtype } from "#/entities/masjid/model/types";
import { formatMasjidSubtypeLabel } from "#/entities/masjid/model/types";
import { MASJID_SUBTYPE_COLORS } from "./map-canvas.lib";

const LEGEND_ITEMS: Array<{
  color: string;
  label: string;
  subtype: MasjidSubtype | "all";
}> = [
  { color: MASJID_SUBTYPE_COLORS.all, label: "Cluster", subtype: "all" },
  {
    color: MASJID_SUBTYPE_COLORS.masjid,
    label: formatMasjidSubtypeLabel("masjid"),
    subtype: "masjid",
  },
  {
    color: MASJID_SUBTYPE_COLORS.musholla,
    label: formatMasjidSubtypeLabel("musholla"),
    subtype: "musholla",
  },
  {
    color: MASJID_SUBTYPE_COLORS.surau,
    label: formatMasjidSubtypeLabel("surau"),
    subtype: "surau",
  },
  {
    color: MASJID_SUBTYPE_COLORS.langgar,
    label: formatMasjidSubtypeLabel("langgar"),
    subtype: "langgar",
  },
  {
    color: MASJID_SUBTYPE_COLORS.unknown,
    label: formatMasjidSubtypeLabel("unknown"),
    subtype: "unknown",
  },
];

type MasjidMapLegendProps = {
  activeSubtypeFilter: MasjidSubtype | "all";
};

export function MasjidMapLegend({ activeSubtypeFilter }: MasjidMapLegendProps) {
  return (
    <aside className="map-legend" aria-label="Legenda tipe masjid">
      <div className="map-legend-items">
        {LEGEND_ITEMS.map((item) => {
          const isMuted =
            activeSubtypeFilter !== "all" &&
            item.subtype !== "all" &&
            item.subtype !== activeSubtypeFilter;

          return (
            <span
              key={item.subtype}
              className={`map-legend-item ${isMuted ? "is-muted" : ""}`}
              title={item.label}
            >
              <span className="map-legend-dot" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
            </span>
          );
        })}
      </div>
    </aside>
  );
}
