// js/script.js
(() => {
  'use strict';

  // -----------------------------
  // Elementreferenser
  // -----------------------------
  const app     = document.getElementById('app');       // Container för dynamiskt innehåll
  const timerEl = document.getElementById('timer');    // Visar timern
  const progEl  = document.getElementById('progress'); // Visar "Gåta X av Y" eller sidtitel
  const navBtns = {                                    // Botten‐navigering
    play: document.getElementById('nav-play'),
    var:  document.getElementById('nav-var'),
    kamp: document.getElementById('nav-kamp'),
    help: document.getElementById('nav-help')
  };
  const sounds  = {                                    // Rätt/fel/finish-ljud
    correct: document.getElementById('audio-correct'),
    wrong:   document.getElementById('audio-wrong'),
    finish:  document.getElementById('audio-finish')
  };

  // -----------------------------
  // Globalt state + localStorage-nycklar
  // -----------------------------
  let puzzles     = [];
  let staticPages = {};
  let validNames  = [];
  let current     = 0;
  let startTime   = 0;
  let timerId     = null;
  let puzzleAudio = null;
  let failCount   = 0;
  let started     = false;

  const LS_STARTED    = 'varkamp_started';
  const LS_START_TIME = 'varkamp_startTime';
  const LS_CURRENT    = 'varkamp_current';

  // -----------------------------
  // Hjälpfunktioner
  // -----------------------------
  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) return false;
    }
    return true;
  }

  function vibrate(pattern) {
    navigator.vibrate?.(pattern);
  }

  function play(type) {
    const a = sounds[type];
    if (a) { a.currentTime = 0; a.play().catch(() => {}); }
    if (type === 'correct') vibrate(200);
    if (type === 'wrong')   vibrate([100,50,100]);
  }

  function showError(el, msg) {
    el.textContent = msg;
  }

  function clearAnim(card) {
    card.classList.remove('correct','shake');
  }

  function updateTimer() {
    const elapsed = Date.now() - startTime;
    const mm = String(Math.floor(elapsed / 60000)).padStart(2,'0');
    const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2,'0');
    timerEl.textContent = `${mm}:${ss}`;
  }

  // -----------------------------
  // Init: ladda JSON, preload, bind nav, återuppta eller intro
  // -----------------------------
  async function init() {
    // Hämta gåtor och statiska sidor
    const res  = await fetch('assets/data/puzzles.json');
    const data = await res.json();
    puzzles     = data.puzzles;
    staticPages = data.staticPages;
    validNames  = data.validNames;

    // Preload ljud + stego-bild
    Object.values(sounds).forEach(a => a.load());
    const steg = puzzles.find(p => p.type === 'stego');
    if (steg) new Image().src = steg.img;

    // Bind navigationsknappar
    Object.keys(navBtns).forEach(key => {
      navBtns[key].addEventListener('click', () => activateTab(key));
    });

    // Återuppta om startat tidigare
    if (localStorage.getItem(LS_STARTED) === '1') {
      started   = true;
      startTime = parseInt(localStorage.getItem(LS_START_TIME), 10) || Date.now();
      current   = parseInt(localStorage.getItem(LS_CURRENT), 10) || 0;
      setNavEnabled(true);
      updateTimer();
      timerId = setInterval(updateTimer, 500);
      activateTab('play');
      renderPuzzle(current);
    } else {
      // Visa intro
      setNavEnabled(false);
      activateTab('play');
    }
  }

  // -----------------------------
  // Lås/lås upp Vår/Kamp/Hjälp-flikar
  // -----------------------------
  function setNavEnabled(enabled) {
    ['var','kamp','help'].forEach(key => {
      navBtns[key].disabled = !enabled;
      navBtns[key].classList.toggle('disabled', !enabled);
    });
  }

  // -----------------------------
  // Växla flik – timern fortsätter alltid
  // -----------------------------
  function activateTab(tab) {
    Object.values(navBtns).forEach(b => b.classList.remove('active'));
    navBtns[tab].classList.add('active');
    // Ingen clearInterval här!

    if (tab === 'play') {
      if (!started) showIntro();
      else renderPuzzle(current);
    } else {
      showStatic(tab);
    }
  }

  // -----------------------------
  // Intro-vy med icon-512.png och startknapp
  // -----------------------------
  function showIntro() {
    progEl.textContent = '';
    app.innerHTML = `
      <div class="card start-card">
        <img src="assets/icons/icon-512.png" class="start-icon" alt="VÅRKAMP⁵-logo">
        <p class="prompt">Välkommen till tävlingens första gren!</p>
        <button id="startBtn" class="start-btn">Starta tävlingen</button>
      </div>`;
    document.getElementById('startBtn').addEventListener('click', () => {
      // Spara state
      started = true;
      localStorage.setItem(LS_STARTED, '1');
      startTime = Date.now();
      localStorage.setItem(LS_START_TIME, String(startTime));
      current = 0;
      localStorage.setItem(LS_CURRENT, '0');

      setNavEnabled(true);
      updateTimer();
      timerId = setInterval(updateTimer, 500);
      renderPuzzle(0);
    });
  }

  // -----------------------------
  // Statiska flikar (Vår/Kamp/Hjälp)
  // -----------------------------
  function showStatic(key) {
    progEl.textContent = staticPages[key].title;
    const d = staticPages[key];
    app.innerHTML = `
      <div class="card">
        <img src="${d.icon}" class="static-icon" alt="${d.title}">
        <h2>${d.title}</h2>
        <p class="static-text">${d.text.replace(/\n/g,'<br>')}</p>
        ${d.thumb ? `<img src="${d.thumb}" id="static-thumb" class="static-thumb" alt="Thumbnail">` : ''}
      </div>`;
    // Bildmodal för Vår
    if (key === 'var' && d.thumb) {
      const thumb    = document.getElementById('static-thumb');
      const modal    = document.getElementById('img-modal');
      const modalImg = document.getElementById('modal-img');
      const closeBtn = document.getElementById('modal-close');
      thumb.addEventListener('click', () => {
        modalImg.src = d.full;
        modal.classList.remove('hidden');
      });
      closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modalImg.src = '';
      });
      modal.addEventListener('click', e => {
        if (e.target === modal) {
          modal.classList.add('hidden');
          modalImg.src = '';
        }
      });
    }
  }

  // -----------------------------
  // Rendera gåta
  // -----------------------------
  function renderPuzzle(i) {
    const p = puzzles[i];
    if (!p) return finishGame();

    current = i;
    localStorage.setItem(LS_CURRENT, String(i));
    failCount = 0;
    progEl.textContent = `Gåta ${i+1} av ${puzzles.length}`;
    app.innerHTML = '';
    if (puzzleAudio) {
      puzzleAudio.pause();
      puzzleAudio = null;
    }

    // Skapa kort
    const card = document.createElement('div');
    card.className = 'card';
    const prm = document.createElement('div');
    prm.className = 'prompt';
    prm.textContent = p.prompt;
    card.append(prm);

    let inputEl, msgEl, hintEl;

    // Olika typer av gåtor
    switch (p.type) {
      case 'name':
      case 'text':
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.append(inputEl);
        break;

      case 'number':
      case 'count':
        inputEl = document.createElement('input');
        inputEl.type = 'number';
        inputEl.placeholder = p.hint;
        card.append(inputEl);
        break;

      case 'word':
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.append(inputEl);
        break;

      case 'stego':
        puzzleAudio = null;
        const stegImg = document.createElement('img');
        stegImg.src = p.img;
        stegImg.alt = 'Stegobild';
        stegImg.style.filter = 'brightness(0)';
        stegImg.addEventListener('click', () => stegImg.style.filter = '');
        card.append(stegImg);
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.append(inputEl);
        break;

      case 'audio':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const btnA = document.createElement('button');
        btnA.textContent = 'Spela baklänges';
        btnA.addEventListener('click', () => {
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(() => {});
        });
        card.append(btnA);
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.append(inputEl);
        break;

      case 'prime':
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.append(inputEl);
        break;

      case 'morse':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const btnM = document.createElement('button');
        btnM.textContent = 'Spela morse';
        btnM.addEventListener('click', () => {
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(() => {});
        });
        card.append(btnM);
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.append(inputEl);
        break;

      case 'magic':
        const grid = document.createElement('div');
        grid.className = 'magic-grid';
        for (let r = 0; r < p.size; r++) {
          for (let c = 0; c < p.size; c++) {
            const v = p.grid[r][c];
            if (v === "") {
              const inp = document.createElement('input');
              inp.type = 'number';
              inp.className = 'magic-cell';
              inp.min = '1';
              inp.max = String(p.size * p.size);
              grid.append(inp);
            } else {
              const cell = document.createElement('div');
              cell.textContent = v;
              cell.className = 'magic-fixed';
              grid.append(cell);
            }
          }
        }
        card.append(grid);
        inputEl = grid;
        break;

      case 'final':
        renderFinal();
        return;
    }

    // Fel‐ och tipsrutor
    msgEl  = document.createElement('div');
    msgEl.className = 'error-msg';
    hintEl = document.createElement('div');
    hintEl.className = 'hint-msg';
    if (p.hint) hintEl.textContent = `Tips: ${p.hint}`;
    card.append(msgEl, hintEl);

    // Skicka-knapp
    const send = document.createElement('button');
    send.textContent = 'Skicka';
    send.addEventListener('click', () => checkAnswer(p, inputEl, msgEl, hintEl, card));
    card.append(send);

    app.append(card);
    inputEl?.focus();
  }

  // -----------------------------
  // Kontrollera svar
  // -----------------------------
  function checkAnswer(p, inputEl, msgEl, hintEl, card) {
    clearAnim(card);

    // Dynamiskt svar för prime‐gåta
    if (p.type === 'prime') {
      const mins = Math.floor((Date.now() - startTime) / 60000);
      if (!isPrime(mins)) {
        showError(msgEl, '⏳ Vänta till ett primtal-minut!');
        return;
      }
      p.answer = String(mins);
    }

    const ans = inputEl ? inputEl.value.trim().toLowerCase() : '';
    let ok = false;

    switch (p.type) {
      case 'name':
        ok = validNames.includes(ans);
        break;

      case 'text':
      case 'number':
      case 'count':
        ok = ans === String(p.answer).toLowerCase();
        break;

      case 'word':
        ok = ans.replace(/\s+/g, '') === String(p.answer).toLowerCase();
        break;

      case 'stego':
      case 'audio':
        ok = ans === String(p.answer);
        break;

      case 'prime':
        ok = ans === String(p.answer);
        break;

      case 'morse': {
        const cleaned = ans.replace(/\s+/g, '').toLowerCase();
        ok = Array.isArray(p.answers) && p.answers.some(a =>
          a.replace(/\s+/g, '').toLowerCase() === cleaned
        );
        break;
      }

      case 'magic':
        const vals = Array.from(inputEl.querySelectorAll('input'))
                          .map(i => parseInt(i.value, 10));
        if (vals.some(isNaN)) {
          showError(msgEl, 'Fyll alla rutor!');
          return;
        }
        const sz = p.size, t = p.target, M = [];
        for (let r = 0; r < sz; r++) {
          M[r] = vals.slice(r * sz, (r + 1) * sz);
        }
        ok = M.every(row => row.reduce((a,b) => a+b,0) === t)
          && Array.from({length:sz}).every(c => M.reduce((s,row) => s+row[c],0) === t)
          && M.reduce((s,row,r) => s+row[r], 0) === t
          && M.reduce((s,row,r) => s+row[sz-1-r], 0) === t;
        break;
    }

    if (ok) {
      play(current + 1 < puzzles.length ? 'correct' : 'finish');
      card.classList.add('correct');
      setTimeout(() => renderPuzzle(current + 1), 500);
    } else {
      play('wrong');
      card.classList.add('shake');
      showError(msgEl, '❌ Fel – försök igen!');
      failCount++;
      if (failCount >= 2 && p.hint) {
        hintEl.textContent = `Tips: ${p.hint}`;
      }
    }
  }

  // -----------------------------
  // Final‐vy: dokumentera trädet
  // -----------------------------
  function renderFinal() {
    clearInterval(timerId);
    const html = `
      <div class="card" id="final-form">
        <fieldset>
          <legend>Dokumentera trädet</legend>
          <label>1. Ta en gruppbild med trädet</label>
          <input type="file" id="photo" accept="image/*">
          <img id="preview" style="display:none;">
          <label>2. Trädets latinska namn</label>
          <input type="text" id="latin" placeholder="Quercus robur">
          <label>3. Ditt lagnamn</label>
          <input type="text" id="team" placeholder="Tigerlaget">
          <button id="submit" disabled>Skicka</button>
        </fieldset>
      </div>
      <div class="card summary" id="summary">
        <h2>Sammanfattning</h2>
        <div class="field"><strong>Latinskt namn:</strong> <span id="out-latin"></span></div>
        <div class="field"><strong>Lagnamn:</strong> <span id="out-team"></span></div>
        <div class="field"><strong>Tid:</strong> <span id="out-time"></span></div>
        <div class="field"><strong>Bild:</strong><br><img id="out-image"></div>
        <p>📸 Ta en skärmdump och skicka till domaren.</p>
      </div>`;
    app.innerHTML = html;

    const photo   = document.getElementById('photo');
    const latinI  = document.getElementById('latin');
    const teamI   = document.getElementById('team');
    const submit  = document.getElementById('submit');
    const preview = document.getElementById('preview');
    const summary = document.getElementById('summary');
    const outLat  = document.getElementById('out-latin');
    const outTeam = document.getElementById('out-team');
    const outTime = document.getElementById('out-time');
    const outImg  = document.getElementById('out-image');

    function validate() {
      submit.disabled = !(
        photo.files.length === 1 &&
        latinI.value.trim() !== '' &&
        teamI.value.trim() !== ''
      );
    }
    [photo, latinI, teamI].forEach(el => el.addEventListener('input', validate));

    photo.addEventListener('change', () => {
      validate();
      const f = photo.files[0];
      if (f && f.size > 5*1024*1024) {
        alert('Max 5 MB');
        photo.value = '';
        preview.style.display = 'none';
        validate();
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(f);
    });

    submit.addEventListener('click', () => {
      const elapsed = Date.now() - startTime;
      const mm = String(Math.floor(elapsed / 60000)).padStart(2,'0');
      const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2,'0');
      outTime.textContent = `${mm}:${ss}`;
      outLat.textContent  = latinI.value.trim();
      outTeam.textContent = teamI.value.trim();

      const reader = new FileReader();
      reader.onload = e => {
        outImg.src = e.target.result;
        document.getElementById('final-form').style.display = 'none';
        summary.classList.add('visible');
        play('finish');
      };
      reader.readAsDataURL(photo.files[0]);
    });
  }

  // -----------------------------
  // När alla gåtor är klara
  // -----------------------------
  function finishGame() {
    clearInterval(timerId);
    play('finish');
    app.innerHTML = `
      <div class="card">
        <h2>✅ Klart!</h2>
        <p>📸 Ta en skärmdump och skicka till domaren.</p>
      </div>`;
  }

  // Starta init när DOM är redo
  document.addEventListener('DOMContentLoaded', init);

})();