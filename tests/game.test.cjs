const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function game({storageThrows=false, best=null}={}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {textContent:'',width:480,height:800,classList:{add(){},remove(){}},addEventListener(){},getContext(){return {};}});
    return elements.get(id);
  };
  const document = {getElementById:element,addEventListener(){}};
  const context = vm.createContext({document,window:{addEventListener(){}},Image:class {set src(v) {this.onload();}},localStorage:{getItem(){if(storageThrows)throw Error('denied');return best;},setItem(){if(storageThrows)throw Error('denied');}},performance:{now:()=>0},requestAnimationFrame(){},console});
  let source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
  source=source.replace(/\}\)\(\);\s*$/, 'globalThis.api={state,resetGame,hurtPlayer,playerBomb,spawnBoss,updateStage,updateBoss,pauseGame,resumeGame,addScore,STAGES,assetFiles};})();');
  vm.runInContext(source,context);
  context.api.resetGame();
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
