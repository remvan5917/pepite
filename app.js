/* =========================================================
   Pépite — petit compagnon de sport façon Tamagotchi
   Tout est stocké sur le téléphone (localStorage).
   ========================================================= */
'use strict';

const STORE_KEY = 'pepite-v1';
const DEFAULT_MODEL = 'qwen/qwen3.8-27b';
const RETIRED_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const WATER_GOAL = 6;

const COLORS = {
  rose:   { main: '#ff8fc2', dark: '#e8609f', name: 'Rose' },
  violet: { main: '#b59cff', dark: '#8a6cf0', name: 'Violet' },
  bleu:   { main: '#7cc8ff', dark: '#4aa3e8', name: 'Bleu' },
  vert:   { main: '#7fe0b0', dark: '#40b985', name: 'Vert' },
  jaune:  { main: '#ffd56b', dark: '#f0ad2e', name: 'Jaune' },
  peche:  { main: '#ffab8a', dark: '#ef7d5a', name: 'Pêche' },
};

const STAGES = [
  { name: 'Œuf',       xp: 0,    emoji: '🥚' },
  { name: 'Bébé',      xp: 15,   emoji: '🐣' },
  { name: 'Junior',    xp: 150,  emoji: '🎽' },
  { name: 'Athlète',   xp: 500,  emoji: '🏅' },
  { name: 'Champion',  xp: 1200, emoji: '🦸' },
  { name: 'Légende',   xp: 2500, emoji: '👑' },
];

const SPORTS = {
  course:   { label: 'Course',   ic: '🏃‍♀️', unit: 'km', xpPer: 6 },
  natation: { label: 'Natation', ic: '🏊‍♀️', unit: 'm',  xpPer: 0.04 },
  velo:     { label: 'Vélo',     ic: '🚴‍♀️', unit: 'km', xpPer: 1.5 },
  marche:   { label: 'Marche',   ic: '🚶‍♀️', unit: 'km', xpPer: 2 },
  renfo:    { label: 'Renfo',    ic: '💪',   unit: null },
  autre:    { label: 'Autre',    ic: '✨',   unit: null },
};

const FEELINGS = [
  { v: 1, e: '😵', t: 'Dur' },
  { v: 2, e: '😮‍💨', t: 'Fatiguée' },
  { v: 3, e: '🙂', t: 'Bien' },
  { v: 4, e: '😄', t: 'Super' },
  { v: 5, e: '🤩', t: 'Au top' },
];

const SNACKS = ['🍓', '🍌', '🍎', '🍇', '🥝', '🍊', '🍉', '🫐'];

const BADGES = [
  { id: 'first',   ic: '🐣', t: '1re séance',        test: s => s.n >= 1 },
  { id: 's5',      ic: '⭐', t: '5 séances',         test: s => s.n >= 5 },
  { id: 's20',     ic: '🌟', t: '20 séances',        test: s => s.n >= 20 },
  { id: 's50',     ic: '🏆', t: '50 séances',        test: s => s.n >= 50 },
  { id: 'run10',   ic: '👟', t: '10 km courus',      test: s => s.run >= 10 },
  { id: 'run50',   ic: '🏅', t: '50 km courus',      test: s => s.run >= 50 },
  { id: 'swim1',   ic: '🐬', t: '1 km nagé',         test: s => s.swim >= 1000 },
  { id: 'swim10',  ic: '🧜‍♀️', t: '10 km nagés',      test: s => s.swim >= 10000 },
  { id: 'h10',     ic: '⏱️', t: '10 h de sport',     test: s => s.min >= 600 },
  { id: 'streak3', ic: '🔥', t: '3 jours de suite',  test: s => s.bestStreak >= 3 },
  { id: 'multi',   ic: '🌈', t: '3 sports différents', test: s => s.kinds >= 3 },
  { id: 'early',   ic: '🌅', t: 'Séance avant 8 h',  test: s => s.early },
  { id: 'water',   ic: '💧', t: `${WATER_GOAL} verres en 1 jour`, test: s => s.waterGoal },
  { id: 'friend',  ic: '💌', t: '20 messages',       test: s => s.msgs >= 20 },
  { id: 'legend',  ic: '👑', t: 'Stade Légende',     test: s => s.stage >= 5 },
  { id: 'rest',    ic: '🛌', t: 'Bien dormi',        test: s => s.slept },
];

/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const dayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const fmtNum = n => (Math.round(n * 10) / 10).toLocaleString('fr-FR');

/* ---------------- state ---------------- */
let S = load();
if (S && (!S.settings.model || RETIRED_MODELS.includes(S.settings.model))) S.settings.model = DEFAULT_MODEL;

function freshState(prenom, petName, color) {
  const now = Date.now();
  return {
    v: 1,
    user: { prenom },
    pet: { name: petName, color, born: now, xp: 0, sleeping: false, sleepSince: null,
           stats: { forme: 60, joie: 80, energie: 80 }, lastTick: now },
    water: { day: dayKey(), glasses: 0, goalDays: 0 },
    snacks: { day: dayKey(), n: 0 },
    workouts: [],
    chat: [],
    badges: [],
    slept: false,
    settings: { key: '', model: DEFAULT_MODEL },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* stockage plein ou bloqué */ }
}

