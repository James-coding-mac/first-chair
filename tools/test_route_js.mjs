import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(root+'route.js','utf8'),context);
const api=context.FCRoute;
const graph=JSON.parse(fs.readFileSync(root+'data/build/paradiski-graph.json','utf8'));
// Use the exact deterministic destination selection from test_routes.py and its Python router.
const reference=JSON.parse(execFileSync('python3',['-c',`
import sys,json,math
sys.dont_write_bytecode=True
sys.path.insert(0,'tools')
from test_routes import *
graph=json.loads(OUT.read_text())
elements,elevations=load_source()
_,info=build_graph(elements,elevations)
resort=load_resort()
base=nearest_node(graph['nodes'],info['base'])
restaurants=[]
for sector,count in [('LP',3),('LA',2)]:
 restaurants+=spread([i for i in resort['eats'] if i['loc']=='mtn' and i['mtn']==sector],count,info['base'])
lifts=[dict(i,at=graph['nodes'][i['top']]) for i in info['lifts'] if i['sector']=='LA']
targets=[nearest_node(graph['nodes'],i['at']) for i in restaurants]+[i['top'] for i in spread(lifts,5,info['base'])]
results=[]
for grade in [None,'red','blue','green']:
 distances,_=dijkstra(graph,base,grade)
 results.append(dict(grade=grade,times=[distances[t] if math.isfinite(distances[t]) else None for t in targets]))
print(json.dumps(dict(base=base,targets=targets,results=results)))
`],{cwd:root,encoding:'utf8'}));
const router=api.load(graph);
for(const {grade,times} of reference.results){
 let reachable=0;
 reference.targets.forEach((target,i)=>{
  const result=router.route(reference.base,target,{maxGrade:grade});
  assert.equal(result===null,times[i]===null,`reachability: ${grade} destination ${i+1}`);
  if(result){
   reachable++;
   assert.ok(Math.abs(result.time-times[i])<=Math.max(.001,times[i]*.01));
   assert.ok(result.edges.every(id=>graph.grades[graph.edges[id][3]]!=='offpiste'));
   assert.ok(Math.abs(result.edges.reduce((sum,id)=>sum+graph.edges[id][6],0)-result.time)<.001);
  }
 });
 console.log(`Python parity: ${grade||'all'}: ${reachable}/10 reachable; all times within 1%.`);
}
const fixture={nodes:[[0,0],[0,.001],[0,.002],[0,.003]],kinds:['piste','lift','walk'],grades:graph.grades,names:[''],
 edges:[[0,1,0,4,0,1,1,[]],[0,2,0,5,0,1,5,[]],[2,1,0,0,0,1,5,[]],[0,1,0,2,0,1,2,[]]]};
const tiny=api.load(fixture);
assert.equal(tiny.route(0,1,{}).time,2);
assert.equal(tiny.route(0,1,{maxGrade:'green'}).time,10);
assert.equal(tiny.route(1,0,{}),null);
assert.equal(tiny.route(0,3,{}),null);
assert.equal(tiny.route(0,0,{}).time,0);
assert.equal(tiny.nearestNode(0,0,0),0);
assert.equal(tiny.nearestNode(1,1,300),null);
assert.equal(tiny.nearestNode(NaN,0,300),null);
assert.equal(api.nearestNode(0,0,0),0);
assert.equal(api.route(0,1,{maxGrade:'green'}).time,10);
assert.equal(router.route(reference.base,reference.base,{}).time,0,'instances remain isolated');
console.log('PASS: directed paths, off-piste exclusion, unknown grades, snapping, zero-length routes and isolated graphs.');
// Exercise asynchronous UI decisions without GPS, network or a browser dependency.
const html=fs.readFileSync(root+'index.html','utf8');
const uiSource=html.slice(html.indexOf('/* Routing is transient;'),html.indexOf('/* =========================================================\n   WEATHER'));
const elements=new Map();
const el=id=>{
 if(!elements.has(id)) elements.set(id,{hidden:true,textContent:'',innerHTML:'',value:'',addEventListener(){}});
 return elements.get(id);
};
let resolveFetch, requests=0;
const ui=vm.createContext({FCRoute:api,Map,Set,Date,Number,Math,
 store:{get:()=> 'all',set(){}},R:{graphData:'local.json',base:{name:'<base>',at:[0,0]}},
 document:{getElementById:el,querySelector:()=>({click(){}})},mapReady:false,
 esc:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),diffSym:()=> '●',
 // lift/piste status helpers live outside this slice; stub them as "no live status"
 statusFresh:()=>false,routeClosures:()=>({blocked:null,liftAt:{}}),coordKey:(a,b)=>a+','+b,statusData:null,
 fetch:()=>{requests++;return new Promise(r=>{resolveFetch=r;});}});
vm.runInContext(uiSource,ui);
const destination={name:'<destination>',at:[0,.001]};
let pending=ui.takeRoute(destination);
resolveFetch({ok:true,json:async()=>fixture});await pending;
assert.match(el('route-details').innerHTML,/From &lt;base&gt;/);
assert.match(el('route-details').innerHTML,/&lt;destination&gt;/);
assert.match(el('route-details').innerHTML,/Map unavailable/);
vm.runInContext('latestPosition={timestamp:Date.now(),coords:{latitude:0,longitude:.002,accuracy:20}}',ui);
await ui.takeRoute(destination);
assert.match(el('route-details').innerHTML,/From your position/);
assert.equal(requests,1,'graph cached in memory');
vm.runInContext('latestPosition.timestamp-=61000',ui);
await ui.takeRoute(destination);
assert.match(el('route-details').innerHTML,/From &lt;base&gt;/);
vm.runInContext('latestPosition.timestamp=Date.now();latestPosition.coords.accuracy=101',ui);
await ui.takeRoute(destination);
assert.match(el('route-details').innerHTML,/From &lt;base&gt;/);
await ui.takeRoute({name:'distant',at:[1,1]});
assert.match(el('route-details').innerHTML,/no graph node within 300 m/);
await ui.takeRoute({name:'disconnected',at:[0,.003]});
assert.match(el('route-details').innerHTML,/Not connected in the OSM data/);
ui.R.graphData='slow.json';pending=ui.takeRoute(destination);ui.clearRoute();
resolveFetch({ok:true,json:async()=>fixture});await pending;
assert.equal(el('route-result').hidden,true,'clear cancels pending rendering');
ui.R.graphData='missing.json';pending=ui.takeRoute(destination);
resolveFetch({ok:false});await pending;
assert.match(el('route-details').textContent,/Couldn't load offline routing/);
assert.ok(!vm.runInContext("routeCache.has('missing.json')",ui),'failed loads can retry');
console.log('PASS: UI GPS freshness/accuracy, base fallback, escaping, memory cache, missing snaps, connectivity, cancellation and load failure.');
