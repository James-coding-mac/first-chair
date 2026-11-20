/* Offline directed routing. load returns an isolated router; no DOM, network or storage. */
(function(root){
  'use strict';
  class Heap {
    constructor(){ this.items=[]; }
    push(item){
      const a=this.items; let i=a.length; a.push(item);
      while(i){ const p=(i-1)>>1; if(a[p][0]<=item[0]) break; a[i]=a[p]; i=p; }
      a[i]=item;
    }
    pop(){
      const a=this.items, first=a[0], last=a.pop();
      if(a.length){
        let i=0;
        while(i*2+1<a.length){
          let c=i*2+1;
          if(c+1<a.length && a[c+1][0]<a[c][0]) c++;
          if(a[c][0]>=last[0]) break;
          a[i]=a[c]; i=c;
        }
        a[i]=last;
      }
      return first;
    }
  }
  function load(json){
    const {nodes,edges,grades,kinds}=json;
    const adj=nodes.map(()=>[]);
    edges.forEach((e,i)=>adj[e[0]].push(i));
    function nearestNode(lat,lon,maxM=300){
      if(!Number.isFinite(lat)||!Number.isFinite(lon)) return null;
      const rad=Math.PI/180; let best=null, distance=maxM;
      nodes.forEach((n,i)=>{
        const h=Math.sin((n[0]-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(n[0]*rad)*Math.sin((n[1]-lon)*rad/2)**2;
        const d=6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));
        if(d<=distance){distance=d;best=i;}
      });
      return best;
    }
    function route(from,to,{maxGrade=null}={}){
      if(maxGrade==='all') maxGrade=null;
      const ranks=['green','blue','red','black'];
      if(maxGrade!==null && !ranks.includes(maxGrade)) throw new Error('Invalid maximum grade');
      if(!Number.isInteger(from)||!Number.isInteger(to)||!nodes[from]||!nodes[to]) return null;
      const limit=maxGrade===null?3:ranks.indexOf(maxGrade);
      const dist=nodes.map(()=>Infinity), prev=nodes.map(()=>-1), heap=new Heap();
      dist[from]=0; heap.push([0,from]);
      while(heap.items.length){
        const [cost,node]=heap.pop();
        if(cost!==dist[node]) continue;
        if(node===to) break;
        for(const id of adj[node]){
          const e=edges[id], grade=grades[e[3]];
          if(grade==='offpiste') continue;
          if(kinds[e[2]]==='piste' && grade!=='unknown' && (!ranks.includes(grade)||ranks.indexOf(grade)>limit)) continue;
          const next=cost+e[6];
          if(next<dist[e[1]]){dist[e[1]]=next;prev[e[1]]=id;heap.push([next,e[1]]);}
        }
      }
      if(!Number.isFinite(dist[to])) return null;
      const path=[];
      for(let n=to;n!==from;){const id=prev[n];path.push(id);n=edges[id][0];}
      return {edges:path.reverse(),time:dist[to]};
    }
    return {nearestNode,route};
  }
  // Convenience API for the single active graph; load also returns an independent instance.
  let active;
  root.FCRoute={load(json){return active=load(json);},
    nearestNode(...args){return active.nearestNode(...args);},
    route(...args){return active.route(...args);}};
})(typeof window==='undefined'?globalThis:window);
