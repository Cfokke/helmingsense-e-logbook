#!/usr/bin/env node
/**
 * Helmingsense – STW from CSV + GRIB Currents (wgrib2)
 * Compact CLI with extras added to original name:
 *   - --start YYYY-MM-DDTHH:MMZ (UTC) to shift track start (optional)
 *   - hourly CSV gains max_neighbor_offset_nm column
 *   - QA summary file alongside outputs (<base>-summary.txt)
 *
 * Usage (unchanged core flags):
 *   bin/stw_from_csv.cjs --csv /path/track.csv [--grib path.grb2] [--out dir] [--slices] [--start YYYY-MM-DDTHH:MMZ]
 *
 * CSV (semicolon-delimited) headers (required):
 *   Date;Latitude(Degree);Longitude(Degree);SOG(Knot);COG(Degree)
 * Date format: DD/MM/YYYY HH:MM[:SS] (UTC).
 *
 * GRIB: currents with UOGRD/VOGRD (m/s), lon 0..360, vt=YYYYMMDDHH times.
 * wgrib2: from $WGRIB2 or /home/chris/miniforge3/envs/gribtools/bin/wgrib2
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/* ---- Config ---- */
const REQUIRED = ["Date","Latitude(Degree)","Longitude(Degree)","SOG(Knot)","COG(Degree)"];
const DELIM = ";";
const U_PARAM=":UOGRD:", V_PARAM=":VOGRD:";
const UNDEF = 9.999e20;
const MAX_GAP_MIN = 20;
const RESAMPLE_MIN = 10;
const NATIVE_OK_MAX = 15;
const MAX_NEI_STEPS = 2;        // ± grid steps for coastal fallback
const CONF_OFFSET_NM = 3.0;     // >3 nm fallback -> MEDIUM
const DEC = 2;

/* ---- Utils ---- */
const fail = m => { console.error("FATAL:", m); process.exit(1); };
const toFixed = (v,n=DEC) => Number.isFinite(v) ? Number(v).toFixed(n) : "";
const deg2rad = d => d*Math.PI/180, rad2deg = r => r*180/Math.PI;
const norm360 = d => { let x=d%360; if(x<0) x+=360; return x; };
const ms2kn = ms => ms*1.943844, km2nm = km => km*0.539956803;
const minutesBetween = (a,b) => Math.abs((b.getTime()-a.getTime())/60000);
const toLon360 = lon => lon<0?lon+360:lon;
const hourKey = d => d.toISOString().slice(0,13)+":00Z";
function gcDistKmBrg(lat1,lon1,lat2,lon2){
  const R=6371,φ1=deg2rad(lat1),φ2=deg2rad(lat2),dφ=deg2rad(lat2-lat1),dλ=deg2rad(lon2-lon1);
  const a=Math.sin(dφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  const y=Math.sin(dλ)*Math.cos(φ2), x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(dλ);
  return { km:R*c, brg:norm360(rad2deg(Math.atan2(y,x))) };
}
const vecFromSpDir = (kn,deg)=>{const t=deg2rad(deg);return{ve:kn*Math.sin(t),vn:kn*Math.cos(t)}};
const spDirFromVec = (ve,vn)=>{const sp=Math.hypot(ve,vn);return{sp,dir:norm360(rad2deg(Math.atan2(ve,vn)))}};

/* ---- CSV ---- */
function parseTZDateUTC(s){
  const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
  if(!m) return null;
  const iso=`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]||"00"}Z`;
  const d=new Date(iso); return isNaN(d)?null:d;
}
function readCsv(file){
  if(!fs.existsSync(file)) fail("CSV not found: "+file);
  const raw=fs.readFileSync(file,'utf8').replace(/\r/g,'');
  const lines=raw.split('\n').filter(l=>l.trim().length>0);
  if(lines.length<2) fail("CSV has no data");
  const header=lines[0].split(DELIM).map(x=>x.trim());
  for(const h of REQUIRED) if(!header.includes(h)) fail("CSV missing column: "+h);
  const idx=Object.fromEntries(header.map((h,i)=>[h,i]));
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const p=lines[i].split(DELIM); if(p.length<header.length) continue;
    const t=parseTZDateUTC(p[idx["Date"]].trim()); if(!t) fail("Bad Date row "+(i+1));
    const lat=Number(p[idx["Latitude(Degree)"]]);
    const lon=Number(p[idx["Longitude(Degree)"]]);
    const sog=Number(p[idx["SOG(Knot)"]]);
    const cog=Number(p[idx["COG(Degree)"]]);
    if(![lat,lon,sog,cog].every(Number.isFinite)) fail("Non-numeric row "+(i+1));
    rows.push({t,lat,lon,sog,cog});
  }
  for(let i=1;i<rows.length;i++){ if(rows[i].t<=rows[i-1].t) fail("Non-monotonic timestamps"); }
  return rows;
}

