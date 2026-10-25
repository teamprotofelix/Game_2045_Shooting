(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const $ = (id) => document.getElementById(id);
  const ui = {
    score: $('scoreText'), best: $('bestText'), stage: $('stageText'),
    life: $('lifeText'), power: $('powerText'), bomb: $('bombText'),
    loading: $('loadingText'), status: $('statusLine'),
    menu: $('menuOverlay'), help: $('helpOverlay'), pause: $('pauseOverlay'), result: $('resultOverlay'),
    resultTitle: $('resultTitle'), resultEyebrow: $('resultEyebrow'), resultDesc: $('resultDesc'), resultScore: $('resultScore'),
    touchBomb: $('touchBomb'), touchPause: $('touchPause')
  };

  const assetFiles = {
    backgrounds: {
      1:'assets/backgrounds/bg_stage1_convoy.webp',
      2:'assets/backgrounds/bg_stage2_islands.webp',
      3:'assets/backgrounds/bg_stage3_harbor.webp',
      4:'assets/backgrounds/bg_stage4_arctic.webp',
      5:'assets/backgrounds/bg_stage5_desert.webp'
    },
    sprites: {
      player_straight:'assets/sprites/player_straight.webp', player_bank_left:'assets/sprites/player_bank_left.webp', player_bank_right:'assets/sprites/player_bank_right.webp', player_boost:'assets/sprites/player_boost.webp', player_damaged:'assets/sprites/player_damaged.webp',
      enemy_f1:'assets/sprites/enemy_f1.webp', enemy_f2:'assets/sprites/enemy_f2.webp', enemy_f3:'assets/sprites/enemy_f3.webp', enemy_f4:'assets/sprites/enemy_f4.webp', enemy_f5:'assets/sprites/enemy_f5.webp', enemy_f6:'assets/sprites/enemy_f6.webp', enemy_f7:'assets/sprites/enemy_f7.webp', enemy_f8:'assets/sprites/enemy_f8.webp',
      enemy_b1:'assets/sprites/enemy_b1.webp', enemy_b2:'assets/sprites/enemy_b2.webp', enemy_b3:'assets/sprites/enemy_b3.webp',
      enemy_ship1:'assets/sprites/enemy_ship1.webp', enemy_ship2:'assets/sprites/enemy_ship2.webp', enemy_ship3:'assets/sprites/enemy_ship3.webp',
      boss_1:'assets/sprites/boss_1.webp', boss_2:'assets/sprites/boss_2.webp', boss_3:'assets/sprites/boss_3.webp', boss_4:'assets/sprites/boss_4.webp',
      bullet_player_1:'assets/sprites/bullet_player_1.webp', bullet_player_2:'assets/sprites/bullet_player_2.webp', bullet_player_3:'assets/sprites/bullet_player_3.webp', bullet_player_4:'assets/sprites/bullet_player_4.webp',
      bullet_enemy_orb:'assets/sprites/bullet_enemy_orb.webp', bullet_enemy_orb2:'assets/sprites/bullet_enemy_orb2.webp', bullet_enemy_needle:'assets/sprites/bullet_enemy_needle.webp', bullet_enemy_needle2:'assets/sprites/bullet_enemy_needle2.webp', bullet_enemy_chain:'assets/sprites/bullet_enemy_chain.webp', bullet_enemy_crescent:'assets/sprites/bullet_enemy_crescent.webp', bullet_enemy_diamond:'assets/sprites/bullet_enemy_diamond.webp',
      power_p:'assets/sprites/power_p.webp', power_shield:'assets/sprites/power_shield.webp', power_repair:'assets/sprites/power_repair.webp', power_star:'assets/sprites/power_star.webp', bomb_pickup:'assets/sprites/bomb_pickup.webp',
      explosion_small:'assets/sprites/explosion_small.webp', explosion_mid:'assets/sprites/explosion_mid.webp', explosion_big:'assets/sprites/explosion_big.webp', smoke_1:'assets/sprites/smoke_1.webp', smoke_2:'assets/sprites/smoke_2.webp', blast_bomb:'assets/sprites/blast_bomb.webp', blast_bomb2:'assets/sprites/blast_bomb2.webp', muzzle_flash:'assets/sprites/muzzle_flash.webp'
    }
  };

  const loaded = {};
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  async function loadAssets() {
    const entries = [];
    for (const [k,v] of Object.entries(assetFiles.sprites)) entries.push([k,v]);
    for (const [k,v] of Object.entries(assetFiles.backgrounds)) entries.push([`bg_${k}`,v]);
    let done = 0;
    for (const [name, path] of entries) {
      loaded[name] = await loadImage(path);
      done++;
      ui.loading.textContent = `에셋 로딩 중... ${done} / ${entries.length}`;
    }
    ui.loading.textContent = '에셋 로딩 완료';
  }

  const rng = (a,b)=> Math.random()*(b-a)+a;
  const clamp = (v,a,b)=> Math.max(a, Math.min(b,v));
  const dist2 = (a,b) => { const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; };
  function circleHit(a,b) { const r=(a.r||20)+(b.r||20); return dist2(a,b) <= r*r; }

  const audio = {
    enabled: true,
    ctx: null,
    tone(freq=440, dur=0.08, type='sine', volume=0.03){
      if (!this.enabled) return;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const t=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.type=type; o.frequency.setValueAtTime(freq,t); g.gain.setValueAtTime(volume,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t+dur);
      } catch { this.enabled = false; }
    }
  };

  function readBestScore() {
    try {
      const value = Number(localStorage.getItem('chrono_striker_best'));
      return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    } catch { return 0; }
  }

  function clearInput() {
    state.keys = {};
    state.touchActive = false;
    state.pointerId = null;
  }

  const state = {
    mode: 'menu',
    score: 0,
    best: readBestScore(),
    stage: 1,
    stageTimer: 0,
    globalTimer: 0,
    cameraY: 0,
    boss: null,
    bossSpawned: false,
    bossIntro: 0,
    clearTimer: 0,
    player: null,
    enemies: [],
    pBullets: [],
    eBullets: [],
    particles: [],
    pickups: [],
    keys: {},
    touchActive: false,
    pointerId: null,
    touchX: W/2,
    touchY: H*0.82,
    shake: 0,
    spawnIndex: 0,
    mobileHint: false,
    canStart: false
  };

  const STAGES = [
    {name:'CONVOY BREAKER', bg:'bg_1', duration:30, scroll:140, boss:'boss_1', waves:['sweep','column','ships','sweep','bomber']},
    {name:'ISLAND SIEGE', bg:'bg_2', duration:32, scroll:150, boss:'boss_3', waves:['zigzag','spread','sweep','bomber','ships']},
    {name:'HARBOR INFERNO', bg:'bg_3', duration:34, scroll:155, boss:'boss_2', waves:['ships','spread','zigzag','ships','bomber']},
    {name:'ARCTIC STORM', bg:'bg_4', duration:36, scroll:165, boss:'boss_1', waves:['zigzag','column','spread','bomber','ships']},
    {name:'FORTRESS OF TIME', bg:'bg_5', duration:38, scroll:175, boss:'boss_4', waves:['spread','ships','sweep','bomber','zigzag']},
  ];

  function resetGame(){
    clearInput();
    state.score=0; state.stage=1; state.globalTimer=0; state.cameraY=0; state.clearTimer=0; state.mode='playing';
    state.enemies=[]; state.pBullets=[]; state.eBullets=[]; state.particles=[]; state.pickups=[]; state.boss=null; state.bossSpawned=false; state.shake=0; state.spawnIndex=0; state.stageTimer=0; state.bossIntro=0;
    createPlayer(); updateHud(); ui.status.textContent='SORTIE IN PROGRESS';
    ui.menu.classList.add('hidden'); ui.pause.classList.add('hidden'); ui.result.classList.add('hidden'); ui.help.classList.add('hidden');
    ui.touchBomb.classList.remove('hidden'); ui.touchPause.classList.remove('hidden');
  }

  function createPlayer(){
    state.player = {
      x: W/2, y: H*0.82, w: 74, h: 74, speed: 310, lives: 3, bombs: 3, power: 1,
      fireCooldown: 0, invuln: 0, flash: 0, shield: 0, bombWave: 0, r: 20, dead:false
    };
  }

  function currentStage(){ return STAGES[state.stage-1]; }

  function addScore(v){ state.score += v; if (state.score > state.best) { state.best = state.score; try { localStorage.setItem('chrono_striker_best', String(state.best)); } catch { /* Storage is optional. */ } } updateHud(); }
  function updateHud(){
    ui.score.textContent = String(state.score).padStart(8,'0');
    ui.best.textContent = String(state.best).padStart(8,'0');
    ui.stage.textContent = `${state.stage}`;
    ui.life.textContent = `LIFE ${'● '.repeat(Math.max(0,state.player?.lives||0)).trim()}`;
    ui.power.textContent = `POWER ${state.player?.power || 1}`;
    ui.bomb.textContent = `BOMB ${state.player?.bombs || 0}`;
  }

  function firePlayer() {
    const p = state.player;
    if (p.fireCooldown > 0) return;
    p.fireCooldown = 0.12;
    const sets = {
      1:[{dx:0, vx:0}],
      2:[{dx:-14, vx:-25}, {dx:14, vx:25}],
      3:[{dx:0,vx:0}, {dx:-20,vx:-55}, {dx:20,vx:55}],
      4:[{dx:-22,vx:-65}, {dx:0,vx:-15}, {dx:0,vx:15}, {dx:22,vx:65}],
    };
    const pattern = sets[p.power] || sets[4];
    pattern.forEach((it, idx) => {
      state.pBullets.push({ x:p.x+it.dx, y:p.y-30, vx:it.vx, vy:-680, damage:1+p.power*0.35, sprite:`bullet_player_${Math.min(4,p.power)}`, r:10, life:1.6, blend:'lighter'});
    });
    if (p.power >= 3) state.pBullets.push({x:p.x-34,y:p.y-4,vx:0,vy:-500,damage:.7,sprite:'muzzle_flash',r:7,life:.18,muzzle:true});
    if (p.power >= 3) state.pBullets.push({x:p.x+34,y:p.y-4,vx:0,vy:-500,damage:.7,sprite:'muzzle_flash',r:7,life:.18,muzzle:true});
    audio.tone(600+Math.random()*50, 0.05, 'square', 0.02);
  }

  function playerBomb() {
    const p = state.player;
    if (state.mode !== 'playing' || state.clearTimer > 0 || !p || p.bombs <= 0 || p.bombWave > 0) return;
    p.bombs--; p.bombWave = 1.2; p.invuln = Math.max(p.invuln, 1.2); state.eBullets.length = 0;
    state.shake = 14; addScore(250);
    for (const enemy of state.enemies) enemy.hp -= 18;
    if (state.boss) state.boss.hp -= 18;
    state.particles.push({type:'bomb', x:p.x, y:p.y, t:0, life:0.8});
    audio.tone(120,0.18,'sawtooth',0.05); audio.tone(80,0.35,'triangle',0.03);
    updateHud();
  }

  function hurtPlayer() {
    const p = state.player;
    if (state.mode !== 'playing' || state.clearTimer > 0 || !p || p.invuln > 0 || p.shield > 0) return;
    p.lives--; p.invuln = 2.5; p.power = Math.max(1, p.power-1); p.flash = .5; state.shake = 12;
    state.particles.push({type:'explode', x:p.x, y:p.y, size:'big', t:0, life:.85});
    audio.tone(180, 0.25, 'sawtooth', 0.05);
    if (p.lives <= 0) { updateHud(); endGame(false); return; }
    p.x = W/2; p.y = H*0.86; updateHud();
  }

  function applyPickup(kind) {
    const p = state.player;
    if (kind === 'power') p.power = Math.min(4, p.power+1);
    else if (kind === 'repair') p.lives = Math.min(5, p.lives+1);
    else if (kind === 'bomb') p.bombs = Math.min(5, p.bombs+1);
    else if (kind === 'shield') p.shield = 6;
    addScore(180); audio.tone(880,0.10,'triangle',0.03); updateHud();
  }

  function dropItem(x,y) {
    const roll = Math.random();
    let kind = 'power';
    if (roll > 0.8) kind = 'repair';
    else if (roll > 0.58) kind = 'bomb';
    else if (roll > 0.35) kind = 'shield';
    state.pickups.push({x,y,vx:rng(-10,10),vy:80, kind, t:0, r:18});
  }

  function spawnEnemy(type,x,y,extra={}){
    const isShip = type.startsWith('enemy_ship');
    const isBomber = type.startsWith('enemy_b');
    const size = isShip ? [70,110] : isBomber ? [84,84] : [68,68];
    const hp = isShip ? 14 : isBomber ? 7 : 3.6;
    const score = isShip ? 420 : isBomber ? 240 : 110;
    state.enemies.push({
      type, x, y, vx:extra.vx??0, vy:extra.vy??(isShip?90:extra.curve?140:100), ax:0, ay:0,
      w:size[0], h:size[1], hp, maxHp:hp, r:isShip?28:22, t:0, curve:extra.curve||0, zig:extra.zig||0,
      fire: rng(.6, 1.5), score, pattern: extra.pattern || 'line', phase:rng(0, Math.PI*2)
    });
  }

  function spawnWave(kind) {
    switch(kind){
      case 'sweep': {
        const dir = Math.random() > .5 ? 1 : -1;
        for (let i=0;i<5;i++) spawnEnemy(`enemy_f${1+(i%8)}`, dir>0 ? -40-i*70 : W+40+i*70, 110+i*40, {vx: dir*110, vy:120, curve: dir*40});
      } break;
      case 'column': {
        const x = rng(90,W-90);
        for (let i=0;i<6;i++) spawnEnemy(`enemy_f${1+((i+2)%8)}`, x+rng(-22,22), -80-i*70, {vx:rng(-25,25), vy:140});
      } break;
      case 'spread': {
        for (let i=0;i<6;i++) spawnEnemy(`enemy_f${1+((i+4)%8)}`, 60+i*70, -50-rng(0,100), {vx:rng(-45,45), vy:rng(110,145), zig:rng(.7,1.4)});
      } break;
      case 'zigzag': {
        for (let i=0;i<5;i++) spawnEnemy(`enemy_f${1+((i+1)%8)}`, 80+i*80, -60-i*10, {vx:0, vy:150, zig:rng(1.2,2.5)});
      } break;
      case 'bomber': {
        for (let i=0;i<3;i++) spawnEnemy(`enemy_b${1+((state.stage+i)%3)}`, 120+i*120, -90-i*70, {vx:rng(-20,20), vy:100, pattern:'burst'});
      } break;
      case 'ships': {
        for (let i=0;i<3;i++) spawnEnemy(`enemy_ship${1+((state.stage+i)%3)}`, 90+i*150, -140-i*220, {vx:rng(-15,15), vy:95, pattern:'ship'});
      } break;
    }
  }

  function bossTemplate(key) {
    const map = {
      boss_1:{w:170,h:310,hp:160, speed:65, pattern:'dreadnought', score:2800},
      boss_2:{w:210,h:320,hp:220, speed:50, pattern:'carrier', score:3600},
      boss_3:{w:190,h:270,hp:200, speed:80, pattern:'fortress', score:3400},
      boss_4:{w:180,h:330,hp:320, speed:88, pattern:'chrono', score:5600}
    };
    return map[key];
  }

  function spawnBoss() {
    if (state.bossSpawned || state.clearTimer > 0) return;
    state.bossSpawned = true;
    const stage = currentStage();
    const t = bossTemplate(stage.boss);
    state.boss = { ...t, key:stage.boss, x:W/2, y:-t.h/2, tx:W/2, enter:true, fire:.8, phase:0, r:68, maxHp:t.hp };
    state.enemies = state.enemies.filter(e => !e.type.startsWith('enemy_ship'));
    state.eBullets.length = 0;
    ui.status.textContent = `${stage.name} — BOSS APPROACHING`;
    state.bossIntro = 3.0;
    audio.tone(140,0.30,'triangle',0.04); audio.tone(95,0.45,'sawtooth',0.03);
  }

  function enemyFire(e) {
    if (state.bossIntro > 0) return;
    if (e.type.startsWith('enemy_ship')) {
      state.eBullets.push({x:e.x,y:e.y+30,vx:0,vy:260, sprite:'bullet_enemy_needle2', r:13, damage:1});
      state.eBullets.push({x:e.x-16,y:e.y+20,vx:-35,vy:245, sprite:'bullet_enemy_orb2', r:16, damage:1});
      state.eBullets.push({x:e.x+16,y:e.y+20,vx:35,vy:245, sprite:'bullet_enemy_orb2', r:16, damage:1});
    } else if (e.type.startsWith('enemy_b')) {
      for (let i=-1;i<=1;i++) state.eBullets.push({x:e.x+i*18,y:e.y+26,vx:i*45,vy:250,sprite:'bullet_enemy_chain',r:12,damage:1});
    } else {
      const angle = Math.atan2(state.player.y-e.y, state.player.x-e.x);
      state.eBullets.push({x:e.x,y:e.y+18,vx:Math.cos(angle)*105,vy:Math.sin(angle)*105,sprite:Math.random()>.5?'bullet_enemy_orb':'bullet_enemy_needle',r:12,damage:1});
    }
    audio.tone(220,0.04,'square',0.01);
  }

  function bossFire(b,dt){
    b.fire -= dt;
    if (b.fire > 0) return;
    const p = b.pattern;
    if (p === 'dreadnought') {
      for (let i=0;i<9;i++) {
        const a = Math.PI/2 + (-0.65 + i*0.16);
        state.eBullets.push({x:b.x,y:b.y+70,vx:Math.cos(a)*180,vy:Math.sin(a)*180,sprite:'bullet_enemy_orb',r:14,damage:1});
      }
      b.fire = .95;
    } else if (p === 'carrier') {
      for (let i=0;i<5;i++) {
        const off=-2+i;
        state.eBullets.push({x:b.x+off*34,y:b.y+20,vx:off*26,vy:220,sprite:'bullet_enemy_diamond',r:12,damage:1});
      }
      if (Math.random()>.55) spawnEnemy(`enemy_f${1+Math.floor(Math.random()*8)}`, b.x+rng(-60,60), b.y+40, {vx:rng(-40,40),vy:140});
      b.fire = .75;
    } else if (p === 'fortress') {
      for (let i=0;i<18;i++) {
        const a = i/18*Math.PI*2 + b.phase;
        state.eBullets.push({x:b.x,y:b.y+40,vx:Math.cos(a)*135,vy:Math.sin(a)*135+45,sprite:i%2?'bullet_enemy_orb2':'bullet_enemy_crescent',r:12,damage:1});
      }
      b.phase += .3;
      b.fire = 1.25;
    } else if (p === 'chrono') {
      const angle0 = Math.atan2(state.player.y-b.y,state.player.x-b.x);
      for (let ring=0; ring<2; ring++) {
        for (let i=0;i<14;i++) {
          const a = angle0 + (i-7)*0.11 + ring*0.04;
          state.eBullets.push({x:b.x,y:b.y+60,vx:Math.cos(a)*(170+ring*35),vy:Math.sin(a)*(170+ring*35),sprite:ring?'bullet_enemy_diamond':'bullet_enemy_orb',r:13,damage:1});
        }
      }
      state.eBullets.push({x:b.x-52,y:b.y+70,vx:-70,vy:215,sprite:'bullet_enemy_needle2',r:14,damage:1});
      state.eBullets.push({x:b.x+52,y:b.y+70,vx:70,vy:215,sprite:'bullet_enemy_needle2',r:14,damage:1});
      b.fire = .55;
    }
    state.shake = Math.max(state.shake, 4);
  }

  function updatePlayer(dt){
    const p = state.player; if (!p) return;
    let mx = 0, my = 0;
    if (state.keys['ArrowLeft']||state.keys['a']) mx -= 1;
    if (state.keys['ArrowRight']||state.keys['d']) mx += 1;
    if (state.keys['ArrowUp']||state.keys['w']) my -= 1;
    if (state.keys['ArrowDown']||state.keys['s']) my += 1;
    if (state.touchActive) {
      p.x += (state.touchX - p.x) * clamp(dt*10, 0, 1);
      p.y += (state.touchY - p.y) * clamp(dt*10, 0, 1);
    } else {
      const len = Math.hypot(mx,my) || 1;
      p.x += (mx/len) * p.speed * dt;
      p.y += (my/len) * p.speed * dt;
    }
    p.x = clamp(p.x, 34, W-34);
    p.y = clamp(p.y, 80, H-44);
    p.fireCooldown -= dt; if (p.fireCooldown < 0) p.fireCooldown = 0;
    p.invuln = Math.max(0, p.invuln-dt); p.flash = Math.max(0,p.flash-dt); p.shield = Math.max(0,p.shield-dt);
    if (p.bombWave > 0) p.bombWave = Math.max(0, p.bombWave-dt);
    firePlayer();
  }

  function updateBullets(arr, dt){
    for (let i=arr.length-1;i>=0;i--){
      const b = arr[i];
      b.x += b.vx*dt; b.y += b.vy*dt; if (b.life != null) b.life -= dt;
      if (b.life != null && b.life <= 0) { arr.splice(i,1); continue; }
      if (b.x < -120 || b.x > W+120 || b.y < -160 || b.y > H+160) arr.splice(i,1);
    }
  }

  function updateEnemies(dt){
    const p = state.player;
    for (let i=state.enemies.length-1;i>=0;i--){
      const e = state.enemies[i]; e.t += dt;
      if (e.zig) e.x += Math.sin(e.t*e.zig*4 + e.phase)*80*dt;
      if (e.curve) e.x += Math.sin(e.t*2.8 + e.phase)*e.curve*dt;
      e.x += e.vx*dt; e.y += e.vy*dt; e.fire -= dt;
      if (e.fire <= 0) { enemyFire(e); e.fire = e.type.startsWith('enemy_ship') ? rng(1.4,2.2) : e.type.startsWith('enemy_b') ? rng(1.6,2.3) : rng(1.0,2.1); }
      if (p && circleHit(e,p)) { state.enemies.splice(i,1); hurtPlayer(); continue; }
      if (e.hp <= 0) {
        addScore(e.score); if (Math.random() > 0.68 || e.type.startsWith('enemy_b') || e.type.startsWith('enemy_ship')) dropItem(e.x,e.y);
        state.particles.push({type:'explode',x:e.x,y:e.y,size:e.type.startsWith('enemy_ship')?'big':'mid',t:0,life:.8});
        state.enemies.splice(i,1); state.shake = Math.max(state.shake, 4);
        continue;
      }
      if (e.y > H+180 || e.x < -180 || e.x > W+180) state.enemies.splice(i,1);
    }
  }

  function updateBoss(dt){
    const b = state.boss; if (!b) return;
    if (b.hp <= 0) {
      addScore(b.score);
      state.particles.push({type:'explode',x:b.x,y:b.y,size:'boss',t:0,life:1.3});
      state.shake = 18;
      state.boss = null; state.bossIntro = 0; state.clearTimer = 3.3;
      state.eBullets.length = 0; state.enemies.length = 0;
      ui.status.textContent = `STAGE ${state.stage} CLEAR`;
      audio.tone(660,0.25,'triangle',0.06); audio.tone(880,0.35,'square',0.03);
      return;
    }
    if (b.enter) {
      b.y += 80*dt; if (b.y > 170) { b.enter = false; b.phase = 0; }
      return;
    }
    b.phase += dt;
    b.x = W/2 + Math.sin(b.phase*0.9) * 110;
    if (b.pattern === 'chrono') b.x = W/2 + Math.sin(b.phase*1.35) * 130;
    bossFire(b,dt);
    if (circleHit(b,state.player)) hurtPlayer();
  }

  function updatePickups(dt){
    for (let i=state.pickups.length-1;i>=0;i--) {
      const p = state.pickups[i]; p.t += dt; p.y += p.vy*dt; p.x += Math.sin(p.t*3)*18*dt;
      if (circleHit({...p,r:18}, state.player)) { applyPickup(p.kind); state.pickups.splice(i,1); continue; }
      if (p.y > H+50) state.pickups.splice(i,1);
    }
  }

  function updateParticles(dt){
    for (let i=state.particles.length-1;i>=0;i--) {
      const p = state.particles[i]; p.t += dt;
      if (p.t >= p.life) state.particles.splice(i,1);
    }
  }

  function handleCollisions(){
    for (let i=state.pBullets.length-1;i>=0;i--) {
      const b = state.pBullets[i];
      if (b.muzzle) continue;
      let hit = false;
      if (state.boss && circleHit({...b,r:b.r||10}, {...state.boss,r:state.boss.r})) {
        state.boss.hp -= b.damage; state.pBullets.splice(i,1); hit = true;
      }
      if (hit) continue;
      for (let j=state.enemies.length-1;j>=0;j--) {
        const e = state.enemies[j];
        if (circleHit({...b,r:b.r||8}, e)) {
          e.hp -= b.damage; state.pBullets.splice(i,1); hit=true;
          if (Math.random()>.75) state.particles.push({type:'spark',x:b.x,y:b.y,size:'small',t:0,life:.2});
          break;
        }
      }
    }

    for (let i=state.eBullets.length-1;i>=0;i--) {
      const b = state.eBullets[i];
      if (circleHit({...b,r:b.r||12}, state.player)) { state.eBullets.splice(i,1); hurtPlayer(); }
    }
  }

  function updateStage(dt) {
    const p = state.player; if (!p) return;
    const stage = currentStage();
    state.cameraY += stage.scroll * dt;
    state.globalTimer += dt;
    state.bossIntro = Math.max(0, state.bossIntro - dt);
    if (state.clearTimer > 0) {
      state.clearTimer = Math.max(0, state.clearTimer - dt);
      if (state.clearTimer === 0) {
        if (state.stage >= STAGES.length) { endGame(true); return; }
        state.stage++; state.stageTimer=0; state.spawnIndex=0;
        state.bossSpawned=false; state.bossIntro=0;
        state.eBullets.length=0; state.enemies.length=0;
        state.pBullets.length=0; state.pickups.length=0;
        ui.status.textContent = `${currentStage().name} — INCOMING`;
        updateHud();
      }
      return;
    }
    state.stageTimer += dt;

    if (!state.boss) {
      const every = Math.max(2.2 - state.stage*0.1, 1.35);
      if (state.stageTimer < stage.duration && Math.floor((state.stageTimer-dt)/every) !== Math.floor(state.stageTimer/every)) {
        const wave = stage.waves[state.spawnIndex % stage.waves.length];
        spawnWave(wave); state.spawnIndex++;
      }
      if (state.stageTimer >= stage.duration && !state.bossSpawned) spawnBoss();
    } else updateBoss(dt);
  }

  function endGame(win) {
    clearInput();
    state.mode = 'result';
    ui.touchBomb.classList.add('hidden'); ui.touchPause.classList.add('hidden');
    ui.result.classList.remove('hidden'); ui.pause.classList.add('hidden');
    ui.resultTitle.textContent = win ? 'WORLD CONQUEST COMPLETE' : 'MISSION FAILED';
    ui.resultEyebrow.textContent = win ? 'TIME DOMINANCE ACHIEVED' : 'SORTIE LOST';
    ui.resultDesc.textContent = win ? '2045의 전투기는 1945년의 전장을 장악했다.' : '시간의 전장에서 격추되었습니다.';
    ui.resultScore.textContent = String(state.score).padStart(8,'0');
    ui.status.textContent = win ? 'MISSION COMPLETE' : 'GAME OVER';
  }

  function pauseGame(){ if (state.mode !== 'playing') return; clearInput(); state.mode = 'pause'; ui.pause.classList.remove('hidden'); ui.status.textContent='PAUSED'; }
  function resumeGame(){ if (state.mode !== 'pause') return; state.mode = 'playing'; ui.pause.classList.add('hidden'); ui.status.textContent='SORTIE IN PROGRESS'; }

  function drawSprite(name,x,y,w,h,alpha=1){
    const img = loaded[name]; if (!img) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(img, x-w/2, y-h/2, w, h); ctx.restore();
  }

  function drawBackground(){
    const stage = currentStage();
    const img = loaded[stage.bg]; if (!img) return;
    const scale = W / img.width;
    const tileH = img.height * scale;
    const offset = state.cameraY % tileH;
    for (let y = -offset; y < H; y += tileH) ctx.drawImage(img, 0, y, W, tileH);
    const grd = ctx.createLinearGradient(0,0,0,H); grd.addColorStop(0,'rgba(0,0,0,.05)'); grd.addColorStop(1,'rgba(0,0,0,.2)'); ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
  }

  function drawPlayer(){
    const p = state.player; if (!p) return;
    const key = p.invuln>0 && Math.floor(p.invuln*10)%2===0 ? 'player_damaged' : state.touchActive ? 'player_boost' : (state.keys['ArrowLeft']||state.keys['a']) ? 'player_bank_left' : (state.keys['ArrowRight']||state.keys['d']) ? 'player_bank_right' : 'player_straight';
    drawSprite(key,p.x,p.y,p.w,p.h,p.invuln>0&&Math.floor(p.invuln*20)%2===0?0.45:1);
    if (p.shield>0) {
      ctx.save(); ctx.strokeStyle='rgba(100,200,255,.8)'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(p.x,p.y,34+Math.sin(state.globalTimer*10)*2,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }
    if (p.bombWave>0) {
      ctx.save(); const a = p.bombWave/1.2; ctx.globalAlpha = Math.max(0.18, a*.7); drawSprite('blast_bomb2', p.x, p.y-60, 340*a+120, 180*a+80); ctx.restore();
    }
  }

  function drawBullets(arr) {
    for (const b of arr) {
      if (b.muzzle) { drawSprite('muzzle_flash', b.x, b.y, 44, 44, .85); continue; }
      const w = b.sprite.includes('player') ? 14 : 18;
      const h = b.sprite.includes('orb') ? 24 : 30;
      drawSprite(b.sprite, b.x, b.y, w, h);
    }
  }

  function drawEnemies() {
    for (const e of state.enemies) drawSprite(e.type,e.x,e.y,e.w,e.h);
    if (state.boss) {
      drawSprite(state.boss.key, state.boss.x, state.boss.y, state.boss.w, state.boss.h);
      const barW = 300, barH = 14, x=(W-barW)/2, y=22;
      ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(x,y,barW,barH);
      ctx.fillStyle='rgba(255,74,74,.92)'; ctx.fillRect(x,y,barW*(state.boss.hp/state.boss.maxHp),barH);
      ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.strokeRect(x,y,barW,barH);
      ctx.fillStyle='#fff'; ctx.font='12px system-ui'; ctx.fillText('BOSS',x-46,y+11);
    }
  }

  function drawPickups() {
    for (const p of state.pickups) {
      const key = p.kind==='power' ? 'power_p' : p.kind==='repair' ? 'power_repair' : p.kind==='shield' ? 'power_shield' : 'bomb_pickup';
      drawSprite(key,p.x,p.y,44,44);
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      const prog = p.t / p.life;
      if (p.type === 'explode') {
        const key = p.size==='big' ? 'explosion_big' : p.size==='boss' ? 'explosion_big' : p.size==='mid' ? 'explosion_mid' : 'explosion_small';
        const s = p.size==='boss' ? 230 : p.size==='big' ? 140 : p.size==='mid' ? 92 : 52;
        drawSprite(key,p.x+rng(-1,1),p.y+rng(-1,1),s*(1+prog*.4),s*(1+prog*.4),1-prog*.75);
        if (p.size==='boss') drawSprite('smoke_2', p.x+rng(-20,20), p.y+rng(-20,20), 180*(1+prog*.3), 140*(1+prog*.3), .45);
      } else if (p.type === 'spark') drawSprite('explosion_small', p.x, p.y, 26, 26, 1-prog);
      else if (p.type === 'bomb') drawSprite('blast_bomb', p.x, p.y-40, 560*prog+80, 220*prog+60, 1-prog*.7);
    }
  }

  function drawStageMessage() {
    if (state.bossIntro > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, state.bossIntro/1.6); ctx.fillStyle='rgba(0,0,0,.42)'; ctx.fillRect(30,H/2-72,W-60,84); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 22px system-ui'; ctx.fillText('WARNING — BOSS APPROACHING', W/2, H/2-24); ctx.font='14px system-ui'; ctx.fillText(currentStage().name, W/2, H/2+8); ctx.restore();
    }
  }

  function draw(){
    let dx=0, dy=0; if (state.shake > 0) { dx = rng(-state.shake,state.shake); dy = rng(-state.shake,state.shake); state.shake *= .85; if (state.shake < .2) state.shake=0; }
    ctx.save(); ctx.clearRect(0,0,W,H); ctx.translate(dx,dy);
    drawBackground(); drawPickups(); drawEnemies(); drawBullets(state.pBullets); drawBullets(state.eBullets); drawParticles(); drawPlayer(); drawStageMessage();
    ctx.restore();
  }

  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.033, (now-last)/1000); last=now;
    if (state.mode === 'playing') {
      updatePlayer(dt); updateBullets(state.pBullets,dt); updateBullets(state.eBullets,dt); updateEnemies(dt);
      if (state.mode === 'playing') {
        updatePickups(dt); updateParticles(dt); updateStage(dt);
        if (state.mode === 'playing') handleCollisions();
      }
      updateHud();
    }
    draw(); requestAnimationFrame(loop);
  }

  function onPointerMove(ev){
    const r=canvas.getBoundingClientRect();
    state.touchX = clamp((ev.clientX-r.left)/r.width*W, 30, W-30);
    state.touchY = clamp((ev.clientY-r.top)/r.height*H, 60, H-30);
  }
  canvas.addEventListener('pointerdown', ev => {
    if (state.mode !== 'playing') return;
    state.touchActive = true; state.pointerId = ev.pointerId; canvas.setPointerCapture?.(ev.pointerId); onPointerMove(ev);
  });
  canvas.addEventListener('pointermove', ev => { if (state.touchActive && ev.pointerId === state.pointerId) onPointerMove(ev); });
  canvas.addEventListener('pointerup', ev => { if (ev.pointerId===state.pointerId) state.touchActive = false; });
  canvas.addEventListener('pointercancel', ev => { if (ev.pointerId === state.pointerId) clearInput(); });
  canvas.addEventListener('lostpointercapture', ev => { if (ev.pointerId === state.pointerId) clearInput(); });
  window.addEventListener('blur', () => { clearInput(); pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); pauseGame(); } });

  window.addEventListener('keydown', ev => {
    const k = ev.key.length===1 ? ev.key.toLowerCase() : ev.key;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(k) && state.mode === 'playing') ev.preventDefault();
    if (ev.repeat && ['x','b','p','Escape'].includes(k)) return;
    state.keys[k]=true;
    if ((k==='x'||k==='b') && state.mode==='playing') playerBomb();
    if ((k==='p'||k==='Escape') && state.mode==='playing') pauseGame(); else if ((k==='p'||k==='Escape') && state.mode==='pause') resumeGame();
  });
  window.addEventListener('keyup', ev => { const k = ev.key.length===1 ? ev.key.toLowerCase() : ev.key; state.keys[k]=false; });

  $('startBtn').addEventListener('click', () => { if (!state.canStart) return; resetGame(); audio.tone(520,0.08,'triangle',0.03); });
  $('helpBtn').addEventListener('click', ()=> ui.help.classList.remove('hidden'));
  $('helpClose').addEventListener('click', ()=> ui.help.classList.add('hidden'));
  $('resumeBtn').addEventListener('click', resumeGame);
  $('backMenuBtn').addEventListener('click', ()=> { state.mode='menu'; ui.pause.classList.add('hidden'); ui.menu.classList.remove('hidden'); ui.touchBomb.classList.add('hidden'); ui.touchPause.classList.add('hidden'); ui.status.textContent='MISSION READY'; });
  $('retryBtn').addEventListener('click', resetGame);
  $('menuBtn').addEventListener('click', ()=> { state.mode='menu'; ui.result.classList.add('hidden'); ui.menu.classList.remove('hidden'); ui.touchBomb.classList.add('hidden'); ui.touchPause.classList.add('hidden'); ui.status.textContent='MISSION READY'; });
  $('soundBtn').addEventListener('click', ()=> { audio.enabled = !audio.enabled; $('soundBtn').textContent = audio.enabled ? '🔊 사운드' : '🔇 사운드'; });
  $('fullBtn').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        if (!document.documentElement.requestFullscreen) { ui.status.textContent='이 브라우저는 전체화면을 지원하지 않습니다'; return; }
        await document.documentElement.requestFullscreen();
      } else await document.exitFullscreen();
    } catch { ui.status.textContent='전체화면 전환을 사용할 수 없습니다'; }
  });
  ui.touchBomb.addEventListener('click', playerBomb);
  ui.touchPause.addEventListener('click', pauseGame);

  updateHud(); ui.best.textContent = String(state.best).padStart(8,'0');
  loadAssets().then(()=> { state.canStart = true; ui.loading.textContent = '에셋 로딩 완료 — 출격 가능'; }).catch(err => { ui.loading.textContent = '에셋 로딩 실패'; console.error(err); });
  requestAnimationFrame(loop);
})();

