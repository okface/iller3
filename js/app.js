/* MedQ Trainer App */
// Data + State
let ALL_QUESTIONS = [];
let filteredQuestions = [];
let currentSession = null; // { questions:[], index, answers:[], startTime }
const STORAGE_KEY = 'medq_trainer_v1';
let store = loadStore();

function loadStore(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { stats:{ perCategory:{}, daily:{}, totalAnswered:0, totalCorrect:0 }, lastSession:null }; } catch(e){ return { stats:{ perCategory:{}, daily:{}, totalAnswered:0, totalCorrect:0 }, lastSession:null }; }
}
function saveStore(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
function todayKey(){ return new Date().toISOString().slice(0,10); }

// Fetch + parse YAML
async function loadQuestions(){
  const res = await fetch('data/questions.yaml');
  const text = await res.text();
  const data = jsyaml.load(text); // array
  ALL_QUESTIONS = data.filter(q=>q.uses_image === false);
  buildCategoryCaches();
  renderCategoryChips();
  refreshDashboard();
  hydrateCustomDialog();
  maybeResume();
}

function buildCategoryCaches(){
  // map categories ensuring not null
  ALL_QUESTIONS.forEach(q=>{ if(!q.category) q.category = 'Uncategorized'; });
}

// DOM refs
const startView = document.getElementById('startView');
const quizView = document.getElementById('quizView');
const summaryView = document.getElementById('summaryView');
const globalProgressEl = document.getElementById('globalProgress');
const weakCategoryList = document.getElementById('weakCategoryList');
const allCategoryList = document.getElementById('allCategoryList');
const optionsList = document.getElementById('optionsList');
const questionText = document.getElementById('quizHeading');
const questionProgress = document.getElementById('questionProgress');
const answerFeedback = document.getElementById('answerFeedback');
const nextBtn = document.getElementById('nextQuestionBtn');
const endBtn = document.getElementById('endSessionBtn');
const summaryStats = document.getElementById('summaryStats');
const reviewList = document.getElementById('reviewList');
const restartWeakBtn = document.getElementById('restartWeakBtn');
const returnHomeBtn = document.getElementById('returnHomeBtn');
const customDialog = document.getElementById('customDialog');
const customSessionBtn = document.getElementById('customSessionBtn');
const customChecklist = document.getElementById('customCategoryChecklist');
const customCountInput = document.getElementById('customCount');
const startCustomBtn = document.getElementById('startCustomBtn');
const backBtn = document.getElementById('backToStart');
const sessionMeta = document.getElementById('sessionMeta');

// Event Listeners
Array.from(document.querySelectorAll('.quick-btn')).forEach(btn=>{
  btn.addEventListener('click', ()=> startNewSession({ count: parseInt(btn.dataset.size), categories: null }));
});
customSessionBtn.addEventListener('click', ()=> { customDialog.showModal(); });
startCustomBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  const selected = Array.from(customChecklist.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.value);
  startNewSession({ count: parseInt(customCountInput.value)||10, categories: selected.length?selected:null });
  customDialog.close();
});
backBtn.addEventListener('click', ()=>{ if(confirm('End current session?')) { endSession(); showView(startView); } });
nextBtn.addEventListener('click', ()=>{
  if(!currentSession) return; if(currentSession.index < currentSession.questions.length-1){ currentSession.index++; renderQuestion(); } else { finalizeSession(); }
});
endBtn.addEventListener('click', ()=> finalizeSession());
restartWeakBtn.addEventListener('click', ()=>{
  const weakCats = getWeakCategories().map(c=>c.name);
  startNewSession({ count: Math.min(10, ALL_QUESTIONS.length), categories: weakCats.length?weakCats:null });
});
returnHomeBtn.addEventListener('click', ()=>{ showView(startView); refreshDashboard(); });

function showView(v){ [startView, quizView, summaryView].forEach(sec=>{ if(sec===v){ sec.hidden=false; sec.classList.add('active'); } else { sec.hidden=true; sec.classList.remove('active'); } }); window.scrollTo({top:0, behavior:'instant'}); }

function startNewSession({ count, categories }){
  if(!ALL_QUESTIONS.length) return;
  const pool = categories && categories.length ? ALL_QUESTIONS.filter(q=> categories.includes(q.category)) : [...ALL_QUESTIONS];
  shuffle(pool);
  const picked = pool.slice(0, Math.min(count, pool.length)).map(q=>({ ...q }));
  currentSession = { questions: picked, index:0, answers:[], startTime: Date.now(), categories, size: picked.length };
  store.lastSession = currentSession;
  saveStore();
  showView(quizView);
  renderQuestion();
}

