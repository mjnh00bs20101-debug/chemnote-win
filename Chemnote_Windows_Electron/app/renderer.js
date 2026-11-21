/* ============================================================================
 * MODULE 3: CANVAS 2D RENDERER (Dựng hình giấy A4, Phân tử, Orbital & Laser)
 * ============================================================================ */

function startLaserLoop() {
    if (laserAnimFrame) return;
    const tick = () => {
        renderAll();
        if (currentLaserStroke) {
            laserAnimFrame = requestAnimationFrame(tick);
        } else {
            laserAnimFrame = null;
        }
    };
    laserAnimFrame = requestAnimationFrame(tick);
}

function isBatterySaverActive() {
    return !!(typeof appLibrary !== 'undefined' && appLibrary && appLibrary.ipadConfig && appLibrary.ipadConfig.batterySaverMode);
}

function getSharpDpr() {
    const raw = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cap = isBatterySaverActive() ? 1.5 : 2;
    return Math.min(cap, Math.max(1, raw));
}

function resizeCanvas() {
    if (typeof syncActivePaperDimensions === 'function') syncActivePaperDimensions();
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    const vp = document.getElementById('deskViewport') || canvas;
    if (!vp) return;
    const vpRect = typeof vp.getBoundingClientRect === 'function' ? vp.getBoundingClientRect() : null;
    const cRect = (canvas && canvas !== vp && typeof canvas.getBoundingClientRect === 'function') ? canvas.getBoundingClientRect() : vpRect;
    const sizeSrc = (vpRect && vpRect.width > 0 && vpRect.height > 0) ? vpRect : cRect;
    const posSrc = (cRect && (cRect.width > 0 || Number.isFinite(cRect.left))) ? cRect : sizeSrc;
    cssWidth = Math.max(300, (vp.clientWidth > 0 ? vp.clientWidth : (sizeSrc?.width || 800)));
    cssHeight = Math.max(250, (vp.clientHeight > 0 ? vp.clientHeight : (sizeSrc?.height || 600)));
    if (typeof cachedCanvasRect !== 'undefined') {
        cachedCanvasRect = { left: posSrc?.left || 0, top: posSrc?.top || 0, width: cssWidth, height: cssHeight };
    }
    const dpr = getSharpDpr();
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (typeof clampViewportPanAndZoom === 'function') clampViewportPanAndZoom();
    if (typeof updateRingTransformFloatingBarPos === 'function') updateRingTransformFloatingBarPos();
    if (typeof updateImageFloatingBarPos === 'function') updateImageFloatingBarPos();
    if (typeof updateChainFloatingBarPos === 'function') updateChainFloatingBarPos();
    if (typeof updateLassoFloatingBarPos === 'function') updateLassoFloatingBarPos();
    renderAll();
    if (appLibrary.splitView.enabled) renderSplitRightPane();
}

function syncCanvasGeometryIfNeeded() {
    const vp = (typeof document !== 'undefined' ? document.getElementById('deskViewport') : null) || canvas;
    if (!vp || !canvas) return false;
    const vpRect = typeof vp.getBoundingClientRect === 'function' ? vp.getBoundingClientRect() : null;
    const cRect = (typeof canvas.getBoundingClientRect === 'function') ? canvas.getBoundingClientRect() : vpRect;
    const liveW = vp.clientWidth > 0 ? vp.clientWidth : (vpRect?.width || cRect?.width || 0);
    const liveH = vp.clientHeight > 0 ? vp.clientHeight : (vpRect?.height || cRect?.height || 0);
    if (liveW <= 0 || liveH <= 0) return false;
    const dpr = getSharpDpr();
    const expectW = Math.round(Math.max(300, liveW) * dpr);
    const expectH = Math.round(Math.max(250, liveH) * dpr);
    if (typeof cachedCanvasRect !== 'undefined') {
        cachedCanvasRect = { left: cRect?.left || 0, top: cRect?.top || 0, width: Math.max(300, liveW), height: Math.max(250, liveH) };
    }
    if (Math.abs(Math.max(300, liveW) - cssWidth) > 1.5 || Math.abs(Math.max(250, liveH) - cssHeight) > 1.5 ||
        Math.abs((canvas.width || 0) - expectW) > 2 || Math.abs((canvas.height || 0) - expectH) > 2) {
        resizeCanvas();
        return true;
    }
    return false;
}

function fitA4ToScreen(mode = 'auto') {
    if (typeof syncActivePaperDimensions === 'function') syncActivePaperDimensions();
    getActivePage();
    const nb = getActiveNotebook();
    const fitPageZ = typeof getFitFullPageZoom === 'function' ? getFitFullPageZoom() : Math.min((cssWidth - 36) / A4_WIDTH, (cssHeight - 36) / A4_HEIGHT);
    const fitWidthZ = typeof getFitWidthZoom === 'function' ? getFitWidthZoom() : (cssWidth - 24) / A4_WIDTH;
    let targetZ;
    if (mode === 'page' || (typeof isReadMode !== 'undefined' && isReadMode)) {
        targetZ = fitPageZ;
    } else if (mode === 'width') {
        targetZ = fitWidthZ;
    } else {
        targetZ = Math.abs((zoom || 1) - fitPageZ) > 0.04 ? fitPageZ : fitWidthZ;
    }
    zoom = targetZ;
    const actIdx = nb.activePageIndex || 0;
    const box = typeof getPageLayoutBox === 'function' ? getPageLayoutBox(actIdx) : { x: 0, y: getPageYOffset(actIdx), w: A4_WIDTH, h: A4_HEIGHT };
    const twoCol = typeof isReadMode !== 'undefined' && isReadMode && typeof readTwoPageMode !== 'undefined' && readTwoPageMode && (nb.pages || []).length > 1;
    const worldW = twoCol ? (A4_WIDTH * 2 + PAGE_GAP) : A4_WIDTH;
    panX = Math.round((cssWidth - worldW * zoom) / 2);
    panY = Math.round((cssHeight - A4_HEIGHT * zoom) / 2 - box.y * zoom);
    if (typeof clampViewportPanAndZoom === 'function') clampViewportPanAndZoom();
    if (typeof updateRingTransformFloatingBarPos === 'function') updateRingTransformFloatingBarPos();
    if (typeof updateImageFloatingBarPos === 'function') updateImageFloatingBarPos();
    if (typeof updateChainFloatingBarPos === 'function') updateChainFloatingBarPos();
    if (typeof updateLassoFloatingBarPos === 'function') updateLassoFloatingBarPos();
    if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
    if (typeof enforcePillDomBounds === 'function' && typeof appLibrary !== 'undefined') {
        const pillEl = document.getElementById('penPillWidget');
        if (pillEl && pillEl.classList?.contains('is-floating')) {
            enforcePillDomBounds(pillEl, appLibrary.penPillConfig);
        }
    }
    renderAll();
}

function zoomCanvasBy(factor) {
    const minZ = typeof getMinFullScreenZoom === 'function' ? getMinFullScreenZoom() : 0.22;
    const oldZoom = zoom || 1;
    const nextZoom = Math.max(minZ, Math.min(3.5, oldZoom * factor));
    const cx = cssWidth / 2;
    const cy = cssHeight / 2;
    panX = cx - ((cx - panX) / oldZoom) * nextZoom;
    panY = cy - ((cy - panY) / oldZoom) * nextZoom;
    zoom = nextZoom;
    if (typeof clampViewportPanAndZoom === 'function') clampViewportPanAndZoom();
    if (typeof updateRingTransformFloatingBarPos === 'function') updateRingTransformFloatingBarPos();
    if (typeof updateImageFloatingBarPos === 'function') updateImageFloatingBarPos();
    if (typeof updateChainFloatingBarPos === 'function') updateChainFloatingBarPos();
    if (typeof updateLassoFloatingBarPos === 'function') updateLassoFloatingBarPos();
    if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
    if (typeof enforcePillDomBounds === 'function' && typeof appLibrary !== 'undefined') {
        const pillEl = document.getElementById('penPillWidget');
        if (pillEl && pillEl.classList?.contains('is-floating')) {
            enforcePillDomBounds(pillEl, appLibrary.penPillConfig);
        }
    }
    renderAll();
}

window.addEventListener('resize', resizeCanvas);
if (typeof window !== 'undefined' && window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('resize', () => {
        if (typeof refreshCanvasRect === 'function') refreshCanvasRect();
        syncCanvasGeometryIfNeeded();
    });
    window.visualViewport.addEventListener('scroll', () => {
        if (typeof refreshCanvasRect === 'function') refreshCanvasRect();
    });
}
if (typeof ResizeObserver === 'function') {
    try {
        let _geoObsRaf = null;
        const _geoObs = new ResizeObserver(() => {
            if (typeof requestAnimationFrame !== 'function') {
                syncCanvasGeometryIfNeeded();
                return;
            }
            if (_geoObsRaf !== null) return;
            _geoObsRaf = requestAnimationFrame(() => {
                _geoObsRaf = null;
                syncCanvasGeometryIfNeeded();
            });
        });
        const _vpNode = typeof document !== 'undefined' ? document.getElementById('deskViewport') : null;
        if (_vpNode) _geoObs.observe(_vpNode);
    } catch (_) {}
}

function measureSubscriptedParts(c, txt, fontSize) {
    c.save();
    c.font = `700 ${fontSize}px Inter, sans-serif`;
    const tokens = (txt || '').match(/([A-Za-z°Δ→±]+|\d+|[+-]|[^A-Za-z\d+-]+)/g) || [txt];
    let totalW = 0;
    const parts = tokens.map((tk, idx) => {
        const isSub = /^\d+$/.test(tk);
        const prev = idx > 0 ? tokens[idx - 1] : '';
        const isSup = (tk === '+' || tk === '-') && /^[A-Za-z\d]+$/.test(prev);
        const fSz = isSub || isSup ? Math.max(5.5, Math.round(fontSize * 0.74 * 10) / 10) : fontSize;
        c.font = `700 ${fSz}px Inter, sans-serif`;
        const w = c.measureText(tk).width;
        totalW += w;
        return { tk, isSub, isSup, fSz, w };
    });
    c.restore();
    return { parts, totalW };
}

function drawSubscriptedTextOnCtx(c, txt, x, y, fontSize, align = 'center') {
    c.save();
    c.textAlign = 'left';
    const { parts, totalW } = measureSubscriptedParts(c, txt, fontSize);
    let curX = align === 'center' ? x - totalW / 2 : (align === 'right' ? x - totalW : x);
    parts.forEach(p => {
        c.font = `700 ${p.fSz}px Inter, sans-serif`;
        const dy = p.isSub ? fontSize * 0.22 : (p.isSup ? -fontSize * 0.28 : 0);
        c.fillText(p.tk, curX, y + dy);
        curX += p.w;
    });
    c.restore();
}

const paperBgCache = new Map();

function renderPaperTemplateDirect(c, cfg) {
    const W = cfg.width, H = cfg.height;
    const tpl = cfg.template;
    const step = cfg.spacing;
    const op = cfg.lineOpacity;
    const isDark = !!cfg.isDark;
    const rgb = isDark ? '226,232,240' : '71,85,105';
    const majorRgb = isDark ? '125,211,252' : '51,65,85';
    const snap = (v) => Math.round(v * 2) / 2;

    c.save();
    c.fillStyle = cfg.bgColor;
    c.fillRect(0, 0, W, H);

    if (tpl === 'grid') {
        const subStep = Math.max(10, Math.round(step * 0.5));
        const cellsPerMajor = 4;
        const majorStep = subStep * cellsPerMajor;
        const minorOp = Math.min(0.42, op * (isDark ? 0.42 : 0.44));
        const midOp = Math.min(0.58, op * (isDark ? 0.68 : 0.72));
        const majorOp = Math.min(0.92, op * (isDark ? 1.75 : 1.65));

        // 1. Ô bé (nét mảnh, nhạt bên trong ô lớn)
        c.strokeStyle = 'rgba(' + rgb + ',' + minorOp.toFixed(3) + ')';
        c.lineWidth = 0.55;
        c.beginPath();
        for (let i = 1, x = subStep; x < W; i++, x += subStep) {
            if (i % 2 === 0) continue;
            const sx = snap(x);
            c.moveTo(sx, 0); c.lineTo(sx, H);
        }
        for (let j = 1, y = subStep; j < H; j++, y += subStep) {
            if (j % 2 === 0) continue;
            const sy = snap(y);
            c.moveTo(0, sy); c.lineTo(W, sy);
        }
        c.stroke();

        // 2. Nét chia đôi trung gian (vừa phải, giúp căn chữ & công thức dễ hơn)
        c.strokeStyle = 'rgba(' + rgb + ',' + midOp.toFixed(3) + ')';
        c.lineWidth = 0.78;
        c.beginPath();
        for (let i = 2, x = subStep * 2; x < W; i += 2, x += subStep * 2) {
            if (i % cellsPerMajor === 0) continue;
            const sx = snap(x);
            c.moveTo(sx, 0); c.lineTo(sx, H);
        }
        for (let j = 2, y = subStep * 2; j < H; j += 2, y += subStep * 2) {
            if (j % cellsPerMajor === 0) continue;
            const sy = snap(y);
            c.moveTo(0, sy); c.lineTo(W, sy);
        }
        c.stroke();

        // 3. Ô vuông lớn (nét đậm rõ nét mỗi 4x4 ô bé)
        c.strokeStyle = 'rgba(' + majorRgb + ',' + majorOp.toFixed(3) + ')';
        c.lineWidth = 1.38;
        c.beginPath();
        for (let x = majorStep; x < W; x += majorStep) {
            const sx = snap(x);
            c.moveTo(sx, 0); c.lineTo(sx, H);
        }
        for (let y = majorStep; y < H; y += majorStep) {
            const sy = snap(y);
            c.moveTo(0, sy); c.lineTo(W, sy);
        }
        c.stroke();

    } else if (tpl === 'dots') {
        const dotOp = Math.min(0.86, op * 1.6);
        const majorDotOp = Math.min(0.94, op * 2.1);
        for (let ix = 1, x = step; x < W; ix++, x += step) {
            for (let iy = 1, y = step; y < H; iy++, y += step) {
                const isMajor = (ix % 5 === 0 && iy % 5 === 0);
                c.fillStyle = isMajor
                    ? `rgba(${majorRgb},${majorDotOp.toFixed(3)})`
                    : `rgba(${rgb},${dotOp.toFixed(3)})`;
                c.beginPath();
                c.arc(snap(x), snap(y), isMajor ? 1.55 : 1.05, 0, Math.PI * 2);
                c.fill();
            }
        }
    } else if (tpl === 'lined' || tpl === 'cornell') {
        const topStart = Math.max(54, step * 2);
        const headerRuleY = snap(topStart - step * 0.14);
        // Header double accent rule
        c.strokeStyle = `rgba(${majorRgb},${Math.min(0.85, op * 1.45).toFixed(3)})`;
        c.lineWidth = 1.25;
        c.beginPath();
        c.moveTo(0, snap(topStart)); c.lineTo(W, snap(topStart));
        c.stroke();
        c.strokeStyle = `rgba(${majorRgb},${Math.min(0.65, op * 0.95).toFixed(3)})`;
        c.lineWidth = 0.85;
        c.beginPath();
        c.moveTo(0, headerRuleY); c.lineTo(W, headerRuleY);
        c.stroke();

        // Horizontal ruled lines
        c.strokeStyle = `rgba(${rgb},${Math.min(0.75, op * 1.08).toFixed(3)})`;
        c.lineWidth = 0.88;
        c.beginPath();
        for (let y = topStart + step; y < H - 24; y += step) {
            const sy = snap(y);
            c.moveTo(0, sy); c.lineTo(W, sy);
        }
        c.stroke();

        if (tpl === 'cornell') {
            const marginX = snap(Math.min(190, Math.round(W * 0.24)));
            c.strokeStyle = `rgba(244,63,94,${Math.min(0.9, op + 0.24).toFixed(3)})`;
            c.lineWidth = 1.45;
            c.beginPath();
            c.moveTo(marginX, 0); c.lineTo(marginX, H);
            c.stroke();
            c.strokeStyle = `rgba(244,63,94,${Math.min(0.55, op + 0.06).toFixed(3)})`;
            c.lineWidth = 0.85;
            c.beginPath();
            c.moveTo(marginX + 3, 0); c.lineTo(marginX + 3, H);
            c.stroke();
            const sumY = snap(H - Math.max(120, step * 4.5));
            c.strokeStyle = `rgba(${majorRgb},${Math.min(0.8, op * 1.35).toFixed(3)})`;
            c.lineWidth = 1.2;
            c.beginPath();
            c.moveTo(0, sumY); c.lineTo(W, sumY);
            c.stroke();
        }
    } else if (tpl === 'hex') {
        const r = Math.max(12, step * 0.65);
        const dxHex = Math.sqrt(3) * r;
        const dyHex = 1.5 * r;
        const rows = Math.ceil(H / dyHex) + 1;
        const cols = Math.ceil(W / dxHex) + 1;
        c.strokeStyle = `rgba(${rgb},${Math.min(0.78, op * 1.15).toFixed(3)})`;
        c.lineWidth = 0.94;
        c.lineJoin = 'round';
        c.beginPath();
        for (let row = 0; row <= rows; row++) {
            const cy = row * dyHex;
            const offsetX = (row % 2 === 1) ? dxHex / 2 : 0;
            for (let col = -1; col <= cols; col++) {
                const cx = col * dxHex + offsetX;
                for (let k = 0; k < 6; k++) {
                    const ang = -Math.PI / 2 + (k * Math.PI) / 3;
                    const vx = cx + r * Math.cos(ang);
                    const vy = cy + r * Math.sin(ang);
                    if (k === 0) c.moveTo(vx, vy);
                    else c.lineTo(vx, vy);
                }
                c.closePath();
            }
        }
        c.stroke();

        // Subtle center guide dots inside benzene hex tiles
        c.fillStyle = `rgba(${majorRgb},${Math.min(0.55, op * 0.72).toFixed(3)})`;
        for (let row = 0; row <= rows; row++) {
            const cy = row * dyHex;
            const offsetX = (row % 2 === 1) ? dxHex / 2 : 0;
            for (let col = -1; col <= cols; col++) {
                const cx = col * dxHex + offsetX;
                c.beginPath();
                c.arc(cx, cy, 0.9, 0, Math.PI * 2);
                c.fill();
            }
        }
    }
    c.restore();
}

