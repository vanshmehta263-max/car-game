async function saveScore() {
  let username = localStorage.getItem("parkingUsername");

  if (!username) {
    username = prompt("Enter your player name:");

    if (!username || !username.trim()) {
      username = "Player";
    }

    username = username.trim().slice(0, 30);
    localStorage.setItem("parkingUsername", username);
  }

  try {
    const response = await fetch("/api/save-score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: username,
        level: level,
        parking_time: elapsed,
        car_condition: health
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log("Score saved:", result.score);
    } else {
      console.error(result.message);
    }

  } catch (error) {
    console.error("Could not save score:", error);
  }
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const levelText = document.getElementById("level");
const speedText = document.getElementById("speed");
const timerText = document.getElementById("timer");
const gearText = document.getElementById("gear");
const healthBar = document.getElementById("healthBar");
const message = document.getElementById("message");
const startBtn = document.getElementById("startBtn");

const W = canvas.width;
const H = canvas.height;

let running = false;
let completed = false;
let level = 1;
let elapsed = 0;
let lastTime = 0;
let health = 100;
let damageCooldown = 0;
let parkingTime = 0;
let keys = {};

const car = {
  x: 500,
  y: 500,
  angle: 0,
  speed: 0,
  width: 34,
  height: 62
};

const controls = {
  left: false,
  right: false,
  gas: false,
  brake: false
};

let obstacles = [];
let parkingSpot = {};

function makeLevel() {
  car.x = 500;
  car.y = 515;
  car.angle = 0;
  car.speed = 0;
  health = 100;
  elapsed = 0;
  parkingTime = 0;
  completed = false;

  obstacles = [
    { x: 220, y: 175, w: 90, h: 125 },
    { x: 390, y: 175, w: 90, h: 125 },
    { x: 730, y: 175, w: 90, h: 125 },
    { x: 830, y: 420, w: 105, h: 70 },
    { x: 180, y: 420, w: 105, h: 70 }
  ];

  parkingSpot = {
    x: 555 + ((level - 1) % 3) * 65,
    y: 145,
    w: 75,
    h: 125
  };

  levelText.textContent = String(level).padStart(2, "0");
  updateHUD();
}

function roundedRect(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawGround() {
  ctx.fillStyle = "#52634d";
  ctx.fillRect(0, 0, W, H);

  // Grass texture
  for (let i = 0; i < 180; i++) {
    const x = (i * 137) % W;
    const y = (i * 83) % H;
    ctx.fillStyle = i % 2 ? "#5b6c52" : "#465a45";
    ctx.fillRect(x, y, 3, 3);
  }

  // Parking lot surface
  ctx.fillStyle = "#555b60";
  ctx.fillRect(75, 65, 850, 530);

  // Surface texture
  for (let i = 0; i < 230; i++) {
    const x = 80 + (i * 71) % 840;
    const y = 70 + (i * 47) % 520;
    ctx.fillStyle = i % 2 ? "#60666a" : "#4e5559";
    ctx.fillRect(x, y, 2, 2);
  }

  // Outer curbs
  ctx.strokeStyle = "#d5d1c8";
  ctx.lineWidth = 12;
  ctx.strokeRect(75, 65, 850, 530);

  ctx.strokeStyle = "#353b40";
  ctx.lineWidth = 3;
  ctx.strokeRect(85, 75, 830, 510);
}

function drawParkingLines() {
  // Parking rows
  ctx.strokeStyle = "#e5e4d8";
  ctx.lineWidth = 3;

  for (let x = 145; x <= 855; x += 170) {
    ctx.beginPath();
    ctx.moveTo(x, 90);
    ctx.lineTo(x, 305);
    ctx.stroke();
  }

  for (let x = 145; x <= 855; x += 170) {
    ctx.beginPath();
    ctx.moveTo(x, 380);
    ctx.lineTo(x, 565);
    ctx.stroke();
  }

  // Target parking bay
  ctx.fillStyle = "#e7c65b22";
  ctx.fillRect(parkingSpot.x, parkingSpot.y, parkingSpot.w, parkingSpot.h);

  ctx.strokeStyle = "#f5d45c";
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(parkingSpot.x, parkingSpot.y, parkingSpot.w, parkingSpot.h);
  ctx.setLineDash([]);

  ctx.fillStyle = "#f5d45c";
  ctx.font = "bold 15px Arial";
  ctx.textAlign = "center";
  ctx.fillText("P", parkingSpot.x + parkingSpot.w / 2,
    parkingSpot.y + parkingSpot.h / 2 + 5);
}

function drawParkedCar(x, y, w, h, color) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);

  // Shadow
  ctx.fillStyle = "#0007";
  ctx.fillRect(-w / 2 + 5, -h / 2 + 7, w, h);

  // Wheels
  ctx.fillStyle = "#161a1d";
  ctx.fillRect(-w / 2 - 3, -h / 2 + 10, 6, 20);
  ctx.fillRect(w / 2 - 3, -h / 2 + 10, 6, 20);
  ctx.fillRect(-w / 2 - 3, h / 2 - 30, 6, 20);
  ctx.fillRect(w / 2 - 3, h / 2 - 30, 6, 20);

  roundedRect(-w / 2, -h / 2, w, h, 12, color);
  roundedRect(-w / 2 + 6, -h / 2 + 13, w - 12, 19, 5, "#9cb6c4");
  roundedRect(-w / 2 + 6, h / 2 - 35, w - 12, 23, 5, "#253a48");

  ctx.fillStyle = "#f7e6a2";
  ctx.fillRect(-w / 2 + 5, -h / 2 + 3, 9, 5);
  ctx.fillRect(w / 2 - 14, -h / 2 + 3, 9, 5);

  ctx.fillStyle = "#b52c32";
  ctx.fillRect(-w / 2 + 5, h / 2 - 7, 9, 4);
  ctx.fillRect(w / 2 - 14, h / 2 - 7, 9, 4);

  ctx.restore();
}

