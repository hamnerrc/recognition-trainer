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

// ——— State ———
let currentCardIndex = 0;
let stage = 'idle';       // idle, showing, waitingAnswer, grading, waitingNext
let recognitionTime = parseFloat(recogInput.value) * 1000;
let practiceMissedMode = false;

// missedIndices separated per category
const missedIndices = {
    oll: new Set(),
    pll: new Set()
};
let practiceMissedIndices = [];

// ——— Helpers ———
function getCards() {
    return selectCategory.value === 'oll' ? ollCards : pllCards;
}

function getMissedSet() {
    return selectCategory.value === 'oll' ? missedIndices.oll : missedIndices.pll;
}

function renderCube(alg, options = {}) {
    const player = document.createElement('twisty-player');
    player.setAttribute('alg', alg);
    player.setAttribute('experimental-setup-anchor', 'end');
    player.setAttribute('hint-facelets', 'none');
    if (selectCategory.value === 'oll') {
        player.setAttribute('experimental-stickering', 'OLL');
    }
    player.setAttribute('control-panel', 'none');
    player.setAttribute('camera', 'top');
    player.style.width = '200px';
    player.style.height = '200px';
    player.style.margin = 'auto';

    if (options.visualization === '2d') {
        player.setAttribute('visualization', 'experimental-2D-LL');
        player.setAttribute('background', 'none');
    } else {
        player.setAttribute('background', 'none');
    }
    return player;
}

function showPressSpaceMessage(targetElement) {
    targetElement.innerHTML = '<div style="color:#aaa; font-size:14px; margin-top: 10px;">Press Space to continue</div>';
    targetElement.style.display = 'flex';
    targetElement.style.justifyContent = 'center';
    targetElement.style.alignItems = 'center';
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
        showPressSpaceMessage(container);  // added message here
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
    const missedSet = getMissedSet();
    if (!correct) missedSet.add(currentCardIndex);
    answerButtons.style.display = 'none';
    answerElement.style.display = 'none';
    container.innerHTML = '';
    showPressSpaceMessage(container);  // added message here
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

    const cards = getCards();
    const missedSet = getMissedSet();
    if (!missedSet.size) {
        statsCards.textContent = 'No missed cases yet.';
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
    if (confirm('Clear all missed stats for this category?')) {
        getMissedSet().clear();
        practiceMissedIndices = [];
        showMenu();
    }
}

// ——— Import/Export ———
function exportData() {
    const data = {
        missedIndices: {
            oll: Array.from(missedIndices.oll),
            pll: Array.from(missedIndices.pll),
        },
        recognitionTime: recognitionTime / 1000,
        practiceMissedIndices: practiceMissedIndices.slice(),
        selectCategory: selectCategory.value,
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'recog-trainer-data.json';
    a.click();

    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.missedIndices) {
                missedIndices.oll = new Set(data.missedIndices.oll || []);
                missedIndices.pll = new Set(data.missedIndices.pll || []);
            }
            if (typeof data.recognitionTime === 'number') {
                recognitionTime = data.recognitionTime * 1000;
                recogInput.value = data.recognitionTime;
            }
            if (Array.isArray(data.practiceMissedIndices)) {
                practiceMissedIndices = data.practiceMissedIndices;
            }
            if (data.selectCategory && (data.selectCategory === 'oll' || data.selectCategory === 'pll')) {
                selectCategory.value = data.selectCategory;
            }
            alert('Data imported successfully.');
            showMenu();
        } catch (err) {
            alert('Failed to import data: invalid file.');
        }
    };
    reader.readAsText(file);
}

// ——— Event Listeners ———
btnStart.onclick = () => { practiceMissedMode = false; startCard(); };
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
    missedIndices.oll.clear();
    missedIndices.pll.clear();
    practiceMissedIndices = [];
    alert('Recognition time changed; all stats cleared.');
    showMenu();
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

btnExportData.onclick = exportData;

btnImportData.onclick = () => {
    fileImportInput.value = null; // reset so same file can be reimported
    fileImportInput.click();
};

fileImportInput.onchange = importData;

// ——— Init ———
showMenu();
