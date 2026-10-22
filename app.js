import {sites,messages} from './data.js';
import {HandController,createModel,clamp} from './hand.js';
import {LightTrail} from './effects.js';
import {initSatellite} from './satellite.js';
initSatellite();
const trail=new LightTrail();
const $=id=>document.getElementById(id),canvas=$('scene'),ctx=canvas.getContext('2d'),stage=$('stage');
let lang=localStorage.getItem('re2-language')==='zh'?'zh':'ko',site=sites[0],progress=0,index=0,phase='observe',phaseElapsed=0,lastFrame=0,active=false,dragging=false,recordChanged=0,lastInput=0;
let handPoint=null,dwell=null,dwellAt=0,dwellFired=false,statusKey='ready',statusExtra='',loadGeneration=0;
const cache=new Map(),visited=new Set(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const options={motion:!reduced.matches,sound:false,preview:true,mirror:true,range:.8};
const tr=v=>typeof v==='string'?v:v?.[lang]||'',t=k=>messages[lang][k]||k;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=r=>r.date.replace('T',' · ')+(r.dateKind==='publication'?(lang==='ko'?' · 자료 공개':' · 资料公开'):''),current=()=>site.records[index];
let audio=null,audioGain=null,checking=false,activity=performance.now();
function setStatus(key,extra='',error=false){statusKey=key;statusExtra=extra;const text=t(key)+(extra?' · '+extra:'');$('status').textContent=text;$('engine').textContent=error?t('engineFail'):hands.active?'HAND / '+hands.delegate:t('local');$('status').classList.toggle('status-error',error);}
function localImage(r){if(cache.has(r.path))return Promise.resolve(cache.get(r.path));return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{cache.set(r.path,im);resolve(im);};im.onerror=()=>reject(Error(r.path));im.src=r.path;});}
function home(){trail.clear();loadGeneration++;active=false;dragging=false;$('home').hidden=false;$('experience').hidden=true;$('handCursor').hidden=!hands.active;setSoundGain(false);if($('dialog').open)$('dialog').close();renderCards();}
function renderCards(){
 $('siteCards').innerHTML=sites.map(s=>`<button class="site-card" data-site="${s.id}"><img src="${s.cover}" alt="${esc(tr(s.name))}"><div class="card-content"><small>${s.tag}${visited.has(s.id)?' / ✓':''}</small><h2>${esc(tr(s.name))}</h2><p>${esc(tr(s.subtitle))}</p></div></button>`).join('');
 document.querySelectorAll('[data-site]').forEach(b=>b.onclick=()=>openSite(b.dataset.site));
}
function language(){
 $('closeDialog').setAttribute('aria-label',t('close'));stage.setAttribute('aria-label',t('stageLabel'));$('timeline').setAttribute('aria-label',t('timelineLabel'));$('video').setAttribute('aria-label',t('cameraPreviewLabel'));document.querySelector('.map-art').setAttribute('aria-label',t('mapLabel'));
 document.documentElement.lang=lang==='ko'?'ko':'zh-CN';document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));$('language').textContent=lang==='ko'?'中文':'한국어';
 renderCards();if(active){renderLabels();renderRecords();}setStatus(statusKey,statusExtra);$('cameraBtn').textContent=t(hands.active?'stop':'camera');
}
async function openSite(id){
 const generation=++loadGeneration;site=sites.find(s=>s.id===id)||sites[0];active=false;$('home').hidden=true;$('experience').hidden=false;$('status').textContent=t('loadingImages');$('scene').style.opacity='.3';
 try{await Promise.all(site.records.map(localImage));if(generation!==loadGeneration)return;active=true;reset();renderRecords();$('scene').style.opacity='1';resize();setStatus(hands.active?'detected':'ready');window.scrollTo({top:0,behavior:'instant'});}catch(e){if(generation===loadGeneration){setStatus('imageError',e.message,true);$('scene').style.opacity='1';}}
}
function reset(){trail.clear();progress=0;index=0;phase='observe';phaseElapsed=0;recordChanged=performance.now();lastInput=recordChanged;$('timeline').value=0;$('completion').hidden=true;setSoundGain(false);renderLabels();}
function input(value){
 if(!active||$('dialog').open)return;
 const now=performance.now();activity=now;if(phase==='observe'&&phaseElapsed<1200)return;
 const p=clamp(value);if(Math.abs(p-progress)>.002)lastInput=now;
 progress=p;$('timeline').value=Math.round(p*1000);
 const next=Math.min(site.records.length-1,Math.floor(p*site.records.length));
 if(next!==index){index=next;recordChanged=now;trail.burst();}
 if(index<site.records.length-1){phase='explore';phaseElapsed=0;$('completion').hidden=true;setSoundGain(false);}
 else if(!['settle','flow'].includes(phase)){phase='settle';phaseElapsed=0;}
 else if(phase==='flow'&&now-lastInput<120){phase='settle';phaseElapsed=0;$('completion').hidden=true;setSoundGain(false);}
 renderLabels();
}
function renderLabels(){
 if($('stageNext'))$('stageNext').textContent=site===sites.at(-1)?t('backMap'):t('next');
 const r=current();$('siteNumber').textContent=site.tag;$('siteName').textContent=tr(site.name);$('year').textContent=r.date.slice(0,4);$('period').textContent=r.date.slice(5,10).replace('-','.');$('event').textContent=tr(r.title);$('hint').textContent=t('hint');$('firstDate').textContent=date(site.records[0]);$('lastDate').textContent=date(site.records.at(-1));$('currentDate').textContent=date(r);$('sequenceStatus').textContent=t(phase);$('recordCredit').textContent=`${r.credit} / ${r.license} · ${tr(r.dateBasis)}`;$('evidenceNote').textContent=tr(site.note);$('completionTitle').textContent=tr(site.title);$('completionCopy').textContent=tr(site.copy);$('nextBtn').textContent=site===sites.at(-1)?t('backMap'):t('next');
 if(r.dateKind==='publication')$('period').textContent+=(lang==='ko'?' · 공개':' · 资料公开');
 document.querySelectorAll('[data-record]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.record===index)));
}
function renderRecords(){
 $('recordDots').innerHTML=site.records.map((r,i)=>`<button data-record="${i}" aria-pressed="${i===index}" title="${esc(tr(r.title))}">${esc(date(r))}</button>`).join('');
 $('recordDots').querySelectorAll('button').forEach(b=>b.onclick=()=>{phaseElapsed=Math.max(1200,phaseElapsed);input(+b.dataset.record/(site.records.length-1));});
}
function resize(){const r=stage.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);}
new ResizeObserver(resize).observe(stage);
function fit(im){const w=canvas.width,h=canvas.height,s=Math.max(w/im.width,h/im.height);return {x:(w-im.width*s)/2,y:(h-im.height*s)/2,w:im.width*s,h:im.height*s};}
function path(poly,r){ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(r.x+x*r.w,r.y+y*r.h):ctx.moveTo(r.x+x*r.w,r.y+y*r.h));ctx.closePath();}
function motion(im,r,now){
 const fade=Math.min(1,phaseElapsed/1800),scale=canvas.width/stage.clientWidth;
 for(const poly of current().water){
  ctx.save();path(poly,r);ctx.clip();ctx.globalAlpha=fade;
  for(let y=0;y<r.h;y+=3){const sy=y/r.h*im.height,sh=Math.min(3,r.h-y);const dx=(Math.sin(y*.045-now*.0013)+Math.sin(y*.017+now*.0007))*scale*1.5;ctx.drawImage(im,0,sy,im.width,sh/r.h*im.height,r.x+dx,r.y+y,r.w,sh+.3);}
  ctx.globalCompositeOperation='screen';
  for(let j=0;j<40;j++){const x=(Math.sin(j*72.1)*.5+.5)*r.w+r.x,y=(.4+(j*.137% .6))*r.h+r.y;ctx.globalAlpha=Math.max(0,Math.sin(now*.0012+j*2.7))*.12*fade;ctx.fillStyle='#d4fff0';ctx.fillRect(x+Math.sin(now*.001+j)*4*scale,y,3*scale,scale);}
  ctx.shadowBlur=0;ctx.strokeStyle='#c9fff0';ctx.lineWidth=scale*.75;
  for(let j=0;j<12;j++){const x=r.x+(j*.173%1)*r.w,y=r.y+(.25+j*.061% .7)*r.h,life=(now*.00012+j*.137)%1;ctx.globalAlpha=(1-life)*.13*fade;ctx.beginPath();ctx.ellipse(x,y,8*scale+life*42*scale,2*scale+life*9*scale,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 }
 for(const poly of current().reeds){ctx.save();path(poly,r);ctx.clip();ctx.globalAlpha=fade;for(let y=0;y<r.h;y+=2){const dx=Math.sin(now*.0012+y*.016)*scale*3;ctx.drawImage(im,0,y/r.h*im.height,im.width,Math.min(2,r.h-y)/r.h*im.height,r.x+dx,r.y+y,r.w,2.3);}ctx.restore();}
}
function draw(now){
 requestAnimationFrame(draw);const dt=Math.min(80,now-lastFrame||16);lastFrame=now;
 if(!active||document.hidden)return;
 if(now-activity>90000){home();return;}
 if(!$('dialog').open){phaseElapsed+=dt;if(phase==='observe'&&phaseElapsed>=1200){phase='explore';phaseElapsed=0;renderLabels();}if(phase==='settle'&&phaseElapsed>=1500&&now-lastInput>=900){phase='flow';phaseElapsed=0;trail.clear();visited.add(site.id);$('completion').hidden=false;renderLabels();setSoundGain(true);}}
 const im=cache.get(current().path);if(!im)return;
 ctx.fillStyle='#071018';ctx.fillRect(0,0,canvas.width,canvas.height);const r=fit(im);ctx.save();ctx.globalAlpha=reduced.matches?1:Math.min(1,.3+(now-recordChanged)/450);ctx.drawImage(im,r.x,r.y,r.w,r.h);ctx.restore();
 if(phase==='flow'&&options.motion&&!reduced.matches&&!$('dialog').open)motion(im,r,now);
 const shade=ctx.createLinearGradient(0,0,0,canvas.height);shade.addColorStop(0,'#00101988');shade.addColorStop(.25,'#00101900');shade.addColorStop(.75,'#00101900');shade.addColorStop(1,'#00101999');ctx.fillStyle=shade;ctx.fillRect(0,0,canvas.width,canvas.height);
 trail.draw(ctx,canvas.width,canvas.height,dt,options.motion&&!reduced.matches&&!$('dialog').open&&phase!=='flow');
 $('motionBadge').hidden=phase!=='flow'||!options.motion||reduced.matches;$('sweep').hidden=phase==='flow'||phase==='settle'||phase==='observe';$('sweep').style.left=progress*100+'%';
}
function pointer(e){const r=stage.getBoundingClientRect();phaseElapsed=Math.max(1200,phaseElapsed);trail.emit(clamp((e.clientX-r.left)/r.width),clamp((e.clientY-r.top)/r.height),performance.now());input((e.clientX-r.left)/r.width);}
stage.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;dragging=true;stage.setPointerCapture(e.pointerId);pointer(e);});stage.addEventListener('pointermove',e=>{if(dragging)pointer(e);});stage.addEventListener('pointerup',()=>dragging=false);stage.addEventListener('pointercancel',()=>dragging=false);
$('timeline').oninput=e=>{phaseElapsed=Math.max(1200,phaseElapsed);input(+e.target.value/1000);};
function onHand(p){
 handPoint=p;$('handDot').hidden=!p||!active;$('handCursor').hidden=!p;if(p)activity=performance.now();
 if(!p){dwell=null;$('skeleton').hidden=true;return;}
 const box=active&&!$('dialog').open?stage.getBoundingClientRect():{x:0,y:0,width:innerWidth,height:innerHeight};
 const x=box.x+p.x*box.width,y=box.y+p.y*box.height;$('handCursor').style.left=x+'px';$('handCursor').style.top=y+'px';$('handDot').style.left=p.x*100+'%';$('handDot').style.top=p.y*100+'%';
 if(options.preview&&active){const sk=$('skeleton');sk.hidden=false;sk.width=290;sk.height=218;const c=sk.getContext('2d');c.clearRect(0,0,290,218);c.strokeStyle='#a9f2d8';c.lineWidth=2;for(const finger of [[0,1,2,3,4],[0,5,6,7,8],[0,9,10,11,12],[0,13,14,15,16],[0,17,18,19,20]]){c.beginPath();finger.forEach((i,j)=>{const q=p.points[i],px=(options.mirror?1-q.x:q.x)*290,py=q.y*218;j?c.lineTo(px,py):c.moveTo(px,py);});c.stroke();}}
 const hit=document.elementFromPoint(x,y)?.closest('button');
 if(hit&&!hit.disabled){const now=performance.now();if(dwell!==hit){dwell=hit;dwellAt=now;dwellFired=false;}const ratio=clamp((now-dwellAt)/1200);$('handCursor').style.setProperty('--dwell',ratio);if(ratio===1&&!dwellFired){dwellFired=true;hit.click();}}
 else{dwell=null;$('handCursor').style.setProperty('--dwell',0);if(active&&!$('dialog').open&&phase!=='observe'){trail.emit(p.x,p.y,performance.now());input(p.x);}}
}
const hands=new HandController({video:$('video'),onPoint:onHand,onStatus:(key,extra)=>setStatus(key,extra),onActive:(yes,delegate)=>{$('cameraBtn').disabled=false;$('cameraBtn').textContent=t(yes?'stop':'camera');$('video').classList.toggle('show',yes&&options.preview&&active);$('engine').textContent=yes?'HAND / '+delegate:t('local');if(!yes)$('skeleton').hidden=true;},onError:e=>{const key=e.code==='secure'?'secure':({NotAllowedError:'denied',NotFoundError:'noCamera',NotReadableError:'busyCamera'}[e.name]||'cameraOther');setStatus(key,e.code==='secure'?'':String(e.message).slice(0,160),true);}});
async function toggleCamera(){if(checking)return;if(hands.active||hands.loading){hands.stop();return;}$('cameraBtn').disabled=true;await hands.start();}
async function checkModel(){
 if(hands.active||hands.loading){setStatus('detected');return;}
 checking=true;$('checkBtn').disabled=$('cameraBtn').disabled=true;setStatus('checking');let model;
 try{const result=await createModel(d=>{$('engine').textContent='MODEL / '+d;});model=result.instance;const sample=document.createElement('canvas');sample.width=sample.height=256;sample.getContext('2d').fillRect(0,0,256,256);model.detectForVideo(sample,performance.now());setStatus('engineOK',result.delegate);$('engine').textContent='MODEL OK / '+result.delegate;}catch(e){setStatus('engineFail',String(e.message).slice(0,180),true);}finally{model?.close();checking=false;$('checkBtn').disabled=$('cameraBtn').disabled=false;}
}
function showDialog(html){$('dialogContent').innerHTML=html;$('dialog').showModal();setSoundGain(false);}
function sources(){showDialog(`<p class="eyebrow">PHOTO ARCHIVE / ${site.tag}</p><h2>${esc(t('credits'))}</h2><p>${esc(tr(site.note))}</p><div class="archive-grid">${site.records.map(r=>`<article class="record"><img src="${r.path}" alt="${esc(tr(r.title))}"><h3>${esc(date(r))}</h3><p>${esc(tr(r.title))}<br>${esc(r.credit)}<br>${esc(r.license)}<br>${esc(tr(r.dateBasis))}</p><a href="${r.source}" target="_blank" rel="noopener">${esc(t('sources'))} ↗</a>${r.licenseUrl?` · <a href="${r.licenseUrl}" target="_blank" rel="noopener">LICENSE ↗</a>`:''}</article>`).join('')}</div><p><a href="${site.history}" target="_blank" rel="noopener">${esc(tr(site.name))} / SOURCE ↗</a></p>`);}
function compare(){const pair=[site.records[0],site.records.at(-1)];showDialog(`<h2>${esc(t('comparisonTitle'))}</h2><p>${esc(tr(site.note))}</p><div class="comparison">${pair.map(r=>`<article><img src="${r.path}" alt="${esc(tr(r.title))}"><h3>${esc(date(r))}</h3><p>${esc(tr(r.title))}<br>${esc(r.credit)} / ${esc(r.license)}</p><a href="${r.source}" target="_blank" rel="noopener">SOURCE ↗</a></article>`).join('')}</div>`);}
function settings(){showDialog(`<h2>${esc(t('settingsTitle'))}</h2><p>${esc(t('privacy'))}</p>${['motion','sound','preview','mirror'].map(k=>`<label class="settings-row"><span>${esc(t(k))}</span><input type="checkbox" data-setting="${k}" ${options[k]?'checked':''} ${k==='motion'&&reduced.matches?'disabled':''}></label>`).join('')}<label class="settings-row"><span>${esc(t('sensitivity'))}</span><select id="rangeSetting"><option value="1">100%</option><option value="0.8">80%</option><option value="0.6">60%</option></select></label><p>${esc(t('checkHint'))}</p>`);$('rangeSetting').value=options.range;document.querySelectorAll('[data-setting]').forEach(el=>el.onchange=async()=>{options[el.dataset.setting]=el.checked;hands.mirror=options.mirror;$('video').style.transform=options.mirror?'scaleX(-1)':'none';$('video').classList.toggle('show',hands.active&&active&&options.preview);if(!options.preview)$('skeleton').hidden=true;if(el.dataset.setting==='sound')await enableSound();});$('rangeSetting').onchange=e=>{options.range=+e.target.value;hands.range=options.range;};}
async function enableSound(){if(options.sound&&!audio){audio=new AudioContext();audioGain=audio.createGain();audioGain.gain.value=0;const buffer=audio.createBuffer(1,audio.sampleRate*4,audio.sampleRate),data=buffer.getChannelData(0);let prev=0;for(let i=0;i<data.length;i++){prev=(prev+.022*(Math.random()*2-1))/1.022;data[i]=prev;}const src=audio.createBufferSource();src.buffer=buffer;src.loop=true;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=550;src.connect(filter).connect(audioGain).connect(audio.destination);src.start();}if(audio)await audio.resume();setSoundGain(active&&phase==='flow'&&!$('dialog').open);}
function setSoundGain(yes){if(audioGain)audioGain.gain.setTargetAtTime((yes&&options.sound)?0.18:0,audio.currentTime,.8);}
function save(){const im=cache.get(current().path);if(!im)return;const out=document.createElement('canvas');out.width=1920;out.height=1200;const c=out.getContext('2d');c.fillStyle='#08141a';c.fillRect(0,0,out.width,out.height);const s=Math.min(1800/im.width,900/im.height);c.drawImage(im,(1920-im.width*s)/2,40,im.width*s,im.height*s);c.fillStyle='#d7f3e4';c.font='26px sans-serif';c.fillText(`RE:ANSAN / ${tr(site.name)} / ${date(current())}`,60,1010);c.font='17px sans-serif';c.fillStyle='#a7c8bd';const r=current();c.fillText(`${r.credit} / ${r.license}`,60,1050);c.font='12px sans-serif';c.fillText(r.source,60,1090);c.fillText(r.licenseUrl||t('local'),60,1120);c.fillText(tr(site.note).slice(0,135),60,1160);out.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`RE-ANSAN-${site.id}-${r.id}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);setStatus('photoSaved');});}
$('language').onclick=()=>{lang=lang==='ko'?'zh':'ko';localStorage.setItem('re2-language',lang);if($('dialog').open)$('dialog').close();language();};$('start').onclick=()=>openSite('lake');$('homeBtn').onclick=home;$('brand').onclick=e=>{e.preventDefault();home();};$('mapReturn').onclick=home;$('reset').onclick=reset;$('cameraBtn').onclick=toggleCamera;$('nextBtn').onclick=()=>{const next=sites[sites.indexOf(site)+1];next?openSite(next.id):home();};$('sourcesBtn').onclick=sources;$('compareBtn').onclick=compare;$('saveBtn').onclick=save;$('settingsBtn').onclick=settings;$('aboutBtn').onclick=()=>showDialog(`<p class="eyebrow">PUBLIC INTERACTIVE VIDEO</p><h2>${esc(t('aboutTitle'))}</h2><p>${esc(t('aboutCopy'))}</p><p>${esc(t('privacy'))}</p>`);$('checkBtn').onclick=checkModel;$('closeDialog').onclick=()=>$('dialog').close();$('dialog').addEventListener('close',()=>setSoundGain(active&&phase==='flow'));$('fullscreen').onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen();}catch(e){setStatus('cameraOther',e.message);}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('dialog').open)home();if(e.key.toLowerCase()==='r'&&active&&!$('dialog').open)reset();});window.addEventListener('pagehide',()=>hands.stop(false));document.addEventListener('visibilitychange',()=>{if(document.hidden){setSoundGain(false);onHand(null);}else setSoundGain(active&&phase==='flow'&&!$('dialog').open);});
const stageHome=document.createElement('button');stageHome.id='stageHome';stageHome.className='glass';stageHome.dataset.i18n='backMap';stageHome.onclick=home;$('sourcesBtn').before(stageHome);
const stageNext=document.createElement('button');stageNext.className='glass';stageNext.id='stageNext';stageNext.dataset.i18n='next';stageNext.onclick=()=>$('nextBtn').click();document.querySelector('.scene-foot').append(stageNext);
for(const event of ['pointerdown','pointermove','keydown','touchstart'])document.addEventListener(event,()=>activity=performance.now(),{passive:true});
language();home();requestAnimationFrame(draw);
