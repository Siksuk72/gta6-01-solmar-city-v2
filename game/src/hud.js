// The HUD: health and armour bars, cash, wanted stars, the mission panel
// with its stage progress, the police-response board, the vehicle panel,
// the radio readout, weapon slots, the crew dialogue box, a live minimap
// with districts, and the toasts, prompts and menus.
import { WANTED_NAMES, DISTRICTS } from './config.js';
import { clamp } from './random.js';

const HUD_IDS = ['hud', 'health-fill', 'armor-fill', 'armor-row', 'cash', 'wanted-stars',
  'weapon-name', 'ammo', 'speed', 'speed-row', 'objective', 'objective-title', 'message',
  'interact', 'crosshair', 'minimap', 'vignette', 'clock', 'title-screen', 'btn-new',
  'btn-continue', 'btn-howto', 'howto-panel', 'title-missions', 'pause-menu', 'btn-resume',
  'btn-save', 'btn-quit-title', 'btn-restart-mission', 'pause-stats', 'shop-panel',
  'shop-title', 'shop-items', 'btn-close-shop', 'overlay-wasted', 'overlay-busted',
  'banner', 'banner-title', 'banner-sub', 'save-note', 'mission-stage', 'mission-next',
  'police-panel', 'police-units', 'vehicle-panel', 'vehicle-name', 'vehicle-condition',
  'vehicle-speed', 'vehicle-nos', 'radio-panel', 'radio-station', 'radio-track',
  'weapon-slots', 'dialogue-box', 'dialogue-portrait', 'dialogue-name', 'dialogue-text',
  'district-label', 'district-name', 'mission-panel'];

export class Hud {
  constructor(city) {
    this.city = city;
    this.el = {};
    for (const id of HUD_IDS) this.el[id] = document.getElementById(id);
    this.minimap = this.el['minimap'] ? this.el['minimap'].getContext('2d') : null;
    this.messageTimer = 0;
    this.bannerTimer = 0;
    this.slowTimer = 0; // throttles the police/vehicle panels to ~7 Hz
    this.lastSlotsSig = '';
    this.lastDialogueSig = '';
    this.roadCoords = [...new Set(city.intersections.map((n) => n.x))].sort((a, b) => a - b);
    // Callbacks the world wires up.
    this.onNewGame = null;
    this.onContinue = null;
    this.onResume = null;
    this.onSave = null;
    this.onQuitToTitle = null;
    this.onRestartMission = null;
    this.onShopBuy = null;
    this.onCloseShop = null;
    this.wireButtons();
  }

