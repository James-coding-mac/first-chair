/* 3D terrain view: MapLibre GL (BSD) + AWS Terrain Tiles (open data, CORS ok), loaded lazily.
   Written by local Qwen from docs/sessions/briefs/qwen-map3d.md; fixed and reviewed by Claude. */
(function() {
  'use strict';

  const SRI_CSS = "sha256-V2sIX92Uh6ZaGSFTKMHghsB85b9toJtmazgG09AI2uk=";
  const SRI_JS = "sha256-vpYzxNhw4m+zfxz+XFp3GBZnEUAD6hYgeseFDY2ordE=";

  let loadPromise = null;
  let mapInstance = null;
  let currentContainer = null;
  let isOpenFlag = false;

  async function ensureMapLibre() {
    if (window.maplibregl) return;
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      link.integrity = SRI_CSS;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
      script.integrity = SRI_JS;
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load MapLibre GL JS'));
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  const baseStyle = {
    version: 8,
    sources: {
      osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 18, attribution: '© OpenStreetMap contributors' },
      dem: { type: 'raster-dem', tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Terrain: Mapzen/AWS Terrain Tiles' }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#DCEAF5' } },
      { id: 'osm', type: 'raster', source: 'osm' },
      { id: 'hillshade', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.35 } }
    ],
    terrain: { source: 'dem', exaggeration: 1.4 }
  };

  const gradeMatch = ['match', ['get', 'g'], 'green', '#2E7D4F', 'blue', '#2B6CB0', 'red', '#C0392B', 'black', '#14181D', 'offpiste', '#E0A93C', '#8796A5'];
  const widthInterp = ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 5];
  const gradeLabels = { green: 'Green', blue: 'Blue', red: 'Red', black: 'Black', offpiste: 'Off-piste', lift: 'Lift', unknown: 'Unknown' };

  window.FC3D = {
    async open(container, opts) {
      await ensureMapLibre();
      if (maplibregl.supported && !maplibregl.supported()) throw new Error('WebGL not supported');
      if (isOpenFlag) this.close();

      currentContainer = container;
      const [lat, lon] = opts.center;

      mapInstance = new maplibregl.Map({
        container,
        style: baseStyle,
        center: [lon, lat],
        zoom: opts.zoom,
        pitch: 62,
        bearing: -20,
        maxPitch: 80,
        antialias: true
      });

      mapInstance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));

      // wait for the style + terrain to be ready (MapLibre has no map.load() promise)
      await new Promise((resolve, reject) => {
        mapInstance.once('load', resolve);
        mapInstance.once('error', e => reject(new Error((e && e.error && e.error.message) || 'Map failed to load')));
      });

      if (opts.geojson) {
        mapInstance.addSource('pistes', { type: 'geojson', data: opts.geojson });
        mapInstance.addLayer({ id: 'piste-fill', type: 'fill', source: 'pistes', filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'k'], 'piste']], paint: { 'fill-color': gradeMatch, 'fill-opacity': 0.15 } });
        mapInstance.addLayer({ id: 'piste-line', type: 'line', source: 'pistes', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'k'], 'piste'], ['!=', ['get', 'g'], 'offpiste']], paint: { 'line-color': gradeMatch, 'line-width': widthInterp } });
        mapInstance.addLayer({ id: 'piste-offpiste', type: 'line', source: 'pistes', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'k'], 'piste'], ['==', ['get', 'g'], 'offpiste']], paint: { 'line-color': '#E0A93C', 'line-width': widthInterp, 'line-dasharray': [2, 2] } });
        mapInstance.addLayer({ id: 'lift-line', type: 'line', source: 'pistes', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'k'], 'lift']], paint: { 'line-color': '#16283C', 'line-width': 2 } });

        ['piste-line', 'piste-offpiste', 'lift-line'].forEach(id => {
          mapInstance.on('mouseenter', id, () => mapInstance.getCanvas().style.cursor = 'pointer');
          mapInstance.on('mouseleave', id, () => mapInstance.getCanvas().style.cursor = '');
          mapInstance.on('click', id, (e) => {
            const p = e.features[0].properties;
            const name = p.n || 'Unnamed';
            const g = p.k === 'lift' ? 'lift' : (p.g || 'unknown');
            new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<strong>${opts.esc(name)}</strong><br>${gradeLabels[g] || 'Unknown'}`).addTo(mapInstance);
          });
        });
      }

      if (opts.path && opts.path.length > 1) {
        mapInstance.addSource('path', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: opts.path.map(p => [p[1], p[0]]) } } });
        mapInstance.addLayer({ id: 'path-line', type: 'line', source: 'path', paint: { 'line-color': '#C0392B', 'line-width': 4 } });
      }

      isOpenFlag = true;
    },

    close() {
      if (mapInstance) {
        try { mapInstance.remove(); } catch (_) {}
        mapInstance = null;
      }
      if (currentContainer) currentContainer.innerHTML = '';
      currentContainer = null;
      isOpenFlag = false;
    },

    isOpen() {
      return isOpenFlag;
    }
  };
})();
