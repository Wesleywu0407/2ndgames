/**
 * Deterministic gameplay capture used only by ?promo-video=1.
 * The normal game never imports this module.
 */
export function installPromoRecorder({
  renderer, ctrl, game, GAME, HALL, GROUND_Y, getMode, settings
}) {
  const canvas = renderer.domElement;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const front = HALL.z + HALL.d * 0.5;
  let recording = false;

  const panel = document.createElement('aside');
  panel.id = 'promoRecorderPanel';
  panel.setAttribute('aria-label', 'LinkedIn promo recorder');
  panel.innerHTML = `
    <strong>LINKEDIN PROMO</strong>
    <button type="button" data-promo-record>RECORD 90S DEMO</button>
    <span data-promo-status>Start Story mode first</span>`;
  Object.assign(panel.style, {
    position: 'fixed',
    right: '18px',
    top: '18px',
    zIndex: '80',
    display: 'grid',
    gap: '8px',
    width: '210px',
    padding: '12px',
    color: '#f2dfbd',
    background: 'rgba(8, 7, 14, .9)',
    border: '1px solid rgba(232, 176, 106, .55)',
    borderRadius: '12px',
    font: '600 12px/1.35 system-ui, sans-serif',
    letterSpacing: '.08em'
  });
  const button = panel.querySelector('[data-promo-record]');
  const status = panel.querySelector('[data-promo-status]');
  Object.assign(button.style, {
    padding: '10px',
    color: '#fff4dd',
    background: '#34243f',
    border: '1px solid #b79358',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '800'
  });
  Object.assign(status.style, {
    color: '#c9bca8',
    fontSize: '10px',
    letterSpacing: '.02em'
  });
  document.body.appendChild(panel);

  const setStatus = value => {
    status.textContent = value;
    canvas.dataset.promoStatus = value;
  };
  const mark = value => {
    setStatus(value);
    console.info(`[Sky Promo] ${value}`);
  };
  const setGround = (x, z, yaw = 0, pitch = 0.08) => {
    ctrl.setPositionForQA(x, GROUND_Y, z);
    ctrl.setViewForQA(yaw, pitch);
  };
  const setFlying = (x, y, z, yaw = 0, pitch = 0.08) => {
    ctrl.setFlyingPositionForQA(x, y, z);
    ctrl.setViewForQA(yaw, pitch);
  };
  const keyEvent = (type, code, key) => {
    document.dispatchEvent(new KeyboardEvent(type, {
      code, key, bubbles: true, cancelable: true
    }));
  };
  const hold = async (code, key, duration) => {
    keyEvent('keydown', code, key);
    await wait(duration);
    keyEvent('keyup', code, key);
    await wait(220);
  };
  const pan = async (fromYaw, toYaw, duration, pitch = 0.08) => {
    const started = performance.now();
    while (performance.now() - started < duration) {
      const progress = Math.min(1, (performance.now() - started) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      ctrl.setViewForQA(lerp(fromYaw, toYaw, eased), pitch);
      await wait(33);
    }
    ctrl.setViewForQA(toYaw, pitch);
  };
  const castSequence = async (weapon, count, spacing) => {
    game.setWeapon(weapon);
    await wait(350);
    for (let index = 0; index < count; index++) {
      game.cast();
      await wait(spacing);
    }
  };

  async function runRoute() {
    GAME.flightUnlocked = true;

    // 0–10s · establish the academy and Great Hall exterior.
    mark('01 / 06 · Great Hall exterior');
    setGround(8, front + 20, 0.27, 0.08);
    await pan(0.27, 0.08, 4500, 0.06);
    await wait(1800);

    // 10–22s · walk the repaired entrance, stairs, threshold, and carpet.
    mark('02 / 06 · Walking the repaired entrance');
    setGround(0, front + 10.5, 0, 0.07);
    await wait(900);
    await hold('KeyW', 'w', 5100);
    await wait(1900);
    setGround(0, front - 2.4, 0, 0.05);
    await hold('KeyW', 'w', 1900);
    await wait(1700);

    // 22–36s · reveal the Great Hall interior with a deliberate camera sweep.
    mark('03 / 06 · Great Hall interior');
    setGround(0, HALL.z + 0.8, 0, 0.02);
    await pan(-0.72, 0.72, 7200, 0.03);
    await pan(0.72, 0, 1700, 0.03);
    await wait(1100);

    // 36–56s · take flight over the campus and pass the surrounding buildings.
    mark('04 / 06 · Campus flight');
    setFlying(0, 15.5, front - 3, Math.PI, -0.04);
    await wait(1200);
    await hold('KeyW', 'w', 7900);
    await pan(Math.PI, Math.PI + 0.62, 3600, -0.08);
    await hold('KeyW', 'w', 4100);
    await pan(Math.PI + 0.62, Math.PI + 0.05, 2600, -0.03);
    await wait(1100);

    // 56–71s · grounded combat using two distinct weapons and the signature.
    mark('05 / 06 · Kael Morrow enters');
    settings.setCharacter('resident-20', '#c96f3b');
    await wait(2800);
    mark('05 / 06 · Kael fights the Unlight');
    game.startEnemyCombatProbe({ type: 'stray', airborne: false });
    ctrl.setViewForQA(0, 0.01);
    await wait(1300);
    await castSequence(1, 5, 920);
    await castSequence(2, 4, 1180);
    game.activateSignature();
    await wait(1100);
    await castSequence(1, 3, 900);
    await wait(900);

    // 71–82s · airborne boss encounter, then a final academy hero shot.
    mark('06 / 06 · Aerial boss encounter');
    game.stopEnemyCombatProbe();
    game.startEnemyCombatProbe({ type: 'groundskeeper', airborne: true });
    ctrl.setViewForQA(0, -0.03);
    await wait(900);
    await castSequence(2, 3, 1160);
    await castSequence(1, 4, 900);
    game.stopEnemyCombatProbe();
    setFlying(0, 17, front + 25, 0, -0.12);
    await pan(-0.28, 0.28, 3200, -0.1);
    await wait(400);
  }

  async function recordPromo() {
    if (recording) return;
    if (getMode() !== 'story') {
      setStatus('Choose Story and start the session first');
      return;
    }
    if (!canvas.captureStream || !window.MediaRecorder) {
      setStatus('This browser cannot record the game canvas');
      return;
    }

    recording = true;
    button.disabled = true;
    setStatus('Loading Aldous Crane · The Chancellor');
    settings.setCharacter('resident-19', '#b79358');
    await wait(5200);
    const mimeType = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ].find(type => MediaRecorder.isTypeSupported(type)) || '';
    const stream = canvas.captureStream(30);
    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 10_000_000
    });
    recorder.addEventListener('dataavailable', event => {
      if (event.data?.size) chunks.push(event.data);
    });
    const stopped = new Promise(resolve => recorder.addEventListener('stop', resolve, { once: true }));

    try {
      recorder.start(1000);
      canvas.dataset.promoRecording = 'true';
      await runRoute();
      recorder.stop();
      await stopped;
      const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
      mark(`Uploading ${(blob.size / 1024 / 1024).toFixed(1)} MB capture`);
      const response = await fetch('/api/promo-recording', {
        method: 'POST',
        headers: { 'Content-Type': blob.type },
        body: blob
      });
      if (!response.ok) throw new Error(`upload failed (${response.status})`);
      const result = await response.json();
      canvas.dataset.promoRecording = 'complete';
      canvas.dataset.promoResult = JSON.stringify(result);
      mark(`Complete · ${result.file}`);
    } catch (error) {
      canvas.dataset.promoRecording = 'error';
      setStatus(`Recording failed · ${error.message}`);
      console.error('[Sky Promo] recording failed', error);
      if (recorder.state !== 'inactive') recorder.stop();
    } finally {
      for (const track of stream.getTracks()) track.stop();
      recording = false;
      button.disabled = false;
    }
  }

  button.addEventListener('click', recordPromo);
}
