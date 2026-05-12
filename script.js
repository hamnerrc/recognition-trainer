// ——— Element Refs ———
const container = document.getElementById('cube-container');
const answerElement = document.getElementById('answer');
const answerButtons = document.getElementById('answerButtons');
const btnCorrect = document.getElementById('btn-correct');
const btnWrong = document.getElementById('btn-wrong');
const btnBackMenu = document.getElementById('btn-back-menu');
const btnStart = document.getElementById('btn-start');
const btnPracticeMissed = document.getElementById('btn-practice-missed');
const btnShowStats = document.getElementById('btn-show-stats');
const btnClearStats = document.getElementById('btn-clear-stats');
const btnCloseStats = document.getElementById('btn-close-stats');
const btnPrimaryAction = document.getElementById('btn-primary-action');
const menuScreen = document.getElementById('menu-screen');
const statsScreen = document.getElementById('statsScreen');
const statsCards = document.getElementById('statsCards');
const recogInput = document.getElementById('input-recog-time');
const selectCategory = document.getElementById('select-category');
const selectTbldSubset = document.getElementById('select-tbld-subset');
const selectTbldMode = document.getElementById('select-tbld-mode');
const tbldModeWrap = document.getElementById('tbld-mode-wrap');
const statsDisplay = document.getElementById('live-stats');
const promptText = document.getElementById('press-space');
const visualSlot = document.getElementById('visual-slot');

// ——— State ———
let currentCardIndex = 0;
let stage = 'idle';
let recognitionTime = parseFloat(recogInput.value) * 1000;
let practiceMissedMode = false;
let practiceMissedIndices = [];

// ——— Stat keys ———
// OLL / PLL use their own keys.
// Team Blind has two sub-sets: f2l and oll_named — each tracked independently.
const STAT_KEYS = ['oll', 'pll', 'f2l', 'oll_named'];

const missedIndices = Object.fromEntries(STAT_KEYS.map(k => [k, new Set()]));
const seenSet = Object.fromEntries(STAT_KEYS.map(k => [k, new Set()]));
const correctSet = Object.fromEntries(STAT_KEYS.map(k => [k, new Set()]));

// ——— Image data ———
let caseImages = { oll: {}, pll: {}, tbld: {}, oll_named: {} };

// ——— Shuffled Deck — one queue per stat key ———
const NO_REPEAT_WINDOW = 10;
const deckQueue = Object.fromEntries(STAT_KEYS.map(k => [k, []]));
const recentlyShown = Object.fromEntries(STAT_KEYS.map(k => [k, []]));

function fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function refillDeck(key) {
    const total = getCards().length;
    if (total === 0) return;

    const recent = recentlyShown[key].slice(-NO_REPEAT_WINDOW);
    const recentSet = new Set(recent);

    const pool = [];
    for (let i = 0; i < total; i++) {
        if (!recentSet.has(i)) pool.push(i);
    }
    fisherYatesShuffle(pool);

    const tail = fisherYatesShuffle([...recent]);
    deckQueue[key] = [...pool, ...tail];
}

function drawNextIndex(key) {
    if (deckQueue[key].length === 0) refillDeck(key);
    const idx = deckQueue[key].shift();

    recentlyShown[key].push(idx);
    if (recentlyShown[key].length > NO_REPEAT_WINDOW * 2) recentlyShown[key].shift();

    return idx;
}

function resetDeck(key) {
    deckQueue[key] = [];
    recentlyShown[key] = [];
}

// ——— Category / Mode Accessors ———
function getCat() { return selectCategory.value; }
function getTbldSubset() { return selectTbldSubset ? selectTbldSubset.value : 'f2l'; }
function getTbldMode() { return selectTbldMode ? selectTbldMode.value : 'solver'; }
function isTbld() { return getCat() === 'tbld'; }

/**
 * Returns the stat key for the current selection.
 * OLL → 'oll', PLL → 'pll', TBLD+f2l → 'f2l', TBLD+oll_named → 'oll_named'
 */
function getActiveKey() {
    if (!isTbld()) return getCat();
    return getTbldSubset(); // 'f2l' or 'oll_named'
}

