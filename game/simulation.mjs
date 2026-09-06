import { seededRandom } from './world.mjs';
export const RULES=Object.freeze({ route:6000, targetKills:12, cruiseSpeed:35, boostSpeed:66, pulseCooldown:12, playerRadius:1.05, maxX:19, maxY:12 });
export function segmentDistanceSquared(p,a,b){const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z;const len=x*x+y*y+z*z;const t=len?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y+(p.z-a.z)*z)/len)):0;return(p.x-a.x-t*x)**2+(p.y-a.y-t*y)**2+(p.z-a.z-t*z)**2;}
export function createSimulation(seed=8374) {
  let random=seededRandom(seed), nextId=1;
  const state={mode:'hangar',health:100,energy:100,heat:0,score:0,kills:0,distance:0,speed:0,time:0,combo:0,notice:'',phase:'穿越碎星带',pulse:0,fps:60,best:0,x:0,y:0,vx:0,vy:0,invincible:0,overheated:false,noticeTime:0,comboTime:0,warp:0};
  let entities=[],shots=[],events=[],enemyTimer=2.2,rockTimer=.8,ringTimer=8,shootTimer=0;
  function emit(type,data={}){events.push({type,...data});}
  function message(text,seconds=3){state.notice=text;state.noticeTime=seconds;}
  function start(){const best=state.best;Object.assign(state,{mode:'playing',health:100,energy:100,heat:0,score:0,kills:0,distance:0,speed:RULES.cruiseSpeed,time:0,combo:0,notice:'WASD 移动 · 按住空格开火 · 青色导航环可修复舰体',noticeTime:6,phase:'穿越碎星带',pulse:0,best,x:0,y:0,vx:0,vy:0,invincible:2,overheated:false,comboTime:0,warp:0});entities=[];shots=[];events=[];random=seededRandom(seed);nextId=1;enemyTimer=2.2;rockTimer=.8;ringTimer=6;shootTimer=0;emit('start');}
  function damage(amount){if(state.invincible>0||state.mode!=='playing')return;state.health=Math.max(0,state.health-amount);state.invincible=.9;state.combo=0;emit('damage',{amount});if(state.health<=0)finish(false);else if(state.health<30)message('舰体受损 · 穿过青色导航环进行修复');}
  function finish(won){if(state.mode!=='playing'&&state.mode!=='warping')return;state.mode=won?'won':'lost';if(won)state.score+=Math.round(state.health*12)+2000;state.best=Math.max(state.best,state.score);emit('finish',{won});}
  function destroy(e){if(e.dead)return;e.dead=true;emit('explosion',{x:e.x,y:e.y,z:e.z,kind:e.type});if(e.type==='drone'){state.kills++;state.combo=state.comboTime>0?Math.min(5,state.combo+1):1;state.comboTime=4;state.score+=150*state.combo;if(state.kills===12)message('威胁清除达标 · 前往跃迁点');}else state.score+=35;}
  function pulse(){if(state.mode!=='playing'||state.pulse>0)return;state.pulse=RULES.pulseCooldown;emit('pulse');message('相位冲击波释放',1.4);for(const e of entities){if(e.z>-80&&e.z<10&&Math.hypot(e.x-state.x,e.y-state.y)<25){if(e.type==='drone'||e.type==='rock')destroy(e);else if(e.type==='enemyShot')e.dead=true;}}}
  function spawn(type,params){const e={id:nextId++,type,dead:false,...params};entities.push(e);return e;}
  function tick(dt,input={}) {
    if(state.mode==='warping'){state.warp+=dt;state.speed+=(220-state.speed)*Math.min(1,dt*2);if(state.warp>=3.4)finish(true);return;}
    if(state.mode!=='playing')return;
    dt=Math.min(dt,.05);state.time+=dt;state.invincible=Math.max(0,state.invincible-dt);state.pulse=Math.max(0,state.pulse-dt);state.comboTime=Math.max(0,state.comboTime-dt);if(!state.comboTime)state.combo=0;
    state.noticeTime-=dt;if(state.noticeTime<=0)state.notice='';
    const boost=!!input.boost&&state.energy>1;
    state.energy=Math.min(100,Math.max(0,state.energy+(boost?-29:14)*dt));
    state.speed+=((boost?RULES.boostSpeed:RULES.cruiseSpeed)-state.speed)*Math.min(1,dt*3);
    state.distance+=state.speed*dt;
    const ax=Math.max(-1,Math.min(1,input.x||0)),ay=Math.max(-1,Math.min(1,input.y||0));const norm=Math.max(1,Math.hypot(ax,ay));
    state.vx+=(ax/norm*20-state.vx)*Math.min(1,dt*7);state.vy+=(ay/norm*16-state.vy)*Math.min(1,dt*7);
    state.x=Math.max(-RULES.maxX,Math.min(RULES.maxX,state.x+state.vx*dt));state.y=Math.max(-RULES.maxY,Math.min(RULES.maxY,state.y+state.vy*dt));
    const phase=state.distance<1800?0:state.distance<3900?1:2;
    const nextPhase=['穿越碎星带','突破无人机封锁','前往跃迁坐标'][phase];if(state.phase!==nextPhase){state.phase=nextPhase;message(['','侦测到拦截机群 · 准备交战','跃迁坐标已锁定 · 保持航向'][phase]);}
    if(state.distance>=RULES.route&&state.kills>=RULES.targetKills){state.mode='warping';state.warp=0;state.phase='跃迁引擎启动';message('坐标确认 · 跃迁引擎充能',4);emit('warp');return;}
    if(state.distance>=RULES.route&&state.kills<RULES.targetKills){state.distance=RULES.route;state.phase=`清除剩余威胁 · ${RULES.targetKills-state.kills} 架`;}
    shootTimer-=dt;state.heat=Math.max(0,state.heat-(input.fire&&!state.overheated?7:29)*dt);
    if(state.overheated&&state.heat<30){state.overheated=false;message('脉冲炮冷却完成',1.3);}
    if(input.fire&&!state.overheated&&shootTimer<=0){shootTimer=.16;state.heat=Math.min(100,state.heat+6.2);const aim={x:Number.isFinite(input.aimX)?input.aimX:state.x,y:Number.isFinite(input.aimY)?input.aimY:state.y,z:-100};for(const side of [-1,1]){const x=state.x+side*.67,y=state.y+.32,z=-1.6;const d=Math.hypot(aim.x-x,aim.y-y,aim.z-z);shots.push({id:nextId++,x,y,z,px:x,py:y,pz:z,vx:(aim.x-x)/d*190,vy:(aim.y-y)/d*190,vz:(aim.z-z)/d*190,dead:false});}emit('fire');if(state.heat>=100){state.overheated=true;message('炮管过热 · 松开开火进行冷却',2);}}
    enemyTimer-=dt;rockTimer-=dt;ringTimer-=dt;
    if(enemyTimer<=0){enemyTimer=(phase===0?3.5:phase===1?1.9:1.6)+random()*.8;const count=phase===0?1:2;for(let i=0;i<count;i++){const x=(random()-.5)*27,y=(random()-.5)*16;spawn('drone',{x,y,z:-145-i*9,originX:x,originY:y,r:1.65,hp:2,life:0,shotTimer:2+random()*2,phase:random()*6.28});}}
    if(rockTimer<=0){rockTimer=.78+random()*.8;spawn('rock',{x:(random()-.5)*49,y:(random()-.5)*29,z:-175,r:1.2+random()*2.4,hp:5,rotation:random()*6,spin:(random()-.5)*.5});}
    if(ringTimer<=0){ringTimer=11;spawn('ring',{x:(random()-.5)*23,y:(random()-.5)*12,z:-150,r:3.8,passed:false});}
    for(const e of entities){if(e.dead)continue;const old={x:e.x,y:e.y,z:e.z};
      if(e.type==='enemyShot'){e.x+=e.vx*dt;e.y+=e.vy*dt;e.z+=e.vz*dt;if(segmentDistanceSquared({x:state.x,y:state.y,z:0},old,e)<(RULES.playerRadius+.28)**2){damage(11);e.dead=true;}}
      else {e.z+=state.speed*dt;if(e.type==='drone'){e.life+=dt;e.x=e.originX+Math.sin(e.life*.8+e.phase)*3.3;e.y=e.originY+Math.cos(e.life*.9+e.phase)*1.9;e.z-=17*dt;e.shotTimer-=dt;if(e.shotTimer<=0&&e.z<-9&&e.z>-100){e.shotTimer=2.6+random();const dx=state.x-e.x,dy=state.y-e.y,dz=-e.z,d=Math.hypot(dx,dy,dz);spawn('enemyShot',{x:e.x,y:e.y,z:e.z,vx:dx/d*58,vy:dy/d*58,vz:dz/d*58,r:.28});}}
        if(e.type==='ring'){if(!e.passed&&old.z<0&&e.z>=0){e.passed=true;if(Math.hypot(e.x-state.x,e.y-state.y)<e.r){state.health=Math.min(100,state.health+18);state.energy=Math.min(100,state.energy+32);state.score+=250;e.dead=true;emit('repair');message('航道校准 +250 · 舰体修复 +18',2);}}}
        else if(segmentDistanceSquared({x:state.x,y:state.y,z:0},old,e)<(RULES.playerRadius+e.r)**2){damage(e.type==='rock'?24:19);e.dead=true;emit('explosion',{x:e.x,y:e.y,z:e.z,kind:e.type});}
      }if(e.z>22||e.z<-210)e.dead=true;
    }
    for(const shot of shots){if(shot.dead)continue;const old={x:shot.x,y:shot.y,z:shot.z};shot.px=shot.x;shot.py=shot.y;shot.pz=shot.z;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.z+=shot.vz*dt;
      // Swept segment prevents tunneling at low frame rates.
      let closest=null, closestZ=-Infinity;for(const e of entities){if(e.dead||(e.type!=='rock'&&e.type!=='drone'))continue;if(segmentDistanceSquared(e,old,shot)<(e.r+.25)**2&&e.z>closestZ){closest=e;closestZ=e.z;}}
      if(closest){closest.hp--;shot.dead=true;emit('hit',{x:closest.x,y:closest.y,z:closest.z});if(closest.hp<=0)destroy(closest);}if(shot.z<-200)shot.dead=true;
    }
    entities=entities.filter(e=>!e.dead);shots=shots.filter(s=>!s.dead);
  }
  return {state,start,tick,pulse,damage,get entities(){return entities;},get shots(){return shots;},drainEvents(){const out=events;events=[];return out;},setMode(mode){state.mode=mode;},message};
}
