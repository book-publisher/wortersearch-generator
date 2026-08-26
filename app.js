let currentPuzzlesData = [];

// ── Language labels ───────────────────────────────────────────────────────
const LANG_LABELS = {
    en: { puzzle: 'Puzzle',      solution: 'Solution' },
    fr: { puzzle: 'Casse-t\u00eate', solution: 'Solution' },
    de: { puzzle: 'R\u00e4tsel',    solution: 'L\u00f6sung'  }
};

function getLang() {
    const el = document.getElementById('puzzle-language');
    return el ? el.value : 'en';
}

function getPuzzleLabel()   { return (LANG_LABELS[getLang()] || LANG_LABELS.en).puzzle;   }
function getSolutionLabel() { return (LANG_LABELS[getLang()] || LANG_LABELS.en).solution; }

function getSettings() {
    const preset = document.getElementById('grid-size-preset').value;
    let cols = 15, rows = 15;
    if (preset === '10x10') { cols = 10; rows = 10; }
    else if (preset === '15x15') { cols = 15; rows = 15; }
    else if (preset === '18x18') { cols = 18; rows = 18; }
    else if (preset === '20x20') { cols = 20; rows = 20; }
    else {
        cols = parseInt(document.getElementById('grid-cols').value) || 15;
        rows = parseInt(document.getElementById('grid-rows').value) || 15;
    }

    const directions = Array.from(document.querySelectorAll('.direction-toggle:checked')).map(cb => cb.value);
    
    // ── Title visibility logic ────────────────────────────────────────────────
    // A value that is ONLY spaces (e.g. " ") means the user wants NO title.
    const rawTitle = document.getElementById('puzzle-title').value;
    const showTitle = rawTitle.trim().length > 0; // false when empty or only spaces
    const titleText = showTitle ? rawTitle.trim() : '';

    return {
        title: titleText,
        showTitle: showTitle,
        words: document.getElementById('word-list').value.split('\n').map(w => w.trim()).filter(w => w),
        cols, rows,
        directions,
        allowBackwards: document.getElementById('allow-backwards').checked,
        trimSize: document.getElementById('trim-size').value,
        titlePlacement: 'center',
        cluePlacement: document.getElementById('clue-placement').value,
        clueCols: parseInt(document.getElementById('clue-cols').value) || 3,
        clueRows: parseInt(document.getElementById('clue-rows').value) || 5,
        clueSpacing: parseInt(document.getElementById('clue-spacing').value) || 10,
        fontTitle: document.getElementById('font-title').value,
        fontClues: document.getElementById('font-clues').value,
        fontGrid: document.getElementById('font-grid').value,
        bgOpacity: document.getElementById('bg-opacity').value / 100,
        showBorder: document.getElementById('grid-border').checked,
        wordsPerPuzzle: parseInt(document.getElementById('words-per-puzzle').value) || 15,
        puzzleCount: parseInt(document.getElementById('puzzle-count').value) || 1,
        solutionsPerPage: parseInt(document.getElementById('solutions-per-page').value) || 6,
        language: getLang()
    };
}

