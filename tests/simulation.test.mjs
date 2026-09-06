import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, RULES, segmentDistanceSquared } from '../game/simulation.mjs';
import { buildPeregrine } from '../game/ship.mjs';
import { Box3, Vector3 } from 'three';

test('swept projectile intersection catches targets between frames',()=>{
  assert.equal(segmentDistanceSquared({x:0,y:0,z:-5},{x:0,y:0,z:0},{x:0,y:0,z:-10}),0);
  assert.equal(segmentDistanceSquared({x:3,y:0,z:-5},{x:0,y:0,z:0},{x:0,y:0,z:-10}),9);
  assert.equal(segmentDistanceSquared({x:0,y:0,z:2},{x:0,y:0,z:0},{x:0,y:0,z:-10}),4);
});
test('pause freezes all mission state; restart clears old entities and inputs',()=>{
  const g=createSimulation();g.start();for(let i=0;i<500;i++)g.tick(1/60,{});
  assert.ok(g.entities.length>0);g.setMode('paused');const before=JSON.stringify(g.state);g.tick(1/60,{fire:true,boost:true,x:1});assert.equal(JSON.stringify(g.state),before);
  g.start();assert.equal(g.state.kills,0);assert.equal(g.state.health,100);assert.equal(g.entities.length,0);assert.equal(g.shots.length,0);
});
test('weapons overheat, lock and recover; boost never produces negative energy',()=>{
  const g=createSimulation();g.start();for(let i=0;i<260;i++)g.tick(1/60,{fire:true,boost:true});assert.ok(g.state.heat<=100);assert.ok(g.state.energy>=0);assert.ok(g.state.overheated);
  for(let i=0;i<220;i++)g.tick(1/60,{});assert.equal(g.state.overheated,false);assert.ok(g.state.heat<30);assert.ok(g.state.energy>0);
});
test('damage grants invulnerability and losing emits exactly one result',()=>{
  const g=createSimulation();g.start();g.state.invincible=0;g.damage(30);assert.equal(g.state.health,70);g.damage(30);assert.equal(g.state.health,70);g.state.invincible=0;g.damage(90);g.damage(90);assert.equal(g.state.mode,'lost');assert.equal(g.state.health,0);assert.equal(g.drainEvents().filter(e=>e.type==='finish').length,1);
});
test('pulse is immediate, respects range and has a cooldown',()=>{
  const g=createSimulation();g.start();g.entities.push({id:991,type:'drone',x:0,y:0,z:-30,hp:2,dead:false},{id:992,type:'drone',x:0,y:0,z:-110,hp:2,dead:false});g.pulse();assert.equal(g.state.kills,1);assert.equal(g.state.pulse,RULES.pulseCooldown);g.pulse();assert.equal(g.state.kills,1);
});
test('repair rings require actually crossing their aperture',()=>{
  const g=createSimulation();g.start();g.state.health=50;g.entities.push({id:993,type:'ring',x:0,y:0,z:-.1,r:3.8,passed:false});g.tick(1/60,{});assert.equal(g.state.health,68);assert.equal(g.state.score,250);
  g.entities.push({id:994,type:'ring',x:20,y:0,z:-.1,r:3.8,passed:false});g.tick(1/60,{});assert.equal(g.state.health,68);
});
test('route alone cannot win; kills plus route trigger cinematic and a single score bonus',()=>{
  const g=createSimulation();g.start();g.state.distance=RULES.route;g.tick(1/60,{});assert.equal(g.state.mode,'playing');g.state.kills=12;g.tick(1/60,{});assert.equal(g.state.mode,'warping');for(let i=0;i<220;i++)g.tick(1/60,{});assert.equal(g.state.mode,'won');const score=g.state.score;g.tick(1/60,{});assert.equal(g.state.score,score);
});
test('headless pilot can finish the complete mission without bypassing combat or damage',()=>{
  const g=createSimulation(8374);g.start();let frames=0;while(frames++<60*260&&g.state.mode!=='won'&&g.state.mode!=='lost'){
    const s=g.state;let x=0,y=0,aimX=s.x,aimY=s.y;const targets=g.entities.filter(e=>e.type==='drone'&&!e.dead&&e.z<-12).sort((a,b)=>b.z-a.z);const t=targets[0];if(t){x=Math.max(-1,Math.min(1,(t.x-s.x)*.5));y=Math.max(-1,Math.min(1,(t.y-s.y)*.5));const ratio=100/-t.z;aimX=s.x+(t.x-s.x)*ratio;aimY=s.y+(t.y-s.y)*ratio;}
    const rock=g.entities.find(e=>e.type==='rock'&&e.z>-23&&e.z<6&&Math.hypot(e.x-s.x,e.y-s.y)<e.r+3);if(rock)x=rock.x>s.x?-1:1;
    if(g.entities.filter(e=>e.type==='drone'&&e.z>-65).length>=2&&s.pulse===0)g.pulse();
    g.tick(1/60,{x,y,fire:!s.overheated,aimX,aimY});g.drainEvents();
  }
  assert.equal(g.state.mode,'won',`pilot result: ${JSON.stringify(g.state)}`);assert.ok(g.state.kills>=12);assert.ok(g.state.health>0);assert.ok(g.state.time<210);
});
test('original model is finite, detailed, bounded and batched for real-time use',()=>{
  const ship=buildPeregrine();assert.ok(ship.userData.parts>=600);assert.ok(ship.children.length<=14);let triangles=0;
  ship.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(const v of p.array)assert.ok(Number.isFinite(v));triangles+=p.count/3;});assert.ok(triangles>30000);const size=new Box3().setFromObject(ship).getSize(new Vector3());assert.ok(size.z>17&&size.z<20);assert.ok(size.x>14&&size.x<16);
  ship.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
});
