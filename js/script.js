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
    help: document.getElementById('nav-help'),
  };
  const sounds = {
    correct: document.getElementById('audio-correct'),
    wrong:   document.getElementById('audio-wrong'),
    finish:  document.getElementById('audio-finish'),
  };

  // ────────────────────────────────────────────────────────────────────────────
  // 2) GLOBALT STATE + localStorage‐nycklar
  // ────────────────────────────────────────────────────────────────────────────
  let puzzles, staticPages, validNames;
  let current     = 0;
  let startTime   = 0;
  let finishTime  = 0;       // fångas först när sista gåtan skickas
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
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  function vibrate(pattern) {
    navigator.vibrate?.(pattern);
  }
  function playSound(type) {
    const a = sounds[type];
    if (a) { a.currentTime = 0; a.play().catch(()=>{}); }
    if (type === 'correct') vibrate(200);
    if (type === 'wrong')   vibrate([100,50,100]);
  }
  function showError(el, msg) { el.textContent = msg; }
  function clearAnim(card)    { card.classList.remove('correct','shake'); }
  function updateTimer() {
    const diff = Date.now() - startTime;
    const mm   = String(Math.floor(diff/60000)).padStart(2,'0');
    const ss   = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
    timerEl.textContent = `${mm}:${ss}`;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 4) INIT – ladda data, preload, bind, återuppta
  // ────────────────────────────────────────────────────────────────────────────
  async function init() {
    const res  = await fetch('assets/data/puzzles.json');
    const data = await res.json();
    puzzles     = data.puzzles;
    staticPages = data.staticPages;
    validNames  = data.validNames;

    Object.values(sounds).forEach(a=>a.load());
    const steg = puzzles.find(p=>p.type==='stego');
    if (steg?.img) new Image().src = steg.img;

    Object.entries(navBtns).forEach(([k,btn])=>{
      btn.addEventListener('click', ()=>activateTab(k));
    });

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

  // ────────────────────────────────────────────────────────────────────────────
  // 5) NAV‐LÅS
  // ────────────────────────────────────────────────────────────────────────────
  function setNavEnabled(on) {
    ['var','kamp','help'].forEach(k=>{
      navBtns[k].disabled = !on;
      navBtns[k].classList.toggle('disabled', !on);
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 6) VÄXLA FLIK
  // ────────────────────────────────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────────────────────────────────
  // 7) INTRO‐VY
  // ────────────────────────────────────────────────────────────────────────────
  function showIntro() {
    clearInterval(timerId);
    timerEl.textContent = '00:00';
    progEl.textContent  = '';
    setNavEnabled(false);

    app.innerHTML = `
      <div class="card start-card">
        <img src="assets/icons/icon-512.png" class="start-icon" alt="">
        <p class="prompt">Välkommen!</p>
        <button id="startBtn" class="start-btn">Starta tävlingen</button>
      </div>`;
    document.getElementById('startBtn').addEventListener('click', ()=>{
      started    = true;
      startTime  = Date.now();
      localStorage.setItem(LS_STARTED,    '1');
      localStorage.setItem(LS_START_TIME, String(startTime));
      current    = 0;
      localStorage.setItem(LS_CURRENT,    '0');
      setNavEnabled(true);
      updateTimer();
      timerId = setInterval(updateTimer, 500);
      renderPuzzle(0);
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 8) STATISKA Sidor
  // ────────────────────────────────────────────────────────────────────────────
  function showStatic(key) {
    progEl.textContent = staticPages[key].title;
    const d = staticPages[key];
    app.innerHTML = `
      <div class="card">
        <img src="${d.icon}" class="static-icon" alt="">
        <h2>${d.title}</h2>
        <p class="static-text">${d.text.replace(/\n/g,'<br>')}</p>
        ${d.thumb?`<img id="static-thumb" src="${d.thumb}" class="static-thumb">`:''}
      </div>`;
    if (d.thumb && key==='var') {
      const thumb = document.getElementById('static-thumb');
      const modal = document.getElementById('img-modal');
      const img   = document.getElementById('modal-img');
      const close = document.getElementById('modal-close');
      thumb.addEventListener('click', ()=>{ img.src=d.full; modal.classList.remove('hidden'); });
      close.addEventListener('click', ()=>{ img.src=''; modal.classList.add('hidden'); });
      modal.addEventListener('click', e=>{ if(e.target===modal) close.click(); });
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 9) RENDERA GÅTA
  // ────────────────────────────────────────────────────────────────────────────
  function renderPuzzle(i) {
    const p = puzzles[i];
    if (!p) return renderFinal();

    // ** Rensa gamla vyer **
    app.innerHTML = '';
    progEl.textContent = '';      // ingen "Gåta x av y"

    current = i;
    localStorage.setItem(LS_CURRENT, String(i));
    failCount = 0;
    clearAnim(app);

    if (!timerId) {
      updateTimer();
      timerId = setInterval(updateTimer, 500);
    }
    if (puzzleAudio) {
      puzzleAudio.pause();
      puzzleAudio = null;
    }

    // Bygg kortet
    const card = document.createElement('div');
    card.className = 'card';
    const prm  = document.createElement('div');
    prm.className = 'prompt';
    prm.textContent = p.prompt;
    card.append(prm);

    let inputEl, msgEl, hintEl;

    switch(p.type) {
      case 'name':
      case 'text':
        inputEl = makeInput('text', p.hint);
        card.append(inputEl);
        break;

      case 'number':
      case 'count':
        if (p.img) card.append(makeImg(p.img));
        inputEl = makeInput('number', p.hint);
        card.append(inputEl);
        break;

      case 'word':
        inputEl = makeInput('text', p.hint);
        card.append(inputEl);
        break;

      case 'stego':
        const si = makeImg(p.img);
        si.classList.add('stego-img');
        si.style.filter = 'brightness(0)';
        si.addEventListener('click', ()=> si.style.filter = '');
        card.append(si);
        inputEl = makeInput('text', p.hint);
        card.append(inputEl);
        break;

      case 'audio':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const ba = document.createElement('button');
        ba.textContent = 'Spela baklänges';
        ba.addEventListener('click', ()=>{
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(()=>{});
        });
        card.append(ba);
        inputEl = makeInput('text', p.hint);
        card.append(inputEl);
        break;

      case 'prime':
        inputEl = makeInput('text', p.hint);
        card.append(inputEl);
        break;

      case 'morse':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const bm = document.createElement('button');
        bm.textContent = 'Spela morse';
        bm.addEventListener('click', ()=>{
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(()=>{});
        });
        card.append(bm);
        inputEl = makeInput('text', p.hint);
        card.append(inputEl);
        break;

      case 'magic':
        // Magisk kvadrat
        const grid = document.createElement('div');
        grid.className = 'magic-grid';
        for (let r=0; r<p.size; r++){
          for (let c=0; c<p.size; c++){
            const cell = document.createElement('div');
            if (p.grid[r][c]==="") {
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

      case 'final':
        return renderFinal();
    }

    // Fel & tips (alltid synligt)
    msgEl  = document.createElement('div'); msgEl.className  = 'error-msg';
    hintEl = document.createElement('div'); hintEl.className = 'hint-msg';
    if (p.hint) hintEl.textContent = `Tips: ${p.hint}`;
    card.append(msgEl, hintEl);

    // Skicka‐knapp
    const btn = document.createElement('button');
    btn.textContent = 'Skicka';
    btn.addEventListener('click', ()=> checkAnswer(p,inputEl,msgEl,card));
    card.append(btn);

    app.append(card);
    inputEl?.focus();
  }

  function makeInput(type, ph) {
    const i = document.createElement('input');
    i.type = type; i.placeholder = ph;
    return i;
  }
  function makeImg(src) {
    const im = document.createElement('img');
    im.src = src; im.alt = '';
    return im;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 10) CHECK ANSWER
  // ────────────────────────────────────────────────────────────────────────────
  function checkAnswer(p, inputEl, msgEl, card) {
    clearAnim(card);
    clearError(msgEl);

    if (puzzleAudio) { puzzleAudio.pause(); puzzleAudio = null; }

    // Prime-logik
    if (p.type === 'prime') {
      const mins = Math.floor((Date.now()-startTime)/60000);
      if (!isPrime(mins)) {
        showError(msgEl,'⏳ Vänta primtal-minut!');
        return;
      }
      p.answer = String(mins);
    }

    const ans = (inputEl.value||'').trim().toLowerCase();
    let ok = false;

    switch(p.type) {
      case 'name': ok = validNames.includes(ans); break;
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
             p.answers.some(a=>a.replace(/\s+/g,'').toLowerCase()===clean);
        break;
      }
      case 'magic': {
        // Läser in alla 16 värden
        const vals = Array.from(inputEl.querySelectorAll('input'))
                          .map(i=>parseInt(i.value,10));
        if (vals.some(isNaN)) {
          showError(msgEl,'Fyll alla rutor!');
          return;
        }
        // Bygg upp M
        const sz = p.size, tgt = p.target;
        const M = []; let idx=0;
        for (let r=0;r<sz;r++){
          M[r]=[];
          for (let c=0;c<sz;c++){
            M[r][c] = (p.grid[r][c]==="")? vals[idx++] : Number(p.grid[r][c]);
          }
        }
        // Kontrollera rader, kolumner, diagonaler
        const rowsOk = M.every(row=> row.reduce((a,b)=>a+b,0)===tgt);
        const colsOk = Array.from({length:sz}).every(c=>
          M.reduce((sum,row)=>sum+row[c],0)===tgt
        );
        const d1 = M.reduce((s,row,i)=>s+row[i],0)===tgt;
        const d2 = M.reduce((s,row,i)=>s+row[sz-1-i],0)===tgt;
        ok = rowsOk && colsOk && d1 && d2;
        break;
      }
    }

    if (ok) {
      // Om sista gåtan (typ magic följd av final), fånga sluttid här:
      if (p.type==='magic' && current === puzzles.length-2) {
        finishTime = Date.now();
      }
      playSound(current === puzzles.length-1 ? 'finish' : 'correct');
      card.classList.add('correct');
      setTimeout(()=> renderPuzzle(current+1), 500);
    } else {
      playSound('wrong');
      card.classList.add('shake');
      showError(msgEl,'❌ Fel – försök igen!');
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 11) FINAL‐VY
  // ────────────────────────────────────────────────────────────────────────────
  function renderFinal() {
    clearInterval(timerId);
    if (!finishTime) finishTime = Date.now();
    playSound('finish');
    setNavEnabled(false);
    Object.values(navBtns).forEach(b=>b.classList.remove('active'));

    app.innerHTML = `
      <div class="card" id="final-form">
        <fieldset>
          <legend>Dokumentera trädet</legend>
          <label>1. Ta en gruppbild</label>
          <input type="file" id="photo" accept="image/*">
          <img id="preview" style="display:none;width:100%;margin-top:.5rem;border-radius:8px;">
          <label>2. Latinskt namn</label>
          <input type="text" id="latin" placeholder="Ex: Quercus robur">
          <label>3. Lagnamn</label>
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

    // Bind final‐form
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

    photo.addEventListener('change', ()=>{
      validate();
      const f = photo.files[0];
      if (f && f.size>5*1024*1024) {
        alert('Max 5 MB');
        photo.value=''; preview.style.display='none'; validate();
        return;
      }
      const fr=new FileReader();
      fr.onload = e=>{ preview.src=e.target.result; preview.style.display='block'; };
      fr.readAsDataURL(f);
    });

    submit.addEventListener('click', ()=>{
      const diff = finishTime - startTime;
      const mm   = String(Math.floor(diff/60000)).padStart(2,'0');
      const ss   = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
      outTime.textContent = `${mm}:${ss}`;
      outLat.textContent  = latinI.value.trim();
      outTeam.textContent = teamI.value.trim();
      const fr2=new FileReader();
      fr2.onload=e2=>{
        outImg.src=e2.target.result;
        document.getElementById('final-form').style.display='none';
        document.getElementById('summary').classList.add('visible');
      };
      fr2.readAsDataURL(photo.files[0]);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();