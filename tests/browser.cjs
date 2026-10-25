// Optional browser smoke test: install Playwright and Chromium before running.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const instrumented=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8').replace(/\}\)\(\);\s*$/, 'window.testGame={state,spawnBoss,updateBoss,updateStage,resetGame,updateRadio};})();');
(async()=>{
 const browser=await chromium.launch({headless:true});
 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:740}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/game.js',route=>route.fulfill({contentType:'text/javascript',body:instrumented}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765');
  await page.waitForFunction(()=>document.querySelector('#loadingText').textContent.includes('출격 가능'));
  assert.ok(await page.locator('#startBtn').isVisible());
  const reachable=await page.locator('#startBtn').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.closest('.screen-wrap').getBoundingClientRect();return r.bottom<=p.bottom&&r.top>=p.top;});
  assert.ok(reachable,'start button must fit inside game screen');
  await page.locator('#startBtn').click();await page.waitForTimeout(1200);
  await page.keyboard.press('x');assert.equal(await page.locator('#bombText').textContent(),'BOMB 2');
  await page.keyboard.press('p');assert.ok(await page.locator('#pauseOverlay').isVisible());
  await page.locator('#touchBomb').evaluate(e=>e.click());assert.equal(await page.locator('#bombText').textContent(),'BOMB 2');
  await page.locator('#resumeBtn').click();assert.ok(await page.locator('#pauseOverlay').isHidden());
  const playfield=await page.locator('#game').boundingBox();
  await page.mouse.move(playfield.x+playfield.width/2,playfield.y+playfield.height*.8);
  await page.mouse.down();await page.mouse.move(playfield.x+playfield.width*.65,playfield.y+playfield.height*.7);await page.mouse.up();
  await page.evaluate(()=>{const g=window.testGame;g.state.player.invuln=999;g.state.player.bombWave=0;});
  await page.locator('#game').evaluate(e=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-20));
  const box=await page.locator('#game').boundingBox();
  const before=await page.evaluate(()=>window.testGame.state.player.x);
  const target=before>240 ? .25 : .75;
  await page.mouse.move(box.x+box.width*target,box.y+box.height*.45);
  await page.waitForTimeout(350);
  const after=await page.evaluate(()=>window.testGame.state.player.x);
  assert.ok(Math.abs(after-target*480)<30,'mouse hover follows without pressed button');
  const bombs=await page.evaluate(()=>window.testGame.state.player.bombs);
  await page.mouse.click(box.x+box.width*target,box.y+box.height*.45);
  assert.equal(await page.evaluate(()=>window.testGame.state.player.bombs),bombs-1);
  assert.ok(await page.locator('#radioStrip').isVisible());
  await page.evaluate(()=>{const g=window.testGame;g.state.stage=4;g.state.bossSpawned=false;g.spawnBoss();});
  assert.ok((await page.locator('#radioText').textContent()).includes('눈보라'));
  await page.evaluate(()=>{const g=window.testGame;g.state.boss.enter=false;g.state.boss.hp=g.state.boss.maxHp*.49;g.updateBoss(.01);});
  assert.ok((await page.locator('#bossDialogue').textContent()).includes('교차'));
  // Stage transition refreshes the portrait, defeated dialogue and copilot briefing.
  await page.evaluate(()=>{const g=window.testGame;g.state.boss.hp=0;g.updateBoss(.01);g.updateStage(4);});
  assert.ok((await page.locator('#bossName').textContent()).includes('CHRONO'));
  assert.ok((await page.locator('#radioText').textContent()).includes('제5 전장'));
  assert.ok(await page.locator('#bossPortrait').evaluate(e=>e.complete&&e.naturalWidth>0));
  await page.keyboard.down('ArrowLeft');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('ArrowLeft');
  assert.ok(await page.locator('#pauseOverlay').isVisible());await page.locator('#resumeBtn').click();
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('canvas')).touchAction),'none');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await page.waitForTimeout(2500);assert.deepEqual(errors,[]);
  await page.screenshot({path:'/tmp/chrono-'+viewport.width+'.png',fullPage:true});
  console.log('PASS browser',viewport.width+'x'+viewport.height);await page.close();
 }
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}});});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765');await page.waitForFunction(()=>document.querySelector('#loadingText').textContent.includes('출격 가능'));await page.locator('#startBtn').click();await page.waitForTimeout(500);assert.deepEqual(errors,[]);console.log('PASS blocked storage browser');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
