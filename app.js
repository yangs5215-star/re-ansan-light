/* RE:ANSAN: local hand tracking + persistent canvas reveal. No image/video uploads. */
const $=id=>document.getElementById(id);
document.body.classList.add('in-menu');
const canvas=$('scene'),ctx=canvas.getContext('2d');
const past=new Image(),lake=new Image(),wetland=new Image();
let present=lake;
let chapter=0,selectedChapter=0,transitioning=false,chapterStart=0,completionTime=0,lastActivity=performance.now();
let milestone=0,toastUntil=0,dwellTarget=null,dwellStart=0,dwellFired=false;
const particles=[],ripples=[];
let soundEnabled=false,audioCtx=null,audioGain=null;
let secondPoint=null,secondPrevious=null,paused=false,focusEnergy=0,visualLast=null;
const handTracks=new Map();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function brushRadius(p){return Math.max(65,Math.min(width,height)*.12)*(p?.focus ? .43 : 1)*(1+focusEnergy*.2);}
const chapters=[{tag:'WATER / 水的流动',name:'물의 흐름',title:'다시 흐르는 물.',kr:'해수 유통과 수질 개선 사업을 통해 시화호의 수질과 생태환경이 개선되어 왔습니다.',cn:'海水流通与水质改善工程，推动了始华湖的水质改善与生态恢复。',nodes:[['오염의 기록','历史档案：看见环境治理的起点。'],['흐름의 회복','恢复水的流通，是环境改善的重要措施之一。'],['계속되는 노력','环境改善需要长期治理与持续关注。']]},{tag:'WETLAND / 湿地的生命',name:'생명의 자리',title:'생명이 머무는 풍경.',kr:'안산갈대습지는 시화호의 수질 개선을 위해 조성된 인공습지입니다. 물과 식물, 생물이 연결되는 공간을 만나보세요.',cn:'安山芦苇湿地是为改善始华湖水质而建设的人工湿地。水、植物和生物，在这里构成相互联系的生态空间。',nodes:[['물과 식물','湿地植物与水体共同构成生态空间。'],['생물의 보금자리','湿地为多种生物提供栖息环境。'],['함께 지키는 풍경','以日常关注，延续环境恢复的故事。']]}];
const mask=document.createElement('canvas'),mctx=mask.getContext('2d');
const layer=document.createElement('canvas'),lctx=layer.getContext('2d');
let width=0,height=0,mode='idle',point=null,previous=null,handPose=null,stream=null;
let lastHand=0,lastFrame=0,lastMeasure=0,coverage=0,completed=false,active=false,resourcesReady=false;
let cameraGeneration=0,modelPromise=null;
const threshold=.70,gridW=100,gridH=64,visited=new Uint8Array(gridW*gridH);
let revealCount=0;
function loadImage(img,url){return new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error(url));img.src=url;});}
function cover(c,img){const scale=Math.max(width/img.width,height/img.height);c.drawImage(img,(width-img.width*scale)/2,(height-img.height*scale)/2,img.width*scale,img.height*scale);}
function resize(){const saved=document.createElement('canvas');saved.width=mask.width;saved.height=mask.height;if(saved.width)saved.getContext('2d').drawImage(mask,0,0);width=innerWidth;height=innerHeight;for(const c of[canvas,mask,layer]){c.width=width;c.height=height;}if(saved.width)mctx.drawImage(saved,0,0,width,height);previous=null;}
function reset(){mctx.clearRect(0,0,width,height);visited.fill(0);revealCount=0;coverage=0;completed=false;completionTime=0;milestone=0;previous=null;point=null;secondPoint=null;secondPrevious=null;focusEnergy=0;visualLast=null;handTracks.clear();setPaused(false);particles.length=0;ripples.length=0;lastActivity=performance.now();$('result').hidden=true;$('toast').hidden=true;$('percent').textContent='0%';$('bar').style.width='0%';$('phase').textContent=chapter===0?'시화호 · 과거의 기록 / 始华湖历史档案':'갈대습지 · 색을 깨우다 / 唤醒湿地色彩';$('guide').hidden=!active;}
function mark(x,y,r){for(let gy=Math.max(0,Math.floor((y-r)/height*gridH));gy<Math.min(gridH,Math.ceil((y+r)/height*gridH));gy++)for(let gx=Math.max(0,Math.floor((x-r)/width*gridW));gx<Math.min(gridW,Math.ceil((x+r)/width*gridW));gx++){const i=gy*gridW+gx,dx=(gx+.5)/gridW*width-x,dy=(gy+.5)/gridH*height-y;if(!visited[i]&&dx*dx+dy*dy<r*r){visited[i]=1;revealCount++;}}}
function stamp(x,y,r){const g=mctx.createRadialGradient(x,y,r*.72,x,y,r);g.addColorStop(0,'rgba(255,255,255,.98)');g.addColorStop(1,'rgba(255,255,255,0)');mctx.fillStyle=g;mctx.fillRect(x-r,y-r,2*r,2*r);mark(x,y,r*.85);}
function paint(p){const radius=brushRadius(p);if(previous){const d=Math.hypot(p.x-previous.x,p.y-previous.y),steps=Math.min(40,Math.ceil(d/(radius*.25)));for(let s=1;s<=steps;s++)stamp(previous.x+(p.x-previous.x)*s/steps,previous.y+(p.y-previous.y)*s/steps,radius);}else stamp(p.x,p.y,radius);previous={...p};if(particles.length<220&&!reducedMotion)for(let i=0;i<(p.focus?4:2);i++)particles.push({x:p.x,y:p.y,vx:(Math.random()-.5)*1.8,vy:-Math.random()*1.8,life:1,size:Math.random()*2+1});}
function measure(){coverage=revealCount/visited.length;const pct=Math.round(coverage*100);$('percent').textContent=pct+'%';$('bar').style.width=pct+'%';if(milestone<3&&coverage>=[.12,.32,.52][milestone]){const node=chapters[chapter].nodes[milestone];$('toast-no').textContent='0'+(milestone+1);$('toast-title').textContent=node[0];$('toast-copy').textContent=node[1];$('toast').hidden=false;toastUntil=performance.now()+4200;milestone++;chime(220+milestone*110);}if(coverage>=threshold&&!completed){completed=true;completionTime=performance.now();$('result-kicker').textContent='CHAPTER 0'+(chapter+1)+' / REVEALED';$('result-title').textContent=chapters[chapter].title;$('result-kr').textContent=chapters[chapter].kr;$('result-cn').textContent=chapters[chapter].cn;$('next').textContent=chapter===0?'다음 이야기 → / 探索湿地':'장면으로 돌아가기 ↗ / 返回场景';$('result').hidden=false;$('guide').hidden=true;$('toast').hidden=true;$('phase').textContent='회복의 이야기 / 生态恢复的故事';chime(660);}}
function draw(now){requestAnimationFrame(draw);if(!resourcesReady)return;const dt=Math.min(60,now-lastFrame);lastFrame=now;if(mode==='camera'&&now-lastHand>500){point=null;secondPoint=null;previous=null;secondPrevious=null;$('status').textContent='손바닥을 보여 주세요 / 请举起手掌';}if(point){gestureUI(now);if(active&&!transitioning&&!dwellTarget&&!paused&&!$('sources').open){const speed=visualLast?Math.hypot(point.x-visualLast.x,point.y-visualLast.y):100;focusEnergy=Math.max(0,Math.min(1,focusEnergy+(speed<2?dt/2200:-dt/400)));visualLast={...point};paint(point);if(secondPoint){const primaryPrevious=previous;previous=secondPrevious;paint(secondPoint);secondPrevious=previous;previous=primaryPrevious;}else secondPrevious=null;if(now-lastMeasure>150){measure();lastMeasure=now;}}}else{visualLast=null;focusEnergy=0;}updateTracking();if(active&&now-lastActivity>90000){showMenu();$('status').textContent='다시 시작해 보세요 / 欢迎再次体验';}if(now>toastUntil)$('toast').hidden=true;
ctx.clearRect(0,0,width,height);ctx.filter='grayscale(1) brightness(.65)';cover(ctx,active?(chapter===0?past:wetland):lake);ctx.filter='none';lctx.clearRect(0,0,width,height);cover(lctx,present);lctx.globalCompositeOperation='destination-in';lctx.drawImage(mask,0,0);lctx.globalCompositeOperation='source-over';ctx.drawImage(layer,0,0);if(completed){ctx.globalAlpha=Math.min(1,(now-completionTime)/2600);cover(ctx,present);ctx.globalAlpha=1;}
const shade=ctx.createLinearGradient(0,0,0,height);shade.addColorStop(0,'rgba(0,9,8,.7)');shade.addColorStop(.25,'rgba(0,9,8,0)');shade.addColorStop(.75,'rgba(0,9,8,0)');shade.addColorStop(1,'rgba(0,9,8,.8)');ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);if(!active){ctx.fillStyle='rgba(0,8,7,.40)';ctx.fillRect(0,0,width,height);}if(!paused&&!reducedMotion)effects(now,dt);for(const p of[point,secondPoint])if(p){const r=active?brushRadius(p):24;ctx.save();ctx.shadowBlur=24+focusEnergy*25;ctx.shadowColor=p.focus?'#a7efff':'#daffc4';ctx.strokeStyle=p.focus?'#b5f0ff':'#e7ffcd';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,r*.83,0,Math.PI*2);ctx.stroke();ctx.setLineDash([4,12]);ctx.beginPath();ctx.arc(p.x,p.y,r*.93,now/1500,now/1500+Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=focusEnergy*.4;ctx.beginPath();ctx.arc(p.x,p.y,r*(1.1+Math.sin(now/700)*.04),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle='#edffdd';ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();ctx.restore();}if(secondPoint&&point&&active){ctx.save();ctx.strokeStyle='#d8efb944';ctx.setLineDash([2,8]);ctx.beginPath();ctx.moveTo(point.x,point.y);ctx.quadraticCurveTo((point.x+secondPoint.x)/2,(point.y+secondPoint.y)/2-70,secondPoint.x,secondPoint.y);ctx.stroke();ctx.restore();}}
function startMode(next){document.body.classList.remove('in-menu');mode=next;active=true;chapter=selectedChapter;present=chapter===0?lake:wetland;chapterStart=performance.now();$('welcome').hidden=true;$('chapters').hidden=false;$('chapter-index').textContent='0'+(chapter+1);$('chapter-tag').textContent=chapters[chapter].tag;$('chapter-name').textContent=chapters[chapter].name;$('guide').hidden=false;$('status').textContent=next==='mouse'?'마우스 체험 / 鼠标体验':'손 인식 중 / 正在识别手掌';reset();}
function stopCamera(){cameraGeneration++;if(handPose){try{handPose.detectStop();}catch{}}if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;}
function loadModel(){
  if(modelPromise)return modelPromise;
  modelPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='vendor/ml5.min.js';
    script.onerror=()=>reject(new Error('识别库加载失败'));
    script.onload=()=>{try{handPose=ml5.handPose({runtime:'mediapipe',modelType:'full',maxHands:2,solutionPath:new URL('vendor/hands/',document.baseURI).href},()=>resolve(handPose));}catch(e){reject(e);}};
    document.head.appendChild(script);
  });return modelPromise;
}
function handleHands(results){
  if(mode!=='camera')return;
  const usable=[],seen=new Set();
  for(let i=0;i<Math.min(2,results.length);i++){
    const hand=results[i],kp=hand.keypoints;if(!kp||kp.length<21)continue;
    const wrist=kp[0],dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const palmSize=Math.max(20,dist(wrist,kp[9]));
    const focus=dist(kp[4],kp[8])/palmSize<.38;
    const open=[8,12,16,20].filter(j=>dist(kp[j],wrist)>dist(kp[j-2],wrist)*1.12).length>=3;
    if(!open&&!focus)continue;
    const center=focus?{x:(kp[4].x+kp[8].x)/2,y:(kp[4].y+kp[8].y)/2}:[0,5,9,13,17].reduce((a,j)=>({x:a.x+kp[j].x/5,y:a.y+kp[j].y/5}),{x:0,y:0});
    const target={x:Math.max(0,Math.min(width,(1-center.x/($('video').videoWidth||640))*width)),y:Math.max(0,Math.min(height,center.y/($('video').videoHeight||480)*height)),focus};
    const key=typeof hand.handedness==='string'?hand.handedness:String(i),old=handTracks.get(key);
    const p=old?{x:old.x+(target.x-old.x)*.28,y:old.y+(target.y-old.y)*.28,focus}:target;p.id=key;
    handTracks.set(key,p);seen.add(key);usable.push(p);
  }
  for(const key of handTracks.keys())if(!seen.has(key))handTracks.delete(key);
  usable.sort((a,b)=>a.id.localeCompare(b.id));
  if(point?.id!==usable[0]?.id)previous=null;
  if(secondPoint?.id!==usable[1]?.id)secondPrevious=null;
  point=usable[0]||null;secondPoint=usable[1]||null;
  if(!point){previous=null;secondPrevious=null;return;}
  lastHand=performance.now();lastActivity=lastHand;
  $('status').textContent=usable.length===2?'두 손 연결됨 / 双手光场已连接':point.focus?'집중의 빛 / 聚光模式':'손바닥 인식됨 / 已识别手掌';
}
async function startCamera(){
  if(!resourcesReady)return;
  if(!window.isSecureContext||!navigator.mediaDevices){$('message').textContent='摄像头需 HTTPS 或 localhost。请使用鼠标体验，或按说明启动本地服务器。';return;}
  $('camera').disabled=true;const generation=++cameraGeneration;$('message').textContent='正在加载本地手势模型并请求摄像头权限…';
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});
    if(generation!==cameraGeneration){stream.getTracks().forEach(t=>t.stop());return;}
    $('video').srcObject=stream;await $('video').play();await loadModel();
    if(generation!==cameraGeneration)return;
    startMode('camera');handPose.detectStart($('video'),handleHands);
  }catch(e){stopCamera();$('message').textContent='摄像头或识别启动失败：'+e.message+'。可点击“鼠标体验”继续。';}
  finally{$('camera').disabled=false;}
}
function effects(now,dt){ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<35;i++){const x=((i*137.51+Math.sin(now/6500+i)*30)%width+width)%width,y=(i*87.31-now*.008)%height;ctx.globalAlpha=.12+.10*Math.sin(now/1400+i);ctx.fillStyle='#d5ebc2';ctx.beginPath();ctx.arc(x,(y+height)%height,1.2,0,7);ctx.fill();}for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt/16;p.y+=p.vy*dt/16;p.life-=dt/1700;if(p.life<=0){particles.splice(i,1);continue;}ctx.globalAlpha=p.life*.65;ctx.shadowBlur=12;ctx.shadowColor='#dcfac1';ctx.fillStyle='#e4fcd1';ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,7);ctx.fill();}for(let i=ripples.length-1;i>=0;i--){const r=ripples[i];r.age+=dt;if(r.age>1800){ripples.splice(i,1);continue;}ctx.globalAlpha=(1-r.age/1800)*.35;ctx.strokeStyle='#dafcc7';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(r.x,r.y,15+r.age*.12,8+r.age*.045,0,0,7);ctx.stroke();}if(point&&active&&Math.floor(now/650)!==Math.floor((now-dt)/650))ripples.push({x:point.x,y:point.y,age:0});ctx.restore();}
function gestureUI(now){if(mode!=='camera'||!point||$('sources').open){$('dwell').hidden=true;dwellTarget=null;return;}const hit=document.elementFromPoint(point.x,point.y)?.closest('button.gesture');if(hit&&!hit.disabled){if(hit!==dwellTarget){dwellTarget=hit;dwellStart=now;dwellFired=false;}$('dwell').hidden=false;$('dwell').style.left=point.x+'px';$('dwell').style.top=point.y+'px';$('dwell').style.setProperty('--progress',Math.min(1,(now-dwellStart)/1250));if(!dwellFired&&now-dwellStart>1250){dwellFired=true;hit.click();}}else{dwellTarget=null;$('dwell').hidden=true;}}
function showMenu(){document.body.classList.add('in-menu');active=false;transitioning=false;reset();$('welcome').hidden=false;$('chapters').hidden=true;$('guide').hidden=true;$('transition').hidden=true;$('message').textContent='本地手势识别 · 不上传摄像头画面';$('phase').textContent='SELECT A CHAPTER / 选择环境故事';}
function selectChapter(i){selectedChapter=i;document.querySelectorAll('[data-scene]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.scene)===i));if(mode==='camera'&&stream){startMode('camera');}}
async function nextChapter(){if(chapter===1){showMenu();return;}if(transitioning)return;transitioning=true;$('transition-num').textContent='02';$('transition-title').textContent=chapters[1].name;$('transition').hidden=false;$('result').hidden=true;await new Promise(r=>setTimeout(r,1600));if(!transitioning)return;selectedChapter=1;startMode(mode);transitioning=false;$('transition').hidden=true;}
async function toggleSound(){if(!audioCtx){audioCtx=new AudioContext();audioGain=audioCtx.createGain();audioGain.gain.value=0;audioGain.connect(audioCtx.destination);const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*3,audioCtx.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+.025*(Math.random()*2-1))/1.025;data[i]=last*3;}const noise=audioCtx.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=420;noise.connect(filter).connect(audioGain);noise.start();}await audioCtx.resume();soundEnabled=!soundEnabled;audioGain.gain.setTargetAtTime(soundEnabled?.18:0,audioCtx.currentTime,.4);$('sound').textContent=soundEnabled?'◉ SOUND ON':'◌ SOUND OFF';$('sound').setAttribute('aria-pressed',String(soundEnabled));}
function chime(freq){if(!soundEnabled||!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.0001,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.06,audioCtx.currentTime+.04);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+1.3);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+1.4);}
function setPaused(value){paused=value;$('pause-overlay').hidden=!value;$('pause').textContent=value?'▶ 继续':'Ⅱ 暂停';$('pause').setAttribute('aria-pressed',String(value));previous=null;secondPrevious=null;lastActivity=performance.now();}
function updateTracking(){
  $('interaction-legend').hidden=!active||completed;
  $('hand-feedback').hidden=!active;
  $('guide').hidden=!active||completed||paused;
  const text=mode==='mouse'?(point?.focus?'FOCUS / 聚光 · 松开 Shift 扩散':'MOUSE / 移动探索 · 按住 Shift 聚光'):secondPoint?'TWO HANDS / 双手共同照亮':point?.focus?'FOCUS / 指尖聚光':point?'PALM / 手掌光场':'WAITING / 请举起手掌';
  if($('tracking-copy').textContent!==text)$('tracking-copy').textContent=text;
}
function savePostcard(){
  const out=document.createElement('canvas');out.width=1920;out.height=1080;const c=out.getContext('2d');
  c.fillStyle='#07110e';c.fillRect(0,0,1920,1080);c.drawImage(present,70,70,1780,714);
  c.fillStyle='#d9edba';c.font='24px sans-serif';c.fillText('RE:ANSAN / 빛으로 다시 보는 시화호',75,845);
  c.fillStyle='#eff5eb';c.font='38px sans-serif';c.fillText(chapters[chapter].title,75,905);
  c.fillStyle='#b4c3b8';c.font='19px sans-serif';c.fillText('本地互动体验纪念 · 真实场景照片，不代表同机位历史复原',75,959);
  c.font='16px sans-serif';c.fillText('照片来源：安山市文化旅游官网 / ansan.go.kr/tourinfo',75,1010);
  out.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='RE-ANSAN-chapter-'+(chapter+1)+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);},'image/png');
}
$('pause').onclick=()=>setPaused(!paused);$('resume').onclick=()=>setPaused(false);$('postcard').onclick=savePostcard;
document.addEventListener('keydown',e=>{if(e.code==='Space'&&active&&!$('sources').open&&!/BUTTON|INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();setPaused(!paused);}if(e.key==='Shift'&&mode==='mouse'&&point)point.focus=true;});
document.addEventListener('keyup',e=>{if(e.key==='Shift'&&point)point.focus=false;});
document.querySelectorAll('.scene-card').forEach(card=>{card.addEventListener('pointermove',e=>{if(reducedMotion)return;const r=card.getBoundingClientRect();card.style.setProperty('--rx',((e.clientY-r.top)/r.height-.5)*-6+'deg');card.style.setProperty('--ry',((e.clientX-r.left)/r.width-.5)*7+'deg');});card.addEventListener('pointerleave',()=>{card.style.setProperty('--rx','0deg');card.style.setProperty('--ry','0deg');});});
document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>selectChapter(Number(b.dataset.scene)));$('menu').onclick=showMenu;$('next').onclick=nextChapter;$('sound').onclick=()=>toggleSound().catch(()=>{$('status').textContent='请点击音效按钮启用声音';});$('source-button').onclick=()=>$('sources').showModal();$('close-sources').onclick=()=>$('sources').close();document.addEventListener('pointermove',()=>lastActivity=performance.now());document.addEventListener('pointerdown',()=>lastActivity=performance.now());document.addEventListener('keydown',()=>lastActivity=performance.now());
$('camera').onclick=()=>{if(mode==='camera'&&stream)startMode('camera');else startCamera();};$('mouse').onclick=()=>{stopCamera();startMode('mouse');};$('reset').onclick=()=>reset();$('again').onclick=()=>reset();$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('status').textContent='浏览器不支持全屏';}};
canvas.addEventListener('pointermove',e=>{if(mode==='mouse')point={x:e.clientX,y:e.clientY,focus:e.shiftKey};});canvas.addEventListener('pointerdown',e=>{if(mode==='mouse'){canvas.setPointerCapture(e.pointerId);point={x:e.clientX,y:e.clientY,focus:e.shiftKey};}});canvas.addEventListener('pointerleave',()=>{if(mode==='mouse'){point=null;previous=null;}});canvas.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse'){point=null;previous=null;}});window.addEventListener('resize',resize);window.addEventListener('beforeunload',stopCamera);document.addEventListener('keydown',e=>{if(e.key==='Escape')reset();if(e.key.toLowerCase()==='r')reset();});
resize();$('camera').disabled=$('mouse').disabled=true;Promise.all([loadImage(past,'assets/past.jpg'),loadImage(lake,'assets/lake-hd.jpg'),loadImage(wetland,'assets/wetland-hd.jpg')]).then(()=>{resourcesReady=true;$('camera').disabled=$('mouse').disabled=false;}).catch(()=>{$('message').textContent='照片加载失败，请通过本地服务器运行并检查 assets 目录。';});requestAnimationFrame(draw);
// Expose read-only state for automated smoke checks.
window.reAnsanState=()=>({mode,coverage,completed,resourcesReady,chapter,active,transitioning,paused,hands:Number(!!point)+Number(!!secondPoint),focused:!!point?.focus});
window.reAnsanVisual=()=>({active:active&&!paused,light:point?{x:point.x/width,y:1-point.y/height}:null,second:secondPoint?{x:secondPoint.x/width,y:1-secondPoint.y/height}:null,energy:focusEnergy,reducedMotion});
setInterval(()=>{if(mode==='camera'&&point&&performance.now()-lastHand<500)lastActivity=performance.now();},1000);