  wireButtons() {
    const click = (id, fn) => {
      const el = this.el[id];
      if (el) el.addEventListener('click', () => { if (fn) fn(); });
    };
    click('btn-new', () => this.onNewGame && this.onNewGame());
    click('btn-continue', () => this.onContinue && this.onContinue());
    click('btn-howto', () => {
      const panel = this.el['howto-panel'];
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    click('btn-resume', () => this.onResume && this.onResume());
    click('btn-save', () => this.onSave && this.onSave());
    click('btn-quit-title', () => this.onQuitToTitle && this.onQuitToTitle());
    click('btn-restart-mission', () => this.onRestartMission && this.onRestartMission());
    click('btn-close-shop', () => this.onCloseShop && this.onCloseShop());
  }

  showTitle(hasSave, missions, completedCount) {
    this.el['title-screen'].style.display = 'flex';
    this.el['hud'].style.display = 'none';
    this.el['btn-continue'].style.display = hasSave ? 'inline-block' : 'none';
    this.el['title-missions'].innerHTML = missions.map((m, i) => {
      const done = i < completedCount;
      const current = i === completedCount;
      const mark = done ? '✓' : current ? '▶' : '·';
      return `<div class="mission-row ${done ? 'done' : ''} ${current ? 'current' : ''}">${mark} ${i + 1}. ${m.name} — $${m.reward.toLocaleString()}</div>`;
    }).join('');
  }

  hideTitle() {
    this.el['title-screen'].style.display = 'none';
    this.el['hud'].style.display = 'block';
  }

  showPause(statsText) {
    this.el['pause-menu'].style.display = 'flex';
    this.el['pause-stats'].textContent = statsText;
  }

  hidePause() {
    this.el['pause-menu'].style.display = 'none';
  }

  showShop(shop, items) {
    this.el['shop-title'].textContent = shop.name;
    const container = this.el['shop-items'];
    container.innerHTML = '';
    for (const item of items) {
      const button = document.createElement('button');
      button.className = 'shop-item';
      button.innerHTML = `<span>${item.label}</span><span>${item.price ? `$${item.price}` : 'FREE'}</span>`;
      if (item.disabled) button.disabled = true;
      button.addEventListener('click', () => { if (this.onShopBuy) this.onShopBuy(item); });
      container.appendChild(button);
    }
    this.el['shop-panel'].style.display = 'flex';
  }

  hideShop() {
    this.el['shop-panel'].style.display = 'none';
  }

  showWasted() { this.el['overlay-wasted'].style.display = 'flex'; }
  hideWasted() { this.el['overlay-wasted'].style.display = 'none'; }
  showBusted() { this.el['overlay-busted'].style.display = 'flex'; }
  hideBusted() { this.el['overlay-busted'].style.display = 'none'; }

  showMessage(text, seconds) {
    this.el['message'].textContent = text;
    this.el['message'].style.opacity = '1';
    this.messageTimer = seconds || 4;
  }

  showBanner(title, sub, seconds) {
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub || '';
    this.el['banner'].style.display = 'block';
    this.bannerTimer = seconds || 3.5;
  }

  update(dt, state) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.el['message'].style.opacity = '0';
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el['banner'].style.display = 'none';
    }
    // --- vitals ---
    this.el['health-fill'].style.width = `${clamp(state.health, 0, 100)}%`;
    // Red only when truly critical (under 25%): at 28% mid-fight the old
    // threshold cried wolf while the player still had a full bar to work with.
    this.el['health-fill'].style.background = state.health < 25 ? '#e33' : '#5da85d';
    this.el['armor-row'].style.display = state.armor > 0 ? 'flex' : 'none';
    this.el['armor-fill'].style.width = `${clamp(state.armor, 0, 100)}%`;
    this.el['cash'].textContent = `$${Math.floor(state.cash).toLocaleString()}`;
    const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    this.el['wanted-stars'].textContent = stars;
    this.el['wanted-stars'].style.color = state.wanted > 0 ? '#ffd800' : 'rgba(255,255,255,0.35)';
    this.el['wanted-stars'].title = WANTED_NAMES[state.wanted] || '';
    const minutes = Math.floor(state.clockMinutes % 60);
    const hours = Math.floor(state.clockMinutes / 60) % 24;
    this.el['clock'].textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    // --- mission panel: name, objective, stage bar, next step ---
    this.el['objective-title'].textContent = state.missionTitle || 'Free roam';
    this.el['objective'].textContent = state.objectiveText || 'Explore Solmar City. Press M for the mission list, E to interact.';
    if (state.missionStage) {
      const ms = state.missionStage;
      this.el['mission-stage'].textContent =
        `MISSION ${ms.number}/${ms.total}  •  STAGE ${ms.stage}/${ms.stages}  ${'█'.repeat(ms.stage)}${'░'.repeat(Math.max(0, ms.stages - ms.stage))}`;
      this.el['mission-next'].textContent = `NEXT: ${ms.next}`;
      this.el['mission-next'].style.display = 'block';
    } else {
      this.el['mission-stage'].textContent = '';
      this.el['mission-next'].style.display = 'none';
    }
    // --- district label ---
    if (state.district) this.el['district-name'].textContent = state.district;
    // --- weapon slots (rebuild only when the signature changes) ---
    if (state.weaponSlots) {
      const sig = state.weaponSlots.map((s) => `${s.id}:${s.owned ? 1 : 0}:${s.current ? 1 : 0}:${s.ammo}`).join('|');
      if (sig !== this.lastSlotsSig) {
        this.lastSlotsSig = sig;
        this.el['weapon-slots'].innerHTML = state.weaponSlots.map((s, i) => {
          const cls = `slot ${s.current ? 'current' : ''} ${s.owned ? '' : 'locked'}`;
          const ammo = s.owned ? (s.ammo === null ? '—' : s.ammo) : '🔒';
          return `<div class="${cls}"><span class="slot-key">${i + 1}</span><span class="slot-name">${s.name}</span><span class="slot-ammo">${ammo}</span></div>`;
        }).join('');
      }
    }
    this.el['weapon-name'].textContent = state.weaponName;
    this.el['ammo'].textContent = state.reloading ? 'RELOADING…' : state.ammoText || `${state.magAmmo} / ∞`;
    // --- dialogue box ---
    const dlg = state.dialogue || null;
    const dlgSig = dlg ? `${dlg.name}|${dlg.text}` : '';
    if (dlgSig !== this.lastDialogueSig) {
      this.lastDialogueSig = dlgSig;
      if (dlg) {
        this.el['dialogue-box'].style.display = 'flex';
        this.el['dialogue-portrait'].textContent = dlg.initials;
        this.el['dialogue-portrait'].style.background = dlg.color;
        this.el['dialogue-name'].textContent = `${dlg.name} — ${dlg.role}`;
        this.el['dialogue-text'].textContent = dlg.text;
      } else {
        this.el['dialogue-box'].style.display = 'none';
      }
    }
    // --- radio panel ---
    if (state.radio) {
      const r = state.radio;
      this.el['radio-station'].textContent = r.on ? `${r.station} ${r.freq} — ${r.genre}` : 'RADIO OFF — press Q / M';
      this.el['radio-track'].textContent = r.on ? `♪ ${r.title} — ${r.artist}` : '';
    }
    // --- prompts / crosshair / vignette ---
    this.el['interact'].style.display = state.interactText ? 'block' : 'none';
    this.el['interact'].textContent = state.interactText || '';
    this.el['crosshair'].style.display = state.showCrosshair ? 'block' : 'none';
    const lowHealth = state.health < 30;
    this.el['vignette'].style.opacity = lowHealth ? '0.55' : state.wanted >= 4 ? '0.25' : '0';
    // --- slow panels: police response + vehicle ---
    this.slowTimer -= dt;
    if (this.slowTimer <= 0) {
      this.slowTimer = 0.15;
      this.updatePolicePanel(state);
      this.updateVehiclePanel(state);
    }
    this.drawMinimap(state);
  }

