You are writing ONE self-contained browser JavaScript file named map3d.js for a vanilla-JS PWA (no build step, no modules, no framework). Output ONLY the complete file inside a single ```js code block, nothing else.

Purpose: a "3D view" of a ski area: real terrain with pistes/lifts draped on it, using MapLibre GL JS loaded lazily.

API (attach to window):
window.FC3D = {
  async open(container, opts),   // container: an empty <div> (full width, fixed height set by CSS). opts below.
  close(),                        // remove the map, free WebGL resources (map.remove()), empty the container
  isOpen()                        // boolean
};
opts = {
  center: [lat, lon], zoom: 13,
  geojson: <GeoJSON FeatureCollection or null>,  // features: LineString/Polygon; properties: k ("piste"|"lift"), n (name), g (grade: "green"|"blue"|"red"|"black"|"offpiste"|"unknown")
  path: [[lat,lon], ...] or null,                  // optional red line (a route or a tracked day)
  esc: function(str) -> html-escaped string        // ALWAYS use it for any OSM name you put in HTML
}

Requirements:
1. Load MapLibre lazily the first time open() is called: insert <link rel="stylesheet"> and <script> tags for
   https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css and https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js
   Put the constant strings SRI_CSS = "sha256-V2sIX92Uh6ZaGSFTKMHghsB85b9toJtmazgG09AI2uk=" and SRI_JS = "sha256-vpYzxNhw4m+zfxz+XFp3GBZnEUAD6hYgeseFDY2ordE=" at the top of the file and set link.integrity / script.integrity to them, with crossOrigin = "anonymous". Return a Promise that resolves when loaded, rejects on error; cache the promise so it only loads once.
2. Style object (no external style URL): version 8, glyphs NOT needed (no text labels), sources:
   - "osm": raster, tiles ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize 256, maxzoom 18, attribution "© OpenStreetMap contributors"
   - "dem": raster-dem, tiles ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"], encoding "terrarium", tileSize 256, maxzoom 14, attribution "Terrain: Mapzen/AWS Terrain Tiles"
   layers: background (#DCEAF5), raster "osm", hillshade from "dem" (exaggeration 0.35).
   terrain: { source: "dem", exaggeration: 1.4 }. Also sky not required.
3. Map: center from opts (note MapLibre wants [lon,lat]), zoom, pitch 62, bearing -20, maxPitch 80, antialias true. Add NavigationControl({visualizePitch:true}).
4. On load: if geojson given, add source "pistes" and layers:
   - fill layer for Polygon pistes (filter geometry-type Polygon and k=="piste"), fill-color by grade, fill-opacity 0.15
   - line layer for LineString pistes: line-color by grade via a "match" expression on ["get","g"]: green #2E7D4F, blue #2B6CB0, red #C0392B, black #14181D, offpiste #E0A93C, default #8796A5; line-width interpolate by zoom (12→2, 16→5); offpiste dashed (line-dasharray [2,2]) — use a separate layer for offpiste since dasharray can't be data-driven
   - line layer for lifts (k=="lift"): #16283C width 2
   If path given: source "path" LineString, line layer color #C0392B width 4.
   Click on piste/lift lines: show a maplibregl.Popup with "<strong>" + esc(name or "Unnamed") + "</strong>" and the grade label (Green/Blue/Red/Black/Off-piste/Lift). Change cursor to pointer on hover.
5. close(): safe to call any time; isOpen() false afterwards.
6. Errors: if WebGL unsupported (maplibregl.supported && !maplibregl.supported()) or loading fails, throw an Error with a short human message; the caller shows it.
7. Code style: 2-space indent, 'use strict' inside an IIFE, short comments, no console.log, no external deps besides MapLibre, ES2019.
