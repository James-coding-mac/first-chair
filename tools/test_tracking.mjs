import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../track.js',import.meta.url),'utf8'),context);
const {analyse,thin,acceptPoint}=context.window.FCTrack;
const rows=[];
function test(name,fn){
  try {const a=fn();rows.push({test:name,result:'PASS',runs:a?.totals.runs??'—',lifts:a?.totals.liftRides??'—',vertical:a?.totals.vertical===null?'—':Math.round(a?.totals.vertical??0)});}
  catch(e){ rows.push({test:name,result:'FAIL',error:e.message});process.exitCode=1; }
}
// Deliberately synthetic coordinates; no resort names or real piste data.
function trace(){
  let t=0, y=0, alt=1000, ps=[{lat:0,lon:0,alt,acc:5,t}];
  return {ps,leg(seconds,metres,climb,noise=false){
    const startY=y,startAlt=alt,n=seconds/5;
    for(let i=1;i<=n;i++){
      t+=5000;y=startY+metres*i/n;alt=startAlt+climb*i/n;
      ps.push({lat:y/111195,lon:0,alt:alt+(noise?8*Math.sin(i*7.13):0),acc:5,t});
    }
    return this;
  }};
}
let day;
test('3 noisy lift/run cycles',()=>{
  const tr=trace();for(let i=0;i<3;i++) tr.leg(480,1600,400,true).leg(300,2000,-400,true);
  day=tr.ps;const a=analyse(day);
  assert.equal(a.totals.runs,3);assert.equal(a.totals.liftRides,3);
  assert.ok(Math.abs(a.totals.vertical-1200)<=120,JSON.stringify(a.totals));
  assert.ok(a.totals.distance>5500 && a.totals.distance<6500);
  assert.ok(a.runs.every(r=>r.start<r.end && r.avgSpeed<=r.topSpeed && r.duration===r.end-r.start));
  return a;
});
test('valley drive at 110 km/h',()=>{
  const a=analyse(trace().leg(600,110/3.6*600,-300).ps);
  // Below the specified 130 km/h rejection threshold: a descending car is
  // indistinguishable from skiing here. It is counted as one run, not hidden.
  assert.equal(a.totals.runs,1);assert.ok(a.totals.topSpeed>100 && a.totals.topSpeed<111);assert.equal(a.dropped,0);
  return a;
});
test('flat walk, noisy altitude',()=>{const a=analyse(trace().leg(900,1000,0,true).ps);assert.equal(a.totals.runs,0);assert.equal(a.totals.liftRides,0);return a;});
test('no altitude, moving fallback',()=>{const a=analyse(trace().leg(300,1200,0).ps.map(p=>({...p,alt:null})));assert.equal(a.totals.vertical,null);assert.equal(a.totals.runs,1);assert.equal(a.state,'Skiing');return a;});
test('GPS jumps and poor accuracy',()=>{
  const ps=day.map(p=>({...p}));ps.splice(20,0,{...ps[19],lat:70,t:ps[19].t+1000});ps.splice(30,0,{...ps[29],acc:51,t:ps[29].t+1000});
  const a=analyse(ps);assert.equal(a.dropped,2);assert.equal(a.totals.runs,3);assert.ok(a.totals.topSpeed<30);return a;
});
test('gondola with geometry confidence',()=>{
  const ps=trace().leg(480,1800,400,true).ps,lifts=[[[0,0],[1800/111195,0]]];
  const a=analyse(ps,{lifts});assert.equal(a.totals.liftRides,1);assert.equal(a.totals.runs,0);assert.equal(a.lifts[0].confidence,'geometry');assert.equal(a.state,'On lift');return a;
});
test('no-altitude geometry fallback',()=>{
  const ps=trace().leg(480,1800,0).ps.map(p=>({...p,alt:null}));
  const a=analyse(ps,{lifts:[[[0,0],[1800/111195,0]]]});assert.equal(a.totals.liftRides,1);assert.equal(a.totals.runs,0);assert.equal(a.totals.vertical,null);return a;
});
test('short stop retains run',()=>{const a=analyse(trace().leg(120,600,-150).leg(90,0,0).leg(120,600,-150).ps);assert.equal(a.totals.runs,1);return a;});
test('stopped state after a minute',()=>{const a=analyse(trace().leg(120,600,-150).leg(90,0,0).ps);assert.equal(a.state,'Stopped');return a;});
test('five-minute stop splits runs',()=>{const a=analyse(trace().leg(120,600,-150).leg(310,0,0).leg(120,600,-150).ps);assert.equal(a.totals.runs,2);return a;});
test('reload gap does not invent distance',()=>{
  const ps=trace().leg(120,600,-150).ps;ps.push({...ps.at(-1),t:900000,lat:0.04,alt:500,breakBefore:true});
  const a=analyse(ps);assert.ok(a.totals.distance<610);assert.equal(a.state,'Stopped');return a;
});
test('invalid fixes and empty trace',()=>{
  assert.equal(acceptPoint({lat:0,lon:0,alt:0,t:0,acc:51}),false);
  assert.equal(acceptPoint({lat:0,lon:0,alt:0,t:0,acc:null}),false);
  assert.equal(analyse([]).totals.runs,0);
  assert.equal(analyse([{lat:0,lon:0,t:0,acc:5,alt:0}]).totals.vertical,0);
  assert.ok(thin(day).length<=day.length);return analyse([]);
});
console.table(rows);
console.log('Car limitation: 110 km/h downhill driving counts as skiing; only jumps above 130 km/h are rejected. Stop tracking before driving.');

