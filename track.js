/* Foreground GPS day analysis. Metres, milliseconds and km/h throughout.
   No DOM/storage: suitable for the browser and node's vm test runner. */
(function () {
  'use strict';
  const rad = x => x * Math.PI / 180;
  function distance(a, b) {
    const s = Math.sin(rad(b.lat-a.lat)/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;
    return 12742000 * Math.asin(Math.sqrt(Math.min(1, s)));
  }
  function acceptPoint(p, prev) {
    return p && Number.isFinite(p.lat) && Math.abs(p.lat)<=90 && Number.isFinite(p.lon) && Math.abs(p.lon)<=180 &&
      Number.isFinite(p.t) && Number.isFinite(p.acc) && p.acc>=0 && p.acc<=50 &&
      (!prev || (p.t>prev.t && distance(prev,p)/(p.t-prev.t)*3600<=130));
  }
  function thin(points) {
    const result=[];
    for (const p of points) {
      const prev=result[result.length-1];
      if (acceptPoint(p,prev) && (!prev || p.t-prev.t>=5000 || distance(prev,p)>=10)) result.push({...p});
    }
    return result;
  }
  function nearLift(p, lifts) {
    const scale=111195, cos=Math.cos(rad(p.lat));
    for (const line of lifts) for(let i=1;i<line.length;i++) {
      const a=line[i-1], b=line[i];
      const x=(a[1]-p.lon)*scale*cos, y=(a[0]-p.lat)*scale;
      const dx=(b[1]-a[1])*scale*cos, dy=(b[0]-a[0])*scale;
      const u=Math.max(0,Math.min(1,-(x*dx+y*dy)/(dx*dx+dy*dy||1)));
      if(Math.hypot(x+u*dx,y+u*dy)<=40) return true;
    }
    return false;
  }
  function analyse(points, opts={}) {
    const ps=[];
    for(const p of points) if(acceptPoint(p,ps[ps.length-1])) ps.push({...p, alt:Number.isFinite(p.alt)?p.alt:null});
    const hasAltitude=ps.some(p=>p.alt!==null), lifts=opts.lifts||[];
    // Centred 20-second median; never interpolate through missing altitude.
    let left=0, right=0;
    const alt=ps.map(p=>{
      while(ps[left].t<p.t-10000) left++;
      while(right<ps.length && ps[right].t<=p.t+10000) right++;
      if(p.alt===null) return null;
      const values=ps.slice(left,right).map(q=>q.alt).filter(v=>v!==null).sort((a,b)=>a-b);
      const n=values.length;
      return n%2?values[(n-1)/2]:(values[n/2-1]+values[n/2])/2;
    });
    const edges=[];
    let trendLeft=0, trendRight=0;
    for(let i=1;i<ps.length;i++) {
      const dt=(ps[i].t-ps[i-1].t)/1000, d=distance(ps[i-1],ps[i]), speed=d/dt*3.6;
      // Gaps are unknown time, never inferred skiing or lift travel.
      const gap=dt>120 || ps[i].breakBefore===true;
      // Use a 40-second altitude trend so residual median noise does not
      // fragment a chairlift into short ascent bursts. At trace ends, keep
      // the full window on the available side.
      while(ps[trendLeft].t<Math.min(ps[i].t-20000,ps[ps.length-1].t-40000)) trendLeft++;
      trendRight=Math.max(trendRight,i);
      while(trendRight+1<ps.length && ps[trendRight+1].t<=Math.max(ps[i].t+20000,ps[0].t+40000)) trendRight++;
      const span=(ps[trendRight].t-ps[trendLeft].t)/1000;
      const v=alt[i]!==null && alt[i-1]!==null && alt[trendRight]!==null && alt[trendLeft]!==null && span>0
        ?(alt[trendRight]-alt[trendLeft])/span:null;
      edges.push({i,dt,d,speed, gap, near:false, lift:false, stopped:false, candidate:!gap && v!==null && v>0.3 && speed<30});
    }
    // Sustained ascent, with retroactive classification once 60 s is observed.
    for(let a=0;a<edges.length;) {
      if(!edges[a].candidate){a++;continue;}
      let b=a, duration=0;
      while(b<edges.length && edges[b].candidate) duration+=edges[b++].dt;
      if(duration>=60) for(let k=a;k<b;k++) {
        edges[k].lift=true;
        edges[k].near=nearLift(ps[edges[k].i],lifts);
      }
      a=b;
    }
    if(!hasAltitude) for(const e of edges) {
      e.near=!e.gap && e.speed>=2 && e.speed<30 && nearLift(ps[e.i],lifts);
      e.lift=e.near;
    }
    for(let a=0;a<edges.length;) {
      if(edges[a].gap || edges[a].speed>=2){a++;continue;}
      let b=a,duration=0;
      while(b<edges.length && !edges[b].gap && edges[b].speed<2) duration+=edges[b++].dt;
      for(let k=a;k<b;k++) { edges[k].stopped=duration>60; edges[k].longStop=duration>300; }
      a=b;
    }
    const runs=[], rides=[];
    let group=[];
    function finishRun() {
      if(!group.length) return;
      const first=group[0].i-1, last=group[group.length-1].i;
      let peak=null, drop=0;
      for(let i=first;i<=last;i++) {
        if(alt[i]===null){peak=null;continue;}
        peak=peak===null?alt[i]:Math.max(peak,alt[i]);
        drop=Math.max(drop,peak-alt[i]);
      }
      const moving=group.filter(e=>e.speed>=2);
      if((hasAltitude && drop>=30) || (!hasAltitude && moving.length)) {
        const dist=group.reduce((s,e)=>s+e.d,0), duration=ps[last].t-ps[first].t;
        runs.push({start:ps[first].t,end:ps[last].t,vertical:hasAltitude?drop:null,distance:dist,duration,
          topSpeed:Math.max(...group.map(e=>e.speed)),avgSpeed:duration?dist/duration*3600:0});
      }
      group=[];
    }
    let ride=null;
    for(const e of edges) {
      if(e.lift && !e.longStop) {
        finishRun();
        if(!ride){ride={start:ps[e.i-1].t,end:ps[e.i].t,confidence:'ascent'};rides.push(ride);}
        ride.end=ps[e.i].t;
        if(e.near) ride.confidence='geometry';
      } else {
        ride=null;
        if(e.gap || e.longStop) finishRun(); else group.push(e);
      }
    }
    finishRun();
    const last=edges[edges.length-1];
    const totals={runs:runs.length,vertical:hasAltitude?runs.reduce((s,r)=>s+r.vertical,0):null,
      distance:runs.reduce((s,r)=>s+r.distance,0),topSpeed:runs.reduce((s,r)=>Math.max(s,r.topSpeed),0),
      liftRides:rides.length,timeSkiing:runs.reduce((s,r)=>s+r.duration,0)};
    return {totals,runs,lifts:rides,state:!last || last.gap || last.stopped?'Stopped':last.lift?'On lift':'Skiing',
      dropped:points.length-ps.length,hasAltitude};
  }
  /* Which named pistes did each run follow?
     points: raw track points {lat,lon,t}; runs: from analyse(); lines: [{name, coords:[[lat,lon],...]}].
     A piste counts for a run when >= 150 m of the run (sampled every ~20 m) lies within 25 m of it,
     moving along the line (angle < 60 deg, either drawing direction), and those samples are >= 60%
     of the run between the first and last sample on that piste. Returns [[names in order], ...]. */
  function matchPistes(points,runs,lines){
    const CELL=0.001, grid=new Map(), segs=[];
    (lines||[]).forEach(l=>{
      if(!l || !l.name || !Array.isArray(l.coords)) return;
      for(let i=0;i+1<l.coords.length;i++){
        const a=l.coords[i], b=l.coords[i+1], id=segs.length;
        segs.push({a,b,name:l.name});
        const y0=Math.floor(Math.min(a[0],b[0])/CELL)-1, y1=Math.floor(Math.max(a[0],b[0])/CELL)+1;
        const x0=Math.floor(Math.min(a[1],b[1])/CELL)-1, x1=Math.floor(Math.max(a[1],b[1])/CELL)+1;
        for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){const k=y+','+x; if(!grid.has(k)) grid.set(k,[]); grid.get(k).push(id);}
      }
    });
    const bearing=(p,q)=>Math.atan2((q[1]-p[1])*Math.cos(p[0]*Math.PI/180),q[0]-p[0]);
    function nearest(p,dir){
      const ids=grid.get(Math.floor(p[0]/CELL)+','+Math.floor(p[1]/CELL))||[];
      const kx=Math.cos(p[0]*Math.PI/180)*111320, ky=110540;
      let best=null;
      for(const id of ids){
        const s=segs[id];
        const ax=(s.a[1]-p[1])*kx, ay=(s.a[0]-p[0])*ky, bx=(s.b[1]-p[1])*kx, by=(s.b[0]-p[0])*ky;
        const dx=bx-ax, dy=by-ay, L2=dx*dx+dy*dy, t=L2?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/L2)):0;
        const d=Math.hypot(ax+t*dx,ay+t*dy);
        if(d>25 || (best && d>=best.d)) continue;
        let ang=Math.abs(dir-bearing(s.a,s.b))%(2*Math.PI); if(ang>Math.PI) ang=2*Math.PI-ang;
        if(ang>Math.PI/2) ang=Math.PI-ang;            // pistes may be drawn either way
        if(ang<Math.PI/3) best={d,name:s.name};
      }
      return best;
    }
    return (runs||[]).map(run=>{
      const pts=(points||[]).filter(p=>p.t>=run.start && p.t<=run.end && Number.isFinite(p.lat) && Number.isFinite(p.lon));
      const samples=[]; let last=null;
      for(const p of pts){
        if(!last){last=p;continue;}
        const d=distance(last,p);
        if(d<20) continue;
        samples.push({at:[p.lat,p.lon],dir:bearing([last.lat,last.lon],[p.lat,p.lon]),d});
        last=p;
      }
      const hits=samples.map(s=>{const n=nearest(s.at,s.dir);return n?n.name:null;});
      const order=[], stat=new Map();
      hits.forEach((n,i)=>{
        if(!n) return;
        if(!stat.has(n)){stat.set(n,{first:i,last:i,len:0,count:0});order.push(n);}
        const st=stat.get(n); st.last=i; st.len+=samples[i].d; st.count++;
      });
      return order.filter(n=>{const st=stat.get(n);return st.len>=150 && st.count/(st.last-st.first+1)>=0.6;});
    });
  }
  /* Which lift was each ride? rides: from analyse().lifts ({start,end}); lines: [{name, coords:[[lat,lon],...]}].
     The lift whose line most ride points lie within 40 m of (>= 50% of the points) wins. Returns [name|null, ...]. */
  function matchLifts(points,rides,lines){
    const kx=lat=>Math.cos(lat*Math.PI/180)*111320, ky=110540;
    function distTo(p,coords){
      let best=Infinity; const k=kx(p.lat);
      for(let i=0;i+1<coords.length;i++){
        const a=coords[i], b=coords[i+1];
        const ax=(a[1]-p.lon)*k, ay=(a[0]-p.lat)*ky, bx=(b[1]-p.lon)*k, by=(b[0]-p.lat)*ky;
        const dx=bx-ax, dy=by-ay, L2=dx*dx+dy*dy, t=L2?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/L2)):0;
        best=Math.min(best,Math.hypot(ax+t*dx,ay+t*dy));
      }
      return best;
    }
    const named=(lines||[]).filter(l=>l && l.name && Array.isArray(l.coords) && l.coords.length>1);
    return (rides||[]).map(r=>{
      const pts=(points||[]).filter(p=>p.t>=r.start && p.t<=r.end && Number.isFinite(p.lat) && Number.isFinite(p.lon));
      if(!pts.length) return null;
      const sample=pts.filter((p,i)=>i%Math.max(1,Math.floor(pts.length/40))===0);
      // only lines near the ride's middle point are candidates
      const mid=sample[Math.floor(sample.length/2)];
      let best=null, bestN=0;
      for(const l of named){
        if(distTo(mid,l.coords)>300) continue;
        const n=sample.filter(p=>distTo(p,l.coords)<=40).length;
        if(n>bestN){bestN=n;best=l.name;}
      }
      return bestN>=sample.length*0.5?best:null;
    });
  }
  window.FCTrack={analyse,distance,acceptPoint,thin,matchPistes,matchLifts};
}());
