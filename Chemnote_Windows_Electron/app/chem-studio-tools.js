/* ============================================================================
 * CHEMNOTE STUDIO TOOLS (v15.16)
 * 100% Offline, Modular, Zero-Conflict Creative Chemistry & Study Suite:
 *  1. Cân bằng PTHH tự động (Gauss-Jordan phân số chính xác BigInt) + thả ra giấy
 *  2. Phân tích CTPT (M, độ bất bão hòa k, % nguyên tố) + Quét phân tử đang vẽ
 *  3. Tra cứu Màu kết tủa, Dung dịch, Ngọn lửa, Chỉ thị pH (kèm ô màu thật)
 *  4. Dãy điện hóa & Quy tắc Alpha (ΔE°, chiều tự diễn biến, thả sơ đồ α)
 *  5. Tạo phân tử vector từ Tên / SMILES trực tiếp thành atoms/bonds trên giấy
 *  6. Băng che ôn bài (Study Tape / Active Recall) chạm để hé mở / úp lại
 *  7. Thẻ Ghi chú Ngoại lệ / Mẹo nhớ & Banner Tiêu đề Studygram
 *  8. Tách nền trắng tự động cho ảnh đề bài (#imageFloatingBar)
 *  9. Đồng hồ Pomodoro & Đếm ngược làm đề thi (25' / 50' / 90' / 180')
 * 10. Thước kẻ ảo xoay góc & Kẻ đường thẳng theo mép thước
 * 11. Đánh dấu & Mục lục trang (Bookmarks)
 * 12. Flashcard ôn phản ứng & cơ chế (lật thẻ 2 mặt)
 * ============================================================================ */

