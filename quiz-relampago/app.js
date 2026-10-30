const ROUND_SIZE = 10;
const SECONDS_PER_QUESTION = 15;
const SOURCES = ['data/questions.json', 'data/sample.json'];

const $ = (id) => document.getElementById(id);

const screens = {
  start: $('screen-start'),
  question: $('screen-question'),
  result: $('screen-result'),
};

let bank = [];
let round = [];
let index = 0;
let answers = [];
let timerId = null;
let questionStartedAt = 0;
let answered = false;

function show(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
}

async function loadBank() {
  for (const src of SOURCES) {
    try {
      const res = await fetch(src, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        return { questions: data.questions, src };
      }
    } catch {
      // tenta a próxima fonte
    }
  }
  throw new Error('Nenhum banco de perguntas encontrado.');
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startRound() {
  if (bank.length === 0) return;
  round = shuffle(bank).slice(0, ROUND_SIZE);
  index = 0;
  answers = [];
  show('question');
  renderQuestion();
}

function renderQuestion() {
  const q = round[index];
  answered = false;

  $('q-count').textContent = `Pergunta ${index + 1} de ${round.length}`;
  $('q-category').textContent = q.category;
  $('q-prompt').textContent = q.prompt;

  const progress = document.querySelector('.progress');
  progress.setAttribute('aria-valuemax', String(round.length));
  progress.setAttribute('aria-valuenow', String(index));
  $('progress-bar').style.width = `${(index / round.length) * 100}%`;

  const list = $('q-options');
  list.replaceChildren(
    ...q.options.map((text, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      btn.dataset.index = String(i);
      btn.innerHTML = `<span class="key">${i + 1}</span><span class="label"></span><span class="mark" aria-hidden="true"></span>`;
      btn.querySelector('.label').textContent = text;
      btn.addEventListener('click', () => answer(i));
      li.append(btn);
      return li;
    }),
  );

  $('feedback').hidden = true;
  $('q-prompt').focus();
  startTimer();
}

function startTimer() {
  stopTimer();
  questionStartedAt = performance.now();
  updateTimer(SECONDS_PER_QUESTION);
  timerId = setInterval(() => {
    const elapsed = (performance.now() - questionStartedAt) / 1000;
    const left = Math.max(0, SECONDS_PER_QUESTION - elapsed);
    updateTimer(left);
    if (left === 0) answer(null);
  }, 100);
}

function stopTimer() {
  if (timerId !== null) clearInterval(timerId);
  timerId = null;
}

function updateTimer(left) {
  const timer = $('q-timer');
  timer.textContent = String(Math.ceil(left));
  timer.classList.toggle('is-low', left <= 5);
  $('time-bar').style.width = `${(left / SECONDS_PER_QUESTION) * 100}%`;
}

// choice === null significa que o tempo acabou
function answer(choice) {
  if (answered) return;
  answered = true;
  stopTimer();

  const q = round[index];
  const seconds = Math.min(SECONDS_PER_QUESTION, (performance.now() - questionStartedAt) / 1000);
  const correct = choice === q.answerIndex;
  answers.push({ correct, timedOut: choice === null, seconds });

  for (const btn of $('q-options').querySelectorAll('.option')) {
    const i = Number(btn.dataset.index);
    btn.disabled = true;
    if (i === q.answerIndex) {
      btn.classList.add('is-correct');
      btn.querySelector('.mark').textContent = '✓ correta';
    } else if (i === choice) {
      btn.classList.add('is-wrong');
      btn.querySelector('.mark').textContent = '✗ sua resposta';
    }
  }

  const title = $('feedback-title');
  title.className = `feedback-title ${correct ? 'is-ok' : 'is-err'}`;
  title.textContent = correct ? 'Certo!' : choice === null ? 'Tempo esgotado' : 'Errado';
  $('feedback-text').textContent = q.explanation ?? '';
  $('btn-next').textContent = index + 1 < round.length ? 'Próxima' : 'Ver resultado';
  $('feedback').hidden = false;
  $('btn-next').focus();
}

function next() {
  index += 1;
  if (index < round.length) renderQuestion();
  else renderResult();
}

function renderResult() {
  const hits = answers.filter((a) => a.correct).length;
  const timeouts = answers.filter((a) => a.timedOut).length;
  const avg = answers.reduce((sum, a) => sum + a.seconds, 0) / answers.length;

  $('result-title').textContent = `${hits} de ${answers.length}`;
  $('stat-hits').textContent = `${Math.round((hits / answers.length) * 100)}%`;
  $('stat-time').textContent = `${avg.toFixed(1)} s`;
  $('stat-timeouts').textContent = String(timeouts);
  show('result');
  $('btn-restart').focus();
}

document.addEventListener('keydown', (event) => {
  if (screens.question.hidden || answered) return;
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  const n = Number(event.key);
  if (Number.isInteger(n) && n >= 1 && n <= round[index].options.length) {
    event.preventDefault();
    answer(n - 1);
  }
});

$('btn-start').addEventListener('click', startRound);
$('btn-next').addEventListener('click', next);
$('btn-restart').addEventListener('click', startRound);

async function init() {
  const btn = $('btn-start');
  const status = $('load-status');
  try {
    const { questions, src } = await loadBank();
    bank = questions;
    if (src.endsWith('sample.json')) {
      status.textContent = `Modo amostra: ${questions.length} perguntas.`;
    }
    btn.textContent = 'Começar';
    btn.disabled = false;
    btn.focus();
  } catch (err) {
    status.textContent = `${err.message} Verifique se data/questions.json existe e recarregue a página.`;
    status.classList.add('is-error');
    btn.textContent = 'Tentar de novo';
    btn.disabled = false;
    btn.onclick = () => location.reload();
  }
}

init();