// ——— Card List ———
function getCards() {
    const cat = getCat();
    if (cat === 'oll') return ollCards;
    if (cat === 'pll') return pllCards;

    // Team Blind — look up whichever subset is active
    const store = caseImages[getTbldSubset()] || {};
    return Object.keys(store)
        .sort((a, b) => +a - +b)
        .map(k => store[k]);
}

// ——— Stat Set Accessors ———
function getMissedSet() { return missedIndices[getActiveKey()]; }
function getSeenSet() { return seenSet[getActiveKey()]; }
function getCorrectSet() { return correctSet[getActiveKey()]; }

// ——— UI Helpers ———
function setPrompt(text) { promptText.textContent = text || ''; }

function setPrimaryAction(text, handler, visible = true, disabled = false) {
    if (!visible) {
        btnPrimaryAction.style.display = 'none';
        btnPrimaryAction.onclick = null;
        btnPrimaryAction.disabled = false;
        return;
    }
    btnPrimaryAction.textContent = text;
    btnPrimaryAction.style.display = 'inline-block';
    btnPrimaryAction.disabled = disabled;
    btnPrimaryAction.onclick = disabled ? null : handler;
}

function clearGameView() {
    container.innerHTML = '';
    answerElement.innerHTML = '';
    answerElement.style.display = 'none';
    answerButtons.style.display = 'none';
}

// ——— Render Helpers ———

function buildImg(src, alt) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
    return img;
}

function missingEl(label) {
    const div = document.createElement('div');
    div.textContent = label || 'Image missing';
    div.style.cssText =
        'color:#f66;display:flex;align-items:center;justify-content:center;' +
        'width:100%;height:100%;font-size:14px;';
    return div;
}

function buildNameCard(name, isAnswer = false) {
    const div = document.createElement('div');
    div.className = isAnswer ? 'name-card name-card-answer' : 'name-card';
    div.textContent = name;
    return div;
}

/**
 * Renders the QUESTION for the current card.
 * OLL / PLL        → static pre-rendered image from ll-images.json
 * TBLD solver mode → algorithm name as large text
 * TBLD speaker mode → case image
 */
function renderStaticImage(index) {
    const cat = getCat();

    if (cat === 'tbld') {
        const store = caseImages[getTbldSubset()] || {};
        const entry = store[String(index)];
        if (!entry) return missingEl(`Case #${index} missing — run the image generator`);

        return getTbldMode() === 'solver'
            ? buildNameCard(entry.name)
            : buildImg(entry.img, entry.name);
    }

    // OLL / PLL
    const imgSrc = caseImages[cat][String(index)];
    if (!imgSrc) return missingEl(`${cat.toUpperCase()} #${index} missing`);
    return buildImg(imgSrc, `${cat.toUpperCase()} case ${index + 1}`);
}

/**
 * Renders the ANSWER for the current card.
 * OLL / PLL        → animated twisty-player
 * TBLD solver mode → case image
 * TBLD speaker mode → algorithm name
 */
function buildAnswer(index) {
    const cat = getCat();

    if (cat === 'tbld') {
        const store = caseImages[getTbldSubset()] || {};
        const entry = store[String(index)];
        if (!entry) return missingEl('Answer missing');

        return getTbldMode() === 'solver'
            ? buildImg(entry.img, entry.name)
            : buildNameCard(entry.name, true);
    }

    // OLL / PLL — animated twisty-player
    const cards = getCards();
    const card = cards[index];
    const player = document.createElement('twisty-player');
    player.setAttribute('alg', card.alg);
    player.setAttribute('experimental-setup-anchor', 'end');
    player.setAttribute('hint-facelets', 'none');
    player.setAttribute('camera', 'top');
    player.setAttribute('control-panel', 'none');
    player.setAttribute('background', 'none');
    player.setAttribute('visualization', 'experimental-2D-LL');
    player.setAttribute('experimental-stickering', cat.toUpperCase());
    player.style.width = 'min(70vw, 240px)';
    player.style.height = 'min(70vw, 240px)';
    player.style.maxWidth = '100%';
    player.style.maxHeight = '100%';
    return player;
}