/* ---- wgrib2 ---- */
function wgrib2Path(){ return process.env.WGRIB2 || "/home/chris/miniforge3/envs/gribtools/bin/wgrib2"; }
function runWgrib2(args){
  const r=spawnSync(wgrib2Path(),args,{encoding:'utf8'});
  if(r.error) fail("wgrib2 failed: "+r.error.message);
  if(r.status!==0) fail("wgrib2 exit "+r.status+": "+(r.stderr||""));
  return r.stdout;
}
const vtToken = d => `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}${String(d.getUTCHours()).padStart(2,'0')}`;
function sampleUV(grib,t,lat,lon360,param){
  const out=runWgrib2([grib,"-match",`vt=${vtToken(t)}`,"-match",param,"-lon",String(lon360),String(lat)]);
  const m=out.match(/val=([0-9.eE+-]+)/); return m?Number(m[1]):UNDEF;
}
function searchWater(grib,t,lat,lon360,latStep=0.027779,lonStep=0.027779){
  let u=sampleUV(grib,t,lat,lon360,U_PARAM), v=sampleUV(grib,t,lat,lon360,V_PARAM);
  if(u!==UNDEF && v!==UNDEF) return {u,v,offsetNm:0};
  for(let s=1;s<=MAX_NEI_STEPS;s++){
    for(let dy=-s;dy<=s;dy++){
      for(let dx=-s;dx<=s;dx++){
        if(dx===0 && dy===0) continue;
        const plat=lat+dy*latStep, plon=lon360+dx*lonStep;
        u=sampleUV(grib,t,plat,plon,U_PARAM); v=sampleUV(grib,t,plat,plon,V_PARAM);
        if(u!==UNDEF && v!==UNDEF){
          const {km}=gcDistKmBrg(lat, lon360>180?lon360-360:lon360, plat, plon>180?plon-360:plon);
          return {u,v,offsetNm:km2nm(km)};
        }
      }
    }
  }
  return {u:UNDEF,v:UNDEF,offsetNm:Infinity};
}

/* ---- Resampling ---- */
function gcStep(lat,lon,brg,distKm){
  const R=6371, δ=distKm/R, θ=deg2rad(brg), φ1=deg2rad(lat), λ1=deg2rad(lon);
  const sinφ1=Math.sin(φ1), cosφ1=Math.cos(φ1), sinδ=Math.sin(δ), cosδ=Math.cos(δ);
  const sinφ2=sinφ1*cosδ + cosφ1*sinδ*Math.cos(θ);
  const φ2=Math.asin(sinφ2);
  const y=Math.sin(θ)*sinδ*cosφ1, x=cosδ - sinφ1*sinφ2;
  const λ2=λ1+Math.atan2(y,x);
  return { lat: rad2deg(φ2), lon: rad2deg(λ2) };
}
function buildSlices(rows){
  const ivals=[]; for(let i=1;i<rows.length;i++) ivals.push(minutesBetween(rows[i-1].t,rows[i].t));
  ivals.sort((a,b)=>a-b); const med=ivals[Math.floor(ivals.length/2)]||0;
  if(med && med<=NATIVE_OK_MAX) return rows.map(r=>({...r}));
  const out=[];
  for(let i=0;i<rows.length-1;i++){
    const a=rows[i], b=rows[i+1];
    const total=minutesBetween(a.t,b.t); const steps=Math.max(1,Math.floor(total/RESAMPLE_MIN));
    const {km,brg}=gcDistKmBrg(a.lat,a.lon,b.lat,b.lon); const kmStep=km/steps;
    for(let s=0;s<steps;s++){
      const t=new Date(a.t.getTime()+s*RESAMPLE_MIN*60000);
      const frac=(s*RESAMPLE_MIN)/total;
      const p=gcStep(a.lat,a.lon,brg,kmStep*s);
      const sog=a.sog+(b.sog-a.sog)*frac, cog=a.cog+(b.cog-a.cog)*frac;
      out.push({t,lat:p.lat,lon:p.lon,sog,cog});
    }
  }
  out.push(rows[rows.length-1]);
  return out;
}

