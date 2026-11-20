/* 3D terrain view: MapLibre GL (BSD) + AWS Terrain Tiles (open data, CORS ok), loaded lazily.
   Written by local Qwen from docs/sessions/briefs/qwen-map3d.md; fixed and reviewed by Claude. */
(function() {
  'use strict';

  const SRI_CSS = "sha256-V2sIX92Uh6ZaGSFTKMHghsB85b9toJtmazgG09AI2uk=";
  const SRI_JS = "sha256-vpYzxNhw4m+zfxz+XFp3GBZnEUAD6hYgeseFDY2ordE=";

  let loadPromise = null, assetsFailed = false;
  let mapInstance = null;
  let currentContainer = null;
  let isOpenFlag = false;
  let generation = 0, cancelLoad = null;
  let position = null, path = null, stopAnimation = null;
  let protocolRegistered = false;
  const tileRequests = new Set();
  const empty = () => ({ type:'FeatureCollection', features:[] });
  const feature = (type, coordinates) => ({type:'Feature', properties:{}, geometry:{type, coordinates}});

  function registerSteepness() {
    if(protocolRegistered) return;
    maplibregl.addProtocol('steep', async (params, controller) => {
      const match = /^steep:\/\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(params.url);
      if(!match) throw new Error('Invalid terrain tile');
      const [, z, x, y] = match.map(Number);
      tileRequests.add(controller);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d', {willReadFrequently:true});
      let bitmap;
      try {
        try {
          const response = await fetch(`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${z}/${x}/${y}.png`, {signal:controller.signal});
          if(!response.ok) throw new Error('Terrain unavailable');
          bitmap = await createImageBitmap(await response.blob());
          if(controller.signal.aborted) throw new Error('Cancelled');
          ctx.drawImage(bitmap, 0, 0);
          const elev = FCSteep.decode(ctx.getImageData(0, 0, 256, 256).data);
          const mpp = 156543.034 * Math.cos(FCSteep.tileLat(y + 0.5, z) * Math.PI / 180) / 2 ** z;
          const slopes = FCSteep.slopes(elev, mpp), out = ctx.createImageData(256, 256);
          for(let i = 0; i < slopes.length; i++) {
            const rgb = FCSteep.band(slopes[i]);
            if(rgb) out.data.set([...rgb, 255], i * 4);
          }
          ctx.putImageData(out, 0, 0);
        } catch(error) {
          if(controller.signal.aborted) throw error;
          ctx.fillStyle = '#E5E7EB'; ctx.fillRect(0, 0, 256, 256);
          ctx.strokeStyle = '#9CA3AF'; ctx.lineWidth = 2; ctx.beginPath();
          for(let x = -256; x < 256; x += 16){ ctx.moveTo(x, 0); ctx.lineTo(x + 256, 256); }
          ctx.stroke();
        }
        const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG encoding failed')), 'image/png'));
        const data = await blob.arrayBuffer();
        if(controller.signal.aborted) throw new Error('Cancelled');
        return {data};
      } finally { if(bitmap) bitmap.close(); tileRequests.delete(controller); }
    });
    protocolRegistered = true;
  }

  function drawPosition() {
    if(!isOpenFlag || !position) return;
    const [lat, lon, accuracy] = position, ring = [], rad = Math.PI / 180;
    const distance = accuracy / 6371000, phi = lat * rad;
    for(let i = 0; i < 48; i++) {
      const bearing = i * 2 * Math.PI / 48;
      const p = Math.asin(Math.sin(phi)*Math.cos(distance) + Math.cos(phi)*Math.sin(distance)*Math.cos(bearing));
      const l = lon*rad + Math.atan2(Math.sin(bearing)*Math.sin(distance)*Math.cos(phi), Math.cos(distance)-Math.sin(phi)*Math.sin(p));
      ring.push([l/rad, p/rad]);
    }
    ring.push(ring[0]);
    mapInstance.getSource('accuracy').setData(feature('Polygon', [ring]));
    mapInstance.getSource('position').setData(feature('Point', [lon, lat]));
  }
  function drawPath() {
    if(isOpenFlag) mapInstance.getSource('path').setData(path && path.length > 1 ? feature('LineString', path.map(p => [p[1],p[0]])) : empty());
  }

  async function ensureMapLibre() {
    if (window.maplibregl && !assetsFailed) return;
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      link.integrity = SRI_CSS;
      link.crossOrigin = 'anonymous';


      const script = document.createElement('script');
      script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
      script.integrity = SRI_JS;
      script.crossOrigin = 'anonymous';
      let cssReady = false, jsReady = false;
      const ready = () => { if(cssReady && jsReady){ assetsFailed = false; resolve(); } };
      const fail = () => {
        assetsFailed = true;
        link.remove(); script.remove();
        reject(new Error('Failed to load MapLibre GL assets'));
      };
      link.onload = () => { cssReady = true; ready(); };
      link.onerror = fail;
      script.onload = () => { jsReady = true; ready(); };
      script.onerror = fail;
      document.head.appendChild(link);
      document.head.appendChild(script);
    }).catch(error => { loadPromise = null; throw error; });
    return loadPromise;
  }

  // 'clean' = snow relief: no raster base, white snow + stronger MapLibre hillshade (no printed names)
  const styleFor = key => key === 'clean'
    ? { ...baseStyle, sources: { dem: baseStyle.sources.dem },
        layers: [ { id: 'background', type: 'background', paint: { 'background-color': '#F7FAFC' } },
                  { id: 'hillshade', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.6, 'hillshade-shadow-color': '#6F8299', 'hillshade-highlight-color': '#FFFFFF', 'hillshade-accent-color': '#8FA3B8' } } ] }
    : baseStyle;
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

  /* piste/lift names lying flat along their line on the terrain, re-angled on rotate so they always read
     left-to-right (HTML markers: no font server needed). opts.labels from index.html buildLabelInfo(). */
  function addLabels(instance, opts){
    if(!Array.isArray(opts.labels) || typeof opts.labelAngle !== 'function') return;
    const pool = opts.labels.filter(x => x && x.name && Array.isArray(x.mid) && Number.isFinite(x.bearing));
    let items = [];
    const orient = () => { const mb = instance.getBearing(); for(const it of items) if(it.b !== null) it.m.setRotation(opts.labelAngle(it.b, mb) + mb); };
    // label what's actually in view (longest first, one per name), like the 2D map
    const refresh = () => {
      for(const it of items) it.m.remove();
      items = [];
      const b = instance.getBounds();
      // tilted view: bounds reach the horizon, so pick the names nearest the centre of the view first
      const c = instance.getCenter(), k = Math.cos(c.lat * Math.PI / 180), seen = new Set();
      const near = (instance.getZoom() < 13 ? [] : pool).filter(x => b.contains([x.mid[1], x.mid[0]]))
        .map(x => ({ x, d: (x.mid[0] - c.lat) ** 2 + ((x.mid[1] - c.lng) * k) ** 2 }))
        .sort((p, q) => p.d - q.d).map(p => p.x);
      for(const x of near){
        if(items.length >= 60) break;
        if(seen.has(x.kind + x.name)) continue;
        seen.add(x.kind + x.name);
        const el = document.createElement('div');
        el.className = 'map3d-label' + (x.kind === 'lift' ? ' lift' : '');
        el.textContent = x.name;                   // textContent: OSM names never become HTML
        // opacityWhenCovered 1: labels lie on the surface; MapLibre's terrain occlusion test fades them wrongly
        const m = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map', opacityWhenCovered: '1' })
          .setLngLat([x.mid[1], x.mid[0]]).addTo(instance);   // labelInfo mid is [lat, lon]
        items.push({ m, el, b: x.bearing });
      }
      // place names (clean background only): upright, by zoom like the 2D map
      if(Array.isArray(opts.places)){
        const z = instance.getZoom(), minZ = { village:11, peak:12, hamlet:14, lake:14 };
        let k = 0;
        for(const p of opts.places){
          if(k >= 60) break;
          if(!p || z < (minZ[p.t] || 15) || !Array.isArray(p.at) || !b.contains([p.at[1], p.at[0]])) continue;
          k++;
          const el = document.createElement('div');
          el.className = 'map3d-place place-' + p.t;
          el.textContent = p.t === 'peak' ? `▲ ${p.n}${Number.isFinite(p.ele) ? ' ' + p.ele.toLocaleString('en-GB') : ''}` : p.n;
          const m = new maplibregl.Marker({ element: el, opacityWhenCovered: '1' }).setLngLat([p.at[1], p.at[0]]).addTo(instance);
          items.push({ m, el, b: null });
        }
      }
      orient();
    };
    refresh();
    instance.on('moveend', refresh); instance.on('rotate', orient);
  }

  window.FC3D = {
    async open(container, opts) {
      this.close();
      const gen = generation;
      path = opts.path || null;
      let instance = null;
      try {
        await ensureMapLibre();
        if(gen !== generation) return;
        if (maplibregl.supported && !maplibregl.supported()) throw new Error('WebGL not supported');

        currentContainer = container;
        const [lat, lon] = opts.center;

        instance = new maplibregl.Map({
          container,
          style: styleFor(opts.basemap),
          center: [lon, lat],
          zoom: opts.zoom,
          pitch: 0,
          bearing: opts.bearing || 0,
          maxPitch: 80,
          antialias: true
        });

        mapInstance = instance;
        instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));

        // wait for the style + terrain to be ready (MapLibre has no map.load() promise)
        await new Promise((resolve, reject) => {
          cancelLoad = resolve;
          instance.once('load', resolve);
          instance.on('error', e => {
            if(gen === generation && isOpenFlag) this.close();
            reject(new Error((e && e.error && e.error.message) || 'Map failed to load'));
          });
        });

        if(gen !== generation) return;
        cancelLoad = null;

        if (opts.geojson) {
          instance.addSource('pistes', { type: 'geojson', data: opts.geojson });
          instance.addLayer({ id: 'piste-fill', type: 'fill', source: 'pistes', filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'k'], 'piste']], paint: { 'fill-color': gradeMatch, 'fill-opacity': 0.15 } });
          instance.addLayer({ id: 'piste-line', type: 'line', source: 'pistes', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'k'], 'piste'], ['!=', ['get', 'g'], 'offpiste']], paint: { 'line-color': gradeMatch, 'line-width': widthInterp } });
          instance.addLayer({ id: 'piste-offpiste', type: 'line', source: 'pistes', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'k'], 'piste'], ['==', ['get', 'g'], 'offpiste']], paint: { 'line-color': '#E0A93C', 'line-width': widthInterp, 'line-dasharray': [2, 2] } });
          instance.addLayer({ id: 'lift-line', type: 'line', source: 'pistes', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'k'], 'lift']], paint: { 'line-color': '#16283C', 'line-width': 2 } });

          ['piste-line', 'piste-offpiste', 'lift-line'].forEach(id => {
            instance.on('mouseenter', id, () => instance.getCanvas().style.cursor = 'pointer');
            instance.on('mouseleave', id, () => instance.getCanvas().style.cursor = '');
            instance.on('click', id, (e) => {
              const p = e.features[0].properties;
              const name = p.n || 'Unnamed';
              const g = p.k === 'lift' ? 'lift' : (p.g || 'unknown');
              new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<strong>${opts.esc(name)}</strong><br>${gradeLabels[g] || 'Unknown'}`).addTo(instance);
            });
          });
        }

        registerSteepness();
        instance.addSource('steepness', {type:'raster', tiles:['steep://{z}/{x}/{y}.png'], tileSize:256, maxzoom:14});
        instance.addLayer({id:'steepness', type:'raster', source:'steepness', layout:{visibility:'none'}, paint:{'raster-opacity':0.5}}, opts.geojson ? 'piste-fill' : undefined);
        const toggle = document.createElement('button');
        toggle.className = 'secondary map3d-steep'; toggle.textContent = '⚠ Avalanche terrain: off';
        toggle.setAttribute('aria-pressed', 'false');
        toggle.title = '30–35° yellow · 35–40° orange · 40–45° red · 45°+ purple. Grey hatch: terrain unavailable.';
        let steep = false;
        const legend = document.createElement('div');
        legend.className = 'steep-legend map3d-legend'; legend.hidden = true;
        legend.innerHTML = '<span style="background:#F1C40F"></span>30–35° <span style="background:#E67E22"></span>35–40° <span style="background:#C0392B"></span>40–45° <span style="background:#7B4FB8"></span>45°+<br>grey hatch = no data (needs signal)';
        toggle.onclick = () => {
          steep = !steep; toggle.setAttribute('aria-pressed', String(steep));
          toggle.textContent = '⚠ Avalanche terrain: ' + (steep ? 'on' : 'off');
          legend.hidden = !steep;
          instance.setLayoutProperty('steepness', 'visibility', steep ? 'visible' : 'none');
        };
        container.appendChild(toggle); container.appendChild(legend);
        for(const id of ['path', 'accuracy', 'position', 'replay']) instance.addSource(id, {type:'geojson', data:empty()});
        instance.addLayer({id:'path-line', type:'line', source:'path', paint:{'line-color':'#C0392B','line-width':4}});
        instance.addLayer({id:'accuracy-fill', type:'fill', source:'accuracy', paint:{'fill-color':'#3D7FB8','fill-opacity':0.12}});
        instance.addLayer({id:'accuracy-line', type:'line', source:'accuracy', paint:{'line-color':'#3D7FB8','line-width':1}});
        for(const id of ['position', 'replay']) instance.addLayer({id:id+'-dot', type:'circle', source:id, paint:{'circle-radius':7,'circle-color':id === 'position' ? '#3D7FB8' : '#C0392B','circle-stroke-color':'#fff','circle-stroke-width':2}});
        isOpenFlag = true;
        drawPath(); drawPosition();
        addLabels(instance, opts);
        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if(opts.replay) {
          const coords = opts.replay.path.map(p => [p[1],p[0]]);
          const bounds = coords.reduce((b,p) => b.extend(p), new maplibregl.LngLatBounds(coords[0],coords[0]));
          instance.fitBounds(bounds, {padding:48, pitch:60, duration:reduced ? 0 : 800});
          stopAnimation = opts.replay.start(p => {
            if(gen === generation && isOpenFlag) instance.getSource('replay').setData(feature('Point', [p[1],p[0]]));
          });
        } else if(reduced) instance.jumpTo({pitch:60});
        else instance.easeTo({pitch:60, duration:800});

      } catch(error) {
        if(gen !== generation) return;
        this.close();
        throw error;
      }
    },

    close() {
      generation++;
      if(stopAnimation){ const stop = stopAnimation; stopAnimation = null; stop(); }
      for(const controller of tileRequests) controller.abort();
      tileRequests.clear();
      position = null; path = null;
      if(cancelLoad){ cancelLoad(); cancelLoad = null; }
      if (mapInstance) {
        try { mapInstance.remove(); } catch (_) {}
        mapInstance = null;
      }
      if (currentContainer) currentContainer.innerHTML = '';
      currentContainer = null;
      isOpenFlag = false;
    },

    setPosition(lat, lon, accuracyM) {
      if(!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) return;
      position = [lat, lon, Number.isFinite(accuracyM) ? Math.max(0, accuracyM) : 20];
      drawPosition();
    },
    setPath(value) {
      path = Array.isArray(value) ? value.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) : null;
      drawPath();
    },
    isOpen() {
      return isOpenFlag;
    }
  };
})();
