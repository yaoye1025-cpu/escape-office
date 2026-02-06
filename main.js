(function () {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  canvas.width = 1200;
  canvas.height = 600;
  
  const ctx = canvas.getContext('2d');
  

  const playerSize = 30;
  let playerX = 50;
  let playerY = 50;
  const playerSpeed = 180;

 // Exit door (use same as exitZone so logic + drawing match)
  const doorX = 1180;
  const doorY = 460;
  const doorWidth = 20;
  const doorHeight = 100;

  let energy = 140;
  const baseDrainPerSecond = 1.2;
  const drainAccelerationPerSecond = 0.3;
  let elapsedTimeMs = 0;

  const keys = {};
  document.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].indexOf(e.code) !== -1) {
      e.preventDefault();
    }
  });
  document.addEventListener('keyup', function (e) {
    keys[e.code] = false;
  });

  let gameOver = false;
  let gameResult = null;
  let lastTime = null;
  let hitFlashMs = 0; // 被抓时闪红计时器（毫秒）

  // ─── Geometry: Rect ───
  function Rect(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
  Rect.prototype.containsPoint = function (px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  };
  Rect.prototype.intersectsRect = function (other) {
    return (
      this.x < other.x + other.w &&
      this.x + this.w > other.x &&
      this.y < other.y + other.h &&
      this.y + this.h > other.y
    );
  };

  // ─── V1 MAP: WALLS ───
// Walls include: outer borders + desks + corridor obstacles (plants).
const WALLS = [
  // Outer border (thickness 20)
  new Rect(0, 0, 1200, 20),
  new Rect(0, 580, 1200, 20),
  new Rect(0, 0, 20, 600),
  new Rect(1180, 0, 20, 600),

  // Left wall with bottom door gap
  new Rect(520, 0, 20, 480),
  new Rect(520, 560, 20, 40),

  // Right wall with top door gap
  new Rect(660, 0, 20, 60),
  new Rect(660, 140, 20, 460),

  // --- Left area desks (obstacles) ---
  new Rect(70, 100, 80, 100),
  new Rect(200, 100, 80, 100),
  new Rect(330, 100, 80, 100),

  new Rect(130, 260, 80, 100),
  new Rect(270, 260, 80, 100),
  new Rect(410, 260, 80, 100),

  // --- Mid corridor obstacles: force S movement ---
  new Rect(540, 20, 60, 60),
  new Rect(600, 140, 60, 60),
  new Rect(540, 260, 60, 60),
  new Rect(600, 380, 60, 60),

  // (可选) 右侧 desks 障碍（如果你想要）
  // new Rect(720, 260, 60, 100),
  // new Rect(880, 260, 60, 100),
  // new Rect(720, 460, 60, 100),
  // new Rect(880, 460, 60, 100),
];

 // ─── ZONES ─── (V1 coords aligned to 1200x600)

// Neutral / Boss forbidden
const corridorZone = new Rect(520, 0, 160, 600);

// Safe zones
const safe1Zone = new Rect(280, 440, 180, 120);
const safe2Zone = new Rect(980, 60, 180, 120);

// Boss probability zones (Plan A hard boundaries)
const boss1_90 = new Rect(0, 260, 500, 220);
const boss1_60 = new Rect(260, 260, 200, 220);

const boss2_100 = new Rect(680, 60, 220, 300);

const boss3_50 = new Rect(800, 280, 400, 220);


  const boss1Zones = [{ zone: boss1_90, chance: 0.9 }, ];
  const boss2Zones = [{ zone: boss2_100, chance: 1.0 }];
  const boss3Zones = [{ zone: boss3_50, chance: 0.5 }];

  // ─── Boss home blocks (visual only) – EDIT: coordinates for boss home display ───
  const boss1Home = new Rect(50, 440, 180, 120);
  const boss2Home = new Rect(740, 60, 180, 120);
  const boss3Home = new Rect(980, 280, 180, 120);

  // ─── Boss state machine (Plan A / hard boundary) ───
  const bosses = [
    {
      id: 1,
      state: 'idle',
      activeZones: boss1Zones,
      home: boss1Home,
      x: boss1Home.x + boss1Home.w / 2 - 12,
      y: boss1Home.y + boss1Home.h / 2 - 12,
      chaseSpeed: 140,
      lastRollTime: 0,
      lastHitTime: 0,
    },
    {
      id: 2,
      state: 'idle',
      activeZones: boss2Zones,
      home: boss2Home,
      x: boss2Home.x + boss2Home.w / 2 - 12,
      y: boss2Home.y + boss2Home.h / 2 - 12,
      chaseSpeed: 150,
      lastRollTime: 0,
      lastHitTime: 0,
    },
    {
      id: 3,
      state: 'idle',
      activeZones: boss3Zones,
      home: boss3Home,
      x: boss3Home.x + boss3Home.w / 2 - 12,
      y: boss3Home.y + boss3Home.h / 2 - 12,
      chaseSpeed: 160,
      lastRollTime: 0,
      lastHitTime: 0,
    },
  ];

  function playerRect() {
    return new Rect(playerX, playerY, playerSize, playerSize);
  }

  function isInZone(rect, zone) {
    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;
    return zone.containsPoint(centerX, centerY);
  }

  function isInAnyZone(rect, zones) {
    for (let i = 0; i < zones.length; i++) {
      if (isInZone(rect, zones[i].zone)) return true;
    }
    return false;
  }

  function isInCorridorOrSafe(rect) {
    return (
      isInZone(rect, corridorZone) ||
      isInZone(rect, safe1Zone) ||
      isInZone(rect, safe2Zone)
    );
  }

  function updateBosses(deltaTimeMs, now) {
    const pr = playerRect();
    for (let i = 0; i < bosses.length; i++) {
      const b = bosses[i];
      const inBossZone = isInAnyZone(pr, b.activeZones);
      const inSafeOrCorridor = isInCorridorOrSafe(pr);

      if (b.state === 'chasing') {
        if (!inBossZone || inSafeOrCorridor) {
          b.state = 'idle';
          b.x = b.home.x + b.home.w / 2 - 12;
          b.y = b.home.y + b.home.h / 2 - 12;
          continue;
        }
        const dx = playerX + playerSize / 2 - (b.x + 12);
        const dy = playerY + playerSize / 2 - (b.y + 12);
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 1) {
          const move = Math.min(b.chaseSpeed * (deltaTimeMs / 1000), len - 1);
          b.x += (dx / len) * move;
          b.y += (dy / len) * move;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let j = 0; j < b.activeZones.length; j++) {
          const z = b.activeZones[j].zone;
          minX = Math.min(minX, z.x); minY = Math.min(minY, z.y);
          maxX = Math.max(maxX, z.x + z.w); maxY = Math.max(maxY, z.y + z.h);
        }
        b.x = Math.max(minX, Math.min(maxX - 24, b.x));
b.y = Math.max(minY, Math.min(maxY - 24, b.y));

// --- HIT CHECK: boss catches player -> energy drops (with cooldown) ---
const bossRect = new Rect(b.x, b.y, 24, 24);
const prNow = playerRect();

const HIT_COOLDOWN_MS = 900; // 0.9s
const HIT_DAMAGE = 25;       // energy loss per hit

if (bossRect.intersectsRect(prNow)) {
  if (now - b.lastHitTime >= HIT_COOLDOWN_MS) {
    b.lastHitTime = now;
    energy = Math.max(0, energy - HIT_DAMAGE);
    hitFlashMs = 200; // 👈 触发红色闪屏 0.2 秒
  }
}

continue;
      }

      if (b.state === 'idle' && inBossZone && !inSafeOrCorridor) {
        const canRoll = now - b.lastRollTime >= 1000;
        if (canRoll) {
          b.lastRollTime = now;
          for (let j = 0; j < b.activeZones.length; j++) {
            if (!isInZone(pr, b.activeZones[j].zone)) continue;
            if (Math.random() < b.activeZones[j].chance) {
              b.state = 'chasing';
              break;
            }
          }
        }
      }
    }
  }

  function intersectsWall(px, py, size) {
    const r = new Rect(px, py, size, size);
    for (let i = 0; i < WALLS.length; i++) {
      const w = WALLS[i];
      const wr = w instanceof Rect ? w : new Rect(w.x, w.y, w.w, w.h);
      if (r.intersectsRect(wr)) return true;
    }
    return false;
  }

  function getDrainRatePerSecond() {
    const elapsedSeconds = elapsedTimeMs / 1000;
    return baseDrainPerSecond + drainAccelerationPerSecond * elapsedSeconds;
  }

  function playerReachesDoor() {
    return (
      playerX < doorX + doorWidth &&
      playerX + playerSize > doorX &&
      playerY < doorY + doorHeight &&
      playerY + playerSize > doorY
    );
  }

  function update(deltaTimeMs) {
    if (gameOver) return;

    elapsedTimeMs += deltaTimeMs;
    const now = performance.now();

    let dx = 0;
    let dy = 0;
    if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
      const move = (playerSpeed * deltaTimeMs) / 1000;

      let newX = playerX + dx * move;
      let newY = playerY;
      if (!intersectsWall(newX, newY, playerSize)) {
        playerX = newX;
      }
      newY = playerY + dy * move;
      if (!intersectsWall(playerX, newY, playerSize)) {
        playerY = newY;
      }
    }

    updateBosses(deltaTimeMs, now);

    const drainRate = getDrainRatePerSecond();
    energy -= drainRate * (deltaTimeMs / 1000);
    if (energy < 0) energy = 0;


    if (energy <= 0) {
      gameOver = true;
      gameResult = 'failure';
      return;
    }
    if (playerReachesDoor() && energy >= 20) {
      gameOver = true;
      gameResult = 'success';
      return;
    }
  }

  function render() {
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // ===== DEBUG: draw zones (temporary) =====
    function drawZone(rect, stroke, fill, label) {
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.fillStyle = fill;
      ctx.lineWidth = 2;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.fillText(label, rect.x + 6, rect.y + 16);
      ctx.restore();
    }

    // ===== DEBUG ZONES =====

// Corridor (Boss forbidden)
drawZone(
  corridorZone,
  '#00bcd4',
  'rgba(0, 188, 212, 0.12)',
  'CORRIDOR'
);

// Boss probability zones
drawZone(boss1_90, '#ff9800', 'rgba(255,152,0,0.12)', 'B1 90%');
drawZone(boss2_100, '#ff5722', 'rgba(255,87,34,0.14)', 'B2 100%');
drawZone(boss3_50, '#e91e63', 'rgba(233,30,99,0.12)', 'B3 50%');

// Exit zone
drawZone(
  new Rect(doorX, doorY, doorWidth, doorHeight),
  '#ffd54f',
  'rgba(255,213,79,0.12)',
  'EXIT'
);


    // Walls (gray rectangles)
    ctx.fillStyle = '#3d3d3d';
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i < WALLS.length; i++) {
      const w = WALLS[i];
      const wr = w instanceof Rect ? w : new Rect(w.x, w.y, w.w, w.h);
      ctx.fillRect(wr.x, wr.y, wr.w, wr.h);
      ctx.strokeRect(wr.x, wr.y, wr.w, wr.h);
    }

    // Safe zones (green, labeled)
    ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 2;
    ctx.fillRect(safe1Zone.x, safe1Zone.y, safe1Zone.w, safe1Zone.h);
    ctx.strokeRect(safe1Zone.x, safe1Zone.y, safe1Zone.w, safe1Zone.h);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText('SAFE 1', safe1Zone.x + 8, safe1Zone.y + 22);

    ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
    ctx.strokeStyle = '#27ae60';
    ctx.fillRect(safe2Zone.x, safe2Zone.y, safe2Zone.w, safe2Zone.h);
    ctx.strokeRect(safe2Zone.x, safe2Zone.y, safe2Zone.w, safe2Zone.h);
    ctx.fillStyle = '#fff';
    ctx.fillText('SAFE 2', safe2Zone.x + 8, safe2Zone.y + 22);

    // Boss home blocks (dark, labeled)
    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    for (let i = 0; i < bosses.length; i++) {
      const h = bosses[i].home;
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.strokeRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = '#888';
      ctx.font = '10px sans-serif';
      ctx.fillText('BOSS ' + bosses[i].id, h.x + 4, h.y + h.h / 2 + 4);
      ctx.fillStyle = '#1a1a1a';
    }

    // Boss when chasing (draw at chase position)
    ctx.fillStyle = '#8b0000';
    for (let i = 0; i < bosses.length; i++) {
      const b = bosses[i];
      if (b.state === 'chasing') {
        ctx.fillRect(b.x, b.y, 24, 24);
        ctx.strokeStyle = '#5c0000';
        ctx.strokeRect(b.x, b.y, 24, 24);
      }
    }

    // Door
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(doorX, doorY, doorWidth, doorHeight);
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    ctx.strokeRect(doorX, doorY, doorWidth, doorHeight);

    // Player
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(playerX, playerY, playerSize, playerSize);
    ctx.strokeStyle = '#2d5a8a';
    ctx.lineWidth = 2;
    ctx.strokeRect(playerX, playerY, playerSize, playerSize);

    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Energy: ' + Math.max(0, Math.floor(energy)), 20, 30);

    if (gameResult === 'failure') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Failure – Out of energy', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'left';
    } else if (gameResult === 'success') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Success – You escaped!', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'left';
    }
  }

  function gameLoop(now) {
    if (lastTime === null) lastTime = now;
    const deltaTimeMs = now - lastTime;
    lastTime = now;

    update(deltaTimeMs);
    render();

    if (!gameOver) {
      requestAnimationFrame(gameLoop);
    }
  }

  requestAnimationFrame(gameLoop);
})();

