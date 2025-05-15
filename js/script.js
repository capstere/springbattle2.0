// File: js/script.js
(() => {
  'use strict';

  // ────────────────────────────────────────────────────────────────────────────
  // 1) ELEMENTREFERENSER
  // ────────────────────────────────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────────────────────────────────
  // 2) GLOBALT STATE + localStorage-nycklar
  // ────────────────────────────────────────────────────────────────────────────
  let puzzles, staticPages, validNames;
  let current     = 0;
  let startTime   = 0;
  let timerId     = null;
  let puzzleAudio = null;
  let failCount   = 0;
  let started     = false;

  const LS_STARTED    = 'varkamp_started';
  const LS_START_TIME = 'varkamp_startTime';
  const LS_CURRENT    = 'varkamp_current';

  // ────────────────────────────────────────────────────────────────────────────
  // 3) HJÄLPFUNKTIONER
  // ────────────────────────────────────────────────────────────────────────────
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

  function playSound(type) {
    const a = sounds[type];
    if (a) {
      a.currentTime = 0;
      a.play().catch(()=>{});
    }
    if (type === 'correct') vibrate(200);
    if (type === 'wrong')   vibrate([100,50,100]);
  }

  function showError(el, msg) {
    el.textContent = msg;
  }

  function clearError(el) {
    el.textContent = '';
  }

  function clearAnim(card) {
    card.classList.remove('correct', 'shake');
  }

  function updateTimer() {
    const diff = Date.now() - startTime;
    const mm = String(Math.floor(diff / 60000)).padStart(2,'0');
    const ss = String(Math.floor((diff % 60000) / 1000)).padStart(2,'0');
    timerEl.textContent = `${mm}:${ss}`;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 4) INIT – ladda puzzles.json, preload, bind, återuppta
  // ────────────────────────────────────────────────────────────────────────────
  async function init() {
    const res  = await fetch('assets/data/puzzles.json');
    const data = await res.json();
    puzzles     = data.puzzles;
    staticPages = data.staticPages;
    validNames  = data.validNames;

    // preload ljudeffekter + stego-bild
    Object.values(sounds).forEach(a=>a.load());
    const steg = puzzles.find(p=>p.type==='stego');
    if (steg?.img) new Image().src = steg.img;

    // binda nav-knappar
    Object.entries(navBtns).forEach(([key, btn]) => {
      btn.addEventListener('click', () => activateTab(key));
    });

    // återuppta om redan startat
    if (localStorage.getItem(LS_STARTED) === '1') {
      started   = true;
      startTime = parseInt(localStorage.getItem(LS_START_TIME), 10) || Date.now();
      current   = parseInt(localStorage.getItem(LS_CURRENT),  10) || 0;
      setNavEnabled(true);
      updateTimer();
      timerId = setInterval(updateTimer, 500);
    }

    // öppna rätt flik
    activateTab('play');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 5) LÅS/AVLÅS NAV
  // ────────────────────────────────────────────────────────────────────────────
  function setNavEnabled(on) {
    ['var','kamp','help'].forEach(k => {
      const btn = navBtns[k];
      btn.disabled = !on;
      btn.classList.toggle('disabled', !on);
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 6) VÄXLA FLIK
  // ────────────────────────────────────────────────────────────────────────────
  function activateTab(tab) {
    Object.values(navBtns).forEach(b => b.classList.remove('active'));
    navBtns[tab].classList.add('active');

    if (tab === 'play') {
      if (!started) showIntro();
      else          renderPuzzle(current);
    } else {
      showStatic(tab);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 7) INTRO-VY
  // ────────────────────────────────────────────────────────────────────────────
  function showIntro() {
    clearInterval(timerId);
    timerEl.textContent = '00:00';
    progEl.textContent  = '';
    setNavEnabled(false);
    app.innerHTML = `
      <div class="card start-card">
        <img src="assets/icons/icon-512.png" class="start-icon" alt="Logo">
        <p class="prompt">Välkommen till tävlingen!</p>
        <button id="startBtn" class="start-btn">Starta tävlingen</button>
      </div>`;
    document.getElementById('startBtn').addEventListener('click', () => {
      started = true;
      startTime = Date.now();
      localStorage.setItem(LS_STARTED,    '1');
      localStorage.setItem(LS_START_TIME, String(startTime));
      localStorage.setItem(LS_CURRENT,    '0');
      setNavEnabled(true);
      updateTimer();
      timerId = setInterval(updateTimer, 500);
      renderPuzzle(0);
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 8) STATISKA SIDOR (Vår/Kamp/Hjälp)
  // ────────────────────────────────────────────────────────────────────────────
  function showStatic(key) {
    progEl.textContent = staticPages[key].title;
    const d = staticPages[key];
    app.innerHTML = `
      <div class="card">
        <img src="${d.icon}" class="static-icon" alt="${d.title}">
        <h2>${d.title}</h2>
        <p class="static-text">${d.text.replace(/\n/g,'<br>')}</p>
        ${d.thumb ? `<img id="static-thumb" src="${d.thumb}" class="static-thumb">` : ''}
      </div>`;
    if (d.thumb) {
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

  // ────────────────────────────────────────────────────────────────────────────
  // 9) RENDERA GÅTA
  // ────────────────────────────────────────────────────────────────────────────
  function renderPuzzle(i) {
    const p = puzzles[i];
    if (!p) return renderFinal();

    current = i;
    localStorage.setItem(LS_CURRENT, String(i));
    failCount = 0;
    clearError(progEl);
    progEl.textContent = `Gåta ${i+1} av ${puzzles.length}`;
    app.innerHTML = '';

    // om timer inte redan tickar, starta
    if (!timerId) {
      updateTimer();
      timerId = setInterval(updateTimer, 500);
    }

    if (puzzleAudio) {
      puzzleAudio.pause();
      puzzleAudio = null;
    }

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="prompt">${p.prompt}</div>`;

    let inputEl, msgEl, hintEl;

    switch (p.type) {
      case 'name':
      case 'text':
        inputEl = createInput('text', 'Skriv svar här');
        card.append(inputEl);
        break;

      case 'number':
      case 'count':
        if (p.img) {
          const im = document.createElement('img');
          im.src = p.img;
          im.className = 'card-img';
          card.append(im);
        }
        inputEl = createInput('number', 'Skriv talet');
        card.append(inputEl);
        break;

      case 'word':
        inputEl = createInput('text', 'Skriv ordet');
        card.append(inputEl);
        break;

      case 'stego':
        const si = document.createElement('img');
        si.src = p.img;
        si.className = 'stego-img';
        si.style.filter = 'brightness(0)';
        si.addEventListener('click', () => si.style.filter = '');
        card.append(si);
        inputEl = createInput('text', 'Skriv talet');
        card.append(inputEl);
        break;

      case 'audio':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const ba = document.createElement('button');
        ba.textContent = 'Spela baklänges';
        ba.addEventListener('click', () => {
          puzzleAudio.pause();
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(()=>{});
        });
        card.append(ba);
        inputEl = createInput('text', 'Skriv svar här');
        card.append(inputEl);
        break;

      case 'prime':
        inputEl = createInput('text', 'Skriv primtalet');
        card.append(inputEl);
        break;

      case 'morse':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const bm = document.createElement('button');
        bm.textContent = 'Spela morse';
        bm.addEventListener('click', () => {
          puzzleAudio.pause();
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(()=>{});
        });
        card.append(bm);
        inputEl = createInput('text', 'Ange kod här');
        card.append(inputEl);
        break;

      case 'magic':
        const grid = document.createElement('div');
        grid.className = 'magic-grid';
        for (let r = 0; r < p.size; r++) {
          for (let c = 0; c < p.size; c++) {
            const cell = document.createElement('div');
            if (p.grid[r][c] === '') {
              cell.className = 'magic-cell';
              const inp = document.createElement('input');
              inp.type = 'number';
              cell.append(inp);
            } else {
              cell.className = 'magic-fixed';
              cell.textContent = p.grid[r][c];
            }
            grid.append(cell);
          }
        }
        card.append(grid);
        inputEl = grid;
        break;
    }

    // feltext + hint (visas först efter 2 fel)
    msgEl  = document.createElement('div');
    msgEl.className = 'error-msg';
    hintEl = document.createElement('div');
    hintEl.className = 'hint-msg';
    card.append(msgEl, hintEl);

    // skicka-knapp
    const btn = document.createElement('button');
    btn.textContent = 'Skicka';
    btn.addEventListener('click', () => checkAnswer(p, inputEl, msgEl, hintEl, card));
    card.append(btn);

    app.append(card);
    inputEl?.focus();
  }

  function createInput(type, placeholder) {
    const i = document.createElement('input');
    i.type = type;
    i.placeholder = placeholder;
    return i;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 10) KONTROLLERA SVAR
  // ────────────────────────────────────────────────────────────────────────────
  function checkAnswer(p, inputEl, msgEl, hintEl, card) {
    clearAnim(card);
    clearError(msgEl);

    // stoppas eventuellt ljud
    if (puzzleAudio) {
      puzzleAudio.pause();
      puzzleAudio = null;
    }

    // dynamiskt primtal-svar
    if (p.type === 'prime') {
      const mins = Math.floor((Date.now() - startTime) / 60000);
      if (!isPrime(mins)) {
        showError(msgEl, '⏳ Vänta till primtal-minut!');
        return;
      }
      p.answer = String(mins);
    }

    const ans = (inputEl.value || '').trim().toLowerCase();
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
        ok = ans.replace(/\s+/g,'') === String(p.answer).toLowerCase();
        break;
      case 'stego':
      case 'audio':
      case 'prime':
        ok = ans === String(p.answer);
        break;
      case 'morse':
        const clean = ans.replace(/\s+/g,'');
        ok = Array.isArray(p.answers) &&
             p.answers.some(a => a.replace(/\s+/g,'').toLowerCase() === clean);
        break;
      case 'magic':
        const vals = Array.from(inputEl.querySelectorAll('input'))
                          .map(i => parseInt(i.value, 10));
        if (vals.some(isNaN)) {
          showError(msgEl, 'Fyll alla rutor!');
          return;
        }
        // bygg matris
        const M = [], sz = p.size, tgt = p.target;
        let idx = 0;
        for (let r = 0; r < sz; r++) {
          M[r] = [];
          for (let c = 0; c < sz; c++) {
            M[r][c] = p.grid[r][c] === '' ? vals[idx++] : Number(p.grid[r][c]);
          }
        }
        const rowsOk = M.every(row => row.reduce((a,b)=>a+b,0) === tgt);
        const colsOk = Array.from({length:sz}).every(c =>
          M.reduce((sum,row)=>sum+row[c],0) === tgt
        );
        const d1 = M.reduce((s,row,i)=>s+row[i],0) === tgt;
        const d2 = M.reduce((s,row,i)=>s+row[sz-1-i],0) === tgt;
        ok = rowsOk && colsOk && d1 && d2;
        break;
    }

    if (ok) {
      playSound(current+1 < puzzles.length ? 'correct' : 'finish');
      card.classList.add('correct');
      setTimeout(() => {
        renderPuzzle(current+1);
      }, 500);
    } else {
      playSound('wrong');
      card.classList.add('shake');
      showError(msgEl, '❌ Fel – försök igen!');
      failCount++;
      if (failCount >= 2 && p.hint) {
        hintEl.textContent = `Tips: ${p.hint}`;
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 11) Slutvy (final)
  // ────────────────────────────────────────────────────────────────────────────
  function renderFinal() {
    clearInterval(timerId);
    playSound('finish');
    setNavEnabled(false);
    Object.values(navBtns).forEach(b => b.classList.remove('active'));

    app.innerHTML = `
      <div class="card" id="final-form">
        <fieldset>
          <legend>Dokumentera trädet</legend>
          <label>1. Ta en gruppbild med trädet</label>
          <input type="file" id="photo" accept="image/*">
          <img id="preview" style="display:none;width:100%;margin-top:.5rem;border-radius:8px;">
          <label>2. Trädets latinska namn</label>
          <input type="text" id="latin" placeholder="Ex: Quercus robur">
          <label>3. Ditt lagnamn</label>
          <input type="text" id="team" placeholder="Ex: Tigerlaget">
          <button id="submit" disabled>Skicka</button>
        </fieldset>
      </div>
      <div class="card summary" id="summary">
        <h2>Sammanfattning</h2>
        <div class="field"><strong>Latinskt namn:</strong> <span id="out-latin"></span></div>
        <div class="field"><strong>Lagnamn:</strong> <span id="out-team"></span></div>
        <div class="field"><strong>Tid:</strong> <span id="out-time"></span></div>
        <div class="field"><strong>Bild:</strong><br><img id="out-image" style="width:100%;border-radius:8px;"></div>
        <p>📸 Ta en skärmdump och skicka till domaren.</p>
      </div>`;

    // ... bindning av final-form som tidigare ...
    const photo   = document.getElementById('photo');
    const latinI  = document.getElementById('latin');
    const teamI   = document.getElementById('team');
    const submit  = document.getElementById('submit');
    const preview = document.getElementById('preview');
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
      const fr = new FileReader();
      fr.onload = e => {
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      fr.readAsDataURL(f);
    });

    submit.addEventListener('click', () => {
      const diff = Date.now() - startTime;
      const mm = String(Math.floor(diff/60000)).padStart(2,'0');
      const ss = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
      outTime.textContent = `${mm}:${ss}`;
      outLat.textContent  = latinI.value.trim();
      outTeam.textContent = teamI.value.trim();
      const fr2 = new FileReader();
      fr2.onload = e2 => {
        outImg.src = e2.target.result;
        document.getElementById('final-form').style.display = 'none';
        document.getElementById('summary').classList.add('visible');
      };
      fr2.readAsDataURL(photo.files[0]);
    });
  }

  // starta init när DOM är klar
  document.addEventListener('DOMContentLoaded', init);
})();