/* Local GPU optics pass. No external assets, no camera upload. Canvas fallback on unsupported devices. */
(()=>{
  const output=document.getElementById('optics'),source=document.getElementById('scene');
  window.reAnsanOptics={renderer:'canvas',reason:'initializing'};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){output.hidden=true;window.reAnsanOptics.reason='reduced-motion';return;}
  const gl=output.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
  if(!gl){output.hidden=true;window.reAnsanOptics.reason='webgl-unavailable';return;}
  const vertex=`attribute vec2 p;varying vec2 uv;void main(){uv=(p+1.)*.5;gl_Position=vec4(p,0.,1.);}`;
  const fragment=`precision mediump float;
    uniform sampler2D image;uniform vec2 resolution;uniform vec2 light;uniform vec2 second;
    uniform float time;uniform float activity;uniform float energy;varying vec2 uv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    vec2 flow(vec2 at,vec2 center){vec2 d=at-center;d.x*=resolution.x/resolution.y;float r=length(d);float gate=exp(-r*r*32.);float wave=sin(r*54.-time*2.5)*gate;return normalize(d+vec2(.0001))*wave*.0015*activity;}
    void main(){vec2 offset=flow(uv,light)+flow(uv,second);vec2 sampleUV=clamp(uv+offset,vec2(.002),vec2(.998));vec3 col=texture2D(image,sampleUV).rgb;
      vec2 q=uv-light;q.x*=resolution.x/resolution.y;float halo=exp(-dot(q,q)*32.)*activity;
      col+=vec3(.035,.045,.020)*halo*(.5+energy*.5);
      float vignette=1.-.12*pow(length((uv-.5)*vec2(1.,.9)),1.4);
      col*=vignette;float grain=(hash(uv*resolution+mod(time,100.))-.5)*.007;
      gl_FragColor=vec4(col+grain,1.);
    }`;
  function compile(type,src){const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
  try{
    const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    const locations={};for(const k of['resolution','light','second','time','activity','energy'])locations[k]=gl.getUniformLocation(program,k);
    let last=0,alive=true;
    output.addEventListener('webglcontextlost',e=>{e.preventDefault();alive=false;output.hidden=true;window.reAnsanOptics={renderer:'canvas',reason:'context-lost'};});
    window.reAnsanOptics={renderer:'webgl',reason:null};
    function frame(t){if(!alive)return;requestAnimationFrame(frame);if(t-last<32)return;last=t;
      try{
        if(output.width!==source.width||output.height!==source.height){output.width=source.width;output.height=source.height;gl.viewport(0,0,output.width,output.height);}
        const state=window.reAnsanVisual();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
        gl.uniform2f(locations.resolution,output.width,output.height);gl.uniform2f(locations.light,state.light?.x??-10,state.light?.y??-10);gl.uniform2f(locations.second,state.second?.x??-10,state.second?.y??-10);gl.uniform1f(locations.time,t/1000);gl.uniform1f(locations.activity,state.active?1:0);gl.uniform1f(locations.energy,state.energy);gl.drawArrays(gl.TRIANGLES,0,6);
      }catch(e){alive=false;output.hidden=true;window.reAnsanOptics={renderer:'canvas',reason:String(e.message)};}
    }requestAnimationFrame(frame);
  }catch(e){output.hidden=true;window.reAnsanOptics={renderer:'canvas',reason:String(e.message)};}
})();
