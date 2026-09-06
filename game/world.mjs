import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const noise = `
float hash(vec3 p){ p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*noise3(p);p=p*2.03+vec3(9.1,2.8,6.3);a*=.5;}return f;}
`;
export function seededRandom(seed=73521) {return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function createWorld(scene, renderer) {
  const rng=seededRandom(8832);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const room=new RoomEnvironment(); const env=pmrem.fromScene(room,.025);scene.environment=env.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
  const key=new THREE.DirectionalLight(0xd5edeb,4.2);key.position.set(-12,22,-15);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-16;key.shadow.camera.right=16;key.shadow.camera.top=16;key.shadow.camera.bottom=-16;key.shadow.camera.far=85;key.shadow.normalBias=.035;key.shadow.bias=-.00025;scene.add(key);
  const rim=new THREE.DirectionalLight(0x71dbe4,3);rim.position.set(9,8,20);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xffc597,1.3);fill.position.set(-20,-4,8);scene.add(fill);
  const ambient=new THREE.HemisphereLight(0xa2dcf4,0x101a24,.65);scene.add(ambient);
  const background=new THREE.Group();scene.add(background);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(950,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDir;${noise}
    void main(){vec3 d=normalize(vDir);float f=fbm(d*4.3+vec3(3.4,8.1,1.7));float h=fbm(d*10.+f*2.);float band=exp(-abs(d.y+.22*d.x-.06)*5.);vec3 col=vec3(.009,.019,.03);col+=vec3(.022,.07,.078)*pow(f,2.)*band*2.2;col+=vec3(.14,.058,.024)*pow(h,3.)*band;col*=.8+noise3(d*95.)*.35;gl_FragColor=vec4(col,1.);}` }));background.add(sky);
  const starPos=[],starCol=[];
  for(let i=0;i<3200;i++) {const u=rng()*2-1,a=rng()*Math.PI*2, rr=600+rng()*140;starPos.push(Math.sqrt(1-u*u)*Math.cos(a)*rr,u*rr,Math.sqrt(1-u*u)*Math.sin(a)*rr);const c=new THREE.Color().setHSL(.52+rng()*.15,.1+rng()*.25,.35+rng()*.55);starCol.push(c.r,c.g,c.b);}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.Float32BufferAttribute(starCol,3));
  const starMat=new THREE.PointsMaterial({size:1.3,vertexColors:true,transparent:true,opacity:.78,sizeAttenuation:false,depthWrite:false});const stars=new THREE.Points(starGeo,starMat);background.add(stars);
  const planet=new THREE.Group();planet.position.set(30,28,94);background.add(planet);
  const planetBody=new THREE.Mesh(new THREE.SphereGeometry(45,80,64),new THREE.ShaderMaterial({vertexShader:`varying vec3 vNormal;varying vec3 vPos;void main(){vNormal=normal;vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vNormal;varying vec3 vPos;${noise}
    void main(){vec3 p=normalize(vPos);float f=fbm(p*8.);float bands=sin((p.y+fbm(p*3.)*.14)*70.)*.5+.5;vec3 col=mix(vec3(.035,.085,.10),vec3(.22,.36,.35),f);col=mix(col,vec3(.39,.48,.40),pow(bands,5.)*.22);float sun=pow(max(0.,dot(normalize(vNormal),normalize(vec3(-.6,.55,-1.)))),.6);col*=.07+sun*.85;gl_FragColor=vec4(col,1.);}` }));planet.add(planetBody);
  const atmo=new THREE.Mesh(new THREE.SphereGeometry(45.7,64,48),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 n;varying vec3 v;void main(){float a=pow(1.-abs(dot(n,v)),3.7);gl_FragColor=vec4(.23,.6,.62,a*.38);}` }));planet.add(atmo);
  const ring=new THREE.Mesh(new THREE.RingGeometry(59,81,160),new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,vertexShader:`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 p;void main(){float r=length(p.xy);float s=sin(r*7.)*.2+sin(r*31.)*.12+.4;float e=smoothstep(59.,61.,r)*(1.-smoothstep(78.,81.,r));gl_FragColor=vec4(.35,.46,.43,s*e*.22);}` }));ring.rotation.x=1.25;ring.rotation.z=-.3;planet.add(ring);

  // Distant debris stays cosmetic; the simulation owns all collidable asteroids.
  const rockGeo=new THREE.IcosahedronGeometry(1,1);const rockPos=rockGeo.attributes.position;for(let i=0;i<rockPos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(rockPos,i);v.multiplyScalar(.8+.3*Math.sin(v.x*19+v.z*13)*Math.cos(v.y*17));rockPos.setXYZ(i,v.x,v.y,v.z);}rockGeo.computeVertexNormals();
  const rockMat=new THREE.MeshStandardMaterial({color:0x58615c,roughness:.98,metalness:.08,flatShading:true});
  const rubble=new THREE.InstancedMesh(rockGeo,rockMat,160);const dummy=new THREE.Object3D();
  for(let i=0;i<160;i++){const a=rng()*Math.PI*2,rr=46+rng()*65;dummy.position.set(Math.sin(a)*rr,(rng()-.5)*27-11,Math.cos(a)*rr);dummy.rotation.set(rng()*6,rng()*6,rng()*6);dummy.scale.setScalar(.18+rng()*1.1);dummy.updateMatrix();rubble.setMatrixAt(i,dummy.matrix);}rubble.instanceMatrix.needsUpdate=true;scene.add(rubble);
  return { background,planet,rubble,key,rim,rockGeo,rockMat,update(t,mode,camera){background.position.copy(camera.position).multiplyScalar(.04);planetBody.rotation.y=t*.004;rubble.rotation.y=t*.0015;rubble.visible=mode==='hangar';if(mode!=='hangar'){planet.position.set(-165,72,-420);planet.scale.setScalar(2.2);}else{planet.position.set(30,28,94);planet.scale.setScalar(1);}},dispose(){env.dispose();} };
}

