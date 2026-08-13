function safe(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

export function createCoopStoryUI({ multiplayer, tr, isStoryActive, onEnterStory, onBack, onOfflineVote,
  onOfflineGardenVote, onModalChange = () => {} }) {
  const lobby = document.getElementById('storyLobby');
  const slots = lobby?.querySelector('.story-party-slots');
  const readyButton = document.getElementById('storyLobbyReady');
  const startButton = document.getElementById('storyLobbyStart');
  const backButton = document.getElementById('storyLobbyBack');
  const hint = lobby?.querySelector('.story-lobby-hint');
  const clueBoard = document.getElementById('clueBoard');
  const voteStatus = clueBoard?.querySelector('.clue-vote-status');
  const gardenChoice = document.getElementById('gardenChoice');
  const gardenVoteStatus = gardenChoice?.querySelector('.garden-vote-status');
  const pingWheel = document.getElementById('pingWheel');
  const dimmed = document.getElementById('dimmedOverlay');
  let active = false;
  let latest = null;
  let pingOpen = false;
  let offlineClueBoard = false;
  let offlineGardenChoice = false;
  let pendingClueVote = null;
  let pendingGardenVote = null;
  let allowOfflineSolo = true;

  function setLobby(open) {
    active = open;
    lobby?.classList.toggle('on', open);
    lobby?.setAttribute('aria-hidden', open ? 'false' : 'true');
    onModalChange(open || clueBoard?.classList.contains('on') || gardenChoice?.classList.contains('on'));
    if (open) requestAnimationFrame(() => readyButton?.focus());
  }

  function render(snapshot = latest) {
    latest = snapshot || latest;
    const connected = multiplayer.connected;
    const party = Array.isArray(latest?.party) ? latest.party : [];
    const self = party.find(member => member.id === multiplayer.selfId);
    const host = self?.host;
    const allReady = party.length > 0 && party.every(member => member.ready);
    const cards = party.slice(0, 4).map(member => `
      <div class="story-party-slot ${member.ready ? 'ready' : ''}">
        <i class="ready-ring" aria-hidden="true"></i>
        <span>${safe(member.name)}${member.id === multiplayer.selfId ? ` <small>${tr('YOU', '你')}</small>` : ''}</span>
        <small>${member.host ? tr('HOST', '隊長') : member.dimmed ? tr('DIMMED', '黯淡') : member.ready ? tr('READY', '準備') : tr('WAITING', '等待')}</small>
      </div>`).join('');
    const empties = Array.from({ length: Math.max(0, 4 - party.length) }, () => `
      <div class="story-party-slot empty"><i class="ready-ring"></i><span>${tr('Open lantern slot', '空的提燈位置')}</span><small>LAN</small></div>`).join('');
    if (slots) slots.innerHTML = cards + empties;

    if (readyButton) {
      readyButton.textContent = !connected && !allowOfflineSolo ? tr('MULTIPLAYER OFFLINE', '多人連線未啟用')
        : !connected ? tr('START SOLO', '開始單人故事')
        : self?.ready ? tr('NOT READY', '取消準備') : tr('READY', '準備');
      readyButton.disabled = (!connected && !allowOfflineSolo) || (connected && !self);
    }
    if (startButton) {
      startButton.hidden = !connected || !host;
      startButton.disabled = !allReady;
    }
    if (hint) hint.textContent = !connected && !allowOfflineSolo
      ? tr('Multiplayer requires the Living World server. Start it, then return and try again.', '多人遊戲需要啟動 Living World 伺服器。啟動後請返回再試一次。')
      : !connected ? tr('LAN unavailable · Start Solo, or Back to retry the party connection.', '區網未連線 · 可開始單人故事，或返回後重試隊伍連線。')
      : host
        ? allReady ? tr('Every lantern is ready.', '所有提燈者都準備好了。') : tr('Waiting for every lantern to ready · Back leaves the party.', '等待所有提燈者準備 · 返回可離開隊伍。')
        : tr('Ready up; the host will begin · Back leaves the party.', '準備後由隊長開始 · 返回可離開隊伍。');

    if (latest?.started && active) { setLobby(false); onEnterStory(); }
    updateClueBoard(latest);
    updateGardenChoice(latest);
  }

  function openLobby(options = {}) {
    allowOfflineSolo = options.allowOfflineSolo !== false;
    setLobby(true);
    multiplayer.joinStory();
    render(multiplayer.storySnapshot);
  }
  function closeLobby() { setLobby(false); }

  function updateClueBoard(snapshot) {
    if (!clueBoard || offlineClueBoard) return;
    const open = Boolean(snapshot?.started && snapshot?.phase === 5 && !snapshot?.choice);
    clueBoard.classList.toggle('on', open);
    clueBoard.setAttribute('aria-hidden', open ? 'false' : 'true');
    onModalChange(open || active || gardenChoice?.classList.contains('on'));
    if (!open) return;
    requestAnimationFrame(() => clueBoard.querySelector('[data-story-vote]:not([disabled])')?.focus());
    const self = snapshot.party?.find(member => member.id === multiplayer.selfId);
    for (const button of clueBoard.querySelectorAll('[data-story-vote]')) {
      button.disabled = Boolean(self?.voted);
      button.classList.toggle('voted', Boolean(self?.voted && button.dataset.storyVote === pendingClueVote));
    }
    if (voteStatus) voteStatus.textContent = tr(
      `${snapshot.votesCast || 0} / ${snapshot.partySize || 1} lanterns have remembered`,
      `${snapshot.votesCast || 0} / ${snapshot.partySize || 1} 位提燈者已做出選擇`
    );
  }

  function openOfflineClueBoard() {
    offlineClueBoard = true;
    clueBoard?.classList.add('on');
    clueBoard?.setAttribute('aria-hidden', 'false');
    onModalChange(true);
    if (voteStatus) voteStatus.textContent = tr('Choose what your lantern believes.', '選擇你的提燈所相信的真相。');
  }
  function closeClueBoard() {
    offlineClueBoard = false;
    clueBoard?.classList.remove('on');
    clueBoard?.setAttribute('aria-hidden', 'true');
    onModalChange(active || gardenChoice?.classList.contains('on'));
  }

  function updateGardenChoice(snapshot) {
    if (!gardenChoice || offlineGardenChoice) return;
    const open = Boolean(snapshot?.started && snapshot?.phase === 9 && !snapshot?.gardenOutcome);
    gardenChoice.classList.toggle('on', open);
    gardenChoice.setAttribute('aria-hidden', open ? 'false' : 'true');
    onModalChange(open || active || clueBoard?.classList.contains('on'));
    if (!open) return;
    requestAnimationFrame(() => gardenChoice.querySelector('[data-garden-vote]:not([disabled])')?.focus());
    const self = snapshot.party?.find(member => member.id === multiplayer.selfId);
    for (const button of gardenChoice.querySelectorAll('[data-garden-vote]')) {
      button.disabled = Boolean(self?.voted);
      button.classList.toggle('voted', Boolean(self?.voted && button.dataset.gardenVote === pendingGardenVote));
    }
    if (gardenVoteStatus) gardenVoteStatus.textContent = tr(
      `${snapshot.gardenVotesCast || 0} / ${snapshot.partySize || 1} lanterns have chosen`,
      `${snapshot.gardenVotesCast || 0} / ${snapshot.partySize || 1} 位提燈者已做出選擇`
    );
  }

  function openOfflineGardenChoice() {
    offlineGardenChoice = true;
    gardenChoice?.classList.add('on');
    gardenChoice?.setAttribute('aria-hidden', 'false');
    onModalChange(true);
    if (gardenVoteStatus) gardenVoteStatus.textContent = tr('Choose what your lantern will carry forward.', '選擇你的提燈將帶著什麼繼續前行。');
  }
  function closeGardenChoice() {
    offlineGardenChoice = false;
    gardenChoice?.classList.remove('on');
    gardenChoice?.setAttribute('aria-hidden', 'true');
    onModalChange(active || clueBoard?.classList.contains('on'));
  }

  function setPingWheel(open) {
    pingOpen = open;
    pingWheel?.classList.toggle('on', open);
    pingWheel?.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  function choosePing(kind) {
    if (!isStoryActive() || !multiplayer.connected) return;
    multiplayer.storyPing(kind); setPingWheel(false);
  }
  function setDimmed(value) {
    dimmed?.classList.toggle('on', Boolean(value));
    dimmed?.setAttribute('aria-hidden', value ? 'false' : 'true');
  }

  readyButton?.addEventListener('click', () => {
    if (!multiplayer.connected) {
      if (allowOfflineSolo) { setLobby(false); onEnterStory(); }
      return;
    }
    const self = latest?.party?.find(member => member.id === multiplayer.selfId);
    multiplayer.setStoryReady(!self?.ready);
  });
  startButton?.addEventListener('click', () => multiplayer.startStorySession());
  backButton?.addEventListener('click', () => { multiplayer.leaveStory(); setLobby(false); onBack(); });
  for (const button of clueBoard?.querySelectorAll('[data-story-vote]') || []) {
    button.addEventListener('click', () => {
      const choice = button.dataset.storyVote;
      pendingClueVote = choice;
      if (multiplayer.connected) multiplayer.storyVote(choice);
      else { closeClueBoard(); onOfflineVote(choice); }
    });
  }
  for (const button of gardenChoice?.querySelectorAll('[data-garden-vote]') || []) {
    button.addEventListener('click', () => {
      const choice = button.dataset.gardenVote;
      pendingGardenVote = choice;
      if (multiplayer.connected) multiplayer.storyGardenVote(choice);
      else { closeGardenChoice(); onOfflineGardenVote?.(choice); }
    });
  }
  for (const button of pingWheel?.querySelectorAll('[data-story-ping]') || []) {
    button.addEventListener('click', () => choosePing(button.dataset.storyPing));
  }
  document.getElementById('touchPing')?.addEventListener('pointerdown', event => {
    event.preventDefault(); event.stopPropagation(); setPingWheel(!pingOpen);
  });
  window.addEventListener('keydown', event => {
    if (!isStoryActive() || event.repeat) return;
    if (event.code === 'KeyG') { event.preventDefault(); setPingWheel(!pingOpen); return; }
    if (!pingOpen) return;
    const kind = { Digit1: 'look', Digit2: 'danger', Digit3: 'help', Digit4: 'wait', Digit5: 'ready' }[event.code];
    if (kind) { event.preventDefault(); event.stopImmediatePropagation(); choosePing(kind); }
    else if (event.code === 'Escape') setPingWheel(false);
  });
  window.addEventListener('sky-story-snapshot', event => render(event.detail));
  window.addEventListener('sky-mp-roster', () => { if (active) render(multiplayer.storySnapshot); });
  window.addEventListener('sky-language-change', () => render(latest));

  return { openLobby, closeLobby, render, openOfflineClueBoard, closeClueBoard,
    openOfflineGardenChoice, closeGardenChoice, updateGardenChoice, setDimmed,
    togglePingWheel: () => setPingWheel(!pingOpen), get active() { return active; } };
}
