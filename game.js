// --- HATA AYIKLAMA ---
function logDebug(msg) {
  console.log(msg);
  const debugBox = document.getElementById('debug-console');
  if (debugBox) {
    // Sadece önemli mesajları ekrana bas
    if (msg.includes("Başladı") || msg.includes("Hata")) {
      debugBox.style.display = 'block';
      debugBox.innerHTML += `<p>ℹ️ ${msg}</p>`;
    }
  }
}

logDebug("Oyun scripti başlatılıyor...");

// --- DOM ELEMENTLERİ ---
const canvas = document.getElementById("gameCanvas");
if (!canvas) {
  throw new Error("Canvas elementi bulunamadı!");
}
const ctx = canvas.getContext("2d");
const jumpBtn = document.getElementById("jumpBtn");
const restartBtn = document.getElementById("restartBtn");
const saveBtn = document.getElementById("saveBtn");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScoreSpan = document.getElementById("finalScore");
const playerNameInput = document.getElementById("playerName");
const saveScoreForm = document.getElementById("saveScoreForm");
const leaderboardList = document.getElementById("leaderboardList");

// Pixel art ayarı
ctx.imageSmoothingEnabled = false;

// --- IMAGE SPRITES YÖNETİMİ ---
function loadImage(fileName) {
  const img = new Image();
  // Netlify ve Vite için path stratejisi:
  // public/assets içindeki dosyalara kök dizinden erişilir.
  img.src = `/assets/${fileName}`; 
  
  img.onload = () => {
    // Resim yüklendiğinde sessizce devam et
  };

  img.onerror = () => {
    console.warn(`Görsel yüklenemedi: ${fileName} (Fallback çizim kullanılacak)`);
    // Ekrana hata basmıyoruz ki oyun keyfi kaçmasın, ama konsolda görebilirsin.
  };
  
  return img;
}

function isImageReady(img) {
  return img && img.complete && img.naturalWidth > 0;
}

// --- GÖRSEL DOSYA İSİMLERİ ---
const run1 = loadImage("run-1.png");
const run2 = loadImage("run-2.png");
const run3 = loadImage("run-3.png");
const run4 = loadImage("run-4.png");
const deadCat = loadImage("dead.png");

const block1 = loadImage("bloke-1.png");
const block2 = loadImage("bloke-2.png");
const moonImg = loadImage("moon.png");
const sunImg = loadImage("sun.png");

// --- OYUN DEĞİŞKENLERİ ---
let speed = 5;
let score = 0;
let gameOver = false;
let isNight = false;
let animationId;

let cat = {
  x: 50,
  y: 220,
  width: 60,
  height: 60,
  dy: 0,
  jumpPower: 16,
  gravity: 1.0,
  grounded: true,
  jumpCount: 0
};

let obstacles = [
  { x: 800, y: 240, width: 40, height: 40, type: 1 },
  { x: 1200, y: 240, width: 40, height: 40, type: 2 },
];