// ——— Live Stats Bar ———
function updateLiveStats() {
    const key = getActiveKey();
    const time = (recognitionTime / 1000).toFixed(2);
    const seen = seenSet[key].size;
    const correct = correctSet[key].size;
    const acc = seen > 0 ? ((correct / seen) * 100).toFixed(1) : '—';

    let label = getCat().toUpperCase();
    if (isTbld()) {
        const subLabel = getTbldSubset() === 'f2l' ? 'F2L' : 'OLL';
        label = `TB · ${subLabel} · ${getTbldMode()}`;
    }

    statsDisplay.textContent =
        `Overall: ${acc}% accuracy on ${time}s recog ${label} (${correct}/${seen})`;
}

// ——— Prompt / Button State Machine ———
function updatePromptForStage() {
    const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    switch (stage) {
        case 'idle':
            setPrompt('');
            setPrimaryAction('Reveal Answer', null, false);
            break;
        case 'showing':
            setPrompt('Watch the case.');
            setPrimaryAction('Showing…', null, true, true);
            break;
        case 'waitingAnswer':
            setPrompt(touch ? 'Tap Reveal Answer.' : 'Press Space or tap Reveal Answer.');
            setPrimaryAction('Reveal Answer', showAnswer, true, false);
            break;
        case 'grading':
            setPrompt(touch ? 'Choose Right or Wrong.' : 'Press 1 or 2, or tap Right / Wrong.');
            setPrimaryAction('Next Card', null, false);
            break;
        case 'waitingNext':
            setPrompt(touch ? 'Tap Next Card.' : 'Press Space or tap Next Card.');
            setPrimaryAction('Next Card', nextCard, true, false);
            break;
        default:
            setPrompt('');
            setPrimaryAction('Reveal Answer', null, false);
    }
}

// ——— TBLD Sub-options Visibility ———
function updateTbldModeVisibility() {
    if (tbldModeWrap) tbldModeWrap.style.display = isTbld() ? 'block' : 'none';
}

// ——— Practice Missed ———
function startPracticeMissed(indices) {
    practiceMissedMode = true;
    practiceMissedIndices = Array.isArray(indices) ? [...indices] : [];
    startCard();
}

// ——— UI State Transitions ———
function showMenu() {
    stage = 'idle';
    practiceMissedMode = false;
    practiceMissedIndices = [];
    clearGameView();
    statsScreen.style.display = 'none';
    menuScreen.style.display = 'block';
    btnBackMenu.style.display = 'none';
    statsDisplay.style.display = 'block';
    updateTbldModeVisibility();
    updateLiveStats();
    updatePromptForStage();
}

function enterGameUI() {
    menuScreen.style.display = 'none';
    statsScreen.style.display = 'none';
    btnBackMenu.style.display = 'inline-block';
    statsDisplay.style.display = 'block';
}

// ——— Core Training Flow ———
async function startCard() {
    enterGameUI();
    const cards = getCards();
    const missedSet = getMissedSet();
    const key = getActiveKey();

    if (!cards.length) {
        alert('No cards available. Make sure ll-images.json is populated for this set.');
        showMenu();
        return;
    }

    if (practiceMissedMode) {
        if (!practiceMissedIndices.length && missedSet.size) {
            practiceMissedIndices = Array.from(missedSet);
        }
        if (!practiceMissedIndices.length) {
            alert('No missed cases for this set!');
            showMenu();
            return;
        }
        currentCardIndex = practiceMissedIndices.shift();
    } else {
        currentCardIndex = drawNextIndex(key);
    }

    clearGameView();
    container.appendChild(renderStaticImage(currentCardIndex));

    stage = 'showing';
    updatePromptForStage();

    setTimeout(() => {
        if (stage !== 'showing') return;
        container.innerHTML = '';
        stage = 'waitingAnswer';
        updatePromptForStage();
    }, recognitionTime);
}

function showAnswer() {
    if (stage !== 'waitingAnswer') return;

    answerElement.innerHTML = '';
    answerElement.appendChild(buildAnswer(currentCardIndex));
    answerElement.style.display = 'block';
    answerButtons.style.display = 'flex';

    stage = 'grading';
    updatePromptForStage();
}

