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
  window.FCTrack={analyse,distance,acceptPoint,thin};
}());
