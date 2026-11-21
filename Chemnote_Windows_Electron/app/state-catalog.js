/* ============================================================================
 * MODULE 1: STATE & CATALOG (Biến toàn cục, Kho biểu tượng SVG, Lưu trữ & Undo)
 * ============================================================================ */

let A4_WIDTH = 794, A4_HEIGHT = 1123;
const PAGE_GAP = 0;
let BOND_LENGTH = 44;
let penColor = '#111827', strokeWidth = 2.8, activeStrokeSlot = 2;
let activePenStyle = 'fountain';
let penSmoothing = 0.50;
let penOpacity = 1.0;
const APP_CURRENT_VERSION = {
    version: '15.15.2',
    versionCode: 37,
    releasedAt: '2026-11-21',
    title: 'v15.15.2 — Bút Máy Thanh–Đậm Chữ Đẹp, Chèn Bảng Tóm Tắt & Gợi Ý iPad'
};
const DEFAULT_FAVORITE_COLORS = ['#111827', '#0ea5e9', '#fb7185', '#10b981', '#fbbf24'];
const DEFAULT_HIGHLIGHTER_COLORS = ['#fef08a', '#86efac', '#f9a8d4', '#7dd3fc', '#fdba74'];
let highlighterColor = DEFAULT_HIGHLIGHTER_COLORS[0];
let slotWidths = { 1: 1.8, 2: 2.8, 3: 5.0 };
let highlighterWidth = 14, activeHighlighterSlot = 2;
let highlighterSlotWidths = { 1: 8, 2: 14, 3: 24 };
let eraserRadius = 24, activeEraserSlot = 2;
let eraserSlotRadii = { 1: 12, 2: 24, 3: 42 };
window.unifiedTool = 'chem_bond';
let previousToolBeforeEraser = 'chem_bond';
let activeRingType = 'benzene';
let activeRxnArrowType = 'normal';
let activeMechArrowType = '2e_120';
let activeOrbitalType = 'p_top_shaded';
let activeChemSymTool = 'plus_circle';
let activeConformerType = 'chair_left';
let activeLabItemType = 'erlenmeyer';
let activeLabLiquidColor = '#38bdf8';
let activeGroupLabel = 'OH';
let activeSnippetId = null;
let recentGroups = ['OH', 'NO2', 'OMe', 'Cl', 'Br', 'Ph'];
let subModalFilter = 'all';
let subManageMode = false;
let atomHoldTimer = null;
let atomHoldState = null;
let inkHoldTimer = null;
let inkHoldState = null;

const canvas = document.getElementById('chemCanvas');
const _uaRaw = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
const _isAppleWebKit = /iPad|iPhone|iPod/i.test(_uaRaw) ||
    (/Macintosh/i.test(_uaRaw) && typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints) > 1) ||
    (/Safari/i.test(_uaRaw) && !/Chrome|Chromium|Edg|Android/i.test(_uaRaw));
const ctx = (canvas && typeof canvas.getContext === 'function')
    ? (_isAppleWebKit
        ? (canvas.getContext('2d', { willReadFrequently: false }) || canvas.getContext('2d'))
        : (canvas.getContext('2d', { desynchronized: true, willReadFrequently: false }) || canvas.getContext('2d')))
    : null;
let cssWidth = 800, cssHeight = 600, zoom = 1, panX = 0, panY = 0;
let cachedCanvasRect = { left: 0, top: 0, width: 800, height: 600 };
let _rectDirty = true;
let _lastRectUpdateTime = 0;

function refreshCanvasRect() {
    const vp = typeof document !== 'undefined' ? document.getElementById('deskViewport') : null;
    const vr = (vp && typeof vp.getBoundingClientRect === 'function') ? vp.getBoundingClientRect() : null;
    const nowR = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
    if (canvas && typeof canvas.getBoundingClientRect === 'function') {
        const r = canvas.getBoundingClientRect();
        const w = (vr && vr.width > 0) ? vr.width : (r?.width || 0);
        const h = (vr && vr.height > 0) ? vr.height : (r?.height || 0);
        if (r && w > 0 && h > 0) {
            cachedCanvasRect = { left: r.left || 0, top: r.top || 0, width: w, height: h };
            _rectDirty = false;
            _lastRectUpdateTime = nowR;
            return cachedCanvasRect;
        }
    }
    if (vr && vr.width > 0 && vr.height > 0) {
        cachedCanvasRect = { left: vr.left || 0, top: vr.top || 0, width: vr.width, height: vr.height };
        _rectDirty = false;
        _lastRectUpdateTime = nowR;
        return cachedCanvasRect;
    }
    return cachedCanvasRect;
}

function getFastCanvasRect(forceRefresh = false) {
    if (forceRefresh || _rectDirty) {
        return refreshCanvasRect();
    }
    const nowR = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
    const inActiveGesture = typeof activePointers !== 'undefined' && activePointers && activePointers.size > 0;
    if (inActiveGesture && (nowR - _lastRectUpdateTime) < 1000) {
        return cachedCanvasRect;
    }
    return refreshCanvasRect();
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', () => { _rectDirty = true; }, { passive: true });
    window.addEventListener('scroll', () => { _rectDirty = true; }, { passive: true, capture: true });
    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
        window.visualViewport.addEventListener('resize', () => { _rectDirty = true; }, { passive: true });
        window.visualViewport.addEventListener('scroll', () => { _rectDirty = true; }, { passive: true });
    }
}

let isDrawing = false, dragStartAtom = null, dragStartPos = null, currentWorldPos = null;
let currentInkStroke = null, activeExtraDragItem = null;
let activeMoveTarget = null;
let hoveredAtom = null;
let hoveredBond = null;
let selectedBondId = null;
let previewChainPoints = [];
let activeCarbonChain = { active: false, mode: 'zigzag', atomIds: [], dirX: 1, fischerSpines: [] };
const activePointers = new Map();
let lastPinchDist = null, lastPanMid = null, pinchStartZoom = null, pinchStartMid = null, pinchStartPan = null;

let activeRingGizmo = { active: false, atomIds: [], ringAtomIds: [], chairType: null, bondIds: [], orbitalIds: [], cx: 0, cy: 0, radius: 44, dragMode: null, dragStartMouse: null, dragStartAngle: 0, dragStartRadius: 44, initialAtomOffsets: [], initialOrbitalOffsets: [] };
let lassoSelection = {
    active: false, dragging: false, polygon: [], bounds: null,
    selectedInkIndices: [], selectedAtomIds: [],
    selectedOrbitalIds: [], selectedSymbolIds: [], selectedTextIds: [],
    selectedArrowIds: [], selectedMechArrowIds: [], selectedBracketIds: [],
    selectedImageIds: [],
    lastDragPos: null
};
let activeImageSelection = { id: null, dragMode: null, startMouse: null, origX: 0, origY: 0, origW: 0, origH: 0 };
const imageObjCache = new Map();
let laserStrokes = [], currentLaserStroke = null, laserAnimFrame = null;
let undoStack = [], redoStack = [];
let toastTimer = null;
let isPresentationMode = false;
let audienceWindow = null;
let audienceFollowZoom = true;
let isCleanRecording = false;
let recordWithMic = false;
let cleanRecordCanvas = null;
let cleanMediaRecorder = null;
let cleanRecordedChunks = [];
let cleanRecordStartTime = 0;
let cleanRecordTimer = null;
let cleanRecordHeartbeat = null;
let cleanRecordAudioStream = null;
let lastAutoPageAppendAt = 0;
let wheelOverscrollY = 0;
let undoPushSeq = 0;
let lastCanvasTapInfo = { time: 0, x: 0, y: 0, clientX: 0, clientY: 0, preTapSnapshot: null, preTapPushSeq: 0 };
let lastBondTapInfo = { bondId: null, time: 0, clientX: 0, clientY: 0, preTapSnapshot: null, preTapPushSeq: 0, hadUndo: false };
let lastAtomTapInfo = { atomId: null, x: 0, y: 0, time: 0, clientX: 0, clientY: 0, preTapSnapshot: null, preTapPushSeq: 0, hadUndo: false };
let pointerDownClientPos = null;
let pointerDownTime = 0;
let pointerMaxMoveDist = 0;
let pointerDownEligibleForDoubleTap = false;
let pointerDownSnapshot = null;
let pointerDownPushSeq = 0;
let pointerDownRedoSnapshot = null;
let lastEraserPoint = null;
let editingHotkeyActionId = null;
let multiTouchTapState = { active: false, maxPointers: 0, startTime: 0, movedFar: false, startPoints: new Map(), startMid: null, endMid: null };
let singleFingerPanState = { active: false, pointerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0, startTime: 0, isEdgeSwipe: false };
let spacePanPressed = false;
let mousePanState = { active: false, pointerId: null, button: -1, startX: 0, startY: 0, lastX: 0, lastY: 0, startTime: 0, moved: false };
let isReadMode = false;
let readTwoPageMode = true;
let readPanState = { active: false, pointerId: null, lastX: 0, lastY: 0 };
let examDrawerState = {
    open: false,
    cropMode: true,
    viewMode: 'crop',
    activeSheetIndex: 0,
    zoom: 1,
    cropRect: null,
    isDraggingCrop: false,
    dragStart: null,
    panScroll: { active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 }
};

