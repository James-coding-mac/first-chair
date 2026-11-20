/* Map rotation for Leaflet 1.9 without a plugin (the common plugin is GPL).
   The map panes live in a square "rotor" div (side = container diagonal) rotated by -bearing, so the
   corners stay covered. Leaflet is told the map is that square; pointer positions are rotated back
   into it, and drag offsets are rotated so the map follows your finger. Controls don't rotate.
   bearing = compass direction at the top of the screen (0 = north up). */
(function(root){
  'use strict';
  function enable(map, opts){
    opts = opts || {};
    const L = root.L, container = map.getContainer(), mapPane = map.getPane('mapPane');
    const rotor = L.DomUtil.create('div', 'fc-rotor');
    container.insertBefore(rotor, mapPane);
    rotor.appendChild(mapPane);
    let bearing = 0, W = 0, H = 0, D = 0;
    const rad = d => d * Math.PI / 180;
    const rotate = (x, y, deg) => { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return [x*c - y*s, x*s + y*c]; };

    function layout(){
      W = container.clientWidth; H = container.clientHeight; D = Math.ceil(Math.hypot(W, H)) || 1;
      rotor.style.cssText = `position:absolute;left:${(W-D)/2}px;top:${(H-D)/2}px;width:${D}px;height:${D}px;` +
        `transform-origin:50% 50%;transform:rotate(${-bearing}deg);--fc-bearing:${bearing}deg`;
    }
    // Leaflet's idea of the map size: the rotor square
    map.getSize = function(){
      if(!this._size || this._sizeChanged){ this._size = L.point(D, D); this._sizeChanged = false; }
      return this._size.clone();
    };
    const origFitBounds = map.fitBounds;
    map.fitBounds = function(bounds, options){
      const o = Object.assign({}, options), margin = L.point((D-W)/2, (D-H)/2);
      o.paddingTopLeft = L.point(o.paddingTopLeft || o.padding || [0,0]).add(margin);
      o.paddingBottomRight = L.point(o.paddingBottomRight || o.padding || [0,0]).add(margin);
      return origFitBounds.call(this, bounds, o);
    };
    const origInvalidate = map.invalidateSize;
    map.invalidateSize = function(o){ layout(); return origInvalidate.call(this, o); };
    // screen point (relative to the visible container) -> rotor point
    map.mouseEventToContainerPoint = function(e){
      const p = L.DomEvent.getMousePosition(e, container);
      const [x, y] = rotate(p.x - W/2, p.y - H/2, bearing);
      return L.point(x + D/2, y + D/2);
    };
    // drags: rotate the finger offset into rotor space
    const drag = map.dragging && map.dragging._draggable;
    if(drag) drag.on('predrag', () => {
      if(!bearing) return;
      const o = drag._newPos.subtract(drag._startPos), [x, y] = rotate(o.x, o.y, bearing);
      drag._newPos = drag._startPos.add(L.point(x, y));
    });

    const listeners = [];
    function setBearing(b, fromUser){
      bearing = ((b % 360) + 360) % 360;
      rotor.style.transform = `rotate(${-bearing}deg)`;
      rotor.style.setProperty('--fc-bearing', bearing + 'deg');
      listeners.forEach(fn => fn(bearing, fromUser));
    }

    // two-finger twist (pinch zoom keeps working alongside)
    let twist = null;
    const angle = t => Math.atan2(t[1].clientY - t[0].clientY, t[1].clientX - t[0].clientX) * 180 / Math.PI;
    container.addEventListener('touchstart', e => {
      if(e.touches.length === 2) twist = { a: angle(e.touches), b: bearing, live: false };
    }, { passive: true });
    container.addEventListener('touchmove', e => {
      if(!twist || e.touches.length !== 2) return;
      let d = angle(e.touches) - twist.a;
      if(d > 180) d -= 360; if(d < -180) d += 360;
      if(!twist.live && Math.abs(d) < 12) return;          // dead zone so a pinch doesn't wobble the map
      twist.live = true;
      setBearing(twist.b - d, true);
    }, { passive: true });
    container.addEventListener('touchend', e => { if(e.touches.length < 2) twist = null; }, { passive: true });
    // desktop: Alt/Option + wheel rotates
    container.addEventListener('wheel', e => {
      if(!e.altKey) return;
      e.preventDefault(); e.stopPropagation();
      setBearing(bearing + (e.deltaY > 0 ? 10 : -10), true);
    }, { capture: true, passive: false });

    const c0 = map.getCenter(), z0 = map.getZoom();
    layout();
    map._sizeChanged = true;
    map.invalidateSize({ pan: false });
    map.setView(c0, z0, { reset: true });         // full re-layout: the bigger virtual size must not move the view
    return {
      getBearing: () => bearing,
      setBearing,
      onChange: fn => listeners.push(fn),
      layout
    };
  }
  root.FCRotate = { enable };
})(window);