function drawPaperBackground(c, pageOrTpl) {
    const cfg = typeof getPagePaperConfig === 'function'
        ? getPagePaperConfig(pageOrTpl)
        : { template: 'grid', width: A4_WIDTH, height: A4_HEIGHT, bgColor: '#fcfaf2', spacing: 28, lineOpacity: 0.34, isDark: false };
    const W = cfg.width, H = cfg.height;
    const bgScale = Math.min(2, Math.max(1.5, getSharpDpr()));
    const cacheKey = `${cfg.template}|${W}|${H}|${cfg.bgColor}|${cfg.spacing}|${cfg.lineOpacity}|${cfg.isDark ? 1 : 0}|@${bgScale}`;
    let cached = paperBgCache.get(cacheKey);
    if (!cached && typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const off = document.createElement('canvas');
        off.width = Math.round(W * bgScale);
        off.height = Math.round(H * bgScale);
        const offCtx = off && typeof off.getContext === 'function' ? off.getContext('2d') : null;
        if (offCtx) {
            offCtx.setTransform(bgScale, 0, 0, bgScale, 0, 0);
            renderPaperTemplateDirect(offCtx, cfg);
            if (paperBgCache.size >= 6) paperBgCache.clear();
            paperBgCache.set(cacheKey, off);
            cached = off;
        }
    }
    if (cached && typeof c.drawImage === 'function') {
        c.save();
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.drawImage(cached, 0, 0, W, H);
        c.restore();
    } else {
        renderPaperTemplateDirect(c, cfg);
    }
}

function computeNotewiseInkWidth(style, baseW, dirX, dirY, speedPxPerMs, pressure, sArc, totalLen, nibAngleDeg, hasStrokeP, isLiveStroke = false) {
    const spd = Number.isFinite(speedPxPerMs) ? Math.max(0.06, Math.min(2.2, speedPxPerMs)) : 0.36;
    let widthMul = 1.0;

    if (style === 'fountain') {
        let dirW;
        if (nibAngleDeg === 35) {
            const ang = Math.atan2(dirY, dirX);
            const ob = Math.abs(Math.sin(ang + 0.6109));
            const obS = ob * ob * (3 - 2 * ob);
            dirW = 0.56 + obS * 0.66 + Math.max(0, dirY) * 0.06;
        } else {
            // Bút máy Vector chuẩn Notewise (Wisenote): góc ngòi tự nhiên ~16°, đường cong C1 smoothstep siêu mượt (không gồ ghề trên chữ tròn), nét sổ đầy mực (1.24x), nét ngang sắc rõ (0.76x), nét hất lên thanh thoát (0.46x)
            const downProj = Math.max(-1, Math.min(1, dirY * 0.96 - dirX * 0.28));
            if (downProj >= 0) {
                const s = downProj * downProj * (3 - 2 * downProj);
                dirW = 0.76 + 0.48 * s;
            } else {
                const a = -downProj;
                const s = a * a * (3 - 2 * a);
                dirW = 0.76 - 0.30 * s;
            }
        }
        // Dòng mực lỏng theo vận tốc kiểu Notewise (smoothstep êm mượt): chậm đầy mực (1.11x), lướt nhanh thanh gọn (0.69x)
        const velNorm = Math.min(1, Math.max(0, (spd - 0.14) / 1.35));
        const vEase = velNorm * velNorm * (3 - 2 * velNorm);
        const velW = 1.11 - vEase * 0.42;
        let pressW = 1.0;
        if (hasStrokeP && typeof pressure === 'number' && Number.isFinite(pressure)) {
            const pNorm = Math.max(0.06, Math.min(0.96, pressure));
            // Lực nhấn Apple Pencil phản hồi tự nhiên, không cắt trần khi nhấn đậm (0.60..1.34)
            pressW = 0.60 + Math.pow(pNorm, 0.76) * 0.74;
        }
        widthMul = dirW * velW * pressW;
    } else if (style === 'brush') {
        const velNorm = Math.min(1, Math.max(0, (spd - 0.14) / 1.35));
        const vEase = velNorm * velNorm * (3 - 2 * velNorm);
        const velW = 1.15 - vEase * 0.44;
        let pressW = 1.0;
        if (hasStrokeP && typeof pressure === 'number' && Number.isFinite(pressure)) {
            const pNorm = Math.max(0.06, Math.min(0.96, pressure));
            pressW = 0.52 + Math.pow(pNorm, 0.74) * 0.90;
        } else {
            const downBoost = Math.max(0, dirY) * 0.20;
            pressW = 0.88 + downBoost;
        }
        widthMul = velW * pressW;
    }

    let taper = 1.0;
    const minTaperLen = Math.max(3.5, baseW * 1.0);
    if (totalLen > minTaperLen) {
        const entryLen = Math.min(style === 'brush' ? 9.0 : 6.5, totalLen * 0.12);
        if (sArc < entryLen && entryLen > 0.1) {
            const uIn = Math.max(0, Math.min(1, sArc / entryLen));
            const startMin = style === 'brush' ? 0.46 : 0.58;
            taper *= startMin + (1 - startMin) * (1 - (1 - uIn) * (1 - uIn));
        }
        const exitLen = isLiveStroke
            ? Math.min(5.0, totalLen * 0.10)
            : Math.min(style === 'brush' ? 18.0 : 14.5, totalLen * 0.25);
        const rem = totalLen - sArc;
        if (rem < exitLen && exitLen > 0.1) {
            const uOut = Math.max(0, Math.min(1, rem / exitLen));
            const endMin = isLiveStroke ? 0.56 : (style === 'brush' ? 0.16 : 0.22);
            taper *= endMin + (1 - endMin) * Math.pow(uOut, 1.02);
        }
    }

    const minFloor = style === 'fountain' ? Math.max(0.42, baseW * 0.18) : Math.max(0.40, baseW * 0.16);
    const maxCeil = Math.max(1.5, baseW * (style === 'brush' ? 1.56 : 1.56));
    return Math.max(minFloor, Math.min(maxCeil, baseW * widthMul * taper));
}

function getHexColorLuminance(hex) {
    if (typeof hex !== 'string') return 0.5;
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return 0.5;
    const n = parseInt(m[1], 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const strokeRibbonCache = typeof WeakMap === 'function' ? new WeakMap() : null;

function invalidateStrokeRibbonCache(st) {
    if (strokeRibbonCache && st && typeof st === 'object') {
        strokeRibbonCache.delete(st);
    }
}

function traceRibbonSegmentToTarget(target, seg) {
    const L = seg.L, R = seg.R;
    const p0x = seg.p0x, p0y = seg.p0y, r0 = seg.r0, aStart = seg.aStart;
    const pEx = seg.pEx, pEy = seg.pEy, rE = seg.rE, aEnd = seg.aEnd;
    for (let a = 0; a <= 7; a++) {
        const ang = aStart - (Math.PI * a) / 7;
        const cx = p0x + Math.cos(ang) * r0, cy = p0y + Math.sin(ang) * r0;
        if (a === 0) target.moveTo(cx, cy); else target.lineTo(cx, cy);
    }
    for (let j = 1; j < L.length - 1; j++) {
        const mx = (L[j].x + L[j + 1].x) * 0.5, my = (L[j].y + L[j + 1].y) * 0.5;
        target.quadraticCurveTo(L[j].x, L[j].y, mx, my);
    }
    target.lineTo(L[L.length - 1].x, L[L.length - 1].y);
    for (let a = 1; a <= 7; a++) {
        const ang = aEnd - (Math.PI * a) / 7;
        target.lineTo(pEx + Math.cos(ang) * rE, pEy + Math.sin(ang) * rE);
    }
    for (let j = R.length - 2; j >= 1; j--) {
        const mx = (R[j].x + R[j - 1].x) * 0.5, my = (R[j].y + R[j - 1].y) * 0.5;
        target.quadraticCurveTo(R[j].x, R[j].y, mx, my);
    }
    target.lineTo(R[0].x, R[0].y);
    target.closePath();
}

function buildRibbonPath2DFromSegs(segs) {
    if (typeof Path2D !== 'function' || !segs || !segs.length) return null;
    try {
        const p2d = new Path2D();
        for (let i = 0; i < segs.length; i++) {
            const seg = segs[i];
            traceRibbonSegmentToTarget(p2d, seg);
            if (seg.cuspCap) {
                p2d.moveTo(seg.pEx + seg.rE, seg.pEy);
                p2d.arc(seg.pEx, seg.pEy, seg.rE, 0, Math.PI * 2);
            }
        }
        return p2d;
    } catch (e) {
        return null;
    }
}

function renderRibbonSegsOnCtx(c, segs, path2d) {
    if (path2d && typeof CanvasRenderingContext2D === 'function' && c instanceof CanvasRenderingContext2D) {
        c.fill(path2d, 'nonzero');
        return;
    }
    for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        c.beginPath();
        traceRibbonSegmentToTarget(c, seg);
        c.fill('nonzero');
        if (seg.cuspCap) {
            c.beginPath();
            c.arc(seg.pEx, seg.pEy, seg.rE, 0, Math.PI * 2);
            c.fill('nonzero');
        }
    }
}

function buildCleanHighlighterSpine(pts, baseW = 14) {
    if (!Array.isArray(pts) || pts.length <= 2) return pts;
    const minDist = Math.max(2.6, Math.min(7.5, (baseW || 14) * 0.24));
    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];
    const clean = [{ x: pStart.x, y: pStart.y }];
    for (let i = 1; i < pts.length - 1; i++) {
        const prev = clean[clean.length - 1];
        if (Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y) >= minDist) {
            clean.push({ x: pts[i].x, y: pts[i].y });
        }
    }
    const lastPrev = clean[clean.length - 1];
    const tailD = Math.hypot(pEnd.x - lastPrev.x, pEnd.y - lastPrev.y);
    if (clean.length >= 2 && tailD < minDist * 0.55) {
        clean[clean.length - 1] = { x: pEnd.x, y: pEnd.y };
    } else if (tailD >= 0.2) {
        clean.push({ x: pEnd.x, y: pEnd.y });
    }
    if (clean.length <= 2) return clean;

    const passes = [0.36, 0.24];
    const m = clean.length;
    for (let p = 0; p < passes.length; p++) {
        const fac = passes[p];
        const snap = clean.map(q => ({ x: q.x, y: q.y }));
        for (let i = 1; i < m - 1; i++) {
            const a = snap[i - 1], b = snap[i], d = snap[i + 1];
            const la = Math.hypot(b.x - a.x, b.y - a.y);
            const lb = Math.hypot(d.x - b.x, d.y - b.y);
            const lSum = la + lb;
            if (lSum < 0.05) continue;
            const tx = (a.x * lb + d.x * la) / lSum;
            const ty = (a.y * lb + d.y * la) / lSum;
            clean[i].x = b.x + (tx - b.x) * fac;
            clean[i].y = b.y + (ty - b.y) * fac;
        }
    }
    return clean;
}

