// Solmar City radio: three original stations, all synthesized live with
// WebAudio by the sound engine — no audio files, no network. Q cycles
// stations, M toggles the radio, and the HUD shows what is playing now.
export const RADIO_STATIONS = [
  {
    id: 'sunset',
    name: 'SOLMAR FM',
    freq: '88.5',
    genre: 'Sunset Drive',
    bpm: 96,
    // Am – F – C – G, one bar each, 8th-note steps.
    chords: [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 261.63, 329.63],
      [164.81, 246.94, 293.66],
    ],
    bass: [110, 87.31, 130.81, 98],
    leadWave: 'sine',
    bassWave: 'triangle',
    hatEvery: 2,
    tracks: [
      { title: 'Golden Hour Run', artist: 'The Palms' },
      { title: 'Salt Air Serenade', artist: 'Marina Vale' },
      { title: 'Two Lanes to the Beach', artist: 'The Palms' },
      { title: 'Last Light on Marina Row', artist: 'Cleo Duarte' },
      { title: 'Umbrella Shade', artist: 'The Palms' },
      { title: 'Sunset Boulevard Stroll', artist: 'The Palms' },
    ],
  },
  {
    id: 'neon',
    name: 'PALM WAVE',
    freq: '101.3',
    genre: 'Neon Nights',
    bpm: 122,
    // Dm – Bb – F – C, driving synth pulse, faster hats.
    chords: [
      [293.66, 349.23, 440.0],
      [233.08, 293.66, 349.23],
      [261.63, 349.23, 440.0],
      [261.63, 329.63, 392.0],
    ],
    bass: [73.42, 116.54, 87.31, 130.81],
    leadWave: 'square',
    bassWave: 'sawtooth',
    hatEvery: 1,
    tracks: [
      { title: 'Neon Palm Speedway', artist: 'Velvet Static' },
      { title: 'Midnight Overdrive', artist: 'Chrome Sunset' },
      { title: 'Getaway Glow', artist: 'Velvet Static' },
      { title: 'Red Light Runner', artist: 'DJ Marisol' },
      { title: 'Chrome Sunset Boulevard', artist: 'Chrome Sunset' },
    ],
  },
  {
    id: 'tide',
    name: 'TIDE TALK',
    freq: '94.1',
    genre: 'Coastline Stories',
    bpm: 80,
    // Cmaj7 – Am7 – Fmaj7 – G6, a lazy jazzy sway for the late drive home.
    chords: [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 329.63],
    ],
    bass: [130.81, 110, 87.31, 98],
    leadWave: 'sine',
    bassWave: 'triangle',
    hatEvery: 4,
    tracks: [
      { title: 'Harbor Lights Lullaby', artist: 'Nadia Vale' },
      { title: 'Ferry Tales', artist: 'Old Man Rook' },
      { title: 'Low Tide, High Hopes', artist: 'Nadia Vale' },
      { title: 'The Long Way Round the Bay', artist: 'Cleo Duarte' },
      { title: 'Old Man Rook Remembers', artist: 'Old Man Rook' },
    ],
  },
];

export class RadioSystem {
  constructor(audio) {
    this.audio = audio;
    this.stationIndex = 0;
    this.trackIndex = 0;
    this.trackTimer = 0;
    this.trackLength = 42; // seconds before the next track rolls in
    this.on = true;
    this.applyStation();
  }

  station() {
    return RADIO_STATIONS[this.stationIndex];
  }

  track() {
    return this.station().tracks[this.trackIndex];
  }

  applyStation() {
    if (!this.audio) return;
    this.audio.setRadioStation(this.station());
    this.audio.setMusicEnabled(this.on);
  }

  nextStation() {
    this.stationIndex = (this.stationIndex + 1) % RADIO_STATIONS.length;
    this.trackIndex = 0;
    this.trackTimer = 0;
    this.applyStation();
    return this.nowPlaying();
  }

  // Shift+Q: step back a station instead of forward.
  previousStation() {
    this.stationIndex = (this.stationIndex + RADIO_STATIONS.length - 1) % RADIO_STATIONS.length;
    this.trackIndex = 0;
    this.trackTimer = 0;
    this.applyStation();
    return this.nowPlaying();
  }

  // Jump straight to a station by id ('sunset', 'neon', 'tide'); unknown
  // ids are ignored so a bad call never kills the radio.
  setStation(id) {
    const index = RADIO_STATIONS.findIndex((s) => s.id === id);
    if (index === -1) return this.nowPlaying();
    this.stationIndex = index;
    this.trackIndex = 0;
    this.trackTimer = 0;
    this.applyStation();
    return this.nowPlaying();
  }

  setOn(on) {
    this.on = on;
    if (this.audio) this.audio.setMusicEnabled(on);
    return this.on;
  }

  toggle() {
    return this.setOn(!this.on);
  }

  nowPlaying() {
    const station = this.station();
    const track = this.track();
    return {
      station: station.name,
      freq: station.freq,
      genre: station.genre,
      title: track.title,
      artist: track.artist,
      on: this.on,
    };
  }

  update(dt) {
    if (!this.on) return;
    this.trackTimer += dt;
    if (this.trackTimer >= this.trackLength) {
      this.trackTimer = 0;
      const station = this.station();
      this.trackIndex = (this.trackIndex + 1) % station.tracks.length;
    }
  }
}
