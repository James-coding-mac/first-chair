/* Slope-steepness overlay (FATMAP-style) computed in the browser from AWS Terrain Tiles
   (Terrarium PNG: metres = R*256 + G + B/256 - 32768). 30-35° yellow, 35-40° orange,
   40-45° red, 45°+ purple; under 30° transparent. Elevation data ~30 m, so very small
   features are smoothed out: a guide for avalanche-terrain awareness, not a measurement. */
(function(root){
  'use strict';
  const DEM = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png';
  const BANDS = [[45, [123, 79, 184]], [40, [192, 57, 43]], [35, [230, 126, 34]], [30, [241, 196, 15]]];

  /* slope in degrees for each pixel of a 256x256 elevation grid (Float32Array), clamped edges */
  function slopes(elev, metresPerPx){
    const n = 256, out = new Float32Array(n * n), k = 1 / (8 * metresPerPx);
    const at = (x, y) => elev[Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))];
    for(let y = 0; y < n; y++) for(let x = 0; x < n; x++){
      // Horn's method (3x3 Sobel), standard for DEM slope
      const a = at(x-1,y-1), b = at(x,y-1), c = at(x+1,y-1), d = at(x-1,y), f = at(x+1,y), g = at(x-1,y+1), h = at(x,y+1), i = at(x+1,y+1);
      const dzdx = ((c + 2*f + i) - (a + 2*d + g)) * k, dzdy = ((g + 2*h + i) - (a + 2*b + c)) * k;
      out[y * n + x] = Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI;
    }
    return out;
  }
  function decode(rgba){
    const e = new Float32Array(256 * 256);
    for(let p = 0, q = 0; p < e.length; p++, q += 4) e[p] = rgba[q] * 256 + rgba[q+1] + rgba[q+2] / 256 - 32768;
    return e;
  }
  function band(deg){ for(const [min, rgb] of BANDS) if(deg >= min) return rgb; return null; }

  function layer(L, opts){
    opts = opts || {};
    return L.GridLayer.extend({
      options: { maxNativeZoom: 14, minZoom: 11, maxZoom: 18, opacity: opts.opacity || 0.5, attribution: 'Steepness from AWS Terrain Tiles' },
      createTile(coords, done){
        const tile = document.createElement('canvas'); tile.width = tile.height = 256;
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => {
          try{
            const c = document.createElement('canvas'); c.width = c.height = 256;
            const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
            const elev = decode(cx.getImageData(0, 0, 256, 256).data);
            const lat = tileLat(coords.y + 0.5, coords.z);
            const mpp = 156543.034 * Math.cos(lat * Math.PI / 180) / Math.pow(2, coords.z);
            const s = slopes(elev, mpp), ctx = tile.getContext('2d'), out = ctx.createImageData(256, 256);
            for(let p = 0; p < s.length; p++){
              const rgb = band(s[p]); if(!rgb) continue;
              out.data[p*4] = rgb[0]; out.data[p*4+1] = rgb[1]; out.data[p*4+2] = rgb[2]; out.data[p*4+3] = 255;
            }
            ctx.putImageData(out, 0, 0); done(null, tile);
          }catch(e){ done(e, tile); }
        };
        img.onerror = () => done(new Error('terrain tile unavailable'), tile);
        img.src = DEM.replace('{z}', coords.z).replace('{x}', coords.x).replace('{y}', coords.y);
        return tile;
      }
    });
  }
  function tileLat(y, z){ const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return 180 / Math.PI * Math.atan(Math.sinh(n)); }

  root.FCSteep = { layer, slopes, decode, band, tileLat };
})(typeof window === 'undefined' ? globalThis : window);