/* Les stats évoluent avec le temps, même app fermée */
function tick() {
  if (!S) return;
  const now = Date.now();
  const h = Math.max(0, (now - S.pet.lastTick) / 3.6e6);
  const st = S.pet.stats;
  st.forme = clamp(st.forme - 0.5 * h);
  st.joie = clamp(st.joie - 0.9 * h, 10);         // ne tombe jamais tout à fait à zéro
  if (S.pet.sleeping) {
    st.energie = clamp(st.energie + 14 * h);
    if (now - S.pet.sleepSince > 7 * 3.6e6) S.slept = true;
    if (st.energie >= 100 && now - S.pet.sleepSince > 10 * 3.6e6) wake(true);
  } else {
    st.energie = clamp(st.energie - 1.1 * h, 5);
  }
  if (S.water.day !== dayKey()) S.water = { day: dayKey(), glasses: 0, goalDays: S.water.goalDays || 0 };
  if (S.snacks.day !== dayKey()) S.snacks = { day: dayKey(), n: 0 };
  S.pet.lastTick = now;
}

function stageOf(xp) {
  let i = 0;
  STAGES.forEach((s, k) => { if (xp >= s.xp) i = k; });
  return i;
}
function waterPct() { return clamp((S.water.glasses / WATER_GOAL) * 100); }
function moodScore() {
  const st = S.pet.stats;
  return st.forme * 0.35 + st.joie * 0.35 + st.energie * 0.2 + waterPct() * 0.1;
}
function mood() {
  if (S.pet.sleeping) return 'sleep';
  const m = moodScore();
  if (m >= 72) return 'super';
  if (m >= 50) return 'content';
  if (m >= 30) return 'bof';
  return 'triste';
}

