// js/script.js
(() => {
  'use strict';

  // --- Element-referenser och globalt state ---
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

  let puzzles = [], staticPages = {}, validNames = [];
  let current = 0, startTime = 0, timerId = null, puzzleAudio = null, failCount = 0;

  // --- Hjälpfunktioner ---
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
    const audio = sounds[type];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
    if (type === 'correct') vibrate(200);
    if (type === 'wrong')   vibrate([100,50,100]);
  }
  function showError(el, msg) {
    el.textContent = msg;
  }
  function clearAnim(el) {
    el.classList.remove('correct','shake');
  }
  function updateTimer() {
    const d = Date.now() - startTime;
    const mm = String(Math.floor(d/60000)).padStart(2,'0');
    const ss = String(Math.floor((d%60000)/1000)).padStart(2,'0');
    timerEl.textContent = `${mm}:${ss}`;
  }

  // --- Init: Ladda JSON och bind navigation ---
  async function init() {
    const res  = await fetch('assets/data/puzzles.json');
    const data = await res.json();
    puzzles     = data.puzzles;
    staticPages = data.staticPages;
    validNames  = data.validNames;

    // Preload ljud + stego-bild
    Object.values(sounds).forEach(a=>a.load());
    const stego = puzzles.find(p=>p.type==='stego');
    if (stego) new Image().src = stego.img;

    // Bind navigation-knappar
    Object.keys(navBtns).forEach(key => {
      navBtns[key].addEventListener('click', () => activateTab(key));
    });

    // Visa spel-fliken först
    activateTab('play');
  }

  // --- Växla flik ---
  function activateTab(tab) {
    // Markera aktiv knapp
    Object.values(navBtns).forEach(b=>b.classList.remove('active'));
    navBtns[tab].classList.add('active');
    // Stoppa timer
    clearInterval(timerId);

    if (tab === 'play') {
      startGame();
    } else {
      showStatic(tab);
    }
  }

  // --- Starta spel ---
  function startGame() {
    current   = 0;
    startTime = Date.now();
    updateTimer();
    timerId   = setInterval(updateTimer, 500);
    renderPuzzle(current);
  }

  // --- Visa statisk sida (Vår/Kamp/Hjälp) ---
  function showStatic(key) {
    timerEl.textContent = '00:00';
    progEl.textContent  = staticPages[key].title;
    const d = staticPages[key];

    app.innerHTML = `
      <div class="card">
        <img src="${d.icon}" class="static-icon" alt="">
        <h2>${d.title}</h2>
        <p class="static-text">${d.text.replace(/\n/g,'<br>')}</p>
        ${d.thumb ? `<img src="${d.thumb}" id="static-thumb" class="static-thumb" alt="">` : ''}
      </div>
    `;

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

  // --- Rendera en gåta från listan ---
  function renderPuzzle(i) {
    const p = puzzles[i];
    if (!p) {
      finishGame();
      return;
    }
    current = i;
    failCount = 0;
    app.innerHTML = '';
    progEl.textContent = `Gåta ${i+1} av ${puzzles.length}`;
    if (puzzleAudio) {
      puzzleAudio.pause();
      puzzleAudio = null;
    }

    const card = document.createElement('div');
    card.className = 'card';
    const prm = document.createElement('div');
    prm.className = 'prompt';
    prm.textContent = p.prompt;
    card.appendChild(prm);

    let inputEl, msgEl, hintEl;

    switch(p.type) {
      case 'name':
      case 'text':
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint || 'Skriv svar';
        card.appendChild(inputEl);
        break;

      case 'number':
      case 'count':
        inputEl = document.createElement('input');
        inputEl.type = 'number';
        inputEl.placeholder = p.hint || 'Skriv siffror';
        card.appendChild(inputEl);
        break;

      case 'word':
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint || 'Skriv ordet';
        card.appendChild(inputEl);
        break;

      case 'stego':
        const img = document.createElement('img');
        img.src = p.img;
        img.alt = 'Stegobild';
        img.style.filter = 'brightness(0)';
        img.addEventListener('click', ()=> img.style.filter = '');
        card.appendChild(img);
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.appendChild(inputEl);
        break;

      case 'audio':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const btnA = document.createElement('button');
        btnA.textContent = 'Spela baklänges';
        btnA.addEventListener('click', ()=>{
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(()=>{});
          btnA.textContent = '...spelar';
        });
        card.appendChild(btnA);
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.appendChild(inputEl);
        break;

      case 'prime':
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.appendChild(inputEl);
        break;

      case 'morse':
        puzzleAudio = new Audio(p.src);
        puzzleAudio.preload = 'auto';
        const btnM = document.createElement('button');
        btnM.textContent = 'Spela morse';
        btnM.addEventListener('click', ()=>{
          puzzleAudio.currentTime = 0;
          puzzleAudio.play().catch(()=>{});
        });
        card.appendChild(btnM);
        inputEl = document.createElement('input');
        inputEl.placeholder = p.hint;
        card.appendChild(inputEl);
        break;

      case 'magic':
        const grid = document.createElement('div');
        grid.className = 'magic-grid';
        for (let r = 0; r < p.size; r++) {
          for (let c = 0; c < p.size; c++) {
            const cellVal = p.grid[r][c];
            if (cellVal === "") {
              const inp = document.createElement('input');
              inp.type = 'number';
              inp.className = 'magic-cell';
              inp.min = '1'; inp.max = String(p.size*p.size);
              grid.appendChild(inp);
            } else {
              const cell = document.createElement('div');
              cell.textContent = cellVal;
              cell.className = 'magic-fixed';
              grid.appendChild(cell);
            }
          }
        }
        card.appendChild(grid);
        inputEl = grid;
        break;

      case 'final':
        renderFinal();
        return;
    }

    msgEl = document.createElement('div');
    msgEl.className = 'error-msg';
    hintEl = document.createElement('div');
    hintEl.className = 'hint-msg';
    if (p.hint) hintEl.textContent = `Tips: ${p.hint}`;
    card.append(msgEl, hintEl);

    const send = document.createElement('button');
    send.textContent = 'Skicka';
    send.addEventListener('click', ()=> checkAnswer(p, inputEl, msgEl, hintEl, card));
    card.appendChild(send);

    app.appendChild(card);
    inputEl?.focus();
  }

  // --- Kontrollera svar och gå vidare ---
  function checkAnswer(p, inputEl, msgEl, hintEl, card) {
    clearAnim(card);

    if (p.type === 'prime') {
      const mins = Math.floor((Date.now() - startTime)/60000);
      if (!isPrime(mins)) {
        showError(msgEl, '⏳ Vänta till ett primtal-minut!');
        return;
      }
      p.answer = String(mins);
    }

    let ans = (p.type==='magic') ? null : (inputEl.value.trim().toLowerCase());
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
        ok = ans === String(p.answer);
        break;
      case 'morse':
        ok = /\.{3}-{3}\.{3}/.test(ans);
        break;
      case 'magic':
        const vals = Array.from(inputEl.querySelectorAll('input'))
                          .map(i=>parseInt(i.value,10));
        if (vals.some(isNaN)) {
          showError(msgEl,'Fyll alla rutor!');
          return;
        }
        const sz = p.size, t = p.target;
        const M = [], n=0;
        for (let r=0; r<sz; r++) {
          M[r] = vals.slice(r*sz,(r+1)*sz);
        }
        ok = M.every(row=>row.reduce((a,b)=>a+b,0)===t)
          && Array.from({length:sz}).every(c=>M.reduce((s,row)=>s+row[c],0)===t)
          && M.reduce((s,row,r)=>s+row[r],0)===t
          && M.reduce((s,row,r)=>s+row[sz-1-r],0)===t;
        break;
    }

    if (ok) {
      play((current+1<puzzles.length)?'correct':'finish');
      card.classList.add('correct');
      setTimeout(()=> renderPuzzle(current+1), 500);
    } else {
      play('wrong');
      card.classList.add('shake');
      showError(msgEl,'❌ Fel – försök igen!');
      failCount++;
      if (failCount>=2 && p.hint) hintEl.textContent = `Tips: ${p.hint}`;
    }
  }

  // --- Slutfas för gåta 11 ---
  function renderFinal() {
    clearInterval(timerId);
    const cardHtml = `
      <div class="card" id="final-form">
        <fieldset>
          <legend>Dokumentera trädet</legend>
          <label>1. Ta en gruppbild med trädet</label>
          <input type="file" id="photo" accept="image/*">
          <img id="preview" style="display:none;">
          <label>2. Trädets latinska namn</label>
          <input type="text" id="latin" placeholder="Quercus robur">
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
        <div class="field"><strong>Bild:</strong><br><img id="out-image"></div>
        <p style="margin-top:1rem;">📸 Ta en skärmdump av denna vy och skicka till domaren.</p>
      </div>`;
    app.innerHTML = cardHtml;

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
      submit.disabled = !(photo.files.length===1
        && latinI.value.trim()!==''
        && teamI.value.trim()!=='');
    }
    [photo, latinI, teamI].forEach(el => el.addEventListener('input', validate));

    photo.addEventListener('change', () => {
      validate();
      const f = photo.files[0];
      if (!f) return;
      if (f.size > 5*1024*1024) {
        alert('Max 5 MB.');
        photo.value = '';
        preview.style.display = 'none';
        validate();
        return;
      }
      const r = new FileReader();
      r.onload = e => {
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      r.readAsDataURL(f);
    });

    submit.addEventListener('click', () => {
      const elapsed = Date.now() - startTime;
      const mm = String(Math.floor(elapsed/60000)).padStart(2,'0');
      const ss = String(Math.floor((elapsed%60000)/1000)).padStart(2,'0');
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

  // --- Avsluta spelet om alla gåtor klara ---
  function finishGame() {
    clearInterval(timerId);
    play('finish');
    app.innerHTML = `
      <div class="card">
        <h2>✅ Klart!</h2>
        <p>📸 Ta en skärmdump av denna vy och skicka till domaren.</p>
      </div>`;
  }

  document.addEventListener('DOMContentLoaded', init);
})();