function renderPuzzleToDOM(puzzleData, puzzleNum, isSolution = false, isSmallMode = false) {
    const s = puzzleData.settings;
    const page = document.createElement('div');
    page.className = 'page';
    
    if (isSmallMode) {
        page.className = 'solution-mini-card';
    } else {
        // Set dimensions based on trim size
        let widthIn = 8.5, heightIn = 11;
        if (s.trimSize === '6x9') { widthIn = 6; heightIn = 9; }
        if (s.trimSize === '8.5x8.5') { widthIn = 8.5; heightIn = 8.5; }
        if (s.trimSize === 'A4') { widthIn = 8.27; heightIn = 11.69; }
        page.style.setProperty('--page-width', `${widthIn}in`);
        page.style.setProperty('--page-height', `${heightIn}in`);
    }

    // ── Title ──────────────────────────────────────────────────────────────
    // For solution pages and small-mode cards, always show the auto label.
    // For puzzle pages, only show a header when showTitle is not suppressed.
    const puzzleLabel   = (LANG_LABELS[s.language] || LANG_LABELS.en).puzzle;
    const solutionLabel = (LANG_LABELS[s.language] || LANG_LABELS.en).solution;

    // Determine whether to show a header at all
    const shouldShowHeader = isSolution || isSmallMode || s.showTitle !== false;

    if (shouldShowHeader) {
        const header = document.createElement('div');
        header.className = 'page-header';
        const title = document.createElement('h1');
        title.style.fontFamily = `"${s.fontTitle}", sans-serif`;

        if (isSmallMode) {
            // Mini solution card
            title.className = 'solution-mini-title';
            title.textContent = `${solutionLabel} #${puzzleNum}`;
        } else if (isSolution) {
            // Full solution page — always labelled
            title.className = `page-title title-${s.titlePlacement}`;
            title.textContent = `${solutionLabel} #${puzzleNum}`;
        } else {
            // Puzzle page — use custom title if provided, otherwise auto label
            title.className = `page-title title-${s.titlePlacement}`;
            title.textContent = s.title ? s.title : `${puzzleLabel} #${puzzleNum}`;
        }

        header.appendChild(title);
        page.appendChild(header);
    }

    // Body layout
    const body = document.createElement('div');
    body.className = `page-body layout-${s.cluePlacement}`;

    // Grid container
    const puzzleContainer = document.createElement('div');
    puzzleContainer.className = 'puzzle-container';
    
    const grid = document.createElement('div');
    grid.className = `word-grid ${(s.showBorder || isSmallMode) ? 'show-border' : ''}`;
    grid.style.position = 'relative';
    grid.style.fontFamily = `"${s.fontGrid}", monospace`;
    
    // Scale font size based on cols and whether it's small mode
    let baseFontSize = isSmallMode ? 8 : 18;
    if (s.cols > 15) baseFontSize -= 4;
    grid.style.fontSize = `${baseFontSize}px`;

    const cellW = isSmallMode ? 12 : (s.cols > 15 ? 20 : 30);
    grid.style.width = `${s.cols * cellW}px`;
    grid.style.height = `${s.rows * cellW}px`;

    // Render cells
    const cellWidth = `${cellW}px`;
    for (let r = 0; r < s.rows; r++) {
        for (let c = 0; c < s.cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.style.width = cellWidth;
            cell.style.height = cellWidth;
            cell.textContent = puzzleData.result.grid[r][c]; // ALWAYS SHOW LETTERS
            grid.appendChild(cell);
        }
    }
    
    // SVG Overlay for Solutions
    if (isSolution) {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.setAttribute("viewBox", `0 0 ${s.cols} ${s.rows}`);
        
        puzzleData.result.placedWords.forEach(pw => {
            const path = pw.path;
            const start = path[0];
            const end = path[path.length - 1];
            
            const r1 = start[0], c1 = start[1];
            const r2 = end[0], c2 = end[1];
            
            const cx = (c1 + c2) / 2 + 0.5;
            const cy = (r1 + r2) / 2 + 0.5;
            
            const dx = c2 - c1;
            const dy = r2 - r1;
            const len = Math.sqrt(dx * dx + dy * dy) + 1;
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            const rect = document.createElementNS(svgNS, "rect");
            const width = len - 0.2; // slight padding
            const height = 0.8; // slight padding
            
            rect.setAttribute("x", cx - width / 2);
            rect.setAttribute("y", cy - height / 2);
            rect.setAttribute("width", width);
            rect.setAttribute("height", height);
            rect.setAttribute("rx", 0.4);
            rect.setAttribute("ry", 0.4);
            
            rect.setAttribute("fill", "none");
            rect.setAttribute("stroke", "black");
            rect.setAttribute("stroke-width", isSmallMode ? "0.15" : "0.08");
            
            rect.setAttribute("transform", `rotate(${angle}, ${cx}, ${cy})`);
            svg.appendChild(rect);
        });
        
        grid.appendChild(svg);
    }
    
    puzzleContainer.appendChild(grid);
    body.appendChild(puzzleContainer);

    // Clues (only if not small mode)
    if (!isSmallMode) {
        const cluesContainer = document.createElement('div');
        cluesContainer.className = 'clues-container';
        
        const cluesList = document.createElement('ul');
        cluesList.className = 'clues-list';
        cluesList.style.fontFamily = `"${s.fontClues}", sans-serif`;
        
        // Dynamic layout for clues using flex
        if (s.cluePlacement === 'bottom') {
            cluesContainer.style.marginTop = `${s.clueSpacing}px`;
        }

        const sortedPlaced = puzzleData.result.placedWords.map(p => p.word).sort();
        const colPercent = 100 / s.clueCols;
        
        sortedPlaced.forEach(word => {
            const li = document.createElement('li');
            li.textContent = word;
            if (isSolution) li.classList.add('found');
            
            li.style.width = `calc(${colPercent}% - ${s.clueSpacing}px)`;
            li.style.marginRight = `${s.clueSpacing}px`;
            li.style.marginBottom = `${s.clueSpacing}px`;
            
            cluesList.appendChild(li);
        });

        cluesContainer.appendChild(cluesList);
        body.appendChild(cluesContainer);
    }

    page.appendChild(body);
    
    // Background overlay
    if (s.bgOpacity > 0 && !isSmallMode) {
        const bg = document.createElement('div');
        bg.className = 'bg-overlay';
        bg.style.backgroundColor = 'rgba(0,0,0,' + s.bgOpacity + ')'; // Placeholder for actual pattern
        page.appendChild(bg);
    }

    return page;
}

