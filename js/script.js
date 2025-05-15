// File: js/script.js
(() => {
  'use strict';

  /*** ELEMENTREFERENSER ***/
  const app     = document.getElementById('app');
  const timerEl = document.getElementById('timer');
  const progEl  = document.getElementById('progress');
  const navBtns = {
    play: document.getElementById('nav-play'),
    var:  document.getElementById('nav-var'),
    kamp: document.getElementById('nav-kamp'),
    help: document.getElementById('nav-help'),
  };
  const sounds  = {
    correct: document.getElementById('audio-correct'),
    wrong:   document.getElementById('audio-wrong'),
    finish:  document.getElementById('audio-finish'),
  };

  /*** GLOBAL STATE + LS-KEYS ***/
  let puzzles, staticPages, validNames;
  let current    = 0;
  let startTime  = 0;
  let timerId    = null;
  let failCount  = 0;
  let started    = false;
  let puzzleAudio= null;

  const LS_STARTED   = 'varkamp_started';
  const LS_STARTTIME = 'varkamp_startTime';
  const LS_CURRENT   = 'varkamp_current';

  /*** HJÄLPFUNKTIONER ***/
  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  function playSound(type) {
    const a = sounds[type];
    if (a) { a.currentTime = 0; a.play().catch(()=>{}); }
  }
  function showError(el, msg) { el.textContent = msg; }
  function clearError(el)      { el.textContent = ''; }
  function updateTimer() {
    const d = Date.now() - startTime;
    const mm = String(Math.floor(d/60000)).padStart(2,'0');
    const ss = String(Math.floor((d%60000)/1000)).padStart(2,'0');
    timerEl.textContent = `${mm}:${ss}`;
  }

  /*** INIT – ladda data och återuppta om möjligt ***/
  async function init() {
    const res  = await fetch('assets/data/puzzles.json');
    const data = await res.json();
    puzzles     = data.puzzles;
    staticPages = data.staticPages;
    validNames  = data.validNames;

    // preload ljud + stegobild
    Object.values(sounds).forEach(a=>a.load());
    const steg = puzzles.find(p=>p.type==='stego');
    if (steg?.img) new Image().src = steg.img;

    // bind nav-knappar
    Object.entries(navBtns).forEach(([k,btn])=>{
      btn.addEventListener('click', ()=>activateTab(k));
    });

    // återuppta om redan startat
    if (localStorage.getItem(LS_STARTED) === '1') {
      started   = true;
      startTime = +localStorage.getItem(LS_STARTTIME) || Date.now();
      current   = +localStorage.getItem(LS_CURRENT)   || 0;
      // starta timer
      updateTimer();
      timerId = setInterval(updateTimer, 500);
      setNavEnabled(true);
    }

    // visa intro eller rätt gåta
    activateTab('play');
  }

  /*** LÅS-UPP NAV ***/
  function setNavEnabled(on) {
    ['var','kamp','help'].forEach(k=>{
      navBtns[k].disabled = !on;
      navBtns[k].classList.toggle('disabled', !on);
    });
  }

  /*** NÄR MAN BYTER FLIK ***/
  function activateTab(tab) {
    Object.values(navBtns).forEach(b=>b.classList.remove('active'));
    navBtns[tab].classList.add('active');

    if (tab === 'play') {
      if (!started) showIntro();
      else renderPuzzle(current);
    } else {
      showStatic(tab);
    }
  }

  /*** INTRO-VY ***/
  function showIntro() {
    clearInterval(timerId);
    timerId = null;
    started = false;
    setNavEnabled(false);
    timerEl.textContent = '00:00';
    progEl.textContent  = '';
    app.innerHTML = `
      <div class="card start-card">
        <img src="assets/icons/icon-512.png" class="start-icon" alt="Logo">
        <p class="prompt">Välkommen till tävlingen!</p>
        <button id="startBtn" class="start-btn">Starta tävlingen</button>
      </div>`;
    document.getElementById('startBtn').onclick = () => {
      started   = true;
      startTime = Date.now();
      localStorage.setItem(LS_STARTED, '1');
      localStorage.setItem(LS_STARTTIME, String(startTime));
      localStorage.setItem(LS_CURRENT, '0');
      // starta timer
      updateTimer();
      timerId = setInterval(updateTimer, 500);
      setNavEnabled(true);
      renderPuzzle(0);
    };
  }

  /*** STATISKA Sidor (Vår/Kamp/Hjälp) ***/
  function showStatic(key) {
    clearInterval(timerId);
    timerEl.textContent = '00:00';
    progEl.textContent  = staticPages[key].title;
    const d = staticPages[key];
    app.innerHTML = `
      <div class="card">
        <img src="${d.icon}" class="static-icon" alt="${d.title}">
        <h2>${d.title}</h2>
        <p class="static-text">${d.text.replace(/\n/g,'<br>')}</p>
        ${d.thumb?`<img id="static-thumb" src="${d.thumb}" class="static-thumb">`:''}
      </div>`;
    if (d.thumb) {
      const thumb = document.getElementById('static-thumb');
      const modal = document.getElementById('img-modal');
      const img   = document.getElementById('modal-img');
      const close = document.getElementById('modal-close');
      thumb.onclick = ()=>{ img.src = d.full; modal.classList.remove('hidden'); };
      close.onclick = ()=>{ modal.classList.add('hidden'); img.src = ''; };
      modal.onclick = e=>{ if (e.target === modal) close.onclick(); };
    }
  }

  /*** RENDERA GÅTA ***/
  function renderPuzzle(i) {
    clearError(progEl);
    const p = puzzles[i];
    if (!p) return renderFinal();

    current   = i;
    localStorage.setItem(LS_CURRENT, String(i));
    failCount = 0;
    progEl.textContent = `Gåta ${i+1} av ${puzzles.length}`;
    app.innerHTML = '';

    // Om timern inte redan tickar, starta den
    if (!timerId) {
      startTime = +localStorage.getItem(LS_STARTTIME) || Date.now();
      updateTimer();
      timerId = setInterval(updateTimer, 500);
    }

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="prompt">${p.prompt}</div>`;

    let inputEl;

    switch (p.type) {
      case 'name':
      case 'text':
        inputEl = createInput('text','Skriv svar här');
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
        inputEl = createInput('number','Skriv siffra');
        card.append(inputEl);
        break;

      case 'word':
        inputEl = createInput('text','Skriv ordet');
        card.append(inputEl);
        break;

      case 'stego':
        const si = document.createElement('img');
        si.src = p.img;
        si.className = 'stego-img card-img';
        si.style.filter = 'brightness(0)';
        si.onclick = () => si.style.filter = '';
        card.append(si);
        inputEl = createInput('text','Skriv talet');
        card.append(inputEl);
        break;

      case 'audio':
        // Återanvänd puzzleAudio
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const ba = document.createElement('button');
        ba.textContent = 'Spela upp';
        ba.onclick = () => {
          puzzleAudio.pause();
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(()=>{});
        };
        card.append(ba);
        inputEl = createInput('text','Skriv texten');
        card.append(inputEl);
        break;

      case 'prime':
        inputEl = createInput('text','Skriv primtalet');
        card.append(inputEl);
        break;

      case 'morse':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const bm = document.createElement('button');
        bm.textContent = 'Spela morse';
        bm.onclick = () => {
          puzzleAudio.pause();
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(()=>{});
        };
        card.append(bm);
        inputEl = createInput('text','Ange kod');
        card.append(inputEl);
        break;

      case 'magic':
        const grid = document.createElement('div');
        grid.className = 'magic-grid';
        for (let r = 0; r < p.size; r++) {
          for (let c = 0; c < p.size; c++) {
            const cell = document.createElement('div');
            if (p.grid[r][c] === "") {
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

    const msgEl  = document.createElement('div');
    msgEl.className = 'error-msg';
    const hintEl = document.createElement('div');
    hintEl.className = 'hint-msg';
    card.append(msgEl, hintEl);

    const btn = document.createElement('button');
    btn.textContent = 'Skicka';
    btn.onclick = () => checkAnswer(p,inputEl,msgEl,hintEl,card);
    card.append(btn);

    app.append(card);
    inputEl?.focus();
  }

  function createInput(type,ph) {
    const i = document.createElement('input');
    i.type = type;
    i.placeholder = ph;
    return i;
  }

  /*** CHECK ANSWER ***/
  function checkAnswer(p,inputEl,msgEl,hintEl,card) {
    clearError(msgEl);
    hintEl.textContent = '';
    // stoppa ljud om spelat
    if (puzzleAudio) {
      puzzleAudio.pause();
      puzzleAudio = null;
    }

    let ok = false;

    // Dynamiskt svar för prime
    if (p.type === 'prime') {
      const m = Math.floor((Date.now() - startTime)/60000);
      if (!isPrime(m)) {
        showError(msgEl,'⏳ Vänta till primtal-minut');
        return;
      }
      p.answer = String(m);
    }

    const ans = (inputEl.value||'').trim().toLowerCase();

    switch(p.type) {
      case 'name':  ok = validNames.includes(ans); break;
      case 'text':
      case 'number':
      case 'count': ok = ans === String(p.answer).toLowerCase(); break;
      case 'word':  ok = ans.replace(/\s+/g,'') === String(p.answer).toLowerCase(); break;
      case 'stego':
      case 'audio':
      case 'prime': ok = ans === String(p.answer).toLowerCase(); break;
      case 'morse':
        const clean = ans.replace(/\s+/g,'');
        ok = Array.isArray(p.answers) && p.answers.some(a=>
          a.replace(/\s+/g,'').toLowerCase() === clean
        );
        break;
      case 'magic':
        const vs = Array.from(inputEl.querySelectorAll('input')).map(i=>+i.value);
        if (vs.some(isNaN)) {
          showError(msgEl,'Fyll alla rutor');
          return;
        }
        // bygg och kontrollera matris
        const M=[]; let idx=0;
        for (let r=0;r<p.size;r++){
          M[r]=[];
          for (let c=0;c<p.size;c++){
            M[r][c] = (p.grid[r][c]==="")? vs[idx++] : Number(p.grid[r][c]);
          }
        }
        const tgt = p.target;
        const rows = M.every(r=> r.reduce((a,b)=>a+b,0)===tgt);
        const cols = M.every((_,c)=> M.reduce((s,row)=>s+row[c],0)===tgt);
        const d1   = M.reduce((s,row,i)=>s+row[i],0)===tgt;
        const d2   = M.reduce((s,row,i)=>s+row[p.size-1-i],0)===tgt;
        ok = rows&&cols&&d1&&d2;
        break;
    }

    if (ok) {
      playSound(current+1 < puzzles.length ? 'correct' : 'finish');
      card.classList.add('correct');
      setTimeout(()=> renderPuzzle(current+1), 500);
    } else {
      playSound('wrong');
      card.classList.add('shake');
      showError(msgEl,'❌ Fel – försök igen!');
      if (++failCount >= 2) hintEl.textContent = p.hint;
    }
  }

  /*** FINAL-VY ***/
  function renderFinal() {
    clearInterval(timerId);
    Object.values(navBtns).forEach(b=>{
      b.disabled = true;
      b.classList.add('disabled');
      b.classList.remove('active');
    });
    progEl.textContent = '';
    app.innerHTML = `
      <div class="card">
        <h2>✅ Klart!</h2>
        <p>Sammanfattning finns i nästa vy – ta en skärmdump!</p>
      </div>`;
  }

  document.addEventListener('DOMContentLoaded', init);
})();