// --- BULUT MATRİSİ ---
const cloudPatterns = [
  [
    [0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,2,2,2,2,1,1,1,1,2,2,2,2,1,1],
    [1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [0,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
    [0,0,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0]
  ]
];

const PIXEL_SIZE = 4;

function generateCloud(startX) {
  return {
    x: startX || Math.random() * canvas.width,
    y: 20 + Math.random() * 80,
    speed: 0.3 + Math.random() * 0.4,
    pattern: cloudPatterns[0]
  };
}

let clouds = Array.from({ length: 4 }, () => generateCloud());

const stars = Array.from({ length: 40 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * 200,
  size: Math.random() < 0.5 ? 2 : 4
}));

// --- LOCAL STORAGE ---
function fetchLeaderboard() {
  if (!leaderboardList) return;
  leaderboardList.innerHTML = '<li>Yükleniyor...</li>';
  try {
    const storedScores = localStorage.getItem('catRunnerScores');
    const data = storedScores ? JSON.parse(storedScores) : [];
    data.sort((a, b) => b.score - a.score);
    const topScores = data.slice(0, 10);

    leaderboardList.innerHTML = '';
    if (topScores.length === 0) {
      leaderboardList.innerHTML = '<li>Henüz skor yok. İlk sen ol!</li>';
      return;
    }

    topScores.forEach((entry, index) => {
      const li = document.createElement('li');
      let starIcon = '';
      if (index === 0) starIcon = '<span class="stars">★★★</span>';
      else if (index === 1) starIcon = '<span class="stars">★★</span>';
      else if (index === 2) starIcon = '<span class="stars">★</span>';

      li.innerHTML = `
        <div><span class="rank">#${index + 1}</span> ${entry.username || 'Anonim'} ${starIcon}</div>
        <span class="score">${entry.score}</span>
      `;
      leaderboardList.appendChild(li);
    });
  } catch (err) {
    console.error('Skorlar çekilemedi:', err);
    leaderboardList.innerHTML = '<li>Skorlar yüklenemedi.</li>';
  }
}

function saveScore() {
  const name = playerNameInput.value.trim();
  if (!name) {
    playerNameInput.classList.add('input-error');
    playerNameInput.focus();
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "KAYDEDİLİYOR...";

  try {
    const storedScores = localStorage.getItem('catRunnerScores');
    const scores = storedScores ? JSON.parse(storedScores) : [];
    scores.push({ username: name, score: score });
    localStorage.setItem('catRunnerScores', JSON.stringify(scores));
    
    saveScoreForm.style.display = 'none';
    fetchLeaderboard();
  } catch (err) {
    console.error('Kayıt hatası:', err);
    alert("Skor kaydedilemedi.");
    saveBtn.disabled = false;
    saveBtn.textContent = "KAYDET";
  }
}

// --- KONTROLLER ---
if (playerNameInput) {
  playerNameInput.addEventListener('input', () => {
    playerNameInput.classList.remove('input-error');
  });
}

function handleJump() {
  if (gameOver) return;
  if (cat.grounded) {
    cat.dy = -cat.jumpPower;
    cat.grounded = false;
    cat.jumpCount = 1;
  } else if (!cat.grounded && cat.jumpCount < 2) {
    cat.dy = -cat.jumpPower;
    cat.jumpCount = 2;
  }
  if (cat.y < 40) { cat.y = 40; cat.dy = 0; }
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    handleJump();
  }
});

if (jumpBtn) {
  jumpBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handleJump();
  });
}

if (saveBtn) saveBtn.addEventListener("click", saveScore);
if (restartBtn) restartBtn.addEventListener("click", restartGame);