// Exercise tracker event handlers against an in-memory DOM/storage, including
// reload recovery and a failed save, without requesting GPS or touching real data.
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const gps=html.slice(html.indexOf('let watchId=null'),html.indexOf('/* =========================================================\n   RUNS'));
const log=html.slice(html.indexOf('function renderLog(){'),html.indexOf('document.getElementById("logadd")'));
function app(storage=new Map()){
  const nodes=new Map(), listeners={};
  function node(id){
    if(!nodes.has(id)) nodes.set(id,{hidden:false,disabled:false,textContent:'',innerHTML:'',children:[],classList:{toggle(){},remove(){}},
      addEventListener(type,fn){this[type]=fn;},appendChild(n){this.children.push(n);},querySelector(){return node(id+' child');},querySelectorAll(){return [];}});
    return nodes.get(id);
  }
  const sandbox={window:{addEventListener(){}},FCTrack:context.window.FCTrack,Date,Number,Math,String,Array,
    document:{getElementById:node,createElement:()=>node('created'+nodes.size),addEventListener(){},querySelector:()=>({click(){}})},
    navigator:{geolocation:{watchPosition(fn){listeners.position=fn;return 1;},clearWatch(){}}},
    localStorage:{removeItem:k=>storage.delete(k)},setInterval:fn=>{listeners.persist=fn;},
    store:{get:(k,f)=>storage.has(k)?JSON.parse(storage.get(k)):f,set:(k,v)=>storage.set(k,JSON.stringify(v))},
    vecData:{},RESORTS:{test:{name:'Test resort'}},resortId:'test',mapReady:false,daylog:[],
    esc:s=>String(s).replace(/[&<>"']/g,'_'),confirm:()=>true,
    // defined outside the sliced sections; tested in test_stats.mjs
    renderSeasonStats(){},shareDayCard(){},renderSOS(){},pisteLines:()=>[],compactPath:()=>[],photoThumbs:()=>'',renderFriends(){}};
  vm.createContext(sandbox);vm.runInContext(gps+'\n'+log,sandbox);
  return {sandbox,node,listeners,run:source=>vm.runInContext(source,sandbox),storage};
}
try {
  const a=app();a.node('trackbtn').click();
  assert.ok(a.storage.has('fc_track_live'));
  const start=Date.now();
  for(const p of trace().leg(120,600,-150).ps) a.listeners.position({coords:{latitude:p.lat,longitude:p.lon,altitude:p.alt,accuracy:p.acc},timestamp:start+p.t});
  a.listeners.persist();
  assert.ok(JSON.parse(a.storage.get('fc_track_live')).points.length>1);
  const b=app(a.storage);b.run('restoreTracking()');
  assert.equal(b.node('trackbtn').disabled,true);assert.equal(b.node('trkresume').disabled,false);
  b.node('trkresume').click();assert.equal(b.run('tracking'),true);
  b.node('trackbtn').click();assert.equal(b.run('tracking'),false);
  const set=b.sandbox.store.set;b.sandbox.store.set=()=>{throw Error('quota');};
  b.node('trksavebtn').click();assert.ok(b.storage.has('fc_track_live'));assert.equal(b.sandbox.daylog.length,0);
  b.sandbox.store.set=set;b.node('trksavebtn').click();
  assert.equal(b.storage.has('fc_track_live'),false);assert.equal(b.sandbox.daylog.length,1);
  assert.equal(b.sandbox.daylog[0].track.totals.runs,1);assert.match(b.sandbox.daylog[0].notes,/Tracked day:/);
  b.sandbox.daylog.push({id:1,date:'2026-01-01',resort:'test',cond:'old',notes:'Old log entry'});
  b.run('renderLog()'); // Older entries need no optional track field.
  const c=app(new Map([['fc_track_live',JSON.stringify({start:Date.now()-86400000,resort:'test',points:[]})]]));
  c.run('restoreTracking()');assert.equal(c.node('trkresume').disabled,true);
  c.node('trkdiscard').click();assert.equal(c.storage.has('fc_track_live'),false);assert.equal(c.node('trackbtn').disabled,false);
  console.log('PASS: UI start/persist/reload/resume/stop, failed-save retention, save cleanup, old logs, stale-session discard.');
} catch(e){console.error('FAIL: UI integration',e);process.exitCode=1;}