function maybeResume(){
  if(store.lastSession && store.lastSession.questions && store.lastSession.questions.length){
    // Offer resume via a chip or auto restore? We'll add a resume card.
    const resumeCard = document.createElement('div');
    resumeCard.className='card';
    resumeCard.innerHTML = `<h3>Resume</h3><div class="big">${store.lastSession.questions.length - (store.lastSession.index||0)} left</div><small>Tap to continue</small>`;
    resumeCard.addEventListener('click', ()=>{ currentSession = store.lastSession; showView(quizView); renderQuestion(); });
    globalProgressEl.prepend(resumeCard);
  }
}

function renderQuestion(){
  const q = currentSession.questions[currentSession.index];
  questionText.textContent = q.question;
  optionsList.innerHTML='';
  answerFeedback.hidden = true; answerFeedback.innerHTML='';
  nextBtn.disabled = true;
  sessionMeta.textContent = (q.category||'Uncategorized');
  questionProgress.textContent = `${currentSession.index+1}/${currentSession.size}`;
  const optionTemplate = document.getElementById('optionTemplate');
  q.options.forEach((opt, idx)=>{
    const li = optionTemplate.content.firstElementChild.cloneNode(true);
    const btn = li.querySelector('button');
    btn.textContent = opt;
    btn.addEventListener('click', ()=> selectAnswer(idx, btn));
    optionsList.appendChild(li);
  });
}

function selectAnswer(idx, btn){
  const q = currentSession.questions[currentSession.index];
  if(q.answered) return; // prevent double
  q.answered = true; q.selected = idx; q.correct = (idx === q.correct_option_index);
  currentSession.answers.push({ number:q.number, correct:q.correct, selected:idx, correctIndex:q.correct_option_index });
  // mark UI
  optionsList.querySelectorAll('.option-btn').forEach((b, i)=>{
    if(i===q.correct_option_index) b.classList.add('correct');
    if(i===idx && !q.correct) b.classList.add('wrong');
    if(i===idx) b.classList.add('selected');
    b.disabled = true;
  });
  showFeedback(q);
  recordStats(q);
  nextBtn.disabled = false;
  store.lastSession = currentSession; saveStore();
}

function showFeedback(q){
  answerFeedback.hidden = false;
  answerFeedback.innerHTML = `<h3>${q.correct? 'Correct':'Incorrect'}</h3><div class="info">${escapeHTML(q.more_information || 'No additional info')}</div>`;
}

function recordStats(q){
  // global
  store.stats.totalAnswered++; if(q.correct) store.stats.totalCorrect++;
  // daily
  const day = todayKey(); if(!store.stats.daily[day]) store.stats.daily[day] = { answered:0, correct:0 };
  store.stats.daily[day].answered++; if(q.correct) store.stats.daily[day].correct++;
  // category
  const cat = q.category || 'Uncategorized'; if(!store.stats.perCategory[cat]) store.stats.perCategory[cat] = { answered:0, correct:0 };
  store.stats.perCategory[cat].answered++; if(q.correct) store.stats.perCategory[cat].correct++;
  saveStore();
}

function finalizeSession(){
  if(!currentSession) return;
  // clear lastSession
  store.lastSession = null; saveStore();
  buildSummary();
  currentSession = null;
  showView(summaryView);
}

function endSession(){ currentSession = null; store.lastSession = null; saveStore(); }

function buildSummary(){
  const answers = store.stats; // for overall
  const s = summaryStats; s.innerHTML='';
  const lastSessionAnswers = (store.lastSession? store.lastSession.answers:[]); // not used after finalize
  const sessionData = lastSessionAnswers; // placeholder
  const session = store.lastSession; // will be null now; we reconstruct from a temp? Instead keep a copy before clearing
  // We'll reconstruct from a backup copy captured earlier.
}

// We'll store previous session answers before clearing
let lastFinishedSession = null;
function finalizeSession(){
  if(!currentSession) return;
  lastFinishedSession = { ...currentSession };
  store.lastSession = null; saveStore();
  renderSummaryFrom(lastFinishedSession);
  currentSession = null;
  showView(summaryView);
}

