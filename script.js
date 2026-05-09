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

const missedIndices = { oll: new Set(), pll: new Set(), tbld: new Set() };
const seenSet = { oll: new Set(), pll: new Set(), tbld: new Set() };
const correctSet = { oll: new Set(), pll: new Set(), tbld: new Set() };

let caseImages = { oll: {}, pll: {}, tbld: {} };

const isTouchDevice =
    window.matchMedia('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0;

// ——— Category / Mode Accessors ———
function getCat() { return selectCategory.value; }
function getTbldMode() { return selectTbldMode ? selectTbldMode.value : 'solver'; }
function isTbld() { return getCat() === 'tbld'; }

// ——— Card List ———
// For OLL/PLL: uses the arrays from LL-database.js.
// For TBLD: derives an ordered array from caseImages.tbld.
function getCards() {
    const cat = getCat();
    if (cat === 'oll') return ollCards;
    if (cat === 'pll') return pllCards;
    // tbld — sorted by numeric key so indices stay stable
    const tbld = caseImages.tbld || {};
    return Object.keys(tbld)
        .sort((a, b) => +a - +b)
        .map(k => tbld[k]);
}

// ——— Stat Set Accessors ———
function getMissedSet() { return missedIndices[getCat()]; }
function getSeenSet() { return seenSet[getCat()]; }
function getCorrectSet() { return correctSet[getCat()]; }

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

/** Returns an <img> element for a data-URL or regular URL. */
function buildImg(src, alt) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
    return img;
}

/** Returns a fallback element when an image is missing. */
function missingEl(label) {
    const div = document.createElement('div');
    div.textContent = label || 'Image missing';
    div.style.cssText =
        'color:#f66;display:flex;align-items:center;justify-content:center;' +
        'width:100%;height:100%;font-size:14px;';
    return div;
}

/**
 * Returns a full-slot element displaying an algorithm NAME.
 * Used as the QUESTION in solver mode and as the ANSWER in speaker mode.
 */
function buildNameCard(name, isAnswer = false) {
    const div = document.createElement('div');
    div.className = isAnswer ? 'name-card name-card-answer' : 'name-card';
    div.textContent = name;
    return div;
}

/**
 * Renders the QUESTION for the current card into #cube-container.
 * - OLL / PLL : static pre-rendered image (from ll-images.json)
 * - TBLD solver  : algorithm name as large text
 * - TBLD speaker : case image
 */
function renderStaticImage(index) {
    const cat = getCat();

    if (cat === 'tbld') {
        const entry = (caseImages.tbld || {})[String(index)];
        if (!entry) return missingEl(`TBLD #${index} missing`);

        return getTbldMode() === 'solver'
            ? buildNameCard(entry.name)          // solver: show the name
            : buildImg(entry.img, entry.name);   // speaker: show the image
    }

    // OLL / PLL
    const imgSrc = caseImages[cat][String(index)];
    if (!imgSrc) return missingEl(`${cat.toUpperCase()} #${index} missing`);
    return buildImg(imgSrc, `${cat.toUpperCase()} case ${index + 1}`);
}

/**
 * Renders the ANSWER for the current card into #answer.
 * - OLL / PLL : animated twisty-player (2D-LL view)
 * - TBLD solver  : case image
 * - TBLD speaker : algorithm name as large text
 */
function buildAnswer(index) {
    const cat = getCat();

    if (cat === 'tbld') {
        const entry = (caseImages.tbld || {})[String(index)];
        if (!entry) return missingEl('Answer missing');

        return getTbldMode() === 'solver'
            ? buildImg(entry.img, entry.name)         // solver: reveal image
            : buildNameCard(entry.name, true);        // speaker: reveal name
    }

    // OLL / PLL — twisty-player
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
    const cat = getCat();
    const time = (recognitionTime / 1000).toFixed(2);
    const seen = seenSet[cat].size;
    const correct = correctSet[cat].size;
    const acc = seen > 0 ? ((correct / seen) * 100).toFixed(1) : '—';

    let label = cat.toUpperCase();
    if (cat === 'tbld') label += ` · ${getTbldMode()}`;

    statsDisplay.textContent =
        `Overall: ${acc}% accuracy on ${time}s recog ${label} (${correct}/${seen})`;
}

// ——— Prompt / Button State Machine ———
function updatePromptForStage() {
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
            setPrompt(isTouchDevice
                ? 'Tap Reveal Answer.'
                : 'Press Space or tap Reveal Answer.');
            setPrimaryAction('Reveal Answer', showAnswer, true, false);
            break;
        case 'grading':
            setPrompt(isTouchDevice
                ? 'Choose Right or Wrong.'
                : 'Press 1 or 2, or tap Right / Wrong.');
            setPrimaryAction('Next Card', null, false);
            break;
        case 'waitingNext':
            setPrompt(isTouchDevice
                ? 'Tap Next Card.'
                : 'Press Space or tap Next Card.');
            setPrimaryAction('Next Card', nextCard, true, false);
            break;
        default:
            setPrompt('');
            setPrimaryAction('Reveal Answer', null, false);
    }
}

