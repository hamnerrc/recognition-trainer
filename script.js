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
const menuScreen = document.getElementById('menu-screen');
const statsScreen = document.getElementById('statsScreen');
const statsCards = document.getElementById('statsCards');
const recogInput = document.getElementById('input-recog-time');
const selectCategory = document.getElementById('select-category');
const btnExportData = document.getElementById('btn-export-data');
const btnImportData = document.getElementById('btn-import-data');
const fileImportInput = document.getElementById('file-import');
const statsDisplay = document.getElementById('live-stats');

// ——— State ———
let currentCardIndex = 0;
let stage = 'idle';
let recognitionTime = parseFloat(recogInput.value) * 1000;
let practiceMissedMode = false;

const missedIndices = {
    oll: new Set(),
    pll: new Set()
};
let practiceMissedIndices = [];

const seenSet = {
    oll: new Set(),
    pll: new Set()
};

const correctSet = {
    oll: new Set(),
    pll: new Set()
};

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

function renderCube(alg, options = {}) {
    const player = document.createElement('twisty-player');
    player.setAttribute('alg', alg);
    player.setAttribute('experimental-setup-anchor', 'end');
    player.setAttribute('hint-facelets', 'none');
    player.setAttribute('camera', 'top');
    player.setAttribute('control-panel', 'none');
    player.setAttribute('background', 'none');
    if (options.visualization === '2d') {
        player.setAttribute('visualization', 'experimental-2D-LL');
    }
    const category = options.category || selectCategory.value;
    player.setAttribute('experimental-stickering', category.toUpperCase());
    player.style.width = '200px';
    player.style.height = '200px';
    player.style.margin = 'auto';
    return player;
}

function showPressSpaceMessage(targetElement) {
    targetElement.innerHTML = '<div style="color:#aaa; font-size:14px; margin-top: 10px;">Press Space to continue</div>';
    targetElement.style.display = 'flex';
    targetElement.style.justifyContent = 'center';
    targetElement.style.alignItems = 'center';
}

function updateLiveStats() {
    const cat = selectCategory.value;
    const time = (recognitionTime / 1000).toFixed(2);
    const seen = seenSet[cat].size;
    const correct = correctSet[cat].size;
    const acc = seen > 0 ? ((correct / seen) * 100).toFixed(1) : '—';
    statsDisplay.textContent = `Overall: ${acc}% accuracy on ${time}s recog ${cat.toUpperCase()} (${correct}/${seen})`;
}

// ——— UI States ———
function showMenu() {
    stage = 'idle';
    practiceMissedMode = false;
    practiceMissedIndices = [];
    container.innerHTML = '';
    answerElement.innerHTML = '';
    answerElement.style.display = 'none';
    answerButtons.style.display = 'none';
    statsScreen.style.display = 'none';
    menuScreen.style.display = 'block';
    btnBackMenu.style.display = 'none';
    statsDisplay.style.display = 'block';
    updateLiveStats();
}

function enterGameUI() {
    menuScreen.style.display = 'none';
    statsScreen.style.display = 'none';
    answerButtons.style.display = 'none';
    answerElement.style.display = 'none';
    btnBackMenu.style.display = 'inline-block';
    container.style.marginBottom = '10px';
}

// ——— Core Flow ———
function startCard() {
    enterGameUI();
    const cards = getCards();
    const missedSet = getMissedSet();

    if (practiceMissedMode) {
        practiceMissedIndices = Array.from(missedSet);
        if (!practiceMissedIndices.length) {
            alert('No missed cases in this category!');
            showMenu();
            return;
        }
        currentCardIndex = practiceMissedIndices.shift();
        practiceMissedIndices.push(currentCardIndex);
    } else {
        currentCardIndex = Math.floor(Math.random() * cards.length);
    }

    const card = cards[currentCardIndex];
    container.innerHTML = '';
    container.appendChild(renderCube(card.alg));
    stage = 'showing';

    setTimeout(() => {
        container.innerHTML = '';
        showPressSpaceMessage(container);
        stage = 'waitingAnswer';
    }, recognitionTime);
}

