"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3-geo";
import { feature } from "topojson-client";
import world110m from "world-atlas/countries-110m.json";
import type { FeatureCollection, Feature, Geometry } from "geojson";

/** ——— Branding ——— */
const COLORS = {
  bgDark: "#0B1E3F",
  bgNavy: "#091A33",
  sphere: "#08162C",
  gold: "#C9A227",
  goldSoft: "#D6B75B",
  ink: "#EDEBE6",
};

/** ——— Typen ——— */
type Status = "EMPTY" | "APPROVED";
type Cell = {
  id: string;
  lon: number;
  lat: number;
  x: number;
  y: number;
  status: Status;
  priceCents: number;
  imageThumbUrl?: string;
  imageFullUrl?: string;
  hoverText?: string;
  title?: string;
  country?: string;
};
type Tooltip = {
  x: number;
  y: number;
  cell: Cell;
};

/** Minimal-„Topology“-Typ, damit TS nicht meckert */
type TopologyLike = { objects: any };

export default function WorldMosaicMVP() {
  const WIDTH = 1200;
  const HEIGHT = 680;
  const STEP_DEG = 3; // Raster-Auflösung
  const DOT = 8; // Punktgröße

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [cells, setCells] = useState<Cell[]>([]);
  const [hover, setHover] = useState<Tooltip | null>(null);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [showBuy, setShowBuy] = useState<Cell | null>(null);

  /** Projektion + Path */
  const projection = useMemo(
    () => d3.geoNaturalEarth1().fitExtent([[20, 20], [WIDTH - 20, HEIGHT - 20]], { type: "Sphere" } as any),
    []
  );
  const path = useMemo(() => d3.geoPath(projection), [projection]);

  /** Länder & Landflächen extrahieren (TopoJSON → GeoJSON) */
  const countries = useMemo<FeatureCollection<Geometry>>(() => {
    const topo = world110m as unknown as TopologyLike;
    // unknown-Zwischencast → korrektes FeatureCollection-Resultat
    return feature(topo as any, (topo.objects as any).countries) as unknown as FeatureCollection<Geometry>;
  }, []);

  const land = useMemo<Feature<Geometry>>(() => {
    const topo = world110m as unknown as TopologyLike;
    return feature(topo as any, (topo.objects as any).land) as unknown as Feature<Geometry>;
  }, []);

  /** Raster generieren (nur Punkte, die auf Land liegen) */
  useEffect(() => {
    let mounted = true;

    const generated: Cell[] = [];
    for (let lat = 85; lat >= -85; lat -= STEP_DEG) {
      for (let lon = -180; lon <= 180; lon += STEP_DEG) {
        const geoPt: [number, number] = [lon, lat];

        // Prüfen, ob Punkt auf Land liegt
        const onLand = d3.geoContains(land as any, geoPt);
        if (!onLand) continue;

        const p = projection(geoPt);
        if (!p) continue;
        const [x, y] = p;

        // Land bestimmen für Tooltip
        const ctry = countries.features.find((f) => d3.geoContains(f as any, geoPt));
        const price = priceFor(lat, lon);

        generated.push({
          id: `${lon}_${lat}`,
          lon,
          lat,
          x,
          y,
          status: Math.random() < 0.08 ? "APPROVED" : "EMPTY",
          priceCents: price,
          country: (ctry?.properties as any)?.name ?? undefined,
        });
      }
    }

    // Demo-Bilder/Texte für APPROVED
    const thumbs = [
      "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?q=80&w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1520975938310-4487bca9e089?q=80&w=400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1520975922213-8bdf0f12bc1b?q=80&w=400&auto=format&fit=crop",
    ];
    const filled = generated.map((c, i) =>
      c.status === "APPROVED"
        ? {
            ...c,
            imageThumbUrl: thumbs[i % thumbs.length],
            imageFullUrl: thumbs[i % thumbs.length].replace("w=400", "w=1600"),
            hoverText: `Greetings from ${c.country ?? approxRegion(c.lat, c.lon)}!`,
            title: `Example #${i}`,
          }
        : c
    );

    if (mounted) setCells(filled);
    return () => {
      mounted = false;
    };
  }, [projection, land, countries]);

  /** Hover-Position innerhalb des Wrappers berechnen */
  const localPoint = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bgDark, color: COLORS.ink }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: COLORS.ink, margin: 0 }}>MEMOORITY</h1>
          <span style={{ fontSize: 14, color: COLORS.goldSoft }}>Memories of Eternity</span>
        </div>

        {/* Karte + Tooltip-Wrapper */}
        <div
          ref={wrapRef}
          style={{
            position: "relative",
            borderRadius: 16,
            overflow: "visible", // ggf. "hidden" wenn Tooltip nicht rausstehen soll
            border: `1px solid rgba(201,162,39,0.35)`,
            background: COLORS.bgNavy,
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            style={{ width: "100%", height: "min(70vh, 720px)", display: "block" }}
          >
            {/* Hintergrund + Kugel */}
            <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={COLORS.bgNavy} />
            <path d={path({ type: "Sphere" } as any) || undefined} fill={COLORS.sphere} />

            {/* Zellen */}
            {cells.map((c) => (
              <g
                key={c.id}
                onMouseMove={(e) => {
                  const pos = localPoint(e);
                  setHover({ x: pos.x, y: pos.y, cell: c });
                }}
                onMouseLeave={() => setHover(null)}
                onClick={() => (c.status === "EMPTY" ? setShowBuy(c) : setSelected(c))}
                style={{ cursor: "pointer" }}
              >
                {/* Hit-Target */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={DOT / 2 + 3}
                  fill="rgba(0,0,0,0)"   // „bemalt“, aber unsichtbar
                  pointerEvents="all"
                />
                {c.status === "APPROVED" && c.imageThumbUrl ? (
                  <>
                    <defs>
                      <clipPath id={`clip_${c.id}`}>
                        <circle cx={c.x} cy={c.y} r={DOT / 2} />
                      </clipPath>
                    </defs>
                    <image
                      href={c.imageThumbUrl}
                      x={c.x - DOT / 2}
                      y={c.y - DOT / 2}
                      width={DOT}
                      height={DOT}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#clip_${c.id})`}
                      pointerEvents="none"
                    />
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={DOT / 2}
                      fill="transparent"
                      stroke={COLORS.gold}
                      strokeOpacity={0.6}
                      strokeWidth={0.7}
                      pointerEvents="none"
                    />
                  </>
                ) : (
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={DOT / 3}
                    fill={COLORS.goldSoft}
                    opacity={0.9}
                    stroke={COLORS.gold}
                    strokeOpacity={0.25}
                    strokeWidth={0.5}
                    pointerEvents="none"
                  />
                )}
              </g>
            ))}
          </svg>

          {/* Tooltip */}
          {hover && (
            <div
              style={{
                position: "absolute",
                zIndex: 20,
                left: hover.x + 12,
                top: hover.y + 12,
                padding: "8px 12px",
                fontSize: 14,
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                background: "rgba(9,26,51,0.92)",
                border: `1px solid ${COLORS.gold}55`,
                color: COLORS.ink,
                pointerEvents: "none",
                transform: "translateZ(0)",
                maxWidth: 260,
              }}
            >
              {hover.cell.status === "EMPTY" ? (
                <>
                  <div>💸 Preis: € {(hover.cell.priceCents / 100).toFixed(2)}</div>
                  <div>🌍 Land: {hover.cell.country ?? "Unbekannt"}</div>
                  <div>
                    📍 {hover.cell.lat.toFixed(1)}°, {hover.cell.lon.toFixed(1)}°
                  </div>
                </>
              ) : (
                <>
                  <div>{hover.cell.hoverText || "—"}</div>
                  <div style={{ opacity: 0.8, marginTop: 4, fontSize: 12 }}>
                    {hover.cell.country ?? "Unbekannt"} · {hover.cell.lat.toFixed(1)}°, {hover.cell.lon.toFixed(1)}°
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <p style={{ marginTop: 12, fontSize: 12, color: "rgba(237,235,230,0.6)" }}>
          Hinweis: Reines Frontend-Mock. Backend/Stripe/Moderation folgen als Nächstes.
        </p>
      </div>

      {/* Bild-Modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
            background: "rgba(0,0,0,0.6)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(900px,95vw)",
              borderRadius: 16,
              padding: 16,
              background: COLORS.bgNavy,
              border: `1px solid ${COLORS.gold}55`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.ink }}>
                {selected.title || "Beitragsbild"}
              </h3>
              <button
                onClick={() => setSelected(null)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: COLORS.sphere,
                  color: COLORS.ink,
                  border: `1px solid ${COLORS.gold}44`,
                  cursor: "pointer",
                }}
              >
                Schließen
              </button>
            </div>

            {selected.imageFullUrl ? (
              <img
                src={selected.imageFullUrl}
                alt="Beitragsbild"
                style={{ maxHeight: "65vh", width: "100%", objectFit: "contain", borderRadius: 8 }}
              />
            ) : (
              <div style={{ height: 256, display: "grid", placeItems: "center", borderRadius: 8, background: COLORS.sphere }}>
                Kein Bild
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 14, color: "rgba(237,235,230,0.85)" }}>
              {selected.hoverText || "Kein Text hinterlegt"}
            </div>
          </div>
        </div>
      )}

      {/* Kauf-Dialog (Demo) */}
      {showBuy && (
        <div
          onClick={() => setShowBuy(null)}
          style={{
            position: "fixed",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
            background: "rgba(0,0,0,0.6)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px,95vw)",
              borderRadius: 16,
              padding: 16,
              background: COLORS.bgNavy,
              border: `1px solid ${COLORS.gold}55`,
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: COLORS.ink }}>Feld kaufen</h3>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "rgba(237,235,230,0.85)" }}>
              Position: {showBuy.lat.toFixed(1)}°, {showBuy.lon.toFixed(1)}° · Preis: €
              {(showBuy.priceCents / 100).toFixed(2)}
            </p>
            <div style={{ display: "flex", justifyContent: "end", gap: 8 }}>
              <button
                onClick={() => setShowBuy(null)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: COLORS.sphere,
                  color: COLORS.ink,
                  border: `1px solid ${COLORS.gold}44`,
                  cursor: "pointer",
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  alert("In Schritt 2 leiten wir zu Stripe um.");
                  setShowBuy(null);
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: COLORS.gold,
                  color: "#151515",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Zur Kasse (Demo)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** ——— Helpers ——— */
function priceFor(lat: number, lon: number) {
  const base = 199; // 1,99 €
  const band = 1 + 0.4 * Math.exp(-Math.pow(lat / 40, 2));
  const jitter = 0.9 + Math.random() * 0.2;
  return Math.round(base * band * jitter);
}
function approxRegion(lat: number, lon: number) {
  if (lat > 35 && lon > -10 && lon < 40) return "Europe";
  if (lat > 10 && lon < -30) return "the Americas";
  if (lat > -40 && lon > 60) return "Asia";
  if (lat < -10 && lon > 110) return "Australia";
  if (lat < 15 && lon > 10 && lon < 40) return "Africa";
  return "the world";
}