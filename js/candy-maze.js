(() => {
  "use strict";

  // === CONSTANTS ===
  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const DPR = 1;
  const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Candy palette: "green" keeps its name (used everywhere as the chrome
  // color) but the cabinet now glows taffy pink, not hacker green.
  const C = {
    black: "#000000",
    green: "#FF6FB5",
    magenta: "#FF2E8C",
    yellow: "#FFD94A",
    cyan: "#7DF5FF",
    mint: "#69FFC7",
    mold: "#27C24C",
    sting: "#FFC400",
    rot: "#B44CFF",
    red: "#FF3355",
    white: "#FFFFFF"
  };
  const CELL = 40;
  const COLS = 30;
  const ROWS = 18;

  const scene = document.createElement("canvas");
  scene.width = W * DPR;
  scene.height = H * DPR;
  const sctx = scene.getContext("2d");

  const glow = document.createElement("canvas");
  glow.width = W;
  glow.height = H;
  const gctx = glow.getContext("2d");

  const post = document.createElement("canvas");
  post.width = W;
  post.height = H;
  const pctx = post.getContext("2d");

  const keys = new Set();
  let last = performance.now();
  let acc = 0;
  let nowTime = 0;
  let game;
  let mode = "free";
  let bootSkipped = false;
  let bootDone = false;
  let powerFlash = 0;
  let brightnessDrop = 0;
  let audio;

  // === AUDIO ENGINE ===
  const AUDIO = {
    ctx: null,
    masterGain: null,
    musicGain: null,
    sfxGain: null,
    masterVolume: 0.3,
    muted: false,
    bgm: null,
    bgmTempo: "free"
  };

  function initAudio() {
    if (AUDIO.ctx) return AUDIO.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    AUDIO.ctx = new AC();
    audio = AUDIO.ctx;
    AUDIO.masterGain = AUDIO.ctx.createGain();
    AUDIO.musicGain = AUDIO.ctx.createGain();
    AUDIO.sfxGain = AUDIO.ctx.createGain();
    AUDIO.masterGain.gain.value = AUDIO.muted ? 0 : AUDIO.masterVolume;
    AUDIO.musicGain.gain.value = 0.55;
    AUDIO.sfxGain.gain.value = 1;
    AUDIO.musicGain.connect(AUDIO.masterGain);
    AUDIO.sfxGain.connect(AUDIO.masterGain);
    AUDIO.masterGain.connect(AUDIO.ctx.destination);
    return AUDIO.ctx;
  }

  function ensureAudio() {
    if (!AUDIO.ctx) initAudio();
    if (AUDIO.ctx.state === "suspended") {
      const resumed = AUDIO.ctx.resume();
      if (resumed && typeof resumed.then === "function") {
        resumed.then(() => {
          if (bootDone && !AUDIO.bgm) startBGM(mode === "challenge" ? "challenge" : "free");
        });
      }
    }
    return AUDIO.ctx;
  }

  function setMasterVolume(value) {
    AUDIO.masterVolume = Math.max(0, Math.min(1, value));
    if (AUDIO.masterGain && !AUDIO.muted) {
      AUDIO.masterGain.gain.value = AUDIO.masterVolume;
    }
  }

  function toggleMute() {
    AUDIO.muted = !AUDIO.muted;
    if (AUDIO.masterGain) {
      AUDIO.masterGain.gain.value = AUDIO.muted ? 0 : AUDIO.masterVolume;
    }
    return AUDIO.muted;
  }

  // === BOOT SEQUENCE ===
  const boot = {
    start: performance.now(),
    beeps: new Set(),
    skip() {
      if (bootDone) return;
      bootSkipped = true;
      bootDone = true;
      resetGame(mode);
      openStory(STORY.intro, "start");
    },
    update(t) {
      const elapsed = (t - boot.start) / 1000;
      if (!bootDone && !bootSkipped) {
        if (elapsed > 0.3 && !boot.beeps.has("beep")) {
          boot.beeps.add("beep");
          sfxBeep();
        }
        if (elapsed > 3.2 && !boot.beeps.has("chunk")) {
          boot.beeps.add("chunk");
          sfxChunk();
        }
        if (elapsed >= 4) {
          bootDone = true;
          powerFlash = 0.18;
          resetGame(mode);
          openStory(STORY.intro, "start");
        }
      }
    }
  };
  if (new URLSearchParams(location.search).has("skipBoot")) {
    bootSkipped = true;
    bootDone = true;
  }

  function drawBoot(c) {
    const t = bootSkipped ? 4 : (performance.now() - boot.start) / 1000;
    c.fillStyle = C.black;
    c.fillRect(0, 0, W, H);

    if (t < 0.3) return;
    if (t < 0.6) {
      c.fillStyle = C.white;
      c.fillRect(0, H / 2 - 1, W, 2);
      return;
    }

    const bloomH = Math.min(H, (t - 0.6) / 0.4 * H);
    const grad = c.createRadialGradient(W / 2, H / 2, 1, W / 2, H / 2, 520);
    grad.addColorStop(0, "rgba(255,111,181,0.16)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = grad;
    c.fillRect(0, H / 2 - bloomH / 2, W, bloomH);

    if (t >= 1 && t < 2) {
      const flicker = prefersReducedMotion ? 1 : 0.68 + Math.random() * 0.32;
      arcadeText(c, "2ND EYES", W / 2, 282, 34, C.green, "center", flicker);
      arcadeText(c, "ROOM 03", W / 2, 342, 18, C.magenta, "center", flicker);
    }

    if (t >= 2 && t < 3.5) {
      const blink = Math.floor((t - 2) / 0.2) % 2 === 0;
      if (blink) arcadeText(c, "INSERT COIN", W / 2, 324, 24, C.yellow, "center", 1);
    }

    if (t >= 3.5) {
      c.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - (t - 3.5) * 4)})`;
      c.fillRect(0, 0, W, H);
    }
  }

  // === STORY ===
  // The cabinet remembers being a bakery. Three stages = three nights
  // of that memory. BONBON is the last sweet spirit inside the machine.
  const STORY = {
    intro: [
      [
        "BEFORE IT WAS A GAME,",
        "THIS MACHINE WAS A BAKERY.",
        "",
        "IT SOLD SUGAR TO",
        "SOFT-HEARTED PEOPLE."
      ],
      [
        "ONE NIGHT THE OVEN DIED.",
        "",
        "THE SWEETS TURNED SOUR:",
        "MOLD. STING. ROT."
      ],
      [
        "YOU ARE BONBON,",
        "THE LAST SWEET SPIRIT.",
        "",
        "EAT BACK EVERY MEMORY OF SUGAR.",
        "THEN FIND THE OVEN LIGHT."
      ]
    ],
    // Shown before entering LEVELS[index].
    stages: [
      null,
      [
        "NIGHT TWO.",
        "",
        "THE HIVE WOKE UP ANGRY.",
        "STING REMEMBERS BEING HONEY."
      ],
      [
        "LAST NIGHT.",
        "",
        "ROT GUARDS THE OVEN DOOR.",
        "EVERYTHING SWEET IS ALMOST HOME."
      ]
    ],
    ending: [
      [
        "THE OVEN LIGHT COMES BACK ON.",
        "",
        "THE BAKERY SMELLS WARM AGAIN.",
        "THE MACHINE STOPS HUMMING."
      ],
      [
        "BONBON SLEEPS IN THE SUGAR.",
        "",
        "THANK YOU FOR PLAYING.",
        "2ND EYES — ROOM 03"
      ]
    ]
  };

  let story = null; // { pages, index, next: "start" | "advance" | "restart" }

  function openStory(pages, next) {
    story = { pages, index: 0, next };
    stopBGM();
  }

  function storyAdvance() {
    if (!story) return;
    sfxMenuTick();
    story.index += 1;
    if (story.index < story.pages.length) return;
    const next = story.next;
    story = null;
    if (next === "advance") {
      advanceLevel();
    } else if (next === "restart") {
      setActiveLevel(0);
      resetGame(mode);
    } else {
      resetGame(mode);
    }
  }

  function storySkip() {
    if (!story) return;
    story.index = story.pages.length - 1;
    storyAdvance();
  }

  // Called when a cleared stage moves on: interstitial, or the ending.
  function storyNextStage() {
    const nextIndex = activeLevelIndex + 1;
    if (nextIndex >= LEVELS.length) {
      openStory(STORY.ending, "restart");
      return;
    }
    const pages = STORY.stages[nextIndex];
    if (pages) openStory([pages], "advance");
    else advanceLevel();
  }

  function drawStory(c) {
    c.fillStyle = C.black;
    c.fillRect(0, 0, W, H);

    const grad = c.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 560);
    grad.addColorStop(0, "rgba(255,111,181,0.13)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    const page = story.pages[story.index];
    const lineH = 46;
    const startY = H / 2 - ((page.length - 1) * lineH) / 2 - 30;
    page.forEach((line, i) => {
      if (!line) return;
      const lead = i === 0;
      arcadeText(c, line, W / 2, startY + i * lineH, lead ? 17 : 14, lead ? C.yellow : C.white, "center", 1);
    });

    // Page dots
    const dots = story.pages.length;
    if (dots > 1) {
      for (let i = 0; i < dots; i += 1) {
        c.save();
        c.globalAlpha = i === story.index ? 1 : 0.28;
        c.fillStyle = C.green;
        c.beginPath();
        c.arc(W / 2 + (i - (dots - 1) / 2) * 26, H - 132, 4, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }

    const blink = Math.floor(nowTime * 2.2) % 2 === 0;
    if (blink || prefersReducedMotion) {
      arcadeText(c, "SPACE TO CONTINUE · ESC TO SKIP", W / 2, H - 92, 10, C.green, "center", 1);
    }
  }

  // === MAZE DATA ===
  const LEVELS = window.CANDY_MAZE_LEVELS;

  let activeLevelIndex = Math.max(0, Math.min(LEVELS.length - 1, (Number(new URLSearchParams(location.search).get("level")) || 1) - 1));
  let activeLevel = LEVELS[activeLevelIndex];
  let activeMap = activeLevel.map;

  function setActiveLevel(index) {
    activeLevelIndex = (index + LEVELS.length) % LEVELS.length;
    activeLevel = LEVELS[activeLevelIndex];
    activeMap = activeLevel.map;
  }

  function cellCenter(x, y) {
    return { x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 };
  }

  function isWall(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return true;
    return activeMap[gy][gx] === "#";
  }

  function isOpen(gx, gy) {
    return !isWall(gx, gy);
  }

  function circleHitsWall(x, y, r) {
    const minX = Math.floor((x - r) / CELL);
    const maxX = Math.floor((x + r) / CELL);
    const minY = Math.floor((y - r) / CELL);
    const maxY = Math.floor((y + r) / CELL);
    for (let gy = minY; gy <= maxY; gy += 1) {
      for (let gx = minX; gx <= maxX; gx += 1) {
        if (!isWall(gx, gy)) continue;
        const rx = gx * CELL;
        const ry = gy * CELL;
        const nx = Math.max(rx, Math.min(x, rx + CELL));
        const ny = Math.max(ry, Math.min(y, ry + CELL));
        const dx = x - nx;
        const dy = y - ny;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  function collectableCells() {
    const cells = [];
    for (let y = 1; y < ROWS - 1; y += 1) {
      for (let x = 1; x < COLS - 1; x += 1) {
        if (!isOpen(x, y)) continue;
        if (x === activeLevel.spawn.x && y === activeLevel.spawn.y) continue;
        if (x === activeLevel.exit.x && y === activeLevel.exit.y) continue;
        if (activeLevel.powerCells.some((p) => p.x === x && p.y === y)) continue;
        const roomBonus = inRoom(x, y, activeLevel.rooms.A) || inRoom(x, y, activeLevel.rooms.C);
        if (roomBonus || (x * 7 + y * 11) % 3 !== 0) cells.push({ x, y });
      }
    }
    return cells.slice(0, activeLevel.candyLimit);
  }

  function inRoom(x, y, room) {
    return x >= room.x1 && x <= room.x2 && y >= room.y1 && y <= room.y2;
  }

  function validateMazeConnectivity() {
    const start = activeLevel.spawn;
    const exit = activeLevel.exit;
    const visited = new Set();
    const queue = [{ x: start.x, y: start.y }];
    visited.add(`${start.x},${start.y}`);

    while (queue.length > 0) {
      const cell = queue.shift();
      for (const dir of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
        const nx = cell.x + dir.x;
        const ny = cell.y + dir.y;
        const key = `${nx},${ny}`;
        if (visited.has(key) || isWall(nx, ny)) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }

    if (!visited.has(`${exit.x},${exit.y}`)) {
      console.error(`[MAZE] Exit (${exit.x},${exit.y}) unreachable from spawn!`);
    }

    if (game && game.candy) {
      const before = game.candy.length;
      game.candy = game.candy.filter((candy) => {
        const gx = Number.isFinite(candy.gx) ? candy.gx : Math.floor(candy.x / CELL);
        const gy = Number.isFinite(candy.gy) ? candy.gy : Math.floor(candy.y / CELL);
        return visited.has(`${gx},${gy}`);
      });
      game.total = game.candy.length;
      if (game.candy.length < before) {
        console.warn(`[MAZE] Removed ${before - game.candy.length} unreachable candy`);
      }
    }

    if (game && game.enemies) {
      game.enemies.forEach((enemy, index) => {
        if (!visited.has(`${enemy.home.gx},${enemy.home.gy}`)) {
          console.error(`[MAZE] Enemy ${index} (${enemy.type}) spawn (${enemy.home.gx},${enemy.home.gy}) unreachable!`);
        }
      });
    }

    return visited;
  }

  // === MODE LOGIC ===
  function resetGame(nextMode = mode) {
    mode = nextMode;
    const p = cellCenter(activeLevel.spawn.x, activeLevel.spawn.y);
    const candy = collectableCells().map((cell, i) => ({
      ...cell,
      ...cellCenter(cell.x, cell.y),
      type: "regular",
      color: i % 2 ? C.mint : C.yellow,
      collected: false
    }));
    activeLevel.powerCells.forEach((cell) => {
      candy.push({
        ...cell,
        ...cellCenter(cell.x, cell.y),
        type: "power",
        color: C.white,
        collected: false
      });
    });

    game = {
      score: 0,
      candy,
      collected: 0,
      total: candy.length,
      lives: 2,
      timer: activeLevel.timer,
      state: "play",
      message: mode === "challenge" ? "EAT ALL CANDY -> EXIT GATE" : "EXPLORE: EAT CANDY -> EXIT",
      messageT: 2.4,
      acidTrails: [],
      player: {
        x: p.x,
        y: p.y,
        r: 11,
        face: 0,
        vx: 1,
        vy: 0,
        invuln: mode === "challenge" ? 2.5 : 0,
        sweetRush: 0,
        inAcid: false,
        acidExposure: 0,
        stamina: 1,
        bob: 0,
        trail: []
      },
      enemies: activeLevel.enemyHomes.map((home) => makeEnemy(home.type, home.x, home.y, home.boss))
    };
    validateMazeConnectivity();
    if (bootDone) {
      powerFlash = 0.12;
      startBGM(mode === "challenge" ? "challenge" : "free");
    }
    canvas.focus();
  }

  function advanceLevel() {
    setActiveLevel(activeLevelIndex + 1);
    resetGame(mode);
  }

  function makeEnemy(type, gx, gy, boss = false) {
    const p = cellCenter(gx, gy);
    const color = type === "mold" ? C.mold : type === "sting" ? C.sting : C.rot;
    const enemy = {
      type,
      boss,
      color,
      x: p.x,
      y: p.y,
      home: { gx, gy },
      r: 18,
      speed: type === "mold" ? 155 : type === "sting" ? 185 : 130,
      dir: { x: 1, y: 0 },
      turn: 0,
      dead: 0,
      lungeTimer: 0,
      lungeActive: 0,
      dashTimer: 0,
      dashActive: 0,
      phase: Math.random() * 10,
      targetX: p.x,
      targetY: p.y
    };
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ].filter((dir) => !isWall(gx + dir.x, gy + dir.y));
    if (dirs.length > 0) {
      enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
    }
    return enemy;
  }

  // === PLAYER ===
  function updatePlayer(dt) {
    const p = game.player;
    if (game.state !== "play") return;
    let x = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
    let y = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len) {
      x /= len;
      y /= len;
      p.face = Math.atan2(y, x);
      p.vx = x;
      p.vy = y;
    }

    let speed = 160;
    if (p.sweetRush > 0) speed = 275;
    const sprinting = mode === "challenge" && keys.has("shift") && p.stamina > 0.02;
    if (sprinting) {
      speed = 260;
      p.stamina = Math.max(0, p.stamina - dt * 0.5);
    } else {
      p.stamina = Math.min(1, p.stamina + dt * 0.28);
    }
    if (p.inAcid) speed *= 0.55;

    if (len) {
      const dx = x * speed * dt;
      const dy = y * speed * dt;
      if (!circleHitsWall(p.x + dx, p.y, p.r)) p.x += dx;
      if (!circleHitsWall(p.x, p.y + dy, p.r)) p.y += dy;
      if (!prefersReducedMotion) p.trail.unshift({ x: p.x, y: p.y, t: 0.22 });
      sfxStep();
    }

    p.bob += dt * (len ? 14 : 5);
    p.trail = p.trail.map((t) => ({ ...t, t: t.t - dt })).filter((t) => t.t > 0).slice(0, 7);
    p.invuln = Math.max(0, p.invuln - dt);
    p.sweetRush = Math.max(0, p.sweetRush - dt);
  }

  function damagePlayer() {
    const p = game.player;
    if (p.invuln > 0 || p.sweetRush > 0 || game.state !== "play") return;
    if (mode !== "challenge") return;
    sfxHit();
    game.lives -= 1;
    p.invuln = 1;
    game.message = "SOUR HIT";
    game.messageT = 1;
    const sp = cellCenter(activeLevel.spawn.x, activeLevel.spawn.y);
    p.x = sp.x;
    p.y = sp.y;
    if (game.lives <= 0) {
      game.state = "gameover";
      game.message = "GAME OVER";
      game.messageT = 999;
      stopBGM();
      sfxGameOver();
    }
  }

  // === CANDY ===
  function updateCandy() {
    const p = game.player;
    for (const candy of game.candy) {
      if (candy.collected) continue;
      const dist = Math.hypot(p.x - candy.x, p.y - candy.y);
      const hit = candy.type === "power" ? 24 : 18;
      if (dist <= hit) {
        candy.collected = true;
        game.collected += 1;
        if (candy.type === "power") {
          game.score += 50;
          p.sweetRush = 4;
          game.message = "SWEET RUSH";
          game.messageT = 1.2;
          sfxPowerUp();
        } else {
          game.score += 10;
          sfxBlip();
        }
      }
    }
  }

  function checkExit() {
    const p = game.player;
    const gx = Math.floor(p.x / CELL);
    const gy = Math.floor(p.y / CELL);
    if (gx === activeLevel.exit.x && gy === activeLevel.exit.y && game.collected >= game.total) {
      game.state = "clear";
      game.message = mode === "challenge" ? "STAGE CLEAR" : "EXIT OPEN";
      game.messageT = 999;
      if (mode === "challenge") game.score += Math.ceil(game.timer) * 20;
      stopBGM();
      sfxStageClear();
    } else if (gx === activeLevel.exit.x && gy === activeLevel.exit.y && game.messageT <= 0) {
      game.message = `${game.total - game.collected} CANDY LEFT`;
      game.messageT = 1.1;
    }
  }

  // === SOUR CANDIES (AI) ===
  function updateEnemies(dt) {
    if (mode !== "challenge" || game.state !== "play") return;
    const p = game.player;
    for (const enemy of game.enemies) {
      if (!Number.isFinite(enemy.turn)) enemy.turn = 0;

      if (enemy.dead > 0) {
        enemy.dead -= dt;
        if (enemy.dead <= 0) {
          const hp = cellCenter(enemy.home.gx, enemy.home.gy);
          enemy.x = hp.x;
          enemy.y = hp.y;
        }
        continue;
      }

      if (enemy.type === "mold") {
        enemy.lungeTimer = (enemy.lungeTimer || 0) + dt;
        if (enemy.lungeTimer > 4) {
          enemy.lungeActive = 0.8;
          enemy.lungeTimer = 0;
          sfxMoldLunge();
        }
        enemy.lungeActive = Math.max(0, (enemy.lungeActive || 0) - dt);
      }
      if (enemy.type === "sting") {
        enemy.dashTimer = (enemy.dashTimer || 0) + dt;
        if (enemy.dashTimer > 2.8 && p.sweetRush <= 0) {
          enemy.dashActive = 0.42;
          enemy.dashTimer = 0;
        }
        enemy.dashActive = Math.max(0, (enemy.dashActive || 0) - dt);
      }

      enemy.turn -= dt;
      enemy.targetX = p.x;
      enemy.targetY = p.y;
      let target = { x: p.x, y: p.y };
      if (enemy.type === "sting") {
        target.x += p.vx * CELL * 6;
        target.y += p.vy * CELL * 6;
      }
      enemy.targetX = target.x;
      enemy.targetY = target.y;
      const enemyDistance = Math.hypot(p.x - enemy.x, p.y - enemy.y);
      if (enemy.type === "sting" && enemyDistance < CELL * 4) {
        const t = performance.now();
        if (t - (enemy.lastLockSound || 0) > 1500) {
          enemy.lastLockSound = t;
          sfxStingLock();
        }
      }
      if (enemy.type === "rot" && enemy.turn <= 0 && enemyDistance > 280 && activeLevelIndex < 2) {
        pickRandomDir(enemy);
      } else if (enemy.turn <= 0 || atCellCenter(enemy)) {
        if (p.sweetRush > 0) chooseDirAway(enemy, p);
        else chooseDirToward(enemy, target);
      }

      const fleeBoost = p.sweetRush > 0 ? 0.9 : 1;
      const lungeBoost = enemy.type === "mold" && enemy.lungeActive > 0 ? 1.8 : 1;
      const dashBoost = enemy.type === "sting" && enemy.dashActive > 0 ? 1.55 : 1;
      const dx = enemy.dir.x * enemy.speed * fleeBoost * lungeBoost * dashBoost * dt;
      const dy = enemy.dir.y * enemy.speed * fleeBoost * lungeBoost * dashBoost * dt;
      if (circleHitsWall(enemy.x + dx, enemy.y + dy, enemy.r)) {
        if (p.sweetRush > 0) chooseDirAway(enemy, p);
        else if (enemy.type === "rot") pickRandomDir(enemy);
        else chooseDirToward(enemy, target);
      } else {
        enemy.x += dx;
        enemy.y += dy;
      }

      if (enemy.type === "rot" && !prefersReducedMotion) {
        game.acidTrails.unshift({ x: enemy.x, y: enemy.y, t: 5, r: 20 });
      }

      if (Math.hypot(p.x - enemy.x, p.y - enemy.y) < p.r + enemy.r) {
        if (p.sweetRush > 0) {
          enemy.dead = 5;
          game.score += 200;
          game.message = "SOUR POP";
          game.messageT = 0.8;
          sfxSourPop();
        } else {
          damagePlayer();
        }
      }
    }
  }

  function updateAcid(dt) {
    game.acidTrails = game.acidTrails.map((a) => ({ ...a, t: a.t - dt })).filter((a) => a.t > 0).slice(0, 60);
    if (mode !== "challenge") {
      game.player.inAcid = false;
      game.player.acidExposure = 0;
      return;
    }
    const p = game.player;
    let inAcid = false;
    for (const a of game.acidTrails) {
      if (Math.hypot(p.x - a.x, p.y - a.y) < (a.r || 15)) {
        inAcid = true;
        break;
      }
    }
    p.inAcid = inAcid;
    if (inAcid) sfxAcidSizzle();
    if (inAcid && p.sweetRush <= 0) {
      p.acidExposure = (p.acidExposure || 0) + dt;
      if (p.acidExposure > 1.5) {
        damagePlayer();
        p.acidExposure = 0;
      }
    } else {
      p.acidExposure = 0;
    }
  }

  function atCellCenter(e) {
    const gx = Math.floor(e.x / CELL);
    const gy = Math.floor(e.y / CELL);
    const p = cellCenter(gx, gy);
    return Math.hypot(e.x - p.x, e.y - p.y) < 3;
  }

  function openDirs(e) {
    const gx = Math.floor(e.x / CELL);
    const gy = Math.floor(e.y / CELL);
    return [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ].filter((d) => isOpen(gx + d.x, gy + d.y));
  }

  function chooseDirToward(e, target) {
    const dirs = openDirs(e);
    const pathDir = nextPathDir(e, target);
    if (pathDir) {
      e.dir = pathDir;
      e.turn = 0.16;
      return;
    }
    dirs.sort((a, b) => {
      const ax = e.x + a.x * CELL - target.x;
      const ay = e.y + a.y * CELL - target.y;
      const bx = e.x + b.x * CELL - target.x;
      const by = e.y + b.y * CELL - target.y;
      return ax * ax + ay * ay - (bx * bx + by * by);
    });
    if (dirs[0]) e.dir = dirs[0];
    e.turn = 0.18;
  }

  function nextPathDir(e, target) {
    const start = {
      x: Math.floor(e.x / CELL),
      y: Math.floor(e.y / CELL)
    };
    const targetCell = nearestOpenCell(Math.floor(target.x / CELL), Math.floor(target.y / CELL));
    if (!targetCell || !isOpen(start.x, start.y)) return null;
    if (start.x === targetCell.x && start.y === targetCell.y) return null;

    const queue = [{ x: start.x, y: start.y }];
    const seen = new Set([`${start.x},${start.y}`]);
    const firstStep = new Map();
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];

    for (let i = 0; i < queue.length; i += 1) {
      const current = queue[i];
      if (current.x === targetCell.x && current.y === targetCell.y) {
        return firstStep.get(`${current.x},${current.y}`) || null;
      }

      for (const dir of dirs) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;
        const key = `${nx},${ny}`;
        if (seen.has(key) || !isOpen(nx, ny)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
        firstStep.set(key, current.x === start.x && current.y === start.y ? dir : firstStep.get(`${current.x},${current.y}`));
      }
    }
    return null;
  }

  function nearestOpenCell(gx, gy) {
    if (isOpen(gx, gy)) return { x: gx, y: gy };
    for (let radius = 1; radius < 5; radius += 1) {
      for (let y = gy - radius; y <= gy + radius; y += 1) {
        for (let x = gx - radius; x <= gx + radius; x += 1) {
          if (isOpen(x, y)) return { x, y };
        }
      }
    }
    return null;
  }

  function chooseDirAway(e, p) {
    const dirs = openDirs(e);
    dirs.sort((a, b) => {
      const ax = e.x + a.x * CELL - p.x;
      const ay = e.y + a.y * CELL - p.y;
      const bx = e.x + b.x * CELL - p.x;
      const by = e.y + b.y * CELL - p.y;
      return bx * bx + by * by - (ax * ax + ay * ay);
    });
    if (dirs[0]) e.dir = dirs[0];
    e.turn = 0.24;
  }

  function pickRandomDir(e) {
    const dirs = openDirs(e);
    if (dirs.length) e.dir = dirs[Math.floor(Math.random() * dirs.length)];
    e.turn = 0.4 + Math.random() * 0.35;
  }

  // === HUD ===
  function drawHud(c) {
    c.save();
    c.fillStyle = "rgba(0,0,0,0.82)";
    c.strokeStyle = "rgba(255,111,181,0.55)";
    c.lineWidth = 2;
    c.fillRect(12, 12, 210, 68);
    c.strokeRect(12, 12, 210, 68);
    c.fillRect(W / 2 - 215, 12, 430, 64);
    c.strokeRect(W / 2 - 215, 12, 430, 64);
    c.fillRect(W - 250, 12, 238, 68);
    c.strokeRect(W - 250, 12, 238, 68);
    c.fillRect(W / 2 - 290, H - 44, 580, 31);
    c.restore();
    arcadeText(c, "SCORE", 24, 24, 12, C.green, "left", 1);
    arcadeText(c, String(game.score).padStart(5, "0"), 24, 48, 22, C.green, "left", 1);
    arcadeText(c, `${activeLevel.title} — ${activeLevel.subtitle}`, W / 2, 28, 12, "rgba(255,255,255,0.78)", "center", 1);
    if (mode === "free") {
      arcadeText(c, `CANDY ${game.collected}/${game.total}`, W - 24, 30, 13, C.yellow, "right", 1);
    } else {
      arcadeText(c, `LIVES ${"♥".repeat(game.lives)}`, W - 24, 22, 13, C.magenta, "right", 1);
      arcadeText(c, `TIME ${Math.ceil(game.timer)}`, W - 24, 50, 13, C.red, "right", 1);
    }

    drawModePills(c);
    arcadeText(c, "WASD MOVE · SHIFT SPRINT · M MODE · N LEVEL · R RESET", W / 2, H - 30, 10, "rgba(255,255,255,0.72)", "center", 1);

    if (mode === "challenge") {
      c.save();
      c.fillStyle = "rgba(255,255,255,0.12)";
      c.fillRect(W / 2 - 150, H - 62, 300, 10);
      c.fillStyle = game.player.stamina > 0.25 ? C.green : C.red;
      c.shadowColor = c.fillStyle;
      c.shadowBlur = 14;
      c.fillRect(W / 2 - 150, H - 62, 300 * game.player.stamina, 10);
      c.restore();
    }

    const remaining = game.total - game.collected;
    const goalText = remaining > 0 ? `GOAL ${remaining} CANDY THEN EXIT` : "GOAL EXIT GATE OPEN";
    arcadeText(c, goalText, W / 2, 56, 9, remaining > 0 ? C.yellow : C.cyan, "center", 1);

    if (game.messageT > 0) {
      c.save();
      c.fillStyle = "rgba(0,0,0,0.86)";
      c.strokeStyle = game.message.includes("OVER") || game.message.includes("HIT") ? C.red : C.green;
      c.lineWidth = 3;
      c.fillRect(W / 2 - 220, H / 2 - 40, 440, 78);
      c.strokeRect(W / 2 - 220, H / 2 - 40, 440, 78);
      arcadeText(c, game.message, W / 2, H / 2 - 13, game.message.length > 18 ? 15 : 22, c.strokeStyle, "center", 1);
      if (game.state === "gameover") arcadeText(c, "INSERT COIN: PRESS R", W / 2, H / 2 + 52, 13, C.yellow, "center", Math.floor(nowTime * 5) % 2 ? 1 : 0.25);
      if (game.state === "clear") {
        const lastStage = activeLevelIndex === LEVELS.length - 1;
        arcadeText(c, lastStage ? "PRESS N — OPEN THE OVEN" : "PRESS N NEXT NIGHT", W / 2, H / 2 + 52, 13, C.yellow, "center", 1);
      }
      c.restore();
    }
  }

  function drawModePills(c) {
    const x = W / 2 - 220;
    const y = H - 96;
    c.save();
    c.lineWidth = 2;
    c.strokeStyle = C.green;
    c.fillStyle = "#000";
    c.strokeRect(x, y, 440, 42);
    drawPill(c, x + 8, y + 7, 206, 28, "FREE WALK", mode === "free");
    drawPill(c, x + 226, y + 7, 206, 28, "CHALLENGE", mode === "challenge");
    c.restore();
  }

  function drawPill(c, x, y, w, h, label, active) {
    c.save();
    c.fillStyle = active ? C.green : "#000";
    c.strokeStyle = active ? C.green : "rgba(255,111,181,0.35)";
    c.shadowColor = active ? C.green : "transparent";
    c.shadowBlur = active ? 16 : 0;
    c.fillRect(x, y, w, h);
    c.strokeRect(x, y, w, h);
    arcadeText(c, label, x + w / 2, y + 9, 9, active ? "#000" : "rgba(255,255,255,0.58)", "center", 1);
    c.restore();
  }

  // === DRAWING ===
  function drawScene(c) {
    c.clearRect(0, 0, W, H);
    c.fillStyle = C.black;
    c.fillRect(0, 0, W, H);
    drawMaze(c);
    drawRoomLabels(c);
    drawAcid(c);
    drawCandy(c);
    drawExit(c);
    drawEnemies(c);
    drawPlayer(c);
    drawHud(c);
  }

  function drawMaze(c) {
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    c.shadowColor = C.green;
    c.shadowBlur = 18;
    c.strokeStyle = C.green;
    c.lineWidth = 6;
    drawWallEdges(c);
    c.shadowBlur = 0;
    c.strokeStyle = "#FFFFFF";
    c.globalAlpha = 0.35;
    c.lineWidth = 1;
    drawWallEdges(c);
    c.restore();
  }

  function drawWallEdges(c) {
    c.beginPath();
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!isWall(x, y)) continue;
        const px = x * CELL;
        const py = y * CELL;
        if (!isWall(x, y - 1)) { c.moveTo(px + 7, py + 4); c.lineTo(px + CELL - 7, py + 4); }
        if (!isWall(x, y + 1)) { c.moveTo(px + 7, py + CELL - 4); c.lineTo(px + CELL - 7, py + CELL - 4); }
        if (!isWall(x - 1, y)) { c.moveTo(px + 4, py + 7); c.lineTo(px + 4, py + CELL - 7); }
        if (!isWall(x + 1, y)) { c.moveTo(px + CELL - 4, py + 7); c.lineTo(px + CELL - 4, py + CELL - 7); }
      }
    }
    c.stroke();
  }

  function drawRoomLabels(c) {
    c.save();
    c.globalAlpha = 0.28;
    arcadeText(c, activeLevel.rooms.A.name, 212, 92, 8, C.green, "center", 1);
    arcadeText(c, activeLevel.rooms.B.name, 900, 92, 8, C.sting, "center", 1);
    arcadeText(c, activeLevel.rooms.C.name, 230, 458, 8, C.rot, "center", 1);
    arcadeText(c, activeLevel.rooms.D.name, 940, 458, 8, C.cyan, "center", 1);
    c.restore();
  }

  function drawCandy(c) {
    for (const candy of game.candy) {
      if (candy.collected) continue;
      const pulse = 1 + Math.sin(nowTime * 4.2 + candy.x * 0.03) * 0.1;
      c.save();
      c.translate(candy.x, candy.y);
      c.scale(pulse, pulse);
      c.shadowColor = candy.color;
      c.shadowBlur = candy.type === "power" ? 24 : 10;
      c.fillStyle = candy.color;
      if (candy.type === "power") {
        c.beginPath();
        c.moveTo(-23, 0); c.lineTo(-35, -10); c.lineTo(-31, 10); c.closePath(); c.fill();
        c.beginPath();
        c.moveTo(23, 0); c.lineTo(35, -10); c.lineTo(31, 10); c.closePath(); c.fill();
        c.fillRect(-22, -11, 44, 22);
      } else {
        c.beginPath();
        c.arc(0, 0, 10, 0, Math.PI * 2);
        c.fill();
      }
      c.shadowBlur = 0;
      c.fillStyle = C.white;
      c.fillRect(-4, -5, 3, 3);
      c.restore();
    }
  }

  function drawPlayer(c) {
    const p = game.player;
    c.save();
    for (const t of p.trail) {
      c.globalAlpha = t.t * 2.4;
      c.fillStyle = C.magenta;
      c.beginPath();
      c.arc(t.x, t.y, 12, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    c.translate(p.x, p.y);
    c.rotate(p.face);
    const squash = 1 + Math.sin(p.bob) * 0.04;
    c.scale(squash, 1 / squash);
    c.shadowColor = C.magenta;
    c.shadowBlur = 16;
    c.fillStyle = C.magenta;
    c.beginPath();
    c.arc(0, 0, 13 + Math.sin(p.bob) * 0.8, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = "#000";
    c.beginPath();
    c.arc(5, -4, 2.2, 0, Math.PI * 2);
    c.arc(5, 4, 2.2, 0, Math.PI * 2);
    c.fill();
    c.fillRect(8, -1, 4, 2);
    if (p.invuln > 0 && !prefersReducedMotion) {
      c.strokeStyle = Math.floor(nowTime * 20) % 2 ? C.white : C.magenta;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 18, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }

  function drawEnemies(c) {
    if (mode !== "challenge") return;
    for (const e of game.enemies) {
      if (e.dead > 0) continue;
      c.save();
      if (game.player.sweetRush <= 0) {
        c.strokeStyle = e.color;
        c.globalAlpha = 0.18 + Math.sin(nowTime * 10 + e.phase) * 0.06;
        c.lineWidth = 2;
        c.setLineDash([6, 10]);
        c.beginPath();
        c.moveTo(e.x, e.y);
        c.lineTo(game.player.x, game.player.y);
        c.stroke();
        c.setLineDash([]);
        c.globalAlpha = 1;
      }
      if (e.type === "sting" && game.player.sweetRush <= 0) {
        c.strokeStyle = C.sting;
        c.globalAlpha = 0.28;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(e.x, e.y);
        c.lineTo(e.targetX, e.targetY);
        c.stroke();
        c.globalAlpha = 1;
      }
      c.translate(e.x, e.y);
      c.globalAlpha = game.player.sweetRush > 0 ? 0.42 : 1;
      if (game.player.sweetRush <= 0) {
        c.save();
        const pulse = 22 + Math.sin(nowTime * 4 + e.phase) * 4;
        c.globalAlpha = 0.25;
        c.strokeStyle = e.color;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, pulse, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
      c.shadowColor = e.color;
      c.shadowBlur = (e.type === "mold" && e.lungeActive > 0) || (e.type === "sting" && e.dashActive > 0) ? 30 : 18;
      c.fillStyle = game.player.sweetRush > 0 ? "#444444" : e.color;
      if (e.type === "mold") drawMold(c, e);
      if (e.type === "sting") drawSting(c, e);
      if (e.type === "rot") drawRot(c, e);
      c.restore();
    }
  }

  function drawMold(c, e) {
    c.save();
    c.scale(1.4, 1.4);
    if (e.lungeActive > 0 && game.player.sweetRush <= 0) {
      c.shadowColor = C.magenta;
      c.shadowBlur = 20;
      c.strokeStyle = C.magenta;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 18, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = i / 10 * Math.PI * 2;
      const r = 12 + Math.sin(nowTime * 5 + i) * 3;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
    c.fill();
    c.fillStyle = "#000";
    c.fillRect(-7, -5, 4, 3);
    c.fillRect(4, -5, 4, 3);
    c.fillRect(-5, 5, 10, 2);
    c.fillRect(-8, 8, 3, 3);
    c.fillRect(7, 6, 3, 3);
    c.restore();
  }

  function drawSting(c, e) {
    c.save();
    c.scale(1.4, 1.4);
    c.beginPath();
    for (let i = 0; i < 16; i += 1) {
      const a = i / 16 * Math.PI * 2;
      const r = i % 2 ? 12 : 18 + Math.sin(nowTime * 9 + i) * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
    c.fill();
    c.fillStyle = "#000";
    c.fillRect(-7, -5, 5, 2);
    c.fillRect(2, -5, 5, 2);
    c.fillRect(-5, 6, 10, 2);
    c.restore();
  }

  function drawRot(c, e) {
    c.save();
    c.scale(1.4, 1.4);
    c.globalAlpha *= 0.82;
    c.beginPath();
    c.moveTo(-14, -8);
    c.quadraticCurveTo(-5, -18, 10, -10);
    c.quadraticCurveTo(18, 0, 8, 11);
    c.lineTo(4, 18);
    c.lineTo(-2, 10);
    c.lineTo(-8, 17);
    c.quadraticCurveTo(-19, 5, -14, -8);
    c.fill();
    c.fillStyle = C.white;
    c.fillRect(-7, -5, 4, 4);
    c.fillRect(4, -5, 4, 4);
    c.fillStyle = C.red;
    c.fillRect(-2, 6, 6, 8);
    c.restore();
  }

  function drawAcid(c) {
    if (mode !== "challenge") return;
    c.save();
    for (const a of game.acidTrails) {
      c.globalAlpha = Math.max(0, a.t / 5) * 0.45;
      c.fillStyle = C.rot;
      c.shadowColor = C.rot;
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(a.x, a.y, a.r || 12, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function drawExit(c) {
    const p = cellCenter(activeLevel.exit.x, activeLevel.exit.y);
    const open = game.collected >= game.total;
    c.save();
    c.translate(p.x, p.y);
    c.shadowColor = open ? C.cyan : C.red;
    c.shadowBlur = open ? 22 : 12;
    c.strokeStyle = open ? C.cyan : C.red;
    c.lineWidth = 5;
    c.strokeRect(-14, -18, 28, 36);
    arcadeText(c, open ? "OPEN" : "LOCK", 0, 26, 7, open ? C.cyan : C.red, "center", 1);
    c.restore();
  }

  function arcadeText(c, text, x, y, size, color, align = "left", alpha = 1) {
    c.save();
    c.globalAlpha *= alpha;
    c.font = `${size}px "Press Start 2P", ui-monospace, monospace`;
    c.textAlign = align;
    c.textBaseline = "top";
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = 12;
    c.fillText(text, x, y);
    c.restore();
  }

  // === CRT POST-FX ===
  function renderPost() {
    pctx.clearRect(0, 0, W, H);
    pctx.save();
    pctx.globalCompositeOperation = "screen";
    pctx.globalAlpha = 0.34;
    pctx.filter = "blur(7px)";
    pctx.drawImage(scene, 0, 0);
    pctx.restore();

    pctx.save();
    pctx.globalAlpha = 0.42;
    pctx.drawImage(scene, -2, 0);
    pctx.globalAlpha = 0.78;
    pctx.drawImage(scene, 0, 0);
    pctx.globalAlpha = 0.42;
    pctx.drawImage(scene, 2, 0);
    pctx.restore();

    pctx.drawImage(scene, 0, 0);

    pctx.save();
    pctx.globalAlpha = 0.12;
    pctx.fillStyle = "#000";
    for (let y = 0; y < H; y += 4) pctx.fillRect(0, y, W, 2);
    pctx.restore();

    if (!prefersReducedMotion) {
      const img = pctx.getImageData(0, 0, W, H);
      const data = img.data;
      for (let i = 0; i < data.length; i += 4 * 29) {
        const n = Math.random() * 255;
        data[i] = n;
        data[i + 1] = n;
        data[i + 2] = n;
        data[i + 3] = 13;
      }
      pctx.putImageData(img, 0, 0);
    }

    const v = pctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 760);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(0.72, "rgba(0,0,0,0.18)");
    v.addColorStop(1, "rgba(0,0,0,0.88)");
    pctx.fillStyle = v;
    pctx.fillRect(0, 0, W, H);

    if (brightnessDrop > 0 && !prefersReducedMotion) {
      pctx.fillStyle = "rgba(0,0,0,0.15)";
      pctx.fillRect(0, 0, W, H);
    }
    if (powerFlash > 0) {
      pctx.fillStyle = `rgba(255,255,255,${Math.min(1, powerFlash * 7)})`;
      pctx.fillRect(0, 0, W, H);
    }

    ctx.clearRect(0, 0, W, H);
    if (!prefersReducedMotion) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(1.006, 1.012);
      ctx.drawImage(post, -W / 2, -H / 2);
      ctx.restore();
    } else {
      ctx.drawImage(post, 0, 0);
    }
  }

  // === AUDIO (Web Audio API) ===
  function playNote(freq, type, dur, gain = 0.4, delay = 0, targetGain = null) {
    ensureAudio();
    const t = AUDIO.ctx.currentTime + delay;
    const osc = AUDIO.ctx.createOscillator();
    const g = AUDIO.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(targetGain || AUDIO.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    return { osc, gain: g };
  }

  function playSweep(fromHz, toHz, type, dur, gain = 0.3, delay = 0) {
    ensureAudio();
    const t = AUDIO.ctx.currentTime + delay;
    const osc = AUDIO.ctx.createOscillator();
    const g = AUDIO.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(AUDIO.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playNoise(dur, gain = 0.2, filterFreq = 2000) {
    ensureAudio();
    const t = AUDIO.ctx.currentTime;
    const buffer = AUDIO.ctx.createBuffer(1, AUDIO.ctx.sampleRate * dur, AUDIO.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const src = AUDIO.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = AUDIO.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = AUDIO.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(AUDIO.sfxGain);
    src.start(t);
  }

  function sfxBeep() { playNote(800, "sine", 0.08, 0.35); }
  function sfxChunk() { playNote(180, "square", 0.12, 0.5); playNoise(0.05, 0.15); }

  let lastStep = 0;
  function sfxStep() {
    const t = performance.now();
    if (t - lastStep < 180) return;
    lastStep = t;
    playNote(240 + Math.random() * 40, "triangle", 0.04, 0.08);
  }

  function sfxBlip() { playNote(1400, "square", 0.05, 0.22); }
  function sfxChime() {
    playNote(660, "square", 0.09, 0.3);
    playNote(990, "square", 0.12, 0.28, 0.05);
    playNote(1320, "square", 0.16, 0.24, 0.11);
  }
  function sfxPowerUp() {
    playSweep(400, 1600, "square", 0.35, 0.35);
    playNote(1600, "square", 0.15, 0.25, 0.32);
  }

  function sfxHit() {
    playNote(120, "square", 0.18, 0.5);
    playNoise(0.15, 0.28, 800);
  }
  function sfxGameOver() {
    playSweep(500, 60, "sawtooth", 1.2, 0.4);
    playNote(200, "square", 0.4, 0.35, 0.6);
    playNote(160, "square", 0.4, 0.35, 1);
    playNote(120, "square", 0.5, 0.35, 1.4);
  }
  function sfxStageClear() {
    [523, 659, 784, 1047, 1319, 1568].forEach((freq, i) => playNote(freq, "square", 0.18, 0.35, i * 0.11));
  }

  function sfxMoldLunge() { playSweep(300, 700, "sawtooth", 0.28, 0.28); }
  function sfxStingLock() {
    playNote(1800, "square", 0.06, 0.18);
    playNote(1500, "square", 0.06, 0.18, 0.08);
  }
  function sfxAcidSizzle() {
    const t = performance.now();
    if (t - (window._lastAcidHiss || 0) < 400) return;
    window._lastAcidHiss = t;
    playNoise(0.2, 0.15, 3000);
  }
  function sfxSourPop() {
    playSweep(800, 200, "square", 0.2, 0.3);
    playNoise(0.06, 0.2);
  }
  function sfxMenuTick() { playNote(600, "square", 0.03, 0.15); }
  function sfxModeSwitch() {
    playNote(500, "square", 0.06, 0.22);
    playNote(750, "square", 0.08, 0.22, 0.05);
  }

  const BGM_MELODY = [
    [523, 0.25], [659, 0.25], [784, 0.25], [1047, 0.25],
    [988, 0.25], [784, 0.25], [659, 0.5],
    [587, 0.25], [740, 0.25], [880, 0.25], [1175, 0.25],
    [1047, 0.5], [784, 0.5],
    [1047, 0.25], [988, 0.25], [880, 0.25], [784, 0.25],
    [740, 0.25], [659, 0.25], [587, 0.5],
    [523, 0.5], [0, 0.5]
  ];

  const BGM_BASS = [
    [131, 1], [131, 1], [147, 1], [147, 1],
    [131, 1], [131, 1], [98, 1], [131, 1]
  ];

  function startBGM(tempo = "free") {
    if (!AUDIO.ctx) initAudio();
    if (AUDIO.ctx.state === "suspended") {
      AUDIO.bgmTempo = tempo;
      return;
    }
    stopBGM();
    if (AUDIO.musicGain) AUDIO.musicGain.gain.value = 0.55;
    AUDIO.bgmTempo = tempo;
    const speedMult = tempo === "challenge" ? 0.65 : 1;
    const gainMult = tempo === "challenge" ? 0.55 : 0.4;

    const scheduleLoop = () => {
      if (!AUDIO.bgm) return;
      const start = AUDIO.ctx.currentTime + 0.05;
      let t = 0;
      for (const [freq, beat] of BGM_MELODY) {
        const dur = beat * speedMult;
        if (freq > 0) {
          const osc = AUDIO.ctx.createOscillator();
          const g = AUDIO.ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(freq, start + t);
          g.gain.setValueAtTime(0, start + t);
          g.gain.linearRampToValueAtTime(gainMult, start + t + 0.01);
          g.gain.setValueAtTime(gainMult, start + t + dur * 0.7);
          g.gain.exponentialRampToValueAtTime(0.0001, start + t + dur * 0.95);
          osc.connect(g).connect(AUDIO.musicGain);
          osc.start(start + t);
          osc.stop(start + t + dur);
        }
        t += dur;
      }

      let bt = 0;
      for (const [freq, beat] of BGM_BASS) {
        const dur = beat * speedMult;
        if (freq > 0) {
          const osc = AUDIO.ctx.createOscillator();
          const g = AUDIO.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, start + bt);
          g.gain.setValueAtTime(0, start + bt);
          g.gain.linearRampToValueAtTime(gainMult * 0.7, start + bt + 0.02);
          g.gain.setValueAtTime(gainMult * 0.7, start + bt + dur * 0.6);
          g.gain.exponentialRampToValueAtTime(0.0001, start + bt + dur * 0.95);
          osc.connect(g).connect(AUDIO.musicGain);
          osc.start(start + bt);
          osc.stop(start + bt + dur);
        }
        bt += dur;
      }

      AUDIO.bgm = setTimeout(scheduleLoop, t * 1000 - 100);
    };

    AUDIO.bgm = true;
    scheduleLoop();
  }

  function stopBGM() {
    if (AUDIO.bgm && typeof AUDIO.bgm !== "boolean") clearTimeout(AUDIO.bgm);
    AUDIO.bgm = null;
    if (AUDIO.musicGain) AUDIO.musicGain.gain.value = 0;
  }

  // === GAME LOOP ===
  function update(dt) {
    nowTime += dt;
    if (!bootDone) return;
    game.messageT = Math.max(0, game.messageT - dt);
    powerFlash = Math.max(0, powerFlash - dt);
    brightnessDrop = Math.max(0, brightnessDrop - dt);
    if (!prefersReducedMotion && Math.floor(nowTime * 10) % 47 === 0) brightnessDrop = Math.max(brightnessDrop, 0.08);
    if (story) return;

    if (game.state === "play") {
      updatePlayer(dt);
      updateCandy();
      updateEnemies(dt);
      updateAcid(dt);
      checkExit();
      if (mode === "challenge") {
        game.timer = Math.max(0, game.timer - dt);
        if (game.timer <= 0) {
          game.state = "gameover";
          game.message = "GAME OVER";
          game.messageT = 999;
          stopBGM();
          sfxGameOver();
        }
      }
    }
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    boot.update(t);
    acc += dt;
    while (acc >= 1 / 60) {
      update(1 / 60);
      acc -= 1 / 60;
    }
    sctx.clearRect(0, 0, W, H);
    if (!bootDone) drawBoot(sctx);
    else if (story) drawStory(sctx);
    else drawScene(sctx);
    renderPost();
    requestAnimationFrame(frame);
  }

  // === INPUT ===
  addEventListener("keydown", (e) => {
    ensureAudio();
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift"].includes(k)) e.preventDefault();
    if (!bootDone && (k === " " || k === "enter")) {
      boot.skip();
      return;
    }
    if (story) {
      if (k === " " || k === "enter" || k === "e") storyAdvance();
      if (k === "escape") storySkip();
      return;
    }
    keys.add(k);
    if (k === "m") {
      sfxModeSwitch();
      resetGame(mode === "free" ? "challenge" : "free");
    }
    if (k === "n") {
      if (game.state === "clear") storyNextStage();
      else advanceLevel();
    }
    if (k === "r") resetGame(mode);
  });

  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  canvas.addEventListener("pointerdown", (e) => {
    ensureAudio();
    canvas.focus();
    if (!bootDone) {
      boot.skip();
      return;
    }
    if (story) {
      storyAdvance();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * W;
    const y = (e.clientY - rect.top) / rect.height * H;
    if (y > H - 105 && y < H - 48 && x > W / 2 - 220 && x < W / 2 + 220) {
      sfxModeSwitch();
      resetGame(x < W / 2 ? "free" : "challenge");
    }
  });

  // === NAVIGATION ===
  // Players can arrive from the gallery lobby (index.html) or from the
  // rain room arcade cabinet — send them back where they came from.
  const cameFromRain = document.referrer.includes("rain-room");
  const backButton = document.querySelector("[data-previous-room]");
  backButton.textContent = cameFromRain ? "← Rain Room" : "← Gallery";
  backButton.addEventListener("click", () => {
    sfxBeep();
    const overlay = document.querySelector("[data-power-off]");
    overlay.classList.add("is-active");
    sessionStorage.setItem("returning_from_room_03", "1");
    setTimeout(() => {
      window.location.href = cameFromRain ? "rain-room.html" : "index.html";
    }, 980);
  });

  const audioToggle = document.querySelector("[data-audio-toggle]");
  const audioIcon = document.querySelector("[data-audio-icon]");
  const audioSlider = document.querySelector("[data-audio-slider]");

  audioToggle.addEventListener("click", () => {
    ensureAudio();
    const muted = toggleMute();
    audioToggle.classList.toggle("is-muted", muted);
    audioIcon.textContent = muted ? "✕" : "♪";
    sfxMenuTick();
  });

  audioSlider.addEventListener("input", (e) => {
    ensureAudio();
    setMasterVolume(e.target.value / 100);
  });

  audioSlider.addEventListener("change", () => sfxMenuTick());

  resetGame(new URLSearchParams(location.search).get("mode") === "challenge" ? "challenge" : "free");
  canvas.focus();
  requestAnimationFrame(frame);
})();