  updatePolicePanel(state) {
    const units = [...(state.policeUnits || [])].sort((a, b) => a.dist - b.dist);
    const panel = this.el['police-panel'];
    if (!panel) return;
    panel.style.display = units.length > 0 ? 'block' : 'none';
    if (units.length === 0) return;
    this.el['police-units'].innerHTML = units.map((u) => {
      const statusClass = u.status === 'RAMMING' ? 'st-ram' : u.status === 'SPOTLIGHT' ? 'st-spot' : u.status === 'ROADBLOCK' ? 'st-block' : 'st-pursuit';
      return `<div class="police-row"><span class="police-name">${u.name}</span><span class="police-dist">${u.dist}m</span><span class="police-status ${statusClass}">${u.status}</span></div>`;
    }).join('');
  }

  updateVehiclePanel(state) {
    const panel = this.el['vehicle-panel'];
    if (!panel) return;
    if (!state.inCar || !state.vehicle) {
      panel.style.display = 'none';
      this.el['speed-row'].style.display = 'none';
      return;
    }
    panel.style.display = 'block';
    const v = state.vehicle;
    this.el['vehicle-name'].textContent = v.name;
    this.el['vehicle-condition'].textContent = `CONDITION ${Math.max(0, Math.round(v.condition))}%`;
    this.el['vehicle-condition'].style.color = v.condition < 35 ? '#ff6666' : '#7dff8a';
    this.el['vehicle-speed'].textContent = `${Math.round(v.speedKmh)}`;
    const nos = v.nos || { charges: 0, max: 3, active: false };
    this.el['vehicle-nos'].textContent = nos.active
      ? `NOS! ${Math.max(0, nos.timer).toFixed(1)}s`
      : `NOS ${'◆'.repeat(nos.charges)}${'◇'.repeat(Math.max(0, nos.max - nos.charges))}  [N]`;
    this.el['vehicle-nos'].style.color = nos.active ? '#66ccff' : '#ffe9a8';
    this.el['speed-row'].style.display = 'none';
  }

  drawMinimap(state) {
    if (!this.minimap) return;
    const ctx = this.minimap;
    const size = 200;
    const scale = size / 640; // world -320..320 maps onto the canvas
    const toMap = (x, z) => [(x + 320) * scale, (z + 320) * scale];
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(16, 28, 40, 0.88)';
    ctx.fillRect(0, 0, size, size);
    // District tints + labels.
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const [x1, y1] = toMap(d.minX, d.minZ);
      const [x2, y2] = toMap(d.maxX, d.maxZ);
      ctx.fillStyle = 'rgba(255, 216, 0, 0.05)';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(d.name.toUpperCase(), (x1 + x2) / 2, (y1 + y2) / 2);
    }
    // Ocean strip on the west edge.
    ctx.fillStyle = 'rgba(42, 122, 158, 0.9)';
    ctx.fillRect(0, 0, toMap(-261, 0)[0], size);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('BEACH', toMap(-290, 0)[0], size / 2);
    // Roads.
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.55)';
    ctx.lineWidth = 2;
    for (const c of this.roadCoords) {
      const [x1] = toMap(c, 0);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, size);
      ctx.stroke();
      const [, z1] = toMap(0, c);
      ctx.beginPath();
      ctx.moveTo(0, z1);
      ctx.lineTo(size, z1);
      ctx.stroke();
    }
    // Shops.
    ctx.fillStyle = '#7ad0ff';
    for (const shop of state.shops || []) {
      const [sx, sy] = toMap(shop.pos[0], shop.pos[1]);
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }
    // Collectibles.
    ctx.fillStyle = '#2aff66';
    for (const spot of state.collectibles || []) {
      const [cx, cy] = toMap(spot.x, spot.z);
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    // Traffic.
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const car of state.traffic || []) {
      const [cx, cy] = toMap(car.x, car.z);
      ctx.fillRect(cx - 1, cy - 1, 2, 2);
    }
    // Police cars.
    ctx.fillStyle = '#ff4444';
    for (const car of state.policeCars || []) {
      const [cx, cy] = toMap(car.x, car.z);
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police helicopter.
    if (state.heli) {
      const [hx, hy] = toMap(state.heli.x, state.heli.z);
      ctx.fillStyle = '#ffd800';
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.font = 'bold 7px Arial';
      ctx.fillText('H', hx, hy + 2.5);
    }
    // Mission marker (pulsing).
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      const pulse = 5 + Math.sin(state.time * 5) * 2;
      ctx.fillStyle = '#ffd800';
      ctx.beginPath();
      ctx.arc(mx, my, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(state.playerHeading), -Math.cos(state.playerHeading)));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North marker.
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('N', size - 12, 13);
  }
}
