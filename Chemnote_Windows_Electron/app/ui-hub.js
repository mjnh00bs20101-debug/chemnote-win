/* ============================================================================
 * MODULE 2: UI, TABS, SPLIT-VIEW, POPOVERS, IMAGES & LIBRARY HUB
 * ============================================================================ */

function renderOpenTabsBar() {
    const bar = document.getElementById('gnOpenTabsBar');
    if (!bar) return;
    bar.innerHTML = appLibrary.openTabIds.map(id => {
        const nb = appLibrary.notebooks.find(n => n.id === id);
        if (!nb) return '';
        const isAct = nb.id === appLibrary.activeNotebookId;
        const pgTxt = `${(nb.activePageIndex || 0) + 1}/${nb.pages.length}`;
        return `
            <div onclick="switchActiveNotebook('${nb.id}')" class="gn-doc-tab ${isAct ? 'active' : ''}">
                <span>${nb.title}</span>
                <span class="text-[10px] opacity-65">(${pgTxt})</span>
                <span onclick="event.stopPropagation(); openNotebookInSplitRight('${nb.id}')" class="opacity-60 hover:opacity-100 px-1" title="Mở song song bên phải">◫</span>
                ${appLibrary.openTabIds.length > 1 ? `<span onclick="event.stopPropagation(); closeNotebookTab('${nb.id}')" class="opacity-60 hover:opacity-100">✕</span>` : ''}
            </div>
        `;
    }).join('');
    syncPageQuickNavUI();
}

function switchActiveNotebook(id) {
    if (!appLibrary.openTabIds.includes(id)) appLibrary.openTabIds.push(id);
    appLibrary.activeNotebookId = id;
    const nb = appLibrary.notebooks.find(n => n.id === id);
    if (nb) nb.lastOpenedAt = Date.now();
    syncActivePaperDimensions();
    undoStack = []; redoStack = [];
    laserStrokes = []; currentLaserStroke = null;
    if (typeof clearActiveRingGizmo === 'function') clearActiveRingGizmo(false);
    clearActiveImageSelection(false);
    if (typeof clearActiveCarbonChain === 'function') clearActiveCarbonChain(false);
    persistLibrary();
    renderOpenTabsBar();
    if (typeof fitA4ToScreen === 'function') fitA4ToScreen();
}

function closeNotebookTab(id) {
    if (appLibrary.openTabIds.length <= 1) return;
    appLibrary.openTabIds = appLibrary.openTabIds.filter(tid => tid !== id);
    if (appLibrary.activeNotebookId === id) appLibrary.activeNotebookId = appLibrary.openTabIds[0];
    persistLibrary(); renderOpenTabsBar(); renderAll();
}

function toggleQuickOpenTabMenu(ev) {
    if (ev) ev.stopPropagation();
    const menu = document.getElementById('quickTabPickerMenu');
    if (!menu) return;
    if (!menu.classList.contains('hidden')) { menu.classList.add('hidden'); return; }
    menu.innerHTML = appLibrary.notebooks.map(nb => `
        <div class="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800 text-xs">
            <button onclick="switchActiveNotebook('${nb.id}'); document.getElementById('quickTabPickerMenu').classList.add('hidden');" class="text-left flex-1 font-semibold text-slate-200 truncate">${nb.title}</button>
            <button onclick="openNotebookInSplitRight('${nb.id}'); document.getElementById('quickTabPickerMenu').classList.add('hidden');" class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">◫</button>
        </div>
    `).join('');
    menu.classList.remove('hidden');
}

function toggleSplitViewMode(force) {
    const sv = appLibrary.splitView;
    sv.enabled = typeof force === 'boolean' ? force : !sv.enabled;
    if (sv.enabled && !sv.rightNotebookId) {
        const other = appLibrary.notebooks.find(n => n.id !== appLibrary.activeNotebookId) || appLibrary.notebooks[0];
        sv.rightNotebookId = other.id;
    }
    document.getElementById('secondarySplitPane')?.classList.toggle('hidden', !sv.enabled);
    document.getElementById('splitViewToggleBtn')?.classList.toggle('active', sv.enabled);
    if (typeof resizeCanvas === 'function') resizeCanvas();
}

function openNotebookInSplitRight(nbId) {
    appLibrary.splitView.rightNotebookId = nbId;
    appLibrary.splitView.rightPageIndex = 0;
    const nb = appLibrary.notebooks.find(n => n.id === nbId);
    if (nb) {
        nb.lastOpenedAt = Date.now();
        persistLibrary();
    }
    toggleSplitViewMode(true);
}

function changeSplitRightNotebook(nbId) {
    appLibrary.splitView.rightNotebookId = nbId;
    appLibrary.splitView.rightPageIndex = 0;
    if (typeof renderSplitRightPane === 'function') renderSplitRightPane();
}

function stepSplitRightPage(dir) {
    const sv = appLibrary.splitView;
    const nb = appLibrary.notebooks.find(n => n.id === sv.rightNotebookId) || getActiveNotebook();
    sv.rightPageIndex = Math.max(0, Math.min(nb.pages.length - 1, (sv.rightPageIndex || 0) + dir));
    if (typeof renderSplitRightPane === 'function') renderSplitRightPane();
}

function swapSplitNotebooks() {
    const sv = appLibrary.splitView;
    if (!sv.rightNotebookId) return;
    const oldLeft = appLibrary.activeNotebookId;
    switchActiveNotebook(sv.rightNotebookId);
    sv.rightNotebookId = oldLeft;
    if (typeof renderSplitRightPane === 'function') renderSplitRightPane();
}

/* CHỌN BÚT, ẢNH & CÔNG CỤ HÓA HỌC */
let isPageHudExpanded = false;

function closeAllPopovers() {
    ['appSettingsMenuPopover','paperTemplatePopover','bondLengthPopover','ringHubPopover','stereoHubPopover','arrowHubPopover','specialHubPopover','labEquipmentPopover','presenterPopover','substituentModal','quickTabPickerMenu','penSettingsPopover','colorPalettePopover','penPillConfigPopover','navyToolbarConfigPopover','appThemePopover','toolInfoTooltipCard'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
    if (typeof closeAtomHandwritingBox === 'function' && typeof atomHwState !== 'undefined' && atomHwState.open && (typeof atomHwPinned === 'undefined' || !atomHwPinned)) {
        closeAtomHandwritingBox();
    }
    if (typeof closeAssistiveMenu === 'function') closeAssistiveMenu();
    document.getElementById('presentationHoverZone')?.classList?.remove('dock-pinned');
    if (isPageHudExpanded && appLibrary.ipadConfig?.pageHudCompact !== false) {
        isPageHudExpanded = false;
        if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
    }
}

function selectPillCarbonMode(ev) {
    if (ev) ev.stopPropagation();
    closeAllPopovers();
    if (window.unifiedTool === 'chem_bond') {
        selectPillPenMode('ballpoint');
        if (typeof showGestureToast === 'function') showGestureToast('✒️ Đã chuyển nhanh về Bút máy Notewise');
        return;
    }
    selectChemDrawTool('chem_bond');
}

function selectPillPenMode(mode, ev) {
    const canSettings = mode === 'ballpoint' || mode === 'highlighter' || mode === 'eraser';
    if (canSettings && window.unifiedTool === 'pen_' + mode) {
        if (ev) ev.stopPropagation();
        togglePenSettingsPopover(ev?.currentTarget || document.getElementById('sp-' + mode));
        return;
    }
    closeAllPopovers();
    if (mode !== 'eraser' && mode !== 'pan') {
        previousToolBeforeEraser = 'pen_' + mode;
    } else if (mode === 'eraser') {
        eraserRadius = (typeof eraserSlotRadii !== 'undefined' && eraserSlotRadii[activeEraserSlot]) || 24;
    }
    if (mode === 'highlighter' && typeof highlighterSlotWidths !== 'undefined') {
        highlighterWidth = highlighterSlotWidths[activeHighlighterSlot] || 14;
    }
    if (mode !== 'laser') {
        laserStrokes = [];
        currentLaserStroke = null;
    }
    if (mode !== 'lasso' && typeof clearLassoSelection === 'function') clearLassoSelection();
    if (mode !== 'image') clearActiveImageSelection(false);
    if (typeof clearActiveRingGizmo === 'function') clearActiveRingGizmo(false);
    if (typeof clearActiveCarbonChain === 'function') clearActiveCarbonChain(false);
    if (typeof cancelAtomHoldTimer === 'function') cancelAtomHoldTimer(true);
    window.unifiedTool = 'pen_' + mode;
    updateToolButtonsUI();
    renderAll();
}

function toggleDoubleTapEraser() {
    if (window.unifiedTool !== 'pen_eraser') {
        previousToolBeforeEraser = window.unifiedTool || 'pen_ballpoint';
        selectPillPenMode('eraser');
        if (typeof showGestureToast === 'function') {
            showGestureToast(`Chạm 2 lần: Đã bật Tẩy (${eraserRadius} px)`);
        }
    } else {
        const prev = previousToolBeforeEraser && previousToolBeforeEraser !== 'pen_eraser'
            ? previousToolBeforeEraser
            : 'pen_ballpoint';
        if (prev.startsWith('pen_')) {
            selectPillPenMode(prev.replace('pen_', ''));
        } else {
            selectChemDrawTool(prev);
        }
        if (typeof showGestureToast === 'function') {
            showGestureToast('Chạm 2 lần: Quay lại công cụ trước');
        }
    }
}

function handleImageToolBtnClick(ev) {
    if (ev) ev.stopPropagation();
    closeAllPopovers();
    selectPillPenMode('image');
    triggerInsertImagePicker();
}

function triggerInsertImagePicker() {
    const inp = document.getElementById('pageImageInput');
    if (inp) { inp.value = ''; inp.click(); }
}

function insertDataUrlImageToPage(dataUrl, natW, natH, opts = {}) {
    const doc = getDocState();
    if (!Array.isArray(doc.images)) doc.images = [];
    saveHistorySnapshot();
    const maxInitW = Number.isFinite(opts.maxW) ? opts.maxW : Math.min(420, A4_WIDTH * 0.62);
    const maxInitH = Number.isFinite(opts.maxH) ? opts.maxH : Math.round(A4_HEIGHT * 0.78);
    const safeNatW = Math.max(1, Number(natW) || 400);
    const safeNatH = Math.max(1, Number(natH) || 260);
    const scale = Math.min(1, maxInitW / safeNatW, maxInitH / safeNatH);
    const w = Math.max(60, Math.round(safeNatW * scale));
    const h = Math.max(40, Math.round(safeNatH * scale));
    let x = Math.round((A4_WIDTH - w) / 2);
    let y = Math.max(40, Math.min(A4_HEIGHT - h - 40, Math.round((-panY / zoom - getPageYOffset(getActiveNotebook().activePageIndex || 0)) + 90)));
    if (Number.isFinite(opts.x) && Number.isFinite(opts.y)) {
        const rawX = opts.centerAtPoint ? Math.round(opts.x - w / 2) : Math.round(opts.x);
        const rawY = opts.centerAtPoint ? Math.round(opts.y - h / 2) : Math.round(opts.y);
        x = Math.max(12, Math.min(Math.max(12, A4_WIDTH - w - 12), rawX));
        y = Math.max(16, Math.min(Math.max(16, A4_HEIGHT - h - 16), rawY));
    }
    const imgItem = {
        id: genId('img'),
        src: dataUrl,
        x, y, w, h,
        fromExam: !!opts.fromExam,
        locked: !!opts.locked
    };
    doc.images.push(imgItem);
    if (imgItem.locked) {
        activeImageSelection = { id: null, dragMode: null, startMouse: null, origX: 0, origY: 0, origW: 0, origH: 0 };
        const fallbackTool = (typeof previousToolBeforeEraser === 'string' && previousToolBeforeEraser && previousToolBeforeEraser !== 'pen_image')
            ? previousToolBeforeEraser : 'pen_ballpoint';
        window.unifiedTool = fallbackTool;
    } else {
        activeImageSelection = { id: imgItem.id, dragMode: null, startMouse: null, origX: x, origY: y, origW: w, origH: h };
        window.unifiedTool = 'pen_image';
    }
    updateToolButtonsUI();
    updateImageFloatingBarPos();
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    persistLibrary();
    renderAll();
    return imgItem;
}

function handleInsertImageFile(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const maxDim = 1200;
            let tw = img.width || 300, th = img.height || 200;
            if (tw > maxDim || th > maxDim) {
                const r = Math.min(maxDim / tw, maxDim / th);
                tw = Math.round(tw * r); th = Math.round(th * r);
            }
            const off = document.createElement('canvas');
            off.width = tw; off.height = th;
            off.getContext('2d').drawImage(img, 0, 0, tw, th);
            insertDataUrlImageToPage(off.toDataURL('image/jpeg', 0.88), tw, th);
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

window.addEventListener('paste', e => {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
            const file = it.getAsFile();
            if (file) {
                if (typeof examDrawerState !== 'undefined' && examDrawerState.open && typeof handleExamFilesSelected === 'function') {
                    handleExamFilesSelected({ target: { files: [file] } });
                } else {
                    handleInsertImageFile({ target: { files: [file] } });
                }
            }
            break;
        }
    }
});

function getSelectedImageObj() {
    if (!activeImageSelection.id) return null;
    return (getDocState().images || []).find(im => im.id === activeImageSelection.id) || null;
}

function updateImageFloatingBarPos() {
    const bar = document.getElementById('imageFloatingBar');
    const im = getSelectedImageObj();
    if (!bar || !im) { bar?.classList.add('hidden'); return; }
    const pageY = getPageYOffset(getActiveNotebook().activePageIndex || 0);
    const sx = panX + (im.x + im.w / 2) * zoom;
    const sy = panY + (pageY + im.y) * zoom - 40;
    bar.style.left = `${Math.max(150, Math.min(cssWidth - 150, sx))}px`;
    bar.style.top = `${Math.max(8, Math.min(cssHeight - 55, sy))}px`;
    const locked = !!im.locked;
    const lockBtn = document.getElementById('imgLockBtn');
    if (lockBtn) {
        lockBtn.classList.toggle('is-locked', locked);
        lockBtn.textContent = locked ? '🔓 Mở khóa' : '📌 Cố định';
        lockBtn.title = locked ? 'Bấm để mở khóa cho phép di chuyển / thu phóng ảnh' : 'Cố định ảnh: khóa kéo trượt & miễn nhiễm với Lasso';
    }
    ['imgScaleDownBtn', 'imgScaleUpBtn', 'imgDupBtn', 'imgDeleteBtn'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.disabled = locked;
    });
    bar.classList.remove('hidden');
}

function toggleSelectedImageLock() {
    const im = getSelectedImageObj();
    if (!im) return;
    saveHistorySnapshot();
    im.locked = !im.locked;
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    if (im.locked) {
        activeImageSelection.dragMode = null;
        if (typeof showGestureToast === 'function') {
            showGestureToast('🔒 Đã cố định ảnh — không thể kéo & miễn nhiễm với khoanh Lasso!');
        }
        clearActiveImageSelection(false);
        if (window.unifiedTool === 'pen_image') {
            const backTool = (typeof previousToolBeforeEraser === 'string' && previousToolBeforeEraser && previousToolBeforeEraser !== 'pen_image')
                ? previousToolBeforeEraser : 'pen_ballpoint';
            if (backTool.startsWith('pen_')) selectPillPenMode(backTool.replace('pen_', ''));
            else selectChemDrawTool(backTool);
        } else {
            updateImageFloatingBarPos();
        }
    } else {
        if (typeof showGestureToast === 'function') showGestureToast('🔓 Đã mở khóa ảnh — có thể kéo chỉnh vị trí');
        updateImageFloatingBarPos();
    }
    persistLibrary(true);
    renderAll();
}

function clearActiveImageSelection(render = true) {
    activeImageSelection.id = null;
    activeImageSelection.dragMode = null;
    document.getElementById('imageFloatingBar')?.classList.add('hidden');
    if (render && typeof renderAll === 'function') renderAll();
}

function scaleSelectedImageBy(f) {
    const im = getSelectedImageObj();
    if (!im) return;
    if (im.locked) {
        if (typeof showGestureToast === 'function') showGestureToast('Ảnh đang cố định — bấm 🔓 Mở khóa để thu phóng');
        return;
    }
    saveHistorySnapshot();
    const cx = im.x + im.w / 2, cy = im.y + im.h / 2;
    im.w = Math.max(50, Math.min(A4_WIDTH * 0.96, im.w * f));
    im.h = Math.max(40, Math.min(A4_HEIGHT * 0.96, im.h * f));
    im.x = cx - im.w / 2; im.y = cy - im.h / 2;
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    updateImageFloatingBarPos(); persistLibrary(); renderAll();
}

function duplicateSelectedImage() {
    const im = getSelectedImageObj();
    if (!im) return;
    if (im.locked) {
        if (typeof showGestureToast === 'function') showGestureToast('Ảnh đang cố định — bấm 🔓 Mở khóa để nhân bản');
        return;
    }
    saveHistorySnapshot();
    const copy = { ...im, id: genId('img'), locked: false, x: im.x + 24, y: im.y + 24 };
    getDocState().images.push(copy);
    activeImageSelection.id = copy.id;
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    updateImageFloatingBarPos(); persistLibrary(); renderAll();
}

function deleteSelectedImage() {
    const im = getSelectedImageObj();
    if (!activeImageSelection.id || !im) return;
    if (im.locked) {
        if (typeof showGestureToast === 'function') showGestureToast('Ảnh đang cố định — hãy bấm 🔓 Mở khóa trước khi xóa');
        return;
    }
    saveHistorySnapshot();
    const doc = getDocState();
    doc.images = (doc.images || []).filter(item => item.id !== activeImageSelection.id);
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    clearActiveImageSelection(true); persistLibrary();
}

function selectChemDrawTool(toolName) {
    previousToolBeforeEraser = toolName;
    laserStrokes = [];
    currentLaserStroke = null;
    if (typeof clearLassoSelection === 'function') clearLassoSelection();
    clearActiveImageSelection(false);
    if (toolName !== 'chem_ring' && toolName !== 'chem_conformer' && toolName !== 'chem_move' && typeof clearActiveRingGizmo === 'function') clearActiveRingGizmo(false);
    if (toolName !== 'chem_bond' && toolName !== 'chem_conformer' && toolName !== 'chem_move' && typeof clearActiveCarbonChain === 'function') clearActiveCarbonChain(false);
    if (typeof cancelAtomHoldTimer === 'function') cancelAtomHoldTimer(true);
    window.unifiedTool = toolName;
    updateToolButtonsUI();
    renderAll();
}

function updateToolButtonsUI() {
    const t = window.unifiedTool;
    ['pan','ballpoint','highlighter','eraser','image','lasso','laser'].forEach(m => {
        document.getElementById('sp-' + m)?.classList.toggle('active', t === 'pen_' + m);
    });
    document.getElementById('sp-carbon')?.classList.toggle('active', t === 'chem_bond');
    ['chem_move','chem_bond','chem_text'].forEach(k => {
        document.getElementById('cd-' + k)?.classList.toggle('active', t === k);
    });
    document.getElementById('cd-chem_stereo_hub')?.classList.toggle('active', t === 'chem_wedge' || t === 'chem_dash');
    document.getElementById('cd-chem_ring_hub')?.classList.toggle('active', t === 'chem_ring' || t === 'chem_snippet');
    document.getElementById('cd-chem_arrow_hub')?.classList.toggle('active', t === 'chem_rxn_arrow' || t === 'chem_mech_arrow');
    document.getElementById('cd-chem_special_hub')?.classList.toggle('active', t === 'chem_conformer' || t === 'chem_orbital' || t === 'chem_symbol');
    document.getElementById('stereoBtnWedge')?.classList.toggle('active', t === 'chem_wedge' || (t !== 'chem_dash' && activeStereoBondType === 'chem_wedge'));
    document.getElementById('stereoBtnDash')?.classList.toggle('active', t === 'chem_dash' || (t !== 'chem_wedge' && activeStereoBondType === 'chem_dash'));
    ['pan', 'ballpoint', 'highlighter', 'laser', 'eraser'].forEach(m => {
        document.getElementById('pres-' + m)?.classList.toggle('active', t === 'pen_' + m);
    });
    document.getElementById('pres-chem_bond')?.classList.toggle('active', t === 'chem_bond');
    syncStrokeOrEraserSlotsUI();
    renderFavoriteColorWells();
    renderRecentGroupsBar();
    if (typeof updateCanvasCursor === 'function') updateCanvasCursor();
}

function syncStrokeOrEraserSlotsUI() {
    const isEraser = window.unifiedTool === 'pen_eraser';
    const isHighlighter = window.unifiedTool === 'pen_highlighter';
    const penTitles = { 1: 'Nét mảnh', 2: 'Nét vừa', 3: 'Nét đậm' };
    const penDefaultWidths = { 1: 1.8, 2: 2.8, 3: 5.0 };
    const hlNames = { 1: 'mảnh', 2: 'vừa', 3: 'to' };
    const hlDefaults = { 1: 8, 2: 14, 3: 24 };
    const eraserNames = { 1: 'nhỏ', 2: 'vừa', 3: 'lớn' };
    const eraserDefaults = { 1: 12, 2: 24, 3: 42 };
    const hlPreviewCol = (typeof highlighterColor === 'string' && highlighterColor) ? highlighterColor : '#fef08a';
    [1, 2, 3].forEach(s => {
        const btn = document.getElementById('st-slot-' + s);
        if (!btn) return;
        if (isEraser) {
            const rad = (typeof eraserSlotRadii !== 'undefined' && eraserSlotRadii[s]) || eraserDefaults[s];
            const dotPx = Math.round(Math.max(7, Math.min(20, 4 + rad * 0.32)));
            btn.innerHTML = '<span class="eraser-slot-dot" style="width:' + dotPx + 'px;height:' + dotPx + 'px;"></span>';
            btn.title = 'Vùng tẩy ' + eraserNames[s] + ' (' + rad + ' px) — Nhấn lại để chỉnh';
            btn.classList.toggle('active', s === activeEraserSlot);
        } else if (isHighlighter) {
            const hw = (typeof highlighterSlotWidths !== 'undefined' && highlighterSlotWidths[s]) || hlDefaults[s];
            const barH = Math.max(3, Math.min(11, Math.round(2 + hw * 0.28)));
            btn.innerHTML = '<span class="stroke-line" style="height:' + barH + 'px;background:' + hlPreviewCol + ';opacity:0.95;"></span>';
            btn.title = 'Dạ quang ' + hlNames[s] + ' (' + hw + ' px) — Size & màu riêng cho Dạ quang';
            btn.classList.toggle('active', s === activeHighlighterSlot);
        } else {
            const w = (typeof slotWidths !== 'undefined' && slotWidths[s]) || penDefaultWidths[s];
            const lineH = Math.max(1.5, Math.min(9, w * 1.15));
            btn.innerHTML = '<span class="stroke-line" style="height:' + lineH + 'px;"></span>';
            btn.title = penTitles[s];
            btn.classList.toggle('active', s === activeStrokeSlot);
        }
    });
}

function togglePenSettingsPopover(anchorEl) {
    const p = document.getElementById('penSettingsPopover');
    if (!p) return;
    const isAlreadyOpen = !p.classList.contains('hidden');
    closeAllPopovers();
    if (!isAlreadyOpen) {
        syncPenSettingsPopoverUI();
        const defaultAnchor = window.unifiedTool === 'pen_eraser'
            ? (document.getElementById('sp-eraser') || document.getElementById('sp-ballpoint'))
            : (window.unifiedTool === 'pen_highlighter'
                ? (document.getElementById('sp-highlighter') || document.getElementById('sp-ballpoint'))
                : document.getElementById('sp-ballpoint'));
        positionPopoverUnderButton(p, anchorEl || defaultAnchor);
        p.classList.remove('hidden');
    }
}

function renderPenStyleGrid() {
    const box = document.getElementById('penStyleGrid');
    if (!box) return;
    box.innerHTML = PEN_STYLE_CATALOG.map(ps => `
        <button onclick="pickPenStyle('${ps.id}')" title="${ps.title}" class="icon-only-chip ${activePenStyle === ps.id ? 'active' : ''}">${wrapSvgIcon(ps.svg)}</button>
    `).join('');
}

function pickPenStyle(id) {
    activePenStyle = id;
    if (typeof appLibrary === 'object' && appLibrary) {
        appLibrary.fountainPrimaryV14 = true;
        appLibrary.brushPrimaryV14_2 = true;
        appLibrary.notewiseFountainV15 = true;
    }
    renderPenStyleGrid();
    syncPenSettingsPopoverUI();
    if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(400);
    else if (typeof persistLibrary === 'function') persistLibrary();
    const found = PEN_STYLE_CATALOG.find(p => p.id === id);
    if (found) showGestureToast(found.title);
}

function setFountainNibAngle(deg) {
    appLibrary.fountainNibAngle = deg === 35 ? 35 : 90;
    if (typeof persistLibrary === 'function') persistLibrary();
    syncPenSettingsPopoverUI();
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    if (typeof renderAll === 'function') renderAll();
    if (typeof showGestureToast === 'function') {
        showGestureToast(appLibrary.fountainNibAngle === 90
            ? 'Bút máy Notewise Chuẩn (Thanh–Đậm siêu mượt)'
            : 'Bút máy 35° Nghiêng cổ điển');
    }
}

function syncPenSettingsPopoverUI() {
    const isEraser = window.unifiedTool === 'pen_eraser';
    const isHighlighter = window.unifiedTool === 'pen_highlighter';
    const isPen = !isEraser && !isHighlighter;
    document.getElementById('penSettingsSection')?.classList.toggle('hidden', !isPen);
    document.getElementById('highlighterSettingsSection')?.classList.toggle('hidden', !isHighlighter);
    document.getElementById('eraserSettingsSection')?.classList.toggle('hidden', !isEraser);
    const nibRow = document.getElementById('fountainNibAngleRow');
    if (nibRow) {
        nibRow.classList.toggle('hidden', !isPen || activePenStyle !== 'fountain');
        const deg = appLibrary.fountainNibAngle === 35 ? 35 : 90;
        document.getElementById('nibAngle90Btn')?.classList.toggle('active', deg === 90);
        document.getElementById('nibAngle35Btn')?.classList.toggle('active', deg === 35);
    }

    if (isHighlighter) {
        const hlSlider = document.getElementById('highlighterWidthSlider');
        const hlLbl = document.getElementById('highlighterWidthValLbl');
        if (hlSlider) hlSlider.value = highlighterWidth;
        if (hlLbl) hlLbl.textContent = `${Math.round(highlighterWidth)} px`;
        [1, 2, 3].forEach(s => {
            const pBtn = document.getElementById('hlPresetBtn' + s);
            if (!pBtn) return;
            const label = s === 1 ? 'Mảnh' : (s === 2 ? 'Vừa' : 'To');
            const wVal = highlighterSlotWidths[s] || (s === 1 ? 8 : (s === 2 ? 14 : 24));
            pBtn.textContent = `${label} (${Math.round(wVal)})`;
            pBtn.classList.toggle('active', s === activeHighlighterSlot);
        });
        const hlOpSlider = document.getElementById('highlighterOpacitySlider');
        const hlOpLbl = document.getElementById('highlighterOpacityValLbl');
        const hlOp = (appLibrary.highlighterConfig && typeof appLibrary.highlighterConfig.opacity === 'number')
            ? appLibrary.highlighterConfig.opacity : 0.50;
        if (hlOpSlider) hlOpSlider.value = hlOp;
        if (hlOpLbl) hlOpLbl.textContent = `${Math.round(hlOp * 100)}%`;
        return;
    }

    if (isEraser) {
        const erSlider = document.getElementById('eraserRadiusSlider');
        const erLbl = document.getElementById('eraserRadiusValLbl');
        if (erSlider) erSlider.value = eraserRadius;
        if (erLbl) erLbl.textContent = `${Math.round(eraserRadius)} px`;
        [1, 2, 3].forEach(s => {
            const pBtn = document.getElementById('eraserPresetBtn' + s);
            if (!pBtn) return;
            const label = s === 1 ? 'Nhỏ' : (s === 2 ? 'Vừa' : 'Lớn');
            const rad = eraserSlotRadii[s] || (s === 1 ? 12 : (s === 2 ? 24 : 42));
            pBtn.textContent = `${label} (${rad})`;
            pBtn.classList.toggle('active', s === activeEraserSlot);
        });
        const scribbleBadge = document.getElementById('scribbleEraseBadge');
        if (scribbleBadge) {
            const enabled = appLibrary.scribbleEraseEnabled !== false;
            scribbleBadge.textContent = enabled ? 'BẬT' : 'TẮT';
            scribbleBadge.className = enabled ? 'text-emerald-400 font-extrabold' : 'text-slate-400 font-extrabold';
        }
        return;
    }

    const wSlider = document.getElementById('penWidthSlider');
    const wLbl = document.getElementById('penWidthValLbl');
    if (wSlider) wSlider.value = strokeWidth;
    if (wLbl) wLbl.textContent = `${Number(strokeWidth).toFixed(1)} px`;

    const sSlider = document.getElementById('penSmoothSlider');
    const sLbl = document.getElementById('penSmoothValLbl');
    if (sSlider) sSlider.value = penSmoothing;
    if (sLbl) sLbl.textContent = `${Math.round(penSmoothing * 100)}%`;
    syncSmoothingPresetButtons();

    const oSlider = document.getElementById('penOpacitySlider');
    const oLbl = document.getElementById('penOpacityValLbl');
    if (oSlider) oSlider.value = penOpacity;
    if (oLbl) oLbl.textContent = `${Math.round(penOpacity * 100)}%`;

    const autoPolishBadge = document.getElementById('autoPolishInkBadge');
    if (autoPolishBadge) {
        const polishOn = appLibrary.penAutoRefine !== false;
        autoPolishBadge.textContent = polishOn ? 'BẬT' : 'TẮT';
        autoPolishBadge.className = polishOn ? 'text-emerald-400 font-extrabold' : 'text-slate-400 font-extrabold';
    }
    const holdBadge = document.getElementById('holdToShapeBadge');
    if (holdBadge) {
        const holdOn = appLibrary.holdToShapeEnabled !== false;
        holdBadge.textContent = holdOn ? 'BẬT' : 'TẮT';
        holdBadge.className = holdOn ? 'text-emerald-400 font-extrabold' : 'text-slate-400 font-extrabold';
    }
    const zzBadge = document.getElementById('autoZigZagCarbonBadge');
    if (zzBadge) {
        const zzOn = appLibrary.autoZigZagToCarbon !== false;
        zzBadge.textContent = zzOn ? 'BẬT' : 'TẮT';
        zzBadge.className = zzOn ? 'text-emerald-400 font-extrabold' : 'text-slate-400 font-extrabold';
    }

    renderPenStyleGrid();
}

function onPenWidthChange(val) {
    const v = Math.max(1, Math.min(16, parseFloat(val) || 2.8));
    strokeWidth = v;
    slotWidths[activeStrokeSlot] = v;
    const wLbl = document.getElementById('penWidthValLbl');
    if (wLbl) wLbl.textContent = `${v.toFixed(1)} px`;
    const slotLine = document.querySelector(`#st-slot-${activeStrokeSlot} .stroke-line`);
    if (slotLine) slotLine.style.height = `${Math.max(1.5, Math.min(9, v * 1.15))}px`;
    if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(400);
}

function onEraserRadiusChange(val) {
    const v = Math.max(6, Math.min(72, parseInt(val, 10) || 24));
    eraserRadius = v;
    eraserSlotRadii[activeEraserSlot] = v;
    syncStrokeOrEraserSlotsUI();
    syncPenSettingsPopoverUI();
    persistLibrary();
    if (typeof renderAll === 'function') renderAll();
}

function onHighlighterWidthChange(val) {
    const v = Math.max(4, Math.min(44, parseInt(val, 10) || 14));
    highlighterWidth = v;
    highlighterSlotWidths[activeHighlighterSlot] = v;
    syncStrokeOrEraserSlotsUI();
    syncPenSettingsPopoverUI();
    if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(300);
    else if (typeof persistLibrary === 'function') persistLibrary();
}

function onHighlighterOpacityChange(val) {
    const op = Math.max(0.15, Math.min(0.75, parseFloat(val) || 0.50));
    if (!appLibrary.highlighterConfig || typeof appLibrary.highlighterConfig !== 'object') {
        appLibrary.highlighterConfig = {
            activeSlot: activeHighlighterSlot,
            widths: { ...highlighterSlotWidths },
            opacity: op,
            colors: typeof DEFAULT_HIGHLIGHTER_COLORS !== 'undefined' ? [...DEFAULT_HIGHLIGHTER_COLORS] : ['#fef08a', '#86efac', '#f9a8d4', '#7dd3fc', '#fdba74'],
            activeColorIdx: 0,
            hlPaletteV15_4: true
        };
    } else {
        appLibrary.highlighterConfig.opacity = op;
    }
    syncPenSettingsPopoverUI();
    if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(300);
    else if (typeof persistLibrary === 'function') persistLibrary();
}

function toggleScribbleEraseSetting() {
    appLibrary.scribbleEraseEnabled = !(appLibrary.scribbleEraseEnabled !== false);
    persistLibrary();
    syncPenSettingsPopoverUI();
    showGestureToast(appLibrary.scribbleEraseEnabled ? 'Đã bật: Vẽ nguệch ngoạc xoá nét' : 'Đã tắt: Vẽ nguệch ngoạc xoá nét');
}

function toggleAutoPolishInkSetting() {
    appLibrary.penAutoRefine = !(appLibrary.penAutoRefine !== false);
    if (appLibrary.penAutoRefine && penSmoothing < 0.05) {
        penSmoothing = 0.50;
    }
    appLibrary.smoothModeV15 = true;
    persistLibrary();
    syncPenSettingsPopoverUI();
    showGestureToast(appLibrary.penAutoRefine
        ? 'Đã bật: Chế độ làm mượt & nắn mịn nét chữ'
        : 'Đã tắt: Giữ nét vẽ thô tự nhiên');
}

function toggleHoldToShapeSetting() {
    appLibrary.holdToShapeEnabled = !(appLibrary.holdToShapeEnabled !== false);
    persistLibrary();
    syncPenSettingsPopoverUI();
    showGestureToast(appLibrary.holdToShapeEnabled ? 'Đã bật: Giữ cuối nét → Tự thành hình (Goodnotes)' : 'Đã tắt: Giữ cuối nét → Tự thành hình');
}

function toggleAutoZigZagCarbonSetting() {
    appLibrary.autoZigZagToCarbon = !(appLibrary.autoZigZagToCarbon !== false);
    persistLibrary();
    syncPenSettingsPopoverUI();
    showGestureToast(appLibrary.autoZigZagToCarbon ? 'Đã bật: Vẽ gấp khúc → Tự thành Mạch Carbon' : 'Đã tắt: Vẽ gấp khúc → Tự thành Mạch Carbon');
}

function syncSmoothingPresetButtons() {
    const refineOn = typeof appLibrary === 'undefined' || appLibrary.penAutoRefine !== false;
    const presets = [
        { id: 'smoothPresetBtn0', val: 0 },
        { id: 'smoothPresetBtn30', val: 0.30 },
        { id: 'smoothPresetBtn55', val: 0.55 },
        { id: 'smoothPresetBtn80', val: 0.80 }
    ];
    let bestId = refineOn ? null : 'smoothPresetBtn0';
    if (refineOn) {
        let bestDiff = 0.14;
        presets.forEach(p => {
            const d = Math.abs(penSmoothing - p.val);
            if (d <= bestDiff) { bestDiff = d; bestId = p.id; }
        });
    }
    presets.forEach(p => {
        const btn = document.getElementById(p.id);
        if (btn) btn.classList.toggle('active', p.id === bestId);
    });
}

function setPenSmoothingPreset(val) {
    const v = Math.max(0, Math.min(0.95, parseFloat(val) || 0));
    if (typeof appLibrary === 'object' && appLibrary) {
        appLibrary.penAutoRefine = v > 0;
        appLibrary.smoothModeV15 = true;
    }
    penSmoothing = v;
    syncPenSettingsPopoverUI();
    if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(300);
    else if (typeof persistLibrary === 'function') persistLibrary();
    const label = v === 0 ? 'Chế độ nét thô (0%)' : `Chế độ làm mượt: ${Math.round(v * 100)}%`;
    if (typeof showGestureToast === 'function') showGestureToast(label);
}

function onPenSmoothingChange(val) {
    penSmoothing = Math.max(0, Math.min(0.95, parseFloat(val) || 0));
    if (typeof appLibrary === 'object' && appLibrary) {
        appLibrary.smoothModeV15 = true;
        if (penSmoothing > 0 && appLibrary.penAutoRefine === false) {
            appLibrary.penAutoRefine = true;
        }
    }
    const sLbl = document.getElementById('penSmoothValLbl');
    if (sLbl) sLbl.textContent = `${Math.round(penSmoothing * 100)}%`;
    const sSlider = document.getElementById('penSmoothSlider');
    if (sSlider) sSlider.value = penSmoothing;
    syncSmoothingPresetButtons();
    if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(400);
}

function onPenOpacityChange(val) {
    penOpacity = Math.max(0.2, Math.min(1, parseFloat(val) || 1));
    const oLbl = document.getElementById('penOpacityValLbl');
    if (oLbl) oLbl.textContent = `${Math.round(penOpacity * 100)}%`;
    if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(400);
}

function setQuickStrokeSlot(slot, w, ev, fromPopoverPreset = false, forceHighlighter = false) {
    if (ev) ev.stopPropagation();
    if (window.unifiedTool === 'pen_eraser' && !forceHighlighter) {
        const isSame = activeEraserSlot === slot;
        activeEraserSlot = slot;
        const defaults = { 1: 12, 2: 24, 3: 42 };
        eraserRadius = eraserSlotRadii[slot] || w || defaults[slot] || 24;
        syncStrokeOrEraserSlotsUI();
        syncPenSettingsPopoverUI();
        persistLibrary();
        if (typeof renderAll === 'function') renderAll();
        if (!fromPopoverPreset && isSame) {
            togglePenSettingsPopover(ev?.currentTarget || document.getElementById('st-slot-' + slot));
        } else if (!fromPopoverPreset) {
            closeAllPopovers();
            const lbl = slot === 1 ? 'nhỏ' : (slot === 2 ? 'vừa' : 'lớn');
            if (typeof showGestureToast === 'function') showGestureToast(`Vùng tẩy ${lbl}: ${eraserRadius} px`);
        }
        return;
    }
    if (forceHighlighter || window.unifiedTool === 'pen_highlighter') {
        const isSame = activeHighlighterSlot === slot;
        activeHighlighterSlot = slot;
        const hlDefaults = { 1: 8, 2: 14, 3: 24 };
        highlighterWidth = highlighterSlotWidths[slot] || w || hlDefaults[slot] || 14;
        syncStrokeOrEraserSlotsUI();
        syncPenSettingsPopoverUI();
        persistLibrary();
        if (!fromPopoverPreset && isSame) {
            togglePenSettingsPopover(ev?.currentTarget || document.getElementById('st-slot-' + slot));
        } else if (!fromPopoverPreset) {
            closeAllPopovers();
            const lbl = slot === 1 ? 'mảnh' : (slot === 2 ? 'vừa' : 'to');
            if (typeof showGestureToast === 'function') showGestureToast(`Dạ quang ${lbl}: ${Math.round(highlighterWidth)} px`);
        }
        return;
    }
    const isSame = activeStrokeSlot === slot;
    activeStrokeSlot = slot;
    strokeWidth = slotWidths[slot] || w || 2.8;
    syncStrokeOrEraserSlotsUI();
    syncPenSettingsPopoverUI();
    if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(400);
    if (isSame) {
        togglePenSettingsPopover(ev?.currentTarget || document.getElementById('st-slot-' + slot));
    } else {
        closeAllPopovers();
    }
}

let editingFavoriteColorIdx = 0;
let lastColorSlotTap = { idx: -1, time: 0, isHl: false };

function isHighlighterPaletteActive() {
    return typeof window !== 'undefined' && window.unifiedTool === 'pen_highlighter';
}

function getFavoriteColorsList() {
    const defs = (typeof DEFAULT_FAVORITE_COLORS !== 'undefined') ? DEFAULT_FAVORITE_COLORS : ['#111827', '#0ea5e9', '#fb7185', '#10b981', '#fbbf24'];
    if (!Array.isArray(appLibrary.favoriteColors) || appLibrary.favoriteColors.length < 5) {
        appLibrary.favoriteColors = [...defs];
        appLibrary.brightColorsV14_2 = true;
    } else if (!appLibrary.brightColorsV14_2) {
        const oldMuted = ['#0f172a', '#1d4ed8', '#e11d48', '#047857', '#d97706'];
        const oldLegacy = ['#000000', '#2563eb', '#dc2626', '#16a34a', '#f59e0b'];
        const curLow = appLibrary.favoriteColors.map(c => String(c || '').toLowerCase());
        const matchesMuted = curLow.length === 5 && curLow.every((c, i) => c === oldMuted[i]);
        const matchesLegacy = curLow.length === 5 && curLow.every((c, i) => c === oldLegacy[i]);
        if (matchesMuted || matchesLegacy) {
            appLibrary.favoriteColors = [...defs];
        }
        appLibrary.brightColorsV14_2 = true;
    }
    return appLibrary.favoriteColors;
}

function getHighlighterColorsList() {
    const defs = (typeof DEFAULT_HIGHLIGHTER_COLORS !== 'undefined')
        ? DEFAULT_HIGHLIGHTER_COLORS
        : ['#fef08a', '#86efac', '#f9a8d4', '#7dd3fc', '#fdba74'];
    if (!appLibrary.highlighterConfig || typeof appLibrary.highlighterConfig !== 'object') {
        appLibrary.highlighterConfig = {
            activeSlot: typeof activeHighlighterSlot === 'number' ? activeHighlighterSlot : 2,
            widths: typeof highlighterSlotWidths === 'object' ? { ...highlighterSlotWidths } : { 1: 8, 2: 14, 3: 24 },
            opacity: 0.50,
            colors: [...defs],
            activeColorIdx: 0,
            hlPaletteV15_4: true
        };
    }
    if (!Array.isArray(appLibrary.highlighterConfig.colors) || appLibrary.highlighterConfig.colors.length < 5) {
        appLibrary.highlighterConfig.colors = [...defs];
    }
    return appLibrary.highlighterConfig.colors;
}

function getActiveColorPaletteContext(forceHl = null) {
    const isHl = typeof forceHl === 'boolean' ? forceHl : isHighlighterPaletteActive();
    if (isHl) {
        const list = getHighlighterColorsList();
        let activeIdx = parseInt(appLibrary.highlighterConfig.activeColorIdx, 10);
        if (!Number.isFinite(activeIdx) || activeIdx < 0 || activeIdx >= 5) activeIdx = 0;
        appLibrary.highlighterConfig.activeColorIdx = activeIdx;
        return {
            isHl: true,
            list,
            activeIdx,
            setActiveIdx: (i) => { appLibrary.highlighterConfig.activeColorIdx = i; },
            getActiveColor: () => (typeof highlighterColor === 'string' && highlighterColor) ? highlighterColor : list[activeIdx],
            setActiveColor: (hex) => { highlighterColor = hex; }
        };
    }
    const list = getFavoriteColorsList();
    let activeIdx = parseInt(appLibrary.activeFavoriteColorIdx, 10);
    if (!Number.isFinite(activeIdx) || activeIdx < 0 || activeIdx >= 5) activeIdx = 0;
    appLibrary.activeFavoriteColorIdx = activeIdx;
    return {
        isHl: false,
        list,
        activeIdx,
        setActiveIdx: (i) => { appLibrary.activeFavoriteColorIdx = i; },
        getActiveColor: () => penColor || list[activeIdx],
        setActiveColor: (hex) => { penColor = hex; }
    };
}

function renderFavoriteColorWells() {
    const row = document.getElementById('favColorWellsRow');
    const ctx = getActiveColorPaletteContext();
    const favs = ctx.list;
    const actIdx = ctx.activeIdx;
    const isHl = ctx.isHl;

    if (row) {
        const wellCls = isHl ? 'color-well hl-well' : 'color-well';
        const roleTxt = isHl ? 'Màu Dạ quang' : 'Màu ưa thích';
        row.innerHTML = favs.map((col, idx) => {
            const isAct = idx === actIdx;
            return '<button id="fav-color-' + idx + '" onclick="handleFavoriteColorSlotClick(' + idx + ', event)" oncontextmenu="event.preventDefault(); openFavoriteColorEditor(' + idx + ', event);" class="' + wellCls + (isAct ? ' active' : '') + '" style="background:' + col + ';" title="' + roleTxt + ' #' + (idx + 1) + ' (' + col + ') — Chạm chọn màu, ấn đúp (2 lần nhanh) để đổi màu"></button>';
        }).join('');
        favs.forEach((_, idx) => {
            const btn = document.getElementById('fav-color-' + idx);
            if (!btn || btn.dataset.holdBound) return;
            btn.dataset.holdBound = '1';
            let holdT = null, holdStartX = 0, holdStartY = 0;
            btn.addEventListener('pointerdown', (e) => {
                if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
                holdStartX = e.clientX; holdStartY = e.clientY;
                clearTimeout(holdT);
                holdT = setTimeout(() => {
                    holdT = null;
                    btn.dataset.holdTriggered = '1';
                    openFavoriteColorEditor(idx, { currentTarget: btn, stopPropagation() {} });
                }, 420);
            });
            btn.addEventListener('pointermove', (e) => {
                if (holdT && Math.hypot(e.clientX - holdStartX, e.clientY - holdStartY) > 8) {
                    clearTimeout(holdT); holdT = null;
                }
            });
            const clearHold = () => { if (holdT) { clearTimeout(holdT); holdT = null; } };
            btn.addEventListener('pointerup', clearHold);
            btn.addEventListener('pointercancel', clearHold);
        });
    }

    if (isHl && typeof syncStrokeOrEraserSlotsUI === 'function') {
        syncStrokeOrEraserSlotsUI();
    }

    // Sync top 4 favorite colors on presentation mini-dock
    const presDots = document.querySelectorAll('#presentationMiniDock .pres-dot');
    presDots.forEach((dot, idx) => {
        if (favs[idx]) {
            dot.style.background = favs[idx];
            dot.onclick = () => setQuickPenColor(favs[idx], dot);
        }
    });
}

function handleFavoriteColorSlotClick(idx, ev) {
    if (ev) ev.stopPropagation();
    const btn = document.getElementById('fav-color-' + idx);
    if (btn && btn.dataset.holdTriggered === '1') {
        delete btn.dataset.holdTriggered;
        return;
    }
    const ctx = getActiveColorPaletteContext();
    const safeIdx = Math.max(0, Math.min(4, parseInt(idx, 10) || 0));
    const chosen = ctx.list[safeIdx] || (ctx.isHl ? '#fef08a' : '#111827');
    const nowTap = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
    const isDoubleTap = (
        lastColorSlotTap.idx === safeIdx &&
        lastColorSlotTap.isHl === ctx.isHl &&
        (nowTap - (lastColorSlotTap.time || 0)) <= 380
    );

    const p = document.getElementById('colorPalettePopover');
    const isAlreadyOpenForThis = p && !p.classList.contains('hidden') && editingFavoriteColorIdx === safeIdx;

    ctx.setActiveIdx(safeIdx);
    editingFavoriteColorIdx = safeIdx;
    ctx.setActiveColor(chosen);
    renderFavoriteColorWells();
    if (typeof lassoSelection !== 'undefined' && lassoSelection.active && typeof recolorLassoSelection === 'function') {
        recolorLassoSelection(chosen);
    }

    if (isDoubleTap) {
        lastColorSlotTap = { idx: -1, time: 0, isHl: ctx.isHl };
        if (isAlreadyOpenForThis) {
            closeAllPopovers();
        } else {
            openFavoriteColorEditor(safeIdx, ev);
        }
    } else {
        lastColorSlotTap = { idx: safeIdx, time: nowTap, isHl: ctx.isHl };
        if (p && !p.classList.contains('hidden')) {
            closeAllPopovers();
        }
    }
    persistLibrary();
}

function openFavoriteColorEditor(idx, ev) {
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    const ctx = getActiveColorPaletteContext();
    const safeIdx = Math.max(0, Math.min(4, parseInt(idx, 10) || 0));
    editingFavoriteColorIdx = safeIdx;
    ctx.setActiveIdx(safeIdx);
    ctx.setActiveColor(ctx.list[safeIdx] || ctx.getActiveColor());
    renderFavoriteColorWells();
    const p = document.getElementById('colorPalettePopover');
    if (!p) return;
    closeAllPopovers();
    renderColorPaletteGrid();
    const anchor = ev?.currentTarget || document.getElementById('fav-color-' + safeIdx);
    positionPopoverUnderButton(p, anchor);
    p.classList.remove('hidden');
}

function syncColorSelectionUI(hex) {
    const norm = (hex || '').toLowerCase();
    const ctx = getActiveColorPaletteContext();
    const idxMatch = ctx.list.findIndex(c => c.toLowerCase() === norm);
    if (idxMatch >= 0) ctx.setActiveIdx(idxMatch);
    renderFavoriteColorWells();
    const customInp = document.getElementById('customPenColorInput');
    if (customInp && /^#[0-9a-f]{6}$/i.test(norm)) customInp.value = norm;
    renderColorPaletteGrid();
}

function setQuickPenColor(c, btn) {
    const ctx = getActiveColorPaletteContext();
    ctx.setActiveColor(c);
    syncColorSelectionUI(c);
    if (typeof lassoSelection !== 'undefined' && lassoSelection.active && typeof recolorLassoSelection === 'function') {
        recolorLassoSelection(c);
    }
}

function renderColorPaletteGrid() {
    const titleEl = document.getElementById('colorPaletteEditingTitle');
    const slotStrip = document.getElementById('paletteFavSlotStrip');
    const presetHeading = document.getElementById('colorPresetHeading');
    const ctx = getActiveColorPaletteContext();
    const favs = ctx.list;
    const isHl = ctx.isHl;
    const edIdx = Math.max(0, Math.min(4, editingFavoriteColorIdx || 0));
    if (titleEl) {
        titleEl.textContent = isHl
            ? ('Đổi màu Dạ quang #' + (edIdx + 1))
            : ('Đổi màu Ô ưa thích #' + (edIdx + 1));
    }
    if (presetHeading) {
        presetHeading.textContent = isHl
            ? 'BỘ MÀU DẠ QUANG SÁNG RÕ CHỮ (1 CHẠM ĐỔI 5 Ô)'
            : 'BỘ MÀU TƯƠI SÁNG ĐỀ XUẤT (1 CHẠM ĐỔI 5 Ô)';
    }
    if (slotStrip) {
        slotStrip.innerHTML = favs.map((c, idx) =>
            '<button onclick="openFavoriteColorEditor(' + idx + ', event)" class="fav-slot-chip ' + (idx === edIdx ? 'active' : '') + '" style="background:' + c + ';" title="Chọn ô #' + (idx + 1) + ' để đổi màu"></button>'
        ).join('');
    }
    const customInp = document.getElementById('customPenColorInput');
    const curSlotHex = (favs[edIdx] || ctx.getActiveColor() || (isHl ? '#fef08a' : '#111827')).toLowerCase();
    if (customInp && /^#[0-9a-f]{6}$/i.test(curSlotHex)) customInp.value = curSlotHex;

    const paletteArr = (isHl && typeof HIGHLIGHTER_PALETTE_LIST !== 'undefined') ? HIGHLIGHTER_PALETTE_LIST : COLOR_PALETTE_LIST;
    const box = document.getElementById('colorPaletteGrid');
    if (box) {
        box.innerHTML = paletteArr.map(col =>
            '<button onclick="pickColorFromPalette(\'' + col + '\')" class="palette-swatch-btn ' + (col.toLowerCase() === curSlotHex ? 'active' : '') + '" style="background:' + col + '" title="' + col + '"></button>'
        ).join('');
    }
    const presetsArr = (isHl && typeof HIGHLIGHTER_PRESET_PALETTES !== 'undefined') ? HIGHLIGHTER_PRESET_PALETTES : (typeof COLOR_PRESET_PALETTES !== 'undefined' ? COLOR_PRESET_PALETTES : []);
    const presetBox = document.getElementById('colorPresetStrips');
    if (presetBox && presetsArr.length) {
        presetBox.innerHTML = presetsArr.map(pr =>
            '<button onclick="applyColorPalettePreset(\'' + pr.id + '\')" class="palette-preset-chip">' +
            '<span>' + pr.label + '</span>' +
            '<span class="palette-preset-dots">' + pr.colors.map(c => '<span class="palette-preset-dot" style="background:' + c + '"></span>').join('') + '</span>' +
            '</button>'
        ).join('');
    }
}

function applyColorPalettePreset(presetId) {
    const ctx = getActiveColorPaletteContext();
    const presetsArr = (ctx.isHl && typeof HIGHLIGHTER_PRESET_PALETTES !== 'undefined')
        ? HIGHLIGHTER_PRESET_PALETTES
        : (typeof COLOR_PRESET_PALETTES !== 'undefined' ? COLOR_PRESET_PALETTES : []);
    const preset = presetsArr.find(p => p.id === presetId);
    if (!preset || !Array.isArray(preset.colors)) return;
    const mapped = preset.colors.map(c => c.toLowerCase());
    if (ctx.isHl) {
        appLibrary.highlighterConfig.colors = mapped;
        const edIdx = Math.max(0, Math.min(4, appLibrary.highlighterConfig.activeColorIdx || 0));
        highlighterColor = mapped[edIdx] || mapped[0];
    } else {
        appLibrary.favoriteColors = mapped;
        appLibrary.brightColorsV14_2 = true;
        const edIdx = Math.max(0, Math.min(4, appLibrary.activeFavoriteColorIdx || 0));
        penColor = mapped[edIdx] || mapped[0];
    }
    renderFavoriteColorWells();
    renderColorPaletteGrid();
    persistLibrary(true);
    if (typeof lassoSelection !== 'undefined' && lassoSelection.active && typeof recolorLassoSelection === 'function') {
        recolorLassoSelection(ctx.isHl ? highlighterColor : penColor);
    }
    if (typeof showGestureToast === 'function') showGestureToast('Đã áp dụng bảng màu: ' + preset.label);
}

function toggleColorPalettePopover(ev) {
    const ctx = getActiveColorPaletteContext();
    openFavoriteColorEditor(ctx.activeIdx || 0, ev);
}

function pickColorFromPalette(hex) {
    const ctx = getActiveColorPaletteContext();
    const clean = /^#[0-9a-fA-F]{6}$/.test(hex || '') ? hex.toLowerCase() : (ctx.isHl ? '#fef08a' : '#111827');
    const edIdx = Math.max(0, Math.min(4, editingFavoriteColorIdx || 0));
    ctx.list[edIdx] = clean;
    ctx.setActiveIdx(edIdx);
    ctx.setActiveColor(clean);
    renderFavoriteColorWells();
    renderColorPaletteGrid();
    persistLibrary(true);
    if (typeof lassoSelection !== 'undefined' && lassoSelection.active && typeof recolorLassoSelection === 'function') {
        recolorLassoSelection(clean);
    }
}

/* POPOVER & NHÓM THẾ */
function ensureActivePageConfig(pg) {
    if (!pg) pg = getActivePage();
    const cfg = getPagePaperConfig(pg);
    pg.template = cfg.template;
    pg.pageConfig = {
        sizeId: cfg.sizeId,
        width: cfg.width,
        height: cfg.height,
        bgColor: cfg.bgColor,
        spacing: cfg.spacing,
        lineOpacity: cfg.lineOpacity
    };
    return pg.pageConfig;
}

function syncPaperSettingsPopoverUI() {
    const pg = getActivePage();
    const cfg = getPagePaperConfig(pg);

    document.querySelectorAll('#paperTemplateGrid [data-tpl]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tpl === cfg.template);
    });

    const szGrid = document.getElementById('paperSizeGrid');
    if (szGrid) {
        szGrid.innerHTML = PAPER_SIZE_CATALOG.map(sz => `
            <button onclick="setPaperSizePreset('${sz.id}')" class="chip-btn flex-col !h-auto !py-1.5 ${cfg.sizeId === sz.id ? 'active' : ''}">
                <span class="text-[11px] font-bold">${sz.title}</span>
                <span class="text-[9px] opacity-65 font-medium">${sz.width}×${sz.height}</span>
            </button>
        `).join('');
    }

    const bgGrid = document.getElementById('paperBgColorGrid');
    if (bgGrid) {
        const normBg = (cfg.bgColor || '').toLowerCase();
        bgGrid.innerHTML = PAPER_COLOR_PRESETS.map(pc => `
            <button onclick="setPaperBgColor('${pc.hex}')" title="${pc.title}" class="paper-bg-swatch ${pc.hex.toLowerCase() === normBg ? 'active' : ''}" style="background:${pc.hex}"></button>
        `).join('');
    }
    const bgInp = document.getElementById('customPaperBgInput');
    if (bgInp && /^#[0-9a-f]{6}$/i.test(cfg.bgColor)) bgInp.value = cfg.bgColor;

    const spSld = document.getElementById('paperSpacingSlider');
    const spLbl = document.getElementById('paperSpacingValLbl');
    if (spSld) spSld.value = cfg.spacing;
    if (spLbl) spLbl.textContent = `${cfg.spacing} px`;

    const opSld = document.getElementById('paperLineOpacitySlider');
    const opLbl = document.getElementById('paperLineOpacityValLbl');
    if (opSld) opSld.value = cfg.lineOpacity;
    if (opLbl) opLbl.textContent = `${Math.round(cfg.lineOpacity * 100)}%`;

    const autoOn = appLibrary.autoAddPage !== false;
    const autoBtn = document.getElementById('autoAddPageToggleBtn');
    if (autoBtn) {
        autoBtn.textContent = autoOn ? 'Đang bật' : 'Đang tắt';
        autoBtn.classList.toggle('active', autoOn);
    }
}

function togglePaperTemplatePopover(ev) {
    if (ev) ev.stopPropagation();
    const p = document.getElementById('paperTemplatePopover');
    if (!p) return;
    const wasHidden = p.classList.contains('hidden');
    closeAllPopovers();
    if (wasHidden) {
        syncPaperSettingsPopoverUI();
        positionPopoverUnderButton(p, ev?.currentTarget);
        p.classList.remove('hidden');
    }
}

function setPaperTemplate(tpl) {
    const pg = getActivePage();
    ensureActivePageConfig(pg);
    pg.template = tpl;
    syncPaperSettingsPopoverUI();
    persistLibrary(); renderAll();
}

function setPaperSizePreset(sizeId) {
    const sz = PAPER_SIZE_CATALOG.find(s => s.id === sizeId);
    if (!sz) return;
    const pg = getActivePage();
    const pc = ensureActivePageConfig(pg);
    pc.sizeId = sz.id;
    pc.width = sz.width;
    pc.height = sz.height;
    syncActivePaperDimensions();
    syncPaperSettingsPopoverUI();
    persistLibrary();
    if (typeof fitA4ToScreen === 'function') fitA4ToScreen();
    showGestureToast(`${sz.title} (${sz.width}×${sz.height})`);
}

function setPaperBgColor(hex) {
    const pg = getActivePage();
    const pc = ensureActivePageConfig(pg);
    pc.bgColor = hex;
    syncPaperSettingsPopoverUI();
    persistLibrary(); renderAll();
}

function onPaperSpacingChange(val) {
    const v = Math.max(14, Math.min(60, parseInt(val, 10) || 28));
    const pg = getActivePage();
    const pc = ensureActivePageConfig(pg);
    pc.spacing = v;
    const spSld = document.getElementById('paperSpacingSlider');
    const spLbl = document.getElementById('paperSpacingValLbl');
    if (spSld) spSld.value = v;
    if (spLbl) spLbl.textContent = `${v} px`;
    persistLibrary(); renderAll();
}

function onPaperLineOpacityChange(val) {
    const v = Math.max(0.10, Math.min(0.70, parseFloat(val) || 0.28));
    const pg = getActivePage();
    const pc = ensureActivePageConfig(pg);
    pc.lineOpacity = Number(v.toFixed(2));
    const opSld = document.getElementById('paperLineOpacitySlider');
    const opLbl = document.getElementById('paperLineOpacityValLbl');
    if (opSld) opSld.value = pc.lineOpacity;
    if (opLbl) opLbl.textContent = `${Math.round(pc.lineOpacity * 100)}%`;
    persistLibrary(); renderAll();
}

function applyPaperSettingsToAllPages() {
    const nb = getActiveNotebook();
    const cur = getActivePage();
    const pc = ensureActivePageConfig(cur);
    (nb.pages || []).forEach(pg => {
        pg.template = cur.template;
        pg.pageConfig = { ...pc };
    });
    syncActivePaperDimensions();
    persistLibrary();
    if (typeof fitA4ToScreen === 'function') fitA4ToScreen();
    showGestureToast(`Đã áp dụng cài đặt giấy cho ${nb.pages.length} trang`);
}

function syncBondLengthPopoverUI() {
    const val = Math.max(22, Math.min(90, parseInt(BOND_LENGTH, 10) || 44));
    BOND_LENGTH = val;
    const badge = document.getElementById('toolbarBondLenBadge');
    if (badge) badge.textContent = String(val);
    const lbl = document.getElementById('bondLenValLabel');
    if (lbl) lbl.textContent = `${val} px`;
    const slider = document.getElementById('bondLenSlider');
    if (slider) slider.value = String(val);
    document.querySelectorAll('#bondLengthPopover [data-bondlen]').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.bondlen, 10) === val);
    });
}

function handleBondToolBtnClick(ev) {
    ev?.stopPropagation?.();
    if (window.unifiedTool === 'chem_bond') {
        const p = document.getElementById('bondLengthPopover');
        if (!p) return;
        const hide = !p.classList.contains('hidden');
        closeAllPopovers();
        if (!hide) {
            syncBondLengthPopoverUI();
            if (typeof positionPopoverUnderButton === 'function') {
                positionPopoverUnderButton(p, ev?.currentTarget || document.getElementById('cd-chem_bond'));
            }
            p.classList.remove('hidden');
        }
    } else {
        closeAllPopovers();
        selectChemDrawTool('chem_bond');
        syncBondLengthPopoverUI();
    }
}

function setBondLengthValue(v, closePop = true) {
    const num = Math.max(22, Math.min(90, parseInt(v, 10) || 44));
    BOND_LENGTH = num;
    appLibrary.bondLength = num;
    syncBondLengthPopoverUI();
    persistLibrary();
    if (typeof renderAll === 'function') renderAll();
    if (closePop) closeAllPopovers();
    showGestureToast(`Độ dài C–C: ${num} px`);
}

function formatChemSubHTML(lbl) {
    return `<span>${lbl.replace(/([A-Za-z])(\d+)/g, '$1<sub>$2</sub>')}</span>`;
}
function wrapSvgIcon(inner) {
    return `<svg viewBox="0 0 24 24" fill="none">${inner}</svg>`;
}

function buildRingPreviewGeom(type) {
    const R = 20;
    const pts = [], edges = [];
    const isPoly = typeof POLYCYCLIC_RING_TYPES !== 'undefined' && POLYCYCLIC_RING_TYPES.has(type);
    if (!isPoly) {
        const cfg = typeof getRingConfig === 'function' ? getRingConfig(type) : { n: 6, dbl: [], hetero: {} };
        const n = cfg.n;
        const rad = R / (2 * Math.sin(Math.PI / n));
        for (let i = 0; i < n; i++) {
            const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
            pts.push({ x: rad * Math.cos(ang), y: rad * Math.sin(ang), label: cfg.hetero[i] || 'C' });
        }
        for (let i = 0; i < n; i++) {
            edges.push({ i1: i, i2: (i + 1) % n, order: cfg.dbl.includes(i) ? 2 : 1 });
        }
        return { pts, edges };
    }

    const r6 = R;
    const dCenter = r6 * Math.cos(Math.PI / 6);
    const addHex = (rcx, rcy, reuseMap = {}, dblIdx = [], heteroMap = {}) => {
        const indices = [];
        for (let i = 0; i < 6; i++) {
            if (reuseMap[i] !== undefined) { indices.push(reuseMap[i]); continue; }
            const ang = -Math.PI / 2 + i * (Math.PI / 3);
            pts.push({ x: rcx + r6 * Math.cos(ang), y: rcy + r6 * Math.sin(ang), label: heteroMap[i] || 'C' });
            indices.push(pts.length - 1);
        }
        for (let i = 0; i < 6; i++) {
            if (reuseMap[i] !== undefined && reuseMap[(i + 1) % 6] !== undefined) continue;
            edges.push({ i1: indices[i], i2: indices[(i + 1) % 6], order: dblIdx.includes(i) ? 2 : 1 });
        }
        return indices;
    };
    const addFused5 = (idx1, idx2, hetero5 = {}, dbl5 = [3]) => {
        const a1 = pts[idx1], a2 = pts[idx2];
        const mx = (a1.x + a2.x) / 2, my = (a1.y + a2.y) / 2;
        const edgeLen = Math.hypot(a2.x - a1.x, a2.y - a1.y) || R;
        const ap5 = edgeLen / (2 * Math.tan(Math.PI / 5));
        const r5 = edgeLen / (2 * Math.sin(Math.PI / 5));
        const rCx = mx + ap5, rCy = my;
        const ang1 = Math.atan2(a1.y - rCy, a1.x - rCx);
        const v5 = [idx1, idx2];
        for (let k = 2; k < 5; k++) {
            const ang = ang1 - k * (2 * Math.PI / 5);
            pts.push({ x: rCx + r5 * Math.cos(ang), y: rCy + r5 * Math.sin(ang), label: hetero5[k] || 'C' });
            v5.push(pts.length - 1);
        }
        for (let k = 1; k < 5; k++) {
            edges.push({ i1: v5[k], i2: v5[(k + 1) % 5], order: dbl5.includes(k) ? 2 : 1 });
        }
    };

    if (type === 'naphthalene' || type === 'quinoline' || type === 'isoquinoline') {
        const left = addHex(-dCenter, 0, {}, [1, 3, 5]);
        const rh = type === 'quinoline' ? { 3: 'N' } : (type === 'isoquinoline' ? { 2: 'N' } : {});
        addHex(dCenter, 0, { 4: left[2], 5: left[1] }, [0, 2], rh);
    } else if (type === 'anthracene') {
        const r1 = addHex(-2 * dCenter, 0, {}, [1, 3, 5]);
        const r2 = addHex(0, 0, { 4: r1[2], 5: r1[1] }, [0, 2]);
        addHex(2 * dCenter, 0, { 4: r2[2], 5: r2[1] }, [0, 2]);
    } else if (type === 'phenanthrene') {
        const r1 = addHex(-dCenter, 0.75 * r6, {}, [1, 3, 5]);
        const r2 = addHex(dCenter, 0.75 * r6, { 4: r1[2], 5: r1[1] }, [0, 2]);
        addHex(2 * dCenter, -0.75 * r6, { 3: r2[1], 4: r2[0] }, [1, 5]);
    } else {
        const lh = type === 'purine' ? { 3: 'N', 5: 'N' } : {};
        const left = addHex(-dCenter, 0, {}, [1, 3, 5], lh);
        const h5 = {
            indole: { 2: 'NH' },
            benzofuran: { 2: 'O' },
            benzothiophene: { 2: 'S' },
            benzimidazole: { 2: 'NH', 4: 'N' },
            purine: { 2: 'NH', 4: 'N' }
        };
        addFused5(left[1], left[2], h5[type] || { 2: 'NH' }, [3]);
    }
    return { pts, edges };
}

function renderRingPreviewSVG(ringObj) {
    if (typeof getRingConfig !== 'function') return wrapSvgIcon(ringObj.svg);
    const { pts, edges } = buildRingPreviewGeom(ringObj.id);
    if (!pts.length) return wrapSvgIcon(ringObj.svg);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs) - 12, maxX = Math.max(...xs) + 12;
    const minY = Math.min(...ys) - 12, maxY = Math.max(...ys) + 12;
    const vw = Math.max(40, maxX - minX), vh = Math.max(40, maxY - minY);

    let out = '';
    edges.forEach(e => {
        const p1 = pts[e.i1], p2 = pts[e.i2];
        const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const t1 = p1.label !== 'C' ? Math.min(0.32, 7.2 / len) : 0;
        const t2 = p2.label !== 'C' ? Math.min(0.32, 7.2 / len) : 0;
        const sx = p1.x + dx * t1, sy = p1.y + dy * t1;
        const ex = p2.x - dx * t2, ey = p2.y - dy * t2;
        out += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="currentColor" stroke-width="1.9"/>`;
        if (e.order === 2) {
            const adj = [];
            edges.forEach(oe => {
                if (oe === e) return;
                if (oe.i1 === e.i1 || oe.i1 === e.i2) adj.push(pts[oe.i2]);
                else if (oe.i2 === e.i1 || oe.i2 === e.i2) adj.push(pts[oe.i1]);
            });
            const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
            let side = 1;
            if (adj.length) {
                const avgX = adj.reduce((s, p) => s + p.x, 0) / adj.length;
                const avgY = adj.reduce((s, p) => s + p.y, 0) / adj.length;
                side = ((avgX - mx) * nx + (avgY - my) * ny) >= 0 ? 1 : -1;
            }
            const inset = 3.5 * side;
            const dT1 = Math.max(0.16, t1), dT2 = Math.max(0.16, t2);
            const ix1 = p1.x + dx * dT1 + nx * inset, iy1 = p1.y + dy * dT1 + ny * inset;
            const ix2 = p2.x - dx * dT2 + nx * inset, iy2 = p2.y - dy * dT2 + ny * inset;
            out += `<line x1="${ix1.toFixed(1)}" y1="${iy1.toFixed(1)}" x2="${ix2.toFixed(1)}" y2="${iy2.toFixed(1)}" stroke="currentColor" stroke-width="1.5"/>`;
        }
    });
    pts.forEach(p => {
        if (p.label === 'C') return;
        const fSize = p.label.length > 1 ? 8.2 : 9.5;
        out += `<text x="${p.x.toFixed(1)}" y="${(p.y + 3.0).toFixed(1)}" text-anchor="middle" font-size="${fSize}" font-weight="800" fill="#7dd3fc" stroke="none">${p.label}</text>`;
    });
    return `<svg viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" fill="none">${out}</svg>`;
}

function escapeHTMLAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderSnippetPreviewSVG(snippet) {
    const atoms = snippet?.atoms || [];
    const bonds = snippet?.bonds || [];
    if (!atoms.length) return `<svg viewBox="0 0 40 24" fill="none"></svg>`;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    atoms.forEach(a => {
        if (a.dx < minX) minX = a.dx;
        if (a.dx > maxX) maxX = a.dx;
        if (a.dy < minY) minY = a.dy;
        if (a.dy > maxY) maxY = a.dy;
    });
    const pad = 12;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const vw = Math.max(40, maxX - minX);
    const vh = Math.max(26, maxY - minY);
    let out = '';
    bonds.forEach(b => {
        const p1 = atoms[b.i1], p2 = atoms[b.i2];
        if (!p1 || !p2) return;
        const dx = p2.dx - p1.dx, dy = p2.dy - p1.dy;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        if ((b.order || 1) === 2) {
            out += `<line x1="${(p1.dx + nx * 1.8).toFixed(1)}" y1="${(p1.dy + ny * 1.8).toFixed(1)}" x2="${(p2.dx + nx * 1.8).toFixed(1)}" y2="${(p2.dy + ny * 1.8).toFixed(1)}" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`;
            out += `<line x1="${(p1.dx - nx * 1.8).toFixed(1)}" y1="${(p1.dy - ny * 1.8).toFixed(1)}" x2="${(p2.dx - nx * 1.8).toFixed(1)}" y2="${(p2.dy - ny * 1.8).toFixed(1)}" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`;
        } else if ((b.order || 1) === 3) {
            out += `<line x1="${p1.dx.toFixed(1)}" y1="${p1.dy.toFixed(1)}" x2="${p2.dx.toFixed(1)}" y2="${p2.dy.toFixed(1)}" stroke="currentColor" stroke-width="1.3"/>`;
            out += `<line x1="${(p1.dx + nx * 2.5).toFixed(1)}" y1="${(p1.dy + ny * 2.5).toFixed(1)}" x2="${(p2.dx + nx * 2.5).toFixed(1)}" y2="${(p2.dy + ny * 2.5).toFixed(1)}" stroke="currentColor" stroke-width="1.1"/>`;
            out += `<line x1="${(p1.dx - nx * 2.5).toFixed(1)}" y1="${(p1.dy - ny * 2.5).toFixed(1)}" x2="${(p2.dx - nx * 2.5).toFixed(1)}" y2="${(p2.dy - ny * 2.5).toFixed(1)}" stroke="currentColor" stroke-width="1.1"/>`;
        } else {
            out += `<line x1="${p1.dx.toFixed(1)}" y1="${p1.dy.toFixed(1)}" x2="${p2.dx.toFixed(1)}" y2="${p2.dy.toFixed(1)}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`;
        }
    });
    atoms.forEach(a => {
        if (!a.label || a.label === 'C') return;
        const fSize = a.label.length > 2 ? 7.2 : (a.label.length > 1 ? 8.2 : 9.2);
        out += `<text x="${a.dx.toFixed(1)}" y="${(a.dy + 3.0).toFixed(1)}" text-anchor="middle" font-size="${fSize}" font-weight="800" fill="#fbbf24" stroke="none">${escapeHTMLAttr(a.label)}</text>`;
    });
    return `<svg viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" fill="none">${out}</svg>`;
}

function renderCustomSnippetsGrid() {
    const sec = document.getElementById('customSnippetsSection');
    const grid = document.getElementById('customSnippetsGrid');
    if (!sec || !grid) return;
    const all = Array.isArray(appLibrary.customSnippets) ? appLibrary.customSnippets : [];
    const q = (document.getElementById('ringSearchInput')?.value || '').trim().toLowerCase();
    const list = all.filter(s => !q || (s.title || '').toLowerCase().includes(q));
    if (!all.length || (!list.length && q)) {
        sec.classList.add('hidden');
        grid.innerHTML = '';
        return;
    }
    sec.classList.remove('hidden');
    grid.innerHTML = list.map(s => {
        const safeId = String(s.id).replace(/'/g, "\\'");
        const isAct = window.unifiedTool === 'chem_snippet' && activeSnippetId === s.id;
        return `
            <div class="snippet-card-wrap">
                <button onclick="pickCustomSnippetTool('${safeId}')" title="${escapeHTMLAttr(s.title || 'Mẫu cấu trúc')}" class="ring-horiz-card w-full pr-7 ${isAct ? 'active' : ''}">
                    <span class="ring-card-title">${escapeHTMLAttr(s.title || 'Mẫu cấu trúc')}</span>
                    <span class="ring-card-svg">${renderSnippetPreviewSVG(s)}</span>
                </button>
                <button onclick="deleteCustomSnippet('${safeId}', event)" class="snippet-del-btn" title="Xóa mẫu này">✕</button>
            </div>
        `;
    }).join('');
}

function renderRingHubGrid() {
    renderCustomSnippetsGrid();
    const grid = document.getElementById('ringHubGrid');
    if (!grid) return;
    const q = (document.getElementById('ringSearchInput')?.value || '').trim().toLowerCase();
    const list = RING_CATALOG.filter(r => !q || (r.title || '').toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    grid.innerHTML = list.map(r => `
        <button onclick="pickRingTool('${r.id}')" title="${r.title || r.id}" class="ring-horiz-card ${window.unifiedTool !== 'chem_snippet' && activeRingType === r.id ? 'active' : ''}">
            <span class="ring-card-title">${r.title || r.id}</span>
            <span class="ring-card-svg">${renderRingPreviewSVG(r)}</span>
        </button>
    `).join('');
}

function initAllPopoverGrids() {
    renderRingHubGrid();
    document.getElementById('rxnArrowGrid').innerHTML = RXN_ARROW_CATALOG.map(a => `<button onclick="pickRxnArrow('${a.id}')" class="icon-only-chip ${activeRxnArrowType===a.id?'active':''}">${wrapSvgIcon(a.svg)}</button>`).join('');
    document.getElementById('mechArrowGrid').innerHTML = MECH_ARROW_CATALOG.map(a => `<button onclick="pickMechArrow('${a.id}')" class="icon-only-chip ${activeMechArrowType===a.id?'active':''}">${wrapSvgIcon(a.svg)}</button>`).join('');
    document.getElementById('orbitalGrid').innerHTML = ORBITAL_CATALOG.map(o => `<button onclick="pickOrbital('${o.id}')" class="icon-only-chip ${activeOrbitalType===o.id?'active':''}">${wrapSvgIcon(o.svg)}</button>`).join('');
    document.getElementById('symbolGrid').innerHTML = SYMBOL_CATALOG.map(s => `<button onclick="pickSymbol('${s.id}')" class="icon-only-chip ${activeChemSymTool===s.id?'active':''}">${wrapSvgIcon(s.svg)}</button>`).join('');
    document.getElementById('conformerGrid').innerHTML = CONFORMER_CATALOG.map(c => `<button onclick="pickConformer('${c.id}')" class="icon-only-chip ${activeConformerType===c.id?'active':''}">${wrapSvgIcon(c.svg)}</button>`).join('');
    renderPenStyleGrid();
    syncPenSettingsPopoverUI();
    syncPaperSettingsPopoverUI();
    renderFavoriteColorWells();
    renderColorPaletteGrid();
    attachGlobalToolLongPressInfo();
    renderSubstituentCatalog();
    renderRecentGroupsBar();
    applyAppTheme(appLibrary.appTheme || 'midnight_sky');
    if (typeof applyNavyToolbarLayout === 'function') applyNavyToolbarLayout();
    applyPenPillLayout();
    syncBondLengthPopoverUI();
    syncPageQuickNavUI();
    syncPresentationModeUI();
    applyIpadAccessibilityConfig();
}

function getAvailableSubstituents() {
    const deleted = new Set(appLibrary.deletedSubstituents || []);
    const custom = Array.isArray(appLibrary.customSubstituents) ? appLibrary.customSubstituents : [];
    const merged = [...custom, ...SUBSTITUENTS_LIST];
    const seen = new Set();
    const out = [];
    merged.forEach(g => {
        if (!g || deleted.has(g) || seen.has(g)) return;
        seen.add(g);
        out.push(g);
    });
    return out;
}

function getFavouriteSubstituents() {
    const deleted = new Set(appLibrary.deletedSubstituents || []);
    const favs = Array.isArray(appLibrary.favouriteGroups) ? appLibrary.favouriteGroups : [];
    const seen = new Set();
    return favs.filter(g => {
        if (!g || deleted.has(g) || seen.has(g)) return false;
        seen.add(g);
        return true;
    });
}

let editingQuickGroupSlotIdx = null;

function ensureQuickGroupSlots() {
    const fallback = ['OH', 'NO2', 'OMe', 'Cl', 'Br', 'Ph'];
    if (!Array.isArray(appLibrary.quickGroupSlots) || appLibrary.quickGroupSlots.length !== 6) {
        appLibrary.quickGroupSlots = fallback.slice();
    }
    if (!Array.isArray(appLibrary.lockedGroupSlots) || appLibrary.lockedGroupSlots.length !== 6) {
        appLibrary.lockedGroupSlots = [false, false, false, false, false, false];
    }
    return { slots: appLibrary.quickGroupSlots, locked: appLibrary.lockedGroupSlots };
}

function selectQuickGroupEditSlot(idx, ev) {
    if (ev) ev.stopPropagation();
    const safeIdx = Math.max(0, Math.min(5, parseInt(idx, 10) || 0));
    editingQuickGroupSlotIdx = (editingQuickGroupSlotIdx === safeIdx) ? null : safeIdx;
    renderQuickGroupSlotsStrip();
}

function toggleQuickGroupSlotLock(idx, ev) {
    if (ev) ev.stopPropagation();
    const { slots, locked } = ensureQuickGroupSlots();
    const safeIdx = Math.max(0, Math.min(5, parseInt(idx, 10) || 0));
    locked[safeIdx] = !locked[safeIdx];
    persistLibrary();
    renderQuickGroupSlotsStrip();
    renderRecentGroupsBar();
    if (typeof showGestureToast === 'function') {
        showGestureToast(locked[safeIdx]
            ? `🔒 Đã khoá ô #${safeIdx + 1} (${slots[safeIdx]}) — sẽ không tự đổi`
            : `🔓 Đã mở khoá ô #${safeIdx + 1} (${slots[safeIdx]})`);
    }
}

function renderQuickGroupSlotsStrip() {
    const strip = document.getElementById('quickGroupSlotsStrip');
    const titleEl = document.getElementById('quickGroupEditTitle');
    if (!strip) return;
    const { slots, locked } = ensureQuickGroupSlots();
    if (titleEl) {
        titleEl.textContent = editingQuickGroupSlotIdx !== null
            ? `Đang chỉnh Ô #${editingQuickGroupSlotIdx + 1} (${slots[editingQuickGroupSlotIdx]}) — Bấm nhóm bên dưới để gán vào ô này`
            : '6 ô trên thanh nhanh (Bấm ô để chỉnh riêng từng ô • 🔒 để khoá cố định)';
    }
    strip.innerHTML = slots.map((g, idx) => {
        const isEd = editingQuickGroupSlotIdx === idx;
        const isLk = !!locked[idx];
        return `
            <div class="qg-slot-card">
                <button onclick="selectQuickGroupEditSlot(${idx}, event)" class="qg-slot-btn ${isEd ? 'editing' : ''}" title="Ô #${idx + 1}: ${g} — Bấm để chọn gán nhóm mới">${formatChemSubHTML(g)}</button>
                <button onclick="toggleQuickGroupSlotLock(${idx}, event)" class="qg-slot-lock ${isLk ? 'locked' : ''}" title="${isLk ? 'Đang khoá (bấm để mở)' : 'Bấm để khoá ô này'}">${isLk ? '🔒' : '🔓'}</button>
            </div>
        `;
    }).join('');
}

function openQuickGroupSlotEditor(idx, ev) {
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    editingQuickGroupSlotIdx = Math.max(0, Math.min(5, parseInt(idx, 10) || 0));
    const m = document.getElementById('substituentModal');
    if (!m) return;
    closeAllPopovers();
    renderQuickGroupSlotsStrip();
    renderSubstituentCatalog();
    positionPopoverUnderButton(m, ev?.currentTarget || document.getElementById('recentGroupsBar'));
    m.classList.remove('hidden');
}


let qsdCollapsed = false;
let qsdInstantMode = false;
let atomHwPinned = false;
const QUICK_SUB_DOCK_GROUPS = ['=O', 'OH', 'CH3', 'COOH', 'CHO', 'NH2', 'NO2', 'Cl', 'Br', 'C2H5', 'O', 'N', 'C'];

function renderQuickSubFloatingDock() {
    const dock = document.getElementById('quickSubFloatingDock');
    if (!dock) return;
    const t = typeof window !== 'undefined' ? window.unifiedTool : '';
    const chemTools = ['chem_bond', 'chem_wedge', 'chem_dash', 'chem_ring', 'chem_snippet', 'chem_group', 'chem_move', 'chem_rxn_arrow'];
    const shouldShow = (typeof isReadMode === 'undefined' || !isReadMode) && chemTools.includes(t);
    dock.classList.toggle('hidden', !shouldShow);
    if (!shouldShow) return;

    document.getElementById('qsdRingBenzeneBtn')?.classList.toggle('active', t === 'chem_ring' && activeRingType === 'benzene');
    document.getElementById('qsdRingC6Btn')?.classList.toggle('active', t === 'chem_ring' && activeRingType === 'cyclohexane');
    document.getElementById('qsdArrowBtn')?.classList.toggle('active', t === 'chem_rxn_arrow');

    dock.classList.toggle('is-collapsed', !!qsdCollapsed);
    const colBtn = document.getElementById('qsdCollapseBtn');
    if (colBtn) {
        colBtn.textContent = qsdCollapsed ? '🧪 Nhóm thế ▸' : '🧪';
    }

    const modeBtn = document.getElementById('qsdModeBtn');
    if (modeBtn) {
        modeBtn.classList.toggle('instant-mode', !!qsdInstantMode);
        modeBtn.textContent = qsdInstantMode ? '⚡ Đỉnh vừa vẽ' : '📌 Chấm gắn';
    }

    const row = document.getElementById('qsdChipsRow');
    if (!row) return;
    const fmt = (s) => typeof formatChemSubHTML === 'function' ? formatChemSubHTML(s) : s;
    row.innerHTML = QUICK_SUB_DOCK_GROUPS.map(g => {
        const isAct = !qsdInstantMode && t === 'chem_group' && activeGroupLabel === g;
        const extraCls = g === '=O' ? 'is-carbonyl' : (g === 'C' ? 'is-reset' : '');
        const disp = g === 'C' ? '↺C' : (g === '=O' ? '=O' : fmt(g));
        const safeG = g.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return '<button onclick="handleQuickSubDockChipClick(\'' + safeG + '\')" class="qsd-chip ' + extraCls + (isAct ? ' active' : '') + '" title="' + (qsdInstantMode ? ('Gắn ngay ' + g + ' vào đỉnh C vừa vẽ') : ('Chọn ' + g + ' rồi chấm 1 chạm (hoặc kéo) lên nguyên tử bất kỳ')) + '">' + disp + '</button>';
    }).join('');
}

function toggleQuickSubDockCollapsed() {
    qsdCollapsed = !qsdCollapsed;
    renderQuickSubFloatingDock();
}

function toggleQuickSubDockMode() {
    qsdInstantMode = !qsdInstantMode;
    if (qsdInstantMode && window.unifiedTool === 'chem_group') {
        selectChemDrawTool('chem_bond');
    }
    renderQuickSubFloatingDock();
    if (typeof showGestureToast === 'function') {
        showGestureToast(qsdInstantMode
            ? '⚡ Chế độ Đỉnh vừa vẽ: Bấm nhóm thế là gắn ngay vào Carbon vừa tạo!'
            : '📌 Chế độ Chấm gắn: Chọn nhóm thế rồi chấm (hoặc kéo) lên bất kỳ đỉnh nào!');
    }
}

function handleQuickSubDockChipClick(group) {
    const doc = typeof getDocState === 'function' ? getDocState() : null;
    if (qsdInstantMode && doc && Array.isArray(doc.atoms) && doc.atoms.length > 0 && typeof smartAttachOrReplaceGroupOnAtom === 'function') {
        let targetAtom = (typeof window !== 'undefined' && window.lastActiveChemAtomId)
            ? doc.atoms.find(a => a.id === window.lastActiveChemAtomId)
            : null;
        if (!targetAtom) targetAtom = doc.atoms[doc.atoms.length - 1];
        if (targetAtom) {
            const res = smartAttachOrReplaceGroupOnAtom(targetAtom, group, doc, null);
            if (res && res.ok) {
                if (typeof ensureAutoNextPageIfNeeded === 'function') ensureAutoNextPageIfNeeded(res.maxY);
                if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
                persistLibrary();
                renderAll();
                if (typeof showGestureToast === 'function') {
                    showGestureToast(res.mode === 'reset' ? '⚡ Đã đưa đỉnh vừa vẽ về C' : ('⚡ Đã gắn -' + res.label + ' vào đỉnh vừa vẽ'));
                }
            }
            return;
        }
    }

    if (window.unifiedTool === 'chem_group' && activeGroupLabel === group) {
        selectChemDrawTool('chem_bond');
        if (typeof showGestureToast === 'function') showGestureToast('Đã quay lại công cụ vẽ Mạch C–C');
        return;
    }
    activeGroupLabel = group;
    selectChemDrawTool('chem_group');
    renderQuickSubFloatingDock();
    if (typeof showGestureToast === 'function') {
        showGestureToast(group === 'C'
            ? '📌 Chấm vào nguyên tử bất kỳ để gỡ nhóm thế về C'
            : ('📌 Đang cầm nhóm -' + group + ': Chấm 1 chạm lên đỉnh (hoặc kéo để chọn hướng)'));
    }
}

function handleQuickDockRingShortcut(ringType) {
    const doc = typeof getDocState === 'function' ? getDocState() : null;
    if (qsdInstantMode && doc && Array.isArray(doc.atoms) && doc.atoms.length > 0 && typeof quickAttachRingToActiveChainTip === 'function') {
        quickAttachRingToActiveChainTip(ringType);
        return;
    }
    if (window.unifiedTool === 'chem_ring' && activeRingType === ringType) {
        selectChemDrawTool('chem_bond');
        if (typeof showGestureToast === 'function') showGestureToast('Đã quay lại vẽ Mạch Carbon (C–C)');
        return;
    }
    activeRingType = ringType;
    selectChemDrawTool('chem_ring');
    renderQuickSubFloatingDock();
    if (typeof showGestureToast === 'function') {
        showGestureToast(ringType === 'benzene'
            ? '⬡ Chấm lên giấy hoặc cạnh liên kết để ghép Vòng Benzen'
            : '⬡ Chấm lên giấy hoặc cạnh liên kết để ghép Vòng C6');
    }
}

function handleQuickDockArrowShortcut() {
    if (window.unifiedTool === 'chem_rxn_arrow') {
        selectChemDrawTool('chem_bond');
        if (typeof showGestureToast === 'function') showGestureToast('Đã quay lại vẽ Mạch Carbon (C–C)');
        return;
    }
    selectChemDrawTool('chem_rxn_arrow');
    renderQuickSubFloatingDock();
    if (typeof showGestureToast === 'function') showGestureToast('→ Kéo trên giấy để kẻ Mũi tên Phản ứng');
}

function handleQuickDockPenShortcut() {
    if (typeof clearActiveCarbonChain === 'function') clearActiveCarbonChain(false);
    selectPillPenMode('ballpoint');
    if (typeof showGestureToast === 'function') showGestureToast('✒️ Đã chuyển nhanh về Bút máy Notewise');
}

function openSubstituentCatalogFromDock(ev) {
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    const doc = typeof getDocState === 'function' ? getDocState() : null;
    let targetAtom = (doc && typeof window !== 'undefined' && window.lastActiveChemAtomId)
        ? (doc.atoms || []).find(a => a.id === window.lastActiveChemAtomId)
        : null;
    if (!targetAtom && doc && Array.isArray(doc.atoms) && doc.atoms.length) {
        targetAtom = doc.atoms[doc.atoms.length - 1];
    }
    const dock = document.getElementById('quickSubFloatingDock');
    const r = (dock && typeof dock.getBoundingClientRect === 'function') ? dock.getBoundingClientRect() : { left: 400, bottom: 120 };
    if (targetAtom) {
        openAtomHandwritingBox(targetAtom, null, { x: r.left + 120, y: r.bottom + 20 });
    } else {
        const centerW = typeof screenToWorld === 'function' ? screenToWorld(cssWidth * 0.5, cssHeight * 0.5) : { x: 350, y: 350 };
        openAtomHandwritingBox(null, centerW, { x: r.left + 120, y: r.bottom + 20 });
    }
}

function toggleAtomHwPinned() {
    atomHwPinned = !atomHwPinned;
    document.getElementById('atomHwPinBtn')?.classList.toggle('active', atomHwPinned);
    if (typeof showGestureToast === 'function') {
        showGestureToast(atomHwPinned ? '📌 Đã ghim bảng Nhóm thế (chấm đỉnh khác trên giấy để gắn tiếp)' : 'Đã tắt ghim bảng Nhóm thế');
    }
}

function renderRecentGroupsBar() {
    if (typeof renderQuickSubFloatingDock === 'function') renderQuickSubFloatingDock();
    const bar = document.getElementById('recentGroupsBar');
    if (!bar) return;
    const { slots, locked } = ensureQuickGroupSlots();
    const resetBtn = `<button onclick="selectResetToCarbonTool()" class="chem-recent-btn ${window.unifiedTool==='chem_group' && activeGroupLabel==='C' ? 'active' : ''}" style="color:#fda4af;" title="Gỡ nhóm thế trên phân tử về lại Carbon (C)">↺C</button>`;
    bar.innerHTML = resetBtn + slots.map((g, idx) => {
        const safeG = g.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const isAct = window.unifiedTool === 'chem_group' && activeGroupLabel === g;
        const isLk = !!locked[idx];
        return `<button id="qg-bar-${idx}" onclick="selectSubstituentGroup('${safeG}')" oncontextmenu="event.preventDefault(); openQuickGroupSlotEditor(${idx}, event);" class="chem-recent-btn ${isAct ? 'active' : ''} ${isLk ? 'is-locked-slot' : ''}" title="Ô #${idx + 1}: ${g}${isLk ? ' (Đã khoá 🔒)' : ''} — Nhấn giữ hoặc chuột phải để đổi/khoá ô này">${formatChemSubHTML(g)}</button>`;
    }).join('');
    slots.forEach((_, idx) => {
        const btn = document.getElementById('qg-bar-' + idx);
        if (!btn || btn.dataset.holdBound) return;
        btn.dataset.holdBound = '1';
        let t = null, sx = 0, sy = 0;
        btn.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
            sx = e.clientX; sy = e.clientY;
            clearTimeout(t);
            t = setTimeout(() => { t = null; openQuickGroupSlotEditor(idx, { currentTarget: btn, stopPropagation() {} }); }, 380);
        });
        btn.addEventListener('pointermove', (e) => {
            if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { clearTimeout(t); t = null; }
        });
        const clr = () => { if (t) { clearTimeout(t); t = null; } };
        btn.addEventListener('pointerup', clr);
        btn.addEventListener('pointercancel', clr);
    });
}

function renderSubChipHTML(g, isFav) {
    const safeG = g.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const isAct = window.unifiedTool === 'chem_group' && activeGroupLabel === g;
    return `
        <div class="sub-chip-wrap">
            <button onclick="selectSubstituentGroup('${safeG}', true); if (editingQuickGroupSlotIdx === null) closeAllPopovers();" class="chip-btn ${isAct ? 'active' : ''}">${formatChemSubHTML(g)}</button>
            <button onclick="toggleFavouriteSubstituent('${safeG}', event)" class="sub-star-btn ${isFav ? 'fav' : ''}" title="${isFav ? 'Bỏ khỏi Yêu thích' : 'Thêm vào Yêu thích'}">${isFav ? '★' : '☆'}</button>
            <button onclick="deleteSubstituentItem('${safeG}', event)" class="sub-del-btn" title="Xóa khỏi danh sách">✕</button>
        </div>
    `;
}

function setSubModalFilter(f) {
    subModalFilter = f === 'fav' ? 'fav' : 'all';
    renderSubstituentCatalog();
}

function toggleSubManageMode() {
    subManageMode = !subManageMode;
    renderSubstituentCatalog();
}

function selectResetToCarbonTool() {
    activeGroupLabel = 'C';
    closeAllPopovers();
    selectChemDrawTool('chem_group');
    showGestureToast('Click lên nhóm thế trên phân tử để gỡ về C');
}

function toggleFavouriteSubstituent(lbl, ev) {
    if (ev) ev.stopPropagation();
    if (!Array.isArray(appLibrary.favouriteGroups)) appLibrary.favouriteGroups = [];
    const idx = appLibrary.favouriteGroups.indexOf(lbl);
    if (idx >= 0) {
        appLibrary.favouriteGroups.splice(idx, 1);
        showGestureToast(`Đã bỏ ★ Yêu thích: ${lbl}`);
    } else {
        appLibrary.favouriteGroups.unshift(lbl);
        showGestureToast(`Đã thêm ★ Yêu thích: ${lbl}`);
    }
    persistLibrary();
    renderSubstituentCatalog();
    renderRecentGroupsBar();
}

function addCustomSubstituent(raw) {
    const lbl = (raw || '').trim();
    if (!lbl || lbl === 'C') return false;
    if (!Array.isArray(appLibrary.deletedSubstituents)) appLibrary.deletedSubstituents = [];
    if (!Array.isArray(appLibrary.customSubstituents)) appLibrary.customSubstituents = [];
    appLibrary.deletedSubstituents = appLibrary.deletedSubstituents.filter(x => x !== lbl);
    if (!SUBSTITUENTS_LIST.includes(lbl) && !appLibrary.customSubstituents.includes(lbl)) {
        appLibrary.customSubstituents.unshift(lbl);
    }
    persistLibrary();
    renderSubstituentCatalog();
    renderRecentGroupsBar();
    showGestureToast(`Đã thêm nhóm thế: ${lbl}`);
    return true;
}

function addCustomSubstituentFromInput() {
    const inp = document.getElementById('subSearchInput');
    if (!inp) return;
    const val = (inp.value || '').trim();
    if (!val) { inp.focus(); return; }
    addCustomSubstituent(val);
    inp.value = '';
    renderSubstituentCatalog();
}

function deleteSubstituentItem(lbl, ev) {
    if (ev) ev.stopPropagation();
    if (!Array.isArray(appLibrary.deletedSubstituents)) appLibrary.deletedSubstituents = [];
    if (!appLibrary.deletedSubstituents.includes(lbl)) appLibrary.deletedSubstituents.push(lbl);
    if (Array.isArray(appLibrary.customSubstituents)) {
        appLibrary.customSubstituents = appLibrary.customSubstituents.filter(x => x !== lbl);
    }
    if (Array.isArray(appLibrary.favouriteGroups)) {
        appLibrary.favouriteGroups = appLibrary.favouriteGroups.filter(x => x !== lbl);
    }
    recentGroups = recentGroups.filter(x => x !== lbl);
    if (activeGroupLabel === lbl) activeGroupLabel = 'C';
    persistLibrary();
    renderSubstituentCatalog();
    renderRecentGroupsBar();
    showGestureToast(`Đã xóa nhóm thế: ${lbl}`);
}

function resetDefaultSubstituents() {
    appLibrary.deletedSubstituents = [];
    appLibrary.favouriteGroups = ['OH', 'NH2', 'NO2', 'COOH', 'Br', 'Cl', 'OMe', 'Ph'];
    if (!recentGroups.length) recentGroups = ['OH', 'NO2', 'OMe', 'Cl', 'Br', 'Ph'];
    persistLibrary();
    renderSubstituentCatalog();
    renderRecentGroupsBar();
    showGestureToast('Đã khôi phục danh sách nhóm thế mặc định');
}

function renderSubstituentCatalog() {
    const modalEl = document.getElementById('substituentModal');
    if (modalEl) modalEl.classList.toggle('sub-manage-on', !!subManageMode);
    document.getElementById('subTabAll')?.classList.toggle('active', subModalFilter === 'all');
    document.getElementById('subTabFav')?.classList.toggle('active', subModalFilter === 'fav');
    document.getElementById('subManageBtn')?.classList.toggle('active', !!subManageMode);
    document.getElementById('subResetToCBtn')?.classList.toggle('active', window.unifiedTool === 'chem_group' && activeGroupLabel === 'C');
    document.getElementById('subManageFooter')?.classList.toggle('hidden', !subManageMode);

    const avail = getAvailableSubstituents();
    const favs = getFavouriteSubstituents();
    const favSet = new Set(favs);

    const rawVal = (document.getElementById('subSearchInput')?.value || '').trim();
    const q = rawVal.toLowerCase();

    const favSec = document.getElementById('subFavSection');
    const favGrid = document.getElementById('subFavGrid');
    if (favSec && favGrid) {
        const showFavSec = subModalFilter === 'all' && favs.length > 0 && !q;
        favSec.classList.toggle('hidden', !showFavSec);
        if (showFavSec) {
            favGrid.innerHTML = favs.map(g => renderSubChipHTML(g, true)).join('');
        }
    }

    const baseList = subModalFilter === 'fav' ? favs : avail;
    const list = baseList.filter(s => !q || s.toLowerCase().includes(q));
    const grid = document.getElementById('substituentGrid');
    if (!grid) return;

    let customChip = '';
    if (rawVal && rawVal !== 'C' && !avail.some(s => s.toLowerCase() === q)) {
        const safeRaw = rawVal.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        customChip = `<button onclick="addCustomSubstituent('${safeRaw}'); selectSubstituentGroup('${safeRaw}'); closeAllPopovers();" class="chip-btn active" style="grid-column: span 2;">+ Thêm ${formatChemSubHTML(rawVal)}</button>`;
    }
    grid.innerHTML = customChip + (list.length
        ? list.map(g => renderSubChipHTML(g, favSet.has(g))).join('')
        : (!customChip ? `<div class="col-span-5 text-center text-[11px] text-slate-500 py-3">Chưa có nhóm thế phù hợp</div>` : ''));
}

function handleCustomSubstituentKey(ev) {
    if (ev.key === 'Enter') {
        const rawVal = (ev.target.value || '').trim();
        if (!rawVal) return;
        addCustomSubstituent(rawVal);
        selectSubstituentGroup(rawVal);
        ev.target.value = '';
        closeAllPopovers();
    }
}

function selectSubstituentGroup(lbl, fromModal = false) {
    activeGroupLabel = lbl;
    if (lbl && lbl !== 'C') {
        const { slots, locked } = ensureQuickGroupSlots();
        if (fromModal && editingQuickGroupSlotIdx !== null) {
            slots[editingQuickGroupSlotIdx] = lbl;
            persistLibrary();
            renderQuickGroupSlotsStrip();
        } else if (!slots.includes(lbl)) {
            const unlockedIndices = [];
            for (let i = 0; i < slots.length; i++) {
                if (!locked[i]) unlockedIndices.push(i);
            }
            if (unlockedIndices.length > 0) {
                for (let k = unlockedIndices.length - 1; k > 0; k--) {
                    slots[unlockedIndices[k]] = slots[unlockedIndices[k - 1]];
                }
                slots[unlockedIndices[0]] = lbl;
                persistLibrary();
            }
        }
        recentGroups = slots.slice();
    }
    selectChemDrawTool('chem_group');
    renderRecentGroupsBar();
}

function toggleSubstituentModal(ev) {
    ev.stopPropagation();
    const m = document.getElementById('substituentModal');
    const hide = !m.classList.contains('hidden');
    closeAllPopovers();
    if (!hide) {
        editingQuickGroupSlotIdx = null;
        renderQuickGroupSlotsStrip();
        renderSubstituentCatalog();
        positionPopoverUnderButton(m, ev.currentTarget);
        m.classList.remove('hidden');
    }
}

function positionPopoverUnderButton(popEl, btnEl) {
    if (!popEl) return;
    const vw = (typeof window !== 'undefined' && (window.visualViewport?.width || window.innerWidth)) || 1200;
    const vh = (typeof window !== 'undefined' && (window.visualViewport?.height || window.innerHeight)) || 800;
    const rawR = btnEl && typeof btnEl.getBoundingClientRect === 'function' ? btnEl.getBoundingClientRect() : null;
    const r = (rawR && (rawR.width > 0 || rawR.height > 0) && rawR.bottom > 0)
        ? rawR
        : { left: vw * 0.5, right: vw * 0.5, width: 0, top: 82, bottom: 88 };
    const wasHidden = popEl.classList.contains('hidden');
    if (wasHidden) { popEl.style.visibility = 'hidden'; popEl.classList.remove('hidden'); }
    const styleWMatch = String(popEl.style.width || '').match(/(\d+)/);
    const parsedW = styleWMatch ? parseInt(styleWMatch[1], 10) : 340;
    const w = Math.min(vw - 20, popEl.offsetWidth || parsedW || 340);
    const h = popEl.offsetHeight || parseInt(popEl.style.maxHeight || '320', 10) || 260;
    if (wasHidden) { popEl.classList.add('hidden'); popEl.style.visibility = ''; }
    const left = Math.max(w / 2 + 10, Math.min(vw - w / 2 - 10, r.left + r.width / 2));
    let top = r.bottom + 6;
    if (top + h > vh - 10) {
        const aboveTop = r.top - h - 6;
        top = aboveTop >= 48 ? aboveTop : Math.max(48, vh - h - 10);
    }
    popEl.style.left = `${left}px`;
    popEl.style.top = `${Math.max(48, top)}px`;
}

function openOrToggleHubPopover(toolName, popId, ev) {
    if (ev) ev.stopPropagation();
    const p = document.getElementById(popId);
    const isAlreadyOpen = p && !p.classList.contains('hidden');
    closeAllPopovers();
    selectChemDrawTool(toolName);
    if (p && !isAlreadyOpen) {
        positionPopoverUnderButton(p, ev?.currentTarget);
        p.classList.remove('hidden');
    }
}

function handleRingHubClick(ev) {
    renderRingHubGrid();
    const keepTool = window.unifiedTool === 'chem_snippet' ? 'chem_snippet' : 'chem_ring';
    openOrToggleHubPopover(keepTool, 'ringHubPopover', ev);
}
function pickRingTool(id) { activeRingType = id; activeSnippetId = null; closeAllPopovers(); selectChemDrawTool('chem_ring'); initAllPopoverGrids(); }
function pickCustomSnippetTool(id) {
    activeSnippetId = id;
    closeAllPopovers();
    selectChemDrawTool('chem_snippet');
    renderCustomSnippetsGrid();
    const sn = (appLibrary.customSnippets || []).find(s => s.id === id);
    showGestureToast(`Mẫu "${sn?.title || 'Cấu trúc'}": Nhấn lên giấy để đóng dấu`);
}
function deleteCustomSnippet(id, ev) {
    if (ev) ev.stopPropagation();
    appLibrary.customSnippets = (appLibrary.customSnippets || []).filter(s => s.id !== id);
    if (activeSnippetId === id) {
        activeSnippetId = null;
        if (window.unifiedTool === 'chem_snippet') selectChemDrawTool('chem_ring');
    }
    persistLibrary();
    renderCustomSnippetsGrid();
    showGestureToast('Đã xóa mẫu cấu trúc');
}

let activeStereoBondType = 'chem_wedge';
let activeArrowHubMode = 'chem_rxn_arrow';
let activeSpecialHubMode = 'chem_conformer';

function handleStereoHubClick(ev) { openOrToggleHubPopover(activeStereoBondType, 'stereoHubPopover', ev); }
function pickStereoBond(toolId) {
    activeStereoBondType = toolId === 'chem_dash' ? 'chem_dash' : 'chem_wedge';
    closeAllPopovers();
    selectChemDrawTool(activeStereoBondType);
}

function handleArrowHubClick(ev) { openOrToggleHubPopover(activeArrowHubMode, 'arrowHubPopover', ev); }
function handleRxnArrowHubClick(ev) { activeArrowHubMode = 'chem_rxn_arrow'; handleArrowHubClick(ev); }
function pickRxnArrow(id) { activeRxnArrowType = id; activeArrowHubMode = 'chem_rxn_arrow'; closeAllPopovers(); selectChemDrawTool('chem_rxn_arrow'); initAllPopoverGrids(); }

function handleMechArrowHubClick(ev) { activeArrowHubMode = 'chem_mech_arrow'; handleArrowHubClick(ev); }
function pickMechArrow(id) { activeMechArrowType = id; activeArrowHubMode = 'chem_mech_arrow'; closeAllPopovers(); selectChemDrawTool('chem_mech_arrow'); initAllPopoverGrids(); }

function handleSpecialHubClick(ev) { openOrToggleHubPopover(activeSpecialHubMode, 'specialHubPopover', ev); }
function handleOrbitalHubClick(ev) { activeSpecialHubMode = 'chem_orbital'; handleSpecialHubClick(ev); }
function pickOrbital(id) { activeOrbitalType = id; activeSpecialHubMode = 'chem_orbital'; closeAllPopovers(); selectChemDrawTool('chem_orbital'); initAllPopoverGrids(); }

function handleSymbolHubClick(ev) { activeSpecialHubMode = 'chem_symbol'; handleSpecialHubClick(ev); }
function pickSymbol(id) { activeChemSymTool = id; activeSpecialHubMode = 'chem_symbol'; closeAllPopovers(); selectChemDrawTool('chem_symbol'); initAllPopoverGrids(); }

function handleConformerHubClick(ev) { activeSpecialHubMode = 'chem_conformer'; handleSpecialHubClick(ev); }
function pickConformer(id) { activeConformerType = id; activeSpecialHubMode = 'chem_conformer'; closeAllPopovers(); selectChemDrawTool('chem_conformer'); initAllPopoverGrids(); }

/* QUẢN LÝ TRANG, SẢNH THƯ VIỆN & XUẤT FILE */
function addNewPageToActiveNotebook() {
    const nb = getActiveNotebook();
    const curPg = getActivePage();
    nb.pages.push({
        id: genId('pg'),
        template: curPg.template || 'grid',
        pageConfig: curPg.pageConfig ? { ...curPg.pageConfig } : undefined,
        content: createEmptyPageContent()
    });
    nb.activePageIndex = nb.pages.length - 1;
    syncActivePaperDimensions();
    laserStrokes = []; currentLaserStroke = null;
    persistLibrary(); renderOpenTabsBar(); fitA4ToScreen();
}

function openPageGridModal() {
    renderPageGridModal();
    document.getElementById('pageGridModal')?.classList.remove('hidden');
}
function closePageGridModal() { document.getElementById('pageGridModal')?.classList.add('hidden'); }
function renderPageGridModal() {
    const nb = getActiveNotebook();
    const box = document.getElementById('pageGridContainer');
    if (!box) return;
    box.innerHTML = nb.pages.map((pg, i) => `
        <div onclick="selectPageFromGrid(${i})" class="p-2.5 rounded-xl border ${i === nb.activePageIndex ? 'border-sky-400 bg-sky-500/15' : 'border-slate-700 bg-slate-800'} cursor-pointer flex flex-col justify-between h-24">
            <div class="flex items-center justify-between gap-1">
                <span class="text-xs font-bold text-white">Trang ${i + 1}</span>
                <button onclick="event.stopPropagation(); duplicatePageAt(${i})" class="text-sky-300 hover:text-sky-200 text-xs font-bold px-1" title="Nhân bản trang này">⧉</button>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-400">
                <span class="truncate">${pg.template || 'grid'}</span>
                ${nb.pages.length > 1 ? `<button onclick="event.stopPropagation(); deletePageAt(${i})" class="text-rose-400 font-bold px-1" title="Xóa trang">✕</button>` : ''}
            </div>
        </div>
    `).join('');
}
function duplicatePageAt(idx) {
    const nb = getActiveNotebook();
    if (!nb || !nb.pages || !nb.pages[idx]) return;
    const copy = JSON.parse(JSON.stringify(nb.pages[idx]));
    copy.id = genId('pg');
    nb.pages.splice(idx + 1, 0, copy);
    nb.activePageIndex = idx + 1;
    syncActivePaperDimensions();
    persistLibrary(); renderPageGridModal(); renderOpenTabsBar(); renderAll();
    if (typeof showGestureToast === 'function') showGestureToast(`Đã nhân bản thành Trang ${idx + 2}`);
}
function selectPageFromGrid(idx) {
    getActiveNotebook().activePageIndex = idx;
    syncActivePaperDimensions();
    laserStrokes = []; currentLaserStroke = null;
    closePageGridModal(); renderOpenTabsBar(); fitA4ToScreen();
}
function deletePageAt(idx) {
    const nb = getActiveNotebook();
    if (nb.pages.length <= 1) return;
    nb.pages.splice(idx, 1);
    nb.activePageIndex = Math.max(0, Math.min(nb.pages.length - 1, nb.activePageIndex));
    persistLibrary(); renderPageGridModal(); renderOpenTabsBar(); renderAll();
}

function openLibraryHub() {
    closeAllPopovers();
    renderLibraryHub();
    document.getElementById('libraryHubModal')?.classList.remove('hidden');
}
function closeLibraryHub() {
    document.getElementById('libraryHubModal')?.classList.add('hidden');
    renderOpenTabsBar();
    resizeCanvas();
    fitA4ToScreen();
}
function setHubFilter(f) { appLibrary.hubFilter = f; renderLibraryHub(); }

let customDialogState = { onConfirm: null, selectedColor: '#0284c7' };
const HUB_PALETTE = ['#0284c7', '#0f766e', '#4f46e5', '#b45309', '#be123c', '#38bdf8', '#10b981', '#a855f7'];

function openCustomDialog({ title, message = '', hideInput = false, confirmText = 'Xác nhận', danger = false, defaultValue = '', showColors = false, defaultColor = '#0284c7', onConfirm }) {
    customDialogState.onConfirm = onConfirm;
    customDialogState.selectedColor = defaultColor;
    const titleEl = document.getElementById('customDialogTitle');
    if (titleEl) {
        titleEl.textContent = title;
        titleEl.classList.toggle('text-rose-400', !!danger);
        titleEl.classList.toggle('text-sky-400', !danger);
    }
    const msgEl = document.getElementById('customDialogMessage');
    if (msgEl) {
        msgEl.textContent = message;
        msgEl.classList.toggle('hidden', !message);
    }
    const inp = document.getElementById('customDialogInput');
    if (inp) {
        inp.value = defaultValue;
        inp.classList.toggle('hidden', !!hideInput);
    }
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    if (confirmBtn) {
        confirmBtn.textContent = confirmText;
        confirmBtn.classList.toggle('bg-rose-500', !!danger);
        confirmBtn.classList.toggle('text-white', !!danger);
        confirmBtn.classList.toggle('bg-sky-500', !danger);
        confirmBtn.classList.toggle('text-slate-950', !danger);
    }
    const cWrap = document.getElementById('customDialogColorsWrap');
    if (showColors) {
        cWrap.classList.remove('hidden');
        renderDialogColorDots();
    } else {
        cWrap.classList.add('hidden');
    }
    document.getElementById('customDialogModal').classList.remove('hidden');
    setTimeout(() => {
        if (!hideInput && inp) { inp.focus(); inp.select(); }
        else if (confirmBtn) { confirmBtn.focus(); }
    }, 30);
}

function renderDialogColorDots() {
    const box = document.getElementById('customDialogColorList');
    if (!box) return;
    box.innerHTML = HUB_PALETTE.map(c => `
        <button type="button" onclick="customDialogState.selectedColor='${c}'; renderDialogColorDots();" class="w-6 h-6 rounded-full border-2 ${customDialogState.selectedColor === c ? 'border-white scale-110' : 'border-transparent opacity-75'}" style="background:${c}"></button>
    `).join('');
}

function closeCustomDialog() {
    document.getElementById('customDialogModal')?.classList.add('hidden');
    customDialogState.onConfirm = null;
}

function confirmCustomDialog() {
    const val = document.getElementById('customDialogInput')?.value || '';
    const cb = customDialogState.onConfirm;
    const col = customDialogState.selectedColor;
    closeCustomDialog();
    if (cb) cb(val, col);
}

function setHubViewMode(mode) {
    appLibrary.hubViewMode = mode === 'list' ? 'list' : 'grid';
    persistLibrary();
    renderLibraryHub();
}

function formatNotebookLastOpened(ts) {
    if (!Number.isFinite(ts) || ts <= 0) return 'Chưa mở';
    const diff = Date.now() - ts;
    if (diff >= 0 && diff < 60000) return 'Vừa xong';
    if (diff >= 0 && diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff >= 0 && diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderLibraryHub() {
    document.getElementById('hubCountAll').textContent = appLibrary.notebooks.length;
    document.getElementById('hubCountStarred').textContent = appLibrary.notebooks.filter(n => n.starred).length;
    document.getElementById('hub-filter-all')?.classList.toggle('active', appLibrary.hubFilter === 'all');
    document.getElementById('hub-filter-starred')?.classList.toggle('active', appLibrary.hubFilter === 'starred');

    const activeFolder = appLibrary.folders.find(f => f.id === appLibrary.hubFilter);
    const titleEl = document.getElementById('hubBreadcrumbTitle');
    const backBtn = document.getElementById('hubBackAllBtn');
    if (titleEl) {
        if (appLibrary.hubFilter === 'all') titleEl.textContent = 'Tất cả sổ tay';
        else if (appLibrary.hubFilter === 'starred') titleEl.textContent = 'Đánh dấu ★';
        else if (activeFolder) titleEl.textContent = activeFolder.name;
    }
    if (backBtn) backBtn.classList.toggle('hidden', appLibrary.hubFilter === 'all');

    const fSide = document.getElementById('hubFoldersSidebarList');
    if (fSide) {
        fSide.innerHTML = appLibrary.folders.map(f => {
            const cnt = appLibrary.notebooks.filter(n => n.folderId === f.id).length;
            return `<button onclick="setHubFilter('${f.id}')" class="hub-nav-item ${appLibrary.hubFilter === f.id ? 'active' : ''}"><span class="flex items-center gap-2 truncate"><span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${f.color}"></span><span class="truncate">${f.name}</span></span><span class="text-xs opacity-65">${cnt}</span></button>`;
        }).join('');
    }

    const fShelf = document.getElementById('hubFoldersShelf');
    if (fShelf) {
        fShelf.innerHTML = appLibrary.folders.map(f => `
            <div onclick="setHubFilter('${f.id}')" class="folder-card ${appLibrary.hubFilter === f.id ? 'active' : ''}" style="border-top:3px solid ${f.color}">
                <div class="font-bold text-xs text-slate-100 truncate">${f.name}</div>
                <div class="flex items-center gap-1.5">
                    <span class="text-[11px] text-slate-400">${appLibrary.notebooks.filter(n => n.folderId === f.id).length}</span>
                    ${appLibrary.folders.length > 1 ? `<button onclick="event.stopPropagation(); deleteFolder('${f.id}')" class="text-[10px] text-slate-500 hover:text-rose-400 px-1">✕</button>` : ''}
                </div>
            </div>
        `).join('');
    }

    const q = (document.getElementById('hubSearchInput')?.value || '').trim().toLowerCase();
    const nbs = appLibrary.notebooks.filter(n => {
        if (q && !n.title.toLowerCase().includes(q)) return false;
        if (appLibrary.hubFilter === 'starred') return n.starred;
        if (appLibrary.hubFilter !== 'all' && activeFolder) return n.folderId === appLibrary.hubFilter;
        return true;
    });

    const viewMode = appLibrary.hubViewMode === 'list' ? 'list' : 'grid';
    document.getElementById('hubViewGridBtn')?.classList.toggle('hub-view-btn-active', viewMode === 'grid');
    document.getElementById('hubViewListBtn')?.classList.toggle('hub-view-btn-active', viewMode === 'list');

    const nShelf = document.getElementById('hubNotebooksShelf');
    if (nShelf) {
        if (!nShelf.dataset.gridClass) nShelf.dataset.gridClass = nShelf.className;
        nShelf.className = viewMode === 'list' ? 'notebook-list-stack' : nShelf.dataset.gridClass;

        if (viewMode === 'list') {
            nShelf.innerHTML = nbs.map(n => {
                const fld = appLibrary.folders.find(f => f.id === n.folderId);
                const isActive = appLibrary.activeNotebookId === n.id;
                const lastOpenedStr = formatNotebookLastOpened(n.lastOpenedAt);
                return `
                    <div onclick="switchActiveNotebook('${n.id}'); closeLibraryHub();" class="notebook-row-item ${isActive ? 'active-row' : ''}">
                        <div class="nb-mini-book" style="background:${n.coverColor || '#0284c7'}">
                            <div class="nb-mini-book-spine"></div>
                            <span style="font-size:10px;font-weight:800;color:#fff;padding-left:5px;opacity:0.9;">H₂</span>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-extrabold truncate">${n.title}</span>
                                ${fld ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style="background:${fld.color || '#38bdf8'}22;color:${fld.color || '#38bdf8'};border:1px solid ${fld.color || '#38bdf8'}44;">${fld.name}</span>` : ''}
                                ${isActive ? `<span class="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px] font-bold shrink-0">Đang mở</span>` : ''}
                            </div>
                            <div class="text-[11px] opacity-75 mt-0.5 truncate">
                                ${n.pages.length} trang • Lần cuối mở: <span class="font-semibold">${lastOpenedStr}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button onclick="event.stopPropagation(); toggleStarNotebook('${n.id}')" class="w-7 h-7 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-sm ${n.starred ? 'text-amber-400' : 'text-slate-400'}" title="Đánh dấu sao">★</button>
                            <button onclick="event.stopPropagation(); openNotebookInSplitRight('${n.id}'); closeLibraryHub();" class="w-7 h-7 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-xs font-bold text-slate-200" title="Mở song song">◫</button>
                            <button onclick="event.stopPropagation(); renameNotebookPrompt('${n.id}')" class="w-7 h-7 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-xs text-slate-200" title="Đổi tên & Màu bìa">✎</button>
                            ${appLibrary.notebooks.length > 1 ? `<button onclick="event.stopPropagation(); deleteNotebook('${n.id}')" class="w-7 h-7 rounded-lg bg-slate-800/70 hover:bg-rose-500/30 text-xs text-rose-400" title="Xóa sổ">✕</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            nShelf.innerHTML = nbs.map(n => `
                <div onclick="switchActiveNotebook('${n.id}'); closeLibraryHub();" class="notebook-card" style="background:${n.coverColor || '#0284c7'}">
                    <div class="nb-spine"></div>
                    <div class="flex items-center justify-between">
                        <button onclick="event.stopPropagation(); toggleStarNotebook('${n.id}')" class="text-sm ${n.starred ? 'text-amber-300' : 'text-white/40'}">★</button>
                        <button onclick="event.stopPropagation(); openNotebookInSplitRight('${n.id}'); closeLibraryHub();" class="px-1.5 py-0.5 rounded bg-black/25 text-[10px] font-bold text-white" title="Mở song song">◫</button>
                    </div>
                    <div class="nb-label-plate">
                        <div class="text-xs font-extrabold truncate">${n.title}</div>
                        <div class="text-[10px] text-slate-500 mt-0.5">${n.pages.length} trang • ${formatNotebookLastOpened(n.lastOpenedAt)}</div>
                    </div>
                    <div class="flex items-center justify-end gap-1">
                        <button onclick="event.stopPropagation(); renameNotebookPrompt('${n.id}')" class="w-6 h-6 rounded bg-black/25 text-white text-[11px]" title="Đổi tên & Màu bìa">✎</button>
                        ${appLibrary.notebooks.length > 1 ? `<button onclick="event.stopPropagation(); deleteNotebook('${n.id}')" class="w-6 h-6 rounded bg-black/25 text-rose-200 text-[11px]" title="Xóa sổ">✕</button>` : ''}
                    </div>
                </div>
            `).join('');
        }
    }
}

function toggleStarNotebook(id) {
    const nb = appLibrary.notebooks.find(n => n.id === id);
    if (nb) { nb.starred = !nb.starred; persistLibrary(); renderLibraryHub(); }
}
function deleteFolder(fid) {
    if (appLibrary.folders.length <= 1) return;
    appLibrary.folders = appLibrary.folders.filter(f => f.id !== fid);
    const fallbackId = appLibrary.folders[0]?.id || null;
    appLibrary.notebooks.forEach(nb => { if (nb.folderId === fid) nb.folderId = fallbackId; });
    if (appLibrary.hubFilter === fid) appLibrary.hubFilter = 'all';
    persistLibrary(); renderLibraryHub();
}
function createNewFolderPrompt() {
    openCustomDialog({
        title: 'Thư mục mới',
        defaultValue: 'Chuyên Đề Mới',
        showColors: true,
        defaultColor: '#38bdf8',
        onConfirm: (name, color) => {
            if (!name || !name.trim()) return;
            const nf = { id: genId('fld'), name: name.trim(), color: color || '#38bdf8' };
            appLibrary.folders.push(nf);
            appLibrary.hubFilter = nf.id;
            persistLibrary(); renderLibraryHub();
        }
    });
}
function createNewNotebookPrompt() {
    const activeFolder = appLibrary.folders.find(f => f.id === appLibrary.hubFilter);
    openCustomDialog({
        title: 'Tạo sổ tay mới',
        defaultValue: 'Sổ Ghi Chép Mới',
        showColors: true,
        defaultColor: HUB_PALETTE[appLibrary.notebooks.length % HUB_PALETTE.length],
        onConfirm: (title, color) => {
            if (!title || !title.trim()) return;
            const nb = {
                id: genId('nb'), title: title.trim(),
                folderId: activeFolder ? activeFolder.id : (appLibrary.folders[0]?.id || null),
                coverColor: color || '#0284c7',
                starred: false, lastOpenedAt: Date.now(), activePageIndex: 0,
                pages: [{ id: genId('pg'), template: 'grid', content: createEmptyPageContent() }]
            };
            appLibrary.notebooks.unshift(nb);
            switchActiveNotebook(nb.id);
            closeLibraryHub();
        }
    });
}
function renameNotebookPrompt(id) {
    const nb = appLibrary.notebooks.find(n => n.id === id);
    if (!nb) return;
    openCustomDialog({
        title: 'Đổi tên & Màu bìa sổ',
        defaultValue: nb.title,
        showColors: true,
        defaultColor: nb.coverColor || '#0284c7',
        onConfirm: (t, col) => {
            if (t && t.trim()) nb.title = t.trim();
            if (col) nb.coverColor = col;
            persistLibrary(); renderLibraryHub(); renderOpenTabsBar();
        }
    });
}
function deleteNotebook(id) {
    if (appLibrary.notebooks.length <= 1) return;
    const nb = appLibrary.notebooks.find(n => n.id === id);
    if (!nb) return;
    openCustomDialog({
        title: 'Xác nhận xóa sổ tay',
        message: `Bạn có chắc chắn muốn xóa sổ tay "${nb.title}" (${nb.pages.length} trang) không? Dữ liệu trong sổ sẽ bị xóa vĩnh viễn.`,
        hideInput: true,
        confirmText: 'Xóa sổ',
        danger: true,
        onConfirm: () => {
            if (appLibrary.notebooks.length <= 1) return;
            appLibrary.notebooks = appLibrary.notebooks.filter(n => n.id !== id);
            appLibrary.openTabIds = appLibrary.openTabIds.filter(tid => tid !== id);
            if (!appLibrary.openTabIds.length) appLibrary.openTabIds = [appLibrary.notebooks[0].id];
            if (appLibrary.activeNotebookId === id) appLibrary.activeNotebookId = appLibrary.openTabIds[0];
            persistLibrary(); renderLibraryHub(); renderOpenTabsBar();
            showGestureToast('Đã xóa sổ tay');
        }
    });
}

function exportActiveNotebookFile() {
    const blob = new Blob([JSON.stringify(appLibrary, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ChemNotes_Backup.chemnotes';
    a.click();
}
function triggerImportNotebookFile() { document.getElementById('chemFileInput')?.click(); }
function handleImportNotebookFile(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
        try {
            const data = JSON.parse(r.result);
            if (data && Array.isArray(data.notebooks)) {
                appLibrary = { ...appLibrary, ...data };
                persistLibrary(); renderOpenTabsBar(); fitA4ToScreen();
                showGestureToast('Đã nạp dữ liệu sổ!');
            }
        } catch (e) {}
    };
    r.readAsText(file);
}

function renderPageToOffscreenCanvas(pg, scale = 2) {
    if (!pg) return null;
    const cfg = getPagePaperConfig(pg);
    const off = document.createElement('canvas');
    off.width = Math.round(cfg.width * scale);
    off.height = Math.round(cfg.height * scale);
    const c = off.getContext('2d');
    if (!c) return null;
    c.save();
    c.scale(scale, scale);
    drawPaperBackground(c, pg);
    if (typeof c.beginPath === 'function' && typeof c.rect === 'function' && typeof c.clip === 'function') {
        c.beginPath();
        c.rect(0, 0, cfg.width, cfg.height);
        c.clip();
    }
    drawPageContentOnContext(c, pg.content || createEmptyPageContent(), pg, false);
    c.restore();
    return off;
}

function exportCurrentPagePNG() {
    const pg = getActivePage();
    const off = renderPageToOffscreenCanvas(pg, 2);
    if (!off) return;
    const a = document.createElement('a');
    a.href = off.toDataURL('image/png');
    a.download = `${getActiveNotebook().title}_Trang_${(getActiveNotebook().activePageIndex || 0) + 1}.png`;
    a.click();
}

function shareCurrentPagePNG() {
    const pg = getActivePage();
    const off = renderPageToOffscreenCanvas(pg, 2);
    if (!off) return;
    const nb = getActiveNotebook();
    const fileName = `${(nb?.title || 'ChemNotes').replace(/[\\/:*?"<>|]/g, '_')}_Trang_${(nb?.activePageIndex || 0) + 1}.png`;
    if (typeof off.toBlob === 'function' && typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File === 'function') {
        off.toBlob(async (blob) => {
            if (!blob) { exportCurrentPagePNG(); return; }
            try {
                const file = new File([blob], fileName, { type: 'image/png' });
                if (!navigator.canShare || navigator.canShare({ files: [file] })) {
                    await navigator.share({ title: nb?.title || 'ChemNotes', files: [file] });
                    return;
                }
            } catch (err) {
                if (err && err.name === 'AbortError') return;
            }
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
        }, 'image/png');
        return;
    }
    exportCurrentPagePNG();
}

function exportActiveNotebookPDF() {
    const nb = getActiveNotebook();
    if (!nb || !Array.isArray(nb.pages) || !nb.pages.length) return;
    const printBox = document.getElementById('printPdfSheetContainer');
    if (!printBox || typeof window === 'undefined' || typeof window.print !== 'function') {
        exportCurrentPagePNG();
        return;
    }
    const pageImgs = [];
    for (let i = 0; i < nb.pages.length; i++) {
        const off = renderPageToOffscreenCanvas(nb.pages[i], 2);
        if (off) {
            const url = off.toDataURL('image/jpeg', 0.93);
            pageImgs.push(`<img class="print-pdf-page" src="${url}" alt="Trang ${i + 1}" />`);
        }
    }
    if (!pageImgs.length) return;
    printBox.innerHTML = pageImgs.join('');
    printBox.classList.remove('hidden');
    const prevTitle = typeof document !== 'undefined' ? document.title : '';
    if (typeof document !== 'undefined') document.title = `${nb.title || 'ChemNotes'} - ${nb.pages.length} trang`;
    if (typeof showGestureToast === 'function') {
        showGestureToast(`🖨️ Đang chuẩn bị PDF (${nb.pages.length} trang). Chọn "Lưu thành PDF" hoặc Chia sẻ!`);
    }
    let cleaned = false;
    const cleanupPrint = () => {
        if (cleaned) return;
        cleaned = true;
        if (typeof document !== 'undefined') document.title = prevTitle;
        printBox.innerHTML = '';
        printBox.classList.add('hidden');
        try { window.removeEventListener('afterprint', cleanupPrint); } catch (_) {}
    };
    try { window.addEventListener('afterprint', cleanupPrint); } catch (_) {}
    setTimeout(() => {
        try { window.print(); } catch (_) {}
        setTimeout(cleanupPrint, 2500);
    }, 60);
}

/* ============================================================
   HỆ THỐNG GIAO DIỆN (APP THEME), VIÊN THUỐC BÚT & VIÊN THUỐC DẠY HỌC
   ============================================================ */

function applyAppTheme(themeId) {
    const list = (typeof APP_THEME_CATALOG !== 'undefined' && Array.isArray(APP_THEME_CATALOG)) ? APP_THEME_CATALOG : [];
    const entry = list.find(t => t.id === themeId) || list[0] || { id: 'midnight_sky', preview: ['#0b1120'] };
    appLibrary.appTheme = entry.id;
    if (typeof document !== 'undefined' && document.body && typeof document.body.setAttribute === 'function') {
        document.body.setAttribute('data-theme', entry.id);
    }
    if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme && entry.preview?.[0]) metaTheme.setAttribute('content', entry.preview[0]);
    }
}

function selectAppTheme(themeId) {
    applyAppTheme(themeId);
    persistLibrary();
    renderAppThemePopover();
    const entry = (typeof APP_THEME_CATALOG !== 'undefined') ? APP_THEME_CATALOG.find(t => t.id === appLibrary.appTheme) : null;
    if (entry && typeof showGestureToast === 'function') showGestureToast(`Giao diện: ${entry.title}`);
}

function toggleAppSettingsMenu(ev) {
    ev?.stopPropagation();
    const pop = document.getElementById('appSettingsMenuPopover');
    if (!pop) return;
    const wasHidden = pop.classList.contains('hidden');
    closeAllPopovers();
    if (wasHidden) {
        const curVer = (typeof APP_CURRENT_VERSION !== 'undefined' && APP_CURRENT_VERSION?.version) || '15.0';
        const rem = typeof latestRemoteVersionInfo !== 'undefined' ? latestRemoteVersionInfo : null;
        const hasNewer = !!(rem && Number(rem.versionCode) > Number(APP_CURRENT_VERSION?.versionCode || 15));
        const badgeTxt = hasNewer ? ('🆕 v' + rem.version) : ('v' + curVer);
        const badge = document.getElementById('versionUpdateMenuBadge');
        if (badge) {
            badge.textContent = badgeTxt;
            badge.className = hasNewer
                ? 'px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 text-[10px] font-extrabold'
                : 'px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-extrabold';
        }
        const sBadge = document.getElementById('settingsVersionUpdateBadge');
        if (sBadge) {
            sBadge.textContent = badgeTxt;
        }
        positionPopoverUnderButton(pop, ev?.currentTarget || document.getElementById('appSettingsHubBtn'));
        pop.classList.remove('hidden');
    }
}

function toggleAppThemePopover(ev) {
    ev?.stopPropagation();
    const pop = document.getElementById('appThemePopover');
    if (!pop) return;
    const wasHidden = pop.classList.contains('hidden');
    closeAllPopovers();
    if (wasHidden) {
        renderAppThemePopover();
        const anchor = document.getElementById('appSettingsHubBtn') || ev?.currentTarget || document.getElementById('appThemeBtn');
        positionPopoverUnderButton(pop, anchor);
        pop.classList.remove('hidden');
    }
}

function renderAppThemePopover() {
    const box = document.getElementById('appThemeList');
    if (!box || typeof APP_THEME_CATALOG === 'undefined') return;
    const cur = appLibrary.appTheme || 'midnight_sky';
    box.innerHTML = APP_THEME_CATALOG.map(t => `
        <button onclick="selectAppTheme('${t.id}')" class="theme-row-btn ${cur === t.id ? 'active' : ''}">
            <span class="flex items-center gap-2 min-w-0">
                <span class="flex items-center gap-1 shrink-0">
                    <span class="w-3 h-3 rounded-full border border-white/20" style="background:${t.preview?.[0] || '#0b1120'}"></span>
                    <span class="w-3 h-3 rounded-full border border-white/20" style="background:${t.preview?.[1] || '#1e293b'}"></span>
                    <span class="w-3 h-3 rounded-full border border-white/20" style="background:${t.preview?.[2] || '#38bdf8'}"></span>
                </span>
                <span class="truncate font-semibold">${t.title}</span>
            </span>
            <span class="text-sky-400 font-bold text-xs shrink-0">${cur === t.id ? '✓' : ''}</span>
        </button>
    `).join('');
}

/* --- TÙY CHỈNH VIÊN THUỐC BÚT VIẾT (#penPillWidget) --- */
const PEN_PILL_DOCK_OPTIONS = [
    { id: 'top_left', label: '↖ Trên T' },
    { id: 'top_center', label: '⬆ Trên giữa' },
    { id: 'top_right', label: '↗ Trên P' },
    { id: 'left_edge', label: '⬅ Cạnh trái' },
    { id: 'free', label: '✥ Tự do' },
    { id: 'right_edge', label: '➡ Cạnh phải' },
    { id: 'bottom_left', label: '↙ Dưới T' },
    { id: 'bottom_center', label: '⬇ Dưới giữa' },
    { id: 'bottom_right', label: '↘ Dưới P' }
];

function ensurePenPillConfig() {
    const allIds = typeof PEN_PILL_ITEMS_CATALOG !== 'undefined' ? PEN_PILL_ITEMS_CATALOG.map(it => it.id) : [];
    const defaultVisible = ['undo_redo', 'carbon', 'ballpoint', 'highlighter', 'eraser', 'lasso', 'stroke_slots', 'color_wells'];
    if (!appLibrary.penPillConfig || typeof appLibrary.penPillConfig !== 'object') {
        appLibrary.penPillConfig = {
            dock: 'top_center', x: null, y: null, vertical: false, scale: 1.0,
            carbonNextToPenV14_2: true,
            movedImgLaserToNavyV15: true,
            itemOrder: [...allIds],
            visibleItems: [...defaultVisible]
        };
    }
    const cfg = appLibrary.penPillConfig;
    if (!cfg.dock) cfg.dock = 'top_center';
    cfg.vertical = typeof cfg.vertical === 'boolean' ? cfg.vertical : (cfg.orientation === 'vertical');
    cfg.orientation = cfg.vertical ? 'vertical' : 'horizontal';
    cfg.scale = Math.max(0.75, Math.min(1.35, Number(cfg.scale) || 1));
    let order = Array.isArray(cfg.itemOrder)
        ? cfg.itemOrder.filter((id, idx, arr) => allIds.includes(id) && arr.indexOf(id) === idx)
        : [];
    allIds.forEach(id => { if (!order.includes(id)) order.push(id); });
    cfg.itemOrder = order;
    if (!Array.isArray(cfg.visibleItems) || !cfg.visibleItems.length) {
        cfg.visibleItems = [...defaultVisible];
    } else {
        cfg.visibleItems = cfg.visibleItems.filter(id => id !== 'line' && id !== 'image' && id !== 'laser' && allIds.includes(id));
    }
    if (!cfg.carbonNextToPenV14_2) {
        cfg.visibleItems = cfg.visibleItems.filter(id => id !== 'pan');
        if (!cfg.visibleItems.includes('carbon')) {
            const idxBp = cfg.visibleItems.indexOf('ballpoint');
            if (idxBp >= 0) cfg.visibleItems.splice(idxBp, 0, 'carbon');
            else cfg.visibleItems.unshift('carbon');
        }
        const idxBpOrder = cfg.itemOrder.indexOf('ballpoint');
        cfg.itemOrder = cfg.itemOrder.filter(id => id !== 'carbon');
        cfg.itemOrder.splice(Math.max(0, idxBpOrder), 0, 'carbon');
        cfg.carbonNextToPenV14_2 = true;
    }
    return cfg;
}

function isPenPillItemVisible(cfg, itemId) {
    return Array.isArray(cfg.visibleItems) ? cfg.visibleItems.includes(itemId) : (cfg.visibleItems?.[itemId] !== false);
}

function applyPenPillLayout() {
    const cfg = ensurePenPillConfig();
    const row = document.getElementById('penSubtoolbarRow');
    const ws = document.getElementById('workspaceContainer');
    const pill = document.getElementById('penPillWidget');
    const isFloating = cfg.dock !== 'top_center';
    const wasCollapsed = row ? row.classList.contains('pen-row-collapsed') : false;

    if (row) row.classList.toggle('pen-row-collapsed', isFloating);
    if (ws) ws.classList.toggle('pen-row-collapsed', isFloating);

    if (pill) {
        pill.classList.toggle('is-floating', isFloating);
        pill.classList.toggle('pill-vertical', !!cfg.vertical);

        if (!isFloating) {
            pill.style.left = '';
            pill.style.top = '';
            pill.style.right = '';
            pill.style.bottom = '';
            pill.style.transformOrigin = 'center center';
            pill.style.transform = Math.abs(cfg.scale - 1) > 0.001 ? `scale(${cfg.scale})` : '';
        } else {
            const vw = (typeof window !== 'undefined' && window.innerWidth) || 1200;
            const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
            const scaleCss = Math.abs(cfg.scale - 1) > 0.001 ? `scale(${cfg.scale})` : '';
            const dockMap = {
                top_left:      { left: '12px', top: '96px', right: '', bottom: '', ox: 'left', oy: 'top', tx: '' },
                top_right:     { left: '', top: '96px', right: '12px', bottom: '', ox: 'right', oy: 'top', tx: '' },
                bottom_center: { left: '50%', top: '', right: '', bottom: '14px', ox: 'center', oy: 'bottom', tx: 'translateX(-50%)' },
                bottom_left:   { left: '12px', top: '', right: '', bottom: '14px', ox: 'left', oy: 'bottom', tx: '' },
                bottom_right:  { left: '', top: '', right: '12px', bottom: '14px', ox: 'right', oy: 'bottom', tx: '' },
                left_edge:     { left: '10px', top: '50%', right: '', bottom: '', ox: 'left', oy: 'center', tx: 'translateY(-50%)' },
                right_edge:    { left: '', top: '50%', right: '10px', bottom: '', ox: 'right', oy: 'center', tx: 'translateY(-50%)' }
            };
            const spec = dockMap[cfg.dock];
            if (spec) {
                pill.style.left = spec.left;
                pill.style.top = spec.top;
                pill.style.right = spec.right;
                pill.style.bottom = spec.bottom;
                pill.style.transformOrigin = `${spec.ox} ${spec.oy}`;
                pill.style.transform = [spec.tx, scaleCss].filter(Boolean).join(' ');
            } else {
                const safeTop = getSafeTopInsetPx();
                const box = getPillBoxSize(pill, cfg, 'pen');
                const rawX = (cfg.x !== null && Number.isFinite(Number(cfg.x))) ? Number(cfg.x) : 24;
                const rawY = (cfg.y !== null && Number.isFinite(Number(cfg.y))) ? Number(cfg.y) : (108 + safeTop);
                const cx = Math.max(6, Math.min(Math.max(6, vw - box.w - 6), rawX));
                const cy = Math.max(48 + safeTop, Math.min(Math.max(48 + safeTop, vh - box.h - 8), rawY));
                cfg.x = cx;
                cfg.y = cy;
                pill.style.left = `${cx}px`;
                pill.style.top = `${cy}px`;
                pill.style.right = '';
                pill.style.bottom = '';
                pill.style.transformOrigin = 'left top';
                pill.style.transform = scaleCss;
            }
        }
    }

    const bar = document.getElementById('penPillBar');
    const endDivider = document.getElementById('penPillEndDivider');
    if (bar && endDivider && Array.isArray(cfg.itemOrder)) {
        cfg.itemOrder.forEach(itemId => {
            if (itemId === 'undo_redo') return;
            const node = bar.querySelector(`[data-pill-item="${itemId}"]`)
                || document.getElementById('pp-item-' + itemId)
                || document.getElementById('sp-' + itemId);
            if (node && node.parentElement === bar) {
                bar.insertBefore(node, endDivider);
            }
        });
    }

    if (typeof PEN_PILL_ITEMS_CATALOG !== 'undefined') {
        for (const item of PEN_PILL_ITEMS_CATALOG) {
            const visible = isPenPillItemVisible(cfg, item.id);
            const node = document.getElementById('pp-item-' + item.id) || document.getElementById('sp-' + item.id);
            if (node) node.classList.toggle('hidden', !visible);
        }
    }

    const orientLbl = document.getElementById('penPillOrientLbl');
    if (orientLbl) orientLbl.textContent = cfg.vertical ? 'Dọc' : 'Ngang';
    const scaleLbl = document.getElementById('penPillScaleValLbl');
    if (scaleLbl) scaleLbl.textContent = `${Math.round(cfg.scale * 100)}%`;
    const scaleSlider = document.getElementById('penPillScaleSlider');
    if (scaleSlider && scaleSlider.value !== String(cfg.scale)) scaleSlider.value = String(cfg.scale);

    if (wasCollapsed !== isFloating && typeof resizeCanvas === 'function') {
        resizeCanvas();
    }
}

function setPenPillDock(dockId) {
    const cfg = ensurePenPillConfig();
    cfg.dock = dockId;
    if (dockId === 'left_edge' || dockId === 'right_edge') cfg.vertical = true;
    else if (dockId === 'top_center' || dockId === 'bottom_center') cfg.vertical = false;
    cfg.orientation = cfg.vertical ? 'vertical' : 'horizontal';
    persistLibrary();
    applyPenPillLayout();
    renderPenPillConfigPopover();
}

function togglePenPillOrientation(ev) {
    ev?.stopPropagation();
    const cfg = ensurePenPillConfig();
    cfg.vertical = !cfg.vertical;
    cfg.orientation = cfg.vertical ? 'vertical' : 'horizontal';
    persistLibrary();
    applyPenPillLayout();
    renderPenPillConfigPopover();
}

function onPenPillScaleChange(val) {
    const cfg = ensurePenPillConfig();
    cfg.scale = Math.max(0.75, Math.min(1.35, parseFloat(val) || 1));
    persistLibrary();
    applyPenPillLayout();
}

function togglePenPillItemVisible(itemId) {
    const cfg = ensurePenPillConfig();
    const idx = cfg.visibleItems.indexOf(itemId);
    if (idx >= 0) {
        if (cfg.visibleItems.length <= 1) {
            if (typeof showGestureToast === 'function') showGestureToast('Cần giữ ít nhất 1 công cụ hiển thị');
            return;
        }
        cfg.visibleItems.splice(idx, 1);
    } else {
        cfg.visibleItems.push(itemId);
    }
    persistLibrary();
    applyPenPillLayout();
    renderPenPillConfigPopover();
}

function togglePenPillConfigPopover(ev) {
    ev?.stopPropagation();
    const pop = document.getElementById('penPillConfigPopover');
    if (!pop) return;
    const wasHidden = pop.classList.contains('hidden');
    closeAllPopovers();
    if (wasHidden) {
        renderPenPillConfigPopover();
        positionPopoverUnderButton(pop, ev?.currentTarget || document.getElementById('penPillConfigBtn'));
        pop.classList.remove('hidden');
    }
}

function movePenPillItem(itemId, delta) {
    const cfg = ensurePenPillConfig();
    if (!Array.isArray(cfg.itemOrder)) return;
    const movableIds = cfg.itemOrder.filter(id => id !== 'undo_redo');
    const idx = movableIds.indexOf(itemId);
    const nextIdx = idx + (delta < 0 ? -1 : 1);
    if (idx < 0 || nextIdx < 0 || nextIdx >= movableIds.length) return;
    const swapId = movableIds[nextIdx];
    const realA = cfg.itemOrder.indexOf(itemId);
    const realB = cfg.itemOrder.indexOf(swapId);
    if (realA < 0 || realB < 0) return;
    cfg.itemOrder[realA] = swapId;
    cfg.itemOrder[realB] = itemId;
    persistLibrary();
    applyPenPillLayout();
    renderPenPillConfigPopover();
}

function resetPenPillConfig() {
    const allIds = typeof PEN_PILL_ITEMS_CATALOG !== 'undefined' ? PEN_PILL_ITEMS_CATALOG.map(it => it.id) : [];
    appLibrary.penPillConfig = {
        dock: 'top_center',
        x: null,
        y: null,
        vertical: false,
        orientation: 'horizontal',
        scale: 1.0,
        carbonNextToPenV14_2: true,
        movedImgLaserToNavyV15: true,
        itemOrder: [...allIds],
        visibleItems: ['undo_redo', 'carbon', 'ballpoint', 'highlighter', 'eraser', 'lasso', 'stroke_slots', 'color_wells']
    };
    persistLibrary();
    applyPenPillLayout();
    renderPenPillConfigPopover();
    if (typeof showGestureToast === 'function') showGestureToast('Đã khôi phục mặc định Viên thuốc Bút');
}

function renderPenPillConfigPopover() {
    const cfg = ensurePenPillConfig();
    const dockGrid = document.getElementById('penPillDockGrid');
    if (dockGrid) {
        dockGrid.innerHTML = PEN_PILL_DOCK_OPTIONS.map(opt => `
            <button onclick="setPenPillDock('${opt.id}')" class="px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition ${cfg.dock === opt.id ? 'border-sky-400 bg-sky-500/20 text-sky-300' : 'border-slate-700/80 bg-slate-800/70 text-slate-300 hover:border-sky-500/50'}">${opt.label}</button>
        `).join('');
    }
    const orientLbl = document.getElementById('penPillOrientLbl');
    if (orientLbl) orientLbl.textContent = cfg.vertical ? 'Dọc' : 'Ngang';
    const scaleLbl = document.getElementById('penPillScaleValLbl');
    if (scaleLbl) scaleLbl.textContent = `${Math.round(cfg.scale * 100)}%`;
    const scaleSlider = document.getElementById('penPillScaleSlider');
    if (scaleSlider) scaleSlider.value = String(cfg.scale);

    const checkBox = document.getElementById('penPillItemsChecklist');
    if (checkBox && typeof PEN_PILL_ITEMS_CATALOG !== 'undefined') {
        const order = Array.isArray(cfg.itemOrder) ? cfg.itemOrder : PEN_PILL_ITEMS_CATALOG.map(it => it.id);
        const movableIds = order.filter(id => id !== 'undo_redo');
        checkBox.innerHTML = order.map(itemId => {
            const item = PEN_PILL_ITEMS_CATALOG.find(it => it.id === itemId);
            if (!item) return '';
            const on = isPenPillItemVisible(cfg, item.id);
            const mvIdx = movableIds.indexOf(item.id);
            const canMove = item.id !== 'undo_redo';
            return `<div class="toolbar-cfg-row">
                <button onclick="togglePenPillItemVisible('${item.id}')" class="toolbar-cfg-toggle ${on ? '' : 'is-hidden'}">
                    <span class="truncate">${item.label}</span>
                    <span class="toolbar-cfg-badge">${on ? 'HIỆN' : 'ẨN'}</span>
                </button>
                ${canMove ? `<div class="toolbar-cfg-arrows">
                    <button onclick="movePenPillItem('${item.id}', -1)" ${mvIdx <= 0 ? 'disabled' : ''} class="toolbar-cfg-arrow-btn" title="Đưa sang trái / lên">▲</button>
                    <button onclick="movePenPillItem('${item.id}', 1)" ${mvIdx >= movableIds.length - 1 ? 'disabled' : ''} class="toolbar-cfg-arrow-btn" title="Đưa sang phải / xuống">▼</button>
                </div>` : ''}
            </div>`;
        }).join('');
    }
}

/* --- TÙY CHỈNH & SẮP XẾP THANH HUB CÔNG CỤ HÀNG 2 (NAVY TOOLBAR) --- */
function ensureNavyToolbarConfig() {
    const allIds = typeof NAVY_TOOLBAR_ITEMS_CATALOG !== 'undefined' ? NAVY_TOOLBAR_ITEMS_CATALOG.map(it => it.id) : [];
    if (!appLibrary.navyToolbarConfig || typeof appLibrary.navyToolbarConfig !== 'object') {
        appLibrary.navyToolbarConfig = { itemOrder: [...allIds], hiddenItems: [] };
    }
    const cfg = appLibrary.navyToolbarConfig;
    let order = Array.isArray(cfg.itemOrder)
        ? cfg.itemOrder.filter((id, idx, arr) => allIds.includes(id) && arr.indexOf(id) === idx)
        : [];
    allIds.forEach(id => { if (!order.includes(id)) order.push(id); });
    cfg.itemOrder = order;
    cfg.hiddenItems = Array.isArray(cfg.hiddenItems)
        ? cfg.hiddenItems.filter((id, idx, arr) => allIds.includes(id) && arr.indexOf(id) === idx)
        : [];
    return cfg;
}

function applyNavyToolbarLayout() {
    const cfg = ensureNavyToolbarConfig();
    const row = document.getElementById('navyToolbarItemsRow');
    if (!row) return;
    const hiddenSet = new Set(cfg.hiddenItems || []);
    cfg.itemOrder.forEach(itemId => {
        const node = row.querySelector(`[data-navy-item="${itemId}"]`);
        if (!node) return;
        node.classList.toggle('hidden', hiddenSet.has(itemId));
        row.appendChild(node);
    });
}

function toggleNavyToolbarItemVisible(itemId) {
    const cfg = ensureNavyToolbarConfig();
    const allIds = cfg.itemOrder || [];
    const idx = cfg.hiddenItems.indexOf(itemId);
    if (idx >= 0) {
        cfg.hiddenItems.splice(idx, 1);
    } else {
        if (allIds.length - cfg.hiddenItems.length <= 1) {
            if (typeof showGestureToast === 'function') showGestureToast('Cần giữ ít nhất 1 nút trên Thanh Hub');
            return;
        }
        cfg.hiddenItems.push(itemId);
    }
    persistLibrary();
    applyNavyToolbarLayout();
    renderNavyToolbarConfigPopover();
}

function moveNavyToolbarItem(itemId, delta) {
    const cfg = ensureNavyToolbarConfig();
    const idx = cfg.itemOrder.indexOf(itemId);
    const nextIdx = idx + (delta < 0 ? -1 : 1);
    if (idx < 0 || nextIdx < 0 || nextIdx >= cfg.itemOrder.length) return;
    const swapId = cfg.itemOrder[nextIdx];
    cfg.itemOrder[idx] = swapId;
    cfg.itemOrder[nextIdx] = itemId;
    persistLibrary();
    applyNavyToolbarLayout();
    renderNavyToolbarConfigPopover();
}

function resetNavyToolbarConfig() {
    const allIds = typeof NAVY_TOOLBAR_ITEMS_CATALOG !== 'undefined' ? NAVY_TOOLBAR_ITEMS_CATALOG.map(it => it.id) : [];
    appLibrary.navyToolbarConfig = { movedImgLaserToNavyV15: true, itemOrder: [...allIds], hiddenItems: [] };
    persistLibrary();
    applyNavyToolbarLayout();
    renderNavyToolbarConfigPopover();
    if (typeof showGestureToast === 'function') showGestureToast('Đã khôi phục mặc định Thanh Hub Công cụ');
}

function toggleNavyToolbarConfigPopover(ev) {
    ev?.stopPropagation();
    const pop = document.getElementById('navyToolbarConfigPopover');
    if (!pop) return;
    const wasHidden = pop.classList.contains('hidden');
    closeAllPopovers();
    if (wasHidden) {
        renderNavyToolbarConfigPopover();
        const rawTarget = ev?.currentTarget;
        const r = rawTarget && typeof rawTarget.getBoundingClientRect === 'function' ? rawTarget.getBoundingClientRect() : null;
        const anchor = (r && (r.width > 0 || r.height > 0)) ? rawTarget : document.getElementById('navyToolbarConfigBtn');
        positionPopoverUnderButton(pop, anchor);
        pop.classList.remove('hidden');
    }
}

function renderNavyToolbarConfigPopover() {
    const box = document.getElementById('navyToolbarItemsChecklist');
    if (!box || typeof NAVY_TOOLBAR_ITEMS_CATALOG === 'undefined') return;
    const cfg = ensureNavyToolbarConfig();
    const hiddenSet = new Set(cfg.hiddenItems || []);
    const order = cfg.itemOrder;
    box.innerHTML = order.map((itemId, idx) => {
        const meta = NAVY_TOOLBAR_ITEMS_CATALOG.find(it => it.id === itemId);
        if (!meta) return '';
        const visible = !hiddenSet.has(itemId);
        return `<div class="toolbar-cfg-row">
            <button onclick="toggleNavyToolbarItemVisible('${itemId}')" class="toolbar-cfg-toggle ${visible ? '' : 'is-hidden'}">
                <span class="truncate">${meta.label}</span>
                <span class="toolbar-cfg-badge">${visible ? 'HIỆN' : 'ẨN'}</span>
            </button>
            <div class="toolbar-cfg-arrows">
                <button onclick="moveNavyToolbarItem('${itemId}', -1)" ${idx <= 0 ? 'disabled' : ''} class="toolbar-cfg-arrow-btn" title="Đưa sang trái / lên">▲</button>
                <button onclick="moveNavyToolbarItem('${itemId}', 1)" ${idx >= order.length - 1 ? 'disabled' : ''} class="toolbar-cfg-arrow-btn" title="Đưa sang phải / xuống">▼</button>
            </div>
        </div>`;
    }).join('');
}

/* Viên thuốc số 2 đã được gỡ bỏ theo yêu cầu v14.2 — giữ stub an toàn */
function ensureCustomChemPillConfig() {
    return { enabled: false, collapsed: true, vertical: false, scale: 1.0, x: 16, y: 148, tools: [] };
}
function renderCustomChemPill() {
    document.getElementById('customChemPill')?.classList?.add('hidden');
}

/* --- KÉO DI CHUYỂN VIÊN THUỐC BẤT KỲ ĐÂU TRÊN MÀN HÌNH --- */
function getSafeTopInsetPx() {
    if (typeof document === 'undefined') return 0;
    try {
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            const topEl = document.body?.classList?.contains('fullscreen-focus-mode')
                ? document.querySelector('.gn-navy-toolbar')
                : document.querySelector('.gn-top-tabs');
            if (topEl) {
                const pt = parseFloat(window.getComputedStyle(topEl).paddingTop);
                if (Number.isFinite(pt) && pt > 0) return pt;
            }
        }
    } catch (_) {}
    return 0;
}

function getPillBoxSize(pillEl, cfg, whichPill) {
    const scale = (cfg && Number.isFinite(Number(cfg.scale))) ? Number(cfg.scale) : 1;
    if (pillEl && typeof pillEl.offsetWidth === 'number' && pillEl.offsetWidth > 0 &&
        typeof pillEl.offsetHeight === 'number' && pillEl.offsetHeight > 0) {
        return {
            w: Math.max(44, Math.round(pillEl.offsetWidth * scale)),
            h: Math.max(40, Math.round(pillEl.offsetHeight * scale))
        };
    }
    const isVert = !!(cfg && cfg.vertical);
    if (whichPill === 'pen') {
        return isVert ? { w: Math.round(98 * scale), h: Math.round(280 * scale) } : { w: Math.round(360 * scale), h: Math.round(54 * scale) };
    }
    return isVert ? { w: Math.round(92 * scale), h: Math.round(250 * scale) } : { w: Math.round(320 * scale), h: Math.round(52 * scale) };
}

function startPillDrag(whichPill, ev) {
    if (!ev) return;
    if (ev.button !== undefined && ev.button !== 0 && ev.pointerType === 'mouse') return;
    ev.preventDefault?.();
    ev.stopPropagation?.();

    const pillEl = document.getElementById(whichPill === 'pen' ? 'penPillWidget' : 'customChemPill');
    if (!pillEl) return;

    let cfg;
    if (whichPill === 'pen') {
        cfg = ensurePenPillConfig();
        if (cfg.dock !== 'free' || cfg.x === null || cfg.y === null) {
            const r0 = pillEl.getBoundingClientRect();
            cfg.dock = 'free';
            cfg.x = r0.left;
            cfg.y = r0.top;
            applyPenPillLayout();
        }
    } else {
        cfg = ensureCustomChemPillConfig();
    }

    const r1 = pillEl.getBoundingClientRect();
    let box = getPillBoxSize(pillEl, cfg, whichPill);
    const dragPointerId = ev.pointerId;
    const startClientX = Number(ev.clientX) || 0;
    const startClientY = Number(ev.clientY) || 0;
    const baseX = (cfg.x !== null && Number.isFinite(Number(cfg.x))) ? Number(cfg.x)
        : (Number.isFinite(parseFloat(pillEl.style.left)) ? parseFloat(pillEl.style.left) : r1.left);
    const baseY = (cfg.y !== null && Number.isFinite(Number(cfg.y))) ? Number(cfg.y)
        : (Number.isFinite(parseFloat(pillEl.style.top)) ? parseFloat(pillEl.style.top) : r1.top);

    const onMove = (moveEv) => {
        if (dragPointerId !== undefined && moveEv.pointerId !== undefined && moveEv.pointerId !== dragPointerId) return;
        const vw = (typeof window !== 'undefined' && window.innerWidth) || 1200;
        const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
        const safeTop = getSafeTopInsetPx();
        const topBoundary = 48 + safeTop;
        const curClientX = Number(moveEv.clientX) || 0;
        const curClientY = Number(moveEv.clientY) || 0;
        const dx = curClientX - startClientX;
        const dy = curClientY - startClientY;

        let nx = Math.max(6, Math.min(Math.max(6, vw - box.w - 6), baseX + dx));
        let ny = Math.max(topBoundary, Math.min(Math.max(topBoundary, vh - box.h - 8), baseY + dy));

        const minSideDist = Math.min(
            Math.max(0, nx),
            Math.max(0, vw - (nx + box.w)),
            Math.max(0, curClientX),
            Math.max(0, vw - curClientX)
        );
        const minTopBottomDist = Math.min(
            Math.max(0, ny - topBoundary),
            Math.max(0, vh - (ny + box.h)),
            Math.max(0, curClientY - topBoundary),
            Math.max(0, vh - curClientY)
        );

        let nextVertical = !!cfg.vertical;
        if (minTopBottomDist <= 105 && minTopBottomDist <= minSideDist + 10) {
            nextVertical = false;
        } else if (minSideDist <= 115 && minSideDist + 10 < minTopBottomDist) {
            nextVertical = true;
        }

        if (nextVertical !== !!cfg.vertical) {
            cfg.vertical = nextVertical;
            if (whichPill === 'pen') {
                pillEl.classList.toggle('pill-vertical', !!cfg.vertical);
                const orientLbl = document.getElementById('penPillOrientLbl');
                if (orientLbl) orientLbl.textContent = cfg.vertical ? 'Dọc' : 'Ngang';
            } else {
                renderCustomChemPill();
            }
            box = getPillBoxSize(pillEl, cfg, whichPill);
            if (nextVertical && curClientX > vw * 0.5) {
                nx = Math.max(6, vw - box.w - 8);
            } else if (nextVertical && curClientX <= 125) {
                nx = 8;
            }
            nx = Math.max(6, Math.min(Math.max(6, vw - box.w - 6), nx));
            ny = Math.max(topBoundary, Math.min(Math.max(topBoundary, vh - box.h - 8), ny));
        }

        cfg.x = Math.round(nx);
        cfg.y = Math.round(ny);
        pillEl.style.left = `${cfg.x}px`;
        pillEl.style.top = `${cfg.y}px`;
    };

    const onEnd = (endEv) => {
        if (dragPointerId !== undefined && endEv && endEv.pointerId !== undefined && endEv.pointerId !== dragPointerId) return;
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        }
        persistLibrary();
        if (whichPill === 'pen') renderPenPillConfigPopover();
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    }
}

/* --- ĐIỀU HƯỚNG TRANG NHANH, TỰ ĐỘNG THÊM TRANG & CHẾ ĐỘ TRÌNH CHIẾU MEET/ZOOM --- */
function togglePageHudExpanded(ev) {
    if (ev) ev.stopPropagation();
    isPageHudExpanded = !isPageHudExpanded;
    syncPageQuickNavUI();
}

let lastPageQuickNavUiKey = '';
function syncPageQuickNavUI() {
    const nb = typeof getActiveNotebook === 'function' ? getActiveNotebook() : null;
    if (!nb) return;
    const total = Math.max(1, (nb.pages || []).length);
    const cur = Math.max(0, Math.min(total - 1, nb.activePageIndex || 0));
    const allowCompact = appLibrary.ipadConfig?.pageHudCompact !== false;
    const isCompact = allowCompact && !isPageHudExpanded;
    const zPct = typeof zoom === 'number' ? Math.round(zoom * 100) : 100;
    const autoOn = appLibrary.autoAddPage !== false;
    const readOn = typeof isReadMode !== 'undefined' && isReadMode;
    const twoCol = readOn && typeof readTwoPageMode !== 'undefined' && readTwoPageMode && total > 1;
    const wMode = appLibrary.ipadConfig?.mouseWheelMode || 'scroll';
    const uiKey = cur + '/' + total + '|' + (isCompact ? 1 : 0) + '|' + zPct + '|' + (autoOn ? 1 : 0) + '|' + (readOn ? 1 : 0) + '|' + (twoCol ? 1 : 0) + '|' + wMode;
    if (uiKey === lastPageQuickNavUiKey) return;
    lastPageQuickNavUiKey = uiKey;

    const hud = document.getElementById('pageQuickNavHud');
    if (hud) hud.classList.toggle('pqn-compact', isCompact);
    const lbl = document.getElementById('pageQuickNavLabel');
    if (lbl) lbl.textContent = isCompact ? `${cur + 1}/${total}` : `Trang ${cur + 1}/${total}`;
    const expBtn = document.getElementById('pqnExpandBtn');
    if (expBtn) {
        expBtn.textContent = isCompact ? '⋯' : '‹';
        expBtn.title = isCompact ? 'Mở rộng zoom & tùy chọn trang' : 'Thu gọn thanh trang';
    }
    const presLbl = document.getElementById('presPageLabel');
    if (presLbl) presLbl.textContent = `${cur + 1}/${total}`;
    const zPctText = typeof zoom === 'number' ? `${Math.round(zoom * 100)}%` : '100%';
    const zBadge = document.getElementById('pqnZoomBadge');
    if (zBadge) zBadge.textContent = zPctText;
    const presZBadge = document.getElementById('presZoomBadge');
    if (presZBadge) presZBadge.textContent = zPctText;
    if (typeof syncMouseWheelModeUI === 'function') syncMouseWheelModeUI();
    const readLbl = document.getElementById('readModePageLabel');
    if (readLbl) {
        if (typeof isReadMode !== 'undefined' && isReadMode && typeof readTwoPageMode !== 'undefined' && readTwoPageMode && total > 1) {
            const leftIdx = Math.floor(cur / 2) * 2;
            const rightIdx = Math.min(total - 1, leftIdx + 1);
            readLbl.textContent = rightIdx !== leftIdx ? `Trang ${leftIdx + 1}–${rightIdx + 1}/${total}` : `Trang ${leftIdx + 1}/${total}`;
        } else {
            readLbl.textContent = `Trang ${cur + 1}/${total}`;
        }
    }
    const qBtn = document.getElementById('pageQuickAutoBtn');
    if (qBtn) {
        qBtn.classList.toggle('active', autoOn);
        qBtn.title = autoOn ? 'Tự động thêm trang: ĐANG BẬT (Nhấn để tắt)' : 'Tự động thêm trang: ĐANG TẮT (Nhấn để bật)';
    }
    const pBtn = document.getElementById('autoAddPageToggleBtn');
    if (pBtn) {
        pBtn.textContent = autoOn ? 'Đang bật' : 'Đang tắt';
        pBtn.classList.toggle('active', autoOn);
    }
}

function toggleAutoAddPage() {
    appLibrary.autoAddPage = !(appLibrary.autoAddPage !== false);
    persistLibrary();
    syncPageQuickNavUI();
    if (typeof showGestureToast === 'function') {
        showGestureToast(appLibrary.autoAddPage ? 'Đã bật tự động tạo trang mới' : 'Đã tắt tự động tạo trang mới');
    }
}

function stepActivePage(delta) {
    const nb = getActiveNotebook();
    if (!nb || !nb.pages || !nb.pages.length) return;
    const cur = nb.activePageIndex || 0;
    const target = cur + delta;
    if (target < 0) return;
    if (target >= nb.pages.length) {
        if (delta > 0 && appLibrary.autoAddPage !== false) {
            appendAutoPageToNotebook(nb, true);
            nb.activePageIndex = nb.pages.length - 1;
        } else {
            return;
        }
    } else {
        nb.activePageIndex = target;
    }
    undoStack = []; redoStack = [];
    laserStrokes = []; currentLaserStroke = null;
    syncActivePaperDimensions();
    renderOpenTabsBar();
    syncPageQuickNavUI();
    persistLibrary();
    if (typeof fitA4ToScreen === 'function') fitA4ToScreen();
    else if (typeof renderAll === 'function') renderAll();
}

function isAudienceWindowOpen() {
    return typeof audienceWindow !== 'undefined' && !!audienceWindow && !audienceWindow.closed;
}

function formatRecDuration(ms) {
    const sec = Math.max(0, Math.floor((ms || 0) / 1000));
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function syncPresentationModeUI() {
    const active = typeof isPresentationMode !== 'undefined' && !!isPresentationMode;
    if (typeof document !== 'undefined' && document.body?.classList) {
        document.body.classList.toggle('presentation-mode', active);
    }
    const audOpen = isAudienceWindowOpen();
    const recOn = typeof isCleanRecording !== 'undefined' && !!isCleanRecording;
    const btn = document.getElementById('presentationModeBtn');
    if (btn) btn.classList.toggle('active', active || audOpen || recOn);

    const dot = document.getElementById('presenterStatusDot');
    if (dot) {
        dot.classList.toggle('hidden', !audOpen && !recOn);
        dot.classList.toggle('is-recording', recOn);
    }
    const lbl = document.getElementById('presenterBtnLabel');
    if (lbl) {
        if (recOn) lbl.textContent = `REC ${formatRecDuration(Date.now() - cleanRecordStartTime)}`;
        else if (audOpen) lbl.textContent = 'Đang chiếu';
        else lbl.textContent = 'Trình chiếu';
    }
    syncPresenterPopoverUI();
}

function syncPresenterPopoverUI() {
    const audOpen = isAudienceWindowOpen();
    const recOn = typeof isCleanRecording !== 'undefined' && !!isCleanRecording;
    document.getElementById('audienceLiveBadge')?.classList.toggle('hidden', !audOpen);
    const openBtn = document.getElementById('openAudienceWinBtn');
    if (openBtn) {
        openBtn.textContent = audOpen ? '⏹ Đóng cửa sổ Bảng Trắng Học Sinh' : 'Mở cửa sổ Bảng Trắng Sạch';
        openBtn.className = audOpen
            ? 'w-full h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition'
            : 'w-full h-8 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition';
    }
    const followLbl = document.getElementById('audienceFollowZoomLbl');
    if (followLbl) {
        const f = typeof audienceFollowZoom === 'undefined' ? true : !!audienceFollowZoom;
        followLbl.textContent = f ? 'Theo Zoom của mình' : 'Luôn vừa trọn trang';
    }
    const micBadge = document.getElementById('cleanRecordMicBadge');
    if (micBadge) {
        const mOn = typeof recordWithMic !== 'undefined' && !!recordWithMic;
        micBadge.textContent = mOn ? 'BẬT' : 'TẮT';
        micBadge.className = mOn ? 'text-emerald-400 font-extrabold' : 'text-slate-400 font-extrabold';
    }
    const recBadge = document.getElementById('cleanRecTimerBadge');
    if (recBadge) {
        recBadge.classList.toggle('hidden', !recOn);
        if (recOn) recBadge.textContent = formatRecDuration(Date.now() - cleanRecordStartTime);
    }
    const recBtn = document.getElementById('cleanRecordActionBtn');
    if (recBtn) {
        recBtn.textContent = recOn
            ? `⏹ Dừng & Lưu video (${formatRecDuration(Date.now() - cleanRecordStartTime)})`
            : '⏺ Bắt đầu quay bảng sạch';
    }
    if (typeof syncPromoDemoUI === 'function') syncPromoDemoUI();
}

function togglePresenterPopover(ev) {
    ev?.stopPropagation();
    const pop = document.getElementById('presenterPopover');
    if (!pop) return;
    const isHidden = pop.classList.contains('hidden');
    closeAllPopovers();
    if (isHidden) {
        syncPresenterPopoverUI();
        positionPopoverUnderButton(pop, ev?.currentTarget || document.getElementById('presentationModeBtn'));
        pop.classList.remove('hidden');
    }
}

function openAudienceProjectorWindow() {
    if (isAudienceWindowOpen()) {
        try { audienceWindow.focus(); } catch (e) {}
        syncPresentationModeUI();
        return audienceWindow;
    }
    const win = window.open('', 'ChemNotesAudienceView', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
    if (!win) {
        if (typeof showGestureToast === 'function') {
            showGestureToast('Trình duyệt đang chặn Popup — hãy cho phép mở cửa sổ để trình chiếu Bảng Trắng');
        }
        return null;
    }
    audienceWindow = win;
    try {
        const d = win.document;
        d.open();
        d.write(`<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><title>ChemNote — Bảng Trắng Học Sinh (Zoom / Google Meet)</title>
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#ffffff;}canvas{display:block;width:100vw;height:100vh;}</style>
</head><body><canvas id="audienceCanvas"></canvas></body></html>`);
        d.close();
        win.addEventListener('resize', () => {
            if (typeof syncAudienceAndRecordingFrames === 'function') syncAudienceAndRecordingFrames();
        });
        win.addEventListener('beforeunload', () => {
            audienceWindow = null;
            syncPresentationModeUI();
        });
    } catch (e) {}
    syncPresentationModeUI();
    if (typeof syncAudienceAndRecordingFrames === 'function') syncAudienceAndRecordingFrames();
    if (typeof showGestureToast === 'function') {
        showGestureToast('Đã mở Bảng Trắng Học Sinh! Khi Share Zoom/Meet hãy chọn cửa sổ này');
    }
    return win;
}

function closeAudienceProjectorWindow() {
    if (audienceWindow && !audienceWindow.closed) {
        try { audienceWindow.close(); } catch (e) {}
    }
    audienceWindow = null;
    syncPresentationModeUI();
}

function toggleAudienceProjectorWindow() {
    if (isAudienceWindowOpen()) {
        closeAudienceProjectorWindow();
        if (typeof showGestureToast === 'function') showGestureToast('Đã đóng cửa sổ Bảng Trắng Học Sinh');
    } else {
        openAudienceProjectorWindow();
    }
}

function toggleAudienceFollowZoom() {
    audienceFollowZoom = !(typeof audienceFollowZoom === 'undefined' ? true : audienceFollowZoom);
    syncPresenterPopoverUI();
    if (typeof syncAudienceAndRecordingFrames === 'function') syncAudienceAndRecordingFrames();
    if (typeof showGestureToast === 'function') {
        showGestureToast(audienceFollowZoom
            ? 'Bảng trắng: Đi theo góc Zoom của giáo viên'
            : 'Bảng trắng: Luôn căn vừa trọn trang giấy');
    }
}

function toggleRecordMicOption() {
    recordWithMic = !recordWithMic;
    syncPresenterPopoverUI();
}

function pickSupportedRecorderMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4;codecs=avc1',
        'video/mp4'
    ];
    return candidates.find(m => MediaRecorder.isTypeSupported(m)) || '';
}

function downloadCleanRecordingBlob(chunks, mimeType) {
    if (!chunks || !chunks.length) return;
    const finalType = mimeType || 'video/webm';
    const ext = finalType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: finalType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    a.href = url;
    a.download = `ChemNotes-BangTrang-${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
    }, 500);
}

async function startCleanBoardRecording() {
    if (isCleanRecording) return;
    if (typeof MediaRecorder === 'undefined') {
        if (typeof showGestureToast === 'function') {
            showGestureToast('Trình duyệt hiện tại chưa hỗ trợ MediaRecorder');
        }
        return;
    }
    if (!cleanRecordCanvas) {
        cleanRecordCanvas = document.createElement('canvas');
    }
    cleanRecordCanvas.width = 1440;
    cleanRecordCanvas.height = 900;
    if (typeof syncAudienceAndRecordingFrames === 'function') syncAudienceAndRecordingFrames();

    if (typeof cleanRecordCanvas.captureStream !== 'function') {
        if (typeof showGestureToast === 'function') {
            showGestureToast('Trình duyệt không hỗ trợ captureStream trên Canvas');
        }
        return;
    }

    const videoStream = cleanRecordCanvas.captureStream(30);
    const tracks = [...videoStream.getVideoTracks()];
    cleanRecordAudioStream = null;
    if (recordWithMic && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
            cleanRecordAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            cleanRecordAudioStream.getAudioTracks().forEach(t => tracks.push(t));
        } catch (err) {
            if (typeof showGestureToast === 'function') {
                showGestureToast('Không truy cập được Micro — quay video không tiếng');
            }
        }
    }

    const combinedStream = new MediaStream(tracks);
    const mimeType = pickSupportedRecorderMimeType();
    cleanRecordedChunks = [];
    try {
        cleanMediaRecorder = mimeType
            ? new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 3500000 })
            : new MediaRecorder(combinedStream);
    } catch (e) {
        cleanMediaRecorder = new MediaRecorder(combinedStream);
    }

    cleanMediaRecorder.ondataavailable = ev => {
        if (ev.data && ev.data.size > 0) cleanRecordedChunks.push(ev.data);
    };
    cleanMediaRecorder.onstop = () => {
        const recMime = cleanMediaRecorder?.mimeType || mimeType;
        downloadCleanRecordingBlob(cleanRecordedChunks, recMime);
        cleanRecordedChunks = [];
        if (cleanRecordAudioStream) {
            cleanRecordAudioStream.getTracks().forEach(t => t.stop());
            cleanRecordAudioStream = null;
        }
        clearInterval(cleanRecordTimer);
        clearInterval(cleanRecordHeartbeat);
        cleanRecordTimer = null;
        cleanRecordHeartbeat = null;
        isCleanRecording = false;
        syncPresentationModeUI();
        if (typeof showGestureToast === 'function') showGestureToast('Đã lưu Video Bảng Trắng Sạch về máy!');
    };

    isCleanRecording = true;
    cleanRecordStartTime = Date.now();
    if (typeof syncAudienceAndRecordingFrames === 'function') syncAudienceAndRecordingFrames();
    cleanMediaRecorder.start(400);
    cleanRecordTimer = setInterval(syncPresentationModeUI, 500);
    cleanRecordHeartbeat = setInterval(() => {
        if (isCleanRecording && typeof syncAudienceAndRecordingFrames === 'function') {
            syncAudienceAndRecordingFrames();
        }
    }, 180);
    closeAllPopovers();
    syncPresentationModeUI();
    if (typeof showGestureToast === 'function') {
        showGestureToast('Đang quay Bảng Trắng Sạch — mọi Hub của bạn không lọt vào video!');
    }
}

function stopCleanBoardRecording() {
    if (!isCleanRecording) return;
    if (cleanMediaRecorder && cleanMediaRecorder.state !== 'inactive') {
        cleanMediaRecorder.stop();
    } else {
        clearInterval(cleanRecordTimer);
        clearInterval(cleanRecordHeartbeat);
        isCleanRecording = false;
        syncPresentationModeUI();
    }
}

function toggleCleanBoardRecording() {
    if (isCleanRecording) stopCleanBoardRecording();
    else startCleanBoardRecording();
}

function togglePresentationMode(force) {
    if (typeof isPresentationMode === 'undefined') return;
    const next = typeof force === 'boolean' ? force : !isPresentationMode;
    if (next === isPresentationMode) {
        syncPresentationModeUI();
        return;
    }
    isPresentationMode = next;
    closeAllPopovers();
    if (isPresentationMode) {
        closePageGridModal();
        document.getElementById('libraryHubModal')?.classList.add('hidden');
        document.getElementById('helpHotkeysModal')?.classList.add('hidden');
        document.getElementById('feedbackHubModal')?.classList.add('hidden');
        document.getElementById('versionUpdateHubModal')?.classList.add('hidden');
        document.getElementById('supportCommunityModal')?.classList.add('hidden');
        document.getElementById('periodicHubModal')?.classList.add('hidden');
    }
    syncPresentationModeUI();
    syncPageQuickNavUI();
    if (typeof resizeCanvas === 'function') resizeCanvas();
    if (typeof fitA4ToScreen === 'function') fitA4ToScreen();
    setTimeout(() => {
        if (typeof resizeCanvas === 'function') resizeCanvas();
        if (typeof fitA4ToScreen === 'function') fitA4ToScreen();
    }, 60);
    if (typeof showGestureToast === 'function') {
        showGestureToast(isPresentationMode
            ? 'Trình chiếu Meet/Zoom: Rê chuột góc phải dưới hoặc nhấn Esc để thoát'
            : 'Đã thoát chế độ Trình chiếu');
    }
}

// =========================================================================
// HƯỚNG DẪN IPAD, CẢM ỨNG / TRỢ NĂNG & TÙY CHỈNH PHÍM TẮT
// =========================================================================
function ensureIpadConfig() {
    if (!appLibrary.ipadConfig || typeof appLibrary.ipadConfig !== 'object') {
        appLibrary.ipadConfig = {};
    }
    const defs = {
        singleFingerMode: 'pan',
        touchPanDefaultV2: true,
        stylusFineTipAutoDraw: true,
        doubleTapAction: 'eraser',
        twoFingerTapAction: 'undo',
        threeFingerTapAction: 'redo',
        twoFingerSwipePage: true,
        edgeSwipeExamDrawer: true,
        assistiveTouchEnabled: false,
        assistiveTouchX: null,
        assistiveTouchY: null,
        largeTouchTargets: false,
        handedness: 'right',
        holdToShapeDelayMs: 480,
        pageHudCompact: true,
        mouseWheelMode: 'scroll',
        batterySaverMode: false,
        fullscreenFocusMode: false
    };
    appLibrary.ipadConfig = { ...defs, ...appLibrary.ipadConfig };
    if (!appLibrary.ipadConfig._v13ScrollFix) {
        appLibrary.ipadConfig.mouseWheelMode = 'scroll';
        appLibrary.ipadConfig._v13ScrollFix = true;
    }
    return appLibrary.ipadConfig;
}

function syncMouseWheelModeUI() {
    const cfg = ensureIpadConfig();
    const isZoom = cfg.mouseWheelMode === 'zoom';
    ['pqnWheelModeBtn', 'presWheelModeBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.textContent = isZoom ? '🔍' : '↕';
        btn.classList.toggle('active', isZoom);
        btn.title = isZoom
            ? 'Con lăn chuột: Đang Thu/Phóng tại con trỏ (Giữ Shift+Lăn để kéo lên/xuống • Bấm để đổi)'
            : 'Con lăn chuột: Đang Kéo lên/xuống (Chụm 2 ngón / Ctrl+Lăn để Zoom • Bấm để đổi con lăn sang Zoom)';
    });
}

function toggleMouseWheelMode(ev) {
    ev?.stopPropagation?.();
    const cfg = ensureIpadConfig();
    cfg.mouseWheelMode = cfg.mouseWheelMode === 'zoom' ? 'scroll' : 'zoom';
    persistLibrary();
    syncMouseWheelModeUI();
    renderIpadTouchSettingsPanel();
    if (typeof showGestureToast === 'function') {
        showGestureToast(cfg.mouseWheelMode === 'zoom'
            ? '🔍 Con lăn chuột: Phóng to / Thu nhỏ tại con trỏ (Shift+Lăn để cuộn)'
            : '↕ Con lăn chuột: Cuộn trang (Ctrl+Lăn để Thu/Phóng)');
    }
}

function syncSingleFingerQuickBtnUI() {
    const cfg = ensureIpadConfig();
    const btn = document.getElementById('singleFingerQuickToggleBtn');
    if (!btn) return;
    const mode = cfg.singleFingerMode || 'pan';
    const isPan = mode === 'pan' || mode === 'ignore';
    btn.classList.toggle('mode-pan', isPan);
    btn.classList.toggle('mode-draw', !isPan);
    const lbl = btn.querySelector('.sf-quick-label');
    if (lbl) {
        if (mode === 'draw') lbl.textContent = '1 ngón: Vẽ';
        else if (mode === 'laser') lbl.textContent = '1 ngón: Laser';
        else if (mode === 'ignore') lbl.textContent = '1 ngón: Khoá';
        else lbl.textContent = '1 ngón: Cuộn';
    }
    const ico = btn.querySelector('.sf-quick-ico');
    if (ico) {
        ico.textContent = mode === 'draw' ? '✍️' : (mode === 'laser' ? '🔴' : '✋');
    }
    btn.title = isPan
        ? 'Chế độ 1 ngón: Cuộn/kéo trang (Apple Pencil vẫn viết bình thường). Bấm để chuyển sang 1 ngón Vẽ.'
        : 'Chế độ 1 ngón: Đang Vẽ nét. Bấm để chuyển về 1 ngón Cuộn trang (tránh chạm tay).';
}

function toggleSingleFingerDrawPan(ev) {
    ev?.stopPropagation?.();
    const cfg = ensureIpadConfig();
    const nextMode = (cfg.singleFingerMode === 'pan' || cfg.singleFingerMode === 'ignore') ? 'draw' : 'pan';
    cfg.singleFingerMode = nextMode;
    cfg.touchPanDefaultV2 = true;
    persistLibrary();
    applyIpadAccessibilityConfig();
    const panel = document.getElementById('ipadTouchSettingsPopover');
    if (panel && !panel.classList.contains('hidden') && typeof renderIpadTouchSettingsPanel === 'function') {
        renderIpadTouchSettingsPanel();
    }
    if (typeof showGestureToast === 'function') {
        showGestureToast(nextMode === 'pan'
            ? '✋ 1 ngón: Cuộn/kéo trang (Apple Pencil viết bình thường)'
            : '✍️ 1 ngón: Vẽ nét trực tiếp bằng ngón tay');
    }
}

function applyFullscreenFocusUI(enabled) {
    const on = !!enabled;
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.toggle('fullscreen-focus-mode', on);
    }
    document.getElementById('exitFullscreenFocusBtn')?.classList?.toggle('hidden', !on);
    document.getElementById('topFullscreenQuickBtn')?.classList?.toggle('active', on);
    const menuBtn = document.getElementById('fullscreenToggleBtn');
    if (menuBtn) {
        menuBtn.classList.toggle('active', on);
        menuBtn.textContent = on ? '⤢ Thoát TM' : '⛶ Toàn màn';
    }
}

function toggleAppFullscreen(forceState) {
    if (typeof document === 'undefined') return;
    const cfg = ensureIpadConfig();
    const curOn = !!(document.body?.classList?.contains('fullscreen-focus-mode') || cfg.fullscreenFocusMode);
    const nextOn = typeof forceState === 'boolean' ? forceState : !curOn;
    cfg.fullscreenFocusMode = nextOn;
    applyFullscreenFocusUI(nextOn);
    persistLibrary();

    const docEl = document.documentElement;
    const isNativeFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (nextOn && !isNativeFs) {
        const req = docEl?.requestFullscreen || docEl?.webkitRequestFullscreen;
        if (typeof req === 'function') {
            try {
                const p = req.call(docEl);
                if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch (_) {}
        }
    } else if (!nextOn && isNativeFs) {
        const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
        if (typeof exitFs === 'function') {
            try {
                const p = exitFs.call(document);
                if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch (_) {}
        }
    }

    if (typeof resizeCanvas === 'function') {
        resizeCanvas();
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resizeCanvas());
        }
    }
    if (typeof showGestureToast === 'function') {
        showGestureToast(nextOn
            ? '⛶ Toàn màn hình: đã ẩn thanh Tab, bấm ⤢ ở góc phải thanh xanh để hiện lại'
            : 'Đã hiện lại thanh Tab trên cùng');
    }
}

function applyIpadAccessibilityConfig() {
    const cfg = ensureIpadConfig();
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.toggle('large-touch-targets', !!cfg.largeTouchTargets);
        document.body.classList.toggle('left-handed-mode', cfg.handedness === 'left');
        document.body.classList.remove('ipad-standalone-safe');
        applyFullscreenFocusUI(!!cfg.fullscreenFocusMode);
    }
    syncSingleFingerQuickBtnUI();
    const widget = document.getElementById('ipadAssistiveWidget');
    if (widget) {
        widget.classList.toggle('hidden', !cfg.assistiveTouchEnabled);
        if (cfg.assistiveTouchEnabled) {
            if (Number.isFinite(Number(cfg.assistiveTouchX)) && Number.isFinite(Number(cfg.assistiveTouchY))) {
                const vw = (typeof window !== 'undefined' && window.innerWidth) || 1200;
                const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
                const ax = Math.max(8, Math.min(vw - 56, Number(cfg.assistiveTouchX)));
                const ay = Math.max(50, Math.min(vh - 56, Number(cfg.assistiveTouchY)));
                widget.style.left = `${ax}px`;
                widget.style.top = `${ay}px`;
                widget.style.right = 'auto';
                widget.style.bottom = 'auto';
            } else {
                widget.style.left = cfg.handedness === 'left' ? '16px' : '';
                widget.style.right = cfg.handedness === 'left' ? 'auto' : '16px';
                widget.style.top = '';
                widget.style.bottom = '72px';
            }
        }
    }
    const handleArrow = document.querySelector('#examDrawerHandle .exam-handle-arrow');
    if (handleArrow) handleArrow.textContent = cfg.handedness === 'left' ? '▶' : '◀';
    const collapseBtn = document.getElementById('examDrawerCollapseBtn');
    if (collapseBtn) collapseBtn.textContent = cfg.handedness === 'left' ? '◀ Thu gọn' : '▶ Thu gọn';
    syncPageQuickNavUI();
    if (typeof syncMouseWheelModeUI === 'function') syncMouseWheelModeUI();
    if (typeof updateCanvasCursor === 'function') updateCanvasCursor();
}

function setIpadConfigOption(key, value) {
    const cfg = ensureIpadConfig();
    cfg[key] = value;
    persistLibrary();
    applyIpadAccessibilityConfig();
    renderIpadTouchSettingsPanel();
    const msgMap = {
        singleFingerMode: {
            draw: '1 chạm/ngón: Viết & Vẽ trực tiếp',
            pan: '1 chạm/ngón: Cuộn & Kéo trang (Apple Pencil vẫn vẽ)',
            laser: '1 chạm/ngón: Con trỏ Laser thuyết trình',
            ignore: 'Kháng tì tay: Chỉ nhận bút Pencil, bỏ qua 1 ngón'
        },
        handedness: {
            right: 'Bố cục Tay phải (Ngăn đề bên phải)',
            left: 'Bố cục Tay trái (Ngăn đề bên trái)'
        }
    };
    const toast = msgMap[key]?.[value] || (key === 'mouseWheelMode'
        ? (value === 'zoom' ? '🔍 Con lăn chuột: Phóng to / Thu nhỏ tại con trỏ' : '↕ Con lăn chuột: Cuộn trang (Ctrl+Lăn để Zoom)')
        : null);
    if (toast && typeof showGestureToast === 'function') showGestureToast(toast);
}

function toggleIpadConfigBool(key) {
    const cfg = ensureIpadConfig();
    cfg[key] = !cfg[key];
    persistLibrary();
    applyIpadAccessibilityConfig();
    renderIpadTouchSettingsPanel();
    if (key === 'batterySaverMode') {
        if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
        if (typeof resizeCanvas === 'function') resizeCanvas();
        if (typeof showGestureToast === 'function') {
            showGestureToast(cfg.batterySaverMode
                ? '🔋 Đã bật Tiết kiệm pin (Eco 60Hz + giảm tải GPU Retina)'
                : '⚡ Đã tắt Eco Mode (120Hz ProMotion & Retina sắc nét tối đa)');
        }
    }
}

function renderIpadTouchSettingsPanel() {
    const panel = document.getElementById('helpTouchPanel');
    if (!panel) return;
    const cfg = ensureIpadConfig();
    const mkChoiceRow = (key, title, desc, options) => `
        <div class="help-guide-card space-y-2">
            <div>
                <div class="font-bold text-[12.5px]" style="color:var(--accent);">${title}</div>
                <div class="text-[10.5px] mt-0.5" style="color:var(--text-muted);">${desc}</div>
            </div>
            <div class="ipad-touch-grid">
                ${options.map(opt => {
                    const isAct = String(cfg[key]) === String(opt.val);
                    const jsVal = typeof opt.val === 'number' ? opt.val : `'${opt.val}'`;
                    return `<button type="button" onclick="setIpadConfigOption('${key}', ${jsVal})" class="ipad-opt-btn ${isAct ? 'active' : ''}">
                        <span class="truncate">${opt.label}</span>
                        <span>${isAct ? '✓' : ''}</span>
                    </button>`;
                }).join('')}
            </div>
        </div>
    `;
    const mkBoolRow = (key, title, desc) => {
        const on = !!cfg[key];
        return `<button type="button" onclick="toggleIpadConfigBool('${key}')" class="ipad-opt-btn w-full">
            <div class="min-w-0">
                <div class="text-[11.5px] font-bold truncate">${title}</div>
                <div class="text-[10px] font-normal truncate" style="color:var(--text-muted);">${desc}</div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${on ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/40 text-slate-400'}">${on ? 'BẬT' : 'TẮT'}</span>
        </button>`;
    };

    panel.innerHTML = [
        mkChoiceRow(
            'singleFingerMode',
            '1. Chế độ 1 chạm & Hỗ trợ Bút cảm ứng',
            'Apple Pencil luôn viết bình thường. Nếu dùng bút Trung Quốc đầu tròn/cảm ứng điện dung không Bluetooth, chọn "Vẽ 1 chạm" hoặc bật tự động nhận diện bút đầu nhỏ bên dưới:',
            [
                { val: 'draw', label: '✎ Vẽ 1 chạm (Ngón tay & Mọi Bút Trung Quốc)' },
                { val: 'pan', label: '✋ Cuộn & Kéo trang (Apple Pencil / Bút đầu nhỏ vẽ)' },
                { val: 'laser', label: '🔴 Bút Laser chỉ bài (Giảng dạy)' },
                { val: 'ignore', label: '🛡 Kháng tì tay (Chỉ nhận Active Pen)' }
            ]
        ),
        mkChoiceRow(
            'doubleTapAction',
            '2. Chạm 2 lần liên tiếp (Double Tap 1 chạm)',
            'Chạm 2 lần nhanh lên vùng trống trang giấy sẽ thực hiện:',
            [
                { val: 'eraser', label: '🧹 Đổi Bút ⇄ Cục Tẩy' },
                { val: 'undo', label: '↩ Hoàn tác nhanh (Undo)' },
                { val: 'fit_page', label: '🗐 Căn vừa trọn trang' },
                { val: 'off', label: '✕ Tắt chạm 2 lần' }
            ]
        ),
        mkChoiceRow(
            'twoFingerTapAction',
            '3. Chạm 2 ngón tay cùng lúc (2-Finger Tap)',
            'Cử chỉ gõ nhẹ 2 ngón tay kiểu Goodnotes / Procreate:',
            [
                { val: 'undo', label: '↩ Hoàn tác (Undo)' },
                { val: 'eraser', label: '🧹 Bật / Tắt Cục Tẩy' },
                { val: 'fit_page', label: '🗐 Căn vừa trọn trang' },
                { val: 'off', label: '✕ Tắt' }
            ]
        ),
        mkChoiceRow(
            'threeFingerTapAction',
            '4. Chạm 3 ngón tay cùng lúc (3-Finger Tap)',
            'Cử chỉ gõ nhẹ 3 ngón tay:',
            [
                { val: 'redo', label: '↪ Làm lại (Redo)' },
                { val: 'clear_selection', label: '✕ Bỏ chọn Lasso / Ảnh / Vòng' },
                { val: 'presentation', label: '🖥 Bật/Tắt Trình chiếu sạch' },
                { val: 'off', label: '✕ Tắt' }
            ]
        ),
        mkChoiceRow(
            'holdToShapeDelayMs',
            '5. Thời gian giữ cuối nét → Tự thành hình',
            'Điều chỉnh độ trễ khi giữ đầu bút ở cuối nét để nắn thẳng / thành hình / Mạch C:',
            [
                { val: 350, label: '⚡ Nhanh (350 ms)' },
                { val: 480, label: '👌 Chuẩn (480 ms)' },
                { val: 700, label: '🐢 Chậm chắc (700 ms)' }
            ]
        ),
        mkChoiceRow(
            'handedness',
            '6. Thuận tay & Vị trí Ngăn Đề Bài',
            'Đổi bên cho Ngăn Gắn Đề Bài và Thanh điều hướng trang để đỡ vướng cổ tay:',
            [
                { val: 'right', label: '👉 Tay phải (Đề ở cạnh phải)' },
                { val: 'left', label: '👈 Tay trái (Đề ở cạnh trái)' }
            ]
        ),
        `<div class="help-guide-card space-y-2">
            <div class="font-bold text-[12.5px]" style="color:var(--accent);">7. Trợ năng & Vuốt nhanh iPad</div>
            <div class="space-y-1.5">
                ${mkBoolRow('batterySaverMode', '🔋 Tiết kiệm pin tối đa iPad (Eco 60Hz & giảm tải GPU)', 'Khóa khung hình vẽ/cuộn ở 60Hz mượt (hạ màn ProMotion 120Hz → 60Hz) & tối ưu độ phân giải canvas để kéo dài pin lâu hơn')}
                ${mkBoolRow('stylusFineTipAutoDraw', '🖊 Tự nhận diện Bút Trung Quốc / Bút đầu nhỏ (<16px)', 'Cho phép bút cảm ứng thường đầu nhọn tự viết ngay cả khi 1 ngón đang đặt kéo trang')}
                ${mkBoolRow('assistiveTouchEnabled', '🔵 Nút Trợ năng nổi 1-Chạm (Assistive Touch)', 'Nút tròn kéo tự do: bấm 1 chạm để Undo, Redo, Đổi Tẩy, Mở Đề bài, Thêm trang')}
                ${mkBoolRow('edgeSwipeExamDrawer', '👉 Vuốt từ mép cạnh → Kéo Ngăn Đề Bài', 'Vuốt 1 ngón từ sát mép cạnh phải (hoặc trái) vào trong để mở nhanh Đề bài')}
                ${mkBoolRow('twoFingerSwipePage', '✌️ Vuốt ngang 2 ngón → Chuyển trang', 'Vuốt nhanh 2 ngón sang trái/phải để qua trang tiếp theo hoặc trang trước')}
                ${mkBoolRow('largeTouchTargets', '🔘 Nút bấm & Vùng chạm lớn (Accessibility)', 'Tăng kích thước nút công cụ & vùng bắt điểm nguyên tử cho màn hình cảm ứng')}
                ${mkBoolRow('pageHudCompact', '📄 Thu gọn thanh trang góc dưới', 'Thu nhỏ thanh trang thành viên thuốc ◀ 1/1 ▶ + ⋯ và tự mờ khi viết')}
            </div>
        </div>`,
        mkChoiceRow(
            'mouseWheelMode',
            '8. Con lăn Chuột PC & Trackpad (Windows / Mac)',
            'Chụm 2 ngón / Ctrl+Lăn / Alt+Lăn luôn Zoom mượt; Chuột phải, Chuột giữa & Space+Kéo luôn kéo bảng mọi lúc:',
            [
                { val: 'scroll', label: '↕ Lăn chuột = Kéo lên/xuống (Khuyên dùng cho Trackpad & Sổ nhiều trang)' },
                { val: 'zoom', label: '🔍 Lăn chuột = Phóng to / Thu nhỏ (Khuyên dùng cho Chuột rời khi Live)' }
            ]
        ),
        `<div class="help-guide-card space-y-2.5">
            <div>
                <div class="font-bold text-[12.5px]" style="color:#fda4af;">9. Ủng hộ ChemNotes &amp; Nhóm Zalo Cộng đồng</div>
                <div class="text-[10.5px] mt-0.5" style="color:var(--text-muted);">Nếu bạn thấy app hay &amp; hữu ích, hãy tham gia cộng đồng trao đổi hoặc mời tác giả 1 ly cà phê nhé ❤️</div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-400/35 space-y-1.5">
                    <div class="font-extrabold text-[11.5px] text-rose-300">☕ Ủng hộ phát triển app (BIDV VietQR)</div>
                    <div class="text-[11px]" style="color:var(--text-main);">Chủ TK: <b>TRAN ANH KHOA</b> · STK: <b class="select-all">8858164966</b></div>
                    <div class="flex flex-wrap gap-1.5 pt-0.5">
                        <button type="button" onclick="openSupportCommunityModal('donate')" class="px-2.5 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200 font-extrabold text-[10.5px]">📷 Mở QR BIDV</button>
                        <button type="button" onclick="copySupportText('8858164966', '📋 Đã copy STK BIDV: 8858164966')" class="support-copy-btn">📋 Copy STK</button>
                    </div>
                </div>
                <div class="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/35 space-y-1.5">
                    <div class="font-extrabold text-[11.5px] text-sky-300">💬 Nhóm Zalo Cộng đồng chemnote</div>
                    <a href="https://zalo.me/g/ajje0yq5ovi633nzutfz" target="_blank" rel="noopener noreferrer" class="block text-[10.5px] text-sky-300 underline break-all">https://zalo.me/g/ajje0yq5ovi633nzutfz</a>
                    <div class="flex flex-wrap gap-1.5 pt-0.5">
                        <button type="button" onclick="openSupportCommunityModal('zalo')" class="px-2.5 py-1 rounded-lg bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/50 text-sky-200 font-extrabold text-[10.5px]">📷 Mở QR Nhóm</button>
                        <button type="button" onclick="copySupportText('https://zalo.me/g/ajje0yq5ovi633nzutfz', '📋 Đã copy link nhóm Zalo Cộng đồng!')" class="support-copy-btn">📋 Copy Link</button>
                    </div>
                </div>
            </div>
        </div>`
    ].join('');
}

let assistiveMenuOpen = false;
let assistiveDragMoved = false;

function toggleAssistiveMenu(ev) {
    if (ev) ev.stopPropagation();
    if (assistiveDragMoved) {
        assistiveDragMoved = false;
        return;
    }
    assistiveMenuOpen = !assistiveMenuOpen;
    document.getElementById('ipadAssistiveMenu')?.classList.toggle('hidden', !assistiveMenuOpen);
}

function closeAssistiveMenu() {
    assistiveMenuOpen = false;
    document.getElementById('ipadAssistiveMenu')?.classList.add('hidden');
}

function startAssistiveTouchDrag(ev) {
    if (!ev) return;
    ev.stopPropagation();
    const widget = document.getElementById('ipadAssistiveWidget');
    if (!widget) return;
    const rect = widget.getBoundingClientRect();
    const dragPointerId = ev.pointerId;
    const startX = Number(ev.clientX) || 0;
    const startY = Number(ev.clientY) || 0;
    const baseLeft = Number.isFinite(parseFloat(widget.style.left)) ? parseFloat(widget.style.left) : rect.left;
    const baseTop = Number.isFinite(parseFloat(widget.style.top)) ? parseFloat(widget.style.top) : rect.top;
    assistiveDragMoved = false;

    const onMove = (mv) => {
        if (dragPointerId !== undefined && mv.pointerId !== undefined && mv.pointerId !== dragPointerId) return;
        const dx = (Number(mv.clientX) || 0) - startX;
        const dy = (Number(mv.clientY) || 0) - startY;
        if (Math.hypot(dx, dy) > 6) {
            assistiveDragMoved = true;
            closeAssistiveMenu();
        }
        if (!assistiveDragMoved) return;
        const vw = (typeof window !== 'undefined' && window.innerWidth) || 1200;
        const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
        const nx = Math.max(8, Math.min(vw - 56, Math.round(baseLeft + dx)));
        const ny = Math.max(50, Math.min(vh - 56, Math.round(baseTop + dy)));
        widget.style.left = `${nx}px`;
        widget.style.top = `${ny}px`;
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
        const cfg = ensureIpadConfig();
        cfg.assistiveTouchX = nx;
        cfg.assistiveTouchY = ny;
    };

    const onEnd = (endEv) => {
        if (dragPointerId !== undefined && endEv && endEv.pointerId !== undefined && endEv.pointerId !== dragPointerId) return;
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        }
        if (assistiveDragMoved) persistLibrary();
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    }
}

function openHelpHotkeysModal(defaultTab = 'guide') {
    closeAllPopovers();
    if (typeof editingHotkeyActionId !== 'undefined') editingHotkeyActionId = null;
    const modal = document.getElementById('helpHotkeysModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const tab = (defaultTab === 'hotkeys' || defaultTab === 'touch' || defaultTab === 'community') ? defaultTab : 'guide';
    switchHelpModalTab(tab);
}

function closeHelpHotkeysModal() {
    if (typeof editingHotkeyActionId !== 'undefined') editingHotkeyActionId = null;
    document.getElementById('helpHotkeysModal')?.classList.add('hidden');
}

function switchHelpModalTab(tab) {
    const isHotkeys = tab === 'hotkeys';
    const isTouch = tab === 'touch';
    const isCommunity = tab === 'community';
    const isGuide = !isHotkeys && !isTouch && !isCommunity;
    if (typeof editingHotkeyActionId !== 'undefined') editingHotkeyActionId = null;
    document.getElementById('helpTabTouchBtn')?.classList.toggle('active', isTouch);
    document.getElementById('helpTabGuideBtn')?.classList.toggle('active', isGuide);
    document.getElementById('helpTabHotkeysBtn')?.classList.toggle('active', isHotkeys);
    document.getElementById('helpTabCommunityBtn')?.classList.toggle('active', isCommunity);
    document.getElementById('helpTouchPanel')?.classList.toggle('hidden', !isTouch);
    document.getElementById('helpGuidePanel')?.classList.toggle('hidden', !isGuide);
    document.getElementById('helpHotkeysPanel')?.classList.toggle('hidden', !isHotkeys);
    document.getElementById('helpCommunityPanel')?.classList.toggle('hidden', !isCommunity);
    if (isHotkeys) renderHotkeysSettingsList();
    if (isTouch) renderIpadTouchSettingsPanel();
    if (isCommunity && typeof renderSupportCommunityUI === 'function') renderSupportCommunityUI('helpCommunityPanel', 'all');
}

function renderHotkeysSettingsList() {
    const listEl = document.getElementById('hotkeysSettingsList');
    if (!listEl || typeof HOTKEY_ACTIONS_CATALOG === 'undefined') return;
    const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const searchEl = document.getElementById('hotkeySearchInput');
    const q = (searchEl?.value || '').trim().toLowerCase();

    const hintEl = document.getElementById('hotkeyCaptureHint');
    if (hintEl) {
        if (editingHotkeyActionId) {
            const activeMeta = HOTKEY_ACTIONS_CATALOG.find(item => item.id === editingHotkeyActionId);
            hintEl.textContent = `Đang chờ bạn nhấn phím mới cho "${activeMeta ? activeMeta.label : editingHotkeyActionId}"... (Nhấn Esc để hủy)`;
        } else {
            hintEl.innerHTML = 'Nhấp vào nút phím bất kỳ bên dưới rồi nhấn phím mới trên bàn phím để gán lại. Nhấn <strong>Esc</strong> để hủy gán.';
        }
    }

    const filtered = HOTKEY_ACTIONS_CATALOG.filter(item => {
        if (!q) return true;
        const eff = getEffectiveHotkey(item.id);
        const badge = formatHotkeyBadge(eff).toLowerCase();
        return (
            item.label.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            eff.toLowerCase().includes(q) ||
            badge.includes(q)
        );
    });

    if (!filtered.length) {
        listEl.innerHTML = '<div class="text-center py-6 opacity-60">Không tìm thấy phím tắt phù hợp.</div>';
        return;
    }

    const groups = new Map();
    for (const item of filtered) {
        if (!groups.has(item.category)) groups.set(item.category, []);
        groups.get(item.category).push(item);
    }

    const scopeLabel = s => (s === 'atom' ? 'Khi trỏ lên nguyên tử' : s === 'bond' ? 'Khi trỏ lên liên kết' : 'Toàn bảng');
    let html = '';
    for (const [cat, items] of groups.entries()) {
        html += `<div><div class="font-bold text-[11px] uppercase tracking-wider mb-1.5" style="color:var(--accent);">${esc(cat)}</div><div class="space-y-1.5">`;
        for (const item of items) {
            const eff = getEffectiveHotkey(item.id);
            const badge = formatHotkeyBadge(eff);
            const isListening = editingHotkeyActionId === item.id;
            const isCustom = !!(appLibrary.customHotkeys && typeof appLibrary.customHotkeys[item.id] === 'string');
            html += `<div class="hotkey-row">
                <div class="min-w-0 flex-1">
                    <div class="font-semibold truncate" style="color:var(--text-main);">${esc(item.label)}${isCustom ? ' <span class="text-[10px] opacity-70" style="color:var(--accent);">• tùy chỉnh</span>' : ''}</div>
                    <div class="text-[10px]" style="color:var(--text-muted);">${esc(scopeLabel(item.scope))} · Mặc định: ${esc(formatHotkeyBadge(item.defaultKey))}</div>
                </div>
                <button type="button" onclick="startEditingHotkey('${esc(item.id)}')" class="hotkey-kbd-btn${isListening ? ' listening' : ''}">${isListening ? 'Nhấn phím...' : esc(badge)}</button>
            </div>`;
        }
        html += '</div></div>';
    }
    listEl.innerHTML = html;
}

function startEditingHotkey(actionId) {
    if (typeof editingHotkeyActionId === 'undefined') return;
    editingHotkeyActionId = editingHotkeyActionId === actionId ? null : actionId;
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    renderHotkeysSettingsList();
}

function assignCustomHotkey(actionId, keyName) {
    if (typeof HOTKEY_ACTIONS_CATALOG === 'undefined') return false;
    const meta = HOTKEY_ACTIONS_CATALOG.find(item => item.id === actionId);
    if (!meta) return false;
    const norm = normalizeHotkeyKeyName(keyName);
    if (!norm) return false;
    if (!appLibrary.customHotkeys || typeof appLibrary.customHotkeys !== 'object') {
        appLibrary.customHotkeys = {};
    }
    let clearedLabel = '';
    for (const other of HOTKEY_ACTIONS_CATALOG) {
        if (other.id !== meta.id && other.scope === meta.scope && getEffectiveHotkey(other.id) === norm) {
            appLibrary.customHotkeys[other.id] = '';
            clearedLabel = other.label;
        }
    }
    if (norm === meta.defaultKey) delete appLibrary.customHotkeys[meta.id];
    else appLibrary.customHotkeys[meta.id] = norm;
    editingHotkeyActionId = null;
    persistLibrary();
    renderHotkeysSettingsList();
    if (typeof showGestureToast === 'function') {
        showGestureToast(
            clearedLabel
                ? `Đã gán [${formatHotkeyBadge(norm)}] cho "${meta.label}" (gỡ khỏi "${clearedLabel}")`
                : `Đã gán [${formatHotkeyBadge(norm)}] cho "${meta.label}"`
        );
    }
    return true;
}

function resetDefaultHotkeys() {
    appLibrary.customHotkeys = {};
    if (typeof editingHotkeyActionId !== 'undefined') editingHotkeyActionId = null;
    persistLibrary();
    renderHotkeysSettingsList();
    if (typeof showGestureToast === 'function') showGestureToast('Đã khôi phục toàn bộ phím tắt mặc định');
}

// =========================================================================
// CHẾ ĐỘ ĐỌC (KHÓA BÚT, XEM 1 HOẶC 2 TRANG CÙNG LÚC)
// =========================================================================
function toggleReadMode(force) {
    if (typeof isReadMode === 'undefined') return;
    const next = typeof force === 'boolean' ? force : !isReadMode;
    if (next === isReadMode) return;
    isReadMode = next;
    closeAllPopovers();
    if (typeof clearActiveRingGizmo === 'function') clearActiveRingGizmo(false);
    if (typeof clearLassoSelection === 'function') clearLassoSelection();
    if (typeof clearActiveImageSelection === 'function') clearActiveImageSelection(false);
    if (typeof clearActiveCarbonChain === 'function') clearActiveCarbonChain(false);
    if (typeof cancelAtomHoldTimer === 'function') cancelAtomHoldTimer(true);
    document.body?.classList?.toggle('read-only-mode', isReadMode);
    document.getElementById('readModeBar')?.classList.toggle('hidden', !isReadMode);
    document.getElementById('readModeBtn')?.classList.toggle('active', isReadMode);
    setReadPageLayout(typeof readTwoPageMode !== 'undefined' ? readTwoPageMode : true, false);
    if (typeof resizeCanvas === 'function') resizeCanvas();
    if (typeof fitA4ToScreen === 'function') fitA4ToScreen('page');
    syncPageQuickNavUI();
    if (typeof updateCanvasCursor === 'function') updateCanvasCursor();
    if (typeof showGestureToast === 'function') {
        showGestureToast(isReadMode
            ? `Chế độ Đọc (${readTwoPageMode ? '2 trang/lúc' : '1 trang'}) — Đã khóa bút`
            : 'Đã trở về chế độ Viết & Vẽ');
    }
}

function setReadPageLayout(twoPages, refit = true) {
    if (typeof readTwoPageMode !== 'undefined') readTwoPageMode = !!twoPages;
    document.getElementById('readLayout1Btn')?.classList.toggle('active', !readTwoPageMode);
    document.getElementById('readLayout2Btn')?.classList.toggle('active', !!readTwoPageMode);
    if (refit && typeof fitA4ToScreen === 'function') fitA4ToScreen('page');
    syncPageQuickNavUI();
}

function stepReadPage(delta) {
    const nb = getActiveNotebook();
    if (!nb || !Array.isArray(nb.pages) || !nb.pages.length) return;
    const step = (typeof isReadMode !== 'undefined' && isReadMode && typeof readTwoPageMode !== 'undefined' && readTwoPageMode && nb.pages.length > 1)
        ? delta * 2
        : delta;
    const cur = nb.activePageIndex || 0;
    const nextIdx = Math.max(0, Math.min(nb.pages.length - 1, cur + step));
    if (nextIdx === cur) return;
    nb.activePageIndex = nextIdx;
    if (typeof renderOpenTabsBar === 'function') renderOpenTabsBar();
    if (typeof fitA4ToScreen === 'function') fitA4ToScreen('page');
    syncPageQuickNavUI();
}

// =========================================================================
// NGĂN GẮN ĐỀ BÀI (ẢNH & FILE PDF / WORD DOCX / TXT) & CẮT DÁN VÀO TRANG VIẾT
// =========================================================================
const examImageCache = new Map();
const examFileBlobCache = new Map();
let examDrawerEventsBound = false;
let examPdfJsLoadPromise = null;
let examPdfWorkerBlobUrl = '';
let examPdfPreferDisableWorker = false;

const EXAM_PDFJS_CDN_SOURCES = [
    {
        lib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    },
    {
        lib: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
        worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
    },
    {
        lib: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
        worker: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
    }
];

function formatFileSizeLabel(bytes) {
    const n = Number(bytes) || 0;
    if (!n) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function setExamDrawerLoading(active, title, detail) {
    examDrawerState.loadingStatus = active
        ? { active: true, title: String(title || 'Đang mở tài liệu...'), detail: String(detail || '') }
        : null;
    if (active) {
        toggleExamDrawer(true);
    } else if (examDrawerState.open) {
        renderExamDrawer();
    }
}

function loadExternalScriptWithTimeout(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
            reject(new Error('no-dom'));
            return;
        }
        const script = document.createElement('script');
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            script.remove?.();
            reject(new Error('timeout'));
        }, timeoutMs || 12000);
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.onload = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(true);
        };
        script.onerror = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            script.remove?.();
            reject(new Error('load-failed'));
        };
        script.src = url;
        (document.head || document.documentElement || document.body)?.appendChild?.(script);
    });
}

async function preparePdfJsWorker(pdfjs, workerUrl) {
    if (!pdfjs || !pdfjs.GlobalWorkerOptions) return;
    if (examPdfWorkerBlobUrl) {
        pdfjs.GlobalWorkerOptions.workerSrc = examPdfWorkerBlobUrl;
        return;
    }
    if (typeof fetch === 'function' && typeof Blob === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        try {
            const res = await fetch(workerUrl, { mode: 'cors' });
            if (res && res.ok) {
                const code = await res.text();
                if (code && code.length > 1000) {
                    examPdfWorkerBlobUrl = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
                    pdfjs.GlobalWorkerOptions.workerSrc = examPdfWorkerBlobUrl;
                    examPdfPreferDisableWorker = false;
                    return;
                }
            }
        } catch (e) {}
    }
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    examPdfPreferDisableWorker = true;
}

async function ensurePdfJsLoaded() {
    if (typeof window !== 'undefined' && window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') {
        return window.pdfjsLib;
    }
    if (examPdfJsLoadPromise) return examPdfJsLoadPromise;
    examPdfJsLoadPromise = (async () => {
        for (let i = 0; i < EXAM_PDFJS_CDN_SOURCES.length; i++) {
            const src = EXAM_PDFJS_CDN_SOURCES[i];
            try {
                await loadExternalScriptWithTimeout(src.lib, 12000);
                if (typeof window !== 'undefined' && window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') {
                    await preparePdfJsWorker(window.pdfjsLib, src.worker);
                    return window.pdfjsLib;
                }
            } catch (e) {}
        }
        examPdfJsLoadPromise = null;
        return null;
    })();
    return examPdfJsLoadPromise;
}

function decodeUtf8BytesSafe(bytes) {
    if (!bytes || !bytes.length) return '';
    if (typeof TextDecoder === 'function') {
        try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); } catch (e) {}
    }
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
        out += String.fromCharCode(bytes[i]);
    }
    try { return decodeURIComponent(escape(out)); } catch (e) { return out; }
}

async function inflateRawZipBytes(compBytes) {
    if (typeof DecompressionStream !== 'function') {
        throw new Error('no-decompression-stream');
    }
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    const writePromise = writer.write(compBytes).then(() => writer.close());
    const chunks = [];
    let totalLen = 0;
    while (true) {
        const step = await reader.read();
        if (step.done) break;
        if (step.value && step.value.length) {
            chunks.push(step.value);
            totalLen += step.value.length;
        }
    }
    await writePromise;
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
        merged.set(chunks[i], offset);
        offset += chunks[i].length;
    }
    return merged;
}

function parseZipDirectoryEntries(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const entries = [];
    let eocdOff = -1;
    const minOff = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= minOff; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            eocdOff = i;
            break;
        }
    }
    if (eocdOff >= 0) {
        const totalEntries = view.getUint16(eocdOff + 10, true);
        let off = view.getUint32(eocdOff + 16, true);
        for (let idx = 0; idx < totalEntries && off + 46 <= bytes.length; idx++) {
            if (view.getUint32(off, true) !== 0x02014b50) break;
            const method = view.getUint16(off + 10, true);
            const compSize = view.getUint32(off + 20, true);
            const uncompSize = view.getUint32(off + 24, true);
            const nameLen = view.getUint16(off + 28, true);
            const extraLen = view.getUint16(off + 30, true);
            const commentLen = view.getUint16(off + 32, true);
            const localHeaderOff = view.getUint32(off + 42, true);
            const entryName = decodeUtf8BytesSafe(bytes.subarray(off + 46, off + 46 + nameLen));
            entries.push({ name: entryName, method, compSize, uncompSize, localHeaderOff });
            off += 46 + nameLen + extraLen + commentLen;
        }
    }
    if (!entries.length) {
        let off = 0;
        while (off + 30 <= bytes.length && view.getUint32(off, true) === 0x04034b50) {
            const method = view.getUint16(off + 8, true);
            const compSize = view.getUint32(off + 18, true);
            const uncompSize = view.getUint32(off + 22, true);
            const nameLen = view.getUint16(off + 26, true);
            const extraLen = view.getUint16(off + 28, true);
            const entryName = decodeUtf8BytesSafe(bytes.subarray(off + 30, off + 30 + nameLen));
            entries.push({ name: entryName, method, compSize, uncompSize, localHeaderOff: off });
            if (compSize === 0 && method !== 0) break;
            off += 30 + nameLen + extraLen + compSize;
        }
    }
    return { bytes, view, entries };
}

async function readZipEntryBytes(zipInfo, entry) {
    const { bytes, view } = zipInfo;
    const lh = entry.localHeaderOff;
    if (lh + 30 > bytes.length || view.getUint32(lh, true) !== 0x04034b50) return null;
    const lhNameLen = view.getUint16(lh + 26, true);
    const lhExtraLen = view.getUint16(lh + 28, true);
    const dataStart = lh + 30 + lhNameLen + lhExtraLen;
    const dataEnd = Math.min(bytes.length, dataStart + entry.compSize);
    if (dataStart > bytes.length || dataEnd < dataStart) return null;
    const rawSlice = bytes.subarray(dataStart, dataEnd);
    if (entry.method === 0) return rawSlice;
    if (entry.method === 8) return await inflateRawZipBytes(rawSlice);
    return null;
}

function decodeXmlEntities(str) {
    return String(str || '')
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
            const cp = parseInt(hex, 16);
            return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
        })
        .replace(/&#(\d+);/g, (_, dec) => {
            const cp = parseInt(dec, 10);
            return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
        })
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

function convertChemScriptDigits(str, mode) {
    const map = mode === 'sub'
        ? { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋' }
        : { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' };
    return String(str || '').replace(/[0-9+-]/g, ch => map[ch] || ch);
}

function extractPlainTextFromWordXml(xml) {
    if (!xml) return '';
    const paragraphs = [];
    const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(xml)) !== null) {
        const pBody = pMatch[1];
        let pText = '';
        const tokenRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>|<m:t\b[^>]*>([\s\S]*?)<\/m:t>|<w:tab\b[^>]*\/?>|<w:br\b[^>]*\/?>|<w:cr\b[^>]*\/?>/g;
        let tok;
        while ((tok = tokenRegex.exec(pBody)) !== null) {
            if (tok[1] !== undefined) {
                const runBody = tok[1];
                const isSub = /<w:vertAlign\b[^>]*w:val="subscript"/i.test(runBody);
                const isSup = /<w:vertAlign\b[^>]*w:val="superscript"/i.test(runBody);
                const innerRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<m:t\b[^>]*>([\s\S]*?)<\/m:t>|<w:tab\b[^>]*\/?>|<w:br\b[^>]*\/?>|<w:cr\b[^>]*\/?>/g;
                let inner;
                while ((inner = innerRegex.exec(runBody)) !== null) {
                    if (inner[1] !== undefined || inner[2] !== undefined) {
                        let txt = decodeXmlEntities(inner[1] !== undefined ? inner[1] : inner[2]);
                        if (isSub) txt = convertChemScriptDigits(txt, 'sub');
                        else if (isSup) txt = convertChemScriptDigits(txt, 'sup');
                        pText += txt;
                    } else if (/^<w:tab/i.test(inner[0])) {
                        pText += '    ';
                    } else {
                        pText += '\n';
                    }
                }
            } else if (tok[2] !== undefined) {
                pText += decodeXmlEntities(tok[2]);
            } else if (/^<w:tab/i.test(tok[0])) {
                pText += '    ';
            } else {
                pText += '\n';
            }
        }
        paragraphs.push(pText.replace(/[ \t]+$/g, ''));
    }
    let joined = paragraphs.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!joined) {
        const fallbackTexts = [];
        const tRegex = /<(?:w|m):t\b[^>]*>([\s\S]*?)<\/(?:w|m):t>/g;
        let tm;
        while ((tm = tRegex.exec(xml)) !== null) {
            fallbackTexts.push(decodeXmlEntities(tm[1]));
        }
        joined = fallbackTexts.join(' ').trim();
    }
    return joined;
}

function uint8ToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + chunk)));
    }
    if (typeof btoa === 'function') return btoa(bin);
    return '';
}

async function extractDocxContentFromBuffer(arrayBuffer) {
    const zipInfo = parseZipDirectoryEntries(arrayBuffer);
    if (!zipInfo.entries.length) return { text: '', mediaImages: [] };
    let text = '';
    const docEntry = zipInfo.entries.find(e => e.name.toLowerCase() === 'word/document.xml');
    if (docEntry) {
        const xmlBytes = await readZipEntryBytes(zipInfo, docEntry);
        if (xmlBytes && xmlBytes.length) {
            text = extractPlainTextFromWordXml(decodeUtf8BytesSafe(xmlBytes));
        }
    }
    const mediaImages = [];
    if (text.trim().length < 20) {
        const mediaEntries = zipInfo.entries
            .filter(e => /^word\/media\/.+\.(png|jpg|jpeg|webp|gif)$/i.test(e.name) && e.compSize >= 500 && e.compSize <= 4 * 1024 * 1024)
            .slice(0, 12);
        for (let i = 0; i < mediaEntries.length; i++) {
            try {
                const mBytes = await readZipEntryBytes(zipInfo, mediaEntries[i]);
                if (!mBytes || !mBytes.length) continue;
                const ext = (mediaEntries[i].name.split('.').pop() || 'png').toLowerCase();
                const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : (ext === 'webp' ? 'image/webp' : (ext === 'gif' ? 'image/gif' : 'image/png'));
                const b64 = uint8ToBase64(mBytes);
                if (b64) {
                    mediaImages.push({
                        name: mediaEntries[i].name.split('/').pop() || ('Hinh_' + (i + 1) + '.' + ext),
                        dataUrl: 'data:' + mime + ';base64,' + b64
                    });
                }
            } catch (e) {}
        }
    }
    return { text, mediaImages };
}

function extractReadableTextFromHtml(html) {
    return decodeXmlEntities(
        String(html || '')
            .replace(/<script\b[\s\S]*?<\/script>/gi, '')
            .replace(/<style\b[\s\S]*?<\/style>/gi, '')
            .replace(/<(?:br|hr)\b[^>]*\/?>/gi, '\n')
            .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
    ).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractReadableTextFromRtf(rtf) {
    return String(rtf || '')
        .replace(/\\par[d]?/g, '\n')
        .replace(/\\tab/g, '    ')
        .replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\u(-?\d+)\??/g, (_, d) => {
            const n = parseInt(d, 10);
            return String.fromCharCode(n < 0 ? n + 65536 : n);
        })
        .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
        .replace(/[{}]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function wrapTextLinesForCanvas(ctx2d, text, maxWidth, maxLines = 42) {
    const rawLines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    for (let r = 0; r < rawLines.length && out.length < maxLines; r++) {
        const line = rawLines[r];
        if (!line) { out.push(''); continue; }
        let cur = '';
        const words = line.split(/(\s+)/);
        for (let w = 0; w < words.length; w++) {
            const test = cur + words[w];
            if (ctx2d.measureText(test).width > maxWidth && cur) {
                out.push(cur.trimEnd());
                cur = words[w].trimStart();
                if (out.length >= maxLines) break;
            } else {
                cur = test;
            }
        }
        if (cur && out.length < maxLines) out.push(cur.trimEnd());
    }
    return out;
}

function renderTextPageLinesToDataUrl(title, lines, pageNum, totalPages, headerLabel) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        return 'data:image/png;base64,';
    }
    const W = 900, H = 1200;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const c = off.getContext('2d');
    if (!c) return 'data:image/png;base64,';
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#0f172a';
    c.fillRect(0, 0, W, 74);
    c.fillStyle = '#38bdf8';
    c.font = '800 17px Inter, sans-serif';
    const tag = headerLabel || '📄 ĐỀ BÀI / TÀI LIỆU VĂN BẢN';
    const pgBadge = totalPages > 1 ? (tag + '  •  Trang ' + pageNum + '/' + totalPages) : tag;
    c.fillText(pgBadge, 34, 30);
    c.fillStyle = '#f8fafc';
    c.font = '700 20px Inter, sans-serif';
    c.fillText(String(title || 'Tài liệu').slice(0, 56), 34, 58);

    c.fillStyle = '#1e293b';
    c.font = '500 20px Inter, sans-serif';
    let y = 114;
    for (let i = 0; i < lines.length; i++) {
        c.fillText(lines[i], 34, y);
        y += 30;
        if (y > H - 36) break;
    }
    try {
        const res = off.toDataURL('image/png') || 'data:image/png;base64,';
        off.width = 0; off.height = 0;
        return res;
    } catch (e) {
        return 'data:image/png;base64,';
    }
}

function renderTextDocumentToDataUrl(title, text) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        return 'data:image/png;base64,';
    }
    const off = document.createElement('canvas');
    off.width = 900; off.height = 64;
    const c = off.getContext('2d');
    if (!c) return 'data:image/png;base64,';
    c.font = '500 20px Inter, sans-serif';
    const lines = wrapTextLinesForCanvas(c, text, 900 - 68, 35);
    off.width = 0; off.height = 0;
    return renderTextPageLinesToDataUrl(title, lines, 1, 1);
}

function addPaginatedTextExamSheets(name, fullText, file, docFormat) {
    const storedText = String(fullText || '').slice(0, 60000);
    const fmt = String(docFormat || 'text').toLowerCase();
    const headerLabel = fmt === 'docx' ? '📘 TÀI LIỆU WORD (.DOCX)' : '📄 ĐỀ BÀI / TÀI LIỆU VĂN BẢN';
    const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(storedText);

    let allLines = [];
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const probe = document.createElement('canvas');
        probe.width = 900; probe.height = 64;
        const pCtx = probe.getContext('2d');
        if (pCtx) {
            pCtx.font = '500 20px Inter, sans-serif';
            allLines = wrapTextLinesForCanvas(pCtx, storedText, 900 - 68, 560);
        }
        probe.width = 0; probe.height = 0;
    }
    if (!allLines.length) {
        allLines = storedText.split(/\r?\n/).slice(0, 35);
    }

    const linesPerPage = 35;
    const maxPages = 16;
    const pages = [];
    for (let i = 0; i < allLines.length && pages.length < maxPages; i += linesPerPage) {
        pages.push(allLines.slice(i, i + linesPerPage));
    }
    if (!pages.length) pages.push(['(Tài liệu trống)']);

    const totalPages = pages.length;
    const groupId = totalPages > 1 ? genId('txtgrp') : '';
    let firstIdx = -1;
    let firstSheet = null;
    for (let p = 0; p < totalPages; p++) {
        const pageTitle = totalPages > 1 ? (name + ' (Trang ' + (p + 1) + '/' + totalPages + ')') : name;
        const previewUrl = renderTextPageLinesToDataUrl(name, pages[p], p + 1, totalPages, headerLabel);
        const sh = addExamSheetFromDataUrl(previewUrl, pageTitle, 900, 1200, {
            fileType: 'text',
            docFormat: fmt,
            fileName: name,
            fileSize: (file && file.size) || storedText.length,
            rawText: storedText,
            pageGroupId: groupId,
            pageNumber: p + 1,
            totalPages: totalPages,
            fileDataUrl: (p === 0 && dataUrl.length <= 280000) ? dataUrl : ''
        }, { silent: p > 0, keepActive: p > 0, deferPersist: true });
        if (sh) {
            examFileBlobCache.set(sh.id, { url: dataUrl, fileName: name, mimeType: 'text/plain' });
            if (firstIdx < 0) {
                firstIdx = appLibrary.examSheets.length - 1;
                firstSheet = sh;
            }
        }
    }
    if (firstIdx >= 0) {
        examDrawerState.activeSheetIndex = firstIdx;
        examDrawerState.viewMode = 'crop';
        persistLibrary();
        toggleExamDrawer(true);
        if (typeof showGestureToast === 'function') {
            showGestureToast(totalPages > 1
                ? ('Đã mở "' + name + '" (' + totalPages + ' trang) — sẵn sàng xem & kéo cắt!')
                : ('Đã gắn "' + name + '" vào Ngăn Đề Bài'));
        }
    }
    return firstSheet;
}

function renderFileCardToDataUrl(title, badgeText, sizeLabel, subtitle) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        return 'data:image/png;base64,';
    }
    const W = 900, H = 640;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const c = off.getContext('2d');
    if (!c) return 'data:image/png;base64,';
    c.fillStyle = '#f8fafc';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 4;
    c.strokeRect(28, 28, W - 56, H - 56);

    c.fillStyle = '#0284c7';
    c.fillRect(60, 74, 130, 52);
    c.fillStyle = '#ffffff';
    c.font = '900 24px Inter, sans-serif';
    c.fillText(String(badgeText || 'FILE').slice(0, 6), 82, 108);

    c.fillStyle = '#0f172a';
    c.font = '800 30px Inter, sans-serif';
    c.fillText(String(title || 'Tài liệu đính kèm').slice(0, 38), 214, 106);

    if (sizeLabel) {
        c.fillStyle = '#475569';
        c.font = '600 20px Inter, sans-serif';
        c.fillText('Dung lượng: ' + sizeLabel, 214, 140);
    }

    c.fillStyle = '#334155';
    c.font = '500 21px Inter, sans-serif';
    const lines = wrapTextLinesForCanvas(c, subtitle || 'Tài liệu đã được đính kèm vào Ngăn Đề Bài.', W - 120, 10);
    let y = 230;
    for (const ln of lines) {
        c.fillText(ln, 60, y);
        y += 34;
    }
    try {
        const res = off.toDataURL('image/png') || 'data:image/png;base64,';
        off.width = 0; off.height = 0;
        return res;
    } catch (e) {
        return 'data:image/png;base64,';
    }
}

function drawImageSourceToWhiteDataUrl(source, srcW, srcH, maxDim) {
    const limit = maxDim || 1600;
    let tw = Math.max(10, Math.round(srcW || 600));
    let th = Math.max(10, Math.round(srcH || 800));
    if (tw > limit || th > limit) {
        const r = Math.min(limit / tw, limit / th);
        tw = Math.max(10, Math.round(tw * r));
        th = Math.max(10, Math.round(th * r));
    }
    const off = document.createElement('canvas');
    off.width = tw;
    off.height = th;
    const offCtx = off.getContext('2d');
    let outUrl = '';
    if (offCtx) {
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, tw, th);
        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = 'high';
        offCtx.drawImage(source, 0, 0, tw, th);
        try { outUrl = off.toDataURL('image/jpeg', 0.88); } catch (e) {}
        if (!outUrl || outUrl.length <= 30) {
            try { outUrl = off.toDataURL('image/png'); } catch (e) {}
        }
    }
    off.width = 0;
    off.height = 0;
    return { dataUrl: outUrl, width: tw, height: th };
}

function initExamDrawerEvents() {
    const can = document.getElementById('examPreviewCanvas');
    const vp = document.getElementById('examPreviewViewport');
    const panel = document.getElementById('examDrawerPanel');
    if (panel && !panel.dataset.dropBound && typeof panel.addEventListener === 'function') {
        panel.dataset.dropBound = '1';
        panel.addEventListener('dragover', ev => {
            ev.preventDefault();
            panel.classList.add('drag-over-file');
        });
        panel.addEventListener('dragleave', () => {
            panel.classList.remove('drag-over-file');
        });
        panel.addEventListener('drop', ev => {
            ev.preventDefault();
            panel.classList.remove('drag-over-file');
            if (ev.dataTransfer?.files?.length) {
                handleExamFilesSelected({ target: { files: ev.dataTransfer.files } });
            }
        });
    }
    if (!can || examDrawerEventsBound || typeof can.addEventListener !== 'function') return;
    examDrawerEventsBound = true;

    const getCanvasPoint = (ev) => {
        const rect = can.getBoundingClientRect();
        const rw = Math.max(1, rect.width || can.width || 1);
        const rh = Math.max(1, rect.height || can.height || 1);
        return {
            x: Math.max(0, Math.min(can.width, (ev.clientX - rect.left) * (can.width / rw))),
            y: Math.max(0, Math.min(can.height, (ev.clientY - rect.top) * (can.height / rh)))
        };
    };

    can.addEventListener('pointerdown', ev => {
        const sheets = appLibrary.examSheets || [];
        if (!sheets.length) return;
        if (!examDrawerState.cropMode) {
            if (vp) {
                examDrawerState.panScroll = {
                    active: true,
                    startX: ev.clientX,
                    startY: ev.clientY,
                    scrollLeft: vp.scrollLeft || 0,
                    scrollTop: vp.scrollTop || 0
                };
            }
            return;
        }
        const pt = getCanvasPoint(ev);
        examDrawerState.isDraggingCrop = true;
        examDrawerState.dragStart = pt;
        examDrawerState.cropRect = { x: pt.x, y: pt.y, w: 0, h: 0 };
        document.getElementById('examCropActionRow')?.classList.add('hidden');
        renderExamDrawer();
    });

    can.addEventListener('pointermove', ev => {
        if (examDrawerState.panScroll?.active && vp) {
            vp.scrollLeft = examDrawerState.panScroll.scrollLeft - (ev.clientX - examDrawerState.panScroll.startX);
            vp.scrollTop = examDrawerState.panScroll.scrollTop - (ev.clientY - examDrawerState.panScroll.startY);
            return;
        }
        if (!examDrawerState.isDraggingCrop || !examDrawerState.dragStart) return;
        const pt = getCanvasPoint(ev);
        const x = Math.min(examDrawerState.dragStart.x, pt.x);
        const y = Math.min(examDrawerState.dragStart.y, pt.y);
        const w = Math.abs(pt.x - examDrawerState.dragStart.x);
        const h = Math.abs(pt.y - examDrawerState.dragStart.y);
        examDrawerState.cropRect = { x, y, w, h };
        renderExamDrawer();
    });

    const finishCropDrag = () => {
        if (examDrawerState.panScroll) examDrawerState.panScroll.active = false;
        if (!examDrawerState.isDraggingCrop) return;
        examDrawerState.isDraggingCrop = false;
        examDrawerState.dragStart = null;
        const cr = examDrawerState.cropRect;
        if (cr && cr.w >= 14 && cr.h >= 14) {
            setExamCropRect(cr.x, cr.y, cr.w, cr.h);
        } else {
            clearExamCropSelection();
        }
    };
    can.addEventListener('pointerup', finishCropDrag);
    can.addEventListener('pointercancel', finishCropDrag);
}

function toggleExamDrawer(force) {
    initExamDrawerEvents();
    const next = typeof force === 'boolean' ? force : !examDrawerState.open;
    examDrawerState.open = next;
    document.getElementById('examDrawerPanel')?.classList.toggle('hidden', !next);
    document.getElementById('examDrawerHandle')?.classList.toggle('hidden', next);
    if (next) renderExamDrawer();
}

function triggerExamFileInput() {
    const inp = document.getElementById('examFileInput');
    if (inp) { inp.value = ''; inp.click(); }
}

async function importImageExamFile(file, name) {
    if (typeof createImageBitmap === 'function' && typeof Blob !== 'undefined' && file instanceof Blob) {
        try {
            const bmp = await createImageBitmap(file);
            if (bmp && bmp.width > 0 && bmp.height > 0) {
                const conv = drawImageSourceToWhiteDataUrl(bmp, bmp.width, bmp.height, 1600);
                bmp.close?.();
                if (conv.dataUrl && conv.dataUrl.length > 30) {
                    addExamSheetFromDataUrl(conv.dataUrl, name, conv.width, conv.height, {
                        fileType: 'image',
                        fileName: name,
                        fileSize: file.size || 0
                    });
                    return true;
                }
            }
            bmp?.close?.();
        } catch (e) {}
    }

    return await new Promise(resolve => {
        const reader = new FileReader();
        reader.onerror = () => {
            if (typeof showGestureToast === 'function') showGestureToast('⚠️ Không đọc được ảnh "' + name + '"!');
            resolve(false);
        };
        reader.onload = () => {
            const rawUrl = String(reader.result || '');
            if (typeof Image !== 'function') {
                addExamSheetFromDataUrl(rawUrl, name, 800, 1000, {
                    fileType: 'image',
                    fileName: name,
                    fileSize: file.size || 0
                });
                resolve(true);
                return;
            }
            const img = new Image();
            img.onload = () => {
                const conv = drawImageSourceToWhiteDataUrl(img, img.naturalWidth || img.width || 600, img.naturalHeight || img.height || 800, 1600);
                addExamSheetFromDataUrl(conv.dataUrl && conv.dataUrl.length > 30 ? conv.dataUrl : rawUrl, name, conv.width, conv.height, {
                    fileType: 'image',
                    fileName: name,
                    fileSize: file.size || 0
                });
                resolve(true);
            };
            img.onerror = () => {
                const ext = (name.split('.').pop() || '').toLowerCase();
                if ((ext === 'heic' || ext === 'heif') && typeof showGestureToast === 'function') {
                    showGestureToast('⚠️ Trình duyệt hiện tại chưa giải mã được ảnh HEIC — hãy chụp màn hình hoặc xuất sang JPG/PNG!');
                }
                const fallbackUrl = renderFileCardToDataUrl(
                    name,
                    (ext || 'IMG').toUpperCase(),
                    formatFileSizeLabel(file.size),
                    'Không thể giải mã trực tiếp định dạng ảnh này trên trình duyệt hiện tại. Hãy chọn ảnh JPG/PNG hoặc nhấn "⬇ Mở/Tải" để xem.'
                );
                const sh = addExamSheetFromDataUrl(fallbackUrl, name, 900, 640, {
                    fileType: 'file',
                    docFormat: ext || 'img',
                    fileName: name,
                    fileSize: file.size || 0,
                    fileDataUrl: rawUrl.length <= 420000 ? rawUrl : ''
                }, { silent: true });
                if (sh) {
                    examFileBlobCache.set(sh.id, { url: rawUrl, dataUrl: rawUrl, fileName: name, mimeType: file.type || 'image/*' });
                    examDrawerState.viewMode = 'file';
                    renderExamDrawer();
                }
                resolve(false);
            };
            img.src = rawUrl;
        };
        reader.readAsDataURL(file);
    });
}

async function importPdfExamFile(file, name, replaceSheetId) {
    let blobUrl = '';
    try {
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Blob !== 'undefined' && file instanceof Blob) {
            blobUrl = URL.createObjectURL(file);
        }
    } catch (e) {}

    setExamDrawerLoading(true, name, 'Đang tải bộ giải mã PDF (chống lỗi màn hình trắng)...');
    let errReason = 'offline';
    try {
        const rawBuf = await file.arrayBuffer();
        const pdfjs = await ensurePdfJsLoaded();
        if (pdfjs && typeof pdfjs.getDocument === 'function') {
            setExamDrawerLoading(true, name, 'Đang đọc cấu trúc các trang PDF...');
            let pdfDoc = null;
            const openOptsBase = { isEvalSupported: false, useSystemFonts: true };
            if (!examPdfPreferDisableWorker) {
                try {
                    const task = pdfjs.getDocument({ ...openOptsBase, data: new Uint8Array(rawBuf.slice(0)) });
                    pdfDoc = await task.promise;
                } catch (workerErr) {
                    examPdfPreferDisableWorker = true;
                }
            }
            if (!pdfDoc) {
                const task = pdfjs.getDocument({ ...openOptsBase, disableWorker: true, data: new Uint8Array(rawBuf.slice(0)) });
                pdfDoc = await task.promise;
            }

            if (pdfDoc && pdfDoc.numPages > 0) {
                const totalPages = pdfDoc.numPages;
                const renderCount = Math.min(totalPages, 24);
                const pdfGroupId = genId('pdfgrp');
                examFileBlobCache.set(pdfGroupId, {
                    url: blobUrl,
                    file: file,
                    fileName: name,
                    mimeType: 'application/pdf'
                });

                if (replaceSheetId && Array.isArray(appLibrary.examSheets)) {
                    const rIdx = appLibrary.examSheets.findIndex(s => s && s.id === replaceSheetId);
                    if (rIdx >= 0) {
                        examImageCache.delete(replaceSheetId);
                        appLibrary.examSheets.splice(rIdx, 1);
                    }
                }

                let firstIdx = -1;
                for (let p = 1; p <= renderCount; p++) {
                    if (p === 1) {
                        setExamDrawerLoading(true, name, 'Đang hiển thị trang 1/' + totalPages + '...');
                    }
                    const page = await pdfDoc.getPage(p);
                    const baseVp = page.getViewport({ scale: 1 });
                    const bw = Math.max(100, baseVp.width || 595);
                    const bh = Math.max(100, baseVp.height || 842);
                    let scale = Math.min(2.2, Math.max(1.25, 1280 / bw));
                    if (Math.max(bw * scale, bh * scale) > 1800) {
                        scale = 1800 / Math.max(bw, bh);
                    }
                    const vp = page.getViewport({ scale });
                    const outW = Math.max(100, Math.round(vp.width));
                    const outH = Math.max(100, Math.round(vp.height));

                    const off = document.createElement('canvas');
                    off.width = outW;
                    off.height = outH;
                    const offCtx = off.getContext('2d');
                    if (offCtx) {
                        offCtx.fillStyle = '#ffffff';
                        offCtx.fillRect(0, 0, outW, outH);
                        await page.render({ canvasContext: offCtx, viewport: vp }).promise;
                    }
                    let pageDataUrl = '';
                    try { pageDataUrl = off.toDataURL('image/jpeg', 0.86); } catch (e) {}
                    if (!pageDataUrl || pageDataUrl.length < 30) {
                        try { pageDataUrl = off.toDataURL('image/png'); } catch (e) {}
                    }
                    off.width = 0;
                    off.height = 0;
                    page.cleanup?.();

                    const pageTitle = totalPages > 1 ? (name + ' (Trang ' + p + '/' + totalPages + ')') : name;
                    const sh = addExamSheetFromDataUrl(pageDataUrl || 'data:image/png;base64,', pageTitle, outW, outH, {
                        fileType: 'pdf',
                        pdfPageRendered: true,
                        pdfGroupId: pdfGroupId,
                        pdfPageNumber: p,
                        pdfTotalPages: totalPages,
                        fileName: name,
                        fileSize: file.size || 0,
                        mimeType: 'application/pdf'
                    }, { silent: true, keepActive: p > 1, deferPersist: true });

                    if (sh) {
                        examFileBlobCache.set(sh.id, {
                            url: blobUrl,
                            file: file,
                            fileName: name,
                            mimeType: 'application/pdf',
                            pdfGroupId: pdfGroupId
                        });
                        if (firstIdx < 0) {
                            firstIdx = appLibrary.examSheets.length - 1;
                            examDrawerState.loadingStatus = null;
                            examDrawerState.activeSheetIndex = firstIdx;
                            examDrawerState.viewMode = 'crop';
                            examDrawerState.cropRect = null;
                            toggleExamDrawer(true);
                        } else if (examDrawerState.open) {
                            renderExamDrawer();
                        }
                    }
                }
                pdfDoc.destroy?.();
                examDrawerState.loadingStatus = null;
                persistLibrary();
                if (examDrawerState.open) renderExamDrawer();
                if (typeof showGestureToast === 'function') {
                    showGestureToast(totalPages > renderCount
                        ? ('Đã mở PDF "' + name + '" (' + renderCount + '/' + totalPages + ' trang đầu) — kéo cắt trực tiếp!')
                        : ('Đã mở PDF "' + name + '" (' + renderCount + ' trang) — sẵn sàng xem & kéo cắt!'));
                }
                return true;
            }
        }
    } catch (err) {
        const msg = String(err?.name || err?.message || '');
        errReason = /password/i.test(msg) ? 'password' : 'decode-error';
    }

    // Fallback an toàn (khi offline lần đầu hoặc PDF bị đặt mật khẩu) — KHÔNG BAO GIỜ mở iframe trắng tinh!
    examDrawerState.loadingStatus = null;
    const sizeStr = formatFileSizeLabel(file.size);
    const reasonText = errReason === 'password'
        ? 'Tệp PDF này đang bị khóa mật khẩu. Nhấn "↗ Mở ngoài" để nhập mật khẩu trên máy.'
        : 'Chưa thể tải bộ giải mã PDF (có thể đang mất mạng lần đầu). Khi có mạng, nhấn "🔄 Giải mã lại PDF" để xem & cắt trực tiếp từng trang, hoặc nhấn "↗ Mở ngoài".';
    const previewUrl = renderFileCardToDataUrl(name, 'PDF', sizeStr, reasonText);
    const sh = addExamSheetFromDataUrl(previewUrl, name, 900, 640, {
        fileType: 'pdf',
        pdfPageRendered: false,
        pdfErrorReason: errReason,
        fileName: name,
        fileSize: file.size || 0,
        mimeType: 'application/pdf',
        fileDataUrl: ''
    }, { silent: true, deferPersist: true });
    if (sh) {
        examFileBlobCache.set(sh.id, {
            url: blobUrl,
            file: file,
            fileName: name,
            mimeType: 'application/pdf'
        });
        examDrawerState.viewMode = 'file';
        persistLibrary();
        toggleExamDrawer(true);
    }
    return false;
}

async function importDocxExamFile(file, name) {
    setExamDrawerLoading(true, name, 'Đang trích xuất nội dung tài liệu Word (.docx)...');
    let blobUrl = '';
    try {
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Blob !== 'undefined' && file instanceof Blob) {
            blobUrl = URL.createObjectURL(file);
        }
    } catch (e) {}

    try {
        const buf = await file.arrayBuffer();
        const extracted = await extractDocxContentFromBuffer(buf);
        examDrawerState.loadingStatus = null;

        if (extracted.text && extracted.text.trim().length >= 5) {
            addPaginatedTextExamSheets(name, extracted.text, file, 'docx');
            const sheets = appLibrary.examSheets || [];
            const activeSheet = sheets[examDrawerState.activeSheetIndex];
            if (activeSheet && blobUrl) {
                examFileBlobCache.set(activeSheet.id, {
                    url: blobUrl,
                    file: file,
                    fileName: name,
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                });
            }
            return true;
        }

        if (extracted.mediaImages && extracted.mediaImages.length) {
            let firstIdx = -1;
            for (let i = 0; i < extracted.mediaImages.length; i++) {
                const m = extracted.mediaImages[i];
                const title = extracted.mediaImages.length > 1
                    ? (name + ' (Ảnh ' + (i + 1) + '/' + extracted.mediaImages.length + ')')
                    : name;
                const sh = addExamSheetFromDataUrl(m.dataUrl, title, 900, 1200, {
                    fileType: 'image',
                    docFormat: 'docx',
                    fileName: name,
                    fileSize: file.size || 0
                }, { silent: true, keepActive: i > 0, deferPersist: true });
                if (sh && firstIdx < 0) firstIdx = appLibrary.examSheets.length - 1;
            }
            if (firstIdx >= 0) {
                examDrawerState.activeSheetIndex = firstIdx;
                examDrawerState.viewMode = 'crop';
                persistLibrary();
                toggleExamDrawer(true);
                if (typeof showGestureToast === 'function') {
                    showGestureToast('Đã tách ' + extracted.mediaImages.length + ' ảnh đề bài từ "' + name + '"!');
                }
                return true;
            }
        }
    } catch (e) {
        examDrawerState.loadingStatus = null;
    }

    const sizeStr = formatFileSizeLabel(file.size);
    const previewUrl = renderFileCardToDataUrl(
        name,
        'DOCX',
        sizeStr,
        'Tệp Word chưa trích xuất được văn bản trực tiếp (có thể bị mã hóa hoặc trống). Hãy xuất sang PDF hoặc nhấn "⬇ Mở/Tải" để xem bằng ứng dụng Word.'
    );
    const sh = addExamSheetFromDataUrl(previewUrl, name, 900, 640, {
        fileType: 'file',
        docFormat: 'docx',
        fileName: name,
        fileSize: file.size || 0,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }, { silent: true, deferPersist: true });
    if (sh) {
        examFileBlobCache.set(sh.id, { url: blobUrl, file: file, fileName: name, mimeType: file.type || '' });
        examDrawerState.viewMode = 'file';
        persistLibrary();
        toggleExamDrawer(true);
    }
    return false;
}

function handleExamFilesSelected(ev) {
    const files = Array.from(ev?.target?.files || ev?.dataTransfer?.files || []);
    if (!files.length) return;
    files.forEach(file => {
        const name = file.name || 'Tài liệu đề bài';
        const ext = (name.split('.').pop() || '').toLowerCase();
        const fType = (file.type || '').toLowerCase();
        const isImage = fType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic', 'heif', 'svg', 'avif', 'jfif', 'ico', 'tif', 'tiff'].includes(ext);
        const isText = fType.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'chemnotes', 'html', 'htm', 'rtf'].includes(ext);
        const isPdf = fType === 'application/pdf' || ext === 'pdf';
        const isDocx = ext === 'docx' || fType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        if (isImage) {
            importImageExamFile(file, name);
            return;
        }

        if (isDocx && typeof file.arrayBuffer === 'function') {
            importDocxExamFile(file, name);
            return;
        }

        if (isPdf && typeof file.arrayBuffer === 'function') {
            importPdfExamFile(file, name);
            return;
        }

        if (isText) {
            const reader = new FileReader();
            reader.onload = () => {
                let text = String(reader.result || '');
                if (ext === 'chemnotes' || ext === 'json') {
                    try {
                        const parsed = JSON.parse(text);
                        if (parsed && Array.isArray(parsed.notebooks)) {
                            text = parsed.notebooks.map(nb => '📘 ' + nb.title + ' (' + ((nb.pages || []).length) + ' trang)').join('\n') + '\n\n' + JSON.stringify(parsed, null, 2);
                        } else {
                            text = JSON.stringify(parsed, null, 2);
                        }
                    } catch (e) {}
                } else if (ext === 'html' || ext === 'htm') {
                    text = extractReadableTextFromHtml(text);
                } else if (ext === 'rtf') {
                    text = extractReadableTextFromRtf(text);
                }
                addPaginatedTextExamSheets(name, text, file, ext || 'text');
            };
            reader.readAsText(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const rawDataUrl = String(reader.result || '');
            let blobUrl = '';
            try {
                if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Blob !== 'undefined' && file instanceof Blob) {
                    blobUrl = URL.createObjectURL(file);
                }
            } catch (e) {}
            const badge = isPdf ? 'PDF' : (ext ? ext.toUpperCase() : 'FILE');
            const sizeStr = formatFileSizeLabel(file.size);
            const subtitle = isPdf
                ? 'Tài liệu PDF đã đính kèm. Nhấn "↗ Mở ngoài" hoặc "⬇ Mở/Tải" để xem đầy đủ.'
                : (ext === 'doc'
                    ? 'Định dạng Word cũ (.doc) chưa hỗ trợ xem trực tiếp trên trình duyệt — hãy lưu thành .docx hoặc PDF để xem & kéo cắt ngay trong ngăn Đề bài, hoặc nhấn "⬇ Mở/Tải".'
                    : ('File ' + badge + ' đã đính kèm vào Ngăn Đề Bài. Nhấn "⬇ Mở/Tải" để mở bằng ứng dụng tương ứng trên máy.'));
            const previewUrl = renderFileCardToDataUrl(name, badge, sizeStr, subtitle);
            const sh = addExamSheetFromDataUrl(previewUrl, name, 900, 640, {
                fileType: isPdf ? 'pdf' : 'file',
                pdfPageRendered: false,
                docFormat: ext || (isPdf ? 'pdf' : 'file'),
                fileName: name,
                fileSize: file.size || 0,
                mimeType: fType || (isPdf ? 'application/pdf' : 'application/octet-stream'),
                fileDataUrl: rawDataUrl.length <= 420000 ? rawDataUrl : ''
            }, { silent: true });
            if (sh) {
                examFileBlobCache.set(sh.id, {
                    url: blobUrl || rawDataUrl,
                    dataUrl: rawDataUrl,
                    file: file,
                    fileName: name,
                    mimeType: fType
                });
                if (isPdf) {
                    examDrawerState.viewMode = 'file';
                    renderExamDrawer();
                }
            }
        };
        reader.readAsDataURL(file);
    });
}

function addExamSheetFromDataUrl(dataUrl, title = 'Đề bài', natW = 800, natH = 1000, extraMeta = null, opts = null) {
    if (!dataUrl) return null;
    if (!Array.isArray(appLibrary.examSheets)) appLibrary.examSheets = [];
    const options = opts && typeof opts === 'object' ? opts : {};
    const sheet = {
        id: genId('exam'),
        title: title || 'Đề bài',
        src: dataUrl,
        width: Math.max(100, Math.round(natW || 800)),
        height: Math.max(100, Math.round(natH || 1000)),
        ...(extraMeta && typeof extraMeta === 'object' ? extraMeta : {})
    };
    appLibrary.examSheets.push(sheet);
    if (!options.keepActive) {
        examDrawerState.activeSheetIndex = appLibrary.examSheets.length - 1;
        examDrawerState.cropRect = null;
        examDrawerState.viewMode = (sheet.fileType === 'pdf' && !sheet.pdfPageRendered) ? 'file' : 'crop';
    }
    if (!options.deferPersist) persistLibrary();
    if (!options.keepActive) toggleExamDrawer(true);
    if (!options.silent && typeof showGestureToast === 'function') {
        showGestureToast('Đã gắn "' + sheet.title + '" vào Ngăn Đề Bài');
    }
    return sheet;
}

function stepExamSheet(delta) {
    const sheets = appLibrary.examSheets || [];
    if (!sheets.length) return;
    const cur = Math.max(0, Math.min(sheets.length - 1, examDrawerState.activeSheetIndex || 0));
    const nextIdx = (cur + delta + sheets.length) % sheets.length;
    selectExamSheet(nextIdx);
}

function selectExamSheet(idx) {
    const sheets = appLibrary.examSheets || [];
    if (!sheets.length) return;
    examDrawerState.activeSheetIndex = Math.max(0, Math.min(sheets.length - 1, idx));
    examDrawerState.cropRect = null;
    const curSheet = sheets[examDrawerState.activeSheetIndex];
    examDrawerState.viewMode = (curSheet && curSheet.fileType === 'pdf' && !curSheet.pdfPageRendered) ? 'file' : 'crop';
    document.getElementById('examCropActionRow')?.classList.add('hidden');
    renderExamDrawer();
}

function jumpToExamSheetCrop(idx) {
    const sheets = appLibrary.examSheets || [];
    if (!sheets.length) return;
    examDrawerState.activeSheetIndex = Math.max(0, Math.min(sheets.length - 1, Number(idx) || 0));
    examDrawerState.cropRect = null;
    examDrawerState.cropMode = true;
    examDrawerState.viewMode = 'crop';
    document.getElementById('examCropActionRow')?.classList.add('hidden');
    renderExamDrawer();
}

function deleteActiveExamSheet() {
    const sheets = appLibrary.examSheets || [];
    if (!sheets.length) return;
    const idx = Math.max(0, Math.min(sheets.length - 1, examDrawerState.activeSheetIndex || 0));
    const removed = sheets.splice(idx, 1)[0];
    if (removed) {
        examImageCache.delete(removed.id);
        examFileBlobCache.delete(removed.id);
        if (removed.pdfGroupId) {
            const stillUsed = sheets.some(s => s && s.pdfGroupId === removed.pdfGroupId);
            if (!stillUsed) {
                const grp = examFileBlobCache.get(removed.pdfGroupId);
                if (grp && grp.url && grp.url.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
                    try { URL.revokeObjectURL(grp.url); } catch (e) {}
                }
                examFileBlobCache.delete(removed.pdfGroupId);
            }
        }
    }
    examDrawerState.activeSheetIndex = Math.max(0, Math.min(sheets.length - 1, idx));
    examDrawerState.cropRect = null;
    examDrawerState.viewMode = 'crop';
    document.getElementById('examCropActionRow')?.classList.add('hidden');
    persistLibrary();
    renderExamDrawer();
}

function toggleExamDrawerCropMode() {
    setExamDrawerCropMode(!examDrawerState.cropMode);
}

function setExamDrawerCropMode(enabled) {
    examDrawerState.cropMode = !!enabled;
    const btn = document.getElementById('examCropModeBtn');
    if (btn) {
        btn.classList.toggle('active', examDrawerState.cropMode);
        btn.textContent = examDrawerState.cropMode ? '✂️ Kéo cắt' : '✋ Cuộn xem';
    }
    if (examDrawerState.cropMode) {
        examDrawerState.viewMode = 'crop';
        renderExamDrawer();
    } else {
        clearExamCropSelection();
    }
}

function toggleExamFileViewerMode() {
    examDrawerState.viewMode = examDrawerState.viewMode === 'file' ? 'crop' : 'file';
    if (examDrawerState.viewMode === 'file') {
        examDrawerState.cropRect = null;
        document.getElementById('examCropActionRow')?.classList.add('hidden');
    }
    renderExamDrawer();
}

function getActiveExamCachedRecord(sheet) {
    if (!sheet) return null;
    return examFileBlobCache.get(sheet.id) || (sheet.pdfGroupId ? examFileBlobCache.get(sheet.pdfGroupId) : null) || null;
}

function openActiveExamFileInNewTab() {
    const sheets = appLibrary.examSheets || [];
    if (!sheets.length) return false;
    const idx = Math.max(0, Math.min(sheets.length - 1, examDrawerState.activeSheetIndex || 0));
    const sheet = sheets[idx];
    const cached = getActiveExamCachedRecord(sheet);
    const href = cached?.url || cached?.dataUrl || sheet.fileDataUrl || sheet.src;
    if (!href) return false;
    try {
        if (typeof window !== 'undefined' && typeof window.open === 'function') {
            const w = window.open(href, '_blank', 'noopener');
            if (w) return true;
        }
    } catch (e) {}
    return downloadOrOpenActiveExamFile();
}

function retryDecodeActiveExamPdf() {
    const sheets = appLibrary.examSheets || [];
    if (!sheets.length) return false;
    const idx = Math.max(0, Math.min(sheets.length - 1, examDrawerState.activeSheetIndex || 0));
    const sheet = sheets[idx];
    const cached = getActiveExamCachedRecord(sheet);
    if (cached && cached.file && typeof cached.file.arrayBuffer === 'function') {
        examPdfJsLoadPromise = null;
        importPdfExamFile(cached.file, sheet.fileName || sheet.title || 'DeBai.pdf', sheet.id);
        return true;
    }
    if (typeof showGestureToast === 'function') {
        showGestureToast('Hãy bấm "+ Ảnh / File" để chọn lại file PDF từ thiết bị!');
    }
    return false;
}

function downloadOrOpenActiveExamFile() {
    const sheets = appLibrary.examSheets || [];
    if (!sheets.length) return false;
    const idx = Math.max(0, Math.min(sheets.length - 1, examDrawerState.activeSheetIndex || 0));
    const sheet = sheets[idx];
    const cached = getActiveExamCachedRecord(sheet);
    const href = cached?.url || cached?.dataUrl || sheet.fileDataUrl || sheet.src;
    if (!href) return false;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const a = document.createElement('a');
        a.href = href;
        a.download = sheet.fileName || sheet.title || 'DeBai';
        a.target = '_blank';
        document.body?.appendChild?.(a);
        a.click?.();
        setTimeout(() => a.remove?.(), 300);
    }
    return true;
}

function pasteExamTextToPage() {
    const sheets = appLibrary.examSheets || [];
    if (!sheets.length) return false;
    const idx = Math.max(0, Math.min(sheets.length - 1, examDrawerState.activeSheetIndex || 0));
    const sheet = sheets[idx];
    const raw = (sheet?.rawText || '').trim();
    if (!raw) return false;
    if (typeof isReadMode !== 'undefined' && isReadMode) toggleReadMode(false);
    const doc = getDocState();
    saveHistorySnapshot();
    if (!Array.isArray(doc.texts)) doc.texts = [];
    const lines = raw.split(/\r?\n/).filter(Boolean).slice(0, 14);
    const pageIdx = getActiveNotebook().activePageIndex || 0;
    const baseY = Math.max(50, Math.min(A4_HEIGHT - 120, Math.round((-panY / zoom - getPageYOffset(pageIdx)) + 70)));
    lines.forEach((line, lIdx) => {
        doc.texts.push({
            id: genId('txt'),
            x: 54,
            y: baseY + lIdx * 24,
            text: line.slice(0, 120),
            color: '#0f172a',
            size: 14
        });
    });
    persistLibrary();
    renderAll();
    if (typeof showGestureToast === 'function') showGestureToast('Đã dán ' + lines.length + ' dòng đề vào trang viết!');
    return true;
}

function clearExamCropSelection() {
    examDrawerState.cropRect = null;
    examDrawerState.isDraggingCrop = false;
    examDrawerState.dragStart = null;
    document.getElementById('examCropActionRow')?.classList.add('hidden');
    renderExamDrawer();
}

function setExamCropRect(x, y, w, h) {
    const sheets = appLibrary.examSheets || [];
    const idx = Math.max(0, Math.min(sheets.length - 1, examDrawerState.activeSheetIndex || 0));
    const sheet = sheets[idx];
    const maxW = sheet ? (sheet.width || 800) : 800;
    const maxH = sheet ? (sheet.height || 1000) : 1000;
    const cx = Math.max(0, Math.min(maxW - 10, Math.round(x)));
    const cy = Math.max(0, Math.min(maxH - 10, Math.round(y)));
    const cw = Math.max(10, Math.min(maxW - cx, Math.round(w)));
    const ch = Math.max(10, Math.min(maxH - cy, Math.round(h)));
    examDrawerState.cropRect = { x: cx, y: cy, w: cw, h: ch };
    document.getElementById('examCropActionRow')?.classList.remove('hidden');
    renderExamDrawer();
}

function renderExamDrawer() {
    const sheets = appLibrary.examSheets || [];
    const total = sheets.length;
    const idx = total ? Math.max(0, Math.min(total - 1, examDrawerState.activeSheetIndex || 0)) : 0;
    examDrawerState.activeSheetIndex = idx;

    const counterEl = document.getElementById('examSheetCounterLabel');
    if (counterEl) counterEl.textContent = total ? ((idx + 1) + '/' + total) : '0/0';

    const pickerEl = document.getElementById('examSheetPickerSelect');
    if (pickerEl) {
        if (!total) {
            pickerEl.classList.add('hidden');
            pickerEl.innerHTML = '';
        } else {
            pickerEl.classList.remove('hidden');
            pickerEl.innerHTML = sheets.map((s, i) => {
                const icon = s.fileType === 'pdf' ? '📕' : (s.docFormat === 'docx' ? '📘' : (s.fileType === 'text' ? '📄' : (s.fileType === 'file' ? '📎' : '🖼')));
                const label = icon + ' ' + String(s.title || ('Tài liệu ' + (i + 1))).slice(0, 24);
                return '<option value="' + i + '" ' + (i === idx ? 'selected' : '') + '>' + escapeHTMLAttr(label) + '</option>';
            }).join('');
            pickerEl.value = String(idx);
        }
    }

    const cropBtn = document.getElementById('examCropModeBtn');
    if (cropBtn) {
        cropBtn.classList.toggle('active', !!examDrawerState.cropMode);
        cropBtn.textContent = examDrawerState.cropMode ? '✂️ Kéo cắt' : '✋ Cuộn xem';
    }

    const emptyEl = document.getElementById('examEmptyState');
    const can = document.getElementById('examPreviewCanvas');
    const metaBar = document.getElementById('examFileMetaBar');
    const viewerWrap = document.getElementById('examFileViewerWrap');
    const iframeEl = document.getElementById('examFileIframe');
    const textEl = document.getElementById('examFileTextView');
    if (!can) return;

    // Luôn ẩn iframe cũ để chống 100% lỗi màn hình trắng trên iPadOS Safari/PWA & CSP frame-ancestors
    iframeEl?.classList.add('hidden');

    const loading = examDrawerState.loadingStatus;
    if (loading && loading.active) {
        emptyEl?.classList.add('hidden');
        can.classList.add('hidden');
        document.getElementById('examCropActionRow')?.classList.add('hidden');
        if (viewerWrap) viewerWrap.classList.remove('hidden');
        if (textEl) {
            textEl.classList.remove('hidden');
            textEl.classList.add('exam-rich-view');
            textEl.innerHTML = '<div class="exam-loading-card">'
                + '<div class="exam-loading-spinner">⏳</div>'
                + '<div class="exam-loading-title">' + escapeHTMLAttr(loading.title) + '</div>'
                + '<div class="exam-loading-sub">' + escapeHTMLAttr(loading.detail || 'Đang xử lý tệp...') + '</div>'
                + '</div>';
        }
        return;
    }

    if (!total) {
        emptyEl?.classList.remove('hidden');
        can.classList.add('hidden');
        metaBar?.classList.add('hidden');
        viewerWrap?.classList.add('hidden');
        document.getElementById('examCropActionRow')?.classList.add('hidden');
        return;
    }

    emptyEl?.classList.add('hidden');
    const sheet = sheets[idx];
    const fType = sheet.fileType || 'image';
    const isFileDoc = fType === 'pdf' || fType === 'text' || fType === 'file';
    if (metaBar) {
        metaBar.classList.remove('hidden');
        const badgeEl = document.getElementById('examFileTypeBadge');
        const nameEl = document.getElementById('examFileNameLabel');
        const sizeEl = document.getElementById('examFileSizeLabel');
        const toggleViewBtn = document.getElementById('examToggleFileViewBtn');
        const pasteTxtBtn = document.getElementById('examPasteTextBtn');
        if (badgeEl) {
            badgeEl.textContent = fType === 'pdf'
                ? 'PDF'
                : (fType === 'text'
                    ? (sheet.docFormat === 'docx' ? 'DOCX' : 'TEXT')
                    : (fType === 'file' ? String(sheet.docFormat || 'FILE').toUpperCase().slice(0, 6) : 'ẢNH'));
        }
        if (nameEl) nameEl.textContent = sheet.fileName || sheet.title || 'Đề bài';
        if (sizeEl) sizeEl.textContent = formatFileSizeLabel(sheet.fileSize);
        if (toggleViewBtn) {
            toggleViewBtn.classList.toggle('hidden', !isFileDoc);
            if (examDrawerState.viewMode === 'file') {
                toggleViewBtn.textContent = '✂️ Kéo cắt';
            } else if (fType === 'pdf' && sheet.pdfPageRendered) {
                toggleViewBtn.textContent = '📖 Đọc cuộn';
            } else if (fType === 'text') {
                toggleViewBtn.textContent = '👁 Xem chữ';
            } else {
                toggleViewBtn.textContent = '👁 Xem file';
            }
        }
        if (pasteTxtBtn) {
            pasteTxtBtn.classList.toggle('hidden', !(fType === 'text' && sheet.rawText));
        }
    }

    const showDocViewer = isFileDoc && examDrawerState.viewMode === 'file';
    if (showDocViewer && viewerWrap) {
        can.classList.add('hidden');
        viewerWrap.classList.remove('hidden');
        document.getElementById('examCropActionRow')?.classList.add('hidden');
        if (fType === 'text') {
            if (textEl) {
                textEl.classList.remove('hidden');
                textEl.classList.remove('exam-rich-view');
                textEl.textContent = sheet.rawText || '(Tài liệu văn bản trống)';
            }
        } else if (fType === 'pdf' && sheet.pdfPageRendered) {
            // Chế độ đọc cuộn dọc tất cả các trang PDF đã dựng ảnh — 100% sắc nét, không dùng iframe!
            if (textEl) {
                textEl.classList.remove('hidden');
                textEl.classList.add('exam-rich-view');
                const groupPages = [];
                sheets.forEach((s, sIdx) => {
                    if (s && s.pdfPageRendered && ((sheet.pdfGroupId && s.pdfGroupId === sheet.pdfGroupId) || s.id === sheet.id)) {
                        groupPages.push({ sheet: s, idx: sIdx });
                    }
                });
                const list = groupPages.length ? groupPages : [{ sheet, idx }];
                textEl.innerHTML = '<div class="exam-pdf-scroll-list">'
                    + list.map((item, pos) =>
                        '<div class="exam-pdf-page-card">'
                        + '<div class="exam-pdf-page-bar">'
                        + '<span>Trang ' + (item.sheet.pdfPageNumber || (pos + 1)) + '/' + (item.sheet.pdfTotalPages || list.length) + '</span>'
                        + '<button onclick="jumpToExamSheetCrop(' + item.idx + ')" class="exam-snip-btn primary">✂️ Cắt trang này</button>'
                        + '</div>'
                        + '<img class="exam-pdf-page-img" src="' + escapeHTMLAttr(item.sheet.src) + '" alt="Trang PDF" />'
                        + '</div>'
                    ).join('')
                    + '</div>';
            }
        } else {
            // Thẻ thông tin trực quan cho PDF offline / file nhị phân — KHÔNG BAO GIỜ hiện iframe trắng!
            if (textEl) {
                textEl.classList.remove('hidden');
                textEl.classList.add('exam-rich-view');
                const cached = getActiveExamCachedRecord(sheet);
                const canRetryPdf = fType === 'pdf' && cached && cached.file && typeof cached.file.arrayBuffer === 'function';
                const badgeTxt = fType === 'pdf' ? 'PDF' : String(sheet.docFormat || 'FILE').toUpperCase().slice(0, 6);
                const sizeTxt = formatFileSizeLabel(sheet.fileSize) || 'Đã lưu trong ngăn Đề bài';
                const descTxt = fType === 'pdf'
                    ? (sheet.pdfErrorReason === 'password'
                        ? 'Tệp PDF này đang được bảo vệ bằng mật khẩu nên trình duyệt không thể tự giải mã ảnh trang. Hãy nhấn "↗ Mở ngoài" để đọc bằng trình xem PDF của máy.'
                        : 'Chưa thể tải bộ giải mã PDF (có thể thiết bị đang ngoại tuyến lần đầu). Khi có mạng, hãy nhấn "🔄 Giải mã lại PDF" để xem & kéo cắt trực tiếp từng trang ngay tại đây, hoặc mở bằng trình đọc PDF của máy.')
                    : (sheet.docFormat === 'doc'
                        ? 'Tệp Word đời cũ (.doc) không thể đọc trực tiếp trên web. Hãy lưu tệp dưới dạng .docx hoặc .pdf rồi gắn lại để xem & cắt câu hỏi tức thì!'
                        : 'Định dạng tệp này không hỗ trợ xem trực tiếp trong trình duyệt. Hãy nhấn "↗ Mở ngoài" hoặc "⬇ Tải về" để mở bằng ứng dụng tương ứng trên máy.');
                textEl.innerHTML = '<div class="exam-doc-fallback-card">'
                    + '<div class="exam-doc-fallback-badge">' + escapeHTMLAttr(badgeTxt) + '</div>'
                    + '<div class="exam-doc-fallback-name">' + escapeHTMLAttr(sheet.fileName || sheet.title || 'Tài liệu') + '</div>'
                    + '<div class="exam-doc-fallback-size">' + escapeHTMLAttr(sizeTxt) + '</div>'
                    + '<p class="exam-doc-fallback-desc">' + escapeHTMLAttr(descTxt) + '</p>'
                    + '<div class="exam-doc-fallback-actions">'
                    + (canRetryPdf ? '<button onclick="retryDecodeActiveExamPdf()" class="exam-snip-btn primary">🔄 Giải mã lại PDF</button>' : '')
                    + '<button onclick="openActiveExamFileInNewTab()" class="exam-snip-btn' + (canRetryPdf ? '' : ' primary') + '">↗ Mở ngoài</button>'
                    + '<button onclick="downloadOrOpenActiveExamFile()" class="exam-snip-btn">⬇ Tải về</button>'
                    + '<button onclick="setExamDrawerCropMode(true)" class="exam-snip-btn">✂️ Xem thẻ</button>'
                    + '</div>'
                    + '</div>';
            }
        }
        return;
    }

    viewerWrap?.classList.add('hidden');
    can.classList.remove('hidden');
    can.style.cursor = examDrawerState.cropMode ? 'crosshair' : 'grab';
    can.style.touchAction = examDrawerState.cropMode ? 'none' : 'pan-x pan-y';

    const W = Math.max(100, sheet.width || 800);
    const H = Math.max(100, sheet.height || 1000);
    if (can.width !== W) can.width = W;
    if (can.height !== H) can.height = H;

    const eCtx = can.getContext('2d');
    if (!eCtx) return;
    eCtx.clearRect(0, 0, W, H);
    eCtx.fillStyle = '#ffffff';
    eCtx.fillRect(0, 0, W, H);

    let imgEl = examImageCache.get(sheet.id);
    if ((!imgEl || imgEl._src !== sheet.src || imgEl._failed) && typeof Image === 'function') {
        imgEl = new Image();
        imgEl._src = sheet.src;
        imgEl._failed = false;
        examImageCache.set(sheet.id, imgEl);
        imgEl.onload = () => {
            imgEl._failed = false;
            if (examDrawerState.open) renderExamDrawer();
        };
        imgEl.onerror = () => {
            imgEl._failed = true;
            if (examDrawerState.open) renderExamDrawer();
        };
        imgEl.src = sheet.src;
        if (typeof imgEl.decode === 'function') {
            imgEl.decode().then(() => {
                if (examDrawerState.open) renderExamDrawer();
            }).catch(() => {});
        }
    }
    if (imgEl && !imgEl._failed && imgEl.complete && imgEl.naturalWidth > 0) {
        eCtx.drawImage(imgEl, 0, 0, W, H);
    } else {
        eCtx.save();
        eCtx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        eCtx.lineWidth = 2;
        eCtx.strokeRect(12, 12, W - 24, H - 24);
        eCtx.fillStyle = imgEl && imgEl._failed ? '#dc2626' : '#334155';
        eCtx.font = '700 20px Inter, sans-serif';
        eCtx.textAlign = 'center';
        eCtx.fillText(
            imgEl && imgEl._failed ? '⚠️ Không hiển thị được ảnh xem trước' : ('⏳ Đang tải: ' + String(sheet.title || 'Đề bài').slice(0, 38)),
            W / 2,
            H / 2 - 12
        );
        eCtx.fillStyle = '#64748b';
        eCtx.font = '500 15px Inter, sans-serif';
        eCtx.fillText(
            imgEl && imgEl._failed ? 'Hãy thử gắn lại file hoặc nhấn "⬇ Mở/Tải" ở thanh trên.' : 'Vui lòng chờ trong giây lát...',
            W / 2,
            H / 2 + 20
        );
        eCtx.restore();
    }

    const cr = examDrawerState.cropRect;
    if (cr && cr.w > 2 && cr.h > 2) {
        eCtx.save();
        eCtx.fillStyle = 'rgba(15, 23, 42, 0.48)';
        eCtx.fillRect(0, 0, W, cr.y);
        eCtx.fillRect(0, cr.y + cr.h, W, Math.max(0, H - (cr.y + cr.h)));
        eCtx.fillRect(0, cr.y, cr.x, cr.h);
        eCtx.fillRect(cr.x + cr.w, cr.y, Math.max(0, W - (cr.x + cr.w)), cr.h);

        eCtx.strokeStyle = '#38bdf8';
        eCtx.lineWidth = 3;
        eCtx.setLineDash([8, 5]);
        eCtx.strokeRect(cr.x, cr.y, cr.w, cr.h);
        eCtx.setLineDash([]);
        eCtx.fillStyle = '#38bdf8';
        [[cr.x, cr.y], [cr.x + cr.w, cr.y], [cr.x, cr.y + cr.h], [cr.x + cr.w, cr.y + cr.h]].forEach(([hx, hy]) => {
            eCtx.beginPath();
            eCtx.arc(hx, hy, 5, 0, Math.PI * 2);
            eCtx.fill();
        });
        eCtx.restore();
    }
}

function pasteCroppedExamToPage(autoCollapse = false, lockImmediately = false) {
    const sheets = appLibrary.examSheets || [];
    if (!sheets.length || !examDrawerState.cropRect) return false;
    const idx = Math.max(0, Math.min(sheets.length - 1, examDrawerState.activeSheetIndex || 0));
    const sheet = sheets[idx];
    const sheetW = Math.max(100, sheet.width || 800);
    const sheetH = Math.max(100, sheet.height || 1000);
    const cr = examDrawerState.cropRect;
    const rx = Math.max(0, Math.min(sheetW - 10, Math.round(cr.x)));
    const ry = Math.max(0, Math.min(sheetH - 10, Math.round(cr.y)));
    const rw = Math.max(10, Math.min(sheetW - rx, Math.round(cr.w)));
    const rh = Math.max(10, Math.min(sheetH - ry, Math.round(cr.h)));

    let croppedDataUrl = sheet.src;
    const imgEl = examImageCache.get(sheet.id);
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0 && typeof document.createElement === 'function') {
        const sx = imgEl.naturalWidth / sheetW;
        const sy = imgEl.naturalHeight / sheetH;
        const off = document.createElement('canvas');
        off.width = Math.max(10, Math.round(rw * sx));
        off.height = Math.max(10, Math.round(rh * sy));
        const offCtx = off.getContext('2d');
        if (offCtx) {
            offCtx.fillStyle = '#ffffff';
            offCtx.fillRect(0, 0, off.width, off.height);
            offCtx.imageSmoothingEnabled = true;
            offCtx.imageSmoothingQuality = 'high';
            offCtx.drawImage(imgEl, rx * sx, ry * sy, rw * sx, rh * sy, 0, 0, off.width, off.height);
            const cand = off.toDataURL('image/png');
            if (cand && cand.length > 30) croppedDataUrl = cand;
        }
        off.width = 0;
        off.height = 0;
    }

    if (typeof isReadMode !== 'undefined' && isReadMode) {
        toggleReadMode(false);
    }
    insertDataUrlImageToPage(croppedDataUrl, rw, rh, { fromExam: true, locked: !!lockImmediately });
    clearExamCropSelection();
    if (autoCollapse) toggleExamDrawer(false);
    if (typeof showGestureToast === 'function') {
        showGestureToast(lockImmediately
            ? '🔒 Đã dán & cố định đề bài (khóa kéo & miễn nhiễm Lasso)!'
            : 'Đã dán câu hỏi vào trang viết — chỉnh vị trí xong bấm 📌 Cố định!');
    }
    return true;
}

function insertFullExamSheetToCanvas(autoCollapse = false) {
    const sheets = appLibrary.examSheets || [];
    if (!sheets.length) return false;
    const idx = Math.max(0, Math.min(sheets.length - 1, examDrawerState.activeSheetIndex || 0));
    const sheet = sheets[idx];
    if (typeof isReadMode !== 'undefined' && isReadMode) {
        toggleReadMode(false);
    }
    insertDataUrlImageToPage(sheet.src, sheet.width || 800, sheet.height || 1000, { fromExam: true, locked: false });
    if (autoCollapse) toggleExamDrawer(false);
    if (typeof showGestureToast === 'function') showGestureToast('Đã dán nguyên tờ đề vào trang viết!');
    return true;
}

let promoDemoTimers = [];
let isPromoDemoRunning = false;
let promoDemoStartedRecording = false;
let promoDemoOriginalTheme = null;

function syncPromoDemoUI() {
    document.getElementById('promoDemoStatusBadge')?.classList.toggle('hidden', !isPromoDemoRunning);
    const runBtn = document.getElementById('promoDemoRunBtn');
    const recBtn = document.getElementById('promoDemoRecBtn');
    if (runBtn) runBtn.textContent = isPromoDemoRunning ? '⏹ Dừng Demo' : '▶ Chạy Demo';
    if (recBtn) recBtn.disabled = isPromoDemoRunning;
}

function stopPromoShowcaseDemo(restoreTheme = true) {
    promoDemoTimers.forEach(t => clearTimeout(t));
    promoDemoTimers = [];
    const wasRunning = isPromoDemoRunning;
    isPromoDemoRunning = false;
    if (restoreTheme && promoDemoOriginalTheme && typeof applyAppTheme === 'function') {
        applyAppTheme(promoDemoOriginalTheme);
    }
    promoDemoOriginalTheme = null;
    if (promoDemoStartedRecording && typeof isCleanRecording !== 'undefined' && isCleanRecording) {
        promoDemoStartedRecording = false;
        stopCleanBoardRecording();
    } else {
        promoDemoStartedRecording = false;
    }
    syncPromoDemoUI();
    if (wasRunning && typeof showGestureToast === 'function') {
        showGestureToast('🎬 Hoàn tất trình diễn Demo ChemNote!');
    }
}

function startPromoShowcaseDemo(recordVideo = false) {
    if (isPromoDemoRunning) {
        stopPromoShowcaseDemo(true);
        return;
    }
    closeAllPopovers();
    if (typeof isReadMode !== 'undefined' && isReadMode) toggleReadMode(false);

    promoDemoOriginalTheme = appLibrary.appTheme || 'midnight_sky';
    isPromoDemoRunning = true;
    promoDemoStartedRecording = false;
    syncPromoDemoUI();

    if (typeof addNewPageToActiveNotebook === 'function') addNewPageToActiveNotebook();
    if (typeof fitA4ToScreen === 'function') fitA4ToScreen('page');

    if (recordVideo && typeof startCleanBoardRecording === 'function' && !isCleanRecording) {
        promoDemoStartedRecording = true;
        startCleanBoardRecording();
    }

    const schedule = (ms, fn) => {
        const id = setTimeout(() => {
            if (!isPromoDemoRunning) return;
            fn();
        }, ms);
        promoDemoTimers.push(id);
    };

    // 1. Tiêu đề + Vẽ tay zíc-zắc -> Mạch Carbon
    schedule(120, () => {
        const doc = getDocState();
        doc.texts = doc.texts || [];
        doc.inkStrokes = doc.inkStrokes || [];
        doc.texts.push({ id: genId('txt'), x: 60, y: 55, text: 'ChemNote Live Demo — Goodnotes 6 × ChemDraw', color: '#0284c7', size: 18 });
        doc.inkStrokes.push({
            mode: 'ink', penStyle: 'ballpoint', color: '#0f172a', width: 3.5, opacity: 1,
            points: [
                { x: 90, y: 170 }, { x: 132, y: 130 }, { x: 174, y: 170 },
                { x: 216, y: 130 }, { x: 258, y: 170 }, { x: 300, y: 130 }
            ]
        });
        persistLibrary();
        if (typeof renderAll === 'function') renderAll();
        if (typeof showGestureToast === 'function') showGestureToast('1/5 • Vẽ zíc-zắc tay chuẩn bị biến thành Mạch Carbon...');
    });

    schedule(1350, () => {
        const doc = getDocState();
        if (doc.inkStrokes?.length) doc.inkStrokes.pop();
        if (typeof commitCarbonChainFromVertices === 'function') {
            commitCarbonChainFromVertices([
                { x: 90, y: 170 }, { x: 132, y: 130 }, { x: 174, y: 170 },
                { x: 216, y: 130 }, { x: 258, y: 170 }, { x: 300, y: 130 }
            ], doc, '#0f172a');
        }
        persistLibrary();
        if (typeof renderAll === 'function') renderAll();
        if (typeof showGestureToast === 'function') showGestureToast('✨ Tự biến thành Mạch Carbon 120° chuẩn xác!');
    });

    // 2. Kho Vòng Thơm & Nhóm thế nhanh
    schedule(2600, () => {
        const doc = getDocState();
        if (typeof stampRingAt === 'function') {
            stampRingAt(220, 350, 'benzene');
            stampRingAt(340, 350, 'cyclohexane');
        }
        const topAtom = (doc.atoms || []).find(a => Math.hypot(a.x - 220, a.y - 310) < 42);
        if (topAtom) topAtom.label = 'OH';
        const rightAtom = (doc.atoms || []).find(a => Math.hypot(a.x - 378, a.y - 350) < 48);
        if (rightAtom) rightAtom.label = 'COOH';
        persistLibrary();
        if (typeof renderAll === 'function') renderAll();
        if (typeof showGestureToast === 'function') showGestureToast('2/5 • Đóng dấu Vòng thơm & Gắn nhóm thế OH / COOH!');
    });

    // 3. Cấu dạng Ghế + Chair Flip + Axial/Equatorial
    schedule(4200, () => {
        if (typeof stampConformerAt === 'function') stampConformerAt(570, 260, 'chair_left');
        if (typeof renderAll === 'function') renderAll();
        if (typeof showGestureToast === 'function') showGestureToast('3/5 • Cấu dạng Ghế Cyclohexan...');
    });

    schedule(5300, () => {
        if (typeof flipActiveChairConformer === 'function') flipActiveChairConformer();
        if (typeof showGestureToast === 'function') showGestureToast('⇄ Chair Flip! Lật cấu dạng ghế 1 chạm');
    });

    schedule(6400, () => {
        if (typeof addAxialEquatorialToActiveChair === 'function') addAxialEquatorialToActiveChair();
        if (typeof showGestureToast === 'function') showGestureToast('⚡ +Ax/Eq! Mọc đủ liên kết Trục & Biên');
    });

    // 4. Mũi tên cơ chế Bezier & Orbital
    schedule(7700, () => {
        const doc = getDocState();
        doc.mechArrows = doc.mechArrows || [];
        doc.orbitals = doc.orbitals || [];
        doc.mechArrows.push({ id: genId('ma'), x1: 185, y1: 540, x2: 335, y2: 540, type: '2e_120', color: '#e11d48' });
        doc.orbitals.push({ id: genId('ob'), x: 430, y: 545, type: 'p_top_shaded', angle: 0.25, scale: 40, color: '#0284c7' });
        persistLibrary();
        if (typeof renderAll === 'function') renderAll();
        if (typeof showGestureToast === 'function') showGestureToast('4/5 • Mũi tên cong cơ chế & Vân đạo Orbital!');
    });

    // 5. Aesthetic Themes & Giấy Lục giác
    schedule(9200, () => {
        if (typeof setPaperTemplate === 'function') setPaperTemplate('hex');
        if (typeof applyAppTheme === 'function') applyAppTheme('sakura_cute');
        if (typeof showGestureToast === 'function') showGestureToast('5/5 • Đổi nhanh Tone Sakura 🌸 & Giấy Lục giác!');
    });
    schedule(10400, () => {
        if (typeof applyAppTheme === 'function') applyAppTheme('mint_cream');
        if (typeof showGestureToast === 'function') showGestureToast('🌿 Tone Matcha Mint cực dịu mắt!');
    });
    schedule(11600, () => {
        if (typeof applyAppTheme === 'function') applyAppTheme('cyber_aurora');
    });
    schedule(12800, () => {
        stopPromoShowcaseDemo(true);
    });
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', () => {
        if (typeof closeAudienceProjectorWindow === 'function') closeAudienceProjectorWindow();
    });
}

/* ============================================================================
 * 1. HUB CẬP NHẬT PHIÊN BẢN, LỊCH SỬ & BẢNG TỔNG HỢP TÍNH NĂNG
 * ============================================================================ */
let latestRemoteVersionInfo = null;
let dismissedUpdateVersionCode = 0;
let lastAutoUpdateCheckAt = 0;
let autoUpdateWakeBound = false;

function showAutoUpdateBanner(data) {
    if (!data || typeof data.versionCode !== 'number') return;
    const banner = document.getElementById('autoUpdateNotifyBanner');
    if (!banner) return;
    const curVer = (typeof APP_CURRENT_VERSION !== 'undefined' && APP_CURRENT_VERSION)
        ? APP_CURRENT_VERSION
        : { version: '15.0', versionCode: 20 };
    if (Number(data.versionCode) <= Number(curVer.versionCode || 0)) {
        banner.classList.add('hidden');
        return;
    }
    const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const titleEl = document.getElementById('autoUpdateBannerTitle');
    const descEl = document.getElementById('autoUpdateBannerDesc');
    const listEl = document.getElementById('autoUpdateBannerList');
    const nowBtn = document.getElementById('autoUpdateBannerNowBtn');
    if (titleEl) titleEl.textContent = '🆕 Đã có bản mới ChemNote v' + (data.version || data.versionCode);
    if (descEl) descEl.textContent = data.title || ('Phiên bản mới v' + data.version + ' đã sẵn sàng — toàn bộ vở viết trên máy được giữ nguyên 100%!');
    if (listEl) {
        const items = Array.isArray(data.highlights) ? data.highlights.slice(0, 3) : [];
        listEl.innerHTML = items.map(it => '<li>' + esc(it) + '</li>').join('');
        listEl.classList.toggle('hidden', items.length === 0);
    }
    if (nowBtn) {
        nowBtn.disabled = false;
        nowBtn.textContent = '⬇ Cập nhật v' + (data.version || '') + ' ngay';
    }
    banner.classList.remove('hidden');
}

function dismissAutoUpdateBanner(rememberDismiss = true) {
    const banner = document.getElementById('autoUpdateNotifyBanner');
    if (banner) banner.classList.add('hidden');
    if (rememberDismiss && latestRemoteVersionInfo && typeof latestRemoteVersionInfo.versionCode === 'number') {
        dismissedUpdateVersionCode = latestRemoteVersionInfo.versionCode;
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('chemnote_dismissed_ver', String(dismissedUpdateVersionCode));
            }
        } catch (_) {}
    }
}

function bindAutoUpdateWakeListeners() {
    if (autoUpdateWakeBound) return;
    autoUpdateWakeBound = true;
    try {
        if (typeof sessionStorage !== 'undefined') {
            const saved = parseInt(sessionStorage.getItem('chemnote_dismissed_ver') || '0', 10);
            if (Number.isFinite(saved) && saved > 0) dismissedUpdateVersionCode = saved;
        }
    } catch (_) {}
    const triggerCheckIfDue = () => {
        const nowT = Date.now();
        if (nowT - lastAutoUpdateCheckAt < 60000) return;
        lastAutoUpdateCheckAt = nowT;
        if (typeof checkForAppUpdate === 'function') checkForAppUpdate(true);
    };
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') triggerCheckIfDue();
        });
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('pageshow', (ev) => {
            if (ev && ev.persisted) triggerCheckIfDue();
        });
        window.addEventListener('online', () => triggerCheckIfDue());
    }
}

function openVersionUpdateHub() {
    closeAllPopovers();
    dismissAutoUpdateBanner(false);
    renderVersionUpdateHubContent();
    document.getElementById('versionUpdateHubModal')?.classList.remove('hidden');
    checkForAppUpdate(true);
}

function closeVersionUpdateHub() {
    document.getElementById('versionUpdateHubModal')?.classList.add('hidden');
}

function switchVerHubSubTab(tab) {
    const isFeatures = tab === 'features';
    document.getElementById('verSubTabChangelog')?.classList.toggle('active', !isFeatures);
    document.getElementById('verSubTabFeatures')?.classList.toggle('active', isFeatures);
    document.getElementById('verChangelogPanel')?.classList.toggle('hidden', isFeatures);
    document.getElementById('verFeaturesPanel')?.classList.toggle('hidden', !isFeatures);
    if (isFeatures) renderFeatureSummaryTable();
}

function renderVersionUpdateHubContent() {
    const curVer = (typeof APP_CURRENT_VERSION !== 'undefined' && APP_CURRENT_VERSION)
        ? APP_CURRENT_VERSION
        : { version: '14.0', versionCode: 14, releasedAt: '2026-11-17', title: 'ChemNote' };
    const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const curBadge = document.getElementById('verCurrentBadge');
    if (curBadge) curBadge.textContent = `Bản trên máy: v${curVer.version}`;

    const rem = latestRemoteVersionInfo;
    const remBadge = document.getElementById('verRemoteStatusBadge');
    const detailEl = document.getElementById('verStatusDetailText');
    const applyBtn = document.getElementById('verApplyUpdateBtn');
    const dotEl = document.getElementById('versionUpdateDot');

    const hasNewer = !!(rem && Number(rem.versionCode) > Number(curVer.versionCode));
    if (dotEl) dotEl.classList.toggle('hidden', !hasNewer);
    const menuBadge = document.getElementById('versionUpdateMenuBadge');
    if (menuBadge) {
        menuBadge.textContent = hasNewer ? `🆕 v${rem.version}` : `v${curVer.version}`;
        menuBadge.className = hasNewer
            ? 'px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 text-[10px] font-extrabold'
            : 'px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-extrabold';
    }
    const settingsBadge = document.getElementById('settingsVersionUpdateBadge');
    if (settingsBadge) {
        settingsBadge.textContent = hasNewer ? `🆕 v${rem.version}` : `v${curVer.version}`;
    }

    if (remBadge) {
        if (hasNewer) {
            remBadge.textContent = `🆕 Có bản mới v${rem.version}`;
            remBadge.className = 'px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-extrabold text-[11px]';
        } else if (rem && Number(rem.versionCode) >= 1) {
            remBadge.textContent = `✓ Đã là mới nhất (v${rem.version})`;
            remBadge.className = 'px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/40 text-sky-300 font-bold text-[11px]';
        }
    }
    if (applyBtn) {
        applyBtn.classList.remove('hidden');
        if (hasNewer && rem) {
            applyBtn.textContent = `⬇ Cập nhật lên v${rem.version} ngay`;
            applyBtn.className = 'px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px] shadow-lg transition';
        } else {
            applyBtn.textContent = '♻️ Tải lại bản mới nhất';
            applyBtn.className = 'px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/45 text-sky-300 font-bold text-[11px] transition';
        }
    }
    if (detailEl && hasNewer && rem) {
        detailEl.textContent = `Phát hiện bản ${rem.title || ('v' + rem.version)} (${rem.releasedAt || ''}). Bấm cập nhật để nâng cấp tức thì — toàn bộ bài viết trên iPad được giữ nguyên!`;
    }

    const summaryList = document.getElementById('verLatestSummaryList');
    if (summaryList) {
        const highlights = (hasNewer && Array.isArray(rem?.highlights) && rem.highlights.length)
            ? rem.highlights
            : ((typeof VERSION_CHANGELOG_HISTORY !== 'undefined' && VERSION_CHANGELOG_HISTORY[0]?.items) || []);
        summaryList.innerHTML = highlights.map(it => `<li>${esc(it)}</li>`).join('');
    }

    const clEl = document.getElementById('verChangelogPanel');
    if (clEl && typeof VERSION_CHANGELOG_HISTORY !== 'undefined') {
        clEl.innerHTML = VERSION_CHANGELOG_HISTORY.map((entry, i) => `
            <div class="help-guide-card">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded-md font-extrabold text-[11px] ${i === 0 ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40' : 'bg-black/20 text-slate-300'}">${esc(entry.version)}</span>
                        <span class="font-bold text-[12px]" style="color:var(--text-main);">${esc(entry.title)}</span>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-black/15" style="color:var(--text-muted);">${esc(entry.date)} · ${esc(entry.badge)}</span>
                </div>
                <ul class="space-y-1 list-disc pl-4 text-[11px] leading-relaxed" style="color:var(--text-muted);">
                    ${(entry.items || []).map(line => `<li>${esc(line)}</li>`).join('')}
                </ul>
            </div>
        `).join('');
    }
    renderFeatureSummaryTable();
}

function renderFeatureSummaryTable() {
    const tbody = document.getElementById('verFeatureTableBody');
    const countEl = document.getElementById('verFeatureCountBadge');
    if (!tbody || typeof FEATURE_SUMMARY_MATRIX === 'undefined') return;
    const q = (document.getElementById('verFeatureSearchInput')?.value || '').trim().toLowerCase();
    const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rows = FEATURE_SUMMARY_MATRIX.filter(f => !q ||
        f.cat.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        f.how.toLowerCase().includes(q));
    if (countEl) countEl.textContent = `${rows.length}/${FEATURE_SUMMARY_MATRIX.length} tính năng`;
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 opacity-70">Không tìm thấy tính năng phù hợp.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(f => `
        <tr>
            <td class="feat-cat">${esc(f.cat)}</td>
            <td class="font-bold">${esc(f.name)}</td>
            <td class="feat-how">${esc(f.how)}</td>
        </tr>
    `).join('');
}

// ===== TỰ CẬP NHẬT BẢN WINDOWS (ELECTRON + GITHUB RELEASES) =====
let desktopUpdateState = null;
let desktopUpdateListenerBound = false;

function isDesktopAutoUpdateAvailable() {
    return typeof window !== 'undefined'
        && window.chemnoteDesktop
        && window.chemnoteDesktop.isElectron
        && typeof window.chemnoteDesktop.checkForUpdates === 'function';
}

function renderDesktopUpdateState(st, silent) {
    desktopUpdateState = st || desktopUpdateState;
    const s = desktopUpdateState || {};
    const remBadge = document.getElementById('verRemoteStatusBadge');
    const detailEl = document.getElementById('verStatusDetailText');
    const applyBtn = document.getElementById('verApplyUpdateBtn');
    const btn = document.getElementById('verCheckUpdateBtn');
    const dotEl = document.getElementById('versionUpdateDot');
    const newVer = s.version || '';

    if (btn) {
        const busy = s.status === 'checking' || s.status === 'downloading' || s.status === 'available';
        btn.disabled = busy;
        btn.textContent = busy ? '⏳ Đang xử lý...' : '🔄 Kiểm tra bản mới';
    }
    if (dotEl) dotEl.classList.toggle('hidden', s.status !== 'downloaded');

    let badgeTxt = '';
    let detailTxt = '';
    if (s.status === 'checking') {
        badgeTxt = '⏳ Đang kiểm tra...';
        detailTxt = 'Đang kiểm tra bản mới trên máy chủ GitHub...';
    } else if (s.status === 'available' || s.status === 'downloading') {
        badgeTxt = '⬇ Đang tải v' + newVer + ' (' + Number(s.percent || 0) + '%)';
        detailTxt = 'Đang tự động tải bản mới v' + newVer + ' ngầm. Bạn cứ tiếp tục ghi chú bình thường.';
    } else if (s.status === 'downloaded') {
        badgeTxt = '🆕 Sẵn sàng cài v' + newVer;
        detailTxt = 'Đã tải xong bản v' + newVer + '. Bấm "Cài đặt & Khởi động lại" để cập nhật ngay (toàn bộ ghi chú được giữ nguyên), hoặc để app tự cài khi bạn tắt app.';
    } else if (s.status === 'not-available') {
        badgeTxt = '✓ Đã là mới nhất (v' + (s.currentVersion || '') + ')';
        detailTxt = 'Bạn đang dùng bản ChemNote Windows mới nhất.';
    } else if (s.status === 'error') {
        badgeTxt = 'Chưa kiểm tra được';
        detailTxt = 'Không kết nối được máy chủ cập nhật (đang offline?). App vẫn dùng bình thường; khi có mạng, bấm Kiểm tra lại.';
    }
    if (remBadge && badgeTxt) remBadge.textContent = badgeTxt;
    if (detailEl && detailTxt) detailEl.textContent = detailTxt;

    if (applyBtn) {
        if (s.status === 'downloaded') {
            applyBtn.classList.remove('hidden');
            applyBtn.disabled = false;
            applyBtn.textContent = '⬇ Cài đặt v' + newVer + ' & Khởi động lại';
            applyBtn.className = 'px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px] shadow-lg transition';
        } else {
            applyBtn.classList.add('hidden');
        }
    }

    if (s.status === 'downloaded') {
        const hubOpen = !document.getElementById('versionUpdateHubModal')?.classList.contains('hidden');
        if (!hubOpen && typeof showAutoUpdateBanner === 'function') {
            showAutoUpdateBanner({
                version: newVer,
                versionCode: 999999,
                title: 'ChemNote v' + newVer + ' đã tải xong',
                highlights: ['Bấm Cập nhật ngay để cài bản mới và khởi động lại app (ghi chú được giữ nguyên).']
            });
        }
        if (!silent && typeof showGestureToast === 'function') {
            showGestureToast('🆕 Bản v' + newVer + ' đã tải xong — bấm Cập nhật để cài!');
        }
    } else if (!silent && s.status === 'not-available' && typeof showGestureToast === 'function') {
        showGestureToast('✓ Bạn đang dùng bản mới nhất (v' + (s.currentVersion || '') + ')');
    }
}

function bindDesktopUpdateListener() {
    if (desktopUpdateListenerBound || !isDesktopAutoUpdateAvailable()) return;
    desktopUpdateListenerBound = true;
    if (typeof window.chemnoteDesktop.onUpdateStatus === 'function') {
        window.chemnoteDesktop.onUpdateStatus(st => renderDesktopUpdateState(st, true));
    }
    if (typeof window.chemnoteDesktop.getUpdateState === 'function') {
        window.chemnoteDesktop.getUpdateState().then(st => renderDesktopUpdateState(st, true)).catch(() => {});
    }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('load', () => { try { bindDesktopUpdateListener(); } catch (_) {} });
}

async function checkForAppUpdate(silent = false) {
    if (isDesktopAutoUpdateAvailable()) {
        bindDesktopUpdateListener();
        try {
            const st = await window.chemnoteDesktop.checkForUpdates();
            renderDesktopUpdateState(st, silent);
        } catch (_) {
            renderDesktopUpdateState({ status: 'error' }, silent);
        }
        return;
    }
    const remBadge = document.getElementById('verRemoteStatusBadge');
    const detailEl = document.getElementById('verStatusDetailText');
    const btn = document.getElementById('verCheckUpdateBtn');
    const curCode = (typeof APP_CURRENT_VERSION !== 'undefined' && APP_CURRENT_VERSION.versionCode) || 12;

    if (!silent && btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Đang kiểm tra...';
    }
    try {
        if (typeof location !== 'undefined' && location.protocol === 'file:') {
            throw new Error('offline-file');
        }
        const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data && typeof data.versionCode === 'number') {
            latestRemoteVersionInfo = data;
            if (typeof navigator !== 'undefined' && navigator.serviceWorker && typeof navigator.serviceWorker.getRegistration === 'function') {
                navigator.serviceWorker.getRegistration().then(reg => reg?.update?.()).catch(() => {});
            }
            const hasNewer = data.versionCode > curCode;
            lastAutoUpdateCheckAt = Date.now();
            renderVersionUpdateHubContent();
            if (hasNewer) {
                const hubOpen = !document.getElementById('versionUpdateHubModal')?.classList.contains('hidden');
                const alreadyDismissed = silent && dismissedUpdateVersionCode === data.versionCode;
                if (!hubOpen && !alreadyDismissed) {
                    showAutoUpdateBanner(data);
                }
                if (typeof showGestureToast === 'function') {
                    showGestureToast('🆕 Đã có bản mới v' + data.version + '! Bấm Cập nhật ngay trên thông báo.');
                }
            } else {
                dismissAutoUpdateBanner(false);
                if (!silent && typeof showGestureToast === 'function') {
                    showGestureToast('✓ Bạn đang dùng bản mới nhất (v' + (data.version || curCode) + ')');
                }
            }
        }
    } catch (err) {
        if (remBadge && !latestRemoteVersionInfo) {
            remBadge.textContent = 'Chế độ Offline / Cục bộ';
        }
        if (detailEl && !silent) {
            detailEl.textContent = 'Không kết nối được máy chủ kiểm tra (đang chạy ngoại tuyến hoặc bản cục bộ). Khi có mạng Wi-Fi, bấm Kiểm tra lại để nhận bản mới nhất.';
        }
        if (!silent && typeof showGestureToast === 'function') {
            showGestureToast('Chưa thể kiểm tra máy chủ (kiểm tra lại kết nối Wi-Fi)');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🔄 Kiểm tra bản mới';
        }
    }
}

async function applyLatestAppUpdate() {
    if (isDesktopAutoUpdateAvailable()) {
        if (typeof persistLibrary === 'function') persistLibrary(true);
        if (desktopUpdateState && desktopUpdateState.status === 'downloaded' && typeof window.chemnoteDesktop.installUpdateNow === 'function') {
            await window.chemnoteDesktop.installUpdateNow();
        } else {
            await checkForAppUpdate(false);
        }
        return;
    }
    const btn = document.getElementById('verApplyUpdateBtn');
    const bannerBtn = document.getElementById('autoUpdateBannerNowBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Đang cập nhật...';
    }
    if (bannerBtn) {
        bannerBtn.disabled = true;
        bannerBtn.textContent = '⏳ Đang tải bản mới...';
    }
    try {
        if (typeof persistLibrary === 'function') persistLibrary(true);
        if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
                try { await reg.update(); } catch (e) {}
                if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                if (reg.active) reg.active.postMessage({ type: 'CLEAR_CACHE_UPDATE' });
            }
        }
        if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
    } catch (e) {}
    if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
    }
}

/* ============================================================================
 * 2. NHẤN GIỮ ICON CÔNG CỤ HIỆN THẺ TÊN, CHỨC NĂNG & GIỚI THIỆU
 * ============================================================================ */
let toolLongPressTimer = null;
let toolLongPressMeta = null;
let suppressToolInfoClickEl = null;
let suppressToolInfoUntil = 0;
let toolInfoLongPressBound = false;

function hideToolInfoCard() {
    document.getElementById('toolInfoTooltipCard')?.classList.add('hidden');
}

function resolveToolInfoForElement(el) {
    if (!el) return null;
    const guideMap = (typeof TOOL_GUIDE_INFO !== 'undefined' && TOOL_GUIDE_INFO) ? TOOL_GUIDE_INFO : {};
    if (el.id && guideMap[el.id]) return guideMap[el.id];
    const toolId = el.getAttribute?.('data-tool-id') || '';
    if (toolId) {
        if (guideMap[toolId]) return guideMap[toolId];
        if (guideMap['cd-' + toolId]) return guideMap['cd-' + toolId];
        if (toolId.startsWith('pen_') && guideMap['sp-' + toolId.slice(4)]) return guideMap['sp-' + toolId.slice(4)];
        const catMeta = (typeof CUSTOM_PILL_TOOL_CATALOG !== 'undefined')
            ? CUSTOM_PILL_TOOL_CATALOG.find(item => item.id === toolId) : null;
        if (catMeta) {
            return {
                name: catMeta.title,
                role: `Nhóm: ${catMeta.cat}`,
                desc: `Công cụ ${catMeta.title} trên viên thuốc nổi dạy học.`,
                tip: 'Chạm 1 lần để kích hoạt ngay khi giảng bài.'
            };
        }
    }
    if (el.classList?.contains('chem-recent-btn')) {
        const lbl = (el.textContent || '').trim();
        if (lbl === '▾') {
            return {
                name: 'Kho Nhóm thế A → Z',
                role: 'Chọn, ghim & tìm hàng chục nhóm chức Hóa học',
                desc: 'Mở bảng tất cả nhóm thế hữu cơ/vô cơ để gắn nhanh lên đầu Carbon.',
                tip: 'Mẹo nhanh hơn: Chạm 2 lần trực tiếp vào đầu Carbon trên giấy để bật ô viết tay nhận diện tự động!'
            };
        }
        return {
            name: `Nhóm thế nhanh (${lbl})`,
            role: 'Chạm lên đầu Carbon hoặc nguyên tử để gắn nhóm này',
            desc: 'Thay thế nguyên tử Carbon thành nhóm thế đã chọn và tự động cân bằng số H theo hóa trị.',
            tip: 'Cũng có thể chạm 2 lần lên đầu Carbon để viết tay tên nhóm thế bất kỳ.'
        };
    }
    const rawTitle = (el.getAttribute?.('title') || '').trim();
    if (!rawTitle) return null;
    const parts = rawTitle.split(/\(([^)]+)\)/);
    return {
        name: (parts[0] || rawTitle).trim(),
        role: parts[1] ? parts[1].trim() : 'Công cụ ChemNote',
        desc: rawTitle,
        tip: 'Nhấn giữ các icon công cụ bất kỳ để xem nhanh chức năng.'
    };
}

function showToolInfoCard(anchorEl, info) {
    const card = document.getElementById('toolInfoTooltipCard');
    if (!card || !anchorEl || !info) return;
    document.getElementById('toolInfoName').textContent = info.name || 'Công cụ';
    document.getElementById('toolInfoRole').textContent = info.role || '';
    document.getElementById('toolInfoDesc').textContent = info.desc || '';
    const tipEl = document.getElementById('toolInfoTip');
    if (tipEl) {
        tipEl.textContent = info.tip ? `💡 ${info.tip}` : '';
        tipEl.classList.toggle('hidden', !info.tip);
    }
    card.style.visibility = 'hidden';
    card.classList.remove('hidden');
    const r = anchorEl.getBoundingClientRect();
    const cw = card.offsetWidth || 292;
    const ch = card.offsetHeight || 130;
    card.style.visibility = '';
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1200;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
    const left = Math.max(8, Math.min(vw - cw - 8, r.left + r.width / 2 - cw / 2));
    let top = r.bottom + 8;
    if (top + ch > vh - 10) {
        const above = r.top - ch - 8;
        top = above >= 10 ? above : Math.max(10, vh - ch - 10);
    }
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
}

function attachGlobalToolLongPressInfo() {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function' || toolInfoLongPressBound) return;
    toolInfoLongPressBound = true;
    const TOOL_SELECTOR = '.gn-main-tool, .gn-sub-pen, .cpill-tool-btn, .stroke-slot, .chem-recent-btn, .top-icon-btn';

    const cancelPending = () => {
        if (toolLongPressTimer) {
            clearTimeout(toolLongPressTimer);
            toolLongPressTimer = null;
        }
        toolLongPressMeta = null;
    };

    document.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
        const btn = e.target?.closest?.(TOOL_SELECTOR);
        cancelPending();
        if (!btn) return;
        const info = resolveToolInfoForElement(btn);
        if (!info) return;
        toolLongPressMeta = {
            btn,
            info,
            pointerId: e.pointerId,
            sx: e.clientX,
            sy: e.clientY
        };
        toolLongPressTimer = setTimeout(() => {
            const m = toolLongPressMeta;
            toolLongPressTimer = null;
            toolLongPressMeta = null;
            if (!m) return;
            suppressToolInfoClickEl = m.btn;
            suppressToolInfoUntil = Date.now() + 550;
            showToolInfoCard(m.btn, m.info);
        }, 420);
    }, true);

    document.addEventListener('pointermove', (e) => {
        if (!toolLongPressMeta) return;
        if (e.pointerId !== undefined && toolLongPressMeta.pointerId !== undefined && e.pointerId !== toolLongPressMeta.pointerId) return;
        if (Math.hypot(e.clientX - toolLongPressMeta.sx, e.clientY - toolLongPressMeta.sy) > 9) {
            cancelPending();
        }
    }, true);

    document.addEventListener('pointerup', cancelPending, true);
    document.addEventListener('pointercancel', cancelPending, true);

    document.addEventListener('click', (e) => {
        if (Date.now() <= suppressToolInfoUntil && suppressToolInfoClickEl &&
            (e.target === suppressToolInfoClickEl || suppressToolInfoClickEl.contains(e.target))) {
            e.preventDefault();
            e.stopPropagation();
            suppressToolInfoClickEl = null;
            suppressToolInfoUntil = 0;
        }
    }, true);
}

/* ============================================================================
 * 3. Ô VIẾT TAY NHẬN DIỆN NHÓM THẾ (KHI CHẠM 2 LẦN ĐẦU CARBON)
 * ============================================================================ */
let atomHwState = {
    open: false,
    atomId: null,
    stampWorldPos: null,
    catalogTab: 'all',
    manageMode: false,
    strokes: [],
    currentStroke: null,
    candidates: [],
    primaryLabel: '',
    drawingPointerId: null
};

const ATOM_HW_COMMON_GROUPS = ['OH', 'NH2', 'COOH', 'CHO', 'CH3', 'NO2', 'CN', 'Cl', 'Br', 'F', 'OMe', 'SH', 'Ph', 'O', 'C'];

const CHEM_HW_DICTIONARY = [
    'OH', 'O', 'NH2', 'NH', 'N', 'COOH', 'CHO', 'CH3', 'C2H5', 'CN', 'NO2',
    'SO3H', 'SH', 'S', 'Cl', 'Br', 'F', 'I', 'P', 'Ph', 'Me', 'Et', 'OMe',
    'OEt', 'OCH3', 'OAc', 'CF3', 'Bn', 'NMe2', 'PO4', 'H', 'C', 'R', 'X',
    'HO', 'CO2H', 'CH2OH', 'CONH2', 'NH3+', 'SO2H', 'CCl3'
];

// Normalized [0..10] strokes per prototype letter for resilient point-cloud matching
const CHEM_CHAR_TEMPLATES = {
    C: [
        [[[8,2],[5,0],[2,2],[1,5],[2,8],[5,10],[8,8]]],
        [[[8,8],[5,10],[2,8],[1,5],[2,2],[5,0],[8,2]]]
    ],
    O: [
        [[[5,0],[2,2],[1,5],[2,8],[5,10],[8,8],[9,5],[8,2],[5,0]]],
        [[[5,0],[8,2],[9,5],[8,8],[5,10],[2,8],[1,5],[2,2],[5,0]]]
    ],
    H: [
        [[[2,0],[2,10]], [[8,0],[8,10]], [[2,5],[8,5]]],
        [[[2,0],[2,10]], [[2,5],[8,5],[8,10]], [[8,0],[8,10]]],
        [[[2,0],[2,10]], [[2,5],[5,4],[8,5],[8,10]]],
        [[[2,0],[2,10],[2,5],[8,5],[8,0],[8,10]]]
    ],
    N: [
        [[[2,10],[2,0],[8,10],[8,0]]],
        [[[2,0],[2,10]], [[2,0],[8,10],[8,0]]],
        [[[2,0],[2,10]], [[2,0],[8,10]], [[8,0],[8,10]]]
    ],
    S: [
        [[[8,2],[5,0],[2,2],[3,4],[7,6],[8,8],[5,10],[2,8]]]
    ],
    P: [
        [[[2,0],[2,10]], [[2,0],[7,0],[9,2.5],[7,5],[2,5]]],
        [[[2,10],[2,0],[7,0],[9,2.5],[7,5],[2,5]]]
    ],
    F: [
        [[[2,0],[2,10]], [[2,0],[8,0]], [[2,5],[7,5]]],
        [[[8,0],[2,0],[2,10]], [[2,5],[7,5]]]
    ],
    I: [
        [[[5,0],[5,10]]],
        [[[2,0],[8,0]], [[5,0],[5,10]], [[2,10],[8,10]]]
    ],
    l: [
        [[[5,0],[5,10]]],
        [[[4,0],[4,9],[6,10]]]
    ],
    B: [
        [[[2,0],[2,10]], [[2,0],[7,1],[8,3],[6,5],[2,5],[7,6],[8,8],[6,10],[2,10]]],
        [[[2,0],[2,10],[6,10],[8,8],[6,5],[2,5],[7,4],[7,1],[2,0]]]
    ],
    r: [
        [[[2,3],[2,10]], [[2,5],[5,3],[8,4]]],
        [[[2,10],[2,3],[4,5],[7,3],[9,4]]]
    ],
    R: [
        [[[2,0],[2,10]], [[2,0],[7,1],[8,3],[6,5],[2,5],[8,10]]]
    ],
    M: [
        [[[1,10],[2,0],[5,6],[8,0],[9,10]]]
    ],
    E: [
        [[[8,0],[2,0],[2,10],[8,10]], [[2,5],[7,5]]],
        [[[2,0],[2,10]], [[2,0],[8,0]], [[2,5],[7,5]], [[2,10],[8,10]]]
    ],
    e: [
        [[[2,5],[8,5],[8,2],[5,1],[2,3],[2,8],[5,10],[8,9]]]
    ],
    t: [
        [[[5,0],[5,9],[8,10]], [[2,3],[8,3]]]
    ],
    X: [
        [[[1,1],[9,9]], [[9,1],[1,9]]]
    ],
    '2': [
        [[[2,2],[5,0],[8,2],[7,5],[2,10],[9,10]]]
    ],
    '3': [
        [[[2,1],[6,0],[8,2.5],[5,5],[8,7.5],[6,10],[2,9]]]
    ],
    '5': [
        [[[8,0],[2,0],[2,4],[7,5],[8,8],[5,10],[2,9]]]
    ],
    n: [
        [[[2,3],[2,10]], [[2,5],[5,3],[8,5],[8,10]]],
        [[[2,10],[2,3],[5,3],[8,5],[8,10]]]
    ]
};

function resamplePolylinePts(pts, count = 24) {
    if (!pts || !pts.length) return [];
    if (pts.length === 1) return Array.from({ length: count }, () => ({ x: pts[0].x, y: pts[0].y }));
    let totalLen = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
        totalLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        cum.push(totalLen);
    }
    if (totalLen < 1e-4) return Array.from({ length: count }, () => ({ x: pts[0].x, y: pts[0].y }));
    const res = [{ x: pts[0].x, y: pts[0].y }];
    let segIdx = 1;
    for (let k = 1; k < count - 1; k++) {
        const targetD = (k / (count - 1)) * totalLen;
        while (segIdx < cum.length - 1 && cum[segIdx] < targetD) segIdx++;
        const d0 = cum[segIdx - 1], d1 = cum[segIdx];
        const ratio = (d1 > d0) ? (targetD - d0) / (d1 - d0) : 0;
        const a = pts[segIdx - 1], b = pts[segIdx];
        res.push({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio });
    }
    res.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    return res;
}

function normalizeStrokesCloud(strokes) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    strokes.forEach(st => st.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }));
    const w = Math.max(4, maxX - minX);
    const h = Math.max(4, maxY - minY);
    const scale = Math.max(w, h);
    const ox = minX + w * 0.5;
    const oy = minY + h * 0.5;
    const cloud = [];
    const normStrokes = strokes.map(st => {
        const pts = st.map(p => ({ x: 0.5 + (p.x - ox) / scale, y: 0.5 + (p.y - oy) / scale }));
        const perCount = Math.max(8, Math.round(28 / Math.max(1, strokes.length)));
        const rs = resamplePolylinePts(pts, perCount);
        rs.forEach(q => cloud.push(q));
        return rs;
    });
    return { cloud, normStrokes, minX, maxX, minY, maxY, w, h, aspect: w / Math.max(8, h) };
}

function cloudSymmetricDistance(ptsA, ptsB) {
    if (!ptsA.length || !ptsB.length) return 999;
    const oneWay = (src, dst) => {
        let sum = 0;
        for (let i = 0; i < src.length; i++) {
            let best = Infinity;
            const a = src[i];
            for (let j = 0; j < dst.length; j++) {
                const d = (a.x - dst[j].x) * (a.x - dst[j].x) + (a.y - dst[j].y) * (a.y - dst[j].y);
                if (d < best) best = d;
            }
            sum += Math.sqrt(best);
        }
        return sum / src.length;
    };
    return (oneWay(ptsA, ptsB) + oneWay(ptsB, ptsA)) * 0.5;
}

function getClusterFeatures(clusterStrokes) {
    const norm = normalizeStrokesCloud(clusterStrokes);
    const diag = Math.hypot(norm.w, norm.h) || 1;
    let longest = clusterStrokes[0] || [];
    let hasHorizBar = false, hasVertStem = false, closedCount = 0;
    clusterStrokes.forEach(st => {
        if (st.length > longest.length) longest = st;
        let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
        st.forEach(p => {
            if (p.x < sx0) sx0 = p.x; if (p.x > sx1) sx1 = p.x;
            if (p.y < sy0) sy0 = p.y; if (p.y > sy1) sy1 = p.y;
        });
        const sw = sx1 - sx0, sh = sy1 - sy0;
        const sd = Math.hypot(sw, sh) || 1;
        if (sw > sh * 1.7 && sw > norm.w * 0.4) hasHorizBar = true;
        if (sh > sw * 1.8 && sh > norm.h * 0.55) hasVertStem = true;
        if (st.length >= 4 && Math.hypot(st[0].x - st[st.length - 1].x, st[0].y - st[st.length - 1].y) / sd < 0.36) {
            closedCount++;
        }
    });
    const endDist = longest.length >= 2
        ? Math.hypot(longest[0].x - longest[longest.length - 1].x, longest[0].y - longest[longest.length - 1].y) / diag
        : 1;
    let rightMidCount = 0, leftMidCount = 0;
    norm.cloud.forEach(p => {
        if (p.y >= 0.3 && p.y <= 0.7) {
            if (p.x > 0.68) rightMidCount++;
            if (p.x < 0.32) leftMidCount++;
        }
    });
    const rightOpenGap = leftMidCount >= 2 && rightMidCount === 0;
    return { ...norm, endDist, closedCount, hasHorizBar, hasVertStem, rightOpenGap, strokeCount: clusterStrokes.length };
}

function scoreClusterCharProbs(clusterStrokes) {
    const feat = getClusterFeatures(clusterStrokes);
    const scores = {};
    for (const ch of Object.keys(CHEM_CHAR_TEMPLATES)) {
        let bestDist = Infinity;
        CHEM_CHAR_TEMPLATES[ch].forEach(tplStrokes => {
            const tplNorm = normalizeStrokesCloud(tplStrokes.map(s => s.map(([x, y]) => ({ x: x * 10, y: y * 10 }))));
            const d = cloudSymmetricDistance(feat.cloud, tplNorm.cloud);
            if (d < bestDist) bestDist = d;
        });

        let adj = bestDist;
        // Domain-specific structural refinements
        if (ch === 'O') {
            if (feat.closedCount > 0 || feat.endDist < 0.34) adj -= 0.085;
            if (feat.rightOpenGap) adj += 0.14;
            if (feat.aspect < 0.42) adj += 0.14;
        } else if (ch === 'C') {
            if (feat.rightOpenGap) adj -= 0.095;
            if (feat.endDist < 0.32 && feat.strokeCount === 1) adj += 0.14;
            if (feat.hasHorizBar) adj += 0.12;
        } else if (ch === 'H') {
            if (feat.strokeCount >= 2 && feat.hasHorizBar && feat.hasVertStem) adj -= 0.12;
            if (feat.strokeCount === 1 && feat.aspect > 0.45) adj += 0.03;
            if (feat.aspect < 0.35) adj += 0.15;
        } else if (ch === 'I' || ch === 'l') {
            if (feat.aspect < 0.36 && feat.strokeCount === 1) adj -= 0.12;
            if (feat.aspect > 0.68 && feat.strokeCount === 1) adj += 0.15;
        } else if (ch === 'N') {
            if (feat.strokeCount <= 3 && !feat.rightOpenGap && feat.closedCount === 0) adj -= 0.03;
        } else if (ch === 'X') {
            if (feat.strokeCount === 2 && !feat.hasHorizBar) adj -= 0.05;
            else if (feat.strokeCount === 1) adj += 0.12;
        } else if (ch === 'F' || ch === 'E') {
            if (feat.hasHorizBar && feat.hasVertStem) adj -= 0.06;
        }
        scores[ch] = Math.max(0.01, Math.exp(-adj * 7.2));
    }
    return { feat, scores };
}

function segmentStrokesIntoClusters(strokes) {
    const boxes = strokes.map((st, idx) => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        st.forEach(p => {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        });
        return { idx, st, minX, maxX, minY, maxY, cx: (minX + maxX) * 0.5, w: maxX - minX, h: maxY - minY };
    });
    const parent = boxes.map((_, i) => i);
    const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const unite = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };

    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j];
            const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
            const minW = Math.max(6, Math.min(a.w, b.w));
            const maxH = Math.max(16, a.h, b.h);
            const horizBridge = Math.abs(a.cx - b.cx) < maxH * 0.34 && (a.w < 14 || b.w < 14);
            if (overlapX > -Math.min(4, minW * 0.1) && (overlapX / minW > 0.2 || horizBridge)) {
                unite(i, j);
            }
        }
    }
    const groupsMap = new Map();
    boxes.forEach((b, i) => {
        const r = find(i);
        if (!groupsMap.has(r)) groupsMap.set(r, []);
        groupsMap.get(r).push(b);
    });
    return Array.from(groupsMap.values())
        .map(items => {
            const minX = Math.min(...items.map(it => it.minX));
            const maxX = Math.max(...items.map(it => it.maxX));
            return { cx: (minX + maxX) * 0.5, strokes: items.map(it => it.st) };
        })
        .sort((a, b) => a.cx - b.cx);
}

function charScoreFromMap(probMap, ch) {
    if (!probMap) return 0.01;
    const direct = probMap[ch];
    if (typeof direct === 'number') return direct;
    const up = probMap[ch.toUpperCase()];
    const low = probMap[ch.toLowerCase()];
    const aliases = {
        h: Math.max(probMap.H || 0, probMap.n || 0),
        o: probMap.O || 0,
        c: probMap.C || 0,
        '0': probMap.O || 0,
        '1': Math.max(probMap.I || 0, probMap.l || 0),
        m: Math.max(probMap.M || 0, probMap.n || 0),
        a: probMap.e || probMap.O || 0.08
    };
    return Math.max(0.02, up || 0, low || 0, aliases[ch] || 0);
}

function recognizeChemStrokes(strokes) {
    if (!strokes || !strokes.length) return [];
    const clusters = segmentStrokesIntoClusters(strokes);
    if (!clusters.length) return [];

    const evaluated = clusters.map(cl => scoreClusterCharProbs(cl.strokes));
    const nC = evaluated.length;

    const results = new Map();
    const addScore = (label, val) => {
        const prev = results.get(label) || 0;
        if (val > prev) results.set(label, val);
    };

    if (nC === 1) {
        const { feat, scores } = evaluated[0];
        ['O', 'N', 'S', 'P', 'F', 'I', 'C', 'H', 'R', 'X'].forEach(ch => {
            if (CHEM_HW_DICTIONARY.includes(ch)) addScore(ch, (scores[ch] || 0) * 1.15);
        });
        // Cursive single-cluster whole-group fallbacks (e.g., wide cursive OH / Cl / CN)
        if (feat.aspect > 1.05) {
            addScore('OH', 0.42 + (scores.O || 0) * 0.32 + (scores.H || 0) * 0.25);
            addScore('Cl', 0.34 + (scores.C || 0) * 0.32);
            addScore('CN', 0.30 + (scores.C || 0) * 0.25 + (scores.N || 0) * 0.25);
            addScore('Br', 0.28 + (scores.B || 0) * 0.32);
            addScore('NO2', 0.22 + (scores.N || 0) * 0.25);
        }
    } else {
        CHEM_HW_DICTIONARY.forEach(word => {
            const lenDiff = Math.abs(word.length - nC);
            if (lenDiff > 2) return;
            if (word.length === nC) {
                let prod = 1;
                for (let i = 0; i < nC; i++) {
                    prod *= Math.pow(charScoreFromMap(evaluated[i].scores, word[i]), 1 / nC);
                }
                addScore(word, prod * 1.35);
            } else if (word.length > nC && nC >= 2) {
                // Handle joined letters (e.g., OH inside COOH written in 3 clusters -> C, OO, H)
                let sum = 0;
                for (let wi = 0; wi < word.length; wi++) {
                    const ci = Math.min(nC - 1, Math.floor((wi / word.length) * nC));
                    sum += charScoreFromMap(evaluated[ci].scores, word[wi]);
                }
                addScore(word, (sum / word.length) * (lenDiff === 1 ? 0.72 : 0.42));
            }
        });
    }

    // Add top common organic favorites softly only as backup after recognized candidates
    const ranked = Array.from(results.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([lbl]) => lbl)
        .filter(lbl => lbl && lbl !== 'HO');

    if (!ranked.includes('OH') && ranked.includes('O') && nC === 1) ranked.splice(1, 0, 'OH');
    if (ranked.length < 4) {
        for (const fallback of ['OH', 'COOH', 'NH2', 'CH3', 'Cl', 'Br']) {
            if (!ranked.includes(fallback)) ranked.push(fallback);
            if (ranked.length >= 5) break;
        }
    }
    return ranked.slice(0, 5);
}

function drawAtomHwCanvasStrokes() {
    const can = document.getElementById('atomHwCanvas');
    if (!can) return;
    const wrap = can.parentElement;
    const rect = wrap ? wrap.getBoundingClientRect() : { width: 280, height: 112 };
    const cw = Math.max(200, Math.round(rect.width || 280));
    const ch = Math.max(80, Math.round(rect.height || 112));
    const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    if (can.width !== Math.round(cw * dpr) || can.height !== Math.round(ch * dpr)) {
        can.width = Math.round(cw * dpr);
        can.height = Math.round(ch * dpr);
    }
    const c = can.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cw, ch);

    // Crisp notebook guide rule inside recognition box
    c.save();
    c.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    c.lineWidth = 1;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(10, ch * 0.72); c.lineTo(cw - 10, ch * 0.72);
    c.stroke();
    c.restore();

    const all = atomHwState.currentStroke ? [...atomHwState.strokes, atomHwState.currentStroke] : atomHwState.strokes;
    document.getElementById('atomHwPlaceholder')?.classList.toggle('hidden', all.length > 0);
    c.save();
    c.strokeStyle = '#0f172a';
    c.lineWidth = 3.2;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    all.forEach(pts => {
        if (!pts || !pts.length) return;
        c.beginPath();
        c.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 1) {
            c.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
        } else {
            for (let i = 1; i < pts.length - 1; i++) {
                const mx = (pts[i].x + pts[i + 1].x) * 0.5;
                const my = (pts[i].y + pts[i + 1].y) * 0.5;
                c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
            }
            c.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        }
        c.stroke();
    });
    c.restore();
}

function updateAtomHwCandidatesUI() {
    const row = document.getElementById('atomHwCandidatesRow');
    const applyBtn = document.getElementById('atomHwApplyPrimaryBtn');
    const cands = atomHwState.candidates || [];
    atomHwState.primaryLabel = cands[0] || '';
    if (applyBtn) {
        applyBtn.textContent = atomHwState.primaryLabel ? `✓ Gắn ${atomHwState.primaryLabel}` : '✓ Gắn';
        applyBtn.disabled = !atomHwState.primaryLabel;
    }
    if (!row) return;
    if (!cands.length) {
        row.innerHTML = '<span class="text-[10px] text-slate-400">Viết vào khung trắng ở trên...</span>';
        return;
    }
    const fmt = (s) => typeof formatChemSubHTML === 'function' ? formatChemSubHTML(s) : s;
    const escAttr = (s) => String(s || '').replace(/'/g, "\\'");
    row.innerHTML = cands.map((lbl, idx) => `
        <button onclick="applyRecognizedGroupToAtom('${escAttr(lbl)}')" class="atom-hw-cand-btn ${idx === 0 ? 'primary' : ''}">${fmt(lbl)}</button>
    `).join('');
}

function initAtomHwCanvasEvents() {
    const can = document.getElementById('atomHwCanvas');
    if (!can || can.dataset.hwBound) return;
    can.dataset.hwBound = '1';

    const localPt = (e) => {
        const r = can.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    can.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault(); e.stopPropagation();
        can.setPointerCapture?.(e.pointerId);
        atomHwState.drawingPointerId = e.pointerId;
        atomHwState.currentStroke = [localPt(e)];
        drawAtomHwCanvasStrokes();
    });
    can.addEventListener('pointermove', (e) => {
        if (!atomHwState.currentStroke || e.pointerId !== atomHwState.drawingPointerId) return;
        e.preventDefault(); e.stopPropagation();
        const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
        const list = (evs && evs.length) ? evs : [e];
        for (let i = 0; i < list.length; i++) {
            const p = localPt(list[i]);
            const prev = atomHwState.currentStroke[atomHwState.currentStroke.length - 1];
            if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) >= 1.5) {
                atomHwState.currentStroke.push(p);
            }
        }
        drawAtomHwCanvasStrokes();
    });
    const finishStroke = (e) => {
        if (!atomHwState.currentStroke || (e && e.pointerId !== atomHwState.drawingPointerId)) return;
        atomHwState.strokes.push(atomHwState.currentStroke);
        atomHwState.currentStroke = null;
        atomHwState.drawingPointerId = null;
        atomHwState.candidates = recognizeChemStrokes(atomHwState.strokes);
        drawAtomHwCanvasStrokes();
        updateAtomHwCandidatesUI();
    };
    can.addEventListener('pointerup', finishStroke);
    can.addEventListener('pointercancel', finishStroke);
    can.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    can.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
}

function setAtomHwCatalogTab(tab) {
    atomHwState.catalogTab = tab === 'fav' ? 'fav' : 'all';
    document.getElementById('atomHwTabFavBtn')?.classList.toggle('active', atomHwState.catalogTab === 'fav');
    document.getElementById('atomHwTabAllBtn')?.classList.toggle('active', atomHwState.catalogTab === 'all');
    renderAtomHwCatalogChips();
}

function toggleAtomHwManageMode() {
    atomHwState.manageMode = !atomHwState.manageMode;
    document.getElementById('atomHwManageBtn')?.classList.toggle('active', !!atomHwState.manageMode);
    renderAtomHwCatalogChips();
}

function toggleAtomHwFavGroup(lbl, ev) {
    if (ev) ev.stopPropagation();
    if (!Array.isArray(appLibrary.favouriteGroups)) appLibrary.favouriteGroups = [];
    const idx = appLibrary.favouriteGroups.indexOf(lbl);
    if (idx >= 0) appLibrary.favouriteGroups.splice(idx, 1);
    else appLibrary.favouriteGroups.unshift(lbl);
    persistLibrary();
    renderAtomHwCatalogChips();
}

function deleteAtomHwGroupItem(lbl, ev) {
    if (ev) ev.stopPropagation();
    if (!Array.isArray(appLibrary.deletedSubstituents)) appLibrary.deletedSubstituents = [];
    if (Array.isArray(appLibrary.customSubstituents)) {
        appLibrary.customSubstituents = appLibrary.customSubstituents.filter(x => x !== lbl);
    }
    if (!appLibrary.deletedSubstituents.includes(lbl)) {
        appLibrary.deletedSubstituents.push(lbl);
    }
    if (Array.isArray(appLibrary.favouriteGroups)) {
        appLibrary.favouriteGroups = appLibrary.favouriteGroups.filter(x => x !== lbl);
    }
    persistLibrary();
    renderAtomHwCatalogChips();
    if (typeof showGestureToast === 'function') showGestureToast(`Đã gỡ nhóm thế: ${lbl}`);
}

function saveCustomGroupFromHwInput() {
    const inp = document.getElementById('atomHwQuickInput');
    const val = (inp?.value || '').trim();
    if (!val) {
        if (typeof showGestureToast === 'function') showGestureToast('Nhập công thức nhóm thế rồi bấm + Lưu');
        return;
    }
    addCustomSubstituent(val);
    renderAtomHwCatalogChips();
}

function renderAtomHwCatalogChips() {
    const chipsEl = document.getElementById('atomHwQuickChips');
    if (!chipsEl) return;
    const fmt = (s) => typeof formatChemSubHTML === 'function' ? formatChemSubHTML(s) : s;
    const q = (document.getElementById('atomHwQuickInput')?.value || '').trim().toLowerCase();
    const favSet = new Set(typeof getFavouriteSubstituents === 'function' ? getFavouriteSubstituents() : []);
    const baseList = atomHwState.catalogTab === 'fav'
        ? (typeof getFavouriteSubstituents === 'function' ? getFavouriteSubstituents() : [])
        : (typeof getAvailableSubstituents === 'function' ? getAvailableSubstituents() : ATOM_HW_COMMON_GROUPS);

    // Ưu tiên nhóm phổ biến + nhóm Yêu thích lên đầu khi chưa tìm kiếm
    let ordered = [];
    if (!q && atomHwState.catalogTab === 'all') {
        const seen = new Set();
        [...favSet, ...ATOM_HW_COMMON_GROUPS.filter(g => g !== 'C'), ...baseList].forEach(g => {
            if (!g || g === 'C' || seen.has(g)) return;
            if (!baseList.includes(g)) return;
            seen.add(g);
            ordered.push(g);
        });
    } else {
        ordered = baseList.filter(g => !q || g.toLowerCase().includes(q));
    }

    if (!ordered.length) {
        chipsEl.innerHTML = `<div class="col-span-full text-[10.5px] text-slate-400 text-center py-2">${q ? 'Không có trong kho — bấm <b>Đặt</b> hoặc <b>+ Lưu</b> để dùng ngay!' : 'Chưa có nhóm ★ Yêu thích nào'}</div>`;
        return;
    }

    chipsEl.classList.toggle('sub-manage-on', !!atomHwState.manageMode);
    chipsEl.innerHTML = ordered.map(g => {
        const safeG = String(g).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const isFav = favSet.has(g);
        return `
            <div class="sub-chip-wrap">
                <button onclick="applyRecognizedGroupToAtom('${safeG}')" class="chip-btn text-[11px]" style="height:28px;padding:0 16px 0 6px;">${fmt(g)}</button>
                <button onclick="toggleAtomHwFavGroup('${safeG}', event)" class="sub-star-btn ${isFav ? 'fav' : ''}" title="${isFav ? 'Bỏ Yêu thích' : 'Thêm ★ Yêu thích'}">${isFav ? '★' : '☆'}</button>
                <button onclick="deleteAtomHwGroupItem('${safeG}', event)" class="sub-del-btn" title="Xóa khỏi kho">✕</button>
            </div>
        `;
    }).join('');
}

function openAtomHandwritingBox(atom, worldPosOpt = null, screenPtOpt = null) {
    if (!atom && !worldPosOpt) return;
    closeAllPopovers();
    const pop = document.getElementById('atomHandwritingPopover');
    if (!pop) return;
    atomHwState = {
        open: true,
        atomId: atom ? atom.id : null,
        stampWorldPos: (!atom && worldPosOpt) ? { x: worldPosOpt.x, y: worldPosOpt.y } : null,
        catalogTab: atomHwState.catalogTab === 'fav' ? 'fav' : 'all',
        manageMode: false,
        strokes: [],
        currentStroke: null,
        candidates: [],
        primaryLabel: '',
        drawingPointerId: null
    };
    const badge = document.getElementById('atomHwTargetBadge');
    if (badge) {
        badge.textContent = atom ? (atom.label || 'C') : 'Đặt trên giấy';
    }
    const resetCBtn = document.getElementById('atomHwResetCBtn');
    if (resetCBtn) resetCBtn.classList.toggle('hidden', !atom);
    document.getElementById('atomHwManageBtn')?.classList.remove('active');
    document.getElementById('atomHwPinBtn')?.classList.toggle('active', !!atomHwPinned);
    document.getElementById('atomHwTabFavBtn')?.classList.toggle('active', atomHwState.catalogTab === 'fav');
    document.getElementById('atomHwTabAllBtn')?.classList.toggle('active', atomHwState.catalogTab === 'all');

    const inp = document.getElementById('atomHwQuickInput');
    if (inp) inp.value = '';
    renderAtomHwCatalogChips();

    pop.style.visibility = 'hidden';
    pop.classList.remove('hidden');
    const pw = pop.offsetWidth || 358;
    const ph = pop.offsetHeight || 420;
    pop.style.visibility = '';

    const pageY = typeof getPageYOffset === 'function' ? getPageYOffset(getActiveNotebook().activePageIndex || 0) : 0;
    const rect = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : { left: 0, top: 0 };
    const anchorW = atom || worldPosOpt;
    const screenX = (screenPtOpt && Number.isFinite(screenPtOpt.x))
        ? screenPtOpt.x
        : ((rect.left || 0) + panX + anchorW.x * zoom);
    const screenY = (screenPtOpt && Number.isFinite(screenPtOpt.y))
        ? screenPtOpt.y
        : ((rect.top || 0) + panY + (pageY + anchorW.y) * zoom);
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1200;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;

    let left = screenX + 20;
    if (left + pw > vw - 10) left = screenX - pw - 20;
    left = Math.max(10, Math.min(vw - pw - 10, left));
    let top = screenY - ph * 0.35;
    top = Math.max(52, Math.min(vh - ph - 10, top));

    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;

    initAtomHwCanvasEvents();
    updateAtomHwCandidatesUI();
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => drawAtomHwCanvasStrokes());
    } else {
        drawAtomHwCanvasStrokes();
    }
}

function closeAtomHandwritingBox() {
    atomHwState.open = false;
    atomHwState.atomId = null;
    atomHwState.stampWorldPos = null;
    atomHwState.manageMode = false;
    document.getElementById('atomHandwritingPopover')?.classList.add('hidden');
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function' && (window.scrollY || window.scrollX)) {
        window.scrollTo(0, 0);
    }
}

function clearAtomHwCanvas() {
    atomHwState.strokes = [];
    atomHwState.currentStroke = null;
    atomHwState.candidates = [];
    drawAtomHwCanvasStrokes();
    updateAtomHwCandidatesUI();
}

function undoAtomHwStroke() {
    if (!atomHwState.strokes.length) return;
    atomHwState.strokes.pop();
    atomHwState.candidates = recognizeChemStrokes(atomHwState.strokes);
    drawAtomHwCanvasStrokes();
    updateAtomHwCandidatesUI();
}

function onAtomHwManualInput(val) {
    const clean = String(val || '').trim();
    if (!clean) {
        atomHwState.candidates = recognizeChemStrokes(atomHwState.strokes);
    } else {
        atomHwState.candidates = [clean, ...(recognizeChemStrokes(atomHwState.strokes).filter(x => x !== clean))].slice(0, 5);
    }
    updateAtomHwCandidatesUI();
    renderAtomHwCatalogChips();
}

function confirmManualAtomHwInput() {
    const val = (document.getElementById('atomHwQuickInput')?.value || '').trim();
    const target = val || atomHwState.primaryLabel;
    if (target) applyRecognizedGroupToAtom(target);
}

function confirmPrimaryAtomHw() {
    const val = (document.getElementById('atomHwQuickInput')?.value || '').trim();
    const target = atomHwState.primaryLabel || val;
    if (target) applyRecognizedGroupToAtom(target);
}

function applyRecognizedGroupToAtom(label) {
    const doc = typeof getDocState === 'function' ? getDocState() : null;
    if (!doc || !label) {
        closeAtomHandwritingBox();
        return;
    }
    const atom = atomHwState.atomId ? (doc.atoms || []).find(a => a.id === atomHwState.atomId) : null;
    const stampPos = atomHwState.stampWorldPos;
    if (!atom && !stampPos) {
        closeAtomHandwritingBox();
        return;
    }
    if (atom && typeof smartAttachOrReplaceGroupOnAtom === 'function') {
        const res = smartAttachOrReplaceGroupOnAtom(atom, label, doc, null);
        if (!res || !res.ok) {
            if (res && res.reason === 'already_c') closeAtomHandwritingBox();
            return;
        }
        if (label !== 'C') {
            activeGroupLabel = label === '=O' ? 'O' : label;
            if (typeof recentGroups !== 'undefined' && Array.isArray(recentGroups)) {
                recentGroups = [activeGroupLabel, ...recentGroups.filter(x => x !== activeGroupLabel)].slice(0, 6);
            }
        }
        if (typeof ensureAutoNextPageIfNeeded === 'function') ensureAutoNextPageIfNeeded(res.maxY);
        if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
        if (!atomHwPinned) closeAtomHandwritingBox();
        else if (atom) { const bEl = document.getElementById('atomHwTargetBadge'); if (bEl) bEl.textContent = atom.label || 'C'; }
        persistLibrary(true);
        renderAll();
        if (typeof showGestureToast === 'function') {
            if (res.mode === 'reset') showGestureToast('Đã đưa về nguyên tử Carbon (C)');
            else if (res.mode === 'sprout') showGestureToast('✨ Đã gắn nhánh -' + res.label);
            else showGestureToast('✨ Đã gắn nhóm thế -' + res.label);
        }
        return;
    }
    saveHistorySnapshot();
    const cleanStamp = (label === '=O' || label === 'O=') ? 'O' : label;
    if (atom) {
        atom.label = cleanStamp;
        atom.color = penColor;
    } else if (stampPos) {
        if (!Array.isArray(doc.atoms)) doc.atoms = [];
        const safePt = typeof clampWorldPointToPaper === 'function' ? clampWorldPointToPaper(stampPos, 8) : stampPos;
        doc.atoms.push({ id: genId('a'), x: safePt.x, y: safePt.y, label: cleanStamp, color: penColor });
    }
    if (cleanStamp !== 'C') {
        activeGroupLabel = cleanStamp;
        if (typeof recentGroups !== 'undefined' && Array.isArray(recentGroups)) {
            recentGroups = [cleanStamp, ...recentGroups.filter(x => x !== cleanStamp)].slice(0, 6);
        }
    }
    if (typeof enforceAllValenceAndHydrogens === 'function') enforceAllValenceAndHydrogens(doc);
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    closeAtomHandwritingBox();
    persistLibrary(true);
    renderAll();
    if (typeof showGestureToast === 'function') {
        showGestureToast('✨ Đã đặt nhóm ' + cleanStamp + ' lên trang giấy');
    }
}

/* ============================================================================
 * 4. HỘP GÓP Ý TÍNH NĂNG & BÁO LỖI BETA (NETLIFY FORMS AJAX + ẢNH <= 8MB)
 * ============================================================================ */
const FEEDBACK_HISTORY_STORAGE_KEY = 'CHEMNOTE_FEEDBACK_HISTORY_V1';

function buildFeedbackDeviceSummary() {
    const ver = (typeof APP_CURRENT_VERSION !== 'undefined' && APP_CURRENT_VERSION?.version) || '13.0';
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    const touchPts = (typeof navigator !== 'undefined' && navigator.maxTouchPoints) ? navigator.maxTouchPoints : 0;
    let os = 'Desktop';
    if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && touchPts > 1)) os = 'iPadOS';
    else if (/iPhone/i.test(ua)) os = 'iOS';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh/i.test(ua)) os = 'macOS';
    else if (/Android/i.test(ua)) os = 'Android';

    let browser = 'Browser';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

    const w = (typeof window !== 'undefined' && window.innerWidth) || 0;
    const h = (typeof window !== 'undefined' && window.innerHeight) || 0;
    const isStandalone = typeof window !== 'undefined' && (
        window.navigator?.standalone === true ||
        (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)')?.matches)
    );
    return `v${ver} | ${os} (${browser}${isStandalone ? ' PWA' : ''}) ${w}x${h}`;
}

function selectFeedbackCategory(cat) {
    const sel = document.getElementById('fbCategorySelect');
    if (sel) sel.value = cat || 'bug';
    syncFeedbackCategoryPills();
}

function syncFeedbackCategoryPills() {
    const cur = document.getElementById('fbCategorySelect')?.value || 'bug';
    document.querySelectorAll('#feedbackCategoryPills .fb-cat-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-fb-cat') === cur);
    });
}

function onFeedbackFileChange(inputEl) {
    const lbl = document.getElementById('fbFileStatusLabel');
    const clrBtn = document.getElementById('fbClearFileBtn');
    const file = inputEl?.files?.[0] || null;
    if (!file) {
        if (lbl) lbl.textContent = 'Chưa chọn ảnh minh họa nào.';
        if (clrBtn) clrBtn.classList.add('hidden');
        return;
    }
    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
        inputEl.value = '';
        if (lbl) lbl.textContent = `⚠️ Ảnh "${file.name}" vượt quá 8 MB — vui lòng chọn ảnh nhẹ hơn.`;
        if (clrBtn) clrBtn.classList.add('hidden');
        return;
    }
    const kb = Math.max(1, Math.round(file.size / 1024));
    if (lbl) lbl.textContent = `✓ Đã đính kèm: ${file.name} (${kb} KB)`;
    if (clrBtn) clrBtn.classList.remove('hidden');
}

function clearFeedbackScreenshot() {
    const inputEl = document.getElementById('fbScreenshotInput');
    if (inputEl) inputEl.value = '';
    onFeedbackFileChange(inputEl);
}

function showFeedbackStatusBanner(msg, type = 'info') {
    const el = document.getElementById('fbSubmitStatusBanner');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    if (type === 'success') {
        el.className = 'p-2.5 rounded-xl text-[11px] font-bold bg-emerald-500/20 border border-emerald-400/50 text-emerald-300';
    } else if (type === 'error') {
        el.className = 'p-2.5 rounded-xl text-[11px] font-bold bg-rose-500/20 border border-rose-400/50 text-rose-300';
    } else {
        el.className = 'p-2.5 rounded-xl text-[11px] font-bold bg-sky-500/15 border border-sky-400/40 text-sky-300';
    }
}

function loadFeedbackRecentHistory() {
    try {
        const raw = localStorage.getItem(FEEDBACK_HISTORY_STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (_) {
        return [];
    }
}

function saveFeedbackToHistory(entry) {
    try {
        const list = loadFeedbackRecentHistory();
        list.unshift(entry);
        localStorage.setItem(FEEDBACK_HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, 8)));
    } catch (_) {}
}

function renderFeedbackRecentHistory() {
    const wrap = document.getElementById('fbRecentHistoryWrap');
    const listEl = document.getElementById('fbRecentHistoryList');
    if (!wrap || !listEl) return;
    const list = loadFeedbackRecentHistory();
    wrap.classList.toggle('hidden', !list.length);
    if (!list.length) {
        listEl.innerHTML = '';
        return;
    }
    const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const catMap = { bug: '🐛 Lỗi', feature: '💡 Tính năng', ui_touch: '✍️ Bút/UI' };
    listEl.innerHTML = list.slice(0, 5).map(item => `
        <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black/15 border border-black/15 text-[10.5px]">
            <div class="flex items-center gap-1.5 min-w-0">
                <span class="shrink-0 font-bold" style="color:var(--accent);">${esc(catMap[item.category] || '💬')}</span>
                <span class="truncate font-semibold" style="color:var(--text-main);">${esc(item.title)}</span>
            </div>
            <span class="shrink-0 text-[10px]" style="color:var(--text-muted);">${esc(item.time)}</span>
        </div>
    `).join('');
}

function openFeedbackHubModal(defaultCategory) {
    closeAllPopovers();
    const modal = document.getElementById('feedbackHubModal');
    if (!modal) return;
    if (defaultCategory) selectFeedbackCategory(defaultCategory);
    else syncFeedbackCategoryPills();

    const verEl = document.getElementById('fbAppVersionInput');
    if (verEl) verEl.value = (typeof APP_CURRENT_VERSION !== 'undefined' && APP_CURRENT_VERSION?.version) || '13.0';
    const devEl = document.getElementById('fbDeviceInfoInput');
    if (devEl) devEl.value = buildFeedbackDeviceSummary();

    const banner = document.getElementById('fbSubmitStatusBanner');
    if (banner) banner.classList.add('hidden');
    renderFeedbackRecentHistory();
    modal.classList.remove('hidden');
}

function closeFeedbackHubModal() {
    document.getElementById('feedbackHubModal')?.classList.add('hidden');
}

async function submitFeedbackForm(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    const form = document.getElementById('feedbackHubForm');
    if (!form) return false;

    const titleEl = document.getElementById('fbTitleInput');
    const msgEl = document.getElementById('fbMessageTextarea');
    const fileInput = document.getElementById('fbScreenshotInput');
    const btn = document.getElementById('fbSubmitBtn');

    const title = (titleEl?.value || '').trim();
    const message = (msgEl?.value || '').trim();
    if (!title || !message) {
        showFeedbackStatusBanner('Vui lòng nhập đầy đủ Tiêu đề và Mô tả chi tiết trước khi gửi.', 'error');
        return false;
    }

    const file = fileInput?.files?.[0] || null;
    if (file && file.size > 8 * 1024 * 1024) {
        showFeedbackStatusBanner('Ảnh đính kèm vượt quá giới hạn 8 MB của máy chủ.', 'error');
        return false;
    }

    if (typeof location !== 'undefined' && location.protocol === 'file:') {
        showFeedbackStatusBanner('Đang mở file cục bộ (file://): Hãy mở trên web chemnotev15.netlify.app để gửi góp ý qua mạng.', 'error');
        return false;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        showFeedbackStatusBanner('Thiết bị đang ngoại tuyến (Offline). Vui lòng kết nối mạng rồi bấm Gửi lại.', 'error');
        return false;
    }

    const devEl = document.getElementById('fbDeviceInfoInput');
    if (devEl && !devEl.value) devEl.value = buildFeedbackDeviceSummary();
    const verEl = document.getElementById('fbAppVersionInput');
    if (verEl) verEl.value = (typeof APP_CURRENT_VERSION !== 'undefined' && APP_CURRENT_VERSION?.version) || '13.0';

    const origBtnText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Đang gửi...';
    }
    showFeedbackStatusBanner('Đang gửi phản hồi về máy chủ...', 'info');

    try {
        let resp;
        if (file) {
            const fd = new FormData(form);
            fd.set('form-name', 'chemnote-feedback');
            resp = await fetch('/', { method: 'POST', body: fd });
        } else {
            const params = new URLSearchParams();
            const rawFd = new FormData(form);
            for (const [k, v] of rawFd.entries()) {
                if (typeof File !== 'undefined' && v instanceof File) continue;
                if (v && typeof v === 'object' && 'size' in v && 'name' in v) continue;
                params.append(k, String(v ?? ''));
            }
            if (!params.get('form-name')) params.set('form-name', 'chemnote-feedback');
            resp = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            });
        }
        if (!resp || !resp.ok) {
            throw new Error(`HTTP ${resp ? resp.status : 'error'}`);
        }
        const cat = document.getElementById('fbCategorySelect')?.value || 'bug';
        const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        saveFeedbackToHistory({ title, category: cat, time: nowStr });
        renderFeedbackRecentHistory();

        if (titleEl) titleEl.value = '';
        if (msgEl) msgEl.value = '';
        clearFeedbackScreenshot();
        showFeedbackStatusBanner('✓ Đã gửi góp ý thành công! Cảm ơn bạn đã chung tay hoàn thiện ChemNote.', 'success');
        if (typeof showGestureToast === 'function') showGestureToast('✓ Đã gửi góp ý về tác giả!');
    } catch (err) {
        showFeedbackStatusBanner('Không thể gửi lúc này (mạng chập chờn hoặc chưa bật Form Detection trên Netlify). Vui lòng thử lại sau!', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = origBtnText || '📨 Gửi Góp Ý Ngay';
        }
    }
    return false;
}

/* ============================================================================
 * 5. NHẬP ĐỀ BÀI BẰNG MÃ LATEX (HÓA \ce{...} & TOÁN HỌC) TRONG NGĂN ĐỀ BÀI
 * ============================================================================ */
const LATEX_SUB_MAP = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋','a':'ₐ','e':'ₑ','o':'ₒ','x':'ₓ','n':'ₙ','m':'ₘ','i':'ᵢ','j':'ⱼ','k':'ₖ' };
const LATEX_SUP_MAP = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','n':'ⁿ','i':'ⁱ','o':'°' };

function toUnicodeSub(str) {
    return String(str || '').split('').map(ch => LATEX_SUB_MAP[ch] || ch).join('');
}
function toUnicodeSup(str) {
    return String(str || '').split('').map(ch => LATEX_SUP_MAP[ch] || ch).join('');
}

function convertChemLatexToUnicode(ceBody) {
    let s = String(ceBody || '').trim();
    s = s.replace(/<=>\[([^\]]*)\]\[([^\]]*)\]/g, (_, a, b) => ` ⇌(${a || b}) `);
    s = s.replace(/<=>\[([^\]]*)\]/g, (_, a) => ` ⇌(${a}) `);
    s = s.replace(/<=>/g, ' ⇌ ');
    s = s.replace(/->\[([^\]]*)\]/g, (_, cond) => ` —[${cond.replace(/\\circ|\^\\circ/g, '°')}]→ `);
    s = s.replace(/->/g, ' → ');
    s = s.replace(/<-/g, ' ← ');
    s = s.replace(/\s+\^\s*/g, '↑ ');
    s = s.replace(/\s+v(?=\s|$|[+,;.)])/g, '↓');
    s = s.replace(/\s*\*\s*/g, '·');
    s = s.replace(/\^\{([^}]+)\}/g, (_, g) => toUnicodeSup(g.replace(/\\circ/g, '°')));
    s = s.replace(/_\{([^}]+)\}/g, (_, g) => toUnicodeSub(g));
    s = s.replace(/\^(\d*[+-])/g, (_, g) => toUnicodeSup(g));
    s = s.replace(/([A-Za-z\)\]])(\d+)/g, (_, p, d) => p + toUnicodeSub(d));
    return s.replace(/\s{2,}/g, ' ').trim();
}

function convertLatexToPlainUnicode(rawText) {
    let s = String(rawText || '');
    s = s.replace(/\\ce\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, body) => convertChemLatexToUnicode(body));
    s = s.replace(/\\xrightarrow(?:\[[^\]]*\])?\{([^}]*)\}/g, (_, top) => ` —[${convertLatexToPlainUnicode(top)}]→ `);
    s = s.replace(/\\xleftarrow(?:\[[^\]]*\])?\{([^}]*)\}/g, (_, top) => ` ←[${convertLatexToPlainUnicode(top)}]— `);
    for (let pass = 0; pass < 3; pass++) {
        s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, a, b) => `(${a})/(${b})`);
        s = s.replace(/\\sqrt\{([^{}]+)\}/g, (_, a) => `√(${a})`);
        s = s.replace(/\\(?:text|mathrm|mathbf|textbf)\{([^{}]+)\}/g, '$1');
    }
    const symMap = [
        [/\\rightleftharpoons/g, ' ⇌ '], [/\\leftrightarrow/g, ' ↔ '],
        [/\\rightarrow|\\to(?![a-zA-Z])/g, ' → '], [/\\leftarrow/g, ' ← '],
        [/\\uparrow/g, '↑'], [/\\downarrow/g, '↓'],
        [/\\Delta/g, 'Δ'], [/\\alpha/g, 'α'], [/\\beta/g, 'β'], [/\\gamma/g, 'γ'],
        [/\\pi/g, 'π'], [/\\lambda/g, 'λ'], [/\\mu/g, 'μ'], [/\\sigma/g, 'σ'], [/\\omega/g, 'ω'],
        [/\\times/g, ' × '], [/\\cdot/g, '·'], [/\\pm/g, '±'],
        [/\\leq|\\le(?![a-zA-Z])/g, ' ≤ '], [/\\geq|\\ge(?![a-zA-Z])/g, ' ≥ '],
        [/\\neq|\\ne(?![a-zA-Z])/g, ' ≠ '], [/\\approx/g, ' ≈ '], [/\\equiv/g, ' ≡ '],
        [/\\infty/g, '∞'], [/\\sum/g, '∑'], [/\\int/g, '∫'],
        [/\^\\circ|\\circ|\\degree/g, '°'], [/\\,/g, ' '], [/\\;/g, ' '], [/\\\\/g, '\n']
    ];
    symMap.forEach(([re, rep]) => { s = s.replace(re, rep); });
    s = s.replace(/\$\$/g, '').replace(/\$/g, '').replace(/\\\(|\\\)|\\\[|\\\]/g, '');
    s = s.replace(/\_\{([^}]+)\}/g, (_, g) => toUnicodeSub(g));
    s = s.replace(/\^\{([^}]+)\}/g, (_, g) => toUnicodeSup(g));
    s = s.replace(/_([A-Za-z0-9])/g, (_, ch) => toUnicodeSub(ch));
    s = s.replace(/\^([0-9+-])/g, (_, ch) => toUnicodeSup(ch));
    return s.replace(/[ \t]{2,}/g, ' ').trim();
}

function toggleExamLatexPanel(force) {
    const panel = document.getElementById('examLatexPanel');
    const btn = document.getElementById('examLatexToggleBtn');
    if (!panel) return;
    const nextShow = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !nextShow);
    if (btn) btn.classList.toggle('active', nextShow);
    if (nextShow) {
        renderExamLatexLivePreview();
        try { document.getElementById('examLatexInput')?.focus?.(); } catch (_) {}
    }
}

function insertExamLatexSnippet(prefix, suffix = '') {
    const ta = document.getElementById('examLatexInput');
    if (!ta) return;
    const val = ta.value || '';
    const start = typeof ta.selectionStart === 'number' ? ta.selectionStart : val.length;
    const end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : val.length;
    const sel = val.slice(start, end);
    ta.value = val.slice(0, start) + prefix + sel + suffix + val.slice(end);
    const nextPos = start + prefix.length + sel.length;
    try {
        ta.focus();
        ta.setSelectionRange(nextPos, nextPos);
    } catch (_) {}
    renderExamLatexLivePreview();
}

function renderExamLatexLivePreview() {
    const ta = document.getElementById('examLatexInput');
    const box = document.getElementById('examLatexPreviewBox');
    if (!ta || !box) return;
    const raw = (ta.value || '').trim();
    if (!raw) {
        box.textContent = 'Nhập mã LaTeX ở trên để xem trước...';
        return;
    }
    const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    if (typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function') {
        const parts = raw.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g);
        box.innerHTML = parts.map(part => {
            if (!part) return '';
            if (part.startsWith('$$') && part.endsWith('$$')) {
                return window.katex.renderToString(part.slice(2, -2), { displayMode: true, throwOnError: false });
            }
            if (part.startsWith('$') && part.endsWith('$')) {
                return window.katex.renderToString(part.slice(1, -1), { displayMode: false, throwOnError: false });
            }
            if (part.startsWith('\\ce{')) {
                return window.katex.renderToString(part, { displayMode: false, throwOnError: false });
            }
            return esc(part).replace(/\n/g, '<br>');
        }).join('');
        return;
    }
    const readable = convertLatexToPlainUnicode(raw);
    box.innerHTML = esc(readable).replace(/\n/g, '<br>');
}

function renderLatexCardToDataUrl(rawText) {
    const cleanText = convertLatexToPlainUnicode(rawText);
    if (!cleanText) return null;

    const cardW = 640;
    const padX = 24;
    const padY = 20;
    const lineH = 28;
    const maxTextW = cardW - padX * 2;
    const dpr = 2.5;

    const measureCanvas = typeof document.createElement === 'function' ? document.createElement('canvas') : null;
    const mCtx = measureCanvas && typeof measureCanvas.getContext === 'function' ? measureCanvas.getContext('2d') : null;
    if (mCtx) mCtx.font = '600 18px Inter, -apple-system, BlinkMacSystemFont, sans-serif';

    const paragraphs = cleanText.split(/\n+/);
    const wrappedLines = [];
    paragraphs.forEach(para => {
        const words = para.split(/\s+/).filter(Boolean);
        if (!words.length) { wrappedLines.push(''); return; }
        let line = words[0];
        for (let i = 1; i < words.length; i++) {
            const test = line + ' ' + words[i];
            const w = mCtx && typeof mCtx.measureText === 'function' ? mCtx.measureText(test).width : (test.length * 10);
            if (w <= maxTextW) line = test;
            else { wrappedLines.push(line); line = words[i]; }
        }
        wrappedLines.push(line);
    });

    const cardH = Math.max(92, padY * 2 + wrappedLines.length * lineH + 10);
    let dataUrl = '';
    if (measureCanvas && mCtx && typeof measureCanvas.toDataURL === 'function') {
        measureCanvas.width = Math.round(cardW * dpr);
        measureCanvas.height = Math.round(cardH * dpr);
        mCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        mCtx.fillStyle = '#fffef9';
        mCtx.fillRect(0, 0, cardW, cardH);
        mCtx.fillStyle = '#0284c7';
        mCtx.fillRect(0, 0, 5, cardH);
        mCtx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        mCtx.lineWidth = 1.5;
        mCtx.strokeRect(1, 1, cardW - 2, cardH - 2);
        mCtx.fillStyle = '#0f172a';
        mCtx.font = '600 18px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
        mCtx.textBaseline = 'top';
        wrappedLines.forEach((ln, idx) => {
            mCtx.fillText(ln, padX, padY + idx * lineH);
        });
        dataUrl = measureCanvas.toDataURL('image/png');
    }
    if (!dataUrl || dataUrl.length < 30) {
        dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}"><rect width="100%" height="100%" fill="#fffef9"/></svg>`);
    }
    return { dataUrl, width: cardW, height: cardH, plainText: cleanText };
}

function addExamLatexAsSheet() {
    const raw = (document.getElementById('examLatexInput')?.value || '').trim();
    if (!raw) {
        if (typeof showGestureToast === 'function') showGestureToast('Hãy nhập hoặc dán mã LaTeX trước!');
        return false;
    }
    const card = renderLatexCardToDataUrl(raw);
    if (!card) return false;
    const title = card.plainText.slice(0, 26) + (card.plainText.length > 26 ? '…' : '');
    addExamSheetFromDataUrl(card.dataUrl, `LaTeX: ${title}`, card.width, card.height, { fileType: 'TEXT', rawText: card.plainText });
    toggleExamLatexPanel(false);
    if (typeof showGestureToast === 'function') showGestureToast('✓ Đã lưu đề LaTeX vào Ngăn Đề Bài!');
    return true;
}

function pasteExamLatexToPage(autoCollapse = true, lockImmediately = false) {
    const raw = (document.getElementById('examLatexInput')?.value || '').trim();
    if (!raw) {
        if (typeof showGestureToast === 'function') showGestureToast('Hãy nhập hoặc dán mã LaTeX trước!');
        return false;
    }
    const card = renderLatexCardToDataUrl(raw);
    if (!card) return false;
    if (typeof isReadMode !== 'undefined' && isReadMode) toggleReadMode(false);
    insertDataUrlImageToPage(card.dataUrl, card.width, card.height, { fromExam: true, locked: !!lockImmediately });
    if (autoCollapse) {
        toggleExamLatexPanel(false);
        toggleExamDrawer(false);
    }
    if (typeof showGestureToast === 'function') {
        showGestureToast(lockImmediately
            ? '🔒 Đã dán & cố định đề LaTeX lên trang vở!'
            : '📌 Đã dán đề LaTeX lên trang vở!');
    }
    return true;
}

/* ============================================================================
 * 6. BỘ DỤNG CỤ THÍ NGHIỆM HÓA HỌC (16 MẪU VECTOR & MÀU DUNG DỊCH)
 * ============================================================================ */
function renderLabEquipmentGrid() {
    const liqRow = document.getElementById('labLiquidColorRow');
    if (liqRow && typeof LAB_LIQUID_COLORS !== 'undefined') {
        liqRow.innerHTML = LAB_LIQUID_COLORS.map(lc => {
            const isAct = (activeLabLiquidColor || '#38bdf8') === lc.hex;
            const bg = lc.hex === 'none' ? 'transparent' : lc.hex;
            return `<button onclick="pickLabLiquidColor('${lc.hex}')" class="w-4 h-4 rounded-full border ${isAct ? 'ring-2 ring-sky-400 scale-110' : 'border-slate-500'}" style="background:${bg};" title="${lc.title}">${lc.hex === 'none' ? '<span style="font-size:9px;line-height:1;color:#94a3b8;">∅</span>' : ''}</button>`;
        }).join('');
    }
    const grid = document.getElementById('labEquipmentGrid');
    if (!grid || typeof LAB_EQUIPMENT_CATALOG === 'undefined') return;
    grid.innerHTML = LAB_EQUIPMENT_CATALOG.map(lb => `
        <button onclick="pickLabEquipment('${lb.id}')" title="${lb.title}" class="icon-only-chip flex-col gap-0.5 py-1.5 ${activeLabItemType === lb.id ? 'active' : ''}" style="height:auto;">
            ${wrapSvgIcon(lb.svg)}
            <span class="text-[9.5px] font-bold leading-tight truncate w-full px-0.5 text-center">${lb.title}</span>
        </button>
    `).join('');
}

function openLabFromSettings(ev) {
    ev?.stopPropagation?.();
    const anchor = document.getElementById('appSettingsHubBtn') || document.getElementById('navyToolbarConfigBtn');
    handleLabHubClick({ currentTarget: anchor, stopPropagation() {} });
}

function handleLabHubClick(ev) {
    ev?.stopPropagation?.();
    if (typeof hideToolInfoCard === 'function') hideToolInfoCard();
    const pop = document.getElementById('labEquipmentPopover');
    if (!pop) return;
    const hide = !pop.classList.contains('hidden');
    closeAllPopovers();
    selectChemDrawTool('chem_lab');
    if (!hide) {
        try { renderLabEquipmentGrid(); } catch (_) {}
        const rawAnchor = ev && ev.currentTarget && typeof ev.currentTarget.getBoundingClientRect === 'function'
            ? ev.currentTarget
            : null;
        const r = rawAnchor ? rawAnchor.getBoundingClientRect() : { width: 0, height: 0 };
        const anchor = (r.width > 0 || r.height > 0) ? rawAnchor : document.getElementById('appSettingsHubBtn');
        positionPopoverUnderButton(pop, anchor);
        pop.style.zIndex = '245';
        pop.classList.remove('hidden');
    }
}

function pickLabEquipment(id) {
    activeLabItemType = id;
    renderLabEquipmentGrid();
    closeAllPopovers();
    selectChemDrawTool('chem_lab');
}

function pickLabLiquidColor(hex) {
    activeLabLiquidColor = hex;
    renderLabEquipmentGrid();
}

/* ============================================================================
 * 7. PHÒNG THÍ NGHIỆM ẢO THCS–THPT & MÔ PHỎNG TRỰC TIẾP TRÊN GIẤY TRẮNG
 * ============================================================================ */
let miniLabAnimRaf = null;

function createMiniLabState(expId = 'titration') {
    return {
        exp: expId || 'titration',
        paperLight: false,
        // 1. Titration state
        acidType: 'HCl',      // 'HCl' | 'H2SO4' | 'CH3COOH' | 'NaOH'
        acidVolMl: 20.0,
        acidConcM: 0.10,
        baseConcM: 0.10,
        indicator: 'phenol',  // 'phenol' | 'methyl' | 'litmus' | 'btb' | 'universal'
        titrationStep: 0,     // 0..5
        addedBaseMl: 0.0,
        dropAnimY: -1,
        // 2. Precipitate state
        precipPair: 'CuSO4_NaOH',
        precipStep: 0,        // 0..3 (or 0..4 for Ca(OH)2 + CO2 excess)
        // 3. Gas & Metal reactivity
        gasMetal: 'Zn',       // 'Zn' | 'Fe' | 'Al' | 'Na' | 'Cu'
        gasMassG: 0.65,
        gasStep: 0,           // 0..3
        // 4. Rutherford Gold Foil Alpha Scattering
        alphaTarget: 'Au',    // 'Au' (Z=79) | 'Al' (Z=13)
        alphaAuto: true,
        alphaStats: { total: 0, straight: 0, deflected: 0, back: 0 },
        // 5. Flame color test
        flameIon: 'Na',       // 'Li' | 'Na' | 'K' | 'Ca' | 'Ba' | 'Cu'
        flameStep: 0,         // 0: pick, 1: burner on, 2: insert wire
        // 6. Silver Mirror (Tollens)
        silverSub: 'glucose', // 'glucose' | 'hcho' | 'sucrose'
        silverStep: 0,        // 0..3
        // 7. Electrolysis
        elecSol: 'CuSO4',     // 'CuSO4' | 'NaCl'
        elecOn: false,
        elecProgress: 0.0
    };
}

function createMiniLabAnim() {
    return {
        lastTs: 0,
        stirAngle: 0,
        dispFill: 0.08,
        dispRgba: [224, 242, 254, 0.25],
        stopcockAmt: 0,
        autoDrip: false,
        autoAccum: 0,
        washPulse: 0,
        indicatorPulse: 0,
        swirlFlash: 0,
        drops: [],
        ripples: [],
        precipParticles: [],
        gasBubbles: [],
        tubeBubbles: [],
        naX: 0, naDir: 1, naTrail: 0,
        alphaParticles: [],   // { x, y, vx, vy, deflected, back, trail:[], done }
        alphaFlashes: [],     // { ang, alpha, isBack }
        alphaEmitAccum: 0,
        flameFlicker: 0,
        silverTemp: 25,
        silverCoating: 0,
        elecBubL: [],
        elecBubR: []
    };
}

let miniLabState = createMiniLabState('titration');
const miniLabAnim = createMiniLabAnim();
const paperLabAnims = new Map();
let paperLabDragState = null;

function getEffectiveTitrationConcFactor(st) {
    return st.acidType === 'H2SO4' ? 2.0 : 1.0;
}

function computeMiniLabTitrationPH(st = miniLabState) {
    const Va = st.acidVolMl;
    const Ca = st.acidType === 'H2SO4' ? 0.05 : st.acidConcM;
    const eqFactor = getEffectiveTitrationConcFactor(st);
    const Vb = st.addedBaseMl;
    const Cb = st.baseConcM;
    const Vsolv = st.titrationStep >= 2 ? 20.0 : 0.0;
    const Vtot = Math.max(1, Va + Vsolv + Vb);
    const nSample = Va * Ca * eqFactor;
    const nBuret = Vb * Cb;

    // Reverse titration: Base (NaOH) in flask titrated by HCl from burette
    if (st.acidType === 'NaOH') {
        if (Math.abs(nSample - nBuret) < 1e-6) return 7.0;
        if (nSample > nBuret) {
            const cOH = (nSample - nBuret) / Vtot;
            return Math.min(13.7, Math.max(7.01, 14 + Math.log10(cOH)));
        }
        const cH = (nBuret - nSample) / Vtot;
        return Math.max(0.3, Math.min(6.99, -Math.log10(cH)));
    }

    if (st.acidType === 'HCl' || st.acidType === 'H2SO4') {
        if (Math.abs(nSample - nBuret) < 1e-6) return 7.0;
        if (nSample > nBuret) {
            const cH = (nSample - nBuret) / Vtot;
            return Math.max(0.3, Math.min(6.99, -Math.log10(cH)));
        }
        const cOH = (nBuret - nSample) / Vtot;
        return Math.min(13.7, Math.max(7.01, 14 + Math.log10(cOH)));
    }

    // Weak acid CH3COOH (pKa = 4.76)
    const pKa = 4.76;
    const Ka = Math.pow(10, -pKa);
    if (Vb <= 0.001) {
        const c0 = nSample / Vtot;
        return Math.max(1.5, -Math.log10(Math.sqrt(Ka * c0)));
    }
    if (nBuret < nSample - 1e-5) {
        const ratio = Math.max(0.01, nBuret / (nSample - nBuret));
        return pKa + Math.log10(ratio);
    }
    if (Math.abs(nBuret - nSample) <= 1e-5) {
        const cSalt = nSample / Vtot;
        const Kb = 1e-14 / Ka;
        return 14 + Math.log10(Math.sqrt(Kb * cSalt));
    }
    const cOH = (nBuret - nSample) / Vtot;
    return Math.min(13.7, 14 + Math.log10(cOH));
}

function computeMiniLabPHAtVolume(vbMl, st = miniLabState) {
    const prev = st.addedBaseMl;
    st.addedBaseMl = vbMl;
    const ph = computeMiniLabTitrationPH(st);
    st.addedBaseMl = prev;
    return ph;
}

function getTitrationEquivVolumeMl(st = miniLabState) {
    const Ca = st.acidType === 'H2SO4' ? 0.05 : st.acidConcM;
    const eqFactor = getEffectiveTitrationConcFactor(st);
    return Math.round(((st.acidVolMl * Ca * eqFactor) / st.baseConcM) * 100) / 100;
}

function getMiniLabTitrationColor(ph, st = miniLabState) {
    if (st.titrationStep < 4) return 'rgba(224, 242, 254, 0.34)';
    const ind = st.indicator;
    if (ind === 'phenol') {
        if (ph < 8.1) return 'rgba(224, 242, 254, 0.36)';
        if (ph < 9.5) return 'rgba(244, 114, 182, 0.45)';
        return 'rgba(236, 72, 153, 0.78)';
    }
    if (ind === 'methyl') {
        if (ph < 3.1) return 'rgba(239, 68, 68, 0.68)';
        if (ph <= 4.4) return 'rgba(249, 115, 22, 0.65)';
        return 'rgba(234, 179, 8, 0.62)';
    }
    if (ind === 'litmus') {
        if (ph < 5.0) return 'rgba(239, 68, 68, 0.72)';
        if (ph <= 8.0) return 'rgba(168, 85, 247, 0.68)';
        return 'rgba(37, 99, 235, 0.74)';
    }
    if (ind === 'btb') {
        if (ph < 6.0) return 'rgba(250, 204, 21, 0.72)';
        if (ph <= 7.6) return 'rgba(16, 185, 129, 0.68)';
        return 'rgba(37, 99, 235, 0.75)';
    }
    // Universal pH indicator
    if (ph < 3.0) return 'rgba(239, 68, 68, 0.74)';
    if (ph < 5.0) return 'rgba(249, 115, 22, 0.72)';
    if (ph < 6.3) return 'rgba(250, 204, 21, 0.72)';
    if (ph <= 7.7) return 'rgba(34, 197, 94, 0.72)';
    if (ph < 9.5) return 'rgba(6, 182, 212, 0.72)';
    if (ph < 11.5) return 'rgba(59, 130, 246, 0.76)';
    return 'rgba(147, 51, 234, 0.80)';
}

function parseRgbaArray(str) {
    const m = String(str || '').match(/[\d.]+/g);
    if (!m || m.length < 3) return [224, 242, 254, 0.36];
    return [Number(m[0]), Number(m[1]), Number(m[2]), m[3] !== undefined ? Number(m[3]) : 1];
}

function formatRgba(arr, alphaMult = 1) {
    return `rgba(${Math.round(arr[0])}, ${Math.round(arr[1])}, ${Math.round(arr[2])}, ${Math.max(0, Math.min(1, arr[3] * alphaMult)).toFixed(3)})`;
}

function safeRadialGrad(c, x0, y0, r0, x1, y1, r1) {
    if (typeof c.createRadialGradient === 'function') {
        return c.createRadialGradient(x0, y0, r0, x1, y1, r1);
    }
    return c.createLinearGradient(x0, y0 - r1, x0, y0 + r1);
}

const PRECIP_PAIRS_META = {
    CuSO4_NaOH:  { title: 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄', ion: 'Cu²⁺ + 2OH⁻ → Cu(OH)₂↓', reagent: 'NaOH 1M', saltCol: 'rgba(56, 189, 248, 0.42)', pptCol: '#2563eb', pptHi: '#60a5fa', formula: 'Cu(OH)₂↓ (Xanh lam keo)', desc: 'Kết tủa keo màu xanh lam đặc trưng lắng xuống đáy ống nghiệm.' },
    FeCl3_NaOH:  { title: 'FeCl₃ + 3NaOH → Fe(OH)₃↓ + 3NaCl', ion: 'Fe³⁺ + 3OH⁻ → Fe(OH)₃↓', reagent: 'NaOH 1M', saltCol: 'rgba(245, 158, 11, 0.35)', pptCol: '#9a3412', pptHi: '#c2410c', formula: 'Fe(OH)₃↓ (Nâu đỏ)', desc: 'Dung dịch Fe³⁺ vàng cam chuyển thành kết tủa nâu đỏ Fe(OH)₃ không tan.' },
    FeSO4_NaOH:  { title: 'FeSO₄ + 2NaOH → Fe(OH)₂↓ + Na₂SO₄', ion: 'Fe²⁺ + 2OH⁻ → Fe(OH)₂↓', reagent: 'NaOH 1M', saltCol: 'rgba(134, 239, 172, 0.30)', pptCol: '#a7f3d0', pptHi: '#9a3412', formula: 'Fe(OH)₂↓ (Trắng xanh→Nâu)', desc: 'Kết tủa trắng xanh Fe(OH)₂ nhanh chóng hóa nâu đỏ trên bề mặt do oxi hóa thành Fe(OH)₃.' },
    BaCl2_H2SO4: { title: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl', ion: 'Ba²⁺ + SO₄²⁻ → BaSO₄↓', reagent: 'H₂SO₄ 1M', saltCol: 'rgba(224, 242, 254, 0.36)', pptCol: '#e2e8f0', pptHi: '#ffffff', formula: 'BaSO₄↓ (Trắng mịn)', desc: 'Kết tủa trắng mịn BaSO₄ rất bền, không tan trong acid mạnh.' },
    AgNO3_NaCl:  { title: 'AgNO₃ + NaCl → AgCl↓ + NaNO₃', ion: 'Ag⁺ + Cl⁻ → AgCl↓', reagent: 'NaCl 0.5M', saltCol: 'rgba(224, 242, 254, 0.36)', pptCol: '#cbd5e1', pptHi: '#ffffff', formula: 'AgCl↓ (Trắng bông)', desc: 'Kết tủa trắng dạng keo bông AgCl xuất hiện tức thì để nhận biết ion Cl⁻.' },
    AgNO3_KI:    { title: 'AgNO₃ + KI → AgI↓ + KNO₃', ion: 'Ag⁺ + I⁻ → AgI↓', reagent: 'KI 0.5M', saltCol: 'rgba(224, 242, 254, 0.34)', pptCol: '#eab308', pptHi: '#fef08a', formula: 'AgI↓ (Vàng đậm)', desc: 'Kết tủa màu vàng đậm AgI đặc trưng giúp phân biệt I⁻ với Br⁻ và Cl⁻.' },
    PbNO3_KI:    { title: 'Pb(NO₃)₂ + 2KI → PbI₂↓ + 2KNO₃', ion: 'Pb²⁺ + 2I⁻ → PbI₂↓', reagent: 'KI 0.5M', saltCol: 'rgba(224, 242, 254, 0.34)', pptCol: '#f59e0b', pptHi: '#fef08a', formula: 'PbI₂↓ (Cơn mưa vàng)', desc: 'Hiện tượng "Cơn mưa vàng": các tinh thể PbI₂ vàng rực óng ánh lơ lửng rồi lắng xuống!' },
    CaOH2_CO2:   { title: 'Ca(OH)₂ + CO₂ → CaCO₃↓ + H₂O', ion: 'Ca²⁺ + CO₃²⁻ → CaCO₃↓', reagent: 'Khí CO₂', saltCol: 'rgba(224, 242, 254, 0.34)', pptCol: '#f1f5f9', pptHi: '#ffffff', formula: 'CaCO₃↓ (Tan khi dư CO₂)', desc: 'Sục CO₂ làm nước vôi trong đục trắng (CaCO₃↓); tiếp tục sục dư CO₂ kết tủa tan tạo Ca(HCO₃)₂!' }
};

const GAS_REACTIONS_META = {
    Zn: { label: 'Zn + HCl', title: 'Zn + 2HCl → ZnCl₂ + H₂↑', M: 65, nFactor: 1.0, rate: 1.0, solCol: 'rgba(224, 242, 254, 0.36)', gasName: 'H₂↑', desc: 'Kẽm tan dần, bọt khí không màu H₂ thoát đều qua ống dẫn.' },
    Fe: { label: 'Fe + HCl', title: 'Fe + 2HCl → FeCl₂ + H₂↑', M: 56, nFactor: 1.0, rate: 0.78, solCol: 'rgba(134, 239, 172, 0.38)', gasName: 'H₂↑', desc: 'Sắt tan tạo dung dịch muối FeCl₂ màu xanh lục nhạt và giải phóng khí H₂.' },
    Al: { label: 'Al + HCl', title: '2Al + 6HCl → 2AlCl₃ + 3H₂↑', M: 27, nFactor: 1.5, rate: 1.45, solCol: 'rgba(224, 242, 254, 0.38)', gasName: 'H₂↑', desc: 'Nhôm phản ứng rất mạnh với acid HCl, sủi bọt khí H₂ dồi dào (1.5 mol H₂/mol Al).' },
    Na: { label: 'Na + H₂O(PP)', title: '2Na + 2H₂O → 2NaOH + H₂↑', M: 23, nFactor: 0.5, rate: 1.65, solCol: 'rgba(236, 72, 153, 0.48)', gasName: 'H₂↑', desc: 'Viên Natri nóng chảy thành giọt tròn chạy trên mặt nước, sủi H₂ và làm Phenolphtalein hóa hồng!' },
    Cu: { label: 'Cu + HNO₃ đặc', title: 'Cu + 4HNO₃(đ) → Cu(NO₃)₂ + 2NO₂↑ + 2H₂O', M: 64, nFactor: 2.0, rate: 1.15, solCol: 'rgba(37, 99, 235, 0.58)', gasName: 'NO₂↑', desc: 'Đồng tan nhanh cho dung dịch xanh lam Cu(NO₃)₂ và giải phóng khí NO₂ màu nâu đỏ!' }
};

const FLAME_IONS_META = {
    Li: { sym: 'Li⁺ (LiCl)', flame: '#f43f5e', core: '#ffe4e6', name: 'Đỏ son (671 nm)', lines: [{ x: 0.86, col: '#ef4444', nm: '671' }, { x: 0.64, col: '#fb923c', nm: '610' }] },
    Na: { sym: 'Na⁺ (NaCl)', flame: '#facc15', core: '#fef9c3', name: 'Vàng rực (589 nm)', lines: [{ x: 0.59, col: '#facc15', nm: '589' }] },
    K:  { sym: 'K⁺ (KCl)', flame: '#c084fc', core: '#f3e8ff', name: 'Tím hoa cà (404 nm)', lines: [{ x: 0.08, col: '#a855f7', nm: '404' }, { x: 0.94, col: '#ef4444', nm: '766' }] },
    Ca: { sym: 'Ca²⁺ (CaCl₂)', flame: '#fb923c', core: '#ffedd5', name: 'Đỏ cam (622 nm)', lines: [{ x: 0.72, col: '#f97316', nm: '622' }, { x: 0.47, col: '#22c55e', nm: '553' }] },
    Ba: { sym: 'Ba²⁺ (BaCl₂)', flame: '#a3e635', core: '#ecfccb', name: 'Xanh lục vàng (524 nm)', lines: [{ x: 0.39, col: '#84cc16', nm: '524' }, { x: 0.48, col: '#a3e635', nm: '554' }] },
    Cu: { sym: 'Cu²⁺ (CuCl₂)', flame: '#10b981', core: '#d1fae5', name: 'Xanh lục lam (510 nm)', lines: [{ x: 0.34, col: '#10b981', nm: '510' }, { x: 0.42, col: '#06b6d4', nm: '532' }] }
};

function initPrecipParticles(anim = miniLabAnim, resetFull = true) {
    if (resetFull) anim.precipParticles = [];
    for (let i = 0; i < 68; i++) {
        anim.precipParticles.push({
            x: (Math.random() - 0.5) * 34,
            y: 202 + Math.random() * 65,
            vx: (Math.random() - 0.5) * 8,
            vy: 14 + Math.random() * 24,
            size: 1.8 + Math.random() * 2.8,
            settled: false,
            phase: Math.random() * Math.PI * 2
        });
    }
}

function spawnAlphaParticle(st, anim) {
    const zWeight = st.alphaTarget === 'Au' ? 1.0 : 0.28;
    const roll = Math.random();
    let mode = 'straight';
    if (roll < 0.045 * zWeight + 0.01) mode = 'back';
    else if (roll < 0.16 * zWeight + 0.04) mode = 'deflected';

    let angOut = (Math.random() - 0.5) * 0.05;
    if (mode === 'deflected') {
        const sign = Math.random() > 0.5 ? 1 : -1;
        angOut = sign * (0.28 + Math.random() * 1.15);
    } else if (mode === 'back') {
        const sign = Math.random() > 0.5 ? 1 : -1;
        angOut = sign * (2.05 + Math.random() * 0.92);
    }
    const yOff = (Math.random() - 0.5) * 14;
    anim.alphaParticles.push({
        x: 108,
        y: 196 + yOff,
        vx: 255,
        vy: 0,
        passedFoil: false,
        mode,
        angOut,
        trail: []
    });
}

function fireRutherfordBurst(count = 50, st = miniLabState, anim = miniLabAnim) {
    for (let i = 0; i < Math.min(25, count); i++) {
        if (typeof setTimeout === 'function') {
            setTimeout(() => {
                if (st.exp === 'rutherford') spawnAlphaParticle(st, anim);
            }, i * 18);
        } else {
            if (st.exp === 'rutherford') spawnAlphaParticle(st, anim);
        }
    }
}

function getOrCreateWidgetAnim(wId) {
    if (!paperLabAnims.has(wId)) paperLabAnims.set(wId, createMiniLabAnim());
    return paperLabAnims.get(wId);
}

let miniLabVisibilityHooked = false;
function ensureLabAnimLoopRunning() {
    if (miniLabAnimRaf !== null || typeof requestAnimationFrame !== 'function') return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const hasWidgets = () => typeof getDocState === 'function' && Array.isArray(getDocState().labWidgets) && getDocState().labWidgets.length > 0;
    const isModalOpen = () => {
        const m = document.getElementById('miniChemLabModal');
        return m && !m.classList.contains('hidden');
    };
    if (!isModalOpen() && !hasWidgets()) return;

    if (!miniLabVisibilityHooked && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        miniLabVisibilityHooked = true;
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) ensureLabAnimLoopRunning();
        });
    }

    let lastTs = 0;
    let lastDrawTs = 0;
    const tick = (ts) => {
        if (typeof document !== 'undefined' && document.hidden) {
            miniLabAnimRaf = null;
            return;
        }
        const modalOn = isModalOpen();
        const doc = typeof getDocState === 'function' ? getDocState() : null;
        const widgets = doc && Array.isArray(doc.labWidgets) ? doc.labWidgets : [];
        if (!modalOn && widgets.length === 0) {
            miniLabAnimRaf = null;
            return;
        }
        // Tiết kiệm pin 75% trên iPad 120Hz: MiniLab gắn trên giấy chạy 30fps êm ái; khi mở Modal chạy 60fps
        const minInterval = modalOn ? 16 : 33;
        if (lastDrawTs && (ts - lastDrawTs) < minInterval) {
            miniLabAnimRaf = requestAnimationFrame(tick);
            return;
        }
        const dt = lastTs ? Math.min(0.06, (ts - lastTs) / 1000) : 0.033;
        lastTs = ts;
        lastDrawTs = ts;
        if (modalOn) {
            stepLabSimulation(miniLabState, miniLabAnim, dt, () => renderMiniLabUI());
            renderMiniLabStage();
        }
        for (const lw of widgets) {
            const wAnim = getOrCreateWidgetAnim(lw.id);
            stepLabSimulation(lw.state, wAnim, dt, () => updateSinglePaperWidgetUI(lw.id));
            const can = document.getElementById('paperLabCan_' + lw.id);
            if (can) {
                renderLabStageOnCanvas(can, lw.state, wAnim, !lw.darkStage);
            }
        }
        if ((typeof audienceWindow !== 'undefined' && audienceWindow && !audienceWindow.closed) ||
            (typeof isCleanRecording !== 'undefined' && isCleanRecording)) {
            if (typeof syncAudienceAndRecordingFrames === 'function') syncAudienceAndRecordingFrames();
        }
        miniLabAnimRaf = requestAnimationFrame(tick);
    };
    miniLabAnimRaf = requestAnimationFrame(tick);
}

function stopMiniLabAnimLoop() {
    miniLabAnim.autoDrip = false;
    const doc = typeof getDocState === 'function' ? getDocState() : null;
    if (!doc || !Array.isArray(doc.labWidgets) || doc.labWidgets.length === 0) {
        if (miniLabAnimRaf !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(miniLabAnimRaf);
        }
        miniLabAnimRaf = null;
    }
}

function stepMiniLabAnimation(dt) {
    stepLabSimulation(miniLabState, miniLabAnim, dt, () => renderMiniLabUI());
}

function stepLabSimulation(st, anim, dt, onUiSync) {
    anim.stirAngle = (anim.stirAngle + dt * 9.5) % (Math.PI * 2);
    if (anim.washPulse > 0) anim.washPulse = Math.max(0, anim.washPulse - dt * 0.48);
    if (anim.indicatorPulse > 0) anim.indicatorPulse = Math.max(0, anim.indicatorPulse - dt * 0.55);
    if (anim.swirlFlash > 0) anim.swirlFlash = Math.max(0, anim.swirlFlash - dt * 1.15);
    if (anim.stopcockAmt > 0 && !anim.autoDrip) anim.stopcockAmt = Math.max(0, anim.stopcockAmt - dt * 2.2);

    if (st.exp === 'titration') {
        if (anim.autoDrip) {
            const vEq = getTitrationEquivVolumeMl(st);
            const nearEq = Math.abs(vEq - st.addedBaseMl) <= 1.2;
            const rate = nearEq ? 0.35 : 1.4;
            anim.stopcockAmt = 1;
            anim.autoAccum += dt * rate;
            if (anim.autoAccum >= 0.05) {
                const chunks = Math.floor(anim.autoAccum / 0.05);
                const delta = Math.min(0.25, chunks * 0.05);
                anim.autoAccum -= chunks * 0.05;
                st.titrationStep = 5;
                st.addedBaseMl = Math.min(40.0, Math.round((st.addedBaseMl + delta) * 100) / 100);
                anim.drops.push({ y: 185, speed: 150, color: 'rgba(186,230,253,0.92)' });
                if (typeof onUiSync === 'function') onUiSync();
                if (st.addedBaseMl >= vEq + 0.20 || st.addedBaseMl >= 40.0) {
                    anim.autoDrip = false;
                    if (typeof onUiSync === 'function') onUiSync();
                }
            }
        }
        const sStep = st.titrationStep;
        const tgtFill = sStep === 0 ? 0.0 : sStep === 1 ? 0.34 : Math.min(0.84, 0.52 + st.addedBaseMl / 78);
        anim.dispFill += (tgtFill - anim.dispFill) * Math.min(1, dt * 8.5);
        const tgtRgba = parseRgbaArray(getMiniLabTitrationColor(computeMiniLabTitrationPH(st), st));
        for (let i = 0; i < 4; i++) anim.dispRgba[i] += (tgtRgba[i] - anim.dispRgba[i]) * Math.min(1, dt * 7.5);
        const liqSurfaceY = 302 - anim.dispFill * 70;
        const nextDrops = [];
        for (const d of anim.drops) {
            d.speed += dt * 420;
            d.y += d.speed * dt;
            if (d.y >= liqSurfaceY) {
                anim.ripples.push({ r: 2, alpha: 0.9 });
                if (st.titrationStep >= 4) {
                    const vEq = getTitrationEquivVolumeMl(st);
                    anim.swirlFlash = st.addedBaseMl > vEq * 0.78 ? 1.0 : 0.65;
                }
            } else {
                nextDrops.push(d);
            }
        }
        anim.drops = nextDrops;
        anim.ripples = anim.ripples.filter(rp => {
            rp.r += dt * 36;
            rp.alpha -= dt * 1.9;
            return rp.alpha > 0.03;
        });
    } else if (st.exp === 'precipitate') {
        if (st.precipStep >= 3 && !(st.precipPair === 'CaOH2_CO2' && st.precipStep >= 4)) {
            if (anim.precipParticles.length === 0) initPrecipParticles(anim, true);
            for (const p of anim.precipParticles) {
                if (!p.settled) {
                    p.y += p.vy * dt;
                    p.x += Math.sin(anim.stirAngle * 0.4 + p.phase) * 9 * dt;
                    p.x = Math.max(-20, Math.min(20, p.x));
                    const floorY = 316 - Math.sqrt(Math.max(0, 500 - p.x * p.x)) * 0.45;
                    if (p.y >= floorY) {
                        p.y = floorY - Math.random() * 8;
                        p.settled = true;
                    }
                }
            }
        }
    } else if (st.exp === 'gas' && st.gasStep >= 3) {
        const gMeta = GAS_REACTIONS_META[st.gasMetal] || GAS_REACTIONS_META.Zn;
        if (st.gasMetal === 'Na') {
            anim.naX += anim.naDir * 68 * dt;
            if (anim.naX > 52) { anim.naX = 52; anim.naDir = -1; }
            if (anim.naX < -52) { anim.naX = -52; anim.naDir = 1; }
            anim.naTrail = Math.min(1, anim.naTrail + dt * 0.22);
        }
        const spawnProb = dt * 20 * gMeta.rate;
        if (anim.gasBubbles.length < 32 && Math.random() < spawnProb) {
            anim.gasBubbles.push({
                x: (Math.random() - 0.5) * 26,
                y: 298 - Math.random() * 6,
                r: 1.5 + Math.random() * 2.8,
                vy: (42 + Math.random() * 38) * gMeta.rate,
                phase: Math.random() * 6.28
            });
        }
        anim.gasBubbles = anim.gasBubbles.filter(b => {
            b.y -= b.vy * dt;
            b.x += Math.sin(b.phase + b.y * 0.09) * 14 * dt;
            return b.y > 205;
        });
        if (anim.tubeBubbles.length < 14 && Math.random() < dt * 8 * gMeta.rate) {
            anim.tubeBubbles.push({ t: 0, r: 2.0 + Math.random() * 1.8 });
        }
        anim.tubeBubbles = anim.tubeBubbles.filter(tb => {
            tb.t += dt * 0.58;
            return tb.t < 1;
        });
    } else if (st.exp === 'rutherford') {
        const foilX = 290, foilY = 196, ringR = 122;
        if (st.alphaAuto) {
            anim.alphaEmitAccum += dt * 11;
            if (anim.alphaEmitAccum >= 1) {
                anim.alphaEmitAccum -= 1;
                if (anim.alphaParticles.length < 48) spawnAlphaParticle(st, anim);
            }
        }
        let statsChanged = false;
        const nextA = [];
        for (const ap of anim.alphaParticles) {
            ap.trail.push({ x: ap.x, y: ap.y });
            if (ap.trail.length > 14) ap.trail.shift();
            ap.x += ap.vx * dt;
            ap.y += ap.vy * dt;
            if (!ap.passedFoil && ap.x >= foilX) {
                ap.passedFoil = true;
                ap.x = foilX;
                const spd = 260;
                ap.vx = Math.cos(ap.angOut) * spd;
                ap.vy = Math.sin(ap.angOut) * spd;
                st.alphaStats.total++;
                if (ap.mode === 'back') st.alphaStats.back++;
                else if (ap.mode === 'deflected') st.alphaStats.deflected++;
                else st.alphaStats.straight++;
                statsChanged = true;
            }
            const dx = ap.x - foilX, dy = ap.y - foilY;
            if (dx * dx + dy * dy >= ringR * ringR) {
                anim.alphaFlashes.push({ ang: Math.atan2(dy, dx), alpha: 1.0, isBack: ap.mode === 'back' });
            } else if (ap.x > 60 && ap.x < 460 && ap.y > 40 && ap.y < 340) {
                nextA.push(ap);
            }
        }
        anim.alphaParticles = nextA;
        anim.alphaFlashes = anim.alphaFlashes.filter(fl => {
            fl.alpha -= dt * 1.1;
            return fl.alpha > 0.04;
        });
        if (statsChanged && typeof onUiSync === 'function') onUiSync();
    } else if (st.exp === 'flame') {
        anim.flameFlicker += dt * 13;
    } else if (st.exp === 'silver_mirror') {
        if (st.silverStep >= 3) {
            anim.silverTemp = Math.min(68, anim.silverTemp + dt * 18);
            if (st.silverSub !== 'sucrose' && anim.silverTemp >= 46) {
                anim.silverCoating = Math.min(1, anim.silverCoating + dt * 0.34);
            }
        } else {
            anim.silverTemp = Math.max(25, anim.silverTemp - dt * 15);
            anim.silverCoating = Math.max(0, anim.silverCoating - dt * 0.6);
        }
    } else if (st.exp === 'electrolysis') {
        if (st.elecOn) {
            st.elecProgress = Math.min(1, st.elecProgress + dt * 0.08);
            if (anim.elecBubL.length < 18 && Math.random() < dt * 12) {
                anim.elecBubL.push({ x: (Math.random() - 0.5) * 14, y: 280, r: 1.8 + Math.random() * 2 });
            }
            if (anim.elecBubR.length < 18 && Math.random() < dt * 14) {
                anim.elecBubR.push({ x: (Math.random() - 0.5) * 14, y: 280, r: 1.8 + Math.random() * 2 });
            }
        }
        anim.elecBubL = anim.elecBubL.filter(b => { b.y -= dt * 52; return b.y > 192; });
        anim.elecBubR = anim.elecBubR.filter(b => { b.y -= dt * 56; return b.y > 192; });
    }
}

/* --- Modal Lifecycle & Controls --- */
function openMiniChemLab(expId = null) {
    if (expId) miniLabState.exp = expId;
    closeAllPopovers();
    const modal = document.getElementById('miniChemLabModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    selectMiniLabExperiment(miniLabState.exp);
    ensureLabAnimLoopRunning();
}

function closeMiniChemLab() {
    document.getElementById('miniChemLabModal')?.classList.add('hidden');
    stopMiniLabAnimLoop();
}

function toggleMiniLabStageTheme() {
    miniLabState.paperLight = !miniLabState.paperLight;
    const shell = document.querySelector('#miniChemLabModal .mini-lab-stage-shell');
    if (shell) shell.classList.toggle('paper-light', miniLabState.paperLight);
    const btn = document.getElementById('miniLabThemeBtn');
    if (btn) btn.textContent = miniLabState.paperLight ? '🌙 Phòng tối' : '🌞 Nền giấy';
    renderMiniLabStage();
}

function selectMiniLabExperiment(expId) {
    miniLabState.exp = expId || 'titration';
    miniLabAnim.autoDrip = false;
    ['titration', 'precipitate', 'gas', 'rutherford', 'flame', 'silver_mirror', 'electrolysis'].forEach(id => {
        document.getElementById('labTab-' + id)?.classList.toggle('active', miniLabState.exp === id);
    });
    renderMiniLabUI();
    renderMiniLabStage();
}

function applyResetOnLabState(st, anim) {
    anim.autoDrip = false;
    anim.drops = [];
    anim.ripples = [];
    anim.washPulse = 0;
    anim.indicatorPulse = 0;
    anim.swirlFlash = 0;
    if (st.exp === 'titration') {
        st.titrationStep = 0;
        st.addedBaseMl = 0;
        anim.dispFill = 0;
        anim.dispRgba = [224, 242, 254, 0.34];
    } else if (st.exp === 'precipitate') {
        st.precipStep = 0;
        anim.precipParticles = [];
    } else if (st.exp === 'gas') {
        st.gasStep = 0;
        anim.gasBubbles = [];
        anim.tubeBubbles = [];
        anim.naTrail = 0;
    } else if (st.exp === 'rutherford') {
        st.alphaStats = { total: 0, straight: 0, deflected: 0, back: 0 };
        anim.alphaParticles = [];
        anim.alphaFlashes = [];
    } else if (st.exp === 'flame') {
        st.flameStep = 0;
    } else if (st.exp === 'silver_mirror') {
        st.silverStep = 0;
        anim.silverTemp = 25;
        anim.silverCoating = 0;
    } else if (st.exp === 'electrolysis') {
        st.elecOn = false;
        st.elecProgress = 0;
        anim.elecBubL = [];
        anim.elecBubR = [];
    }
}

function resetMiniLabExperiment() {
    applyResetOnLabState(miniLabState, miniLabAnim);
    renderMiniLabUI();
    renderMiniLabStage();
}

function miniLabSetConfig(key, val, targetState = miniLabState, targetAnim = miniLabAnim) {
    targetState[key] = val;
    targetAnim.autoDrip = false;
    if (['acidType', 'acidConcM', 'acidVolMl', 'baseConcM', 'precipPair', 'gasMetal', 'gasMassG', 'silverSub', 'elecSol'].includes(key)) {
        targetState.addedBaseMl = 0;
        targetAnim.precipParticles = [];
        targetAnim.gasBubbles = [];
        targetAnim.naTrail = 0;
        targetAnim.silverCoating = 0;
        targetState.elecProgress = 0;
    }
    if (key === 'precipPair' && targetState.precipStep >= 3) initPrecipParticles(targetAnim, true);
    if (key === 'alphaTarget') targetState.alphaStats = { total: 0, straight: 0, deflected: 0, back: 0 };
    if (targetState === miniLabState) {
        renderMiniLabUI();
        renderMiniLabStage();
    }
}

function miniLabStepAction(stepNum, targetState = miniLabState, targetAnim = miniLabAnim) {
    if (targetState.exp === 'titration') {
        const prev = targetState.titrationStep;
        targetState.titrationStep = stepNum;
        if (stepNum < 3 && prev >= 3) targetState.addedBaseMl = 0;
        if (stepNum === 2 && prev < 2) targetAnim.washPulse = 1.0;
        if (stepNum === 4 && prev < 4) {
            targetAnim.indicatorPulse = 1.0;
            targetAnim.swirlFlash = 0.85;
        }
    } else if (targetState.exp === 'precipitate') {
        targetState.precipStep = stepNum;
        if (stepNum === 2) targetAnim.washPulse = 1.0;
        if (stepNum >= 3) {
            targetAnim.indicatorPulse = 1.0;
            initPrecipParticles(targetAnim, true);
        }
    } else if (targetState.exp === 'gas') {
        targetState.gasStep = stepNum;
        if (stepNum >= 3) {
            targetAnim.gasBubbles = [];
            targetAnim.tubeBubbles = [];
            targetAnim.naTrail = 0.05;
        }
    } else if (targetState.exp === 'rutherford') {
        targetState.alphaAuto = stepNum >= 1;
    } else if (targetState.exp === 'flame') {
        targetState.flameStep = stepNum;
    } else if (targetState.exp === 'silver_mirror') {
        targetState.silverStep = stepNum;
        if (stepNum < 3) targetAnim.silverCoating = 0;
    } else if (targetState.exp === 'electrolysis') {
        targetState.elecOn = stepNum >= 1;
    }
    if (targetState === miniLabState) {
        renderMiniLabUI();
        renderMiniLabStage();
    }
}

function miniLabTitrateAdd(deltaMl, targetState = miniLabState, targetAnim = miniLabAnim) {
    if (targetState.titrationStep < 4) targetState.titrationStep = 4;
    targetState.titrationStep = 5;
    targetState.addedBaseMl = Math.max(0, Math.min(50.0, Math.round((targetState.addedBaseMl + deltaMl) * 100) / 100));
    targetState.dropAnimY = 0;
    if (deltaMl > 0) {
        targetAnim.stopcockAmt = 1.0;
        const count = deltaMl >= 1.5 ? 3 : (deltaMl >= 0.4 ? 2 : 1);
        for (let i = 0; i < count; i++) {
            targetAnim.drops.push({ y: 185 - i * 10, speed: 120 + i * 25, color: 'rgba(186,230,253,0.92)' });
        }
    }
    if (targetState === miniLabState) {
        renderMiniLabUI();
        renderMiniLabStage();
    }
}

function toggleMiniLabAutoDrip(targetState = miniLabState, targetAnim = miniLabAnim) {
    if (targetState.titrationStep < 4) targetState.titrationStep = 4;
    targetState.titrationStep = 5;
    targetAnim.autoDrip = !targetAnim.autoDrip;
    if (targetState === miniLabState) renderMiniLabUI();
}

function jumpNearEquivalencePoint(targetState = miniLabState, targetAnim = miniLabAnim) {
    if (targetState.titrationStep < 4) targetState.titrationStep = 4;
    targetState.titrationStep = 5;
    targetAnim.autoDrip = false;
    const vEq = getTitrationEquivVolumeMl(targetState);
    targetState.addedBaseMl = Math.max(0, Math.round((vEq - 0.15) * 100) / 100);
    targetAnim.drops.push({ y: 185, speed: 150, color: 'rgba(186,230,253,0.92)' });
    if (targetState === miniLabState) {
        renderMiniLabUI();
        renderMiniLabStage();
    }
}

function handleLabStageInteraction(relX, st, anim) {
    if (st.exp === 'titration') {
        if (relX > 0.66) return;
        if (st.titrationStep < 4) miniLabStepAction(st.titrationStep + 1, st, anim);
        else miniLabTitrateAdd(0.05, st, anim);
    } else if (st.exp === 'precipitate') {
        const maxS = st.precipPair === 'CaOH2_CO2' ? 4 : 3;
        miniLabStepAction(Math.min(maxS, st.precipStep + 1), st, anim);
    } else if (st.exp === 'gas') {
        miniLabStepAction(Math.min(3, st.gasStep + 1), st, anim);
    } else if (st.exp === 'rutherford') {
        fireRutherfordBurst(30, st, anim);
    } else if (st.exp === 'flame') {
        miniLabStepAction(st.flameStep >= 2 ? 0 : st.flameStep + 1, st, anim);
    } else if (st.exp === 'silver_mirror') {
        miniLabStepAction(Math.min(3, st.silverStep + 1), st, anim);
    } else if (st.exp === 'electrolysis') {
        miniLabStepAction(st.elecOn ? 0 : 1, st, anim);
    }
}

function handleMiniLabCanvasClick(event) {
    if (!event) return;
    const can = document.getElementById('miniLabStageCanvas');
    if (!can) return;
    const rect = can.getBoundingClientRect ? can.getBoundingClientRect() : { left: 0, width: 600 };
    const relX = rect.width ? (event.clientX - rect.left) / rect.width : 0.5;
    handleLabStageInteraction(relX, miniLabState, miniLabAnim);
}

function getMiniLabEqAndTelemetry(st) {
    if (st.exp === 'titration') {
        const ph = computeMiniLabTitrationPH(st);
        const vEq = getTitrationEquivVolumeMl(st);
        const buretName = st.acidType === 'NaOH' ? 'HCl 0.10M' : `NaOH ${st.baseConcM.toFixed(2)}M`;
        const indNames = { phenol: 'Phenolphtalein', methyl: 'Methyl cam', litmus: 'Quỳ tím', btb: 'BTB xanh', universal: 'Vạn năng pH' };
        const curRgba = getMiniLabTitrationColor(ph, st);
        const statusShort = st.titrationStep < 4 ? 'Chưa có chỉ thị'
            : (st.indicator === 'phenol' ? (ph < 8.1 ? 'Không màu' : ph < 9.5 ? 'Hồng nhạt (TĐ)' : 'Hồng đậm')
            : st.indicator === 'methyl' ? (ph < 3.1 ? 'Đỏ' : ph <= 4.4 ? 'Da cam' : 'Vàng')
            : st.indicator === 'litmus' ? (ph < 5.0 ? 'Hóa đỏ' : ph <= 8.0 ? 'Tím trung tính' : 'Hóa xanh')
            : st.indicator === 'btb' ? (ph < 6.0 ? 'Vàng' : ph <= 7.6 ? 'Xanh lục (TĐ)' : 'Xanh dương')
            : `pH ${ph.toFixed(1)}`);
        const eqMap = {
            HCl: 'HCl + NaOH → NaCl + H₂O',
            H2SO4: 'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O',
            CH3COOH: 'CH₃COOH + NaOH ⇌ CH₃COONa + H₂O',
            NaOH: 'NaOH + HCl → NaCl + H₂O (Chuẩn độ ngược)'
        };
        return {
            pills: [
                { lbl: 'pH', val: ph.toFixed(2), cls: 'text-sky-300' },
                { lbl: st.acidType === 'NaOH' ? 'V(HCl)' : 'V(NaOH)', val: `${st.addedBaseMl.toFixed(2)} mL`, cls: 'text-emerald-300' },
                { lbl: 'V_tđ', val: `${vEq.toFixed(1)} mL`, cls: 'text-amber-300' }
            ],
            swatch: { col: curRgba, txt: statusShort },
            eq: eqMap[st.acidType] || eqMap.HCl,
            ion: 'H⁺ + OH⁻ → H₂O',
            buretName,
            indName: indNames[st.indicator] || 'Phenolphtalein',
            desc: st.titrationStep < 4 ? 'Thực hiện tuần tự Bước 1 → Bước 4 để chuẩn bị dung dịch chuẩn độ.' : `Màu chỉ thị: ${statusShort} (pH = ${ph.toFixed(2)}).`
        };
    }
    if (st.exp === 'precipitate') {
        const curP = PRECIP_PAIRS_META[st.precipPair] || PRECIP_PAIRS_META.CuSO4_NaOH;
        const maxS = st.precipPair === 'CaOH2_CO2' ? 4 : 3;
        const isDissolved = st.precipPair === 'CaOH2_CO2' && st.precipStep >= 4;
        return {
            pills: [{ lbl: `Bước ${st.precipStep}/${maxS}`, val: isDissolved ? 'Tan hết tạo Ca(HCO₃)₂' : (st.precipStep >= 3 ? '✓ Kết tủa!' : 'Chuẩn bị'), cls: 'text-sky-300' }],
            swatch: { col: st.precipStep >= 3 && !isDissolved ? curP.pptCol : 'rgba(224,242,254,0.35)', txt: isDissolved ? 'Trong suốt' : (st.precipStep >= 3 ? curP.formula : 'Chưa phản ứng') },
            eq: isDissolved ? 'CaCO₃↓ + CO₂ + H₂O → Ca(HCO₃)₂' : curP.title,
            ion: curP.ion,
            desc: isDissolved ? 'Dư khí CO₂ hòa tan hoàn toàn kết tủa CaCO₃ tạo dung dịch muối hidrocacbonat không màu.' : (st.precipStep >= 3 ? curP.desc : 'Thực hiện từng bước để quan sát hạt kết tủa lắng đáy.')
        };
    }
    if (st.exp === 'gas') {
        const gMeta = GAS_REACTIONS_META[st.gasMetal] || GAS_REACTIONS_META.Zn;
        const nGas = (st.gasMassG / gMeta.M) * gMeta.nFactor;
        const vGas = (nGas * 24.79).toFixed(3);
        return {
            pills: [
                { lbl: `m(${st.gasMetal})`, val: `${st.gasMassG.toFixed(2)} g`, cls: 'text-sky-300' },
                { lbl: `n(${gMeta.gasName.replace('↑','')})`, val: `${nGas.toFixed(3)} mol`, cls: 'text-emerald-300' },
                { lbl: 'V(đkc)', val: `${vGas} L`, cls: 'text-amber-300' }
            ],
            swatch: null,
            eq: gMeta.title,
            ion: `V = ${vGas} L (đkc)`,
            desc: st.gasStep >= 3 ? `${gMeta.desc} (Thu được ≈ ${vGas} lít khí ở đkc).` : 'Làm tuần tự 3 bước để cân mẫu kim loại và quan sát phản ứng.'
        };
    }
    if (st.exp === 'rutherford') {
        const s = st.alphaStats || { total: 0, straight: 0, deflected: 0, back: 0 };
        return {
            pills: [
                { lbl: 'Bia', val: st.alphaTarget === 'Au' ? '⁷⁹Au (Vàng)' : '¹³Al (Nhôm)', cls: 'text-amber-300' },
                { lbl: 'Tổng α', val: `${s.total}`, cls: 'text-sky-300' },
                { lbl: 'Bật ngược', val: `${s.back}`, cls: 'text-rose-400' }
            ],
            swatch: null,
            eq: 'Thí nghiệm Rutherford (1911): Bắn phá lá vàng bằng hạt α (⁴₂He²⁺)',
            ion: `Xuyên thẳng: ${s.straight} · Lệch: ${s.deflected}`,
            desc: 'Đa số hạt α xuyên thẳng chứng tỏ nguyên tử có cấu tạo rỗng; tỉ lệ nhỏ bật ngược chứng tỏ tồn tại hạt nhân mang điện (+) rất nhỏ tập trung khối lượng ở tâm!'
        };
    }
    if (st.exp === 'flame') {
        const fm = FLAME_IONS_META[st.flameIon] || FLAME_IONS_META.Na;
        return {
            pills: [
                { lbl: 'Ion', val: fm.sym, cls: 'text-sky-300' },
                { lbl: 'Màu lửa', val: st.flameStep >= 2 ? fm.name : 'Chờ đưa que Pt', cls: 'text-amber-300' }
            ],
            swatch: { col: st.flameStep >= 2 ? fm.flame : '#38bdf8', txt: st.flameStep >= 2 ? fm.name : 'Ngọn lửa nền' },
            eq: `Nhận biết ion ${fm.sym} bằng phương pháp thử màu ngọn lửa`,
            ion: 'Quang phổ phát xạ đặc trưng',
            desc: st.flameStep >= 2 ? `Electron kích thích nhảy mức năng lượng phát ra bức xạ đặc trưng ${fm.name}.` : 'Bật đèn khí Bunsen và đưa que cấy bạch kim thấm muối vào ngọn lửa.'
        };
    }
    if (st.exp === 'silver_mirror') {
        const subName = st.silverSub === 'glucose' ? 'CH₂OH[CHOH]₄CHO (Glucozơ)' : (st.silverSub === 'hcho' ? 'HCHO (Andehit fomic)' : 'Saccarozơ (C₁₂H₂₂O₁₁)');
        const eq = st.silverSub === 'sucrose'
            ? 'Saccarozơ + [Ag(NH₃)₂]OH → Không phản ứng tráng bạc!'
            : (st.silverSub === 'hcho' ? 'HCHO + 4[Ag(NH₃)₂]OH → (NH₄)₂CO₃ + 4Ag↓ + 6NH₃ + 2H₂O' : 'R–CHO + 2[Ag(NH₃)₂]OH → R–COONH₄ + 2Ag↓ + 3NH₃ + H₂O');
        return {
            pills: [
                { lbl: 'Mẫu', val: st.silverSub === 'glucose' ? 'Glucozơ' : st.silverSub === 'hcho' ? 'HCHO' : 'Saccarozơ', cls: 'text-sky-300' },
                { lbl: 'Bước', val: `${st.silverStep}/3`, cls: 'text-emerald-300' }
            ],
            swatch: null,
            eq,
            ion: st.silverSub === 'sucrose' ? 'Đối chứng: Không có nhóm -CHO' : 'Kết tủa Ag sáng gương',
            desc: st.silverStep >= 3
                ? (st.silverSub === 'sucrose' ? 'Saccarozơ không có nhóm -CHO nên không khử được Ag⁺ — dung dịch vẫn trong suốt!' : `Đun cách thủy ~65°C giúp ${subName} khử phức bạc tạo lớp gương Ag bám đều trên thành ống nghiệm!`)
                : 'Chuẩn bị thuốc thử Tollens, nhỏ mẫu thử và đun cách thủy nhẹ ở 65°C.'
        };
    }
    // Electrolysis
    const isCu = st.elecSol === 'CuSO4';
    const pct = Math.round((st.elecProgress || 0) * 100);
    return {
        pills: [
            { lbl: 'Dung dịch', val: isCu ? 'CuSO₄' : 'NaCl (Màng ngăn + PP)', cls: 'text-sky-300' },
            { lbl: 'Nguồn DC', val: st.elecOn ? `Đang điện phân (${pct}%)` : 'Đang ngắt', cls: st.elecOn ? 'text-emerald-300' : 'text-slate-400' }
        ],
        swatch: null,
        eq: isCu ? '2CuSO₄ + 2H₂O —đpdd→ 2Cu↓ + 2H₂SO₄ + O₂↑' : '2NaCl + 2H₂O —đpdd có màng ngăn→ 2NaOH + H₂↑ + Cl₂↑',
        ion: isCu ? 'K(−): Cu²⁺→Cu · A(+): H₂O→O₂↑' : 'K(−): H₂↑ + OH⁻(hồng) · A(+): Cl₂↑',
        desc: isCu
            ? 'Ở Cathode (−) đồng đỏ bám dần lên điện cực; ở Anode (+) sủi bọt khí O₂ không màu; màu xanh dung dịch nhạt dần.'
            : 'Ở Cathode (−) khí H₂ thoát ra đồng thời tạo NaOH làm Phenolphtalein hóa hồng; ở Anode (+) có khí vàng lục Cl₂↑.'
    };
}

function renderMiniLabUI() {
    const cfgBox = document.getElementById('miniLabConfigBox');
    const stepsBox = document.getElementById('miniLabStepsBox');
    const actBox = document.getElementById('miniLabActionBar');
    const eqBox = document.getElementById('miniLabReactionEquationBox');
    const teleBar = document.getElementById('miniLabTelemetryBar');
    if (!cfgBox || !stepsBox || !actBox || !eqBox || !teleBar) return;

    const st = miniLabState;
    const meta = getMiniLabEqAndTelemetry(st);

    // Telemetry strip
    let teleHtml = '<div class="flex items-center gap-1.5 flex-wrap">';
    meta.pills.forEach(p => {
        teleHtml += `<span class="mini-lab-hud-pill"><span class="${p.cls}">${p.lbl}</span> <span>${p.val}</span></span>`;
    });
    teleHtml += '</div>';
    if (meta.swatch) {
        teleHtml += `<span class="mini-lab-hud-pill"><span class="mini-lab-swatch" style="background:${meta.swatch.col};"></span><span>${meta.swatch.txt}</span></span>`;
    }
    teleBar.innerHTML = teleHtml;

    // Equation banner
    eqBox.innerHTML = `
        <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
            <span class="font-extrabold" style="color:var(--accent);">${meta.eq}</span>
            <span class="text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-500/15 font-bold" style="color:#10b981;">${meta.ion}</span>
        </div>
        <div style="color:var(--text-muted);">${meta.desc}</div>
    `;

    // Experiment-specific config, steps & actions
    if (st.exp === 'titration') {
        const sStep = st.titrationStep;
        const acidMassG = (st.acidVolMl * 0.001 * (st.acidType === 'H2SO4' ? 0.05 : st.acidConcM) * (st.acidType === 'HCl' ? 36.5 : st.acidType === 'H2SO4' ? 98 : st.acidType === 'CH3COOH' ? 60 : 40)).toFixed(3);
        cfgBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>1. Dung dịch mẫu &amp; 5 Chỉ thị màu</span><span class="text-[10px]">Buret: ${meta.buretName}</span></div>
            <div class="mini-lab-opt-grid">
                ${[
                    ['HCl', 'HCl 0.10M'], ['H2SO4', 'H₂SO₄ 0.05M'],
                    ['CH3COOH', 'CH₃COOH 0.1M'], ['NaOH', 'NaOH (ngược HCl)']
                ].map(([k, lbl]) => `<button onclick="miniLabSetConfig('acidType','${k}')" class="mini-lab-opt-btn ${st.acidType === k ? 'active' : ''}"><span>${lbl}</span><span>${st.acidType === k ? '✓' : ''}</span></button>`).join('')}
            </div>
            <div class="grid grid-cols-3 gap-1 pt-0.5">
                ${[
                    ['phenol', 'Phenolphtalein', 'linear-gradient(135deg,#e2e8f0,#ec4899)'],
                    ['methyl', 'Methyl cam', 'linear-gradient(135deg,#ef4444,#eab308)'],
                    ['litmus', 'Quỳ tím', 'linear-gradient(135deg,#ef4444,#a855f7,#2563eb)'],
                    ['btb', 'BTB xanh', 'linear-gradient(135deg,#facc15,#10b981,#2563eb)'],
                    ['universal', 'Vạn năng pH', 'linear-gradient(135deg,#ef4444,#22c55e,#9333ea)']
                ].map(([k, lbl, grad]) => `<button onclick="miniLabSetConfig('indicator','${k}')" class="mini-lab-opt-btn !px-1.5 !py-1 !text-[10.5px] ${st.indicator === k ? 'active' : ''}"><span class="flex items-center gap-1 truncate"><span class="mini-lab-swatch" style="width:9px;height:9px;background:${grad};"></span>${lbl}</span></button>`).join('')}
            </div>
            <div class="flex items-center justify-between gap-2 text-[11px]">
                <span style="color:var(--text-muted);" class="font-semibold">Thể tích mẫu:</span>
                <div class="flex items-center gap-1">
                    ${[10, 20, 25].map(v => `<button onclick="miniLabSetConfig('acidVolMl',${v})" class="mini-lab-opt-btn !py-0.5 !px-2 !text-[10.5px] ${st.acidVolMl === v ? 'active' : ''}">${v} mL</button>`).join('')}
                </div>
            </div>`;
        const mkStep = (num, label, done, isCur) => `<button onclick="miniLabStepAction(${num})" class="mini-lab-step-row ${done ? 'done' : ''} ${isCur ? 'current' : ''}"><span class="mini-lab-step-num">${done ? '✓' : num}</span><span class="flex-1 truncate">${label}</span></button>`;
        stepsBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>2. Quy trình thực hành (5 bước)</span><span>${Math.min(sStep, 5)}/5</span></div>
            ${mkStep(1, `Cân / Đong ${st.acidVolMl} mL ${st.acidType} (${acidMassG}g)`, sStep >= 1, sStep === 0)}
            ${mkStep(2, 'Thêm 20 mL dung môi (nước cất H₂O)', sStep >= 2, sStep === 1)}
            ${mkStep(3, `Lắp Giá đỡ, Buret ${meta.buretName} & Khuấy từ`, sStep >= 3, sStep === 2)}
            ${mkStep(4, `Nhỏ 2 giọt chỉ thị ${meta.indName}`, sStep >= 4, sStep === 3)}
            ${mkStep(5, 'Mở khóa Buret & Quan sát đổi màu', sStep >= 5, sStep === 4 || sStep === 5)}`;
        let nextHtml = '';
        if (sStep === 0) nextHtml = `<button onclick="miniLabStepAction(1)" class="mini-lab-primary-btn">⚖️ Bước 1: Cân / Đong mẫu ${st.acidType}</button>`;
        else if (sStep === 1) nextHtml = `<button onclick="miniLabStepAction(2)" class="mini-lab-primary-btn">💧 Bước 2: Bóp bình tia thêm dung môi H₂O</button>`;
        else if (sStep === 2) nextHtml = `<button onclick="miniLabStepAction(3)" class="mini-lab-primary-btn">🔧 Bước 3: Lắp Buret &amp; Bật khuấy từ</button>`;
        else if (sStep === 3) nextHtml = `<button onclick="miniLabStepAction(4)" class="mini-lab-primary-btn" style="background:linear-gradient(135deg,#ec4899,#f43f5e);">🧪 Bước 4: Nhỏ 2 giọt ${meta.indName}</button>`;
        else {
            nextHtml = `
                <div class="mini-lab-panel-title"><span>Mở khóa Buret</span><span>${st.addedBaseMl.toFixed(2)} / 40.0 mL</span></div>
                <div class="mini-lab-drip-grid">
                    <button onclick="miniLabTitrateAdd(0.05)" class="mini-lab-drip-btn">💧 +1 giọt</button>
                    <button onclick="miniLabTitrateAdd(0.5)" class="mini-lab-drip-btn">💦 +0.5 mL</button>
                    <button onclick="miniLabTitrateAdd(2.0)" class="mini-lab-drip-btn">🌊 +2.0 mL</button>
                </div>
                <div class="grid grid-cols-2 gap-1.5">
                    <button onclick="toggleMiniLabAutoDrip()" class="mini-lab-drip-btn ${miniLabAnim.autoDrip ? 'active-drip' : ''}">${miniLabAnim.autoDrip ? '⏸️ Tạm dừng' : '▶️ Tự nhỏ giọt'}</button>
                    <button onclick="jumpNearEquivalencePoint()" class="mini-lab-drip-btn">🎯 Sát điểm TĐ</button>
                </div>`;
        }
        actBox.innerHTML = nextHtml;
    } else if (st.exp === 'precipitate') {
        const sStep = st.precipStep;
        const maxS = st.precipPair === 'CaOH2_CO2' ? 4 : 3;
        cfgBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>1. Chọn 8 phản ứng kết tủa phổ biến</span></div>
            <div class="grid grid-cols-2 gap-1 max-h-[145px] overflow-y-auto pr-0.5">
                ${Object.entries(PRECIP_PAIRS_META).map(([k, info]) => `
                    <button onclick="miniLabSetConfig('precipPair','${k}')" class="mini-lab-opt-btn !py-1 !px-1.5 !text-[10.5px] ${st.precipPair === k ? 'active' : ''}">
                        <span class="flex items-center gap-1.5 truncate"><span class="mini-lab-swatch" style="width:9px;height:9px;background:${info.pptCol};"></span>${k.replace('_', ' + ')}</span>
                    </button>`).join('')}
            </div>`;
        const mkP = (num, lbl) => `<button onclick="miniLabStepAction(${num})" class="mini-lab-step-row ${sStep>=num?'done':''} ${sStep===num-1?'current':''}"><span class="mini-lab-step-num">${sStep>=num?'✓':num}</span><span class="truncate">${lbl}</span></button>`;
        stepsBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>2. Quy trình thực hiện</span><span>${sStep}/${maxS}</span></div>
            ${mkP(1, 'Rót 5 mL dung dịch muối/bazơ mẫu')}
            ${mkP(2, 'Thêm 5 mL nước cất (dung môi)')}
            ${mkP(3, `Cho ${PRECIP_PAIRS_META[st.precipPair]?.reagent || 'thuốc thử'} tạo kết tủa`)}
            ${st.precipPair === 'CaOH2_CO2' ? mkP(4, 'Tiếp tục sục dư khí CO₂ (hòa tan kết tủa)') : ''}`;
        actBox.innerHTML = sStep < 1 ? `<button onclick="miniLabStepAction(1)" class="mini-lab-primary-btn">🧪 Bước 1: Lấy dung dịch mẫu</button>`
            : sStep < 2 ? `<button onclick="miniLabStepAction(2)" class="mini-lab-primary-btn">💧 Bước 2: Thêm dung môi H₂O</button>`
            : (sStep < 3 || st.precipPair !== 'CaOH2_CO2')
                ? `<button onclick="miniLabStepAction(3)" class="mini-lab-primary-btn" style="background:linear-gradient(135deg,#3b82f6,#06b6d4);">✨ Bước 3: Cho thuốc thử tạo kết tủa</button>`
                : `<button onclick="miniLabStepAction(4)" class="mini-lab-primary-btn" style="background:linear-gradient(135deg,#8b5cf6,#ec4899);">🫧 Bước 4: Sục dư khí CO₂ (Tan lại)</button>`;
    } else if (st.exp === 'gas') {
        const sStep = st.gasStep;
        cfgBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>1. Chọn Kim loại &amp; Tác nhân</span></div>
            <div class="grid grid-cols-2 gap-1">
                ${Object.entries(GAS_REACTIONS_META).map(([k, gm]) => `
                    <button onclick="miniLabSetConfig('gasMetal','${k}')" class="mini-lab-opt-btn !py-1 !text-[10.5px] ${st.gasMetal === k ? 'active' : ''}"><span>${gm.label}</span><span>${st.gasMetal === k ? '✓' : ''}</span></button>`).join('')}
            </div>
            <div class="flex items-center justify-between gap-2 text-[11px] pt-0.5">
                <span style="color:var(--text-muted);" class="font-semibold">Khối lượng mẫu:</span>
                <div class="flex items-center gap-1">
                    ${[0.325, 0.65, 1.3].map(m => `<button onclick="miniLabSetConfig('gasMassG',${m})" class="mini-lab-opt-btn !py-0.5 !px-2 !text-[10.5px] ${st.gasMassG === m ? 'active' : ''}">${m} g</button>`).join('')}
                </div>
            </div>`;
        const mkG = (num, lbl) => `<button onclick="miniLabStepAction(${num})" class="mini-lab-step-row ${sStep>=num?'done':''} ${sStep===num-1?'current':''}"><span class="mini-lab-step-num">${sStep>=num?'✓':num}</span><span class="truncate">${lbl}</span></button>`;
        stepsBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>2. Các bước tiến hành</span><span>${sStep}/3</span></div>
            ${mkG(1, `Cân ${st.gasMassG.toFixed(2)}g kim loại ${st.gasMetal}`)}
            ${mkG(2, st.gasMetal === 'Na' ? 'Chuẩn bị chậu nước có vài giọt Phenolphtalein' : (st.gasMetal === 'Cu' ? 'Rót dung dịch HNO₃ đặc vào ống nghiệm' : 'Rót dung dịch HCl 1M vào bình phản ứng'))}
            ${mkG(3, `Thả ${st.gasMetal} vào &amp; Quan sát hiện tượng sinh khí`)}`;
        actBox.innerHTML = sStep < 1 ? `<button onclick="miniLabStepAction(1)" class="mini-lab-primary-btn">⚖️ Bước 1: Cân ${st.gasMassG.toFixed(2)}g ${st.gasMetal}</button>`
            : sStep < 2 ? `<button onclick="miniLabStepAction(2)" class="mini-lab-primary-btn">💧 Bước 2: Rót dung dịch phản ứng</button>`
            : `<button onclick="miniLabStepAction(3)" class="mini-lab-primary-btn" style="background:linear-gradient(135deg,#10b981,#14b8a6);">⚡ Bước 3: Thả ${st.gasMetal} &amp; Thu khí!</button>`;
    } else if (st.exp === 'rutherford') {
        const s = st.alphaStats || { total: 0, straight: 0, deflected: 0, back: 0 };
        cfgBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>1. Chọn lá kim loại bắn phá</span></div>
            <div class="mini-lab-opt-grid">
                <button onclick="miniLabSetConfig('alphaTarget','Au')" class="mini-lab-opt-btn ${st.alphaTarget === 'Au' ? 'active' : ''}"><span>Lá Vàng (⁷⁹Au)</span><span>${st.alphaTarget === 'Au' ? '✓' : ''}</span></button>
                <button onclick="miniLabSetConfig('alphaTarget','Al')" class="mini-lab-opt-btn ${st.alphaTarget === 'Al' ? 'active' : ''}"><span>Lá Nhôm (¹³Al)</span><span>${st.alphaTarget === 'Al' ? '✓' : ''}</span></button>
            </div>`;
        stepsBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>2. Thống kê hạt Alpha (α)</span><span>Tổng: ${s.total}</span></div>
            <div class="mini-lab-step-row done"><span class="mini-lab-step-num">→</span><span>Xuyên thẳng qua lớp vỏ rỗng: <b>${s.straight}</b></span></div>
            <div class="mini-lab-step-row"><span class="mini-lab-step-num" style="background:#f59e0b;color:#0f172a;">↗</span><span>Lệch hướng gần hạt nhân: <b>${s.deflected}</b></span></div>
            <div class="mini-lab-step-row"><span class="mini-lab-step-num" style="background:#f43f5e;color:#fff;">↩</span><span>Bật ngược trực diện (&gt;90°): <b>${s.back}</b></span></div>`;
        actBox.innerHTML = `
            <div class="grid grid-cols-2 gap-1.5">
                <button onclick="miniLabStepAction(${st.alphaAuto ? 0 : 1})" class="mini-lab-primary-btn ${st.alphaAuto ? '' : 'opacity-90'}">${st.alphaAuto ? '⏸️ Tạm dừng chùm α' : '▶️ Bật chùm α liên tục'}</button>
                <button onclick="fireRutherfordBurst(25)" class="mini-lab-drip-btn h-[38px]">💥 Bắn loạt +25 α</button>
            </div>`;
    } else if (st.exp === 'flame') {
        cfgBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>1. Chọn muối ion kim loại (6 ion)</span></div>
            <div class="grid grid-cols-3 gap-1">
                ${Object.entries(FLAME_IONS_META).map(([k, fm]) => `
                    <button onclick="miniLabSetConfig('flameIon','${k}')" class="mini-lab-opt-btn !px-1.5 !py-1 !text-[10.5px] ${st.flameIon === k ? 'active' : ''}">
                        <span class="flex items-center gap-1"><span class="mini-lab-swatch" style="width:9px;height:9px;background:${fm.flame};"></span>${k}⁺</span>
                    </button>`).join('')}
            </div>`;
        const fStep = st.flameStep;
        stepsBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>2. Thao tác đốt thử màu</span><span>${fStep}/2</span></div>
            <button onclick="miniLabStepAction(1)" class="mini-lab-step-row ${fStep>=1?'done':''} ${fStep===0?'current':''}"><span class="mini-lab-step-num">1</span><span>Bật đèn khí Bunsen (ngọn lửa xanh nền)</span></button>
            <button onclick="miniLabStepAction(2)" class="mini-lab-step-row ${fStep>=2?'done':''} ${fStep===1?'current':''}"><span class="mini-lab-step-num">2</span><span>Đưa que Pt nhúng muối vào ngọn lửa</span></button>`;
        actBox.innerHTML = fStep < 1
            ? `<button onclick="miniLabStepAction(1)" class="mini-lab-primary-btn">🔥 Bước 1: Bật đèn khí Bunsen</button>`
            : (fStep < 2 ? `<button onclick="miniLabStepAction(2)" class="mini-lab-primary-btn" style="background:linear-gradient(135deg,#f97316,#eab308);">✨ Bước 2: Đưa mẫu ${st.flameIon} vào lửa!</button>`
                : `<button onclick="miniLabStepAction(0)" class="mini-lab-primary-btn" style="background:linear-gradient(135deg,#64748b,#475569);">🧯 Tắt đèn Bunsen</button>`);
    } else if (st.exp === 'silver_mirror') {
        const sStep = st.silverStep;
        cfgBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>1. Chọn chất hữu cơ kiểm tra</span></div>
            <div class="grid grid-cols-3 gap-1">
                ${[['glucose', 'Glucozơ'], ['hcho', 'HCHO'], ['sucrose', 'Saccarozơ']].map(([k, lbl]) => `
                    <button onclick="miniLabSetConfig('silverSub','${k}')" class="mini-lab-opt-btn !px-2 !py-1 !text-[10.5px] ${st.silverSub === k ? 'active' : ''}"><span>${lbl}</span></button>`).join('')}
            </div>`;
        stepsBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>2. Quy trình Tráng Bạc (Tollens)</span><span>${sStep}/3</span></div>
            <button onclick="miniLabStepAction(1)" class="mini-lab-step-row ${sStep>=1?'done':''} ${sStep===0?'current':''}"><span class="mini-lab-step-num">1</span><span>Lấy 2 mL thuốc thử Tollens [Ag(NH₃)₂]OH</span></button>
            <button onclick="miniLabStepAction(2)" class="mini-lab-step-row ${sStep>=2?'done':''} ${sStep===1?'current':''}"><span class="mini-lab-step-num">2</span><span>Nhỏ dung dịch mẫu hữu cơ</span></button>
            <button onclick="miniLabStepAction(3)" class="mini-lab-step-row ${sStep>=3?'done':''} ${sStep===2?'current':''}"><span class="mini-lab-step-num">3</span><span>Ngâm đun cách thủy (~65°C)</span></button>`;
        actBox.innerHTML = sStep < 1 ? `<button onclick="miniLabStepAction(1)" class="mini-lab-primary-btn">🧪 Bước 1: Lấy thuốc thử Tollens</button>`
            : sStep < 2 ? `<button onclick="miniLabStepAction(2)" class="mini-lab-primary-btn">💧 Bước 2: Nhỏ mẫu thử</button>`
            : `<button onclick="miniLabStepAction(3)" class="mini-lab-primary-btn" style="background:linear-gradient(135deg,#f59e0b,#ef4444);">🌡️ Bước 3: Đun cách thủy 65°C</button>`;
    } else {
        cfgBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>1. Chọn dung dịch điện phân</span></div>
            <div class="mini-lab-opt-grid">
                <button onclick="miniLabSetConfig('elecSol','CuSO4')" class="mini-lab-opt-btn ${st.elecSol==='CuSO4'?'active':''}"><span>CuSO₄ (Mạ đồng + O₂)</span><span>${st.elecSol==='CuSO4'?'✓':''}</span></button>
                <button onclick="miniLabSetConfig('elecSol','NaCl')" class="mini-lab-opt-btn ${st.elecSol==='NaCl'?'active':''}"><span>NaCl (Màng ngăn + PP)</span><span>${st.elecSol==='NaCl'?'✓':''}</span></button>
            </div>`;
        stepsBox.innerHTML = `
            <div class="mini-lab-panel-title"><span>2. Hiện tượng điện cực</span><span>${Math.round((st.elecProgress||0)*100)}%</span></div>
            <div class="mini-lab-step-row done"><span class="mini-lab-step-num">−</span><span>Cathode (−): ${st.elecSol==='CuSO4'?'Bám lớp Đồng đỏ Cu↓':'Sủi khí H₂↑ &amp; Hóa hồng NaOH'}</span></div>
            <div class="mini-lab-step-row done"><span class="mini-lab-step-num">+</span><span>Anode (+): ${st.elecSol==='CuSO4'?'Sủi bọt khí không màu O₂↑':'Sủi bọt khí vàng lục Cl₂↑'}</span></div>`;
        actBox.innerHTML = `<button onclick="miniLabStepAction(${st.elecOn ? 0 : 1})" class="mini-lab-primary-btn" style="${st.elecOn ? 'background:linear-gradient(135deg,#ef4444,#f97316);' : ''}">${st.elecOn ? '⏸️ Ngắt công tắc điện phân' : '⚡ Đóng công tắc nguồn DC 9V'}</button>`;
    }
}

/* --- Theme Palette for Crisp White Paper vs Dark Lab Mode --- */
function getLabThemePalette(paperMode) {
    if (paperMode) {
        return {
            paper: true,
            bgTop: '#ffffff',
            bgBot: '#f8fafc',
            glow0: 'rgba(14, 165, 233, 0.08)',
            grid: 'rgba(15, 23, 42, 0.045)',
            benchTop: '#e2e8f0',
            benchMid: '#cbd5e1',
            benchBot: '#94a3b8',
            benchLine: '#64748b',
            glassStroke: 'rgba(15, 23, 42, 0.85)',
            glassHighlight: 'rgba(255, 255, 255, 0.85)',
            glassTick: 'rgba(15, 23, 42, 0.65)',
            textMain: '#0f172a',
            textMuted: '#475569',
            hudBg: 'rgba(255, 255, 255, 0.94)',
            hudBorder: '#cbd5e1',
            hudText: '#0f172a',
            accentText: '#0284c7',
            rodDark: '#475569',
            rodLight: '#cbd5e1'
        };
    }
    return {
        paper: false,
        bgTop: '#091124',
        bgBot: '#0b1426',
        glow0: 'rgba(56, 189, 248, 0.14)',
        grid: 'rgba(148, 163, 184, 0.045)',
        benchTop: '#22314a',
        benchMid: '#182438',
        benchBot: '#0b1220',
        benchLine: 'rgba(148, 163, 184, 0.38)',
        glassStroke: 'rgba(226, 232, 240, 0.9)',
        glassHighlight: 'rgba(255, 255, 255, 0.36)',
        glassTick: 'rgba(226, 232, 240, 0.65)',
        textMain: '#f8fafc',
        textMuted: '#94a3b8',
        hudBg: 'rgba(15, 23, 42, 0.86)',
        hudBorder: 'rgba(148, 163, 184, 0.28)',
        hudText: '#e2e8f0',
        accentText: '#7dd3fc',
        rodDark: '#475569',
        rodLight: '#f1f5f9'
    };
}

function drawLabBackdropAndBench(c, w, h, benchY, scale, pal) {
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, pal.bgTop);
    bg.addColorStop(1, pal.bgBot);
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);

    const glow = safeRadialGrad(c, w * 0.44, h * 0.36, 15, w * 0.44, h * 0.36, w * 0.48);
    glow.addColorStop(0, pal.glow0);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);

    c.save();
    c.strokeStyle = pal.grid;
    c.lineWidth = 1;
    const step = 28 * scale;
    for (let gx = step; gx < w; gx += step) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, h - 50 * scale); c.stroke(); }
    for (let gy = step; gy < h - 50 * scale; gy += step) { c.beginPath(); c.moveTo(0, gy); c.lineTo(w, gy); c.stroke(); }
    c.restore();

    const benchTop = h - 52 * scale;
    const benchGrad = c.createLinearGradient(0, benchTop, 0, h);
    benchGrad.addColorStop(0, pal.benchTop);
    benchGrad.addColorStop(0.25, pal.benchMid);
    benchGrad.addColorStop(1, pal.benchBot);
    c.fillStyle = benchGrad;
    c.fillRect(0, benchTop, w, 54 * scale);
    c.strokeStyle = pal.benchLine;
    c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(0, benchTop); c.lineTo(w, benchTop); c.stroke();
}

function drawAnalyticalBalancePro(c, cx, baseY, lcdText, labelText, hasSample, metalType, pal) {
    c.save();
    c.fillStyle = pal.paper ? 'rgba(15, 23, 42, 0.14)' : 'rgba(2, 6, 23, 0.55)';
    c.beginPath(); c.ellipse(cx, baseY + 1, 56, 6, 0, 0, Math.PI * 2); c.fill();

    c.fillStyle = pal.paper ? 'rgba(14, 165, 233, 0.05)' : 'rgba(186, 230, 253, 0.06)';
    c.strokeStyle = pal.paper ? 'rgba(15, 23, 42, 0.35)' : 'rgba(186, 230, 253, 0.35)';
    c.lineWidth = 1.1;
    c.beginPath(); c.roundRect(cx - 42, baseY - 108, 84, 62, 5); c.fill(); c.stroke();

    const panGrad = c.createLinearGradient(cx - 26, 0, cx + 26, 0);
    panGrad.addColorStop(0, '#94a3b8'); panGrad.addColorStop(0.5, '#f1f5f9'); panGrad.addColorStop(1, '#64748b');
    c.fillStyle = '#475569'; c.fillRect(cx - 3, baseY - 56, 6, 10);
    c.fillStyle = panGrad;
    c.beginPath(); c.ellipse(cx, baseY - 56, 26, 5, 0, 0, Math.PI * 2); c.fill();

    if (hasSample) {
        if (metalType) {
            c.fillStyle = pal.paper ? '#e2e8f0' : 'rgba(241, 245, 249, 0.9)';
            c.beginPath(); c.moveTo(cx - 18, baseY - 62); c.lineTo(cx + 18, baseY - 62); c.lineTo(cx + 12, baseY - 57); c.lineTo(cx - 12, baseY - 57); c.closePath(); c.fill();
            c.fillStyle = metalType === 'Cu' ? '#d97706' : (metalType === 'Na' ? '#e2e8f0' : (metalType === 'Zn' || metalType === 'Al' ? '#94a3b8' : '#475569'));
            [[-6, -63, 3.2], [0, -64, 3.5], [6, -62.5, 2.8]].forEach(([dx, dy, r]) => {
                c.beginPath(); c.arc(cx + dx, baseY + dy, r, 0, Math.PI * 2); c.fill();
            });
        } else {
            c.fillStyle = 'rgba(56, 189, 248, 0.28)';
            c.fillRect(cx - 12, baseY - 76, 24, 19);
            c.strokeStyle = pal.glassStroke; c.lineWidth = 1.4;
            c.beginPath(); c.moveTo(cx - 13, baseY - 88); c.lineTo(cx - 13, baseY - 57); c.lineTo(cx + 13, baseY - 57); c.lineTo(cx + 13, baseY - 88); c.stroke();
        }
    }

    const bodyGrad = c.createLinearGradient(0, baseY - 46, 0, baseY);
    bodyGrad.addColorStop(0, pal.paper ? '#cbd5e1' : '#475569');
    bodyGrad.addColorStop(1, pal.paper ? '#94a3b8' : '#1e293b');
    c.fillStyle = bodyGrad;
    c.strokeStyle = pal.paper ? '#475569' : 'rgba(148, 163, 184, 0.45)';
    c.lineWidth = 1.3;
    c.beginPath(); c.roundRect(cx - 52, baseY - 46, 104, 46, 7); c.fill(); c.stroke();

    c.fillStyle = '#06202a';
    c.beginPath(); c.roundRect(cx - 42, baseY - 34, 84, 22, 4); c.fill();
    c.fillStyle = hasSample ? '#34d399' : '#38bdf8';
    c.font = '700 11px ui-monospace, Menlo, monospace'; c.textAlign = 'center';
    c.fillText(lcdText, cx, baseY - 19);

    c.fillStyle = pal.textMuted; c.font = '600 9.5px Inter, sans-serif';
    c.fillText(labelText, cx, baseY + 14);
    c.restore();
}

function drawWashBottleAndStream(c, cx, baseY, animPulse, targetX, targetY, pal) {
    c.save();
    const tilt = animPulse > 0 ? Math.sin(animPulse * Math.PI) * 0.62 : 0;
    const bx = animPulse > 0 ? cx + Math.sin(animPulse * Math.PI) * 18 : cx;
    const by = animPulse > 0 ? baseY - 96 * Math.sin(animPulse * Math.PI) : baseY;
    c.translate(bx, by);
    c.rotate(tilt);

    if (animPulse <= 0.02) {
        c.fillStyle = pal.paper ? 'rgba(15, 23, 42, 0.12)' : 'rgba(2, 6, 23, 0.45)';
        c.beginPath(); c.ellipse(0, 1, 20, 4, 0, 0, Math.PI * 2); c.fill();
    }
    const botGrad = c.createLinearGradient(-17, 0, 17, 0);
    botGrad.addColorStop(0, pal.paper ? 'rgba(226,232,240,0.85)' : 'rgba(226, 232, 240, 0.55)');
    botGrad.addColorStop(0.5, '#ffffff');
    botGrad.addColorStop(1, '#cbd5e1');
    c.fillStyle = botGrad;
    c.strokeStyle = pal.glassStroke; c.lineWidth = 1.2;
    c.beginPath(); c.roundRect(-16, -62, 32, 62, 7); c.fill(); c.stroke();
    c.fillStyle = 'rgba(56, 189, 248, 0.45)';
    c.beginPath(); c.roundRect(-14, -40, 28, 38, 5); c.fill();
    c.fillStyle = '#0284c7';
    c.beginPath(); c.roundRect(-10, -73, 20, 11, 3); c.fill();
    c.strokeStyle = pal.glassStroke; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(2, -73); c.quadraticCurveTo(6, -88, 24, -84); c.stroke();
    c.fillStyle = '#0f172a'; c.font = '800 9px Inter, sans-serif'; c.textAlign = 'center';
    c.fillText('H₂O', 0, -24);
    c.restore();

    if (animPulse <= 0.02) {
        c.fillStyle = pal.textMuted; c.font = '600 9.5px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText('Bình tia H₂O', cx, baseY + 14);
    }
    if (animPulse > 0.12) {
        c.save();
        c.strokeStyle = '#0ea5e9'; c.lineWidth = 2.4;
        c.setLineDash([7, 5]); c.lineDashOffset = -animPulse * 60;
        const tipX = bx + Math.cos(tilt) * 24 - Math.sin(tilt) * (-84);
        const tipY = by + Math.sin(tilt) * 24 + Math.cos(tilt) * (-84);
        c.beginPath(); c.moveTo(tipX, tipY);
        c.quadraticCurveTo((tipX + targetX) * 0.52, Math.min(tipY, targetY) - 24, targetX, targetY);
        c.stroke();
        c.restore();
    }
}

function drawErlenmeyerAndStirrer(c, cx, baseY, fillFrac, rgbaArr, stepNum, stirAngle, swirlFlash, ripples, indMode, pal) {
    c.save();
    c.fillStyle = pal.paper ? '#334155' : '#1e293b';
    c.strokeStyle = pal.paper ? '#475569' : 'rgba(148, 163, 184, 0.35)';
    c.lineWidth = 1.2;
    c.beginPath(); c.roundRect(cx - 94, baseY - 8, 152, 8, 3); c.fill(); c.stroke();

    const stirGrad = c.createLinearGradient(0, baseY - 32, 0, baseY - 8);
    stirGrad.addColorStop(0, pal.paper ? '#64748b' : '#475569');
    stirGrad.addColorStop(1, pal.paper ? '#334155' : '#1e293b');
    c.fillStyle = stirGrad;
    c.beginPath(); c.roundRect(cx - 52, baseY - 32, 104, 24, 5); c.fill(); c.stroke();
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#cbd5e1'; c.lineWidth = 1;
    c.beginPath(); c.roundRect(cx - 46, baseY - 36, 92, 5, 2.5); c.fill(); c.stroke();
    c.fillStyle = stepNum >= 3 ? '#10b981' : '#64748b';
    c.beginPath(); c.arc(cx - 32, baseY - 20, 3.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f8fafc'; c.font = '700 8px Inter, sans-serif'; c.textAlign = 'center';
    c.fillText(stepNum >= 3 ? 'KHUẤY TỪ ON' : 'MÁY KHUẤY', cx, baseY - 17);

    const fy = baseY - 36;
    const traceFlask = () => {
        c.beginPath();
        c.moveTo(cx - 14, fy - 110); c.lineTo(cx - 14, fy - 76);
        c.lineTo(cx - 44, fy - 12);
        c.quadraticCurveTo(cx - 48, fy, cx - 35, fy); c.lineTo(cx + 35, fy);
        c.quadraticCurveTo(cx + 48, fy, cx + 44, fy - 12);
        c.lineTo(cx + 14, fy - 76); c.lineTo(cx + 14, fy - 110);
    };

    if (fillFrac > 0.02) {
        c.save(); traceFlask(); c.closePath(); c.clip();
        const liqH = Math.max(8, fillFrac * 68);
        const liqTopY = fy - liqH;
        const liqGrad = c.createLinearGradient(0, liqTopY, 0, fy);
        liqGrad.addColorStop(0, formatRgba(rgbaArr, 0.85));
        liqGrad.addColorStop(1, formatRgba(rgbaArr, 1.15));
        c.fillStyle = liqGrad;
        c.fillRect(cx - 50, liqTopY, 100, liqH + 2);

        if (swirlFlash > 0.02) {
            const flashRgb = indMode === 'methyl' ? '249, 115, 22' : indMode === 'litmus' ? '168, 85, 247' : indMode === 'btb' ? '37, 99, 235' : '236, 72, 153';
            const sx = cx + Math.cos(stirAngle) * 10 * swirlFlash;
            const sy = liqTopY + 14 + Math.sin(stirAngle) * 5;
            const sg = safeRadialGrad(c, sx, sy, 2, sx, sy, 32 * swirlFlash + 8);
            sg.addColorStop(0, `rgba(${flashRgb}, ${(0.72 * swirlFlash).toFixed(3)})`);
            sg.addColorStop(1, `rgba(${flashRgb}, 0)`);
            c.fillStyle = sg;
            c.fillRect(cx - 48, liqTopY - 4, 96, 60);
        }

        const topHalfW = 14 + (1 - Math.min(1, liqH / 76)) * 30;
        c.fillStyle = pal.paper ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.22)';
        c.beginPath(); c.ellipse(cx, liqTopY, topHalfW, 3.6, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = pal.paper ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.55)'; c.lineWidth = 1; c.stroke();

        for (const rp of ripples) {
            c.strokeStyle = pal.paper ? `rgba(15,23,42,${(rp.alpha*0.45).toFixed(3)})` : `rgba(255,255,255,${(rp.alpha*0.7).toFixed(3)})`;
            c.lineWidth = 1.2;
            c.beginPath(); c.ellipse(cx, liqTopY, Math.min(topHalfW - 2, rp.r), Math.max(1.5, rp.r * 0.28), 0, 0, Math.PI * 2); c.stroke();
        }
        if (stepNum >= 3) {
            const barHalf = 4 + Math.abs(Math.cos(stirAngle)) * 8.5;
            c.fillStyle = '#ffffff'; c.strokeStyle = '#64748b'; c.lineWidth = 0.9;
            c.beginPath(); c.roundRect(cx - barHalf, fy - 7, barHalf * 2, 4.5, 2.2); c.fill(); c.stroke();
        }
        c.restore();
    }

    c.strokeStyle = pal.glassStroke; c.lineWidth = 2.2;
    traceFlask(); c.stroke();
    c.beginPath(); c.ellipse(cx, fy - 110, 14.5, 3.5, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = pal.glassHighlight; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(cx - 10, fy - 102); c.lineTo(cx - 10, fy - 76); c.lineTo(cx - 36, fy - 12); c.stroke();

    c.strokeStyle = pal.glassTick; c.lineWidth = 1;
    [[fy - 22, '50'], [fy - 42, '100'], [fy - 62, '150']].forEach(([ty, lbl]) => {
        const dx = 14 + ((ty - (fy - 76)) / 64) * 30;
        c.beginPath(); c.moveTo(cx + dx - 8, ty); c.lineTo(cx + dx - 1, ty); c.stroke();
        c.fillStyle = pal.glassTick; c.font = '600 7.5px Inter, sans-serif'; c.textAlign = 'right';
        c.fillText(lbl, cx + dx - 10, ty + 2.5);
    });
    c.restore();
}

function drawRetortStandAndBurettePro(c, cx, baseY, addedMl, stepNum, stopcockOpenAmt, drops, buretText, pal) {
    c.save();
    const mounted = stepNum >= 3;
    c.globalAlpha = mounted ? 1 : 0.25;
    const rodX = cx - 80;
    const rodGrad = c.createLinearGradient(rodX - 4, 0, rodX + 4, 0);
    rodGrad.addColorStop(0, pal.rodDark); rodGrad.addColorStop(0.5, pal.rodLight); rodGrad.addColorStop(1, pal.rodDark);
    c.fillStyle = rodGrad;
    c.fillRect(rodX - 3.5, 42, 7, baseY - 50);

    c.fillStyle = '#94a3b8'; c.fillRect(rodX + 3, 94, cx - rodX - 11, 5);
    c.fillStyle = '#64748b'; c.beginPath(); c.roundRect(rodX - 6, 90, 12, 13, 3); c.fill();
    c.strokeStyle = pal.glassStroke; c.lineWidth = 1.8;
    c.beginPath(); c.roundRect(cx - 10, 91, 20, 11, 4); c.stroke();

    const bTop = 44, bBot = 160, bH = bBot - bTop;
    c.fillStyle = pal.paper ? 'rgba(186, 230, 253, 0.22)' : 'rgba(224, 242, 254, 0.14)';
    c.beginPath(); c.roundRect(cx - 7, bTop, 14, bH, 2); c.fill();

    const zeroY = bTop + 10, spanH = bH - 22;
    const menY = zeroY + Math.max(0, Math.min(1, addedMl / 50)) * spanH;
    c.fillStyle = 'rgba(56, 189, 248, 0.42)';
    c.fillRect(cx - 5.5, menY, 11, bBot - menY);
    c.strokeStyle = pal.glassStroke; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(cx - 5.5, menY); c.quadraticCurveTo(cx, menY + 2.5, cx + 5.5, menY); c.stroke();

    c.strokeStyle = pal.glassStroke; c.lineWidth = 1.6;
    c.strokeRect(cx - 7, bTop, 14, bH);
    c.strokeStyle = pal.glassTick; c.lineWidth = 0.9;
    for (let ml = 0; ml <= 50; ml += 5) {
        const ty = zeroY + (ml / 50) * spanH;
        c.beginPath(); c.moveTo(cx - 7, ty); c.lineTo(cx - 7 + (ml % 10 === 0 ? 7 : 4), ty); c.stroke();
    }

    if (mounted) {
        c.fillStyle = pal.hudBg; c.strokeStyle = pal.accentText; c.lineWidth = 1;
        c.beginPath(); c.roundRect(cx + 12, menY - 9, 54, 18, 4); c.fill(); c.stroke();
        c.fillStyle = pal.accentText; c.font = '700 9.5px ui-monospace, Menlo, monospace'; c.textAlign = 'left';
        c.fillText(`${addedMl.toFixed(1)} mL`, cx + 16, menY + 3);
    }

    c.strokeStyle = pal.glassStroke; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(cx - 6, bBot); c.lineTo(cx - 1.5, 186); c.lineTo(cx + 1.5, 186); c.lineTo(cx + 6, bBot); c.stroke();
    c.fillStyle = '#0284c7';
    c.save(); c.translate(cx, 166);
    c.rotate((1 - stopcockOpenAmt) * (Math.PI / 2) * 0.85);
    c.beginPath(); c.roundRect(-12, -3, 24, 6, 3); c.fill();
    c.restore();

    c.fillStyle = pal.accentText; c.font = '700 9.5px Inter, sans-serif'; c.textAlign = 'center';
    c.fillText(buretText, cx, bTop - 7);

    if (mounted) {
        for (const d of drops) {
            c.fillStyle = '#38bdf8';
            c.beginPath(); c.moveTo(cx, d.y - 5);
            c.quadraticCurveTo(cx + 4, d.y + 1, cx, d.y + 4);
            c.quadraticCurveTo(cx - 4, d.y + 1, cx, d.y - 5);
            c.fill();
        }
    }
    c.restore();
}

function drawTitrationCurveHUD(c, x, y, w, h, st, curPh, pal) {
    c.save();
    c.fillStyle = pal.hudBg; c.strokeStyle = pal.hudBorder; c.lineWidth = 1.2;
    c.beginPath(); c.roundRect(x, y, w, h, 12); c.fill(); c.stroke();
    c.fillStyle = pal.hudText; c.font = '800 10.5px Inter, sans-serif'; c.textAlign = 'left';
    c.fillText('ĐỒ THỊ CHUẨN ĐỘ pH', x + 12, y + 18);

    const px = x + 28, py = y + 28, pw = w - 40, phH = h - 54;
    const vEq = getTitrationEquivVolumeMl(st);
    const maxV = Math.max(35, Math.ceil(vEq * 1.6 / 5) * 5);

    const bands = { phenol: [8.1, 10.0, 'rgba(236,72,153,0.18)'], methyl: [3.1, 4.4, 'rgba(249,115,22,0.18)'], litmus: [5.0, 8.0, 'rgba(168,85,247,0.16)'], btb: [6.0, 7.6, 'rgba(16,185,129,0.18)'], universal: [6.0, 8.0, 'rgba(34,197,94,0.15)'] };
    const [bMin, bMax, bCol] = bands[st.indicator] || bands.phenol;
    c.fillStyle = bCol;
    c.fillRect(px, py + (1 - bMax / 14) * phH, pw, ((bMax - bMin) / 14) * phH);

    c.strokeStyle = pal.textMuted; c.lineWidth = 1;
    c.beginPath(); c.moveTo(px, py); c.lineTo(px, py + phH); c.lineTo(px + pw, py + phH); c.stroke();

    c.fillStyle = pal.textMuted; c.font = '600 8px ui-monospace, monospace'; c.textAlign = 'right';
    [0, 7, 14].forEach(p => c.fillText(String(p), px - 4, py + (1 - p / 14) * phH + 3));
    c.textAlign = 'center';
    c.fillText('V (mL)', px + pw * 0.5, py + phH + 15);

    const eqX = px + (Math.min(maxV, vEq) / maxV) * pw;
    c.setLineDash([3, 3]);
    c.strokeStyle = 'rgba(217, 119, 6, 0.55)';
    c.beginPath(); c.moveTo(eqX, py); c.lineTo(eqX, py + phH); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#d97706'; c.font = '700 8px ui-monospace, monospace';
    c.fillText(`TĐ:${vEq.toFixed(0)}`, Math.min(px + pw - 14, Math.max(px + 14, eqX)), py + 9);

    c.strokeStyle = pal.paper ? 'rgba(148,163,184,0.45)' : 'rgba(148, 163, 184, 0.25)'; c.lineWidth = 1.4;
    c.beginPath();
    for (let i = 0; i <= 48; i++) {
        const vv = (i / 48) * maxV;
        const pVal = computeMiniLabPHAtVolume(vv, st);
        const cxPt = px + (vv / maxV) * pw;
        const cyPt = py + (1 - Math.max(0, Math.min(14, pVal)) / 14) * phH;
        if (i === 0) c.moveTo(cxPt, cyPt); else c.lineTo(cxPt, cyPt);
    }
    c.stroke();

    c.strokeStyle = '#0ea5e9'; c.lineWidth = 2.2;
    c.beginPath();
    const stepsN = Math.max(2, Math.round((Math.min(maxV, st.addedBaseMl) / maxV) * 48));
    for (let i = 0; i <= stepsN; i++) {
        const vv = (i / stepsN) * Math.min(maxV, st.addedBaseMl);
        const pVal = computeMiniLabPHAtVolume(vv, st);
        const cxPt = px + (vv / maxV) * pw;
        const cyPt = py + (1 - Math.max(0, Math.min(14, pVal)) / 14) * phH;
        if (i === 0) c.moveTo(cxPt, cyPt); else c.lineTo(cxPt, cyPt);
    }
    c.stroke();

    const dotX = px + (Math.min(maxV, st.addedBaseMl) / maxV) * pw;
    const dotY = py + (1 - Math.max(0, Math.min(14, curPh)) / 14) * phH;
    c.fillStyle = getMiniLabTitrationColor(curPh, st);
    c.beginPath(); c.arc(dotX, dotY, 4.5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = pal.glassStroke; c.lineWidth = 1.2; c.stroke();
    c.restore();
}

function renderLabStageOnCanvas(can, st = miniLabState, anim = miniLabAnim, paperMode = false) {
    if (!can || typeof can.getContext !== 'function') return;
    const c = can.getContext('2d');
    if (!c) return;
    const w = can.clientWidth || 600;
    const h = can.clientHeight || 390;
    const dpr = Math.min(2.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 2);
    if (can.width !== Math.round(w * dpr)) can.width = Math.round(w * dpr);
    if (can.height !== Math.round(h * dpr)) can.height = Math.round(h * dpr);
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    renderLabStageOnContext(c, w, h, st, anim, paperMode);
    c.restore();
}

function renderMiniLabStage() {
    const can = document.getElementById('miniLabStageCanvas');
    renderLabStageOnCanvas(can, miniLabState, miniLabAnim, Boolean(miniLabState.paperLight));
}

function renderLabStageOnContext(c, w, h, st, anim, paperMode) {
    const pal = getLabThemePalette(paperMode);
    const scale = Math.min(w / 600, h / 390);
    const benchY = 340;
    drawLabBackdropAndBench(c, w, h, benchY, scale, pal);

    c.save();
    c.translate((w - 600 * scale) * 0.5, (h - 52 * scale) - benchY * scale);
    c.scale(scale, scale);

    if (st.exp === 'titration') {
        const sStep = st.titrationStep;
        const ph = computeMiniLabTitrationPH(st);
        const massLabel = sStep >= 1 ? `${st.acidVolMl.toFixed(1)} mL` : '0.000 g';
        const flaskCx = 294;
        drawAnalyticalBalancePro(c, 64, benchY, massLabel, `Cân mẫu ${st.acidType}`, sStep <= 1, null, pal);
        drawWashBottleAndStream(c, 146, benchY, anim.washPulse, flaskCx, 198, pal);

        const fillVal = (typeof anim.dispFill === 'number' && !miniLabAnimRaf)
            ? (sStep === 0 ? 0 : sStep === 1 ? 0.34 : Math.min(0.84, 0.52 + st.addedBaseMl / 78))
            : anim.dispFill;
        const rgbaVal = miniLabAnimRaf ? anim.dispRgba : parseRgbaArray(getMiniLabTitrationColor(ph, st));
        drawErlenmeyerAndStirrer(c, flaskCx, benchY, fillVal, rgbaVal, sStep, anim.stirAngle, anim.swirlFlash, anim.ripples, st.indicator, pal);
        const buretLbl = st.acidType === 'NaOH' ? 'HCl 0.10M' : `NaOH ${st.baseConcM.toFixed(2)}M`;
        drawRetortStandAndBurettePro(c, flaskCx, benchY, st.addedBaseMl, sStep, anim.stopcockAmt, anim.drops, buretLbl, pal);

        // Indicator dropper bottle
        c.save();
        c.fillStyle = 'rgba(146, 64, 14, 0.85)'; c.beginPath(); c.roundRect(175, benchY - 34, 18, 34, 4); c.fill();
        c.fillStyle = '#f43f5e'; c.beginPath(); c.roundRect(179, benchY - 45, 10, 11, 3); c.fill();
        c.fillStyle = '#f8fafc'; c.fillRect(177, benchY - 24, 14, 12);
        c.fillStyle = '#0f172a'; c.font = '800 6.5px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText(st.indicator.slice(0, 3).toUpperCase(), 184, benchY - 16);
        c.fillStyle = pal.textMuted; c.font = '600 8.5px Inter, sans-serif';
        c.fillText('Chỉ thị', 184, benchY + 14);
        c.restore();

        c.fillStyle = pal.textMain; c.font = '600 9.5px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText(`Bình tam giác (${st.acidType}${sStep >= 2 ? ' + H₂O' : ''}${sStep >= 4 ? ' + Chỉ thị' : ''})`, flaskCx, benchY + 14);

        if (anim.indicatorPulse > 0.05) {
            c.save();
            const dY = 186 + (1 - anim.indicatorPulse) * 44;
            c.fillStyle = st.indicator === 'phenol' ? '#f472b6' : st.indicator === 'litmus' ? '#a855f7' : '#f97316';
            c.beginPath(); c.arc(flaskCx + 10, dY, 3.8, 0, Math.PI * 2); c.fill();
            c.restore();
        }
        drawTitrationCurveHUD(c, 398, 56, 186, 178, st, ph, pal);
        c.save();
        c.fillStyle = pal.hudBg; c.strokeStyle = pal.hudBorder; c.lineWidth = 1.2;
        c.beginPath(); c.roundRect(398, 244, 186, 86, 12); c.fill(); c.stroke();
        c.fillStyle = pal.hudText; c.font = '800 10px Inter, sans-serif'; c.textAlign = 'left';
        c.fillText('BẢNG MÀU CHẤT CHỈ THỊ', 410, 261);
        const legendMap = {
            phenol: [['rgba(186,230,253,0.75)', '< 8.1', 'Không màu'], ['rgba(244,114,182,0.85)', '8.1–9.5', 'Hồng nhạt'], ['#ec4899', '> 9.5', 'Hồng đậm']],
            methyl: [['#ef4444', '< 3.1', 'Đỏ'], ['#f97316', '3.1–4.4', 'Da cam'], ['#eab308', '> 4.4', 'Vàng']],
            litmus: [['#ef4444', '< 5.0', 'Hóa đỏ'], ['#a855f7', '5.0–8.0', 'Tím'], ['#2563eb', '> 8.0', 'Hóa xanh']],
            btb:    [['#facc15', '< 6.0', 'Vàng'], ['#10b981', '6.0–7.6', 'Xanh lục'], ['#2563eb', '> 7.6', 'Xanh dương']],
            universal: [['#ef4444', 'Acid', 'Đỏ/Cam'], ['#22c55e', 'pH=7', 'Xanh lục'], ['#7e22ce', 'Kiềm', 'Lam/Tím']]
        };
        (legendMap[st.indicator] || legendMap.phenol).forEach(([col, rng, txt], idx) => {
            const yy = 278 + idx * 17;
            c.fillStyle = col; c.beginPath(); c.arc(416, yy - 3, 5, 0, Math.PI * 2); c.fill();
            c.fillStyle = pal.textMuted; c.font = '700 9px ui-monospace, monospace'; c.fillText(rng, 426, yy);
            c.fillStyle = pal.hudText; c.font = '600 9.5px Inter, sans-serif'; c.fillText(txt, 480, yy);
        });
        c.restore();
    } else if (st.exp === 'precipitate') {
        const sStep = st.precipStep;
        const pairMeta = PRECIP_PAIRS_META[st.precipPair] || PRECIP_PAIRS_META.CuSO4_NaOH;
        const isDissolved = st.precipPair === 'CaOH2_CO2' && sStep >= 4;

        c.save();
        c.fillStyle = 'rgba(180, 83, 9, 0.85)'; c.beginPath(); c.roundRect(74, benchY - 76, 48, 76, 8); c.fill();
        c.fillStyle = '#e11d48'; c.beginPath(); c.roundRect(89, benchY - 102, 18, 26, 6); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(78, benchY - 56, 40, 26, 4); c.fill();
        c.fillStyle = '#0f172a'; c.font = '800 8.5px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText(pairMeta.reagent, 98, benchY - 40);
        c.fillStyle = pal.textMuted; c.font = '600 9.5px Inter, sans-serif'; c.fillText('Thuốc thử', 98, benchY + 14);
        c.restore();

        drawWashBottleAndStream(c, 178, benchY, anim.washPulse, 290, 128, pal);

        const tx = 290, ty = benchY - 16;
        c.save();
        c.fillStyle = '#334155'; c.beginPath(); c.roundRect(tx - 54, benchY - 10, 108, 10, 4); c.fill();
        c.fillStyle = '#64748b'; c.fillRect(tx - 44, benchY - 115, 6, 106); c.fillRect(tx + 38, benchY - 115, 6, 106);
        const traceTube = () => {
            c.beginPath(); c.moveTo(tx - 24, ty - 178); c.lineTo(tx - 24, ty - 24);
            c.arc(tx, ty - 24, 24, Math.PI, 0, true); c.lineTo(tx + 24, ty - 178);
        };
        if (sStep >= 1) {
            c.save(); traceTube(); c.closePath(); c.clip();
            const liqTop = ty - (sStep >= 2 ? 128 : 88);
            c.fillStyle = pairMeta.saltCol; c.fillRect(tx - 26, liqTop, 52, ty - liqTop + 4);
            c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.ellipse(tx, liqTop, 23, 3.5, 0, 0, Math.PI * 2); c.fill();
            if (sStep >= 3 && !isDissolved) {
                c.fillStyle = pairMeta.pptCol;
                c.beginPath(); c.arc(tx, ty - 24, 23, 0, Math.PI);
                c.lineTo(tx - 23, ty - 28); c.quadraticCurveTo(tx, ty - 38, tx + 23, ty - 28); c.closePath(); c.fill();
                for (const p of anim.precipParticles) {
                    c.fillStyle = p.phase > 3.14 ? pairMeta.pptCol : pairMeta.pptHi;
                    c.beginPath(); c.arc(tx + p.x, p.y, p.size, 0, Math.PI * 2); c.fill();
                }
            }
            c.restore();
        }
        c.strokeStyle = pal.glassStroke; c.lineWidth = 2.4; traceTube(); c.stroke();
        c.beginPath(); c.ellipse(tx, ty - 178, 24.5, 4.5, 0, 0, Math.PI * 2); c.stroke();
        c.restore();

        const lx = 486, ly = 188, lr = 76;
        c.save();
        c.setLineDash([4, 4]); c.strokeStyle = pal.accentText; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(tx + 24, ty - 28); c.lineTo(lx - lr + 6, ly + 18); c.stroke();
        c.setLineDash([]);
        c.fillStyle = pal.paper ? '#f1f5f9' : '#0b1426';
        c.beginPath(); c.arc(lx, ly, lr, 0, Math.PI * 2); c.fill();
        c.save(); c.beginPath(); c.arc(lx, ly, lr - 4, 0, Math.PI * 2); c.clip();
        if (sStep >= 3 && !isDissolved) {
            c.fillStyle = pairMeta.saltCol; c.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
            for (let i = 0; i < 24; i++) {
                const px = lx + Math.sin(i * 1.9 + anim.stirAngle) * 44;
                const py = ly + 12 + Math.cos(i * 2.7) * 34;
                c.fillStyle = i % 2 === 0 ? pairMeta.pptCol : pairMeta.pptHi;
                c.beginPath(); c.arc(px, py, 5 + (i % 4) * 2.2, 0, Math.PI * 2); c.fill();
            }
        } else {
            c.fillStyle = pal.textMuted; c.font = '600 10.5px Inter, sans-serif'; c.textAlign = 'center';
            c.fillText(isDissolved ? 'Kết tủa đã tan hết!' : 'Chờ nhỏ thuốc thử...', lx, ly + 4);
        }
        c.restore();
        c.strokeStyle = '#0284c7'; c.lineWidth = 3.2; c.beginPath(); c.arc(lx, ly, lr, 0, Math.PI * 2); c.stroke();
        c.fillStyle = pal.textMain; c.font = '800 10.5px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText('SOI KÍNH LÚP ×4', lx, ly - lr - 10);
        c.fillStyle = pal.accentText; c.font = '700 10.5px Inter, sans-serif';
        c.fillText(isDissolved ? 'Ca(HCO₃)₂ (Trong suốt)' : (sStep >= 3 ? pairMeta.formula : 'Quan sát kết tủa vi mô'), lx, ly + lr + 18);
        c.restore();
    } else if (st.exp === 'gas') {
        const sStep = st.gasStep;
        const gMeta = GAS_REACTIONS_META[st.gasMetal] || GAS_REACTIONS_META.Zn;
        const nGas = (st.gasMassG / gMeta.M) * gMeta.nFactor;
        const vGasL = nGas * 24.79;
        drawAnalyticalBalancePro(c, 84, benchY, sStep >= 1 ? `${st.gasMassG.toFixed(2)} g` : '0.000 g', `Cân mẫu ${st.gasMetal}`, sStep >= 1 && sStep < 3, st.gasMetal, pal);

        if (st.gasMetal === 'Na') {
            // Wide glass trough with molten Sodium ball skating & pink Phenolphthalein trail!
            const wx = 340, wy = benchY;
            c.save();
            if (sStep >= 2) {
                c.fillStyle = 'rgba(186, 230, 253, 0.38)';
                c.fillRect(wx - 125, wy - 74, 250, 74);
                if (sStep >= 3) {
                    const trailGrad = safeRadialGrad(c, wx + anim.naX, wy - 70, 8, wx + anim.naX, wy - 56, 110 * anim.naTrail + 30);
                    trailGrad.addColorStop(0, 'rgba(236, 72, 153, 0.78)');
                    trailGrad.addColorStop(1, 'rgba(236, 72, 153, 0.14)');
                    c.fillStyle = trailGrad;
                    c.fillRect(wx - 125, wy - 74, 250, 74);
                    // Skating silver Na sphere
                    c.fillStyle = '#e2e8f0'; c.strokeStyle = '#64748b'; c.lineWidth = 1.2;
                    c.beginPath(); c.arc(wx + anim.naX, wy - 74, 7.5, 0, Math.PI * 2); c.fill(); c.stroke();
                    // Vapor puff
                    c.fillStyle = 'rgba(255,255,255,0.7)';
                    for (let i = 0; i < 6; i++) {
                        c.beginPath(); c.arc(wx + anim.naX + Math.sin(anim.stirAngle + i) * 10, wy - 86 - i * 7, 3, 0, Math.PI * 2); c.fill();
                    }
                }
            }
            c.strokeStyle = pal.glassStroke; c.lineWidth = 2.4;
            c.beginPath(); c.moveTo(wx - 125, wy - 102); c.lineTo(wx - 125, wy); c.lineTo(wx + 125, wy); c.lineTo(wx + 125, wy - 102); c.stroke();
            c.fillStyle = pal.textMain; c.font = '700 10.5px Inter, sans-serif'; c.textAlign = 'center';
            c.fillText('Chậu nước + Phenolphtalein (Na chạy trên mặt nước)', wx, wy + 15);
            c.restore();
        } else {
            const rx = 246, ry = benchY - 22;
            c.save();
            c.fillStyle = '#334155'; c.beginPath(); c.roundRect(rx - 44, benchY - 10, 88, 10, 4); c.fill();
            c.fillStyle = '#64748b'; c.fillRect(rx - 36, benchY - 165, 6, 156);
            const traceRTube = () => {
                c.beginPath(); c.moveTo(rx - 22, ry - 182); c.lineTo(rx - 22, ry - 22);
                c.arc(rx, ry - 22, 22, Math.PI, 0, true); c.lineTo(rx + 22, ry - 182);
            };
            if (sStep >= 2) {
                c.save(); traceRTube(); c.closePath(); c.clip();
                c.fillStyle = sStep >= 3 ? gMeta.solCol : 'rgba(224, 242, 254, 0.35)';
                c.fillRect(rx - 24, ry - 118, 48, 120);
                if (sStep >= 3) {
                    if (st.gasMetal === 'Cu') {
                        // Reddish-brown NO2 gas filling upper tube space!
                        const no2 = c.createLinearGradient(0, ry - 180, 0, ry - 115);
                        no2.addColorStop(0, 'rgba(180, 83, 9, 0.72)');
                        no2.addColorStop(1, 'rgba(217, 119, 6, 0.25)');
                        c.fillStyle = no2;
                        c.fillRect(rx - 22, ry - 182, 44, 65);
                    }
                    c.fillStyle = st.gasMetal === 'Cu' ? '#d97706' : (st.gasMetal === 'Fe' ? '#475569' : '#cbd5e1');
                    [[-8, -10], [0, -8], [7, -11]].forEach(([dx, dy]) => { c.beginPath(); c.arc(rx + dx, ry + dy, 4.2, 0, Math.PI * 2); c.fill(); });
                    const bubList = miniLabAnimRaf ? anim.gasBubbles : [[-6, -32, 2.5], [5, -52, 3], [-3, -76, 2.2]].map(([x, dy, r]) => ({ x, y: ry + dy, r }));
                    for (const b of bubList) {
                        c.strokeStyle = 'rgba(255,255,255,0.9)'; c.fillStyle = st.gasMetal === 'Cu' ? 'rgba(217,119,6,0.5)' : 'rgba(224,242,254,0.45)';
                        c.lineWidth = 1; c.beginPath(); c.arc(rx + b.x, b.y, b.r, 0, Math.PI * 2); c.fill(); c.stroke();
                    }
                }
                c.restore();
            }
            c.strokeStyle = pal.glassStroke; c.lineWidth = 2.2; traceRTube(); c.stroke();
            c.fillStyle = '#475569'; c.beginPath(); c.roundRect(rx - 20, ry - 194, 40, 16, 4); c.fill();
            c.strokeStyle = st.gasMetal === 'Cu' && sStep >= 3 ? 'rgba(180, 83, 9, 0.75)' : 'rgba(14, 165, 233, 0.65)'; c.lineWidth = 4.5;
            c.beginPath(); c.moveTo(rx, ry - 194); c.bezierCurveTo(rx, ry - 245, 454, ry - 245, 454, benchY - 12); c.lineTo(476, benchY - 18); c.stroke();
            c.restore();

            const cxP = 478;
            c.save();
            c.fillStyle = 'rgba(56, 189, 248, 0.24)'; c.fillRect(392, benchY - 58, 172, 58);
            c.strokeStyle = pal.glassStroke; c.lineWidth = 1.8;
            c.beginPath(); c.moveTo(392, benchY - 72); c.lineTo(392, benchY); c.lineTo(564, benchY); c.lineTo(564, benchY - 72); c.stroke();
            const cylTop = 86, cylBot = benchY - 14;
            const gasFillH = sStep >= 3 ? Math.min(148, 52 + (vGasL / 0.8) * 80) : 12;
            const waterInCylY = cylTop + gasFillH;
            c.fillStyle = sStep >= 3 ? (st.gasMetal === 'Cu' ? 'rgba(180, 83, 9, 0.45)' : 'rgba(16, 185, 129, 0.18)') : 'rgba(226, 232, 240, 0.08)';
            c.fillRect(cxP - 26, cylTop, 52, gasFillH);
            c.fillStyle = 'rgba(56, 189, 248, 0.36)'; c.fillRect(cxP - 26, waterInCylY, 52, cylBot - waterInCylY);
            if (sStep >= 3) {
                c.fillStyle = st.gasMetal === 'Cu' ? '#d97706' : '#10b981'; c.font = '800 11px Inter, sans-serif'; c.textAlign = 'center';
                c.fillText(gMeta.gasName, cxP, cylTop + gasFillH * 0.5);
                c.fillStyle = pal.textMain; c.font = '700 10px ui-monospace, monospace';
                c.fillText(`≈ ${vGasL.toFixed(3)} L`, cxP, cylTop + gasFillH * 0.5 + 15);
            }
            c.strokeStyle = pal.glassStroke; c.lineWidth = 2;
            c.beginPath(); c.moveTo(cxP - 26, cylBot); c.lineTo(cxP - 26, cylTop); c.arc(cxP, cylTop, 26, Math.PI, 0, false); c.lineTo(cxP + 26, cylBot); c.stroke();
            c.fillStyle = pal.textMuted; c.font = '600 9.5px Inter, sans-serif'; c.textAlign = 'center';
            c.fillText(`Ống thu khí ${gMeta.gasName}`, cxP, benchY + 14);
            c.restore();
        }
    } else if (st.exp === 'rutherford') {
        // Dark optical chamber even on paper so α beams & ZnS phosphor ring gleam clearly!
        const cx = 290, cy = 196, ringR = 122;
        c.save();
        c.fillStyle = '#091124'; c.strokeStyle = pal.paper ? '#475569' : '#38bdf8'; c.lineWidth = 1.6;
        c.beginPath(); c.roundRect(16, 40, 412, 294, 14); c.fill(); c.stroke();

        // Lead alpha emitter block
        c.fillStyle = '#475569'; c.strokeStyle = '#94a3b8'; c.lineWidth = 1.5;
        c.beginPath(); c.roundRect(30, cy - 26, 78, 52, 6); c.fill(); c.stroke();
        c.fillStyle = '#fbbf24'; c.font = '800 9.5px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText('Nguồn hạt α', 69, cy - 4);
        c.fillStyle = '#e2e8f0'; c.font = '700 8.5px ui-monospace, monospace';
        c.fillText('(He²⁺)', 69, cy + 10);
        // Collimated beam slit
        c.fillStyle = '#0ea5e9'; c.fillRect(108, cy - 3, 182, 6);

        // ZnS fluorescent detector screen ring (open beam entrance on left)
        c.strokeStyle = 'rgba(52, 211, 153, 0.55)'; c.lineWidth = 6;
        c.beginPath(); c.arc(cx, cy, ringR, -Math.PI + 0.35, Math.PI - 0.35); c.stroke();
        for (const fl of anim.alphaFlashes) {
            const fx = cx + Math.cos(fl.ang) * ringR, fy = cy + Math.sin(fl.ang) * ringR;
            c.fillStyle = fl.isBack ? `rgba(244,63,94,${fl.alpha.toFixed(2)})` : `rgba(52,211,153,${fl.alpha.toFixed(2)})`;
            c.beginPath(); c.arc(fx, fy, fl.isBack ? 6 : 4.2, 0, Math.PI * 2); c.fill();
        }

        // Thin Metal Foil in center
        c.strokeStyle = st.alphaTarget === 'Au' ? '#facc15' : '#cbd5e1'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(cx, cy - 42); c.lineTo(cx, cy + 42); c.stroke();
        c.fillStyle = st.alphaTarget === 'Au' ? '#fef08a' : '#e2e8f0';
        c.font = '800 9.5px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText(st.alphaTarget === 'Au' ? 'Lá Vàng (⁷⁹Au)' : 'Lá Nhôm (¹³Al)', cx, cy - 48);

        // Moving alpha particle trajectories
        for (const ap of anim.alphaParticles) {
            const col = ap.mode === 'back' ? '#f43f5e' : (ap.mode === 'deflected' ? '#fbbf24' : '#38bdf8');
            c.strokeStyle = col; c.lineWidth = 1.6;
            c.beginPath();
            ap.trail.forEach((pt, idx) => idx === 0 ? c.moveTo(pt.x, pt.y) : c.lineTo(pt.x, pt.y));
            c.lineTo(ap.x, ap.y); c.stroke();
            c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ap.x, ap.y, 2.8, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#34d399'; c.font = '700 9px Inter, sans-serif';
        c.fillText('Màn huỳnh quang ZnS', cx, cy + ringR + 15);
        c.restore();

        // Atomic Nucleus Microscopic Zoom Panel on Right
        c.save();
        c.fillStyle = pal.hudBg; c.strokeStyle = pal.hudBorder; c.lineWidth = 1.2;
        c.beginPath(); c.roundRect(438, 40, 148, 294, 12); c.fill(); c.stroke();
        c.fillStyle = pal.hudText; c.font = '800 10px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText('PHÓNG ĐẠI NGUYÊN TỬ', 512, 60);
        for (let r = 0; r < 3; r++) {
            const ny = 112 + r * 66, nx = 512;
            c.strokeStyle = 'rgba(56, 189, 248, 0.35)'; c.setLineDash([3, 3]);
            c.beginPath(); c.arc(nx, ny, 28, 0, Math.PI * 2); c.stroke();
            c.setLineDash([]);
            // Tiny dense nucleus in empty atom
            c.fillStyle = st.alphaTarget === 'Au' ? '#f59e0b' : '#94a3b8';
            c.beginPath(); c.arc(nx, ny, 4.2, 0, Math.PI * 2); c.fill();
            // Electron dots orbiting
            const ex = nx + Math.cos(anim.stirAngle + r) * 28, ey = ny + Math.sin(anim.stirAngle + r) * 28;
            c.fillStyle = '#38bdf8'; c.beginPath(); c.arc(ex, ey, 2.2, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = pal.textMuted; c.font = '600 9px Inter, sans-serif';
        c.fillText('(+) Hạt nhân cực nhỏ ở tâm', 512, 294);
        c.fillText('Không gian rỗng rất lớn', 512, 308);
        c.restore();
    } else if (st.exp === 'flame') {
        const fm = FLAME_IONS_META[st.flameIon] || FLAME_IONS_META.Na;
        const fStep = st.flameStep;
        // Bunsen burner in left optical shield
        c.save();
        c.fillStyle = '#0b1324'; c.strokeStyle = pal.hudBorder; c.lineWidth = 1.4;
        c.beginPath(); c.roundRect(22, 42, 290, 294, 14); c.fill(); c.stroke();

        // Burner base & barrel
        const bx = 148;
        c.fillStyle = '#475569'; c.beginPath(); c.roundRect(bx - 36, 316, 72, 12, 4); c.fill();
        c.fillStyle = '#94a3b8'; c.fillRect(bx - 9, 224, 18, 92);

        // Watch glass with sample salt on left
        c.strokeStyle = '#cbd5e1'; c.lineWidth = 1.8;
        c.beginPath(); c.arc(68, 306, 22, 0.25, Math.PI - 0.25); c.stroke();
        c.fillStyle = '#f8fafc'; c.fillRect(58, 315, 20, 6);
        c.fillStyle = '#e2e8f0'; c.font = '700 8.5px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText(`Muối ${st.flameIon}Cl`, 68, 296);

        if (fStep >= 1) {
            const flick = Math.sin(anim.flameFlicker) * 4;
            const fCol = fStep >= 2 ? fm.flame : '#0ea5e9';
            const cCol = fStep >= 2 ? fm.core : '#bae6fd';
            const fg = safeRadialGrad(c, bx, 175, 4, bx, 175, 65);
            fg.addColorStop(0, cCol); fg.addColorStop(0.5, fCol); fg.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = fg; c.beginPath(); c.arc(bx, 170, 65, 0, Math.PI * 2); c.fill();

            c.fillStyle = fCol;
            c.beginPath(); c.moveTo(bx - 12, 224);
            c.quadraticCurveTo(bx - 26, 170, bx + flick, 92 + Math.cos(anim.flameFlicker) * 6);
            c.quadraticCurveTo(bx + 26, 170, bx + 12, 224); c.closePath(); c.fill();

            c.fillStyle = cCol;
            c.beginPath(); c.moveTo(bx - 6, 224);
            c.quadraticCurveTo(bx - 12, 185, bx + flick * 0.5, 138);
            c.quadraticCurveTo(bx + 12, 185, bx + 6, 224); c.closePath(); c.fill();
        }
        // Platinum wire loop inserted into flame
        c.strokeStyle = '#e2e8f0'; c.lineWidth = 2;
        if (fStep >= 2) {
            c.beginPath(); c.moveTo(275, 228); c.lineTo(bx + 12, 176); c.stroke();
            c.beginPath(); c.arc(bx + 7, 174, 5, 0, Math.PI * 2); c.stroke();
        } else {
            c.beginPath(); c.moveTo(275, 255); c.lineTo(205, 265); c.stroke();
            c.beginPath(); c.arc(200, 266, 5, 0, Math.PI * 2); c.stroke();
        }
        c.restore();

        // Right: Atomic Emission Spectrum Strip (400 - 700 nm)
        c.save();
        c.fillStyle = pal.hudBg; c.strokeStyle = pal.hudBorder; c.lineWidth = 1.2;
        c.beginPath(); c.roundRect(328, 42, 256, 294, 14); c.fill(); c.stroke();
        c.fillStyle = pal.hudText; c.font = '800 10.5px Inter, sans-serif'; c.textAlign = 'left';
        c.fillText('QUANG PHỔ VẠCH PHÁT XẠ', 344, 66);
        c.fillStyle = '#090d16'; c.beginPath(); c.roundRect(344, 82, 224, 96, 8); c.fill();
        if (fStep >= 2) {
            fm.lines.forEach(ln => {
                const lx = 352 + ln.x * 208;
                c.strokeStyle = ln.col; c.lineWidth = 3.5;
                c.beginPath(); c.moveTo(lx, 90); c.lineTo(lx, 168); c.stroke();
                c.fillStyle = ln.col; c.font = '700 8.5px ui-monospace, monospace'; c.textAlign = 'center';
                c.fillText(`${ln.nm}nm`, lx, 192);
            });
        } else {
            c.fillStyle = '#94a3b8'; c.font = '600 10px Inter, sans-serif'; c.textAlign = 'center';
            c.fillText('Đưa mẫu muối vào ngọn lửa để đo phổ', 456, 134);
        }
        c.fillStyle = pal.textMuted; c.font = '600 9.5px Inter, sans-serif'; c.textAlign = 'left';
        c.fillText(`Ion đang thử: ${fm.sym}`, 344, 228);
        c.fillStyle = fm.flame; c.font = '800 13px Inter, sans-serif';
        c.fillText(fStep >= 2 ? `→ ${fm.name}` : '→ Chưa đốt mẫu', 344, 250);
        c.restore();
    } else if (st.exp === 'silver_mirror') {
        const sStep = st.silverStep;
        const hot = sStep >= 3;
        // Hot water bath beaker on heating plate + Thermometer + Reaction Test Tube!
        const cx = 294;
        c.save();
        // Hotplate base
        c.fillStyle = '#334155'; c.beginPath(); c.roundRect(cx - 88, benchY - 26, 176, 26, 5); c.fill();
        c.fillStyle = hot ? '#ef4444' : '#64748b'; c.beginPath(); c.roundRect(cx - 72, benchY - 30, 144, 4, 2); c.fill();
        const by = benchY - 30;

        // Outer water bath beaker
        c.fillStyle = 'rgba(186, 230, 253, 0.25)'; c.fillRect(cx - 64, by - 120, 128, 118);
        c.strokeStyle = pal.glassStroke; c.lineWidth = 2;
        c.beginPath(); c.moveTo(cx - 66, by - 150); c.lineTo(cx - 66, by); c.lineTo(cx + 66, by); c.lineTo(cx + 66, by - 150); c.stroke();

        // Inner Test Tube with Tollens + Sugar -> Metallic Mirror Silver coating!
        const traceST = () => {
            c.beginPath(); c.moveTo(cx - 22, by - 188); c.lineTo(cx - 22, by - 36);
            c.arc(cx, by - 36, 22, Math.PI, 0, true); c.lineTo(cx + 22, by - 188);
        };
        if (sStep >= 1) {
            c.save(); traceST(); c.closePath(); c.clip();
            c.fillStyle = 'rgba(224, 242, 254, 0.34)'; c.fillRect(cx - 24, by - 110, 48, 98);
            const coat = miniLabAnimRaf ? anim.silverCoating : (sStep >= 3 && st.silverSub !== 'sucrose' ? 1.0 : 0);
            if (coat > 0.02) {
                const mir = c.createLinearGradient(cx - 22, 0, cx + 22, 0);
                mir.addColorStop(0, `rgba(148, 163, 184, ${coat.toFixed(2)})`);
                mir.addColorStop(0.38, `rgba(248, 250, 252, ${coat.toFixed(2)})`);
                mir.addColorStop(0.7, `rgba(100, 116, 139, ${coat.toFixed(2)})`);
                mir.addColorStop(1, `rgba(226, 232, 240, ${coat.toFixed(2)})`);
                c.fillStyle = mir;
                c.fillRect(cx - 23, by - 108, 46, 98);
            }
            c.restore();
        }
        c.strokeStyle = pal.glassStroke; c.lineWidth = 2.2; traceST(); c.stroke();

        // Thermometer in water bath
        c.fillStyle = '#ef4444'; c.beginPath(); c.arc(cx + 46, by - 22, 5, 0, Math.PI * 2); c.fill();
        const tFrac = ((miniLabAnimRaf ? anim.silverTemp : (hot ? 65 : 25)) - 20) / 60;
        c.fillRect(cx + 44.5, by - 22 - tFrac * 96, 3, tFrac * 96);
        c.strokeStyle = pal.glassStroke; c.lineWidth = 1.4; c.strokeRect(cx + 42, by - 140, 8, 114);
        c.fillStyle = pal.textMain; c.font = '800 10px ui-monospace, monospace'; c.textAlign = 'left';
        c.fillText(`${Math.round(miniLabAnimRaf ? anim.silverTemp : (hot ? 65 : 25))}°C`, cx + 74, by - 88);
        c.fillStyle = pal.textMuted; c.font = '600 10px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText('Bể đun cách thủy (~65°C)', cx, benchY + 15);
        c.restore();
    } else {
        // Electrolysis DC Cell
        const isCu = st.elecSol === 'CuSO4', prog = st.elecProgress || 0, on = st.elecOn;
        const cx = 300;
        c.save();
        // DC 9V Power Box on top
        c.fillStyle = '#334155'; c.beginPath(); c.roundRect(cx - 72, 46, 144, 52, 8); c.fill();
        c.fillStyle = '#06202a'; c.beginPath(); c.roundRect(cx - 56, 58, 72, 26, 4); c.fill();
        c.fillStyle = on ? '#34d399' : '#64748b'; c.font = '700 10.5px ui-monospace, monospace'; c.textAlign = 'center';
        c.fillText(on ? 'DC 9V • 2.0A' : 'DC OFF', cx - 20, 75);
        c.fillStyle = on ? '#10b981' : '#ef4444'; c.beginPath(); c.arc(cx + 42, 71, 8, 0, Math.PI * 2); c.fill();

        // Electrolyte tank
        const tx = cx, ty = benchY - 12;
        const blueAlpha = isCu ? Math.max(0.14, 0.56 - prog * 0.42) : 0.22;
        c.fillStyle = isCu ? `rgba(37, 99, 235, ${blueAlpha.toFixed(2)})` : 'rgba(224, 242, 254, 0.34)';
        c.fillRect(tx - 108, ty - 140, 216, 140);

        if (!isCu && prog > 0.02) {
            // NaOH + Phenolphthalein turning Cathode chamber bright magenta!
            const pg = safeRadialGrad(c, tx - 56, ty - 80, 10, tx - 56, ty - 80, 95 * Math.min(1, prog * 1.4));
            pg.addColorStop(0, 'rgba(236, 72, 153, 0.85)');
            pg.addColorStop(1, 'rgba(236, 72, 153, 0.12)');
            c.fillStyle = pg; c.fillRect(tx - 108, ty - 140, 108, 140);
        }

        if (!isCu) {
            // Porous membrane diaphragm
            c.setLineDash([5, 4]); c.strokeStyle = pal.textMuted; c.lineWidth = 2;
            c.beginPath(); c.moveTo(tx, ty - 145); c.lineTo(tx, ty); c.stroke(); c.setLineDash([]);
        }
        c.strokeStyle = pal.glassStroke; c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(tx - 110, ty - 165); c.lineTo(tx - 110, ty); c.lineTo(tx + 110, ty); c.lineTo(tx + 110, ty - 165); c.stroke();

        // Cathode (-) left & Anode (+) right electrodes + wires
        c.strokeStyle = '#38bdf8'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(cx - 48, 98); c.lineTo(tx - 56, ty - 148); c.stroke();
        c.strokeStyle = '#ef4444';
        c.beginPath(); c.moveTo(cx + 48, 98); c.lineTo(tx + 56, ty - 148); c.stroke();

        // Cathode rod
        c.fillStyle = '#475569'; c.fillRect(tx - 64, ty - 148, 16, 118);
        if (isCu && prog > 0.02) {
            // Plated red metallic Copper coating!
            c.fillStyle = '#b45309';
            c.fillRect(tx - 66, ty - 120, 20, 92 * Math.min(1, prog * 1.3));
        }
        // Anode rod
        c.fillStyle = '#475569'; c.fillRect(tx + 48, ty - 148, 16, 118);

        // Bubbles on electrodes
        anim.elecBubR.forEach(b => {
            c.fillStyle = isCu ? 'rgba(255,255,255,0.8)' : 'rgba(163, 230, 53, 0.85)';
            c.beginPath(); c.arc(tx + 56 + b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
        });
        if (!isCu) {
            anim.elecBubL.forEach(b => {
                c.fillStyle = 'rgba(255,255,255,0.85)';
                c.beginPath(); c.arc(tx - 56 + b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
            });
        }
        c.fillStyle = pal.textMain; c.font = '800 10px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText(isCu ? 'Cathode (−) • Cu↓' : 'Cathode (−) • H₂↑ + OH⁻', tx - 56, benchY + 14);
        c.fillText(isCu ? 'Anode (+) • O₂↑' : 'Anode (+) • Cl₂↑', tx + 56, benchY + 14);
        c.restore();
    }

    c.restore();
}

/* ============================================================================
 * ON-PAPER INTERACTIVE LAB WIDGETS (LÀM TRỰC TIẾP TRÊN GIẤY TRẮNG)
 * ============================================================================ */
function addPaperLabWidgetToActivePage(expId = 'titration', sourceState = null) {
    const doc = typeof getDocState === 'function' ? getDocState() : null;
    if (!doc) return null;
    if (!Array.isArray(doc.labWidgets)) doc.labWidgets = [];
    if (typeof saveHistorySnapshot === 'function') saveHistorySnapshot(true);

    const wWidth = 480, wHeight = 356;
    const pgW = typeof A4_WIDTH === 'number' ? A4_WIDTH : 794;
    const pgH = typeof A4_HEIGHT === 'number' ? A4_HEIGHT : 1123;
    let spawnX = 70 + (doc.labWidgets.length % 3) * 32;
    let spawnY = 95 + (doc.labWidgets.length % 3) * 40;
    if (typeof screenToWorld === 'function' && typeof getFastCanvasRect === 'function') {
        try {
            const rect = getFastCanvasRect();
            if (rect && rect.width > 0 && rect.height > 0) {
                const centerW = screenToWorld(rect.left + rect.width * 0.5, rect.top + rect.height * 0.48);
                if (centerW && Number.isFinite(centerW.x) && Number.isFinite(centerW.y)) {
                    const offset = (doc.labWidgets.length % 3) * 26;
                    spawnX = Math.round(Math.max(20, Math.min(pgW - wWidth - 20, centerW.x - wWidth * 0.5 + offset)));
                    spawnY = Math.round(Math.max(20, Math.min(pgH - wHeight - 20, centerW.y - wHeight * 0.5 + offset)));
                }
            }
        } catch (_) {}
    }

    const wObj = {
        id: genId('plab'),
        x: spawnX,
        y: spawnY,
        w: wWidth,
        h: wHeight,
        locked: false,
        darkStage: false,
        state: sourceState ? JSON.parse(JSON.stringify(sourceState)) : createMiniLabState(expId)
    };
    wObj.state.paperLight = true;
    doc.labWidgets.push(wObj);
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    if (window.unifiedTool === 'chem_lab' && typeof selectPillPenMode === 'function') {
        selectPillPenMode('ballpoint');
    }
    syncPaperLabWidgets();
    ensureLabAnimLoopRunning();
    if (typeof persistLibrary === 'function') persistLibrary();
    if (typeof showGestureToast === 'function') showGestureToast('📄 Đã đặt bảng Thí nghiệm trực tiếp lên trang giấy!');
    return wObj;
}

function placeCurrentMiniLabOnWhitePaper() {
    const cloned = JSON.parse(JSON.stringify(miniLabState));
    closeMiniChemLab();
    addPaperLabWidgetToActivePage(cloned.exp, cloned);
}

function syncPaperLabWidgets() {
    const layer = document.getElementById('paperLabLayer');
    if (!layer) return;
    const nb = typeof getActiveNotebook === 'function' ? getActiveNotebook() : null;
    if (!nb || !Array.isArray(nb.pages)) { layer.innerHTML = ''; return; }
    const actIdx = nb.activePageIndex || 0;
    const pg = nb.pages[actIdx];
    const widgets = (pg && pg.content && Array.isArray(pg.content.labWidgets)) ? pg.content.labWidgets : [];
    const curIds = new Set(widgets.map(w => w.id));

    // Remove stale widget DOM elements
    Array.from(layer.children || []).forEach(el => {
        if (!curIds.has(el.dataset?.widgetId) && typeof el.remove === 'function') el.remove();
    });

    if (widgets.length === 0) return;
    const box = typeof getPageLayoutBox === 'function' ? getPageLayoutBox(actIdx) : { x: 0, y: 0 };
    const sxBase = (typeof panX === 'number' ? panX : 0) + box.x * (typeof zoom === 'number' ? zoom : 1);
    const syBase = (typeof panY === 'number' ? panY : 0) + box.y * (typeof zoom === 'number' ? zoom : 1);
    const z = typeof zoom === 'number' ? zoom : 1;

    widgets.forEach(wObj => {
        let el = document.getElementById('paperLabCard_' + wObj.id);
        if (!el) {
            el = buildPaperLabWidgetDOM(wObj);
            if (typeof layer.appendChild === 'function') layer.appendChild(el);
        }
        el.classList.toggle('is-locked', Boolean(wObj.locked));
        el.classList.toggle('is-dark-stage', Boolean(wObj.darkStage));
        el.style.width = `${wObj.w}px`;
        el.style.height = `${wObj.h}px`;
        const sx = sxBase + wObj.x * z;
        const sy = syBase + wObj.y * z;
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) scale(${z.toFixed(4)})`;
        updateSinglePaperWidgetUI(wObj.id);
        const can = document.getElementById('paperLabCan_' + wObj.id);
        if (can) renderLabStageOnCanvas(can, wObj.state, getOrCreateWidgetAnim(wObj.id), !wObj.darkStage);
    });
}

function findPaperLabWidgetById(wId) {
    const doc = typeof getDocState === 'function' ? getDocState() : null;
    if (!doc || !Array.isArray(doc.labWidgets)) return null;
    return doc.labWidgets.find(w => w.id === wId) || null;
}

function buildPaperLabWidgetDOM(wObj) {
    const el = document.createElement('div');
    el.id = 'paperLabCard_' + wObj.id;
    el.dataset.widgetId = wObj.id;
    el.className = 'paper-lab-widget';
    el.setAttribute('onpointerdown', 'event.stopPropagation()');
    el.setAttribute('onclick', 'event.stopPropagation()');
    el.innerHTML = `
        <div class="paper-lab-head" onpointerdown="startPaperLabDrag(event, '${wObj.id}')">
            <div class="flex items-center gap-1.5 min-w-0">
                <span class="opacity-60 text-xs">⠿</span>
                <select class="paper-lab-select" onpointerdown="event.stopPropagation()" onchange="setPaperLabExp('${wObj.id}', this.value)">
                    <option value="titration">⚗️ Chuẩn độ Acid–Base</option>
                    <option value="precipitate">🧪 Kết tủa (8 cặp)</option>
                    <option value="gas">🫧 Kim loại + Acid / H₂O</option>
                    <option value="rutherford">⚛️ Bắn phá α (Rutherford)</option>
                    <option value="flame">🔥 Màu ngọn lửa ion</option>
                    <option value="silver_mirror">🪞 Tráng bạc Tollens</option>
                    <option value="electrolysis">⚡ Điện phân dung dịch</option>
                </select>
            </div>
            <div class="flex items-center gap-1">
                <button class="paper-lab-hbtn" onclick="resetPaperLabWidget('${wObj.id}')" title="Làm lại">↺</button>
                <button class="paper-lab-hbtn" onclick="togglePaperLabDark('${wObj.id}')" title="Đổi nền Sáng / Tối">🌓</button>
                <button class="paper-lab-hbtn" onclick="togglePaperLabLock('${wObj.id}')" title="Khóa vị trí">🔒</button>
                <button class="paper-lab-hbtn" onclick="openPaperLabInModal('${wObj.id}')" title="Mở lớn">⛶</button>
                <button class="paper-lab-hbtn text-rose-500" onclick="removePaperLabWidget('${wObj.id}')" title="Xóa khỏi giấy">✕</button>
            </div>
        </div>
        <div id="paperLabChips_${wObj.id}" class="paper-lab-chips no-scrollbar" onpointerdown="event.stopPropagation()"></div>
        <div class="paper-lab-stage">
            <canvas id="paperLabCan_${wObj.id}" class="paper-lab-canvas" onclick="clickPaperLabCanvas(event, '${wObj.id}')"></canvas>
            <div id="paperLabTele_${wObj.id}" class="paper-lab-tele"></div>
        </div>
        <div id="paperLabFoot_${wObj.id}" class="paper-lab-foot" onpointerdown="event.stopPropagation()"></div>
        <div class="paper-lab-resize" onpointerdown="startPaperLabResize(event, '${wObj.id}')" title="Kéo đổi cỡ">◢</div>
    `;
    return el;
}

function updateSinglePaperWidgetUI(wId) {
    const wObj = findPaperLabWidgetById(wId);
    if (!wObj) return;
    const st = wObj.state;
    const el = document.getElementById('paperLabCard_' + wId);
    if (!el) return;
    const sel = el.querySelector('.paper-lab-select');
    if (sel && sel.value !== st.exp) sel.value = st.exp;

    const chips = document.getElementById('paperLabChips_' + wId);
    const tele = document.getElementById('paperLabTele_' + wId);
    const foot = document.getElementById('paperLabFoot_' + wId);
    const meta = getMiniLabEqAndTelemetry(st);

    if (tele) {
        let th = '<div class="flex items-center gap-1 flex-wrap">';
        meta.pills.forEach(p => { th += `<span class="paper-lab-tpill">${p.lbl}: ${p.val}</span>`; });
        th += '</div>';
        if (meta.swatch) th += `<span class="paper-lab-tpill flex items-center gap-1"><span class="mini-lab-swatch" style="width:9px;height:9px;background:${meta.swatch.col};"></span>${meta.swatch.txt}</span>`;
        tele.innerHTML = th;
    }
    if (chips) {
        if (st.exp === 'titration') {
            chips.innerHTML = ['HCl', 'H2SO4', 'CH3COOH', 'NaOH'].map(a => `<button class="paper-lab-chip ${st.acidType===a?'active':''}" onclick="setPaperLabCfg('${wId}','acidType','${a}')">${a}</button>`).join('')
                + '<span class="opacity-40 px-0.5">|</span>'
                + [['phenol','PP'],['methyl','MO'],['litmus','Quỳ'],['btb','BTB'],['universal','pH']].map(([k,l]) => `<button class="paper-lab-chip ${st.indicator===k?'active':''}" onclick="setPaperLabCfg('${wId}','indicator','${k}')">${l}</button>`).join('');
        } else if (st.exp === 'precipitate') {
            chips.innerHTML = Object.keys(PRECIP_PAIRS_META).map(k => `<button class="paper-lab-chip ${st.precipPair===k?'active':''}" onclick="setPaperLabCfg('${wId}','precipPair','${k}')">${k.replace('_','+')}</button>`).join('');
        } else if (st.exp === 'gas') {
            chips.innerHTML = Object.entries(GAS_REACTIONS_META).map(([k,m]) => `<button class="paper-lab-chip ${st.gasMetal===k?'active':''}" onclick="setPaperLabCfg('${wId}','gasMetal','${k}')">${m.label}</button>`).join('');
        } else if (st.exp === 'rutherford') {
            chips.innerHTML = `<button class="paper-lab-chip ${st.alphaTarget==='Au'?'active':''}" onclick="setPaperLabCfg('${wId}','alphaTarget','Au')">Lá Vàng ⁷⁹Au</button><button class="paper-lab-chip ${st.alphaTarget==='Al'?'active':''}" onclick="setPaperLabCfg('${wId}','alphaTarget','Al')">Lá Nhôm ¹³Al</button>`;
        } else if (st.exp === 'flame') {
            chips.innerHTML = Object.entries(FLAME_IONS_META).map(([k,fm]) => `<button class="paper-lab-chip ${st.flameIon===k?'active':''}" onclick="setPaperLabCfg('${wId}','flameIon','${k}')">${k}⁺</button>`).join('');
        } else if (st.exp === 'silver_mirror') {
            chips.innerHTML = [['glucose','Glucozơ'],['hcho','HCHO'],['sucrose','Saccarozơ']].map(([k,l]) => `<button class="paper-lab-chip ${st.silverSub===k?'active':''}" onclick="setPaperLabCfg('${wId}','silverSub','${k}')">${l}</button>`).join('');
        } else {
            chips.innerHTML = `<button class="paper-lab-chip ${st.elecSol==='CuSO4'?'active':''}" onclick="setPaperLabCfg('${wId}','elecSol','CuSO4')">CuSO₄</button><button class="paper-lab-chip ${st.elecSol==='NaCl'?'active':''}" onclick="setPaperLabCfg('${wId}','elecSol','NaCl')">NaCl (Màng ngăn)</button>`;
        }
    }
    if (foot) {
        let btns = '';
        if (st.exp === 'titration') {
            if (st.titrationStep < 4) btns = `<button class="paper-lab-act-btn" onclick="stepPaperLab('${wId}',${st.titrationStep+1})">Bước ${st.titrationStep+1}/4 ▶</button>`;
            else {
                const anim = getOrCreateWidgetAnim(wId);
                btns = `<button class="paper-lab-act-btn" onclick="dripPaperLab('${wId}',0.05)">+1 giọt</button><button class="paper-lab-act-btn sec" onclick="dripPaperLab('${wId}',0.5)">+0.5mL</button><button class="paper-lab-act-btn sec" onclick="togglePaperAutoDrip('${wId}')">${anim.autoDrip?'⏸':'▶ Tự'}</button><button class="paper-lab-act-btn sec" onclick="jumpPaperEq('${wId}')">TĐ</button>`;
            }
        } else if (st.exp === 'precipitate') {
            const maxS = st.precipPair === 'CaOH2_CO2' ? 4 : 3;
            const nx = Math.min(maxS, st.precipStep + 1);
            btns = `<button class="paper-lab-act-btn" onclick="stepPaperLab('${wId}',${nx})">${st.precipStep >= maxS ? 'Lặp lại bước 3' : `Bước ${nx}/${maxS} ▶`}</button>`;
        } else if (st.exp === 'gas') {
            const nx = Math.min(3, st.gasStep + 1);
            btns = `<button class="paper-lab-act-btn" onclick="stepPaperLab('${wId}',${nx})">${st.gasStep >= 3 ? 'Thả mẫu mới' : `Bước ${nx}/3 ▶`}</button>`;
        } else if (st.exp === 'rutherford') {
            btns = `<button class="paper-lab-act-btn" onclick="stepPaperLab('${wId}',${st.alphaAuto ? 0 : 1})">${st.alphaAuto ? '⏸ Dừng α' : '▶ Bắn α'}</button><button class="paper-lab-act-btn sec" onclick="burstPaperAlpha('${wId}')">+25 α</button>`;
        } else if (st.exp === 'flame') {
            btns = `<button class="paper-lab-act-btn" onclick="stepPaperLab('${wId}',${st.flameStep >= 2 ? 0 : st.flameStep + 1})">${st.flameStep >= 2 ? 'Tắt lửa' : st.flameStep === 1 ? 'Đốt mẫu Pt 🔥' : 'Bật đèn 🔥'}</button>`;
        } else if (st.exp === 'silver_mirror') {
            const nx = Math.min(3, st.silverStep + 1);
            btns = `<button class="paper-lab-act-btn" onclick="stepPaperLab('${wId}',${nx})">${st.silverStep >= 3 ? 'Đang tráng 65°C' : `Bước ${nx}/3 ▶`}</button>`;
        } else {
            btns = `<button class="paper-lab-act-btn" onclick="stepPaperLab('${wId}',${st.elecOn ? 0 : 1})">${st.elecOn ? '⏸ Ngắt DC' : '⚡ Bật điện phân'}</button>`;
        }
        foot.innerHTML = `<span class="paper-lab-eq" title="${meta.eq}">${meta.eq}</span><div class="flex items-center gap-1">${btns}</div>`;
    }
}

function setPaperLabExp(wId, expId) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    wObj.state.exp = expId;
    applyResetOnLabState(wObj.state, getOrCreateWidgetAnim(wId));
    updateSinglePaperWidgetUI(wId);
    if (typeof persistLibrary === 'function') persistLibrary();
}
function setPaperLabCfg(wId, k, v) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    miniLabSetConfig(k, v, wObj.state, getOrCreateWidgetAnim(wId));
    updateSinglePaperWidgetUI(wId);
    if (typeof persistLibrary === 'function') persistLibrary();
}
function stepPaperLab(wId, n) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    miniLabStepAction(n, wObj.state, getOrCreateWidgetAnim(wId));
    updateSinglePaperWidgetUI(wId);
    if (typeof persistLibrary === 'function') persistLibrary();
}
function dripPaperLab(wId, d) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    miniLabTitrateAdd(d, wObj.state, getOrCreateWidgetAnim(wId));
    updateSinglePaperWidgetUI(wId);
}
function togglePaperAutoDrip(wId) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    toggleMiniLabAutoDrip(wObj.state, getOrCreateWidgetAnim(wId));
    updateSinglePaperWidgetUI(wId);
}
function jumpPaperEq(wId) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    jumpNearEquivalencePoint(wObj.state, getOrCreateWidgetAnim(wId));
    updateSinglePaperWidgetUI(wId);
}
function burstPaperAlpha(wId) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    fireRutherfordBurst(25, wObj.state, getOrCreateWidgetAnim(wId));
}
function resetPaperLabWidget(wId) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    applyResetOnLabState(wObj.state, getOrCreateWidgetAnim(wId));
    updateSinglePaperWidgetUI(wId);
    if (typeof persistLibrary === 'function') persistLibrary();
}
function togglePaperLabDark(wId) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    wObj.darkStage = !wObj.darkStage;
    syncPaperLabWidgets();
    if (typeof persistLibrary === 'function') persistLibrary();
}
function togglePaperLabLock(wId) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    wObj.locked = !wObj.locked;
    syncPaperLabWidgets();
    if (typeof persistLibrary === 'function') persistLibrary();
}
function openPaperLabInModal(wId) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    miniLabState = JSON.parse(JSON.stringify(wObj.state));
    openMiniChemLab(miniLabState.exp);
}
function removePaperLabWidget(wId) {
    const doc = typeof getDocState === 'function' ? getDocState() : null;
    if (!doc || !Array.isArray(doc.labWidgets)) return;
    if (typeof saveHistorySnapshot === 'function') saveHistorySnapshot(true);
    doc.labWidgets = doc.labWidgets.filter(w => w.id !== wId);
    paperLabAnims.delete(wId);
    syncPaperLabWidgets();
    if (typeof persistLibrary === 'function') persistLibrary();
}
function clickPaperLabCanvas(event, wId) {
    const wObj = findPaperLabWidgetById(wId); if (!wObj) return;
    const can = document.getElementById('paperLabCan_' + wId);
    const rect = can && can.getBoundingClientRect ? can.getBoundingClientRect() : { left: 0, width: 480 };
    const relX = rect.width ? (event.clientX - rect.left) / rect.width : 0.5;
    handleLabStageInteraction(relX, wObj.state, getOrCreateWidgetAnim(wId));
    updateSinglePaperWidgetUI(wId);
}

function startPaperLabDrag(event, wId) {
    event.stopPropagation();
    const wObj = findPaperLabWidgetById(wId);
    if (!wObj || wObj.locked) return;
    const startX = event.clientX, startY = event.clientY, origX = wObj.x, origY = wObj.y;
    const z = typeof zoom === 'number' ? zoom : 1;
    const maxW = typeof A4_WIDTH === 'number' ? A4_WIDTH : 794;
    const maxH = typeof A4_HEIGHT === 'number' ? A4_HEIGHT : 1123;
    const onMove = (mv) => {
        wObj.x = Math.max(0, Math.min(Math.max(0, maxW - (wObj.w || 340)), Math.round(origX + (mv.clientX - startX) / z)));
        wObj.y = Math.max(0, Math.min(Math.max(0, maxH - (wObj.h || 240)), Math.round(origY + (mv.clientY - startY) / z)));
        syncPaperLabWidgets();
    };
    const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (typeof persistLibrary === 'function') persistLibrary();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
}

function startPaperLabResize(event, wId) {
    event.stopPropagation();
    const wObj = findPaperLabWidgetById(wId);
    if (!wObj || wObj.locked) return;
    const startX = event.clientX, startY = event.clientY, origW = wObj.w, origH = wObj.h;
    const z = typeof zoom === 'number' ? zoom : 1;
    const onMove = (mv) => {
        wObj.w = Math.max(330, Math.min(760, Math.round(origW + (mv.clientX - startX) / z)));
        wObj.h = Math.max(250, Math.min(580, Math.round(origH + (mv.clientY - startY) / z)));
        syncPaperLabWidgets();
    };
    const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (typeof persistLibrary === 'function') persistLibrary();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
}

function drawPaperLabWidgetOnExportCtx(c, wObj) {
    if (!c || !wObj) return;
    c.save();
    c.translate(wObj.x, wObj.y);
    c.fillStyle = wObj.darkStage ? '#0f172a' : '#ffffff';
    c.strokeStyle = '#cbd5e1'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(0, 0, wObj.w, wObj.h, 12); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(0, 0, wObj.w, wObj.h, 12); c.clip();
    renderLabStageOnContext(c, wObj.w, wObj.h - 32, wObj.state, getOrCreateWidgetAnim(wObj.id), !wObj.darkStage);
    const meta = getMiniLabEqAndTelemetry(wObj.state);
    c.fillStyle = wObj.darkStage ? '#1e293b' : '#f1f5f9';
    c.fillRect(0, wObj.h - 32, wObj.w, 32);
    c.fillStyle = wObj.darkStage ? '#38bdf8' : '#0369a1';
    c.font = '700 11px Inter, sans-serif'; c.textAlign = 'left';
    c.fillText(meta.eq, 12, wObj.h - 12);
    c.restore();
}

function pasteMiniLabSnapshotToPage() {
    const can = document.getElementById('miniLabStageCanvas');
    let dataUrl = '';
    let outW = 600, outH = 396;
    if (can && typeof can.toDataURL === 'function') {
        try {
            if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
                const expCan = document.createElement('canvas');
                expCan.width = 960; expCan.height = 680;
                const ec = expCan.getContext && expCan.getContext('2d');
                if (ec) {
                    const meta = getMiniLabEqAndTelemetry(miniLabState);
                    ec.fillStyle = miniLabState.paperLight ? '#ffffff' : '#0b1326';
                    ec.fillRect(0, 0, 960, 680);
                    ec.drawImage(can, 0, 0, 960, 600);
                    ec.fillStyle = miniLabState.paperLight ? '#f1f5f9' : '#1e293b';
                    ec.fillRect(0, 600, 960, 80);
                    ec.fillStyle = miniLabState.paperLight ? '#0369a1' : '#38bdf8';
                    ec.font = '800 21px Inter, sans-serif';
                    ec.fillText(meta.eq, 24, 646);
                    dataUrl = expCan.toDataURL('image/png');
                    outW = 480; outH = 340;
                }
            }
            if (!dataUrl) dataUrl = can.toDataURL('image/png');
        } catch (_) {}
    }
    if (!dataUrl || dataUrl.length < 30) {
        dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="100%" height="100%" fill="#ffffff"/></svg>');
    }
    if (typeof isReadMode !== 'undefined' && isReadMode) toggleReadMode(false);
    if (typeof insertDataUrlImageToPage === 'function') {
        insertDataUrlImageToPage(dataUrl, outW, outH, { fromExam: true, locked: false });
    }
    closeMiniChemLab();
    if (typeof showGestureToast === 'function') showGestureToast('📌 Đã dán sơ đồ thí nghiệm vào trang vở!');
}

// ============================================================================
// SECTION 9: ỦNG HỘ APP (VIETQR BIDV) & NHÓM ZALO CỘNG ĐỒNG CHEMNOTE
// ============================================================================

const CHEMNOTE_DONATE_INFO = {
    bank: 'BIDV (VietQR · NAPAS 247)',
    accountName: 'TRAN ANH KHOA',
    accountNo: '8858164966',
    note: 'Ung ho ChemNotes',
    qrImg: 'icons/qr-donate-bidv.jpg'
};

const CHEMNOTE_COMMUNITY_ZALO = {
    groupName: 'Cộng đồng chemnote',
    url: 'https://zalo.me/g/ajje0yq5ovi633nzutfz',
    qrImg: 'icons/qr-zalo-community.jpg'
};

function copySupportText(text, toastMsg = 'Đã sao chép!') {
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(String(text)).catch(() => {});
        }
    } catch (_) {}
    if (typeof showGestureToast === 'function') {
        showGestureToast(toastMsg);
    }
}

function renderSupportCommunityUI(containerId, focusTab = 'all') {
    const el = document.getElementById(containerId);
    if (!el) return;
    const f = (focusTab === 'donate' || focusTab === 'zalo') ? focusTab : 'all';
    const donateHl = f === 'donate' ? ' is-highlighted-donate order-first md:order-none' : '';
    const zaloHl = f === 'zalo' ? ' is-highlighted-zalo order-first md:order-none' : '';

    el.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div class="text-[11.5px]" style="color:var(--text-muted);">
                Chọn quét mã <b style="color:var(--text-main);">QR trực tiếp</b> bằng camera/app Ngân hàng &amp; Zalo hoặc bấm nút sao chép / mở liên kết nhanh:
            </div>
            <div class="flex items-center gap-1.5">
                <button type="button" onclick="renderSupportCommunityUI('${containerId}', 'all')" class="px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition ${f === 'all' ? 'bg-sky-500/20 border-sky-400/60 text-sky-300' : 'bg-black/20 border-white/10 text-slate-400'}">Xem cả 2</button>
                <button type="button" onclick="renderSupportCommunityUI('${containerId}', 'donate')" class="px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition ${f === 'donate' ? 'bg-rose-500/20 border-rose-400/60 text-rose-200' : 'bg-black/20 border-white/10 text-slate-400'}">❤️ Ủng hộ</button>
                <button type="button" onclick="renderSupportCommunityUI('${containerId}', 'zalo')" class="px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition ${f === 'zalo' ? 'bg-sky-500/20 border-sky-400/60 text-sky-200' : 'bg-black/20 border-white/10 text-slate-400'}">💬 Nhóm Zalo</button>
            </div>
        </div>

        <div class="support-community-grid">
            <div class="support-card${donateHl}">
                <div class="flex items-center justify-between gap-2">
                    <div class="font-extrabold text-[13px] text-rose-300">☕ Ủng hộ app nếu bạn thấy hay</div>
                    <span class="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/40 text-rose-200 text-[10px] font-extrabold">Tùy tâm ❤️</span>
                </div>
                <p class="text-[11px] leading-relaxed" style="color:var(--text-muted);">
                    Nếu ChemNotes giúp việc ghi chép, vẽ công thức &amp; giảng dạy của bạn mượt mà hơn, bạn có thể mời tác giả 1 ly cà phê duy trì máy chủ qua <b style="color:var(--text-main);">BIDV VietQR</b> nhé!
                </p>
                <div class="qr-showcase-card">
                    <img src="${CHEMNOTE_DONATE_INFO.qrImg}" alt="Mã QR BIDV VietQR ủng hộ ChemNotes - TRAN ANH KHOA 8858164966" class="qr-showcase-img" loading="lazy" />
                </div>
                <div class="space-y-1.5 text-[11.5px]">
                    <div class="support-info-row">
                        <span style="color:var(--text-muted);">Ngân hàng</span>
                        <span class="font-extrabold" style="color:var(--text-main);">${CHEMNOTE_DONATE_INFO.bank}</span>
                    </div>
                    <div class="support-info-row">
                        <span style="color:var(--text-muted);">Chủ tài khoản</span>
                        <span class="font-extrabold text-amber-300 select-all">${CHEMNOTE_DONATE_INFO.accountName}</span>
                    </div>
                    <div class="support-info-row">
                        <span style="color:var(--text-muted);">Số tài khoản</span>
                        <div class="flex items-center gap-2">
                            <code class="font-black text-[13px] text-emerald-300 select-all">${CHEMNOTE_DONATE_INFO.accountNo}</code>
                            <button type="button" onclick="copySupportText('${CHEMNOTE_DONATE_INFO.accountNo}', '✅ Đã sao chép STK BIDV: ${CHEMNOTE_DONATE_INFO.accountNo}')" class="support-copy-btn">📋 Copy</button>
                        </div>
                    </div>
                    <div class="support-info-row">
                        <span style="color:var(--text-muted);">Nội dung</span>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-200 select-all">${CHEMNOTE_DONATE_INFO.note}</span>
                            <button type="button" onclick="copySupportText('${CHEMNOTE_DONATE_INFO.note}', '✅ Đã sao chép nội dung chuyển khoản!')" class="support-copy-btn">📋 Copy</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="support-card${zaloHl}">
                <div class="flex items-center justify-between gap-2">
                    <div class="font-extrabold text-[13px] text-sky-300">💬 Nhóm Zalo: ${CHEMNOTE_COMMUNITY_ZALO.groupName}</div>
                    <span class="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/40 text-sky-200 text-[10px] font-extrabold">Cộng đồng</span>
                </div>
                <p class="text-[11px] leading-relaxed" style="color:var(--text-muted);">
                    Tham gia nhóm để nhận bản cập nhật mới sớm nhất, trao đổi mẹo sử dụng trên iPad/PC, chia sẻ học liệu Hóa học &amp; góp ý trực tiếp cho tác giả.
                </p>
                <div class="qr-showcase-card">
                    <img src="${CHEMNOTE_COMMUNITY_ZALO.qrImg}" alt="Mã QR vào nhóm Zalo Cộng đồng chemnote" class="qr-showcase-img" loading="lazy" />
                </div>
                <div class="space-y-2">
                    <a href="${CHEMNOTE_COMMUNITY_ZALO.url}" target="_blank" rel="noopener noreferrer" class="support-link-box" title="Bấm để mở nhóm Zalo Cộng đồng chemnote">
                        ${CHEMNOTE_COMMUNITY_ZALO.url}
                    </a>
                    <div class="flex items-center gap-2">
                        <a href="${CHEMNOTE_COMMUNITY_ZALO.url}" target="_blank" rel="noopener noreferrer" class="flex-1 h-9 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-[11.5px] flex items-center justify-center gap-1.5 shadow-lg transition no-underline">
                            💬 Vào Nhóm Zalo Ngay
                        </a>
                        <button type="button" onclick="copySupportText('${CHEMNOTE_COMMUNITY_ZALO.url}', '✅ Đã sao chép link nhóm Zalo Cộng đồng!')" class="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-[11px] font-bold whitespace-nowrap transition">
                            📋 Copy Link
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function openSupportCommunityModal(focusTab = 'all') {
    closeAllPopovers();
    renderSupportCommunityUI('supportCommunityBody', focusTab);
    document.getElementById('supportCommunityModal')?.classList.remove('hidden');
}

function closeSupportCommunityModal() {
    document.getElementById('supportCommunityModal')?.classList.add('hidden');
}

function openWindowsDownloadModal() {
    closeAllPopovers();
    document.getElementById('windowsDownloadModal')?.classList.remove('hidden');
}

function closeWindowsDownloadModal() {
    document.getElementById('windowsDownloadModal')?.classList.add('hidden');
}

window.openWindowsDownloadModal = openWindowsDownloadModal;
window.closeWindowsDownloadModal = closeWindowsDownloadModal;

// ============================================================================
// SECTION 10: BẢNG TUẦN HOÀN 118 NGUYÊN TỐ & MÁY TÍNH PHÂN TỬ KHỐI (M)
// ============================================================================

// Định dạng nén gọn: Z|Ký hiệu|Tên IUPAC (Tên Việt)|M phổ thông|M chính xác|Cột|Hàng|Nhóm màu|Độ âm điện|Hóa trị/OXH|Cấu hình e
const PERIODIC_RAW_LIST = [
    '1|H|Hydrogen (Hiđro)|1|1.008|1|1|nonmetal|2.20|+1, -1|1s¹',
    '2|He|Helium (Heli)|4|4.003|18|1|noble|—|0|1s²',
    '3|Li|Lithium (Liti)|7|6.94|1|2|alkali|0.98|+1|[He] 2s¹',
    '4|Be|Beryllium (Beri)|9|9.012|2|2|alkearth|1.57|+2|[He] 2s²',
    '5|B|Boron (Bo)|11|10.81|13|2|metalloid|2.04|+3|[He] 2s²2p¹',
    '6|C|Carbon (Cacbon)|12|12.011|14|2|nonmetal|2.55|-4..+4|[He] 2s²2p²',
    '7|N|Nitrogen (Nitơ)|14|14.007|15|2|nonmetal|3.04|-3..+5|[He] 2s²2p³',
    '8|O|Oxygen (Oxi)|16|15.999|16|2|nonmetal|3.44|-2|[He] 2s²2p⁴',
    '9|F|Fluorine (Flo)|19|18.998|17|2|halogen|3.98|-1|[He] 2s²2p⁵',
    '10|Ne|Neon|20|20.18|18|2|noble|—|0|[He] 2s²2p⁶',
    '11|Na|Sodium (Natri)|23|22.99|1|3|alkali|0.93|+1|[Ne] 3s¹',
    '12|Mg|Magnesium (Magie)|24|24.305|2|3|alkearth|1.31|+2|[Ne] 3s²',
    '13|Al|Aluminium (Nhôm)|27|26.982|13|3|postmetal|1.61|+3|[Ne] 3s²3p¹',
    '14|Si|Silicon (Silic)|28|28.085|14|3|metalloid|1.90|+4|[Ne] 3s²3p²',
    '15|P|Phosphorus (Photpho)|31|30.974|15|3|nonmetal|2.19|-3,+3,+5|[Ne] 3s²3p³',
    '16|S|Sulfur (Lưu huỳnh)|32|32.06|16|3|nonmetal|2.58|-2,+4,+6|[Ne] 3s²3p⁴',
    '17|Cl|Chlorine (Clo)|35.5|35.45|17|3|halogen|3.16|-1..+7|[Ne] 3s²3p⁵',
    '18|Ar|Argon (Agon)|40|39.95|18|3|noble|—|0|[Ne] 3s²3p⁶',
    '19|K|Potassium (Kali)|39|39.098|1|4|alkali|0.82|+1|[Ar] 4s¹',
    '20|Ca|Calcium (Canxi)|40|40.078|2|4|alkearth|1.00|+2|[Ar] 4s²',
    '21|Sc|Scandium (Scandi)|45|44.956|3|4|transition|1.36|+3|[Ar] 3d¹4s²',
    '22|Ti|Titanium (Titan)|48|47.867|4|4|transition|1.54|+2,+3,+4|[Ar] 3d²4s²',
    '23|V|Vanadium (Vanadi)|51|50.942|5|4|transition|1.63|+2..+5|[Ar] 3d³4s²',
    '24|Cr|Chromium (Crom)|52|51.996|6|4|transition|1.66|+2,+3,+6|[Ar] 3d⁵4s¹',
    '25|Mn|Manganese (Mangan)|55|54.938|7|4|transition|1.55|+2,+4,+7|[Ar] 3d⁵4s²',
    '26|Fe|Iron (Sắt)|56|55.845|8|4|transition|1.83|+2, +3|[Ar] 3d⁶4s²',
    '27|Co|Cobalt (Coban)|59|58.933|9|4|transition|1.88|+2, +3|[Ar] 3d⁷4s²',
    '28|Ni|Nickel (Niken)|59|58.693|10|4|transition|1.91|+2|[Ar] 3d⁸4s²',
    '29|Cu|Copper (Đồng)|64|63.546|11|4|transition|1.90|+1, +2|[Ar] 3d¹⁰4s¹',
    '30|Zn|Zinc (Kẽm)|65|65.38|12|4|transition|1.65|+2|[Ar] 3d¹⁰4s²',
    '31|Ga|Gallium (Gali)|70|69.723|13|4|postmetal|1.81|+3|[Ar] 3d¹⁰4s²4p¹',
    '32|Ge|Germanium (Gemani)|73|72.63|14|4|metalloid|2.01|+4|[Ar] 3d¹⁰4s²4p²',
    '33|As|Arsenic (Asen)|75|74.922|15|4|metalloid|2.18|-3,+3,+5|[Ar] 3d¹⁰4s²4p³',
    '34|Se|Selenium (Selen)|79|78.971|16|4|nonmetal|2.55|-2,+4,+6|[Ar] 3d¹⁰4s²4p⁴',
    '35|Br|Bromine (Brom)|80|79.904|17|4|halogen|2.96|-1,+1,+5|[Ar] 3d¹⁰4s²4p⁵',
    '36|Kr|Krypton (Kripton)|84|83.798|18|4|noble|3.00|0, +2|[Ar] 3d¹⁰4s²4p⁶',
    '37|Rb|Rubidium (Rubidi)|85.5|85.468|1|5|alkali|0.82|+1|[Kr] 5s¹',
    '38|Sr|Strontium (Stronti)|88|87.62|2|5|alkearth|0.95|+2|[Kr] 5s²',
    '39|Y|Yttrium (Ytri)|89|88.906|3|5|transition|1.22|+3|[Kr] 4d¹5s²',
    '40|Zr|Zirconium (Ziriconi)|91|91.224|4|5|transition|1.33|+4|[Kr] 4d²5s²',
    '41|Nb|Niobium (Niobi)|93|92.906|5|5|transition|1.60|+5|[Kr] 4d⁴5s¹',
    '42|Mo|Molybdenum (Molypden)|96|95.95|6|5|transition|2.16|+4, +6|[Kr] 4d⁵5s¹',
    '43|Tc|Technetium (Tecneti)|98|98|7|5|transition|1.90|+4, +7|[Kr] 4d⁵5s²',
    '44|Ru|Ruthenium (Ruteni)|101|101.07|8|5|transition|2.20|+3, +4|[Kr] 4d⁷5s¹',
    '45|Rh|Rhodium (Rodi)|103|102.91|9|5|transition|2.28|+3|[Kr] 4d⁸5s¹',
    '46|Pd|Palladium (Paladi)|106|106.42|10|5|transition|2.20|+2, +4|[Kr] 4d¹⁰',
    '47|Ag|Silver (Bạc)|108|107.87|11|5|transition|1.93|+1|[Kr] 4d¹⁰5s¹',
    '48|Cd|Cadmium (Cadimi)|112|112.41|12|5|transition|1.69|+2|[Kr] 4d¹⁰5s²',
    '49|In|Indium (Indi)|115|114.82|13|5|postmetal|1.78|+3|[Kr] 4d¹⁰5s²5p¹',
    '50|Sn|Tin (Thiếc)|119|118.71|14|5|postmetal|1.96|+2, +4|[Kr] 4d¹⁰5s²5p²',
    '51|Sb|Antimony (Antimon)|122|121.76|15|5|metalloid|2.05|+3, +5|[Kr] 4d¹⁰5s²5p³',
    '52|Te|Tellurium (Telu)|128|127.60|16|5|metalloid|2.10|-2,+4,+6|[Kr] 4d¹⁰5s²5p⁴',
    '53|I|Iodine (Iot)|127|126.90|17|5|halogen|2.66|-1,+5,+7|[Kr] 4d¹⁰5s²5p⁵',
    '54|Xe|Xenon|131|131.29|18|5|noble|2.60|0,+2,+4|[Kr] 4d¹⁰5s²5p⁶',
    '55|Cs|Caesium (Xesi)|133|132.91|1|6|alkali|0.79|+1|[Xe] 6s¹',
    '56|Ba|Barium (Bari)|137|137.33|2|6|alkearth|0.89|+2|[Xe] 6s²',
    '57|La|Lanthanum (Lantan)|139|138.91|4|9|lanth|1.10|+3|[Xe] 5d¹6s²',
    '58|Ce|Cerium (Xeri)|140|140.12|5|9|lanth|1.12|+3, +4|[Xe] 4f¹5d¹6s²',
    '59|Pr|Praseodymium|141|140.91|6|9|lanth|1.13|+3|[Xe] 4f³6s²',
    '60|Nd|Neodymium|144|144.24|7|9|lanth|1.14|+3|[Xe] 4f⁴6s²',
    '61|Pm|Promethium|145|145|8|9|lanth|1.13|+3|[Xe] 4f⁵6s²',
    '62|Sm|Samarium|150|150.36|9|9|lanth|1.17|+2, +3|[Xe] 4f⁶6s²',
    '63|Eu|Europium|152|151.96|10|9|lanth|1.20|+2, +3|[Xe] 4f⁷6s²',
    '64|Gd|Gadolinium|157|157.25|11|9|lanth|1.20|+3|[Xe] 4f⁷5d¹6s²',
    '65|Tb|Terbium|159|158.93|12|9|lanth|1.20|+3|[Xe] 4f⁹6s²',
    '66|Dy|Dysprosium|162.5|162.50|13|9|lanth|1.22|+3|[Xe] 4f¹⁰6s²',
    '67|Ho|Holmium|165|164.93|14|9|lanth|1.23|+3|[Xe] 4f¹¹6s²',
    '68|Er|Erbium|167|167.26|15|9|lanth|1.24|+3|[Xe] 4f¹²6s²',
    '69|Tm|Thulium|169|168.93|16|9|lanth|1.25|+3|[Xe] 4f¹³6s²',
    '70|Yb|Ytterbium|173|173.05|17|9|lanth|1.10|+2, +3|[Xe] 4f¹⁴6s²',
    '71|Lu|Lutetium|175|174.97|18|9|lanth|1.27|+3|[Xe] 4f¹⁴5d¹6s²',
    '72|Hf|Hafnium|178.5|178.49|4|6|transition|1.30|+4|[Xe] 4f¹⁴5d²6s²',
    '73|Ta|Tantalum|181|180.95|5|6|transition|1.50|+5|[Xe] 4f¹⁴5d³6s²',
    '74|W|Tungsten (Vonfram)|184|183.84|6|6|transition|2.36|+4, +6|[Xe] 4f¹⁴5d⁴6s²',
    '75|Re|Rhenium|186|186.21|7|6|transition|1.90|+4, +7|[Xe] 4f¹⁴5d⁵6s²',
    '76|Os|Osmium|190|190.23|8|6|transition|2.20|+4, +8|[Xe] 4f¹⁴5d⁶6s²',
    '77|Ir|Iridium|192|192.22|9|6|transition|2.20|+3, +4|[Xe] 4f¹⁴5d⁷6s²',
    '78|Pt|Platinum (Platin)|195|195.08|10|6|transition|2.28|+2, +4|[Xe] 4f¹⁴5d⁹6s¹',
    '79|Au|Gold (Vàng)|197|196.97|11|6|transition|2.54|+1, +3|[Xe] 4f¹⁴5d¹⁰6s¹',
    '80|Hg|Mercury (Thủy ngân)|201|200.59|12|6|transition|2.00|+1, +2|[Xe] 4f¹⁴5d¹⁰6s²',
    '81|Tl|Thallium (Tali)|204|204.38|13|6|postmetal|1.62|+1, +3|[Xe] 4f¹⁴5d¹⁰6s²6p¹',
    '82|Pb|Lead (Chì)|207|207.2|14|6|postmetal|2.33|+2, +4|[Xe] 4f¹⁴5d¹⁰6s²6p²',
    '83|Bi|Bismuth (Bitmut)|209|208.98|15|6|postmetal|2.02|+3, +5|[Xe] 4f¹⁴5d¹⁰6s²6p³',
    '84|Po|Polonium (Poloni)|209|209|16|6|metalloid|2.00|+2, +4|[Xe] 4f¹⁴5d¹⁰6s²6p⁴',
    '85|At|Astatine (Atatin)|210|210|17|6|halogen|2.20|-1, +1|[Xe] 4f¹⁴5d¹⁰6s²6p⁵',
    '86|Rn|Radon|222|222|18|6|noble|—|0|[Xe] 4f¹⁴5d¹⁰6s²6p⁶',
    '87|Fr|Francium (Franxi)|223|223|1|7|alkali|0.70|+1|[Rn] 7s¹',
    '88|Ra|Radium (Rađi)|226|226|2|7|alkearth|0.90|+2|[Rn] 7s²',
    '89|Ac|Actinium (Actini)|227|227|4|10|actin|1.10|+3|[Rn] 6d¹7s²',
    '90|Th|Thorium (Thori)|232|232.04|5|10|actin|1.30|+4|[Rn] 6d²7s²',
    '91|Pa|Protactinium|231|231.04|6|10|actin|1.50|+5|[Rn] 5f²6d¹7s²',
    '92|U|Uranium (Urani)|238|238.03|7|10|actin|1.38|+4, +6|[Rn] 5f³6d¹7s²',
    '93|Np|Neptunium|237|237|8|10|actin|1.36|+5|[Rn] 5f⁴6d¹7s²',
    '94|Pu|Plutonium|244|244|9|10|actin|1.28|+4|[Rn] 5f⁶7s²',
    '95|Am|Americium|243|243|10|10|actin|1.30|+3|[Rn] 5f⁷7s²',
    '96|Cm|Curium|247|247|11|10|actin|1.30|+3|[Rn] 5f⁷6d¹7s²',
    '97|Bk|Berkelium|247|247|12|10|actin|1.30|+3|[Rn] 5f⁹7s²',
    '98|Cf|Californium|251|251|13|10|actin|1.30|+3|[Rn] 5f¹⁰7s²',
    '99|Es|Einsteinium|252|252|14|10|actin|1.30|+3|[Rn] 5f¹¹7s²',
    '100|Fm|Fermium|257|257|15|10|actin|1.30|+3|[Rn] 5f¹²7s²',
    '101|Md|Mendelevium|258|258|16|10|actin|1.30|+3|[Rn] 5f¹³7s²',
    '102|No|Nobelium|259|259|17|10|actin|1.30|+2, +3|[Rn] 5f¹⁴7s²',
    '103|Lr|Lawrencium|266|266|18|10|actin|1.30|+3|[Rn] 5f¹⁴7s²7p¹',
    '104|Rf|Rutherfordium|267|267|4|7|transition|—|+4|[Rn] 5f¹⁴6d²7s²',
    '105|Db|Dubnium|268|268|5|7|transition|—|+5|[Rn] 5f¹⁴6d³7s²',
    '106|Sg|Seaborgium|269|269|6|7|transition|—|+6|[Rn] 5f¹⁴6d⁴7s²',
    '107|Bh|Bohrium|270|270|7|7|transition|—|+7|[Rn] 5f¹⁴6d⁵7s²',
    '108|Hs|Hassium|277|277|8|7|transition|—|+8|[Rn] 5f¹⁴6d⁶7s²',
    '109|Mt|Meitnerium|278|278|9|7|transition|—|—|[Rn] 5f¹⁴6d⁷7s²',
    '110|Ds|Darmstadtium|281|281|10|7|transition|—|—|[Rn] 5f¹⁴6d⁸7s²',
    '111|Rg|Roentgenium|282|282|11|7|transition|—|—|[Rn] 5f¹⁴6d⁹7s²',
    '112|Cn|Copernicium|285|285|12|7|transition|—|+2|[Rn] 5f¹⁴6d¹⁰7s²',
    '113|Nh|Nihonium|286|286|13|7|postmetal|—|+1|[Rn] 5f¹⁴6d¹⁰7s²7p¹',
    '114|Fl|Flerovium|289|289|14|7|postmetal|—|+2|[Rn] 5f¹⁴6d¹⁰7s²7p²',
    '115|Mc|Moscovium|290|290|15|7|postmetal|—|+1, +3|[Rn] 5f¹⁴6d¹⁰7s²7p³',
    '116|Lv|Livermorium|293|293|16|7|postmetal|—|+2|[Rn] 5f¹⁴6d¹⁰7s²7p⁴',
    '117|Ts|Tennessine|294|294|17|7|halogen|—|-1, +1|[Rn] 5f¹⁴6d¹⁰7s²7p⁵',
    '118|Og|Oganesson|294|294|18|7|noble|—|0|[Rn] 5f¹⁴6d¹⁰7s²7p⁶'
];

const PT_CAT_LABELS = {
    alkali: 'Kim loại kiềm',
    alkearth: 'Kim loại kiềm thổ',
    transition: 'Kim loại chuyển tiếp',
    postmetal: 'Kim loại sau chuyển tiếp',
    metalloid: 'Á kim',
    nonmetal: 'Phi kim',
    halogen: 'Halogen',
    noble: 'Khí hiếm',
    lanth: 'Họ Lantan (Lanthanide)',
    actin: 'Họ Actini (Actinide)'
};

let _cachedPeriodicElements = null;
let _cachedElementBySym = null;
let selectedPeriodicZ = 26; // Fe mặc định
let periodicSearchQuery = '';
let periodicFormulaExpr = 'CuSO4.5H2O';

function getPeriodicElementsList() {
    if (_cachedPeriodicElements) return _cachedPeriodicElements;
    _cachedElementBySym = new Map();
    _cachedPeriodicElements = PERIODIC_RAW_LIST.map(row => {
        const [z, sym, name, ptMass, exactMass, col, rowIdx, cat, en, val, cfg] = row.split('|');
        const obj = {
            z: Number(z),
            sym,
            name,
            ptMass: Number(ptMass),
            exactMass: Number(exactMass),
            col: Number(col),
            row: Number(rowIdx),
            cat,
            en,
            val,
            cfg
        };
        _cachedElementBySym.set(sym, obj);
        return obj;
    });
    return _cachedPeriodicElements;
}

function getElementBySymbol(sym) {
    getPeriodicElementsList();
    return _cachedElementBySym.get(sym) || null;
}

function calculateChemicalMolarMass(rawFormula) {
    const cleaned = String(rawFormula || '').trim().replace(/\s+/g, '');
    if (!cleaned) return { ok: false, error: 'Nhập công thức hóa học để tính phân tử khối M' };
    getPeriodicElementsList();

    const mergeCounts = (target, src, mul) => {
        for (const [k, v] of Object.entries(src)) {
            target[k] = (target[k] || 0) + v * mul;
        }
    };

    const parseSegment = (seg) => {
        if (!seg) throw new Error('Công thức có đoạn rỗng giữa dấu ngậm nước');
        let idx = 0;
        let coeff = 0;
        while (idx < seg.length && /\d/.test(seg[idx])) {
            coeff = coeff * 10 + Number(seg[idx]);
            idx++;
        }
        const leadMul = coeff > 0 ? coeff : 1;

        const parseGroup = (stopChar) => {
            const counts = {};
            while (idx < seg.length) {
                const ch = seg[idx];
                if (stopChar && ch === stopChar) {
                    idx++;
                    return counts;
                }
                if (ch === ')' || ch === ']') {
                    throw new Error(`Dấu ngoặc "${ch}" thừa hoặc sai vị trí`);
                }
                if (ch === '(' || ch === '[') {
                    const closeCh = ch === '(' ? ')' : ']';
                    idx++;
                    const inner = parseGroup(closeCh);
                    let numStr = '';
                    while (idx < seg.length && /\d/.test(seg[idx])) {
                        numStr += seg[idx++];
                    }
                    const mul = numStr ? Number(numStr) : 1;
                    mergeCounts(counts, inner, mul);
                    continue;
                }
                if (/[A-Z]/.test(ch)) {
                    let sym = ch;
                    idx++;
                    if (idx < seg.length && /[a-z]/.test(seg[idx])) {
                        const sym2 = sym + seg[idx];
                        if (_cachedElementBySym.has(sym2)) {
                            sym = sym2;
                            idx++;
                        }
                    }
                    if (!_cachedElementBySym.has(sym)) {
                        throw new Error(`Ký hiệu nguyên tố không hợp lệ: "${sym}"`);
                    }
                    let numStr = '';
                    while (idx < seg.length && /\d/.test(seg[idx])) {
                        numStr += seg[idx++];
                    }
                    const mul = numStr ? Number(numStr) : 1;
                    counts[sym] = (counts[sym] || 0) + mul;
                    continue;
                }
                throw new Error(`Ký tự không hợp lệ: "${ch}"`);
            }
            if (stopChar) throw new Error(`Thiếu dấu đóng ngoặc "${stopChar}"`);
            return counts;
        };

        const segCounts = parseGroup(null);
        const finalCounts = {};
        mergeCounts(finalCounts, segCounts, leadMul);
        return finalCounts;
    };

    try {
        const parts = cleaned.split(/[.·*•]/);
        const totalCounts = {};
        parts.forEach(part => {
            const cMap = parseSegment(part);
            mergeCounts(totalCounts, cMap, 1);
        });
        let roundMass = 0;
        let exactMass = 0;
        const breakdown = Object.entries(totalCounts).map(([sym, qty]) => {
            const info = _cachedElementBySym.get(sym);
            const rSub = qty * info.ptMass;
            const eSub = qty * info.exactMass;
            roundMass += rSub;
            exactMass += eSub;
            return { sym, name: info.name, qty, ptMass: info.ptMass, exactMass: info.exactMass, rSub, eSub };
        });
        breakdown.forEach(b => {
            b.pct = roundMass > 0 ? (b.rSub / roundMass) * 100 : 0;
        });
        return {
            ok: true,
            formula: cleaned,
            molarMassRound: Math.round(roundMass * 1000) / 1000,
            molarMassExact: Math.round(exactMass * 1000) / 1000,
            breakdown
        };
    } catch (err) {
        return { ok: false, error: err?.message || 'Công thức chưa đúng định dạng' };
    }
}

function stampChemTextOntoActivePage(txt) {
    if (!txt || typeof getDocState !== 'function') return;
    const doc = getDocState();
    if (!doc.texts) doc.texts = [];
    if (typeof saveHistorySnapshot === 'function') saveHistorySnapshot();
    const z = (typeof zoom === 'number' && zoom > 0) ? zoom : 1;
    const px = typeof panX === 'number' ? panX : 0;
    const py = typeof panY === 'number' ? panY : 0;
    const cw = typeof canvas !== 'undefined' && canvas?.clientWidth ? canvas.clientWidth : 900;
    const ch = typeof canvas !== 'undefined' && canvas?.clientHeight ? canvas.clientHeight : 650;
    const pageW = typeof A4_WIDTH === 'number' ? A4_WIDTH : 794;
    const pageH = typeof A4_HEIGHT === 'number' ? A4_HEIGHT : 1123;
    const activePageY = typeof getPageYOffset === 'function' ? getPageYOffset(getActiveNotebook()?.activePageIndex || 0) : 0;
    const worldCx = Math.max(48, Math.min(pageW - 180, (cw * 0.42 - px) / z));
    const worldCy = Math.max(48, Math.min(pageH - 48, ((ch * 0.42 - py) / z) - activePageY));
    doc.texts.push({ id: typeof genId === 'function' ? genId('txt') : 'txt_' + Date.now(), x: Math.round(worldCx), y: Math.round(worldCy), text: txt, color: '#0f172a', size: 15 });
    if (typeof persistLibrary === 'function') persistLibrary();
    if (typeof renderAll === 'function') renderAll();
    if (typeof showGestureToast === 'function') showGestureToast(`📌 Đã dán "${txt}" lên trang viết!`);
}

function onPeriodicSearchInput(val) {
    periodicSearchQuery = String(val || '');
    renderPeriodicInspectorAndGrid();
}

function selectPeriodicElement(z) {
    selectedPeriodicZ = Number(z) || 1;
    renderPeriodicInspectorAndGrid();
}

function onPeriodicFormulaInput(val) {
    periodicFormulaExpr = String(val || '');
    updatePeriodicFormulaResultOnly();
}

function setPeriodicQuickFormula(formula) {
    periodicFormulaExpr = formula;
    const inp = document.getElementById('ptFormulaCalcInput');
    if (inp) inp.value = formula;
    updatePeriodicFormulaResultOnly();
}

function appendSymbolToFormulaCalc(sym) {
    const inp = document.getElementById('ptFormulaCalcInput');
    periodicFormulaExpr = (periodicFormulaExpr || '') + sym;
    if (inp) {
        inp.value = periodicFormulaExpr;
        inp.focus();
    }
    updatePeriodicFormulaResultOnly();
}

function updatePeriodicFormulaResultOnly() {
    const outEl = document.getElementById('ptFormulaCalcResult');
    if (!outEl) return;
    const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const res = calculateChemicalMolarMass(periodicFormulaExpr);
    if (!res.ok) {
        outEl.innerHTML = `<div class="text-[11px] font-semibold text-amber-300">${esc(res.error)}</div>`;
        return;
    }
    const stampTxt = `M(${res.formula}) = ${res.molarMassRound} g/mol`;
    outEl.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-baseline gap-2.5 flex-wrap">
                <span class="text-sm font-black text-emerald-300">M = ${res.molarMassRound} <span class="text-[11px] font-bold opacity-85">g/mol</span></span>
                <span class="text-[10.5px] text-slate-400">(IUPAC chính xác: ${res.molarMassExact})</span>
            </div>
            <div class="flex items-center gap-1.5">
                <button type="button" onclick="copySupportText('${esc(String(res.molarMassRound))}', '📋 Đã copy M = ${res.molarMassRound}')" class="support-copy-btn">📋 Copy M</button>
                <button type="button" onclick="stampChemTextOntoActivePage('${esc(stampTxt).replace(/'/g, "\\'")}'); closePeriodicHubModal();" class="px-2.5 py-1 rounded-lg bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/50 text-sky-200 font-extrabold text-[11px]">📌 Dán lên giấy</button>
            </div>
        </div>
        <div class="flex flex-wrap gap-1.5 pt-1">
            ${res.breakdown.map(b => `<span class="px-2 py-0.5 rounded-md bg-black/30 border border-white/10 text-[10.5px] text-slate-200"><b>${b.sym}</b>×${b.qty}: ${b.rSub} (${b.pct.toFixed(1)}%)</span>`).join('')}
        </div>
    `;
}

function buildPeriodicInspectorHtml(sel) {
    const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const elStamp = `${sel.sym} (Z=${sel.z}, M=${sel.ptMass})`;
    return `
        <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5">
                <div class="w-12 h-12 rounded-xl pt-cat-${sel.cat} border flex flex-col items-center justify-center shrink-0">
                    <span class="text-[9px] leading-none opacity-80">Z=${sel.z}</span>
                    <span class="text-lg font-black leading-tight text-white">${sel.sym}</span>
                </div>
                <div>
                    <div class="font-extrabold text-[13px] text-white">${esc(sel.name)}</div>
                    <div class="text-[10.5px] text-sky-300 font-bold">${esc(PT_CAT_LABELS[sel.cat] || sel.cat)}</div>
                </div>
            </div>
            <div class="flex flex-col gap-1 items-end">
                <button type="button" onclick="appendSymbolToFormulaCalc('${sel.sym}')" class="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-[10px] font-extrabold">+ Vào ô tính M</button>
                <button type="button" onclick="stampChemTextOntoActivePage('${esc(elStamp).replace(/'/g, "\\'")}'); closePeriodicHubModal();" class="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-200 text-[10px] font-extrabold">📌 Dán lên giấy</button>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-1.5 text-[11px]">
            <div class="support-info-row"><span style="color:var(--text-muted);">M (PT / IUPAC)</span><b class="text-emerald-300">${sel.ptMass} / ${sel.exactMass}</b></div>
            <div class="support-info-row"><span style="color:var(--text-muted);">Độ âm điện</span><b class="text-amber-300">${esc(sel.en)}</b></div>
            <div class="support-info-row"><span style="color:var(--text-muted);">Số OXH / Hóa trị</span><b class="text-sky-200">${esc(sel.val)}</b></div>
            <div class="support-info-row"><span style="color:var(--text-muted);">Cấu hình e</span><b class="text-slate-100">${esc(sel.cfg)}</b></div>
        </div>
    `;
}

function buildPeriodicGridCellsHtml(q, sel) {
    const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const list = getPeriodicElementsList();
    const gridMap = new Map();
    list.forEach(el => gridMap.set(`${el.row}-${el.col}`, el));

    const cellsHtml = [];
    const rows = [1, 2, 3, 4, 5, 6, 7, 9, 10];
    rows.forEach(r => {
        if (r === 9) {
            cellsHtml.push(`<div style="grid-column:span 3;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:10px;font-weight:700;color:#f472b6;">Lantan (57–71) →</div>`);
        } else if (r === 10) {
            cellsHtml.push(`<div style="grid-column:span 3;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:10px;font-weight:700;color:#a78bfa;">Actini (89–103) →</div>`);
        }
        const startCol = (r === 9 || r === 10) ? 4 : 1;
        for (let c = startCol; c <= 18; c++) {
            if (r === 6 && c === 3) {
                cellsHtml.push(`<button type="button" onclick="selectPeriodicElement(57)" class="pt-cell pt-cat-lanth" title="Xem họ Lantan (57–71)"><span class="pt-z">57–71</span><span class="pt-sym" style="font-size:10px;">La–Lu</span></button>`);
                continue;
            }
            if (r === 7 && c === 3) {
                cellsHtml.push(`<button type="button" onclick="selectPeriodicElement(89)" class="pt-cell pt-cat-actin" title="Xem họ Actini (89–103)"><span class="pt-z">89–103</span><span class="pt-sym" style="font-size:10px;">Ac–Lr</span></button>`);
                continue;
            }
            const el = gridMap.get(`${r}-${c}`);
            if (!el) {
                cellsHtml.push(`<div></div>`);
                continue;
            }
            const matched = !q || String(el.z) === q || el.sym.toLowerCase().includes(q) || el.name.toLowerCase().includes(q);
            const cls = [
                'pt-cell',
                `pt-cat-${el.cat}`,
                el.z === sel.z ? 'active' : '',
                matched ? '' : 'dimmed'
            ].filter(Boolean).join(' ');
            cellsHtml.push(`<button type="button" onclick="selectPeriodicElement(${el.z})" class="${cls}" title="${esc(el.sym)} (${el.z}) - ${esc(el.name)} · M=${el.ptMass}"><span class="pt-z">${el.z}</span><span class="pt-sym">${el.sym}</span><span class="pt-mass">${el.ptMass}</span></button>`);
        }
    });
    return cellsHtml.join('');
}

function renderPeriodicInspectorAndGrid() {
    const list = getPeriodicElementsList();
    const q = periodicSearchQuery.trim().toLowerCase();
    const sel = list.find(e => e.z === selectedPeriodicZ) || list[25];
    const inspSlot = document.getElementById('ptInspectorSlot');
    const gridSlot = document.getElementById('ptGridSlot');
    if (inspSlot && gridSlot) {
        inspSlot.innerHTML = buildPeriodicInspectorHtml(sel);
        gridSlot.innerHTML = buildPeriodicGridCellsHtml(q, sel);
    } else {
        renderPeriodicHubBody();
    }
}

function renderPeriodicHubBody() {
    const body = document.getElementById('periodicHubBody');
    if (!body) return;
    const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const list = getPeriodicElementsList();
    const q = periodicSearchQuery.trim().toLowerCase();
    const sel = list.find(e => e.z === selectedPeriodicZ) || list[25];

    body.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div class="lg:col-span-7 molar-calc-panel">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="font-extrabold text-[12px] text-sky-300">🧮 Tính nhanh Phân tử khối (M)</span>
                    <div class="flex flex-wrap gap-1">
                        ${['H2SO4', 'Cu(OH)2', 'Fe2(SO4)3', 'KMnO4', 'CuSO4.5H2O', 'CH3COOH'].map(f => `<button type="button" onclick="setPeriodicQuickFormula('${f}')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600/70 text-[10px] font-bold text-slate-200">${f}</button>`).join('')}
                    </div>
                </div>
                <input id="ptFormulaCalcInput" type="text" value="${esc(periodicFormulaExpr)}" oninput="onPeriodicFormulaInput(this.value)" placeholder="Nhập công thức: H2SO4, Fe2(SO4)3, CuSO4.5H2O, [Ag(NH3)2]OH..." class="w-full h-9 px-3 rounded-xl bg-slate-950/90 border border-slate-600 focus:border-sky-400 text-xs font-bold text-white outline-none" />
                <div id="ptFormulaCalcResult" class="space-y-1.5"></div>
            </div>

            <div id="ptInspectorSlot" class="lg:col-span-5 pt-inspector-card space-y-2">
                ${buildPeriodicInspectorHtml(sel)}
            </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
            <input id="ptSearchInput" type="text" value="${esc(periodicSearchQuery)}" oninput="onPeriodicSearchInput(this.value)" placeholder="🔎 Tìm nhanh nguyên tố theo Ký hiệu (Fe, Cu...), Tên (Sắt, Oxi...) hoặc Số hiệu Z (26)..." class="flex-1 min-w-[220px] h-8 px-3 rounded-xl bg-slate-950/85 border border-slate-700 focus:border-sky-400 text-xs text-white outline-none" />
            <div class="text-[10.5px]" style="color:var(--text-muted);">Chạm ô nguyên tố bất kỳ để xem chi tiết</div>
        </div>

        <div class="periodic-scroll-wrap">
            <div id="ptGridSlot" class="periodic-grid-18">${buildPeriodicGridCellsHtml(q, sel)}</div>
        </div>
    `;
    updatePeriodicFormulaResultOnly();
}

function openPeriodicHubModal() {
    closeAllPopovers();
    renderPeriodicHubBody();
    document.getElementById('periodicHubModal')?.classList.remove('hidden');
}

function closePeriodicHubModal() {
    document.getElementById('periodicHubModal')?.classList.add('hidden');
}

// ============================================================================
// KHO 185 NAME REACTIONS & 331 TÁC NHÂN HỮU CƠ CVP (v15.15 — Scroll Fix + Drag to Paper)
// ============================================================================
const NAME_REACTIONS_CATEGORIES = [
    { id: 'all', label: 'Tất cả' },
    { id: 'fav', label: '★ Yêu thích' },
    { id: 'cc', label: 'Tạo C–C' },
    { id: 'coupling', label: 'Ghép cặp kim loại' },
    { id: 'ox', label: 'Oxy hóa' },
    { id: 'red', label: 'Khử' },
    { id: 'rearr', label: 'Chuyển vị' },
    { id: 'het', label: 'Tổng hợp dị vòng' },
    { id: 'alkene', label: 'Alken / Olefin' },
    { id: 'fg', label: 'Chuyển hóa nhóm chức' }
];

const REAGENTS_CATEGORIES = [
    { id: 'all', label: 'Tất cả' },
    { id: 'fav', label: '★ Yêu thích' },
    { id: 'ox', label: 'Oxy hóa' },
    { id: 'red', label: 'Khử' },
    { id: 'protect', label: 'Bảo vệ / Silyl' },
    { id: 'metal', label: 'Kim loại / Xúc tác' },
    { id: 'halogen', label: 'Halogen / P / S' },
    { id: 'base', label: 'Bazơ / Axit / Ngưng tụ' },
    { id: 'cc', label: 'Tạo C–C / Chuyển vị' },
    { id: 'other', label: 'Tác nhân khác' }
];

let nameReactionsState = {
    tab: 'reactions',
    docked: false,
    loaded: false,
    loading: false,
    error: null,
    items: [],
    query: '',
    cat: 'all',
    selectedId: 1,
    zoomed: false
};

let reagentsState = {
    loaded: false,
    loading: false,
    error: null,
    items: [],
    query: '',
    cat: 'all',
    selectedId: 1,
    zoomed: false
};

function normalizeViSearchStr(str) {
    return String(str || '')
        .replace(/[đĐ]/g, 'd')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[–—−]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function getNameReactionFavSet() {
    const arr = Array.isArray(appLibrary?.favoriteNameReactions) ? appLibrary.favoriteNameReactions : [];
    return new Set(arr.map(x => Number(x)).filter(Number.isFinite));
}

function getReagentFavSet() {
    const arr = Array.isArray(appLibrary?.favoriteReagents) ? appLibrary.favoriteReagents : [];
    return new Set(arr.map(x => Number(x)).filter(Number.isFinite));
}

function getNameReactionCategoryLabel(catId) {
    const found = NAME_REACTIONS_CATEGORIES.find(c => c.id === catId);
    return found ? found.label : 'Hóa hữu cơ';
}

function getReagentCategoryLabel(catId) {
    const found = REAGENTS_CATEGORIES.find(c => c.id === catId);
    return found ? found.label : 'Tác nhân CVP';
}

function getFilteredNameReactions() {
    const items = Array.isArray(nameReactionsState.items) ? nameReactionsState.items : [];
    const cat = nameReactionsState.cat || 'all';
    const favSet = getNameReactionFavSet();
    const tokens = normalizeViSearchStr(nameReactionsState.query || '').split(' ').filter(Boolean);
    return items.filter(item => {
        if (cat === 'fav') {
            if (!favSet.has(Number(item.id))) return false;
        } else if (cat !== 'all') {
            if (item.cat !== cat) return false;
        }
        if (!tokens.length) return true;
        if (item._searchHay == null) {
            item._searchHay = normalizeViSearchStr(
                (item.vi || '') + ' ' +
                (item.en || '') + ' ' +
                (item.start || '') + ' ' +
                (item.reagent || '') + ' ' +
                (item.product || '') + ' ' +
                (item.mech || '') + ' ' +
                (item.seeAlso || '')
            );
        }
        return tokens.every(tok => item._searchHay.indexOf(tok) !== -1);
    });
}

function getFilteredReagents() {
    const items = Array.isArray(reagentsState.items) ? reagentsState.items : [];
    const cat = reagentsState.cat || 'all';
    const favSet = getReagentFavSet();
    const tokens = normalizeViSearchStr(reagentsState.query || '').split(' ').filter(Boolean);
    return items.filter(item => {
        if (cat === 'fav') {
            if (!favSet.has(Number(item.id))) return false;
        } else if (cat !== 'all') {
            if (item.cat !== cat) return false;
        }
        if (!tokens.length) return true;
        if (item._searchHay == null) {
            item._searchHay = normalizeViSearchStr(
                '#' + (item.stt || item.id || '') + ' ' +
                (item.name || '') + ' ' +
                (item.aliases || '') + ' ' +
                getReagentCategoryLabel(item.cat) + ' ' +
                'tr.' + (item.bookPage || '')
            );
        }
        return tokens.every(tok => item._searchHay.indexOf(tok) !== -1);
    });
}

async function loadNameReactionsCatalog(forceReload = false) {
    if (nameReactionsState.loading) return;
    if (nameReactionsState.loaded && !forceReload && nameReactionsState.items.length) {
        renderReferenceHub();
        return;
    }
    nameReactionsState.loading = true;
    nameReactionsState.error = null;
    renderReferenceHub();
    try {
        const resp = await fetch('./name-reactions/index.json');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        if (!Array.isArray(data) || !data.length) throw new Error('Dữ liệu rỗng');
        nameReactionsState.items = data;
        nameReactionsState.loaded = true;
        nameReactionsState.error = null;
        if (!data.some(x => Number(x.id) === Number(nameReactionsState.selectedId))) {
            nameReactionsState.selectedId = Number(data[0].id);
        }
    } catch (err) {
        nameReactionsState.error = String(err && err.message ? err.message : err || 'Lỗi tải dữ liệu');
    } finally {
        nameReactionsState.loading = false;
        renderReferenceHub();
    }
}

async function loadReagentsCatalog(forceReload = false) {
    if (reagentsState.loading) return;
    if (reagentsState.loaded && !forceReload && reagentsState.items.length) {
        renderReferenceHub();
        return;
    }
    reagentsState.loading = true;
    reagentsState.error = null;
    renderReferenceHub();
    try {
        const resp = await fetch('./reagents/index.json');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        if (!Array.isArray(data) || !data.length) throw new Error('Dữ liệu rỗng');
        reagentsState.items = data;
        reagentsState.loaded = true;
        reagentsState.error = null;
        if (!data.some(x => Number(x.id) === Number(reagentsState.selectedId))) {
            reagentsState.selectedId = Number(data[0].id);
        }
    } catch (err) {
        reagentsState.error = String(err && err.message ? err.message : err || 'Lỗi tải dữ liệu');
    } finally {
        reagentsState.loading = false;
        renderReferenceHub();
    }
}

function resetReferenceDetailScroll() {
    const detailPane = document.getElementById('nrDetailPane');
    if (detailPane) detailPane.scrollTop = 0;
}

function syncReferenceHubChrome() {
    const isReag = nameReactionsState.tab === 'reagents';
    const modal = document.getElementById('nameReactionsHubModal');
    if (modal) modal.classList.toggle('is-docked', !!nameReactionsState.docked);

    const iconEl = document.getElementById('nrHubIcon');
    const titleEl = document.getElementById('nrHubTitle');
    const subEl = document.getElementById('nrHubSubtitle');
    const tabReact = document.getElementById('nrTabReactionsBtn');
    const tabReag = document.getElementById('nrTabReagentsBtn');
    const dockBtn = document.getElementById('nrDockBtn');
    const inp = document.getElementById('nrSearchInput');

    if (iconEl) iconEl.textContent = isReag ? '🧪' : '📚';
    if (titleEl) {
        const reagCnt = reagentsState.loaded ? reagentsState.items.length : 331;
        titleEl.textContent = isReag
            ? ('Sổ Tay Tác Nhân Hữu Cơ — Chu Văn Phòng (' + reagCnt + ')')
            : 'Kho Name Reactions Hữu Cơ (185 Phản Ứng)';
    }
    if (subEl) {
        subEl.textContent = isReag
            ? 'Tác giả: Chu Văn Phòng · Tra cứu theo CTCT & kéo thả trực tiếp ra trang giấy A4'
            : 'Jie Jack Li (6th Ed. VN) · Kéo Sơ đồ / Cơ chế trực tiếp ra trang giấy A4';
    }
    if (tabReact) tabReact.classList.toggle('active', !isReag);
    if (tabReag) tabReag.classList.toggle('active', isReag);
    if (dockBtn) {
        dockBtn.classList.toggle('active', !!nameReactionsState.docked);
        dockBtn.textContent = nameReactionsState.docked ? '⬜ Mở rộng' : '◧ Cạnh trái';
        dockBtn.title = nameReactionsState.docked
            ? 'Mở rộng toàn màn hình'
            : 'Thu gọn sang cạnh trái để vừa xem giấy vừa kéo thả';
    }
    if (inp) {
        inp.placeholder = isReag
            ? 'Tìm: DMSO, LAH, mCPBA, Pd/C, Grignard, Kẽm...'
            : 'Tìm: aldol, Pd, mCPBA, chuyển vị...';
        const wantedVal = isReag ? (reagentsState.query || '') : (nameReactionsState.query || '');
        if (inp.value !== wantedVal) inp.value = wantedVal;
    }
}

function openNameReactionsHubModal(initialQuery) {
    closeAllPopovers();
    nameReactionsState.tab = 'reactions';
    if (typeof initialQuery === 'string') {
        nameReactionsState.query = initialQuery;
        nameReactionsState.cat = 'all';
    }
    const modal = document.getElementById('nameReactionsHubModal');
    if (modal) modal.classList.remove('hidden');
    syncReferenceHubChrome();
    renderReferenceHub();
    if (!nameReactionsState.loaded && !nameReactionsState.loading) {
        loadNameReactionsCatalog();
    }
    const inp = document.getElementById('nrSearchInput');
    if (inp && typeof window !== 'undefined' && window.innerWidth >= 768) {
        setTimeout(() => { try { inp.focus(); } catch (_) {} }, 60);
    }
}

function openReagentsHubModal(initialQuery) {
    closeAllPopovers();
    nameReactionsState.tab = 'reagents';
    if (typeof initialQuery === 'string') {
        reagentsState.query = initialQuery;
        reagentsState.cat = 'all';
    }
    const modal = document.getElementById('nameReactionsHubModal');
    if (modal) modal.classList.remove('hidden');
    syncReferenceHubChrome();
    renderReferenceHub();
    if (!reagentsState.loaded && !reagentsState.loading) {
        loadReagentsCatalog();
    }
    const inp = document.getElementById('nrSearchInput');
    if (inp && typeof window !== 'undefined' && window.innerWidth >= 768) {
        setTimeout(() => { try { inp.focus(); } catch (_) {} }, 60);
    }
}

function closeNameReactionsHubModal() {
    nameReactionsState.zoomed = false;
    reagentsState.zoomed = false;
    const modal = document.getElementById('nameReactionsHubModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('is-dragging-out');
    }
    const ghost = document.getElementById('nrDragGhost');
    if (ghost) ghost.remove();
}

function setReferenceHubTab(tab) {
    const nextTab = (tab === 'reagents') ? 'reagents' : 'reactions';
    if (nameReactionsState.tab === nextTab) return;
    nameReactionsState.tab = nextTab;
    syncReferenceHubChrome();
    resetReferenceDetailScroll();
    renderReferenceHub();
    if (nextTab === 'reagents' && !reagentsState.loaded && !reagentsState.loading) {
        loadReagentsCatalog();
    } else if (nextTab === 'reactions' && !nameReactionsState.loaded && !nameReactionsState.loading) {
        loadNameReactionsCatalog();
    }
}

function toggleReferenceHubDock(forceState) {
    nameReactionsState.docked = (typeof forceState === 'boolean') ? forceState : !nameReactionsState.docked;
    syncReferenceHubChrome();
    if (nameReactionsState.docked && typeof showGestureToast === 'function') {
        showGestureToast('Đã thu gọn sang cạnh trái — nhấn giữ nút Kéo ra giấy và thả vào trang A4!');
    }
}

function setReferenceHubQuery(q) {
    if (nameReactionsState.tab === 'reagents') {
        setReagentsQuery(q);
    } else {
        setNameReactionsQuery(q);
    }
}

function setNameReactionsQuery(q) {
    nameReactionsState.query = String(q || '');
    const filtered = getFilteredNameReactions();
    if (filtered.length && !filtered.some(x => Number(x.id) === Number(nameReactionsState.selectedId))) {
        nameReactionsState.selectedId = Number(filtered[0].id);
    }
    renderReferenceHub();
}

function setReagentsQuery(q) {
    reagentsState.query = String(q || '');
    const filtered = getFilteredReagents();
    if (filtered.length && !filtered.some(x => Number(x.id) === Number(reagentsState.selectedId))) {
        reagentsState.selectedId = Number(filtered[0].id);
    }
    renderReferenceHub();
}

function setNameReactionsCategory(cat) {
    nameReactionsState.cat = String(cat || 'all');
    const filtered = getFilteredNameReactions();
    if (filtered.length && !filtered.some(x => Number(x.id) === Number(nameReactionsState.selectedId))) {
        nameReactionsState.selectedId = Number(filtered[0].id);
    }
    resetReferenceDetailScroll();
    renderReferenceHub();
}

function setReagentsCategory(cat) {
    reagentsState.cat = String(cat || 'all');
    const filtered = getFilteredReagents();
    if (filtered.length && !filtered.some(x => Number(x.id) === Number(reagentsState.selectedId))) {
        reagentsState.selectedId = Number(filtered[0].id);
    }
    resetReferenceDetailScroll();
    renderReferenceHub();
}

function selectNameReactionItem(id) {
    nameReactionsState.selectedId = Number(id);
    nameReactionsState.zoomed = false;
    resetReferenceDetailScroll();
    renderReferenceHub();
}

function selectReagentItem(id) {
    reagentsState.selectedId = Number(id);
    reagentsState.zoomed = false;
    resetReferenceDetailScroll();
    renderReferenceHub();
}

function toggleFavoriteNameReaction(id, ev) {
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    const numId = Number(id);
    if (!Number.isFinite(numId)) return;
    if (!Array.isArray(appLibrary.favoriteNameReactions)) appLibrary.favoriteNameReactions = [];
    const idx = appLibrary.favoriteNameReactions.indexOf(numId);
    if (idx === -1) {
        appLibrary.favoriteNameReactions.push(numId);
    } else {
        appLibrary.favoriteNameReactions.splice(idx, 1);
    }
    persistLibrary();
    renderReferenceHub();
}

function toggleFavoriteReagent(id, ev) {
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    const numId = Number(id);
    if (!Number.isFinite(numId)) return;
    if (!Array.isArray(appLibrary.favoriteReagents)) appLibrary.favoriteReagents = [];
    const idx = appLibrary.favoriteReagents.indexOf(numId);
    if (idx === -1) {
        appLibrary.favoriteReagents.push(numId);
    } else {
        appLibrary.favoriteReagents.splice(idx, 1);
    }
    persistLibrary();
    renderReferenceHub();
}

function toggleNameReactionDiagramZoom() {
    if (nameReactionsState.tab === 'reagents') {
        reagentsState.zoomed = !reagentsState.zoomed;
        const box = document.getElementById('nrDiagramBox');
        if (box) box.classList.toggle('is-zoomed', !!reagentsState.zoomed);
    } else {
        nameReactionsState.zoomed = !nameReactionsState.zoomed;
        const box = document.getElementById('nrDiagramBox');
        if (box) box.classList.toggle('is-zoomed', !!nameReactionsState.zoomed);
    }
}

function jumpToRelatedNameReaction(targetText) {
    const cleaned = String(targetText || '').replace(/^(xem them|xem thêm)\s*/i, '').trim();
    nameReactionsState.tab = 'reactions';
    nameReactionsState.query = cleaned;
    nameReactionsState.cat = 'all';
    syncReferenceHubChrome();
    const filtered = getFilteredNameReactions();
    if (filtered.length) nameReactionsState.selectedId = Number(filtered[0].id);
    resetReferenceDetailScroll();
    renderReferenceHub();
}

function startReferenceDragToPaper(kind, id, mode, ev) {
    if (ev && ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();

    const isReag = (kind === 'reagent');
    const item = isReag
        ? (reagentsState.items || []).find(x => Number(x.id) === Number(id))
        : (nameReactionsState.items || []).find(x => Number(x.id) === Number(id));
    if (!item || !item.img) return false;

    const startX = ev && Number.isFinite(ev.clientX) ? ev.clientX : 0;
    const startY = ev && Number.isFinite(ev.clientY) ? ev.clientY : 0;
    let activeDrag = false;
    let ghostEl = null;

    const imgSrc = isReag ? ('./reagents/' + item.img) : ('./name-reactions/' + item.img);
    const title = isReag ? (item.name || ('Tác nhân #' + id)) : (item.vi || ('Phản ứng #' + id));
    const modeLabel = isReag
        ? 'Bảng tác nhân CVP'
        : (mode === 'scheme' ? 'Phản ứng tổng quát' : (mode === 'mech' ? 'Cơ chế' : 'Sơ đồ + Cơ chế'));

    const cleanup = () => {
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('pointermove', onMove, true);
            window.removeEventListener('pointerup', onUp, true);
            window.removeEventListener('pointercancel', onCancel, true);
        }
        const modal = document.getElementById('nameReactionsHubModal');
        if (modal) modal.classList.remove('is-dragging-out');
        if (ghostEl) {
            ghostEl.remove();
            ghostEl = null;
        }
    };

    const getDropTargetPoint = (cx, cy) => {
        const cardEl = document.querySelector('#nameReactionsHubModal .nr-modal-card');
        if (nameReactionsState.docked && cardEl && typeof cardEl.getBoundingClientRect === 'function') {
            const cr = cardEl.getBoundingClientRect();
            if (cx >= cr.left && cx <= cr.right && cy >= cr.top && cy <= cr.bottom) {
                return null;
            }
        }
        const canvasEl = (typeof canvas !== 'undefined' && canvas) ? canvas : document.getElementById('chemCanvas');
        if (!canvasEl || typeof canvasEl.getBoundingClientRect !== 'function') return null;
        const rect = canvasEl.getBoundingClientRect();
        if (cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom) {
            if (typeof autoDetectPageFromScreenY === 'function') autoDetectPageFromScreenY(cy);
            if (typeof screenToWorld === 'function') return screenToWorld(cx, cy);
            return { x: Math.round(A4_WIDTH / 2), y: 220 };
        }
        return null;
    };

    const onMove = (mv) => {
        const cx = mv.clientX;
        const cy = mv.clientY;
        if (!activeDrag && Math.hypot(cx - startX, cy - startY) >= 8) {
            activeDrag = true;
            const modal = document.getElementById('nameReactionsHubModal');
            if (modal) modal.classList.add('is-dragging-out');
            const prevGhost = document.getElementById('nrDragGhost');
            if (prevGhost) prevGhost.remove();
            ghostEl = document.createElement('div');
            ghostEl.id = 'nrDragGhost';
            ghostEl.className = 'nr-drag-ghost';
            ghostEl.innerHTML =
                '<img src="' + escapeHTMLAttr(imgSrc) + '" alt="" />' +
                '<div class="nr-drag-ghost-label">🎯 Kéo thả ra giấy: ' + escapeHTMLAttr(modeLabel) + '</div>';
            document.body.appendChild(ghostEl);
        }
        if (activeDrag && ghostEl) {
            ghostEl.style.left = cx + 'px';
            ghostEl.style.top = cy + 'px';
            const canvasEl = (typeof canvas !== 'undefined' && canvas) ? canvas : document.getElementById('chemCanvas');
            const rect = canvasEl && canvasEl.getBoundingClientRect ? canvasEl.getBoundingClientRect() : null;
            let inPaper = !!(rect && cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom);
            if (inPaper && nameReactionsState.docked) {
                const cardEl = document.querySelector('#nameReactionsHubModal .nr-modal-card');
                const cr = cardEl && cardEl.getBoundingClientRect ? cardEl.getBoundingClientRect() : null;
                if (cr && cx >= cr.left && cx <= cr.right && cy >= cr.top && cy <= cr.bottom) inPaper = false;
            }
            ghostEl.style.borderColor = inPaper ? '#10b981' : '#38bdf8';
            const lbl = ghostEl.querySelector('.nr-drag-ghost-label');
            if (lbl) {
                lbl.textContent = (inPaper ? '✅ Thả để đặt lên A4: ' : '🎯 Kéo vào vùng giấy A4: ') + modeLabel + ' · ' + title;
            }
        }
    };

    const onUp = (upEv) => {
        const wasDrag = activeDrag;
        cleanup();
        if (!wasDrag) {
            const opts = { keepModalOpen: !!nameReactionsState.docked };
            if (isReag) pasteReagentCardToPage(id, opts);
            else pasteNameReactionDiagramToPage(id, mode, opts);
            return;
        }
        const cx = upEv && Number.isFinite(upEv.clientX) ? upEv.clientX : startX;
        const cy = upEv && Number.isFinite(upEv.clientY) ? upEv.clientY : startY;
        const pt = getDropTargetPoint(cx, cy);
        if (pt) {
            const opts = {
                x: pt.x,
                y: pt.y,
                centerAtPoint: true,
                keepModalOpen: !!nameReactionsState.docked
            };
            if (isReag) pasteReagentCardToPage(id, opts);
            else pasteNameReactionDiagramToPage(id, mode, opts);
        } else if (typeof showGestureToast === 'function') {
            showGestureToast('Đã hủy kéo — hãy thả vào trong vùng trang giấy A4');
        }
    };

    const onCancel = () => {
        cleanup();
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onCancel, true);
    }
    return true;
}

function renderReferenceHub() {
    syncReferenceHubChrome();
    if (nameReactionsState.tab === 'reagents') {
        renderReagentsHubBody();
    } else {
        renderNameReactionsHubBody();
    }
}

function renderNameReactionsHub() {
    renderReferenceHub();
}

function renderNameReactionsHubBody() {
    const catBar = document.getElementById('nrCategoryBar');
    const listPane = document.getElementById('nrListPane');
    const detailPane = document.getElementById('nrDetailPane');
    const countBadge = document.getElementById('nrCountBadge');
    if (!catBar || !listPane || !detailPane) return;

    const favSet = getNameReactionFavSet();
    const items = nameReactionsState.items || [];
    const filtered = getFilteredNameReactions();

    if (countBadge) {
        countBadge.textContent = nameReactionsState.loaded ? (filtered.length + '/' + items.length + ' P.ứng') : 'Đang tải...';
    }

    catBar.innerHTML = NAME_REACTIONS_CATEGORIES.map(c => {
        let cnt = '';
        if (nameReactionsState.loaded) {
            if (c.id === 'all') cnt = ' (' + items.length + ')';
            else if (c.id === 'fav') cnt = ' (' + favSet.size + ')';
            else cnt = ' (' + items.filter(x => x.cat === c.id).length + ')';
        }
        const activeCls = nameReactionsState.cat === c.id ? ' active' : '';
        return '<button type="button" onclick="setNameReactionsCategory(\'' + c.id + '\')" class="nr-cat-chip' + activeCls + '">' + escapeHTMLAttr(c.label + cnt) + '</button>';
    }).join('');

    if (nameReactionsState.loading && !nameReactionsState.loaded) {
        listPane.innerHTML = '<div class="text-xs p-4 text-center" style="color:var(--text-sub);">Đang tải kho 185 Name Reactions...</div>';
        detailPane.innerHTML = '<div class="text-xs p-6 text-center" style="color:var(--text-sub);">⏳ Đang nạp chỉ mục &amp; sơ đồ hóa học...</div>';
        return;
    }

    if (nameReactionsState.error && !nameReactionsState.loaded) {
        listPane.innerHTML = '<div class="text-xs p-4 text-center text-rose-400">Không tải được dữ liệu.</div>';
        detailPane.innerHTML =
            '<div class="p-6 text-center space-y-3">' +
            '<div class="text-sm font-bold text-rose-400">Lỗi tải kho Name Reactions: ' + escapeHTMLAttr(nameReactionsState.error) + '</div>' +
            '<button type="button" onclick="loadNameReactionsCatalog(true)" class="nr-action-btn primary">🔄 Thử tải lại</button>' +
            '</div>';
        return;
    }

    if (!filtered.length) {
        listPane.innerHTML = '<div class="text-xs p-4 text-center" style="color:var(--text-sub);">Không tìm thấy phản ứng phù hợp.</div>';
        detailPane.innerHTML = '<div class="text-xs p-6 text-center" style="color:var(--text-sub);">Thử gõ từ khóa khác (ví dụ: aldol, Pd, Grignard, mCPBA, NaBH4...) hoặc chuyển sang tab Tất cả.</div>';
        return;
    }

    let selItem = filtered.find(x => Number(x.id) === Number(nameReactionsState.selectedId));
    if (!selItem) {
        selItem = filtered[0];
        nameReactionsState.selectedId = Number(selItem.id);
    }

    listPane.innerHTML = filtered.map(item => {
        const isAct = Number(item.id) === Number(selItem.id);
        const isFav = favSet.has(Number(item.id));
        const catLbl = getNameReactionCategoryLabel(item.cat);
        return (
            '<div onclick="selectNameReactionItem(' + Number(item.id) + ')" class="nr-list-item' + (isAct ? ' active' : '') + '">' +
            '<div class="min-w-0 flex-1">' +
            '<div class="text-xs font-extrabold truncate" style="color:var(--text-main);">' + escapeHTMLAttr(item.vi) + '</div>' +
            '<div class="text-[10.5px] truncate" style="color:var(--text-sub);">' + escapeHTMLAttr(item.en) + '</div>' +
            '<div class="mt-1 flex items-center gap-1.5 text-[10px]" style="color:var(--text-muted);">' +
            '<span class="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 font-bold">' + escapeHTMLAttr(catLbl) + '</span>' +
            '<span>tr.' + Number(item.bookPage || item.pdfPage || 0) + '</span>' +
            '</div>' +
            '</div>' +
            '<button type="button" onclick="toggleFavoriteNameReaction(' + Number(item.id) + ', event)" class="nr-fav-btn' + (isFav ? ' is-fav' : '') + '" title="Đánh dấu yêu thích">★</button>' +
            '</div>'
        );
    }).join('');

    const isSelFav = favSet.has(Number(selItem.id));
    const hasSplit = Number(selItem.splitY || 0) > 20 && Number(selItem.splitY || 0) < Number(selItem.h || 0) - 20;
    const seeAlsoHtml = selItem.seeAlso
        ? '<div class="text-[11.5px] flex items-center gap-1.5 flex-wrap" style="color:var(--text-sub);"><span>🔗 Xem thêm:</span><button type="button" data-nr-see="' + escapeHTMLAttr(selItem.seeAlso) + '" onclick="jumpToRelatedNameReaction(this.dataset.nrSee)" class="underline font-bold text-sky-400 hover:text-sky-300">' + escapeHTMLAttr(selItem.seeAlso) + '</button></div>'
        : '';

    const dragBarHtml =
        '<div class="nr-action-bar">' +
        '<button type="button" onpointerdown="startReferenceDragToPaper(\'reaction\', ' + Number(selItem.id) + ', \'full\', event)" class="nr-drag-pill" title="Chạm nhẹ để dán, hoặc nhấn giữ kéo ra giấy A4">🖐 Kéo Sơ đồ + Cơ chế ra giấy</button>' +
        (hasSplit ? '<button type="button" onpointerdown="startReferenceDragToPaper(\'reaction\', ' + Number(selItem.id) + ', \'scheme\', event)" class="nr-drag-pill scheme" title="Kéo phản ứng tổng quát trực tiếp ra giấy A4">⚗️ Kéo Phản ứng tổng quát</button>' : '') +
        (hasSplit ? '<button type="button" onpointerdown="startReferenceDragToPaper(\'reaction\', ' + Number(selItem.id) + ', \'mech\', event)" class="nr-drag-pill mech" title="Kéo sơ đồ cơ chế trực tiếp ra giấy A4">🔄 Kéo Cơ chế ra giấy</button>' : '') +
        '<button type="button" onclick="pasteNameReactionTextToPage(' + Number(selItem.id) + ')" class="nr-action-btn">📝 Dán Tóm tắt chữ</button>' +
        '</div>' +
        '<div class="text-[10.5px]" style="color:var(--text-muted);">💡 Mẹo: Chạm 1 lần để dán nhanh, hoặc nhấn giữ nút 🖐 / ⚗️ / 🔄 và kéo thẳng ra vị trí muốn đặt trên trang giấy A4.</div>';

    detailPane.innerHTML =
        '<div class="flex items-start justify-between gap-3 flex-wrap">' +
        '<div class="min-w-0 flex-1">' +
        '<div class="flex items-center gap-2 flex-wrap">' +
        '<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300">' + escapeHTMLAttr(getNameReactionCategoryLabel(selItem.cat)) + '</span>' +
        '<span class="text-[11px] font-semibold" style="color:var(--text-sub);">Sách trang ' + Number(selItem.bookPage || 0) + ' (PDF ' + Number(selItem.pdfPage || 0) + ')</span>' +
        '</div>' +
        '<h3 class="text-base sm:text-lg font-black mt-1" style="color:var(--text-main);">' + escapeHTMLAttr(selItem.vi) + '</h3>' +
        '<div class="text-xs font-semibold" style="color:var(--text-sub);">' + escapeHTMLAttr(selItem.en) + '</div>' +
        '</div>' +
        '<button type="button" onclick="toggleFavoriteNameReaction(' + Number(selItem.id) + ', event)" class="nr-action-btn" title="Lưu vào Yêu thích">' + (isSelFav ? '★ Đã lưu' : '☆ Yêu thích') + '</button>' +
        '</div>' +
        dragBarHtml +
        '<div class="nr-fact-grid">' +
        '<div class="nr-fact-card is-start"><div class="nr-fact-label">Chất đầu (Substrates)</div><div class="nr-fact-val">' + escapeHTMLAttr(selItem.start) + '</div></div>' +
        '<div class="nr-fact-card is-reagent"><div class="nr-fact-label">Tác nhân &amp; Điều kiện</div><div class="nr-fact-val">' + escapeHTMLAttr(selItem.reagent) + '</div></div>' +
        '<div class="nr-fact-card is-product"><div class="nr-fact-label">Chất cuối (Sản phẩm)</div><div class="nr-fact-val">' + escapeHTMLAttr(selItem.product) + '</div></div>' +
        '<div class="nr-fact-card is-mech"><div class="nr-fact-label">Tóm tắt Cơ chế phản ứng</div><div class="nr-fact-val">' + escapeHTMLAttr(selItem.mech) + '</div></div>' +
        '</div>' +
        '<div class="text-xs leading-relaxed px-3 py-2.5 rounded-xl border" style="border-color:var(--border-chip);background:rgba(15,23,42,0.22);color:var(--text-sub);">' +
        '<strong style="color:var(--text-main);">📖 Mô tả chi tiết:</strong> ' + escapeHTMLAttr(selItem.desc) +
        '</div>' +
        seeAlsoHtml +
        '<div class="space-y-2">' +
        '<div class="flex items-center justify-between gap-2 flex-wrap">' +
        '<span class="text-xs font-extrabold uppercase tracking-wider" style="color:var(--text-sub);">Sơ đồ &amp; Cơ chế chuẩn ChemDraw (Chạm ảnh để phóng to)</span>' +
        '<button type="button" onclick="toggleNameReactionDiagramZoom()" class="text-[11px] font-bold px-2.5 py-1 rounded-lg border" style="border-color:var(--border-chip);color:var(--text-main);">' + (nameReactionsState.zoomed ? '🔍 Thu gọn' : '🔎 Phóng to 145%') + '</button>' +
        '</div>' +
        '<div id="nrDiagramBox" onclick="toggleNameReactionDiagramZoom()" class="nr-diagram-box' + (nameReactionsState.zoomed ? ' is-zoomed' : '') + '">' +
        '<img src="./name-reactions/' + escapeHTMLAttr(selItem.img) + '" alt="' + escapeHTMLAttr(selItem.vi) + '" loading="eager" />' +
        '</div>' +
        '</div>';
}

function renderReagentsHubBody() {
    const catBar = document.getElementById('nrCategoryBar');
    const listPane = document.getElementById('nrListPane');
    const detailPane = document.getElementById('nrDetailPane');
    const countBadge = document.getElementById('nrCountBadge');
    if (!catBar || !listPane || !detailPane) return;

    const favSet = getReagentFavSet();
    const items = reagentsState.items || [];
    const filtered = getFilteredReagents();

    if (countBadge) {
        countBadge.textContent = reagentsState.loaded ? (filtered.length + '/' + items.length + ' T.nhân') : 'Đang tải...';
    }

    catBar.innerHTML = REAGENTS_CATEGORIES.map(c => {
        let cnt = '';
        if (reagentsState.loaded) {
            if (c.id === 'all') cnt = ' (' + items.length + ')';
            else if (c.id === 'fav') cnt = ' (' + favSet.size + ')';
            else cnt = ' (' + items.filter(x => x.cat === c.id).length + ')';
        }
        const activeCls = reagentsState.cat === c.id ? ' active' : '';
        return '<button type="button" onclick="setReagentsCategory(\'' + c.id + '\')" class="nr-cat-chip' + activeCls + '">' + escapeHTMLAttr(c.label + cnt) + '</button>';
    }).join('');

    if (reagentsState.loading && !reagentsState.loaded) {
        listPane.innerHTML = '<div class="text-xs p-4 text-center" style="color:var(--text-sub);">Đang tải 331 Tác nhân CVP...</div>';
        detailPane.innerHTML = '<div class="text-xs p-6 text-center" style="color:var(--text-sub);">⏳ Đang nạp chỉ mục &amp; bảng tác nhân hữu cơ...</div>';
        return;
    }

    if (reagentsState.error && !reagentsState.loaded) {
        listPane.innerHTML = '<div class="text-xs p-4 text-center text-rose-400">Không tải được dữ liệu.</div>';
        detailPane.innerHTML =
            '<div class="p-6 text-center space-y-3">' +
            '<div class="text-sm font-bold text-rose-400">Lỗi tải Sổ tay Tác nhân: ' + escapeHTMLAttr(reagentsState.error) + '</div>' +
            '<button type="button" onclick="loadReagentsCatalog(true)" class="nr-action-btn primary">🔄 Thử tải lại</button>' +
            '</div>';
        return;
    }

    if (!filtered.length) {
        listPane.innerHTML = '<div class="text-xs p-4 text-center" style="color:var(--text-sub);">Không tìm thấy tác nhân phù hợp.</div>';
        detailPane.innerHTML = '<div class="text-xs p-6 text-center" style="color:var(--text-sub);">Thử gõ từ khóa khác (ví dụ: DMSO, LAH, mCPBA, Pd/C, Grignard, Kẽm...) hoặc chọn Tất cả.</div>';
        return;
    }

    let selItem = filtered.find(x => Number(x.id) === Number(reagentsState.selectedId));
    if (!selItem) {
        selItem = filtered[0];
        reagentsState.selectedId = Number(selItem.id);
    }

    listPane.innerHTML = filtered.map(item => {
        const isAct = Number(item.id) === Number(selItem.id);
        const isFav = favSet.has(Number(item.id));
        const catLbl = getReagentCategoryLabel(item.cat);
        const sttNum = Number(item.stt || item.id);
        const hasCtImg = typeof item.ctImg === 'string' && item.ctImg.length > 0;
        const isFormula = Number(item.ctH || 0) > 0 && Number(item.ctH) <= 28;
        const ctVisualHtml = hasCtImg
            ? ('<img src="./reagents/' + escapeHTMLAttr(item.ctImg) + '" class="nr-ctct-img' + (isFormula ? ' is-formula' : '') + '" alt="' + escapeHTMLAttr(item.name) + '" loading="lazy" />' +
               (item.ctSub ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 shrink-0">' + escapeHTMLAttr(item.ctSub) + '</span>' : ''))
            : '<div class="nr-ctct-fallback">' + escapeHTMLAttr(item.ctFormula || item.name) + '</div>';
        return (
            '<div onclick="selectReagentItem(' + Number(item.id) + ')" title="' + escapeHTMLAttr('#' + sttNum + '. ' + item.name) + '" class="nr-list-item' + (isAct ? ' active' : '') + '">' +
            '<div class="min-w-0 flex-1">' +
            '<div class="nr-reagent-item-head">' +
            '<span class="nr-reagent-stt">#' + sttNum + '</span>' +
            '<div class="nr-ctct-wrap">' + ctVisualHtml + '</div>' +
            '</div>' +
            '<div class="mt-1.5 flex items-center gap-1.5 text-[10px]" style="color:var(--text-muted);">' +
            '<span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">' + escapeHTMLAttr(catLbl) + '</span>' +
            '<span>tr.' + Number(item.bookPage || item.pdfPage || 0) + '</span>' +
            '</div>' +
            '</div>' +
            '<button type="button" onclick="toggleFavoriteReagent(' + Number(item.id) + ', event)" class="nr-fav-btn' + (isFav ? ' is-fav' : '') + '" title="Đánh dấu yêu thích">★</button>' +
            '</div>'
        );
    }).join('');

    const isSelFav = favSet.has(Number(selItem.id));
    detailPane.innerHTML =
        '<div class="flex items-start justify-between gap-3 flex-wrap">' +
        '<div class="min-w-0 flex-1">' +
        '<div class="flex items-center gap-2 flex-wrap">' +
        '<span class="nr-author-badge">✍️ Tác giả: Chu Văn Phòng</span>' +
        '<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300">' + escapeHTMLAttr(getReagentCategoryLabel(selItem.cat)) + '</span>' +
        '<span class="text-[11px] font-semibold" style="color:var(--text-sub);">STT #' + Number(selItem.stt || selItem.id) + ' · Trang ' + Number(selItem.bookPage || 0) + ' (PDF ' + Number(selItem.pdfPage || 0) + ')</span>' +
        '</div>' +
        '<h3 class="text-base sm:text-lg font-black mt-1" style="color:var(--text-main);">' + escapeHTMLAttr(selItem.name) + '</h3>' +
        (selItem.aliases ? '<div class="text-xs font-semibold" style="color:var(--text-sub);">Từ khóa / Viết tắt: ' + escapeHTMLAttr(selItem.aliases) + '</div>' : '') +
        '</div>' +
        '<button type="button" onclick="toggleFavoriteReagent(' + Number(selItem.id) + ', event)" class="nr-action-btn" title="Lưu vào Yêu thích">' + (isSelFav ? '★ Đã lưu' : '☆ Yêu thích') + '</button>' +
        '</div>' +
        '<div class="nr-action-bar">' +
        '<button type="button" onpointerdown="startReferenceDragToPaper(\'reagent\', ' + Number(selItem.id) + ', \'full\', event)" class="nr-drag-pill scheme" title="Chạm nhẹ để dán hoặc kéo thả bảng tác nhân ra giấy A4">🖐 Kéo Bảng Tác Nhân ra giấy A4</button>' +
        '<button type="button" onclick="pasteReagentTextToPage(' + Number(selItem.id) + ')" class="nr-action-btn">📝 Dán tên Tác nhân</button>' +
        '</div>' +
        '<div class="text-[10.5px]" style="color:var(--text-muted);">💡 Mẹo: Chạm 1 lần để dán nhanh, hoặc nhấn giữ nút 🖐 và kéo thẳng ra vị trí muốn đặt trên trang A4 (cuộn xuống để xem toàn bộ bảng phản ứng).</div>' +
        '<div class="space-y-2">' +
        '<div class="flex items-center justify-between gap-2 flex-wrap">' +
        '<span class="text-xs font-extrabold uppercase tracking-wider" style="color:var(--text-sub);">Bảng Tác Nhân &amp; Phản Ứng Đặc Trưng (' + Number(selItem.w || 0) + '×' + Number(selItem.h || 0) + 'px)</span>' +
        '<button type="button" onclick="toggleNameReactionDiagramZoom()" class="text-[11px] font-bold px-2.5 py-1 rounded-lg border" style="border-color:var(--border-chip);color:var(--text-main);">' + (reagentsState.zoomed ? '🔍 Thu gọn' : '🔎 Phóng to 145%') + '</button>' +
        '</div>' +
        '<div id="nrDiagramBox" onclick="toggleNameReactionDiagramZoom()" class="nr-diagram-box' + (reagentsState.zoomed ? ' is-zoomed' : '') + '">' +
        '<img src="./reagents/' + escapeHTMLAttr(selItem.img) + '" alt="' + escapeHTMLAttr(selItem.name) + '" loading="eager" />' +
        '</div>' +
        '</div>';
}

function pasteNameReactionDiagramToPage(id, mode = 'full', opts = {}) {
    const item = (nameReactionsState.items || []).find(x => Number(x.id) === Number(id));
    if (!item || !item.img) return false;
    const imgEl = new Image();
    imgEl.onload = () => {
        const natW = imgEl.naturalWidth || item.w || 600;
        const natH = imgEl.naturalHeight || item.h || 320;
        let sy = 0;
        let sh = natH;
        const splitY = Number(item.splitY || 0);
        if (mode === 'scheme' && splitY > 20 && splitY < natH - 20) {
            sy = 0;
            sh = splitY;
        } else if (mode === 'mech' && splitY > 20 && splitY < natH - 20) {
            sy = splitY;
            sh = natH - splitY;
        }
        let dataUrl = '';
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
            const off = document.createElement('canvas');
            off.width = natW;
            off.height = Math.max(20, sh);
            const octx = off.getContext('2d');
            if (octx) {
                octx.fillStyle = '#ffffff';
                octx.fillRect(0, 0, off.width, off.height);
                octx.imageSmoothingEnabled = true;
                octx.imageSmoothingQuality = 'high';
                octx.drawImage(imgEl, 0, sy, natW, sh, 0, 0, natW, off.height);
                dataUrl = off.toDataURL('image/png');
            }
            off.width = 0;
            off.height = 0;
        }
        if (!dataUrl || dataUrl.length < 30) {
            if (typeof showGestureToast === 'function') showGestureToast('Không thể trích xuất ảnh sơ đồ phản ứng.');
            return;
        }
        if (typeof isReadMode !== 'undefined' && isReadMode && typeof toggleReadMode === 'function') {
            toggleReadMode(false);
        }
        insertDataUrlImageToPage(dataUrl, natW, sh, {
            fromExam: false,
            locked: false,
            x: opts.x,
            y: opts.y,
            centerAtPoint: !!opts.centerAtPoint,
            maxW: Number.isFinite(opts.maxW) ? opts.maxW : Math.min(480, A4_WIDTH * 0.68),
            maxH: Number.isFinite(opts.maxH) ? opts.maxH : Math.round(A4_HEIGHT * 0.72)
        });
        if (!opts.keepModalOpen) closeNameReactionsHubModal();
        if (typeof showGestureToast === 'function') {
            const lbl = mode === 'scheme' ? 'Sơ đồ phản ứng' : (mode === 'mech' ? 'Cơ chế phản ứng' : 'Sơ đồ + Cơ chế');
            showGestureToast('Đã đặt ' + lbl + ' — ' + item.vi + ' lên trang viết!');
        }
    };
    imgEl.onerror = () => {
        if (typeof showGestureToast === 'function') showGestureToast('Lỗi tải ảnh sơ đồ: ' + item.img);
    };
    imgEl.src = './name-reactions/' + item.img;
    return true;
}

function pasteReagentCardToPage(id, opts = {}) {
    const item = (reagentsState.items || []).find(x => Number(x.id) === Number(id));
    if (!item || !item.img) return false;
    const imgEl = new Image();
    imgEl.onload = () => {
        const natW = imgEl.naturalWidth || item.w || 919;
        const natH = imgEl.naturalHeight || item.h || 500;
        let dataUrl = '';
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
            const off = document.createElement('canvas');
            off.width = natW;
            off.height = natH;
            const octx = off.getContext('2d');
            if (octx) {
                octx.fillStyle = '#ffffff';
                octx.fillRect(0, 0, off.width, off.height);
                octx.drawImage(imgEl, 0, 0, natW, natH);
                dataUrl = off.toDataURL('image/png');
            }
            off.width = 0;
            off.height = 0;
        }
        if (!dataUrl || dataUrl.length < 30) {
            if (typeof showGestureToast === 'function') showGestureToast('Không thể trích xuất ảnh tác nhân.');
            return;
        }
        if (typeof isReadMode !== 'undefined' && isReadMode && typeof toggleReadMode === 'function') {
            toggleReadMode(false);
        }
        insertDataUrlImageToPage(dataUrl, natW, natH, {
            fromExam: false,
            locked: false,
            x: opts.x,
            y: opts.y,
            centerAtPoint: !!opts.centerAtPoint,
            maxW: Number.isFinite(opts.maxW) ? opts.maxW : Math.min(540, A4_WIDTH * 0.72),
            maxH: Number.isFinite(opts.maxH) ? opts.maxH : Math.round(A4_HEIGHT * 0.78)
        });
        if (!opts.keepModalOpen) closeNameReactionsHubModal();
        if (typeof showGestureToast === 'function') {
            showGestureToast('Đã đặt bảng tác nhân ' + item.name + ' lên trang viết!');
        }
    };
    imgEl.onerror = () => {
        if (typeof showGestureToast === 'function') showGestureToast('Lỗi tải ảnh tác nhân: ' + item.img);
    };
    imgEl.src = './reagents/' + item.img;
    return true;
}

function pasteReagentTextToPage(id) {
    const item = (reagentsState.items || []).find(x => Number(x.id) === Number(id));
    if (!item) return false;
    if (typeof isReadMode !== 'undefined' && isReadMode && typeof toggleReadMode === 'function') {
        toggleReadMode(false);
    }
    const doc = getDocState();
    saveHistorySnapshot();
    if (!Array.isArray(doc.texts)) doc.texts = [];
    const nb = typeof getActiveNotebook === 'function' ? getActiveNotebook() : null;
    const pageIdx = nb ? (nb.activePageIndex || 0) : 0;
    const pageOffY = typeof getPageYOffset === 'function' ? getPageYOffset(pageIdx) : 0;
    const curZoom = typeof zoom === 'number' && zoom > 0 ? zoom : 1;
    const curPanY = typeof panY === 'number' ? panY : 0;
    const a4H = typeof A4_HEIGHT === 'number' ? A4_HEIGHT : 1122;
    const baseY = Math.max(52, Math.min(a4H - 120, Math.round((-curPanY / curZoom - pageOffY) + 70)));

    doc.texts.push({
        id: typeof genId === 'function' ? genId('txt') : 'txt_' + Date.now() + '_0',
        x: 54,
        y: baseY,
        text: '#' + Number(item.stt || item.id) + '. ' + item.name + (item.aliases ? ' [' + item.aliases + ']' : ''),
        color: '#047857',
        size: 14
    });

    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    persistLibrary();
    renderAll();
    if (!nameReactionsState.docked) closeNameReactionsHubModal();
    if (typeof showGestureToast === 'function') {
        showGestureToast('Đã dán tên tác nhân ' + item.name + ' lên trang viết!');
    }
    return true;
}

function wrapNameReactionTextLines(prefix, text, maxLen = 78) {
    const full = (prefix ? prefix + ' ' : '') + String(text || '').trim();
    if (!full) return [];
    const words = full.split(/\s+/);
    const out = [];
    let cur = '';
    words.forEach(w => {
        if (!cur) {
            cur = w;
        } else if (cur.length + 1 + w.length <= maxLen) {
            cur += ' ' + w;
        } else {
            out.push(cur);
            cur = '   ' + w;
        }
    });
    if (cur) out.push(cur);
    return out;
}

function pasteNameReactionTextToPage(id) {
    const item = (nameReactionsState.items || []).find(x => Number(x.id) === Number(id));
    if (!item) return false;
    if (typeof isReadMode !== 'undefined' && isReadMode && typeof toggleReadMode === 'function') {
        toggleReadMode(false);
    }
    const doc = getDocState();
    saveHistorySnapshot();
    if (!Array.isArray(doc.texts)) doc.texts = [];
    const nb = typeof getActiveNotebook === 'function' ? getActiveNotebook() : null;
    const pageIdx = nb ? (nb.activePageIndex || 0) : 0;
    const pageOffY = typeof getPageYOffset === 'function' ? getPageYOffset(pageIdx) : 0;
    const curZoom = typeof zoom === 'number' && zoom > 0 ? zoom : 1;
    const curPanY = typeof panY === 'number' ? panY : 0;
    const a4H = typeof A4_HEIGHT === 'number' ? A4_HEIGHT : 1122;
    const baseY = Math.max(52, Math.min(a4H - 260, Math.round((-curPanY / curZoom - pageOffY) + 70)));

    const lines = [];
    lines.push({ text: item.vi + ' (' + item.en + ')', color: '#0369a1', size: 15 });
    wrapNameReactionTextLines('• Chất đầu:', item.start, 78).forEach(t => lines.push({ text: t, color: '#0f172a', size: 13 }));
    wrapNameReactionTextLines('• Tác nhân:', item.reagent, 78).forEach(t => lines.push({ text: t, color: '#b45309', size: 13 }));
    wrapNameReactionTextLines('• Chất cuối:', item.product, 78).forEach(t => lines.push({ text: t, color: '#047857', size: 13 }));
    wrapNameReactionTextLines('• Cơ chế:', item.mech, 78).forEach(t => lines.push({ text: t, color: '#0f172a', size: 13 }));

    lines.forEach((ln, idx) => {
        doc.texts.push({
            id: typeof genId === 'function' ? genId('txt') : 'txt_' + Date.now() + '_' + idx,
            x: 54,
            y: baseY + idx * 21,
            text: ln.text,
            color: ln.color,
            size: ln.size
        });
    });

    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    persistLibrary();
    renderAll();
    if (!nameReactionsState.docked) closeNameReactionsHubModal();
    if (typeof showGestureToast === 'function') {
        showGestureToast('Đã dán tóm tắt ' + item.vi + ' lên trang viết!');
    }
    return true;
}


