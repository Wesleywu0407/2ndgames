const DEFAULTS = Object.freeze({
  language: 'en', difficulty: 'normal', volume: 90, muted: false,
  quality: 'balanced', brightness: 100, uiScale: 1.15, highContrast: false,
  subtitleSize: 1.15, speakerLabels: true, subtitleBackground: 85,
  reducedSmoke: false, reducedFlash: false, reducedBloom: false,
  sensitivity: 100, flightSensitivity: 90, invertY: false, cameraShake: true,
  playerName: '', characterId: 'resident-01', cloakColor: '#e8b06a'
});

const byId = id => document.getElementById(id);
const validColour = value => /^#[0-9a-fA-F]{6}$/.test(value || '');

export function createSettingsController({
  renderer, composer, bloom, audio, multiplayer, playerPrefs, playerCharacterIds,
  storageKey, applyDocumentLanguage, setLanguage, setSteeringBlocked,
  getSky = () => window.__sky
}) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) { /* private mode */ }
  const prefs = { ...DEFAULTS, ...saved };
  prefs.language = prefs.language === 'zh-Hant' ? 'zh-Hant' : 'en';

  const panel = byId('settingsPanel');
  const controls = {
    button: byId('settingsBtn'), language: byId('settingLanguage'), difficulty: byId('settingDifficulty'),
    volume: byId('settingVolume'), muted: byId('settingMuted'), quality: byId('settingQuality'),
    uiScale: byId('settingUiScale'), highContrast: byId('settingHighContrast'),
    subtitleSize: byId('settingSubtitleSize'), speakerLabels: byId('settingSpeakerLabels'),
    subtitleBackground: byId('settingSubtitleBackground'), brightness: byId('settingBrightness'),
    reducedSmoke: byId('settingReducedSmoke'), reducedFlash: byId('settingReducedFlash'),
    reducedBloom: byId('settingReducedBloom'), sensitivity: byId('settingSensitivity'),
    flightSensitivity: byId('settingFlightSensitivity'), invertY: byId('settingInvertY'),
    shake: byId('settingShake'), playerName: byId('settingPlayerName'),
    character: byId('settingCharacter'), cloak: byId('settingCloak'), mainMenu: byId('settingsMainMenu')
  };
  const outputs = Object.fromEntries(['Volume', 'SubtitleBackground', 'Brightness', 'Sensitivity', 'FlightSensitivity']
    .map(name => [name[0].toLowerCase() + name.slice(1), panel.querySelector(`output[for="setting${name}"]`)]));

  // Settings tabs. Splits what used to be one 21-row scroll into short panes.
  const tabs = [...panel.querySelectorAll('[data-settings-tab]')];
  const panes = [...panel.querySelectorAll('[data-settings-pane]')];
  const selectTab = name => {
    for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.settingsTab === name));
    for (const pane of panes) pane.hidden = pane.dataset.settingsPane !== name;
  };
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => selectTab(tab.dataset.settingsTab));
    // Left/right arrows move between tabs, per the WAI-ARIA tabs pattern.
    tab.addEventListener('keydown', event => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      selectTab(next.dataset.settingsTab);
      next.focus();
    });
  }

  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch (_) { /* private mode */ }
  };
  const ensureCloakOption = value => {
    if ([...controls.cloak.options].some(option => option.value.toLowerCase() === value.toLowerCase())) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = prefs.language === 'zh-Hant' ? `自訂 ${value}` : `Custom ${value}`;
    controls.cloak.appendChild(option);
  };
  const applyQuality = value => {
    prefs.quality = ['high', 'balanced', 'performance'].includes(value) ? value : DEFAULTS.quality;
    const cap = prefs.quality === 'high' ? 2 : prefs.quality === 'balanced' ? 1.5 : 1;
    const ratio = Math.min(window.devicePixelRatio || 1, cap);
    renderer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setPixelRatio?.(ratio);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloom.enabled = prefs.quality === 'high' && !prefs.reducedBloom;
  };
  const applyInterface = () => {
    prefs.uiScale = [1, 1.15, 1.3, 1.5].includes(Number(prefs.uiScale)) ? Number(prefs.uiScale) : DEFAULTS.uiScale;
    prefs.subtitleSize = [1, 1.15, 1.3].includes(Number(prefs.subtitleSize)) ? Number(prefs.subtitleSize) : DEFAULTS.subtitleSize;
    prefs.subtitleBackground = Math.max(60, Math.min(100, Number(prefs.subtitleBackground) || DEFAULTS.subtitleBackground));
    document.documentElement.style.setProperty('--sky-ui-scale', String(prefs.uiScale));
    document.documentElement.style.setProperty('--sky-subtitle-scale', String(prefs.subtitleSize));
    document.documentElement.style.setProperty('--sky-subtitle-bg', String(prefs.subtitleBackground / 100));
    document.body.classList.toggle('high-contrast-hud', !!prefs.highContrast);
    document.body.classList.toggle('hide-speaker-labels', !prefs.speakerLabels);
    document.body.classList.toggle('reduced-bloom', !!prefs.reducedBloom);
    bloom.enabled = prefs.quality === 'high' && !prefs.reducedBloom;
  };
  const sync = () => {
    const { volume: storedVolume, muted: storedMuted } = prefs;
    prefs.difficulty = ['story', 'normal', 'warden'].includes(prefs.difficulty) ? prefs.difficulty : DEFAULTS.difficulty;
    prefs.cloakColor = validColour(prefs.cloakColor) ? prefs.cloakColor : DEFAULTS.cloakColor;
    Object.assign(controls.language, { value: prefs.language });
    Object.assign(controls.difficulty, { value: prefs.difficulty });
    Object.assign(controls.volume, { value: storedVolume }); outputs.volume.value = `${storedVolume}%`;
    controls.muted.checked = storedMuted;
    controls.quality.value = prefs.quality;
    controls.uiScale.value = String(prefs.uiScale); controls.highContrast.checked = !!prefs.highContrast;
    controls.subtitleSize.value = String(prefs.subtitleSize); controls.speakerLabels.checked = prefs.speakerLabels !== false;
    controls.subtitleBackground.value = prefs.subtitleBackground; outputs.subtitleBackground.value = `${prefs.subtitleBackground}%`;
    controls.brightness.value = prefs.brightness; outputs.brightness.value = `${prefs.brightness}%`;
    controls.reducedSmoke.checked = prefs.reducedSmoke; controls.reducedFlash.checked = prefs.reducedFlash;
    controls.reducedBloom.checked = prefs.reducedBloom;
    controls.sensitivity.value = prefs.sensitivity; outputs.sensitivity.value = `${prefs.sensitivity}%`;
    controls.flightSensitivity.value = prefs.flightSensitivity; outputs.flightSensitivity.value = `${prefs.flightSensitivity}%`;
    controls.invertY.checked = prefs.invertY; controls.shake.checked = prefs.cameraShake;
    controls.playerName.value = prefs.playerName; controls.character.value = prefs.characterId;
    ensureCloakOption(prefs.cloakColor); controls.cloak.value = prefs.cloakColor;
    Object.assign(playerPrefs, {
      lookSensitivity: prefs.sensitivity / 100,
      groundLookSensitivity: prefs.sensitivity / 100,
      flightLookSensitivity: prefs.flightSensitivity / 100,
      invertY: prefs.invertY,
      cameraShake: prefs.cameraShake
    });
    audio.setMuted(storedMuted); audio.setVolume(storedVolume / 100);
    applyQuality(prefs.quality); applyInterface();
    renderer.toneMappingExposure = 1.24 * (prefs.brightness / 100);
  };
  const setOpen = open => {
    setSteeringBlocked(open);
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    controls.button.setAttribute('aria-expanded', String(open));
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock();
      panel.querySelector('.settings-close').focus();
    } else {
      controls.button.focus();
      const ctrl = getSky()?.ctrl;
      if (ctrl && (ctrl.state === 'ground' || ctrl.state === 'flying')) ctrl.lockPointer();
    }
  };

  controls.button.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  panel.addEventListener('click', event => { if (event.target.closest('[data-close-settings]')) setOpen(false); });
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && panel.classList.contains('open')) { event.preventDefault(); setOpen(false); }
  });
  controls.language.addEventListener('change', () => {
    prefs.language = controls.language.value === 'zh-Hant' ? 'zh-Hant' : 'en';
    setLanguage(prefs.language); persist(); applyDocumentLanguage();
    window.dispatchEvent(new CustomEvent('sky-language-change'));
  });
  controls.difficulty.addEventListener('change', () => {
    prefs.difficulty = ['story', 'normal', 'warden'].includes(controls.difficulty.value) ? controls.difficulty.value : DEFAULTS.difficulty;
    persist(); window.dispatchEvent(new CustomEvent('sky-difficulty-change', { detail: { difficulty: prefs.difficulty } }));
  });
  controls.volume.addEventListener('input', () => {
    prefs.volume = Number(controls.volume.value); outputs.volume.value = `${prefs.volume}%`;
    audio.setVolume(prefs.volume / 100); persist();
  });
  controls.muted.addEventListener('change', () => { prefs.muted = controls.muted.checked; audio.setMuted(prefs.muted); persist(); });
  controls.quality.addEventListener('change', () => { applyQuality(controls.quality.value); persist(); });
  controls.uiScale.addEventListener('change', () => { prefs.uiScale = Number(controls.uiScale.value); applyInterface(); persist(); });
  controls.highContrast.addEventListener('change', () => { prefs.highContrast = controls.highContrast.checked; applyInterface(); persist(); });
  controls.subtitleSize.addEventListener('change', () => { prefs.subtitleSize = Number(controls.subtitleSize.value); applyInterface(); persist(); });
  controls.speakerLabels.addEventListener('change', () => { prefs.speakerLabels = controls.speakerLabels.checked; applyInterface(); persist(); });
  controls.subtitleBackground.addEventListener('input', () => {
    prefs.subtitleBackground = Number(controls.subtitleBackground.value); outputs.subtitleBackground.value = `${prefs.subtitleBackground}%`;
    applyInterface(); persist();
  });
  controls.brightness.addEventListener('input', () => {
    prefs.brightness = Number(controls.brightness.value); outputs.brightness.value = `${prefs.brightness}%`;
    renderer.toneMappingExposure = 1.24 * (prefs.brightness / 100); persist();
  });
  for (const [control, pref] of [[controls.reducedSmoke, 'reducedSmoke'], [controls.reducedFlash, 'reducedFlash']]) {
    control.addEventListener('change', () => { prefs[pref] = control.checked; persist(); });
  }
  controls.reducedBloom.addEventListener('change', () => { prefs.reducedBloom = controls.reducedBloom.checked; applyInterface(); persist(); });
  controls.sensitivity.addEventListener('input', () => {
    prefs.sensitivity = Number(controls.sensitivity.value); outputs.sensitivity.value = `${prefs.sensitivity}%`;
    playerPrefs.lookSensitivity = playerPrefs.groundLookSensitivity = prefs.sensitivity / 100; persist();
  });
  controls.flightSensitivity.addEventListener('input', () => {
    prefs.flightSensitivity = Number(controls.flightSensitivity.value); outputs.flightSensitivity.value = `${prefs.flightSensitivity}%`;
    playerPrefs.flightLookSensitivity = prefs.flightSensitivity / 100; persist();
  });
  controls.invertY.addEventListener('change', () => { prefs.invertY = controls.invertY.checked; playerPrefs.invertY = prefs.invertY; persist(); });
  controls.shake.addEventListener('change', () => { prefs.cameraShake = controls.shake.checked; playerPrefs.cameraShake = prefs.cameraShake; persist(); });
  controls.playerName.addEventListener('change', () => {
    prefs.playerName = controls.playerName.value.trim().slice(0, 24); persist(); multiplayer.refreshIdentity();
  });
  const updateCharacter = () => {
    getSky()?.avatar?.setCharacter(prefs.characterId, prefs.cloakColor);
    getSky()?.game?.refreshWeapon?.();
    multiplayer.refreshIdentity();
  };
  controls.character.addEventListener('change', () => { prefs.characterId = controls.character.value; persist(); updateCharacter(); });
  controls.cloak.addEventListener('change', () => { prefs.cloakColor = controls.cloak.value; persist(); updateCharacter(); });
  window.addEventListener('sky-audio-change', event => {
    prefs.muted = event.detail.muted; prefs.volume = Math.round(event.detail.volume * 100);
    controls.muted.checked = prefs.muted; controls.volume.value = prefs.volume; outputs.volume.value = `${prefs.volume}%`; persist();
  });
  controls.mainMenu.addEventListener('click', () => window.location.reload());

  sync();
  return {
    open: () => setOpen(true), close: () => setOpen(false), prefs, applyQuality,
    setCharacter(id, color = prefs.cloakColor) {
      prefs.characterId = playerCharacterIds.includes(id) ? id : playerCharacterIds[0];
      prefs.cloakColor = validColour(color) ? color : DEFAULTS.cloakColor;
      controls.character.value = prefs.characterId; ensureCloakOption(prefs.cloakColor); controls.cloak.value = prefs.cloakColor;
      persist(); updateCharacter();
    }
  };
}