const HOTKEY_ACTIONS_CATALOG = [
    // 1. Công cụ Hóa học
    { id: 'tool_chem_bond', scope: 'global', category: 'Công cụ Hóa học', label: 'Mạch Carbon C–C', defaultKey: 'c', tool: 'chem_bond' },
    { id: 'tool_chem_move', scope: 'global', category: 'Công cụ Hóa học', label: 'Di chuyển / Kéo đối tượng', defaultKey: 'v', tool: 'chem_move' },
    { id: 'tool_chem_wedge', scope: 'global', category: 'Công cụ Hóa học', label: 'Liên kết đậm (Wedge)', defaultKey: 'w', tool: 'chem_wedge' },
    { id: 'tool_chem_dash', scope: 'global', category: 'Công cụ Hóa học', label: 'Liên kết đứt (Dash)', defaultKey: 'd', tool: 'chem_dash' },
    { id: 'tool_chem_ring', scope: 'global', category: 'Công cụ Hóa học', label: 'Đóng dấu Vòng thơm / Dị vòng', defaultKey: 'r', tool: 'chem_ring' },
    { id: 'tool_chem_rxn_arrow', scope: 'global', category: 'Công cụ Hóa học', label: 'Mũi tên phản ứng', defaultKey: 'a', tool: 'chem_rxn_arrow' },
    { id: 'tool_chem_mech_arrow', scope: 'global', category: 'Công cụ Hóa học', label: 'Mũi tên cơ chế cong', defaultKey: 'k', tool: 'chem_mech_arrow' },
    { id: 'tool_chem_orbital', scope: 'global', category: 'Công cụ Hóa học', label: 'Vân đạo Orbital', defaultKey: 'o', tool: 'chem_orbital' },
    { id: 'tool_chem_symbol', scope: 'global', category: 'Công cụ Hóa học', label: 'Điện tích / Gốc tự do / Newman', defaultKey: 's', tool: 'chem_symbol' },
    { id: 'tool_chem_conformer', scope: 'global', category: 'Công cụ Hóa học', label: 'Cấu dạng Ghế / Thuyền / Newman', defaultKey: 'g', tool: 'chem_conformer' },
    { id: 'tool_chem_text', scope: 'global', category: 'Công cụ Hóa học', label: 'Viết chữ / Điều kiện phản ứng', defaultKey: 't', tool: 'chem_text' },

    // 2. Bút & Công cụ Viết tay Goodnotes
    { id: 'tool_pen_pan', scope: 'global', category: 'Bút & Viết tay', label: 'Bàn tay Kéo / Di chuyển bảng (hoặc giữ Space)', defaultKey: 'x', penMode: 'pan' },
    { id: 'tool_pen_ballpoint', scope: 'global', category: 'Bút & Viết tay', label: 'Bút viết (Ballpoint)', defaultKey: 'p', penMode: 'ballpoint' },
    { id: 'tool_pen_highlighter', scope: 'global', category: 'Bút & Viết tay', label: 'Bút dạ quang (Highlighter)', defaultKey: 'h', penMode: 'highlighter' },
    { id: 'tool_pen_eraser', scope: 'global', category: 'Bút & Viết tay', label: 'Cục tẩy (Eraser)', defaultKey: 'e', penMode: 'eraser' },
    { id: 'tool_pen_lasso', scope: 'global', category: 'Bút & Viết tay', label: 'Khoanh vùng Lasso', defaultKey: 'l', penMode: 'lasso' },
    { id: 'tool_pen_laser', scope: 'global', category: 'Bút & Viết tay', label: 'Bút Laser thuyết trình', defaultKey: 'q', penMode: 'laser' },

    // 3. Trang giấy, Trình chiếu & Hệ thống
    { id: 'act_new_page', scope: 'global', category: 'Trang giấy & Trình chiếu', label: 'Thêm trang giấy mới', defaultKey: 'n' },
    { id: 'act_prev_page', scope: 'global', category: 'Trang giấy & Trình chiếu', label: 'Chuyển trang trước', defaultKey: '[' },
    { id: 'act_next_page', scope: 'global', category: 'Trang giấy & Trình chiếu', label: 'Chuyển trang sau', defaultKey: ']' },
    { id: 'act_fit_screen', scope: 'global', category: 'Trang giấy & Trình chiếu', label: 'Căn trang vừa màn hình', defaultKey: '0' },
    { id: 'act_audience_win', scope: 'global', category: 'Trang giấy & Trình chiếu', label: 'Mở/Đóng Bảng Trắng Zoom/Meet', defaultKey: '/' },
    { id: 'act_clean_rec', scope: 'global', category: 'Trang giấy & Trình chiếu', label: 'Bật/Dừng Quay Video Bảng Sạch', defaultKey: ';' },
    { id: 'act_pres_mode', scope: 'global', category: 'Trang giấy & Trình chiếu', label: 'Ẩn/Hiện Hub Toàn màn hình', defaultKey: 'f9' },
    { id: 'act_read_mode', scope: 'global', category: 'Trang giấy & Trình chiếu', label: 'Bật/Tắt Chế độ Đọc (1–2 trang)', defaultKey: 'm' },
    { id: 'act_help_modal', scope: 'global', category: 'Trang giấy & Trình chiếu', label: 'Mở Hướng dẫn & Phím tắt', defaultKey: '?' },

    // 4. Đổi Nhóm thế nhanh khi trỏ vào Nguyên tử
    { id: 'atom_OH', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -OH', defaultKey: 'o', atomLabel: 'OH' },
    { id: 'atom_NH2', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -NH2', defaultKey: 'n', atomLabel: 'NH2' },
    { id: 'atom_SH', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -SH', defaultKey: 's', atomLabel: 'SH' },
    { id: 'atom_F', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -F', defaultKey: 'f', atomLabel: 'F' },
    { id: 'atom_Cl', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -Cl', defaultKey: 'c', atomLabel: 'Cl' },
    { id: 'atom_Br', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -Br', defaultKey: 'b', atomLabel: 'Br' },
    { id: 'atom_I', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -I', defaultKey: 'i', atomLabel: 'I' },
    { id: 'atom_P', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nguyên tử P', defaultKey: 'p', atomLabel: 'P' },
    { id: 'atom_Me', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -Me', defaultKey: 'm', atomLabel: 'Me' },
    { id: 'atom_Et', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -Et', defaultKey: 'e', atomLabel: 'Et' },
    { id: 'atom_OAc', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -OAc', defaultKey: 'a', atomLabel: 'OAc' },
    { id: 'atom_COOH', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -COOH', defaultKey: 'g', atomLabel: 'COOH' },
    { id: 'atom_NO2', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -NO2', defaultKey: 'y', atomLabel: 'NO2' },
    { id: 'atom_CHO', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Gắn nhóm -CHO', defaultKey: 'j', atomLabel: 'CHO' },
    { id: 'atom_C', scope: 'atom', category: 'Khi trỏ vào Nguyên tử', label: 'Đưa về Carbon ẩn (C)', defaultKey: 'z', atomLabel: 'C' },

    // 5. Đổi Liên kết nhanh khi trỏ vào Liên kết
    { id: 'bond_1', scope: 'bond', category: 'Khi trỏ vào Liên kết', label: 'Liên kết đơn (Bậc 1)', defaultKey: '1', bondOrder: 1 },
    { id: 'bond_2', scope: 'bond', category: 'Khi trỏ vào Liên kết', label: 'Liên kết đôi (Bậc 2)', defaultKey: '2', bondOrder: 2 },
    { id: 'bond_3', scope: 'bond', category: 'Khi trỏ vào Liên kết', label: 'Liên kết ba (Bậc 3)', defaultKey: '3', bondOrder: 3 },
    { id: 'bond_wedge', scope: 'bond', category: 'Khi trỏ vào Liên kết', label: 'Bật/Tắt Nét đậm (Wedge)', defaultKey: 'w', bondStereo: 'wedge' },
    { id: 'bond_dash', scope: 'bond', category: 'Khi trỏ vào Liên kết', label: 'Bật/Tắt Nét đứt (Dash)', defaultKey: 'd', bondStereo: 'dash' }
];

function genId(p = 'id') { return p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36); }
const LAB_LIQUID_COLORS = [
    { hex: 'none', title: 'Không chứa dung dịch' },
    { hex: '#38bdf8', title: 'Xanh lam (CuSO4 / Dung dịch)' },
    { hex: '#f472b6', title: 'Hồng (Phenolphtalein)' },
    { hex: '#fbbf24', title: 'Vàng cam (Br2 / Fe3+)' },
    { hex: '#a855f7', title: 'Tím (KMnO4)' },
    { hex: '#34d399', title: 'Xanh lục (Fe2+ / Ni2+)' }
];

const LAB_EQUIPMENT_CATALOG = [
    { id: 'test_tube', title: 'Ống nghiệm', svg: '<path d="M9 3h6M10 3v13a2 2 0 0 0 4 0V3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M10 12h4v4a2 2 0 0 1-4 0z" fill="#38bdf8" opacity="0.5"/>' },
    { id: 'erlenmeyer', title: 'Bình tam giác', svg: '<path d="M9 3h6M10 3v5l-5 9.5A1.8 1.8 0 0 0 6.6 20h10.8a1.8 1.8 0 0 0 1.6-2.5L14 8V3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M6.8 14.5h10.4l1.5 3a1.5 1.5 0 0 1-1.3 2H6.6a1.5 1.5 0 0 1-1.3-2z" fill="#38bdf8" opacity="0.45"/>' },
    { id: 'round_flask', title: 'Bình cầu tròn', svg: '<path d="M9 3h6M10 3v4.5a6.2 6.2 0 1 0 4 0V3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M6.5 14.5a5.8 5.8 0 0 0 11 0z" fill="#38bdf8" opacity="0.45"/>' },
    { id: 'distill_flask', title: 'Bình cầu nhánh', svg: '<path d="M8 3h6M9 3v4.8a5.8 5.8 0 1 0 4 0V3M13 6l6 2.5" fill="none" stroke="currentColor" stroke-width="1.9"/>' },
    { id: 'beaker', title: 'Cốc chia vạch', svg: '<path d="M5 5l1.5 1.5V19a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V5" fill="none" stroke="currentColor" stroke-width="1.9"/><line x1="9" y1="10" x2="13" y2="10"/><line x1="9" y1="14" x2="13" y2="14"/>' },
    { id: 'grad_cylinder', title: 'Ống đong', svg: '<path d="M9 4v15h6V4M7 20h10" fill="none" stroke="currentColor" stroke-width="1.9"/><line x1="10" y1="8" x2="13" y2="8"/><line x1="10" y1="12" x2="13" y2="12"/><line x1="10" y1="16" x2="13" y2="16"/>' },
    { id: 'burette', title: 'Buret chuẩn độ', svg: '<path d="M10 2v13l1.5 3.5h1L14 15V2M8 15h8" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="18.5" x2="12" y2="22"/>' },
    { id: 'pipette', title: 'Pipet bầu', svg: '<path d="M12 2v5c-2.5 1.4-2.5 6.2 0 7.6V22M12 7c2.5 1.4 2.5 6.2 0 7.6" fill="none" stroke="currentColor" stroke-width="1.9"/>' },
    { id: 'sep_funnel', title: 'Phễu chiết', svg: '<path d="M9 3h6M10 3l-3.5 6.5c0 3 2.8 5 5.5 5.5v5.5M14 3l3.5 6.5c0 3-2.8 5-5.5 5.5M9 17.5h6" fill="none" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'filter_funnel', title: 'Phễu lọc', svg: '<path d="M4 5l7 8v8h2v-8l7-8" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="6.5" y1="5.5" x2="17.5" y2="5.5" stroke-dasharray="2 2"/>' },
    { id: 'alcohol_lamp', title: 'Đèn cồn', svg: '<path d="M6 19h12l-1.8-6.5H7.8zM10 12.5V10h4v2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 3c-2 2.5-2.2 5 0 6.5 2.2-1.5 2-4 0-6.5z" fill="#f59e0b" stroke="#ea580c" stroke-width="1.3"/>' },
    { id: 'retort_stand', title: 'Giá đỡ & Kẹp', svg: '<path d="M4 20h12M7 20V3M7 8h9M15 6.5v3" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'condenser', title: 'Sinh hàn', svg: '<line x1="3" y1="18" x2="21" y2="6" stroke-width="1.8"/><rect x="6.5" y="9" width="11" height="6" rx="1.5" transform="rotate(-33 12 12)" fill="none" stroke="currentColor" stroke-width="1.7"/>' },
    { id: 'kipp_apparatus', title: 'Bình Kipp', svg: '<circle cx="12" cy="6.5" r="2.8" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9.5 16.5L8 20h8l-1.5-3.5" fill="none" stroke="currentColor" stroke-width="1.7"/>' },
    { id: 'water_trough', title: 'Chậu thu khí', svg: '<path d="M3 11v9h18v-9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 14.5h18v5.5H3z" fill="#38bdf8" opacity="0.35"/><path d="M9.5 16V6h5v10" fill="none" stroke="currentColor" stroke-width="1.7"/>' },
    { id: 'thermometer', title: 'Nhiệt kế', svg: '<path d="M10.5 3a1.5 1.5 0 0 1 3 0v11.5a3 3 0 1 1-3 0z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="17.5" r="1.4" fill="#ef4444" stroke="none"/><line x1="12" y1="8" x2="12" y2="16.5" stroke="#ef4444" stroke-width="1.8"/>' }
];

function createEmptyPageContent() {
    return { images: [], atoms: [], bonds: [], arrows: [], mechArrows: [], orbitals: [], chemSymbols: [], labItems: [], labWidgets: [], texts: [], brackets: [], inkStrokes: [] };
}

const STORAGE_KEY = 'CHEMNOTES_GN6_V9';
let appLibrary = {
    folders: [
        { id: 'f_org', name: 'Hóa Hữu Cơ', color: '#38bdf8' },
        { id: 'f_mech', name: 'Cơ Chế Phản Ứng', color: '#f43f5e' }
    ],
    notebooks: [],
    openTabIds: [],
    activeNotebookId: null,
    hubFilter: 'all',
    hubViewMode: 'grid',
    autoAddPage: true,
    bondLength: 44,
    favouriteGroups: ['OH', 'NH2', 'NO2', 'COOH', 'Br', 'Cl', 'OMe', 'Ph'],
    quickGroupSlots: ['OH', 'NO2', 'OMe', 'Cl', 'Br', 'Ph'],
    lockedGroupSlots: [false, false, false, false, false, false],
    customSubstituents: [],
    deletedSubstituents: [],
    customSnippets: [],
    favoriteNameReactions: [],
    favoriteReagents: [],
    appTheme: 'midnight_sky',
    favoriteColors: ['#111827', '#0ea5e9', '#fb7185', '#10b981', '#fbbf24'],
    activeFavoriteColorIdx: 0,
    brightColorsV14_2: true,
    penPillConfig: {
        dock: 'top_center',
        x: null,
        y: null,
        vertical: false,
        scale: 1.0,
        carbonNextToPenV14_2: true,
        movedImgLaserToNavyV15: true,
        itemOrder: ['undo_redo', 'carbon', 'ballpoint', 'highlighter', 'eraser', 'lasso', 'pan', 'stroke_slots', 'color_wells'],
        visibleItems: ['undo_redo', 'carbon', 'ballpoint', 'highlighter', 'eraser', 'lasso', 'stroke_slots', 'color_wells']
    },
    navyToolbarConfig: {
        movedImgLaserToNavyV15: true,
        itemOrder: ['page_grid', 'paper_tpl', 'chem_bond', 'chem_move', 'chem_stereo_hub', 'chem_ring_hub', 'chem_arrow_hub', 'chem_special_hub', 'chem_text', 'pen_image', 'pen_laser', 'add_page', 'export_png'],
        hiddenItems: []
    },
    customChemPill: {
        enabled: false,
        collapsed: false,
        x: 16,
        y: 148,
        vertical: false,
        scale: 1.0,
        tools: ['chem_bond', 'chem_move', 'pen_ballpoint']
    },
    splitView: { enabled: false, rightNotebookId: null, rightPageIndex: 0, rightZoom: 0.58, rightPanX: 20, rightPanY: 20 }
};

const APP_THEME_CATALOG = [
    { id: 'midnight_sky', title: 'Đen Xanh Neon (Mặc định)', preview: ['#0b1120', '#142850', '#38bdf8'] },
    { id: 'sakura_cute', title: 'Hồng Trắng (Dễ thương 🌸)', preview: ['#fdf2f7', '#fce7f3', '#db2777'] },
    { id: 'mint_cream', title: 'Xanh Lục Kem (Matcha & Mint 🌿)', preview: ['#eef8f3', '#d8f3e5', '#047857'] },
    { id: 'lavender_milk', title: 'Trắng Tím Pastel (Lavender 💜)', preview: ['#f8f5ff', '#ede9fe', '#8b5cf6'] },
    { id: 'pearl_light', title: 'Trắng Xanh Ngọc Trai', preview: ['#f1f5f9', '#dbeafe', '#0284c7'] },
    { id: 'cyber_aurora', title: 'Đen Tím Cực Quang (Aurora 🌌)', preview: ['#090d1a', '#2e1065', '#22d3ee'] },
    { id: 'emerald_lab', title: 'Đen Xanh Lục Ngọc Bích 💎', preview: ['#071717', '#0d2e2a', '#10b981'] },
    { id: 'violet_cosmos', title: 'Đen Tím Tinh Vân', preview: ['#110c21', '#2b1d52', '#a78bfa'] },
    { id: 'amber_warm', title: 'Đen Hổ Phách Ấm', preview: ['#19120b', '#422811', '#fbbf24'] },
    { id: 'rose_studio', title: 'Đen Hồng Ngọc Studio', preview: ['#1c0c14', '#4c142e', '#fb7185'] }
];

const PEN_PILL_ITEMS_CATALOG = [
    { id: 'undo_redo', label: 'Hoàn tác / Làm lại' },
    { id: 'carbon', label: 'Vẽ Mạch Carbon (C–C)' },
    { id: 'ballpoint', label: 'Bút Máy Notewise / Bút chính' },
    { id: 'highlighter', label: 'Dạ quang' },
    { id: 'eraser', label: 'Tẩy' },
    { id: 'lasso', label: 'Lasso khoanh vùng' },
    { id: 'pan', label: 'Bàn tay Kéo bảng (Tùy chọn)' },
    { id: 'stroke_slots', label: '3 cỡ nét nhanh' },
    { id: 'color_wells', label: 'Bảng màu nhanh' }
];

const NAVY_TOOLBAR_ITEMS_CATALOG = [
    { id: 'page_grid', label: 'Lưới trang & Tỉ lệ' },
    { id: 'paper_tpl', label: 'Mẫu giấy & Nền trang' },
    { id: 'chem_bond', label: 'Mạch Carbon (C–C)' },
    { id: 'chem_move', label: 'Di chuyển & Chọn' },
    { id: 'chem_stereo_hub', label: 'Nét thanh & Nét gạch (Wedge/Dash)' },
    { id: 'chem_ring_hub', label: 'Kho Vòng & Nhóm thế' },
    { id: 'chem_arrow_hub', label: 'Mũi tên Phản ứng & Cơ chế e⁻' },
    { id: 'chem_special_hub', label: 'Cấu dạng, Orbital & Điện tích e⁻' },
    { id: 'chem_text', label: 'Chữ & Điều kiện Phản ứng' },
    { id: 'pen_image', label: 'Gắn & Quản lý Ảnh' },
    { id: 'pen_laser', label: 'Bút Laser thuyết trình' },
    { id: 'add_page', label: 'Thêm trang mới' },
    { id: 'export_png', label: 'Xuất PDF / Chia sẻ ảnh' }
];

const CUSTOM_PILL_TOOL_CATALOG = [
    { id: 'chem_bond', cat: 'Liên kết & Sửa', title: 'Vẽ mạch Carbon (C–C)', shortLabel: '', svg: '<line x1="5" y1="19" x2="19" y2="5"/>' },
    { id: 'chem_move', cat: 'Liên kết & Sửa', title: 'Di chuyển / Chỉnh Bezier', shortLabel: '', svg: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>' },
    { id: 'chem_wedge', cat: 'Liên kết & Sửa', title: 'Nét đậm Wedge', shortLabel: '', svg: '<polygon points="4,20 17,4 21,8" fill="currentColor" stroke="none"/>' },
    { id: 'chem_dash', cat: 'Liên kết & Sửa', title: 'Nét đứt Dash', shortLabel: '', svg: '<line x1="5" y1="19" x2="7" y2="17"/><line x1="9" y1="15" x2="12" y2="12"/><line x1="14" y1="10" x2="17" y2="7"/><line x1="18" y1="6" x2="21" y2="3"/>' },
    { id: 'chem_text', cat: 'Liên kết & Sửa', title: 'Gõ chữ / Điều kiện', shortLabel: 'T', svg: '' },

    { id: 'ring_benzene', cat: 'Vòng & Cấu dạng', title: 'Vòng Benzen', shortLabel: '', svg: '<polygon points="12 3 19.5 7.5 19.5 16.5 12 21 4.5 16.5 4.5 7.5"/><circle cx="12" cy="12" r="4.2"/>' },
    { id: 'ring_r6', cat: 'Vòng & Cấu dạng', title: 'Xiclohexan (C6)', shortLabel: '', svg: '<polygon points="12 3 19.5 7.5 19.5 16.5 12 21 4.5 16.5 4.5 7.5"/>' },
    { id: 'ring_r5', cat: 'Vòng & Cấu dạng', title: 'Xiclopentan (C5)', shortLabel: '', svg: '<polygon points="12 3 20 9 17 19 7 19 4 9"/>' },
    { id: 'ring_pyridine', cat: 'Vòng & Cấu dạng', title: 'Pyridin', shortLabel: 'Pyr', svg: '' },
    { id: 'conf_chair_left', cat: 'Vòng & Cấu dạng', title: 'Cấu dạng Ghế trái', shortLabel: '', svg: '<polyline points="3 15 8 8 15 10 21 6 16 14 9 12 3 15"/>' },
    { id: 'conf_chair_right', cat: 'Vòng & Cấu dạng', title: 'Cấu dạng Ghế phải', shortLabel: '', svg: '<polyline points="3 8 9 10 16 8 21 15 15 13 8 15 3 8"/>' },
    { id: 'conf_newman_stag', cat: 'Vòng & Cấu dạng', title: 'Chiếu Newman', shortLabel: '', svg: '<circle cx="12" cy="12" r="5.5"/><line x1="12" y1="12" x2="12" y2="3"/><line x1="12" y1="12" x2="5" y2="17"/><line x1="12" y1="12" x2="19" y2="17"/>' },
    { id: 'conf_fischer_2', cat: 'Vòng & Cấu dạng', title: 'Công thức Fischer', shortLabel: '', svg: '<line x1="12" y1="3" x2="12" y2="21"/><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/>' },

    { id: 'chem_rxn_arrow', cat: 'Phản ứng & Cơ chế', title: 'Mũi tên phản ứng', shortLabel: '', svg: '<line x1="3" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/>' },
    { id: 'chem_mech_arrow', cat: 'Phản ứng & Cơ chế', title: 'Mũi tên cong cơ chế', shortLabel: '', svg: '<path d="M4 17 C 6 7, 15 7, 19 14" stroke="#f43f5e"/><polyline points="15 14 19 14 18 10" stroke="#f43f5e"/>' },
    { id: 'sym_plus', cat: 'Phản ứng & Cơ chế', title: 'Điện tích dương (+)', shortLabel: '⊕', svg: '' },
    { id: 'sym_minus', cat: 'Phản ứng & Cơ chế', title: 'Điện tích âm (−)', shortLabel: '⊖', svg: '' },
    { id: 'sym_radical', cat: 'Phản ứng & Cơ chế', title: 'Gốc tự do (•)', shortLabel: '•', svg: '' },
    { id: 'orb_p', cat: 'Phản ứng & Cơ chế', title: 'Orbital p', shortLabel: '', svg: '<path d="M12 12 C 7 4, 17 4, 12 12 C 7 20, 17 20, 12 12 Z"/>' },

    { id: 'grp_C', cat: 'Nhóm thế nhanh', title: 'Gỡ nhóm về Carbon (C)', shortLabel: '↺C', svg: '' },
    { id: 'grp_OH', cat: 'Nhóm thế nhanh', title: 'Nhóm –OH', shortLabel: 'OH', svg: '' },
    { id: 'grp_NH2', cat: 'Nhóm thế nhanh', title: 'Nhóm –NH2', shortLabel: 'NH2', svg: '' },
    { id: 'grp_COOH', cat: 'Nhóm thế nhanh', title: 'Nhóm –COOH', shortLabel: 'COOH', svg: '' },
    { id: 'grp_CHO', cat: 'Nhóm thế nhanh', title: 'Nhóm –CHO', shortLabel: 'CHO', svg: '' },
    { id: 'grp_OMe', cat: 'Nhóm thế nhanh', title: 'Nhóm –OMe', shortLabel: 'OMe', svg: '' },
    { id: 'grp_NO2', cat: 'Nhóm thế nhanh', title: 'Nhóm –NO2', shortLabel: 'NO2', svg: '' },
    { id: 'grp_Br', cat: 'Nhóm thế nhanh', title: 'Nhóm –Br', shortLabel: 'Br', svg: '' },
    { id: 'grp_Cl', cat: 'Nhóm thế nhanh', title: 'Nhóm –Cl', shortLabel: 'Cl', svg: '' },
    { id: 'grp_Me', cat: 'Nhóm thế nhanh', title: 'Nhóm –Me', shortLabel: 'Me', svg: '' },
    { id: 'grp_Ph', cat: 'Nhóm thế nhanh', title: 'Nhóm –Ph', shortLabel: 'Ph', svg: '' },

    { id: 'pen_ballpoint', cat: 'Bút & Thao tác', title: 'Bút máy (Chính)', shortLabel: '', svg: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="1.8" fill="currentColor" stroke="none"/>' },
    { id: 'pen_highlighter', cat: 'Bút & Thao tác', title: 'Dạ quang', shortLabel: '', svg: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>' },
    { id: 'pen_eraser', cat: 'Bút & Thao tác', title: 'Tẩy', shortLabel: '', svg: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/>' },
    { id: 'pen_lasso', cat: 'Bút & Thao tác', title: 'Lasso khoanh vùng', shortLabel: '', svg: '<path d="M12 3C7 3 3 6.5 3 11.5S6.5 20 12 20s9-3.5 9-8.5S17 3 12 3z" stroke-dasharray="2.5 2.5"/>' },
    { id: 'pen_laser', cat: 'Bút & Thao tác', title: 'Bút Laser', shortLabel: '', svg: '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M3 21l9-9"/>' },
    { id: 'pen_pan', cat: 'Bút & Thao tác', title: 'Bàn tay Kéo / Di chuyển bảng', shortLabel: '✋', svg: '' },
    { id: 'act_undo', cat: 'Bút & Thao tác', title: 'Hoàn tác (Ctrl+Z)', shortLabel: '', svg: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>' },
    { id: 'act_redo', cat: 'Bút & Thao tác', title: 'Làm lại (Ctrl+Y)', shortLabel: '', svg: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>' }
];

const CUSTOM_PILL_PRESETS = [
    {
        id: 'organic_carbon',
        title: 'Hữu cơ: Mạch C & Nhóm',
        tools: ['chem_bond', 'chem_move', 'chem_wedge', 'chem_dash', 'ring_benzene', 'ring_r6', 'grp_OH', 'grp_COOH', 'grp_CHO', 'grp_C', 'pen_eraser', 'pen_laser', 'act_undo']
    },
    {
        id: 'carbon_only',
        title: 'Chỉ vẽ Carbon (Tối giản)',
        tools: ['chem_bond', 'chem_move', 'ring_r6', 'ring_benzene', 'pen_eraser', 'act_undo']
    },
    {
        id: 'mechanism',
        title: 'Cơ chế phản ứng',
        tools: ['chem_bond', 'chem_mech_arrow', 'chem_rxn_arrow', 'sym_plus', 'sym_minus', 'sym_radical', 'orb_p', 'grp_OH', 'grp_Br', 'pen_ballpoint', 'pen_eraser', 'act_undo']
    },
    {
        id: 'stereo',
        title: 'Lập thể & Cấu dạng',
        tools: ['chem_bond', 'chem_wedge', 'chem_dash', 'conf_chair_left', 'conf_chair_right', 'conf_newman_stag', 'conf_fischer_2', 'chem_move', 'pen_lasso', 'act_undo']
    }
];

const PAPER_SIZE_CATALOG = [
    { id: 'a4_portrait', title: 'A4 Dọc', width: 794, height: 1123 },
    { id: 'a4_landscape', title: 'A4 Ngang', width: 1123, height: 794 },
    { id: 'a5_portrait', title: 'A5 Dọc', width: 560, height: 794 },
    { id: 'b5_portrait', title: 'B5 Sổ tay', width: 665, height: 940 },
    { id: 'letter', title: 'US Letter', width: 816, height: 1056 },
    { id: 'wide_16_9', title: 'Ngang 16:9', width: 1120, height: 630 }
];

const PAPER_COLOR_PRESETS = [
    { hex: '#fcfaf2', title: 'Kem ấm' },
    { hex: '#ffffff', title: 'Trắng tinh' },
    { hex: '#fef9c3', title: 'Vàng Sepia' },
    { hex: '#ecfeff', title: 'Xanh dịu' },
    { hex: '#fff1f2', title: 'Hồng phấn' },
    { hex: '#f0fdf4', title: 'Xanh lá nhạt' },
    { hex: '#1e293b', title: 'Xám tối' },
    { hex: '#111827', title: 'Đen đêm' }
];

function isDarkPaperColor(hex) {
    const h = (hex || '#fcfaf2').replace('#', '');
    if (h.length !== 6) return false;
    const r = parseInt(h.slice(0, 2), 16) || 0;
    const g = parseInt(h.slice(2, 4), 16) || 0;
    const b = parseInt(h.slice(4, 6), 16) || 0;
    return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
}

function getPagePaperConfig(pg) {
    if (typeof pg === 'string') pg = { template: pg };
    const rawTpl = pg?.template || 'grid';
    const cfg = pg?.pageConfig || {};
    const isLegacyDark = rawTpl === 'dark_grid';
    const template = isLegacyDark ? 'grid' : rawTpl;
    const sizeObj = PAPER_SIZE_CATALOG.find(s => s.id === cfg.sizeId) || PAPER_SIZE_CATALOG[0];
    const width = Number(cfg.width) || sizeObj.width;
    const height = Number(cfg.height) || sizeObj.height;
    const bgColor = cfg.bgColor || (isLegacyDark ? '#111827' : '#fcfaf2');
    const spacing = Math.max(14, Math.min(60, Number(cfg.spacing) || 28));
    const lineOpacity = Math.max(0.12, Math.min(0.75, typeof cfg.lineOpacity === 'number' ? cfg.lineOpacity : (isDarkPaperColor(bgColor) ? 0.22 : 0.34)));
    return {
        template,
        sizeId: sizeObj.id,
        width,
        height,
        bgColor,
        spacing,
        lineOpacity,
        isDark: isDarkPaperColor(bgColor)
    };
}

function syncActivePaperDimensions() {
    if (!appLibrary || !Array.isArray(appLibrary.notebooks) || !appLibrary.notebooks.length) return;
    const pg = getActivePage();
    const cfg = getPagePaperConfig(pg);
    A4_WIDTH = cfg.width;
    A4_HEIGHT = cfg.height;
}

/* KHO DỮ LIỆU BIỂU TƯỢNG HÓA HỌC (CATALOGS) */
const PEN_STYLE_CATALOG = [
    { id: 'fountain', label: 'Bút máy', title: 'Bút máy (Có nét thanh – đậm theo hướng & lực nhấn)', svg: '<path d="M4,18 C9,8 15,15 20,6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8,14 C11,10 13,12 16,10" fill="none" stroke="currentColor" stroke-width="3.6"/>' },
    { id: 'ballpoint', label: 'Bút bi', title: 'Bút bi (Đều nét 100% · Không thanh đậm)', svg: '<path d="M4,18 C9,10 15,14 20,6" fill="none" stroke="currentColor" stroke-width="2.4"/>' },
    { id: 'brush', label: 'Bút lông', title: 'Bút lông đều nét (Không thanh đậm)', svg: '<path d="M4,17 Q10,6 15,13 T20,7" fill="none" stroke="currentColor" stroke-width="3.2"/><circle cx="6" cy="15" r="2.2" fill="currentColor" stroke="none"/>' },
    { id: 'dashed', label: 'Nét đứt', title: 'Bút nét đứt (Đều nét)', svg: '<path d="M4,18 C9,10 15,14 20,6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-dasharray="3.5 3"/>' }
];

const COLOR_PALETTE_LIST = [
    '#111827', '#334155', '#64748b', '#94a3b8', '#e2e8f0', '#ffffff',
    '#0369a1', '#0284c7', '#0ea5e9', '#38bdf8', '#06b6d4', '#22d3ee',
    '#e11d48', '#f43f5e', '#fb7185', '#ef4444', '#f97316', '#fb923c',
    '#059669', '#10b981', '#34d399', '#22c55e', '#84cc16', '#0d9488',
    '#4f46e5', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#eab308', '#fbbf24', '#fde047', '#93c5fd', '#f9a8d4', '#86efac'
];

const COLOR_PRESET_PALETTES = [
    { id: 'bright_study', label: '✨ Tươi Sáng', colors: ['#111827', '#0ea5e9', '#fb7185', '#10b981', '#fbbf24'] },
    { id: 'pastel_soft', label: '🌸 Pastel Dịu', colors: ['#334155', '#38bdf8', '#f9a8d4', '#86efac', '#fde047'] },
    { id: 'chem_vivid', label: '🧪 Hóa Học Nét', colors: ['#111827', '#0284c7', '#e11d48', '#059669', '#8b5cf6'] },
    { id: 'neon_hl', label: '⚡ Dạ Quang Sáng', colors: ['#fde047', '#22d3ee', '#fb7185', '#34d399', '#d946ef'] }
];

const HIGHLIGHTER_PALETTE_LIST = [
    '#fef08a', '#fde047', '#fef9c3', '#fde68a', '#fcd34d', '#ecfccb',
    '#bef264', '#86efac', '#bbf7d0', '#6ee7b7', '#a7f3d0', '#99f6e4',
    '#a5f3fc', '#67e8f9', '#7dd3fc', '#bae6fd', '#93c5fd', '#bfdbfe',
    '#f9a8d4', '#fbcfe8', '#fda4af', '#fdba74', '#fed7aa', '#d8b4fe'
];

const HIGHLIGHTER_PRESET_PALETTES = [
    { id: 'hl_classic', label: '✨ Dạ Quang Chuẩn', colors: ['#fef08a', '#86efac', '#f9a8d4', '#7dd3fc', '#fdba74'] },
    { id: 'hl_pastel', label: '🌸 Pastel Dịu Mắt', colors: ['#fef9c3', '#bbf7d0', '#fbcfe8', '#bae6fd', '#d8b4fe'] },
    { id: 'hl_neon', label: '⚡ Neon Nổi Bật', colors: ['#fde047', '#bef264', '#f9a8d4', '#67e8f9', '#fdba74'] },
    { id: 'hl_chem', label: '🧪 Ôn Thi Hoá Học', colors: ['#fde68a', '#6ee7b7', '#fda4af', '#93c5fd', '#d8b4fe'] }
];

const TOOL_GUIDE_INFO = {
    'cd-chem_bond': { name: 'Mạch Carbon & Liên kết C–C', role: 'Vẽ liên kết, mạch zíc-zắc 120° & chuyển liên kết đôi', desc: 'Kéo trên giấy để vẽ mạch Carbon tự động 120°. Bấm lại nút này để chỉnh độ dài liên kết C–C.', tip: 'Chạm 2 lần vào liên kết đơn bất kỳ để đổi sang liên kết đôi (VD: C–OH → C=O, C–C → C=C). Chạm 2 lần vào đầu Carbon để viết tay gắn nhóm thế!' },
    'cd-chem_move': { name: 'Di chuyển & Chỉnh sửa', role: 'Kéo nguyên tử, phân tử, tay cầm Bezier & khung ngoặc', desc: 'Chọn để di chuyển nguyên tử, kéo điểm uốn mũi tên cong cơ chế hoặc kéo đầu/đuôi mũi tên.', tip: 'Giữ phím Shift (hoặc nhấn giữ nút) khi kéo nguyên tử để di chuyển nguyên cả phân tử.' },
    'cd-chem_stereo_hub': { name: 'Nét Thanh & Nét Gạch 3D (Wedge / Dash)', role: 'Gộp chung liên kết hướng ra trước (Wedge) & hướng ra sau (Dash)', desc: 'Chạm để mở nhanh hoặc vẽ liên kết lập thể hình nêm đặc (hướng ra trước) hoặc nét gạch (hướng ra sau).', tip: 'Chạm trực tiếp lên một liên kết đơn có sẵn để chuyển nhanh sang nét thanh/gạch 3D!' },
    'cd-chem_ring_hub': { name: 'Kho Vòng C3–C9 & Dị vòng', role: 'Đóng dấu nhanh vòng thơm, dị vòng & mẫu tự lưu', desc: 'Chọn vòng Benzen, Cyclohexan, dị vòng N/O/S hoặc cấu trúc bạn đã lưu bằng Lasso.', tip: 'Chạm lên cạnh liên kết có sẵn để ghép nối 2 vòng chung cạnh chuẩn ChemDraw.' },
    'cd-chem_arrow_hub': { name: 'Mũi tên Phản ứng & Cơ chế Electron (e⁻)', role: 'Gộp chung mọi mũi tên phản ứng (→, ⇌, ↔) và mũi tên cong chuyển 1e/2e⁻', desc: 'Chạm để mở bảng chọn giữa Mũi tên Phản ứng hóa học và Mũi tên Cong cơ chế di chuyển e⁻.', tip: 'Mũi tên cong cơ chế tự né các nguyên tử xung quanh; kéo chấm xanh để uốn lại độ cong.' },
    'cd-chem_special_hub': { name: 'Cấu dạng, Orbital & Điện tích e⁻', role: 'Gộp chung Cấu dạng 3D, Vân đạo Orbital & Ký hiệu ⊕ ⊖ • ••', desc: 'Mở nhanh Ghế Cyclohexan / Newman / Fischer, các vân đạo s/p/lai hóa sp3 và ký hiệu điện tích electron.', tip: 'Khi đặt Orbital có thể nhấn giữ và kéo nhẹ ngay lúc đặt để xoay góc & đổi kích cỡ.' },
    'cd-chem_text': { name: 'Chữ & Điều kiện Phản ứng', role: 'Chèn text hóa học tự định dạng chỉ số dưới & ký hiệu', desc: 'Chạm lên trang để gõ công thức hay điều kiện phản ứng; số đứng sau chữ tự hạ xuống làm chỉ số dưới.', tip: 'Gõ "to" hoặc "t0" tự đổi thành "t°", gõ "Delta" thành "Δ".' },
    'navyToolbarConfigBtn': { name: 'Tùy Chỉnh Thanh Hub Công Cụ', role: 'Ẩn/hiện và sắp xếp lại thứ tự nút trên Thanh Hub phía trên', desc: 'Cho phép tự chọn những nút công cụ hóa học thường dùng và đổi vị trí trái/phải theo ý thích.', tip: 'Có thể mở nhanh cả phần tùy chỉnh Viên thuốc Bút từ trong bảng này.' },
    'sp-carbon': { name: 'Vẽ Nhanh Mạch Carbon (C–C)', role: 'Nút vẽ mạch Carbon zíc-zắc 120° ngay trên Viên thuốc Bút', desc: 'Chuyển tức thì từ viết tay sang vẽ liên kết/mạch Carbon mà không cần với tay lên thanh Hub trên.', tip: 'Rất tiện khi vừa viết phương trình vừa vẽ công thức cấu tạo trên iPad!' },
    'sp-ballpoint': { name: 'Bút Lông Chính (Apple Pencil / Chuột)', role: 'Bút chính mặc định · Nét cọ siêu mượt, nhạy lực & tự nắn thẳng khi giữ cuối nét', desc: 'Bút lông tối ưu 120Hz không rổ/chấm lởm chởm; hỗ trợ giữ cuối nét ~0.5s để tự động thẳng đều.', tip: 'Bấm lại icon bút đang sáng để mở Cài đặt ngòi (Bút lông, Bút máy 90°, Bút bi, Nét đứt), chỉnh độ dày & làm mịn.' },
    'sp-pan': { name: 'Bàn tay Kéo / Di chuyển bảng', role: 'Di chuyển tự do quanh trang viết bằng chuột, bút hoặc ngón tay', desc: 'Rất tiện khi dạy live trên Windows/Mac hoặc cần trượt bảng mà không vô tình vẽ nét.', tip: 'Mẹo nhanh: Đang chọn bất kỳ công cụ nào vẫn có thể Kéo bằng Chuột phải, Chuột giữa hoặc giữ phím Space + Kéo chuột trái; lăn con lăn chuột để Thu/Phóng!' },
    'sp-highlighter': { name: 'Bút Dạ quang (Highlighter)', role: 'Tô sáng công thức, đề bài, điểm quan trọng', desc: 'Mực trong suốt không che mất chữ hay nét hóa học bên dưới.', tip: 'Giữ cuối nét để tự kẻ thẳng đều; chạm lại nút để chỉnh cỡ nét.' },
    'sp-eraser': { name: 'Cục Tẩy thông minh', role: 'Xóa từng nét mực hoặc cấu trúc hóa học theo bán kính', desc: 'Chạm hoặc kéo qua đối tượng cần xóa mà không đụng ảnh Đề bài đã cố định.', tip: '3 nút nét nhanh tự đổi thành 3 cỡ vùng tẩy Nhỏ / Vừa / Lớn; hoặc chạm 2 lần lên khoảng trống để bật/tắt nhanh Tẩy.' },
    'sp-image': { name: 'Chèn & Quản lý Ảnh', role: 'Chèn ảnh từ máy hoặc chọn ảnh chưa cố định trên trang', desc: 'Chèn hình minh họa hoặc chạm vào ảnh đang có trên giấy để chỉnh kích cỡ, nhân bản hay cố định.', tip: 'Sau khi cắt ảnh từ Đề bài hoặc chèn ảnh, bấm nút 🔒 Cố định để khóa vị trí & miễn nhiễm với Lasso.' },
    'sp-lasso': { name: 'Khoanh vùng Lasso', role: 'Chọn nhóm nét viết & phân tử để di chuyển, xoay, nhân bản, đổi màu', desc: 'Vẽ một vòng khép kín quanh vùng chữ/công thức cần thao tác hàng loạt.', tip: 'Ảnh đã bấm 🔒 Cố định (như phần cắt Đề bài) sẽ không bị xê dịch khi khoanh Lasso lên chữ viết bên trên.' },
    'sp-laser': { name: 'Bút Laser Thuyết trình', role: 'Chỉ điểm phát sáng nổi bật khi giảng bài', desc: 'Nét phát sáng đỏ neon giúp học sinh dễ theo dõi luồng giải bài.', tip: 'Nét Laser được giữ lại cho tới khi bạn chuyển sang công cụ viết khác.' },
    'st-slot-1': { name: 'Cỡ nét nhanh #1 (Mảnh)', role: 'Chọn nhanh độ dày nét 1 hoặc cỡ Tẩy nhỏ', desc: 'Lưu sẵn một độ dày riêng để đổi qua lại tức thì không cần mở thanh trượt.', tip: 'Chạm lại khi đang sáng để mở bảng tinh chỉnh px cho riêng slot này.' },
    'st-slot-2': { name: 'Cỡ nét nhanh #2 (Vừa)', role: 'Chọn nhanh độ dày nét 2 hoặc cỡ Tẩy vừa', desc: 'Độ dày tiêu chuẩn cho ghi chép hằng ngày.', tip: 'Chạm lại khi đang sáng để tinh chỉnh.' },
    'st-slot-3': { name: 'Cỡ nét nhanh #3 (Đậm)', role: 'Chọn nhanh độ dày nét 3 hoặc cỡ Tẩy lớn', desc: 'Thích hợp viết tiêu đề hoặc tô đậm đánh dấu.', tip: 'Chạm lại khi đang sáng để tinh chỉnh.' },
    'penPillOrientBtn': { name: 'Xoay Ngang / Dọc Viên thuốc', role: 'Chuyển nhanh hướng thanh bút nổi', desc: 'Chuyển thanh bút từ hàng ngang sang 2 cột dọc gọn gàng hoặc ngược lại.', tip: 'Khi kéo viên thuốc lại gần cạnh trái/phải màn hình, thanh cũng tự xoay dọc giúp bạn.' },
    'penPillConfigBtn': { name: 'Cấu hình Viên thuốc Bút', role: 'Chọn vị trí neo, thu phóng và ẩn/hiện từng nút trên thanh bút', desc: 'Tùy biến thanh bút tối giản hay đầy đủ theo thói quen viết.', tip: 'Có thể thu gọn những công cụ ít dùng để tăng tối đa diện tích bảng trắng.' },
    'readModeBtn': { name: 'Chế độ Đọc (Khóa Bút)', role: 'Xem lại tài liệu 1 trang hoặc 2 trang song song mà không sợ lỡ tay vẽ', desc: 'Khóa hoàn toàn nét bút để cuộn lướt xem bài an toàn.', tip: 'Phím tắt M hoặc bấm lại nút này để quay về viết bài.' },
    'presentationModeBtn': { name: 'Trình chiếu Bảng Sạch', role: 'Ẩn UI khi dạy Zoom/Meet hoặc mở cửa sổ Khán giả / Quay HD', desc: 'Cho phép ẩn toàn bộ nút bấm hoặc tách cửa sổ sạch riêng để chia sẻ màn hình.', tip: 'Đưa chuột lên mép trên khi đang trình chiếu để mở thanh điều khiển mini.' },
    'ipadTouchSettingsBtn': { name: 'Cài đặt Cảm ứng iPad', role: 'Tùy chỉnh 1 ngón, 2 ngón, 3 ngón, chế độ tay trái & nút Trợ năng', desc: 'Tối ưu thao tác chạm ngón tay kết hợp Apple Pencil như Goodnotes.', tip: 'Chế độ 1 ngón khuyên dùng: Kéo cuộn/chuyển trang tự do, còn bút Apple Pencil chuyên để viết.' },
    'helpGuideBtn': { name: 'Hướng dẫn & Phím tắt', role: 'Xem hướng dẫn cử chỉ cảm ứng và gán lại mọi phím tắt bàn phím', desc: 'Tra cứu thao tác nhanh cho cả iPad và bàn phím rời.', tip: 'Nhấn dấu ? bất cứ lúc nào để mở nhanh bảng hướng dẫn.' },
    'versionUpdateHubBtn': { name: 'Hub Cập Nhật & Tính Năng', role: 'Kiểm tra bản mới nhất, xem lịch sử cập nhật & bảng tổng hợp tính năng', desc: 'Tải về bản vá lỗi và tính năng mới nhất từ máy chủ mà không cần xóa app hay mất dữ liệu sổ.', tip: 'Chấm xanh xuất hiện khi phát hiện máy chủ đã có phiên bản mới hơn.' },
    'appSettingsHubBtn': { name: 'Cài Đặt & Tiện Ích', role: 'Gom gọn Cảm ứng iPad/Chuột PC, Tone màu, Hướng dẫn, Hub Cập nhật & Góp ý', desc: 'Mở menu cài đặt tổng hợp giúp thanh trên cùng trên iPad gọn gàng hơn.', tip: 'Chấm xanh xuất hiện trên icon cờ lê khi có phiên bản mới.' },
    'feedbackHubBtn': { name: 'Góp Ý & Báo Lỗi (Beta)', role: 'Gửi phản hồi lỗi, đề xuất tính năng kèm ảnh chụp màn hình', desc: 'Mọi góp ý của bạn được gửi thẳng tới hộp thư quản trị để cải thiện bản beta tiếp theo.', tip: 'Hệ thống tự đính kèm phiên bản & thiết bị giúp sửa lỗi nhanh hơn trên cả Windows và iPad.' },
    'appThemeBtn': { name: 'Đổi Tone Màu Ứng Dụng', role: 'Chuyển đổi giao diện Sáng / Tối / Sakura / Matcha / Aurora', desc: 'Đổi màu sắc toàn bộ thanh công cụ phù hợp mắt nhìn ban ngày hoặc ban đêm.', tip: 'Màu nền từng trang giấy có thể chỉnh riêng độc lập trong Cài đặt Trang giấy.' },
    'splitViewToggleBtn': { name: 'Chia Đôi Màn Hình (2 Sổ)', role: 'Mở song song 2 quyển sổ cùng lúc', desc: 'Rất tiện để vừa xem lý thuyết/công thức bên phải vừa giải bài tập bên trái.', tip: 'Bấm ⇄ trên khung bên phải để hoán đổi nhanh hai sổ.' },
    'fullscreenToggleBtn': { name: 'Chế độ Toàn Màn Hình', role: 'Mở rộng hết cỡ không gian làm việc', desc: 'Phóng toàn màn hình để tập trung tối đa vào trang viết.', tip: 'Chạm lại hoặc bấm Esc để thoát.' },
    'menuFitPageBtn': { name: 'Căn vừa trang màn hình (Fit A4)', role: 'Phóng hoặc thu vừa khít chiều ngang/trọn trang giấy vào màn hình', desc: 'Nhanh chóng đưa trang viết về chính giữa sau khi zoom lớn hoặc kéo sang mép.', tip: 'Phím tắt Ctrl+0 / Cmd+0.' },
    'menuLabBtn': { name: 'Bộ Dụng Cụ & Thí Nghiệm Ảo', role: 'Đặt dụng cụ thủy tinh & mở Phòng Thí Nghiệm Mini tương tác', desc: 'Chứa ống nghiệm, bình cầu, buret chuẩn độ cùng 7 mô phỏng thí nghiệm hóa học sinh động.', tip: 'Có thể đặt trực tiếp dụng cụ lên trang giấy hoặc bấm Mở Mô phỏng Mini.' },
    'settingsPeriodicBtn': { name: 'Bảng Tuần Hoàn & Tính Khối Lượng Mol', role: 'Tra cứu 118 nguyên tố & máy tính nhanh M (g/mol)', desc: 'Xem chi tiết khối lượng nguyên tử, độ âm điện, cấu hình e và gõ nhanh công thức như CuSO4 để tính ngay M.', tip: 'Bấm trực tiếp công thức gợi ý hoặc gõ tự do để sao chép kết quả vào trang viết.' },
    'settingsNameReactionsBtn': { name: 'Kho 185 Name Reactions Hữu Cơ', role: 'Tra cứu Chất đầu, Tác nhân, Sản phẩm, Cơ chế & Sơ đồ ChemDraw', desc: 'Tổng hợp trọn bộ 185 phản ứng mang tên từ sách Jie Jack Li 6th Ed. (tiếng Việt), tìm không dấu tức thì theo tên, chất đầu hoặc tác nhân.', tip: 'Chạm hoặc nhấn giữ kéo Sơ đồ / Phản ứng tổng quát / Cơ chế trực tiếp ra trang viết A4.' },
    'settingsReagentsBtn': { name: 'Sổ Tay 331 Tác Nhân (Chu Văn Phòng)', role: 'Tra cứu 331 CTCT Tác nhân & Phản ứng đặc trưng (Tác giả: Chu Văn Phòng)', desc: 'Tổng hợp trọn bộ 331 tác nhân hóa hữu cơ từ Sổ tay Tác nhân của tác giả Chu Văn Phòng (hiển thị theo CTCT trực quan, đã lọc sạch watermark), hỗ trợ tìm nhanh theo tên, viết tắt (DMSO, LAH, mCPBA...) hoặc loại phản ứng.', tip: 'Bấm ◧ Cạnh trái để thu gọn bảng tra cứu sang lề trái và kéo thả trực tiếp bảng tác nhân ra giấy A4.' },
    'menuToolbarConfigBtn': { name: 'Tùy Chỉnh Thanh Hub & Viên Thuốc', role: 'Ẩn/hiện và sắp xếp lại thứ tự các nút công cụ', desc: 'Cho phép ẩn bớt nút ít dùng và đổi vị trí nút trên cả Thanh Hub lẫn Viên thuốc Bút.', tip: 'Hỗ trợ khôi phục mặc định 1 chạm bất cứ lúc nào.' },
    'favColor': { name: 'Màu Ưa Thích (5 Ô Tùy Biến)', role: 'Chạm 1 lần để chọn nhanh màu • Ấn đúp (2 lần nhanh) để mở bảng đổi màu', desc: 'Tự động tách riêng 5 ô màu Bút viết và 5 ô màu Dạ quang sáng rõ chữ.', tip: 'Chạm 1 lần chuyển màu tức thì không bị bật bảng che trang; ấn đúp vào ô màu khi muốn thay màu khác.' }
};

const VERSION_CHANGELOG_HISTORY = [
    {
        version: 'v15.15',
        date: '20/11/2026',
        badge: 'MỚI NHẤT',
        title: 'Sổ Tay 331 Tác Nhân Chu Văn Phòng (CTCT), Kéo Thả Cơ Chế Ra Giấy A4 & Sửa Cuộn Trọn Vẹn',
        items: [
            'Tích hợp trọn bộ 331 Tác nhân Hóa Hữu Cơ từ Sổ Tay Tác Nhân của tác giả Chu Văn Phòng (nén gọn ~14.5 MB ảnh sạch nền trắng, xóa sạch watermark thay vì 96 MB PDF), hiển thị trực quan bằng Công thức cấu tạo (CTCT) ở danh sách và tìm kiếm tức thì theo tên, ký hiệu (DMSO, LAH, mCPBA, Pd/C...).',
            'Hỗ trợ nhấn giữ kéo thả (Drag-to-Paper) Sơ đồ tổng quát, Cơ chế phản ứng hoặc Bảng Tác nhân CVP trực tiếp ra đúng vị trí con trỏ trên trang giấy A4, kèm nút ◧ Cạnh trái để vừa xem giấy vừa kéo thả.',
            'Sửa triệt để lỗi không kéo xuống xem hết được phản ứng/sơ đồ dài trong cửa sổ tra cứu (cuộn mượt toàn bộ chi tiết trên iPad & PC); toàn bộ tính năng sử dụng tự do 100%.'
        ]
    },
    {
        version: 'v15.14',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Kho 185 Name Reactions Hữu Cơ (Chất Đầu, Tác Nhân, Chất Cuối & Sơ Đồ Cơ Chế)',
        items: [
            'Trích xuất và tích hợp trọn bộ 185 Name Reactions Hóa Hữu Cơ từ sách Jie Jack Li 6th Ed. (bản tiếng Việt) với dung lượng siêu gọn (~5.4 MB ảnh sơ đồ ChemDraw sắc nét thay vì 82 MB PDF).',
            'Tìm kiếm không dấu tức thì bằng tiếng Việt/tiếng Anh theo tên phản ứng, chất đầu, tác nhân (Pd, mCPBA, NaBH4...) hoặc sản phẩm; hỗ trợ lọc 8 nhóm phản ứng và đánh dấu ★ Yêu thích.',
            'Hỗ trợ xem phóng to 145% và dán trực tiếp Sơ đồ + Cơ chế, Chỉ dán Sơ đồ phản ứng, Chỉ dán Cơ chế hoặc Tóm tắt chữ lên trang viết A4.'
        ]
    },
    {
        version: 'v15.13',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Khôi Phục 100% Setting Nét Viết & Bút Máy Nguyên Bản Của v15.10 (v10.15)',
        items: [
            'Khôi phục nguyên vẹn 100% thông số nét bút máy & bút lông của bản v15.10: tỷ lệ thanh–đậm (0.46x..1.24x), đường cong vận tốc (1.11 - 0.42*vEase), phản hồi lực nhấn (0.60 + 0.74*p^0.76), độ vuốt đầu/đuôi nét (endMin = 0.22) và 4 lượt làm mượt Taubin khi nhấc bút.',
            'Khôi phục nguyên bản bộ lọc ổn định nét trực tiếp (live stabilizer), bước lấy mẫu điểm, làm thẳng thân nét dọc/ngang (alignStraightStemSubspans) và cảm giác viết tay của v15.10.',
            'Giữ nguyên toàn bộ bản vá lỗi nét Bút Dạ quang (2light) của v15.12 (nét phẳng mượt, không gấp khúc, không lem viền Multiply & không xoá nhầm chữ).'
        ]
    },
    {
        version: 'v15.12',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Sửa Triệt Để Lỗi Nét Bút Dạ Quang (2light) — Phẳng Mượt Chuẩn Notewise, Không Lem Viền & Không Xoá Nhầm',
        items: [
            'Khắc phục lỗi gấp khúc / răng cưa viền trên nét Bút Dạ quang to (14–44px): tách bước lấy mẫu rộng chuẩn ngòi bản lớn, bỏ hẳn nhánh nối góc nhọn lineTo và thêm bộ lọc làm mịn trục tâm buildCleanHighlighterSpine cho cả nét mới lẫn nét dạ quang cũ.',
            'Tự động nắn nét tô dạ quang kéo ngang/dọc qua dòng chữ thành thanh Pill phẳng mượt chuẩn Notewise / Goodnotes 6 ngay khi nhấc bút (vẫn giữ nguyên đường cong mượt khi cố ý tô vòng cung hoặc khoanh vùng).',
            'Khóa khung cắt Dirty-Rect phần cứng và nới biên an toàn cho chế độ hòa trộn Multiply (chống chồng màu sẫm viền khi tô 120Hz) + chặn hoàn toàn cử chỉ gạch xoá Scribble khi đang dùng Bút Dạ quang để tô đi tô lại nhiều lần không bao giờ xoá mất chữ.'
        ]
    },
    {
        version: 'v15.11',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Đại Tu Bút Máy Y Hệt Notewise — Tròn Nét, Mượt Tay, Không Nhảy Chữ & Hết Đuôi Nhọn',
        items: [
            'Loại bỏ hoàn toàn kiểu vuốt đuôi nhọn giả tạo (như mũi kiếm ở cuối chữ T, F, 2, C, dấu sắc) — đầu/đuôi nét tròn gọn tự nhiên chuẩn Notewise và chỉ vuốt thanh nhẹ khi thực sự vẩy bút nhanh.',
            'Cân chỉnh lại độ thanh–đậm chuẩn bút máy Notewise (nét ngang & nét lên luôn sắc rõ không còn bị mảnh đứt sợi, nét sổ đầy đặn êm mắt) và chuẩn hóa lực nhấn thực tế của Apple Pencil 1/2/Pro lẫn bút không cảm ứng lực (Apple Pencil USB-C / Gojodoq).',
            'Thay bộ lọc kéo trễ cũ bằng bộ lọc One-Euro thích ứng tốc độ bám sát đầu bút, bỏ bước bẻ thẳng nét cong và đồng bộ 100% nét lúc đang viết với nét sau khi nhấc bút (hết hoàn toàn cảm giác nhảy chữ hay méo bụng chữ e, o, a, h).'
        ]
    },
    {
        version: 'v15.10',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Xóa Khoảng Trống Thừa Trên Đỉnh Hub & Chế Độ Toàn Màn Hình Tràn Viền iPad',
        items: [
            'Gỡ bỏ hoàn toàn khoảng đệm giả 26px (ipad-standalone-safe) vốn gây ra dải trống lớn phía trên thanh Hub trên iPad PWA; chuyển thanh trạng thái PWA sang tràn viền black-translucent + fullscreen.',
            'Nâng cấp nút ⛶ Toàn màn hình (đặt sẵn 1 chạm trên thanh trên và trong Chức năng khác): hoạt động thật trên cả iPad Safari/PWA lẫn PC — ẩn thanh Tab trên, đẩy thanh Hub xanh sát mép trên cùng và mở rộng tối đa trang viết (bấm ⤢ ở góc phải thanh xanh để hiện lại thanh Tab).'
        ]
    },
    {
        version: 'v15.9',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Đại Tu Tiết Kiệm Pin & Giảm Nóng Máy iPad (Cắt Tới 70–85% Tải CPU/GPU Khi Viết & Đọc)',
        items: [
            'Sửa triệt để lỗi cache-miss vẽ lại toàn trang mỗi lần đặt bút (vốn khiến iPad dựng lại hàng trăm nét bút máy trên mỗi chữ cái) + áp dụng vẽ cục bộ Dirty-Rect khi kéo bút và bộ đệm Path2D cho mọi nét thư pháp đã viết.',
            'Gỡ bỏ hoàn toàn các lớp kính mờ Gaussian blur (backdrop-filter) chạy 120Hz đè lên canvas vẽ (viên thuốc nổi, ngăn Đề bài, thanh trang, nút trợ năng) + khử shadowBlur trên Laser — hạ mạnh công suất GPU Apple.',
            'Tắt hoàn toàn vòng lặp ngầm khi đứng yên (watchdog theo sự kiện, tạm dừng MiniLab khi ẩn tab & hạ 30fps trên giấy, gom lượt lưu ổ cứng 2.2s, chống ghi lặp localStorage khi quá 4MB) + thêm nút bật 🔋 Tiết kiệm pin iPad (Eco 60Hz & giảm DPR) trong Cài đặt Cảm ứng.'
        ]
    },
    {
        version: 'v15.8',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Sửa Triệt Để Ngăn Đề Bài — Hết Lỗi Màn Hình Trắng Khi Gắn PDF, Word (.docx) & Ảnh',
        items: [
            'Gỡ bỏ hoàn toàn khung iframe bị chặn trên iPadOS/PWA & bảo mật tên miền (nguyên nhân khiến gắn file PDF/Word bị trắng tinh): chuyển sang dựng trang PDF sắc nét trực tiếp bằng PDF.js (tới 24 trang), hỗ trợ xem cuộn dọc lẫn kéo cắt từng câu dán thẳng sang vở.',
            'Tích hợp bộ đọc file Word (.docx) 100% offline ngay trong app: tự trích xuất văn bản, chỉ số hóa học (H₂SO₄, Fe³⁺...), tách trang để kéo cắt hoặc dán chữ; hỗ trợ tách cả ảnh chụp nhúng trong file Word.',
            'Nâng cấp đọc ảnh đề bài trên iPad (hỗ trợ cả HEIC/HEIF qua createImageBitmap, nền trắng chống đen ảnh PNG trong suốt, sửa lỗi bấm nút Kéo cắt trên bản deploy & hiện trạng thái tải rõ ràng — không bao giờ trắng tinh).'
        ]
    },
    {
        version: 'v15.7',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Tự Động Căn Đẹp Chuẩn ChemDraw Khi Vẽ Vòng Carbon (3–8 Cạnh, Vòng Ghép & Phác Tay)',
        items: [
            'Khi nối khép kín bất kỳ vòng 3–8 cạnh nào bằng công cụ Mạch C hoặc vẽ gấp khúc: hệ thống tự động nắn thành đa giác đều chuẩn độ dài cạnh C–C và góc chuẩn hóa học (60° / 90° / 108° / 120°), căn hướng thẳng đẹp và kéo mượt các nhóm thế (–OH, –CH3, =O) đi theo nguyên vẹn.',
            'Hỗ trợ tự động căn đẹp cả vòng ghép chung cạnh (như Naphthalen, Indole): ghim chặt cạnh chung của vòng cũ và nắn vòng mới nở đều ra phía ngoài cực cân đối.',
            'Khi dùng Bút máy phác tay hình ngũ giác (5C) hoặc lục giác (6C) — dù nhấc bút ngay hay giữ cuối nét (cả 7C) — tự động chuyển thành Vòng Carbon đều đẹp (vẫn phân biệt rõ chữ O / số 0 / hình tròn để không nhận nhầm).'
        ]
    },
    {
        version: 'v15.6',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Gỡ Hub Vướng Mắt Sau Khi Vẽ C–C & Nâng Cấp Nhận Diện Gấp Khúc → Mạch Carbon Siêu Nhạy',
        items: [
            'Gỡ bỏ hoàn toàn thanh Hub nổi hiện ra sau mỗi lần kéo vẽ mạch C–C (giữ trang viết thoáng sạch 100%, không còn bị che khuất phân tử vừa vẽ).',
            'Nâng cấp động cơ nhận diện nét vẽ tay gấp khúc → Mạch Carbon đa tỷ lệ (tự cắt mẩu móc đặt/nhấc bút, gộp điểm rung tay, hỗ trợ cả mạch nhỏ 13px đến mạch vẽ phóng khoáng 145px/cạnh, tự căn ngang chuẩn ±30°/120° và cho phép vẽ nhánh 3C từ nguyên tử có sẵn — đồng thời vẫn lọc sạch chữ Z/N/M/W/m/n/u).'
        ]
    },
    {
        version: 'v15.5',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Thông Báo Cập Nhật Tự Động Khi Mở App & Bút Máy Vector Chuẩn Notewise Siêu Đẹp',
        items: [
            'Tự động kiểm tra bản mới ngay khi mở app hoặc quay lại ứng dụng trên iPad (Home Screen PWA) và bật thẻ thông báo nổi trực tiếp ngay đầu màn hình kèm danh sách tính năng mới + nút "Cập nhật ngay" 1 chạm.',
            'Viết lại toàn bộ động cơ Bút máy & Bút lông sang kiến trúc dải Vector Calligraphy liền khối (Centripetal Catmull-Rom + Khử rung Taubin + Đổ mực NonZero không lỗ hổng): cạnh nét sắc lẹm chuẩn Retina như Notewise, hết hoàn toàn viền răng cưa/chấm nổ mực, chữ tròn mềm như lụa và nhẹ pin hơn gấp nhiều lần.'
        ]
    },
    {
        version: 'v15.4',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Đổi Màu Ấn Đúp Gọn Gàng & Bút Dạ Quang Bảng Màu Riêng Sáng Rõ Chữ',
        items: [
            'Chạm 1 lần vào ô màu chỉ đổi màu viết ngay lập tức (không bật bảng màu che trang); ấn đúp (2 lần nhanh) vào ô màu để mở bảng đổi màu.',
            'Tách riêng hoàn toàn bảng màu 5 ô cho Bút Dạ quang với các màu phổ thông chuyên dụng (Vàng chanh, Xanh lá, Hồng phấn, Xanh lam, Cam đào) + 24 màu dạ quang sáng dịu, không dùng chung màu đen với bút viết.',
            'Nâng cấp cơ chế đổ mực Dạ quang hòa trộn Multiply + tách lớp nằm dưới nét chữ/công thức/ảnh đề: chữ đen và công thức hóa học luôn đen sắc nét 100%, không còn bị dìm chữ hay lem nhem.'
        ]
    },
    {
        version: 'v15.3',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Vuốt 1 Ngón Native 120fps (Sang Ngang / Lên Xuống) & Bút Máy Chuẩn Notewise',
        items: [
            'Bổ sung động cơ Vuốt 1 ngón Native Touch 120fps (nativeSinglePanState) trượt sang ngang, lên xuống & chéo 360° siêu mượt có quán tính chuẩn trên iPadOS; sửa triệt để 2 lỗi nhận nhầm ngón tay 1px là stylus và xóa sớm pointer khi chạm.',
            'Tinh chỉnh Bút máy đạt đúng cảm giác & hình dáng Notewise: đường cong tròn mềm không gãy đa giác trên chữ e/o/a/c/u/n/m, lực nhấn + vận tốc mực + thanh đậm hài hòa tự nhiên (~2.2×), đuôi vuốt bén, 0 chấm nổ mực và không nhảy chữ khi nhấc bút.'
        ]
    },
    {
        version: 'v15.2',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Vẽ Mạch Carbon Siêu Tốc & Giảm Tối Đa Thao Tác Mỏi Tay',
        items: [
            'Hiển thị thẻ đếm số Carbon trực tiếp ngay đầu bút (VD: 6C) khi kéo mạch + tự động hít khép vòng xanh ngọc lục bảo khi đầu kéo chạm nguyên tử có sẵn.',
            'Thanh Turbo ngay đầu mạch vừa vẽ (tự né nét Trên/Dưới, hiện cả khi kéo Mạch C lẫn tự viết tay zíc-zắc bằng Bút máy): bấm 1 chạm -C/+C, đổi liên kết cuối (= / ≡), mọc =O, mọc –OH (=O + OH tạo ngay –COOH), nối nhanh Vòng Benzen ⬡ hoặc về Bút máy ✒️.',
            '1 chạm trực tiếp vào thân liên kết ở chế độ Mạch C để xoay vòng Đơn — → Đôi = → Ba ≡ mà không cần gõ đúp.',
            'Bổ sung cụm phím nhảy 1 chạm (⬡ Benzen, ⬡6 C6, → Mũi tên PƯ, ✒️ Bút) ngay trên Dock Hóa nổi và biến nút Mạch C trên Viên thuốc thành công tắc 2 chiều Mạch C ↔ Bút máy.'
        ]
    },
    {
        version: 'v15.1',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Triệt Tiêu Mất Cảm Ứng Sau 14 Từ & Xóa Sạch Chấm Nổ Mực Bút Máy Notewise',
        items: [
            'Triệt tiêu hoàn toàn đơ cảm ứng khi viết liên tục: loại bỏ kẹt tái sử dụng pointerId trong ignoredPalmPointerIds, sửa deadlock isDrawing khi pointer phụ nhấc sớm, đồng bộ số ngón thật của phần cứng iOS, gắn touchend/touchcancel toàn cửa sổ, bỏ recalc CSS body.is-drawing-canvas * và bổ sung watchdog tự giải kẹt.',
            'Xóa sạch 100% chấm tròn "nổ mực" trên Bút máy Notewise: khóa hình học độ dốc bán kính 2 chiều theo chiều dài cung (|dr/ds| ≤ 0.12) xuyên qua mọi góc nhọn, triệt tiêu xung áp lực giả 0.5 lúc Apple Pencil chạm/nhấc màn hình, chống móc ngược cuối nét và tính tốc độ cửa sổ trượt chống nhiễu 240Hz.'
        ]
    },
    {
        version: 'v15.0',
        date: '20/11/2026',
        badge: 'Ổn định',
        title: 'Bút Máy Notewise Thanh–Đậm, Zoom 2 Ngón 120fps, Hub Gọn & Siêu Tiết Kiệm Pin',
        items: [
            'Bút máy kiểu Notewise (Thanh–Đậm siêu mượt): nét kéo xuống đậm đầy đặn, nét hất lên mảnh sắc, đuôi nét vuốt thon tự nhiên, không chấm hột & không thủng chữ vòng lặp.',
            'Khôi phục & làm mượt toàn diện cảm ứng iPad: Native Touch Zoom 2 ngón 120fps, chuyển tiếp 2→1 ngón không giật, vuốt 1 ngón quán tính mượt 60Hz/120Hz, khóa nét theo đầu bút & hoàn tác trượt cổ tay trước bút.',
            'Chuyển Gắn ảnh & Bút Laser lên Thanh Hub Xanh giúp Viên thuốc Bút gọn gàng; nâng cấp Dock Nhóm thế nổi 1 chạm, C=O cân đối, vẽ mạch C tự do 360° & giấy kẻ ô 3 tầng đậm–nhạt.',
            'Tối ưu tiết kiệm 50–60% GPU/pin khi viết lâu (giữ ấm cache mực nền, tắt blur 120Hz đè canvas, khóa chuẩn Retina 2x) và đặt nút Cập nhật & Tính năng ngay trong menu Chức năng khác.'
        ]
    },
    {
        version: 'v14.6',
        date: '17/11/2026',
        badge: 'Ổn định',
        title: 'Khôi Phục Zoom 2 Ngón Toàn Diện Trên iPad + Hoàn Thiện Bút & Đè Tay',
        items: [
            'Sửa lỗi lọc chéo giữa 2 điểm touch (isFineChinaStylus trước đó nhận nhầm ngón tay 1px/18px trên iPad Safari rồi loại mất ngón thứ hai): nay chỉ cách ly touch khi dùng Apple Pencil hoặc mảng lòng bàn tay thực sự rộng (>64px), đảm bảo zoom/pan 2 ngón luôn nhận ở mọi kích cỡ ngón tay.',
            'Tăng cửa sổ hoàn tác nét chạm nhầm trước khi chụm 2 ngón lên 320ms (< 16px) giúp bắt đầu chụm 2 ngón ở chế độ vẽ không để lại chấm mực thừa.'
        ]
    },
    {
        version: 'v14.5',
        date: '17/11/2026',
        badge: 'Ổn định',
        title: 'Cache Rect O(1) Không Reflow, Vận Tốc Thời Gian Thực (dist/dt) & Bảo Vệ Chuột Rời Màn Hình',
        items: [
            'Áp dụng cơ chế _rectDirty cho getFastCanvasRect(forceRefresh): đo lại khung canvas đúng 1 lần khi chạm bút hoặc resize/scroll/visualViewport, loại bỏ hàng trăm lần getBoundingClientRect() gây giật reflow ở 120Hz.',
            'Thêm gợi ý { willReadFrequently: false } cho Canvas 2D Context trên Safari WebKit để giữ pipeline GPU ổn định khi viết tốc độ cao.',
            'Nâng cấp Bút Lông & Bút Máy tính vận tốc chuẩn theo thời gian thực (dist / dt) kết hợp làm mượt 5 điểm, giúp nét đậm nhạt mịn bất kể trình duyệt gom gói hay rớt khung hình; thêm tự kết thúc nét khi chuột thả ngoài màn hình (buttons === 0).'
        ]
    },
    {
        version: 'v14.4',
        date: '17/11/2026',
        badge: 'Ổn định',
        title: 'Đè Tay Viết Siêu Mượt Không Đơ, Nét Bút Lông Liền Mạch Không Chấm Tắc & Gạch Xoá Vừa Tay',
        items: [
            'Khắc phục đè tay viết bị đơ/mất cảm ứng trên iPadOS Safari: loại bỏ setPointerCapture gây kẹt trên WebKit, cách ly vùng lòng bàn tay đang tì riêng biệt cho cả Apple Pencil và bút Trung Quốc đầu nhỏ, tự đồng bộ số ngón thật theo touchstart và dọn pointer treo kể cả khi lòng bàn tay vẫn đặt trên màn hình.',
            'Sửa lỗi nét viết hiện chấm chấm mực như bút bị tắc: làm mượt bộ lọc vận tốc 5 điểm, nâng sàn độ đậm nét mảnh của Bút Lông, bỏ nhảy predicted jump và chặn lưu nhầm chấm đơn lẻ khi pointercancel.',
            'Giảm độ nhạy tự động gạch xoá nguệch ngoạc: yêu cầu đủ 4 đoạn gập đảo chiều rõ ràng (tránh xoá nhầm khi viết chữ thường N, Z, e, s, 2, 3, CH...).'
        ]
    },
    {
        version: 'v14.3',
        date: '17/11/2026',
        badge: 'Ổn định',
        title: 'Cảm Ứng & Bút Mọi Hãng Chuẩn Xác 0 Lệch, Nhóm Thế Tỷ Lệ C–C & Gõ Đúp Toàn Màn Hình',
        items: [
            'Khắc phục triệt để mất cảm ứng & lệch đầu bút trên iPad/Safari: cập nhật tọa độ canvas động theo ResizeObserver & VisualViewport, tắt desynchronized trên Apple WebKit tránh pointercancel/lệch tọa độ, thêm watchdog hồi phục tức thì và nhận diện bút Trung Quốc đầu nhỏ + bút cảm ứng thường.',
            'Cân xứng hoàn toàn nhóm thế với độ dài liên kết C–C: tự thu nhỏ/phóng to chữ nhóm thế (OH, COOH, NH2...) tỷ lệ thuận với liên kết C–C khi chỉnh cỡ mạch C–C và căn tâm nguyên tử liên kết chuẩn ChemDraw.',
            'Gỡ thanh nhóm thế phụ ở hàng công cụ trên; tích hợp toàn bộ Kho Nhóm thế A–Z, Yêu thích ★, tìm nhanh & thêm nhóm mới vào Bảng Viết tay khi dùng bút gõ đúp lên màn hình trống hoặc đầu C gần nhất.'
        ]
    },
    {
        version: 'v14.2',
        date: '17/11/2026',
        badge: 'Ổn định',
        title: 'Bút Lông Chính, Hub Gộp Gọn, Tẩy/Lasso Chuẩn Xác & Tùy Biến Toàn Diện',
        items: [
            'Đặt Bút Lông làm bút viết chính mặc định với nét cọ siêu mượt; tách riêng cỡ nét cho Bút Dạ quang (3 slot độc lập) giống Cục tẩy.',
            'Tinh gọn thanh công cụ: gộp Mũi tên PƯ & Cơ chế e⁻; gộp Cấu dạng + Orbital + Điện tích e⁻; gộp Nét Thanh & Nét Gạch 3D; chuyển Thí nghiệm, Bảng Tuần Hoàn & Căn vừa trang vào Chức năng khác (⚙).',
            'Xóa bằng gạch nguệch ngoạc nhạy chuẩn Goodnotes và giới hạn chính xác vùng gạch, không xóa lan nét/chữ bên cạnh; khoanh Lasso chỉ lấy đúng đối tượng nằm bên trong vòng khoanh.',
            'Thay nút Bàn tay trên Viên thuốc bằng nút Vẽ nhanh Mạch Carbon (bên trên giữ nguyên), bỏ Viên thuốc số 2, nâng cấp 36 màu tươi sáng và cho phép tùy biến + sắp xếp lại cả Viên thuốc lẫn Thanh Hub.'
        ]
    },
    {
        version: 'v14.0',
        date: '17/11/2026',
        badge: 'Ổn định',
        title: 'Bút Máy 90° Mượt, Thí Nghiệm Ngoài Giấy, Khóa Vùng Đen, IndexedDB & Bảng Tuần Hoàn',
        items: [
            'Bút máy Notewise 90° & động cơ ổn định nét trực tiếp (One-Euro live stabilizer + beautifier làm chữ viết tay gọn đẹp tự nhiên).',
            'Giữ cuối nét để tự nắn thẳng (Hold-to-Straighten mượt, không móc đuôi), kéo dài độ trễ giữ đầu Carbon lên 560ms chống di chuyển nhầm.',
            'Phòng Thí Nghiệm Mini tương tác ngay ngoài giấy trắng với 7 chuyên đề (Chuẩn độ, 8 Kết tủa, Kim loại + Acid/H₂O, Bắn phá hạt α Rutherford, Màu ngọn lửa, Tráng bạc, Điện phân).',
            'Khóa cứng 2 khoảng đen hai bên ngoài trang giấy khi zoom nhỏ: không thể vẽ/tẩy/đóng dấu tràn ra nền tối nhưng vẫn cuộn & pinch-zoom bình thường.',
            'Nâng cấp lưu trữ sổ tay lên IndexedDB (dung lượng lớn chống tràn 5MB localStorage), thêm Xuất PDF cả quyển sổ, Chia sẻ ảnh iPad, Bảng Tuần Hoàn 118 nguyên tố + Tính M, Ủng hộ app & Nhóm Zalo Cộng đồng.'
        ]
    },
    {
        version: 'v13.0',
        date: '16/11/2026',
        badge: 'Ổn định',
        title: 'Hộp Góp Ý & Báo Lỗi Trực Tiếp + Kéo/Zoom Chuột Windows & Live',
        items: [
            'Thêm Hộp Góp Ý & Báo Lỗi (icon 💬 trên thanh trên & nút trong Hub): gửi báo lỗi hoặc ý tưởng tính năng kèm ảnh chụp màn hình và thông số thiết bị về Netlify Forms.',
            'Chuột máy tính Windows/Mac: Lăn con lăn chuột để Phóng to / Thu nhỏ mượt ngay tại vị trí con trỏ (có nút 🔍 / ↕ đổi sang Cuộn trang 1 chạm).',
            'Hỗ trợ kéo di chuyển bảng bằng Chuột phải, Chuột giữa, giữ Space + Kéo trái hoặc công cụ Bàn tay ✋ (phím X) trên cả chế độ thường, Đọc & Trình chiếu.',
            'Thanh Trình chiếu Live bổ sung nút − / Vừa trang / + / ✋ Kéo bảng / Chế độ con lăn; hỗ trợ phím Ctrl + / Ctrl − / Ctrl 0 thu phóng canvas mà không làm lệch giao diện trình duyệt.'
        ]
    },
    {
        version: 'v12.0',
        date: '16/11/2026',
        badge: 'Ổn định',
        title: 'Nét Bút Sắc Nét, Viết Tay Nhóm Thế & Hub Cập Nhật',
        items: [
            'Chạm 2 lần vào liên kết đơn để chuyển ngay sang liên kết đôi (VD: C–OH → C=O, C–C → C=C).',
            'Bỏ nút cầu vồng, gom thành đúng 5 ô màu ưa thích — chạm ô đang chọn hoặc nhấn giữ để mở bảng chọn & đổi màu ô đó.',
            'Cải thiện độ nhạy gắn nhóm thế + chạm 2 lần vào đầu Carbon mở ô viết tay nhận diện nét bút tự động thành OH, COOH, NH2, CH3, Cl, Br, NO2...',
            'Thêm Hub Cập Nhật Phiên Bản (kiểm tra version.json, cài bản mới không mất bài, tóm tắt cập nhật, lịch sử phiên bản & bảng tổng hợp tính năng).',
            'Mũi tên cong chuyển electron (e⁻) tự tính hướng cong phù hợp từng ngữ cảnh & né nguyên tử/liên kết/vòng gần đó.',
            'Nâng cấp kẻ ô giấy lên độ phân giải HiDPI 2.5× sắc nét, bổ sung đường lưới chính 5×5 & giao diện kẻ ô/chấm/lục giác đẹp hơn.',
            'Ảnh cắt từ Ngăn Đề Bài sau khi bấm Cố định sẽ bị khóa chặt không thể kéo trượt và miễn nhiễm hoàn toàn với khoanh tròn Lasso.',
            'Nhấn giữ bất kỳ icon công cụ nào ~0.4s để hiện thẻ giới thiệu tên, chức năng và mẹo dùng nhanh.',
            'Tối ưu thêm độ nhạy Apple Pencil, chống tì cổ tay, bám ngòi mượt & tăng độ sắc nét toàn khung hình.'
        ]
    },
    {
        version: 'v11',
        date: '15/11/2026',
        badge: 'Ổn định',
        title: 'Bút Chống Nhòe, Giữ Tốc Độ FPS Cao & Giao Diện Gọn',
        items: [
            'Nâng cấp động cơ vẽ bút máy & bút cọ bằng thuật toán chia bước tròn khử tự cắt làm lem nét.',
            'Tối ưu canvas nền tách lớp cache (inkBaseLayerCanvas), render bất đồng bộ 120Hz (desynchronized) & lược nét ngoài màn hình.',
            'Thu gọn thanh trên chỉ giữ icon, tinh giản viên thuốc dạy học mặc định còn 3 công cụ cốt lõi (Bút, Dạ quang, Mạch C).'
        ]
    },
    {
        version: 'v10',
        date: '15/11/2026',
        badge: 'Cảm ứng',
        title: 'Sửa Triệt Để Lỗi Rớt Nét Apple Pencil & Bút Viết',
        items: [
            'Bảo vệ nét Apple Pencil (activePenPointerId), ưu tiên stylus trước ngón tay & chặn Scribble Safari đúng đối tượng.',
            'Thêm getCoalescedEvents gom điểm tốc độ cao, cải tiến thuật toán làm mịn giữ góc nhọn chữ viết.'
        ]
    },
    {
        version: 'v9',
        date: '15/11/2026',
        badge: 'iPadOS',
        title: 'Cảm Ứng 1 Ngón Vuốt, 2 Ngón Zoom Mượt Như Goodnotes',
        items: [
            'Mở biên độ trượt tự do khi đang xem trọn trang & bổ sung quán tính vuốt 1 ngón mượt mà.',
            'Pinch-to-zoom 2 ngón tỉ lệ 1:1 kèm kéo thả thẳng vùng Lasso / Ảnh bằng ngón tay.'
        ]
    },
    {
        version: 'v1 – v8',
        date: 'Nền tảng',
        badge: 'Khởi tạo',
        title: 'Hệ Sinh Thái Hóa Học ChemDraw × Goodnotes 6 + Đề Bài + Trình Chiếu',
        items: [
            'Vẽ mạch Carbon zíc-zắc 120°, hệ vòng C3–C9, dị vòng, cấu dạng Ghế (Flip & Ax/Eq), Newman, Fischer, Orbital, Điện tích & Mũi tên cơ chế.',
            'Ngăn Đề Bài trượt cạnh phải: nhập PDF/Ảnh/Text, kéo khung cắt câu hỏi dán thẳng sang trang viết.',
            'Đa tab sổ tay, Chia đôi màn hình, Bảng Trắng Khán giả cho Zoom/Meet, Quay video bảng sạch & 10 tone màu giao diện.'
        ]
    }
];

const FEATURE_SUMMARY_MATRIX = [
    { cat: 'Bút & Vẽ tay', name: '4 loại ngòi bút chuyên dụng', how: 'Bút bi, Bút máy thanh đậm, Bút cọ, Nét đứt; hỗ trợ lực nhấn Apple Pencil & giữ góc nhọn chữ.' },
    { cat: 'Bút & Vẽ tay', name: '5 Ô Màu Ưa Thích tùy biến', how: 'Chạm nhanh để đổi màu; chạm lại ô đang chọn hoặc nhấn giữ để thay màu bất kỳ vào ô đó.' },
    { cat: 'Bút & Vẽ tay', name: 'Giữ cuối nét thành hình', how: 'Vẽ đường thẳng, vòng tròn, elip hoặc cung cong rồi giữ yên cuối nét ~0.5s để tự nắn thẳng chuẩn xác.' },
    { cat: 'Bút & Vẽ tay', name: 'Vẽ gấp khúc → Mạch Carbon', how: 'Dùng Bút bi vẽ nét zíc-zắc tự nhiên, app tự biến thành mạch Carbon 120°.' },
    { cat: 'Bút & Vẽ tay', name: 'Gạch zíc-zắc xóa nhanh (Scribble)', how: 'Gạch qua lại 4–5 nhịp lên đoạn mực/hình để xóa ngay không cần đổi sang Tẩy.' },
    { cat: 'Bút & Vẽ tay', name: 'Khoanh vùng Lasso', how: 'Khoanh chọn chữ viết & công thức để kéo, xoay, thu phóng, nhân bản, đổi màu, lưu mẫu hoặc đóng khung [ ]‡.' },
    { cat: 'Cảm ứng iPad', name: 'Vuốt 1 ngón & Zoom 2 ngón chuẩn Goodnotes', how: 'Ngón tay cuộn/chuyển trang/chụm phóng to thu nhỏ; Apple Pencil luôn ưu tiên viết nét ngay lập tức.' },
    { cat: 'Cảm ứng iPad', name: 'Chạm đa điểm & Chạm 2 lần', how: 'Chạm 2 ngón = Undo, 3 ngón = Redo, chạm 2 lần khoảng trống = Bật/Tắt nhanh Tẩy, vuốt cạnh = Mở Đề bài.' },
    { cat: 'Cảm ứng iPad', name: 'Nhấn giữ icon xem giới thiệu tool', how: 'Giữ ~0.4s vào bất kỳ biểu tượng công cụ nào để hiện tên, chức năng và hướng dẫn chi tiết.' },
    { cat: 'Hóa học & Cấu trúc', name: 'Mạch Carbon C–C thông minh', how: 'Kéo liên kết nối zíc-zắc 120° kèm thanh +C/−C nhanh và chỉnh độ dài liên kết.' },
    { cat: 'Hóa học & Cấu trúc', name: 'Chạm 2 lần đổi Liên kết Đơn → Đôi', how: 'Chạm 2 lần vào liên kết đơn chuyển sang liên kết đôi và tự cân bằng H (C–OH → C=O, C–C → C=C).' },
    { cat: 'Hóa học & Cấu trúc', name: 'Viết tay nhận diện nhóm thế', how: 'Chạm 2 lần vào bất kỳ đầu Carbon nào để bật bảng viết tay nhận diện thành OH, COOH, NH2, NO2, Cl, Br...' },
    { cat: 'Hóa học & Cấu trúc', name: 'Hệ vòng C3–C9 & Dị vòng', how: 'Đóng dấu nhanh Benzen, Cyclohexan, Furans, Pyridin... và ghép chung cạnh vào liên kết sẵn.' },
    { cat: 'Hóa học & Cấu trúc', name: 'Lập thể & Cấu dạng 3D', how: 'Liên kết Wedge/Dash, Cấu dạng Ghế (Chair Flip & +Ax/Eq), Thuyền, Newman xoay góc, Fischer.' },
    { cat: 'Hóa học & Cấu trúc', name: 'Bộ Dụng cụ & Phòng Thí Nghiệm Ảo (Trên Giấy Trắng)', how: 'Đặt 16 dụng cụ vector hoặc ghim Bảng Thí Nghiệm tương tác trực tiếp ngay trên trang giấy trắng: 7 chuyên đề THCS–THPT (Chuẩn độ 5 chỉ thị, 8 phản ứng kết tủa, Na+H₂O / Cu+HNO₃, Bắn phá hạt α Rutherford, Màu ngọn lửa 6 ion, Tráng bạc Tollens, Điện phân).' },
    { cat: 'Cơ chế phản ứng', name: 'Mũi tên cong chuyển e⁻ thông minh', how: 'Tự tính toán hướng uốn thuận mắt, né chất/liên kết khác; hỗ trợ kéo chấm xanh hoặc chạm 2 lần để đảo chiều cong.' },
    { cat: 'Cơ chế phản ứng', name: 'Orbital, Điện tích & Điều kiện', how: 'Vân đạo s/p/lai hóa/d, ký hiệu ⊕/⊖/gốc tự do/cặp e, khung [ ]‡ và chữ tự hạ chỉ số hóa học.' },
    { cat: 'Ngăn Đề Bài & Ảnh', name: 'Ngăn Đề Bài trượt & Cắt câu hỏi', how: 'Mở PDF/Ảnh/Văn bản ở ngăn bên phải, kéo khung cắt từng câu hỏi dán thẳng sang trang vở.' },
    { cat: 'Ngăn Đề Bài & Ảnh', name: 'Nhập đề bằng mã LaTeX (∑ LaTeX)', how: 'Bấm ∑ LaTeX trong Ngăn Đề Bài để gõ/dán mã Toán & Hóa học (\\ce{...}, \\frac, mũi tên phản ứng), xem trước và dán/cố định vào vở.' },
    { cat: 'Ngăn Đề Bài & Ảnh', name: 'Cố định ảnh Đề bài chống Lasso', how: 'Bấm 🔒 Cố định để khóa cứng ảnh cắt trên giấy: không thể kéo trượt và miễn nhiễm hoàn toàn với khoanh Lasso.' },
    { cat: 'Giấy, Trình chiếu & PWA', name: 'Giấy kẻ ô HiDPI 2.5× sắc nét', how: '6 mẫu giấy (Ô vuông 5×5, Chấm, Kẻ ngang, Cornell, Lục giác, Trắng), tùy chỉnh khổ A4/A5/16:9 & màu giấy.' },
    { cat: 'Giấy, Trình chiếu & PWA', name: 'Quản lý sổ, Chia đôi & Bảng sạch', how: 'Đa tab sổ tay, Split-View 2 sổ, Chế độ Đọc, Cửa sổ Khán giả Meet/Zoom, Quay video HD, xuất PDF/PNG/.chemnotes.' },
    { cat: 'Giấy, Trình chiếu & PWA', name: 'PWA Offline & Hub Cập Nhật', how: 'Cài ra màn hình chính iPad không thanh Safari, chạy offline & cập nhật bản mới qua nút trong Hub mà giữ nguyên dữ liệu.' },
    { cat: 'Windows / Chuột & Live', name: 'Kéo & Zoom bằng Chuột PC & Trình chiếu', how: 'Lăn con lăn chuột để thu/phóng tại con trỏ; kéo bảng bằng Chuột phải, Chuột giữa, giữ Space + Kéo trái hoặc chọn nút ✋ Bàn tay (phím X).' },
    { cat: 'Windows / Chuột & Live', name: 'Phím tắt & Thanh Zoom khi Live', how: 'Dùng Ctrl + / Ctrl − / Ctrl 0 để thu phóng bảng; khi bật Trình chiếu, rê chuột góc phải dưới có đầy đủ nút −, Fit, +, ✋ Kéo & Bút.' },
    { cat: 'PWA & Hỗ trợ', name: 'Góp Ý & Báo Lỗi Trực Tiếp (Beta)', how: 'Bấm biểu tượng 💬 trên thanh trên (hoặc trong Hub Cập Nhật) để gửi báo lỗi/đề xuất kèm ảnh chụp màn hình về cho tác giả.' }
];

const RING_CATALOG = [
    { id: 'cyclopropane', title: 'Cyclopropan (C3)', svg: '<polygon points="12,4 20,19 4,19" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'cyclobutane', title: 'Cyclobutan (C4)', svg: '<rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'cyclopentane', title: 'Cyclopentan (C5)', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'cyclohexane', title: 'Cyclohexan (C6)', svg: '<polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'cycloheptane', title: 'Cycloheptan (C7)', svg: '<polygon points="12,2.5 19.5,6 21.5,14 16.5,20.5 7.5,20.5 2.5,14 4.5,6" fill="none" stroke="currentColor" stroke-width="1.9"/>' },
    { id: 'cyclooctane', title: 'Cyclooctan (C8)', svg: '<polygon points="8.5,2.5 15.5,2.5 21,8 21,15.5 15.5,21 8.5,21 3,15.5 3,8" fill="none" stroke="currentColor" stroke-width="1.9"/>' },
    { id: 'cyclononane', title: 'Cyclononan (C9)', svg: '<polygon points="12,2 18,4.2 21.5,9.8 20.4,16.2 15.4,20.6 8.6,20.6 3.6,16.2 2.5,9.8 6,4.2" fill="none" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'benzene', title: 'Benzen', svg: '<polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.8" fill="none" stroke="currentColor" stroke-width="1.6"/>' },
    { id: 'cyclopentadiene', title: 'Cyclopentadien', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="6.2" y1="11" x2="8.8" y2="17.8" stroke="currentColor" stroke-width="1.6"/><line x1="17.8" y1="11" x2="15.2" y2="17.8" stroke="currentColor" stroke-width="1.6"/>' },

    /* Dị vòng 3 & 4 cạnh */
    { id: 'epoxide', title: 'Epoxid (Oxiran)', svg: '<polygon points="12,5 20,19 4,19" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="7.5" text-anchor="middle" font-size="6.8" fill="currentColor" stroke="none" font-weight="800">O</text>' },
    { id: 'aziridine', title: 'Aziridin', svg: '<polygon points="12,5 20,19 4,19" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="7.5" text-anchor="middle" font-size="6.2" fill="currentColor" stroke="none" font-weight="800">NH</text>' },
    { id: 'thiirane', title: 'Thiiran', svg: '<polygon points="12,5 20,19 4,19" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="7.5" text-anchor="middle" font-size="6.8" fill="currentColor" stroke="none" font-weight="800">S</text>' },
    { id: 'oxetane', title: 'Oxetan', svg: '<rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="7.5" text-anchor="middle" font-size="6.5" fill="currentColor" stroke="none" font-weight="800">O</text>' },
    { id: 'azetidine', title: 'Azetidin', svg: '<rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="7.5" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">NH</text>' },

    /* Dị vòng 5 cạnh thơm & no */
    { id: 'pyrrole', title: 'Pyrrol', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><line x1="6.2" y1="11.2" x2="8.8" y2="17.8" stroke="currentColor" stroke-width="1.4"/><line x1="17.8" y1="11.2" x2="15.2" y2="17.8" stroke="currentColor" stroke-width="1.4"/><text x="12" y="8.2" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">NH</text>' },
    { id: 'furan', title: 'Furan', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><line x1="6.2" y1="11.2" x2="8.8" y2="17.8" stroke="currentColor" stroke-width="1.4"/><line x1="17.8" y1="11.2" x2="15.2" y2="17.8" stroke="currentColor" stroke-width="1.4"/><text x="12" y="8.5" text-anchor="middle" font-size="6.5" fill="currentColor" stroke="none" font-weight="800">O</text>' },
    { id: 'thiophene', title: 'Thiophen', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><line x1="6.2" y1="11.2" x2="8.8" y2="17.8" stroke="currentColor" stroke-width="1.4"/><line x1="17.8" y1="11.2" x2="15.2" y2="17.8" stroke="currentColor" stroke-width="1.4"/><text x="12" y="8.5" text-anchor="middle" font-size="6.5" fill="currentColor" stroke="none" font-weight="800">S</text>' },
    { id: 'pyrrolidine', title: 'Pyrrolidin', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="8.5" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">NH</text>' },
    { id: 'thf', title: 'Tetrahydrofuran (THF)', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="8.5" text-anchor="middle" font-size="6.5" fill="currentColor" stroke="none" font-weight="800">O</text>' },
    { id: 'imidazole', title: 'Imidazol', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="8.2" text-anchor="middle" font-size="5.8" fill="currentColor" stroke="none" font-weight="800">NH</text><text x="17" y="19.5" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'pyrazole', title: 'Pyrazol', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="8.2" text-anchor="middle" font-size="5.8" fill="currentColor" stroke="none" font-weight="800">NH</text><text x="19" y="12.5" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'oxazole', title: 'Oxazol', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="8.5" text-anchor="middle" font-size="6.2" fill="currentColor" stroke="none" font-weight="800">O</text><text x="17" y="19.5" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'isoxazole', title: 'Isoxazol', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="8.5" text-anchor="middle" font-size="6.2" fill="currentColor" stroke="none" font-weight="800">O</text><text x="19" y="12.5" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'thiazole', title: 'Thiazol', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="8.5" text-anchor="middle" font-size="6.2" fill="currentColor" stroke="none" font-weight="800">S</text><text x="17" y="19.5" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'triazole', title: '1,2,3-Triazol', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="8.2" text-anchor="middle" font-size="5.6" fill="currentColor" stroke="none" font-weight="800">NH</text><text x="19" y="12" text-anchor="middle" font-size="5.6" fill="currentColor" stroke="none" font-weight="800">N</text><text x="17" y="19.5" text-anchor="middle" font-size="5.6" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'tetrazole', title: 'Tetrazol', svg: '<polygon points="12,3 21,10 17,20 7,20 3,10" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="8.2" text-anchor="middle" font-size="5.5" fill="currentColor" stroke="none" font-weight="800">NH</text><text x="19" y="12" text-anchor="middle" font-size="5.5" fill="currentColor" stroke="none" font-weight="800">N</text><text x="16.5" y="19.8" text-anchor="middle" font-size="5.5" fill="currentColor" stroke="none" font-weight="800">N</text><text x="7.5" y="19.8" text-anchor="middle" font-size="5.5" fill="currentColor" stroke="none" font-weight="800">N</text>' },

    /* Dị vòng 6 cạnh thơm & no */
    { id: 'pyridine', title: 'Pyridin', svg: '<polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="20.5" text-anchor="middle" font-size="6.5" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'pyrimidine', title: 'Pyrimidin', svg: '<polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="18.5" y="9" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">N</text><text x="12" y="20.5" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'pyrazine', title: 'Pyrazin', svg: '<polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="7.5" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">N</text><text x="12" y="20.5" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'pyridazine', title: 'Pyridazin', svg: '<polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="7.5" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">N</text><text x="18.8" y="10" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'triazine', title: '1,3,5-Triazin', svg: '<polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="7.5" text-anchor="middle" font-size="5.6" fill="currentColor" stroke="none" font-weight="800">N</text><text x="18.5" y="16.8" text-anchor="middle" font-size="5.6" fill="currentColor" stroke="none" font-weight="800">N</text><text x="5.5" y="16.8" text-anchor="middle" font-size="5.6" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'piperidine', title: 'Piperidin', svg: '<polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="20.5" text-anchor="middle" font-size="5.8" fill="currentColor" stroke="none" font-weight="800">NH</text>' },
    { id: 'piperazine', title: 'Piperazin', svg: '<polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="7.5" text-anchor="middle" font-size="5.8" fill="currentColor" stroke="none" font-weight="800">HN</text><text x="12" y="20.5" text-anchor="middle" font-size="5.8" fill="currentColor" stroke="none" font-weight="800">NH</text>' },
    { id: 'morpholine', title: 'Morpholin', svg: '<polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="7.5" text-anchor="middle" font-size="6.2" fill="currentColor" stroke="none" font-weight="800">O</text><text x="12" y="20.5" text-anchor="middle" font-size="5.8" fill="currentColor" stroke="none" font-weight="800">NH</text>' },
    { id: 'tetrahydropyran', title: 'Tetrahydropyran (THP)', svg: '<polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" stroke-width="1.9"/><text x="12" y="7.5" text-anchor="middle" font-size="6.5" fill="currentColor" stroke="none" font-weight="800">O</text>' },

    /* Đa vòng & Dị vòng ngưng tụ */
    { id: 'naphthalene', title: 'Naphthalen', svg: '<polygon points="7.5,5 12,8 12,16 7.5,19 3,16 3,8" fill="none" stroke="currentColor" stroke-width="1.7"/><polygon points="12,8 16.5,5 21,8 21,16 16.5,19 12,16" fill="none" stroke="currentColor" stroke-width="1.7"/>' },
    { id: 'anthracene', title: 'Anthracen', svg: '<polygon points="5,6.5 8.5,8.5 8.5,15.5 5,17.5 1.5,15.5 1.5,8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><polygon points="8.5,8.5 12,6.5 15.5,8.5 15.5,15.5 12,17.5 8.5,15.5" fill="none" stroke="currentColor" stroke-width="1.5"/><polygon points="15.5,8.5 19,6.5 22.5,8.5 22.5,15.5 19,17.5 15.5,15.5" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
    { id: 'phenanthrene', title: 'Phenanthren', svg: '<polygon points="7,8 11,10.5 11,16 7,18.5 3,16 3,10.5" fill="none" stroke="currentColor" stroke-width="1.5"/><polygon points="11,10.5 15,8 19,10.5 19,16 15,18.5 11,16" fill="none" stroke="currentColor" stroke-width="1.5"/><polygon points="11,4 15,2 19,4 19,10.5 15,8 11,10.5" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
    { id: 'indole', title: 'Indol', svg: '<polygon points="7.5,5 13,8 13,16 7.5,19 2,16 2,8" fill="none" stroke="currentColor" stroke-width="1.8"/><polygon points="13,8 20.5,10 20.5,14 13,16" fill="none" stroke="currentColor" stroke-width="1.8"/><text x="17" y="19" text-anchor="middle" font-size="5.5" fill="currentColor" stroke="none" font-weight="800">NH</text>' },
    { id: 'benzofuran', title: 'Benzofuran', svg: '<polygon points="7.5,5 13,8 13,16 7.5,19 2,16 2,8" fill="none" stroke="currentColor" stroke-width="1.8"/><polygon points="13,8 20.5,10 20.5,14 13,16" fill="none" stroke="currentColor" stroke-width="1.8"/><text x="17" y="19" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">O</text>' },
    { id: 'benzothiophene', title: 'Benzothiophen', svg: '<polygon points="7.5,5 13,8 13,16 7.5,19 2,16 2,8" fill="none" stroke="currentColor" stroke-width="1.8"/><polygon points="13,8 20.5,10 20.5,14 13,16" fill="none" stroke="currentColor" stroke-width="1.8"/><text x="17" y="19" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-weight="800">S</text>' },
    { id: 'benzimidazole', title: 'Benzimidazol', svg: '<polygon points="7.5,5 13,8 13,16 7.5,19 2,16 2,8" fill="none" stroke="currentColor" stroke-width="1.8"/><polygon points="13,8 20.5,10 20.5,14 13,16" fill="none" stroke="currentColor" stroke-width="1.8"/><text x="17" y="8" text-anchor="middle" font-size="5.5" fill="currentColor" stroke="none" font-weight="800">N</text><text x="17" y="19" text-anchor="middle" font-size="5.5" fill="currentColor" stroke="none" font-weight="800">NH</text>' },
    { id: 'quinoline', title: 'Quinolin', svg: '<polygon points="7.5,5 12,8 12,16 7.5,19 3,16 3,8" fill="none" stroke="currentColor" stroke-width="1.7"/><polygon points="12,8 16.5,5 21,8 21,16 16.5,19 12,16" fill="none" stroke="currentColor" stroke-width="1.7"/><text x="16.5" y="19.5" text-anchor="middle" font-size="5.8" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'isoquinoline', title: 'Isoquinolin', svg: '<polygon points="7.5,5 12,8 12,16 7.5,19 3,16 3,8" fill="none" stroke="currentColor" stroke-width="1.7"/><polygon points="12,8 16.5,5 21,8 21,16 16.5,19 12,16" fill="none" stroke="currentColor" stroke-width="1.7"/><text x="20.5" y="16" text-anchor="middle" font-size="5.8" fill="currentColor" stroke="none" font-weight="800">N</text>' },
    { id: 'purine', title: 'Purin', svg: '<polygon points="7.5,5 13,8 13,16 7.5,19 2,16 2,8" fill="none" stroke="currentColor" stroke-width="1.7"/><polygon points="13,8 20.5,10 20.5,14 13,16" fill="none" stroke="currentColor" stroke-width="1.7"/><text x="4" y="9" text-anchor="middle" font-size="5" fill="currentColor" stroke="none" font-weight="800">N</text><text x="4" y="18" text-anchor="middle" font-size="5" fill="currentColor" stroke="none" font-weight="800">N</text><text x="17" y="8" text-anchor="middle" font-size="5" fill="currentColor" stroke="none" font-weight="800">N</text><text x="17" y="19" text-anchor="middle" font-size="5" fill="currentColor" stroke="none" font-weight="800">NH</text>' }
];

const RXN_ARROW_CATALOG = [
    { id: 'normal', svg: '<line x1="3" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2"/><polyline points="15,7 20,12 15,17" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'bold', svg: '<line x1="3" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="3.5"/><polygon points="14,6 22,12 14,18" fill="currentColor" stroke="none"/>' },
    { id: 'dashed', svg: '<line x1="3" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/><polyline points="15,7 20,12 15,17" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'resonance', svg: '<line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2"/><polyline points="8,8 4,12 8,16" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="16,8 20,12 16,16" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'equilibrium', svg: '<line x1="3" y1="9.5" x2="20" y2="9.5" stroke="currentColor" stroke-width="1.8"/><polyline points="15,5.5 20,9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="4" y1="14.5" x2="21" y2="14.5" stroke="currentColor" stroke-width="1.8"/><polyline points="9,18.5 4,14.5" fill="none" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'eq_fwd', svg: '<line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="2"/><polyline points="16,5 21,9" fill="none" stroke="currentColor" stroke-width="2"/><line x1="7" y1="15" x2="17" y2="15" stroke="currentColor" stroke-width="1.6"/><polyline points="11,18 7,15" fill="none" stroke="currentColor" stroke-width="1.6"/>' },
    { id: 'retro', svg: '<line x1="3" y1="9.5" x2="18" y2="9.5" stroke="currentColor" stroke-width="1.8"/><line x1="3" y1="14.5" x2="18" y2="14.5" stroke="currentColor" stroke-width="1.8"/><polyline points="14,5 21,12 14,19" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: 'no_rxn', svg: '<line x1="3" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2"/><polyline points="15,7 20,12 15,17" fill="none" stroke="currentColor" stroke-width="2"/><line x1="9" y1="7" x2="14" y2="17" stroke="currentColor" stroke-width="2"/><line x1="14" y1="7" x2="9" y2="17" stroke="currentColor" stroke-width="2"/>' }
];

const MECH_ARROW_CATALOG = [
    { id: '2e_90', svg: '<path d="M5,16 Q12,8 19,16" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="19,16 14,15 18,11" fill="currentColor" stroke="none"/>' },
    { id: '2e_120', svg: '<path d="M4,18 C6,6 18,6 20,16" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="20,16 15,14 19,10" fill="currentColor" stroke="none"/>' },
    { id: '2e_180', svg: '<path d="M4,19 C3,3 21,3 20,19" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="20,19 16,15 21,14" fill="currentColor" stroke="none"/>' },
    { id: '1e_120', svg: '<path d="M4,18 C6,6 18,6 20,16" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="20,16 15,14" fill="none" stroke="currentColor" stroke-width="2"/>' },
    { id: '2e_neg120', svg: '<path d="M4,8 C6,19 18,19 20,9" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="20,9 15,11 19,15" fill="currentColor" stroke="none"/>' },
    { id: '1e_neg120', svg: '<path d="M4,8 C6,19 18,19 20,9" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="20,9 15,11" fill="none" stroke="currentColor" stroke-width="2"/>' }
];

const ORBITAL_CATALOG = [
    { id: 's_open', svg: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 's_shaded', svg: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="currentColor" stroke-width="1.5"/>' },
    { id: 'p_open', svg: '<path d="M12,12 C7,3 17,3 12,12 C7,21 17,21 12,12 Z" fill="none" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'p_top_shaded', svg: '<path d="M12,12 C7,3 17,3 12,12" fill="currentColor" stroke="currentColor" stroke-width="1.6"/><path d="M12,12 C7,21 17,21 12,12" fill="none" stroke="currentColor" stroke-width="1.6"/>' },
    { id: 'p_bot_shaded', svg: '<path d="M12,12 C7,3 17,3 12,12" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12,12 C7,21 17,21 12,12" fill="currentColor" stroke="currentColor" stroke-width="1.6"/>' },
    { id: 'hyb_top_shaded', svg: '<path d="M12,14 C6,2 18,2 12,14" fill="currentColor" stroke="currentColor" stroke-width="1.6"/><path d="M12,14 C9,21 15,21 12,14" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
    { id: 'dz2_shaded', svg: '<path d="M12,12 C8,3 16,3 12,12 C8,21 16,21 12,12" fill="currentColor" stroke="currentColor" stroke-width="1.4"/><ellipse cx="12" cy="12" rx="7" ry="2.4" fill="#1c273b" stroke="currentColor" stroke-width="1.5"/>' },
    { id: 'd4_alt', svg: '<path d="M12,12 C9,4 15,4 12,12 C9,20 15,20 12,12" fill="currentColor" stroke="currentColor" stroke-width="1.4"/><path d="M12,12 C4,9 4,15 12,12 C20,9 20,15 12,12" fill="none" stroke="currentColor" stroke-width="1.6"/>' }
];

const SYMBOL_CATALOG = [
    { id: 'plus_circle', svg: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="1.8"/><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'minus_circle', svg: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'plus_plain', svg: '<line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" stroke-width="2.4"/><line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" stroke-width="2.4"/>' },
    { id: 'minus_plain', svg: '<line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" stroke-width="2.4"/>' },
    { id: 'lone_pair', svg: '<circle cx="8.5" cy="12" r="2.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="12" r="2.2" fill="currentColor" stroke="none"/>' },
    { id: 'radical', svg: '<circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>' },
    { id: 'rad_plus', svg: '<circle cx="7" cy="12" r="2.2" fill="currentColor" stroke="none"/><line x1="15" y1="8" x2="15" y2="16" stroke="currentColor" stroke-width="2"/><line x1="11" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2"/>' },
    { id: 'rad_minus', svg: '<circle cx="7" cy="12" r="2.2" fill="currentColor" stroke="none"/><line x1="11" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2"/>' }
];

const CONFORMER_CATALOG = [
    { id: 'chair_left', svg: '<polygon points="2,16 7,9 14,11.5 22,8 17,15 10,12.5" fill="none" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'chair_right', svg: '<polygon points="2,8 10,11.5 17,9 22,16 14,12.5 7,15" fill="none" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'boat_conf', svg: '<polygon points="2,9 7,16 17,16 22,9 16,12 8,12" fill="none" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'sawhorse_stag', svg: '<line x1="6" y1="16" x2="18" y2="8" stroke="currentColor" stroke-width="1.8"/><line x1="6" y1="16" x2="6" y2="21" stroke="currentColor" stroke-width="1.6"/><line x1="6" y1="16" x2="2" y2="13" stroke="currentColor" stroke-width="1.6"/><line x1="18" y1="8" x2="18" y2="3" stroke="currentColor" stroke-width="1.6"/><line x1="18" y1="8" x2="22" y2="11" stroke="currentColor" stroke-width="1.6"/>' },
    { id: 'newman_stag', svg: '<circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><line x1="12" y1="12" x2="12" y2="3" stroke="currentColor" stroke-width="1.7"/><line x1="12" y1="12" x2="19.5" y2="16.5" stroke="currentColor" stroke-width="1.7"/><line x1="12" y1="12" x2="4.5" y2="16.5" stroke="currentColor" stroke-width="1.7"/><line x1="12" y1="17.5" x2="12" y2="21" stroke="currentColor" stroke-width="1.7"/>' },
    { id: 'newman_eclip', svg: '<circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><line x1="12" y1="12" x2="12" y2="3" stroke="currentColor" stroke-width="1.7"/><line x1="12" y1="12" x2="19.5" y2="16.5" stroke="currentColor" stroke-width="1.7"/><line x1="12" y1="12" x2="4.5" y2="16.5" stroke="currentColor" stroke-width="1.7"/>' },
    { id: 'fischer_1', svg: '<line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="1.8"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'fischer_2', svg: '<line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" stroke-width="1.8"/><line x1="4" y1="8.5" x2="20" y2="8.5" stroke="currentColor" stroke-width="1.8"/><line x1="4" y1="15.5" x2="20" y2="15.5" stroke="currentColor" stroke-width="1.8"/>' },
    { id: 'fischer_3', svg: '<line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" stroke-width="1.8"/><line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.7"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.7"/><line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" stroke-width="1.7"/>' },
    { id: 'fischer_4', svg: '<line x1="12" y1="1.5" x2="12" y2="22.5" stroke="currentColor" stroke-width="1.8"/><line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" stroke-width="1.6"/><line x1="4" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="1.6"/><line x1="4" y1="14" x2="20" y2="14" stroke="currentColor" stroke-width="1.6"/><line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="1.6"/>' }
];

const SUBSTITUENTS_LIST = [
    // Oxy / Ancol / Ete / Phenol / Sunfonat este
    'OH','OMe','OEt','OiPr','OtBu','OPh','OBn','OAc','OBz','OCF3','OTs','OMs','OTf','OTBS','OTMS','O-',
    // Carbonyl / Axit / Este / Amit / Nitril
    'CHO','COMe','COEt','COPh','COOH','COO-','COOMe','COOEt','COOtBu','COCl','CONH2','CONHMe','CONMe2','CN','NC','OCN','SCN','NCO','NCS',
    // Nitơ / Amin / Nitro / Diazoni
    'NH2','NHMe','NHEt','NMe2','NEt2','NHPh','NHAc','NHBoc','NH3+','NO','NO2','N3','N2+','NHNH2','=NH','=NOH',
    // Halogen & Polyhalogen
    'F','Cl','Br','I','CF3','CCl3','CHF2','CH2F','CH2Cl','CH2Br','CH2I',
    // Gốc Hydrocacbon (No, Không no, Thơm, Dẫn xuất CH2)
    'Me','Et','nPr','iPr','nBu','sBu','iBu','tBu','CH2OH','CH2NH2','CH2CN','CH2COOH','CH=CH2','CH2CH=CH2','C≡CH','Ph','Bn','Bz','Ac','Tol','Mes','Ar','Cy',
    // Lưu huỳnh / Phốt pho / Silic
    'SH','SMe','SEt','SPh','SOMe','SO2Me','SO2Ph','SO2Cl','SO2NH2','SO3H','SO3-','PO(OMe)2','PO(OEt)2','PPh2','PPh3','PPh3+','SiMe3',
    // Nhóm Bảo vệ (Protecting Groups)
    'Ts','Ms','Tf','Boc','Cbz','Fmoc','Alloc','TBS','TMS','TES','TIPS','TBDPS','MOM','MEM','THP','SEM','PMB','Tr',
    // Cơ kim & Phản ứng ghép nối (Grignard / Suzuki / Stille)
    'Li','Na','K','MgCl','MgBr','MgI','ZnCl','ZnBr','CuLi','B(OH)2','BPin','BF3K','SnBu3','SnMe3','SePh'
];

/* DỮ LIỆU MẪU BAN ĐẦU & LƯU TRỮ LOCALSTORAGE */
function createStarterDemoContent() {
    const content = createEmptyPageContent();
    const cx = 250, cy = 220, R = 44;
    const ringAtoms = [];
    for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 3;
        const a = { id: 'demo_a' + i, x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), label: 'C', color: '#0f172a' };
        content.atoms.push(a);
        ringAtoms.push(a);
    }
    for (let i = 0; i < 6; i++) {
        content.bonds.push({
            id: 'demo_b' + i,
            a1: ringAtoms[i].id,
            a2: ringAtoms[(i + 1) % 6].id,
            order: i % 2 === 0 ? 2 : 1,
            color: '#0f172a'
        });
    }
    const topSub = { id: 'demo_sub_top', x: cx, y: cy - R - 42, label: 'CHO', color: '#1d4ed8' };
    content.atoms.push(topSub);
    content.bonds.push({ id: 'demo_b_top', a1: ringAtoms[0].id, a2: topSub.id, order: 1, color: '#0f172a' });

    content.arrows.push({ id: 'demo_ar1', x1: 345, y1: 215, x2: 475, y2: 215, type: 'normal', color: '#0f172a' });
    content.texts.push({ id: 'demo_txt1', x: 410, y: 192, text: 'NaBH4, MeOH', color: '#047857', size: 14 });
    content.texts.push({ id: 'demo_txt2', x: 410, y: 238, text: '0 °C → t°', color: '#e11d48', size: 13 });

    const px = 575, py = 220;
    const prodAtoms = [];
    for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 3;
        const a = { id: 'demo_pa' + i, x: px + R * Math.cos(ang), y: py + R * Math.sin(ang), label: 'C', color: '#0f172a' };
        content.atoms.push(a);
        prodAtoms.push(a);
    }
    for (let i = 0; i < 6; i++) {
        content.bonds.push({
            id: 'demo_pb' + i,
            a1: prodAtoms[i].id,
            a2: prodAtoms[(i + 1) % 6].id,
            order: i % 2 === 0 ? 2 : 1,
            color: '#0f172a'
        });
    }
    const ch2 = { id: 'demo_pch2', x: px, y: py - R - 42, label: 'C', color: '#0f172a' };
    const oh = { id: 'demo_poh', x: px + 38, y: py - R - 64, label: 'OH', color: '#e11d48' };
    content.atoms.push(ch2, oh);
    content.bonds.push({ id: 'demo_pb_ch2', a1: prodAtoms[0].id, a2: ch2.id, order: 1, color: '#0f172a' });
    content.bonds.push({ id: 'demo_pb_oh', a1: ch2.id, a2: oh.id, order: 1, color: '#e11d48' });

    return content;
}

const CN_LIB_IDB_NAME = 'ChemNotesDataDB';
const CN_LIB_IDB_STORE = 'library';
const CN_LIB_IDB_KEY = 'main_v1';
let _loadedFromIdbStub = false;
let _hasUserPersistedSinceBoot = false;
let _storageQuotaWarned = false;

function writeLibraryToIndexedDB(serializedJson) {
    try {
        if (typeof indexedDB === 'undefined' || typeof indexedDB.open !== 'function') return;
        const req = indexedDB.open(CN_LIB_IDB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(CN_LIB_IDB_STORE)) {
                db.createObjectStore(CN_LIB_IDB_STORE);
            }
        };
        req.onsuccess = () => {
            try {
                const db = req.result;
                const tx = db.transaction(CN_LIB_IDB_STORE, 'readwrite');
                tx.objectStore(CN_LIB_IDB_STORE).put(serializedJson, CN_LIB_IDB_KEY);
            } catch (_) {}
        };
    } catch (_) {}
}

function hydrateLibraryFromIndexedDB(onHydrated) {
    try {
        if (typeof indexedDB === 'undefined' || typeof indexedDB.open !== 'function') return;
        const req = indexedDB.open(CN_LIB_IDB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(CN_LIB_IDB_STORE)) {
                db.createObjectStore(CN_LIB_IDB_STORE);
            }
        };
        req.onsuccess = () => {
            try {
                const db = req.result;
                if (!db.objectStoreNames.contains(CN_LIB_IDB_STORE)) return;
                const tx = db.transaction(CN_LIB_IDB_STORE, 'readonly');
                const getReq = tx.objectStore(CN_LIB_IDB_STORE).get(CN_LIB_IDB_KEY);
                getReq.onsuccess = () => {
                    try {
                        if (_hasUserPersistedSinceBoot) return;
                        const rawIdb = getReq.result;
                        if (typeof rawIdb !== 'string' || !rawIdb) return;
                        const parsed = JSON.parse(rawIdb);
                        if (!parsed || !Array.isArray(parsed.notebooks) || !parsed.notebooks.length) return;
                        const curAt = Number(appLibrary._savedAt || 0);
                        const idbAt = Number(parsed._savedAt || 0);
                        if (_loadedFromIdbStub || idbAt > curAt) {
                            appLibrary = { ...appLibrary, ...parsed };
                            _loadedFromIdbStub = false;
                            normalizeLoadedLibraryState();
                            if (typeof onHydrated === 'function') onHydrated(appLibrary);
                        }
                    } catch (_) {}
                };
            } catch (_) {}
        };
    } catch (_) {}
}

function initLibraryData() {
    _loadedFromIdbStub = false;
    _hasUserPersistedSinceBoot = false;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.__idbBacked) {
                _loadedFromIdbStub = true;
            } else if (parsed && Array.isArray(parsed.notebooks) && parsed.notebooks.length) {
                appLibrary = { ...appLibrary, ...parsed };
            }
        }
    } catch (e) {}
    normalizeLoadedLibraryState();
}

function normalizeLoadedLibraryState() {
    if (!appLibrary.notebooks.length) {
        const now = Date.now();
        const nb1 = { id: 'nb_1', title: 'Sổ Tay Hóa Hữu Cơ', folderId: 'f_org', coverColor: '#0284c7', starred: true, lastOpenedAt: now, activePageIndex: 0, pages: [{ id: genId('pg'), template: 'grid', content: createStarterDemoContent() }] };
        const nb2 = { id: 'nb_2', title: 'Cơ Chế & Lập Thể', folderId: 'f_mech', coverColor: '#0f766e', starred: false, lastOpenedAt: now - 3600000, activePageIndex: 0, pages: [{ id: genId('pg'), template: 'dots', content: createEmptyPageContent() }] };
        appLibrary.notebooks = [nb1, nb2];
        appLibrary.openTabIds = ['nb_1', 'nb_2'];
        appLibrary.activeNotebookId = 'nb_1';
    }
    appLibrary.notebooks.forEach((nb, idx) => {
        if (!Number.isFinite(nb.lastOpenedAt)) {
            nb.lastOpenedAt = Date.now() - idx * 600000;
        }
    });
    if (!Array.isArray(appLibrary.openTabIds) || !appLibrary.openTabIds.length) {
        appLibrary.openTabIds = [appLibrary.notebooks[0].id];
    }
    if (!appLibrary.activeNotebookId || !appLibrary.notebooks.some(n => n.id === appLibrary.activeNotebookId)) {
        appLibrary.activeNotebookId = appLibrary.openTabIds[0];
    }
    if (appLibrary.hubViewMode !== 'grid' && appLibrary.hubViewMode !== 'list') {
        appLibrary.hubViewMode = 'grid';
    }
    if (typeof appLibrary.autoAddPage !== 'boolean') {
        appLibrary.autoAddPage = true;
    }
    const bl = parseInt(appLibrary.bondLength, 10);
    appLibrary.bondLength = Number.isFinite(bl) ? Math.max(22, Math.min(90, bl)) : 44;
    BOND_LENGTH = appLibrary.bondLength;
    if (!Array.isArray(appLibrary.favouriteGroups)) {
        appLibrary.favouriteGroups = ['OH', 'NH2', 'NO2', 'COOH', 'Br', 'Cl', 'OMe', 'Ph'];
    }
    if (!Array.isArray(appLibrary.customSubstituents)) appLibrary.customSubstituents = [];
    if (!Array.isArray(appLibrary.deletedSubstituents)) appLibrary.deletedSubstituents = [];
    if (!Array.isArray(appLibrary.customSnippets)) appLibrary.customSnippets = [];
    if (!Array.isArray(appLibrary.favoriteNameReactions)) {
        appLibrary.favoriteNameReactions = [];
    } else {
        appLibrary.favoriteNameReactions = appLibrary.favoriteNameReactions.map(x => Number(x)).filter(Number.isFinite);
    }
    if (!Array.isArray(appLibrary.favoriteReagents)) {
        appLibrary.favoriteReagents = [];
    } else {
        appLibrary.favoriteReagents = appLibrary.favoriteReagents.map(x => Number(x)).filter(Number.isFinite);
    }
    if (!appLibrary.appTheme || !APP_THEME_CATALOG.some(t => t.id === appLibrary.appTheme)) {
        appLibrary.appTheme = 'midnight_sky';
    }
    const rawFavCols = Array.isArray(appLibrary.favoriteColors) ? appLibrary.favoriteColors : [];
    const legacyDefaultCols = ['#000000', '#2563eb', '#dc2626', '#16a34a', '#f59e0b'];
    const isLegacyUntouchedPalette = rawFavCols.length === 5 && rawFavCols.every((c, idx) => String(c || '').toLowerCase() === legacyDefaultCols[idx]);
    const validFavCols = [];
    for (let i = 0; i < 5; i++) {
        const c = rawFavCols[i];
        if (!appLibrary.brightColorsV14_2 && (isLegacyUntouchedPalette || !rawFavCols.length)) {
            validFavCols.push(DEFAULT_FAVORITE_COLORS[i]);
        } else {
            validFavCols.push((typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) ? c.toLowerCase() : DEFAULT_FAVORITE_COLORS[i]);
        }
    }
    appLibrary.favoriteColors = validFavCols;
    appLibrary.brightColorsV14_2 = true;
    const favIdx = parseInt(appLibrary.activeFavoriteColorIdx, 10);
    appLibrary.activeFavoriteColorIdx = (Number.isFinite(favIdx) && favIdx >= 0 && favIdx < 5) ? favIdx : 0;
    penColor = appLibrary.favoriteColors[appLibrary.activeFavoriteColorIdx] || DEFAULT_FAVORITE_COLORS[0];
    const allPillIds = PEN_PILL_ITEMS_CATALOG.map(it => it.id);
    const defaultPillVisible = ['undo_redo', 'carbon', 'ballpoint', 'highlighter', 'eraser', 'lasso', 'stroke_slots', 'color_wells'];
    const rawPenPill = (appLibrary.penPillConfig && typeof appLibrary.penPillConfig === 'object') ? appLibrary.penPillConfig : {};
    const defPen = {
        dock: 'top_center', x: null, y: null, vertical: false, scale: 1.0,
        carbonNextToPenV14_2: true,
        movedImgLaserToNavyV15: true,
        itemOrder: [...allPillIds],
        visibleItems: [...defaultPillVisible]
    };
    appLibrary.penPillConfig = { ...defPen, ...rawPenPill };
    let normalizedPillOrder = Array.isArray(rawPenPill.itemOrder)
        ? rawPenPill.itemOrder.filter((id, idx, arr) => allPillIds.includes(id) && arr.indexOf(id) === idx)
        : [];
    allPillIds.forEach(id => { if (!normalizedPillOrder.includes(id)) normalizedPillOrder.push(id); });
    appLibrary.penPillConfig.itemOrder = normalizedPillOrder;
    if (!Array.isArray(rawPenPill.visibleItems) || !rawPenPill.visibleItems.length) {
        appLibrary.penPillConfig.visibleItems = [...defaultPillVisible];
    } else {
        appLibrary.penPillConfig.visibleItems = rawPenPill.visibleItems.filter(id => id !== 'line' && id !== 'image' && id !== 'laser' && allPillIds.includes(id));
    }
    if (!rawPenPill.carbonNextToPenV14_2) {
        appLibrary.penPillConfig.visibleItems = appLibrary.penPillConfig.visibleItems.filter(id => id !== 'pan');
        if (!appLibrary.penPillConfig.visibleItems.includes('carbon')) {
            const bpIdx = appLibrary.penPillConfig.visibleItems.indexOf('ballpoint');
            if (bpIdx >= 0) appLibrary.penPillConfig.visibleItems.splice(bpIdx, 0, 'carbon');
            else appLibrary.penPillConfig.visibleItems.unshift('carbon');
        }
        const bpOrderIdx = appLibrary.penPillConfig.itemOrder.indexOf('ballpoint');
        appLibrary.penPillConfig.itemOrder = appLibrary.penPillConfig.itemOrder.filter(id => id !== 'carbon');
        appLibrary.penPillConfig.itemOrder.splice(Math.max(0, bpOrderIdx), 0, 'carbon');
        appLibrary.penPillConfig.carbonNextToPenV14_2 = true;
    }
    appLibrary.penPillConfig.movedImgLaserToNavyV15 = true;
    const allNavyIds = NAVY_TOOLBAR_ITEMS_CATALOG.map(it => it.id);
    const rawNavyCfg = (appLibrary.navyToolbarConfig && typeof appLibrary.navyToolbarConfig === 'object') ? appLibrary.navyToolbarConfig : {};
    let normalizedNavyOrder = Array.isArray(rawNavyCfg.itemOrder)
        ? rawNavyCfg.itemOrder.filter((id, idx, arr) => allNavyIds.includes(id) && arr.indexOf(id) === idx)
        : [];
    allNavyIds.forEach(id => { if (!normalizedNavyOrder.includes(id)) normalizedNavyOrder.push(id); });
    let normalizedNavyHidden = Array.isArray(rawNavyCfg.hiddenItems)
        ? rawNavyCfg.hiddenItems.filter((id, idx, arr) => allNavyIds.includes(id) && arr.indexOf(id) === idx)
        : [];
    if (!rawNavyCfg.movedImgLaserToNavyV15) {
        normalizedNavyOrder = normalizedNavyOrder.filter(id => id !== 'pen_image' && id !== 'pen_laser');
        const txtIdx = normalizedNavyOrder.indexOf('chem_text');
        const insIdx = txtIdx >= 0 ? txtIdx + 1 : Math.max(0, normalizedNavyOrder.length - 2);
        normalizedNavyOrder.splice(insIdx, 0, 'pen_image', 'pen_laser');
        normalizedNavyHidden = normalizedNavyHidden.filter(id => id !== 'pen_image' && id !== 'pen_laser');
    }
    appLibrary.navyToolbarConfig = {
        movedImgLaserToNavyV15: true,
        itemOrder: normalizedNavyOrder,
        hiddenItems: normalizedNavyHidden
    };
    appLibrary.customChemPill = {
        enabled: false,
        collapsed: true,
        x: 16,
        y: 148,
        vertical: false,
        scale: 1.0,
        tools: []
    };
    if (typeof appLibrary.scribbleEraseEnabled !== 'boolean') {
        appLibrary.scribbleEraseEnabled = true;
    }
    if (typeof appLibrary.holdToShapeEnabled !== 'boolean') {
        appLibrary.holdToShapeEnabled = true;
    }
    if (typeof appLibrary.autoZigZagToCarbon !== 'boolean') {
        appLibrary.autoZigZagToCarbon = true;
    }
    if (typeof appLibrary.penAutoRefine !== 'boolean') {
        appLibrary.penAutoRefine = true;
    }
    const pc = appLibrary.penConfig && typeof appLibrary.penConfig === 'object' ? appLibrary.penConfig : null;
    if (pc) {
        if (typeof pc.style === 'string' && PEN_STYLE_CATALOG.some(s => s.id === pc.style)) {
            activePenStyle = pc.style;
        }
        if (typeof pc.smoothing === 'number' && Number.isFinite(pc.smoothing)) {
            penSmoothing = Math.max(0, Math.min(0.95, pc.smoothing));
        }
        if (typeof pc.opacity === 'number' && Number.isFinite(pc.opacity)) {
            penOpacity = Math.max(0.2, Math.min(1, pc.opacity));
        }
        if (pc.slotWidths && typeof pc.slotWidths === 'object') {
            [1, 2, 3].forEach(s => {
                const sw = parseFloat(pc.slotWidths[s]);
                if (Number.isFinite(sw) && sw >= 1 && sw <= 16) slotWidths[s] = sw;
            });
        }
        if ([1, 2, 3].includes(Number(pc.activeStrokeSlot))) {
            activeStrokeSlot = Number(pc.activeStrokeSlot);
        }
        strokeWidth = slotWidths[activeStrokeSlot] || 2.8;
        if (pc.nibAngle === 35 || pc.nibAngle === 90) {
            appLibrary.fountainNibAngle = pc.nibAngle;
        }
    }
    if (appLibrary.fountainNibAngle !== 35 && appLibrary.fountainNibAngle !== 90) {
        appLibrary.fountainNibAngle = 90;
    }
    if (!appLibrary.smoothModeV15) {
        penSmoothing = Math.max(penSmoothing, 0.50);
        appLibrary.smoothModeV15 = true;
    }
    if (!appLibrary.notewiseFountainV15) {
        activePenStyle = 'fountain';
        appLibrary.fountainNibAngle = 90;
        appLibrary.notewiseFountainV15 = true;
    }
    const defHlCfg = { activeSlot: 2, widths: { 1: 8, 2: 14, 3: 24 }, opacity: 0.50, colors: [...DEFAULT_HIGHLIGHTER_COLORS], activeColorIdx: 0 };
    const hc = appLibrary.highlighterConfig && typeof appLibrary.highlighterConfig === 'object' ? appLibrary.highlighterConfig : {};
    const hcWidths = hc.widths && typeof hc.widths === 'object' ? hc.widths : {};
    highlighterSlotWidths = {
        1: Math.max(4, Math.min(44, parseFloat(hcWidths[1]) || defHlCfg.widths[1])),
        2: Math.max(4, Math.min(44, parseFloat(hcWidths[2]) || defHlCfg.widths[2])),
        3: Math.max(4, Math.min(44, parseFloat(hcWidths[3]) || defHlCfg.widths[3]))
    };
    activeHighlighterSlot = [1, 2, 3].includes(Number(hc.activeSlot)) ? Number(hc.activeSlot) : 2;
    highlighterWidth = highlighterSlotWidths[activeHighlighterSlot] || 14;
    const rawHlCols = Array.isArray(hc.colors) ? hc.colors : [];
    const validHlCols = [];
    for (let i = 0; i < 5; i++) {
        const c = rawHlCols[i];
        validHlCols.push((typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) ? c.toLowerCase() : DEFAULT_HIGHLIGHTER_COLORS[i]);
    }
    const hlColorIdx = parseInt(hc.activeColorIdx, 10);
    const safeHlColorIdx = (Number.isFinite(hlColorIdx) && hlColorIdx >= 0 && hlColorIdx < 5) ? hlColorIdx : 0;
    let resolvedHlOp = (typeof hc.opacity === 'number' && Number.isFinite(hc.opacity))
        ? Math.max(0.15, Math.min(0.75, hc.opacity))
        : defHlCfg.opacity;
    if (!hc.hlPaletteV15_4 && Math.abs(resolvedHlOp - 0.34) < 0.005) {
        resolvedHlOp = defHlCfg.opacity;
    }
    highlighterColor = validHlCols[safeHlColorIdx] || DEFAULT_HIGHLIGHTER_COLORS[0];
    appLibrary.highlighterConfig = {
        activeSlot: activeHighlighterSlot,
        widths: { ...highlighterSlotWidths },
        opacity: resolvedHlOp,
        colors: validHlCols,
        activeColorIdx: safeHlColorIdx,
        hlPaletteV15_4: true
    };
    const defEraserCfg = { activeSlot: 2, radii: { 1: 12, 2: 24, 3: 42 } };
    const ec = appLibrary.eraserConfig && typeof appLibrary.eraserConfig === 'object' ? appLibrary.eraserConfig : {};
    const ecRadii = ec.radii && typeof ec.radii === 'object' ? ec.radii : {};
    eraserSlotRadii = {
        1: Math.max(6, Math.min(72, parseInt(ecRadii[1], 10) || defEraserCfg.radii[1])),
        2: Math.max(6, Math.min(72, parseInt(ecRadii[2], 10) || defEraserCfg.radii[2])),
        3: Math.max(6, Math.min(72, parseInt(ecRadii[3], 10) || defEraserCfg.radii[3]))
    };
    activeEraserSlot = [1, 2, 3].includes(Number(ec.activeSlot)) ? Number(ec.activeSlot) : 2;
    eraserRadius = eraserSlotRadii[activeEraserSlot] || 24;
    appLibrary.eraserConfig = { activeSlot: activeEraserSlot, radii: { ...eraserSlotRadii } };
    if (!appLibrary.customHotkeys || typeof appLibrary.customHotkeys !== 'object') {
        appLibrary.customHotkeys = {};
    }
    if (!Array.isArray(appLibrary.examSheets)) {
        appLibrary.examSheets = [];
    }
    const defIpadCfg = {
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
        holdToShapeDelayMs: 850,
        pageHudCompact: true,
        batterySaverMode: false,
        fullscreenFocusMode: false
    };
    const loadedIpadCfg = (appLibrary.ipadConfig && typeof appLibrary.ipadConfig === 'object') ? appLibrary.ipadConfig : {};
    appLibrary.ipadConfig = {
        ...defIpadCfg,
        ...loadedIpadCfg
    };
    if (!loadedIpadCfg.touchPanDefaultV2) {
        appLibrary.ipadConfig.singleFingerMode = 'pan';
        appLibrary.ipadConfig.touchPanDefaultV2 = true;
    }
    syncActivePaperDimensions();
}

let persistDirty = false;
let persistTimer = null;
let lastPersistWriteTime = -10000;
let _preferIdbOnlyStorage = false;

function syncPersistedToolConfig() {
    appLibrary.eraserConfig = { activeSlot: activeEraserSlot, radii: { ...eraserSlotRadii } };
    const prevHl = (appLibrary.highlighterConfig && typeof appLibrary.highlighterConfig === 'object') ? appLibrary.highlighterConfig : {};
    appLibrary.highlighterConfig = {
        activeSlot: activeHighlighterSlot,
        widths: { ...highlighterSlotWidths },
        opacity: (typeof prevHl.opacity === 'number') ? prevHl.opacity : 0.50,
        colors: Array.isArray(prevHl.colors) && prevHl.colors.length === 5 ? [...prevHl.colors] : [...DEFAULT_HIGHLIGHTER_COLORS],
        activeColorIdx: Number.isFinite(parseInt(prevHl.activeColorIdx, 10)) ? Math.max(0, Math.min(4, parseInt(prevHl.activeColorIdx, 10))) : 0,
        hlPaletteV15_4: true
    };
    appLibrary.penConfig = {
        style: activePenStyle,
        smoothing: penSmoothing,
        opacity: penOpacity,
        activeStrokeSlot,
        slotWidths: { ...slotWidths },
        nibAngle: appLibrary.fountainNibAngle === 35 ? 35 : 90
    };
}

function flushPersistLibrary() {
    if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
    persistDirty = false;
    syncPersistedToolConfig();
    _hasUserPersistedSinceBoot = true;
    appLibrary._savedAt = Date.now();
    lastPersistWriteTime = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
    let serialized = '';
    try {
        serialized = JSON.stringify(appLibrary);
    } catch (_) {
        return;
    }
    writeLibraryToIndexedDB(serialized);
    if (_preferIdbOnlyStorage || serialized.length > 2000000) {
        _preferIdbOnlyStorage = true;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ __idbBacked: true, _savedAt: appLibrary._savedAt }));
        } catch (_) {}
        return;
    }
    try {
        localStorage.setItem(STORAGE_KEY, serialized);
    } catch (e) {
        _preferIdbOnlyStorage = true;
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ __idbBacked: true, _savedAt: appLibrary._savedAt }));
        } catch (_) {}
        if (!_storageQuotaWarned) {
            _storageQuotaWarned = true;
            if (typeof showGestureToast === 'function') {
                showGestureToast('💾 Sổ tay lớn (>5MB) đã tự động lưu vào kho IndexedDB an toàn!');
            }
        }
    }
}

function schedulePersistLibrary(delayMs = 2200) {
    syncPersistedToolConfig();
    persistDirty = true;
    if (typeof requestAnimationFrame !== 'function') {
        flushPersistLibrary();
        return;
    }
    if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
    persistTimer = setTimeout(() => {
        persistTimer = null;
        if (persistDirty) flushPersistLibrary();
    }, Math.max(300, delayMs));
}

function persistLibrary(immediate = false) {
    syncPersistedToolConfig();
    persistDirty = true;
    if (typeof requestAnimationFrame !== 'function') {
        flushPersistLibrary();
        return;
    }
    const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
    if (immediate || (now - lastPersistWriteTime) >= 1500) {
        flushPersistLibrary();
        return;
    }
    if (!persistTimer) {
        persistTimer = setTimeout(() => {
            persistTimer = null;
            if (persistDirty) flushPersistLibrary();
        }, 1500);
    }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', flushPersistLibrary);
    window.addEventListener('pagehide', flushPersistLibrary);
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && persistDirty) flushPersistLibrary();
    });
}

function getActiveNotebook() {
    return appLibrary.notebooks.find(n => n.id === appLibrary.activeNotebookId) || appLibrary.notebooks[0];
}
function getActivePage() {
    const nb = getActiveNotebook();
    if (!nb.pages || !nb.pages.length) nb.pages = [{ id: genId('pg'), template: 'grid', content: createEmptyPageContent() }];
    const idx = Math.max(0, Math.min(nb.pages.length - 1, nb.activePageIndex || 0));
    nb.activePageIndex = idx;
    return nb.pages[idx];
}
function getDocState() {
    const pg = getActivePage();
    if (!pg.content) pg.content = createEmptyPageContent();
    return pg.content;
}
function getPageLayoutBox(pageIdx) {
    const nb = getActiveNotebook();
    const numPages = Math.max(1, (nb && Array.isArray(nb.pages)) ? nb.pages.length : 1);
    if (isReadMode && readTwoPageMode && numPages > 1) {
        const col = pageIdx % 2;
        const row = Math.floor(pageIdx / 2);
        return {
            x: col * (A4_WIDTH + PAGE_GAP),
            y: row * (A4_HEIGHT + PAGE_GAP),
            w: A4_WIDTH,
            h: A4_HEIGHT
        };
    }
    return {
        x: 0,
        y: pageIdx * (A4_HEIGHT + PAGE_GAP),
        w: A4_WIDTH,
        h: A4_HEIGHT
    };
}

function getPageYOffset(pageIdx) {
    return getPageLayoutBox(pageIdx).y;
}

function getFitFullPageZoom() {
    const nb = getActiveNotebook();
    const numPages = Math.max(1, (nb && Array.isArray(nb.pages)) ? nb.pages.length : 1);
    const twoCol = isReadMode && readTwoPageMode && numPages > 1;
    const targetW = twoCol ? (A4_WIDTH * 2 + PAGE_GAP) : A4_WIDTH;
    const padX = twoCol ? 48 : 36;
    const padY = isReadMode ? 88 : 36;
    return Math.max(0.22, Math.min((cssWidth - padX) / Math.max(1, targetW), (cssHeight - padY) / Math.max(1, A4_HEIGHT)));
}

function getFitWidthZoom() {
    const nb = getActiveNotebook();
    const numPages = Math.max(1, (nb && Array.isArray(nb.pages)) ? nb.pages.length : 1);
    const twoCol = isReadMode && readTwoPageMode && numPages > 1;
    const targetW = twoCol ? (A4_WIDTH * 2 + PAGE_GAP) : A4_WIDTH;
    return Math.max(0.25, (cssWidth - 24) / Math.max(1, targetW));
}

function getMinFullScreenZoom() {
    return Math.max(0.22, Math.min(getFitFullPageZoom() * 0.75, 0.45));
}

function applyZoomSnapDetents(z, prevZ = null) {
    const fitPage = getFitFullPageZoom();
    const fitWidth = getFitWidthZoom();
    const eps = 0.008;
    const snapIfNotStuck = (target) => {
        if (Math.abs(z - target) >= eps) return false;
        if (typeof prevZ === 'number' && Math.abs(prevZ - target) < 0.002 && Math.abs(z - prevZ) > 0.0005) {
            return false;
        }
        return true;
    };
    if (snapIfNotStuck(fitPage)) return fitPage;
    if (snapIfNotStuck(fitWidth)) return fitWidth;
    return z;
}

function clampViewportPanAndZoom() {
    const minZ = getMinFullScreenZoom();
    zoom = Math.max(minZ, Math.min(3.5, zoom));
    const nb = getActiveNotebook();
    const numPages = Math.max(1, (nb.pages || []).length);
    const twoCol = isReadMode && readTwoPageMode && numPages > 1;
    const worldW = twoCol ? (A4_WIDTH * 2 + PAGE_GAP) : A4_WIDTH;
    const numRows = twoCol ? Math.ceil(numPages / 2) : numPages;
    const totalPagesH = numRows * (A4_HEIGHT + PAGE_GAP) - PAGE_GAP;
    const totalW = worldW * zoom;
    const totalH = totalPagesH * zoom;

    // Allow comfortable panning (sang ngang & lên xuống) & pinch focal stability even when a single page fits inside viewport
    const centerX = (cssWidth - totalW) / 2;
    const minPanX = Math.min(centerX - 220, cssWidth - totalW - 120);
    const maxPanX = Math.max(centerX + 220, 120);
    panX = Math.max(minPanX, Math.min(maxPanX, panX));

    const centerY = (cssHeight - totalH) / 2;
    const minPanY = Math.min(centerY - 200, cssHeight - totalH - 160);
    const maxPanY = Math.max(centerY + 200, isReadMode ? 96 : 96);
    panY = Math.max(minPanY, Math.min(maxPanY, panY));
}

function isPageContentEmpty(doc) {
    if (!doc) return true;
    return !(
        (doc.images && doc.images.length) ||
        (doc.atoms && doc.atoms.length) ||
        (doc.bonds && doc.bonds.length) ||
        (doc.arrows && doc.arrows.length) ||
        (doc.mechArrows && doc.mechArrows.length) ||
        (doc.orbitals && doc.orbitals.length) ||
        (doc.chemSymbols && doc.chemSymbols.length) ||
        (doc.texts && doc.texts.length) ||
        (doc.labItems && doc.labItems.length) ||
        (doc.labWidgets && doc.labWidgets.length) ||
        (doc.brackets && doc.brackets.length) ||
        (doc.inkStrokes && doc.inkStrokes.length)
    );
}

function getPageContentMaxY(doc) {
    if (!doc) return 0;
    let maxY = 0;
    const upd = (v) => { if (Number.isFinite(v) && v > maxY) maxY = v; };
    (doc.atoms || []).forEach(a => upd(a.y));
    (doc.orbitals || []).forEach(o => upd((o.y || 0) + (o.scale || 36)));
    (doc.chemSymbols || []).forEach(s => upd((s.y || 0) + 18));
    (doc.texts || []).forEach(t => upd((t.y || 0) + 16));
    (doc.arrows || []).forEach(ar => { upd(ar.y1); upd(ar.y2); });
    (doc.mechArrows || []).forEach(ma => { upd(ma.y1); upd(ma.y2); upd(ma.cpy); });
    (doc.brackets || []).forEach(br => upd((br.y || 0) + (br.h || 0)));
    (doc.images || []).forEach(im => upd((im.y || 0) + (im.h || 0)));
    (doc.labWidgets || []).forEach(lw => upd((lw.y || 0) + (lw.h || 0)));
    (doc.inkStrokes || []).forEach(st => {
        (st.points || []).forEach(p => upd(p.y));
    });
    return maxY;
}

function appendAutoPageToNotebook(nb, force = false) {
    if (!nb || !Array.isArray(nb.pages) || !nb.pages.length) return false;
    const now = Date.now();
    if (!force && now - lastAutoPageAppendAt < 450) return false;
    const lastPg = nb.pages[nb.pages.length - 1];
    if (!force && isPageContentEmpty(lastPg.content)) return false;
    lastAutoPageAppendAt = now;
    nb.pages.push({
        id: genId('pg'),
        template: lastPg.template || 'grid',
        pageConfig: lastPg.pageConfig ? { ...lastPg.pageConfig } : undefined,
        content: createEmptyPageContent()
    });
    if (typeof renderOpenTabsBar === 'function') renderOpenTabsBar();
    if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
    persistLibrary();
    showGestureToast(`Tự động thêm Trang ${nb.pages.length}`);
    return true;
}

function ensureAutoNextPageIfNeeded(triggerY = null) {
    if (appLibrary.autoAddPage === false) return false;
    const nb = getActiveNotebook();
    if (!nb || !nb.pages || !nb.pages.length) return false;
    const lastIdx = nb.pages.length - 1;
    if (nb.activePageIndex !== lastIdx) return false;
    const doc = getActivePage().content;
    const maxY = Math.max(Number.isFinite(triggerY) ? triggerY : 0, getPageContentMaxY(doc));
    if (maxY > A4_HEIGHT - 260) {
        return appendAutoPageToNotebook(nb);
    }
    return false;
}

function autoDetectPageFromScreenY(sy) {
    const rect = canvas.getBoundingClientRect();
    const ly = sy - rect.top;
    const globalY = (ly - panY) / zoom;
    const nb = getActiveNotebook();
    let detected = nb.pages.length - 1;
    for (let i = 0; i < nb.pages.length; i++) {
        const topY = getPageYOffset(i);
        if (globalY >= topY && globalY < topY + A4_HEIGHT + PAGE_GAP) {
            detected = i;
            break;
        }
    }
    if (globalY < 0) detected = 0;
    if (nb.activePageIndex !== detected) {
        nb.activePageIndex = detected;
        undoStack = [];
        redoStack = [];
        if (typeof renderOpenTabsBar === 'function') renderOpenTabsBar();
        if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
    }
}

function screenToWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    const lx = sx - rect.left, ly = sy - rect.top;
    const box = getPageLayoutBox(getActiveNotebook().activePageIndex || 0);
    return { x: (lx - panX) / zoom - box.x, y: (ly - panY) / zoom - box.y };
}

function showGestureToast(msg) {
    const el = document.getElementById('gestureToastHud');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 1400);
}

/* LỊCH SỬ UNDO / REDO & PHÍM TẮT BÀN PHÍM */
function clonePageContentSnapshot(doc, deepInk = true) {
    if (!doc || typeof doc !== 'object') return createEmptyPageContent();
    return {
        images: (doc.images || []).map(im => ({ ...im })),
        atoms: (doc.atoms || []).map(a => ({ ...a })),
        bonds: (doc.bonds || []).map(b => ({ ...b })),
        arrows: (doc.arrows || []).map(ar => ({ ...ar })),
        mechArrows: (doc.mechArrows || []).map(ma => ({ ...ma })),
        orbitals: (doc.orbitals || []).map(ob => ({ ...ob })),
        chemSymbols: (doc.chemSymbols || []).map(sm => ({
            ...sm,
            frontAtomIds: Array.isArray(sm.frontAtomIds) ? sm.frontAtomIds.slice() : undefined,
            backAtomIds: Array.isArray(sm.backAtomIds) ? sm.backAtomIds.slice() : undefined
        })),
        texts: (doc.texts || []).map(tx => ({ ...tx })),
        labItems: (doc.labItems || []).map(lb => ({ ...lb })),
        labWidgets: (doc.labWidgets || []).map(lw => ({ ...lw, state: lw.state ? { ...lw.state, alphaStats: lw.state.alphaStats ? { ...lw.state.alphaStats } : undefined } : undefined })),
        brackets: (doc.brackets || []).map(br => ({ ...br })),
        inkStrokes: deepInk
            ? (doc.inkStrokes || []).map(st => ({ ...st, points: (st.points || []).map(p => ({ x: p.x, y: p.y })) }))
            : (doc.inkStrokes || []).slice()
    };
}
function restorePageContentSnapshot(snap) {
    if (!snap) return createEmptyPageContent();
    if (typeof snap === 'string') {
        try { return JSON.parse(snap); } catch (e) { return createEmptyPageContent(); }
    }
    return clonePageContentSnapshot(snap, true);
}
function saveHistorySnapshot(deepInk = true, keepInkCache = false) {
    undoStack.push(clonePageContentSnapshot(getDocState(), deepInk));
    undoPushSeq++;
    if (!keepInkCache && typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    if (undoStack.length > 40) undoStack.shift();
    redoStack = [];
}
function undoAction() {
    if (!undoStack.length) return;
    redoStack.push(clonePageContentSnapshot(getDocState(), true));
    getActivePage().content = restorePageContentSnapshot(undoStack.pop());
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    schedulePersistLibrary(400);
    if (typeof renderAll === 'function') renderAll();
}
function redoAction() {
    if (!redoStack.length) return;
    undoStack.push(clonePageContentSnapshot(getDocState(), true));
    getActivePage().content = restorePageContentSnapshot(redoStack.pop());
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    schedulePersistLibrary(400);
    if (typeof renderAll === 'function') renderAll();
}

function normalizeHotkeyKeyName(rawKey) {
    if (!rawKey) return '';
    if (rawKey === ' ') return 'space';
    return String(rawKey).length === 1 ? rawKey.toLowerCase() : String(rawKey).toLowerCase();
}

function getEffectiveHotkey(actionId) {
    const meta = HOTKEY_ACTIONS_CATALOG.find(item => item.id === actionId);
    if (!meta) return '';
    const custom = appLibrary.customHotkeys && appLibrary.customHotkeys[actionId];
    return typeof custom === 'string' ? custom : meta.defaultKey;
}

function formatHotkeyBadge(k) {
    if (!k) return '—';
    if (k === 'space') return 'SPACE';
    if (k.length === 1) return k.toUpperCase();
    return k.toUpperCase();
}

function findHotkeyActionByKey(normKey, scope) {
    if (!normKey) return null;
    return HOTKEY_ACTIONS_CATALOG.find(item => item.scope === scope && getEffectiveHotkey(item.id) === normKey) || null;
}

function applyAtomHotkeyLabel(atom, newLbl) {
    if (!atom || !newLbl) return false;
    const doc = getDocState();
    if (newLbl !== 'C' && typeof getMaxValenceForAtom === 'function' && typeof getAtomBondOrderSum === 'function') {
        const maxV = getMaxValenceForAtom({ label: newLbl });
        const curSum = getAtomBondOrderSum(atom.id, doc);
        if (curSum > maxV) {
            showGestureToast(`${newLbl} tối đa ${maxV} liên kết!`);
            return false;
        }
    }
    saveHistorySnapshot();
    atom.label = newLbl;
    atom.color = penColor;
    if (typeof enforceAllValenceAndHydrogens === 'function') enforceAllValenceAndHydrogens(doc);
    persistLibrary();
    if (typeof renderAll === 'function') renderAll();
    showGestureToast(atom.label === 'C' ? 'Đã đưa về Carbon' : `Đổi nhóm: ${atom.label}`);
    return true;
}

function applyBondHotkeyAction(bond, action) {
    if (!bond || !action) return false;
    const doc = getDocState();
    if (typeof action.bondOrder === 'number') {
        const nextOrd = action.bondOrder;
        const curEff = bond.stereo ? 1 : (bond.order || 1);
        const delta = nextOrd - curEff;
        if (delta > 0 && typeof canAddBondOrder === 'function') {
            const a1 = (doc.atoms || []).find(a => a.id === bond.a1);
            const a2 = (doc.atoms || []).find(a => a.id === bond.a2);
            if ((a1 && !canAddBondOrder(a1, delta, doc)) || (a2 && !canAddBondOrder(a2, delta, doc))) {
                showGestureToast('Đã đạt giới hạn liên kết của nguyên tử!');
                return false;
            }
        }
        saveHistorySnapshot();
        bond.order = nextOrd;
        bond.stereo = null;
        if (typeof enforceAllValenceAndHydrogens === 'function') enforceAllValenceAndHydrogens(doc);
        if (typeof alignLinearSpChemistry === 'function') alignLinearSpChemistry(doc);
        persistLibrary();
        if (typeof renderAll === 'function') renderAll();
        showGestureToast(`Liên kết bậc ${nextOrd}`);
        return true;
    }
    if (action.bondStereo) {
        saveHistorySnapshot();
        bond.stereo = bond.stereo === action.bondStereo ? null : action.bondStereo;
        bond.order = 1;
        if (typeof enforceAllValenceAndHydrogens === 'function') enforceAllValenceAndHydrogens(doc);
        persistLibrary();
        if (typeof renderAll === 'function') renderAll();
        showGestureToast(bond.stereo ? (action.bondStereo === 'wedge' ? 'Nét đậm (Wedge)' : 'Nét đứt (Dash)') : 'Bỏ lập thể (Đơn)');
        return true;
    }
    return false;
}

function triggerGlobalHotkeyAction(action) {
    if (!action) return false;
    if (action.tool && typeof selectChemDrawTool === 'function') {
        selectChemDrawTool(action.tool);
        showGestureToast(`Công cụ: ${action.label}`);
        return true;
    }
    if (action.penMode && typeof selectPillPenMode === 'function') {
        selectPillPenMode(action.penMode);
        showGestureToast(`Công cụ: ${action.label}`);
        return true;
    }
    switch (action.id) {
        case 'act_new_page':
            if (typeof addNewPageToActiveNotebook === 'function') addNewPageToActiveNotebook();
            return true;
        case 'act_prev_page':
            if (typeof stepActivePage === 'function') stepActivePage(-1);
            return true;
        case 'act_next_page':
            if (typeof stepActivePage === 'function') stepActivePage(1);
            return true;
        case 'act_fit_screen':
            if (typeof fitA4ToScreen === 'function') fitA4ToScreen();
            return true;
        case 'act_audience_win':
            if (typeof toggleAudienceProjectorWindow === 'function') toggleAudienceProjectorWindow();
            return true;
        case 'act_clean_rec':
            if (typeof toggleCleanBoardRecording === 'function') toggleCleanBoardRecording();
            return true;
        case 'act_pres_mode':
            if (typeof togglePresentationMode === 'function') togglePresentationMode();
            return true;
        case 'act_read_mode':
            if (typeof toggleReadMode === 'function') toggleReadMode();
            return true;
        case 'act_help_modal':
            if (typeof openHelpHotkeysModal === 'function') openHelpHotkeysModal();
            return true;
        default:
            return false;
    }
}

window.addEventListener('keydown', e => {
    if (editingHotkeyActionId) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') {
            editingHotkeyActionId = null;
            if (typeof renderHotkeysSettingsList === 'function') renderHotkeysSettingsList();
            showGestureToast('Đã huỷ đổi phím tắt');
            return;
        }
        if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;
        const captured = normalizeHotkeyKeyName(e.key);
        if (captured && typeof assignCustomHotkey === 'function') {
            assignCustomHotkey(editingHotkeyActionId, captured);
        }
        return;
    }

    const tag = (e.target?.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
        if (e.key === 'Escape') {
            const supMod = document.getElementById('supportCommunityModal');
        if (supMod && !supMod.classList.contains('hidden') && typeof closeSupportCommunityModal === 'function') {
            closeSupportCommunityModal();
            return;
        }
        const perMod = document.getElementById('periodicHubModal');
        if (perMod && !perMod.classList.contains('hidden') && typeof closePeriodicHubModal === 'function') {
            closePeriodicHubModal();
            return;
        }
        const nrMod = document.getElementById('nameReactionsHubModal');
        if (nrMod && !nrMod.classList.contains('hidden') && typeof closeNameReactionsHubModal === 'function') {
            closeNameReactionsHubModal();
            return;
        }
        const fbMod = document.getElementById('feedbackHubModal');
            if (fbMod && !fbMod.classList.contains('hidden') && typeof closeFeedbackHubModal === 'function') {
                closeFeedbackHubModal();
            }
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
            e.preventDefault();
            if (typeof zoomCanvasBy === 'function') zoomCanvasBy(1.16);
            return;
        }
        if (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
            e.preventDefault();
            if (typeof zoomCanvasBy === 'function') zoomCanvasBy(0.86);
            return;
        }
        if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
            e.preventDefault();
            if (typeof fitA4ToScreen === 'function') fitA4ToScreen('page');
            return;
        }
    }

    if ((e.code === 'Space' || e.key === ' ') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!spacePanPressed) {
            spacePanPressed = true;
            if (typeof updateCanvasCursor === 'function') updateCanvasCursor();
        }
        return;
    }

    if (isReadMode) {
        if (e.key === 'Escape') {
            const supMod = document.getElementById('supportCommunityModal');
            if (supMod && !supMod.classList.contains('hidden') && typeof closeSupportCommunityModal === 'function') {
                closeSupportCommunityModal();
                return;
            }
            const fbMod = document.getElementById('feedbackHubModal');
            if (fbMod && !fbMod.classList.contains('hidden') && typeof closeFeedbackHubModal === 'function') {
                closeFeedbackHubModal();
                return;
            }
            const verMod = document.getElementById('versionUpdateHubModal');
            if (verMod && !verMod.classList.contains('hidden') && typeof closeVersionUpdateHub === 'function') {
                closeVersionUpdateHub();
                return;
            }
            const helpMod = document.getElementById('helpHotkeysModal');
            if (helpMod && !helpMod.classList.contains('hidden') && typeof closeHelpHotkeysModal === 'function') {
                closeHelpHotkeysModal();
                return;
            }
            if (typeof toggleReadMode === 'function') toggleReadMode(false);
            return;
        }
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            const rk = normalizeHotkeyKeyName(e.key);
            const globalAct = findHotkeyActionByKey(rk, 'global');
            const actId = globalAct ? globalAct.id : '';
            if (rk === '[' || actId === 'act_prev_page') { e.preventDefault(); if (typeof stepReadPage === 'function') stepReadPage(-1); return; }
            if (rk === ']' || actId === 'act_next_page') { e.preventDefault(); if (typeof stepReadPage === 'function') stepReadPage(1); return; }
            if (rk === '0' || actId === 'act_fit_screen') { e.preventDefault(); if (typeof fitA4ToScreen === 'function') fitA4ToScreen('page'); return; }
            if (rk === 'm' || actId === 'act_read_mode') { e.preventDefault(); if (typeof toggleReadMode === 'function') toggleReadMode(false); return; }
            if (rk === '?' || actId === 'act_help_modal') { e.preventDefault(); if (typeof openHelpHotkeysModal === 'function') openHelpHotkeysModal(); return; }
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoAction();
        else undoAction();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redoAction();
        return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeRingGizmo.active && typeof deleteActiveRing === 'function') { e.preventDefault(); deleteActiveRing(); }
        else if (lassoSelection.active && typeof deleteLassoSelection === 'function') { e.preventDefault(); deleteLassoSelection(); }
        else if (activeImageSelection.id && typeof deleteSelectedImage === 'function') { e.preventDefault(); deleteSelectedImage(); }
        return;
    }
    if (e.key === 'Escape') {
        const hwPop = document.getElementById('atomHandwritingPopover');
        if (hwPop && !hwPop.classList.contains('hidden') && typeof closeAtomHandwritingBox === 'function') {
            closeAtomHandwritingBox();
            return;
        }
        const labMod = document.getElementById('miniChemLabModal');
        if (labMod && !labMod.classList.contains('hidden') && typeof closeMiniChemLab === 'function') {
            closeMiniChemLab();
            return;
        }
        const supMod = document.getElementById('supportCommunityModal');
        if (supMod && !supMod.classList.contains('hidden') && typeof closeSupportCommunityModal === 'function') {
            closeSupportCommunityModal();
            return;
        }
        const perMod = document.getElementById('periodicHubModal');
        if (perMod && !perMod.classList.contains('hidden') && typeof closePeriodicHubModal === 'function') {
            closePeriodicHubModal();
            return;
        }
        const nrMod = document.getElementById('nameReactionsHubModal');
        if (nrMod && !nrMod.classList.contains('hidden') && typeof closeNameReactionsHubModal === 'function') {
            closeNameReactionsHubModal();
            return;
        }
        const fbMod = document.getElementById('feedbackHubModal');
        if (fbMod && !fbMod.classList.contains('hidden') && typeof closeFeedbackHubModal === 'function') {
            closeFeedbackHubModal();
            return;
        }
        const verMod = document.getElementById('versionUpdateHubModal');
        if (verMod && !verMod.classList.contains('hidden') && typeof closeVersionUpdateHub === 'function') {
            closeVersionUpdateHub();
            return;
        }
        const helpMod = document.getElementById('helpHotkeysModal');
        if (helpMod && !helpMod.classList.contains('hidden') && typeof closeHelpHotkeysModal === 'function') {
            closeHelpHotkeysModal();
            return;
        }
        if (typeof hideToolInfoCard === 'function') hideToolInfoCard();
        if (typeof isPresentationMode !== 'undefined' && isPresentationMode && typeof togglePresentationMode === 'function') {
            togglePresentationMode(false);
            return;
        }
        if (typeof closeAllPopovers === 'function') closeAllPopovers();
        if (typeof clearActiveRingGizmo === 'function') clearActiveRingGizmo(true);
        if (typeof clearLassoSelection === 'function') clearLassoSelection();
        if (typeof clearActiveImageSelection === 'function') clearActiveImageSelection(true);
        if (typeof clearActiveCarbonChain === 'function') clearActiveCarbonChain(true);
        return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = normalizeHotkeyKeyName(e.key);
        if (hoveredAtom) {
            const atomAct = findHotkeyActionByKey(k, 'atom');
            if (atomAct) {
                e.preventDefault();
                applyAtomHotkeyLabel(hoveredAtom, atomAct.atomLabel);
                return;
            }
        }
        if (hoveredBond && !hoveredAtom) {
            const bondAct = findHotkeyActionByKey(k, 'bond');
            if (bondAct) {
                e.preventDefault();
                applyBondHotkeyAction(hoveredBond, bondAct);
                return;
            }
        }
        const globalAct = findHotkeyActionByKey(k, 'global');
        if (globalAct) {
            e.preventDefault();
            triggerGlobalHotkeyAction(globalAct);
            return;
        }
    }
});

window.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.key === ' ') {
        if (spacePanPressed) {
            spacePanPressed = false;
            if (typeof updateCanvasCursor === 'function') updateCanvasCursor();
        }
    }
});
window.addEventListener('blur', () => {
    if (spacePanPressed) {
        spacePanPressed = false;
        if (typeof updateCanvasCursor === 'function') updateCanvasCursor();
    }
});