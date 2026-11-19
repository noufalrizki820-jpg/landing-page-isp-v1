/**
 * NUSA Internet — Network Canvas & Data Signal Pulse Animation
 * Lightweight HTML5 Canvas (Target 60 FPS, multi-section querySelectorAll, zero layout thrashing)
 */
(function () {
  'use strict';

  const canvases = document.querySelectorAll('.network-canvas');
  if (!canvases.length) return;

  // Accessibility: respect user motion preference
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isReducedMotion = motionQuery.matches;

  let animationFrameId = null;

  // Global mouse tracker
  const mouse = {
    x: -1000,
    y: -1000,
    radius: 140,
    active: false
  };

  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });

  window.addEventListener('mouseleave', function () {
    mouse.active = false;
    mouse.x = -1000;
    mouse.y = -1000;
  });

  // Color palette matching NUSA visual identity
  const COLORS = {
    nodeNormal: 'rgba(15, 23, 42, 0.28)',
    nodeAccent: 'rgba(200, 90, 50, 0.40)',
    lineBase: '15, 23, 42',
    pulseTerracotta: '#C85A32',
    pulseEmerald: '#10B981'
  };

  const maxLineDist = 145;

  class Node {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.baseX = x;
      this.baseY = y;
      this.vx = (Math.random() - 0.5) * 0.32;
      this.vy = (Math.random() - 0.5) * 0.32;
      this.radius = 1.5 + Math.random() * 1.2;
      this.isAccent = Math.random() < 0.25;
    }

    update(width, height, mouseActive, mouseX, mouseY) {
      // Natural slow drift
      this.x += this.vx;
      this.y += this.vy;

      // Soft boundary bounce
      const pad = 24;
      if (this.x < -pad) { this.x = -pad; this.vx *= -1; }
      if (this.x > width + pad) { this.x = width + pad; this.vx *= -1; }
      if (this.y < -pad) { this.y = -pad; this.vy *= -1; }
      if (this.y > height + pad) { this.y = height + pad; this.vy *= -1; }

      // Subtle mouse interaction (soft repel)
      if (mouseActive) {
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 140) {
          const force = (1 - dist / 140) * 1.8;
          this.x += (dx / dist) * force;
          this.y += (dy / dist) * force;
        }
      }
    }

    draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.isAccent ? COLORS.nodeAccent : COLORS.nodeNormal;
      ctx.fill();
    }
  }

  class Pulse {
    constructor(fromNode, toNode) {
      this.from = fromNode;
      this.to = toNode;
      this.progress = 0;
      this.speed = 0.008 + Math.random() * 0.012; // Smooth travel time
      this.color = Math.random() < 0.55 ? COLORS.pulseTerracotta : COLORS.pulseEmerald;
      this.size = 2.2;
    }

    update() {
      this.progress += this.speed;
      return this.progress < 1;
    }

    draw(ctx) {
      const x = this.from.x + (this.to.x - this.from.x) * this.progress;
      const y = this.from.y + (this.to.y - this.from.y) * this.progress;

      // Outer soft glow
      ctx.beginPath();
      ctx.arc(x, y, this.size * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = this.color === COLORS.pulseTerracotta
        ? 'rgba(200, 90, 50, 0.18)'
        : 'rgba(16, 185, 129, 0.20)';
      ctx.fill();

      // Core packet dot
      ctx.beginPath();
      ctx.arc(x, y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  class SectionNetwork {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.nodes = [];
      this.pulses = [];
      this.isVisible = true;

      // Viewport visibility observer to avoid rendering off-screen canvases
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            this.isVisible = entry.isIntersecting;
          });
        }, { threshold: 0.05 });
        this.observer.observe(canvas.parentElement || canvas);
      }
    }

    resize() {
      if (!this.ctx) return;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const parent = this.canvas.parentElement;
      this.width = parent ? parent.clientWidth : window.innerWidth;
      this.height = parent ? parent.clientHeight : window.innerHeight;

      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = this.width + 'px';
      this.canvas.style.height = this.height + 'px';

      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      this.initNodes();
      if (isReducedMotion) {
        this.drawStatic();
      }
    }

    initNodes() {
      this.nodes.length = 0;
      this.pulses.length = 0;

      const area = this.width * this.height;
      const targetCount = Math.min(Math.max(Math.floor(area / 32000), 12), 26);

      for (let i = 0; i < targetCount; i++) {
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        this.nodes.push(new Node(x, y));
      }
    }

    spawnPulses() {
      if (this.pulses.length >= 5 || this.nodes.length < 2) return;

      if (Math.random() < 0.035) {
        const i = Math.floor(Math.random() * this.nodes.length);
        const from = this.nodes[i];
        const neighbors = [];
        for (let j = 0; j < this.nodes.length; j++) {
          if (i === j) continue;
          const d = Math.hypot(from.x - this.nodes[j].x, from.y - this.nodes[j].y);
          if (d < maxLineDist) {
            neighbors.push(this.nodes[j]);
          }
        }
        if (neighbors.length > 0) {
          const to = neighbors[Math.floor(Math.random() * neighbors.length)];
          this.pulses.push(new Pulse(from, to));
        }
      }
    }

    drawConnections() {
      this.ctx.lineWidth = 1;
      for (let i = 0; i < this.nodes.length; i++) {
        const a = this.nodes[i];
        for (let j = i + 1; j < this.nodes.length; j++) {
          const b = this.nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < maxLineDist) {
            const alpha = (1 - dist / maxLineDist) * 0.12;
            this.ctx.strokeStyle = `rgba(${COLORS.lineBase}, ${alpha.toFixed(3)})`;
            this.ctx.beginPath();
            this.ctx.moveTo(a.x, a.y);
            this.ctx.lineTo(b.x, b.y);
            this.ctx.stroke();
          }
        }
      }
    }

    updateAndRender() {
      if (!this.ctx || !this.isVisible || isReducedMotion) return;

      let localMouseX = -1000;
      let localMouseY = -1000;
      let mouseActive = false;
      if (mouse.active) {
        const rect = this.canvas.getBoundingClientRect();
        localMouseX = mouse.x - rect.left;
        localMouseY = mouse.y - rect.top;
        if (localMouseX >= -50 && localMouseX <= this.width + 50 &&
          localMouseY >= -50 && localMouseY <= this.height + 50) {
          mouseActive = true;
        }
      }

      this.ctx.clearRect(0, 0, this.width, this.height);

      this.drawConnections();

      this.spawnPulses();
      for (let i = this.pulses.length - 1; i >= 0; i--) {
        const pulse = this.pulses[i];
        if (pulse.update()) {
          pulse.draw(this.ctx);
        } else {
          this.pulses.splice(i, 1);
        }
      }

      for (let i = 0; i < this.nodes.length; i++) {
        this.nodes[i].update(this.width, this.height, mouseActive, localMouseX, localMouseY);
        this.nodes[i].draw(this.ctx);
      }
    }

    drawStatic() {
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.drawConnections();
      for (let i = 0; i < this.nodes.length; i++) {
        this.nodes[i].draw(this.ctx);
      }
    }
  }

  const instances = Array.from(canvases).map(c => new SectionNetwork(c));

  function resizeAll() {
    instances.forEach(inst => inst.resize());
  }

  function loop() {
    if (!isReducedMotion) {
      instances.forEach(inst => inst.updateAndRender());
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  motionQuery.addEventListener('change', function (e) {
    isReducedMotion = e.matches;
    if (isReducedMotion) {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      instances.forEach(inst => inst.drawStatic());
    } else {
      animationFrameId = requestAnimationFrame(loop);
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    } else if (!isReducedMotion) {
      animationFrameId = requestAnimationFrame(loop);
    }
  });

  let resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeAll, 140);
  });

  resizeAll();
  if (!isReducedMotion) {
    animationFrameId = requestAnimationFrame(loop);
  }
})();

