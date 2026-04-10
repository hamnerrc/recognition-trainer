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
const statsDisplay = document.getElementById('live-stats');
const promptText = document.getElementById('press-space');
const visualSlot = document.getElementById('visual-slot');

// ——— State ———
let currentCardIndex = 0;
let stage = 'idle';
let recognitionTime = parseFloat(recogInput.value) * 1000;
let practiceMissedMode = false;
let practiceMissedIndices = [];
const missedIndices = { oll: new Set(), pll: new Set() };
const seenSet = { oll: new Set(), pll: new Set() };
const correctSet = { oll: new Set(), pll: new Set() };

let caseImages = { oll: {}, pll: {} }; // base64 images from ll-images.json

const isTouchDevice =
    window.matchMedia('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0;

// ——— Helpers ———
function getCards() {
    return selectCategory.value === 'oll' ? ollCards : pllCards;
}

function getMissedSet() {
    return selectCategory.value === 'oll' ? missedIndices.oll : missedIndices.pll;
}

function getSeenSet() {
    return selectCategory.value === 'oll' ? seenSet.oll : seenSet.pll;
}

function getCorrectSet() {
    return selectCategory.value === 'oll' ? correctSet.oll : correctSet.pll;
}

function setPrompt(text) {
    promptText.textContent = text || '';
}

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

function renderStaticImage(index) {
    const cat = selectCategory.value;
    const imgSrc = caseImages[cat][index];

    if (!imgSrc) {
        console.warn(`No image for ${cat} #${index}`);
        const div = document.createElement('div');
        div.textContent = 'Image missing';
        div.style.color = '#f66';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.width = '100%';
        div.style.height = '100%';
        return div;
    }

    const img = document.createElement('img');
    img.src = imgSrc;
    img.alt = `${cat.toUpperCase()} case ${index + 1}`;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    return img;
}

function renderCubeForAnswer(alg) {
    const player = document.createElement('twisty-player');
    player.setAttribute('alg', alg);
    player.setAttribute('experimental-setup-anchor', 'end');
    player.setAttribute('hint-facelets', 'none');
    player.setAttribute('camera', 'top');
    player.setAttribute('control-panel', 'none');
    player.setAttribute('background', 'none');
    player.setAttribute('visualization', 'experimental-2D-LL');
    player.setAttribute('experimental-stickering', selectCategory.value.toUpperCase());
    player.style.width = 'min(70vw, 240px)';
    player.style.height = 'min(70vw, 240px)';
    player.style.maxWidth = '100%';
    player.style.maxHeight = '100%';
    return player;
}

function updateLiveStats() {
    const cat = selectCategory.value;
    const time = (recognitionTime / 1000).toFixed(2);
    const seen = seenSet[cat].size;
    const correct = correctSet[cat].size;
    const acc = seen > 0 ? ((correct / seen) * 100).toFixed(1) : '—';
    statsDisplay.textContent = `Overall: ${acc}% accuracy on ${time}s recog ${cat.toUpperCase()} (${correct}/${seen})`;
}

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
            setPrompt(isTouchDevice ? 'Tap Reveal Answer.' : 'Press Space or tap Reveal Answer.');
            setPrimaryAction('Reveal Answer', showAnswer, true, false);
            break;
        case 'grading':
            setPrompt(isTouchDevice ? 'Choose Right or Wrong.' : 'Press 1 or 2, or tap Right / Wrong.');
            setPrimaryAction('Next Card', null, false);
            break;
        case 'waitingNext':
            setPrompt(isTouchDevice ? 'Tap Next Card.' : 'Press Space or tap Next Card.');
            setPrimaryAction('Next Card', nextCard, true, false);
            break;
        default:
            setPrompt('');
            setPrimaryAction('Reveal Answer', null, false);
    }
}

function startPracticeMissed(indices) {
    practiceMissedMode = true;
    practiceMissedIndices = Array.isArray(indices) ? [...indices] : [];
    startCard();
}

// ——— UI States ———
function showMenu() {
    stage = 'idle';
    practiceMissedMode = false;
    practiceMissedIndices = [];
    clearGameView();
    statsScreen.style.display = 'none';
    menuScreen.style.display = 'block';
    btnBackMenu.style.display = 'none';
    statsDisplay.style.display = 'block';
    updateLiveStats();
    updatePromptForStage();
}

function enterGameUI() {
    menuScreen.style.display = 'none';
    statsScreen.style.display = 'none';
    btnBackMenu.style.display = 'inline-block';
    statsDisplay.style.display = 'block';
}

