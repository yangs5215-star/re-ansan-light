// All library, WASM and model requests are same-origin local files.
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function palmPoint(points,mirror=true,range=.8){
 if(!points||points.length<21)return null;
 const center=[0,5,9,13,17].reduce((a,i)=>({x:a.x+points[i].x/5,y:a.y+points[i].y/5}),{x:0,y:0});
 return {x:clamp(((mirror?1-center.x:center.x)-.5)/range+.5),y:clamp(center.y)};
}
const timeout=(promise,ms,message)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(message)),ms);promise.then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});
let modelPromise=null;
export async function createModel(onStatus=()=>{}){
 if(modelPromise)return modelPromise;
 modelPromise=(async()=>{
  const {FilesetResolver,HandLandmarker}=await import('./vendor/mediapipe/vision_bundle.mjs');
  const fileset=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm/',import.meta.url).href);
  const model=new URL('./models/hand_landmarker.task',import.meta.url).href;
  let gpuError;
  for(const delegate of ['GPU','CPU']){
   onStatus(delegate);
   try{return {instance:await HandLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetPath:model,delegate},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5}),delegate};}catch(e){gpuError=e;}
  }
  throw gpuError;
 })();
 try{return await modelPromise;}finally{modelPromise=null;}
}
export class HandController{
 constructor({video,onPoint,onStatus,onActive,onError}){Object.assign(this,{video,onPoint,onStatus,onActive,onError});this.session=0;this.active=false;this.loading=false;this.mirror=true;this.range=.8;}
 async start(){
  if(this.active||this.loading)return;
  const session=++this.session;this.loading=true;this.onStatus('loading');let localStream=null,localModel=null;
  try{
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Object.assign(Error('secure'),{code:'secure'});
   localStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
   if(session!==this.session){localStream.getTracks().forEach(t=>t.stop());return;}
   this.stream=localStream;this.video.srcObject=localStream;
   await timeout(this.video.play(),12000,'Video did not start');
   const result=await createModel(d=>this.onStatus('loading',d));localModel=result.instance;
   if(session!==this.session){localModel.close();localStream.getTracks().forEach(t=>t.stop());return;}
   this.model=localModel;this.delegate=result.delegate;this.active=true;this.loading=false;this.onActive(true,result.delegate);this.lastVideo=-1;this.lastInference=0;this.previous=null;this.lastSeen=0;
   localStream.getVideoTracks()[0].addEventListener('ended',()=>{if(session===this.session)this.stop();});
   const tick=now=>{
    if(!this.active||session!==this.session)return;
    this.frame=requestAnimationFrame(tick);
    if(document.hidden||this.video.readyState<2||now-this.lastInference<70||this.video.currentTime===this.lastVideo)return;
    this.lastInference=now;this.lastVideo=this.video.currentTime;
    try{
     const result=this.model.detectForVideo(this.video,now),points=result.landmarks?.[0];
     if(points){const raw=palmPoint(points,this.mirror,this.range);const smooth=this.previous?{x:this.previous.x+(raw.x-this.previous.x)*.25,y:this.previous.y+(raw.y-this.previous.y)*.25}:raw;this.previous=smooth;this.lastSeen=now;this.onPoint({...smooth,points});this.onStatus('detected');}
     else if(now-this.lastSeen>700){this.previous=null;this.onPoint(null);this.onStatus('noHand');}
    }catch(e){this.stop(false);this.onError(e);}
   };this.frame=requestAnimationFrame(tick);
  }catch(e){if(localModel&&localModel!==this.model)localModel.close();if(localStream&&localStream!==this.stream)localStream.getTracks().forEach(t=>t.stop());if(session===this.session){this.stop(false);this.onError(e);}}
  finally{if(session===this.session){this.loading=false;this.onActive(this.active,this.delegate);}}
 }
 stop(notify=true){this.session++;this.active=false;this.loading=false;cancelAnimationFrame(this.frame);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;try{this.model?.close();}catch{}this.model=null;this.video.pause();this.video.srcObject=null;this.onPoint(null);this.onActive(false);if(notify)this.onStatus('stopped');}
}