/* ---- Aggregation ---- */
function aggregateHourly(slices){
  const bins=new Map();
  for(const s of slices){
    const k=hourKey(s.t);
    if(!bins.has(k)) bins.set(k,[]);
    bins.get(k).push(s);
  }
  const out=[];
  for(const [ts,arr] of bins){
    arr.sort((a,b)=>a.t-b.t);
    const cov=minutesBetween(arr[0].t,arr[arr.length-1].t);
    if(cov<MAX_GAP_MIN){ out.push({ts,confidence:"GAP",maxOffNm:""}); continue; }
    // equal-weight vec avg
    let curVe=0,curVn=0,stwVe=0,stwVn=0,sogVe=0,sogVn=0,off=0;
    for(const s of arr){
      const cv=vecFromSpDir(s.curKn,s.curDir), sv=vecFromSpDir(s.stwKn,s.stwDir), gv=vecFromSpDir(s.sog,s.cog);
      curVe+=cv.ve; curVn+=cv.vn; stwVe+=sv.ve; stwVn+=sv.vn; sogVe+=gv.ve; sogVn+=gv.vn;
      off=Math.max(off,s.neiOff||0);
    }
    const n=arr.length; curVe/=n;curVn/=n;stwVe/=n;stwVn/=n;sogVe/=n;sogVn/=n;
    const cur=spDirFromVec(curVe,curVn), stw=spDirFromVec(stwVe,stwVn), sog=spDirFromVec(sogVe,sogVn);
    let conf="HIGH"; if(off>CONF_OFFSET_NM) conf="MEDIUM";
    const last=arr[arr.length-1];
    out.push({ts,lat:last.lat,lon:last.lon,sog:sog.sp,cog:sog.dir,curKn:cur.sp,curDir:cur.dir,stwKn:stw.sp,stwDir:stw.dir,confidence:conf,maxOffNm:off});
  }
  out.sort((a,b)=>a.ts.localeCompare(b.ts));
  return out;
}