function drawSmoothInkStroke(c, st, paperIsDark = false) {
    const rawPts = st?.points || [];
    if (!rawPts.length) return;
    let pts = rawPts;
    const isHl = st.mode === 'highlighter';
    const baseW = st.width || (isHl ? 14 : 2.8);
    if (st.liveTip) {
        const tail = rawPts[rawPts.length - 1];
        const minTipDist = isHl ? Math.max(1.6, baseW * 0.12) : 0.15;
        if (Math.hypot(st.liveTip.x - tail.x, st.liveTip.y - tail.y) >= minTipDist) {
            pts = [...rawPts, st.liveTip];
        }
    }
    if (isHl && !st.snappedShape && pts.length >= 3) {
        pts = buildCleanHighlighterSpine(pts, baseW);
    }

    c.save();
    const col = st.color || (isHl ? '#fef08a' : '#0f172a');
    const baseOp = typeof st.opacity === 'number' ? st.opacity : 1;

    c.strokeStyle = col;
    c.fillStyle = col;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (st.mode === 'highlighter') {
        const rawHlA = Math.max(0.15, Math.min(0.75, typeof st.hlAlpha === 'number' ? st.hlAlpha : 0.50));
        const lum = getHexColorLuminance(col);
        if (!paperIsDark && lum >= 0.52) {
            // Hòa trộn Multiply chuẩn Notewise/Goodnotes: giữ chữ đen 100% sắc nét, màu dạ quang sáng rực không dìm chữ!
            c.globalCompositeOperation = 'multiply';
            c.globalAlpha = Math.max(0.28, Math.min(0.92, rawHlA * 1.48));
        } else if (!paperIsDark) {
            // Phòng trường hợp nét dạ quang cũ/màu tối: tự hạ độ đục nhẹ & vẽ dưới lớp chữ để không bao giờ lem chữ đen
            c.globalCompositeOperation = 'source-over';
            c.globalAlpha = Math.max(0.14, Math.min(0.38, rawHlA * 0.62));
        } else {
            // Giấy tối: giữ độ trong dịu & nằm dưới chữ sáng
            c.globalCompositeOperation = 'source-over';
            c.globalAlpha = Math.max(0.20, Math.min(0.55, rawHlA * 0.72));
        }
    } else {
        c.globalAlpha = baseOp;
    }

    if (pts.length === 1 || (pts.length === 2 && Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) < 0.2)) {
        c.beginPath();
        c.arc(pts[0].x, pts[0].y, Math.max(0.9, baseW * 0.5), 0, Math.PI * 2);
        c.fill();
        c.restore();
        return;
    }

    const style = st.penStyle || 'ballpoint';
    // Chỉ duy nhất Bút máy (fountain) có nét thanh – đậm; Bút bi (ballpoint), Bút lông & Nét đứt luôn đều nét 100%
    const isCalligraphic = style === 'fountain' && st.mode !== 'highlighter' && !st.snappedShape && baseOp >= 0.985;

    if (isCalligraphic) {
        const isLiveStroke = !!st.liveTip || (typeof currentInkStroke !== 'undefined' && st === currentInkStroke);
        const nibDeg = (st.nibAngle === 35 || st.nibAngle === 90)
            ? st.nibAngle
            : ((typeof appLibrary !== 'undefined' && appLibrary?.fountainNibAngle === 35) ? 35 : 90);
        const hasStrokeP = !!st.hasPressure;
        const cacheKey = !isLiveStroke && strokeRibbonCache
            ? (pts.length + '|' + baseW + '|' + style + '|' + nibDeg + '|' + (hasStrokeP ? 1 : 0))
            : '';
        if (cacheKey) {
            const cachedRibbon = strokeRibbonCache.get(st);
            if (cachedRibbon && cachedRibbon.key === cacheKey) {
                renderRibbonSegsOnCtx(c, cachedRibbon.segs, cachedRibbon.path2d);
                c.restore();
                return;
            }
        }

        // 1. Khử điểm trùng theo chiều dài cung — bảo toàn tuyệt đối mọi góc nhọn (tam giác, vuông, ngũ/lục giác) & đầu/đuôi nét
        const minCtrlDist = Math.max(1.0, Math.min(2.2, baseW * 0.55));
        const ctrlPts = [{ ...pts[0] }];
        for (let i = 1; i < pts.length - 1; i++) {
            const prev = ctrlPts[ctrlPts.length - 1];
            const dPrev = Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y);
            const v1x = pts[i].x - pts[i - 1].x, v1y = pts[i].y - pts[i - 1].y;
            const v2x = pts[i + 1].x - pts[i].x, v2y = pts[i + 1].y - pts[i].y;
            const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
            const isSharpRaw = l1 > 0.8 && l2 > 0.8 && ((v1x * v2x + v1y * v2y) / (l1 * l2)) < 0.62;
            if (dPrev >= minCtrlDist || isSharpRaw) {
                ctrlPts.push({ ...pts[i] });
            }
        }
        ctrlPts.push({ ...pts[pts.length - 1] });
        const nPts = ctrlPts.length;

        const isCusp = new Array(nPts).fill(false);
        for (let i = 1; i < nPts - 1; i++) {
            const v1x = ctrlPts[i].x - ctrlPts[i - 1].x, v1y = ctrlPts[i].y - ctrlPts[i - 1].y;
            const v2x = ctrlPts[i + 1].x - ctrlPts[i].x, v2y = ctrlPts[i + 1].y - ctrlPts[i].y;
            const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
            if (l1 > 1.2 && l2 > 1.2 && ((v1x * v2x + v1y * v2y) / (l1 * l2)) < 0.58) {
                isCusp[i] = true;
            }
        }
        if (nPts >= 4 && !st._preSmoothed) {
            // Chỉ làm mượt rất nhẹ khi chưa qua beautifyInkStrokePoints, tuyệt đối không làm tròn góc nhọn hay tụt đầu/đuôi
            const tPasses = isLiveStroke ? [0.18] : [0.22, -0.10];
            for (let pass = 0; pass < tPasses.length; pass++) {
                const fac = tPasses[pass];
                const snap = ctrlPts.map(q => ({ x: q.x, y: q.y }));
                for (let i = 2; i < nPts - 2; i++) {
                    if (isCusp[i]) continue;
                    const a = snap[i - 1], b = snap[i], d = snap[i + 1];
                    const la = Math.hypot(b.x - a.x, b.y - a.y);
                    const lb = Math.hypot(d.x - b.x, d.y - b.y);
                    const ls = la + lb;
                    if (ls < 0.05) continue;
                    const tx0 = (a.x * lb + d.x * la) / ls;
                    const ty0 = (a.y * lb + d.y * la) / ls;
                    ctrlPts[i].x = b.x + (tx0 - b.x) * fac;
                    ctrlPts[i].y = b.y + (ty0 - b.y) * fac;
                }
            }
        }

        // 2. Tính tốc độ cửa sổ trượt (>= 5.5px / >= 3ms) & áp lực mượt 2 chiều
        const ptSpeeds = new Array(nPts).fill(0.36);
        const ptPress = new Array(nPts).fill(0.42);
        const cumPtS = new Array(nPts).fill(0);
        for (let i = 0; i < nPts; i++) {
            const rawPi = (typeof ctrlPts[i].p === 'number' && Number.isFinite(ctrlPts[i].p) && ctrlPts[i].p > 0.01)
                ? ctrlPts[i].p : (i > 0 ? ptPress[i - 1] : 0.38);
            ptPress[i] = rawPi;
            if (i > 0) {
                cumPtS[i] = cumPtS[i - 1] + Math.hypot(ctrlPts[i].x - ctrlPts[i - 1].x, ctrlPts[i].y - ctrlPts[i - 1].y);
            }
        }
        if (nPts >= 3 && hasStrokeP) {
            ptPress[0] = Math.min(ptPress[0], ptPress[1] * 0.92);
            ptPress[nPts - 1] = Math.min(ptPress[nPts - 1], ptPress[nPts - 2] * 0.78);
        }
        for (let i = 1; i < nPts; i++) {
            let j = i - 1;
            while (j > 0 && (cumPtS[i] - cumPtS[j]) < 5.5 && (i - j) < 5) j--;
            const ds = cumPtS[i] - cumPtS[j];
            const t0 = ctrlPts[j].t, t1 = ctrlPts[i].t;
            if (typeof t0 === 'number' && typeof t1 === 'number' && (t1 - t0) >= 3.0) {
                ptSpeeds[i] = ds / (t1 - t0);
            } else {
                ptSpeeds[i] = ds / Math.max(8, (i - j) * 10.5);
            }
        }
        if (nPts > 1) ptSpeeds[0] = ptSpeeds[1];
        for (let pass = 0; pass < 2; pass++) {
            for (let i = 1; i < nPts; i++) {
                ptSpeeds[i] = ptSpeeds[i - 1] * 0.64 + ptSpeeds[i] * 0.36;
                ptPress[i] = ptPress[i - 1] * 0.58 + ptPress[i] * 0.42;
            }
            for (let i = nPts - 2; i >= 0; i--) {
                ptSpeeds[i] = ptSpeeds[i + 1] * 0.64 + ptSpeeds[i] * 0.36;
                ptPress[i] = ptPress[i + 1] * 0.58 + ptPress[i] * 0.42;
            }
        }

        // 3. Nội suy đường cong Centripetal Catmull-Rom bậc 3 (alpha = 0.5) chuẩn Notewise / Apple PencilKit
        const ecoOn = isBatterySaverActive();
        const stepPx = isLiveStroke
            ? (ecoOn ? Math.max(1.35, Math.min(2.1, baseW * 0.54)) : Math.max(1.05, Math.min(1.65, baseW * 0.42)))
            : Math.max(0.55, Math.min(1.0, baseW * 0.26));
        const spine = [{ x: ctrlPts[0].x, y: ctrlPts[0].y, spd: ptSpeeds[0], p: ptPress[0], s: 0, cusp: false }];
        let cumS = 0;
        let prevX = ctrlPts[0].x, prevY = ctrlPts[0].y;

        for (let i = 0; i < nPts - 1; i++) {
            const p1 = ctrlPts[i], p2 = ctrlPts[i + 1];
            const p0 = (i === 0 || isCusp[i]) ? { x: p1.x * 2 - p2.x, y: p1.y * 2 - p2.y } : ctrlPts[i - 1];
            const p3 = (i + 1 === nPts - 1 || isCusp[i + 1]) ? { x: p2.x * 2 - p1.x, y: p2.y * 2 - p1.y } : ctrlPts[i + 2];

            const d01 = Math.max(0.5, Math.hypot(p1.x - p0.x, p1.y - p0.y));
            const d12 = Math.max(0.5, Math.hypot(p2.x - p1.x, p2.y - p1.y));
            const d23 = Math.max(0.5, Math.hypot(p3.x - p2.x, p3.y - p2.y));
            const t0 = 0;
            const t1 = Math.sqrt(d01);
            const t2 = t1 + Math.sqrt(d12);
            const t3 = t2 + Math.sqrt(d23);
            const steps = Math.max(2, Math.min(40, Math.ceil(d12 / stepPx)));
            const sp0 = ptSpeeds[i], sp1 = ptSpeeds[i + 1];
            const pr0 = ptPress[i], pr1 = ptPress[i + 1];

            for (let k = 1; k <= steps; k++) {
                const u = k / steps;
                const tt = t1 + (t2 - t1) * u;
                const a1x = ((t1 - tt) * p0.x + (tt - t0) * p1.x) / (t1 - t0);
                const a1y = ((t1 - tt) * p0.y + (tt - t0) * p1.y) / (t1 - t0);
                const a2x = ((t2 - tt) * p1.x + (tt - t1) * p2.x) / (t2 - t1);
                const a2y = ((t2 - tt) * p1.y + (tt - t1) * p2.y) / (t2 - t1);
                const a3x = ((t3 - tt) * p2.x + (tt - t2) * p3.x) / (t3 - t2);
                const a3y = ((t3 - tt) * p2.y + (tt - t2) * p3.y) / (t3 - t2);
                const b1x = ((t2 - tt) * a1x + (tt - t0) * a2x) / (t2 - t0);
                const b1y = ((t2 - tt) * a1y + (tt - t0) * a2y) / (t2 - t0);
                const b2x = ((t3 - tt) * a2x + (tt - t1) * a3x) / (t3 - t1);
                const b2y = ((t3 - tt) * a2y + (tt - t1) * a3y) / (t3 - t1);
                const sx = ((t2 - tt) * b1x + (tt - t1) * b2x) / (t2 - t1);
                const sy = ((t2 - tt) * b1y + (tt - t1) * b2y) / (t2 - t1);
                const dd = Math.hypot(sx - prevX, sy - prevY);
                if (dd < 0.22 && !(i === nPts - 2 && k === steps) && !(k === steps && isCusp[i + 1])) continue;
                cumS += dd;
                spine.push({
                    x: sx, y: sy,
                    spd: sp0 + (sp1 - sp0) * u,
                    p: pr0 + (pr1 - pr0) * u,
                    s: cumS,
                    cusp: (k === steps && isCusp[i + 1])
                });
                prevX = sx; prevY = sy;
            }
        }

        // 4. Tính hướng tiếp tuyến mượt & độ dày Notewise thanh-đậm có khóa tốc độ biến thiên chống nổ mực
        const m = spine.length;
        if (m >= 2) {
            const totalLen = Math.max(0.01, cumS);
            const tx = new Array(m), ty = new Array(m), widths = new Array(m);
            for (let i = 0; i < m; i++) {
                const i0 = (i > 0 && !spine[i].cusp) ? i - 1 : i;
                const i1 = (i < m - 1) ? i + 1 : i;
                const dx = spine[i1].x - spine[i0].x;
                const dy = spine[i1].y - spine[i0].y;
                const dl = Math.hypot(dx, dy) || 1;
                tx[i] = dx / dl; ty[i] = dy / dl;
            }

            let sDirX = tx[0], sDirY = ty[0];
            widths[0] = computeNotewiseInkWidth(style, baseW, sDirX, sDirY, spine[0].spd, spine[0].p, 0, totalLen, nibDeg, hasStrokeP, isLiveStroke);
            for (let i = 1; i < m; i++) {
                const cosT = tx[i] * sDirX + ty[i] * sDirY;
                if (spine[i - 1].cusp || cosT < 0.35) {
                    sDirX = tx[i]; sDirY = ty[i];
                } else {
                    const nx = sDirX * 0.58 + tx[i] * 0.42;
                    const ny = sDirY * 0.58 + ty[i] * 0.42;
                    const nl = Math.hypot(nx, ny) || 1;
                    sDirX = nx / nl; sDirY = ny / nl;
                }
                widths[i] = computeNotewiseInkWidth(style, baseW, sDirX, sDirY, spine[i].spd, spine[i].p, spine[i].s, totalLen, nibDeg, hasStrokeP, isLiveStroke);
            }

            if (m > 2) {
                const maxSlope = 0.20;
                for (let i = 1; i < m; i++) {
                    const lim = maxSlope * Math.max(0.25, spine[i].s - spine[i - 1].s) + 0.008;
                    if (widths[i] > widths[i - 1] + lim) widths[i] = widths[i - 1] + lim;
                    else if (widths[i] < widths[i - 1] - lim) widths[i] = widths[i - 1] - lim;
                }
                for (let i = m - 2; i >= 0; i--) {
                    const lim = maxSlope * Math.max(0.25, spine[i + 1].s - spine[i].s) + 0.008;
                    if (widths[i] > widths[i + 1] + lim) widths[i] = widths[i + 1] + lim;
                    else if (widths[i] < widths[i + 1] - lim) widths[i] = widths[i + 1] - lim;
                }
                const wPrev = 0.54, wCur = 0.46;
                for (let i = 1; i < m - 1; i++) widths[i] = widths[i - 1] * wPrev + widths[i] * wCur;
                for (let i = m - 2; i >= 1; i--) widths[i] = widths[i + 1] * wPrev + widths[i] * wCur;
                const lim0 = maxSlope * Math.max(0.25, spine[1].s - spine[0].s) + 0.008;
                if (widths[0] > widths[1] + lim0) widths[0] = widths[1] + lim0;
                else if (widths[0] < widths[1] - lim0) widths[0] = widths[1] - lim0;
                const limLast = maxSlope * Math.max(0.25, spine[m - 1].s - spine[m - 2].s) + 0.008;
                if (widths[m - 1] > widths[m - 2] + limLast) widths[m - 1] = widths[m - 2] + limLast;
                else if (widths[m - 1] < widths[m - 2] - limLast) widths[m - 1] = widths[m - 2] - limLast;
            }

            // 5. Dựng dải Vector Calligraphy liền khối sắc nét chuẩn Retina + Cache Path2D tiết kiệm pin GPU tối đa!
            const builtSegs = [];
            let segStart = 0;
            for (let cut = 1; cut < m; cut++) {
                const isEnd = cut === m - 1;
                if (!spine[cut].cusp && !isEnd) continue;
                const subLen = cut - segStart + 1;
                if (subLen >= 2) {
                    const L = [], R = [];
                    for (let j = segStart; j <= cut; j++) {
                        let dx, dy;
                        if (j === segStart) { dx = spine[j + 1].x - spine[j].x; dy = spine[j + 1].y - spine[j].y; }
                        else if (j === cut) { dx = spine[j].x - spine[j - 1].x; dy = spine[j].y - spine[j - 1].y; }
                        else { dx = spine[j + 1].x - spine[j - 1].x; dy = spine[j + 1].y - spine[j - 1].y; }
                        const dl = Math.hypot(dx, dy) || 1;
                        const ux = dx / dl, uy = dy / dl;
                        const nx = -uy, ny = ux;
                        const r = widths[j] * 0.5;
                        let lx = spine[j].x + nx * r, ly = spine[j].y + ny * r;
                        let rx = spine[j].x - nx * r, ry = spine[j].y - ny * r;
                        if (L.length > 0) {
                            const prevL = L[L.length - 1], prevR = R[R.length - 1];
                            if ((lx - prevL.x) * ux + (ly - prevL.y) * uy < 0) { lx = prevL.x; ly = prevL.y; }
                            if ((rx - prevR.x) * ux + (ry - prevR.y) * uy < 0) { rx = prevR.x; ry = prevR.y; }
                        }
                        L.push({ x: lx, y: ly });
                        R.push({ x: rx, y: ry });
                    }
                    const p0 = spine[segStart], r0 = widths[segStart] * 0.5;
                    const pE = spine[cut], rE = widths[cut] * 0.5;
                    const aStart = Math.atan2(R[0].y - p0.y, R[0].x - p0.x);
                    const aEnd = Math.atan2(L[L.length - 1].y - pE.y, L[L.length - 1].x - pE.x);
                    builtSegs.push({
                        p0x: p0.x, p0y: p0.y, r0, aStart,
                        pEx: pE.x, pEy: pE.y, rE, aEnd,
                        L, R,
                        cuspCap: !!(spine[cut].cusp && !isEnd)
                    });
                }
                segStart = cut;
            }
            const p2d = cacheKey ? buildRibbonPath2DFromSegs(builtSegs) : null;
            if (cacheKey) {
                strokeRibbonCache.set(st, { key: cacheKey, segs: builtSegs, path2d: p2d });
            }
            renderRibbonSegsOnCtx(c, builtSegs, p2d);
            c.restore();
            return;
        }
    }

    if (style === 'dashed' && st.mode !== 'highlighter') {
        c.setLineDash([Math.max(4, baseW * 2.2), Math.max(4, baseW * 1.8)]);
    }

    c.lineWidth = baseW;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);

    if (pts.length === 2) {
        c.lineTo(pts[1].x, pts[1].y);
    } else if (st.snappedShape && st.snappedShape.type !== 'arc' && st.snappedShape.type !== 'circle' && st.snappedShape.type !== 'ellipse') {
        for (let i = 1; i < pts.length; i++) {
            c.lineTo(pts[i].x, pts[i].y);
        }
    } else {
        for (let i = 1; i < pts.length - 1; i++) {
            const pPrev = pts[i - 1], pCur = pts[i], pNext = pts[i + 1];
            const mx = (pCur.x + pNext.x) * 0.5;
            const my = (pCur.y + pNext.y) * 0.5;
            if (isHl) {
                c.quadraticCurveTo(pCur.x, pCur.y, mx, my);
            } else {
                const v1x = pCur.x - pPrev.x, v1y = pCur.y - pPrev.y;
                const v2x = pNext.x - pCur.x, v2y = pNext.y - pCur.y;
                const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
                if (l1 > 1.2 && l2 > 1.2 && ((v1x * v2x + v1y * v2y) / (l1 * l2)) < 0.62) {
                    c.lineTo(pCur.x, pCur.y);
                    c.lineTo(mx, my);
                } else {
                    c.quadraticCurveTo(pCur.x, pCur.y, mx, my);
                }
            }
        }
        const last = pts[pts.length - 1];
        c.lineTo(last.x, last.y);
    }
    c.stroke();
    if (st.snappedShape && st.snappedShape.type === 'carbon_chain') {
        c.setLineDash([]);
        for (let i = 0; i < pts.length; i++) {
            c.beginPath();
            c.arc(pts[i].x, pts[i].y, Math.max(2.2, baseW * 0.85), 0, Math.PI * 2);
            c.fill();
        }
    }
    c.restore();
}

const REVERSED_SUBSTITUENT_LABELS = {
    OH: 'HO',
    NH2: 'H2N',
    SH: 'HS',
    COOH: 'HOOC',
    CO2H: 'HO2C',
    CHO: 'OHC',
    NO2: 'O2N',
    CN: 'NC',
    OMe: 'MeO',
    OCH3: 'H3CO',
    OEt: 'EtO',
    OC2H5: 'H5C2O',
    OAc: 'AcO',
    CF3: 'F3C',
    CH2OH: 'HOCH2',
    CONH2: 'H2NOC',
    SO3H: 'HO3S',
    CH3: 'H3C',
    C2H5: 'H5C2',
    NH: 'HN',
    COOCH3: 'H3COOC',
    COOC2H5: 'H5C2OOC'
};

function getOrientedAtomDisplayLabel(a, doc, atomByIdOpt = null, adjAtomsByAtomIdOpt = null) {
    if (!a || !a.label || a.label === 'C') return a?.label || '';
    const rev = REVERSED_SUBSTITUENT_LABELS[a.label];
    if (!rev) return a.label;
    let neighbors;
    if (adjAtomsByAtomIdOpt) {
        neighbors = adjAtomsByAtomIdOpt.get(a.id) || [];
    } else {
        const atomById = atomByIdOpt || new Map((doc.atoms || []).map(at => [at.id, at]));
        neighbors = [];
        (doc.bonds || []).forEach(b => {
            if (b.a1 === a.id) {
                const nb = atomById.get(b.a2);
                if (nb) neighbors.push(nb);
            } else if (b.a2 === a.id) {
                const nb = atomById.get(b.a1);
                if (nb) neighbors.push(nb);
            }
        });
    }
    if (!neighbors.length) return a.label;
    const avgDx = neighbors.reduce((s, nb) => s + (nb.x - a.x), 0) / neighbors.length;
    if (avgDx > 6 && neighbors.every(nb => nb.x >= a.x - 2)) return rev;
    return a.label;
}

