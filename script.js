// ——— Element Refs ———
const container = document.getElementById('cube-container');
const answerElement = document.getElementById('answer');
const answerButtons = document.getElementById('answerButtons');
const btnCorrect = document.getElementById('btn-correct');
const btnWrong = document.getElementById('btn-wrong');
const btnBackMenu = document.getElementById('btn-back-menu');
const btnStart = document.getElementById('btn-start');
const btnPrimaryAction = document.getElementById('btn-primary-action');
const menuScreen = document.getElementById('menu-screen');

// Selection Screen Refs
const selectionScreen = document.getElementById('selection-screen');
const selectionGrid = document.getElementById('selection-grid');
const btnSelectAll = document.getElementById('btn-select-all');
const btnDeselectAll = document.getElementById('btn-deselect-all');
const btnStartTraining = document.getElementById('btn-start-training');

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
let cardShownTime = 0;
let currentReactionTime = 0;

// ——— Stat keys & Data ———
const STAT_KEYS = ['oll', 'pll', 'f2l', 'oll_named'];

let gameStats = Object.fromEntries(STAT_KEYS.map(k => [
    k, { correct_count: 0, incorrect_count: 0, streak: 0, bestStreak: 0, bestAcc: 0, bestTime: Infinity }
]));

let selectedIndices = Object.fromEntries(STAT_KEYS.map(k => [k, null]));

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
    const pool = selectedIndices[key] || [];
    if (pool.length === 0) return;

    const recent = recentlyShown[key].filter(i => pool.includes(i)).slice(-NO_REPEAT_WINDOW);
    const recentSet = new Set(recent);

    const available = pool.filter(i => !recentSet.has(i));

    if (available.length === 0) {
        const arr = [...pool];
        fisherYatesShuffle(arr);
        deckQueue[key] = arr;
    } else {
        fisherYatesShuffle(available);
        const tail = fisherYatesShuffle([...recent]);
        deckQueue[key] = [...available, ...tail];
    }
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

function getActiveKey() {
    if (!isTbld()) return getCat();
    return getTbldSubset(); // 'f2l' or 'oll_named'
}

// ——— Card List ———
function getCards() {
    const cat = getCat();
    if (cat === 'oll') return ollCards;
    if (cat === 'pll') return pllCards;

    const store = caseImages[getTbldSubset()] || {};
    return Object.keys(store)
        .sort((a, b) => +a - +b)
        .map(k => store[k]);
}

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

function flashGreen() {
    document.body.style.backgroundColor = '#1a3a1a';
    setTimeout(() => {
        document.body.style.backgroundColor = '#121212';
    }, 150);
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

    const imgSrc = caseImages[cat][String(index)];
    if (!imgSrc) return missingEl(`${cat.toUpperCase()} #${index} missing`);
    return buildImg(imgSrc, `${cat.toUpperCase()} case ${index + 1}`);
}

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
    const st = gameStats[key];
    const totalAttempts = st.correct_count + st.incorrect_count;
    const acc = totalAttempts > 0 ? ((st.correct_count / totalAttempts) * 100).toFixed(1) : '—';
    const bestAcc = st.bestAcc > 0 ? st.bestAcc.toFixed(1) + '%' : '—';
    const bestTime = st.bestTime !== Infinity ? (st.bestTime / 1000).toFixed(2) + 's' : '—';

    let label = getCat().toUpperCase();
    if (isTbld()) {
        const subLabel = getTbldSubset() === 'f2l' ? 'F2L' : 'OLL';
        label = `TB · ${subLabel} · ${getTbldMode()}`;
    }

    statsDisplay.innerHTML =
        `${label} — Acc: ${acc}% (${st.correct_count}/${totalAttempts}) | Best Acc: ${bestAcc}<br>` +
        `Streak: ${st.streak} (Best: ${st.bestStreak}) | Best Time: ${bestTime}`;
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

// ——— UI State Transitions ———
function showMenu() {
    stage = 'idle';
    clearGameView();
    selectionScreen.style.display = 'none';
    menuScreen.style.display = 'block';
    btnBackMenu.style.display = 'none';
    visualSlot.style.display = 'flex';
    statsDisplay.style.display = 'block';
    promptText.style.display = 'block';
    updateTbldModeVisibility();
    updateLiveStats();
    updatePromptForStage();
}

