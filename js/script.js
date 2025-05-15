// js/script.js
(() => {
  'use strict';

  // === Element‐references ===
  const app     = document.getElementById('app');
  const timerEl = document.getElementById('timer');
  const progEl  = document.getElementById('progress');
  const navBtns = {
    play: document.getElementById('nav-play'),
    var:  document.getElementById('nav-var'),
    kamp: document.getElementById('nav-kamp'),
    help: document.getElementById('nav-help')
  };
  const sounds = {
    correct: document.getElementById('audio-correct'),
    wrong:   document.getElementById('audio-wrong'),
    finish:  document.getElementById('audio-finish')
  };

  // === State & constants ===
  let puzzles, staticPages, validNames;
  let current = 0;
  let startTime = 0;
  let timerId = null;
  let failCount = 0;
  let started = false;
  let finalElapsed = 0;

  const LS_STARTED    = 'varkamp_started';
  const LS_START_TIME = 'varkamp_startTime';
  const LS_CURRENT    = 'varkamp_current';

  // === Helpers ===
  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) return false;
    }
    return true;
  }
  function vibrate(pat) {
    navigator.vibrate?.(pat);
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
    card.classList.remove('correct', 'shake');
  }
  function updateTimer() {
    const diff = Date.now() - startTime;
    const mm = String(Math.floor(diff/60000)).padStart(2,'0');
    const ss = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
    timerEl.textContent = `${mm}:${ss}`;
  }

  // === Enable/disable static tabs ===
  function setNavEnabled(on) {
    ['var','kamp','help'].forEach(k => {
      navBtns[k].disabled = !on;
      navBtns[k].classList.toggle('disabled', !on);
    });
  }

  // === Init ===
  async function init() {
    const res = await fetch('assets/data/puzzles.json');
    const data = await res.json();
    puzzles     = data.puzzles;
    staticPages = data.staticPages;
    validNames  = data.validNames;

    Object.values(sounds).forEach(a => a.load());
    const steg = puzzles.find(p => p.type === 'stego');
    if (steg?.img) new Image().src = steg.img;

    Object.keys(navBtns).forEach(key => {
      navBtns[key].addEventListener('click', () => activateTab(key));
    });

    if (localStorage.getItem(LS_STARTED) === '1') {
      started   = true;
      startTime = parseInt(localStorage.getItem(LS_START_TIME),10) || Date.now();
      current   = parseInt(localStorage.getItem(LS_CURRENT),10)   || 0;
      setNavEnabled(true);
      updateTimer();
      timerId = setInterval(updateTimer,500);
      activateTab('play');
      renderPuzzle(current);
    } else {
      setNavEnabled(false);
      activateTab('play');
    }
  }

  // === Tab switching ===
  function activateTab(tab) {
    Object.values(navBtns).forEach(b => b.classList.remove('active'));
    navBtns[tab].classList.add('active');

    if (tab === 'play') {
      if (!started) showIntro();
      else renderPuzzle(current);
    } else {
      showStatic(tab);
    }
  }

  // === Show Intro ===
  function showIntro() {
    progEl.textContent = '';
    app.innerHTML = `
      <div class="card start-card">
        <img src="assets/icons/icon-512.png" class="start-icon" alt="VÅRKAMP⁵-logo">
        <p class="prompt">Välkommen till tävlingens första gren!</p>
        <button id="startBtn" class="start-btn">Starta tävlingen</button>
      </div>`;
    document.getElementById('startBtn').addEventListener('click', () => {
      started = true;
      localStorage.setItem(LS_STARTED, '1');
      startTime = Date.now();
      localStorage.setItem(LS_START_TIME, String(startTime));
      current = 0;
      localStorage.setItem(LS_CURRENT, '0');
      setNavEnabled(true);
      updateTimer();
      timerId = setInterval(updateTimer,500);
      renderPuzzle(0);
    });
  }

  // === Show Static Page ===
  function showStatic(key) {
    const d = staticPages[key];
    progEl.textContent = d.title;
    app.innerHTML = `
      <div class="card">
        <img src="${d.icon}" class="static-icon" alt="${d.title}">
        <h2>${d.title}</h2>
        <p class="static-text">${d.text.replace(/\n/g,'<br>')}</p>
        ${d.thumb?`<img src="${d.thumb}" id="static-thumb" class="static-thumb">`:''}
      </div>`;
    if (key === 'var' && d.thumb) {
      const thumb = document.getElementById('static-thumb');
      const modal = document.getElementById('img-modal');
      const img   = document.getElementById('modal-img');
      const close = document.getElementById('modal-close');
      thumb.addEventListener('click', () => {
        img.src = d.full;
        modal.classList.remove('hidden');
      });
      close.addEventListener('click', () => {
        img.src = '';
        modal.classList.add('hidden');
      });
      modal.addEventListener('click', e => {
        if (e.target === modal) {
          img.src = '';
          modal.classList.add('hidden');
        }
      });
    }
  }

  // === Render Puzzle ===
  function renderPuzzle(i) {
    const p = puzzles[i];
    if (!p) return;

    current = i;
    failCount = 0;
    localStorage.setItem(LS_CURRENT, String(i));
    progEl.textContent = `Gåta ${i+1} av ${puzzles.length}`;
    app.innerHTML = '';
    let puzzleAudio = null;

    const card = document.createElement('div');
    card.className = 'card';
    const prm = document.createElement('div');
    prm.className = 'prompt';
    prm.textContent = p.prompt;
    card.append(prm);

    let inputEl, msgEl, hintEl;

    switch(p.type) {
      case 'name':
      case 'text':
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.append(inputEl);
        break;

      case 'number':
      case 'count':
        if (p.img) {
          const im = document.createElement('img');
          im.src = p.img;
          im.alt = '';
          im.style.width = '100%';
          card.append(im);
        }
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
        // Stego-bild med egen klass för responsivitet
        const si = document.createElement('img');
        si.src = p.img;
        si.alt = 'Stegobild';
        si.classList.add('stego-img');
        si.style.filter = 'brightness(0)';
        si.addEventListener('click', () => si.style.filter = '');
        card.append(si);
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.append(inputEl);
        break;

      case 'audio':
      case 'morse':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const playBtn = document.createElement('button');
        playBtn.textContent = (p.type==='audio' ? 'Spela baklänges' : 'Spela morse');
        playBtn.addEventListener('click', () => {
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(()=>{});
        });
        card.append(playBtn);
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.append(inputEl);
        break;

      case 'prime':
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.append(inputEl);
        break;

      case 'magic':
        const grid = document.createElement('div');
        grid.className = 'magic-grid';
        for (let r = 0; r < p.size; r++) {
          for (let c = 0; c < p.size; c++) {
            const cell = document.createElement('div');
            const v = p.grid[r][c];
            if (v === '') {
              cell.className = 'magic-cell';
              const inp = document.createElement('input');
              inp.type = 'number';
              cell.append(inp);
            } else {
              cell.className = 'magic-fixed';
              cell.textContent = v;
            }
            grid.append(cell);
          }
        }
        card.append(grid);
        inputEl = grid;
        break;

      case 'final':
        return renderFinal();
    }

    msgEl = document.createElement('div'); msgEl.className = 'error-msg';
    hintEl = document.createElement('div'); hintEl.className = 'hint-msg';
    if (p.hint) hintEl.textContent = `Tips: ${p.hint}`;
    card.append(msgEl, hintEl);

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Skicka';
    sendBtn.addEventListener('click', () => checkAnswer(p, inputEl, msgEl, hintEl, card));
    card.append(sendBtn);

    app.append(card);
    inputEl?.focus();
  }

  // === Check Answer ===
  function checkAnswer(p, inputEl, msgEl, hintEl, card) {
    clearAnim(card);

    if (p.type === 'prime') {
      const mins = Math.floor((Date.now() - startTime)/60000);
      if (!isPrime(mins)) {
        showError(msgEl,'⏳ Vänta till primtal-minut!');
        return;
      }
      p.answer = String(mins);
    }

    const ans = inputEl?.value?.trim().toLowerCase() || '';
    let ok = false;

    switch(p.type) {
      case 'name':
        ok = validNames.includes(ans);
        break;
      case 'text':
      case 'number':
      case 'count':
        ok = ans === String(p.answer).toLowerCase();
        break;
      case 'word':
        ok = ans.replace(/\s+/g,'') === String(p.answer).toLowerCase();
        break;
      case 'stego':
      case 'audio':
      case 'prime':
        ok = ans === String(p.answer);
        break;
      case 'morse': {
        const clean = ans.replace(/\s+/g,'');
        ok = Array.isArray(p.answers) &&
             p.answers.some(a => a.replace(/\s+/g,'') === clean);
        break;
      }
      case 'magic': {
        const inputs = Array.from(inputEl.querySelectorAll('input'));
        const vals   = inputs.map(i => parseInt(i.value,10));
        if (vals.some(isNaN)) {
          showError(msgEl,'Fyll alla rutor!');
          return;
        }
        const M = [], size = p.size;
        let idx = 0;
        for (let r=0; r<size; r++) {
          M[r] = [];
          for (let c=0; c<size; c++) {
            M[r][c] = p.grid[r][c] === '' ? vals[idx++] : Number(p.grid[r][c]);
          }
        }
        const rowsOk = M.every(row=>row.reduce((a,b)=>a+b,0)===p.target);
        const colsOk = Array.from({length:size})
          .every(c=>M.reduce((sum,row)=>sum+row[c],0)===p.target);
        const d1 = M.reduce((s,row,r)=>s+row[r],0)===p.target;
        const d2 = M.reduce((s,row,r)=>s+row[size-1-r],0)===p.target;
        ok = rowsOk && colsOk && d1 && d2;
        break;
      }
    }

    if (ok) {
      play(current+1 < puzzles.length ? 'correct' : 'finish');
      card.classList.add('correct');
      if (p.type !== 'final') {
        setTimeout(() => renderPuzzle(current+1), 500);
      }
    } else {
      play('wrong');
      card.classList.add('shake');
      showError(msgEl,'❌ Fel – försök igen!');
      failCount++;
      if (failCount >= 2 && p.hint) hintEl.textContent = `Tips: ${p.hint}`;
    }
  }

  // === Final view ===
  function renderFinal() {
    clearInterval(timerId);
    finalElapsed = Date.now() - startTime;

    // disable nav
    Object.values(navBtns).forEach(b => {
      b.disabled = true;
      b.classList.add('disabled');
      b.classList.remove('active');
    });
    progEl.textContent = `Gåta ${puzzles.length} av ${puzzles.length}`;

    app.innerHTML = `
      <div class="card" id="final-form">
        <fieldset>
          <legend>Dokumentera trädet</legend>
          <label>1. Ta en gruppbild med trädet</label>
          <input type="file" id="photo" accept="image/*">
          <img id="preview" style="display:none; width:100%; margin-top:.5rem; border-radius:8px;">
          <label>2. Trädets latinska namn</label>
          <input type="text" id="latin" placeholder="Ex: Quercus robur">
          <label>3. Ditt lagnamn</label>
          <input type="text" id="team" placeholder="Ex: Tigerlaget">
          <button id="submit" disabled>Skicka</button>
        </fieldset>
      </div>
      <div class="card summary" id="summary" style="visibility:hidden;opacity:0;transform:translateY(20px);transition:all .5s;">
        <h2>Sammanfattning</h2>
        <div><strong>Latinskt namn:</strong> <span id="out-latin"></span></div>
        <div><strong>Lagnamn:</strong> <span id="out-team"></span></div>
        <div><strong>Tid:</strong> <span id="out-time"></span></div>
        <div><strong>Bild:</strong><br><img id="out-image" style="width:100%;border-radius:8px;"></div>
        <p>📸 Ta en skärmdump och skicka till domaren.</p>
      </div>`;

    // Bind final form
    const photo   = document.getElementById('photo');
    const latinI  = document.getElementById('latin');
    const teamI   = document.getElementById('team');
    const submit  = document.getElementById('submit');
    const preview = document.getElementById('preview');
    const outLat  = document.getElementById('out-latin');
    const outTeam = document.getElementById('out-team');
    const outTime = document.getElementById('out-time');
    const outImg  = document.getElementById('out-image');
    const summary = document.getElementById('summary');

    function validate() {
      submit.disabled = !(
        photo.files.length === 1 &&
        latinI.value.trim() !== '' &&
        teamI.value.trim()  !== ''
      );
    }
    [photo, latinI, teamI].forEach(el => el.addEventListener('input', validate));

    photo.addEventListener('change', () => {
      validate();
      const f = photo.files[0];
      if (f && f.size > 5*1024*1024) {
        alert('Max 5 MB.');
        photo.value = '';
        preview.style.display = 'none';
        validate();
        return;
      }
      const fr = new FileReader();
      fr.onload = e => {
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      fr.readAsDataURL(f);
    });

    submit.addEventListener('click', () => {
      outLat.textContent  = latinI.value.trim();
      outTeam.textContent = teamI.value.trim();
      const mm = String(Math.floor(finalElapsed/60000)).padStart(2,'0');
      const ss = String(Math.floor((finalElapsed%60000)/1000)).padStart(2,'0');
      outTime.textContent = `${mm}:${ss}`;

      const fr2 = new FileReader();
      fr2.onload = e2 => {
        outImg.src = e2.target.result;
        document.getElementById('final-form').style.display = 'none';
        summary.style.visibility = 'visible';
        summary.style.opacity    = '1';
        summary.style.transform  = 'translateY(0)';
      };
      fr2.readAsDataURL(photo.files[0]);
    });
  }

  // Kick things off
  document.addEventListener('DOMContentLoaded', init);

})();