(() => {
  'use strict';
  const TYPES = {
    circle: { color: 'circle', name: 'Circle', svg: '<circle cx="50" cy="50" r="31" fill="white"/>' },
    diamond: { color: 'diamond', name: 'Diamond', svg: '<path d="M50 14 86 50 50 86 14 50Z" fill="white"/>' },
    star: { color: 'star', name: 'Star', svg: '<path d="m50 10 11.6 25.5 27.8 3.1-20.6 18.9 5.6 27.5L50 71.2 25.6 85l5.6-27.5L10.6 38.6l27.8-3.1Z" fill="white"/>' }
  };
  const LEVELS = [
    ['circle','diamond','circle','star','diamond','star'],
    ['diamond','circle','star','diamond','star','circle','diamond','star','circle']
  ];
  const $ = id => document.getElementById(id);
  const bins = $('bins'), slot = $('objectSlot'), queue = $('queue'), feedback = $('feedback');
  let level = 0, index = 0, selected = false, drag = null, sound = true, audioContext;
  let feedbackTimer;

  const shape = type => `<svg class="shape" viewBox="0 0 100 100" aria-hidden="true">${TYPES[type].svg}</svg>`;
  function playSound(ok) {
    if (!sound) return;
    try {
      audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(ok ? 520 : 220, audioContext.currentTime);
      if (ok) osc.frequency.exponentialRampToValueAtTime(780, audioContext.currentTime + .11);
      gain.gain.setValueAtTime(.07, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .16);
      osc.connect(gain).connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime + .17);
    } catch (_) { /* Sound is optional. */ }
  }
  function announce(message, error = false) {
    clearTimeout(feedbackTimer);feedback.textContent = message;feedback.classList.toggle('error', error);
    if (message) feedbackTimer = setTimeout(() => { feedback.textContent = '';feedback.classList.remove('error'); }, 1500);
  }
  function current() { return LEVELS[level][index]; }
  function update() {
    const items = LEVELS[level], unlocked = level > 0 || index >= 3;
    $('levelLabel').textContent = String(level + 1).padStart(2, '0');
    $('progressText').textContent = `${index} / ${items.length} sorted`;
    $('progressFill').style.width = `${100 * index / items.length}%`;
    const bar = document.querySelector('.progress');bar.setAttribute('aria-valuenow', index);bar.setAttribute('aria-valuemax', items.length);
    $('remaining').textContent = `${items.length - index} LEFT`;
    $('instruction').textContent = level === 0 && index === 0 ? 'Drag the object into the matching bin' : selected ? 'Now tap the matching bin' : 'Match each object to its shape';
    bins.replaceChildren();
    for (const type of Object.keys(TYPES)) {
      if (type === 'star' && !unlocked) continue;
      const b = document.createElement('button');b.type = 'button';b.className = `bin ${TYPES[type].color}`;
      b.dataset.type = type;b.setAttribute('aria-label', `${TYPES[type].name} bin`);
      b.innerHTML = shape(type) + `<span class="bin-label">${TYPES[type].name.toUpperCase()}</span>`;
      b.addEventListener('click', () => { if (selected) attempt(type, b); else announce('Choose an object first'); });
      bins.append(b);
    }
    slot.replaceChildren();queue.replaceChildren();
    if (index < items.length) {
      const type = current(), piece = document.createElement('button');piece.type = 'button';
      piece.className = `piece ${TYPES[type].color}${selected ? ' selected' : ''}`;
      piece.setAttribute('aria-label', `${TYPES[type].name} object. Drag it or select it, then choose a bin.`);
      piece.innerHTML = shape(type);piece.addEventListener('click', () => {
        if (performance.now() - lastDragEnd < 250) return;
        selected = !selected;piece.classList.toggle('selected', selected);
        $('instruction').textContent = selected ? 'Now tap the matching bin' : 'Match each object to its shape';
        if (selected) announce('Tap the matching bin');
      });
      piece.addEventListener('pointerdown', startDrag);slot.append(piece);
      items.slice(index + 1, index + 4).forEach(nextType => {
        const item = document.createElement('div');item.className = `queue-item ${TYPES[nextType].color}`;item.innerHTML = shape(nextType);queue.append(item);
      });
    }
  }
  function attempt(type, bin) {
    selected = false;
    if (type !== current()) {
      announce('Try the matching shape', true);playSound(false);
      bin.classList.add('wrong');setTimeout(() => bin.classList.remove('wrong'), 340);
      const p = slot.querySelector('.piece');if (p) p.classList.remove('selected');return;
    }
    playSound(true);bin.classList.add('correct');index++;
    if (level === 0 && index === 3) announce('New shape unlocked: star!');else announce('Perfect snap!');
    if (index === LEVELS[level].length) {
      update();setTimeout(() => {
        $('resultTitle').textContent = level === 0 ? 'Nicely sorted!' : 'Sorting superstar!';
        $('resultCopy').textContent = `You matched all ${LEVELS[level].length} objects.`;
        $('nextButton').textContent = level === 0 ? 'Next level →' : 'Back to level 1 ↺';
        $('result').classList.remove('hidden');$('nextButton').focus();
        try { localStorage.setItem('sort-snap-unlocked', '1'); } catch (_) {}
      }, 450);
    } else setTimeout(update, 280);
  }
  let lastDragEnd = -Infinity;
  function startDrag(event) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const piece = event.currentTarget;
    drag = { id: event.pointerId, piece, x: event.clientX, y: event.clientY, ghost: null };
    piece.setPointerCapture(event.pointerId);
    piece.addEventListener('pointermove', moveDrag);piece.addEventListener('pointerup', endDrag);
    piece.addEventListener('pointercancel', cancelDrag);
  }
  function moveDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.ghost && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    if (!drag.ghost) {
      drag.ghost = drag.piece.cloneNode(true);drag.ghost.classList.add('drag-ghost');drag.ghost.classList.remove('selected');
      document.body.append(drag.ghost);drag.piece.classList.add('dragging');
    }
    event.preventDefault();drag.ghost.style.left = `${event.clientX}px`;drag.ghost.style.top = `${event.clientY}px`;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.bin');
    bins.querySelectorAll('.bin').forEach(b => b.classList.toggle('target', b === target));
  }
  function cleanDrag() {
    if (!drag) return;
    drag.piece.removeEventListener('pointermove', moveDrag);drag.piece.removeEventListener('pointerup', endDrag);
    drag.piece.removeEventListener('pointercancel', cancelDrag);drag.piece.classList.remove('dragging');
    drag.ghost?.remove();bins.querySelectorAll('.bin').forEach(b => b.classList.remove('target'));drag = null;
  }
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = !!drag.ghost;
    const target = moved ? document.elementFromPoint(event.clientX, event.clientY)?.closest('.bin') : null;
    cleanDrag();
    if (moved) { lastDragEnd = performance.now();if (target && bins.contains(target)) attempt(target.dataset.type, target);else announce('Drop into a bin', true); }
  }
  function cancelDrag() { cleanDrag(); }
  function startLevel(next) {
    level = next;index = 0;selected = false;lastDragEnd = -Infinity;cleanDrag();$('result').classList.add('hidden');announce('');update();
  }
  $('restartButton').addEventListener('click', () => startLevel(level));
  $('againButton').addEventListener('click', () => startLevel(level));
  $('nextButton').addEventListener('click', () => startLevel((level + 1) % LEVELS.length));
  $('soundButton').addEventListener('click', () => { sound = !sound;$('soundButton').textContent = sound ? '♪' : '♪̸';$('soundButton').setAttribute('aria-label', sound ? 'Mute sound' : 'Unmute sound'); });
  startLevel(0);
})();