function grade(correct) {
    if (stage !== 'grading') return;

    const key = getActiveKey();
    seenSet[key].add(currentCardIndex);

    if (correct) {
        correctSet[key].add(currentCardIndex);
        getMissedSet().delete(currentCardIndex);
    } else {
        getMissedSet().add(currentCardIndex);
    }

    updateLiveStats();
    saveStats();

    answerButtons.style.display = 'none';
    answerElement.style.display = 'none';
    answerElement.innerHTML = '';
    container.innerHTML = '';

    stage = 'waitingNext';
    updatePromptForStage();
}

function nextCard() {
    if (practiceMissedMode && practiceMissedIndices.length === 0) {
        alert('Finished all missed cases!');
        showMenu();
        return;
    }
    startCard();
}

// ——— Stats Screen ———
function showStats() {
    menuScreen.style.display = 'none';
    btnBackMenu.style.display = 'inline-block';
    statsScreen.style.display = 'block';
    statsCards.innerHTML = '';
    statsDisplay.style.display = 'none';
    setPrompt('');

    const key = getActiveKey();
    const missedSet = getMissedSet();
    const seen = seenSet[key].size;
    const correct = correctSet[key].size;
    const acc = seen > 0 ? ((correct / seen) * 100).toFixed(1) : '—';

    const summary = document.createElement('div');
    summary.style.cssText = 'margin-bottom:10px;width:100%;';
    summary.textContent = `Accuracy: ${acc}% (${correct}/${seen})`;
    statsCards.appendChild(summary);

    if (!missedSet.size) {
        const empty = document.createElement('div');
        empty.textContent = 'No missed cases yet.';
        empty.style.width = '100%';
        statsCards.appendChild(empty);
        return;
    }

    missedSet.forEach(i => {
        const div = document.createElement('div');
        div.onclick = () => startPracticeMissed([i]);

        if (isTbld()) {
            const store = caseImages[getTbldSubset()] || {};
            const entry = store[String(i)];
            if (entry) {
                if (getTbldMode() === 'solver') {
                    div.classList.add('solver-card');
                    div.textContent = entry.name;
                    div.title = entry.alg;
                } else {
                    div.classList.add('has-label');
                    div.title = entry.name;
                    const img = document.createElement('img');
                    img.src = entry.img || '';
                    img.alt = entry.name;
                    img.style.cssText = 'width:100%;height:72%;object-fit:contain;';
                    const lbl = document.createElement('span');
                    lbl.className = 'case-name-label';
                    lbl.textContent = entry.name;
                    div.appendChild(img);
                    div.appendChild(lbl);
                }
            }
        } else {
            // OLL / PLL
            const cards = getCards();
            const card = cards[i];
            div.title = card ? card.alg : '';
            const img = document.createElement('img');
            img.src = caseImages[getCat()][String(i)] || '';
            img.alt = card ? card.alg : '';
            img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
            div.appendChild(img);
        }

        statsCards.appendChild(div);
    });
}

function clearStats() {
    if (confirm('Clear all missed and accuracy stats for this set?')) {
        const key = getActiveKey();
        missedIndices[key].clear();
        seenSet[key].clear();
        correctSet[key].clear();
        practiceMissedIndices = [];
        saveStats();
        showMenu();
    }
}

// ——— Persistence ———
function saveStats() {
    localStorage.setItem('seenSet', JSON.stringify(Object.fromEntries(STAT_KEYS.map(k => [k, Array.from(seenSet[k])]))));
    localStorage.setItem('correctSet', JSON.stringify(Object.fromEntries(STAT_KEYS.map(k => [k, Array.from(correctSet[k])]))));
    localStorage.setItem('missedIndices', JSON.stringify(Object.fromEntries(STAT_KEYS.map(k => [k, Array.from(missedIndices[k])]))));
}

function loadStats() {
    try {
        const seenData = JSON.parse(localStorage.getItem('seenSet'));
        const correctData = JSON.parse(localStorage.getItem('correctSet'));
        const missedData = JSON.parse(localStorage.getItem('missedIndices'));

        STAT_KEYS.forEach(k => {
            if (seenData && seenData[k]) seenSet[k] = new Set(seenData[k]);
            if (correctData && correctData[k]) correctSet[k] = new Set(correctData[k]);
            if (missedData && missedData[k]) missedIndices[k] = new Set(missedData[k]);
        });
    } catch (e) {
        console.warn('Failed to load stats from localStorage.');
    }
}

