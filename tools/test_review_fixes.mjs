// Offline regressions for the second review's status, map and stored-data fixes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const slice = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const ctx = vm.createContext({ Intl, Date, Set });
vm.runInContext(slice('function parisMinutes()', 'function hhmm'), ctx);
assert.equal(vm.runInContext('parisMinutes()', ctx), (() => {
  const [h,m] = new Date().toLocaleTimeString('en-GB', {timeZone:'Europe/Paris', hourCycle:'h23'}).split(':');
  return +h*60 + +m;
})());
vm.runInContext(`
let statusData = {season_open:null, fetched_at:new Date().toISOString(), lifts:{'LP|test':'closed'}};
const STATUS_FRESH_MS = 10800000;
const R = {lifts:[{name:'test',mtn:'LP',bottom:[1,2],top:[3,4]}],runs:[]};
` + slice('function statusAgeMs()', 'function liftStatus') +
slice('function coordKey(', 'function vecStyle'), ctx);
const graph = {edges:[[0,0,0,0,0,0,0,[1,2]]],kinds:['lift']};
ctx.graph = graph;
assert.equal(vm.runInContext('routeClosures(graph).blocked.has(0)', ctx), true);
assert.equal(vm.runInContext("statusData.lifts['LP|test']='scheduled'; routeClosures(graph).blocked.has(0)", ctx), true);
assert.equal(vm.runInContext('statusData.season_open=false; routeClosures(graph).blocked', ctx), null);
vm.runInContext('const daylog = [{resort:"p",track:{runs:[null,42,"bad",[],{pistes:["test"]}]}}];' +
slice('function skiedNames(', 'function pisteLines'), ctx);
assert.deepEqual([...vm.runInContext('skiedNames("p")', ctx)], ['test']);

// Failed downloads remove both assets and allow a new attempt; close while pending cancels.
const assets = [], maps = [];
class FakeMap {
  constructor(){ this.handlers = {}; this.removed = 0; maps.push(this); }
  addControl(){}
  once(name, fn){ this.handlers[name] = fn; }
  on(name, fn){ this.handlers[name] = fn; }
  remove(){ this.removed++; }
}
const lib = {Map:FakeMap,NavigationControl:class {}};
const c = vm.createContext({window:{}, document:{
  createElement(tag){ return {tag,remove(){this.removed=true;}}; },
  head:{appendChild(el){assets.push(el);}}
}});
vm.runInContext(fs.readFileSync(new URL('../map3d.js', import.meta.url),'utf8'),c);
const api = c.window.FC3D, opts = {center:[1,2],zoom:12};
let pending = api.open({},opts);
assets[1].onerror();
await assert.rejects(pending);
assert.ok(assets.every(a=>a.removed));
pending = api.open({},opts);
assert.equal(assets.length,4);
api.close();
c.window.maplibregl = c.maplibregl = lib;
assets[2].onload(); assets[3].onload();
await pending;
assert.equal(maps.length,0);
pending = api.open({},opts);
await new Promise(setImmediate);
api.close();
await pending;
assert.equal(maps[0].removed,1);
pending = api.open({},opts);
await new Promise(setImmediate);
maps[1].handlers.error({error:new Error('terrain unavailable')});
await assert.rejects(pending,/terrain unavailable/);
assert.equal(maps[1].removed,1);
pending = api.open({},opts);
await new Promise(setImmediate);
maps[2].handlers.load();
await pending;
assert.equal(api.isOpen(),true);
maps[2].handlers.error({error:new Error('late terrain error')});
assert.equal(maps[2].removed,1);
assert.equal(api.isOpen(),false);
console.log('PASS: Paris clock, null-season/scheduled closures, malformed runs, 3D retry/cancellation/terrain cleanup');

// Replay's saved first-fix clock wins, with valid older-entry fallbacks.
const clockExpr = /start = (new Date\(typeof entry\.track\.t0[^;]+);/.exec(html)[1];
const replayStart = entry => vm.runInNewContext(clockExpr,{entry,Date}).valueOf();
assert.equal(replayStart({track:{t0:2000},id:1000}),2000);
assert.equal(replayStart({track:{t0:'2000'},id:1000}),1000);
assert.equal(replayStart({track:{t0:Infinity},id:NaN,date:'2026-11-20'}),Date.parse('2026-11-20T09:00'));

// Failed terrain loads render an actual hatched tile.
let img, fills=0, strokes=0;
const canvas = {getContext:()=>({fillRect(){fills++;},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++;}})};
const sc = vm.createContext({document:{createElement:()=>canvas},Image:class {constructor(){img=this;}}});
vm.runInContext(fs.readFileSync(new URL('../steep.js',import.meta.url),'utf8'),sc);
const tileLayer = sc.FCSteep.layer({GridLayer:{extend:obj=>obj}});
let tileError;
tileLayer.createTile({x:0,y:0,z:11},(err,tile)=>{tileError=err;assert.equal(tile,canvas);});
img.onerror();
assert.ok(tileError); assert.equal(fills,1); assert.equal(strokes,1);

// Fit padding preserves caller padding and adds the diagonal rotor's hidden margins.
const point = (x,y) => {
  if(Array.isArray(x)) [x,y]=x;
  else if(typeof x==='object') ({x,y}=x);
  return {x,y,add(p){return point(x+p.x,y+p.y);},clone(){return point(x,y);}};
};
const container = {clientWidth:300,clientHeight:400,insertBefore(){},addEventListener(){}};
const rotor = {style:{setProperty(){}},appendChild(){}};
const map = {getContainer:()=>container,getPane:()=>({}),getCenter:()=>[0,0],getZoom:()=>12,
  invalidateSize(){},setView(){},fitBounds(b,o){return o;}};
const rc = vm.createContext({window:{L:{point,DomUtil:{create:()=>rotor}}}});
vm.runInContext(fs.readFileSync(new URL('../rotate.js',import.meta.url),'utf8'),rc);
rc.window.FCRotate.enable(map);
const options = {padding:[24,24]};
const fitted = map.fitBounds([],options);
assert.equal(fitted.paddingTopLeft.x,124);
assert.equal(fitted.paddingBottomRight.y,74);
assert.deepEqual(options,{padding:[24,24]});
console.log('PASS: replay origin/fallbacks, missing terrain hatch, rotor fit padding');
