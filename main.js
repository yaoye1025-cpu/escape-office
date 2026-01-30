(function () {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // Player: square
  const playerSize = 24;
  let playerX = 100;
  let playerY = 300;
  const playerSpeed = 180; // pixels per second

  // Door: rectangle
  const doorX = 650;
  const doorY = 250;
  const doorWidth = 80;
  const doorHeight = 100;

  // Energy
  let energy = 100;
  const baseDrainPerSecond = 2;
  const drainAccelerationPerSecond = 0.5; // extra drain per second of elapsed time
  let elapsedTimeMs = 0;

  // Input
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
  let gameResult = null; // 'success' | 'failure' | null
  let lastTime = null;

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
      playerX += dx * move;
      playerY += dy * move;
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

    // Door: rectangle
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(doorX, doorY, doorWidth, doorHeight);
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    ctx.strokeRect(doorX, doorY, doorWidth, doorHeight);

    // Player: square
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(playerX, playerY, playerSize, playerSize);
    ctx.strokeStyle = '#2d5a8a';
    ctx.lineWidth = 2;
    ctx.strokeRect(playerX, playerY, playerSize, playerSize);

    // Energy text
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