function showAnswer() {
    const cards = getCards();
    const card = cards[currentCardIndex];

    answerElement.innerHTML = '';
    answerElement.appendChild(
        renderCube(card.alg, { visualization: '2d' })
    );
    answerElement.style.display = 'block';
    answerButtons.style.display = 'block';
    stage = 'grading';
}

function grade(correct) {
    const cat = selectCategory.value;
    seenSet[cat].add(currentCardIndex);
    if (correct) {
        correctSet[cat].add(currentCardIndex);
    }

    const missedSet = getMissedSet();
    if (!correct) missedSet.add(currentCardIndex);
    else missedSet.delete(currentCardIndex);

    updateLiveStats();
    saveStats();

    answerButtons.style.display = 'none';
    answerElement.style.display = 'none';
    container.innerHTML = '';
    showPressSpaceMessage(container);
    stage = 'waitingNext';
}

function nextCard() {
    if (practiceMissedMode && !practiceMissedIndices.length) {
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

    const cat = selectCategory.value;
    const cards = getCards();
    const missedSet = getMissedSet();
    const seen = seenSet[cat].size;
    const correct = correctSet[cat].size;
    const acc = seen > 0 ? ((correct / seen) * 100).toFixed(1) : '—';

    const summary = document.createElement('div');
    summary.style.marginBottom = '10px';
    summary.textContent = `Accuracy: ${acc}% (${correct}/${seen})`;
    statsCards.appendChild(summary);

    if (!missedSet.size) {
        statsCards.appendChild(document.createTextNode('No missed cases yet.'));
        return;
    }

    missedSet.forEach(i => {
        const card = cards[i];
        const div = document.createElement('div');
        div.title = card.alg;
        const cube = renderCube(card.alg, { visualization: '2d' });
        cube.style.width = '90px';
        cube.style.height = '90px';
        div.appendChild(cube);
        div.onclick = () => {
            practiceMissedMode = true;
            practiceMissedIndices = [i];
            showMenu();
            startCard();
        };
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

// ——— LocalStorage Persistence ———
function saveStats() {
    localStorage.setItem('seenSet', JSON.stringify({
        oll: Array.from(seenSet.oll),
        pll: Array.from(seenSet.pll)
    }));
    localStorage.setItem('correctSet', JSON.stringify({
        oll: Array.from(correctSet.oll),
        pll: Array.from(correctSet.pll)
    }));
}

function loadStats() {
    try {
        const seenData = JSON.parse(localStorage.getItem('seenSet'));
        const correctData = JSON.parse(localStorage.getItem('correctSet'));
        if (seenData) {
            seenSet.oll = new Set(seenData.oll || []);
            seenSet.pll = new Set(seenData.pll || []);
        }
        if (correctData) {
            correctSet.oll = new Set(correctData.oll || []);
            correctSet.pll = new Set(correctData.pll || []);
        }
    } catch (e) {
        console.warn("Failed to load stats from localStorage.");
    }
}

// ——— Event Listeners ———
btnStart.onclick = () => {
    practiceMissedMode = false;
    startCard();
};
btnPracticeMissed.onclick = () => {
    if (!getMissedSet().size) { alert('No missed cases!'); return; }
    practiceMissedMode = true;
    practiceMissedIndices = Array.from(getMissedSet());
    startCard();
};
btnShowStats.onclick = showStats;
btnClearStats.onclick = clearStats;
btnCloseStats.onclick = showMenu;
btnBackMenu.onclick = showMenu;

recogInput.onchange = () => {
    let v = parseFloat(recogInput.value);
    if (isNaN(v) || v < 0) { v = 5; recogInput.value = v; }
    recognitionTime = v * 1000;
    alert('Recognition time changed. Stats preserved.');
    updateLiveStats();
};

btnCorrect.onclick = () => grade(true);
btnWrong.onclick = () => grade(false);

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
loadStats();
updateLiveStats();
showMenu();
