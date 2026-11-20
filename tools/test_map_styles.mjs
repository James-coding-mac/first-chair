import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8');
const active=new Set();
const layer=()=>({addTo(){active.add(this);return this;},bringToBack(){return this;}});
const prefs={};
const c=vm.createContext({store:{get:()=>prefs},resortId:'pdk',R:{places:[{}],mapData:'local'},
 mapReady:true,map:{hasLayer:l=>active.has(l),removeLayer:l=>active.delete(l)},vecGroup:layer(),layersCtl:{removeLayer(){},addOverlay(){}}});
vm.runInContext(html.slice(html.indexOf('const SATELLITE_URL'),html.indexOf('function initMapTypePicker')),c);
c.clean=layer();c.osm=layer();c.satellite=layer();c.snow=layer();
vm.runInContext('baseLayers={clean,osm,satellite,satonly:satellite};snowLayer=snow;',c);
assert.equal(c.basemapKey(),'clean');
for(const key of ['clean','satellite','satonly','osm','satellite']){
 prefs.pdk=key;c.applyBasemap();assert.equal(c.basemapKey(),key);
 assert.equal(active.has(c.vecGroup),key!=='satonly');
 assert.equal(active.has(c.satellite),key.startsWith('sat'));
 assert.equal(active.has(c.snow),false);
}
c.resortId='other';c.R={};assert.equal(c.basemapKey(),'osm');
prefs.other='satonly';c.applyBasemap();assert.equal(active.has(c.snow),false);
prefs.other='satellite';c.applyBasemap();assert.equal(active.has(c.snow),true);
assert.equal(prefs.pdk,'satellite');prefs.other='obsolete';assert.equal(c.basemapKey(),'osm');
const sw=fs.readFileSync('sw.js','utf8');
vm.runInContext(sw.slice(sw.indexOf('function isTile'),sw.indexOf('async function trimCache')),c);
assert.equal(c.isTile(new URL('https://tiles.maps.eox.at/wmts/test')),true);
assert.equal(c.isTile(new URL('https://tiles.maps.eox.at.evil.test/test')),false);
console.log('PASS: map preferences, resort defaults, satellite-only visibility, restoration, imagery cache allow-list');