(function () {
    'use strict';

    /* ------------------------------------------------------------------------
     * 0. BẢNG NGUYÊN TỬ KHỐI 118 NGUYÊN TỐ & TIỆN ÍCH CHỈ SỐ DƯỚI UNICODE
     * ------------------------------------------------------------------------ */
    const ATOMIC_MASS = {
        H: 1.008, He: 4.003, Li: 6.941, Be: 9.012, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.18,
        Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.086, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.948, K: 39.098, Ca: 40.078,
        Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996, Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38,
        Ga: 69.723, Ge: 72.63, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798, Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224,
        Nb: 92.906, Mo: 95.95, Tc: 98, Ru: 101.07, Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41, In: 114.82, Sn: 118.71,
        Sb: 121.76, Te: 127.6, I: 126.9, Xe: 131.29, Cs: 132.91, Ba: 137.33, La: 138.91, Ce: 140.12, Pt: 195.08, Au: 196.97,
        Hg: 200.59, Pb: 207.2, Bi: 208.98, Ra: 226, U: 238.03
    };
    const SUB_MAP = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
    const escHtml = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function formatChemFormulaUnicode(raw) {
        return String(raw || '').trim().replace(/([A-Za-z\)\]])(\d+)/g, (_, pre, digits) => {
            return pre + digits.split('').map(d => SUB_MAP[d] || d).join('');
        });
    }

    function parseFormulaCounts(formula) {
        const clean = String(formula || '').trim().replace(/\s+/g, '');
        if (!clean) return null;
        // Hỗ trợ ngậm nước kiểu CuSO4.5H2O hoặc CuSO4*5H2O
        const parts = clean.split(/[\.\*·]/);
        const total = {};
        for (const rawPart of parts) {
            if (!rawPart) continue;
            let mul = 1;
            let s = rawPart;
            const mLead = /^(\d+)(.+)$/.exec(s);
            if (mLead) {
                mul = parseInt(mLead[1], 10) || 1;
                s = mLead[2];
            }
            const stack = [{}];
            let i = 0;
            while (i < s.length) {
                const ch = s[i];
                if (ch === '(' || ch === '[') {
                    stack.push({});
                    i++;
                } else if (ch === ')' || ch === ']') {
                    if (stack.length <= 1) return null;
                    i++;
                    let numStr = '';
                    while (i < s.length && /\d/.test(s[i])) { numStr += s[i++]; }
                    const mult = numStr ? parseInt(numStr, 10) : 1;
                    const popped = stack.pop();
                    const top = stack[stack.length - 1];
                    for (const el in popped) {
                        top[el] = (top[el] || 0) + popped[el] * mult;
                    }
                } else if (/[A-Z]/.test(ch)) {
                    let sym = ch;
                    i++;
                    if (i < s.length && /[a-z]/.test(s[i])) sym += s[i++];
                    let numStr = '';
                    while (i < s.length && /\d/.test(s[i])) { numStr += s[i++]; }
                    const cnt = numStr ? parseInt(numStr, 10) : 1;
                    const top = stack[stack.length - 1];
                    top[sym] = (top[sym] || 0) + cnt;
                } else {
                    return null;
                }
            }
            if (stack.length !== 1) return null;
            const cur = stack[0];
            for (const el in cur) {
                total[el] = (total[el] || 0) + cur[el] * mul;
            }
        }
        return Object.keys(total).length ? total : null;
    }

    /* ------------------------------------------------------------------------
     * 1. MÁY CÂN BẰNG PHƯƠNG TRÌNH HÓA HỌC (GAUSS-JORDAN BIGINT CHÍNH XÁC 100%)
     * ------------------------------------------------------------------------ */
    function bgcd(a, b) {
        a = a < 0n ? -a : a;
        b = b < 0n ? -b : b;
        while (b !== 0n) { const t = a % b; a = b; b = t; }
        return a || 1n;
    }
    function blcm(a, b) {
        if (a === 0n || b === 0n) return 0n;
        return (a < 0n ? -a : a) / bgcd(a, b) * (b < 0n ? -b : b);
    }
    function frac(n, d = 1n) {
        if (d < 0n) { n = -n; d = -d; }
        const g = bgcd(n, d);
        return { n: n / g, d: d / g };
    }
    const fAdd = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
    const fSub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
    const fMul = (a, b) => frac(a.n * b.n, a.d * b.d);
    const fDiv = (a, b) => frac(a.n * b.d, a.d * b.n);

    function balanceChemEquation(input) {
        const raw = String(input || '').trim();
        if (!raw) return { error: 'Vui lòng nhập phương trình hóa học.' };
        const sides = raw.split(/->|=>|=|→|⇌/);
        if (sides.length !== 2) return { error: 'Cần có đúng 1 dấu mũi tên (-> hoặc =) ngăn cách 2 vế.' };
        const leftRaw = sides[0].split('+').map(s => s.trim().replace(/^\d+\s*/, '')).filter(Boolean);
        const rightRaw = sides[1].split('+').map(s => s.trim().replace(/^\d+\s*/, '')).filter(Boolean);
        if (!leftRaw.length || !rightRaw.length) return { error: 'Thiếu chất tham gia hoặc sản phẩm.' };

        const allSpecies = [...leftRaw, ...rightRaw];
        const parsed = [];
        const elSet = new Set();
        for (const sp of allSpecies) {
            const cnt = parseFormulaCounts(sp);
            if (!cnt) return { error: `Không đọc được công thức "${sp}". Hãy kiểm tra chữ hoa/thường (VD: Fe2O3, H2SO4).` };
            parsed.push(cnt);
            Object.keys(cnt).forEach(e => elSet.add(e));
        }

        const elements = Array.from(elSet);
        const rows = elements.length;
        const cols = allSpecies.length;
        const M = [];
        for (let r = 0; r < rows; r++) {
            const el = elements[r];
            const row = [];
            for (let c = 0; c < cols; c++) {
                const v = BigInt(parsed[c][el] || 0);
                row.push(frac(c < leftRaw.length ? v : -v, 1n));
            }
            M.push(row);
        }

        // Gauss-Jordan RREF
        const pivotCols = [];
        let lead = 0;
        for (let r = 0; r < rows && lead < cols; r++) {
            let i = r;
            while (i < rows && M[i][lead].n === 0n) i++;
            if (i === rows) {
                lead++;
                r--;
                continue;
            }
            if (i !== r) { const tmp = M[r]; M[r] = M[i]; M[i] = tmp; }
            const lv = M[r][lead];
            for (let j = 0; j < cols; j++) M[r][j] = fDiv(M[r][j], lv);
            for (let k = 0; k < rows; k++) {
                if (k !== r && M[k][lead].n !== 0n) {
                    const f = M[k][lead];
                    for (let j = 0; j < cols; j++) M[k][j] = fSub(M[k][j], fMul(f, M[r][j]));
                }
            }
            pivotCols.push(lead);
            lead++;
        }

        const freeCols = [];
        for (let c = 0; c < cols; c++) {
            if (!pivotCols.includes(c)) freeCols.push(c);
        }
        if (freeCols.length === 0) return { error: 'Phương trình không có nghiệm cân bằng hợp lệ (kiểm tra lại nguyên tố 2 vế).' };

        // Gán 1 cho các biến tự do (thông thường có 1 biến tự do)
        const sol = new Array(cols).fill(null).map(() => frac(0n, 1n));
        freeCols.forEach(fc => { sol[fc] = frac(1n, 1n); });
        for (let r = 0; r < pivotCols.length; r++) {
            const pc = pivotCols[r];
            let sum = frac(0n, 1n);
            for (const fc of freeCols) {
                sum = fSub(sum, fMul(M[r][fc], sol[fc]));
            }
            sol[pc] = sum;
        }

        let commonDen = 1n;
        for (const s of sol) commonDen = blcm(commonDen, s.d);
        let ints = sol.map(s => (s.n * (commonDen / s.d)));
        if (ints.every(v => v <= 0n)) ints = ints.map(v => -v);
        if (ints.some(v => v <= 0n)) return { error: 'Không tìm được bộ hệ số nguyên dương — hãy kiểm tra xem 2 vế đã đủ chất chưa.' };

        let g = ints[0];
        for (let i = 1; i < ints.length; i++) g = bgcd(g, ints[i]);
        ints = ints.map(v => Number(v / g));

        const fmtSide = (arr, offset) => arr.map((sp, idx) => {
            const coef = ints[offset + idx];
            return (coef > 1 ? String(coef) : '') + formatChemFormulaUnicode(sp);
        }).join(' + ');

        const leftStr = fmtSide(leftRaw, 0);
        const rightStr = fmtSide(rightRaw, leftRaw.length);
        return {
            ok: true,
            leftStr,
            rightStr,
            equation: `${leftStr} → ${rightStr}`,
            coeffs: ints
        };
    }

    function renderTextCardDataUrl(titleText, bodyLines, accentHex = '#0284c7', bgRgba = 'rgba(255,255,255,0.92)') {
        const dpr = 2;
        const padX = 22, padY = 16;
        const tmp = document.createElement('canvas').getContext('2d');
        tmp.font = '700 22px "Inter", -apple-system, sans-serif';
        let maxW = titleText ? tmp.measureText(titleText).width : 0;
        tmp.font = '600 18px "Inter", -apple-system, sans-serif';
        const lines = Array.isArray(bodyLines) ? bodyLines : [String(bodyLines || '')];
        lines.forEach(ln => { maxW = Math.max(maxW, tmp.measureText(ln).width); });

        const w = Math.max(240, Math.min(720, Math.ceil(maxW) + padX * 2 + 12));
        const titleH = titleText ? 30 : 0;
        const lineH = 26;
        const h = padY * 2 + titleH + lines.length * lineH + (titleText && lines.length ? 6 : 0);

        const cvs = document.createElement('canvas');
        cvs.width = w * dpr;
        cvs.height = h * dpr;
        const g = cvs.getContext('2d');
        g.scale(dpr, dpr);

        g.fillStyle = bgRgba;
        g.beginPath();
        g.roundRect(2, 2, w - 4, h - 4, 12);
        g.fill();
        g.strokeStyle = accentHex;
        g.lineWidth = 2;
        g.stroke();

        let y = padY;
        if (titleText) {
            g.fillStyle = accentHex;
            g.font = '800 16px "Inter", -apple-system, sans-serif';
            g.textBaseline = 'top';
            g.fillText(titleText, padX, y);
            y += titleH;
        }
        g.fillStyle = '#0f172a';
        g.font = '700 19px "Inter", -apple-system, sans-serif';
        g.textBaseline = 'top';
        lines.forEach(ln => {
            g.fillText(ln, padX, y);
            y += lineH;
        });
        return { dataUrl: cvs.toDataURL('image/png'), natW: w, natH: h };
    }

    function dropBalancedEquationToPaper(eqText) {
        const { dataUrl, natW, natH } = renderTextCardDataUrl('', [eqText], '#0284c7', 'rgba(240, 249, 255, 0.92)');
        if (typeof insertDataUrlImageToPage === 'function') {
            insertDataUrlImageToPage(dataUrl, natW, natH, { maxW: Math.min(580, A4_WIDTH * 0.85) });
            closeChemAssistantModal();
            if (typeof showGestureToast === 'function') showGestureToast('⚖️ Đã thả phương trình cân bằng lên giấy A4!');
        }
    }

    /* ------------------------------------------------------------------------
     * 2. PHÂN TÍCH CTPT (M, k, %) & QUÉT PHÂN TỬ ĐANG VẼ TRÊN GIẤY
     * ------------------------------------------------------------------------ */
    function analyzeChemFormula(raw) {
        const cnt = parseFormulaCounts(raw);
        if (!cnt) return { error: 'Công thức không hợp lệ (VD: C8H8O2, C6H5NO2, Fe2(SO4)3).' };
        let mass = 0;
        const rows = [];
        for (const el of Object.keys(cnt)) {
            const am = ATOMIC_MASS[el];
            if (!am) return { error: `Không tìm thấy nguyên tố "${el}".` };
            const sub = am * cnt[el];
            mass += sub;
            rows.push({ el, n: cnt[el], sub });
        }
        rows.forEach(r => { r.pct = (r.sub / mass) * 100; });

        const C = cnt.C || 0, H = cnt.H || 0, N = cnt.N || 0;
        const X = (cnt.F || 0) + (cnt.Cl || 0) + (cnt.Br || 0) + (cnt.I || 0);
        let kVal = null, kHint = '';
        if (C > 0) {
            kVal = (2 * C + 2 + N - H - X) / 2;
            if (kVal === 0) kHint = 'Mạch hở no (ankan / ancol no / ete / amin no...)';
            else if (kVal === 1) kHint = '1 liên kết π (C=C, C=O) hoặc 1 vòng no';
            else if (kVal === 2) kHint = '1 nối ba C≡C, 2 nối đôi, hoặc 1 vòng + 1 π';
            else if (kVal >= 4 && C >= 6) kHint = `Có khả năng chứa vòng benzen (k ≥ 4)${kVal > 4 ? ` + ${kVal - 4} nhóm π/vòng thêm` : ''}`;
            else if (kVal > 0) kHint = `Tổng số vòng + liên kết π = ${kVal}`;
            else kHint = 'Kiểm tra lại hóa trị / có thể là ion hoặc gốc tự do';
        }
        return { ok: true, pretty: formatChemFormulaUnicode(raw), mass, rows, kVal, kHint };
    }

    function scanActivePageMolecules() {
        const doc = typeof getDocState === 'function' ? getDocState() : null;
        if (!doc || !Array.isArray(doc.atoms) || !doc.atoms.length) return [];
        const adj = new Map();
        doc.atoms.forEach(a => adj.set(a.id, []));
        (doc.bonds || []).forEach(b => {
            const ord = b.order || 1;
            if (adj.has(b.a1)) adj.get(b.a1).push({ to: b.a2, ord });
            if (adj.has(b.a2)) adj.get(b.a2).push({ to: b.a1, ord });
        });
        const atomById = new Map(doc.atoms.map(a => [a.id, a]));
        const valMap = { C: 4, N: 3, O: 2, S: 2, P: 3, F: 1, Cl: 1, Br: 1, I: 1, Si: 4, B: 3 };
        const seen = new Set();
        const comps = [];
        for (const a of doc.atoms) {
            if (seen.has(a.id)) continue;
            const q = [a.id];
            seen.add(a.id);
            const list = [];
            while (q.length) {
                const id = q.shift();
                list.push(atomById.get(id));
                (adj.get(id) || []).forEach(e => {
                    if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
                });
            }
            const counts = {};
            for (const at of list) {
                const rawLbl = String(at.label || 'C').trim();
                const parsedLbl = parseFormulaCounts(rawLbl);
                const bondSum = (adj.get(at.id) || []).reduce((s, e) => s + e.ord, 0);
                if (parsedLbl && Object.keys(parsedLbl).length > 1) {
                    for (const k in parsedLbl) counts[k] = (counts[k] || 0) + parsedLbl[k];
                } else {
                    const sym = parsedLbl ? Object.keys(parsedLbl)[0] : 'C';
                    counts[sym] = (counts[sym] || 0) + 1;
                    const v = valMap[sym];
                    if (v && bondSum < v) {
                        counts.H = (counts.H || 0) + (v - bondSum);
                    }
                }
            }
            // Hill order: C, H, then alphabetical
            const keys = Object.keys(counts).sort((x, y) => {
                if (x === 'C') return -1; if (y === 'C') return 1;
                if (x === 'H') return -1; if (y === 'H') return 1;
                return x.localeCompare(y);
            });
            const fStr = keys.map(k => k + (counts[k] > 1 ? counts[k] : '')).join('');
            const res = analyzeChemFormula(fStr);
            if (res.ok) comps.push({ atomCount: list.length, formula: fStr, ...res });
        }
        return comps;
    }

    /* ------------------------------------------------------------------------
     * 3. KHO MÀU SẮC KẾT TỦA, DUNG DỊCH, NGỌN LỬA & CHỈ THỊ pH
     * ------------------------------------------------------------------------ */
    const CHEM_COLORS_DB = [
        { cat: 'kt', name: 'Fe(OH)₃', desc: 'Kết tủa nâu đỏ', hex: '#9a3412' },
        { cat: 'kt', name: 'Fe(OH)₂', desc: 'Trắng xanh (hóa nâu ngoài KK)', hex: '#bbf7d0' },
        { cat: 'kt', name: 'Cu(OH)₂', desc: 'Kết tủa xanh lam', hex: '#2563eb' },
        { cat: 'kt', name: 'AgCl', desc: 'Kết tủa trắng (đen dần ngoài AS)', hex: '#f8fafc' },
        { cat: 'kt', name: 'AgBr', desc: 'Kết tủa vàng nhạt', hex: '#fef08a' },
        { cat: 'kt', name: 'AgI', desc: 'Kết tủa vàng đậm', hex: '#eab308' },
        { cat: 'kt', name: 'Ag₃PO₄', desc: 'Kết tủa vàng tươi', hex: '#facc15' },
        { cat: 'kt', name: 'BaSO₄ / CaCO₃', desc: 'Kết tủa trắng bền', hex: '#ffffff' },
        { cat: 'kt', name: 'CuS / PbS / Ag₂S', desc: 'Kết tủa đen (không tan axit)', hex: '#0f172a' },
        { cat: 'kt', name: 'CdS', desc: 'Kết tủa vàng tươi', hex: '#fbbf24' },
        { cat: 'kt', name: 'MnS', desc: 'Kết tủa hồng nhạt', hex: '#f9a8d4' },
        { cat: 'kt', name: 'Cr(OH)₃', desc: 'Kết tủa lục xám (lưỡng tính)', hex: '#4d7c0f' },
        { cat: 'kt', name: 'Cu₂O', desc: 'Kết tủa đỏ gạch (pư glucozơ)', hex: '#c2410c' },
        { cat: 'kt', name: '2,4,6-Tribromphenol', desc: 'Kết tủa trắng', hex: '#f1f5f9' },
        { cat: 'dd', name: 'Cu²⁺ (dd)', desc: 'Dung dịch xanh lam', hex: '#0284c7' },
        { cat: 'dd', name: 'Fe²⁺ (dd)', desc: 'Dung dịch xanh lục nhạt', hex: '#86efac' },
        { cat: 'dd', name: 'Fe³⁺ (dd)', desc: 'Dung dịch vàng nâu', hex: '#d97706' },
        { cat: 'dd', name: 'MnO₄⁻ (KMnO₄)', desc: 'Dung dịch tím đậm', hex: '#7e22ce' },
        { cat: 'dd', name: 'Cr₂O₇²⁻ (axit)', desc: 'Dung dịch màu da cam', hex: '#f97316' },
        { cat: 'dd', name: 'CrO₄²⁻ (kiềm)', desc: 'Dung dịch màu vàng chanh', hex: '#facc15' },
        { cat: 'dd', name: '[Fe(SCN)]²⁺', desc: 'Phức màu đỏ máu (nhận Fe³⁺)', hex: '#991b1b' },
        { cat: 'dd', name: '[Cu(NH₃)₄]²⁺', desc: 'Phức xanh thẫm', hex: '#1d4ed8' },
        { cat: 'dd', name: 'I₂ + Hồ tinh bột', desc: 'Phức xanh tím đặc trưng', hex: '#312e81' },
        { cat: 'dd', name: 'Cu(OH)₂ + Poliancol', desc: 'Phức xanh lam thẫm', hex: '#1e40af' },
        { cat: 'dd', name: 'Biuret (Peptit)', desc: 'Phức màu tím đặc trưng', hex: '#9333ea' },
        { cat: 'fl', name: 'Na⁺ (Ngọn lửa)', desc: 'Màu vàng tươi đặc trưng', hex: '#facc15' },
        { cat: 'fl', name: 'K⁺ (Ngọn lửa)', desc: 'Màu tím nhạt (hoa cà)', hex: '#c084fc' },
        { cat: 'fl', name: 'Li⁺ / Sr²⁺', desc: 'Màu đỏ son rực', hex: '#e11d48' },
        { cat: 'fl', name: 'Ca²⁺ (Ngọn lửa)', desc: 'Màu đỏ cam (đỏ gạch)', hex: '#ea580c' },
        { cat: 'fl', name: 'Ba²⁺ (Ngọn lửa)', desc: 'Màu lục vàng', hex: '#84cc16' },
        { cat: 'fl', name: 'Cu²⁺ (Ngọn lửa)', desc: 'Màu xanh lục lam', hex: '#10b981' },
        { cat: 'ph', name: 'Quỳ tím', desc: 'Axit: Đỏ | Trung: Tím | Kiềm: Xanh', hex: '#6366f1' },
        { cat: 'ph', name: 'Phenolphtalein', desc: 'pH < 8.2: Không màu | Kiềm: Hồng', hex: '#ec4899' },
        { cat: 'ph', name: 'Metyl da cam', desc: 'Axit: Đỏ | pH > 4.4: Vàng', hex: '#f59e0b' }
    ];

    /* ------------------------------------------------------------------------
     * 4. DÃY ĐIỆN HÓA KIM LOẠI & QUY TẮC ALPHA (α)
     * ------------------------------------------------------------------------ */
    const ELECTROCHEM_SERIES = [
        { ox: 'K⁺', red: 'K', e0: -2.93 },
        { ox: 'Ba²⁺', red: 'Ba', e0: -2.91 },
        { ox: 'Ca²⁺', red: 'Ca', e0: -2.87 },
        { ox: 'Na⁺', red: 'Na', e0: -2.71 },
        { ox: 'Mg²⁺', red: 'Mg', e0: -2.37 },
        { ox: 'Al³⁺', red: 'Al', e0: -1.66 },
        { ox: 'Mn²⁺', red: 'Mn', e0: -1.18 },
        { ox: 'Zn²⁺', red: 'Zn', e0: -0.76 },
        { ox: 'Cr³⁺', red: 'Cr', e0: -0.74 },
        { ox: 'Fe²⁺', red: 'Fe', e0: -0.44 },
        { ox: 'Ni²⁺', red: 'Ni', e0: -0.26 },
        { ox: 'Sn²⁺', red: 'Sn', e0: -0.14 },
        { ox: 'Pb²⁺', red: 'Pb', e0: -0.13 },
        { ox: '2H⁺', red: 'H₂', e0: 0.00 },
        { ox: 'Cu²⁺', red: 'Cu', e0: +0.34 },
        { ox: 'I₂', red: '2I⁻', e0: +0.54 },
        { ox: 'Fe³⁺', red: 'Fe²⁺', e0: +0.77 },
        { ox: 'Ag⁺', red: 'Ag', e0: +0.80 },
        { ox: 'Hg²⁺', red: 'Hg', e0: +0.85 },
        { ox: 'Br₂', red: '2Br⁻', e0: +1.07 },
        { ox: 'Cl₂', red: '2Cl⁻', e0: +1.36 },
        { ox: 'Au³⁺', red: 'Au', e0: +1.50 }
    ];

    /* ------------------------------------------------------------------------
     * 5. TẠO PHÂN TỬ VECTOR TỪ TÊN / SMILES THẲNG LÊN GIẤY A4 (ATOMS + BONDS)
     * ------------------------------------------------------------------------ */
    const PRESET_MOLECULES = {
        benzene: { name: 'Benzen (C₆H₆)', smiles: 'c1ccccc1' },
        toluene: { name: 'Toluen (C₇H₈)', smiles: 'Cc1ccccc1' },
        phenol: { name: 'Phenol (C₆H₅OH)', smiles: 'Oc1ccccc1' },
        aniline: { name: 'Anilin (C₆H₅NH₂)', smiles: 'Nc1ccccc1' },
        benzoic: { name: 'Axit benzoic', smiles: 'OC(=O)c1ccccc1' },
        nitrobenzene: { name: 'Nitrobenzen', smiles: 'O2Nc1ccccc1' },
        styrene: { name: 'Stiren', smiles: 'C=Cc1ccccc1' },
        ethanol: { name: 'Etanol (C₂H₅OH)', smiles: 'CCO' },
        acetic: { name: 'Axit axetic (CH₃COOH)', smiles: 'CC(=O)O' },
        acetone: { name: 'Axeton (CH₃COCH₃)', smiles: 'CC(=O)C' },
        isoprene: { name: 'Isopren', smiles: 'C=CC(C)=C' },
        butadiene: { name: 'Buta-1,3-đien', smiles: 'C=CC=C' },
        glycine: { name: 'Glyxin', smiles: 'NCC(=O)O' },
        alanine: { name: 'Alanin', smiles: 'CC(N)C(=O)O' },
        glycerol: { name: 'Glixerol', smiles: 'OCC(O)CO' },
        urea: { name: 'Ure', smiles: 'NC(=O)N' },
        acetylene: { name: 'Axetilen', smiles: 'C#C' },
        ethyl_acetate: { name: 'Etyl axetat', smiles: 'CC(=O)OCC' }
    };

    function insertMoleculeFromSmilesOrName(rawQuery) {
        const doc = typeof getDocState === 'function' ? getDocState() : null;
        if (!doc) return false;
        let q = String(rawQuery || '').trim();
        if (!q) return false;
        const low = q.toLowerCase().replace(/[\s\-]+/g, '_');
        let smiles = q;
        for (const k in PRESET_MOLECULES) {
            if (low === k || PRESET_MOLECULES[k].name.toLowerCase().includes(q.toLowerCase())) {
                smiles = PRESET_MOLECULES[k].smiles;
                break;
            }
        }

        const L = (typeof BOND_LENGTH === 'number' && BOND_LENGTH > 0) ? BOND_LENGTH : 44;
        const cx = Math.round(A4_WIDTH * 0.5);
        const cy = Math.max(120, Math.min(A4_HEIGHT - 160, Math.round((-panY / zoom - getPageYOffset(getActiveNotebook().activePageIndex || 0)) + 220)));
        if (typeof saveHistorySnapshot === 'function') saveHistorySnapshot();
        const col = (typeof penColor === 'string' && penColor) ? penColor : '#0f172a';
        const newAtoms = [];
        const newBonds = [];
        const mkA = (x, y, label = 'C') => {
            const a = { id: genId('a'), x, y, label, color: col };
            newAtoms.push(a);
            return a;
        };
        const mkB = (a1, a2, order = 1) => {
            newBonds.push({ id: genId('b'), a1: a1.id, a2: a2.id, order, stereo: null, color: col });
        };

        // Xử lý nhanh vòng thơm c1ccccc1 kèm nhóm thế phía trước
        const benzMatch = /^(.*)c1ccccc1(.*)$/.exec(smiles);
        if (benzMatch) {
            const pre = benzMatch[1];
            const ringVerts = [];
            for (let i = 0; i < 6; i++) {
                const ang = -Math.PI / 2 + i * (Math.PI / 3);
                ringVerts.push(mkA(cx + L * Math.cos(ang), cy + L * Math.sin(ang), 'C'));
            }
            for (let i = 0; i < 6; i++) {
                mkB(ringVerts[i], ringVerts[(i + 1) % 6], i % 2 === 0 ? 2 : 1);
            }
            if (pre) {
                const topV = ringVerts[0];
                if (pre === 'O') {
                    const o = mkA(topV.x, topV.y - L, 'OH');
                    mkB(topV, o, 1);
                } else if (pre === 'N') {
                    const n = mkA(topV.x, topV.y - L, 'NH2');
                    mkB(topV, n, 1);
                } else if (pre === 'C') {
                    const c = mkA(topV.x, topV.y - L, 'CH3');
                    mkB(topV, c, 1);
                } else if (pre === 'O2N') {
                    const n = mkA(topV.x, topV.y - L, 'NO2');
                    mkB(topV, n, 1);
                } else if (pre === 'C=C') {
                    const c1 = mkA(topV.x + L * 0.866, topV.y - L * 0.5, 'C');
                    const c2 = mkA(c1.x + L * 0.866, c1.y + L * 0.5, 'C');
                    mkB(topV, c1, 1); mkB(c1, c2, 2);
                } else if (pre === 'OC(=O)') {
                    const c1 = mkA(topV.x, topV.y - L, 'C');
                    const o1 = mkA(c1.x - L * 0.866, c1.y - L * 0.5, 'O');
                    const o2 = mkA(c1.x + L * 0.866, c1.y - L * 0.5, 'OH');
                    mkB(topV, c1, 1); mkB(c1, o1, 2); mkB(c1, o2, 1);
                }
            }
        } else {
            // Parser SMILES mạch thẳng & phân nhánh (hỗ trợ =, #, (), C, N, O, S, F, Cl, Br, I)
            const tokens = [];
            let i = 0;
            while (i < smiles.length) {
                const ch = smiles[i];
                if (ch === '(' || ch === ')' || ch === '=' || ch === '#') {
                    tokens.push(ch); i++;
                } else if (/[A-Z]/.test(ch)) {
                    let sym = ch; i++;
                    if (i < smiles.length && /[a-z]/.test(smiles[i])) sym += smiles[i++];
                    tokens.push(sym);
                } else {
                    i++;
                }
            }
            if (!tokens.length) return false;
            const branchStack = [];
            let prevAtom = null;
            let pendingOrder = 1;
            let stepIdx = 0;
            let curX = cx - L * 1.5, curY = cy;
            for (const tk of tokens) {
                if (tk === '=') { pendingOrder = 2; continue; }
                if (tk === '#') { pendingOrder = 3; continue; }
                if (tk === '(') {
                    branchStack.push({ atom: prevAtom, x: curX, y: curY, step: stepIdx });
                    continue;
                }
                if (tk === ')') {
                    const st = branchStack.pop();
                    if (st) { prevAtom = st.atom; curX = st.x; curY = st.y; stepIdx = st.step; }
                    continue;
                }
                let nx = curX, ny = curY;
                if (prevAtom) {
                    const inBranch = branchStack.length > 0 && branchStack[branchStack.length - 1].atom === prevAtom;
                    if (inBranch) {
                        const dirY = (stepIdx % 2 === 0) ? -1 : 1;
                        nx = prevAtom.x;
                        ny = prevAtom.y + dirY * L;
                    } else {
                        const ang = (stepIdx % 2 === 0) ? -Math.PI / 6 : Math.PI / 6;
                        nx = prevAtom.x + L * Math.cos(ang);
                        ny = prevAtom.y + L * Math.sin(ang);
                        stepIdx++;
                    }
                }
                const a = mkA(nx, ny, tk);
                if (prevAtom) mkB(prevAtom, a, pendingOrder);
                prevAtom = a; curX = nx; curY = ny; pendingOrder = 1;
            }
        }

        if (!newAtoms.length) return false;
        doc.atoms = (doc.atoms || []).concat(newAtoms);
        doc.bonds = (doc.bonds || []).concat(newBonds);
        if (typeof enforceAllValenceAndHydrogens === 'function') enforceAllValenceAndHydrogens(doc);
        if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
        if (typeof persistLibrary === 'function') persistLibrary();
        if (typeof renderAll === 'function') renderAll();
        return true;
    }

    /* ------------------------------------------------------------------------
     * 6. BĂNG CHE ÔN BÀI (STUDY TAPE / ACTIVE RECALL)
     * ------------------------------------------------------------------------ */
    function addStudyTapeToPage(colorHex = '#38bdf8', labelText = '') {
        const doc = typeof getDocState === 'function' ? getDocState() : null;
        if (!doc) return;
        if (!Array.isArray(doc.studyTapes)) doc.studyTapes = [];
        if (typeof saveHistorySnapshot === 'function') saveHistorySnapshot();
        const w = 180, h = 42;
        const x = Math.round((A4_WIDTH - w) / 2);
        const y = Math.max(60, Math.min(A4_HEIGHT - h - 60, Math.round((-panY / zoom - getPageYOffset(getActiveNotebook().activePageIndex || 0)) + 160)));
        doc.studyTapes.push({
            id: genId('tape'),
            x, y, w, h,
            color: colorHex || '#38bdf8',
            revealed: false,
            label: labelText || '👁 Chạm để hé mở'
        });
        if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
        if (typeof persistLibrary === 'function') persistLibrary();
        if (typeof renderAll === 'function') renderAll();
        if (typeof showGestureToast === 'function') showGestureToast('🃏 Đã dán Băng che ôn bài — chạm vào dải băng để hé mở / che lại!');
    }

    function toggleAllStudyTapes(revealState) {
        const doc = typeof getDocState === 'function' ? getDocState() : null;
        if (!doc || !Array.isArray(doc.studyTapes) || !doc.studyTapes.length) {
            if (typeof showGestureToast === 'function') showGestureToast('Trang hiện tại chưa có Băng che ôn bài nào.');
            return;
        }
        doc.studyTapes.forEach(t => { t.revealed = !!revealState; });
        if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
        if (typeof persistLibrary === 'function') persistLibrary();
        if (typeof renderAll === 'function') renderAll();
    }

    function clearPageStudyTapes() {
        const doc = typeof getDocState === 'function' ? getDocState() : null;
        if (!doc || !Array.isArray(doc.studyTapes) || !doc.studyTapes.length) return;
        if (typeof saveHistorySnapshot === 'function') saveHistorySnapshot();
        doc.studyTapes = [];
        if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
        if (typeof persistLibrary === 'function') persistLibrary();
        if (typeof renderAll === 'function') renderAll();
        if (typeof showGestureToast === 'function') showGestureToast('🗑 Đã xóa toàn bộ Băng che ôn bài trên trang này.');
    }

    function renderStudyTapesOnContext(c, doc) {
        const tapes = doc?.studyTapes;
        if (!Array.isArray(tapes) || !tapes.length) return;
        c.save();
        for (const tp of tapes) {
            const x = tp.x, y = tp.y, w = tp.w, h = tp.h;
            const col = tp.color || '#38bdf8';
            c.save();
            c.beginPath();
            c.roundRect(x, y, w, h, 8);
            if (tp.revealed) {
                c.fillStyle = 'rgba(148, 163, 184, 0.10)';
                c.fill();
                c.setLineDash([5, 4]);
                c.strokeStyle = col;
                c.lineWidth = 1.6;
                c.stroke();
            } else {
                c.fillStyle = col;
                c.globalAlpha = 0.94;
                c.fill();
                c.globalAlpha = 1;
                c.strokeStyle = 'rgba(15, 23, 42, 0.25)';
                c.lineWidth = 1.4;
                c.stroke();
                c.fillStyle = '#0f172a';
                c.font = '800 12px "Inter", -apple-system, sans-serif';
                c.textAlign = 'center';
                c.textBaseline = 'middle';
                c.fillText(tp.label || '👁 Chạm để hé mở', x + w / 2, y + h / 2);
            }
            c.restore();
        }
        c.restore();
    }

    // Bắt chạm nhanh vào Băng che ôn bài (không cản trở vẽ nét/vuốt trang)
    let _tapeTapDown = null;
    if (typeof window !== 'undefined') {
        window.addEventListener('pointerdown', (e) => {
            if (!e || e.target?.id !== 'chemCanvas') { _tapeTapDown = null; return; }
            const doc = typeof getDocState === 'function' ? getDocState() : null;
            if (!doc || !Array.isArray(doc.studyTapes) || !doc.studyTapes.length) { _tapeTapDown = null; return; }
            if (typeof screenToWorld !== 'function') return;
            const pt = screenToWorld(e.clientX, e.clientY);
            const hit = doc.studyTapes.find(tp => pt.x >= tp.x && pt.x <= tp.x + tp.w && pt.y >= tp.y && pt.y <= tp.y + tp.h);
            _tapeTapDown = hit ? { id: hit.id, x: e.clientX, y: e.clientY, t: performance.now() } : null;
        }, true);
        window.addEventListener('pointerup', (e) => {
            if (!_tapeTapDown || !e) return;
            const dt = performance.now() - _tapeTapDown.t;
            const dist = Math.hypot(e.clientX - _tapeTapDown.x, e.clientY - _tapeTapDown.y);
            const targetId = _tapeTapDown.id;
            _tapeTapDown = null;
            if (dt < 320 && dist < 10) {
                const doc = typeof getDocState === 'function' ? getDocState() : null;
                const hit = doc?.studyTapes?.find(tp => tp.id === targetId);
                if (hit) {
                    hit.revealed = !hit.revealed;
                    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
                    if (typeof persistLibrary === 'function') persistLibrary();
                    if (typeof renderAll === 'function') renderAll();
                }
            }
        }, true);
    }

    /* ------------------------------------------------------------------------
     * 7. THẺ GHI CHÚ NGOẠI LỆ / MẸO NHỚ & BANNER TIÊU ĐỀ STUDYGRAM
     * ------------------------------------------------------------------------ */
    function insertStickyCalloutToPaper(kind, customTitle) {
        const presets = {
            exception: { icon: '⚠️', label: 'NGOẠI LỆ CẦN NHỚ', bg: 'rgba(254, 243, 199, 0.88)', border: '#d97706', hdr: '#b45309' },
            tip:       { icon: '💡', label: 'MẸO NHỚ NHANH',   bg: 'rgba(224, 242, 254, 0.88)', border: '#0284c7', hdr: '#0369a1' },
            cond:      { icon: '🔥', label: 'ĐIỀU KIỆN PHẢN ỨNG', bg: 'rgba(255, 228, 230, 0.88)', border: '#e11d48', hdr: '#be123c' },
            focus:     { icon: '⭐', label: 'TRỌNG TÂM THI',    bg: 'rgba(209, 250, 229, 0.88)', border: '#059669', hdr: '#047857' }
        };
        const p = presets[kind] || presets.tip;
        const title = `${p.icon} ${(customTitle || p.label).trim()}`;
        const dpr = 2, w = 440, h = 148;
        const cvs = document.createElement('canvas');
        cvs.width = w * dpr; cvs.height = h * dpr;
        const g = cvs.getContext('2d');
        g.scale(dpr, dpr);

        g.fillStyle = p.bg;
        g.beginPath(); g.roundRect(3, 3, w - 6, h - 6, 14); g.fill();
        g.strokeStyle = p.border; g.lineWidth = 2.2; g.stroke();
        // Thanh nhấn bên trái
        g.fillStyle = p.border;
        g.beginPath(); g.roundRect(3, 3, 9, h - 6, [14, 0, 0, 14]); g.fill();
        // Tiêu đề
        g.fillStyle = p.hdr;
        g.font = '800 15px "Inter", -apple-system, sans-serif';
        g.textBaseline = 'top';
        g.fillText(title, 22, 14);
        // Đường kẻ mờ phân cách
        g.strokeStyle = p.border; g.globalAlpha = 0.25; g.lineWidth = 1;
        g.beginPath(); g.moveTo(22, 38); g.lineTo(w - 18, 38); g.stroke();

        if (typeof insertDataUrlImageToPage === 'function') {
            insertDataUrlImageToPage(cvs.toDataURL('image/png'), w, h, { maxW: Math.min(440, A4_WIDTH * 0.72) });
            if (typeof closeInsertTableModal === 'function') closeInsertTableModal();
            if (typeof showGestureToast === 'function') showGestureToast('📌 Đã chèn Thẻ Ghi Chú — bấm Khóa rồi viết tay trực tiếp lên thẻ!');
        }
    }

    function insertStudyBannerToPaper(text, styleId = 'ribbon_sky') {
        const label = String(text || 'CHUYÊN ĐỀ HÓA HỌC').trim();
        const styles = {
            ribbon_sky:  { bg1: '#0284c7', bg2: '#38bdf8', txt: '#ffffff' },
            ribbon_rose: { bg1: '#e11d48', bg2: '#fb7185', txt: '#ffffff' },
            ribbon_mint: { bg1: '#059669', bg2: '#34d399', txt: '#ffffff' },
            highlight:   { bg1: '#fef08a', bg2: '#fde047', txt: '#0f172a' }
        };
        const st = styles[styleId] || styles.ribbon_sky;
        const dpr = 2;
        const tmp = document.createElement('canvas').getContext('2d');
        tmp.font = '900 22px "Inter", -apple-system, sans-serif';
        const tw = Math.ceil(tmp.measureText(label).width);
        const w = Math.max(280, Math.min(680, tw + 76));
        const h = 56;
        const cvs = document.createElement('canvas');
        cvs.width = w * dpr; cvs.height = h * dpr;
        const g = cvs.getContext('2d');
        g.scale(dpr, dpr);

        const grad = g.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, st.bg1);
        grad.addColorStop(1, st.bg2);
        g.fillStyle = grad;
        g.beginPath();
        g.roundRect(4, 4, w - 8, h - 8, 14);
        g.fill();
        g.fillStyle = st.txt;
        g.font = '900 22px "Inter", -apple-system, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(label, w / 2, h / 2 + 1);

        if (typeof insertDataUrlImageToPage === 'function') {
            insertDataUrlImageToPage(cvs.toDataURL('image/png'), w, h, { maxW: Math.min(580, A4_WIDTH * 0.84) });
            if (typeof closeInsertTableModal === 'function') closeInsertTableModal();
            if (typeof showGestureToast === 'function') showGestureToast('✨ Đã chèn Banner Tiêu Đề lên giấy A4!');
        }
    }

    /* ------------------------------------------------------------------------
     * 8. TÁCH NỀN TRẮNG TỰ ĐỘNG CHO ẢNH ĐỀ BÀI (#imageFloatingBar)
     * ------------------------------------------------------------------------ */
    function removeWhiteBgFromSelectedImage() {
        const im = typeof getSelectedImageObj === 'function' ? getSelectedImageObj() : null;
        if (!im || !im.src) {
            if (typeof showGestureToast === 'function') showGestureToast('Hãy chọn 1 ảnh trên giấy trước khi tách nền.');
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const cvs = document.createElement('canvas');
                cvs.width = img.naturalWidth || img.width;
                cvs.height = img.naturalHeight || img.height;
                const g = cvs.getContext('2d');
                g.drawImage(img, 0, 0);
                const idata = g.getImageData(0, 0, cvs.width, cvs.height);
                const d = idata.data;
                for (let i = 0; i < d.length; i += 4) {
                    const r = d[i], gr = d[i + 1], b = d[i + 2], a = d[i + 3];
                    if (a === 0) continue;
                    const lum = 0.299 * r + 0.587 * gr + 0.114 * b;
                    const sat = Math.max(r, gr, b) - Math.min(r, gr, b);
                    if (lum > 235 && sat < 24) {
                        d[i + 3] = 0;
                    } else if (lum > 195 && sat < 28) {
                        const factor = Math.max(0, Math.min(1, (235 - lum) / 40));
                        d[i + 3] = Math.round(a * factor);
                    }
                }
                g.putImageData(idata, 0, 0);
                if (typeof saveHistorySnapshot === 'function') saveHistorySnapshot();
                im.src = cvs.toDataURL('image/png');
                if (typeof imageObjCache !== 'undefined' && imageObjCache?.delete) imageObjCache.delete(im.id);
                if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
                if (typeof persistLibrary === 'function') persistLibrary();
                if (typeof renderAll === 'function') renderAll();
                if (typeof showGestureToast === 'function') showGestureToast('🪄 Đã tách nền trắng trong suốt cho ảnh đề bài!');
            } catch (err) {
                if (typeof showGestureToast === 'function') showGestureToast('Không thể tách nền ảnh này.');
            }
        };
        img.src = im.src;
    }

    /* ------------------------------------------------------------------------
     * 9. ĐỒNG HỒ POMODORO & ĐẾM NGƯỢC LÀM ĐỀ THI
     * ------------------------------------------------------------------------ */
    let timerInterval = null;
    let timerRemainSec = 25 * 60;
    let timerPresetSec = 25 * 60;
    let timerRunning = false;

    function playGentleTimerChime() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            const ac = new AC();
            [523.25, 659.25, 783.99].forEach((freq, idx) => {
                const osc = ac.createOscillator();
                const gain = ac.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.08, ac.currentTime + idx * 0.16);
                gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + idx * 0.16 + 0.5);
                osc.connect(gain); gain.connect(ac.destination);
                osc.start(ac.currentTime + idx * 0.16);
                osc.stop(ac.currentTime + idx * 0.16 + 0.55);
            });
        } catch (_) {}
    }

    function updateStudyTimerUI() {
        const lbl = document.getElementById('studyTimerDisplay');
        const btn = document.getElementById('studyTimerPlayBtn');
        const mins = Math.floor(timerRemainSec / 60);
        const secs = timerRemainSec % 60;
        if (lbl) lbl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (btn) btn.textContent = timerRunning ? '⏸' : '▶';
    }

    function toggleStudyTimerWidget(forceShow) {
        const el = document.getElementById('studyTimerWidget');
        if (!el) return;
        const show = typeof forceShow === 'boolean' ? forceShow : el.classList.contains('hidden');
        el.classList.toggle('hidden', !show);
        updateStudyTimerUI();
    }

    function setStudyTimerMinutes(mins) {
        timerRunning = false;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        timerPresetSec = Math.max(1, Number(mins) || 25) * 60;
        timerRemainSec = timerPresetSec;
        updateStudyTimerUI();
    }

    function toggleStudyTimerRun() {
        if (timerRunning) {
            timerRunning = false;
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        } else {
            if (timerRemainSec <= 0) timerRemainSec = timerPresetSec;
            timerRunning = true;
            timerInterval = setInterval(() => {
                timerRemainSec = Math.max(0, timerRemainSec - 1);
                updateStudyTimerUI();
                if (timerRemainSec === 0) {
                    timerRunning = false;
                    clearInterval(timerInterval); timerInterval = null;
                    playGentleTimerChime();
                    if (typeof showGestureToast === 'function') showGestureToast('⏰ Hết giờ làm bài / Pomodoro!');
                }
            }, 1000);
        }
        updateStudyTimerUI();
    }

    function resetStudyTimer() {
        timerRunning = false;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        timerRemainSec = timerPresetSec;
        updateStudyTimerUI();
    }

    /* ------------------------------------------------------------------------
     * 10. THƯỚC KẺ ẢO TRÊN GIẤY (VIRTUAL RULER + KẺ ĐƯỜNG THẲNG THEO THƯỚC)
     * ------------------------------------------------------------------------ */
    const rulerState = { active: false, x: 240, y: 240, angleDeg: 0, width: 420 };

    function syncVirtualRulerDOM() {
        const el = document.getElementById('virtualRulerOverlay');
        if (!el) return;
        el.classList.toggle('hidden', !rulerState.active);
        el.style.left = `${Math.round(rulerState.x)}px`;
        el.style.top = `${Math.round(rulerState.y)}px`;
        el.style.width = `${rulerState.width}px`;
        el.style.transform = `translate(-50%, -50%) rotate(${rulerState.angleDeg}deg)`;
        const angLbl = document.getElementById('virtualRulerAngleLbl');
        if (angLbl) angLbl.textContent = `${rulerState.angleDeg}°`;
    }

    function toggleVirtualRuler(forceState) {
        rulerState.active = typeof forceState === 'boolean' ? forceState : !rulerState.active;
        if (rulerState.active) {
            rulerState.x = Math.round((window.innerWidth || 1000) * 0.5);
            rulerState.y = Math.round((window.innerHeight || 700) * 0.52);
        }
        syncVirtualRulerDOM();
    }

    function rotateVirtualRuler(deg, isDelta = false) {
        let next = isDelta ? (rulerState.angleDeg + deg) : deg;
        next = ((next % 360) + 360) % 360;
        if (next > 180) next -= 360;
        rulerState.angleDeg = Math.round(next);
        syncVirtualRulerDOM();
    }

    function startVirtualRulerDrag(ev) {
        if (!ev) return;
        ev.preventDefault?.();
        ev.stopPropagation?.();
        const sx = ev.clientX, sy = ev.clientY, bx = rulerState.x, by = rulerState.y;
        const onMove = (me) => {
            rulerState.x = Math.max(80, Math.min((window.innerWidth || 1200) - 80, bx + (me.clientX - sx)));
            rulerState.y = Math.max(110, Math.min((window.innerHeight || 800) - 50, by + (me.clientY - sy)));
            syncVirtualRulerDOM();
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }

    function drawLineAlongVirtualRuler() {
        const el = document.getElementById('virtualRulerOverlay');
        const doc = typeof getDocState === 'function' ? getDocState() : null;
        if (!el || !doc || typeof screenToWorld !== 'function') return;
        const rad = (rulerState.angleDeg * Math.PI) / 180;
        const halfW = rulerState.width * 0.46;
        const halfH = 26;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        // Mép trên cây thước trong tọa độ màn hình
        const topCx = rulerState.x + sin * halfH;
        const topCy = rulerState.y - cos * halfH;
        const p1 = screenToWorld(topCx - cos * halfW, topCy - sin * halfW);
        const p2 = screenToWorld(topCx + cos * halfW, topCy + sin * halfW);
        if (typeof saveHistorySnapshot === 'function') saveHistorySnapshot();
        if (!Array.isArray(doc.inkStrokes)) doc.inkStrokes = [];
        doc.inkStrokes.push({
            mode: 'ink',
            penStyle: 'ballpoint',
            color: (typeof penColor === 'string' && penColor) ? penColor : '#0f172a',
            width: (typeof strokeWidth === 'number' && strokeWidth > 0) ? strokeWidth : 2.8,
            opacity: 1,
            points: [p1, p2],
            _preSmoothed: true
        });
        if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
        if (typeof persistLibrary === 'function') persistLibrary();
        if (typeof renderAll === 'function') renderAll();
        if (typeof showGestureToast === 'function') showGestureToast(`📏 Đã kẻ đường thẳng ${rulerState.angleDeg}° dọc mép thước!`);
    }

    /* ------------------------------------------------------------------------
     * 11. ĐÁNH DẤU & MỤC LỤC TRANG (BOOKMARKS)
     * ------------------------------------------------------------------------ */
    function openBookmarksModal() {
        closeAllPopovers?.();
        renderBookmarksModalBody();
        document.getElementById('bookmarksModal')?.classList?.remove('hidden');
    }

    function closeBookmarksModal() {
        document.getElementById('bookmarksModal')?.classList?.add('hidden');
    }

    function saveCurrentPageBookmark() {
        const nb = typeof getActiveNotebook === 'function' ? getActiveNotebook() : null;
        if (!nb || !Array.isArray(nb.pages)) return;
        const idx = nb.activePageIndex || 0;
        const pg = nb.pages[idx];
        if (!pg) return;
        const inp = document.getElementById('bookmarkPageTitleInput');
        const txt = String(inp?.value || '').trim();
        pg.bookmarkTitle = txt || `Trang ${idx + 1} (Đánh dấu)`;
        if (typeof persistLibrary === 'function') persistLibrary();
        renderBookmarksModalBody();
        if (typeof showGestureToast === 'function') showGestureToast(`🔖 Đã gắn nhãn Trang ${idx + 1}: "${pg.bookmarkTitle}"`);
    }

    function removePageBookmark(pageIdx) {
        const nb = typeof getActiveNotebook === 'function' ? getActiveNotebook() : null;
        if (!nb || !nb.pages?.[pageIdx]) return;
        delete nb.pages[pageIdx].bookmarkTitle;
        if (typeof persistLibrary === 'function') persistLibrary();
        renderBookmarksModalBody();
    }

    function jumpToBookmarkedPage(pageIdx) {
        closeBookmarksModal();
        if (typeof switchToPage === 'function') switchToPage(pageIdx);
    }

    function renderBookmarksModalBody() {
        const nb = typeof getActiveNotebook === 'function' ? getActiveNotebook() : null;
        const listEl = document.getElementById('bookmarksListContainer');
        const curLbl = document.getElementById('bookmarkCurrentPageLbl');
        const inp = document.getElementById('bookmarkPageTitleInput');
        if (!nb || !listEl) return;
        const curIdx = nb.activePageIndex || 0;
        if (curLbl) curLbl.textContent = `Trang hiện tại: Trang ${curIdx + 1}/${nb.pages.length}`;
        if (inp) inp.value = nb.pages[curIdx]?.bookmarkTitle || '';

        const items = [];
        nb.pages.forEach((p, idx) => {
            if (p && p.bookmarkTitle) items.push({ idx, title: p.bookmarkTitle });
        });
        if (!items.length) {
            listEl.innerHTML = '<div class="text-center py-6 text-slate-400">Chưa có trang nào được đánh dấu trong quyển sổ này.</div>';
            return;
        }
        listEl.innerHTML = items.map(it => `
            <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/20 border border-slate-700/70 hover:border-sky-400/50 transition">
                <button type="button" onclick="jumpToBookmarkedPage(${it.idx})" class="flex-1 text-left flex items-center gap-2 min-w-0">
                    <span class="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-extrabold text-[10.5px] shrink-0">Tr. ${it.idx + 1}</span>
                    <span class="font-bold text-slate-100 truncate">${escHtml(it.title)}</span>
                </button>
                <button type="button" onclick="removePageBookmark(${it.idx})" class="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-xs font-bold shrink-0" title="Bỏ đánh dấu">✕</button>
            </div>
        `).join('');
    }

    /* ------------------------------------------------------------------------
     * 12. FLASHCARD ÔN PHẢN ỨNG & CƠ CHẾ (LẬT THẺ 2 MẶT)
     * ------------------------------------------------------------------------ */
    let fcIndex = 0;
    let fcFlipped = false;

    function ensureFlashcardsDeck() {
        if (typeof appLibrary === 'undefined' || !appLibrary) return [];
        if (!Array.isArray(appLibrary.flashcards) || !appLibrary.flashcards.length) {
            appLibrary.flashcards = [
                { id: 'fc1', front: 'Fe + O₂ (t°) → ?', back: '3Fe + 2O₂ → Fe₃O₄ (oxit sắt từ)', mastered: false },
                { id: 'fc2', front: 'Nhận biết ion Fe³⁺ bằng KSCN?', back: 'Tạo phức [Fe(SCN)]²⁺ màu đỏ máu đặc trưng', mastered: false },
                { id: 'fc3', front: 'Kim loại duy nhất phản ứng với S ở nhiệt độ thường?', back: 'Thủy ngân (Hg): Hg + S → HgS (dùng bột S khử độc Hg)', mastered: false },
                { id: 'fc4', front: 'Cặp Fe³⁺/Fe²⁺ đứng ở đâu trong dãy điện hóa?', back: 'Đứng giữa Cu²⁺/Cu (+0.34V) và Ag⁺/Ag (+0.80V) → Fe³⁺ oxi hóa được Cu!', mastered: false }
            ];
        }
        return appLibrary.flashcards;
    }

    function openFlashcardsModal() {
        closeAllPopovers?.();
        fcFlipped = false;
        renderFlashcardsModal();
        document.getElementById('flashcardsModal')?.classList?.remove('hidden');
    }

    function closeFlashcardsModal() {
        document.getElementById('flashcardsModal')?.classList?.add('hidden');
    }

    function addNewFlashcard(frontText, backText) {
        const deck = ensureFlashcardsDeck();
        const f = String(frontText ?? document.getElementById('fcFrontInput')?.value ?? '').trim();
        const b = String(backText ?? document.getElementById('fcBackInput')?.value ?? '').trim();
        if (!f || !b) {
            if (typeof showGestureToast === 'function') showGestureToast('Nhập đủ Mặt trước (câu hỏi) và Mặt sau (đáp án) nhé!');
            return;
        }
        deck.unshift({ id: genId('fc'), front: f, back: b, mastered: false });
        fcIndex = 0;
        fcFlipped = false;
        const fi = document.getElementById('fcFrontInput');
        const bi = document.getElementById('fcBackInput');
        if (fi) fi.value = '';
        if (bi) bi.value = '';
        if (typeof persistLibrary === 'function') persistLibrary();
        renderFlashcardsModal();
        if (typeof showGestureToast === 'function') showGestureToast('🃏 Đã thêm thẻ Flashcard mới!');
    }

    function flipCurrentFlashcard() {
        fcFlipped = !fcFlipped;
        renderFlashcardsModal();
    }

    function stepFlashcard(delta) {
        const deck = ensureFlashcardsDeck();
        if (!deck.length) return;
        fcIndex = (fcIndex + delta + deck.length) % deck.length;
        fcFlipped = false;
        renderFlashcardsModal();
    }

    function toggleMasteredFlashcard() {
        const deck = ensureFlashcardsDeck();
        if (!deck[fcIndex]) return;
        deck[fcIndex].mastered = !deck[fcIndex].mastered;
        if (typeof persistLibrary === 'function') persistLibrary();
        renderFlashcardsModal();
    }

    function deleteCurrentFlashcard() {
        const deck = ensureFlashcardsDeck();
        if (!deck.length) return;
        deck.splice(fcIndex, 1);
        fcIndex = Math.max(0, Math.min(fcIndex, deck.length - 1));
        fcFlipped = false;
        if (typeof persistLibrary === 'function') persistLibrary();
        renderFlashcardsModal();
    }

    function renderFlashcardsModal() {
        const deck = ensureFlashcardsDeck();
        const cardBox = document.getElementById('fcActiveCardBox');
        const progLbl = document.getElementById('fcProgressLbl');
        const mBtn = document.getElementById('fcMasteredBtn');
        if (!cardBox) return;
        if (!deck.length) {
            if (progLbl) progLbl.textContent = '0 / 0 thẻ';
            cardBox.innerHTML = '<div class="text-slate-400">Chưa có thẻ nào — hãy thêm thẻ mới bên dưới!</div>';
            return;
        }
        fcIndex = Math.max(0, Math.min(fcIndex, deck.length - 1));
        const cur = deck[fcIndex];
        const masteredCount = deck.filter(d => d.mastered).length;
        if (progLbl) progLbl.textContent = `Thẻ ${fcIndex + 1}/${deck.length} · Đã thuộc ${masteredCount}/${deck.length}`;
        if (mBtn) {
            mBtn.textContent = cur.mastered ? '✅ Đã thuộc' : '⬜ Đánh dấu đã thuộc';
            mBtn.classList.toggle('active', !!cur.mastered);
        }
        cardBox.innerHTML = `
            <div class="text-[10.5px] font-extrabold uppercase tracking-wider mb-2 ${fcFlipped ? 'text-emerald-300' : 'text-sky-300'}">
                ${fcFlipped ? '✨ ĐÁP ÁN / CƠ CHẾ (Bấm để lật lại)' : '❓ CÂU HỎI / PHẢN ỨNG (Bấm vào thẻ để xem đáp án)'}
            </div>
            <div class="text-base sm:text-lg font-extrabold text-white leading-relaxed">${escHtml(fcFlipped ? cur.back : cur.front)}</div>
        `;
    }

    /* ------------------------------------------------------------------------
     * 13. GIAO DIỆN TRỢ LÝ HÓA HỌC TOÀN NĂNG (5 TABS)
     * ------------------------------------------------------------------------ */
    let chemAssistantTab = 'balance';
    let chemColorCat = 'all';
    let chemColorQuery = '';
    let alphaPairA = 14; // Cu2+/Cu
    let alphaPairB = 16; // Fe3+/Fe2+

    function openChemAssistantModal(defaultTab) {
        closeAllPopovers?.();
        if (defaultTab) chemAssistantTab = defaultTab;
        document.getElementById('chemAssistantModal')?.classList?.remove('hidden');
        switchChemAssistantTab(chemAssistantTab);
    }

    function closeChemAssistantModal() {
        document.getElementById('chemAssistantModal')?.classList?.add('hidden');
    }

    function switchChemAssistantTab(tab) {
        chemAssistantTab = tab || 'balance';
        ['balance', 'analyze', 'colors', 'alpha', 'smiles'].forEach(t => {
            document.getElementById('caTabBtn_' + t)?.classList?.toggle('active', t === chemAssistantTab);
            document.getElementById('caPanel_' + t)?.classList?.toggle('hidden', t !== chemAssistantTab);
        });
        if (chemAssistantTab === 'colors') renderChemColorsGrid();
        if (chemAssistantTab === 'alpha') renderAlphaRulePanel();
        if (chemAssistantTab === 'smiles') renderSmilesPresetsGrid();
        if (chemAssistantTab === 'analyze') renderPageMoleculeScanResults();
    }

    function runEquationBalancerUI(presetEq) {
        const inp = document.getElementById('caBalanceInput');
        if (presetEq && inp) inp.value = presetEq;
        const val = inp?.value || '';
        const out = document.getElementById('caBalanceResultBox');
        if (!out) return;
        const res = balanceChemEquation(val);
        if (!res.ok) {
            out.innerHTML = `<div class="p-3 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 font-bold">${escHtml(res.error)}</div>`;
            return;
        }
        const safeEq = res.equation.replace(/'/g, "\\'");
        const safeQ = (res.leftStr + ' → ?').replace(/'/g, "\\'");
        out.innerHTML = `
            <div class="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/45 space-y-2.5">
                <div class="text-[10.5px] font-extrabold text-emerald-300 uppercase">✓ Đã cân bằng chính xác</div>
                <div class="text-base sm:text-lg font-black text-white select-all break-words">${escHtml(res.equation)}</div>
                <div class="flex flex-wrap gap-2">
                    <button type="button" onclick="dropBalancedEquationToPaper('${safeEq}')" class="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-[11px]">📌 Thả ra giấy A4</button>
                    <button type="button" onclick="navigator.clipboard?.writeText('${safeEq}'); showGestureToast?.('📋 Đã copy phương trình!');" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-[11px]">📋 Copy</button>
                    <button type="button" onclick="addNewFlashcard('${safeQ}', '${safeEq}')" class="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-bold text-[11px]">🃏 Lưu Flashcard</button>
                </div>
            </div>
        `;
    }

    function runFormulaAnalyzerUI(presetF) {
        const inp = document.getElementById('caFormulaInput');
        if (presetF && inp) inp.value = presetF;
        const out = document.getElementById('caFormulaResultBox');
        if (!out) return;
        const res = analyzeChemFormula(inp?.value || '');
        if (!res.ok) {
            out.innerHTML = `<div class="p-3 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 font-bold">${escHtml(res.error)}</div>`;
            return;
        }
        const pctStr = res.rows.map(r => `%${r.el} = ${r.pct.toFixed(2)}%`).join(' · ');
        const dropLines = [
            `CTPT: ${res.pretty}   |   M = ${res.mass.toFixed(2)} g/mol`,
            ...(res.kVal !== null ? [`Độ bất bão hòa k = ${res.kVal} (${res.kHint})`] : []),
            pctStr
        ];
        window._lastAnalyzedDropLines = dropLines;
        out.innerHTML = `
            <div class="p-3.5 rounded-2xl bg-sky-500/12 border border-sky-400/40 space-y-2">
                <div class="flex items-center justify-between flex-wrap gap-2">
                    <div class="text-base font-black text-white">${escHtml(res.pretty)}</div>
                    <div class="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-extrabold text-xs">M = ${res.mass.toFixed(2)} g/mol</div>
                </div>
                ${res.kVal !== null ? `<div class="p-2 rounded-xl bg-black/20 text-[11.5px] text-amber-200"><b>Độ bất bão hòa k = ${res.kVal}</b> — ${escHtml(res.kHint)}</div>` : ''}
                <div class="flex flex-wrap gap-1.5">
                    ${res.rows.map(r => `<span class="px-2 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-[11px] font-bold text-slate-200">${r.el} (${r.n}): <b class="text-sky-300">${r.pct.toFixed(2)}%</b></span>`).join('')}
                </div>
                <button type="button" onclick="dropLastFormulaAnalysisToPaper()" class="px-3 py-1.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-extrabold text-[11px]">📌 Thả thẻ kết quả ra giấy A4</button>
            </div>
        `;
    }

    function dropLastFormulaAnalysisToPaper() {
        if (!Array.isArray(window._lastAnalyzedDropLines)) return;
        const { dataUrl, natW, natH } = renderTextCardDataUrl('🧪 PHÂN TÍCH CÔNG THỨC', window._lastAnalyzedDropLines, '#0284c7', 'rgba(240, 249, 255, 0.94)');
        if (typeof insertDataUrlImageToPage === 'function') {
            insertDataUrlImageToPage(dataUrl, natW, natH, { maxW: Math.min(520, A4_WIDTH * 0.8) });
            closeChemAssistantModal();
        }
    }

    function renderPageMoleculeScanResults() {
        const box = document.getElementById('caPageScanBox');
        if (!box) return;
        const comps = scanActivePageMolecules();
        if (!comps.length) {
            box.innerHTML = '<div class="text-[11px] text-slate-400">Trang hiện tại chưa có phân tử vẽ bằng công cụ Mạch C / Vòng.</div>';
            return;
        }
        box.innerHTML = comps.map((m, idx) => `
            <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/25 border border-slate-700/70">
                <div class="text-[11.5px]">
                    <b class="text-white">#${idx + 1}: ${escHtml(m.pretty)}</b>
                    <span class="text-emerald-300 font-bold ml-1.5">M = ${m.mass.toFixed(2)}</span>
                    ${m.kVal !== null ? `<span class="text-amber-300 font-bold ml-1.5">k = ${m.kVal}</span>` : ''}
                </div>
                <button type="button" onclick="dropScannedMoleculeLabel('${m.formula}')" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 font-bold text-[10.5px]">📌 Thả nhãn</button>
            </div>
        `).join('');
    }

    function dropScannedMoleculeLabel(formula) {
        const res = analyzeChemFormula(formula);
        if (!res.ok) return;
        const line = `${res.pretty}  |  M = ${res.mass.toFixed(2)}${res.kVal !== null ? `  |  k = ${res.kVal}` : ''}`;
        const { dataUrl, natW, natH } = renderTextCardDataUrl('', [line], '#059669', 'rgba(236, 253, 245, 0.94)');
        if (typeof insertDataUrlImageToPage === 'function') {
            insertDataUrlImageToPage(dataUrl, natW, natH, { maxW: 360 });
            closeChemAssistantModal();
        }
    }

    function setChemColorFilter(cat, q) {
        if (typeof cat === 'string') chemColorCat = cat;
        if (typeof q === 'string') chemColorQuery = q;
        ['all', 'kt', 'dd', 'fl', 'ph'].forEach(c => document.getElementById('caColCat_' + c)?.classList?.toggle('active', c === chemColorCat));
        renderChemColorsGrid();
    }

    function renderChemColorsGrid() {
        const grid = document.getElementById('caColorsGrid');
        if (!grid) return;
        const q = chemColorQuery.trim().toLowerCase();
        const list = CHEM_COLORS_DB.filter(item => {
            if (chemColorCat !== 'all' && item.cat !== chemColorCat) return false;
            if (q && !item.name.toLowerCase().includes(q) && !item.desc.toLowerCase().includes(q)) return false;
            return true;
        });
        grid.innerHTML = list.map((it, idx) => `
            <button type="button" onclick="dropChemColorCardToPaper('${escHtml(it.name)}', '${escHtml(it.desc)}', '${it.hex}')" class="p-2 rounded-xl bg-black/25 hover:bg-white/10 border border-slate-700/80 flex items-center gap-2.5 text-left transition">
                <span class="w-8 h-8 rounded-lg shrink-0 border border-white/25 shadow-inner" style="background:${it.hex};"></span>
                <div class="min-w-0">
                    <div class="font-extrabold text-[11.5px] text-white truncate">${escHtml(it.name)}</div>
                    <div class="text-[10px] text-slate-300 truncate">${escHtml(it.desc)}</div>
                </div>
            </button>
        `).join('') || '<div class="col-span-2 text-center py-4 text-slate-400">Không tìm thấy chất phù hợp.</div>';
    }

    function dropChemColorCardToPaper(name, desc, hex) {
        const dpr = 2, w = 320, h = 58;
        const cvs = document.createElement('canvas');
        cvs.width = w * dpr; cvs.height = h * dpr;
        const g = cvs.getContext('2d');
        g.scale(dpr, dpr);
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 12); g.fill();
        g.strokeStyle = '#64748b'; g.lineWidth = 1.6; g.stroke();
        g.fillStyle = hex;
        g.beginPath(); g.roundRect(12, 11, 36, 36, 9); g.fill();
        g.strokeStyle = 'rgba(15,23,42,0.25)'; g.lineWidth = 1.2; g.stroke();
        g.fillStyle = '#0f172a';
        g.font = '800 15px "Inter", -apple-system, sans-serif';
        g.textBaseline = 'top';
        g.fillText(name, 58, 12);
        g.fillStyle = '#334155';
        g.font = '600 12.5px "Inter", -apple-system, sans-serif';
        g.fillText(desc, 58, 33);
        if (typeof insertDataUrlImageToPage === 'function') {
            insertDataUrlImageToPage(cvs.toDataURL('image/png'), w, h, { maxW: 300 });
            closeChemAssistantModal();
            if (typeof showGestureToast === 'function') showGestureToast(`🌈 Đã thả thẻ màu ${name} ra giấy!`);
        }
    }

    function renderAlphaRulePanel() {
        const selA = document.getElementById('caAlphaSelA');
        const selB = document.getElementById('caAlphaSelB');
        const resBox = document.getElementById('caAlphaResultBox');
        if (!selA || !selB || !resBox) return;
        if (!selA.options.length) {
            const optsHtml = ELECTROCHEM_SERIES.map((p, i) => `<option value="${i}">${p.ox} / ${p.red} (E° = ${p.e0 >= 0 ? '+' : ''}${p.e0.toFixed(2)}V)</option>`).join('');
            selA.innerHTML = optsHtml;
            selB.innerHTML = optsHtml;
            selA.value = String(alphaPairA);
            selB.value = String(alphaPairB);
        }
        alphaPairA = Number(selA.value);
        alphaPairB = Number(selB.value);
        const pA = ELECTROCHEM_SERIES[alphaPairA];
        const pB = ELECTROCHEM_SERIES[alphaPairB];
        if (!pA || !pB || alphaPairA === alphaPairB) {
            resBox.innerHTML = '<div class="p-3 rounded-xl bg-amber-500/15 text-amber-200 font-bold">Hãy chọn 2 cặp oxi hóa – khử khác nhau để áp dụng quy tắc α.</div>';
            return;
        }
        const leftP = pA.e0 < pB.e0 ? pA : pB;
        const rightP = pA.e0 < pB.e0 ? pB : pA;
        const dE = (rightP.e0 - leftP.e0).toFixed(2);
        const rxn = `${rightP.ox} + ${leftP.red} → ${rightP.red} + ${leftP.ox}`;
        window._lastAlphaData = { leftP, rightP, dE, rxn };

        resBox.innerHTML = `
            <div class="p-3.5 rounded-2xl bg-indigo-500/15 border border-indigo-400/40 space-y-2.5">
                <div class="flex items-center justify-between flex-wrap gap-2">
                    <span class="text-[11px] font-extrabold text-indigo-300">⚡ QUY TẮC ALPHA (α)</span>
                    <span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-extrabold text-[11px]">ΔE° = +${dE} V > 0 (Tự xảy ra)</span>
                </div>
                <div class="grid grid-cols-2 gap-3 text-center p-2.5 rounded-xl bg-black/25">
                    <div>
                        <div class="text-sm font-black text-sky-300">${leftP.ox}</div>
                        <div class="h-px bg-slate-600 my-1"></div>
                        <div class="text-sm font-black text-emerald-300">${leftP.red}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">E° = ${leftP.e0 >= 0 ? '+' : ''}${leftP.e0.toFixed(2)}V</div>
                    </div>
                    <div>
                        <div class="text-sm font-black text-rose-300">${rightP.ox}</div>
                        <div class="h-px bg-slate-600 my-1"></div>
                        <div class="text-sm font-black text-amber-300">${rightP.red}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">E° = ${rightP.e0 >= 0 ? '+' : ''}${rightP.e0.toFixed(2)}V</div>
                    </div>
                </div>
                <div class="text-sm font-black text-white text-center">${escHtml(rxn)}</div>
                <button type="button" onclick="dropAlphaDiagramToPaper()" class="w-full h-9 rounded-xl bg-indigo-400 hover:bg-indigo-300 text-slate-950 font-extrabold text-xs">📌 Thả sơ đồ Quy tắc α ra giấy A4</button>
            </div>
        `;
    }

    function dropAlphaDiagramToPaper() {
        const d = window._lastAlphaData;
        if (!d) return;
        const lines = [
            `Cặp 1: ${d.leftP.ox}/${d.leftP.red} (${d.leftP.e0}V)   <   Cặp 2: ${d.rightP.ox}/${d.rightP.red} (${d.rightP.e0 >= 0 ? '+' : ''}${d.rightP.e0}V)`,
            `Phản ứng (α):  ${d.rxn}   (ΔE° = +${d.dE} V)`
        ];
        const { dataUrl, natW, natH } = renderTextCardDataUrl('⚡ QUY TẮC ALPHA (α)', lines, '#4f46e5', 'rgba(238, 242, 255, 0.94)');
        if (typeof insertDataUrlImageToPage === 'function') {
            insertDataUrlImageToPage(dataUrl, natW, natH, { maxW: Math.min(540, A4_WIDTH * 0.82) });
            closeChemAssistantModal();
        }
    }

    function renderSmilesPresetsGrid() {
        const box = document.getElementById('caSmilesPresetsGrid');
        if (!box) return;
        box.innerHTML = Object.entries(PRESET_MOLECULES).map(([k, v]) => `
            <button type="button" onclick="runSmilesInsertUI('${v.smiles}', '${escHtml(v.name)}')" class="px-2.5 py-1.5 rounded-xl bg-black/25 hover:bg-sky-500/20 border border-slate-700/80 hover:border-sky-400/50 text-left transition">
                <div class="font-bold text-[11px] text-white truncate">${escHtml(v.name)}</div>
                <div class="text-[9.5px] text-sky-300 font-mono truncate">${escHtml(v.smiles)}</div>
            </button>
        `).join('');
    }

    function runSmilesInsertUI(presetSmiles, labelName) {
        const inp = document.getElementById('caSmilesInput');
        const q = presetSmiles || inp?.value || '';
        const ok = insertMoleculeFromSmilesOrName(q);
        if (ok) {
            closeChemAssistantModal();
            if (typeof showGestureToast === 'function') showGestureToast(`🧬 Đã vẽ phân tử ${labelName || q} ra giấy A4!`);
        } else {
            if (typeof showGestureToast === 'function') showGestureToast('Không nhận diện được tên / SMILES này (VD: benzene, phenol, CC(=O)O, C=CC=C).');
        }
    }

    /* ------------------------------------------------------------------------
     * 14. TABS CHO MODAL BẢNG & TRANG TRÍ VỞ (BẢNG / THẺ GHI CHÚ / BANNER / BĂNG CHE)
     * ------------------------------------------------------------------------ */
    function switchDecorModalTab(tab) {
        ['table', 'sticky', 'banner', 'tape'].forEach(t => {
            document.getElementById('decorTabBtn_' + t)?.classList?.toggle('active', t === tab);
            document.getElementById('decorPanel_' + t)?.classList?.toggle('hidden', t !== tab);
        });
    }

    // Export globals
    Object.assign(window, {
        balanceChemEquation,
        dropBalancedEquationToPaper,
        analyzeChemFormula,
        scanActivePageMolecules,
        renderStudyTapesOnContext,
        addStudyTapeToPage,
        toggleAllStudyTapes,
        clearPageStudyTapes,
        insertStickyCalloutToPaper,
        insertStudyBannerToPaper,
        removeWhiteBgFromSelectedImage,
        toggleStudyTimerWidget,
        setStudyTimerMinutes,
        toggleStudyTimerRun,
        resetStudyTimer,
        toggleVirtualRuler,
        rotateVirtualRuler,
        startVirtualRulerDrag,
        drawLineAlongVirtualRuler,
        openBookmarksModal,
        closeBookmarksModal,
        saveCurrentPageBookmark,
        removePageBookmark,
        jumpToBookmarkedPage,
        openFlashcardsModal,
        closeFlashcardsModal,
        addNewFlashcard,
        flipCurrentFlashcard,
        stepFlashcard,
        toggleMasteredFlashcard,
        deleteCurrentFlashcard,
        openChemAssistantModal,
        closeChemAssistantModal,
        switchChemAssistantTab,
        runEquationBalancerUI,
        runFormulaAnalyzerUI,
        dropLastFormulaAnalysisToPaper,
        renderPageMoleculeScanResults,
        dropScannedMoleculeLabel,
        setChemColorFilter,
        dropChemColorCardToPaper,
        renderAlphaRulePanel,
        dropAlphaDiagramToPaper,
        runSmilesInsertUI,
        switchDecorModalTab
    });
})();