/* ---------------- dessin du compagnon (SVG) ---------------- */
function petSVG({ stage, color, mood: md, xp = 0 }) {
  const c = COLORS[color] || COLORS.rose;
  if (stage === 0) {
    const crack = xp >= 5;
    const crack2 = xp >= 10;
    return `<svg viewBox="0 0 200 200"><g class="egg-wobble">
      <ellipse cx="100" cy="118" rx="54" ry="66" fill="#fff6e6" stroke="#f0dcc0" stroke-width="3"/>
      <ellipse cx="78" cy="96" rx="11" ry="9" fill="${c.main}"/>
      <ellipse cx="124" cy="132" rx="14" ry="11" fill="${c.main}"/>
      <ellipse cx="92" cy="152" rx="8" ry="6" fill="${c.main}"/>
      <ellipse cx="128" cy="88" rx="6" ry="5" fill="${c.main}"/>
      <ellipse cx="82" cy="84" rx="10" ry="16" fill="#fff" opacity=".7" transform="rotate(-20 82 84)"/>
      ${crack ? `<path d="M66 110 L78 102 L86 114 L96 104 L104 116" fill="none" stroke="#c9a77c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${crack2 ? `<path d="M110 92 L118 100 L126 90 L134 100" fill="none" stroke="#c9a77c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    </g></svg>`;
  }
  const scale = [0, 0.72, 0.82, 0.9, 0.96, 1][stage];
  const ink = '#3b2a4a';
  let eyes, mouth;
  if (md === 'sleep') {
    eyes = `<path d="M70 114 Q78 121 86 114 M114 114 Q122 121 130 114" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`;
    mouth = `<ellipse cx="100" cy="137" rx="5" ry="4" fill="${ink}" opacity=".7"/>`;
  } else if (md === 'super') {
    eyes = `<path d="M69 116 Q78 102 87 116 M113 116 Q122 102 131 116" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
    mouth = `<path d="M86 131 Q100 152 114 131 Z" fill="#7a2e4f"/><path d="M93 140 Q100 147 107 140 Q100 136 93 140" fill="#ff7a9c"/>`;
  } else {
    eyes = `<g class="blink"><ellipse cx="78" cy="112" rx="9" ry="12" fill="${ink}"/><circle cx="75" cy="107" r="3.5" fill="#fff"/></g>
            <g class="blink"><ellipse cx="122" cy="112" rx="9" ry="12" fill="${ink}"/><circle cx="119" cy="107" r="3.5" fill="#fff"/></g>`;
    if (md === 'triste') {
      eyes += `<path d="M66 96 L86 101 M134 96 L114 101" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
               <path d="M70 128 q-3 8 0 10 q3 -2 0 -10" fill="#7cc8ff"/>`;
    }
    mouth = {
      content: `<path d="M89 132 Q100 143 111 132" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`,
      bof: `<path d="M91 137 L109 137" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`,
      triste: `<path d="M89 141 Q100 131 111 141" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`,
    }[md] || '';
  }
  const cape = stage >= 4 ? `<path d="M52 104 Q30 170 44 186 L156 186 Q170 170 148 104 Z" fill="#ff5f7e"/><path d="M60 110 Q46 160 56 182" stroke="#e8405f" stroke-width="4" fill="none"/>` : '';
  const band = stage >= 2 ? `<path d="M37 92 Q100 66 163 92" fill="none" stroke="#ff5fa2" stroke-width="10" stroke-linecap="round"/>
      <path d="M160 90 l14 -8 l-2 14 Z M160 90 l16 6 l-12 8 Z" fill="#ff5fa2"/>` : '';
  const medal = stage >= 3 ? `<path d="M88 146 L100 166 L112 146" fill="none" stroke="#7c6cff" stroke-width="6" stroke-linejoin="round"/>
      <circle cx="100" cy="168" r="11" fill="#ffd34d" stroke="#f0ad2e" stroke-width="3"/>
      <path d="M100 161 l2.2 4.6 5 .6 -3.7 3.4 1 5 -4.5 -2.5 -4.5 2.5 1 -5 -3.7 -3.4 5 -.6Z" fill="#fff6c8"/>` : '';
  const crown = stage >= 5 ? `<path d="M74 66 L78 38 L90 54 L100 30 L110 54 L122 38 L126 66 Z" fill="#ffd34d" stroke="#f0ad2e" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="100" cy="30" r="4" fill="#ff5fa2"/><circle cx="78" cy="38" r="3" fill="#7cc8ff"/><circle cx="122" cy="38" r="3" fill="#7fe0b0"/>` : '';
  const zzz = md === 'sleep' ? `<g font-family="Baloo 2, sans-serif" font-weight="800" fill="${c.dark}">
      <text x="150" y="70" font-size="22" class="zzz">z</text><text x="162" y="52" font-size="16" class="zzz" style="animation-delay:.8s">z</text></g>` : '';
  return `<svg viewBox="0 0 200 200"><g transform="translate(100 186) scale(${scale}) translate(-100 -186)">
    ${cape}
    <ellipse cx="62" cy="70" rx="14" ry="22" fill="${c.main}" transform="rotate(-22 62 70)"/>
    <ellipse cx="138" cy="70" rx="14" ry="22" fill="${c.main}" transform="rotate(22 138 70)"/>
    <ellipse cx="62" cy="72" rx="6" ry="12" fill="${c.dark}" opacity=".5" transform="rotate(-22 62 72)"/>
    <ellipse cx="138" cy="72" rx="6" ry="12" fill="${c.dark}" opacity=".5" transform="rotate(22 138 72)"/>
    <ellipse cx="76" cy="180" rx="17" ry="9" fill="${c.dark}"/>
    <ellipse cx="124" cy="180" rx="17" ry="9" fill="${c.dark}"/>
    <ellipse cx="34" cy="130" rx="12" ry="19" fill="${c.dark}" transform="rotate(25 34 130)"/>
    <ellipse cx="166" cy="130" rx="12" ry="19" fill="${c.dark}" transform="rotate(-25 166 130)"/>
    <ellipse cx="100" cy="122" rx="70" ry="62" fill="${c.main}"/>
    <ellipse cx="100" cy="142" rx="42" ry="32" fill="#fff" opacity=".35"/>
    <ellipse cx="70" cy="80" rx="14" ry="8" fill="#fff" opacity=".45" transform="rotate(-25 70 80)"/>
    ${band}
    ${eyes}
    <ellipse cx="62" cy="130" rx="11" ry="6.5" fill="#ff6f9f" opacity=".45"/>
    <ellipse cx="138" cy="130" rx="11" ry="6.5" fill="#ff6f9f" opacity=".45"/>
    ${mouth}
    ${medal}
    ${crown}
    ${zzz}
  </g></svg>`;
}

/* ---------------- phrases toutes prêtes ---------------- */
function idleLine() {
  const st = S.pet.stats, p = S.user.prenom, hr = new Date().getHours();
  if (S.pet.sleeping) return 'Zzz… 💤';
  if (stageOf(S.pet.xp) === 0) return pick(['Toc toc… fais une séance pour me faire éclore ! 🥚', 'Je bouge un peu là-dedans… 🥚✨']);
  if (st.energie < 20) return pick(['Je suis toute crevée… un petit dodo ? 😴', 'Mes paupières sont lourdes… 💤']);
  if (S.water.glasses < 2 && hr >= 11) return pick([`On boit un verre d'eau, ${p} ? 💧`, "J'ai soif ! Et toi ? 💧"]);
  if (st.forme < 30) return pick(['On va bouger un peu ensemble ? 🏃‍♀️', "J'ai des fourmis dans les pattes ! 🐜", 'Même 10 minutes, ça compte ! ✨']);
  if (st.joie < 35) return pick(['Tu me fais un câlin ? 🥺', 'Tu viens me parler ? 💬']);
  if (hr < 10) return pick([`Bonjour ${p} ! ☀️`, 'Bien dormi ? 🌞']);
  if (hr >= 21) return pick(['Bientôt l\'heure du dodo… 🌙', `Bonne soirée ${p} ✨`]);
  return pick([`Coucou ${p} ! 💖`, 'Je suis trop content·e de te voir !', "T'es la meilleure 🫶", 'Le repos aussi, ça rend plus fort·e 💤', 'On est une super équipe ! ✨']);
}

/* ---------------- rendu ---------------- */
let currentTab = 'home';

function render() {
  if (!S) return;
  tick();
  const stage = stageOf(S.pet.xp);
  const md = mood();
  $('#hdr-name').textContent = S.pet.name;
  $('#hdr-stage').textContent = `${STAGES[stage].emoji} ${STAGES[stage].name}`;

  const petEl = $('#pet');
  const key = `${stage}|${S.pet.color}|${md}|${stage === 0 ? Math.min(S.pet.xp, 10) : ''}`;
  if (petEl.dataset.k !== key) { petEl.innerHTML = petSVG({ stage, color: S.pet.color, mood: md, xp: S.pet.xp }); petEl.dataset.k = key; }
  petEl.classList.toggle('sleep', S.pet.sleeping);

  const next = STAGES[stage + 1];
  const base = STAGES[stage].xp;
  $('#xp-label').textContent = `${Math.round(S.pet.xp)} XP`;
  $('#xp-next').textContent = next ? `${STAGES[stage + 1].emoji} ${next.name} à ${next.xp}` : 'Niveau max 👑';
  $('#xp-fill').style.width = next ? `${((S.pet.xp - base) / (next.xp - base)) * 100}%` : '100%';

  const bars = { forme: S.pet.stats.forme, joie: S.pet.stats.joie, energie: S.pet.stats.energie, eau: waterPct() };
  for (const [k, v] of Object.entries(bars)) {
    const el = $(`#st-${k}`);
    el.style.width = `${Math.max(4, v)}%`;
    el.classList.toggle('low', v < 25);
  }
  $('#act-sleep').innerHTML = S.pet.sleeping ? '<b>🌞</b>Réveil' : '<b>😴</b>Dodo';
  $('#act-water').innerHTML = `<b>💧</b>${S.water.glasses}/${WATER_GOAL}`;

  const sk = streak();
  const week = activeDaysThisWeek();
  $('#streak').textContent = sk >= 2 ? `🔥 ${sk} jours d'affilée · ${week} jour${week > 1 ? 's' : ''} actif${week > 1 ? 's' : ''} cette semaine`
    : week ? `✨ ${week} jour${week > 1 ? 's' : ''} actif${week > 1 ? 's' : ''} cette semaine` : '';

  if (currentTab === 'journal') renderJournal();
}

function say(text, ms = 6000) {
  const b = $('#bubble');
  b.textContent = text;
  clearTimeout(say._t);
  say._t = setTimeout(() => { b.textContent = ''; }, ms);
}

function toast(t) {
  const el = $('#toast');
  el.textContent = t;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}

function animPet(cls) {
  const p = $('#pet');
  p.classList.remove('jump', 'wiggle');
  void p.offsetWidth;
  p.classList.add(cls);
  setTimeout(() => p.classList.remove(cls), 1100);
}

function floatFx(emoji, n = 4) {
  const fx = $('#fx');
  for (let i = 0; i < n; i++) {
    const h = document.createElement('span');
    h.className = 'heart';
    h.textContent = emoji;
    h.style.left = `${40 + Math.random() * 20}%`;
    h.style.top = `${40 + Math.random() * 15}%`;
    h.style.animationDelay = `${i * 0.12}s`;
    fx.appendChild(h);
    setTimeout(() => h.remove(), 1600 + i * 120);
  }
}

function confetti(n = 70) {
  const cols = ['#ff5fa2', '#7c6cff', '#ffd34d', '#3ccf91', '#7cc8ff', '#ff9a6b'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = pick(cols);
    c.style.animationDuration = `${1.8 + Math.random() * 1.8}s`;
    c.style.animationDelay = `${Math.random() * 0.4}s`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}

function levelUp(stage) {
  confetti(110);
  const o = document.createElement('div');
  o.className = 'levelup';
  const title = stage === 1 ? `${S.pet.name} est né·e ! 🐣` : `${S.pet.name} devient ${STAGES[stage].name} !`;
  o.innerHTML = `<div class="box"><div class="pet">${petSVG({ stage, color: S.pet.color, mood: 'super' })}</div>
    <h1>${esc(title)}</h1><p class="muted">${stage === 1 ? 'Merci de m\'avoir fait éclore 💖' : 'Tout ça grâce à toi, bravo ! ✨'}</p>
    <button class="btn primary big">Trop bien !</button></div>`;
  o.querySelector('button').onclick = () => o.remove();
  document.body.appendChild(o);
}

/* ---------------- stats sport ---------------- */
function streak() {
  const days = new Set(S.workouts.map(w => dayKey(w.date)));
  let d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function bestStreak() {
  const days = [...new Set(S.workouts.map(w => dayKey(w.date)))].sort();
  let best = 0, cur = 0, prev = null;
  for (const k of days) {
    const t = new Date(k + 'T12:00').getTime();
    cur = prev && Math.round((t - prev) / 864e5) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return best;
}
function activeDaysThisWeek() {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return new Set(S.workouts.filter(w => w.date >= monday.getTime()).map(w => dayKey(w.date))).size;
}
function summary() {
  const w = S.workouts;
  return {
    n: w.length,
    min: w.reduce((a, x) => a + x.duree, 0),
    run: w.filter(x => x.type === 'course').reduce((a, x) => a + (x.dist || 0), 0),
    swim: w.filter(x => x.type === 'natation').reduce((a, x) => a + (x.dist || 0), 0),
    kinds: new Set(w.map(x => x.type)).size,
    early: w.some(x => new Date(x.date).getHours() < 8),
    bestStreak: bestStreak(),
    waterGoal: (S.water.goalDays || 0) > 0,
    msgs: S.chat.filter(m => m.role === 'user').length,
    stage: stageOf(S.pet.xp),
    slept: !!S.slept,
  };
}
function checkBadges() {
  const s = summary();
  const fresh = BADGES.filter(b => !S.badges.includes(b.id) && b.test(s));
  fresh.forEach((b, i) => {
    S.badges.push(b.id);
    setTimeout(() => toast(`Nouveau badge : ${b.ic} ${b.t}`), 900 + i * 2600);
  });
  if (fresh.length) save();
}

function xpFor(type, duree, dist) {
  const sp = SPORTS[type];
  return Math.max(5, Math.round(duree + (sp.unit ? (dist || 0) * sp.xpPer : 0)));
}

/* ---------------- actions ---------------- */
let lastPat = 0;
function onPetTap() {
  if (!S) return;
  if (S.pet.sleeping) { say('Chut… je dors 💤 (bouton Réveil pour me réveiller)'); animPet('wiggle'); return; }
  const now = Date.now();
  floatFx(pick(['💖', '💗', '✨', '💕']), 3);
  animPet('jump');
  if (now - lastPat > 2500) {
    S.pet.stats.joie = clamp(S.pet.stats.joie + 2);
    lastPat = now;
    save();
    say(stageOf(S.pet.xp) === 0 ? 'Toc toc ! 🥚' : pick(['Hihi ça chatouille ! 😆', 'Encore ! 💖', 'Je t\'adore ! 🫶', idleLine()]), 3500);
    render();
  }
}

function drinkWater() {
  if (S.water.glasses >= 12) { say('Ça fait déjà beaucoup d\'eau pour aujourd\'hui ! 🌊'); return; }
  S.water.glasses++;
  S.pet.stats.joie = clamp(S.pet.stats.joie + 2);
  if (S.water.glasses === WATER_GOAL) {
    S.water.goalDays = (S.water.goalDays || 0) + 1;
    confetti(40);
    say(`Objectif hydratation atteint ! ${WATER_GOAL} verres 💧🎉`);
  } else {
    say(pick(['Glou glou ! 💧', 'Ahhh, ça fait du bien ! 💧', 'Hydratée comme une championne ! 💦']), 3000);
  }
  floatFx('💧', 3);
  animPet('jump');
  save(); render(); checkBadges();
}

function giveSnack() {
  if (S.pet.sleeping) { say('Zzz… plus tard 💤'); return; }
  if (S.snacks.n >= 3) { say('Merci mais je n\'ai plus faim ! 😊', 3500); animPet('wiggle'); return; }
  const f = pick(SNACKS);
  S.snacks.n++;
  S.pet.stats.energie = clamp(S.pet.stats.energie + 12);
  S.pet.stats.joie = clamp(S.pet.stats.joie + 4);
  floatFx(f, 3);
  animPet('jump');
  say(`Miam, ${f} ! Merci !`, 3000);
  save(); render();
}

function wake(auto = false) {
  S.pet.sleeping = false;
  S.pet.sleepSince = null;
  if (!auto) { say(pick(['Bien dormi ! ☀️', 'Je suis en pleine forme ! 🌞'])); animPet('jump'); }
}
function toggleSleep() {
  if (S.pet.sleeping) wake();
  else {
    S.pet.sleeping = true;
    S.pet.sleepSince = Date.now();
    say('Bonne nuit… 🌙', 3000);
  }
  save(); render(); checkBadges();
}

/* ---------------- formulaire séance ---------------- */
let form = { type: 'course', feel: 4 };

function buildSportForm() {
  $('#sport-types').innerHTML = Object.entries(SPORTS).map(([k, s]) =>
    `<button type="button" data-k="${k}" class="${k === form.type ? 'on' : ''}"><b>${s.ic}</b>${s.label}</button>`).join('');
  $('#feelings').innerHTML = FEELINGS.map(f =>
    `<button type="button" data-v="${f.v}" class="${f.v === form.feel ? 'on' : ''}">${f.e}<small>${f.t}</small></button>`).join('');
  const sp = SPORTS[form.type];
  $('#f-dist').closest('label').style.visibility = sp.unit ? 'visible' : 'hidden';
  $('#f-dist-label').textContent = sp.unit === 'm' ? 'Distance (m)' : 'Distance (km)';
  $('#f-dist').step = sp.unit === 'm' ? '25' : '0.1';
}

async function saveWorkout() {
  const duree = parseInt($('#f-duree').value, 10);
  if (!duree || duree < 1 || duree > 600) { toast('Indique la durée en minutes ⏱️'); $('#f-duree').focus(); return; }
  const sp = SPORTS[form.type];
  const dist = sp.unit ? parseFloat(String($('#f-dist').value).replace(',', '.')) || 0 : 0;
  const note = $('#f-note').value.trim();
  const xp = xpFor(form.type, duree, dist);
  const before = stageOf(S.pet.xp);
  const w = { id: Date.now(), date: Date.now(), type: form.type, duree, dist, feel: form.feel, note, xp };
  S.workouts.unshift(w);
  S.pet.xp += xp;
  const st = S.pet.stats;
  st.forme = clamp(st.forme + 15 + Math.min(25, duree / 2));
  st.joie = clamp(st.joie + 10 + (form.feel >= 4 ? 5 : 0));
  st.energie = clamp(st.energie - Math.min(30, duree / 3), 5);
  if (S.pet.sleeping) wake(true);
  save();

  $('#f-duree').value = ''; $('#f-dist').value = ''; $('#f-note').value = '';
  switchTab('home');
  const after = stageOf(S.pet.xp);
  confetti();
  animPet('jump');
  floatFx('⭐', 5);
  toast(`+${xp} XP ✨`);
  render();
  if (after > before) setTimeout(() => levelUp(after), 700);
  setTimeout(checkBadges, after > before ? 2500 : 600);

  // Réaction du compagnon
  const canned = cannedWorkoutReaction(w);
  say(canned, 9000);
  if (S.settings.key) {
    const desc = describeWorkout(w);
    try {
      const reply = await askAI([{ role: 'user', content: `[Info appli, pas un message de ${S.user.prenom}] Elle vient d'enregistrer une séance : ${desc}. Réagis en 1 à 2 phrases courtes, comme son compagnon fier d'elle.` }], 120);
      say(reply, 11000);
      S.chat.push({ role: 'assistant', content: reply, t: Date.now() });
      trimChat(); save();
    } catch (e) { /* on garde la phrase toute prête */ }
  }
}

function describeWorkout(w) {
  const sp = SPORTS[w.type];
  const d = w.dist ? `, ${fmtNum(w.dist)} ${sp.unit}` : '';
  const f = FEELINGS.find(x => x.v === w.feel);
  return `${sp.label} ${w.duree} min${d}, ressenti « ${f ? f.t : '?'} »${w.note ? `, son mot : "${w.note}"` : ''}`;
}

function cannedWorkoutReaction(w) {
  const sp = SPORTS[w.type];
  if (w.feel <= 2) return pick(['Bravo d\'y être allée même si c\'était dur ! Repose-toi bien 💖', 'Les séances difficiles, ce sont celles qui comptent le plus 💪 Pense à bien boire !']);
  const byType = {
    course: ['Tu as couru comme une fusée ! 🚀', 'Quelle foulée ! 🏃‍♀️💨'],
    natation: ['Splash ! Une vraie sirène 🧜‍♀️', 'Tu nages comme un dauphin ! 🐬'],
    velo: ['Ça roule ! 🚴‍♀️✨'],
    marche: ['Chaque pas compte ! 🚶‍♀️💖'],
    renfo: ['Force et courage ! 💪'],
    autre: ['Trop fort·e ce que tu as fait ! ✨'],
  };
  return `${pick(byType[w.type])} ${sp.ic} +${w.xp} XP`;
}

/* ---------------- IA (Groq) ---------------- */
function systemPrompt() {
  const stage = stageOf(S.pet.xp);
  const st = S.pet.stats;
  const s = summary();
  const last = S.workouts.slice(0, 6).map(w => `- ${new Date(w.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })} : ${describeWorkout(w)}`).join('\n') || '- aucune pour l\'instant';
  const now = new Date();
  return `Tu es ${S.pet.name}, un petit compagnon virtuel façon Tamagotchi qui vit dans le téléphone de ${S.user.prenom}. ${S.user.prenom} s'est mise au sport (course, natation…) et tu l'accompagnes : tu grandis grâce à ses séances.

Ta personnalité : mignon, drôle, enthousiaste, un peu taquin, très bienveillant. Tu tutoies. Tu parles en français, avec quelques emojis (1 à 3 max). Réponses COURTES : 1 à 4 phrases, sauf si elle demande un plan ou une explication.

Ton état actuel : stade « ${STAGES[stage].name} » (${Math.round(S.pet.xp)} XP). Forme ${Math.round(st.forme)}/100, joie ${Math.round(st.joie)}/100, énergie ${Math.round(st.energie)}/100, ${S.water.glasses}/${WATER_GOAL} verres d'eau aujourd'hui${S.pet.sleeping ? ', tu es en train de dormir (tu peux parler à moitié endormi)' : ''}.
Nous sommes le ${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}, il est ${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}.
Son bilan : ${s.n} séances, ${Math.round(s.min / 60 * 10) / 10} h de sport, ${fmtNum(s.run)} km courus, ${fmtNum(s.swim)} m nagés, série actuelle ${streak()} jour(s).
Ses dernières séances :
${last}

Règles importantes :
- Ne parle JAMAIS de poids, de régime, de calories, de minceur ou d'apparence physique. Le sport, c'est pour le plaisir, la santé, la fierté et se sentir bien.
- Valorise la régularité, le plaisir, les progrès, le repos et l'hydratation. Un jour de repos est une bonne chose.
- Tu peux proposer des petits défis doux et adaptés à son niveau (ex. : courir 2 min de plus, 2 longueurs de plus, essayer un nouveau parcours), et donner des conseils simples (échauffement, respiration, étirements, boire de l'eau).
- Si elle parle de douleur, blessure, malaise, vertige ou de quelque chose qui la rend vraiment triste : sois doux, ne donne pas de diagnostic, et encourage-la à en parler à un adulte de confiance ou à un médecin.
- Reste toujours dans ton personnage de petit compagnon. Ne dis pas que tu es un modèle d'IA sauf si on te le demande directement.`;
}

async function askAI(extra, maxTokens = 300) {
  const history = S.chat.slice(-16).map(m => ({ role: m.role, content: m.content }));
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${S.settings.key}` },
    body: JSON.stringify(aiBody([{ role: 'system', content: systemPrompt() }, ...history, ...extra], maxTokens)),
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try { const j = await res.json(); msg += ` : ${j.error?.message || ''}`; } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  const j = await res.json();
  return cleanReply(j.choices?.[0]?.message?.content || '…');
}

function aiBody(messages, maxTokens) {
  const model = S.settings.model || DEFAULT_MODEL;
  const body = { model, messages, temperature: 0.85, max_tokens: maxTokens };
  // Les modèles « qui réfléchissent » : réflexion courte, et on ne garde que la réponse
  if (model.startsWith('openai/gpt-oss')) { body.reasoning_effort = 'low'; body.max_tokens = maxTokens + 300; }
  if (model.startsWith('qwen/')) body.reasoning_format = 'hidden';
  return body;
}

function cleanReply(t) {
  return t.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s*/gm, '').trim() || '…';
}

function offlineReply(text) {
  const t = text.toLowerCase();
  if (/mal|douleur|bless|vertige/.test(t)) return 'Oh non 🥺 Si tu as mal, repose-toi et parles-en à un adulte ou à un médecin, d\'accord ? Je suis là 💖';
  if (/pas envie|flemme|fatigu/.test(t)) return 'C\'est normal d\'avoir des jours sans 😌 Et si on faisait juste 10 minutes tranquilles ? Ou un vrai jour de repos, c\'est bien aussi 💤';
  if (/défi|defi|challenge/.test(t)) return pick(['Défi : 5 minutes de plus que ta dernière séance ! 💪', 'Défi : 2 longueurs de plus à la piscine ! 🏊‍♀️', 'Défi : essaie un nouveau parcours de course ! 🗺️']);
  if (/respir/.test(t)) return 'Expire bien tout l\'air sous l\'eau, et inspire vite et calmement quand tu tournes la tête 🫧';
  if (/merci/.test(t)) return 'Avec plaisir ! 💖';
  return pick(['Je t\'écoute ! 💬 (Pour que je réponde vraiment, ajoute une clé Groq dans les réglages ⚙️)', 'Hihi 😊 Raconte-moi ta prochaine séance !', 'Tu es trop forte, tu le sais ? ✨']);
}

function trimChat() { if (S.chat.length > 80) S.chat = S.chat.slice(-80); }

function renderChat() {
  const log = $('#chat-log');
  const mini = petSVG({ stage: Math.max(1, stageOf(S.pet.xp)), color: S.pet.color, mood: 'content' });
  if (!S.chat.length) {
    log.innerHTML = `<div class="msg bot"><span class="mini">${mini}</span><span>Coucou ${esc(S.user.prenom)} ! Tu peux me parler de tes séances, me demander un défi ou un conseil 💖</span></div>`;
  } else {
    log.innerHTML = S.chat.map(m => m.role === 'user'
      ? `<div class="msg me">${esc(m.content)}</div>`
      : `<div class="msg bot"><span class="mini">${mini}</span><span>${esc(m.content)}</span></div>`).join('');
  }
  log.scrollTop = log.scrollHeight;
  const sugg = ['Donne-moi un petit défi 💪', 'Je n\'ai pas envie aujourd\'hui 😩', 'Comment mieux respirer en nageant ?', 'Un échauffement avant de courir ?', 'Raconte-moi une blague 😂'];
  $('#chat-sugg').innerHTML = sugg.map(s => `<button type="button">${esc(s)}</button>`).join('');
}

let sending = false;
async function sendChat(text) {
  text = text.trim();
  if (!text || sending) return;
  sending = true;
  S.chat.push({ role: 'user', content: text, t: Date.now() });
  S.pet.stats.joie = clamp(S.pet.stats.joie + 3);
  save();
  renderChat();
  const log = $('#chat-log');
  const typing = document.createElement('div');
  typing.className = 'msg bot typing';
  typing.textContent = `${S.pet.name} réfléchit…`;
  log.appendChild(typing);
  log.scrollTop = log.scrollHeight;
  let reply;
  if (S.settings.key) {
    try { reply = await askAI([]); } catch (e) { reply = `Oups, je n'arrive pas à réfléchir là 😵 (${e.message})`; }
  } else {
    await new Promise(r => setTimeout(r, 600));
    reply = offlineReply(text);
  }
  S.chat.push({ role: 'assistant', content: reply, t: Date.now() });
  trimChat();
  save();
  sending = false;
  renderChat();
  checkBadges();
}

/* ---------------- journal ---------------- */
function renderJournal() {
  const s = summary();
  $('#totals').innerHTML = `
    <div><b>${s.n}</b><span>séances</span></div>
    <div><b>${fmtNum(s.min / 60)} h</b><span>de sport</span></div>
    <div><b>${bestStreak()}</b><span>meilleure série</span></div>
    <div><b>${fmtNum(s.run)}</b><span>km courus</span></div>
    <div><b>${fmtNum(s.swim)}</b><span>m nagés</span></div>
    <div><b>${S.badges.length}/${BADGES.length}</b><span>badges</span></div>`;
  $('#badges').innerHTML = BADGES.map(b =>
    `<div class="badge ${S.badges.includes(b.id) ? '' : 'off'}"><b>${b.ic}</b>${esc(b.t)}</div>`).join('');
  $('#history').innerHTML = S.workouts.length ? S.workouts.slice(0, 100).map(w => {
    const sp = SPORTS[w.type];
    const f = FEELINGS.find(x => x.v === w.feel);
    const dt = new Date(w.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    return `<div class="hist"><span class="ic">${sp.ic}</span><div>
      <div class="t">${sp.label} · ${w.duree} min${w.dist ? ` · ${fmtNum(w.dist)} ${sp.unit}` : ''} ${f ? f.e : ''}</div>
      <div class="d">${dt}${w.note ? ' — ' + esc(w.note) : ''}</div></div>
      <span class="xpv">+${w.xp} XP</span><button class="del" data-id="${w.id}" aria-label="Supprimer">✕</button></div>`;
  }).join('') : '<p class="muted">Aucune séance pour l\'instant. La première fera éclore ton œuf ! 🥚</p>';
}

function deleteWorkout(id) {
  const w = S.workouts.find(x => x.id === id);
  if (!w || !confirm('Supprimer cette séance ?')) return;
  S.workouts = S.workouts.filter(x => x.id !== id);
  S.pet.xp = Math.max(0, S.pet.xp - w.xp);
  save(); render();
}

/* ---------------- navigation ---------------- */
function switchTab(t) {
  currentTab = t;
  ['home', 'sport', 'chat', 'journal'].forEach(k => $(`#tab-${k}`).classList.toggle('hidden', k !== t));
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  if (t === 'sport') buildSportForm();
  if (t === 'chat') renderChat();
  if (t === 'journal') renderJournal();
  window.scrollTo(0, 0);
}

/* ---------------- réglages ---------------- */
let pickedColor = 'rose';
function colorPicker(el, current, onPick) {
  el.innerHTML = Object.entries(COLORS).map(([k, c]) =>
    `<button type="button" data-c="${k}" title="${c.name}" style="background:${c.main}" class="${k === current ? 'on' : ''}"></button>`).join('');
  el.onclick = e => {
    const b = e.target.closest('button[data-c]');
    if (!b) return;
    el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    onPick(b.dataset.c);
  };
}

function openSettings() {
  $('#s-key').value = S.settings.key || '';
  $('#s-model').value = S.settings.model || DEFAULT_MODEL;
  $('#s-prenom').value = S.user.prenom;
  $('#s-petname').value = S.pet.name;
  $('#s-msg').textContent = '';
  let c = S.pet.color;
  colorPicker($('#s-colors'), c, v => { c = v; });
  $('#settings').returnValue = '';
  $('#settings').showModal();
  $('#settings').onclose = () => {
    if ($('#settings').returnValue !== 'save') return;
    S.settings.key = $('#s-key').value.trim();
    S.settings.model = $('#s-model').value.trim() || DEFAULT_MODEL;
    S.user.prenom = $('#s-prenom').value.trim() || S.user.prenom;
    S.pet.name = $('#s-petname').value.trim() || S.pet.name;
    S.pet.color = c;
    save(); render();
    toast('Réglages enregistrés ✅');
  };
}

async function testAI() {
  const key = $('#s-key').value.trim();
  const msg = $('#s-msg');
  if (!key) { msg.textContent = 'Colle d\'abord ta clé Groq (elle commence par gsk_).'; return; }
  msg.textContent = 'Test en cours…';
  const saved = { ...S.settings };
  S.settings.key = key;
  S.settings.model = $('#s-model').value.trim() || DEFAULT_MODEL;
  try {
    const r = await askAI([{ role: 'user', content: '[Test de l\'appli] Dis bonjour en une phrase.' }], 60);
    msg.textContent = `✅ Ça marche ! « ${r} »`;
  } catch (e) {
    msg.textContent = `❌ ${e.message}`;
  } finally {
    S.settings = saved;
  }
}

function exportData() {
  const data = { ...S, settings: { ...S.settings, key: '' } };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pepite-sauvegarde-${dayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  $('#s-msg').textContent = 'Sauvegarde téléchargée 📦';
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d.pet || !Array.isArray(d.workouts)) throw new Error('fichier invalide');
      const key = S.settings.key;
      S = d;
      S.settings = { ...(d.settings || {}), key: d.settings?.key || key };
      save(); render();
      $('#s-msg').textContent = 'Sauvegarde restaurée ✅';
    } catch (e) { $('#s-msg').textContent = `❌ Impossible de lire ce fichier (${e.message})`; }
  };
  r.readAsText(file);
}

/* ---------------- démarrage ---------------- */
function showApp() {
  $('#onboarding').classList.add('hidden');
  ['#topbar', '#main', '#tabbar'].forEach(s => $(s).classList.remove('hidden'));
  render();
  setTimeout(() => say(idleLine()), 500);
}

function showOnboarding() {
  $('#onboarding').classList.remove('hidden');
  $('#ob-egg').innerHTML = petSVG({ stage: 0, color: pickedColor });
  colorPicker($('#ob-colors'), pickedColor, c => { pickedColor = c; $('#ob-egg').innerHTML = petSVG({ stage: 0, color: c }); });
  $('#ob-go').onclick = () => {
    const prenom = $('#ob-prenom').value.trim();
    const name = $('#ob-petname').value.trim() || 'Pépite';
    if (!prenom) { toast('Écris ton prénom 😊'); $('#ob-prenom').focus(); return; }
    S = freshState(prenom, name, pickedColor);
    save();
    showApp();
  };
}

function bind() {
  $('#pet').addEventListener('click', onPetTap);
  $('#act-sport').onclick = () => switchTab('sport');
  $('#act-water').onclick = drinkWater;
  $('#act-snack').onclick = giveSnack;
  $('#act-sleep').onclick = toggleSleep;
  document.querySelectorAll('#tabbar button').forEach(b => { b.onclick = () => switchTab(b.dataset.tab); });
  $('#sport-types').onclick = e => { const b = e.target.closest('button[data-k]'); if (b) { form.type = b.dataset.k; buildSportForm(); } };
  $('#feelings').onclick = e => { const b = e.target.closest('button[data-v]'); if (b) { form.feel = +b.dataset.v; buildSportForm(); } };
  $('#f-save').onclick = saveWorkout;
  $('#chat-form').onsubmit = e => { e.preventDefault(); const i = $('#chat-input'); sendChat(i.value); i.value = ''; };
  $('#chat-sugg').onclick = e => { const b = e.target.closest('button'); if (b) sendChat(b.textContent); };
  $('#history').onclick = e => { const b = e.target.closest('.del'); if (b) deleteWorkout(+b.dataset.id); };
  $('#btn-settings').onclick = openSettings;
  $('#s-test').onclick = testAI;
  $('#s-export').onclick = exportData;
  $('#s-import').onchange = e => { if (e.target.files[0]) importData(e.target.files[0]); };
  $('#s-reset').onclick = () => {
    if (!confirm(`Vraiment tout effacer ? ${S.pet.name} retournera dans son œuf 🥚`)) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    location.reload();
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S) { render(); say(idleLine()); } });
  setInterval(() => { if (S) { render(); save(); } }, 60000);
  setInterval(() => { if (S && currentTab === 'home' && !$('#bubble').textContent && Math.random() < 0.35) say(idleLine(), 5000); }, 20000);
}

bind();
if (S) showApp(); else showOnboarding();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
