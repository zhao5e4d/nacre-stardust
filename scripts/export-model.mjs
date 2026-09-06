import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Box3, Vector3 } from 'three';
import { buildPeregrine } from '../game/ship.mjs';

// GLTFExporter only needs FileReader for binary blobs in this texture-free model.
globalThis.FileReader=class FileReader {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result=`data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;this.onloadend?.();});}
};
const ship=buildPeregrine();ship.updateMatrixWorld(true);
const dimensions=new Box3().setFromObject(ship).getSize(new Vector3());
let triangles=0;ship.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
const binary=await new GLTFExporter().parseAsync(ship,{binary:true,onlyVisible:true});
await mkdir(new URL('../public/models/',import.meta.url),{recursive:true});
await writeFile(new URL('../public/models/peregrine.glb',import.meta.url),Buffer.from(binary));
const stats={name:ship.name,parts:ship.userData.parts,triangles,drawCalls:ship.children.length,dimensions:dimensions.toArray(),bytes:binary.byteLength};
await writeFile(new URL('../public/models/peregrine.info.json',import.meta.url),JSON.stringify(stats,null,2)+'\n');
console.log(JSON.stringify(stats,null,2));
