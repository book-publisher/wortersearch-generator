/**
 * pdf-export.js  –  Native jsPDF vector rendering with Google Font embedding
 * Draws the puzzle grid, letters, clues, and solution outlines directly
 * using jsPDF primitives for sharp, print-ready, high-resolution output.
 *
 * Font embedding: at export time the selected Google Fonts (title, clues,
 * grid) are fetched as TTF binaries, base64-encoded, and registered with
 * jsPDF via addFileToVFS/addFont. This means the downloaded PDF matches
 * the on-screen preview exactly.
 *
 * Fallback: if the page is opened as file:// or the CDN is unreachable,
 * font embedding is skipped gracefully and Helvetica is used — the PDF
 * still generates without any error.
 */

function umlautSafe(str) {
    return String(str);
}

// ── Direct TTF source map – Google Fonts GitHub repo via jsDelivr CDN ─────────
// jsPDF 2.5.1 requires real TTF binary data. woff2 (what the Google Fonts CSS
// API returns in modern browsers) is Brotli-compressed and cannot be parsed by
// jsPDF. These URLs point to the uncompressed TTF source files in the official
// Google/fonts GitHub repository served via jsDelivr (full CORS support).
// Each entry: [ primaryUrl, alternativeUrl ]
const FONT_TTF_URLS = {
    'Roboto':           ['https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Roboto-Regular.ttf'],
    'Open Sans':        ['https://cdn.jsdelivr.net/gh/google/fonts@main/apache/opensans/static/OpenSans-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/opensans/OpenSans-Regular.ttf'],
    'Lato':             ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lato/Lato-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lato/static/Lato-Regular.ttf'],
    'Montserrat':       ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/static/Montserrat-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/Montserrat-Regular.ttf'],
    'Oswald':           ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/oswald/static/Oswald-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/oswald/Oswald-Regular.ttf'],
    'Source Sans Pro':  ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sourcesanspro/SourceSansPro-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sourcesans3/static/SourceSans3-Regular.ttf'],
    'Slabo 27px':       ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/slabo27px/Slabo27px-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/slabo27px/static/Slabo27px-Regular.ttf'],
    'Raleway':          ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/raleway/static/Raleway-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/raleway/Raleway-Regular.ttf'],
    'PT Sans':          ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ptsans/PTSans-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ptsans/static/PTSans-Regular.ttf'],
    'Merriweather':     ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/merriweather/Merriweather-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/merriweather/static/Merriweather-Regular.ttf'],
    'Nunito':           ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nunito/static/Nunito-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nunito/Nunito-Regular.ttf'],
    'Playfair Display': ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/playfairdisplay/static/PlayfairDisplay-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/playfairdisplay/PlayfairDisplay-Regular.ttf'],
    'Rubik':            ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/rubik/static/Rubik-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/rubik/Rubik-Regular.ttf'],
    'Lora':             ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lora/static/Lora-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lora/Lora-Regular.ttf'],
    'Work Sans':        ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/worksans/static/WorkSans-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/worksans/WorkSans-Regular.ttf'],
    'Fira Sans':        ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/firasans/FiraSans-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/firasans/static/FiraSans-Regular.ttf'],
    'Quicksand':        ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/quicksand/static/Quicksand-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/quicksand/Quicksand-Regular.ttf'],
    'Inter':            ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/static/Inter-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter-Regular.ttf'],
    'Outfit':           ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/outfit/static/Outfit-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/outfit/Outfit-Regular.ttf'],
    'Cabin':            ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cabin/static/Cabin-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cabin/Cabin-Regular.ttf'],
    'Inconsolata':      ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inconsolata/static/Inconsolata-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inconsolata/Inconsolata-Regular.ttf'],
    'Josefin Sans':     ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/josefinsans/static/JosefinSans-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/josefinsans/JosefinSans-Regular.ttf'],
    'DM Sans':          ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/dmsans/static/DMSans-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/dmsans/DMSans-Regular.ttf'],
    'Anton':            ['https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/anton/Anton-Regular.ttf',
                         'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/anton/static/Anton-Regular.ttf'],
};

// ── Per-session font data cache ───────────────────────────────────────────────
const _fontDataCache = {}; // fontName → { base64, vfsName } | 'failed'

/**
 * Fetch a TTF font binary and cache it.
 * Returns true on success, false if download failed or was skipped.
 * NEVER throws — all errors are caught internally.
 */
