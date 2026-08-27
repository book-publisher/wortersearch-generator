/**
 * pdf-export.js  –  Native jsPDF vector rendering
 * Draws the puzzle grid, letters, clues, and solution outlines directly
 * using jsPDF primitives for sharp, print-ready, high-resolution output.
 *
 * German Umlaut support: Ä, Ö, Ü are preserved in the grid and clues.
 * ß is always rendered as SS (handled upstream in generator.js).
 */

/**
 * Ensure German Umlaut characters survive jsPDF's WinAnsi text encoder.
 * jsPDF 2.x maps JS Unicode strings through a WinAnsi lookup table;
 * passing the characters directly works in most builds, but this tiny
 * shim keeps it explicit and safe across versions.
 *
 * Characters outside the map (accented letters not in CP1252) are left
 * as-is — jsPDF will substitute them with '?' only if it can't encode them,
 * which never happens for Ä Ö Ü ä ö ü (all present in CP1252).
 */
function umlautSafe(str) {
    // These characters are all in WinAnsi / CP1252, so no substitution needed.
    // We return the string as-is; jsPDF 2.5+ handles them correctly.
    // (Keeping this function as a clear hook for future font-embedding changes.)
    return String(str);
}

async function generatePDF(puzzlesData, trimSizeStr, solutionsPerPage) {
    const { jsPDF } = window.jspdf;

    // ── Trim size in inches ──────────────────────────────────────────
    let W, H; // page width / height in inches
    if      (trimSizeStr === '8.5x11')  { W = 8.5;  H = 11;   }
    else if (trimSizeStr === '6x9')     { W = 6;    H = 9;    }
    else if (trimSizeStr === '8.5x8.5') { W = 8.5;  H = 8.5;  }
    else if (trimSizeStr === 'A4')      { W = 8.27; H = 11.69;}
    else                                { W = 8.5;  H = 11;   }

    const pdf = new jsPDF({
        orientation: W > H ? 'landscape' : 'portrait',
        unit: 'in',
        format: [W, H]
    });

    const MARGIN = 0.5; // half-inch margins on all sides
    const usableW = W - 2 * MARGIN;
    const usableH = H - 2 * MARGIN;

    // ── Helper: draw a single full puzzle page (puzzle or solution) ──
    function drawPuzzlePage(puzzleData, puzzleNum, isSolution) {
        const s = puzzleData.settings;
        const result = puzzleData.result;
        const grid = result.grid;
        const rows = s.rows;
        const cols = s.cols;

        // ── Title ────────────────────────────────────────────────────
        const titleFont = s.fontTitle || 'Helvetica';
        pdf.setFont('Helvetica', 'bold'); // fallback; custom fonts need embedding
        pdf.setFontSize(22);
        pdf.setTextColor(0, 0, 0);

        // ── Language labels ─────────────────────────────────────────
        const LANG_LABELS_PDF = {
            en: { puzzle: 'Puzzle',       solution: 'Solution' },
            fr: { puzzle: 'Casse-t\u00eate', solution: 'Solution'  },
            de: { puzzle: 'R\u00e4tsel',     solution: 'L\u00f6sung'   }
        };
        const lang = s.language || 'en';
        const labels = LANG_LABELS_PDF[lang] || LANG_LABELS_PDF.en;

        // Determine what to show in the title area:
        //   - Solution page   → always show auto "Solution #N" label
        //   - Puzzle page, showTitle === false  → skip title entirely
        //   - Puzzle page, custom title provided → use that text
        //   - Puzzle page, no custom title       → fall back to auto "Puzzle #N"
        let titleText;
        if (isSolution) {
            titleText = `${labels.solution} #${puzzleNum}`;
        } else if (s.showTitle === false) {
            titleText = null; // hidden
        } else {
            titleText = s.title && s.title.trim() ? s.title.trim() : `${labels.puzzle} #${puzzleNum}`;
        }

        let titleX;
        let titleAlign = 'center';
        if (s.titlePlacement === 'left')       { titleX = MARGIN; titleAlign = 'left'; }
        else if (s.titlePlacement === 'right')  { titleX = W - MARGIN; titleAlign = 'right'; }
        else                                    { titleX = W / 2; titleAlign = 'center'; }

        if (titleText !== null) {
            pdf.text(titleText, titleX, MARGIN + 0.3, { align: titleAlign });
        }

        // ── Grid geometry ────────────────────────────────────────────
        // The grid is always top-center, directly under the title
        const titleBottomY = MARGIN + 0.5;

        // Calculate max cell size so the grid fits within usable width
        // and leaves room for clues below
        const clueAreaHeight = 2.5; // reserve generous space at bottom for clues
        const maxGridH = usableH - 0.5 - clueAreaHeight; // subtract title area + clue area
        const maxGridW = usableW;

        const cellSize = Math.min(maxGridW / cols, maxGridH / rows);
        const gridW = cellSize * cols;
        const gridH = cellSize * rows;

        // Center the grid horizontally
        const gridX = (W - gridW) / 2;
        const gridY = titleBottomY;

        // ── Draw grid border ─────────────────────────────────────────
        if (s.showBorder) {
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.02);
            pdf.rect(gridX, gridY, gridW, gridH);
        }

        // ── Draw letters ─────────────────────────────────────────────
        const letterFontSize = Math.min(cellSize * 72 * 0.55, 18); // 55% of cell in points, max 18pt
        pdf.setFontSize(letterFontSize);
        pdf.setFont('Helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cx = gridX + c * cellSize + cellSize / 2;
                const cy = gridY + r * cellSize + cellSize / 2 + (letterFontSize / 72) * 0.35;
                pdf.text(umlautSafe(grid[r][c]), cx, cy, { align: 'center' });
            }
        }

        // ── Solution outlines (black rounded rectangles) ─────────────
        if (isSolution) {
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.018);
            pdf.setFillColor(255, 255, 255); // not used, just ensure no fill

            result.placedWords.forEach(pw => {
                const path = pw.path;
                if (path.length === 0) return;

                const startR = path[0][0],            startC = path[0][1];
                const endR   = path[path.length-1][0], endC   = path[path.length-1][1];

                // Center of first and last cell in page coordinates
                const x1 = gridX + startC * cellSize + cellSize / 2;
                const y1 = gridY + startR * cellSize + cellSize / 2;
                const x2 = gridX + endC   * cellSize + cellSize / 2;
                const y2 = gridY + endR   * cellSize + cellSize / 2;

                // Midpoint, length, angle
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const wordLen = Math.sqrt(dx * dx + dy * dy) + cellSize * 0.9;
                const angle = Math.atan2(dy, dx); // radians

                // Draw a rotated rounded rectangle as a series of line segments
                const hw = wordLen / 2;        // half-width
                const hh = cellSize * 0.42;    // half-height
                const cornerR = hh;            // corner radius = half the height for pill shape

                drawRotatedRoundedRect(pdf, mx, my, wordLen, cellSize * 0.84, cornerR, angle);
            });
        }

        // ── Clues ────────────────────────────────────────────────────
        const clueStartY = gridY + gridH + 0.35;
        const clueFontSize = 11; // clear, readable size matching preview
        pdf.setFontSize(clueFontSize);
        pdf.setFont('Helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);

        const sortedWords = result.placedWords.map(p => p.word).sort();
        const colWidth = usableW / s.clueCols;
        const lineHeight = clueFontSize / 72 + 0.12; // generous spacing

        sortedWords.forEach((word, idx) => {
            const col = idx % s.clueCols;
            const row = Math.floor(idx / s.clueCols);
            const cx = MARGIN + col * colWidth + colWidth / 2;
            const cy = clueStartY + row * lineHeight;

            if (cy < H - MARGIN) { // don't overflow the page
                pdf.text(umlautSafe(word), cx, cy, { align: 'center' });
            }
        });
    }

    // ── Helper: draw a rotated rounded rect (pill shape outline) ─────
    function drawRotatedRoundedRect(doc, cx, cy, w, h, r, angle) {
        // Clamp radius
        r = Math.min(r, w / 2, h / 2);

        const hw = w / 2;
        const hh = h / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        function rot(lx, ly) {
            return [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos];
        }

        // Build path points (clockwise from top-left after the corner)
        // We approximate rounded corners with small arc segments via Bezier
        const kappa = 0.5522847498; // Bezier approximation of quarter circle
        const kr = r * kappa;

        // Corner centers (local coords)
        const corners = [
            { cx: -hw + r, cy: -hh + r }, // top-left
            { cx:  hw - r, cy: -hh + r }, // top-right
            { cx:  hw - r, cy:  hh - r }, // bottom-right
            { cx: -hw + r, cy:  hh - r }, // bottom-left
        ];

        // Start at top edge, after top-left corner
        const startP = rot(-hw + r, -hh);
        doc.setLineWidth(0.018);
        doc.setDrawColor(0, 0, 0);

        // We'll build a path manually using lines() with Bezier-approximated corners
        // jsPDF doesn't have native rounded-rect-with-rotation, so we use lines()
        
        const segments = [];
        
        // Top edge: from top-left-corner-end to top-right-corner-start
        segments.push(rot(hw - r, -hh));
        
        // Top-right corner (Bezier)
        // Control points for quarter circle from (hw-r, -hh) around (hw-r, -hh+r) to (hw, -hh+r)
        
        // Since jsPDF lines() is limited, let's approximate with many small line segments
        const arcSteps = 8;
        
        // Top-right corner
        for (let i = 1; i <= arcSteps; i++) {
            const t = (i / arcSteps) * Math.PI / 2;
            const lx = corners[1].cx + r * Math.cos(Math.PI * 1.5 + t);
            const ly = corners[1].cy + r * Math.sin(Math.PI * 1.5 + t);
            segments.push(rot(lx, ly));
        }
        
        // Right edge
        segments.push(rot(hw, hh - r));
        
        // Bottom-right corner
        for (let i = 1; i <= arcSteps; i++) {
            const t = (i / arcSteps) * Math.PI / 2;
            const lx = corners[2].cx + r * Math.cos(0 + t);
            const ly = corners[2].cy + r * Math.sin(0 + t);
            segments.push(rot(lx, ly));
        }
        
        // Bottom edge
        segments.push(rot(-hw + r, hh));
        
        // Bottom-left corner
        for (let i = 1; i <= arcSteps; i++) {
            const t = (i / arcSteps) * Math.PI / 2;
            const lx = corners[3].cx + r * Math.cos(Math.PI * 0.5 + t);
            const ly = corners[3].cy + r * Math.sin(Math.PI * 0.5 + t);
            segments.push(rot(lx, ly));
        }
        
        // Left edge
        segments.push(rot(-hw, -hh + r));
        
        // Top-left corner
        for (let i = 1; i <= arcSteps; i++) {
            const t = (i / arcSteps) * Math.PI / 2;
            const lx = corners[0].cx + r * Math.cos(Math.PI + t);
            const ly = corners[0].cy + r * Math.sin(Math.PI + t);
            segments.push(rot(lx, ly));
        }

        // Draw the path
        // Convert to relative offsets for jsPDF lines()
        const lineSegments = [];
        for (let i = 0; i < segments.length; i++) {
            const prev = i === 0 ? startP : segments[i - 1];
            lineSegments.push([segments[i][0] - prev[0], segments[i][1] - prev[1]]);
        }

        doc.lines(lineSegments, startP[0], startP[1], [1, 1], 'S', true);
    }

    function drawMiniSolution(puzzleData, puzzleNum, ox, oy, boxW, boxH) {
        const s = puzzleData.settings;
        const result = puzzleData.result;
        const grid = result.grid;
        const rows = s.rows;
        const cols = s.cols;

        const innerMargin = 0.1;

        // ── Language label for title ────────────────────────────────────
        const LANG_LABELS_MINI = {
            en: { solution: 'Solution' },
            fr: { solution: 'Solution' },
            de: { solution: 'L\u00f6sung'  }
        };
        const miniLang = s.language || 'en';
        const miniLabels = LANG_LABELS_MINI[miniLang] || LANG_LABELS_MINI.en;

        // Title (solution heading, centered above grid)
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${miniLabels.solution} #${puzzleNum}`, ox + boxW / 2, oy + 0.18, { align: 'center' });

        // Grid geometry
        const gridTopY = oy + 0.25;
        const availW = boxW - 2 * innerMargin;
        const availH = boxH - 0.35;
        const cellSize = Math.min(availW / cols, availH / rows);
        const gridW = cellSize * cols;
        const gridH = cellSize * rows;
        const gridX = ox + (boxW - gridW) / 2;
        const gridY = gridTopY;

        // ── Border tightly around the grid bounding box ─────────────────
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.025);
        pdf.rect(gridX, gridY, gridW, gridH);

        // Letters
        const fontSize = Math.max(5, Math.min(cellSize * 72 * 0.55, 10));
        pdf.setFontSize(fontSize);
        pdf.setFont('Helvetica', 'normal');

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cx = gridX + c * cellSize + cellSize / 2;
                const cy = gridY + r * cellSize + cellSize / 2 + (fontSize / 72) * 0.35;
                pdf.text(umlautSafe(grid[r][c]), cx, cy, { align: 'center' });
            }
        }

        // Solution outlines
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.012);

        result.placedWords.forEach(pw => {
            const path = pw.path;
            if (path.length === 0) return;

            const startR = path[0][0],            startC = path[0][1];
            const endR   = path[path.length-1][0], endC   = path[path.length-1][1];

            const x1 = gridX + startC * cellSize + cellSize / 2;
            const y1 = gridY + startR * cellSize + cellSize / 2;
            const x2 = gridX + endC   * cellSize + cellSize / 2;
            const y2 = gridY + endR   * cellSize + cellSize / 2;

            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const wordLen = Math.sqrt(dx * dx + dy * dy) + cellSize * 0.85;
            const ang = Math.atan2(dy, dx);

            drawRotatedRoundedRect(pdf, mx, my, wordLen, cellSize * 0.78, cellSize * 0.39, ang);
        });
    }

    // ══════════════════════════════════════════════════════════════════
    //  RENDER ALL PAGES
    // ══════════════════════════════════════════════════════════════════

    // 1. Puzzle pages (one per puzzle)
    for (let i = 0; i < puzzlesData.length; i++) {
        if (i > 0) pdf.addPage([W, H], W > H ? 'landscape' : 'portrait');
        drawPuzzlePage(puzzlesData[i], i + 1, false);
    }

    // 2. Solution pages
    if (solutionsPerPage === 1) {
        // Full-page solution for each puzzle
        for (let i = 0; i < puzzlesData.length; i++) {
            pdf.addPage([W, H], W > H ? 'landscape' : 'portrait');
            drawPuzzlePage(puzzlesData[i], i + 1, true);
        }
    } else {
        // Multi-solution layout
        let solCols, solRows;
        if (solutionsPerPage <= 2) { solCols = 1; solRows = 2; }
        else if (solutionsPerPage <= 4) { solCols = 2; solRows = 2; }
        else { solCols = 2; solRows = 3; } // 5 or 6

        // Use the full usable height — no page header reserved
        const boxW = usableW / solCols;
        const boxH = usableH / solRows;

        let idx = 0;
        while (idx < puzzlesData.length) {
            pdf.addPage([W, H], W > H ? 'landscape' : 'portrait');

            // No 'Solutions' page header — solution heading is per-puzzle
            const startY = MARGIN;

            for (let slot = 0; slot < solutionsPerPage && idx < puzzlesData.length; slot++) {
                const col = slot % solCols;
                const row = Math.floor(slot / solCols);
                const ox = MARGIN + col * boxW;
                const oy = startY + row * boxH;

                drawMiniSolution(puzzlesData[idx], idx + 1, ox, oy, boxW, boxH);
                idx++;
            }
        }
    }

    pdf.save('WordSearch_PuzzleBook.pdf');
}