function renderSummaryFrom(session){
  summaryStats.innerHTML='';
  const answered = session.answers.length;
  const correct = session.answers.filter(a=>a.correct).length;
  const accuracy = answered? Math.round(correct/answered*100):0;
  summaryStats.appendChild(statCard('Answered', answered));
  summaryStats.appendChild(statCard('Correct', correct));
  summaryStats.appendChild(statCard('Accuracy', accuracy+'%'));
  const duration = Math.round((Date.now() - session.startTime)/1000);
  summaryStats.appendChild(statCard('Time', duration+'s'));
  // Review list
  reviewList.innerHTML='';
  const reviewTemplate = document.getElementById('reviewTemplate');
  session.questions.forEach(q=>{
    const det = reviewTemplate.content.firstElementChild.cloneNode(true);
    det.querySelector('.review-q').textContent = q.question;
    const meta = det.querySelector('.review-meta');
    const wasCorrect = q.correct; meta.innerHTML = `<span style="font-size:.65rem; font-weight:600; letter-spacing:.09em; text-transform:uppercase; color:${wasCorrect?'#2f7a44':'#b3261e'}">${wasCorrect?'Correct':'Incorrect'}</span> <span style="font-size:.65rem; opacity:.65; margin-left:.5rem;">${q.category}</span>`;
    const list = det.querySelector('.review-options');
    q.options.forEach((opt,i)=>{
      const li = document.createElement('li');
      const highlight = i===q.correct_option_index? ' ✅':' ';
      const chosen = i===q.selected? ' <mark>chosen</mark>':'';
      li.innerHTML = escapeHTML(opt)+highlight+chosen; list.appendChild(li);
    });
    det.querySelector('.review-info').innerHTML = escapeHTML(q.more_information||'');
    reviewList.appendChild(det);
  });
}

function statCard(label, value){
  const div=document.createElement('div');
  div.className='stat';
  div.innerHTML=`<h3>${label}</h3><div class="value">${value}</div>`;
  return div;
}

function refreshDashboard(){
  globalProgressEl.innerHTML='';
  const totalAnswered = store.stats.totalAnswered;
  const totalCorrect = store.stats.totalCorrect;
  const overallAcc = totalAnswered? Math.round(totalCorrect/totalAnswered*100):0;
  const day = todayKey(); const today = store.stats.daily[day]||{answered:0,correct:0};
  globalProgressEl.appendChild(dashCard('Today', `${today.answered}`, today.answered? `${Math.round(today.correct/today.answered*100)}% acc`:'No answers'));
  globalProgressEl.appendChild(dashCard('Total', `${totalAnswered}`, `${overallAcc}% acc`));
  const weak = getWeakCategories();
  if(weak.length){
    globalProgressEl.appendChild(dashCard('Weak Cats', weak.length, 'Tap below'));
  }
}

function dashCard(title, main, sub){
  const div=document.createElement('div'); div.className='card';
  div.innerHTML=`<h3>${title}</h3><div class="big">${main}</div><small>${sub}</small>`;
  return div;
}

function getWeakCategories(){
  const arr = Object.entries(store.stats.perCategory).map(([name, v])=>{
    const acc = v.answered? v.correct/v.answered:0; return { name, answered:v.answered, acc };
  }).filter(o=> o.answered>=3 && o.acc < 0.6);
  arr.sort((a,b)=> a.acc - b.acc);
  return arr;
}

function renderCategoryChips(){
  const cats = Array.from(new Set(ALL_QUESTIONS.map(q=>q.category || 'Uncategorized'))).sort();
  allCategoryList.innerHTML='';
  cats.forEach(cat=>{
    const chip = document.createElement('button'); chip.type='button'; chip.className='chip'; chip.textContent=cat; chip.addEventListener('click',()=> startNewSession({ count: 10, categories:[cat] }));
    const stats = store.stats.perCategory[cat]; if(stats){ const acc = stats.answered? Math.round(stats.correct/stats.answered*100):'-'; chip.innerHTML = `${cat} <small>${acc}%</small>`; }
    allCategoryList.appendChild(chip);
  });
  // weak categories
  weakCategoryList.innerHTML='';
  const weak = getWeakCategories();
  weak.forEach(w=>{
    const chip = document.createElement('button'); chip.type='button'; chip.className='chip'; chip.dataset.weak='true'; chip.innerHTML=`${w.name} <small>${Math.round(w.acc*100)}%</small>`; chip.addEventListener('click', ()=> startNewSession({ count:10, categories:[w.name] }));
    weakCategoryList.appendChild(chip);
  });
}

function hydrateCustomDialog(){
  const cats = Array.from(new Set(ALL_QUESTIONS.map(q=>q.category)));
  customChecklist.innerHTML='';
  cats.forEach(cat=>{
    const id = 'cat_'+cat.replace(/\W+/g,'_');
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${cat}" id="${id}"><span>${cat}</span>`;
    customChecklist.appendChild(label);
  });
}

function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } }
function escapeHTML(str){ return String(str).replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[s]); }

// Service worker register
if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('service-worker.js')); }

loadQuestions();
