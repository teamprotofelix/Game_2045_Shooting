const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function game({storageThrows=false, best=null}={}) {
  const elements = new Map();
  const draws = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, {textContent:'',dataset:{},listeners:{},width:480,height:800,classList:{add(){},remove(){}},addEventListener(type,fn){this.listeners[type]=fn;},getBoundingClientRect(){return {left:0,top:0,width:480,height:800};},getContext(){return {save(){},restore(){},drawImage(...args){draws.push(args);},createLinearGradient(){return {addColorStop(){}};},fillRect(){}};}});
    return elements.get(id);
  };
  const document = {getElementById:element,addEventListener(){}};
  const context = vm.createContext({document,window:{addEventListener(){}},Image:class {set src(v) {this.onload();}},localStorage:{getItem(){if(storageThrows)throw Error('denied');return best;},setItem(){if(storageThrows)throw Error('denied');}},performance:{now:()=>0},requestAnimationFrame(){},console});
  let source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
  source=source.replace(/\}\)\(\);\s*$/, 'globalThis.api={state,resetGame,hurtPlayer,playerBomb,spawnBoss,updateStage,updateBoss,pauseGame,resumeGame,addScore,STAGES,assetFiles,BOSS_INTEL,updatePlayer,updateRadio,announce,bossFire,drawBackground,loaded};})();');
  vm.runInContext(source,context);
  context.api.resetGame();
  context.api.elements = elements; context.api.draws = draws;
  return context.api;
}
test('last displayed life ends the mission immediately',()=>{const g=game();g.state.player.lives=1;g.hurtPlayer();assert.equal(g.state.player.lives,0);assert.equal(g.state.mode,'result');});
test('dead player cannot lose more lives',()=>{const g=game();g.state.player.lives=1;g.hurtPlayer();g.state.player.invuln=0;g.hurtPlayer();assert.equal(g.state.player.lives,0);});
test('boss defeat keeps clear timer and never respawns during transition',()=>{const g=game();g.state.stageTimer=31;g.spawnBoss();g.state.boss.enter=false;g.state.boss.hp=0;g.updateBoss(.016);g.updateStage(.016);assert.equal(g.state.boss,null);assert.ok(g.state.clearTimer>3);});
test('all five bosses advance once and final stage wins',()=>{const g=game();for(let stage=1;stage<=5;stage++){assert.equal(g.state.stage,stage);g.state.stageTimer=40;g.spawnBoss();g.state.boss.hp=0;g.updateBoss(.016);for(let i=0;i<220;i++)g.updateStage(.016);if(stage<5){assert.equal(g.state.bossSpawned,false);assert.equal(g.state.boss,null);}}assert.equal(g.state.mode,'result');assert.equal(g.state.stage,5);});
test('entry-phase boss can be defeated and clears hazards',()=>{const g=game();g.spawnBoss();g.state.enemies.push({});g.state.eBullets.push({});g.state.boss.hp=0;g.updateBoss(.01);assert.equal(g.state.boss,null);assert.equal(g.state.eBullets.length,0);assert.equal(g.state.enemies.length,0);});
test('pause freezes simulation timers and denies bombs',()=>{const g=game();g.spawnBoss();g.pauseGame();const b=g.state.player.bombs;g.playerBomb();assert.equal(g.state.player.bombs,b);assert.equal(g.state.bossIntro,3);g.resumeGame();g.updateStage(.5);assert.equal(g.state.bossIntro,2.5);});
test('bomb damages boss and clears bullets only once per wave',()=>{const g=game();g.spawnBoss();g.state.eBullets.push({});const hp=g.state.boss.hp;g.playerBomb();g.playerBomb();assert.equal(g.state.player.bombs,2);assert.equal(g.state.boss.hp,hp-18);assert.equal(g.state.eBullets.length,0);});
test('clear transition cannot consume bombs or damage player',()=>{const g=game();g.state.clearTimer=2;g.hurtPlayer();g.playerBomb();assert.equal(g.state.player.lives,3);assert.equal(g.state.player.bombs,3);});
test('blocked local storage permits launch and scoring',()=>{const g=game({storageThrows:true});g.addScore(100);assert.equal(g.state.best,100);});
test('invalid saved scores normalize to zero',()=>{for(const best of ['NaN','Infinity','-100','3.4'])assert.equal(game({best}).state.best,0);assert.equal(game({best:'1234'}).state.best,1234);});
test('pause and restart release all input and stage flags',()=>{const g=game();g.state.keys.ArrowLeft=true;g.state.touchActive=true;g.pauseGame();assert.equal(Object.keys(g.state.keys).length,0);assert.equal(g.state.touchActive,false);g.state.bossSpawned=true;g.resetGame();assert.equal(g.state.bossSpawned,false);assert.equal(g.state.stage,1);});
test('all referenced images exist and are WebP',()=>{const g=game();for(const group of Object.values(g.assetFiles))for(const file of Object.values(group)){const b=fs.readFileSync(path.join(__dirname,'..',file));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');}});

test('background texture moves down and tiles cover the screen across wrap',()=>{
 const g=game();g.loaded.bg_1={width:480,height:1000};
 for(const offset of [0,10,999,1001]){g.draws.length=0;g.state.cameraY=offset;g.drawBackground();const ys=g.draws.map(d=>d[2]);assert.ok(ys[0]<=0);assert.ok(ys.at(-1)+1000>=800);}
 g.draws.length=0;g.state.cameraY=10;g.drawBackground();const before=g.draws[0][2];g.draws.length=0;g.state.cameraY=20;g.drawBackground();assert.equal(g.draws[0][2]-before,10);
});
test('mouse hover moves aircraft without holding a button, click bombs once',()=>{
 const g=game(),c=g.elements.get('game'),p=g.state.player;
 c.listeners.pointermove({pointerType:'mouse',clientX:360,clientY:500});g.updatePlayer(.05);assert.ok(p.x>240);assert.ok(p.y<656);assert.equal(p.bombs,3);
 c.listeners.pointerdown({pointerType:'mouse',button:0,clientX:360,clientY:500});assert.equal(p.bombs,2);
 c.listeners.pointermove({pointerType:'mouse',clientX:350,clientY:490});assert.equal(p.bombs,2);
 c.listeners.pointerleave({pointerType:'mouse'});assert.equal(g.state.mouseActive,false);
});
test('pause denies mouse aiming and bombing; right click is not a bomb',()=>{
 const g=game(),c=g.elements.get('game');c.listeners.pointerdown({pointerType:'mouse',button:2,clientX:50,clientY:300});assert.equal(g.state.player.bombs,3);
 g.pauseGame();c.listeners.pointermove({pointerType:'mouse',clientX:100,clientY:300});c.listeners.pointerdown({pointerType:'mouse',button:0,clientX:100,clientY:300});assert.equal(g.state.player.bombs,3);assert.equal(g.state.mouseActive,false);
});
test('touch drag does not bomb and ignores a second finger until release',()=>{
 const g=game(),c=g.elements.get('game');c.listeners.pointerdown({pointerType:'touch',pointerId:7,clientX:100,clientY:500});
 c.listeners.pointerdown({pointerType:'touch',pointerId:8,clientX:400,clientY:300});assert.equal(g.state.touchX,100);assert.equal(g.state.player.bombs,3);
 c.listeners.pointercancel({pointerId:7});assert.equal(g.state.touchActive,false);assert.equal(g.state.pointerId,null);
 c.listeners.pointerdown({pointerType:'touch',pointerId:8,clientX:400,clientY:300});assert.equal(g.state.pointerId,8);
});
test('five bosses have distinct visual identities and offensive patterns',()=>{
 const g=game();assert.equal(new Set(g.STAGES.map(s=>g.BOSS_INTEL[s.boss].sprite)).size,5);
 const patterns=new Set();for(let i=0;i<5;i++){g.resetGame();g.state.stage=i+1;g.spawnBoss();const b=g.state.boss;patterns.add(b.pattern);b.enter=false;b.fire=0;g.bossFire(b,.1);assert.ok(g.state.eBullets.length>0);b.hp=b.maxHp*.5;g.updateBoss(.1);assert.equal(b.enraged,true);assert.equal(g.elements.get('bossDialogue').textContent,g.BOSS_INTEL[b.key].rage);}
 assert.equal(patterns.size,5);
});
test('copilot respects warning priority, expires in game time and resets on retry',()=>{
 const g=game();g.announce('critical',{priority:3,duration:4});g.announce('pickup',{priority:0});assert.equal(g.elements.get('radioText').textContent,'critical');g.updateRadio(4);assert.equal(g.state.radioTime,0);g.announce('new',{priority:2});assert.equal(g.elements.get('radioText').textContent,'new');g.resetGame();assert.ok(g.elements.get('radioText').textContent.includes('제1 전장'));
});
test('pre-boss warning fires once; stage advance updates portrait and intel',()=>{
 const g=game();g.updateStage(24);assert.equal(g.state.briefingSent,true);assert.ok(g.elements.get('radioText').textContent.includes('대형 적'));g.spawnBoss();g.state.boss.hp=0;g.updateBoss(.01);g.updateStage(4);assert.equal(g.elements.get('bossName').textContent,g.BOSS_INTEL[g.STAGES[1].boss].name);assert.equal(g.elements.get('bossHealth').value,100);
});