// ——— Core Flow ———
async function startCard() {
    enterGameUI();
    const cards = getCards();
    const missedSet = getMissedSet();

    if (practiceMissedMode) {
        if (!practiceMissedIndices.length) {
            if (missedSet.size) {
                practiceMissedIndices = Array.from(missedSet);
            }
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

    const card = cards[currentCardIndex];

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

    const cards = getCards();
    const card = cards[currentCardIndex];

    answerElement.innerHTML = '';
    answerElement.appendChild(renderCubeForAnswer(card.alg));
    answerElement.style.display = 'block';
    answerButtons.style.display = 'flex';

    stage = 'grading';
    updatePromptForStage();
}

function grade(correct) {
    if (stage !== 'grading') return;

    const cat = selectCategory.value;
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

// ——— Stats ———
function showStats() {
    menuScreen.style.display = 'none';
    btnBackMenu.style.display = 'inline-block';
    statsScreen.style.display = 'block';
    statsCards.innerHTML = '';
    statsDisplay.style.display = 'none';
    setPrompt('');

    const cat = selectCategory.value;
    const cards = getCards();
    const missedSet = getMissedSet();
    const seen = seenSet[cat].size;
    const correct = correctSet[cat].size;
    const acc = seen > 0 ? ((correct / seen) * 100).toFixed(1) : '—';

    const summary = document.createElement('div');
    summary.style.marginBottom = '10px';
    summary.style.width = '100%';
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
        const card = cards[i];
        const div = document.createElement('div');
        div.title = card.alg;

        const img = document.createElement('img');
        img.src = caseImages[cat][i] || '';
        img.alt = card.alg;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';

        div.appendChild(img);
        div.onclick = () => startPracticeMissed([i]);
        statsCards.appendChild(div);
    });
}

function clearStats() {
    if (confirm('Clear all missed and accuracy stats for this category?')) {
        const cat = selectCategory.value;
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
        pll: Array.from(seenSet.pll)
    }));

    localStorage.setItem('correctSet', JSON.stringify({
        oll: Array.from(correctSet.oll),
        pll: Array.from(correctSet.pll)
    }));

    localStorage.setItem('missedIndices', JSON.stringify({
        oll: Array.from(missedIndices.oll),
        pll: Array.from(missedIndices.pll)
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
        }

        if (correctData) {
            correctSet.oll = new Set(correctData.oll || []);
            correctSet.pll = new Set(correctData.pll || []);
        }

        if (missedData) {
            missedIndices.oll = new Set(missedData.oll || []);
            missedIndices.pll = new Set(missedData.pll || []);
        }
    } catch (e) {
        console.warn('Failed to load stats from localStorage.');
    }
}

// ——— Load Images ———
async function loadCaseImages() {
    try {
        let res = await fetch('ll-images.json');

        if (!res.ok && window.location.hostname.includes('githubusercontent.com')) {
            const repoPath = window.location.pathname.split('/').slice(0, -1).join('/');
            res = await fetch(`${repoPath}/ll-images.json`);
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        caseImages = await res.json();
        console.log(
            `✅ Loaded ${Object.keys(caseImages.oll).length} OLL + ${Object.keys(caseImages.pll).length} PLL static images`
        );
    } catch (e) {
        console.error('Failed to load ll-images.json', e);
        alert(
            'Could not load ll-images.json.\n\nMake sure the file is in the same folder as index.html and you are viewing the page through a web server or GitHub Pages (not file://).'
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
    if (!missed.length) {
        alert('No missed cases!');
        return;
    }
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
    if (Number.isNaN(v) || v < 0.1) {
        v = 1;
        recogInput.value = v;
    }
    if (v > 10) {
        v = 10;
        recogInput.value = v;
    }
    recognitionTime = v * 1000;
    updateLiveStats();
};

selectCategory.onchange = () => {
    updateLiveStats();
    if (statsScreen.style.display === 'block') {
        showStats();
    } else if (stage !== 'idle') {
        updatePromptForStage();
    }
};

btnCorrect.onclick = () => grade(true);
btnWrong.onclick = () => grade(false);

visualSlot.addEventListener('click', () => {
    if (stage === 'waitingAnswer') {
        showAnswer();
    } else if (stage === 'waitingNext') {
        nextCard();
    }
});

document.addEventListener('keydown', e => {
    if (e.code === 'Escape') {
        e.preventDefault();
        showMenu();
        return;
    }

    switch (stage) {
        case 'idle':
            if (e.code === 'Space') {
                e.preventDefault();
                startCard();
            }
            break;
        case 'waitingAnswer':
            if (e.code === 'Space') {
                e.preventDefault();
                showAnswer();
            }
            break;
        case 'grading':
            if (e.key === '1') {
                e.preventDefault();
                grade(true);
            } else if (e.key === '2') {
                e.preventDefault();
                grade(false);
            }
            break;
        case 'waitingNext':
            if (e.code === 'Space') {
                e.preventDefault();
                nextCard();
            }
            break;
    }
});

// ——— Init ———
async function init() {
    loadStats();
    await loadCaseImages();
    updateLiveStats();
    showMenu();
}

init();
