import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {sites,messages} from './data.js';
import {palmPoint,clamp} from './hand.js';
import {LightTrail} from './effects.js';
import {satellite,mapPoint} from './satellite.js';
assert(existsSync(new URL(satellite.path,import.meta.url)),'卫星底图必须本地保存');
assert.equal(satellite.date,'2026-10-06');
for(const p of satellite.places){const q=mapPoint(p.lon,p.lat);assert(q.x>0&&q.x<100&&q.y>0&&q.y<100,'地图地点必须在影像范围内');}
assert.deepEqual(mapPoint(126.55,37.39),{x:0,y:0});
const trail=new LightTrail();
trail.emit(.1,.5,0);trail.emit(.5,.6,30);
assert(trail.particles.length>0,'移动必须产生粒子');
for(let n=1;n<100;n++)trail.emit(n%2,.5,n*20);
assert(trail.particles.length<=320,'粒子数量必须有上限');
trail.burst();assert.equal(trail.pulse,1);
trail.clear();assert.equal(trail.particles.length,0);assert.equal(trail.previous,null);
const center=Array.from({length:21},()=>({x:.2,y:.6}));
assert(palmPoint(center,true,1).x>.5,'镜像手掌应在画面右侧');
assert(palmPoint(center,false,1).x<.5,'关闭镜像应反转方向');
assert.equal(palmPoint([],true),null);
assert.equal(clamp(-1),0);assert.equal(clamp(2),1);
assert.equal(new Set(sites.map(s=>s.id)).size,3);
assert(sites.every(s=>s.records.length===3),'三个案例均须有三个节点');
assert.deepEqual(sites[2].records.map(r=>r.date.slice(0,4)),['2002','2015','2024']);
assert.equal(sites[1].records[1].dateKind,'publication','湿地2023资料不能冒充拍摄日期');
assert.equal(sites[1].records[2].path,'assets/photos/wetland-2025-06-21.png');
assert(sites[1].records[2].dateBasis.zh.includes('无EXIF'),'到访日不能冒充EXIF拍摄日');
for(const site of sites){
 assert(site.records.length>=2);
 for(let i=0;i<site.records.length;i++){
  const r=site.records[i];assert(existsSync(new URL(r.path,import.meta.url)),r.path);
  assert(/^\d{4}-\d{2}-\d{2}/.test(r.date),r.id);assert(r.source.startsWith('https://'));assert(r.credit&&r.license);
  if(i)assert(site.records[i-1].date<=r.date,'照片日期必须按实际时间排序');
 }
}
assert.deepEqual(Object.keys(messages.ko).sort(),Object.keys(messages.zh).sort(),'中韩文案字段应完整对应');
for(const file of ['vendor/mediapipe/vision_bundle.mjs','vendor/mediapipe/wasm/vision_wasm_internal.js','vendor/mediapipe/wasm/vision_wasm_internal.wasm','vendor/mediapipe/wasm/vision_wasm_nosimd_internal.js','vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm','models/hand_landmarker.task'])assert(existsSync(new URL(file,import.meta.url)),file);
assert(!/https?:\/\//.test(readFileSync(new URL('hand.js',import.meta.url),'utf8')),'手势运行依赖须为本地地址');
console.log('PASS: 三场景素材、日期顺序、双语字段、手掌方向及本地识别依赖完整。');
