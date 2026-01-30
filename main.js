(function () {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const playerSize = 24;
  let playerX = 38;
  let playerY = 548;
  const playerSpeed = 180;

  // Exit door: top area, not visible from start (start is bottom-left)
  const doorX = 362;
  const doorY = 28;
  const doorWidth = 76;
  const doorHeight = 48;

  let energy = 100;
  const baseDrainPerSecond = 2;
  const drainAccelerationPerSecond = 0.5;
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

  // ─── Wall shapes: all axis-aligned rectangles { x, y, w, h } ───
  // Boundary (4), cubicle partitions (~10), main corridor (~20), boss offices (~12), safe office (~4), final approach (~10)
  const WALLS = [
    // 1) Boundary
    { x: 0, y: 0, w: 14, h: 600 },
    { x: 786, y: 0, w: 14, h: 600 },
    { x: 0, y: 0, w: 800, h: 14 },
    { x: 0, y: 586, w: 800, h: 14 },

    // 2) Irregular cubicle cluster near start (bottom-left) – offset partitions
    { x: 18, y: 418, w: 8, h: 168 },
    { x: 52, y: 455, w: 6, h: 133 },
    { x: 58, y: 402, w: 10, h: 98 },
    { x: 118, y: 478, w: 7, h: 108 },
    { x: 128, y: 415, w: 12, h: 72 },
    { x: 168, y: 442, w: 8, h: 144 },
    { x: 178, y: 398, w: 6, h: 58 },
    { x: 42, y: 398, w: 88, h: 6 },
    { x: 48, y: 448, w: 72, h: 7 },
    { x: 112, y: 512, w: 68, h: 6 },
    { x: 22, y: 535, w: 95, h: 8 },

    // 3) Main traversal zone – left side of bending corridor (angled/offset segments)
    { x: 188, y: 14, w: 10, h: 185 },
    { x: 198, y: 92, w: 8, h: 212 },
    { x: 206, y: 268, w: 12, h: 138 },
    { x: 218, y: 318, w: 6, h: 88 },
    { x: 224, y: 14, w: 14, h: 125 },
    { x: 238, y: 245, w: 10, h: 165 },
    { x: 248, y: 14, w: 8, h: 198 },
    { x: 256, y: 278, w: 9, h: 132 },
    { x: 265, y: 14, w: 11, h: 155 },
    { x: 276, y: 302, w: 7, h: 108 },

    // 4) Main traversal zone – right side (varying distance = varying corridor width)
    { x: 318, y: 14, w: 12, h: 168 },
    { x: 330, y: 178, w: 8, h: 98 },
    { x: 338, y: 14, w: 10, h: 142 },
    { x: 348, y: 258, w: 9, h: 152 },
    { x: 357, y: 14, w: 8, h: 118 },
    { x: 365, y: 288, w: 11, h: 122 },
    { x: 376, y: 14, w: 14, h: 88 },
    { x: 390, y: 268, w: 8, h: 142 },
    { x: 398, y: 14, w: 9, h: 195 },
    { x: 407, y: 245, w: 10, h: 165 },
    { x: 417, y: 14, w: 12, h: 178 },
    { x: 429, y: 278, w: 8, h: 132 },
    { x: 437, y: 14, w: 10, h: 155 },
    { x: 447, y: 302, w: 7, h: 108 },

    // 5) Horizontal corridor segments (bend/shift) – top and bottom of horizontal stretch
    { x: 198, y: 198, w: 228, h: 8 },
    { x: 206, y: 258, w: 242, h: 10 },
    { x: 298, y: 398, w: 118, h: 7 },
    { x: 224, y: 455, w: 185, h: 9 },
    { x: 265, y: 138, w: 182, h: 6 },
    { x: 276, y: 88, w: 168, h: 8 },

    // 6) Boss Office 1 – spatial pressure (left of main flow)
    { x: 118, y: 268, w: 82, h: 10 },
    { x: 118, y: 268, w: 10, h: 92 },
    { x: 118, y: 352, w: 85, h: 10 },
    { x: 193, y: 278, w: 10, h: 74 },

    // 7) Boss Office 2 – center pressure
    { x: 448, y: 198, w: 92, h: 8 },
    { x: 448, y: 198, w: 10, h: 88 },
    { x: 448, y: 278, w: 95, h: 10 },
    { x: 533, y: 206, w: 10, h: 72 },

    // 8) Boss Office 3 – upper pressure
    { x: 276, y: 58, w: 98, h: 8 },
    { x: 276, y: 58, w: 10, h: 72 },
    { x: 276, y: 122, w: 102, h: 8 },
    { x: 368, y: 66, w: 10, h: 56 },

    // 9) Safe Office – off main flow, one entrance (recess)
    { x: 542, y: 318, w: 12, h: 158 },
    { x: 542, y: 318, w: 118, h: 10 },
    { x: 542, y: 466, w: 122, h: 10 },
    { x: 652, y: 328, w: 10, h: 138 },

    // 10) Final approach – irregular narrowing before exit
    { x: 318, y: 78, w: 48, h: 8 },
    { x: 318, y: 78, w: 8, h: 52 },
    { x: 358, y: 86, w: 8, h: 48 },
    { x: 366, y: 78, w: 52, h: 8 },
    { x: 418, y: 78, w: 8, h: 58 },
    { x: 426, y: 78, w: 42, h: 8 },
    { x: 332, y: 14, w: 8, h: 68 },
    { x: 340, y: 14, w: 38, h: 8 },
    { x: 378, y: 14, w: 8, h: 42 },
    { x: 386, y: 14, w: 48, h: 8 },
  ];

  function intersectsWall(px, py, size) {
    for (let i = 0; i < WALLS.length; i++) {
      const w = WALLS[i];
      if (
        px < w.x + w.w &&
        px + size > w.x &&
        py < w.y + w.h &&
        py + size > w.y
      ) {
        return true;
      }
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

    // Walls
    ctx.fillStyle = '#3d3d3d';
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i < WALLS.length; i++) {
      const w = WALLS[i];
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeRect(w.x, w.y, w.w, w.h);
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

/*
  WALL SHAPES USED (all axis-aligned rectangles: x, y, w, h)
  ─────────────────────────────────────────────────────────
  1) Boundary (4): (0,0,14,600), (786,0,14,600), (0,0,800,14), (0,586,800,14)
  2) Cubicle cluster (11): (18,418,8,168), (52,455,6,133), (58,402,10,98), (118,478,7,108), (128,415,12,72), (168,442,8,144), (178,398,6,58), (42,398,88,6), (48,448,72,7), (112,512,68,6), (22,535,95,8)
  3) Main corridor left (10): (188,14,10,185), (198,92,8,212), (206,268,12,138), (218,318,6,88), (224,14,14,125), (238,245,10,165), (248,14,8,198), (256,278,9,132), (265,14,11,155), (276,302,7,108)
  4) Main corridor right (13): (318,14,12,168), (330,178,8,98), (338,14,10,142), (348,258,9,152), (357,14,8,118), (365,288,11,122), (376,14,14,88), (390,268,8,142), (398,14,9,195), (407,245,10,165), (417,14,12,178), (429,278,8,132), (437,14,10,155), (447,302,7,108)
  5) Horizontal corridor (6): (198,198,228,8), (206,258,242,10), (298,398,118,7), (224,455,185,9), (265,138,182,6), (276,88,168,8)
  6) Boss Office 1 (4): (118,268,82,10), (118,268,10,92), (118,352,85,10), (193,278,10,74)
  7) Boss Office 2 (4): (448,198,92,8), (448,198,10,88), (448,278,95,10), (533,206,10,72)
  8) Boss Office 3 (4): (276,58,98,8), (276,58,10,72), (276,122,102,8), (368,66,10,56)
  9) Safe Office (4): (542,318,12,158), (542,318,118,10), (542,466,122,10), (652,328,10,138)
  10) Final approach (10): (318,78,48,8), (318,78,8,52), (358,86,8,48), (366,78,52,8), (418,78,8,58), (426,78,42,8), (332,14,8,68), (340,14,38,8), (378,14,8,42), (386,14,48,8)
*/
