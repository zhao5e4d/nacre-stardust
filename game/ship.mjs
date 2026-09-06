import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original P–04 Peregrine. All dimensions and surfaces are authored here.
// Forward is -Z. Fine parts are baked into material batches to keep draw calls low.
export function buildPeregrine() {
  const root = new THREE.Group(); root.name = 'Peregrine_Mk_IV';
  const mats = {
    armor: new THREE.MeshStandardMaterial({ color: 0xcbd6d3, metalness: .58, roughness: .31 }),
    secondary: new THREE.MeshStandardMaterial({ color: 0x7e969b, metalness: .75, roughness: .37 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x162733, metalness: .78, roughness: .42 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x354650, metalness: .85, roughness: .32 }),
    silver: new THREE.MeshStandardMaterial({ color: 0x9eabb1, metalness: .95, roughness: .24 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xad794d, metalness: .8, roughness: .32 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xca653b, metalness: .4, roughness: .44 }),
    black: new THREE.MeshStandardMaterial({ color: 0x060e17, metalness: .36, roughness: .54 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x153f50, metalness: .72, roughness: .12, clearcoat: 1, clearcoatRoughness: .08, emissive: 0x0d3340, emissiveIntensity: .23 }),
    light: new THREE.MeshStandardMaterial({ color: 0x93ebdf, emissive: 0x66ffdf, emissiveIntensity: 3.2, metalness: .2, roughness: .3 }),
    warm: new THREE.MeshStandardMaterial({ color: 0xffc17e, emissive: 0xff952d, emissiveIntensity: 2.7 }),
    red: new THREE.MeshStandardMaterial({ color: 0xfd5b48, emissive: 0xff3020, emissiveIntensity: 2.1 }),
  };
  Object.entries(mats).forEach(([name, m]) => m.name = `P04_${name}`);
  const buckets = new Map(Object.keys(mats).map(k => [k, []]));
  let parts = 0;
  function bake(geo, mat, pos = [0,0,0], rot = [0,0,0], scale = [1,1,1]) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    geo.applyMatrix4(matrix); buckets.get(mat).push(geo); parts++;
  }
  function box(w,h,d,x,y,z,m='frame',rx=0,ry=0,rz=0) { bake(new THREE.BoxGeometry(w,h,d),m,[x,y,z],[rx,ry,rz]); }
  function tube(r1,r2,len,x,y,z,m='silver',axis='z',segments=16) { bake(new THREE.CylinderGeometry(r1,r2,len,segments),m,[x,y,z],axis==='z'?[Math.PI/2,0,0]:axis==='x'?[0,0,Math.PI/2]:[0,0,0]); }
  function ring(radius, thick, x,y,z,m='silver', axis='z') { bake(new THREE.TorusGeometry(radius,thick,6,32),m,[x,y,z],axis==='y'?[Math.PI/2,0,0]:axis==='x'?[0,Math.PI/2,0]:[0,0,0]); }
  function beam(a,b,r,m='silver') {
    const va=new THREE.Vector3(...a), vb=new THREE.Vector3(...b), diff=vb.clone().sub(va);
    const g=new THREE.CylinderGeometry(r,r,diff.length(),8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),diff.normalize()));
    g.translate(...va.add(vb).multiplyScalar(.5).toArray()); buckets.get(m).push(g); parts++;
  }
  function plate(points,y,depth,mat='armor',bevel=.06) {
    const shape = new THREE.Shape(); points.forEach(([x,z],i) => i ? shape.lineTo(x,-z) : shape.moveTo(x,-z)); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel>0, bevelSegments: 2, steps:1, bevelSize:bevel, bevelThickness:bevel, curveSegments:1 });
    bake(g,mat,[0,y,0],[-Math.PI/2,0,0]);
  }
  function mirroredPlate(points,y,d,m='armor',b=.06) { plate(points,y,d,m,b); plate(points.map(([x,z])=>[-x,z]).reverse(),y,d,m,b); }
  function bolt(x,y,z) { tube(.047,.047,.036,x,y,z,'silver','y',6); }
  function hatch(x,y,z,w,d) { box(w,.065,d,x,y,z,'dark'); box(w*.88,.07,d*.88,x,y+.043,z,'secondary'); for(const sx of [-1,1])for(const sz of [-1,1])bolt(x+sx*w*.37,y+.095,z+sz*d*.37); }
  function grille(x,y,z,w,d,n=9) { box(w,.06,d,x,y,z,'black'); for(let k=0;k<n;k++)box(w*.92,.04,.045,x,y+.04,z-d*.44+k*d*.88/(n-1),'silver',.18); }

  // Keel, carbon underbody and broad, stepped armour silhouette.
  plate([[-.16,-10.4],[-.85,-8.6],[-1.72,-4.7],[-1.85,.4],[-1.45,6.9],[1.45,6.9],[1.85,.4],[1.72,-4.7],[.85,-8.6],[.16,-10.4]],-.55,.8,'dark',.12);
  plate([[-.15,-10.45],[-.58,-8.7],[-.65,-5],[-.65,5.6],[.65,5.6],[.65,-5],[.58,-8.7],[.15,-10.45]],-.88,.34,'frame',.06);
  mirroredPlate([[.12,-10.1],[.66,-8.5],[1.35,-5.4],[.8,-4.4],[.12,-4.75]],.28,.28,'armor',.06);
  mirroredPlate([[.18,-9.2],[.48,-8.55],[1.13,-5.6],[.84,-5.12],[.18,-5.5]],.60,.06,'secondary',.02);
  mirroredPlate([[.34,-8.6],[.48,-8.1],[.95,-5.88],[.77,-5.67]],.685,.015,'armor',.01);
  box(.09,.05,3.9,0,.68,-7.04,'dark');
  for(let i=0;i<13;i++)box(.055,.017,.065,0,.711,-8.85+i*.29,'light');
  mirroredPlate([[1.12,-5.05],[1.75,-4.2],[2.0,-.8],[1.65,.4],[1.13,-.4]],.18,.35,'armor',.1);
  mirroredPlate([[1.19,-4.5],[1.63,-3.95],[1.83,-1.14],[1.6,-.63],[1.26,-1.1]],.64,.09,'armor',.035);
  mirroredPlate([[.93,.0],[1.69,.6],[1.36,6.4],[.7,6.72],[.68,1.5]],.25,.38,'armor',.09);
  plate([[-.85,-4.72],[-1.08,-3.55],[-.85,-1.6],[.85,-1.6],[1.08,-3.55],[.85,-4.72]],.45,.42,'dark',.08);
  // Recessed blue glass cockpit and its separate metal mullions.
  plate([[-.58,-4.53],[-.84,-3.46],[-.65,-2.04],[.65,-2.04],[.84,-3.46],[.58,-4.53]],.89,.27,'glass',.1);
  beam([0,1.30,-4.49],[0,1.30,-2.07],.036,'silver');
  beam([-.78,1.24,-3.44],[.78,1.24,-3.44],.035,'frame');
  for(const s of [-1,1]) { beam([s*.56,1.27,-4.5],[s*.78,1.27,-3.47],.046,'armor'); beam([s*.78,1.27,-3.47],[s*.60,1.27,-2.07],.046,'armor'); }
  box(1.38,.055,.1,0,1.245,-2.02,'frame');
  plate([[-.64,-1.65],[-.92,-.2],[-.68,2.5],[.68,2.5],[.92,-.2],[.64,-1.65]],.67,.37,'armor',.08);
  for(let i=0;i<4;i++) hatch(0,1.135,-.93+i*.7,.77,.43);
  tube(.63,.75,.16,0,.99,3.08,'dark','y',32); ring(.52,.045,0,1.11,3.08,'copper','y');
  tube(.37,.37,.1,0,1.12,3.08,'glass','y',24);
  for(let i=0;i<12;i++){const a=i*Math.PI/6; box(.085,.055,.13,Math.cos(a)*.48,1.18,3.08+Math.sin(a)*.48,'light',0,-a);}
  hatch(0,.89,4.62,1.06,1.45); grille(0,1.0,4.62,.76,1.18,15);
  // Split wings are tapered polygons rather than scaled boxes.
  mirroredPlate([[1.5,-2.2],[2.4,-1.8],[6.58,2.28],[7.3,5.15],[5.58,4.96],[2.48,2.22],[1.58,2.64]],-.34,.3,'dark',.1);
  mirroredPlate([[1.66,-1.95],[2.38,-1.43],[5.95,2.3],[5.48,3.27],[3.8,2.05],[1.61,.66]],.06,.21,'armor',.07);
  mirroredPlate([[2.4,-1.21],[3.28,-.3],[5.54,2.42],[5.13,2.79],[3.51,1.07]],.345,.045,'secondary',.016);
  mirroredPlate([[1.84,1.02],[3.52,1.78],[5.54,3.58],[6.26,4.81],[5.76,4.75],[3.46,2.97],[1.8,2.22]],-.02,.16,'armor',.04);
  mirroredPlate([[5.98,2.58],[6.59,2.68],[7.08,4.94],[6.59,4.76]],-.04,.21,'armor',.035);
  mirroredPlate([[6.58,3.35],[6.72,3.45],[6.96,4.54],[6.77,4.42]],.21,.016,'orange',.008);
  // Engine outriggers with layered nose caps, exposed turbine cores and service hardware.
  for(const s of [-1,1]) {
    const x=s*3.84;
    beam([s*1.25,-.05,1.5],[x,-.03,3.3],.20,'frame');
    beam([s*1.26,-.08,4.9],[x,-.03,5.9],.18,'frame');
    beam([s*1.3,.12,1.5],[x,.12,3.3],.068,'copper');
    beam([s*1.3,.12,5.1],[x,.12,5.9],.08,'silver');
    tube(.76,.76,7.6,x,.1,3.2,'dark');
    tube(.60,.73,1.34,x,.1,-1.19,'frame');
    ring(.64,.10,x,.1,-1.58,'armor');
    tube(.45,.52,.14,x,.1,-1.66,'black');
    tube(.23,.36,.18,x,.1,-1.77,'glass');
    ring(.31,.024,x,.1,-1.88,'light');
    for(let q=0;q<8;q++){const a=q*Math.PI/4; beam([x+Math.cos(a)*.33,.1+Math.sin(a)*.33,-1.80],[x+Math.cos(a)*.54,.1+Math.sin(a)*.54,-1.63],.028,'silver');}
    for(let j=0;j<5;j++) {
      const z=-.63+j*1.22;
      plate([[x-.68,z-.42],[x-.40,z-.55],[x+.4,z-.55],[x+.68,z-.32],[x+.66,z+.48],[x-.66,z+.48]],.6,.22,j===3?'secondary':'armor',.045);
      box(.075,.13,.86,x+s*.12,.945,z,'orange');
      for(const a of [-1,1]) {
        box(.17,.62,.94,x+a*.74,.12,z,'armor',0,0,a*.12);
        box(.03,.05,.7,x+a*.846,.3,z,'dark');
        bolt(x+a*.43,.89,z-.29); bolt(x+a*.43,.89,z+.31);
      }
      ring(.765,.035,x,.1,z+.58,'frame');
    }
    for(let j=0;j<12;j++) {
      const z=4.85+j*.16;
      ring(.7,.037,x,.1,z,'silver');
      if(j%3===0)ring(.745,.027,x,.1,z,'copper');
    }
    tube(.91,.72,.65,x,.1,7.0,'frame');
    ring(.85,.065,x,.1,7.25,'armor'); ring(.70,.052,x,.1,7.39,'copper');
    tube(.59,.63,.15,x,.1,7.30,'black');
    tube(.49,.49,.03,x,.1,7.42,'light'); ring(.49,.035,x,.1,7.46,'silver');
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      box(.16,.22,.67,x+Math.sin(a)*.79,.1+Math.cos(a)*.79,7.05,'secondary',0,0,-a);
      beam([x+Math.sin(a)*.18,.1+Math.cos(a)*.18,7.47],[x+Math.sin(a)*.45,.1+Math.cos(a)*.45,7.47],.018,'silver');
    }
    // External bypass pipes and brackets.
    beam([x+s*.8,.04,.15],[x+s*.8,.04,4.6],.06,'copper');
    for(let j=0;j<7;j++)box(.18,.2,.11,x+s*.8,.04,.2+j*.68,'frame');
    grille(x,.925,3.8,1.06,.9,12);
    // Outboard heat radiator, slats and navigation lights.
    box(.6,.11,2.0,s*5.40,.04,3.30,'dark');
    for(let j=0;j<18;j++)box(.68,.10,.047,s*5.40,.13,2.4+j*.105,j%5===0?'copper':'silver');
    box(.055,.05,1.12,s*6.65,.23,3.98,'light',0,-s*.24);
    bake(new THREE.SphereGeometry(.075,10,8),s<0?'red':'light',[s*7.0,.2,4.64]);
    // Thin wing support rods provide negative space at oblique viewing angles.
    beam([s*2.04,-.17,1.9],[s*5.82,-.17,4.3],.06,'silver');
    beam([s*2.13,-.17,1.3],[s*5.79,-.17,4.29],.06,'silver');
    for(let j=0;j<5;j++) {
      const xx=s*(2.28+j*.55), zz=2.2+j*.40;
      box(.32,.08,.50,xx,-.16,zz,'frame',0,-s*.7);
    }
    // Dual articulated railguns.
    const tx=s*2.04, tz=-3.0;
    tube(.42,.54,.24,tx,.66,tz,'dark','y',16);
    tube(.35,.38,.15,tx,.86,tz,'silver','y',16);
    box(.66,.32,.87,tx,1.09,tz,'armor'); box(.28,.07,.6,tx,1.295,tz,'dark');
    for(const a of [-1,1]) {
      tube(.078,.11,2.3,tx+a*.19,1.08,tz-1.4,'silver');
      tube(.15,.15,.21,tx+a*.19,1.08,tz-2.42,'dark', 'z',8);
      tube(.061,.061,.025,tx+a*.19,1.08,tz-2.54,'light');
      for(let r=0;r<5;r++)tube(.105,.105,.075,tx+a*.19,1.08,tz-.45-r*.29,'frame','z',8);
    }
    // Inner fuselage recesses full of cable conduits and varied access covers.
    for(let k=0;k<11;k++) {
      const z=-.85+k*.59;
      box(.31,.075,.42,s*1.12,.73,z,'dark');
      box(.23,.036,.29,s*1.12,.79,z,k%4===0?'copper':'frame');
      if(k%2===0)box(.05,.035,.12,s*1.12,.823,z,'light');
      beam([s*1.51,.28,z-.13],[s*1.67,.16,z+.19],.034,'silver');
    }
    beam([s*.94,.55,.14],[s*.94,.55,5.71],.032,'copper');
    for(let i=0;i<10;i++) {
      box(.14,.065,.055,s*.93,.59,.1+i*.57,'frame');
      box(.09,.045,.16,s*1.49,.19,1+i*.46,'light');
    }
    for(let k=0;k<6;k++) {
      const z=-8.35+k*.5, xx=s*(.5+k*.12);
      bolt(xx,.745,z); box(.045,.024,.13,xx+s*.07,.735,z+.10,'dark');
    }
    // Landing pods and abdominal mechanical detail.
    box(.6,.24,2.4,s*1.11,-.68,2.67,'frame');
    for(let k=0;k<5;k++)tube(.16,.16,.45,s*1.11,-.87,1.72+k*.45,'dark','x',12);
    box(.35,.12,1.6,s*.94,-1.0,-3.1,'secondary');
    beam([s*1.2,-.68,-4.5],[s*1.2,-.68,-.4],.07,'copper');
    // Swept aft stabilizers, real solid geometry standing above the hull.
    const finPts = [[-.05,-1],[.92,.6],[.7,2.6],[-.05,1.9]];
    const finShape=new THREE.Shape(); finPts.forEach(([z,y],i)=>i?finShape.lineTo(z,y):finShape.moveTo(z,y));finShape.closePath();
    const fg=new THREE.ExtrudeGeometry(finShape,{depth:.10,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1});
    bake(fg,'armor',[s*1.3,.25,4.62],[0,-Math.PI/2,s*.14]);
    beam([s*1.3,1.5,4.1],[s*1.45,2.3,4.55],.025,'orange');
  }
  // Aft auxiliary drive, sensor mast and bow antennae.
  for(const s of [-1,1]) { tube(.31,.4,.66,s*.71,-.13,6.85,'dark');ring(.32,.045,s*.71,-.13,7.18,'silver');tube(.24,.24,.02,s*.71,-.13,7.21,'light'); }
  box(.35,.26,.47,0,1.1,1.53,'frame'); tube(.055,.11,.8,0,1.58,1.53,'silver','y');
  box(.46,.19,.10,0,1.93,1.53,'armor');box(.28,.08,.015,0,1.94,1.465,'light');
  for(const s of [-1,1]){beam([s*.3,.31,-9.22],[s*.37,.23,-10.55],.023,'silver');bake(new THREE.SphereGeometry(.04,8,6),'warm',[s*.37,.23,-10.56]);}
  // Asymmetrical orange ID band, chevrons and service marks.
  for(let j=0;j<3;j++)box(.3,.028,.055,-1.56,.70,-3.37+j*.19,'orange',0,-.18);
  for(let j=0;j<4;j++)box(.14,.025,.03,.3+j*.15,1.065,.9,'dark');
  for(let j=0;j<7;j++)box(.028,.028,.13,-.47+j*.15,.986,5.09,j%2?'orange':'dark');

  for(const [key, geos] of buckets) {
    if(!geos.length)continue;
    const flat=geos.map(g => {const n=g.index?g.toNonIndexed():g;const p=n.getAttribute('position');if(!n.getAttribute('uv'))n.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2));return n;});
    const geometry=mergeGeometries(flat,false); geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,mats[key]);mesh.name=`P04_${key}_batch`;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    new Set([...geos,...flat]).forEach(g=>g.dispose());
  }
  root.userData = { author:'NACRE / original procedural hard-surface design', parts, lengthMeters:42.8, forward:'-Z', engineSockets:[[-3.84,.1,7.48],[3.84,.1,7.48],[-.71,-.13,7.25],[.71,-.13,7.25]], gunSockets:[[-2.04,1.08,-5.6],[2.04,1.08,-5.6]] };
  return root;
}

export function setShipPalette(ship, palette) {
  const themes={ceramic:[0xcbd6d3,0x7e969b,0xca653b],graphite:[0x354c61,0x738c98,0xbee7db],rescue:[0xc46939,0xd0c7b0,0x20343e]};
  const colors=themes[palette] || themes.ceramic;
  ship.traverse(o=>{if(!o.isMesh)return;const n=o.material.name;if(n==='P04_armor')o.material.color.setHex(colors[0]);if(n==='P04_secondary')o.material.color.setHex(colors[1]);if(n==='P04_orange')o.material.color.setHex(colors[2]);});
}
