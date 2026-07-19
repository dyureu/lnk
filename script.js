(function () {
  'use strict';

  /* ═══════════════════════════════════════════
     COSMOS PARTICLE BACKGROUND
     Morphs: Earth → Note → Heart → Earth
     ═══════════════════════════════════════════ */

  var canvas = document.getElementById('cosmos-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d', { alpha: true });
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isCoarse = window.matchMedia('(pointer: coarse)').matches;
  var isMobile = isCoarse || window.innerWidth < 768;
  var isSmallMobile = window.innerWidth < 430;

  var mouse = { x: 0.5, y: 0.5, active: false };
  var smoothMouse = { x: 0.5, y: 0.5 };
  var parallax = { x: 0, y: 0 };
  var w = 0;
  var h = 0;
  var dpr = 1;
  var shapeScale = 0.32;

  var PARTICLE_COUNT = isSmallMobile ? 180 : isMobile ? 350 : 900;
  var CONNECT_DIST = isMobile ? 55 : 72;
  var MAX_CONNECTIONS = isMobile ? 2 : 3;

  var COLORS = [
    { r: 255, g: 255, b: 255, a: 0.55 },
    { r: 255, g: 255, b: 255, a: 0.35 },
    { r: 212, g: 175, b: 120, a: 0.5 },
    { r: 212, g: 175, b: 120, a: 0.3 },
    { r: 100, g: 155, b: 130, a: 0.35 },
    { r: 110, g: 150, b: 190, a: 0.3 }
  ];

  /* ── Shape point generators (normalized -1..1) ── */

  function generateEarth(n) {
    var pts = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (i / Math.max(n - 1, 1)) * 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var theta = golden * i;
      var x3 = Math.cos(theta) * r;
      pts.push({ x: x3 * 0.88, y: -y * 0.88 });
    }
    return pts;
  }

  function generateNote(n) {
    var pts = [];
    var headN = Math.floor(n * 0.42);
    var stemN = Math.floor(n * 0.33);
    var flagN = n - headN - stemN;
    var i;

    for (i = 0; i < headN; i++) {
      var a = (i / headN) * Math.PI * 2;
      pts.push({
        x: -0.18 + Math.cos(a) * 0.2,
        y: 0.12 + Math.sin(a) * 0.14
      });
    }

    for (i = 0; i < stemN; i++) {
      var t = i / Math.max(stemN - 1, 1);
      pts.push({ x: 0.02, y: -0.48 + t * 0.82 });
    }

    for (i = 0; i < flagN; i++) {
      var ft = i / Math.max(flagN - 1, 1);
      pts.push({
        x: 0.02 + Math.sin(ft * Math.PI * 0.85) * 0.32,
        y: 0.34 - ft * 0.52
      });
    }

    return pts;
  }

  function generateHeart(n) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var t = (i / n) * Math.PI * 2;
      var sinT = Math.sin(t);
      var x = 16 * sinT * sinT * sinT;
      var y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push({ x: x / 17, y: y / 17 + 0.05 });
    }
    return pts;
  }

  var shapes = [
    generateEarth(PARTICLE_COUNT),
    generateNote(PARTICLE_COUNT),
    generateHeart(PARTICLE_COUNT)
  ];

  /* ── Particles ── */

  var particles = [];
  var sparkles = [];
  var maxSparkles = isMobile ? 0 : 40;

  for (var p = 0; p < PARTICLE_COUNT; p++) {
    var colorIdx = p % COLORS.length;
    particles.push({
      x: 0,
      y: 0,
      phase: Math.random() * Math.PI * 2,
      drift: 0.3 + Math.random() * 0.7,
      size: 0.6 + Math.random() * 1.2,
      color: COLORS[colorIdx],
      gridX: 0,
      gridY: 0
    });
  }

  /* ── Morph state ── */

  var morph = {
    fromIdx: 0,
    toIdx: 1,
    progress: 0,
    holdTime: 0,
    holdDuration: isMobile ? 7000 : 9000,
    morphDuration: isMobile ? 4500 : 5500,
    morphing: false
  };

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function getMorphTarget(i, progress) {
    var eased = easeInOutCubic(progress);
    var from = shapes[morph.fromIdx][i];
    var to = shapes[morph.toIdx][i];
    return {
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased
    };
  }

  /* ── Sparkle particles ── */

  function spawnSparkle(x, y) {
    if (isMobile || sparkles.length >= maxSparkles) return;
    var count = 1 + (Math.random() > 0.6 ? 1 : 0);
    for (var s = 0; s < count; s++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 0.3 + Math.random() * 0.8;
      sparkles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.2,
        life: 1,
        decay: 0.012 + Math.random() * 0.018,
        size: 0.8 + Math.random() * 1.5,
        gold: Math.random() > 0.4
      });
    }
  }

  /* ── Resize ── */

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    shapeScale = Math.min(w, h) * (isMobile ? 0.28 : 0.32);
  }

  /* ── Spatial grid for connections ── */

  var grid = {};
  var cellSize = CONNECT_DIST;

  function clearGrid() {
    grid = {};
  }

  function gridKey(gx, gy) {
    return gx + ',' + gy;
  }

  function addToGrid(i, px, py) {
    var gx = Math.floor(px / cellSize);
    var gy = Math.floor(py / cellSize);
    particles[i].gridX = gx;
    particles[i].gridY = gy;
    var key = gridKey(gx, gy);
    if (!grid[key]) grid[key] = [];
    grid[key].push(i);
  }

  /* ── Draw frame ── */

  var lastTime = 0;
  var sparkleThrottle = 0;

  function drawFrame(timestamp) {
    if (!lastTime) lastTime = timestamp;
    var dt = Math.min(timestamp - lastTime, 32);
    lastTime = timestamp;
    var time = timestamp * 0.001;

    if (!reducedMotion) {
      smoothMouse.x += (mouse.x - smoothMouse.x) * 0.06;
      smoothMouse.y += (mouse.y - smoothMouse.y) * 0.06;

      if (!isMobile) {
        parallax.x += (smoothMouse.x - 0.5) * 18 - parallax.x;
        parallax.x *= 0.04;
        parallax.x += (smoothMouse.x - 0.5) * 18 * 0.04;

        parallax.y += (smoothMouse.y - 0.5) * 12 - parallax.y;
        parallax.y *= 0.04;
        parallax.y += (smoothMouse.y - 0.5) * 12 * 0.04;
      }
    }

    var cx = w * 0.5 + parallax.x;
    var cy = h * 0.42 + parallax.y;

    /* Morph update */
    if (!reducedMotion) {
      if (morph.morphing) {
        morph.progress += dt / morph.morphDuration;
        if (morph.progress >= 1) {
          morph.progress = 0;
          morph.morphing = false;
          morph.fromIdx = morph.toIdx;
          morph.toIdx = (morph.toIdx + 1) % shapes.length;
          morph.holdTime = 0;
        }
      } else {
        morph.holdTime += dt;
        if (morph.holdTime >= morph.holdDuration) {
          morph.morphing = true;
        }
      }
    }

    /* Background */

    ctx.fillRect(0, 0, w, h);

    /* Update particle positions */
    clearGrid();
    var mousePx = smoothMouse.x * w;
    var mousePy = smoothMouse.y * h;
    var mouseInfluence = isMobile ? 0 : 1;

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var pt = particles[i];
      var target = morph.morphing || morph.progress > 0
        ? getMorphTarget(i, morph.progress)
        : shapes[morph.fromIdx][i];

      var driftX = Math.sin(time * 0.4 + pt.phase) * 3 * pt.drift;
      var driftY = Math.cos(time * 0.35 + pt.phase * 1.3) * 3 * pt.drift;

      pt.x = cx + target.x * shapeScale + driftX;
      pt.y = cy + target.y * shapeScale + driftY;

      if (mouseInfluence && mouse.active) {
        var dx = pt.x - mousePx;
        var dy = pt.y - mousePy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          var force = (1 - dist / 120) * 12;
          pt.x += (dx / dist) * force;
          pt.y += (dy / dist) * force;
        }
      }

      addToGrid(i, pt.x, pt.y);
    }

    /* Draw connections */
    var drawn = {};
    ctx.lineWidth = 0.5;

    for (var j = 0; j < PARTICLE_COUNT; j++) {
      if (j % (isMobile ? 3 : 2) !== 0) continue;

      var pj = particles[j];
      var connections = 0;
      var gx = pj.gridX;
      var gy = pj.gridY;

      for (var ox = -1; ox <= 1; ox++) {
        for (var oy = -1; oy <= 1; oy++) {
          var cell = grid[gridKey(gx + ox, gy + oy)];
          if (!cell) continue;

          for (var c = 0; c < cell.length; c++) {
            var k = cell[c];
            if (k <= j || connections >= MAX_CONNECTIONS) continue;

            var pk = particles[k];
            var ldx = pk.x - pj.x;
            var ldy = pk.y - pj.y;
            var dist = Math.sqrt(ldx * ldx + ldy * ldy);

            if (dist < CONNECT_DIST) {
              var pairKey = j < k ? j + '-' + k : k + '-' + j;
              if (drawn[pairKey]) continue;
              drawn[pairKey] = true;

              var alpha = (1 - dist / CONNECT_DIST) * 0.18;
              var isGold = (j + k) % 5 === 0;
              if (isGold) {
                ctx.strokeStyle = 'rgba(212, 175, 120, ' + (alpha * 1.4) + ')';
              } else if ((j + k) % 7 === 0) {
                ctx.strokeStyle = 'rgba(100, 155, 130, ' + alpha + ')';
              } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, ' + alpha + ')';
              }

              ctx.beginPath();
              ctx.moveTo(pj.x, pj.y);
              ctx.lineTo(pk.x, pk.y);
              ctx.stroke();
              connections++;
            }
          }
        }
      }
    }

    /* Draw dots */
    for (var d = 0; d < PARTICLE_COUNT; d++) {
      var pd = particles[d];
      var col = pd.color;
      ctx.beginPath();
      ctx.arc(pd.x, pd.y, pd.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',' + col.a + ')';
      ctx.fill();
    }

    /* Sparkles */
    if (!isMobile && !reducedMotion) {
      for (var sp = sparkles.length - 1; sp >= 0; sp--) {
        var sk = sparkles[sp];
        sk.x += sk.vx;
        sk.y += sk.vy;
        sk.vy += 0.015;
        sk.life -= sk.decay;

        if (sk.life <= 0) {
          sparkles.splice(sp, 1);
          continue;
        }

        var sa = sk.life * 0.7;
        ctx.beginPath();
        ctx.arc(sk.x, sk.y, sk.size * sk.life, 0, Math.PI * 2);
        if (sk.gold) {
          ctx.fillStyle = 'rgba(212, 175, 120, ' + sa + ')';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, ' + sa + ')';
        }
        ctx.fill();
      }
    }

    requestAnimationFrame(drawFrame);
  }

  /* ── Events ── */

  function onMouseMove(e) {
    mouse.x = e.clientX / w;
    mouse.y = e.clientY / h;
    mouse.active = true;

    sparkleThrottle += 1;
    if (sparkleThrottle % 3 === 0) {
      spawnSparkle(e.clientX, e.clientY);
    }
  }

  function onMouseLeave() {
    mouse.active = false;
  }

  window.addEventListener('resize', resize);
  if (!isMobile && !reducedMotion) {
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave);
  }

  resize();
  if (reducedMotion) {
    morph.progress = 0;
    morph.morphing = false;
    morph.fromIdx = 0;
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, w, h);
    var cx = w * 0.5;
    var cy = h * 0.42;
    shapeScale = Math.min(w, h) * 0.32;
    for (var r = 0; r < PARTICLE_COUNT; r++) {
      var tgt = shapes[0][r];
      var pr = particles[r];
      ctx.beginPath();
      ctx.arc(cx + tgt.x * shapeScale, cy + tgt.y * shapeScale, pr.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    }
  } else {
    requestAnimationFrame(drawFrame);
  }

  /* ═══════════════════════════════════════════
     CARD 3D TILT (desktop only)
     ═══════════════════════════════════════════ */

  function initCardTilt() {
    if (isMobile || reducedMotion) return;

    var cards = document.querySelectorAll('[data-tilt]');
    cards.forEach(function (card) {
      var wrap = card.closest('.card-wrap');

      function onMove(e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform =
        'perspective(900px) rotateY(' +
        (x * 3.5).toFixed(2) +
        'deg) rotateX(' +
        (-y * 3.5).toFixed(2) +
        'deg)';
      }

      function onLeave() {
        card.style.removeProperty('transform');
      }

      if (wrap) {
        wrap.addEventListener('mousemove', onMove);
        wrap.addEventListener('mouseleave', onLeave);
      }
    });
  }

  /* ═══════════════════════════════════════════
     SCROLL REVEAL
     ═══════════════════════════════════════════ */

  function initReveal() {
    var elements = document.querySelectorAll('.reveal');
    if (!elements.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px' }
    );

    elements.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ═══════════════════════════════════════════
     FOOTER
     ═══════════════════════════════════════════ */

  function initFooter() {
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }


// initCardTilt();
  initReveal();
  initFooter();
})();


const bgm = document.getElementById("bgm");
const bgmBtn = document.getElementById("bgm-toggle");

if (bgm && bgmBtn) {

  bgm.volume = 0.25;

  bgmBtn.addEventListener("click", () => {

    if (bgm.paused) {
      bgm.play();
      bgmBtn.textContent = "🔊";
    } else {
      bgm.pause();
      bgmBtn.textContent = "🔇";
    }

  });

}