export function createDrone() {
  const root=new THREE.Group();const hull=new THREE.MeshStandardMaterial({color:0x6b777a,metalness:.8,roughness:.42});
  const dark=new THREE.MeshStandardMaterial({color:0x17202a,metalness:.65,roughness:.4});
  const red=new THREE.MeshStandardMaterial({color:0xfa7961,emissive:0xff4727,emissiveIntensity:3});
  const body=new THREE.Mesh(new THREE.OctahedronGeometry(.95,1),dark);body.scale.set(1,.5,1.7);root.add(body);
  for(const s of [-1,1]) {
    const wing=new THREE.Mesh(new THREE.BoxGeometry(1.2,.14,1.8),hull);wing.position.set(s*1.02,0,.2);wing.rotation.z=-s*.27;wing.rotation.y=s*.3;root.add(wing);
    const gun=new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,1.8,8),dark);gun.rotation.x=Math.PI/2;gun.position.set(s*.85,-.2,-.4);root.add(gun);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(.13,.12,.85),red);lamp.position.set(s*1.39,.09,.1);root.add(lamp);
    const engine=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.3,12),red);engine.rotation.x=Math.PI/2;engine.position.set(s*.55,0,1.33);root.add(engine);
  }
  const eye=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),red);eye.position.set(0,.13,-1.02);root.add(eye);return root;
}

export function createExhaust() {
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uPower:{value:.25}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float uTime;uniform float uPower;void main(){float z=vUv.y;float w=abs(vUv.x-.5)*2.;float taper=(1.-z)*.84+.10;float core=exp(-w*w/(taper*taper)*7.);float cells=.7+.3*sin(z*43.-uTime*17.);float a=core*pow(1.-z,1.5)*cells;vec3 c=mix(vec3(.11,.65,.83),vec3(.55,1.,.89),core);gl_FragColor=vec4(c*2.,a*(.48+uPower*.5));}`});
  // Local plane bottom is nozzle, increasing UV.y points along +Z.
  const geo=new THREE.PlaneGeometry(1.35,1,1,1);geo.rotateX(Math.PI/2);geo.translate(0,0,.5);
  const root=new THREE.Group();for(const angle of [0,Math.PI/2,Math.PI/4,-Math.PI/4]){const p=new THREE.Mesh(geo,material);p.rotation.z=angle;root.add(p);}
  return {root,material,update(t,power){material.uniforms.uTime.value=t;material.uniforms.uPower.value=power;root.scale.z=2.8+power*5.0;root.scale.x=root.scale.y=.85+power*.13;}};
}
