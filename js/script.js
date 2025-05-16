// File: js/script.js
(() => {
  'use strict';

  // 1) Element-referenser
  const app     = document.getElementById('app');
  const timerEl = document.getElementById('timer');
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

  // 2) Globalt state + localStorage-nycklar
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

  // 3) Hjälpfunktioner
  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) return false;
    }
    return true;
  }
  function vibrate(pattern) { navigator.vibrate?.(pattern); }
  function playSound(type) {
    const a = sounds[type];
    if (a) { a.currentTime = 0; a.play().catch(()=>{}); }
    if (type === 'correct') vibrate(200);
    if (type === 'wrong')   vibrate([100,50,100]);
  }
  function clearAnim(card) { card.classList.remove('correct','shake'); }
  function updateTimer() {
    const diff = Date.now() - startTime;
    const mm   = String(Math.floor(diff/60000)).padStart(2,'0');
    const ss   = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
    timerEl.textContent = `${mm}:${ss}`;
  }

  // 4) Init: ladda JSON, preload, bind, återuppta
  async function init() {
    const res  = await fetch('assets/data/puzzles.json');
    const data = await res.json();
    puzzles     = data.puzzles;
    staticPages = data.staticPages;
    validNames  = data.validNames;

    // Preload ljud + stegobild
    Object.values(sounds).forEach(a=>a.load());
    const steg = puzzles.find(p => p.type==='stego');
    if (steg?.img) new Image().src = steg.img;

    // Bind navigeringsknappar
    Object.entries(navBtns).forEach(([k,btn]) =>
      btn.addEventListener('click', () => activateTab(k))
    );

    // Återuppta vid refresh
    if (localStorage.getItem(LS_STARTED) === '1') {
      started   = true;
      startTime = +localStorage.getItem(LS_START_TIME) || Date.now();
      current   = +localStorage.getItem(LS_CURRENT)   || 0;
      setNavEnabled(true);
      updateTimer();
      timerId = setInterval(updateTimer, 500);
    } else {
      setNavEnabled(false);
    }

    activateTab('play');
  }

  // 5) Lås/avlås nav
  function setNavEnabled(on) {
    ['var','kamp','help'].forEach(k=>{
      navBtns[k].disabled = !on;
      navBtns[k].classList.toggle('disabled', !on);
    });
  }

  // 6) Växla flik
  function activateTab(tab) {
    Object.values(navBtns).forEach(b=>b.classList.remove('active'));
    navBtns[tab].classList.add('active');

    if (tab === 'play') {
      if (!started) showIntro();
      else          renderPuzzle(current);
    } else {
      showStatic(tab);
    }
  }

  // 7) Intro-vy
  function showIntro() {
    clearInterval(timerId);
    timerEl.textContent = '00:00';
    document.getElementById('progress').textContent = '';
    setNavEnabled(false);

    app.innerHTML = `
      <div class="card start-card">
        <img src="assets/icons/icon-512.png" class="start-icon" alt="">
        <p class="prompt">Välkommen!</p>
        <button id="startBtn" class="start-btn">Starta tävlingen</button>
      </div>`;

    document.getElementById('startBtn').onclick = () => {
      started   = true;
      startTime = Date.now();
      localStorage.setItem(LS_STARTED,    '1');
      localStorage.setItem(LS_START_TIME, String(startTime));
      localStorage.setItem(LS_CURRENT,    '0');
      setNavEnabled(true);
      updateTimer();
      timerId = setInterval(updateTimer, 500);
      renderPuzzle(0);
    };
  }

  // 8) Statiska sidor (Vår/Kamp/Hjälp)
  function showStatic(key) {
    // inga “Gåta x av y” längre, progress är alltid tom
    document.getElementById('progress').textContent = '';
    const d = staticPages[key];
    app.innerHTML = `
      <div class="card">
        <img src="${d.icon}" class="static-icon" alt="">
        <h2>${d.title}</h2>
        <p class="static-text">${d.text.replace(/\n/g,'<br>')}</p>
        ${d.thumb?`<img id="static-thumb" src="${d.thumb}" class="static-thumb">`:''}
      </div>`;

    if (key==='var' && d.thumb) {
      const thumb = document.getElementById('static-thumb'),
            modal = document.getElementById('img-modal'),
            img   = document.getElementById('modal-img'),
            close = document.getElementById('modal-close');
      thumb.onclick = () => { img.src = d.full; modal.classList.remove('hidden'); };
      close.onclick = () => { img.src = ''; modal.classList.add('hidden'); };
      modal.onclick = e => { if (e.target===modal) close.onclick(); };
    }
  }

  // 9) Rendera gåta
  function renderPuzzle(i) {
    const p = puzzles[i];
    if (!p) return renderFinal();

    current = i;
    localStorage.setItem(LS_CURRENT, String(i));
    failCount = 0;

    app.innerHTML = '';              // rensa allt
    const card = document.createElement('div');
    card.className = 'card';
    // prompt
    const prm = document.createElement('div');
    prm.className = 'prompt';
    prm.textContent = p.prompt;
    card.append(prm);

    let inputEl, msgEl, hintEl;

    switch (p.type) {
      case 'name':
      case 'text':
      case 'word':
        inputEl = makeInput('text', p.placeholder || p.hint)
        card.append(inputEl);
        break;

      case 'number':
      case 'count':
        if (p.img) card.append(makeImg(p.img));
        inputEl = makeInput('number', p.hint);
        card.append(inputEl);
        break;

      case 'stego':
        puzzleAudio = null;
        const si = makeImg(p.img);
        si.classList.add('stego-img');
        si.style.filter = 'brightness(0)';
        si.onclick = () => si.style.filter = '';
        card.append(si);
        inputEl = makeInput('text', p.placeholder || p.hint)
        card.append(inputEl);
        break;

      case 'audio':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const btnB = document.createElement('button');
        btnB.textContent = 'Spela baklänges';
        btnB.onclick = () => {
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(()=>{});
        };
        card.append(btnB);
        inputEl = makeInput('text', p.hint);
        card.append(inputEl);
        break;

      case 'morse':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const btnM = document.createElement('button');
        btnM.textContent = 'Spela morse';
        btnM.onclick = () => {
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(()=>{});
        };
        card.append(btnM);
        inputEl = makeInput('text', p.placeholder || p.hint)
        card.append(inputEl);
        break;

      case 'prime':
        inputEl = makeInput('text', p.placeholder || p.hint)
        card.append(inputEl);
        break;

      case 'magic':
        const grid = document.createElement('div');
        grid.className = 'magic-grid';
        for (let r = 0; r < p.size; r++) {
          for (let c = 0; c < p.size; c++) {
            const cell = document.createElement('div');
            const v = p.grid[r][c];
            if (v === "") {
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

    // fel- och alltid synligt hint
    msgEl  = document.createElement('div');
    msgEl.className = 'error-msg';
    hintEl = document.createElement('div');
    hintEl.className = 'hint-msg';
    if (p.hint) hintEl.textContent = 'Tips: ' + p.hint;
    card.append(msgEl, hintEl);

    // Skicka-knapp
    const sb = document.createElement('button');
    sb.textContent = 'Skicka';
    sb.onclick = () => checkAnswer(p, inputEl, msgEl, card);
    card.append(sb);

    app.append(card);
    inputEl?.focus();
  }

  function makeInput(type, placeholder) {
    const i = document.createElement('input');
    i.type = type;
    i.placeholder = placeholder;
    return i;
  }
  function makeImg(src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    return img;
  }

  // 10) Kontrollera svar
  function checkAnswer(p, inputEl, msgEl, card) {
    clearAnim(card);
    msgEl.textContent = '';
    if (puzzleAudio) { puzzleAudio.pause(); puzzleAudio = null; }

    // primtal
    if (p.type==='prime') {
      const mins = Math.floor((Date.now() - startTime)/60000);
      if (!isPrime(mins)) {
        msgEl.textContent = '⏳ Vänta till primtal-minut!';
        return;
      }
      p.answer = String(mins);
    }

    const ans = (inputEl.value||'').trim().toLowerCase();
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
        ok = ans === String(p.answer);
        break;
      case 'audio':
        ok = ans === String(p.answer).toLowerCase();
        break;
      case 'morse':
        const cleaned = ans.replace(/\s+/g,'');
        ok = Array.isArray(p.answers) &&
             p.answers.some(a =>
               a.replace(/\s+/g,'').toLowerCase() === cleaned
             );
        break;
      case 'prime':
        ok = ans === String(p.answer);
        break;
      case 'magic':
        const vals = Array.from(inputEl.querySelectorAll('input'))
                          .map(i => parseInt(i.value, 10));
        if (vals.some(v=>isNaN(v))) {
          msgEl.textContent = 'Fyll alla rutor!';
          return;
        }
        // bygg matris
        const sz = p.size, tgt = p.target, M = [];
        let idx = 0;
        for (let r=0; r<sz; r++){
          M[r] = [];
          for (let c=0; c<sz; c++){
            M[r][c] = (p.grid[r][c]==="")? vals[idx++] : Number(p.grid[r][c]);
          }
        }
        const rowsOk = M.every(row => row.reduce((a,b)=>a+b,0)===tgt);
        const colsOk = Array.from({length:sz}).every((_,c)=>
          M.reduce((sum,row)=>sum+row[c],0)===tgt
        );
        const d1 = M.reduce((s,row,i)=>s+row[i],0)===tgt;
        const d2 = M.reduce((s,row,i)=>s+row[sz-1-i],0)===tgt;
        ok = rowsOk && colsOk && d1 && d2;
        break;
    }

    if (ok) {
      playSound(puzzles[current+1]? 'correct':'finish');
      card.classList.add('correct');
      // direkt till nästa pussel, utan extra fördröjning
      setTimeout(() => renderPuzzle(current+1), 250);
    } else {
      playSound('wrong');
      card.classList.add('shake');
      msgEl.textContent = '❌ Fel – försök igen!';
    }
  }

  // 11) Slutvy
  function renderFinal() {
    clearInterval(timerId);
    const finishTime = Date.now();
    playSound('finish');
    setNavEnabled(false);
    Object.values(navBtns).forEach(b=>b.classList.remove('active'));

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

    // bind final-form
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
        photo.files.length===1 &&
        latinI.value.trim()!=='' &&
        teamI.value.trim()!==''
      );
    }
    [photo,latinI,teamI].forEach(el=>el.addEventListener('input', validate));

    photo.onchange = () => {
      validate();
      const f = photo.files[0];
      if (f && f.size>5*1024*1024) {
        alert('Max 5 MB'); photo.value=''; preview.style.display='none'; validate(); return;
      }
      const fr = new FileReader();
      fr.onload = e=>{ preview.src=e.target.result; preview.style.display='block'; };
      fr.readAsDataURL(f);
    };

    submit.onclick = () => {
      const diff = finishTime - startTime;
      const mm   = String(Math.floor(diff/60000)).padStart(2,'0');
      const ss   = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
      outTime.textContent = `${mm}:${ss}`;
      outLat.textContent  = latinI.value.trim();
      outTeam.textContent = teamI.value.trim();

      const fr2 = new FileReader();
      fr2.onload = e2 => {
        outImg.src = e2.target.result;
        document.getElementById('final-form').style.display='none';
        document.getElementById('summary').classList.add('visible');
      };
      fr2.readAsDataURL(photo.files[0]);
    };
  }

  // STARTA
  document.addEventListener('DOMContentLoaded', init);

})();