function generateBatch() {
    const s = getSettings();
    currentPuzzlesData = [];

    const errorMsg = document.getElementById('error-message');
    errorMsg.style.display = 'none';
    
    // Check word lengths
    const maxDimension = Math.max(s.cols, s.rows);
    const oversized = s.words.some(w => w.length > maxDimension);
    if (oversized) {
        errorMsg.textContent = "Warning: Some words are longer than the grid size and may not fit!";
        errorMsg.style.display = 'block';
    }

    let wordsPerPuzzle = s.wordsPerPuzzle;
    
    for (let i = 0; i < s.puzzleCount; i++) {
        let puzzleWords = [];
        if (s.words.length > 0) {
            for (let j = 0; j < wordsPerPuzzle; j++) {
                const wordIndex = (i * wordsPerPuzzle + j) % s.words.length;
                puzzleWords.push(s.words[wordIndex]);
            }
        }

        const genConfig = {
            rows: s.rows,
            cols: s.cols,
            words: puzzleWords,
            directions: s.directions,
            allowBackwards: s.allowBackwards
        };
        const generator = new WordSearchGenerator(genConfig);
        const result = generator.generate();
        
        currentPuzzlesData.push({
            settings: s,
            result: result
        });
    }

    updatePreview();
}

function updatePreview() {
    const canvas = document.getElementById('preview-canvas');
    canvas.innerHTML = '';
    
    if (currentPuzzlesData.length === 0) return;

    // Show only the first puzzle and its solution in the live preview
    const firstPuzzle = currentPuzzlesData[0];
    
    const puzzleDom = renderPuzzleToDOM(firstPuzzle, 1, false);
    const solutionDom = renderPuzzleToDOM(firstPuzzle, 1, true);
    
    canvas.appendChild(puzzleDom);
    canvas.appendChild(solutionDom);
}

// Event Listeners
document.getElementById('generate-btn').addEventListener('click', generateBatch);

document.getElementById('export-pdf-btn').addEventListener('click', async () => {
    if (currentPuzzlesData.length === 0) {
        generateBatch();
    }
    const btn = document.getElementById('export-pdf-btn');
    const oldText = btn.textContent;
    btn.textContent = 'Generating PDF... Please wait';
    btn.disabled = true;
    
    try {
        const s = getSettings();
        await generatePDF(currentPuzzlesData, s.trimSize, s.solutionsPerPage);
    } catch (err) {
        console.error(err);
        alert("Error generating PDF. See console.");
    } finally {
        btn.textContent = oldText;
        btn.disabled = false;
    }
});

// Settings interactions
document.getElementById('grid-size-preset').addEventListener('change', (e) => {
    const custom = document.getElementById('custom-grid-size');
    if (e.target.value === 'custom') {
        custom.style.display = 'flex';
    } else {
        custom.style.display = 'none';
    }
});

// Removed clue-placement event listener since it's always visible now

document.getElementById('shuffle-words').addEventListener('click', () => {
    const ta = document.getElementById('word-list');
    const words = ta.value.split('\n').filter(w => w.trim());
    for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
    }
    ta.value = words.join('\n');
});

// CSV Upload logic
document.getElementById('csv-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        const text = ev.target.result;
        // Basic CSV parsing: split by newlines, take first column, ignore empty
        const words = text.split(/\r?\n/)
            .map(row => row.split(',')[0].trim())
            .filter(w => w.length > 0);
            
        if (words.length > 0) {
            document.getElementById('word-list').value = words.join('\n');
            alert(`Loaded ${words.length} words from CSV.`);
        }
    };
    reader.readAsText(file);
});

// Language change triggers a preview refresh
document.getElementById('puzzle-language').addEventListener('change', generateBatch);

// ── Puzzle title: live-update preview as the user types ───────────────────────
// If the field contains only spaces the title will be hidden; any other text shows it.
document.getElementById('puzzle-title').addEventListener('input', () => {
    // Rebuild the settings snapshot in currentPuzzlesData so renderPuzzleToDOM
    // picks up the new title / showTitle flag, then repaint the preview.
    const rawTitle = document.getElementById('puzzle-title').value;
    const showTitle = rawTitle.trim().length > 0;
    const titleText = showTitle ? rawTitle.trim() : '';

    currentPuzzlesData.forEach(pd => {
        pd.settings.title     = titleText;
        pd.settings.showTitle = showTitle;
    });

    updatePreview();
});

// Initial generation
window.addEventListener('settingsChanged', generateBatch);
setTimeout(generateBatch, 500); // give fonts a moment to load
