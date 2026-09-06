import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildPeregrine, setShipPalette } from './ship.mjs';
import { createWorld, createDrone, createExhaust, seededRandom } from './world.mjs';
import { createSimulation } from './simulation.mjs';
import { createAudio } from './audio.mjs';

export async function createGame(container,onState,onBoot) {
  let disposed=false,raf=0,lastTime=0,visualTime=0,publishTime=0,frameCount=0,fpsTime=0,fps=60;
  let high=true,inspecting=false,cockpit=false,mouseFire=false,touchFire=false,touchBoost=false,touchMove=null,mouseMoved=false;
  let damageFlash=0,shake=0,launchBlend=0,pausedWas='playing';
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const keys=new Set(), pointer=new THREE.Vector2(0,.08), ray=new THREE.Raycaster(), plane=new THREE.Plane(new THREE.Vector3(0,0,1),100);
  const v1=new THREE.Vector3(),v2=new THREE.Vector3(),dummy=new THREE.Object3D(),audio=createAudio(),sim=createSimulation();
  try{sim.state.best=Number(localStorage.getItem('nacre-best')||0)||0;}catch{}
  const scene=new THREE.Scene();
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.setSize(container.clientWidth,container.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.domElement.setAttribute('aria-label','可拖动旋转的游隼星舰');renderer.domElement.tabIndex=0;container.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(39,container.clientWidth/container.clientHeight,.12,2100);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.enablePan=false;controls.minDistance=14;controls.maxDistance=62;controls.minPolarAngle=.14;controls.maxPolarAngle=Math.PI*.88;controls.rotateSpeed=.48;controls.autoRotate=!reducedMotion;controls.autoRotateSpeed=.28;
  function hangarCamera(){const mobile=container.clientWidth<760;camera.fov=mobile?45:39;camera.position.set(mobile?28:23,mobile?19:14,mobile?-34:-25);controls.target.set(mobile?-1.4:-2.8,mobile?.7:.2,mobile?-1.4:-2.2);camera.updateProjectionMatrix();controls.update();}
  hangarCamera();
  onBoot('正在校准深空光场');
  const world=createWorld(scene,renderer);
  const shipRoot=new THREE.Group();scene.add(shipRoot);
  onBoot('正在装配游隼号');
  // GLB is generated from the same source and shipped locally. Source is a resilient fallback.
  let ship;
  try { const gltf=await new GLTFLoader().loadAsync('/models/peregrine.glb');ship=gltf.scene; } catch {ship=buildPeregrine();}
  shipRoot.add(ship);ship.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const exhausts=[];
  for(const [x,y,z,scale] of [[-3.84,.1,7.49,1],[3.84,.1,7.49,1],[-.71,-.13,7.25,.4],[.71,-.13,7.25,.4]]){const fx=createExhaust();const pivot=new THREE.Group();pivot.position.set(x,y,z);pivot.scale.setScalar(scale);pivot.add(fx.root);shipRoot.add(pivot);exhausts.push(fx);}
  const engineGlow=new THREE.PointLight(0x8bfada,14,12,2);engineGlow.position.set(0,.2,8);shipRoot.add(engineGlow);
  // Typography painted onto a real decal surface, not a flat illustration of the ship.
  const labelCanvas=document.createElement('canvas');labelCanvas.width=1024;labelCanvas.height=256;const ctx=labelCanvas.getContext('2d');
  ctx.fillStyle='#cbd6d3';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#293d45';ctx.font='bold 104px Arial';ctx.fillText('P–04',40,120);ctx.font='32px Arial';ctx.fillText('PEREGRINE  /  NACRE EXPEDITION',42,180);for(let i=0;i<45;i++)ctx.fillRect(700+i*5,34,2,80+(i%3)*7);
  const labelTex=new THREE.CanvasTexture(labelCanvas);labelTex.colorSpace=THREE.SRGBColorSpace;labelTex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const decal=new THREE.Mesh(new THREE.PlaneGeometry(1.02,.255),new THREE.MeshStandardMaterial({map:labelTex,roughness:.45,metalness:.35,polygonOffset:true,polygonOffsetFactor:-2}));decal.rotation.x=-Math.PI/2;decal.rotation.z=-Math.PI/2;decal.position.set(3.84,.91,.62);shipRoot.add(decal);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(container.clientWidth,container.clientHeight),.32,.50,1.1);composer.addPass(bloom);
  const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0},uDamage:{value:0},uWarp:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uDamage,uWarp;varying vec2 vUv;void main(){vec2 q=vUv-.5;float d=dot(q,q);vec2 offset=q*(.001+uWarp*.003);vec3 c=texture2D(tDiffuse,vUv).rgb;c.r=texture2D(tDiffuse,vUv+offset).r;c.b=texture2D(tDiffuse,vUv-offset).b;c*=1.-d*.5;float grain=fract(sin(dot(vUv*vec2(1703.,913.)+uTime,vec2(12.9898,78.233)))*43758.5453);c+=(grain-.5)*.003;c+=vec3(.42,.02,.008)*uDamage*pow(d*2.,.7);gl_FragColor=vec4(c,1.);}`});composer.addPass(grade);composer.addPass(new OutputPass());
  const gameRoot=new THREE.Group();gameRoot.visible=false;scene.add(gameRoot);
  const rockGeometry=world.rockGeo.clone(), rockMaterial=world.rockMat.clone();rockMaterial.color.setHex(0x777b70);
  const drones=createDrone();
  const dronePool=[],rockPool=[],ringsPool=[];
  const enemyMeshes=new Map();
  const ringGeo=new THREE.TorusGeometry(3.8,.06,6,64),ringMat=new THREE.MeshBasicMaterial({color:0x8df8cc,transparent:true,opacity:.85});
  const bulletGeo=new THREE.CylinderGeometry(.04,.055,2.2,5);bulletGeo.rotateX(Math.PI/2);
  const bullets=new THREE.InstancedMesh(bulletGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(1.2,3.1,2.3)}),350);bullets.count=0;bullets.frustumCulled=false;gameRoot.add(bullets);
  const hostileBulletGeo=new THREE.SphereGeometry(.26,8,6);const hostileBullets=new THREE.InstancedMesh(hostileBulletGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(3, .25,.04)}),100);hostileBullets.count=0;hostileBullets.frustumCulled=false;gameRoot.add(hostileBullets);
  // Transient particles share one dynamic buffer, never allocate geometry in the frame loop.
  const particleCount=1700,particles=[],pPos=new Float32Array(particleCount*3),pColors=new Float32Array(particleCount*3);pPos.fill(10000);
  const particlesGeo=new THREE.BufferGeometry();particlesGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3).setUsage(THREE.DynamicDrawUsage));particlesGeo.setAttribute('color',new THREE.BufferAttribute(pColors,3).setUsage(THREE.DynamicDrawUsage));
  const particleMat=new THREE.PointsMaterial({size:.22,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});const particleMesh=new THREE.Points(particlesGeo,particleMat);particleMesh.frustumCulled=false;gameRoot.add(particleMesh);
  const pulseGeo=new THREE.SphereGeometry(1,32,24),pulseMat=new THREE.MeshBasicMaterial({color:0x8ff8df,wireframe:true,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});const pulseMesh=new THREE.Mesh(pulseGeo,pulseMat);pulseMesh.visible=false;gameRoot.add(pulseMesh);let pulseAge=99;
  const warpRoot=new THREE.Group();gameRoot.add(warpRoot);const warpRings=[];
  for(let i=0;i<7;i++){const m=new THREE.Mesh(new THREE.TorusGeometry(20+i*2.6,.08,6,100),new THREE.MeshBasicMaterial({color:0x97fbe6,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));warpRoot.add(m);warpRings.push(m);}
  const trailCount=270,trailPos=new Float32Array(trailCount*6),trailSeed=[];const rng=seededRandom(4901);
  for(let i=0;i<trailCount;i++)trailSeed.push({x:(rng()-.5)*110,y:(rng()-.5)*75,z:-rng()*220});
  const trailGeo=new THREE.BufferGeometry();trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPos,3).setUsage(THREE.DynamicDrawUsage));const trails=new THREE.LineSegments(trailGeo,new THREE.LineBasicMaterial({color:0x82c7d1,transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false}));trails.frustumCulled=false;gameRoot.add(trails);
  const targetLayer=document.createElement('div');targetLayer.className='target-layer';container.parentElement.appendChild(targetLayer);const targetMarkers=new Map();
  const reticle=()=>container.parentElement.querySelector('.reticle');
  function spawnParticles(x,y,z,count,color,power=8){for(let i=0;i<count;i++){if(particles.length>=particleCount)particles.shift();const a=rng()*Math.PI*2,vy=rng()*2-1,s=Math.sqrt(1-vy*vy),speed=(.3+rng()*.7)*power;particles.push({x,y,z,vx:Math.cos(a)*s*speed,vy:vy*speed,vz:Math.sin(a)*s*speed,age:0,life:.25+rng()*.8,color});}}
  function clearEntities(){enemyMeshes.forEach(({mesh,type})=>{gameRoot.remove(mesh);(type==='drone'?dronePool:type==='rock'?rockPool:ringsPool).push(mesh);});enemyMeshes.clear();targetMarkers.forEach(m=>m.remove());targetMarkers.clear();particles.length=0;bullets.count=hostileBullets.count=0;pulseMesh.visible=false;warpRings.forEach(r=>r.material.opacity=0);}
  function onEvents(){for(const event of sim.drainEvents()){audio.event(event.type);if(event.type==='explosion'){spawnParticles(event.x,event.y,event.z,75,[2.7,1.1,.22],15);shake=Math.max(shake,.12);}if(event.type==='hit')spawnParticles(event.x,event.y,event.z,9,[.4,2.7,1.8],6);if(event.type==='damage'){damageFlash=1;shake=.55;}if(event.type==='repair'){spawnParticles(sim.state.x,sim.state.y,-1,60,[.5,2.5,1.4],10);}if(event.type==='pulse'){pulseAge=0;pulseMesh.position.set(sim.state.x,sim.state.y,0);pulseMesh.visible=true;shake=.2;}if(event.type==='warp')shake=.15;if(event.type==='finish'){try{localStorage.setItem('nacre-best',String(sim.state.best));}catch{}}}}
  function syncEntities(){const present=new Set();let enemyIndex=0;for(const e of sim.entities){if(e.type==='enemyShot'){if(enemyIndex<100){dummy.position.set(e.x,e.y,e.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();hostileBullets.setMatrixAt(enemyIndex++,dummy.matrix);}continue;}present.add(e.id);let item=enemyMeshes.get(e.id);if(!item){let mesh;if(e.type==='drone')mesh=dronePool.pop()||drones.clone();else if(e.type==='rock')mesh=rockPool.pop()||new THREE.Mesh(rockGeometry,rockMaterial);else mesh=ringsPool.pop()||new THREE.Mesh(ringGeo,ringMat);item={mesh,type:e.type};enemyMeshes.set(e.id,item);gameRoot.add(mesh);}const m=item.mesh;m.position.set(e.x,e.y,e.z);if(e.type==='rock'){m.scale.set(e.r,e.r*.85,e.r*1.1);m.rotation.set(e.rotation+visualTime*e.spin,e.rotation*.7,visualTime*e.spin*.7);}else if(e.type==='drone'){m.rotation.set(Math.sin(visualTime+e.phase)*.12,Math.PI,Math.sin(e.life*.8+e.phase)*-.22);m.scale.setScalar(1);}else{m.rotation.z=visualTime*.18;m.scale.setScalar(1);}}
    hostileBullets.count=enemyIndex;hostileBullets.instanceMatrix.needsUpdate=true;
    enemyMeshes.forEach((item,id)=>{if(!present.has(id)){gameRoot.remove(item.mesh);(item.type==='drone'?dronePool:item.type==='rock'?rockPool:ringsPool).push(item.mesh);enemyMeshes.delete(id);}});
    const n=Math.min(350,sim.shots.length);for(let i=0;i<n;i++){const b=sim.shots[i];dummy.position.set(b.x,b.y,b.z);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),v1.set(b.vx,b.vy,b.vz).normalize());dummy.scale.setScalar(1);dummy.updateMatrix();bullets.setMatrixAt(i,dummy.matrix);}bullets.count=n;bullets.instanceMatrix.needsUpdate=true;
  }
  function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=dt;if(p.age>p.life){particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=(p.vz+sim.state.speed*.3)*dt;}for(let i=0;i<particles.length;i++){const p=particles[i],fade=(1-p.age/p.life)**2;pPos.set([p.x,p.y,p.z],i*3);pColors.set(p.color.map(c=>c*fade),i*3);}particlesGeo.setDrawRange(0,particles.length);particlesGeo.attributes.position.needsUpdate=true;particlesGeo.attributes.color.needsUpdate=true;}
  function updateMarkers(){const shown=new Set();if(sim.state.mode==='playing')for(const e of sim.entities){if(e.type!=='drone'||e.z>-7)continue;v1.set(e.x,e.y,e.z).project(camera);if(v1.z>1||Math.abs(v1.x)>1.12||Math.abs(v1.y)>1.1)continue;shown.add(e.id);let mark=targetMarkers.get(e.id);if(!mark){mark=document.createElement('div');mark.className='target-marker';const text=document.createElement('span');mark.appendChild(text);targetLayer.appendChild(mark);targetMarkers.set(e.id,mark);}mark.style.transform=`translate(${(v1.x*.5+.5)*container.clientWidth}px,${(-v1.y*.5+.5)*container.clientHeight}px)`;mark.firstChild.textContent=`${Math.round(-e.z*8)} M`;}
    targetMarkers.forEach((mark,id)=>{if(!shown.has(id)){mark.remove();targetMarkers.delete(id);}});
  }
  function action(name,value){if(disposed)return;if(name==='start'){audio.unlock();keys.clear();mouseFire=touchFire=touchBoost=false;touchMove=null;mouseMoved=false;pointer.set(0,.08);clearEntities();sim.start();launchBlend=0;cockpit=false;controls.enabled=false;gameRoot.visible=true;shipRoot.visible=true;shipRoot.scale.setScalar(.34);shipRoot.position.set(0,0,0);shipRoot.rotation.set(0,0,0);engineGlow.intensity=4;world.key.castShadow=false;renderer.domElement.focus({preventScroll:true});}
    if(name==='hangar'){sim.setMode('hangar');clearEntities();keys.clear();mouseFire=touchFire=touchBoost=false;touchMove=null;controls.enabled=true;controls.autoRotate=!reducedMotion;shipRoot.scale.setScalar(1);shipRoot.position.set(0,0,0);shipRoot.rotation.set(0,0,0);shipRoot.visible=true;gameRoot.visible=false;engineGlow.intensity=14;world.key.castShadow=high;hangarCamera();}
    if(name==='pause'){if(sim.state.mode==='paused'){sim.setMode(pausedWas);audio.unlock();}else if(sim.state.mode==='playing'||sim.state.mode==='warping'){pausedWas=sim.state.mode;sim.setMode('paused');keys.clear();mouseFire=touchFire=touchBoost=false;touchMove=null;}}
    if(name==='pulse'){audio.unlock();sim.pulse();}
    if(name==='sound'){audio.unlock();audio.setEnabled(value);}
    if(name==='palette'){setShipPalette(ship,value);decal.visible=value==='ceramic';}
    if(name==='inspect'){inspecting=!!value;controls.autoRotate=!inspecting&&!reducedMotion;}
    if(name==='camera')cockpit=!cockpit;
    if(name==='quality'){high=value==='high';renderer.setPixelRatio(Math.min(window.devicePixelRatio,high?1.7:1));bloom.enabled=high;renderer.shadowMap.enabled=high;world.key.castShadow=high&&sim.state.mode==='hangar';resize();}
    if(name==='fullscreen'){if(document.fullscreenElement){document.exitFullscreen().catch(()=>sim.message('无法退出全屏'));}else{container.parentElement.requestFullscreen?.().catch(()=>sim.message('当前浏览器暂不支持全屏'));}}
    if(name==='touchMove')touchMove=value;if(name==='touchFire')touchFire=!!value;if(name==='touchBoost')touchBoost=!!value;
    publish();
  }
  function publish(){const {mode,health,energy,heat,score,kills,distance,speed,time,combo,notice,phase,pulse,best}=sim.state;onState({mode,health,energy,heat,score,kills,distance,speed,time,combo,notice,phase,pulse,best,fps});}
  function resize(){if(disposed)return;const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(sim.state.mode==='hangar')hangarCamera();}
  const ro=new ResizeObserver(resize);ro.observe(container);
  const removers=[];function listen(target,name,fn,opts){target.addEventListener(name,fn,opts);removers.push(()=>target.removeEventListener(name,fn,opts));}
  listen(window,'keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextArea)return;const code=e.code;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code)&&sim.state.mode!=='hangar')e.preventDefault();keys.add(code);if(e.repeat)return;if(code==='Escape'||code==='KeyP')action('pause');if(code==='KeyQ')action('pulse');if(code==='KeyC')action('camera');if(code==='Enter'&&sim.state.mode==='hangar')action('start');});
  listen(window,'keyup',e=>keys.delete(e.code));
  listen(renderer.domElement,'pointermove',e=>{if(e.pointerType==='touch'||sim.state.mode!=='playing')return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);mouseMoved=true;const r=reticle();if(r){r.style.left=`${e.clientX-rect.left}px`;r.style.top=`${e.clientY-rect.top}px`;}});
  listen(renderer.domElement,'pointerdown',e=>{audio.unlock();if(e.button===0&&e.pointerType!=='touch'&&sim.state.mode==='playing')mouseFire=true;});listen(window,'pointerup',()=>mouseFire=false);listen(window,'pointercancel',()=>{mouseFire=touchFire=touchBoost=false;touchMove=null;});
  listen(renderer.domElement,'contextmenu',e=>e.preventDefault());listen(window,'blur',()=>{if(sim.state.mode==='playing'||sim.state.mode==='warping')action('pause');});listen(document,'visibilitychange',()=>{if(document.hidden&&(sim.state.mode==='playing'||sim.state.mode==='warping'))action('pause');});
  listen(renderer.domElement,'webglcontextlost',e=>{e.preventDefault();action('pause');sim.message('图形设备连接中断，请刷新页面重新连接',999);publish();});
  function frame(ms){if(disposed)return;raf=requestAnimationFrame(frame);const dt=lastTime?Math.min((ms-lastTime)/1000,.05):.016;lastTime=ms;frameCount++;fpsTime+=dt;if(fpsTime>=1){fps=Math.round(frameCount/fpsTime);frameCount=0;fpsTime=0;}
    const s=sim.state, running=s.mode==='playing'||s.mode==='warping',hangar=s.mode==='hangar';if(s.mode!=='paused')visualTime+=dt;
    if(hangar){shipRoot.position.y=Math.sin(visualTime*.55)*.12;shipRoot.rotation.z=Math.sin(visualTime*.32)*.01;controls.update();}
    else if(running){const ix=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),iy=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
      ray.setFromCamera(pointer,camera);ray.ray.intersectPlane(plane,v1);let aimX=v1.x,aimY=v1.y;
      // Keyboard/touch aim assistance is limited to the forward cone; mouse has fine control.
      let nearest=null,best=Infinity;for(const e of sim.entities){if(e.type!=='drone'||e.z>-9)continue;const dx=e.x-s.x,dy=e.y-s.y;if(!mouseMoved&&Math.abs(dx)<9&&Math.abs(dy)<7){const d=dx*dx+dy*dy;if(d<best){nearest=e;best=d;}}else if(mouseMoved){v2.set(e.x,e.y,e.z).project(camera);const d=(v2.x-pointer.x)**2+(v2.y-pointer.y)**2;if(d<.013&&d<best){nearest=e;best=d;}}}
      if(nearest){const z=Math.max(15,-nearest.z),ratio=100/z;aimX=s.x+(nearest.x-s.x)*ratio;aimY=s.y+(nearest.y-s.y)*ratio;}else if(!mouseMoved){aimX=s.x;aimY=s.y;}
      sim.tick(dt,{x:touchMove?touchMove.x:ix,y:touchMove?touchMove.y:iy,fire:keys.has('Space')||mouseFire||touchFire,boost:keys.has('ShiftLeft')||keys.has('ShiftRight')||touchBoost,aimX,aimY});onEvents();
      shipRoot.position.set(s.x,s.y,0);shipRoot.rotation.z=THREE.MathUtils.damp(shipRoot.rotation.z,-s.vx*.021,7,dt);shipRoot.rotation.x=THREE.MathUtils.damp(shipRoot.rotation.x,s.vy*.014,7,dt);shipRoot.rotation.y=THREE.MathUtils.damp(shipRoot.rotation.y,-s.vx*.007,7,dt);
      shipRoot.visible=!cockpit;launchBlend=Math.min(1,launchBlend+dt*1.1);
      const mobile=container.clientWidth<760;const followX=s.x*.48,followY=s.y*.47;
      v1.set(cockpit?s.x:followX,cockpit?s.y+.62:followY+4.6,cockpit?-2.1:mobile?18.5:14.5);camera.position.lerp(v1,1-Math.exp(-dt*(launchBlend<1?3.4:5)));
      v2.set(cockpit?s.x:s.x*.58,cockpit?s.y+.32:s.y*.6+.4,-45);camera.lookAt(v2);
      camera.fov=THREE.MathUtils.damp(camera.fov,cockpit?70:49+(s.speed-35)*.25,3,dt);camera.updateProjectionMatrix();
      if(!reducedMotion&&shake>.001){camera.position.x+=(rng()-.5)*shake;camera.position.y+=(rng()-.5)*shake*.7;}
      shake*=Math.exp(-dt*5);syncEntities();updateParticles(dt);
      pulseAge+=dt;if(pulseAge<1.4){pulseMesh.scale.setScalar(1+pulseAge*42);pulseMat.opacity=(1-pulseAge/1.4)*.16;}else pulseMesh.visible=false;
      for(let i=0;i<trailCount;i++){const p=trailSeed[i];p.z+=s.speed*dt;if(p.z>17)p.z=-210;const len=s.mode==='warping'?24:(s.speed>44?3.5:.24);trailPos.set([p.x+s.x*.2,p.y+s.y*.2,p.z,p.x+s.x*.2,p.y+s.y*.2,p.z-len],i*6);}trailGeo.attributes.position.needsUpdate=true;trails.material.opacity=s.mode==='warping'?.75:s.speed>44?.24:.12;
      for(let i=0;i<warpRings.length;i++){const r=warpRings[i];r.visible=s.mode==='warping';if(r.visible){r.position.set(s.x,s.y,-90+((s.warp*65+i*22)%120));r.material.opacity=Math.min(.45,s.warp*.17);r.rotation.z=visualTime*.3;}}
    }
    damageFlash*=Math.exp(-dt*4);grade.uniforms.uDamage.value=damageFlash;grade.uniforms.uTime.value=visualTime;grade.uniforms.uWarp.value=s.mode==='warping'?Math.min(1,s.warp*.5):0;
    for(const fx of exhausts)fx.update(visualTime,hangar?.22:s.mode==='warping'?1.6:(s.speed-25)/42);
    world.update(visualTime,s.mode,camera);audio.update(s.speed,running);if(high)composer.render();else renderer.render(scene,camera);
    publishTime+=dt;if(publishTime>.1){publishTime=0;updateMarkers();publish();}
  }
  onBoot('舰载系统就绪');renderer.compile(scene,camera);resize();publish();raf=requestAnimationFrame(frame);
  return {action,dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);ro.disconnect();removers.forEach(fn=>fn());controls.dispose();audio.dispose();targetLayer.remove();clearEntities();const geos=new Set(),mats=new Set(),tex=new Set();function collect(o){if(o.geometry)geos.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)tex.add(v);});}}}scene.traverse(collect);drones.traverse(collect);for(const pool of [dronePool,rockPool,ringsPool])pool.forEach(m=>m.traverse(collect));geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());tex.forEach(t=>t.dispose());world.dispose();composer.passes.forEach(p=>p.dispose?.());composer.dispose();renderer.dispose();renderer.domElement.remove();}};
}