function computeSmartMechArrowControlPoint(ma, doc = null, dragBiasOverride = null) {
    const mx = (ma.x1 + ma.x2) / 2, my = (ma.y1 + ma.y2) / 2;
    const dx = ma.x2 - ma.x1, dy = ma.y2 - ma.y1;
    const len = Math.hypot(dx, dy);
    if (len < 4) return { x: mx, y: my - 12 };
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const targetDoc = doc || (typeof getDocState === 'function' ? getDocState() : null);
    const isLoop = (ma.type || '').includes('180');
    const explicitNeg = (ma.type || '').includes('neg');
    const dragBias = typeof dragBiasOverride === 'number'
        ? dragBiasOverride
        : (typeof ma.dragBias === 'number' ? ma.dragBias : 0);

    const atoms = targetDoc?.atoms || [];
    const atomById = new Map(atoms.map(a => [a.id, a]));
    const bonds = targetDoc?.bonds || [];
    const texts = targetDoc?.texts || [];
    const arrows = targetDoc?.arrows || [];
    const orbitals = targetDoc?.orbitals || [];
    const symbols = targetDoc?.chemSymbols || [];
    const otherMechArrows = (targetDoc?.mechArrows || []).filter(m => m !== ma && m.id !== ma.id);

    // Local neighborhood centroid (helps curve cleanly OUTWARD away from rings & dense molecule interiors)
    let sumCx = 0, sumCy = 0, nearCnt = 0;
    const neighRad = Math.max(100, len * 1.45);
    for (let i = 0; i < atoms.length; i++) {
        const a = atoms[i];
        if (Math.hypot(a.x - mx, a.y - my) <= neighRad) {
            sumCx += a.x; sumCy += a.y; nearCnt++;
        }
    }
    const hasCentroid = nearCnt >= 2;
    const centX = hasCentroid ? sumCx / nearCnt : mx;
    const centY = hasCentroid ? sumCy / nearCnt : my;

    const segDist = (px, py, x1, y1, x2, y2) => {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 <= 1e-4) return Math.hypot(px - x1, py - y1);
        const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    };

    const depths = isLoop ? [0.85, 1.15, 1.42] : [0.54, 0.72, 0.94];
    const shifts = [0, -0.06, 0.06];
    let bestCtrl = { x: mx + nx * len * 0.68 * (explicitNeg ? 1 : -1), y: my + ny * len * 0.68 * (explicitNeg ? 1 : -1) };
    let bestScore = Infinity;

    for (const side of [-1, 1]) {
        for (let di = 0; di < depths.length; di++) {
            const perpRatio = side * depths[di];
            for (let si = 0; si < shifts.length; si++) {
                const along = shifts[si];
                const cx = mx + ux * len * along + nx * len * perpRatio;
                const cy = my + uy * len * along + ny * len * perpRatio;
                let score = 0;

                // Evaluate curve interior points (skip exact start/end tips)
                for (let k = 1; k <= 7; k++) {
                    const t = k / 8;
                    const mt = 1 - t;
                    const px = mt * mt * ma.x1 + 2 * mt * t * cx + t * t * ma.x2;
                    const py = mt * mt * ma.y1 + 2 * mt * t * cy + t * t * ma.y2;

                    for (let i = 0; i < atoms.length; i++) {
                        const a = atoms[i];
                        if (Math.hypot(a.x - ma.x1, a.y - ma.y1) < 12 || Math.hypot(a.x - ma.x2, a.y - ma.y2) < 12) continue;
                        const d = Math.hypot(px - a.x, py - a.y);
                        const safeR = (a.label && a.label !== 'C') ? 26 : 18;
                        if (d < safeR) score += Math.pow((safeR - d) / safeR, 2) * 145;
                    }

                    if (k >= 2 && k <= 6) {
                        for (let i = 0; i < bonds.length; i++) {
                            const b = bonds[i];
                            const a1 = atomById.get(b.a1), a2 = atomById.get(b.a2);
                            if (!a1 || !a2) continue;
                            const d = segDist(px, py, a1.x, a1.y, a2.x, a2.y);
                            if (d < 15) {
                                score += Math.pow((15 - d) / 15, 2) * 115;
                                if (d < 4.5) score += 120;
                            }
                        }
                    }

                    for (let i = 0; i < texts.length; i++) {
                        const tx = texts[i];
                        const d = Math.hypot(px - tx.x, py - tx.y);
                        if (d < 28) score += Math.pow((28 - d) / 28, 2) * 105;
                    }
                    for (let i = 0; i < orbitals.length; i++) {
                        const ob = orbitals[i];
                        const safeO = Math.max(20, (ob.scale || 36) * 0.65);
                        const d = Math.hypot(px - ob.x, py - ob.y);
                        if (d < safeO) score += Math.pow((safeO - d) / safeO, 2) * 90;
                    }
                    for (let i = 0; i < symbols.length; i++) {
                        const sm = symbols[i];
                        const d = Math.hypot(px - sm.x, py - sm.y);
                        if (d < 20) score += Math.pow((20 - d) / 20, 2) * 85;
                    }
                    for (let i = 0; i < arrows.length; i++) {
                        const ar = arrows[i];
                        const d = segDist(px, py, ar.x1, ar.y1, ar.x2, ar.y2);
                        if (d < 18) score += Math.pow((18 - d) / 18, 2) * 85;
                    }
                    for (let i = 0; i < otherMechArrows.length; i++) {
                        const om = otherMechArrows[i];
                        const omApexX = (om.x1 + om.x2) * 0.25 + (typeof om.cpx === 'number' ? om.cpx : (om.x1 + om.x2) * 0.5) * 0.5;
                        const omApexY = (om.y1 + om.y2) * 0.25 + (typeof om.cpy === 'number' ? om.cpy : (om.y1 + om.y2) * 0.5) * 0.5;
                        const d = Math.hypot(px - omApexX, py - omApexY);
                        if (d < 18) score += Math.pow((18 - d) / 18, 2) * 65;
                    }
                }

                // Apex point aesthetic heuristics
                const apexX = 0.25 * ma.x1 + 0.5 * cx + 0.25 * ma.x2;
                const apexY = 0.25 * ma.y1 + 0.5 * cy + 0.25 * ma.y2;
                if (hasCentroid) {
                    const outDot = (apexX - centX) * (nx * side) + (apexY - centY) * (ny * side);
                    if (outDot > 0) score -= 28;
                    else score += 26;
                }
                if (Math.abs(dragBias) > 8) {
                    score += (Math.sign(side) === Math.sign(dragBias)) ? -75 : 75;
                } else if (explicitNeg) {
                    score += (side === 1) ? -10 : 10;
                } else {
                    // Gently prefer upward arch in open horizontal space when no obstacles dictate direction
                    const isHorizontalish = Math.abs(dy) < Math.abs(dx) * 0.8;
                    if (isHorizontalish && apexY < my) score -= 6;
                }

                // Favor moderate, harmonious curvature & symmetry unless obstacle evasion needs deeper arch
                score += di * 11;
                if (si !== 0) score += 7;

                if (score < bestScore) {
                    bestScore = score;
                    bestCtrl = { x: cx, y: cy };
                }
            }
        }
    }
    return bestCtrl;
}

function getMechArrowControlPoint(ma, doc = null) {
    if (typeof ma.cpx === 'number' && typeof ma.cpy === 'number') {
        return { x: ma.cpx, y: ma.cpy };
    }
    return computeSmartMechArrowControlPoint(ma, doc);
}

