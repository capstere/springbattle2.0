// js/script.js

(() => {
  'use strict';

  // -----------------------------
  // Elementreferenser
  // -----------------------------
  const app     = document.getElementById('app');       // Container för dynamiskt innehåll
  const timerEl = document.getElementById('timer');    // Visar timern
  const progEl  = document.getElementById('progress'); // Visar "Gåta X av Y" eller sidtitel
  const navBtns = {                                    // Navigationsknappar
    play: document.getElementById('nav-play'),
    var:  document.getElementById('nav-var'),
    kamp: document.getElementById('nav-kamp'),
    help: document.getElementById('nav-help')
  };
  const sounds  = {                                    // Ljud för rätt/fel/finish
    correct: document.getElementById('audio-correct'),
    wrong:   document.getElementById('audio-wrong'),
    finish:  document.getElementById('audio-finish')
  };

  // -----------------------------
  // Globalt state
  // -----------------------------
  let puzzles     = [];   // Gåtor + konfiguration hämtas från JSON
  let staticPages = {};   // Statiska vyer (Vår/Kamp/Hjälp)
  let validNames  = [];   // Namnlista för gåta 1
  let current     = 0;    // Index för aktuell gåta
  let startTime   = 0;    // Timestamp då tävlingen startades
  let timerId     = null; // ID för setInterval
  let puzzleAudio = null; // Audio-objekt för ljud/stego/morse
  let failCount   = 0;    // Räknar felaktiga försök per gåta
  let started     = false;// Har "Starta tävlingen" tryckts

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

  function clearAnim(card) {
    card.classList.remove('correct','shake');
  }

  function updateTimer() {
    const elapsed = Date.now() - startTime;
    const mm = String(Math.floor(elapsed/60000)).padStart(2,'0');
    const ss = String(Math.floor((elapsed%60000)/1000)).padStart(2,'0');
    timerEl.textContent = `${mm}:${ss}`;
  }

  // -----------------------------
  // Init: Hämta data och bind navigation
  // -----------------------------
  async function init() {
    // Hämta gåtor + statiska sidor från JSON
    const res  = await fetch('assets/data/puzzles.json');
    const data = await res.json();
    puzzles     = data.puzzles;
    staticPages = data.staticPages;
    validNames  = data.validNames;

    // Preload ljudfiler
    Object.values(sounds).forEach(a => a.load());
    // Preload stego‐bild
    const stegoCfg = puzzles.find(p => p.type === 'stego');
    if (stegoCfg) new Image().src = stegoCfg.img;

    // Bind navigationsknappar
    Object.keys(navBtns).forEach(key => {
      navBtns[key].addEventListener('click', () => activateTab(key));
    });

    // I början: bara "Spela" aktiv
    setNavEnabled(false);
    activateTab('play');
  }

  // -----------------------------
  // Lås/lås upp flikar (var/kamp/help)
  // -----------------------------
  function setNavEnabled(enabled) {
    ['var','kamp','help'].forEach(key => {
      navBtns[key].disabled = !enabled;
      navBtns[key].classList.toggle('disabled', !enabled);
    });
  }

  // -----------------------------
  // Växla flik utan att stoppa timern
  // -----------------------------
  function activateTab(tab) {
    // Markera rätt ikon som "active"
    Object.values(navBtns).forEach(b => b.classList.remove('active'));
    navBtns[tab].classList.add('active');
    // OBS: vi tar inte clearInterval här – timern tickar på!

    if (tab === 'play') {
      // Spela-fliken: antingen intro eller pågående gåta
      if (!started) showIntro();
      else renderPuzzle(current);
    } else {
      // Statiska sidor: Vår/Kamp/Hjälp
      showStatic(tab);
    }
  }

  // -----------------------------
  // Visa intro-vy med icon-512 och startknapp
  // -----------------------------
  function showIntro() {
    progEl.textContent = '';
    app.innerHTML = `
      <div class="card start-card">
        <img src="assets/icons/icon-512.png" class="start-icon" alt="VÅRKAMP⁵-logo">
        <p class="prompt">Välkommen till tävlingsgren 5!</p>
        <button id="startBtn" class="start-btn">Starta tävlingen</button>
      </div>`;

    document.getElementById('startBtn').addEventListener('click', () => {
      started    = true;
      setNavEnabled(true);        // Lås upp övriga flikar
      startTime  = Date.now();    // Starta timern
      updateTimer();
      timerId    = setInterval(updateTimer, 500);
      renderPuzzle(0);
    });
  }

  // -----------------------------
  // Visa statisk sida (Vår/Kamp/Hjälp)
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

    // Om "Vår", bind thumbnail → modal
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
  // Rendera gåta baserat på index
  // -----------------------------
  function renderPuzzle(i) {
    const p = puzzles[i];
    if (!p) {
      finishGame();
      return;
    }
    current = i;
    failCount = 0;
    progEl.textContent = `Gåta ${i+1} av ${puzzles.length}`;
    app.innerHTML = '';
    if (puzzleAudio) {
      puzzleAudio.pause();
      puzzleAudio = null;
    }

    // Skapa kortet
    const card = document.createElement('div');
    card.className = 'card';
    const prm = document.createElement('div');
    prm.className = 'prompt';
    prm.textContent = p.prompt;
    card.append(prm);

    let inputEl, msgEl, hintEl;

    // Olika UI per typ
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

    // Fel & tips
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

    // Dynamiskt svar för prime
    if (p.type === 'prime') {
      const mins = Math.floor((Date.now() - startTime) / 60000);
      if (!isPrime(mins)) {
        showError(msgEl, '⏳ Vänta till primtal-minut!');
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
      case 'morse': {
        // Jämför ans mot alla varianter i p.answers
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
        ok = M.every(row => row.reduce((a,b)=>a+b,0)===t)
          && Array.from({length:sz}).every(c=>M.reduce((s,row)=>s+row[c],0)===t)
          && M.reduce((s,row,r)=>s+row[r],0)===t
          && M.reduce((s,row,r)=>s+row[sz-1-r],0)===t;
        break;
    }

    // Rätt/fel‐hantering
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
  // Finalvy: dokumentera trädet
  // -----------------------------
  function renderFinal() {
    // Stoppa timern nu när spelet är klart
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

    // (… resten av renderFinal‐logiken för filuppladdning …)
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
        photo.files.length===1 &&
        latinI.value.trim()!=='' &&
        teamI.value.trim()!==''
      );
    }
    [photo, latinI, teamI].forEach(el => el.addEventListener('input', validate));

    photo.addEventListener('change', () => {
      validate();
      const f = photo.files[0];
      if (!f) return;
      if (f.size > 5*1024*1024) {
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

  // -----------------------------
  // När alla gåtor är klara
  // -----------------------------
  function finishGame() {
    // Stoppa timern
    clearInterval(timerId);
    play('finish');
    app.innerHTML = `
      <div class="card">
        <h2>✅ Klart!</h2>
        <p>📸 Ta en skärmdump och skicka till domaren.</p>
      </div>`;
  }

  // Starta allt när DOM är redo
  document.addEventListener('DOMContentLoaded', init);

})();