// Save and load: the player's cash, story progress, collectibles and
// position live in localStorage so a session can continue later.
const SAVE_KEY = 'solmar-city-save-v1';
export const SAVE_VERSION = 1;

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    // A save from another version of the game is not ours to trust: start
    // fresh instead of loading fields that mean something else now.
    if (data.version !== SAVE_VERSION) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    /* storage unavailable */
  }
}

export function buildSaveData(game) {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    cash: Math.floor(game.player.cash),
    health: Math.round(game.player.health),
    armor: Math.round(game.player.armor),
    weapon: game.player.weapon,
    // Every weapon the player owns, not just the one in hand: the old save
    // kept only the current weapon, so a bought SMG or rifle vanished on
    // Continue and had to be bought again.
    ownedWeapons: [...game.ownedWeapons],
    missionIndex: game.missions.missionIndex,
    storyComplete: game.missions.storyComplete,
    playerX: game.player.x,
    playerZ: game.player.z,
    collectiblesTaken: [...game.collectiblesTaken],
    playTimeSeconds: Math.round(game.playTimeSeconds),
    // The radio station is part of the session: Continue comes back on the
    // station the player was listening to instead of SOLMAR FM by default.
    stationIndex: game.radio.stationIndex,
  };
}
