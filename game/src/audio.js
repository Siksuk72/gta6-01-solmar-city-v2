// Synthesized sound and music — everything is generated with WebAudio, no
// audio files and no network. Engine hum, sirens, a helicopter rotor, gunfire,
// jingles and the Solmar City radio: three stations, each a step-sequenced
// groove (bass + chords + hats) driven by the station's own pattern.
export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicOn = true;
    this.volume = 0.5;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.rotorOsc = null;
    this.rotorGain = null;
    this.rotorTimer = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.radioStation = null; // pattern from the radio system, or null for the default groove
    this.muted = false;
  }

  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.context.destination);
    this.startEngineLoop();
    this.startMusic();
  }

  setVolume(value) {
    this.volume = value;
    if (this.master) this.master.gain.value = this.muted ? 0 : value;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  toggleMusic() {
    return this.setMusicEnabled(!this.musicOn);
  }

  setMusicEnabled(on) {
    this.musicOn = on;
    return this.musicOn;
  }

  // --- radio stations: the pattern the music sequencer plays ---
  setRadioStation(station) {
    this.radioStation = station || null;
    this.musicStep = 0;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
      this.startMusic();
    }
  }

  // --- engine ---
  startEngineLoop() {
    const ctx = this.context;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speedRatio, inCar) {
    if (!this.context || !this.engineGain) return;
    const target = inCar ? 0.05 + speedRatio * 0.11 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.context.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(46 + speedRatio * 130, this.context.currentTime, 0.08);
    this.engineFilter.frequency.setTargetAtTime(380 + speedRatio * 1400, this.context.currentTime, 0.1);
  }

  // --- siren ---
  setSiren(on) {
    if (!this.context) return;
    if (on && !this.sirenOsc) {
      const ctx = this.context;
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      // A slightly lower wail (700/940 Hz instead of 720/960): the old one
      // cut through the radio mix too sharply at full wanted level.
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0.028;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      let high = false;
      this.sirenTimer = setInterval(() => {
        if (!this.sirenOsc) return;
        high = !high;
        this.sirenOsc.frequency.setTargetAtTime(high ? 940 : 700, ctx.currentTime, 0.05);
      }, 420);
    } else if (!on && this.sirenOsc) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
      try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc.disconnect();
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  // --- helicopter rotor: a chopped low thump, like blades beating the air ---
  setRotor(on) {
    if (!this.context) return;
    if (on && !this.rotorOsc) {
      const ctx = this.context;
      this.rotorOsc = ctx.createOscillator();
      this.rotorOsc.type = 'sawtooth';
      this.rotorOsc.frequency.value = 52;
      this.rotorGain = ctx.createGain();
      this.rotorGain.gain.value = 0.05;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.rotorOsc.connect(filter);
      filter.connect(this.rotorGain);
      this.rotorGain.connect(this.master);
      this.rotorOsc.start();
      let chop = false;
      this.rotorTimer = setInterval(() => {
        if (!this.rotorGain) return;
        chop = !chop;
        this.rotorGain.gain.setTargetAtTime(chop ? 0.055 : 0.015, ctx.currentTime, 0.01);
      }, 38);
    } else if (!on && this.rotorOsc) {
      clearInterval(this.rotorTimer);
      this.rotorTimer = null;
      try { this.rotorOsc.stop(); } catch (e) { /* already stopped */ }
      this.rotorOsc.disconnect();
      this.rotorOsc = null;
      this.rotorGain = null;
    }
  }

  // --- one-shots ---
  blip(freq, duration, type, gainValue) {
    if (!this.context) return;
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue || 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  noiseBurst(duration, gainValue, filterFreq) {
    if (!this.context) return;
    const ctx = this.context;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 3000;
    const gain = ctx.createGain();
    gain.gain.value = gainValue || 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  gunshot() { this.noiseBurst(0.14, 0.4, 1800); this.blip(160, 0.08, 'square', 0.12); }
  enemyShot() { this.noiseBurst(0.1, 0.16, 1200); }
  explosion() {
    this.noiseBurst(0.7, 0.6, 500);
    this.blip(70, 0.5, 'sine', 0.4);
  }
  nosWhoosh() {
    this.noiseBurst(0.5, 0.35, 5000);
    this.blip(180, 0.5, 'sawtooth', 0.1);
    setTimeout(() => this.blip(720, 0.3, 'sawtooth', 0.08), 120);
  }
  pickup() { this.blip(880, 0.12, 'sine', 0.18); setTimeout(() => this.blip(1320, 0.18, 'sine', 0.18), 90); }
  // Two-note alert sting: AIR-1 just joined the chase.
  sting() { this.blip(660, 0.14, 'square', 0.14); setTimeout(() => this.blip(880, 0.22, 'square', 0.14), 130); }
  // The click-clack of a magazine going in.
  reloadClick() { this.blip(1200, 0.05, 'square', 0.1); setTimeout(() => this.blip(900, 0.06, 'square', 0.1), 90); }
  cashSound() { this.blip(1046, 0.1, 'triangle', 0.16); setTimeout(() => this.blip(1568, 0.16, 'triangle', 0.16), 80); }
  uiClick() { this.blip(660, 0.06, 'square', 0.08); }
  denied() { this.blip(180, 0.18, 'square', 0.12); }
  carDoor() { this.noiseBurst(0.08, 0.2, 900); }
  skid() { this.noiseBurst(0.18, 0.08, 2400); }
  missionComplete() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.2), i * 110));
  }
  missionFailed() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.1), i * 140));
  }
  wasted() {
    [330, 262, 196, 131].forEach((f, i) => setTimeout(() => this.blip(f, 0.4, 'sawtooth', 0.14), i * 220));
  }

  // --- radio: the active station's groove, bass + chords + hats, step-sequenced ---
  startMusic() {
    if (this.musicTimer) return;
    const station = this.radioStation || {
      // Default sunset groove when no station is set yet:
      // Am – F – C – G, one bar each, 8th-note steps at 96 BPM.
      chords: [
        [220.0, 261.63, 329.63],
        [174.61, 220.0, 261.63],
        [196.0, 261.63, 329.63],
        [164.81, 246.94, 293.66],
      ],
      bass: [110, 87.31, 130.81, 98],
      bpm: 96,
      leadWave: 'sine',
      bassWave: 'triangle',
      hatEvery: 2,
    };
    const stepMs = 60000 / station.bpm / 2;
    this.musicTimer = setInterval(() => {
      if (!this.context || !this.musicOn || this.muted) return;
      const step = this.musicStep;
      this.musicStep = (this.musicStep + 1) % 32;
      const bar = Math.floor(step / 8);
      const inBar = step % 8;
      const chord = station.chords[bar];
      if (inBar === 0) this.blip(station.bass[bar], 0.5, station.bassWave, 0.14);
      if (inBar % 2 === 0) this.blip(chord[inBar % chord.length], 0.22, station.leadWave, 0.05);
      if (inBar === 4) this.blip(chord[1] * 2, 0.18, station.leadWave, 0.04);
      if (inBar % station.hatEvery === 1) this.noiseBurst(0.03, 0.02, 8000);
    }, stepMs);
  }
}