// ——— TBLD Sub-mode Selector Visibility ———
function updateTbldModeVisibility() {
    if (tbldModeWrap) {
        tbldModeWrap.style.display = isTbld() ? 'block' : 'none';
    }
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

    if (!cards.length) {
        alert('No cards available for this category. Make sure ll-images.json has been populated.');
        showMenu();
        return;
    }

    if (practiceMissedMode) {
        if (!practiceMissedIndices.length && missedSet.size) {
            practiceMissedIndices = Array.from(missedSet);
        }
        if (!practiceMissedIndices.length) {
            alert('No missed cases in this category!');
            showMenu();
            return;
        }
        currentCardIndex = practiceMissedIndices.shift();
    } else {
        currentCardIndex = Math.floor(Math.random() * cards.length);
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

    const cat = getCat();
    seenSet[cat].add(currentCardIndex);

    if (correct) {
        correctSet[cat].add(currentCardIndex);
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

    const cat = getCat();
    const missedSet = getMissedSet();
    const seen = seenSet[cat].size;
    const correct = correctSet[cat].size;
    const acc = seen > 0 ? ((correct / seen) * 100).toFixed(1) : '—';

    // Summary row
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

        if (cat === 'tbld') {
            const entry = (caseImages.tbld || {})[String(i)];
            if (entry) {
                if (getTbldMode() === 'solver') {
                    // Solver missed: show name prominently (that's what they were shown)
                    div.classList.add('solver-card');
                    div.textContent = entry.name;
                    div.title = entry.alg;
                } else {
                    // Speaker missed: show image + name label
                    div.classList.add('has-label');
                    div.title = entry.name;
                    const img = document.createElement('img');
                    img.src = entry.img || '';
                    img.alt = entry.name;
                    img.style.cssText = 'width:100%;height:72%;object-fit:contain;';
                    const label = document.createElement('span');
                    label.className = 'case-name-label';
                    label.textContent = entry.name;
                    div.appendChild(img);
                    div.appendChild(label);
                }
            }
        } else {
            // OLL / PLL
            const cards = getCards();
            const card = cards[i];
            div.title = card ? card.alg : '';
            const img = document.createElement('img');
            img.src = caseImages[cat][String(i)] || '';
            img.alt = card ? card.alg : '';
            img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
            div.appendChild(img);
        }

        statsCards.appendChild(div);
    });
}

function clearStats() {
    if (confirm('Clear all missed and accuracy stats for this category?')) {
        const cat = getCat();
        missedIndices[cat].clear();
        seenSet[cat].clear();
        correctSet[cat].clear();
        practiceMissedIndices = [];
        saveStats();
        showMenu();
    }
}

// ——— Persistence ———
function saveStats() {
    localStorage.setItem('seenSet', JSON.stringify({
        oll: Array.from(seenSet.oll),
        pll: Array.from(seenSet.pll),
        tbld: Array.from(seenSet.tbld),
    }));
    localStorage.setItem('correctSet', JSON.stringify({
        oll: Array.from(correctSet.oll),
        pll: Array.from(correctSet.pll),
        tbld: Array.from(correctSet.tbld),
    }));
    localStorage.setItem('missedIndices', JSON.stringify({
        oll: Array.from(missedIndices.oll),
        pll: Array.from(missedIndices.pll),
        tbld: Array.from(missedIndices.tbld),
    }));
}

function loadStats() {
    try {
        const seenData = JSON.parse(localStorage.getItem('seenSet'));
        const correctData = JSON.parse(localStorage.getItem('correctSet'));
        const missedData = JSON.parse(localStorage.getItem('missedIndices'));

        if (seenData) {
            seenSet.oll = new Set(seenData.oll || []);
            seenSet.pll = new Set(seenData.pll || []);
            seenSet.tbld = new Set(seenData.tbld || []);
        }
        if (correctData) {
            correctSet.oll = new Set(correctData.oll || []);
            correctSet.pll = new Set(correctData.pll || []);
            correctSet.tbld = new Set(correctData.tbld || []);
        }
        if (missedData) {
            missedIndices.oll = new Set(missedData.oll || []);
            missedIndices.pll = new Set(missedData.pll || []);
            missedIndices.tbld = new Set(missedData.tbld || []);
        }
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
        caseImages.tbld = data.tbld || {};

        console.log(
            `✅ Loaded ${Object.keys(caseImages.oll).length} OLL + ` +
            `${Object.keys(caseImages.pll).length} PLL + ` +
            `${Object.keys(caseImages.tbld).length} TBLD images`
        );
    } catch (e) {
        console.error('Failed to load ll-images.json', e);
        alert(
            'Could not load ll-images.json.\n\n' +
            'Make sure the file is in the same folder as index.html and you are ' +
            'viewing the page through a web server or GitHub Pages (not file://).'
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
    updateTbldModeVisibility();
    updateLiveStats();
    if (statsScreen.style.display === 'block') {
        showStats();
    } else if (stage !== 'idle') {
        updatePromptForStage();
    }
};

if (selectTbldMode) {
    selectTbldMode.onchange = () => {
        updateLiveStats();
        // If stats screen is open, refresh it to match the new mode's missed cases
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
    if (e.code === 'Escape') {
        e.preventDefault();
        showMenu();
        return;
    }

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