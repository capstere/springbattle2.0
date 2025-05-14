// js/script.js
(() => {
  'use strict';

  // Global state & element-refs
  let puzzles, staticPages, validNames;
  let current=0, startTime=0, timerId=null, puzzleAudio=null, failCount=0;

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

  // --- Hjälpfunktioner ---
  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  function vibrate(p)        { navigator.vibrate?.(p); }
  function play(type) {
    const a = sounds[type];
    if (a) { a.currentTime = 0; a.play().catch(()=>{}); }
    if (type==='correct') vibrate(200);
    if (type==='wrong')   vibrate([100,50,100]);
  }
  function showError(el,msg){ el.textContent = msg; }
  function clearAnim(el)    { el.classList.remove('correct','shake'); }

  // --- Timer-uppdatering ---
  function updateTimer() {
    const d = Date.now() - startTime;
    const mm = String(Math.floor(d/60000)).padStart(2,'0');
    const ss = String(Math.floor((d%60000)/1000)).padStart(2,'0');
    timerEl.textContent = `${mm}:${ss}`;
  }

  // Init: ladda in data + bind nav
  async function init() {
    // Ladda puzzles.json
    const res = await fetch('assets/data/puzzles.json');
    const data = await res.json();
    puzzles = data.puzzles;
    staticPages = data.staticPages;
    validNames = data.validNames;

    // Preload ljud + stegobild
    Object.values(sounds).forEach(a=>a.load());
    new Image().src = puzzles.find(p=>p.type==='stego').img;

    // Bind navigering
    navBtns.play.addEventListener('click', ()=>activateTab('play'));
    navBtns.var .addEventListener('click', ()=>activateTab('var'));
    navBtns.kamp.addEventListener('click', ()=>activateTab('kamp'));
    navBtns.help.addEventListener('click', ()=>activateTab('help'));

    // Start på spel-fliken
    activateTab('play');
  }

  // Växla tab
  function activateTab(tab) {
    Object.values(navBtns).forEach(b=>b.classList.remove('active'));
    navBtns[tab].classList.add('active');
    clearInterval(timerId);

    if(tab==='play') {
      startGame();
    } else {
      showStatic(tab);
    }
  }

  // Starta eller återuppta spelet
  function startGame() {
    startTime = Date.now();
    timerId = setInterval(updateTimer, 500);
    renderPuzzle(0);
  }

  // Visa statisk sida
  function showStatic(key) {
    timerEl.textContent = '00:00';
    progEl.textContent  = staticPages[key].title;
    const d = staticPages[key];
    app.innerHTML = `
      <div class="card">
        <img src="${d.icon}" class="static-icon" alt="">
        <h2>${d.title}</h2>
        <p class="static-text">${d.text}</p>
        ${d.thumb ? `<img src="${d.thumb}" id="static-thumb" class="static-thumb" alt="">` : ''}
      </div>`;
    // Modal-logik för "Vår"
    if(key==='var' && d.thumb) {
      const modal = document.getElementById('img-modal');
      const img   = document.getElementById('modal-img');
      document.getElementById('static-thumb').onclick = ()=>{
        img.src = d.full;
        modal.classList.remove('hidden');
      };
      document.getElementById('modal-close').onclick = ()=>{
        modal.classList.add('hidden');
        img.src = '';
      };
      modal.onclick = e=>{
        if(e.target===modal) {
          modal.classList.add('hidden');
          img.src = '';
        }
      };
    }
  }

  // Rendera gåta från puzzles[]
  function renderPuzzle(i) {
    current = i; failCount = 0;
    app.innerHTML = '';
    progEl.textContent = `Gåta ${i+1} av ${puzzles.length}`;
    if(puzzleAudio){ puzzleAudio.pause(); puzzleAudio=null; }

    const p = puzzles[i];
    if(!p) return finishGame();

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="prompt">${p.prompt}</div>`;
    let inputEl, msgEl, hintEl;

    // Bygg UI per p.type … (samma logik som tidigare)
    // Exempel för morse:
    if(p.type==='morse') {
      puzzleAudio = new Audio(p.src); puzzleAudio.preload = 'auto';
      inputEl = document.createElement('input');
      inputEl.placeholder = p.hint;
      const btn = document.createElement('button');
      btn.textContent = 'Spela morse';
      btn.onclick = ()=>{ puzzleAudio.currentTime=0; puzzleAudio.play().catch(()=>{}); };
      card.appendChild(btn);
      card.appendChild(inputEl);
    }
    
    // … komplettera alla typer: magic, count, text, number, word, name, stego, audio, prime, final …
    
    const card = document.createElement('div'); card.className='card';
    const prm  = document.createElement('div'); prm.className='prompt'; prm.textContent=p.prompt;
    card.append(prm);

    let inputEl, msgEl, hintEl;
    switch(p.type){
      case 'name':
      case 'prime':
        inputEl = document.createElement('input');
        inputEl.placeholder='Skriv svar';
        card.append(inputEl);
        break;
      case 'stego':
        const img = document.createElement('img');
        img.src=p.img; img.alt='Stegobild'; img.style.filter='brightness(0)';
        img.onclick=()=>img.style.filter='';
        card.append(img);
        inputEl = document.createElement('input');
        inputEl.placeholder='Tal (siffror)';
        card.append(inputEl);
        break;
      case 'audio':
        puzzleAudio=new Audio(p.src); puzzleAudio.preload='auto';
        const btn=document.createElement('button');
        btn.textContent='Spela baklänges';
        btn.onclick=()=>{
          puzzleAudio.currentTime=0; puzzleAudio.play().catch(()=>{});
          btn.textContent='...spelar';
        };
        card.append(btn);
        inputEl = document.createElement('input');
        inputEl.placeholder='Svara här';
        card.append(inputEl);
        break;
    }

    msgEl = document.createElement('div'); msgEl.className = 'error-msg';
    hintEl = document.createElement('div'); hintEl.className = 'hint-msg';
    if(p.hint) hintEl.textContent = `Tips: ${p.hint}`;
    card.appendChild(msgEl);
    card.appendChild(hintEl);

    const send = document.createElement('button');
    send.textContent = 'Skicka';
    send.onclick = ()=>checkAnswer(p, inputEl, msgEl, card);
    card.appendChild(send);

    app.appendChild(card);
    inputEl?.focus();
  }

  // Kontroll av svar (samma logik som tidigare)…
    function checkAnswer(p,ans,msgEl,hintEl,card,inputEl){
    if(puzzleAudio){ puzzleAudio.pause(); puzzleAudio=null; }
    clearAnim(card);
    if(p.type==='prime'){
      const mins = Math.floor((Date.now()-startTime)/60000);
      if(!isPrime(mins)){ showError(msgEl,'⏳ Vänta till primtal-minut!'); return; }
      p.answer=String(mins);
    }
    let ok = ans===String(p.answer);
    if(p.type==='name') ok = validNames.includes(ans);
    if(ok){
      play((p.type==='name'||current+1<puzzles.length)?'correct':'finish');
      card.classList.add('correct');
      inputEl?.removeAttribute('aria-invalid');
      setTimeout(()=>renderPuzzle(current+1),500);
    } else {
      play('wrong');
      card.classList.add('shake');
      showError(msgEl,'❌ Fel – försök igen!');
      inputEl?.setAttribute('aria-invalid','true');
      failCount++;
      if(failCount>=2 && p.hint) hintEl.textContent=`Tips: ${p.hint}`;
    }
  }

  // Avsluta spelet
  function finishGame() {
    clearInterval(timerId);
    play('finish');
    app.innerHTML = `
      <div class="card">
        <h2>✅ Klart!</h2>
        <p>Ta en skärmdump av sammanfattningen och SMS:a till domare.</p>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