function drawObstacles() {
  const colors = ["#c83d38", "#d2b13e", "#3376a5", "#7b8790"];

  obstacles.forEach((o, i) => {
    drawParkedCar(o.x, o.y, o.w, o.h, colors[i % colors.length]);
  });
}

function drawPlayer() {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Car shadow
  ctx.fillStyle = "#0008";
  ctx.beginPath();
  ctx.ellipse(5, 5, 25, 38, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels
  ctx.fillStyle = "#121518";
  ctx.fillRect(-21, -23, 7, 19);
  ctx.fillRect(14, -23, 7, 19);
  ctx.fillRect(-21, 9, 7, 19);
  ctx.fillRect(14, 9, 7, 19);

  // Body
  const gradient = ctx.createLinearGradient(-18, 0, 18, 0);
  gradient.addColorStop(0, "#a90f19");
  gradient.addColorStop(.5, "#f0444d");
  gradient.addColorStop(1, "#a90f19");

  roundedRect(-17, -31, 34, 62, 10, gradient);

  // Front windshield
  roundedRect(-12, -19, 24, 18, 5, "#91b5c8");
  // Rear windshield
  roundedRect(-12, 8, 24, 13, 4, "#263e4c");

  // Roof detail
  ctx.fillStyle = "#d9e1e4";
  ctx.fillRect(-1, -17, 2, 37);

  // Headlights
  ctx.fillStyle = "#fff1ae";
  ctx.fillRect(-13, -30, 8, 4);
  ctx.fillRect(5, -30, 8, 4);

  // Tail lights
  ctx.fillStyle = "#ff2525";
  ctx.fillRect(-13, 26, 8, 4);
  ctx.fillRect(5, 26, 8, 4);

  ctx.restore();
}

function drawWorld() {
  drawGround();
  drawParkingLines();
  drawObstacles();
  drawPlayer();

  // Instructions on road
  ctx.fillStyle = "#ffffff88";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText("PARKING AREA", 500, 350);
}

function updateHUD() {
  speedText.textContent = Math.round(Math.abs(car.speed) * 3.6) + " km/h";
  gearText.textContent = car.speed < -0.2 ? "R" : "D";
  healthBar.style.width = health + "%";
  healthBar.style.background = health > 50 ? "#5bd68b" :
    health > 25 ? "#f5b942" : "#ed4545";
}

function isInside(x, y, rect, margin = 0) {
  return x > rect.x - margin && x < rect.x + rect.w + margin &&
    y > rect.y - margin && y < rect.y + rect.h + margin;
}

function checkCollision() {
  const corners = [
    [-15, -28], [15, -28], [-15, 28], [15, 28]
  ];

  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);

  const points = corners.map(([x, y]) => ({
    x: car.x + x * cos - y * sin,
    y: car.y + x * sin + y * cos
  }));

  let hit = points.some(p =>
    p.x < 95 || p.x > 905 || p.y < 80 || p.y > 580
  );

  for (const o of obstacles) {
    if (points.some(p => isInside(p.x, p.y, o, -2))) {
      hit = true;
      break;
    }
  }

  if (hit && damageCooldown <= 0) {
    health = Math.max(0, health - 12);
    car.speed *= -0.25;
    damageCooldown = 0.8;

    if (health <= 0) {
      endGame("CAR DAMAGED!", "Your car has taken too much damage.");
    }
  }
}

