// Canvas-only interaction overlay. Photograph pixels and archive exports stay intact.
export class LightTrail {
 constructor(){this.clear();}
 clear(){this.particles=[];this.previous=null;this.pulse=0;this.anchor={x:.5,y:.5};}
 emit(x,y,now){
  const p=this.previous;this.previous={x,y,now};this.anchor={x,y};
  if(!p||now-p.now>250)return;
  const distance=Math.hypot(x-p.x,y-p.y);if(distance<.002)return;
  const n=Math.min(28,Math.ceil(distance*280));
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=.018+Math.random()*.045,t=i/n;this.particles.push({x:p.x+(x-p.x)*t,y:p.y+(y-p.y)*t,vx:Math.cos(a)*s,vy:Math.sin(a)*s-.012,life:.65+Math.random()*.65,age:0,size:1+Math.random()*3});}
  if(this.particles.length>320)this.particles.splice(0,this.particles.length-320);
 }
 burst(){this.pulse=1;}
 draw(ctx,w,h,dt,enabled){
  if(!enabled){this.clear();return;}
  const seconds=Math.min(dt,60)/1000;ctx.save();ctx.globalCompositeOperation='lighter';
  this.particles=this.particles.filter(p=>p.age<p.life);
  for(const p of this.particles){p.age+=seconds;p.x+=p.vx*seconds;p.y+=p.vy*seconds;const a=Math.max(0,1-p.age/p.life),r=p.size*w/1100;ctx.globalAlpha=a*.8;ctx.shadowBlur=12;ctx.shadowColor='#71ffd7';ctx.fillStyle=p.size>2?'#c9fff0':'#65eacb';ctx.beginPath();ctx.arc(p.x*w,p.y*h,r,0,Math.PI*2);ctx.fill();}
  if(this.previous&&performance.now()-this.previous.now<180){const {x,y}=this.anchor;const radius=w*.065,g=ctx.createRadialGradient(x*w,y*h,0,x*w,y*h,radius);g.addColorStop(0,'#b5ffe82b');g.addColorStop(1,'#70ffd000');ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.fillStyle=g;ctx.fillRect(x*w-radius,y*h-radius,radius*2,radius*2);}
  if(this.pulse>0){this.pulse=Math.max(0,this.pulse-seconds*1.4);ctx.shadowBlur=15;ctx.strokeStyle='#b7ffe7';ctx.globalAlpha=this.pulse*.55;ctx.lineWidth=2;ctx.beginPath();ctx.arc(this.anchor.x*w,this.anchor.y*h,(1-this.pulse)*w*.14+12,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 }
}