/**
 * NUSA Internet — Custom Interactive Smooth Trailing Cursor (Lerp 60 FPS)
 */
(function () {
  'use strict';

  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');

  // Only run if elements exist and device has fine pointer (mouse/trackpad, not touch)
  if (!dot || !ring || !window.matchMedia('(pointer: fine)').matches) {
    return;
  }

  document.body.classList.add('has-custom-cursor');

  let mouseX = -100;
  let mouseY = -100;
  let ringX = -100;
  let ringY = -100;
  let isVisible = false;

  // Linear interpolation for smooth trailing spring effect
  const lerp = function (start, end, factor) {
    return start + (end - start) * factor;
  };

  window.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!isVisible) {
      isVisible = true;
      dot.style.opacity = '1';
      ring.style.opacity = '1';
      ringX = mouseX;
      ringY = mouseY;
    }
  });

  window.addEventListener('mouseenter', function () {
    if (mouseX > 0 && mouseY > 0) {
      isVisible = true;
      dot.style.opacity = '1';
      ring.style.opacity = '1';
    }
  });

  window.addEventListener('mouseleave', function () {
    isVisible = false;
    dot.style.opacity = '0';
    ring.style.opacity = '0';
  });

  // Click effect (Mousedown / Mouseup)
  window.addEventListener('mousedown', function () {
    document.body.classList.add('cursor-clicking');
  });

  window.addEventListener('mouseup', function () {
    document.body.classList.remove('cursor-clicking');
  });

  // Interactive hover targets
  const interactiveTarget = 'a, button, input, select, textarea, [role="button"], .btn, .paket__card, .berlangganan__step, .statistik__item, .faq__item, .faq__question, .navbar__hamburger';

  document.addEventListener('mouseover', function (e) {
    if (e.target && e.target.closest && e.target.closest(interactiveTarget)) {
      document.body.classList.add('cursor-hover');
    }
  });

  document.addEventListener('mouseout', function (e) {
    if (e.target && e.target.closest && e.target.closest(interactiveTarget)) {
      const nextTarget = e.relatedTarget;
      if (!nextTarget || !nextTarget.closest || !nextTarget.closest(interactiveTarget)) {
        document.body.classList.remove('cursor-hover');
      }
    }
  });

  // 60 FPS animation loop with lerp
  function renderCursor() {
    if (isVisible) {
      ringX = lerp(ringX, mouseX, 0.18);
      ringY = lerp(ringY, mouseY, 0.18);

      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${ringX.toFixed(2)}px, ${ringY.toFixed(2)}px, 0) translate(-50%, -50%)`;
    }
    requestAnimationFrame(renderCursor);
  }

  requestAnimationFrame(renderCursor);
})();

/**
 * NUSA Internet — Interactive Kota Surakarta & Solo Raya Coverage Map Controller
 * Connects 8 kecamatan tags with interactive SVG district zones & telemetry HUD
 */
(function () {
  'use strict';

  const SOLO_RAYA_DATA = {
    'banjarsari': {
      name: 'Kecamatan Banjarsari',
      sub: 'Solo Utara — Tengah',
      kelurahan: 'Kadipiro, Manahan, Nusukan, Sumber, Banyuanyar, Gilingan, Kestalan, Keprabon, Timuran, Ketelan',
      landmark: 'Jaringan aktif di koridor Stasiun Balapan, Terminal Tirtonadi, kawasan hunian Manahan & pusat bisnis Nusukan',
      status: 'Ready (68 Titik Tiang ODP Aktif) • Teknisi siap 1–2 jam',
      speed: 'Up to 500 Mbps Simetris',
      latency: '1.8 ms (PoP Nusukan)',
      slot: 'Ready (Siap Pasang Hari Ini)'
    },
    'jebres': {
      name: 'Kecamatan Jebres',
      sub: 'Solo Timur',
      kelurahan: 'Mojosongo, Pucangsawit, Jagalan, Purwodiningratan, Sewu, Jebres, Kepatihan Kulon/Wetan, Gandekan',
      landmark: 'Kawasan Kampus UNS & ISI Surakarta, Solo Safari (Jurug), Stasiun Jebres, RS Dr. Oen Kandang Sapi',
      status: 'Ready (62 Titik Tiang ODP Aktif) • Teknisi siap 1–2 jam',
      speed: 'Up to 500 Mbps Simetris',
      latency: '1.9 ms (PoP UNS Kentingan)',
      slot: 'Ready (Siap Pasang Hari Ini)'
    },
    'laweyan': {
      name: 'Kecamatan Laweyan',
      sub: 'Solo Barat',
      kelurahan: 'Karangasem, Jajar, Kerten, Purwosari, Sondakan, Pajang, Sriwedari, Panularan, Penumping, Bumi',
      landmark: 'Stasiun Purwosari, Kampung Batik Laweyan, Koridor Bisnis Slamet Riyadi Barat, RS Kasih Ibu',
      status: 'Ready (56 Titik Tiang ODP Aktif) • Teknisi siap 1–2 jam',
      speed: 'Up to 500 Mbps Simetris',
      latency: '1.7 ms (PoP Purwosari)',
      slot: 'Ready (Siap Pasang Hari Ini)'
    },
    'pasar-kliwon': {
      name: 'Kecamatan Pasar Kliwon',
      sub: 'Solo Tenggara & Pusat Cagar Budaya',
      kelurahan: 'Kauman, Baluwarti, Gajahan, Semanggi, Pasar Kliwon, Kedung Lumbu, Sangkrah, Kampung Baru, Joyosuran',
      landmark: 'Kraton Kasunanan Surakarta, Pasar Klewer, Pasar Gede Hardjonagoro, Benteng Vastenburg, Wisata Kauman',
      status: 'Ready (54 Titik Tiang ODP Aktif) • Teknisi siap 1–2 jam',
      speed: 'Up to 500 Mbps Simetris',
      latency: '2.0 ms (PoP Gladak)',
      slot: 'Ready (Siap Pasang Hari Ini)'
    },
    'serengan': {
      name: 'Kecamatan Serengan',
      sub: 'Solo Selatan — Tengah',
      kelurahan: 'Tipes, Kratonan, Jayengan, Kemlayan, Serengan, Danukusuman, Joyotakan',
      landmark: 'Sentra Kuliner Notosuman, Koridor Niaga Yos Sudarso, Sentra Emas Nonongan, Akses Alun-Alun Kidul',
      status: 'Ready (44 Titik Tiang ODP Aktif) • Teknisi siap 1–2 jam',
      speed: 'Up to 500 Mbps Simetris',
      latency: '2.1 ms (PoP Dawung)',
      slot: 'Ready (Siap Pasang Hari Ini)'
    },
    'kartasura': {
      name: 'Kecamatan Kartasura',
      sub: 'Penyangga Barat Solo Raya',
      kelurahan: 'Pabelan, Gonilan, Makamhaji, Ngadirejo, Singopuran, Kartasura, Gumpang, Ngemplak, Pucangan',
      landmark: 'Simpang Segitiga Emas Jogja-Semarang-Solo, Kampus Utama UMS Pabelan, Kawasan Residensial Makamhaji',
      status: 'Ready (72 Titik Tiang ODP Aktif) • Teknisi siap 1–2 jam',
      speed: 'Up to 500 Mbps Simetris',
      latency: '2.3 ms (PoP Pabelan)',
      slot: 'Ready (Siap Pasang Hari Ini)'
    },
    'colomadu': {
      name: 'Kecamatan Colomadu',
      sub: 'Penyangga Barat Laut (Arah Bandara)',
      kelurahan: 'Paulan, Baturan, Blulukan, Tohudan, Gawanan, Malangjiwan, Klodran, Gedongan',
      landmark: 'Heritage De Tjolomadoe, Koridor Bandara Internasional Adi Soemarmo, Residensial Fajar Indah & Baturan',
      status: 'Ready (58 Titik Tiang ODP Aktif) • Teknisi siap 1–2 jam',
      speed: 'Up to 500 Mbps Simetris',
      latency: '2.2 ms (PoP Adisumarmo)',
      slot: 'Ready (Siap Pasang Hari Ini)'
    },
    'gondangrejo': {
      name: 'Kecamatan Gondangrejo',
      sub: 'Penyangga Utara Solo Raya',
      kelurahan: 'Plesungan, Selokaton, Wonorejo, Tuban, Jatikuwung, Bulurejo, Dayu',
      landmark: 'Akses Utama Geopark Sangiran, Koridor Mojosongo Utara, Sentra Kawasan Logistik & Pergudangan Solo Utara',
      status: 'Ready (42 Titik Tiang ODP Aktif) • Teknisi siap 1–2 jam',
      speed: 'Up to 500 Mbps Simetris',
      latency: '2.6 ms (PoP Plesungan)',
      slot: 'Ready (Siap Pasang Hari Ini)'
    }
  };

  const pillButtons = document.querySelectorAll('.cakupan__area-tag');
  const zoneGroups = document.querySelectorAll('.zone-group');
  const statusCard = document.getElementById('coverage-status-card');

  if (!pillButtons.length || !zoneGroups.length) return;

  const elTitle = document.getElementById('node-title');
  const elSub = document.getElementById('node-sub');
  const elStatus = document.getElementById('node-status');
  const elKelurahan = document.getElementById('node-kelurahan');
  const elLandmark = document.getElementById('node-landmark');
  const elSpeed = document.getElementById('node-speed');
  const elLatency = document.getElementById('node-latency');
  const elSlot = document.getElementById('node-slot');

  let activeKec = 'banjarsari';

  function activateKecamatan(kec, triggerPulse) {
    if (!SOLO_RAYA_DATA[kec]) return;
    activeKec = kec;
    const data = SOLO_RAYA_DATA[kec];

    // Update pill buttons active state
    pillButtons.forEach(btn => {
      const match = btn.getAttribute('data-kec') === kec;
      btn.classList.toggle('is-active', match);
      btn.setAttribute('aria-pressed', match ? 'true' : 'false');
    });

    // Update SVG district zone groups active state
    zoneGroups.forEach(group => {
      const match = group.getAttribute('data-kec') === kec;
      group.classList.toggle('is-active', match);
    });

    // Update Status Card telemetry fields
    if (elTitle) elTitle.textContent = data.name;
    if (elSub) elSub.textContent = data.sub;
    if (elKelurahan) elKelurahan.textContent = data.kelurahan;
    if (elLandmark) elLandmark.textContent = data.landmark;
    if (elSpeed) elSpeed.textContent = data.speed;
    if (elLatency) elLatency.textContent = data.latency;
    if (elSlot) elSlot.textContent = data.slot;
    if (elStatus) {
      elStatus.innerHTML = '<span class="badge-indicator"></span> ' + data.status;
    }

    if (triggerPulse && statusCard) {
      statusCard.classList.remove('status-card-pulse');
      void statusCard.offsetWidth; // trigger reflow
      statusCard.classList.add('status-card-pulse');
    }
  }

  // Bind events to Left Pill Buttons
  pillButtons.forEach(btn => {
    const kec = btn.getAttribute('data-kec');
    if (!kec) return;

    btn.addEventListener('click', function () {
      activateKecamatan(kec, true);
    });

    btn.addEventListener('mouseenter', function () {
      activateKecamatan(kec, false);
    });

    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateKecamatan(kec, true);
      }
    });
  });

  // Bind events to Right SVG Zone Groups
  zoneGroups.forEach(group => {
    const kec = group.getAttribute('data-kec');
    if (!kec) return;

    group.addEventListener('click', function () {
      activateKecamatan(kec, true);
    });

    group.addEventListener('mouseenter', function () {
      activateKecamatan(kec, false);
    });

    group.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateKecamatan(kec, true);
      }
    });
  });

  // Initialize with default district (Banjarsari)
  activateKecamatan('banjarsari', false);
})();



/**
 * ============================================================
 * NUSA Internet — Cakupan Bento Fiber Streak Canvas Animation
 * Draws 4 animated fiber data streaks along a 44px grid
 * inside the dark bento container
 * ============================================================
 */
(function () {
  'use strict';
  var canvas = document.querySelector('.cakupan__fiber-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motionQuery.matches) return;

  var GRID = 44;
  var COLORS = ['#C85A32', '#10B981'];
  var w = 0, h = 0, dpr = 1;
  var streaks = [];
  var animId = null;
  var isVisible = false;

  // IntersectionObserver for visibility-gated animation
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      isVisible = entries[0].isIntersecting;
      if (isVisible && !animId) animId = requestAnimationFrame(loop);
    }, { threshold: 0.05 }).observe(canvas.parentElement);
  } else {
    isVisible = true;
  }

  function Streak() {
    this.reset();
  }

  Streak.prototype.reset = function () {
    this.horizontal = Math.random() > 0.5;
    this.length = 80 + Math.random() * 40; // 80-120px
    this.speed = 0.6 + Math.random() * 0.8;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.delay = Math.random() * 180; // frame delay
    this.life = 0;
    if (this.horizontal) {
      var row = Math.floor(Math.random() * Math.ceil(h / GRID));
      this.y = row * GRID;
      this.x = -this.length - Math.random() * w * 0.3;
      this.maxTravel = w + this.length * 2;
    } else {
      var col = Math.floor(Math.random() * Math.ceil(w / GRID));
      this.x = col * GRID;
      this.y = -this.length - Math.random() * h * 0.3;
      this.maxTravel = h + this.length * 2;
    }
  };

  Streak.prototype.update = function () {
    if (this.delay > 0) { this.delay--; return; }
    this.life += this.speed;
    if (this.life > this.maxTravel) this.reset();
  };

  Streak.prototype.draw = function (c) {
    if (this.delay > 0) return;
    var x1, y1, x2, y2;
    if (this.horizontal) {
      x1 = this.x + this.life - this.length;
      y1 = this.y;
      x2 = this.x + this.life;
      y2 = this.y;
    } else {
      x1 = this.x;
      y1 = this.y + this.life - this.length;
      x2 = this.x;
      y2 = this.y + this.life;
    }
    var grad = c.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, this.color);
    c.strokeStyle = grad;
    c.lineWidth = 1.5;
    c.globalAlpha = 0.55;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.globalAlpha = 1;
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var parent = canvas.parentElement;
    w = parent.clientWidth;
    h = parent.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Re-init 4 streaks
    streaks = [];
    for (var i = 0; i < 4; i++) streaks.push(new Streak());
  }

  function loop() {
    if (!isVisible) { animId = null; return; }
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < streaks.length; i++) {
      streaks[i].update();
      streaks[i].draw(ctx);
    }
    animId = requestAnimationFrame(loop);
  }

  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 150);
  });
  resize();
  if (isVisible) animId = requestAnimationFrame(loop);
})();


/**
 * ============================================================
 * NUSA Internet — Cakupan Bento Mouse Spotlight Interaction
 * Updates CSS custom properties for radial-gradient spotlight
 * ============================================================
 */
(function () {
  'use strict';
  var bento = document.querySelector('.cakupan__bento');
  if (!bento) return;
  // Only activate on devices with fine pointer (mouse/trackpad)
  if (!window.matchMedia('(pointer: fine)').matches) return;

  bento.addEventListener('mousemove', function (e) {
    var rect = bento.getBoundingClientRect();
    bento.style.setProperty('--bento-mouse-x', (e.clientX - rect.left) + 'px');
    bento.style.setProperty('--bento-mouse-y', (e.clientY - rect.top) + 'px');
  });

  bento.addEventListener('mouseleave', function () {
    bento.style.setProperty('--bento-mouse-x', '-9999px');
    bento.style.setProperty('--bento-mouse-y', '-9999px');
  });
})();


/**
 * ============================================================
 * NUSA Internet — Seksi Cakupan Outer Cream Background Animation
 * Canvas: #cream-bg-canvas
 * 1. 48px x 48px grid lines (rgba(15, 23, 42, 0.05))
 * 2. 8–12 fiber streaks (70px-130px, 2px thick, terracotta & navy)
 * 3. Technical crosshair & node blinking at intersections
 * 4. Subtle cursor trail in cream area (radius 140px, terracotta glow)
 * 5. Auto sync with section.clientWidth & section.clientHeight
 * ============================================================
 */
(function () {
  'use strict';

  var section = document.getElementById('cakupan');
  var canvas = document.getElementById('cream-bg-canvas');
  var bento = document.querySelector('.cakupan__bento');
  if (!section || !canvas) return;

  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motionQuery.matches) return;

  var GRID = 48;
  var STREAK_COUNT = 10; // 8-12 paket data fiber
  var CROSSHAIR_COUNT = 14;

  var w = 0;
  var h = 0;
  var dpr = 1;
  var streaks = [];
  var crosshairs = [];
  var animId = null;

  var mouse = {
    x: -9999,
    y: -9999,
    isActive: false
  };

  // Streak colors: Terakota (rgba(200, 90, 50, 0.65)) & Navy (rgba(15, 23, 42, 0.35))
  var STREAK_COLORS = [
    { base: 'rgba(200, 90, 50, 0.65)', tip: 'rgba(200, 90, 50, 0.95)', head: '#C85A32' },
    { base: 'rgba(15, 23, 42, 0.35)', tip: 'rgba(15, 23, 42, 0.75)', head: '#0F172A' },
    { base: 'rgba(200, 90, 50, 0.65)', tip: 'rgba(200, 90, 50, 0.95)', head: '#C85A32' }
  ];

  // Fiber Streak Object
  function FiberStreak() {
    this.reset();
  }

  FiberStreak.prototype.reset = function () {
    this.horizontal = Math.random() > 0.5;
    this.length = 70 + Math.random() * 60; // 70px - 130px
    this.speed = 1.4 + Math.random() * 1.6; // 1.4 - 3.0 px/frame
    this.dir = Math.random() > 0.5 ? 1 : -1;
    this.color = STREAK_COLORS[Math.floor(Math.random() * STREAK_COLORS.length)];
    this.delay = Math.floor(Math.random() * 50);
    this.life = 0;

    if (this.horizontal) {
      var row = Math.floor(Math.random() * Math.max(1, Math.floor(h / GRID)));
      this.y = row * GRID;
      if (this.dir === 1) {
        this.x = -this.length - Math.random() * 80;
        this.maxTravel = w + this.length * 2 + 80;
      } else {
        this.x = w + this.length + Math.random() * 80;
        this.maxTravel = w + this.length * 2 + 80;
      }
    } else {
      var col = Math.floor(Math.random() * Math.max(1, Math.floor(w / GRID)));
      this.x = col * GRID;
      if (this.dir === 1) {
        this.y = -this.length - Math.random() * 80;
        this.maxTravel = h + this.length * 2 + 80;
      } else {
        this.y = h + this.length + Math.random() * 80;
        this.maxTravel = h + this.length * 2 + 80;
      }
    }
  };

  FiberStreak.prototype.update = function () {
    if (this.delay > 0) {
      this.delay--;
      return;
    }
    this.life += this.speed;
    if (this.life > this.maxTravel) {
      this.reset();
    }
  };

  FiberStreak.prototype.draw = function (c) {
    if (this.delay > 0) return;

    var curX, curY, tailX, tailY;
    if (this.horizontal) {
      curX = this.dir === 1 ? this.x + this.life : this.x - this.life;
      curY = this.y;
      tailX = this.dir === 1 ? curX - this.length : curX + this.length;
      tailY = curY;
    } else {
      curX = this.x;
      curY = this.dir === 1 ? this.y + this.life : this.y - this.life;
      tailX = curX;
      tailY = this.dir === 1 ? curY - this.length : curY + this.length;
    }

    var grad = c.createLinearGradient(tailX, tailY, curX, curY);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.7, this.color.base);
    grad.addColorStop(1, this.color.tip);

    c.strokeStyle = grad;
    c.lineWidth = 2; // Tebal 2px
    c.beginPath();
    c.moveTo(tailX, tailY);
    c.lineTo(curX, curY);
    c.stroke();

    // Spark micro dot di ujung kepala streak
    c.fillStyle = this.color.head;
    c.beginPath();
    c.arc(curX, curY, 1.8, 0, Math.PI * 2);
    c.fill();
  };

  // Technical Crosshair & Node Blinking Object
  function TechnicalNode() {
    this.reset();
  }

  TechnicalNode.prototype.reset = function () {
    var cols = Math.max(1, Math.floor(w / GRID));
    var rows = Math.max(1, Math.floor(h / GRID));

    this.col = Math.floor(Math.random() * cols);
    this.row = Math.floor(Math.random() * rows);
    this.x = this.col * GRID;
    this.y = this.row * GRID;

    this.isTerracotta = Math.random() > 0.4;
    this.phase = Math.random() * Math.PI * 2;
    this.speed = 0.02 + Math.random() * 0.025;
    this.maxPulse = 11 + Math.random() * 4;
  };

  TechnicalNode.prototype.update = function () {
    this.phase += this.speed;
    if (this.phase >= Math.PI * 2) {
      this.reset();
    }
  };

  TechnicalNode.prototype.draw = function (c) {
    var sinVal = Math.sin(this.phase);
    if (sinVal <= 0.05) return;

    var alpha = sinVal;
    var baseColor = this.isTerracotta ? '200, 90, 50' : '15, 23, 42';

    // 1. Simbol Koordinat tipis "+"
    c.strokeStyle = 'rgba(' + baseColor + ', ' + (alpha * 0.45) + ')';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(this.x - 4.5, this.y);
    c.lineTo(this.x + 4.5, this.y);
    c.moveTo(this.x, this.y - 4.5);
    c.lineTo(this.x, this.y + 4.5);
    c.stroke();

    // 2. Titik mikro di pusat koordinat
    c.fillStyle = 'rgba(' + baseColor + ', ' + (alpha * 0.75) + ')';
    c.beginPath();
    c.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
    c.fill();

    // 3. Soft Pulse Ring yang mengembang dan memudar
    if (sinVal > 0.25) {
      var pulseProgress = (sinVal - 0.25) / 0.75;
      var ringRadius = 2.5 + pulseProgress * this.maxPulse;
      var ringAlpha = (1 - pulseProgress) * 0.32;
      c.strokeStyle = 'rgba(' + baseColor + ', ' + ringAlpha + ')';
      c.beginPath();
      c.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
      c.stroke();
    }
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = section.clientWidth || window.innerWidth;
    h = section.clientHeight || 700;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Inisialisasi streaks
    if (streaks.length !== STREAK_COUNT) {
      streaks = [];
      for (var i = 0; i < STREAK_COUNT; i++) {
        streaks.push(new FiberStreak());
      }
    }

    // Inisialisasi technical nodes
    if (crosshairs.length !== CROSSHAIR_COUNT) {
      crosshairs = [];
      for (var j = 0; j < CROSSHAIR_COUNT; j++) {
        crosshairs.push(new TechnicalNode());
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, w, h);

    // 1. Gambar Garis Grid Tipis (rgba(15, 23, 42, 0.05), jarak 48px)
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 0; gx <= w; gx += GRID) {
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
    }
    for (var gy = 0; gy <= h; gy += GRID) {
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
    }
    ctx.stroke();

    // 2. Subtle Cursor Trail di Area Krem (Radius 140px, warna Terakota rgba(200, 90, 50, 0.35))
    if (mouse.isActive && mouse.x >= 0 && mouse.y >= 0) {
      var minC = Math.max(0, Math.floor((mouse.x - 140) / GRID));
      var maxC = Math.min(Math.floor(w / GRID), Math.ceil((mouse.x + 140) / GRID));
      var minR = Math.max(0, Math.floor((mouse.y - 140) / GRID));
      var maxR = Math.min(Math.floor(h / GRID), Math.ceil((mouse.y + 140) / GRID));

      for (var c = minC; c <= maxC; c++) {
        for (var r = minR; r <= maxR; r++) {
          var px = c * GRID;
          var py = r * GRID;
          var dx = mouse.x - px;
          var dy = mouse.y - py;
          var dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 140) {
            var factor = (1 - dist / 140);
            var alpha = factor * 0.35;

            // Crosshair menyala di persimpangan grid
            ctx.strokeStyle = 'rgba(200, 90, 50, ' + alpha + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px - 5, py);
            ctx.lineTo(px + 5, py);
            ctx.moveTo(px, py - 5);
            ctx.lineTo(px, py + 5);
            ctx.stroke();

            // Pendaran titik mikro terakota
            ctx.fillStyle = 'rgba(200, 90, 50, ' + (factor * 0.6) + ')';
            ctx.beginPath();
            ctx.arc(px, py, 1.8, 0, Math.PI * 2);
            ctx.fill();

            // Pendaran halo lembut
            var halo = ctx.createRadialGradient(px, py, 0, px, py, 7);
            halo.addColorStop(0, 'rgba(200, 90, 50, ' + (factor * 0.22) + ')');
            halo.addColorStop(1, 'transparent');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(px, py, 7, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // 3. Technical Crosshairs & Node Blinking
    for (var k = 0; k < crosshairs.length; k++) {
      crosshairs[k].update();
      crosshairs[k].draw(ctx);
    }

    // 4. Fiber Data Streaks (8-12 paket data meluncur sepanjang garis grid)
    for (var s = 0; s < streaks.length; s++) {
      streaks[s].update();
      streaks[s].draw(ctx);
    }

    animId = requestAnimationFrame(loop);
  }

  // Tracking Mouse di Area Krem di Luar Kotak Biru Bento
  section.addEventListener('mousemove', function (e) {
    if (bento) {
      var bRect = bento.getBoundingClientRect();
      var inBento = (
        e.clientX >= bRect.left &&
        e.clientX <= bRect.right &&
        e.clientY >= bRect.top &&
        e.clientY <= bRect.bottom
      );
      if (inBento) {
        mouse.isActive = false;
        return;
      }
    }
    var sRect = section.getBoundingClientRect();
    mouse.x = e.clientX - sRect.left;
    mouse.y = e.clientY - sRect.top;
    mouse.isActive = true;
  });

  section.addEventListener('mouseleave', function () {
    mouse.isActive = false;
    mouse.x = -9999;
    mouse.y = -9999;
  });

  // Sinkronisasi ukuran canvas
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      resize();
    }).observe(section);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('load', resize);

  resize();
  animId = requestAnimationFrame(loop);
})();