function drawPageContentOnContext(c, doc, page, isInteractiveActivePage, isAudienceClean = false, includeCurrentInk = true, visBounds = null) {
    // 0. Hình ảnh gắn trên giấy
    (doc.images || []).forEach(im => {
        let el = imageObjCache.get(im.id);
        if (!el) {
            el = new Image();
            imageObjCache.set(im.id, el);
            el.onload = () => {
                if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
                renderAll();
            };
            el.src = im.src;
        }
        if (el.complete && el.naturalWidth > 0) {
            c.save();
            c.imageSmoothingEnabled = true;
            c.imageSmoothingQuality = 'high';
            c.drawImage(el, im.x, im.y, im.w, im.h);
            if (isInteractiveActivePage && !isAudienceClean && (activeImageSelection.id === im.id || (window.unifiedTool === 'pen_image' && im.locked))) {
                const isSel = activeImageSelection.id === im.id;
                c.strokeStyle = im.locked ? '#f59e0b' : '#38bdf8';
                c.lineWidth = isSel ? 2 : 1.3;
                c.setLineDash([6, 4]);
                c.strokeRect(im.x, im.y, im.w, im.h);
                c.setLineDash([]);
                if (im.locked) {
                    const bx = im.x + 6, by = im.y + 6;
                    c.fillStyle = 'rgba(15, 23, 42, 0.84)';
                    c.strokeStyle = 'rgba(251, 191, 36, 0.8)';
                    c.lineWidth = 1.2;
                    c.beginPath();
                    if (typeof c.roundRect === 'function') c.roundRect(bx, by, 76, 20, 6);
                    else c.rect(bx, by, 76, 20);
                    c.fill(); c.stroke();
                    c.fillStyle = '#fde68a';
                    c.font = '700 10px Inter, sans-serif';
                    c.textBaseline = 'middle';
                    c.textAlign = 'left';
                    c.fillText('🔒 Cố định', bx + 7, by + 10.5);
                } else if (isSel) {
                    c.fillStyle = '#0ea5e9';
                    c.beginPath(); c.arc(im.x + im.w, im.y + im.h, 9, 0, Math.PI * 2); c.fill();
                    c.strokeStyle = '#ffffff'; c.lineWidth = 1.8; c.stroke();
                }
            }
            c.restore();
        }
    });

    // 1A. Lớp Bút Dạ Quang (LUÔN vẽ DƯỚI nét mực, chữ & công thức hóa học để không bao giờ dìm chữ đen hay làm lem nét!)
    const pageIsDark = !!(typeof getPagePaperConfig === 'function'
        ? getPagePaperConfig(page).isDark
        : (page && page.template === 'dark_grid'));
    const useCull = visBounds && typeof getStrokeBounds === 'function';
    const committedStrokes = doc.inkStrokes || [];
    for (let i = 0; i < committedStrokes.length; i++) {
        const st = committedStrokes[i];
        if (!st || st.mode !== 'highlighter') continue;
        if (useCull) {
            const b = getStrokeBounds(st);
            if (b && (b.maxY + 24 < visBounds.minY || b.minY - 24 > visBounds.maxY)) continue;
        }
        drawSmoothInkStroke(c, st, pageIsDark);
    }
    if (includeCurrentInk && isInteractiveActivePage && currentInkStroke && currentInkStroke.mode === 'highlighter') {
        drawSmoothInkStroke(c, currentInkStroke, pageIsDark);
    }

    // 1B. Lớp Nét Mực chính (Nằm TRÊN dạ quang -> chữ viết tay luôn đen sắc nét 100%)
    for (let i = 0; i < committedStrokes.length; i++) {
        const st = committedStrokes[i];
        if (!st || st.mode === 'highlighter') continue;
        if (useCull) {
            const b = getStrokeBounds(st);
            if (b && (b.maxY + 24 < visBounds.minY || b.minY - 24 > visBounds.maxY)) continue;
        }
        drawSmoothInkStroke(c, st, pageIsDark);
    }
    if (includeCurrentInk && isInteractiveActivePage && currentInkStroke && currentInkStroke.mode !== 'highlighter') {
        drawSmoothInkStroke(c, currentInkStroke, pageIsDark);
    }

    // 2. Liên kết C-C (Nét đôi chuẩn ChemDraw không hở góc vòng)
    const atomById = new Map();
    (doc.atoms || []).forEach(a => atomById.set(a.id, a));
    const adjAtomsByAtomId = new Map();
    (doc.bonds || []).forEach(b => {
        const a1 = atomById.get(b.a1);
        const a2 = atomById.get(b.a2);
        if (!a1 || !a2) return;
        if (!adjAtomsByAtomId.has(a1.id)) adjAtomsByAtomId.set(a1.id, []);
        if (!adjAtomsByAtomId.has(a2.id)) adjAtomsByAtomId.set(a2.id, []);
        adjAtomsByAtomId.get(a1.id).push(a2);
        adjAtomsByAtomId.get(a2.id).push(a1);
    });

    // Phát hiện tâm Allene (=C=) để vẽ C=C=C thành =·= chuẩn hóa học
    const bondsByAtomId = new Map();
    (doc.bonds || []).forEach(b => {
        if (!bondsByAtomId.has(b.a1)) bondsByAtomId.set(b.a1, []);
        if (!bondsByAtomId.has(b.a2)) bondsByAtomId.set(b.a2, []);
        bondsByAtomId.get(b.a1).push(b);
        bondsByAtomId.get(b.a2).push(b);
    });
    const alleneAtomIds = new Set();
    (doc.atoms || []).forEach(a => {
        if (a.label && a.label !== 'C') return;
        const bs = bondsByAtomId.get(a.id) || [];
        if (bs.length === 2 && !bs[0].stereo && !bs[1].stereo && bs[0].order === 2 && bs[1].order === 2) {
            alleneAtomIds.add(a.id);
        }
    });

    (doc.bonds || []).forEach(b => {
        const a1 = atomById.get(b.a1);
        const a2 = atomById.get(b.a2);
        if (!a1 || !a2) return;
        c.save();
        if (isInteractiveActivePage && !isAudienceClean && typeof selectedBondId !== 'undefined' && selectedBondId === b.id) {
            c.save();
            c.strokeStyle = 'rgba(56, 189, 248, 0.42)';
            c.lineWidth = 7;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(a1.x, a1.y); c.lineTo(a2.x, a2.y);
            c.stroke();
            c.restore();
        }
        const col = b.color || '#0f172a';
        const dx = a2.x - a1.x, dy = a2.y - a1.y, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const bScale = Math.max(0.62, Math.min(1.42, len / 44));
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Number((2.02 * Math.sqrt(bScale)).toFixed(2)); c.lineCap = 'round'; c.lineJoin = 'round';
        if (b.stereo === 'wedge') {
            const wHalf = 5.2 * bScale;
            c.beginPath();
            c.moveTo(a1.x, a1.y);
            c.lineTo(a2.x + nx * wHalf, a2.y + ny * wHalf);
            c.lineTo(a2.x - nx * wHalf, a2.y - ny * wHalf);
            c.closePath(); c.fill();
        } else if (b.stereo === 'dash') {
            const dHalfMax = 5.2 * bScale;
            for (let i = 1; i <= 6; i++) {
                const t = i / 6, w = t * dHalfMax;
                const px = a1.x + dx * t, py = a1.y + dy * t;
                c.beginPath(); c.moveTo(px - nx * w, py - ny * w); c.lineTo(px + nx * w, py + ny * w); c.stroke();
            }
        } else if (b.order === 2) {
            const hasAlleneEnd = alleneAtomIds.has(a1.id) || alleneAtomIds.has(a2.id);
            const nbs1 = (adjAtomsByAtomId.get(a1.id) || []).filter(nb => nb.id !== a2.id);
            const nbs2 = (adjAtomsByAtomId.get(a2.id) || []).filter(nb => nb.id !== a1.id);
            const isHet1 = !!(a1.label && a1.label !== 'C');
            const isHet2 = !!(a2.label && a2.label !== 'C');
            const isInternalCarbonAlkene = !hasAlleneEnd && !isHet1 && !isHet2 && nbs1.length >= 1 && nbs2.length >= 1;

            if (isInternalCarbonAlkene) {
                const neighbors = [...nbs1, ...nbs2];
                const mx = (a1.x + a2.x) / 2, my = (a1.y + a2.y) / 2;
                const avgX = neighbors.reduce((s, a) => s + a.x, 0) / neighbors.length;
                const avgY = neighbors.reduce((s, a) => s + a.y, 0) / neighbors.length;
                const side = ((avgX - mx) * nx + (avgY - my) * ny) >= 0 ? 1 : -1;
                const inset = 5.0 * bScale * side;
                const trim = 0.14;
                c.beginPath();
                c.moveTo(a1.x, a1.y);
                c.lineTo(a2.x, a2.y);
                c.moveTo(a1.x + dx * trim + nx * inset, a1.y + dy * trim + ny * inset);
                c.lineTo(a2.x - dx * trim + nx * inset, a2.y - dy * trim + ny * inset);
                c.stroke();
            } else {
                const dOff = 2.42 * bScale;
                const ext1 = (!isHet1 && nbs1.length >= 1) ? -0.04 : 0;
                const ext2 = (!isHet2 && nbs2.length >= 1) ? 0.04 : 0;
                const sx1 = a1.x + dx * ext1, sy1 = a1.y + dy * ext1;
                const sx2 = a2.x + dx * ext2, sy2 = a2.y + dy * ext2;
                c.beginPath();
                c.moveTo(sx1 + nx * dOff, sy1 + ny * dOff); c.lineTo(sx2 + nx * dOff, sy2 + ny * dOff);
                c.moveTo(sx1 - nx * dOff, sy1 - ny * dOff); c.lineTo(sx2 - nx * dOff, sy2 - ny * dOff);
                c.stroke();
            }
        } else if (b.order === 3) {
            const tOff = 4.1 * bScale;
            c.beginPath();
            c.moveTo(a1.x, a1.y); c.lineTo(a2.x, a2.y);
            c.moveTo(a1.x + nx * tOff, a1.y + ny * tOff); c.lineTo(a2.x + nx * tOff, a2.y + ny * tOff);
            c.moveTo(a1.x - nx * tOff, a1.y - ny * tOff); c.lineTo(a2.x - nx * tOff, a2.y - ny * tOff);
            c.stroke();
        } else {
            c.beginPath(); c.moveTo(a1.x, a1.y); c.lineTo(a2.x, a2.y); c.stroke();
        }
        c.restore();
    });

    // 3. Nhãn nguyên tử, chấm tâm Allene (=·=) & nhóm thế (tỷ lệ theo độ dài C–C & căn chuẩn ChemDraw)
    const pagePaperBg = typeof getPagePaperConfig === 'function'
        ? getPagePaperConfig(page).bgColor
        : (page.template === 'dark_grid' ? '#111827' : '#fcfaf2');
    alleneAtomIds.forEach(aid => {
        const a = atomById.get(aid);
        if (!a) return;
        c.save();
        c.fillStyle = pagePaperBg;
        c.beginPath(); c.arc(a.x, a.y, 4.8, 0, Math.PI * 2); c.fill();
        c.fillStyle = a.color || '#0f172a';
        c.beginPath(); c.arc(a.x, a.y, 2.55, 0, Math.PI * 2); c.fill();
        c.restore();
    });
    const curGlobalBondLen = (typeof BOND_LENGTH === 'number' && BOND_LENGTH > 0) ? BOND_LENGTH : 44;
    (doc.atoms || []).forEach(a => {
        if (!a.label || a.label === 'C') return;
        const dispLabel = getOrientedAtomDisplayLabel(a, doc, atomById, adjAtomsByAtomId);
        const neighbors = adjAtomsByAtomId.get(a.id) || [];
        let refBondLen = curGlobalBondLen;
        if (neighbors.length > 0) {
            let sumD = 0;
            for (let ni = 0; ni < neighbors.length; ni++) {
                sumD += Math.hypot(neighbors[ni].x - a.x, neighbors[ni].y - a.y);
            }
            const avgD = sumD / neighbors.length;
            if (avgD >= 10) {
                refBondLen = avgD;
            }
        }
        const fontSize = Math.max(7.2, Math.min(24, Number((refBondLen * 0.318).toFixed(1))));
        c.save();
        const { totalW } = measureSubscriptedParts(c, dispLabel, fontSize);
        let drawCenterX = a.x;
        if (neighbors.length === 1 && dispLabel.length >= 2) {
            const dxNb = neighbors[0].x - a.x;
            c.font = `700 ${fontSize}px Inter, sans-serif`;
            if (dxNb < -5) {
                // Liên kết tới từ bên trái -> đặt tâm chữ cái đầu (C/O/N/S...) đúng đỉnh nguyên tử
                const firstW = typeof c.measureText === 'function' ? c.measureText(dispLabel[0]).width : fontSize * 0.65;
                drawCenterX = a.x + Math.max(0, (totalW - firstW) * 0.5);
            } else if (dxNb > 5) {
                // Liên kết tới từ bên phải -> nhãn đảo sẵn (HOOC, H2N, HO...) đặt chữ cái nguyên tử cuối đúng đỉnh
                const upperMatch = dispLabel.match(/[A-Z](?![a-z]*[A-Z])/);
                const anchorCh = upperMatch ? upperMatch[0] : dispLabel[dispLabel.length - 1];
                const tailW = typeof c.measureText === 'function' ? c.measureText(anchorCh).width : fontSize * 0.65;
                drawCenterX = a.x - Math.max(0, (totalW - tailW) * 0.5);
            }
        }
        c.fillStyle = pagePaperBg;
        const rx = Math.max(fontSize * 0.48, totalW * 0.54 + fontSize * 0.16);
        const ry = Math.max(4.4, fontSize * 0.62);
        c.beginPath(); c.ellipse(drawCenterX, a.y, rx, ry, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = a.color || '#0f172a';
        c.textBaseline = 'middle';
        drawSubscriptedTextOnCtx(c, dispLabel, drawCenterX, a.y, fontSize, 'center');
        c.restore();
    });

    // 3b. Bộ Dụng cụ Thí nghiệm Hóa học vector (đặt trước nhãn để dễ chú thích)
    (doc.labItems || []).forEach(lb => drawLabEquipmentOnCtx(c, lb));

    // 3c. Mô phỏng Phòng Thí nghiệm trên Giấy Trắng (vẽ vào bảng phụ / ảnh xuất)
    if ((isAudienceClean || c !== ctx) && Array.isArray(doc.labWidgets) && doc.labWidgets.length && typeof drawPaperLabWidgetOnExportCtx === 'function') {
        doc.labWidgets.forEach(lw => drawPaperLabWidgetOnExportCtx(c, lw));
    }

    // 4. Mũi tên phản ứng (Đầu mũi tên ChemDraw sắc nét, cân đối)
    (doc.arrows || []).forEach(ar => {
        c.save();
        const col = ar.color || '#0f172a';
        const isBold = ar.type === 'bold';
        const lw = isBold ? 3.4 : 2.05;
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw;
        c.lineCap = 'round'; c.lineJoin = 'round';
        const dx = ar.x2 - ar.x1, dy = ar.y2 - ar.y1, ang = Math.atan2(dy, dx), len = Math.hypot(dx, dy);
        if (len < 4) { c.restore(); return; }
        c.translate(ar.x1, ar.y1); c.rotate(ang);
        const hL = isBold ? 14 : 11.5;
        const hW = isBold ? 5.6 : 4.4;
        const hNeck = isBold ? 10.2 : 8.4;

        if (ar.type === 'dashed') c.setLineDash([5, 4]);
        if (ar.type === 'equilibrium' || ar.type === 'eq_fwd') {
            const topL = len, botL = ar.type === 'eq_fwd' ? len * 0.65 : len;
            const botX = (len - botL) / 2;
            c.beginPath(); c.moveTo(0, -3.4); c.lineTo(topL - 2, -3.4); c.stroke();
            c.beginPath(); c.moveTo(topL, -3.4); c.lineTo(topL - 10, -7.8); c.lineTo(topL - 7.4, -3.4); c.closePath(); c.fill();
            c.beginPath(); c.moveTo(botX + botL, 3.4); c.lineTo(botX + 2, 3.4); c.stroke();
            c.beginPath(); c.moveTo(botX, 3.4); c.lineTo(botX + 10, 7.8); c.lineTo(botX + 7.4, 3.4); c.closePath(); c.fill();
        } else if (ar.type === 'retro') {
            c.beginPath();
            c.moveTo(0, -3.4); c.lineTo(len - 5.5, -3.4);
            c.moveTo(0, 3.4); c.lineTo(len - 5.5, 3.4);
            c.moveTo(len - 10.5, -7.4); c.lineTo(len, 0); c.lineTo(len - 10.5, 7.4);
            c.stroke();
        } else {
            const shaftStart = ar.type === 'resonance' ? hNeck : 0;
            const shaftEnd = Math.max(shaftStart, len - hNeck);
            c.beginPath(); c.moveTo(shaftStart, 0); c.lineTo(shaftEnd, 0); c.stroke();
            c.setLineDash([]);
            c.beginPath();
            c.moveTo(len, 0); c.lineTo(len - hL, -hW); c.lineTo(len - hNeck, 0); c.lineTo(len - hL, hW);
            c.closePath(); c.fill();
            if (ar.type === 'resonance') {
                c.beginPath();
                c.moveTo(0, 0); c.lineTo(hL, -hW); c.lineTo(hNeck, 0); c.lineTo(hL, hW);
                c.closePath(); c.fill();
            }
            if (ar.type === 'no_rxn') {
                c.beginPath(); c.moveTo(len/2 - 6, -7); c.lineTo(len/2 + 6, 7); c.moveTo(len/2 + 6, -7); c.lineTo(len/2 - 6, 7); c.stroke();
            }
        }
        c.restore();
    });

    // 5. Mũi tên cong cơ chế
    (doc.mechArrows || []).forEach(ma => {
        c.save();
        const col = ma.color || '#e11d48';
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.05;
        c.lineCap = 'round'; c.lineJoin = 'round';
        const ctrl = getMechArrowControlPoint(ma, doc);
        c.beginPath(); c.moveTo(ma.x1, ma.y1); c.quadraticCurveTo(ctrl.x, ctrl.y, ma.x2, ma.y2); c.stroke();
        const ang = Math.atan2(ma.y2 - ctrl.y, ma.x2 - ctrl.x);
        c.translate(ma.x2, ma.y2); c.rotate(ang);
        if ((ma.type || '').startsWith('1e')) {
            c.beginPath(); c.moveTo(0, 0); c.lineTo(-9.5, -5.2); c.stroke();
        } else {
            c.beginPath(); c.moveTo(0, 0); c.lineTo(-9.5, -4.6); c.lineTo(-7.2, 0); c.lineTo(-9.5, 4.6); c.closePath(); c.fill();
        }
        c.restore();
    });

    // 6. Vân đạo Orbital
    (doc.orbitals || []).forEach(ob => {
        c.save();
        c.translate(ob.x, ob.y); c.rotate(ob.angle || 0);
        const s = ob.scale || 36, col = ob.color || '#0f172a';
        c.strokeStyle = col; c.lineWidth = 1.7;
        const drawLobe = (dirY, len, w, shaded) => {
            c.beginPath(); c.moveTo(0, 0);
            c.bezierCurveTo(-w, dirY * len * 0.55, -w * 0.85, dirY * len, 0, dirY * len);
            c.bezierCurveTo(w * 0.85, dirY * len, w, dirY * len * 0.55, 0, 0);
            c.closePath();
            c.fillStyle = shaded ? col : '#ffffff'; c.fill(); c.stroke();
        };
        if (ob.type === 's_open' || ob.type === 's_shaded') {
            c.beginPath(); c.arc(0, 0, s * 0.5, 0, Math.PI * 2);
            c.fillStyle = ob.type === 's_shaded' ? col : '#ffffff'; c.fill(); c.stroke();
        } else if (ob.type.startsWith('p_')) {
            drawLobe(-1, s, s * 0.44, ob.type === 'p_top_shaded');
            drawLobe(1, s, s * 0.44, ob.type === 'p_bot_shaded');
        } else if (ob.type === 'hyb_top_shaded') {
            drawLobe(-1, s * 1.15, s * 0.48, true);
            drawLobe(1, s * 0.42, s * 0.22, false);
        } else if (ob.type === 'dz2_shaded') {
            drawLobe(-1, s, s * 0.4, true); drawLobe(1, s, s * 0.4, true);
            c.beginPath(); c.ellipse(0, 0, s * 0.46, s * 0.16, 0, 0, Math.PI * 2);
            c.fillStyle = '#ffffff'; c.fill(); c.stroke();
        } else if (ob.type === 'd4_alt') {
            for (let k = 0; k < 4; k++) {
                c.save(); c.rotate((k * Math.PI) / 2);
                drawLobe(-1, s * 0.9, s * 0.36, k % 2 === 0);
                c.restore();
            }
        }
        c.restore();
    });

    // 7. Điện tích, Gốc tự do & Vòng tròn Newman
    (doc.chemSymbols || []).forEach(sm => {
        c.save();
        c.translate(sm.x, sm.y); c.rotate(sm.angle || 0);
        const col = sm.color || '#0f172a';
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.8;
        if (sm.type === 'plus_circle' || sm.type === 'minus_circle') {
            c.fillStyle = '#ffffff';
            c.beginPath(); c.arc(0, 0, 9.5, 0, Math.PI * 2); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0);
            if (sm.type === 'plus_circle') { c.moveTo(0, -5); c.lineTo(0, 5); }
            c.stroke();
        } else if (sm.type === 'plus_plain' || sm.type === 'minus_plain') {
            c.lineWidth = 2.2;
            c.beginPath(); c.moveTo(-5.5, 0); c.lineTo(5.5, 0);
            if (sm.type === 'plus_plain') { c.moveTo(0, -5.5); c.lineTo(0, 5.5); }
            c.stroke();
        } else if (sm.type === 'lone_pair') {
            c.beginPath(); c.arc(-5, -14, 2.3, 0, Math.PI * 2); c.arc(5, -14, 2.3, 0, Math.PI * 2); c.fill();
        } else if (sm.type === 'radical') {
            c.beginPath(); c.arc(0, -14, 2.6, 0, Math.PI * 2); c.fill();
        } else if (sm.type === 'rad_plus' || sm.type === 'rad_minus') {
            c.beginPath(); c.arc(-6, -14, 2.4, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.moveTo(1, -14); c.lineTo(9, -14);
            if (sm.type === 'rad_plus') { c.moveTo(5, -18); c.lineTo(5, -10); }
            c.stroke();
        } else if (sm.type === 'newman_stag' || sm.type === 'newman_eclip') {
            const R = 20, L = 40;
            const backShift = sm.type === 'newman_stag' ? Math.PI / 3 : 0.24;
            for (let k = 0; k < 3; k++) {
                const ang = -Math.PI / 2 + backShift + (sm.backRotation || 0) + k * (2 * Math.PI / 3);
                c.beginPath(); c.moveTo(R * Math.cos(ang), R * Math.sin(ang)); c.lineTo(L * Math.cos(ang), L * Math.sin(ang)); c.stroke();
            }
            c.fillStyle = pagePaperBg;
            c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill(); c.stroke();
            for (let k = 0; k < 3; k++) {
                const ang = -Math.PI / 2 + k * (2 * Math.PI / 3);
                c.beginPath(); c.moveTo(0, 0); c.lineTo(L * Math.cos(ang), L * Math.sin(ang)); c.stroke();
            }
        }
        c.restore();
    });

    // 8. Chữ điều kiện phản ứng
    (doc.texts || []).forEach(t => {
        c.save();
        c.fillStyle = t.color || '#0f172a';
        c.textBaseline = 'middle';
        drawSubscriptedTextOnCtx(c, t.text, t.x, t.y, t.size || 14, 'center');
        c.restore();
    });

    // 8b. Ngoặc vuông trạng thái chuyển tiếp [ ... ]‡
    (doc.brackets || []).forEach(br => {
        c.save();
        const col = br.color || '#0f172a';
        const x = br.x, y = br.y, w = br.w, h = br.h;
        const arm = Math.max(8, Math.min(18, Math.min(w, h) * 0.16));
        c.strokeStyle = col;
        c.fillStyle = col;
        c.lineWidth = 2.0;
        c.lineCap = 'square';
        c.beginPath();
        c.moveTo(x + arm, y); c.lineTo(x, y); c.lineTo(x, y + h); c.lineTo(x + arm, y + h);
        c.moveTo(x + w - arm, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h); c.lineTo(x + w - arm, y + h);
        c.stroke();
        if (br.sup) {
            c.font = '700 15px Inter, sans-serif';
            c.textBaseline = 'top';
            c.textAlign = 'left';
            c.fillText(br.sup, x + w + 5, y - 4);
        }
        c.restore();
    });

    // 9. Gizmo xoay/phóng vòng
    if (isInteractiveActivePage && !isAudienceClean && activeRingGizmo.active) {
        c.save();
        c.strokeStyle = '#38bdf8'; c.lineWidth = 1.6; c.setLineDash([5, 4]);
        c.beginPath(); c.arc(activeRingGizmo.cx, activeRingGizmo.cy, activeRingGizmo.radius, 0, Math.PI * 2); c.stroke();
        c.setLineDash([]);
        c.fillStyle = '#0ea5e9';
        c.beginPath(); c.arc(activeRingGizmo.cx + activeRingGizmo.radius, activeRingGizmo.cy, 7, 0, Math.PI * 2); c.fill();
        c.restore();
    }

    // 10. Khung Lasso
    if (isInteractiveActivePage && !isAudienceClean && lassoSelection.polygon.length > 1) {
        c.save();
        c.strokeStyle = '#38bdf8'; c.lineWidth = 1.8; c.setLineDash([5, 4]);
        c.beginPath();
        c.moveTo(lassoSelection.polygon[0].x, lassoSelection.polygon[0].y);
        lassoSelection.polygon.forEach(p => c.lineTo(p.x, p.y));
        if (lassoSelection.active) c.closePath();
        c.stroke();
        c.restore();
    }

    // 11. Bút Laser thuyết trình (Giữ nét đến khi đổi bút — 3 lớp neon không dùng shadowBlur tiết kiệm GPU)
    if (isInteractiveActivePage && (laserStrokes.length || currentLaserStroke)) {
        const allLaser = currentLaserStroke ? [...laserStrokes, currentLaserStroke] : laserStrokes;
        allLaser.forEach(ls => {
            if (!ls.points || ls.points.length < 2) return;
            c.save();
            c.globalAlpha = 1;
            c.lineCap = 'round'; c.lineJoin = 'round';
            c.beginPath();
            c.moveTo(ls.points[0].x, ls.points[0].y);
            for (let i = 1; i < ls.points.length; i++) c.lineTo(ls.points[i].x, ls.points[i].y);

            c.strokeStyle = 'rgba(244, 63, 94, 0.24)';
            c.lineWidth = 12.5;
            c.stroke();

            c.strokeStyle = 'rgba(251, 113, 133, 0.72)';
            c.lineWidth = 6.2;
            c.stroke();

            c.strokeStyle = '#ffffff';
            c.lineWidth = 2.1;
            c.stroke();
            c.restore();
        });
    }
}

function drawLiveDragPreviewOnContext(targetCtx) {
    if (!isDrawing || !dragStartPos || !currentWorldPos) return;
    targetCtx.save();
    targetCtx.strokeStyle = '#0ea5e9';
    targetCtx.lineWidth = 2.2;
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    targetCtx.setLineDash([5, 4]);
    if (previewChainPoints && previewChainPoints.length > 1) {
        targetCtx.beginPath();
        targetCtx.moveTo(previewChainPoints[0].x, previewChainPoints[0].y);
        for (let i = 1; i < previewChainPoints.length; i++) {
            targetCtx.lineTo(previewChainPoints[i].x, previewChainPoints[i].y);
        }
        targetCtx.stroke();
        targetCtx.setLineDash([]);
        const lastIdx = previewChainPoints.length - 1;
        previewChainPoints.forEach((pt, idxPt) => {
            const isSnapClose = idxPt === lastIdx && !!pt.existingAtom;
            targetCtx.fillStyle = isSnapClose ? '#10b981' : '#0ea5e9';
            targetCtx.beginPath();
            targetCtx.arc(pt.x, pt.y, idxPt === lastIdx ? 4.4 : 3.0, 0, Math.PI * 2);
            targetCtx.fill();
            if (isSnapClose) {
                targetCtx.strokeStyle = '#10b981';
                targetCtx.lineWidth = 2.0;
                targetCtx.beginPath();
                targetCtx.arc(pt.x, pt.y, 10.5, 0, Math.PI * 2);
                targetCtx.stroke();
            }
        });
        // Thẻ đếm số Carbon trực tiếp ngay đầu bút (không cần dừng lại đếm zíc-zắc)
        const tipPt = previewChainPoints[lastIdx];
        const countTxt = tipPt.existingAtom ? (previewChainPoints.length + 'C · Khép vòng') : (previewChainPoints.length + 'C');
        const badgeW = tipPt.existingAtom ? 92 : 34;
        const badgeH = 20;
        const bx = tipPt.x - badgeW * 0.5;
        const by = tipPt.y - 30;
        targetCtx.fillStyle = tipPt.existingAtom ? 'rgba(6, 78, 59, 0.94)' : 'rgba(15, 23, 42, 0.92)';
        targetCtx.strokeStyle = tipPt.existingAtom ? '#34d399' : '#38bdf8';
        targetCtx.lineWidth = 1.25;
        targetCtx.beginPath();
        if (typeof targetCtx.roundRect === 'function') targetCtx.roundRect(bx, by, badgeW, badgeH, 7);
        else targetCtx.rect(bx, by, badgeW, badgeH);
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.fillStyle = tipPt.existingAtom ? '#a7f3d0' : '#7dd3fc';
        targetCtx.font = '800 11px Inter, sans-serif';
        targetCtx.textAlign = 'center';
        targetCtx.textBaseline = 'middle';
        targetCtx.fillText(countTxt, tipPt.x, by + badgeH * 0.5 + 0.5);
    } else if (window.unifiedTool === 'chem_mech_arrow' && Math.hypot(currentWorldPos.x - dragStartPos.x, currentWorldPos.y - dragStartPos.y) > 10) {
        const doc = typeof getDocState === 'function' ? getDocState() : null;
        const maType = typeof activeMechArrowType !== 'undefined' ? activeMechArrowType : '2e_120';
        const bias = typeof getActiveMechArrowDragBias === 'function' ? getActiveMechArrowDragBias(dragStartPos, currentWorldPos) : 0;
        const ctrl = computeSmartMechArrowControlPoint({
            x1: dragStartPos.x, y1: dragStartPos.y,
            x2: currentWorldPos.x, y2: currentWorldPos.y,
            type: maType,
            dragBias: bias
        }, doc, bias);
        targetCtx.strokeStyle = '#e11d48';
        targetCtx.fillStyle = '#e11d48';
        targetCtx.setLineDash([6, 4]);
        targetCtx.beginPath();
        targetCtx.moveTo(dragStartPos.x, dragStartPos.y);
        targetCtx.quadraticCurveTo(ctrl.x, ctrl.y, currentWorldPos.x, currentWorldPos.y);
        targetCtx.stroke();
        targetCtx.setLineDash([]);
        const ang = Math.atan2(currentWorldPos.y - ctrl.y, currentWorldPos.x - ctrl.x);
        targetCtx.translate(currentWorldPos.x, currentWorldPos.y);
        targetCtx.rotate(ang);
        if (maType.startsWith('1e')) {
            targetCtx.beginPath(); targetCtx.moveTo(0, 0); targetCtx.lineTo(-9.5, -5.2); targetCtx.stroke();
        } else {
            targetCtx.beginPath(); targetCtx.moveTo(0, 0); targetCtx.lineTo(-9.5, -4.6); targetCtx.lineTo(-7.2, 0); targetCtx.lineTo(-9.5, 4.6); targetCtx.closePath(); targetCtx.fill();
        }
    } else {
        targetCtx.beginPath();
        targetCtx.moveTo(dragStartPos.x, dragStartPos.y);
        targetCtx.lineTo(currentWorldPos.x, currentWorldPos.y);
        targetCtx.stroke();
        if (window.unifiedTool === 'chem_group' && typeof activeGroupLabel === 'string' && activeGroupLabel) {
            targetCtx.setLineDash([]);
            targetCtx.fillStyle = '#0ea5e9';
            targetCtx.font = '800 13px Inter, sans-serif';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(activeGroupLabel, currentWorldPos.x, currentWorldPos.y - 12);
        }
    }
    targetCtx.restore();
}

function renderCleanAudienceFrame(targetCtx, targetW, targetH, dpr = 1) {
    if (!targetCtx || targetW <= 0 || targetH <= 0) return;
    targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(0, 0, targetW, targetH);

    const nb = getActiveNotebook();
    if (!nb || !Array.isArray(nb.pages) || !nb.pages.length) return;
    const actIdx = Math.max(0, Math.min(nb.pages.length - 1, nb.activePageIndex || 0));

    if (typeof audienceFollowZoom === 'undefined' || audienceFollowZoom) {
        const curZoom = Math.max(0.25, zoom || 1);
        const worldCenterX = (cssWidth * 0.5 - panX) / curZoom;
        const worldCenterY = (cssHeight * 0.5 - panY) / curZoom;
        const fitScale = Math.min(targetW / Math.max(1, cssWidth), targetH / Math.max(1, cssHeight));
        const audZoom = curZoom * fitScale;
        const audPanX = targetW * 0.5 - worldCenterX * audZoom;
        const audPanY = targetH * 0.5 - worldCenterY * audZoom;

        nb.pages.forEach((pg, idx) => {
            const box = typeof getPageLayoutBox === 'function' ? getPageLayoutBox(idx) : { x: 0, y: getPageYOffset(idx), w: A4_WIDTH, h: A4_HEIGHT };
            const isAct = idx === actIdx;
            const pageCfg = typeof getPagePaperConfig === 'function' ? getPagePaperConfig(pg) : { height: A4_HEIGHT };
            const screenTop = audPanY + box.y * audZoom;
            const screenBottom = screenTop + (pageCfg.height || box.h || A4_HEIGHT) * audZoom;
            if (!isAct && (screenBottom < -120 || screenTop > targetH + 120)) return;
            targetCtx.save();
            targetCtx.translate(audPanX + box.x * audZoom, audPanY + box.y * audZoom);
            targetCtx.scale(audZoom, audZoom);
            drawPaperBackground(targetCtx, pg);
            drawPageContentOnContext(targetCtx, pg.content || createEmptyPageContent(), pg, isAct, true);
            if (isAct) drawLiveDragPreviewOnContext(targetCtx);
            targetCtx.restore();
        });
    } else {
        const pg = nb.pages[actIdx];
        const audZoom = Math.min(targetW / Math.max(1, A4_WIDTH), targetH / Math.max(1, A4_HEIGHT));
        const audPanX = (targetW - A4_WIDTH * audZoom) * 0.5;
        const audPanY = (targetH - A4_HEIGHT * audZoom) * 0.5;
        targetCtx.save();
        targetCtx.translate(audPanX, audPanY);
        targetCtx.scale(audZoom, audZoom);
        drawPaperBackground(targetCtx, pg);
        drawPageContentOnContext(targetCtx, pg.content || createEmptyPageContent(), pg, true, true);
        drawLiveDragPreviewOnContext(targetCtx);
        targetCtx.restore();
    }
}

let lastAudienceSyncTime = -1000;

function syncAudienceAndRecordingFrames(force = false) {
    const hasAudience = typeof audienceWindow !== 'undefined' && audienceWindow && !audienceWindow.closed;
    const hasRecording = typeof isCleanRecording !== 'undefined' && isCleanRecording && cleanRecordCanvas;
    if (!hasAudience && !hasRecording) return;

    const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
    if (typeof isDrawing !== 'undefined' && isDrawing && !force && (now - lastAudienceSyncTime) < 32) {
        return;
    }
    lastAudienceSyncTime = now;

    if (hasAudience) {
        try {
            const aDoc = audienceWindow.document;
            const aCan = aDoc && aDoc.getElementById('audienceCanvas');
            if (aCan) {
                const aw = Math.max(320, audienceWindow.innerWidth || 1024);
                const ah = Math.max(240, audienceWindow.innerHeight || 768);
                const adpr = audienceWindow.devicePixelRatio || 1;
                if (aCan.width !== Math.round(aw * adpr) || aCan.height !== Math.round(ah * adpr)) {
                    aCan.width = Math.round(aw * adpr);
                    aCan.height = Math.round(ah * adpr);
                }
                const aCtx = aCan.getContext('2d');
                if (aCtx) renderCleanAudienceFrame(aCtx, aw, ah, adpr);
            }
        } catch (e) {}
    }
    if (hasRecording) {
        try {
            const rcCtx = cleanRecordCanvas.getContext('2d');
            if (rcCtx) renderCleanAudienceFrame(rcCtx, cleanRecordCanvas.width, cleanRecordCanvas.height, 1);
        } catch (e) {}
    }
}

let inkBaseLayerCanvas = null;
let inkBaseLayerMeta = '';
let inkBaseLayerEpoch = 0;
let inkBaseLayerLastStrokeRef = null;
let inkBaseLayerBuildCount = 0;
let inkBaseSyncedToMainCanvas = false;
let lastLiveInkDirtyPxRect = null;
let inkDirtyBlitCount = 0;
let inkFullBlitCount = 0;
let panZoomCacheCanvas = null;
let panZoomCacheSnap = null;
let panZoomSettleTimer = null;

function invalidateInkBaseLayerCache() {
    inkBaseLayerEpoch++;
    inkBaseLayerMeta = '';
    inkBaseLayerLastStrokeRef = null;
    inkBaseSyncedToMainCanvas = false;
    lastLiveInkDirtyPxRect = null;
    panZoomCacheSnap = null;
    if (panZoomSettleTimer) {
        clearTimeout(panZoomSettleTimer);
        panZoomSettleTimer = null;
    }
}

function computeStrokeScreenPxRect(st, actPageIdx, curDpr, maxW, maxH) {
    if (!st || !Array.isArray(st.points) || !st.points.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const pts = st.points;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    if (st.liveTip) {
        if (st.liveTip.x < minX) minX = st.liveTip.x;
        if (st.liveTip.x > maxX) maxX = st.liveTip.x;
        if (st.liveTip.y < minY) minY = st.liveTip.y;
        if (st.liveTip.y > maxY) maxY = st.liveTip.y;
    }
    if (!Number.isFinite(minX)) return null;
    const box = typeof getPageLayoutBox === 'function' ? getPageLayoutBox(actPageIdx) : { x: 0, y: getPageYOffset(actPageIdx), w: A4_WIDTH, h: A4_HEIGHT };
    const padW = st.mode === 'highlighter'
        ? Math.max(26, (st.width || 14) * 3.0 + 18)
        : Math.max(12, (st.width || 3) * 2.6 + 8);
    const ox = panX + box.x * zoom;
    const oy = panY + box.y * zoom;
    const x0 = Math.max(0, Math.floor((ox + (minX - padW) * zoom) * curDpr) - 6);
    const y0 = Math.max(0, Math.floor((oy + (minY - padW) * zoom) * curDpr) - 6);
    const x1 = Math.min(maxW, Math.ceil((ox + (maxX + padW) * zoom) * curDpr) + 6);
    const y1 = Math.min(maxH, Math.ceil((oy + (maxY + padW) * zoom) * curDpr) + 6);
    if (x1 <= x0 || y1 <= y0) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function unionPxRects(r1, r2, maxW, maxH) {
    if (!r1) return r2;
    if (!r2) return r1;
    const x0 = Math.max(0, Math.min(r1.x, r2.x));
    const y0 = Math.max(0, Math.min(r1.y, r2.y));
    const x1 = Math.min(maxW, Math.max(r1.x + r1.w, r2.x + r2.w));
    const y1 = Math.min(maxH, Math.max(r1.y + r1.h, r2.y + r2.h));
    if (x1 <= x0 || y1 <= y0) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function isInteractivePanZoomActive() {
    if (typeof currentInkStroke !== 'undefined' && currentInkStroke) return false;
    if (typeof atomHoldState !== 'undefined' && atomHoldState) return false;
    if (typeof activeMoveTarget !== 'undefined' && activeMoveTarget) return false;
    if (typeof dragStartAtom !== 'undefined' && dragStartAtom) return false;
    if (typeof lassoSelection !== 'undefined' && lassoSelection && lassoSelection.dragging) return false;
    if (typeof nativePinchState !== 'undefined' && nativePinchState && nativePinchState.active) return true;
    if (typeof nativeSinglePanState !== 'undefined' && nativeSinglePanState && nativeSinglePanState.active && nativeSinglePanState.panActivated) return true;
    if (typeof singleFingerPanState !== 'undefined' && singleFingerPanState && singleFingerPanState.active && singleFingerPanState.panActivated) return true;
    if (typeof mousePanState !== 'undefined' && mousePanState && mousePanState.active) return true;
    if (typeof readPanState !== 'undefined' && readPanState && readPanState.active) return true;
    if (typeof panInertiaRafId !== 'undefined' && panInertiaRafId !== null) return true;
    if (typeof safariGestureState !== 'undefined' && safariGestureState && safariGestureState.active) return true;
    if (typeof multiTouchTapState !== 'undefined' && multiTouchTapState && multiTouchTapState.active && typeof activePointers !== 'undefined' && activePointers.size >= 2) return true;
    return false;
}

function buildPanZoomContentKey(nb, actPageIdx, actDoc, curDpr, readOnly, twoColRead) {
    return [
        nb.id,
        actPageIdx,
        cssWidth + 'x' + cssHeight + '@' + curDpr,
        inkBaseLayerEpoch,
        (actDoc?.inkStrokes?.length || 0) + ':' + (actDoc?.atoms?.length || 0) + ':' + (actDoc?.bonds?.length || 0) + ':' + (actDoc?.texts?.length || 0) + ':' + (actDoc?.images?.length || 0) + ':' + (nb.pages?.length || 0),
        typeof selectedBondId !== 'undefined' ? (selectedBondId || '') : '',
        appLibrary.theme || '',
        readOnly ? 1 : 0,
        twoColRead ? 1 : 0
    ].join('|');
}

function drawLabEquipmentOnCtx(c, item) {
    if (!c || !item) return;
    c.save();
    const s = Math.max(0.45, Math.min(2.8, (item.scale || 46) / 46));
    c.translate(item.x, item.y);
    if (item.angle) c.rotate(item.angle);
    c.scale(s, s);
    const strokeCol = item.color || '#1e293b';
    const liqCol = (item.liquidColor && item.liquidColor !== 'none') ? item.liquidColor : null;
    const glassFill = 'rgba(224, 242, 254, 0.24)';
    c.strokeStyle = strokeCol;
    c.lineWidth = 2.0;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    const drawGlassSpec = (x, y1, y2) => {
        c.save();
        c.strokeStyle = 'rgba(255, 255, 255, 0.72)';
        c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(x, y1); c.lineTo(x, y2); c.stroke();
        c.restore();
    };

    switch (item.type) {
        case 'test_tube':
            if (liqCol) {
                c.fillStyle = liqCol; c.globalAlpha = 0.42;
                c.beginPath(); c.moveTo(-8, 6); c.lineTo(8, 6); c.lineTo(8, 28); c.arc(0, 28, 8, 0, Math.PI); c.closePath(); c.fill();
                c.globalAlpha = 1;
            }
            c.fillStyle = glassFill;
            c.beginPath(); c.moveTo(-10, -34); c.lineTo(-8, -31); c.lineTo(-8, 28); c.arc(0, 28, 8, Math.PI, 0, true); c.lineTo(8, -31); c.lineTo(10, -34);
            c.fill(); c.stroke();
            c.beginPath(); c.ellipse(0, -34, 10, 2.5, 0, 0, Math.PI * 2); c.stroke();
            drawGlassSpec(-4.5, -24, 24);
            break;
        case 'erlenmeyer':
            if (liqCol) {
                c.fillStyle = liqCol; c.globalAlpha = 0.42;
                c.beginPath(); c.moveTo(-17, 11); c.lineTo(17, 11); c.lineTo(25, 28); c.quadraticCurveTo(27, 34, 20, 34); c.lineTo(-20, 34); c.quadraticCurveTo(-27, 34, -25, 28); c.closePath(); c.fill();
                c.globalAlpha = 1;
            }
            c.fillStyle = glassFill;
            c.beginPath();
            c.moveTo(-9, -34); c.lineTo(-7.5, -30); c.lineTo(-7.5, -13); c.lineTo(-25, 28); c.quadraticCurveTo(-27, 34, -20, 34);
            c.lineTo(20, 34); c.quadraticCurveTo(27, 34, 25, 28); c.lineTo(7.5, -13); c.lineTo(7.5, -30); c.lineTo(9, -34);
            c.fill(); c.stroke();
            c.beginPath(); c.ellipse(0, -34, 9, 2.3, 0, 0, Math.PI * 2); c.stroke();
            c.beginPath(); c.moveTo(-6, 8); c.lineTo(0, 8); c.moveTo(-8, 18); c.lineTo(0, 18); c.stroke();
            drawGlassSpec(-13, 4, 26);
            break;
        case 'round_flask':
            if (liqCol) {
                c.fillStyle = liqCol; c.globalAlpha = 0.42;
                c.beginPath(); c.arc(0, 11, 21.5, 0.2, Math.PI - 0.2); c.closePath(); c.fill();
                c.globalAlpha = 1;
            }
            c.fillStyle = glassFill;
            c.beginPath();
            c.moveTo(-8, -34); c.lineTo(-6.5, -30); c.lineTo(-6.5, -10.5);
            c.arc(0, 11, 22.5, -Math.PI / 2 - 0.295, -Math.PI / 2 + 0.295, true);
            c.lineTo(6.5, -30); c.lineTo(8, -34);
            c.fill(); c.stroke();
            c.beginPath(); c.ellipse(0, -34, 8, 2.2, 0, 0, Math.PI * 2); c.stroke();
            drawGlassSpec(-13, 4, 18);
            break;
        case 'distill_flask':
            if (liqCol) {
                c.fillStyle = liqCol; c.globalAlpha = 0.42;
                c.beginPath(); c.arc(-3, 12, 19, 0.2, Math.PI - 0.2); c.closePath(); c.fill();
                c.globalAlpha = 1;
            }
            c.fillStyle = glassFill;
            c.beginPath();
            c.moveTo(-10, -34); c.lineTo(-9, -30); c.lineTo(-9, -7);
            c.arc(-3, 12, 20, -Math.PI / 2 - 0.305, -Math.PI / 2 + 0.305, true);
            c.lineTo(3, -17);
            c.moveTo(3, -22); c.lineTo(3, -30); c.lineTo(4, -34);
            c.fill(); c.stroke();
            c.beginPath(); c.ellipse(-3, -34, 7, 2, 0, 0, Math.PI * 2); c.stroke();
            c.beginPath(); c.moveTo(3, -22); c.lineTo(27, -12); c.moveTo(3, -17); c.lineTo(25, -8); c.stroke();
            break;
        case 'beaker':
            if (liqCol) {
                c.fillStyle = liqCol; c.globalAlpha = 0.42;
                c.fillRect(-19, 3, 38, 27);
                c.globalAlpha = 1;
            }
            c.fillStyle = glassFill;
            c.beginPath(); c.moveTo(-23, -26); c.lineTo(-19, -22); c.lineTo(-19, 28); c.quadraticCurveTo(-19, 31, -15, 31);
            c.lineTo(15, 31); c.quadraticCurveTo(19, 31, 19, 28); c.lineTo(19, -26);
            c.fill(); c.stroke();
            for (let y = -12; y <= 20; y += 8) { c.beginPath(); c.moveTo(-6, y); c.lineTo(2, y); c.stroke(); }
            drawGlassSpec(-14, -18, 25);
            break;
        case 'grad_cylinder':
            if (liqCol) {
                c.fillStyle = liqCol; c.globalAlpha = 0.42;
                c.fillRect(-7, 2, 14, 28);
                c.globalAlpha = 1;
            }
            c.fillStyle = glassFill;
            c.beginPath(); c.moveTo(-8.5, -34); c.lineTo(-7, -31); c.lineTo(-7, 30); c.lineTo(7, 30); c.lineTo(7, -31); c.lineTo(8.5, -34);
            c.fill(); c.stroke();
            c.beginPath(); c.ellipse(0, -34, 8.5, 2.0, 0, 0, Math.PI * 2); c.stroke();
            c.beginPath(); c.moveTo(-14, 30); c.lineTo(14, 30); c.lineTo(16, 34); c.lineTo(-16, 34); c.closePath(); c.fill(); c.stroke();
            for (let y = -24; y <= 22; y += 6) { c.beginPath(); c.moveTo(-4, y); c.lineTo(y % 12 === 0 ? 3 : 0, y); c.stroke(); }
            break;
        case 'burette':
            if (liqCol) {
                c.fillStyle = liqCol; c.globalAlpha = 0.45;
                c.fillRect(-3.5, -24, 7, 41);
                c.globalAlpha = 1;
            }
            c.fillStyle = glassFill;
            c.beginPath(); c.moveTo(-5.5, -40); c.lineTo(-4, -37); c.lineTo(-4, 17); c.lineTo(-1.3, 35); c.moveTo(1.3, 35); c.lineTo(4, 17); c.lineTo(4, -37); c.lineTo(5.5, -40);
            c.fill(); c.stroke();
            c.beginPath(); c.moveTo(-10, 22); c.lineTo(10, 22); c.stroke();
            c.save(); c.fillStyle = '#0284c7'; c.fillRect(-10, 19.5, 4, 5); c.restore();
            for (let y = -32; y <= 12; y += 6) { c.beginPath(); c.moveTo(-2, y); c.lineTo(2, y); c.stroke(); }
            break;
        case 'pipette':
            c.fillStyle = glassFill;
            c.beginPath();
            c.moveTo(-2, -38); c.lineTo(-2, -14); c.quadraticCurveTo(-9, 0, -2, 14); c.lineTo(-1.5, 34);
            c.lineTo(1.5, 34); c.lineTo(2, 14); c.quadraticCurveTo(9, 0, 2, -14); c.lineTo(2, -38);
            c.closePath(); c.fill(); c.stroke();
            if (liqCol) {
                c.fillStyle = liqCol; c.globalAlpha = 0.45;
                c.beginPath(); c.ellipse(0, 0, 4.5, 11, 0, 0, Math.PI * 2); c.fill();
                c.globalAlpha = 1;
            }
            break;
        case 'sep_funnel':
            if (liqCol) {
                c.fillStyle = liqCol; c.globalAlpha = 0.45;
                c.beginPath(); c.moveTo(-12, -2); c.lineTo(12, -2); c.lineTo(3, 12); c.lineTo(-3, 12); c.closePath(); c.fill();
                c.globalAlpha = 1;
            }
            c.fillStyle = glassFill;
            c.beginPath();
            c.moveTo(-6, -34); c.lineTo(-5, -28); c.quadraticCurveTo(-18, -8, -3, 12); c.lineTo(-2.5, 34);
            c.lineTo(2.5, 34); c.lineTo(3, 12); c.quadraticCurveTo(18, -8, 5, -28); c.lineTo(6, -34);
            c.fill(); c.stroke();
            c.beginPath(); c.ellipse(0, -34, 6, 2, 0, 0, Math.PI * 2); c.stroke();
            c.beginPath(); c.moveTo(-10, 20); c.lineTo(10, 20); c.stroke();
            break;
        case 'filter_funnel':
            c.fillStyle = glassFill;
            c.beginPath();
            c.moveTo(-22, -22); c.lineTo(-3, 6); c.lineTo(-2.5, 32); c.moveTo(2.5, 32); c.lineTo(3, 6); c.lineTo(22, -22);
            c.fill(); c.stroke();
            c.beginPath(); c.ellipse(0, -22, 22, 3.2, 0, 0, Math.PI * 2); c.stroke();
            c.save(); c.setLineDash([4, 3]);
            c.beginPath(); c.moveTo(-16, -20); c.lineTo(0, 3); c.lineTo(16, -20); c.stroke();
            c.restore();
            break;
        case 'alcohol_lamp':
            if (liqCol) {
                c.fillStyle = liqCol; c.globalAlpha = 0.42;
                c.beginPath(); c.moveTo(-18, 12); c.lineTo(18, 12); c.lineTo(22, 29); c.lineTo(-22, 29); c.closePath(); c.fill();
                c.globalAlpha = 1;
            }
            c.fillStyle = glassFill;
            c.beginPath(); c.moveTo(-11, -3); c.lineTo(11, -3); c.lineTo(23, 29); c.lineTo(-23, 29); c.closePath();
            c.fill(); c.stroke();
            c.fillStyle = '#94a3b8'; c.fillRect(-5, -10, 10, 7); c.strokeRect(-5, -10, 10, 7);
            c.beginPath(); c.moveTo(0, -10); c.lineTo(0, -14); c.stroke();
            c.fillStyle = '#f59e0b';
            c.beginPath(); c.moveTo(0, -33); c.quadraticCurveTo(-8, -20, 0, -13); c.quadraticCurveTo(8, -20, 0, -33); c.fill();
            c.fillStyle = '#fef08a';
            c.beginPath(); c.moveTo(0, -26); c.quadraticCurveTo(-4, -19, 0, -14); c.quadraticCurveTo(4, -19, 0, -26); c.fill();
            break;
        case 'retort_stand':
            c.lineWidth = 3.2;
            c.beginPath(); c.moveTo(-26, 32); c.lineTo(26, 32); c.moveTo(-16, 32); c.lineTo(-16, -38); c.stroke();
            c.lineWidth = 2.2;
            c.beginPath(); c.moveTo(-16, -14); c.lineTo(12, -14); c.arc(17, -14, 5, Math.PI * 0.7, Math.PI * 1.3, true); c.stroke();
            c.fillStyle = '#475569'; c.fillRect(-20, -18, 8, 8);
            break;
        case 'condenser':
            c.save(); c.rotate(-0.45);
            c.beginPath(); c.moveTo(-36, 0); c.lineTo(36, 0); c.stroke();
            c.fillStyle = glassFill;
            c.fillRect(-22, -9, 44, 18);
            c.strokeRect(-22, -9, 44, 18);
            c.beginPath(); c.moveTo(-15, 9); c.lineTo(-15, 18); c.moveTo(15, -9); c.lineTo(15, -18); c.stroke();
            c.restore();
            break;
        case 'kipp_apparatus':
            c.fillStyle = glassFill;
            c.beginPath(); c.arc(0, -21, 10, 0, Math.PI * 2); c.fill(); c.stroke();
            c.beginPath(); c.arc(0, 1, 14, 0, Math.PI * 2); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(-9, 12); c.lineTo(-15, 31); c.lineTo(15, 31); c.lineTo(9, 12); c.closePath(); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(14, 1); c.lineTo(26, 1); c.stroke();
            break;
        case 'water_trough':
            c.fillStyle = liqCol || '#38bdf8'; c.globalAlpha = 0.34;
            c.fillRect(-28, 8, 56, 22);
            c.globalAlpha = 1;
            c.beginPath(); c.moveTo(-28, -4); c.lineTo(-28, 30); c.lineTo(28, 30); c.lineTo(28, -4); c.stroke();
            c.fillStyle = glassFill;
            c.beginPath(); c.moveTo(-10, 18); c.lineTo(-10, -26); c.lineTo(10, -26); c.lineTo(10, 18);
            c.fill(); c.stroke();
            break;
        case 'thermometer':
            c.fillStyle = glassFill;
            c.beginPath(); c.roundRect(-4.5, -36, 9, 52, 4.5); c.fill(); c.stroke();
            c.beginPath(); c.arc(0, 22, 8, 0, Math.PI * 2); c.fill(); c.stroke();
            c.fillStyle = '#ef4444'; c.strokeStyle = '#ef4444';
            c.beginPath(); c.arc(0, 22, 5.2, 0, Math.PI * 2); c.fill();
            c.lineWidth = 2.6;
            c.beginPath(); c.moveTo(0, 18); c.lineTo(0, -16); c.stroke();
            break;
    }
    c.restore();
}

function renderAllPagesOnContext(targetCtx, includeCurrentInk = true, cullPadPx = 0) {
    const nb = getActiveNotebook();
    const actPageIdx = nb.activePageIndex || 0;
    const readOnly = typeof isReadMode !== 'undefined' && isReadMode;
    const twoColRead = readOnly && typeof readTwoPageMode !== 'undefined' && readTwoPageMode && nb.pages.length > 1;
    nb.pages.forEach((pg, idx) => {
        const box = typeof getPageLayoutBox === 'function' ? getPageLayoutBox(idx) : { x: 0, y: getPageYOffset(idx), w: A4_WIDTH, h: A4_HEIGHT };
        const isAct = idx === actPageIdx;
        const pageCfg = typeof getPagePaperConfig === 'function' ? getPagePaperConfig(pg) : { width: A4_WIDTH, height: A4_HEIGHT };
        const pageW = pageCfg.width || box.w || A4_WIDTH;
        const pageH = pageCfg.height || box.h || A4_HEIGHT;
        const screenTop = panY + box.y * zoom;
        const screenBottom = screenTop + pageH * zoom;
        const inSameReadRow = twoColRead && Math.floor(idx / 2) === Math.floor(actPageIdx / 2);
        if (!isAct && !inSameReadRow && (screenBottom < -120 - cullPadPx || screenTop > cssHeight + 120 + cullPadPx)) return;
        targetCtx.save();
        targetCtx.translate(panX + box.x * zoom, panY + box.y * zoom);
        targetCtx.scale(zoom, zoom);
        targetCtx.save();
        targetCtx.fillStyle = 'rgba(2, 6, 23, 0.14)';
        targetCtx.fillRect(2, 5, pageW, pageH);
        targetCtx.fillStyle = 'rgba(2, 6, 23, 0.08)';
        targetCtx.fillRect(-1, 2, pageW + 2, pageH + 2);
        targetCtx.restore();
        drawPaperBackground(targetCtx, pg);
        targetCtx.save();
        targetCtx.strokeStyle = 'rgba(148, 163, 184, 0.36)';
        targetCtx.lineWidth = 1.05 / Math.max(0.25, zoom);
        targetCtx.strokeRect(0, 0, pageW, pageH);
        targetCtx.restore();
        if (idx > 0 || twoColRead) {
            targetCtx.save();
            targetCtx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
            targetCtx.lineWidth = 1.2;
            targetCtx.setLineDash([8, 6]);
            targetCtx.beginPath(); targetCtx.moveTo(0, 0); targetCtx.lineTo(pageW, 0); targetCtx.stroke();
            targetCtx.setLineDash([]);
            targetCtx.fillStyle = 'rgba(56, 189, 248, 0.72)';
            targetCtx.font = '700 10px Inter, sans-serif';
            targetCtx.textAlign = 'right';
            targetCtx.fillText(`Trang ${idx + 1}`, pageW - 12, 14);
            targetCtx.restore();
        }
        const allowOverlay = isAct && !readOnly;
        const visBounds = {
            minY: (-48 - cullPadPx - panY) / zoom - box.y,
            maxY: (cssHeight + 48 + cullPadPx - panY) / zoom - box.y
        };
        targetCtx.save();
        targetCtx.beginPath();
        targetCtx.rect(0, 0, pageW, pageH);
        targetCtx.clip();
        drawPageContentOnContext(targetCtx, pg.content || createEmptyPageContent(), pg, allowOverlay, false, includeCurrentInk, visBounds);
        targetCtx.restore();

        if (allowOverlay && typeof atomHoldState !== 'undefined' && atomHoldState && atomHoldState.atom) {
            const ha = atomHoldState.atom;
            targetCtx.save();
            if (atomHoldState.active) {
                targetCtx.strokeStyle = '#34d399';
                targetCtx.fillStyle = 'rgba(52, 211, 153, 0.22)';
                targetCtx.lineWidth = 2.2;
                targetCtx.beginPath(); targetCtx.arc(ha.x, ha.y, 13, 0, Math.PI * 2); targetCtx.fill(); targetCtx.stroke();
                targetCtx.strokeStyle = '#38bdf8';
                targetCtx.lineWidth = 1.5;
                targetCtx.beginPath(); targetCtx.arc(ha.x, ha.y, 17, 0, Math.PI * 2); targetCtx.stroke();
                const arOff = 20, arLen = 4.5;
                targetCtx.fillStyle = '#34d399';
                [[0,-1],[0,1],[-1,0],[1,0]].forEach(([dx, dy]) => {
                    const px = ha.x + dx * arOff, py2 = ha.y + dy * arOff;
                    targetCtx.beginPath();
                    targetCtx.moveTo(px + dx * arLen, py2 + dy * arLen);
                    targetCtx.lineTo(px - dy * 3, py2 + dx * 3);
                    targetCtx.lineTo(px + dy * 3, py2 - dx * 3);
                    targetCtx.closePath(); targetCtx.fill();
                });
            } else {
                const delayMs = atomHoldState.delayMs || 560;
                const elapsed = Math.min(1, Math.max(0.12, (Date.now() - atomHoldState.startedAt) / delayMs));
                targetCtx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
                targetCtx.lineWidth = 2.0;
                targetCtx.beginPath(); targetCtx.arc(ha.x, ha.y, 12, 0, Math.PI * 2); targetCtx.stroke();
                targetCtx.strokeStyle = '#38bdf8';
                targetCtx.lineWidth = 2.5;
                targetCtx.beginPath(); targetCtx.arc(ha.x, ha.y, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * elapsed); targetCtx.stroke();
            }
            targetCtx.restore();
        } else if (allowOverlay && hoveredAtom && !isDrawing) {
            targetCtx.save();
            targetCtx.strokeStyle = '#38bdf8';
            targetCtx.fillStyle = 'rgba(56, 189, 248, 0.18)';
            targetCtx.lineWidth = 1.8;
            targetCtx.beginPath();
            targetCtx.arc(hoveredAtom.x, hoveredAtom.y, 9, 0, Math.PI * 2);
            targetCtx.fill();
            targetCtx.stroke();
            targetCtx.restore();
        } else if (allowOverlay && typeof hoveredBond !== 'undefined' && hoveredBond && !isDrawing) {
            const docCur = pg.content || createEmptyPageContent();
            const a1 = (docCur.atoms || []).find(a => a.id === hoveredBond.a1);
            const a2 = (docCur.atoms || []).find(a => a.id === hoveredBond.a2);
            if (a1 && a2) {
                targetCtx.save();
                targetCtx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
                targetCtx.lineWidth = 6;
                targetCtx.lineCap = 'round';
                targetCtx.beginPath();
                targetCtx.moveTo(a1.x, a1.y);
                targetCtx.lineTo(a2.x, a2.y);
                targetCtx.stroke();
                targetCtx.restore();
            }
        }

        if (allowOverlay && (window.unifiedTool === 'chem_move' || window.unifiedTool === 'chem_mech_arrow')) {
            const docCur = pg.content || createEmptyPageContent();
            (docCur.mechArrows || []).forEach(ma => {
                const ctrl = getMechArrowControlPoint(ma, docCur);
                const bx = 0.25 * ma.x1 + 0.5 * ctrl.x + 0.25 * ma.x2;
                const by = 0.25 * ma.y1 + 0.5 * ctrl.y + 0.25 * ma.y2;
                targetCtx.save();
                targetCtx.fillStyle = '#38bdf8';
                targetCtx.strokeStyle = '#ffffff';
                targetCtx.lineWidth = 1.5;
                targetCtx.beginPath();
                targetCtx.arc(bx, by, 5, 0, Math.PI * 2);
                targetCtx.fill();
                targetCtx.stroke();
                if (window.unifiedTool === 'chem_move') {
                    targetCtx.fillStyle = '#0ea5e9';
                    [[ma.x1, ma.y1], [ma.x2, ma.y2]].forEach(([ex, ey]) => {
                        targetCtx.beginPath();
                        targetCtx.arc(ex, ey, 4.2, 0, Math.PI * 2);
                        targetCtx.fill();
                        targetCtx.stroke();
                    });
                }
                targetCtx.restore();
            });
            if (window.unifiedTool === 'chem_move') {
                (docCur.arrows || []).forEach(ar => {
                    targetCtx.save();
                    targetCtx.fillStyle = '#0ea5e9';
                    targetCtx.strokeStyle = '#ffffff';
                    targetCtx.lineWidth = 1.4;
                    [[ar.x1, ar.y1], [ar.x2, ar.y2]].forEach(([ex, ey]) => {
                        targetCtx.beginPath();
                        targetCtx.arc(ex, ey, 4.2, 0, Math.PI * 2);
                        targetCtx.fill();
                        targetCtx.stroke();
                    });
                    targetCtx.restore();
                });
            }
        }

        if (allowOverlay) {
            drawLiveDragPreviewOnContext(targetCtx);
        }

        if (allowOverlay && window.unifiedTool === 'pen_eraser' && currentWorldPos) {
            const erR = Math.max(6, (typeof eraserRadius === 'number' ? eraserRadius : 24));
            targetCtx.save();
            targetCtx.beginPath();
            targetCtx.arc(currentWorldPos.x, currentWorldPos.y, erR, 0, Math.PI * 2);
            targetCtx.fillStyle = isDrawing ? 'rgba(244, 63, 94, 0.14)' : 'rgba(56, 189, 248, 0.12)';
            targetCtx.fill();
            targetCtx.lineWidth = 1.6;
            targetCtx.setLineDash(isDrawing ? [] : [4, 3]);
            targetCtx.strokeStyle = isDrawing ? '#f43f5e' : '#0ea5e9';
            targetCtx.stroke();
            targetCtx.setLineDash([]);
            targetCtx.beginPath();
            targetCtx.arc(currentWorldPos.x, currentWorldPos.y, 1.8, 0, Math.PI * 2);
            targetCtx.fillStyle = isDrawing ? '#f43f5e' : '#0ea5e9';
            targetCtx.fill();
            targetCtx.restore();
        }
        targetCtx.restore();
    });
}

function buildInkBaseLayerKey(nb, actPageIdx, actDoc, curDpr, readOnly, twoColRead, strokeCountOverride) {
    const sc = typeof strokeCountOverride === 'number' ? strokeCountOverride : (actDoc?.inkStrokes?.length || 0);
    return [
        nb.id,
        actPageIdx,
        Math.round(panX * 10),
        Math.round(panY * 10),
        zoom.toFixed(4),
        cssWidth + 'x' + cssHeight + '@' + curDpr,
        inkBaseLayerEpoch,
        sc + ':' + (actDoc?.atoms?.length || 0) + ':' + (actDoc?.bonds?.length || 0) + ':' + (actDoc?.texts?.length || 0) + ':' + (actDoc?.images?.length || 0) + ':' + (actDoc?.arrows?.length || 0) + ':' + (actDoc?.mechArrows?.length || 0) + ':' + (actDoc?.orbitals?.length || 0) + ':' + (actDoc?.chemSymbols?.length || 0) + ':' + (actDoc?.brackets?.length || 0) + ':' + (actDoc?.labItems?.length || 0),
        typeof selectedBondId !== 'undefined' ? (selectedBondId || '') : '',
        (typeof activeImageSelection !== 'undefined' && activeImageSelection?.id) ? activeImageSelection.id : '',
        (typeof lassoSelection !== 'undefined' && lassoSelection?.active) ? 1 : 0,
        appLibrary.theme || '',
        readOnly ? 1 : 0,
        twoColRead ? 1 : 0
    ].join('|');
}

function commitStrokeToInkBaseLayerCache(committedStroke, actPageIdx, newStrokeCount) {
    if (!committedStroke || committedStroke.mode === 'highlighter' || !inkBaseLayerCanvas || !inkBaseLayerMeta) return false;
    if (typeof document === 'undefined' || typeof ctx?.drawImage !== 'function' || cssWidth <= 0 || cssHeight <= 0) return false;
    const baseCtx = typeof inkBaseLayerCanvas.getContext === 'function' ? inkBaseLayerCanvas.getContext('2d') : null;
    if (!baseCtx || typeof baseCtx.setTransform !== 'function') return false;

    const nb = getActiveNotebook();
    const actPg = nb.pages[actPageIdx];
    const actDoc = actPg?.content;
    const curDpr = getSharpDpr();
    const readOnly = typeof isReadMode !== 'undefined' && isReadMode;
    const twoColRead = readOnly && typeof readTwoPageMode !== 'undefined' && readTwoPageMode && nb.pages.length > 1;

    const prevCount = Math.max(0, newStrokeCount - 1);
    const prevKey = buildInkBaseLayerKey(nb, actPageIdx, actDoc, curDpr, readOnly, twoColRead, prevCount);
    const prevStrokeRef = (actDoc && Array.isArray(actDoc.inkStrokes) && prevCount > 0) ? actDoc.inkStrokes[prevCount - 1] : null;
    if (inkBaseLayerMeta !== prevKey || inkBaseLayerLastStrokeRef !== prevStrokeRef) return false;

    const box = typeof getPageLayoutBox === 'function' ? getPageLayoutBox(actPageIdx) : { x: 0, y: getPageYOffset(actPageIdx), w: A4_WIDTH, h: A4_HEIGHT };
    const cCfg = typeof getPagePaperConfig === 'function' ? getPagePaperConfig(actPg) : { width: A4_WIDTH, height: A4_HEIGHT };
    baseCtx.save();
    baseCtx.setTransform(curDpr, 0, 0, curDpr, 0, 0);
    baseCtx.translate(panX + box.x * zoom, panY + box.y * zoom);
    baseCtx.scale(zoom, zoom);
    baseCtx.beginPath();
    baseCtx.rect(0, 0, cCfg.width || box.w || A4_WIDTH, cCfg.height || box.h || A4_HEIGHT);
    baseCtx.clip();
    drawSmoothInkStroke(baseCtx, committedStroke, !!cCfg.isDark);
    baseCtx.restore();

    inkBaseLayerMeta = buildInkBaseLayerKey(nb, actPageIdx, actDoc, curDpr, readOnly, twoColRead, newStrokeCount);
    inkBaseLayerLastStrokeRef = committedStroke;

    const blitW = canvas.width || Math.max(1, Math.round(cssWidth * curDpr));
    const blitH = canvas.height || Math.max(1, Math.round(cssHeight * curDpr));
    const finalStrokePx = computeStrokeScreenPxRect(committedStroke, actPageIdx, curDpr, blitW, blitH);
    const commitDirty = inkBaseSyncedToMainCanvas ? unionPxRects(lastLiveInkDirtyPxRect, finalStrokePx, blitW, blitH) : null;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (commitDirty && commitDirty.w > 0 && commitDirty.h > 0) {
        ctx.clearRect(commitDirty.x, commitDirty.y, commitDirty.w, commitDirty.h);
        ctx.drawImage(inkBaseLayerCanvas, commitDirty.x, commitDirty.y, commitDirty.w, commitDirty.h, commitDirty.x, commitDirty.y, commitDirty.w, commitDirty.h);
        inkDirtyBlitCount++;
    } else {
        ctx.clearRect(0, 0, blitW, blitH);
        ctx.drawImage(inkBaseLayerCanvas, 0, 0, blitW, blitH);
        inkFullBlitCount++;
    }
    ctx.restore();
    inkBaseSyncedToMainCanvas = true;
    lastLiveInkDirtyPxRect = null;
    syncAudienceAndRecordingFrames();
    return true;
}

function renderAll() {
    if (typeof syncActivePaperDimensions === 'function') syncActivePaperDimensions();
    const nb = getActiveNotebook();
    const actPageIdx = nb.activePageIndex || 0;
    const readOnly = typeof isReadMode !== 'undefined' && isReadMode;
    const twoColRead = readOnly && typeof readTwoPageMode !== 'undefined' && readTwoPageMode && nb.pages.length > 1;
    const activeInk = typeof currentInkStroke !== 'undefined' && currentInkStroke;

    if (activeInk && typeof document !== 'undefined' && typeof ctx?.drawImage === 'function' && cssWidth > 0 && cssHeight > 0) {
        if (!inkBaseLayerCanvas && typeof document.createElement === 'function') {
            inkBaseLayerCanvas = document.createElement('canvas');
        }
        const baseCtx = inkBaseLayerCanvas && typeof inkBaseLayerCanvas.getContext === 'function'
            ? inkBaseLayerCanvas.getContext('2d')
            : null;
        if (baseCtx && typeof baseCtx.setTransform === 'function') {
            const curDpr = getSharpDpr();
            const actPg = nb.pages[actPageIdx];
            const actDoc = actPg?.content;
            const committedList = actDoc?.inkStrokes || [];
            const curLastStrokeRef = committedList.length > 0 ? committedList[committedList.length - 1] : null;
            const cacheKey = buildInkBaseLayerKey(nb, actPageIdx, actDoc, curDpr, readOnly, twoColRead);

            if (inkBaseLayerMeta !== cacheKey || inkBaseLayerLastStrokeRef !== curLastStrokeRef) {
                const targetPixW = canvas.width || Math.max(1, Math.round(cssWidth * curDpr));
                const targetPixH = canvas.height || Math.max(1, Math.round(cssHeight * curDpr));
                if (inkBaseLayerCanvas.width !== targetPixW || inkBaseLayerCanvas.height !== targetPixH) {
                    inkBaseLayerCanvas.width = targetPixW;
                    inkBaseLayerCanvas.height = targetPixH;
                }
                baseCtx.setTransform(1, 0, 0, 1, 0, 0);
                baseCtx.clearRect(0, 0, targetPixW, targetPixH);
                baseCtx.setTransform(curDpr, 0, 0, curDpr, 0, 0);
                renderAllPagesOnContext(baseCtx, false);
                inkBaseLayerMeta = cacheKey;
                inkBaseLayerLastStrokeRef = curLastStrokeRef;
                inkBaseLayerBuildCount++;
                inkBaseSyncedToMainCanvas = false;
                lastLiveInkDirtyPxRect = null;
            }

            const blitW = canvas.width || Math.max(1, Math.round(cssWidth * curDpr));
            const blitH = canvas.height || Math.max(1, Math.round(cssHeight * curDpr));
            const curStrokePx = computeStrokeScreenPxRect(currentInkStroke, actPageIdx, curDpr, blitW, blitH);
            const dirtyRect = inkBaseSyncedToMainCanvas && curStrokePx
                ? unionPxRects(lastLiveInkDirtyPxRect, curStrokePx, blitW, blitH)
                : null;

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            if (dirtyRect && dirtyRect.w > 0 && dirtyRect.h > 0) {
                ctx.clearRect(dirtyRect.x, dirtyRect.y, dirtyRect.w, dirtyRect.h);
                ctx.drawImage(inkBaseLayerCanvas, dirtyRect.x, dirtyRect.y, dirtyRect.w, dirtyRect.h, dirtyRect.x, dirtyRect.y, dirtyRect.w, dirtyRect.h);
                inkDirtyBlitCount++;
            } else {
                ctx.clearRect(0, 0, blitW, blitH);
                ctx.drawImage(inkBaseLayerCanvas, 0, 0, blitW, blitH);
                inkFullBlitCount++;
            }
            ctx.restore();
            inkBaseSyncedToMainCanvas = true;
            lastLiveInkDirtyPxRect = curStrokePx;

            if (actPg) {
                const box = typeof getPageLayoutBox === 'function' ? getPageLayoutBox(actPageIdx) : { x: 0, y: getPageYOffset(actPageIdx), w: A4_WIDTH, h: A4_HEIGHT };
                const aCfg = typeof getPagePaperConfig === 'function' ? getPagePaperConfig(actPg) : { width: A4_WIDTH, height: A4_HEIGHT };
                ctx.save();
                if (dirtyRect && dirtyRect.w > 0 && dirtyRect.h > 0) {
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.beginPath();
                    ctx.rect(dirtyRect.x, dirtyRect.y, dirtyRect.w, dirtyRect.h);
                    ctx.clip();
                    ctx.setTransform(curDpr, 0, 0, curDpr, 0, 0);
                }
                ctx.translate(panX + box.x * zoom, panY + box.y * zoom);
                ctx.scale(zoom, zoom);
                ctx.beginPath();
                ctx.rect(0, 0, aCfg.width || box.w || A4_WIDTH, aCfg.height || box.h || A4_HEIGHT);
                ctx.clip();
                drawSmoothInkStroke(ctx, currentInkStroke, !!aCfg.isDark);
                ctx.restore();
            }
            syncAudienceAndRecordingFrames();
            return;
        }
    }

    inkBaseSyncedToMainCanvas = false;
    lastLiveInkDirtyPxRect = null;

    if (!activeInk && isInteractivePanZoomActive() && typeof document !== 'undefined' && typeof ctx?.drawImage === 'function' && cssWidth > 0 && cssHeight > 0) {
        if (!panZoomCacheCanvas && typeof document.createElement === 'function') {
            panZoomCacheCanvas = document.createElement('canvas');
        }
        const pCtx = panZoomCacheCanvas && typeof panZoomCacheCanvas.getContext === 'function'
            ? panZoomCacheCanvas.getContext('2d')
            : null;
        if (pCtx && typeof pCtx.setTransform === 'function') {
            const curDpr = getSharpDpr();
            const actDoc = nb.pages[actPageIdx]?.content;
            const cKey = buildPanZoomContentKey(nb, actPageIdx, actDoc, curDpr, readOnly, twoColRead);
            let needRebuild = true;
            let dstX = 0, dstY = 0, dstW = cssWidth, dstH = cssHeight;
            if (panZoomCacheSnap && panZoomCacheSnap.key === cKey && panZoomCacheSnap.zoom > 0) {
                const relS = zoom / panZoomCacheSnap.zoom;
                dstX = panX - relS * (panZoomCacheSnap.panX + panZoomCacheSnap.pad);
                dstY = panY - relS * (panZoomCacheSnap.panY + panZoomCacheSnap.pad);
                dstW = panZoomCacheSnap.cssSpanW * relS;
                dstH = panZoomCacheSnap.cssSpanH * relS;
                const coversScreen = dstX <= 1 && dstY <= 1 && (dstX + dstW) >= (cssWidth - 1) && (dstY + dstH) >= (cssHeight - 1);
                if (coversScreen && relS >= 0.68 && relS <= 1.60) {
                    needRebuild = false;
                }
            }
            if (needRebuild) {
                const pad = Math.round(Math.min(260, Math.max(140, Math.max(cssWidth, cssHeight) * 0.28)));
                const cssSpanW = cssWidth + pad * 2;
                const cssSpanH = cssHeight + pad * 2;
                const maxTex = 3200;
                const cacheDpr = Math.max(1, Math.min(curDpr, 2, maxTex / Math.max(1, cssSpanW), maxTex / Math.max(1, cssSpanH)));
                const bufW = Math.max(1, Math.round(cssSpanW * cacheDpr));
                const bufH = Math.max(1, Math.round(cssSpanH * cacheDpr));
                if (panZoomCacheCanvas.width !== bufW || panZoomCacheCanvas.height !== bufH) {
                    panZoomCacheCanvas.width = bufW;
                    panZoomCacheCanvas.height = bufH;
                }
                pCtx.setTransform(1, 0, 0, 1, 0, 0);
                pCtx.clearRect(0, 0, bufW, bufH);
                pCtx.setTransform(cacheDpr, 0, 0, cacheDpr, pad * cacheDpr, pad * cacheDpr);
                renderAllPagesOnContext(pCtx, false, pad);
                panZoomCacheSnap = { key: cKey, panX, panY, zoom, pad, cssSpanW, cssSpanH };
                dstX = -pad;
                dstY = -pad;
                dstW = cssSpanW;
                dstH = cssSpanH;
            }
            ctx.save();
            ctx.setTransform(curDpr, 0, 0, curDpr, 0, 0);
            ctx.clearRect(0, 0, cssWidth, cssHeight);
            ctx.drawImage(panZoomCacheCanvas, dstX, dstY, dstW, dstH);
            ctx.restore();
            if (typeof setTimeout === 'function') {
                if (panZoomSettleTimer) clearTimeout(panZoomSettleTimer);
                panZoomSettleTimer = setTimeout(() => {
                    panZoomSettleTimer = null;
                    if (!isInteractivePanZoomActive() && typeof renderAll === 'function') {
                        renderAll();
                    }
                }, 75);
            }
            if (typeof syncPaperLabWidgets === 'function') syncPaperLabWidgets();
            syncAudienceAndRecordingFrames();
            return;
        }
    }

    if (panZoomSettleTimer) {
        clearTimeout(panZoomSettleTimer);
        panZoomSettleTimer = null;
    }
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    renderAllPagesOnContext(ctx, true);
    if (typeof syncPaperLabWidgets === 'function') syncPaperLabWidgets();
    syncAudienceAndRecordingFrames();
}

function renderSplitRightPane() {
    const sv = appLibrary.splitView;
    if (!sv.enabled) return;
    const sel = document.getElementById('splitRightNotebookSelect');
    if (sel) {
        sel.innerHTML = appLibrary.notebooks.map(n => `<option value="${n.id}" ${n.id === sv.rightNotebookId ? 'selected' : ''}>${n.title}</option>`).join('');
    }
    const nb = appLibrary.notebooks.find(n => n.id === sv.rightNotebookId) || getActiveNotebook();
    const pgIdx = Math.max(0, Math.min(nb.pages.length - 1, sv.rightPageIndex || 0));
    const pg = nb.pages[pgIdx];
    const ind = document.getElementById('splitRightPageIndicator');
    if (ind) ind.textContent = `${pgIdx + 1}/${nb.pages.length}`;

    const rVp = document.getElementById('splitRightViewport');
    const rCan = document.getElementById('splitRightCanvas');
    if (!rVp || !rCan || !pg) return;
    const rect = rVp.getBoundingClientRect();
    const dpr = getSharpDpr();
    rCan.width = Math.round(Math.max(200, rect.width) * dpr);
    rCan.height = Math.round(Math.max(200, rect.height) * dpr);
    const rCtx = rCan.getContext('2d');
    rCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rCtx.imageSmoothingEnabled = true;
    rCtx.imageSmoothingQuality = 'high';
    rCtx.clearRect(0, 0, rect.width, rect.height);
    const rCfg = typeof getPagePaperConfig === 'function' ? getPagePaperConfig(pg) : { width: A4_WIDTH, height: A4_HEIGHT };
    const rZoom = rect.width / rCfg.width;
    rCtx.save();
    rCtx.translate(0, 0);
    rCtx.scale(rZoom, rZoom);
    drawPaperBackground(rCtx, pg);
    rCtx.beginPath();
    rCtx.rect(0, 0, rCfg.width || A4_WIDTH, rCfg.height || A4_HEIGHT);
    rCtx.clip();
    drawPageContentOnContext(rCtx, pg.content || createEmptyPageContent(), pg, false);
    rCtx.restore();
}
