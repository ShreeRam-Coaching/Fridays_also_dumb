/* Small purpose-built WebGL renderer for the clinic's scroll scene. */
(function () {
  const vertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uMvp;
    uniform mat4 uModel;
    uniform mat3 uNormalMatrix;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec3 vLocal;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vWorld = world.xyz;
      vLocal = aPosition;
      vNormal = normalize(uNormalMatrix * aNormal);
      gl_Position = uMvp * vec4(aPosition, 1.0);
    }
  `;

  const fragmentShader = `
    precision mediump float;
    uniform vec3 uBase;
    uniform vec3 uKey;
    uniform vec3 uFill;
    uniform vec3 uLightPosition;
    uniform vec3 uCamera;
    uniform float uMetal;
    uniform float uOpacity;
    uniform float uSoftEdge;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec3 vLocal;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 l = normalize(uLightPosition - vWorld);
      vec3 v = normalize(uCamera - vWorld);
      vec3 h = normalize(l + v);
      float diffuse = max(dot(n, l), 0.0);
      float fill = 0.23 + 0.33 * max(dot(n, normalize(vec3(-0.35, 0.78, -0.4))), 0.0);
      float specular = pow(max(dot(n, h), 0.0), mix(42.0, 20.0, uMetal));
      float rim = pow(1.0 - max(dot(n, v), 0.0), 2.4);
      vec3 color = uBase * (fill + diffuse * 0.65) + uKey * specular * (0.26 + uMetal * 0.65);
      color += uFill * rim * (0.07 + uMetal * 0.18);
      float alpha = uOpacity;
      if (uSoftEdge > 0.5) alpha *= 1.0 - smoothstep(0.12, 1.0, length(vLocal.xz));
      gl_FragColor = vec4(color, alpha);
    }
  `;

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || 'Could not compile scene shader');
    }
    return shader;
  }

  function createProgram(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentShader));
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.bindAttribLocation(program, 1, 'aNormal');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  function field(x, y, z) {
    const q = x * x + 2.25 * z * z + y * y - 1;
    return q * q * q - x * x * y * y * y - 0.1125 * z * z * y * y * y;
  }

  function fieldNormal(p) {
    const e = 0.002;
    return normalize([
      field(p[0] + e, p[1], p[2]) - field(p[0] - e, p[1], p[2]),
      field(p[0], p[1] + e, p[2]) - field(p[0], p[1] - e, p[2]),
      field(p[0], p[1], p[2] + e) - field(p[0], p[1], p[2] - e)
    ]);
  }

  function normalize(v) {
    const d = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / d, v[1] / d, v[2] / d];
  }

  function makeHeart(resolution) {
    const n = resolution;
    const lo = [-1.25, -1.38, -1.25];
    const hi = [1.25, 1.18, 1.25];
    const size = n + 1;
    const values = new Float32Array(size * size * size);
    const positionAt = (x, y, z) => [
      mix(lo[0], hi[0], x / n), mix(lo[1], hi[1], y / n), mix(lo[2], hi[2], z / n)
    ];
    const index = (x, y, z) => (z * size + y) * size + x;
    for (let z = 0; z <= n; z++) for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) {
      const p = positionAt(x, y, z);
      values[index(x, y, z)] = field(p[0], p[1], p[2]);
    }

    const corners = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    const tetrahedra = [[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
    const positions = [];
    const normals = [];
    const edge = (a, b, va, vb) => {
      const t = clamp(va / (va - vb), 0, 1);
      return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
    };
    const emit = (a, b, c) => {
      for (const p of [a, b, c]) {
        positions.push(p[0], p[1], p[2]);
        normals.push(...fieldNormal(p));
      }
    };
    const polygonize = (p, v) => {
      const inside = [], outside = [];
      for (let i = 0; i < 4; i++) (v[i] < 0 ? inside : outside).push(i);
      if (inside.length === 0 || inside.length === 4) return;
      if (inside.length === 1) {
        const a = inside[0];
        emit(edge(p[a],p[outside[0]],v[a],v[outside[0]]), edge(p[a],p[outside[1]],v[a],v[outside[1]]), edge(p[a],p[outside[2]],v[a],v[outside[2]]));
      } else if (inside.length === 3) {
        const a = outside[0];
        emit(edge(p[a],p[inside[0]],v[a],v[inside[0]]), edge(p[a],p[inside[2]],v[a],v[inside[2]]), edge(p[a],p[inside[1]],v[a],v[inside[1]]));
      } else {
        const a=inside[0], b=inside[1], c=outside[0], d=outside[1];
        const ac=edge(p[a],p[c],v[a],v[c]), ad=edge(p[a],p[d],v[a],v[d]);
        const bc=edge(p[b],p[c],v[b],v[c]), bd=edge(p[b],p[d],v[b],v[d]);
        emit(ac,ad,bc); emit(ad,bd,bc);
      }
    };
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const points = corners.map(([dx,dy,dz]) => positionAt(x+dx,y+dy,z+dz));
      const vals = corners.map(([dx,dy,dz]) => values[index(x+dx,y+dy,z+dz)]);
      for (const tet of tetrahedra) polygonize(tet.map(i => points[i]), tet.map(i => vals[i]));
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), count: positions.length / 3 };
  }

  function makeTube(path, radius, steps, sides) {
    const positions = [], normals = [];
    const bezier = (t) => {
      const s=1-t;
      return path[0].map((_,i) => s*s*s*path[0][i]+3*s*s*t*path[1][i]+3*s*t*t*path[2][i]+t*t*t*path[3][i]);
    };
    const rings = [];
    for (let i=0;i<=steps;i++) {
      const t=i/steps, center=bezier(t), tangent=normalize([
        bezier(Math.min(1,t+.001))[0]-bezier(Math.max(0,t-.001))[0],
        bezier(Math.min(1,t+.001))[1]-bezier(Math.max(0,t-.001))[1],
        bezier(Math.min(1,t+.001))[2]-bezier(Math.max(0,t-.001))[2]
      ]);
      const guide=Math.abs(tangent[1])>.88?[1,0,0]:[0,1,0];
      const u=normalize([tangent[1]*guide[2]-tangent[2]*guide[1],tangent[2]*guide[0]-tangent[0]*guide[2],tangent[0]*guide[1]-tangent[1]*guide[0]]);
      const v=normalize([tangent[1]*u[2]-tangent[2]*u[1],tangent[2]*u[0]-tangent[0]*u[2],tangent[0]*u[1]-tangent[1]*u[0]]);
      rings.push(Array.from({length:sides},(_,j)=>{
        const angle=j/sides*Math.PI*2, normal=normalize([u[0]*Math.cos(angle)+v[0]*Math.sin(angle),u[1]*Math.cos(angle)+v[1]*Math.sin(angle),u[2]*Math.cos(angle)+v[2]*Math.sin(angle)]);
        return {p:[center[0]+normal[0]*radius,center[1]+normal[1]*radius,center[2]+normal[2]*radius],n:normal};
      }));
    }
    for (let i=0;i<steps;i++) for(let j=0;j<sides;j++) {
      const a=rings[i][j],b=rings[i][(j+1)%sides],c=rings[i+1][j],d=rings[i+1][(j+1)%sides];
      for(const q of [a,c,b,b,c,d]){positions.push(...q.p);normals.push(...q.n);}
    }
    return {positions:new Float32Array(positions),normals:new Float32Array(normals),count:positions.length/3};
  }

  function makeTorus(radius, tube, steps, sides) {
    const positions=[],normals=[];
    for(let i=0;i<steps;i++) for(let j=0;j<sides;j++) {
      const make=(a,b)=>{
        const u=a/steps*Math.PI*2,v=b/sides*Math.PI*2;
        const n=[Math.cos(v)*Math.cos(u),Math.cos(v)*Math.sin(u),Math.sin(v)];
        return {p:[(radius+tube*Math.cos(v))*Math.cos(u),(radius+tube*Math.cos(v))*Math.sin(u),tube*Math.sin(v)],n};
      };
      const a=make(i,j),b=make(i+1,j),c=make(i,j+1),d=make(i+1,j+1);
      for(const q of [a,b,c,c,b,d]){positions.push(...q.p);normals.push(...q.n);}
    }
    return {positions:new Float32Array(positions),normals:new Float32Array(normals),count:positions.length/3};
  }

  function makeDisk(steps) {
    const positions=[],normals=[];
    for(let i=0;i<steps;i++){
      const a=i/steps*Math.PI*2,b=(i+1)/steps*Math.PI*2;
      for(const p of [[0,0,0],[Math.cos(a),0,Math.sin(a)],[Math.cos(b),0,Math.sin(b)]]){positions.push(...p);normals.push(0,1,0);}
    }
    return {positions:new Float32Array(positions),normals:new Float32Array(normals),count:positions.length/3};
  }

  function bufferMesh(gl, geometry) {
    const position=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,position);gl.bufferData(gl.ARRAY_BUFFER,geometry.positions,gl.STATIC_DRAW);
    const normal=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,normal);gl.bufferData(gl.ARRAY_BUFFER,geometry.normals,gl.STATIC_DRAW);
    return {position,normal,count:geometry.count};
  }

  function perspective(fovy, aspect, near, far) {
    const f=1/Math.tan(fovy/2),nf=1/(near-far);
    return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
  }
  function lookAt(eye,target) {
    const z=normalize([eye[0]-target[0],eye[1]-target[1],eye[2]-target[2]]);
    const x=normalize([z[2],0,-z[0]]);
    const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
    return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
  }
  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
  function multiply(a,b){
    const out=new Float32Array(16);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return out;
  }
  function modelMatrix(position,rotation,scale){
    const [x,y,z]=rotation,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
    const r00=cy*cz,r01=cy*sz,r02=-sy;
    const r10=sx*sy*cz-cx*sz,r11=sx*sy*sz+cx*cz,r12=sx*cy;
    const r20=cx*sy*cz+sx*sz,r21=cx*sy*sz-sx*cz,r22=cx*cy;
    return new Float32Array([r00*scale,r10*scale,r20*scale,0,r01*scale,r11*scale,r21*scale,0,r02*scale,r12*scale,r22*scale,0,position[0],position[1],position[2],1]);
  }

  const keyframes=[
    {camera:[0.15,0.08,5.25],target:[0,0,0],heart:[0.72,0.02,0],rotation:[0.02,-0.28,0.02],scale:0.95,key:[0.78,0.83,0.72],fill:[0.18,0.35,0.28],color:[0.58,0.67,0.59],metal:.38},
    {camera:[-0.22,0.12,4.25],target:[0,0,0],heart:[-0.88,0.02,0],rotation:[0.1,1.48,-0.08],scale:.78,key:[0.49,0.78,0.68],fill:[0.17,0.46,0.39],color:[0.53,0.72,0.65],metal:.57},
    {camera:[-0.28,0.2,4.5],target:[0,0,0],heart:[1.35,-0.05,-.2],rotation:[-.06,2.25,.1],scale:.68,key:[0.87,0.78,0.61],fill:[0.42,0.52,0.38],color:[0.68,0.69,0.59],metal:.24},
    {camera:[0,0.13,6.1],target:[0,0,0],heart:[.72,0,-.18],rotation:[.04,3.08,.02],scale:.93,key:[0.78,0.84,0.73],fill:[0.23,0.42,0.32],color:[0.63,0.7,0.62],metal:.42}
  ];

  function mount(canvas) {
    let gl;
    try { gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,powerPreference:'high-performance'}); } catch (_) { return null; }
    if(!gl)return null;
    let program,meshes=[];
    try {
      program=createProgram(gl);
      const resolution=window.matchMedia('(max-width: 1100px)').matches?25:31;
      const heart=bufferMesh(gl,makeHeart(resolution));
      const aorta=bufferMesh(gl,makeTube([[.13,.58,0],[.17,1.18,0],[.78,1.22,-.02],[.72,.57,-.02]],.115,42,9));
      const branchA=bufferMesh(gl,makeTube([[.48,.86,-.02],[.72,1.14,-.04],[.94,1.02,-.04],[1.04,.83,-.04]],.058,26,8));
      const branchB=bufferMesh(gl,makeTube([[-.28,.89,.03],[-.52,1.18,.03],[-.78,1.1,.03],[-.89,.92,.03]],.05,24,8));
      const lowerVessel=bufferMesh(gl,makeTube([[-.44,.36,-.04],[-.79,.26,-.04],[-.72,-.2,-.04],[-.43,-.54,-.04]],.038,26,8));
      const ring=bufferMesh(gl,makeTorus(1.58,.014,82,7));
      const innerRing=bufferMesh(gl,makeTorus(1.28,.009,72,6));
      const portalLeft=bufferMesh(gl,makeTube([[-1.08,-1.35,-.8],[-1.1,-.35,-.8],[-1.08,.3,-.8],[-.96,.64,-.8]],.021,28,7));
      const portalCrown=bufferMesh(gl,makeTube([[-.96,.64,-.8],[-.68,1.53,-.8],[.68,1.53,-.8],[.96,.64,-.8]],.023,44,7));
      const portalRight=bufferMesh(gl,makeTube([[.96,.64,-.8],[1.08,.3,-.8],[1.1,-.35,-.8],[1.08,-1.35,-.8]],.021,28,7));
      const shadow=bufferMesh(gl,makeDisk(72));
      meshes.push({mesh:heart,color:[.58,.67,.59],metal:.42,opacity:1},{mesh:aorta,color:[.75,.76,.68],metal:.64,opacity:1},{mesh:branchA,color:[.65,.69,.61],metal:.54,opacity:.94},{mesh:branchB,color:[.63,.7,.66],metal:.48,opacity:.9},{mesh:lowerVessel,color:[.35,.57,.5],metal:.55,opacity:.92},{mesh:ring,color:[.65,.72,.62],metal:.72,opacity:.48},{mesh:innerRing,color:[.42,.65,.57],metal:.62,opacity:.38},{mesh:portalLeft,color:[.69,.73,.64],metal:.63,opacity:0},{mesh:portalCrown,color:[.69,.73,.64],metal:.63,opacity:0},{mesh:portalRight,color:[.69,.73,.64],metal:.63,opacity:0},{mesh:shadow,color:[.025,.055,.04],metal:0,opacity:.35,soft:true});
    } catch(error) { console.warn('The clinic scene could not be created.',error);return null; }

    gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
    const loc={mvp:gl.getUniformLocation(program,'uMvp'),model:gl.getUniformLocation(program,'uModel'),normal:gl.getUniformLocation(program,'uNormalMatrix'),base:gl.getUniformLocation(program,'uBase'),key:gl.getUniformLocation(program,'uKey'),fill:gl.getUniformLocation(program,'uFill'),light:gl.getUniformLocation(program,'uLightPosition'),camera:gl.getUniformLocation(program,'uCamera'),metal:gl.getUniformLocation(program,'uMetal'),opacity:gl.getUniformLocation(program,'uOpacity'),soft:gl.getUniformLocation(program,'uSoftEdge')};
    const attribPosition=gl.getAttribLocation(program,'aPosition'),attribNormal=gl.getAttribLocation(program,'aNormal');
    let width=0,height=0,dpr=1,lastState=null,visible=true,disposed=false;
    const state={progress:0};
    function resize(){
      if(disposed)return;
      const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
      const memory=navigator.deviceMemory||8;dpr=Math.min(window.devicePixelRatio||1,window.matchMedia('(pointer:coarse)').matches?1.25:1.65,memory<=4?1:1.65);
      width=Math.max(1,Math.round(rect.width*dpr));height=Math.max(1,Math.round(rect.height*dpr));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);draw();}
    }
    function drawMesh(entry,viewProjection,scene,position,rotation,scale,opacityOverride){
      const mesh=entry.mesh,model=modelMatrix(position,rotation,scale),mvp=multiply(viewProjection,model);
      const normal=new Float32Array([model[0],model[1],model[2],model[4],model[5],model[6],model[8],model[9],model[10]]);
      gl.uniformMatrix4fv(loc.mvp,false,mvp);gl.uniformMatrix4fv(loc.model,false,model);gl.uniformMatrix3fv(loc.normal,false,normal);
      gl.uniform3fv(loc.base,entry.color||scene.color);gl.uniform3fv(loc.key,scene.key);gl.uniform3fv(loc.fill,scene.fill);
      gl.uniform3f(loc.light,scene.light[0],scene.light[1],scene.light[2]);gl.uniform3fv(loc.camera,scene.camera);
      gl.uniform1f(loc.metal,entry.metal==null?scene.metal:entry.metal);gl.uniform1f(loc.opacity,opacityOverride==null?(entry.opacity==null?1:entry.opacity):opacityOverride);gl.uniform1f(loc.soft,entry.soft?1:0);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.position);gl.enableVertexAttribArray(attribPosition);gl.vertexAttribPointer(attribPosition,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.normal);gl.enableVertexAttribArray(attribNormal);gl.vertexAttribPointer(attribNormal,3,gl.FLOAT,false,0,0);
      gl.drawArrays(gl.TRIANGLES,0,mesh.count);
    }
    function sample(progress){
      const scaled=clamp(progress,0,1)*3,index=Math.min(2,Math.floor(scaled)),t=smooth(scaled-index),a=keyframes[index],b=keyframes[index+1],out={};
      for(const key of ['camera','target','heart','rotation','key','fill','color'])out[key]=mix3(a[key],b[key],t);
      out.scale=mix(a.scale,b.scale,t);out.metal=mix(a.metal,b.metal,t);out.light=[-2.4+progress*1.1,2.2,3.1];
      return out;
    }
    function draw(){
      if(disposed||!visible||!width||!height)return;
      gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
      const scene=sample(state.progress),projection=perspective(42*Math.PI/180,width/height,.1,80),view=lookAt(scene.camera,scene.target),vp=multiply(projection,view);
      const groupRot=scene.rotation;
      const shadowPos=[scene.heart[0],-1.3,scene.heart[2]];
      const portalIn=clamp((state.progress-.36)/.2,0,1),portalOut=clamp((state.progress-.74)/.11,0,1),portalOpacity=Math.min(.42,portalIn*.42)*(1-portalOut*.8);
      drawMesh(meshes[7],vp,scene,[0,0,-.8],[0,0,0],[1,1,1],portalOpacity);
      drawMesh(meshes[8],vp,scene,[0,0,-.8],[0,0,0],[1,1,1],portalOpacity);
      drawMesh(meshes[9],vp,scene,[0,0,-.8],[0,0,0],[1,1,1],portalOpacity);
      drawMesh(meshes[10],vp,scene,shadowPos,[0,groupRot[1],0],[1.55,.001,1.08]);
      drawMesh(meshes[5],vp,scene,[scene.heart[0],scene.heart[1],scene.heart[2]-.5],[groupRot[0],groupRot[1]+.16,groupRot[2]],[1,1,.7]);
      drawMesh(meshes[6],vp,scene,[scene.heart[0],scene.heart[1],scene.heart[2]-.42],[groupRot[0]+.2,groupRot[1]-.2,groupRot[2]+.18],[1,1,.72]);
      drawMesh(meshes[0],vp,scene,scene.heart,groupRot,[scene.scale,scene.scale,scene.scale]);
      const tubeScale=[scene.scale,scene.scale,scene.scale];
      drawMesh(meshes[1],vp,scene,scene.heart,groupRot,tubeScale);drawMesh(meshes[2],vp,scene,scene.heart,groupRot,tubeScale);
      drawMesh(meshes[3],vp,scene,scene.heart,groupRot,tubeScale);drawMesh(meshes[4],vp,scene,scene.heart,groupRot,tubeScale);
      lastState=scene;
    }
    const onResize=()=>{resize();draw();};
    const onLost=(event)=>{event.preventDefault();visible=false;canvas.dispatchEvent(new Event('clinicweblost'));};
    const onRestored=()=>{visible=true;resize();draw();canvas.dispatchEvent(new Event('clinicwebrestored'));};
    canvas.addEventListener('webglcontextlost',onLost,false);canvas.addEventListener('webglcontextrestored',onRestored,false);
    window.addEventListener('resize',onResize,{passive:true});resize();draw();
    return {
      setProgress(value){state.progress=clamp(value,0,1);draw();},
      setVisible(value){visible=value;if(visible)draw();},
      destroy(){disposed=true;window.removeEventListener('resize',onResize);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);for(const entry of meshes){gl.deleteBuffer(entry.mesh.position);gl.deleteBuffer(entry.mesh.normal);}gl.deleteProgram(program);}
    };
  }

  window.ClinicScene={mount};
})();