/* ---- Main ---- */
function main(){
  const opts=parseArgs();
  let rows=readCsv(opts.csv);

  // Optional time shift (--start)
  if(opts.start){
    const delta=opts.start.getTime()-rows[0].t.getTime();
    rows = rows.map(r=>({...r,t:new Date(r.t.getTime()+delta)}));
  }

  const slices=buildSlices(rows);

  // Current sampling & STW per slice
  const outSlices=[];
  for(const s of slices){
    const lon360=toLon360(s.lon);
    const sw=searchWater(opts.grib,s.t,s.lat,lon360);
    if(sw.u===UNDEF||sw.v===UNDEF) continue; // skip if not found
    const curKn=ms2kn(Math.hypot(sw.u,sw.v));
    const curDir=norm360(rad2deg(Math.atan2(sw.u,sw.v)));
    const sogV=vecFromSpDir(s.sog,s.cog);
    const curV=vecFromSpDir(curKn,curDir);
    const stwV={ ve:sogV.ve-curV.ve, vn:sogV.vn-curV.vn };
    const stw=spDirFromVec(stwV.ve,stwV.vn);
    outSlices.push({...s,curKn,curDir,stwKn:stw.sp,stwDir:stw.dir,neiOff:sw.offsetNm});
  }

  const hourly=aggregateHourly(outSlices);

  // Write files
  fs.mkdirSync(opts.outDir,{recursive:true});
  const base=path.basename(opts.csv).replace(/\.[^.]+$/,"");
  const hourlyPath=path.join(opts.outDir,`${base}-hourly.csv`);
  const slicePath =path.join(opts.outDir,`${base}-slices.csv`);
  const summaryPath=path.join(opts.outDir,`${base}-summary.txt`);

  fs.writeFileSync(hourlyPath,[
    "timestamp_utc,lat,lon,sog_kn,cog_deg,current_kn,current_dir_deg,stw_kn,stw_dir_deg,confidence,max_neighbor_offset_nm",
    ...hourly.map(h=>[h.ts, toFixed(h.lat,5), toFixed(h.lon,5), toFixed(h.sog), toFixed(h.cog,0), toFixed(h.curKn), toFixed(h.curDir,0), toFixed(h.stwKn), toFixed(h.stwDir,0), h.confidence, toFixed(h.maxOffNm,2)].join(","))
  ].join("\n")+"\n","utf8");

  if(opts.slices){
    fs.writeFileSync(slicePath,[
      "timestamp_utc,lat,lon,sog_kn,cog_deg,current_kn,current_dir_deg,stw_kn,stw_dir_deg,neighbor_offset_nm",
      ...outSlices.map(s=>[s.t.toISOString(), toFixed(s.lat,5), toFixed(s.lon,5), toFixed(s.sog), toFixed(s.cog,0), toFixed(s.curKn), toFixed(s.curDir,0), toFixed(s.stwKn), toFixed(s.stwDir,0), toFixed(s.neiOff,2)].join(","))
    ].join("\n")+"\n","utf8");
  }

  // QA summary
  const hoursTotal = hourly.length;
  const gapCount = hourly.filter(h=>h.confidence==="GAP").length;
  const medCur = median(hourly.filter(h=>h.confidence!=="GAP").map(h=>h.curKn));
  const maxOff = Math.max(0,...hourly.filter(h=>h.maxOffNm!=="").map(h=>h.maxOffNm));
  fs.writeFileSync(summaryPath,
    `Helmingsense STW summary\n`+
    `Source CSV: ${opts.csv}\nGRIB: ${opts.grib}\n\n`+
    `Hours total: ${hoursTotal}\nHours GAP:   ${gapCount}\n`+
    `Median current (kn): ${toFixed(medCur)}\nMax neighbor offset (nm): ${toFixed(maxOff,2)}\n`,
    "utf8"
  );

  console.log("OK");
  console.log("Hourly :", hourlyPath);
  if(opts.slices) console.log("Slices :", slicePath);
  console.log("Summary:", summaryPath);
}

function median(arr){
  if(!arr || arr.length===0) return NaN;
  const a=arr.slice().sort((x,y)=>x-y);
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}

/* ---- CLI ---- */
function parseArgs(){
  const a=process.argv.slice(2);
  let csv=null, grib="data/grib_currents/current.grb2", outDir="data/derived/stw", slices=false, start=null;
  for(let i=0;i<a.length;i++){
    if(a[i]==="--csv" && a[i+1]){csv=a[++i]; continue;}
    if(a[i]==="--grib" && a[i+1]){grib=a[++i]; continue;}
    if(a[i]==="--out" && a[i+1]){outDir=a[++i]; continue;}
    if(a[i]==="--slices"){slices=true; continue;}
    if(a[i]==="--start" && a[i+1]){ start=parseStart(a[++i]); continue; }
  }
  if(!csv) fail("Missing --csv <file>");
  return {csv,grib,outDir,slices,start};
}
function parseStart(s){
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})Z$/);
  if(!m) fail("--start must be YYYY-MM-DDTHH:MMZ (UTC)");
  const d=new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`);
  if(isNaN(d)) fail("Invalid --start value");
  return d;
}

if (require.main === module) {
  try { main(); } catch(e){ fail(e && e.message ? e.message : String(e)); }
}
