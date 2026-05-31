(() => {
  const DIRS = [
    { dx: 0, dy: -1 }, // 上
    { dx: 0, dy: 1 },  // 下
    { dx: -1, dy: 0 }, // 左
    { dx: 1, dy: 0 },  // 右
  ];

  const difficultyMap = {
    easy: { turnBias: 1, deadendKeep: 3, label: "簡單" },
    medium: { turnBias: 3, deadendKeep: 3, label: "中等" },
    hard: { turnBias: 5, deadendKeep: 5, label: "困難" },
  };

  class RNG {
    constructor(seed) {
      this.state = seed >>> 0;
      if (this.state === 0) this.state = 0x9e3779b9;
    }

    next() {
      let t = (this.state += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    int(maxExclusive) {
      return Math.floor(this.next() * maxExclusive);
    }
  }

  function makeRandomSeed(lastSeed = null) {
    const minGap = 50000000;
    let fallback = 0;
    for (let i = 0; i < 16; i++) {
      let candidate = 0;
      if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
        const arr = new Uint32Array(1);
        globalThis.crypto.getRandomValues(arr);
        candidate = arr[0] >>> 0;
      } else {
        candidate = (Math.floor(Math.random() * 0x100000000) >>> 0);
      }
      fallback = candidate;
      if (lastSeed == null || Math.abs(candidate - lastSeed) >= minGap) return candidate;
    }

    // 若連續抽樣都太接近，就做一次位元混合後回傳。
    let x = (fallback ^ 0x9e3779b9) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x85ebca6b) >>> 0;
    x ^= x >>> 13;
    return x >>> 0;
  }

  function mazeSignature(grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    const binsX = 8;
    const binsY = 8;
    const sig = new Array(binsX * binsY).fill(0);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] !== "#") {
          const bx = Math.min(binsX - 1, Math.floor((x / cols) * binsX));
          const by = Math.min(binsY - 1, Math.floor((y / rows) * binsY));
          sig[by * binsX + bx]++;
        }
      }
    }
    return sig;
  }

  function signatureDistance(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
    return d;
  }

  function oppositeDir(d) {
    if (d === 0) return 1;
    if (d === 1) return 0;
    if (d === 2) return 3;
    return 2;
  }

  function createMaze({ width, height, seed, turnBias, deadendKeep }) {
    const rng = new RNG(seed);
    const gridW = width * 2 + 1;
    const gridH = height * 2 + 1;

    const grid = Array.from({ length: gridH }, () => Array(gridW).fill("#"));
    const visited = Array.from({ length: height }, () => Array(width).fill(false));

    const start = { x: 0, y: 0 };
    const exit = { x: width - 1, y: height - 1 };

    function inBounds(cx, cy) {
      return cx >= 0 && cx < width && cy >= 0 && cy < height;
    }

    function unvisitedAround(cx, cy) {
      let cnt = 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DIRS[d].dx;
        const ny = cy + DIRS[d].dy;
        if (inBounds(nx, ny) && !visited[ny][nx]) cnt++;
      }
      return cnt;
    }

    function hasUnvisitedNeighbor(cx, cy) {
      for (let d = 0; d < 4; d++) {
        const nx = cx + DIRS[d].dx;
        const ny = cy + DIRS[d].dy;
        if (inBounds(nx, ny) && !visited[ny][nx]) return true;
      }
      return false;
    }

    function segmentCapByKeep() {
      if (deadendKeep >= 5) return Number.POSITIVE_INFINITY;
      const base = deadendKeep * 3;
      return base + rng.int(base + 1);
    }

    function orderDirsForCoverage(cx, cy, fromDir, turnStreak) {
      const dirs = [0, 1, 2, 3];
      const scores = [];

      for (let i = 0; i < 4; i++) {
        const d = dirs[i];
        const nx = cx + DIRS[d].dx;
        const ny = cy + DIRS[d].dy;
        let s = rng.int(100);

        if (inBounds(nx, ny) && !visited[ny][nx]) {
          s += unvisitedAround(nx, ny) * 40;
        } else {
          s -= 1000;
        }

        if (fromDir >= 0) {
          const isStraight = d === fromDir;
          const isBack = d === oppositeDir(fromDir);

          if (isBack) {
            s -= 120;
          } else if (isStraight) {
            s += (6 - turnBias) * 18;
          } else {
            s += (turnBias - 1) * 18;
          }

          if (turnStreak >= 2) {
            if (isStraight) s += turnStreak * 16;
            else s -= turnStreak * 22;
          }
        }

        scores.push({ d, s });
      }

      scores.sort((a, b) => b.s - a.s);
      return scores.map((x) => x.d);
    }

    function markVisited(cx, cy, order) {
      if (visited[cy][cx]) return;
      visited[cy][cx] = true;
      grid[cy * 2 + 1][cx * 2 + 1] = " ";
      order.push({ x: cx, y: cy });
    }

    function carveWalkToDeadEnd(startX, startY, fromDir, order) {
      let cx = startX;
      let cy = startY;
      let prevDir = fromDir;
      let turnStreak = 0;
      const cap = segmentCapByKeep();
      let steps = 0;

      markVisited(cx, cy, order);

      while (true) {
        const dirs = orderDirsForCoverage(cx, cy, prevDir, turnStreak);
        let moved = false;

        for (const d of dirs) {
          const nx = cx + DIRS[d].dx;
          const ny = cy + DIRS[d].dy;
          if (!inBounds(nx, ny) || visited[ny][nx]) continue;

          grid[cy * 2 + 1 + DIRS[d].dy][cx * 2 + 1 + DIRS[d].dx] = " ";

          cx = nx;
          cy = ny;
          if (prevDir >= 0 && d !== prevDir) turnStreak++;
          else turnStreak = 0;
          prevDir = d;

          markVisited(cx, cy, order);
          steps++;
          moved = true;
          break;
        }

        if (!moved) break;
        if (steps >= cap && hasUnvisitedNeighbor(cx, cy)) break;
      }
    }

    function generateAlternatingFrontBack(startX, startY) {
      const totalCells = width * height;
      const order = [];
      let useFront = true;

      carveWalkToDeadEnd(startX, startY, 3, order);

      while (order.length < totalCells) {
        let pick = null;

        if (useFront) {
          for (let i = 0; i < order.length; i++) {
            const p = order[i];
            if (hasUnvisitedNeighbor(p.x, p.y)) {
              pick = p;
              break;
            }
          }
        } else {
          for (let i = order.length - 1; i >= 0; i--) {
            const p = order[i];
            if (hasUnvisitedNeighbor(p.x, p.y)) {
              pick = p;
              break;
            }
          }
        }

        if (!pick) break;

        carveWalkToDeadEnd(pick.x, pick.y, -1, order);
        useFront = !useFront;
      }
    }

    // 目前研究版：從出口開始挖路
    generateAlternatingFrontBack(exit.x, exit.y);

    // 開入口與出口
    grid[start.y * 2 + 1][start.x * 2] = " ";
    grid[exit.y * 2 + 1][exit.x * 2 + 2] = " ";

    return { grid, start, exit, gridW, gridH, width, height, seed, turnBias, deadendKeep };
  }

  function drawMaze(canvas, maze) {
    const ctx = canvas.getContext("2d");
    const margin = 20;
    const maxW = 1120;
    const maxH = 1120;
    // 牆與通道使用不同像素比例：牆更細、通道更寬。
    const wallUnit = 1;
    const passUnit = 6;
    const wallCols = Math.floor((maze.gridW + 1) / 2);
    const passCols = Math.floor(maze.gridW / 2);
    const wallRows = Math.floor((maze.gridH + 1) / 2);
    const passRows = Math.floor(maze.gridH / 2);

    const baseW = wallCols * wallUnit + passCols * passUnit;
    const baseH = wallRows * wallUnit + passRows * passUnit;
    let scale = Math.floor(Math.min(maxW / baseW, maxH / baseH));
    if (scale < 1) scale = 1;

    const wallPx = wallUnit * scale;
    const passPx = passUnit * scale;

    const xPos = new Array(maze.gridW + 1);
    const yPos = new Array(maze.gridH + 1);
    xPos[0] = 0;
    yPos[0] = 0;
    for (let i = 0; i < maze.gridW; i++) {
      xPos[i + 1] = xPos[i] + (i % 2 === 0 ? wallPx : passPx);
    }
    for (let i = 0; i < maze.gridH; i++) {
      yPos[i + 1] = yPos[i] + (i % 2 === 0 ? wallPx : passPx);
    }

    const drawW = xPos[maze.gridW];
    const drawH = yPos[maze.gridH];

    canvas.width = drawW + margin * 2;
    canvas.height = drawH + margin * 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#111111";
    for (let y = 0; y < maze.gridH; y++) {
      for (let x = 0; x < maze.gridW; x++) {
        if (maze.grid[y][x] === "#") {
          ctx.fillRect(
            margin + xPos[x],
            margin + yPos[y],
            xPos[x + 1] - xPos[x],
            yPos[y + 1] - yPos[y]
          );
        }
      }
    }

    function drawMarker(cx, cy, color, text) {
      const gx = cx * 2 + 1;
      const gy = cy * 2 + 1;
      const px = margin + xPos[gx] + passPx / 2;
      const py = margin + yPos[gy] + passPx / 2;
      const r = Math.max(4, Math.floor(passPx * 0.45));

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(8, Math.floor(r * 1.1))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, px, py + 1);
    }

    drawMarker(maze.start.x, maze.start.y, "#43a047", "S");
    drawMarker(maze.exit.x, maze.exit.y, "#e53935", "E");
  }

  function main() {
    const widthEl = document.getElementById("mazeWidth");
    const heightEl = document.getElementById("mazeHeight");
    const seedEl = document.getElementById("seed");
    const difficultyEl = document.getElementById("difficulty");
    const randomSeedBtn = document.getElementById("randomSeed");
    const generateBtn = document.getElementById("generate");
    const printBtn = document.getElementById("printPage");
    const canvas = document.getElementById("mazeCanvas");
    const meta = document.getElementById("meta");
    const printInfo = document.getElementById("printInfo");
    let lastRandomSeed = null;
    let lastRandomSignature = null;

    function readInputs() {
      const width = Math.max(10, Math.min(80, Number(widthEl.value) || 30));
      const height = Math.max(10, Math.min(80, Number(heightEl.value) || 42));
      const seed = Math.abs(Number(seedEl.value) || 20260330) >>> 0;
      seedEl.value = String(seed);
      const diff = difficultyMap[difficultyEl.value] || difficultyMap.medium;
      return { width, height, seed, diff };
    }

    function renderMaze(maze, diff, width, height, seed) {
      drawMaze(canvas, maze);
      meta.textContent = `難易度：${diff.label}｜尺寸：${width}x${height}｜種子：${seed}`;
      printInfo.textContent = `種子：${seed}　難易度：${diff.label}`;
    }

    function generate() {
      const { width, height, seed, diff } = readInputs();

      const maze = createMaze({
        width,
        height,
        seed,
        turnBias: diff.turnBias,
        deadendKeep: diff.deadendKeep,
      });
      renderMaze(maze, diff, width, height, seed);
      lastRandomSeed = seed;
      lastRandomSignature = mazeSignature(maze.grid);
    }

    randomSeedBtn.addEventListener("click", () => {
      const { width, height, diff } = readInputs();
      let chosenMaze = null;
      let chosenSeed = null;
      let chosenSig = null;

      for (let tries = 0; tries < 12; tries++) {
        const seed = makeRandomSeed(lastRandomSeed);
        const maze = createMaze({
          width,
          height,
          seed,
          turnBias: diff.turnBias,
          deadendKeep: diff.deadendKeep,
        });
        const sig = mazeSignature(maze.grid);

        if (!lastRandomSignature) {
          chosenMaze = maze;
          chosenSeed = seed;
          chosenSig = sig;
          break;
        }

        const distance = signatureDistance(sig, lastRandomSignature);
        if (distance >= width * height * 0.12 || tries === 11) {
          chosenMaze = maze;
          chosenSeed = seed;
          chosenSig = sig;
          break;
        }
      }

      seedEl.value = String(chosenSeed);
      lastRandomSeed = chosenSeed;
      lastRandomSignature = chosenSig;
      renderMaze(chosenMaze, diff, width, height, chosenSeed);
    });

    generateBtn.addEventListener("click", generate);
    printBtn.addEventListener("click", () => window.print());

    generate();
  }

  main();
})();