function checkParking(dt) {
  const inside =
    car.x > parkingSpot.x + 8 &&
    car.x < parkingSpot.x + parkingSpot.w - 8 &&
    car.y > parkingSpot.y + 8 &&
    car.y < parkingSpot.y + parkingSpot.h - 8;

  const angleError = Math.abs(
    Math.atan2(Math.sin(car.angle), Math.cos(car.angle))
  );

  const correctlyAligned = angleError < 0.22;
  const slowEnough = Math.abs(car.speed) < 0.5;

  if (inside && correctlyAligned && slowEnough) {
    parkingTime += dt;

    if (parkingTime >= 1.5) {
      completeLevel();
    }
  } else {
    parkingTime = 0;
  }
}

function completeLevel() {
  if (completed) return;
  completed = true;
  running = false;
   saveScore();

  endGame(
    "PARKING SUCCESSFUL!",
    "Excellent parking! You completed level " + level + "."
  );

  startBtn.textContent = "NEXT LEVEL";
  startBtn.onclick = () => {
    level++;
    startBtn.onclick = startGame;
    startGame();
  };
}

function endGame(title, description) {
  running = false;
  message.style.display = "flex";
  message.querySelector("h2").textContent = title;
  message.querySelector("p").textContent = description;

  if (!completed) {
    startBtn.textContent = "TRY AGAIN";
    startBtn.onclick = startGame;
  }
}

function update(dt) {
  if (!running) return;

  elapsed += dt;
  damageCooldown = Math.max(0, damageCooldown - dt);

  const accelerating = controls.gas || keys.ArrowUp || keys.w;
  const braking = controls.brake || keys.ArrowDown || keys.s;
  const left = controls.left || keys.ArrowLeft || keys.a;
  const right = controls.right || keys.ArrowRight || keys.d;
  const handbrake = keys[" "];

  // Acceleration and reverse
  if (accelerating) {
    car.speed += 2.8 * dt;
  } else if (braking) {
    if (car.speed > 0.15) {
      car.speed -= 5.5 * dt;
    } else {
      car.speed -= 1.8 * dt;
    }
  } else {
    car.speed *= Math.pow(0.985, dt * 60);
  }

  car.speed = Math.max(-2.2, Math.min(4.5, car.speed));

  if (handbrake) car.speed *= Math.pow(0.94, dt * 60);

  // Steering becomes stronger at low speed
  const direction = car.speed >= 0 ? 1 : -1;
  const steeringPower = Math.min(1, Math.abs(car.speed) / 1.2);

  if (left) car.angle -= 1.9 * steeringPower * direction * dt;
  if (right) car.angle += 1.9 * steeringPower * direction * dt;

  // Vehicle movement
  const oldX = car.x;
  const oldY = car.y;

  car.x += Math.sin(car.angle) * car.speed * 60 * dt;
  car.y -= Math.cos(car.angle) * car.speed * 60 * dt;

  checkCollision();

  // Prevent the car from remaining inside a solid obstacle
  if (damageCooldown > 0.65) {
    car.x = oldX;
    car.y = oldY;
  }

  checkParking(dt);
  updateHUD();

  const seconds = Math.floor(elapsed);
  timerText.textContent =
    String(Math.floor(seconds / 60)).padStart(2, "0") + ":" +
    String(seconds % 60).padStart(2, "0");
}

function draw() {
  drawWorld();
}

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000 || 0, 0.04);
  lastTime = time;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

function startGame() {
  makeLevel();
  running = true;
  message.style.display = "none";
  startBtn.textContent = "START GAME";
  startBtn.onclick = startGame;
}

startBtn.onclick = startGame;

// Keyboard input
window.addEventListener("keydown", e => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }

  keys[e.key] = true;
  keys[e.key.toLowerCase()] = true;

  if (e.key.toLowerCase() === "r") startGame();
});

window.addEventListener("keyup", e => {
  keys[e.key] = false;
  keys[e.key.toLowerCase()] = false;
});

// Mobile touch controls
document.querySelectorAll("[data-control]").forEach(button => {
  const control = button.dataset.control;

  button.addEventListener("pointerdown", e => {
    e.preventDefault();
    controls[control] = true;
    button.setPointerCapture(e.pointerId);
  });

  const release = e => {
    e.preventDefault();
    controls[control] = false;
  };

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", () => {
    controls[control] = false;
  });
});

makeLevel();
draw();
requestAnimationFrame(loop);