async function fetchGoogleFontBase64(fontName) {
    if (!fontName) return false;
    if (_fontDataCache[fontName] === 'failed') return false;
    if (_fontDataCache[fontName]) return true;

    const urls = FONT_TTF_URLS[fontName] || [];
    if (urls.length === 0) {
        console.warn(`[pdf-export] No known TTF URL for "${fontName}" – skipping`);
        _fontDataCache[fontName] = 'failed';
        return false;
    }

    for (const url of urls) {
        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                console.warn(`[pdf-export] HTTP ${resp.status} for "${fontName}" at ${url}`);
                continue;
            }
            const buffer = await resp.arrayBuffer();
            if (!buffer || buffer.byteLength < 200) {
                console.warn(`[pdf-export] Too small for "${fontName}" at ${url}`);
                continue;
            }

            // Base64-encode in chunks to avoid call-stack overflow
            const uint8 = new Uint8Array(buffer);
            let binary = '';
            const CHUNK = 8192;
            for (let i = 0; i < uint8.length; i += CHUNK) {
                binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK));
            }

            const vfsName = `${fontName.replace(/ /g, '_')}-Regular.ttf`;
            _fontDataCache[fontName] = { base64: btoa(binary), vfsName };
            console.info(`[pdf-export] ✓ Font embedded: "${fontName}" (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
            return true;

        } catch (err) {
            // fetch() throws on network errors (e.g. file:// protocol blocked)
            console.warn(`[pdf-export] Fetch error for "${fontName}" (${url}): ${err.message}`);
        }
    }

    console.warn(`[pdf-export] Could not embed "${fontName}" – falling back to Helvetica`);
    _fontDataCache[fontName] = 'failed';
    return false;
}

/**
 * Register a cached font into a jsPDF instance.
 * Returns the font name to use with setFont(), or 'helvetica' on failure.
 * Uses lowercase 'helvetica' which is always available in jsPDF.
 */
function registerFontInPdf(pdf, fontName) {
    if (!fontName) return 'helvetica';
    const entry = _fontDataCache[fontName];
    if (!entry || entry === 'failed') return 'helvetica';

    try {
        pdf.addFileToVFS(entry.vfsName, entry.base64);
        pdf.addFont(entry.vfsName, fontName, 'normal');
        pdf.addFont(entry.vfsName, fontName, 'bold'); // same file – bold style alias
        return fontName;
    } catch (err) {
        console.warn(`[pdf-export] Could not register "${fontName}" in pdf: ${err.message}`);
        return 'helvetica';
    }
}

/**
 * Safe pdf.setFont() wrapper.
 * Falls back to 'helvetica'/'normal' if the requested font/style isn't available.
 */
function safeSetFont(pdf, fontName, style) {
    style = style || 'normal';
    // First try the requested font + style
    try {
        pdf.setFont(fontName, style);
        return;
    } catch (_) { /* fall through */ }
    // Try the same font with 'normal' (in case bold wasn't registered)
    if (style !== 'normal') {
        try {
            pdf.setFont(fontName, 'normal');
            return;
        } catch (_) { /* fall through */ }
    }
    // Final fallback: helvetica normal (always available)
    try {
        pdf.setFont('helvetica', 'normal');
    } catch (_) { /* nothing more to do */ }
}

// ── Main export entry point ───────────────────────────────────────────────────

async function generatePDF(puzzlesData, trimSizeStr, solutionsPerPage) {
    const { jsPDF } = window.jspdf;

    // ── Trim size in inches ──────────────────────────────────────────
    let W, H;
    if      (trimSizeStr === '8.5x11')  { W = 8.5;  H = 11;   }
    else if (trimSizeStr === '6x9')     { W = 6;    H = 9;    }
    else if (trimSizeStr === '8.5x8.5') { W = 8.5;  H = 8.5;  }
    else if (trimSizeStr === 'A4')      { W = 8.27; H = 11.69; }
    else                                { W = 8.5;  H = 11;   }

    const pdf = new jsPDF({
        orientation: W > H ? 'landscape' : 'portrait',
        unit: 'in',
        format: [W, H]
    });

    const MARGIN   = 0.5;
    const usableW  = W - 2 * MARGIN;
    const usableH  = H - 2 * MARGIN;

    // ── Collect unique font names needed ─────────────────────────────
    const fontNamesNeeded = new Set();
    puzzlesData.forEach(pd => {
        if (pd.settings.fontTitle) fontNamesNeeded.add(pd.settings.fontTitle);
        if (pd.settings.fontClues) fontNamesNeeded.add(pd.settings.fontClues);
        if (pd.settings.fontGrid)  fontNamesNeeded.add(pd.settings.fontGrid);
    });

    // ── Phase 1: fetch all TTF binaries in parallel ───────────────────
    // fetchGoogleFontBase64 never throws — failures are silent & graceful.
    await Promise.all([...fontNamesNeeded].map(name => fetchGoogleFontBase64(name)));

    // ── Phase 2: register each fetched font into this jsPDF instance ──
    const fontNameMap = {}; // display name → resolved jsPDF font name
    [...fontNamesNeeded].forEach(name => {
        fontNameMap[name] = registerFontInPdf(pdf, name);
    });

    // Resolve a settings font name to the embedded jsPDF name (or fallback)
    function resolveFont(name) {
        return fontNameMap[name] || 'helvetica';
    }

    // ── Helper: draw a single full puzzle page (puzzle or solution) ───
    function drawPuzzlePage(puzzleData, puzzleNum, isSolution) {
        const s      = puzzleData.settings;
        const result = puzzleData.result;
        const grid   = result.grid;
        const rows   = s.rows;
        const cols   = s.cols;

        const titleFont = resolveFont(s.fontTitle);
        const cluesFont = resolveFont(s.fontClues);
        const gridFont  = resolveFont(s.fontGrid);

        // ── Language labels ─────────────────────────────────────────
        const LANG_LABELS_PDF = {
            en: { puzzle: 'Puzzle',          solution: 'Solution' },
            fr: { puzzle: 'Casse-t\u00eate', solution: 'Solution' },
            de: { puzzle: 'R\u00e4tsel',     solution: 'L\u00f6sung' }
        };
        const lang   = s.language || 'en';
        const labels = LANG_LABELS_PDF[lang] || LANG_LABELS_PDF.en;

        // ── Title ────────────────────────────────────────────────────
        let titleText;
        if (isSolution) {
            titleText = `${labels.solution} #${puzzleNum}`;
        } else if (s.showTitle === false) {
            titleText = null;
        } else {
            titleText = s.title && s.title.trim() ? s.title.trim() : `${labels.puzzle} #${puzzleNum}`;
        }

        let titleX, titleAlign;
        if (s.titlePlacement === 'left')       { titleX = MARGIN;     titleAlign = 'left';   }
        else if (s.titlePlacement === 'right')  { titleX = W - MARGIN; titleAlign = 'right';  }
        else                                    { titleX = W / 2;      titleAlign = 'center'; }

        if (titleText !== null) {
            safeSetFont(pdf, titleFont, 'bold');
            pdf.setFontSize(22);
            pdf.setTextColor(0, 0, 0);
            pdf.text(titleText, titleX, MARGIN + 0.3, { align: titleAlign });
        }

        // ── Grid geometry ────────────────────────────────────────────
        const titleBottomY   = MARGIN + 0.5;
        const clueAreaHeight = 2.5;
        const maxGridH       = usableH - 0.5 - clueAreaHeight;
        const maxGridW       = usableW;

        const cellSize = Math.min(maxGridW / cols, maxGridH / rows);
        const gridW    = cellSize * cols;
        const gridH    = cellSize * rows;
        const gridX    = (W - gridW) / 2;
        const gridY    = titleBottomY;

        // ── Grid border ──────────────────────────────────────────────
        if (s.showBorder) {
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.02);
            pdf.rect(gridX, gridY, gridW, gridH);
        }

        // ── Grid letters ─────────────────────────────────────────────
        const letterFontSize = Math.min(cellSize * 72 * 0.55, 18);
        safeSetFont(pdf, gridFont, 'normal');
        pdf.setFontSize(letterFontSize);
        pdf.setTextColor(0, 0, 0);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cx = gridX + c * cellSize + cellSize / 2;
                const cy = gridY + r * cellSize + cellSize / 2 + (letterFontSize / 72) * 0.35;
                pdf.text(umlautSafe(grid[r][c]), cx, cy, { align: 'center' });
            }
        }

        // ── Solution outlines (pill shapes) ──────────────────────────
        if (isSolution) {
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.018);
            pdf.setFillColor(255, 255, 255);

            result.placedWords.forEach(pw => {
                const path = pw.path;
                if (path.length === 0) return;

                const startR = path[0][0],             startC = path[0][1];
                const endR   = path[path.length-1][0], endC   = path[path.length-1][1];

                const x1 = gridX + startC * cellSize + cellSize / 2;
                const y1 = gridY + startR * cellSize + cellSize / 2;
                const x2 = gridX + endC   * cellSize + cellSize / 2;
                const y2 = gridY + endR   * cellSize + cellSize / 2;

                const mx      = (x1 + x2) / 2;
                const my      = (y1 + y2) / 2;
                const dx      = x2 - x1;
                const dy      = y2 - y1;
                const wordLen = Math.sqrt(dx * dx + dy * dy) + cellSize * 0.9;
                const angle   = Math.atan2(dy, dx);

                drawRotatedRoundedRect(pdf, mx, my, wordLen, cellSize * 0.84, cellSize * 0.42, angle);
            });
        }

        // ── Clues ────────────────────────────────────────────────────
        const clueStartY   = gridY + gridH + 0.35;
        const clueFontSize = 11;
        safeSetFont(pdf, cluesFont, 'normal');
        pdf.setFontSize(clueFontSize);
        pdf.setTextColor(0, 0, 0);

        const sortedWords = result.placedWords.map(p => p.word).sort();
        const colWidth    = usableW / s.clueCols;
        const lineHeight  = clueFontSize / 72 + 0.12;

        sortedWords.forEach((word, idx) => {
            const col = idx % s.clueCols;
            const row = Math.floor(idx / s.clueCols);
            const cx  = MARGIN + col * colWidth + colWidth / 2;
            const cy  = clueStartY + row * lineHeight;
            if (cy < H - MARGIN) {
                pdf.text(umlautSafe(word), cx, cy, { align: 'center' });
            }
        });
    }

    // ── Rotated pill outline helper ───────────────────────────────────
    function drawRotatedRoundedRect(doc, cx, cy, w, h, r, angle) {
        r = Math.min(r, w / 2, h / 2);

        const hw  = w / 2;
        const hh  = h / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        function rot(lx, ly) {
            return [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos];
        }

        const corners = [
            { cx: -hw + r, cy: -hh + r },
            { cx:  hw - r, cy: -hh + r },
            { cx:  hw - r, cy:  hh - r },
            { cx: -hw + r, cy:  hh - r },
        ];

        const startP   = rot(-hw + r, -hh);
        const arcSteps = 8;
        const segments = [];

        segments.push(rot(hw - r, -hh));
        for (let i = 1; i <= arcSteps; i++) {
            const t = (i / arcSteps) * Math.PI / 2;
            segments.push(rot(corners[1].cx + r * Math.cos(Math.PI * 1.5 + t),
                               corners[1].cy + r * Math.sin(Math.PI * 1.5 + t)));
        }
        segments.push(rot(hw, hh - r));
        for (let i = 1; i <= arcSteps; i++) {
            const t = (i / arcSteps) * Math.PI / 2;
            segments.push(rot(corners[2].cx + r * Math.cos(t),
                               corners[2].cy + r * Math.sin(t)));
        }
        segments.push(rot(-hw + r, hh));
        for (let i = 1; i <= arcSteps; i++) {
            const t = (i / arcSteps) * Math.PI / 2;
            segments.push(rot(corners[3].cx + r * Math.cos(Math.PI * 0.5 + t),
                               corners[3].cy + r * Math.sin(Math.PI * 0.5 + t)));
        }
        segments.push(rot(-hw, -hh + r));
        for (let i = 1; i <= arcSteps; i++) {
            const t = (i / arcSteps) * Math.PI / 2;
            segments.push(rot(corners[0].cx + r * Math.cos(Math.PI + t),
                               corners[0].cy + r * Math.sin(Math.PI + t)));
        }

        const lineSegments = [];
        for (let i = 0; i < segments.length; i++) {
            const prev = i === 0 ? startP : segments[i - 1];
            lineSegments.push([segments[i][0] - prev[0], segments[i][1] - prev[1]]);
        }

        doc.setLineWidth(0.018);
        doc.setDrawColor(0, 0, 0);
        doc.lines(lineSegments, startP[0], startP[1], [1, 1], 'S', true);
    }

    // ── Mini solution card (multi-up layout) ─────────────────────────
    function drawMiniSolution(puzzleData, puzzleNum, ox, oy, boxW, boxH) {
        const s      = puzzleData.settings;
        const result = puzzleData.result;
        const grid   = result.grid;
        const rows   = s.rows;
        const cols   = s.cols;

        const titleFont = resolveFont(s.fontTitle);
        const gridFont  = resolveFont(s.fontGrid);

        const LANG_LABELS_MINI = {
            en: { solution: 'Solution' },
            fr: { solution: 'Solution' },
            de: { solution: 'L\u00f6sung' }
        };
        const miniLang   = s.language || 'en';
        const miniLabels = LANG_LABELS_MINI[miniLang] || LANG_LABELS_MINI.en;

        safeSetFont(pdf, titleFont, 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${miniLabels.solution} #${puzzleNum}`, ox + boxW / 2, oy + 0.18, { align: 'center' });

        const innerMargin = 0.1;
        const gridTopY    = oy + 0.25;
        const availW      = boxW - 2 * innerMargin;
        const availH      = boxH - 0.35;
        const cellSize    = Math.min(availW / cols, availH / rows);
        const gridW       = cellSize * cols;
        const gridH       = cellSize * rows;
        const gridX       = ox + (boxW - gridW) / 2;
        const gridY       = gridTopY;

        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.025);
        pdf.rect(gridX, gridY, gridW, gridH);

        const fontSize = Math.max(5, Math.min(cellSize * 72 * 0.55, 10));
        safeSetFont(pdf, gridFont, 'normal');
        pdf.setFontSize(fontSize);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cx = gridX + c * cellSize + cellSize / 2;
                const cy = gridY + r * cellSize + cellSize / 2 + (fontSize / 72) * 0.35;
                pdf.text(umlautSafe(grid[r][c]), cx, cy, { align: 'center' });
            }
        }

        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.012);

        result.placedWords.forEach(pw => {
            const path = pw.path;
            if (path.length === 0) return;

            const startR = path[0][0],             startC = path[0][1];
            const endR   = path[path.length-1][0], endC   = path[path.length-1][1];

            const x1 = gridX + startC * cellSize + cellSize / 2;
            const y1 = gridY + startR * cellSize + cellSize / 2;
            const x2 = gridX + endC   * cellSize + cellSize / 2;
            const y2 = gridY + endR   * cellSize + cellSize / 2;

            const mx      = (x1 + x2) / 2;
            const my      = (y1 + y2) / 2;
            const dx      = x2 - x1;
            const dy      = y2 - y1;
            const wordLen = Math.sqrt(dx * dx + dy * dy) + cellSize * 0.85;
            const ang     = Math.atan2(dy, dx);

            drawRotatedRoundedRect(pdf, mx, my, wordLen, cellSize * 0.78, cellSize * 0.39, ang);
        });
    }

    // ══════════════════════════════════════════════════════════════════
    //  RENDER ALL PAGES
    // ══════════════════════════════════════════════════════════════════

    for (let i = 0; i < puzzlesData.length; i++) {
        if (i > 0) pdf.addPage([W, H], W > H ? 'landscape' : 'portrait');
        drawPuzzlePage(puzzlesData[i], i + 1, false);
    }

    if (solutionsPerPage === 1) {
        for (let i = 0; i < puzzlesData.length; i++) {
            pdf.addPage([W, H], W > H ? 'landscape' : 'portrait');
            drawPuzzlePage(puzzlesData[i], i + 1, true);
        }
    } else {
        let solCols, solRows;
        if (solutionsPerPage <= 2)      { solCols = 1; solRows = 2; }
        else if (solutionsPerPage <= 4) { solCols = 2; solRows = 2; }
        else                            { solCols = 2; solRows = 3; }

        const boxW = usableW / solCols;
        const boxH = usableH / solRows;

        let idx = 0;
        while (idx < puzzlesData.length) {
            pdf.addPage([W, H], W > H ? 'landscape' : 'portrait');
            const startY = MARGIN;

            for (let slot = 0; slot < solutionsPerPage && idx < puzzlesData.length; slot++) {
                const col = slot % solCols;
                const row = Math.floor(slot / solCols);
                drawMiniSolution(puzzlesData[idx], idx + 1,
                    MARGIN + col * boxW, startY + row * boxH, boxW, boxH);
                idx++;
            }
        }
    }

    pdf.save('WordSearch_PuzzleBook.pdf');
}
