import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const maps = [], buttons = [], protocols = [];
let fills = 0, strokes = 0, bitmapClosed = 0, fail = false, reduced = false;
const pixels = new Uint8ClampedArray(256*256*4);
const canvasContext = {drawImage(){},getImageData:()=>({data:pixels}),createImageData:()=>({data:pixels}),putImageData(){},fillRect(){fills++;},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++;}};
class MapStub {
  constructor(options){this.options=options;this.handlers={};this.sources={};this.layers=[];maps.push(this);}
  addControl(){}
  once(n,f){this.handlers[n]=f;}
  on(n,...args){this.handlers[n]=args.at(-1);}
  addSource(n,s){this.sources[n]={...s,setData(d){this.data=d;}};}
  getSource(n){return this.sources[n];}
  addLayer(l,before){this.layers.push({...l,before});}
  setLayoutProperty(id,key,v){this.layers.find(l=>l.id===id).layout[key]=v;}
  easeTo(o){this.ease=o;}
  jumpTo(o){this.jump=o;}
  fitBounds(b,o){this.fit={b,o};}
  remove(){this.removed=true;}
}
const lib = {Map:MapStub,NavigationControl:class {},LngLatBounds:class {constructor(a,b){this.points=[a,b];}extend(p){this.points.push(p);return this;}}, addProtocol(n,f){protocols.push({n,f});}};
const c = vm.createContext({window:{maplibregl:lib,matchMedia:()=>({matches:reduced})},maplibregl:lib,AbortController,
 document:{createElement(tag){return tag==='canvas'?{getContext:()=>canvasContext,toBlob:fn=>fn(new Blob(['png']))}:{setAttribute(k,v){this[k]=v;},remove(){}};}},
 fetch:async()=>{if(fail) throw new Error('offline');return {ok:true,blob:async()=>new Blob()};},
 createImageBitmap:async()=>({close(){bitmapClosed++;}}),
 FCSteep:{decode:()=>[],tileLat:()=>45,slopes:()=>[31,41],band:()=>[1,2,3]}
});
vm.runInContext(fs.readFileSync('map3d.js','utf8'),c);
const api=c.window.FC3D, container={appendChild(b){buttons.push(b);}}, opts={center:[45,6],zoom:12,bearing:85};
api.setPosition(45,6,20); api.setPath([[45,6],[46,7]]); // Safe before map/style exists.
async function open(extra={}){const p=api.open(container,{...opts,...extra});await new Promise(setImmediate);const m=maps.at(-1);m.handlers.load();await p;return m;}
let m=await open({path:[[45,6],[46,7]],geojson:{type:'FeatureCollection',features:[]}});
assert.equal(m.options.bearing,85);assert.equal(m.options.pitch,0);assert.equal(m.ease.duration,800);
api.setPosition(45,6,30);
assert.deepEqual(Array.from(m.sources.position.data.geometry.coordinates),[6,45]);
const ring=m.sources.accuracy.data.geometry.coordinates[0];assert.equal(ring.length,49);assert.deepEqual(ring[0],ring[48]);
assert.equal(m.sources.path.data.geometry.coordinates.length,2);
api.setPath(null);assert.equal(m.sources.path.data.features.length,0);
api.setPath([[40,5],[41,6]]);assert.equal(m.sources.path.data.geometry.coordinates[0][0],5);
assert.equal(m.layers.find(l=>l.id==='steepness').before,'piste-fill');
buttons.find(b=>/map3d-steep/.test(b.className)).onclick();assert.equal(m.layers.find(l=>l.id==='steepness').layout.visibility,'visible');
assert.equal(protocols.length,1);
const protocol=protocols[0].f;
const result=await protocol({url:'steep://12/2100/1500.png'},new AbortController());assert.ok(result.data instanceof ArrayBuffer);assert.equal(bitmapClosed,1);
fail=true;await protocol({url:'steep://12/2100/1500.png'},new AbortController());assert.equal(fills,1);assert.equal(strokes,1);
const aborted=new AbortController();aborted.abort();await assert.rejects(protocol({url:'steep://12/2100/1500.png'},aborted));assert.equal(fills,1);
let stopped=0, frame;
m=await open({replay:{path:[[45,6],[46,7]],start(fn){frame=fn;fn([45,6]);return ()=>stopped++;}}});
assert.equal(m.fit.o.pitch,60);assert.equal(m.fit.o.padding,48);assert.equal(m.sources.replay.data.geometry.coordinates[0],6);
api.close();assert.equal(stopped,1);assert.equal(m.removed,true);frame([50,10]); // Stale callback cannot touch a removed map.
api.close();assert.equal(stopped,1);
reduced=true;m=await open();assert.equal(m.jump.pitch,60);assert.equal(protocols.length,1);api.close();
const pending=api.open(container,opts);await new Promise(setImmediate);api.setPosition(45,6,10);api.setPath(null);api.close();await pending;assert.equal(api.isOpen(),false);
// Exercise the actual shared clock with deterministic RAF, including pause and stop.
const html=fs.readFileSync('index.html','utf8');
let now=0, scheduled, cancelled;
const r=vm.createContext({Date,performance:{now:()=>now},requestAnimationFrame(fn){scheduled=fn;return 1;},cancelAnimationFrame(id){cancelled=id;}});
vm.runInContext(html.slice(html.indexOf('function replayClock('),html.indexOf('function startDayReplay(')),r);
const frames=[];r.entry={track:{t0:0}};r.path=[[45,6,1000,0],[46,7,900,120],[47,8,800,240]];r.update=(...f)=>frames.push(f);
const control=vm.runInContext('replayClock(entry,path,update)',r);assert.equal(frames[0][1],0);
now=1000;scheduled(now);assert.equal(frames.at(-1)[1],1);assert.match(frames.at(-1)[2],/50%/);
control.paused=true;now=2000;scheduled(now);assert.equal(frames.at(-1)[1],1);
control.stop();assert.equal(cancelled,1);const count=frames.length;scheduled(3000);assert.equal(frames.length,count);
console.log('PASS: 3D position, route, replay, reduced motion, protocol PNG/hatch, repeated open/close and cancellation; shared replay clock');
// Open integration carries the 2D bearing/route and only forwards a fresh GPS fix.
let opened, positionCalls=0;
const fc={async open(box,o){opened=o;},isOpen:()=>true,setPosition(){positionCalls++;}};
const integration=vm.createContext({window:{FC3D:fc},FC3D:fc,Date,Math,
 document:{getElementById:()=>({hidden:true})},map:{getCenter:()=>({lat:45,lng:6}),getZoom:()=>13},
 rotor:{getBearing:()=>123},vecData:{},resortId:'pdk',currentRouteLine:[[45,6],[46,7]],labelInfo:[],labelAngle:()=>0,esc:x=>x,
 latestPosition:{timestamp:Date.now(),coords:{latitude:45,longitude:6,accuracy:30}},alert:msg=>assert.fail(msg)});
vm.runInContext(html.slice(html.indexOf('async function open3D('),html.indexOf('document.getElementById("map3d-close").addEventListener')),integration);
await integration.open3D();assert.equal(opened.bearing,123);assert.equal(opened.path.length,2);assert.equal(positionCalls,1);
integration.latestPosition.timestamp-=121000;await integration.open3D();assert.equal(positionCalls,1);
// Close aborts an outstanding protocol fetch as well as the map load.
c.fetch=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));
const tileController=new AbortController();const tilePending=protocol({url:'steep://12/2100/1500.png'},tileController);
api.close();await assert.rejects(tilePending,/aborted/);assert.equal(tileController.signal.aborted,true);
console.log('PASS: open forwards bearing/route/fresh GPS; close aborts protocol requests');