function showSelectionScreen() {
    stage = 'idle';
    clearGameView();
    menuScreen.style.display = 'none';
    selectionScreen.style.display = 'flex';
    btnBackMenu.style.display = 'inline-block';
    visualSlot.style.display = 'none';
    statsDisplay.style.display = 'none';
    promptText.style.display = 'none';

    const key = getActiveKey();
    const cards = getCards();

    // Init selection if missing
    if (!selectedIndices[key] || selectedIndices[key].length !== cards.length) {
        selectedIndices[key] = cards.map((_, i) => i);
    }

    selectionGrid.innerHTML = '';
    cards.forEach((card, i) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'case-toggle';
        if (selectedIndices[key].includes(i)) wrapper.classList.add('selected');

        let content;
        if (isTbld()) {
            const store = caseImages[getTbldSubset()] || {};
            const entry = store[String(i)];
            if (entry) {
                if (getTbldMode() === 'solver') {
                    content = document.createElement('div');
                    content.className = 'case-name';
                    content.textContent = entry.name;
                } else {
                    content = buildImg(entry.img, entry.name);
                }
            } else {
                content = missingEl('?');
            }
        } else {
            const imgSrc = caseImages[getCat()][String(i)];
            if (imgSrc) content = buildImg(imgSrc, `Case ${i + 1}`);
            else content = missingEl('?');
        }

        wrapper.appendChild(content);

        wrapper.onclick = () => {
            const idx = selectedIndices[key].indexOf(i);
            if (idx > -1) {
                selectedIndices[key].splice(idx, 1);
                wrapper.classList.remove('selected');
            } else {
                selectedIndices[key].push(i);
                wrapper.classList.add('selected');
            }
        };

        selectionGrid.appendChild(wrapper);
    });
}

function enterGameUI() {
    menuScreen.style.display = 'none';
    selectionScreen.style.display = 'none';
    visualSlot.style.display = 'flex';
    statsDisplay.style.display = 'block';
    promptText.style.display = 'block';
    btnBackMenu.style.display = 'inline-block';
}

// ——— Core Training Flow ———
async function startCard() {
    enterGameUI();
    const cards = getCards();
    const key = getActiveKey();

    if (!cards.length) {
        alert('No cards available. Make sure ll-images.json is populated for this set.');
        showMenu();
        return;
    }

    currentCardIndex = drawNextIndex(key);

    clearGameView();
    container.appendChild(renderStaticImage(currentCardIndex));

    stage = 'showing';
    updatePromptForStage();
    cardShownTime = Date.now();

    setTimeout(() => {
        if (stage !== 'showing') return;
        container.innerHTML = '';
        stage = 'waitingAnswer';
        updatePromptForStage();
    }, recognitionTime);
}

function showAnswer() {
    if (stage !== 'waitingAnswer') return;

    currentReactionTime = Date.now() - cardShownTime;

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
    const st = gameStats[key];

    if (correct) {
        st.correct_count++;
        st.streak++;
        if (st.streak > st.bestStreak) st.bestStreak = st.streak;
        if (currentReactionTime < st.bestTime) st.bestTime = currentReactionTime;
        flashGreen();
    } else {
        st.incorrect_count++;
        st.streak = 0;
    }

    const totalAttempts = st.correct_count + st.incorrect_count;
    const currentAcc = (st.correct_count / totalAttempts) * 100;
    if (currentAcc > st.bestAcc) st.bestAcc = currentAcc;

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
    startCard();
}

// ——— Persistence ———
function saveStats() {
    localStorage.setItem('gameStats', JSON.stringify(gameStats));
    localStorage.setItem('selectedIndices', JSON.stringify(selectedIndices));
}

function loadStats() {
    try {
        const savedStats = JSON.parse(localStorage.getItem('gameStats'));
        if (savedStats) {
            STAT_KEYS.forEach(k => {
                if (savedStats[k]) gameStats[k] = { ...gameStats[k], ...savedStats[k] };
            });
        }
        const savedSelected = JSON.parse(localStorage.getItem('selectedIndices'));
        if (savedSelected) {
            STAT_KEYS.forEach(k => {
                if (savedSelected[k]) selectedIndices[k] = savedSelected[k];
            });
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
btnStart.onclick = showSelectionScreen;

btnSelectAll.onclick = () => {
    const key = getActiveKey();
    selectedIndices[key] = getCards().map((_, i) => i);
    Array.from(selectionGrid.children).forEach(child => child.classList.add('selected'));
    saveStats();
};

btnDeselectAll.onclick = () => {
    const key = getActiveKey();
    selectedIndices[key] = [];
    Array.from(selectionGrid.children).forEach(child => child.classList.remove('selected'));
    saveStats();
};

btnStartTraining.onclick = () => {
    const key = getActiveKey();
    if (!selectedIndices[key] || selectedIndices[key].length === 0) {
        alert('Please select at least one case to train.');
        return;
    }
    resetDeck(key);
    startCard();
};

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
};

selectCategory.onchange = () => {
    resetDeck(getActiveKey());
    updateTbldModeVisibility();
    updateLiveStats();
    if (stage !== 'idle') updatePromptForStage();
};

if (selectTbldSubset) {
    selectTbldSubset.onchange = () => {
        resetDeck(getActiveKey());
        updateLiveStats();
    };
}

if (selectTbldMode) {
    selectTbldMode.onchange = () => {
        updateLiveStats();
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
            // Allow spacebar only if visual slot is active and ready
            if (e.code === 'Space' && selectionScreen.style.display === 'flex') {
                e.preventDefault();
                btnStartTraining.click();
            } else if (e.code === 'Space' && menuScreen.style.display === 'block') {
                e.preventDefault();
                btnStart.click();
            }
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