// ——— Image Loader ———
async function loadCaseImages() {
    try {
        let res = await fetch('ll-images.json');

        if (!res.ok && window.location.hostname.includes('githubusercontent.com')) {
            const repoPath = window.location.pathname.split('/').slice(0, -1).join('/');
            res = await fetch(`${repoPath}/ll-images.json`);
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        caseImages.oll = data.oll || {};
        caseImages.pll = data.pll || {};
        caseImages.tbld = data.tbld || {};   // F2L images (key "f2l" in subset selector maps here)
        caseImages.oll_named = data.oll_named || {};

        console.log(
            `✅ Loaded  OLL:${Object.keys(caseImages.oll).length}` +
            `  PLL:${Object.keys(caseImages.pll).length}` +
            `  TBLD/F2L:${Object.keys(caseImages.tbld).length}` +
            `  OLL-named:${Object.keys(caseImages.oll_named).length}`
        );
    } catch (e) {
        console.error('Failed to load ll-images.json', e);
        alert(
            'Could not load ll-images.json.\n\n' +
            'Make sure the file is in the same folder as index.html and you are ' +
            'viewing the page through a web server (not file://).'
        );
    }
}

// ——— Event Listeners ———
btnStart.onclick = () => {
    practiceMissedMode = false;
    practiceMissedIndices = [];
    startCard();
};

btnPracticeMissed.onclick = () => {
    const missed = Array.from(getMissedSet());
    if (!missed.length) { alert('No missed cases!'); return; }
    startPracticeMissed(missed);
};

btnShowStats.onclick = showStats;
btnClearStats.onclick = clearStats;
btnCloseStats.onclick = showMenu;
btnBackMenu.onclick = showMenu;

btnPrimaryAction.onclick = () => {
    if (stage === 'waitingAnswer') showAnswer();
    else if (stage === 'waitingNext') nextCard();
};

recogInput.oninput = () => {
    let v = parseFloat(recogInput.value);
    if (Number.isNaN(v) || v < 0.1) { v = 1; recogInput.value = v; }
    if (v > 10) { v = 10; recogInput.value = v; }
    recognitionTime = v * 1000;
    updateLiveStats();
};

selectCategory.onchange = () => {
    resetDeck(getActiveKey());
    updateTbldModeVisibility();
    updateLiveStats();
    if (statsScreen.style.display === 'block') showStats();
    else if (stage !== 'idle') updatePromptForStage();
};

if (selectTbldSubset) {
    selectTbldSubset.onchange = () => {
        resetDeck(getActiveKey());
        updateLiveStats();
        if (statsScreen.style.display === 'block') showStats();
    };
}

if (selectTbldMode) {
    selectTbldMode.onchange = () => {
        updateLiveStats();
        if (statsScreen.style.display === 'block') showStats();
    };
}

btnCorrect.onclick = () => grade(true);
btnWrong.onclick = () => grade(false);

visualSlot.addEventListener('click', () => {
    if (stage === 'waitingAnswer') showAnswer();
    else if (stage === 'waitingNext') nextCard();
});

document.addEventListener('keydown', e => {
    if (e.code === 'Escape') { e.preventDefault(); showMenu(); return; }

    switch (stage) {
        case 'idle':
            if (e.code === 'Space') { e.preventDefault(); startCard(); }
            break;
        case 'waitingAnswer':
            if (e.code === 'Space') { e.preventDefault(); showAnswer(); }
            break;
        case 'grading':
            if (e.key === '1') { e.preventDefault(); grade(true); }
            else if (e.key === '2') { e.preventDefault(); grade(false); }
            break;
        case 'waitingNext':
            if (e.code === 'Space') { e.preventDefault(); nextCard(); }
            break;
    }
});

// ——— Init ———
async function init() {
    loadStats();
    await loadCaseImages();
    updateTbldModeVisibility();
    updateLiveStats();
    showMenu();
}

init();