// --- OYUN DÖNGÜSÜ ---
function update() {
  try {
    cat.dy += cat.gravity;
    cat.y += cat.dy;

    if (cat.y > 220) {
      cat.y = 220;
      cat.dy = 0;
      cat.grounded = true;
      cat.jumpCount = 0;
    }

    const cycle = Math.floor(score / 10) % 2;
    isNight = (cycle === 1);
    if (isNight) document.body.classList.add("night");
    else document.body.classList.remove("night");

    clouds.forEach((cloud, index) => {
      cloud.x -= cloud.speed;
      if (cloud.x < -150) clouds[index] = generateCloud(canvas.width + 50);
    });

    obstacles.forEach((obs) => {
      if (!gameOver) {
        obs.x -= speed;
        if (obs.x < -50) {
          obs.x = 800 + Math.random() * 400;
          obs.type = Math.random() < 0.5 ? 1 : 2;
          score++;
          speed += 0.1;
        }
      }

      const hit =
        cat.x < obs.x + obs.width - 15 &&
        cat.x + cat.width > obs.x + 15 &&
        cat.y < obs.y + obs.height &&
        cat.y + cat.height > obs.y;

      if (hit && !gameOver) {
        handleGameOver();
      }
    });

    draw();
    animationId = requestAnimationFrame(update);
  } catch (err) {
    console.error("Oyun döngüsü hatası:", err);
    logDebug("Oyun döngüsü hatası: " + err.message);
    cancelAnimationFrame(animationId);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Arka Plan (Güneş/Ay)
  if (isNight) {
    ctx.fillStyle = "#ffffff";
    stars.forEach(star => ctx.fillRect(star.x, star.y, star.size, star.size));
    
    if (isImageReady(moonImg)) {
      ctx.drawImage(moonImg, 690, 40, 60, 60);
    } else {
      ctx.fillStyle = "#f4f6f0";
      ctx.beginPath();
      ctx.arc(720, 70, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    clouds.forEach(cloud => {
      cloud.pattern.forEach((row, rowIndex) => {
        row.forEach((pixel, colIndex) => {
          if (pixel !== 0) {
            ctx.fillStyle = pixel === 1 ? "#ffffff" : "#dbeeff";
            ctx.fillRect(cloud.x + (colIndex * PIXEL_SIZE), cloud.y + (rowIndex * PIXEL_SIZE), PIXEL_SIZE, PIXEL_SIZE);
          }
        });
      });
    });
    
    if (isImageReady(sunImg)) {
      ctx.drawImage(sunImg, 675, 25, 90, 90);
    } else {
      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      ctx.arc(720, 70, 40, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Zemin
  ctx.fillStyle = isNight ? "#333" : "#654321";
  ctx.fillRect(0, 260, canvas.width, 40);
  ctx.fillStyle = isNight ? "#222" : "#4caf50";
  ctx.fillRect(0, 260, canvas.width, 10);

  // Karakter Çizimi
  let frame = Math.floor((Date.now() / 100) % 4);
  let sprite = [run1, run2, run3, run4][frame];

  if (!gameOver) {
    if (isImageReady(sprite)) {
      ctx.drawImage(sprite, cat.x, cat.y, cat.width, cat.height);
    } else {
      // Kedi Fallback (Turuncu Kutu)
      ctx.fillStyle = "#FFA500";
      ctx.fillRect(cat.x, cat.y, cat.width, cat.height);
      ctx.fillStyle = "#000";
      ctx.fillRect(cat.x + 40, cat.y + 10, 5, 5);
    }
  } else {
    if (isImageReady(deadCat)) {
      ctx.drawImage(deadCat, cat.x, cat.y, cat.width, cat.height);
    } else {
      ctx.fillStyle = "#FF0000";
      ctx.fillRect(cat.x, cat.y, cat.width, cat.height);
    }
  }

  // Engel Çizimi
  obstacles.forEach((obs) => {
    const img = obs.type === 1 ? block1 : block2;
    if (isImageReady(img)) {
      ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
    } else {
      ctx.fillStyle = obs.type === 1 ? "#8B4513" : "#556B2F";
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    }
  });

  // Skor
  ctx.fillStyle = isNight ? "#fff" : "#333";
  ctx.font = "16px 'Press Start 2P'";
  ctx.textAlign = "left";
  ctx.fillText(`SKOR: ${score}`, 20, 30);
}

function handleGameOver() {
  gameOver = true;
  finalScoreSpan.textContent = score;
  gameOverOverlay.classList.remove("hidden");
  saveScoreForm.style.display = 'block';
  saveBtn.disabled = false;
  saveBtn.textContent = "KAYDET";
  playerNameInput.value = "";
  playerNameInput.classList.remove('input-error');
}

function restartGame() {
  gameOverOverlay.classList.add("hidden");
  obstacles.forEach((obs, i) => {
    obs.x = 800 + i * 400;
    obs.y = 240;
  });
  score = 0;
  gameOver = false;
  cat.y = 220;
  cat.dy = 0;
  cat.grounded = true;
  cat.jumpCount = 0;
  speed = 5;
  isNight = false;
  document.body.classList.remove("night");
  for(let i=0; i<clouds.length; i++) {
    clouds[i] = generateCloud();
  }
}

// Başlat
fetchLeaderboard();
logDebug("Oyun döngüsü başlatılıyor...");
update();
