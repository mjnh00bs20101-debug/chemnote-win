/* ============================================================================
 * MODULE 4: CHEMICAL ENGINE (Mạch Carbon, Ghép Vòng C3-C9, Cấu dạng & Sự kiện)
 * ============================================================================ */

function getLargeTouchScale() {
    return (typeof appLibrary !== 'undefined' && appLibrary?.ipadConfig?.largeTouchTargets) ? 1.32 : 1;
}

function findNearestAtom(x, y, maxDist = 22) {
    let best = null, bestD = maxDist * getLargeTouchScale();
    for (const a of (getDocState().atoms || [])) {
        const d = Math.hypot(a.x - x, a.y - y);
        if (d < bestD) { bestD = d; best = a; }
    }
    return best;
}

function findNearestBond(x, y, maxDist = 16) {
    const doc = getDocState();
    let best = null, bestD = maxDist * getLargeTouchScale();
    for (const b of (doc.bonds || [])) {
        const a1 = doc.atoms.find(a => a.id === b.a1), a2 = doc.atoms.find(a => a.id === b.a2);
        if (!a1 || !a2) continue;
        const d = distToSegment({x,y}, a1, a2);
        if (d < bestD) { bestD = d; best = b; }
    }
    return best;
}

function findHitBondInterior(x, y, maxDist = 16) {
    const doc = getDocState();
    const scale = getLargeTouchScale();
    const tol = maxDist * scale;
    let best = null, bestD = tol;
    for (const b of (doc.bonds || [])) {
        const a1 = doc.atoms.find(a => a.id === b.a1);
        const a2 = doc.atoms.find(a => a.id === b.a2);
        if (!a1 || !a2) continue;
        const da1 = Math.hypot(x - a1.x, y - a1.y);
        const da2 = Math.hypot(x - a2.x, y - a2.y);
        const bondLen = Math.hypot(a2.x - a1.x, a2.y - a1.y);
        const endGuard = Math.min(16, Math.max(8, bondLen * 0.30));
        if (da1 <= endGuard || da2 <= endGuard) continue;
        const d = distToSegment({ x, y }, a1, a2);
        if (d < bestD && d < Math.min(da1, da2)) {
            bestD = d;
            best = b;
        }
    }
    return best;
}

function collectAcyclicBranchAtoms(startId, blockedId, doc) {
    const visited = new Set();
    const queue = [startId];
    const adj = new Map();
    (doc.bonds || []).forEach(b => {
        if (!adj.has(b.a1)) adj.set(b.a1, []);
        if (!adj.has(b.a2)) adj.set(b.a2, []);
        adj.get(b.a1).push(b.a2);
        adj.get(b.a2).push(b.a1);
    });
    while (queue.length) {
        const cur = queue.shift();
        if (cur === blockedId) return null; // Thuộc vòng kín → không xoay để giữ nguyên hình học vòng
        if (visited.has(cur)) continue;
        visited.add(cur);
        (adj.get(cur) || []).forEach(nbId => {
            if (cur === startId && nbId === blockedId) return;
            if (!visited.has(nbId)) queue.push(nbId);
        });
    }
    return visited;
}

function alignBranchOpposite180(centerAtom, fixedAtom, branchRoot, doc) {
    if (!centerAtom || !fixedAtom || !branchRoot || !doc) return;
    const targetAng = Math.atan2(centerAtom.y - fixedAtom.y, centerAtom.x - fixedAtom.x);
    const curAng = Math.atan2(branchRoot.y - centerAtom.y, branchRoot.x - centerAtom.x);
    const delta = Math.atan2(Math.sin(targetAng - curAng), Math.cos(targetAng - curAng));
    if (Math.abs(delta) < 0.01) return;

    const branchIds = collectAcyclicBranchAtoms(branchRoot.id, centerAtom.id, doc);
    if (!branchIds || !branchIds.size) return;

    const cosD = Math.cos(delta), sinD = Math.sin(delta);
    (doc.atoms || []).forEach(at => {
        if (!branchIds.has(at.id)) return;
        const rx = at.x - centerAtom.x;
        const ry = at.y - centerAtom.y;
        at.x = centerAtom.x + rx * cosD - ry * sinD;
        at.y = centerAtom.y + rx * sinD + ry * cosD;
    });
}

function alignLinearSpChemistry(doc) {
    if (!doc || !Array.isArray(doc.atoms) || !Array.isArray(doc.bonds)) return;
    const atomMap = new Map(doc.atoms.map(a => [a.id, a]));
    const bondsByAtom = new Map();
    doc.bonds.forEach(b => {
        if (!bondsByAtom.has(b.a1)) bondsByAtom.set(b.a1, []);
        if (!bondsByAtom.has(b.a2)) bondsByAtom.set(b.a2, []);
        bondsByAtom.get(b.a1).push(b);
        bondsByAtom.get(b.a2).push(b);
    });
    const getOther = (b, id) => atomMap.get(b.a1 === id ? b.a2 : b.a1);
    const tryAlign = (center, n1, n2) => {
        const b1 = collectAcyclicBranchAtoms(n1.id, center.id, doc);
        const b2 = collectAcyclicBranchAtoms(n2.id, center.id, doc);
        if (b2 && (!b1 || b2.size <= b1.size)) {
            alignBranchOpposite180(center, n1, n2, doc);
        } else if (b1) {
            alignBranchOpposite180(center, n2, n1, doc);
        }
    };

    // 1. Allene C=C=C (=·=) → canh thẳng 180° quanh tâm sp (kể cả mạch dài không phân vòng)
    doc.atoms.forEach(a => {
        if (a.label && a.label !== 'C') return;
        const bs = bondsByAtom.get(a.id) || [];
        if (bs.length === 2 && !bs[0].stereo && !bs[1].stereo && bs[0].order === 2 && bs[1].order === 2) {
            const n1 = getOther(bs[0], a.id);
            const n2 = getOther(bs[1], a.id);
            if (n1 && n2) tryAlign(a, n1, n2);
        }
    });

    // 2. Liên kết ba C≡C → góc liên kết sp hai đầu = 180° (xoay cả nhánh nối nếu là mạch hở)
    doc.bonds.forEach(b => {
        if (b.order !== 3 || b.stereo) return;
        const a1 = atomMap.get(b.a1), a2 = atomMap.get(b.a2);
        if (!a1 || !a2) return;
        const b1Others = (bondsByAtom.get(a1.id) || []).filter(ob => ob !== b);
        if (b1Others.length === 1) {
            const n1 = getOther(b1Others[0], a1.id);
            if (n1) tryAlign(a1, a2, n1);
        }
        const b2Others = (bondsByAtom.get(a2.id) || []).filter(ob => ob !== b);
        if (b2Others.length === 1) {
            const n2 = getOther(b2Others[0], a2.id);
            if (n2) tryAlign(a2, a1, n2);
        }
    });
}

function promoteBondOnDoubleTap(hitBond, doc) {
    if (!hitBond || !doc) return false;
    const a1 = (doc.atoms || []).find(a => a.id === hitBond.a1);
    const a2 = (doc.atoms || []).find(a => a.id === hitBond.a2);
    if (!a1 || !a2) return false;
    const curOrd = hitBond.stereo ? 1 : (hitBond.order || 1);
    let nextOrd = 2;
    if (curOrd === 1) {
        if (!canAddBondOrder(a1, 1, doc) || !canAddBondOrder(a2, 1, doc)) {
            if (typeof showGestureToast === 'function') showGestureToast('Đã đạt giới hạn hóa trị của nguyên tử!');
            return false;
        }
        nextOrd = 2;
    } else if (curOrd === 2) {
        const el1 = getAtomBaseElement(a1), el2 = getAtomBaseElement(a2);
        const n1 = getAtomNeighbors(a1.id, doc).length, n2 = getAtomNeighbors(a2.id, doc).length;
        const isTerminalDoubleHetero = ((el1 === 'O' || el1 === 'S') && n1 <= 1) || ((el2 === 'O' || el2 === 'S') && n2 <= 1);
        if (!isTerminalDoubleHetero && canAddBondOrder(a1, 1, doc) && canAddBondOrder(a2, 1, doc)) {
            nextOrd = 3;
        } else {
            nextOrd = 1;
        }
    } else {
        nextOrd = 1;
    }
    saveHistorySnapshot();
    hitBond.stereo = null;
    hitBond.order = nextOrd;
    if (typeof selectedBondId !== 'undefined') selectedBondId = null;
    enforceAllValenceAndHydrogens(doc);
    alignLinearSpChemistry(doc);
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    persistLibrary();
    renderAll();
    if (typeof showGestureToast === 'function') {
        const msg = nextOrd === 2 ? '✨ Đã chuyển thành liên kết đôi (=)' : (nextOrd === 3 ? 'Đã chuyển thành liên kết ba (≡)' : 'Đã đưa về liên kết đơn (—)');
        showGestureToast(msg);
    }
    return true;
}

let mechArrowDragPoints = [];

function getActiveMechArrowDragBias(pStart, pEnd, pts = mechArrowDragPoints) {
    if (!pStart || !pEnd || !Array.isArray(pts) || pts.length < 3) return 0;
    const dx = pEnd.x - pStart.x, dy = pEnd.y - pStart.y;
    const len = Math.hypot(dx, dy);
    if (len < 12) return 0;
    const nx = -dy / len, ny = dx / len;
    let peak = 0;
    for (let i = 0; i < pts.length; i++) {
        const signed = (pts[i].x - pStart.x) * nx + (pts[i].y - pStart.y) * ny;
        if (Math.abs(signed) > Math.abs(peak)) peak = signed;
    }
    return Math.abs(peak) >= 8 ? peak : 0;
}

function flipMechArrowCurve(ma, doc) {
    if (!ma) return;
    const cur = typeof getMechArrowControlPoint === 'function'
        ? getMechArrowControlPoint(ma, doc)
        : { x: (ma.x1 + ma.x2) * 0.5, y: (ma.y1 + ma.y2) * 0.5 };
    const mx = (ma.x1 + ma.x2) * 0.5, my = (ma.y1 + ma.y2) * 0.5;
    saveHistorySnapshot();
    ma.cpx = 2 * mx - cur.x;
    ma.cpy = 2 * my - cur.y;
    ma.manualCtrl = true;
    persistLibrary();
    renderAll();
    if (typeof showGestureToast === 'function') showGestureToast('⇄ Đã đảo hướng cong mũi tên e⁻');
}

function distToSegment(p, v, w) {
    const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x)*(w.x - v.x) + (p.y - v.y)*(w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t*(w.x - v.x)), p.y - (v.y + t*(w.y - v.y)));
}

const NITROGEN_ATOM_LABELS = new Set(['N', 'NH', 'HN', 'NH2', 'H2N', 'NH3', 'N+', 'NH+', 'NH2+', 'NH3+']);
const OXYGEN_ATOM_LABELS = new Set(['O', 'OH', 'HO', 'O+', 'OH+']);
const SULFUR_ATOM_LABELS = new Set(['S', 'SH', 'HS']);
const PHOSPHORUS_ATOM_LABELS = new Set(['P', 'PH', 'PH2', 'P+']);

function getAtomBaseElement(atom) {
    const lbl = (atom?.label || 'C').trim();
    if (lbl === 'C') return 'C';
    if (lbl === 'CH') return 'CH';
    if (lbl === 'CH2') return 'CH2';
    if (NITROGEN_ATOM_LABELS.has(lbl)) return 'N';
    if (OXYGEN_ATOM_LABELS.has(lbl)) return 'O';
    if (SULFUR_ATOM_LABELS.has(lbl)) return 'S';
    if (PHOSPHORUS_ATOM_LABELS.has(lbl)) return 'P';
    if (lbl === 'B') return 'B';
    if (lbl === 'Si') return 'Si';
    return 'Group';
}

function getMaxValenceForAtom(atom) {
    const el = getAtomBaseElement(atom);
    if (el === 'C' || el === 'N' || el === 'B' || el === 'Si') return 4;
    if (el === 'CH') return 3;
    if (el === 'CH2') return 2;
    if (el === 'O') return 3;
    if (el === 'S') return 6;
    if (el === 'P') return 5;
    return 1;
}

function getAtomBondOrderSum(atomId, doc) {
    return (doc.bonds || []).reduce((sum, b) => {
        if (b.a1 === atomId || b.a2 === atomId) return sum + (b.stereo ? 1 : (b.order || 1));
        return sum;
    }, 0);
}

function canAddBondOrder(atom, deltaOrder, doc) {
    if (!atom) return false;
    return getAtomBondOrderSum(atom.id, doc) + deltaOrder <= getMaxValenceForAtom(atom);
}

function enforceAllValenceAndHydrogens(doc) {
    if (!doc || !Array.isArray(doc.atoms)) return;
    doc.atoms.forEach(a => {
        const el = getAtomBaseElement(a);
        const s = getAtomBondOrderSum(a.id, doc);
        if (s === 0) return;
        if (el === 'N') {
            if (s === 1) a.label = 'NH2';
            else if (s === 2) a.label = 'NH';
            else if (s === 3) a.label = 'N';
            else a.label = 'N+';
        } else if (el === 'O') {
            if (s === 1) a.label = 'OH';
            else if (s === 2) a.label = 'O';
            else a.label = 'O+';
        } else if (el === 'S') {
            if (s === 1) a.label = 'SH';
            else a.label = 'S';
        } else if (el === 'P') {
            if (s === 1) a.label = 'PH2';
            else if (s === 2) a.label = 'PH';
            else if (s === 3) a.label = 'P';
            else if (s === 4) a.label = 'P+';
            else a.label = 'P';
        }
    });
}

function getAtomNeighbors(atomId, doc) {
    if (!atomId || !doc || !Array.isArray(doc.atoms)) return [];
    return (doc.bonds || [])
        .filter(b => b.a1 === atomId || b.a2 === atomId)
        .map(b => doc.atoms.find(a => a.id === (b.a1 === atomId ? b.a2 : b.a1)))
        .filter(Boolean);
}

function normalizeBondAngle(a) {
    return Math.atan2(Math.sin(a), Math.cos(a));
}

function bondAngleDiff(a, b) {
    return normalizeBondAngle(a - b);
}

function snapHexLatticeAngle(rawAng) {
    return normalizeBondAngle(Math.round((rawAng - Math.PI / 6) / (Math.PI / 3)) * (Math.PI / 3) + Math.PI / 6);
}

function getSmartHorizontalZigZagAngle(atom, doc, preferredAng = null) {
    if (!atom) return preferredAng !== null ? snapHexLatticeAngle(preferredAng) : -Math.PI / 6;
    const neighbors = getAtomNeighbors(atom.id, doc);

    // Khi người dùng chủ động kéo chọn hướng (preferredAng !== null): tôn trọng mọi hướng 360° (kể cả sang trái/lên/xuống)
    if (preferredAng !== null) {
        const occAngles = neighbors.map(nb => Math.atan2(nb.y - atom.y, nb.x - atom.x));
        const isFreeAngle = (cand) => occAngles.every(oa => Math.abs(bondAngleDiff(cand, oa)) >= 0.32);

        if (neighbors.length === 1) {
            const prev = neighbors[0];
            const inAng = Math.atan2(atom.y - prev.y, atom.x - prev.x);
            const incBond = (doc?.bonds || []).find(b =>
                (b.a1 === atom.id && b.a2 === prev.id) || (b.a2 === atom.id && b.a1 === prev.id)
            );
            if (incBond && incBond.order === 3 && Math.abs(bondAngleDiff(preferredAng, inAng)) < 0.45) {
                return inAng;
            }
            const cPlus = normalizeBondAngle(inAng + Math.PI / 3);
            const cMinus = normalizeBondAngle(inAng - Math.PI / 3);
            if (Math.abs(bondAngleDiff(preferredAng, cPlus)) <= 0.22) return cPlus;
            if (Math.abs(bondAngleDiff(preferredAng, cMinus)) <= 0.22) return cMinus;
        }

        const hexSnap = snapHexLatticeAngle(preferredAng);
        if (Math.abs(bondAngleDiff(preferredAng, hexSnap)) <= 0.18 && isFreeAngle(hexSnap)) {
            return hexSnap;
        }
        const step15 = Math.PI / 12;
        const fineSnap = normalizeBondAngle(Math.round(preferredAng / step15) * step15);
        if (isFreeAngle(fineSnap)) return fineSnap;
        if (isFreeAngle(preferredAng)) return preferredAng;
    }

    if (neighbors.length === 0) {
        return preferredAng !== null ? snapHexLatticeAngle(preferredAng) : -Math.PI / 6;
    }

    if (neighbors.length === 1) {
        const prev = neighbors[0];
        const inAng = Math.atan2(atom.y - prev.y, atom.x - prev.x);
        const incBond = (doc?.bonds || []).find(b =>
            (b.a1 === atom.id && b.a2 === prev.id) || (b.a2 === atom.id && b.a1 === prev.id)
        );
        if (incBond && incBond.order === 3) {
            return inAng;
        }
        const cPlus = normalizeBondAngle(inAng + Math.PI / 3);
        const cMinus = normalizeBondAngle(inAng - Math.PI / 3);
        const score = (ang) => Math.cos(ang) * 1.15 + (Math.abs(Math.abs(ang) - Math.PI / 2) > 0.25 ? 0.55 : 0);
        return score(cPlus) >= score(cMinus) ? cPlus : cMinus;
    }

    if (neighbors.length === 2) {
        const u1x = neighbors[0].x - atom.x, u1y = neighbors[0].y - atom.y;
        const l1 = Math.hypot(u1x, u1y) || 1;
        const u2x = neighbors[1].x - atom.x, u2y = neighbors[1].y - atom.y;
        const l2 = Math.hypot(u2x, u2y) || 1;
        const bx = -(u1x / l1 + u2x / l2);
        const by = -(u1y / l1 + u2y / l2);
        if (Math.hypot(bx, by) > 0.05) return Math.atan2(by, bx);
        return -Math.PI / 2;
    }

    const angles = neighbors.map(nb => Math.atan2(nb.y - atom.y, nb.x - atom.x)).sort((a, b) => a - b);
    let bestAng = -Math.PI / 6, maxGap = -1;
    for (let i = 0; i < angles.length; i++) {
        const a1 = angles[i];
        const a2 = (i + 1 < angles.length) ? angles[i + 1] : (angles[0] + Math.PI * 2);
        const gap = a2 - a1;
        if (gap > maxGap) { maxGap = gap; bestAng = a1 + gap / 2; }
    }
    return bestAng;
}

function chooseNonCollinearFirstParity(startAtom, doc, angA, angB, fallbackUseA = true) {
    if (!startAtom || !doc) return fallbackUseA;
    const nbs = getAtomNeighbors(startAtom.id, doc);
    if (nbs.length === 0) return fallbackUseA;
    if (nbs.length !== 1) {
        const occ = nbs.map(nb => Math.atan2(nb.y - startAtom.y, nb.x - startAtom.x));
        const minClearA = Math.min(...occ.map(oa => Math.abs(bondAngleDiff(angA, oa))));
        const minClearB = Math.min(...occ.map(oa => Math.abs(bondAngleDiff(angB, oa))));
        if (Math.abs(minClearA - minClearB) > 0.08) return minClearA >= minClearB;
        return fallbackUseA;
    }
    const inAng = Math.atan2(startAtom.y - nbs[0].y, startAtom.x - nbs[0].x);
    const incBond = (doc?.bonds || []).find(b =>
        (b.a1 === startAtom.id && b.a2 === nbs[0].id) || (b.a2 === startAtom.id && b.a1 === nbs[0].id)
    );
    const diffA = Math.abs(bondAngleDiff(angA, inAng));
    const diffB = Math.abs(bondAngleDiff(angB, inAng));
    if (incBond && incBond.order === 3) {
        return diffA <= diffB;
    }
    // Tuyệt đối tránh hướng 180° (cùng phương inAng, diff ≈ 0) hoặc gấp khúc 0° (quay ngược lên chính liên kết cũ, diff ≈ π)
    const penaltyA = (diffA < 0.42 || diffA > 2.65) ? 10 : Math.abs(diffA - Math.PI / 3);
    const penaltyB = (diffB < 0.42 || diffB > 2.65) ? 10 : Math.abs(diffB - Math.PI / 3);
    return penaltyA <= penaltyB;
}

function buildHorizontalZigZagPreview(startAtom, startPos, endPos, doc) {
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const dist = Math.hypot(dx, dy);
    const stepX = BOND_LENGTH * Math.cos(Math.PI / 6);

    if (dist <= BOND_LENGTH * 1.55) {
        if (dist < 10) {
            const ang = getSmartHorizontalZigZagAngle(startAtom, doc);
            return [
                { x: startPos.x, y: startPos.y },
                { x: startPos.x + BOND_LENGTH * Math.cos(ang), y: startPos.y + BOND_LENGTH * Math.sin(ang) }
            ];
        }
        const nearA = findNearestAtom(endPos.x, endPos.y, 18);
        if (nearA && nearA !== startAtom) {
            return [{ x: startPos.x, y: startPos.y }, { x: nearA.x, y: nearA.y, existingAtom: nearA }];
        }
        const rawAng = Math.atan2(dy, dx);
        const snap = startAtom ? getSmartHorizontalZigZagAngle(startAtom, doc, rawAng) : getSmartHorizontalZigZagAngle({ id: '__tmp__', x: startPos.x, y: startPos.y }, { atoms: [], bonds: [] }, rawAng);
        return [
            { x: startPos.x, y: startPos.y },
            { x: startPos.x + BOND_LENGTH * Math.cos(snap), y: startPos.y + BOND_LENGTH * Math.sin(snap) }
        ];
    }

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const isVerticalDrag = absDy >= absDx * 1.45;
    const isHorizontalDrag = absDx >= absDy * 1.45;

    const trySnapChainTailToAtom = (ptsList) => {
        if (!ptsList || ptsList.length < 2) return ptsList;
        const tail = ptsList[ptsList.length - 1];
        const prev = ptsList[ptsList.length - 2];
        const nearEnd = findNearestAtom(endPos.x, endPos.y, 24);
        const nearTail = findNearestAtom(tail.x, tail.y, 24);
        const cand = (nearEnd && nearEnd !== startAtom) ? nearEnd : ((nearTail && nearTail !== startAtom) ? nearTail : null);
        if (cand && Math.hypot(cand.x - prev.x, cand.y - prev.y) >= 14 && Math.hypot(cand.x - prev.x, cand.y - prev.y) <= BOND_LENGTH * 1.9) {
            ptsList[ptsList.length - 1] = { x: cand.x, y: cand.y, existingAtom: cand };
        }
        return ptsList;
    };

    if (isVerticalDrag) {
        const stepY = BOND_LENGTH * Math.sin(Math.PI / 3);
        const numSegV = Math.max(2, Math.min(24, Math.round(absDy / stepY)));
        const dirY = dy < 0 ? -1 : 1;
        const angR = dirY < 0 ? -Math.PI / 3 : Math.PI / 3;
        const angL = dirY < 0 ? -2 * Math.PI / 3 : 2 * Math.PI / 3;
        let goingRight = chooseNonCollinearFirstParity(startAtom, doc, angR, angL, dx >= 0);
        const ptsV = [{ x: startPos.x, y: startPos.y }];
        let curX = startPos.x, curY = startPos.y;
        for (let i = 0; i < numSegV; i++) {
            const ang = goingRight ? angR : angL;
            curX += BOND_LENGTH * Math.cos(ang);
            curY += BOND_LENGTH * Math.sin(ang);
            ptsV.push({ x: curX, y: curY });
            goingRight = !goingRight;
        }
        return trySnapChainTailToAtom(ptsV);
    }

    if (!isHorizontalDrag) {
        // Kéo chéo: tạo bậc thang lục giác 120° bám trục chéo ±60° / ±120° thẳng tới con trỏ
        const rawAng = Math.atan2(dy, dx);
        const axisAng = Math.round(rawAng / (Math.PI / 3)) * (Math.PI / 3);
        const angA = normalizeBondAngle(axisAng - Math.PI / 6);
        const angB = normalizeBondAngle(axisAng + Math.PI / 6);
        const numSegD = Math.max(2, Math.min(24, Math.round(dist / stepX)));
        let useA = chooseNonCollinearFirstParity(startAtom, doc, angA, angB, true);
        const ptsD = [{ x: startPos.x, y: startPos.y }];
        let curX = startPos.x, curY = startPos.y;
        for (let i = 0; i < numSegD; i++) {
            const ang = useA ? angA : angB;
            curX += BOND_LENGTH * Math.cos(ang);
            curY += BOND_LENGTH * Math.sin(ang);
            ptsD.push({ x: curX, y: curY });
            useA = !useA;
        }
        return trySnapChainTailToAtom(ptsD);
    }

    const numSegments = Math.max(2, Math.min(24, Math.round(dist / stepX)));
    const dirX = dx >= 0 ? 1 : -1;
    const angUp = dirX > 0 ? (-Math.PI / 6) : (-5 * Math.PI / 6);
    const angDown = dirX > 0 ? (Math.PI / 6) : (5 * Math.PI / 6);
    let goingUp = chooseNonCollinearFirstParity(startAtom, doc, angUp, angDown, dy <= 14);
    const pts = [{ x: startPos.x, y: startPos.y }];
    let curX = startPos.x, curY = startPos.y;
    for (let i = 0; i < numSegments; i++) {
        const ang = goingUp ? angUp : angDown;
        curX += BOND_LENGTH * Math.cos(ang);
        curY += BOND_LENGTH * Math.sin(ang);
        pts.push({ x: curX, y: curY });
        goingUp = !goingUp;
    }
    return trySnapChainTailToAtom(pts);
}

function updateChainFloatingBarPos() {
    const bar = document.getElementById('chainFloatingBar');
    const badge = document.getElementById('chainCountBadge');
    if (!bar || !activeCarbonChain.active) { bar?.classList.add('hidden'); return; }
    // Bỏ hub nổi sau khi vẽ mạch C–C để không vướng mắt trên trang giấy; chỉ giữ thanh ±C cho công thức chiếu Fischer
    if (activeCarbonChain.mode !== 'fischer') {
        bar.classList.add('hidden');
        return;
    }
    const doc = getDocState();
    const pageY = getPageYOffset(getActiveNotebook().activePageIndex || 0);

    const spines = (activeCarbonChain.fischerSpines || []).map(id => doc.atoms.find(a => a.id === id)).filter(Boolean);
    if (!spines.length) { bar.classList.add('hidden'); return; }
    const totalC = spines.length + 2;
    if (badge) badge.textContent = 'Fischer: C' + totalC;
    const topA = spines[0];
    const sx = panX + topA.x * zoom;
    const sy = panY + (pageY + topA.y - BOND_LENGTH) * zoom - 44;
    bar.style.left = Math.max(120, Math.min(cssWidth - 120, sx)) + 'px';
    bar.style.top = Math.max(8, Math.min(cssHeight - 50, sy)) + 'px';
    bar.classList.remove('hidden');
}

function getActiveChainTipAtom(doc) {
    if (!doc || !Array.isArray(doc.atoms) || !doc.atoms.length) return null;
    if (activeCarbonChain.active && Array.isArray(activeCarbonChain.atomIds) && activeCarbonChain.atomIds.length) {
        for (let i = activeCarbonChain.atomIds.length - 1; i >= 0; i--) {
            const found = doc.atoms.find(a => a.id === activeCarbonChain.atomIds[i]);
            if (found) return found;
        }
    }
    if (typeof window !== 'undefined' && window.lastActiveChemAtomId) {
        const lastA = doc.atoms.find(a => a.id === window.lastActiveChemAtomId);
        if (lastA) return lastA;
    }
    return doc.atoms[doc.atoms.length - 1];
}

function toggleLastActiveChainBondOrder() {
    const doc = getDocState();
    if (!doc || !Array.isArray(doc.bonds) || !doc.bonds.length) return false;
    let targetBond = null;
    if (activeCarbonChain.active && Array.isArray(activeCarbonChain.atomIds) && activeCarbonChain.atomIds.length >= 2) {
        const aEnd = activeCarbonChain.atomIds[activeCarbonChain.atomIds.length - 1];
        const aPrev = activeCarbonChain.atomIds[activeCarbonChain.atomIds.length - 2];
        targetBond = doc.bonds.find(b => (b.a1 === aEnd && b.a2 === aPrev) || (b.a2 === aEnd && b.a1 === aPrev)) || null;
    }
    if (!targetBond) {
        const tip = getActiveChainTipAtom(doc);
        if (tip) {
            for (let i = doc.bonds.length - 1; i >= 0; i--) {
                if (doc.bonds[i].a1 === tip.id || doc.bonds[i].a2 === tip.id) {
                    targetBond = doc.bonds[i];
                    break;
                }
            }
        }
    }
    if (!targetBond) return false;
    const ok = promoteBondOnDoubleTap(targetBond, doc);
    updateChainFloatingBarPos();
    return ok;
}

function quickSproutGroupOnActiveChainTip(groupLabel) {
    const doc = getDocState();
    const tip = getActiveChainTipAtom(doc);
    if (!tip) return false;
    const isCarbonyl = groupLabel === '=O' || groupLabel === 'O=';
    const needOrder = isCarbonyl ? 2 : 1;
    if (!canAddBondOrder(tip, needOrder, doc)) {
        if (typeof showGestureToast === 'function') {
            showGestureToast((tip.label || 'C') + ' không đủ hóa trị trống để gắn ' + groupLabel + '!');
        }
        return false;
    }
    saveHistorySnapshot();
    const ang = getSmartHorizontalZigZagAngle(tip, doc, null);
    const tx = tip.x + BOND_LENGTH * Math.cos(ang);
    const ty = tip.y + BOND_LENGTH * Math.sin(ang);
    const cleanLbl = isCarbonyl ? 'O' : groupLabel;
    const newAtom = { id: genId('a'), x: tx, y: ty, label: cleanLbl, color: penColor };
    doc.atoms.push(newAtom);
    doc.bonds.push({ id: genId('b'), a1: tip.id, a2: newAtom.id, order: needOrder, stereo: null, color: penColor });
    enforceAllValenceAndHydrogens(doc);
    ensureAutoNextPageIfNeeded(Math.max(tip.y, ty));
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    updateChainFloatingBarPos();
    persistLibrary();
    renderAll();
    if (typeof showGestureToast === 'function') {
        showGestureToast('⚡ Đã mọc nhánh ' + (isCarbonyl ? '=O' : ('-' + cleanLbl)) + ' ngay đầu mạch!');
    }
    return true;
}

function quickAttachRingToActiveChainTip(ringType = 'benzene') {
    const doc = getDocState();
    const tip = getActiveChainTipAtom(doc);
    if (!tip) {
        if (typeof selectRingFromHub === 'function') selectRingFromHub(ringType);
        return false;
    }
    if (!canAddBondOrder(tip, 1, doc)) {
        if (typeof showGestureToast === 'function') showGestureToast('Đỉnh Carbon hiện tại đã đủ 4 hóa trị!');
        return false;
    }
    saveHistorySnapshot();
    const cfg = getRingConfig(ringType);
    const n = cfg.n || 6;
    const R = BOND_LENGTH;
    const rad = R / (2 * Math.sin(Math.PI / n));
    const ang = getSmartHorizontalZigZagAngle(tip, doc, null);
    const attachX = tip.x + R * Math.cos(ang);
    const attachY = tip.y + R * Math.sin(ang);
    const cx = attachX + rad * Math.cos(ang);
    const cy = attachY + rad * Math.sin(ang);
    const startTheta = ang + Math.PI;
    const ringAtoms = [];
    for (let k = 0; k < n; k++) {
        const th = startTheta + (k * 2 * Math.PI) / n;
        const px = cx + rad * Math.cos(th);
        const py = cy + rad * Math.sin(th);
        const lbl = (cfg.hetero && cfg.hetero[k]) ? cfg.hetero[k] : 'C';
        const na = { id: genId('a'), x: px, y: py, label: lbl, color: penColor };
        doc.atoms.push(na);
        ringAtoms.push(na);
    }
    doc.bonds.push({ id: genId('b'), a1: tip.id, a2: ringAtoms[0].id, order: 1, stereo: null, color: penColor });
    for (let k = 0; k < n; k++) {
        const order = (cfg.dbl && cfg.dbl.includes(k)) ? 2 : 1;
        doc.bonds.push({ id: genId('b'), a1: ringAtoms[k].id, a2: ringAtoms[(k + 1) % n].id, order, stereo: null, color: penColor });
    }
    const paraAtom = ringAtoms[Math.floor(n / 2)] || ringAtoms[0];
    window.lastActiveChemAtomId = paraAtom.id;
    activeCarbonChain = {
        active: true,
        mode: 'zigzag',
        atomIds: [...(activeCarbonChain.atomIds || [tip.id]), ringAtoms[0].id, paraAtom.id],
        dirX: Math.cos(ang) >= 0 ? 1 : -1,
        fischerSpines: []
    };
    enforceAllValenceAndHydrogens(doc);
    ensureAutoNextPageIfNeeded(cy + rad);
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    updateChainFloatingBarPos();
    persistLibrary();
    renderAll();
    if (typeof showGestureToast === 'function') {
        showGestureToast(ringType === 'benzene' ? '⬡ Đã nối nhanh Vòng Benzen vào đầu mạch!' : '⬡ Đã nối nhanh Vòng C6 vào đầu mạch!');
    }
    return true;
}

function clearActiveCarbonChain(render = true) {
    activeCarbonChain.active = false;
    document.getElementById('chainFloatingBar')?.classList.add('hidden');
    if (render && typeof renderAll === 'function') renderAll();
}

function adjustActiveMainChainCarbon(delta) {
    if (!activeCarbonChain.active) return;
    const doc = getDocState();

    if (activeCarbonChain.mode === 'fischer') {
        const spines = (activeCarbonChain.fischerSpines || []).map(id => doc.atoms.find(a => a.id === id)).filter(Boolean);
        if (!spines.length) return;
        const stepY = BOND_LENGTH * 0.78;
        if (delta > 0) {
            saveHistorySnapshot();
            const lastSpine = spines[spines.length - 1];
            const bottomCap = doc.atoms.find(a => a.id === activeCarbonChain.bottomCapId);
            const newY = lastSpine.y + stepY;
            const newSpine = { id: genId('a'), x: lastSpine.x, y: newY, label: 'C', color: penColor };
            const leftArm = { id: genId('a'), x: lastSpine.x - BOND_LENGTH * 0.85, y: newY, label: 'C', color: penColor };
            const rightArm = { id: genId('a'), x: lastSpine.x + BOND_LENGTH * 0.85, y: newY, label: 'C', color: penColor };
            doc.atoms.push(newSpine, leftArm, rightArm);
            doc.bonds.push(
                { id: genId('b'), a1: newSpine.id, a2: leftArm.id, order: 1, color: penColor },
                { id: genId('b'), a1: newSpine.id, a2: rightArm.id, order: 1, color: penColor }
            );
            if (bottomCap) {
                bottomCap.y = newY + BOND_LENGTH * 0.85;
                const capBond = (doc.bonds || []).find(b => (b.a1 === lastSpine.id && b.a2 === bottomCap.id) || (b.a2 === lastSpine.id && b.a1 === bottomCap.id));
                if (capBond) { capBond.a1 = newSpine.id; capBond.a2 = bottomCap.id; }
            }
            doc.bonds.push({ id: genId('b'), a1: lastSpine.id, a2: newSpine.id, order: 1, color: penColor });
            activeCarbonChain.fischerSpines.push(newSpine.id);
            activeCarbonChain.atomIds.push(newSpine.id, leftArm.id, rightArm.id);
            ensureAutoNextPageIfNeeded(bottomCap ? bottomCap.y : newY);
            updateChainFloatingBarPos(); persistLibrary(); renderAll();
        } else if (delta < 0 && spines.length > 1) {
            saveHistorySnapshot();
            const remId = activeCarbonChain.fischerSpines.pop();
            const prevSpineId = activeCarbonChain.fischerSpines[activeCarbonChain.fischerSpines.length - 1];
            const prevSpine = doc.atoms.find(a => a.id === prevSpineId);
            const bottomCap = doc.atoms.find(a => a.id === activeCarbonChain.bottomCapId);
            const armIds = (doc.bonds || [])
                .filter(b => b.a1 === remId || b.a2 === remId)
                .map(b => b.a1 === remId ? b.a2 : b.a1)
                .filter(id => id !== prevSpineId && id !== activeCarbonChain.bottomCapId);
            const removeSet = new Set([remId, ...armIds]);
            doc.bonds = (doc.bonds || []).filter(b => !removeSet.has(b.a1) && !removeSet.has(b.a2));
            doc.atoms = (doc.atoms || []).filter(a => !removeSet.has(a.id));
            if (prevSpine && bottomCap) {
                bottomCap.y = prevSpine.y + BOND_LENGTH * 0.85;
                doc.bonds.push({ id: genId('b'), a1: prevSpine.id, a2: bottomCap.id, order: 1, color: penColor });
            }
            updateChainFloatingBarPos(); persistLibrary(); renderAll();
        }
        return;
    }

    const validIds = (activeCarbonChain.atomIds || []).filter(id => doc.atoms.some(a => a.id === id));
    activeCarbonChain.atomIds = validIds;
    if (validIds.length < 2) { clearActiveCarbonChain(); return; }

    if (delta > 0) {
        saveHistorySnapshot();
        const lastAtom = doc.atoms.find(a => a.id === validIds[validIds.length - 1]);
        const ang = getSmartHorizontalZigZagAngle(lastAtom, doc);
        const newA = {
            id: genId('a'),
            x: lastAtom.x + BOND_LENGTH * Math.cos(ang),
            y: lastAtom.y + BOND_LENGTH * Math.sin(ang),
            label: 'C',
            color: penColor
        };
        doc.atoms.push(newA);
        doc.bonds.push({ id: genId('b'), a1: lastAtom.id, a2: newA.id, order: 1, color: penColor });
        activeCarbonChain.atomIds.push(newA.id);
        window.lastActiveChemAtomId = newA.id;
        ensureAutoNextPageIfNeeded(newA.y);
        updateChainFloatingBarPos(); persistLibrary(); renderAll();
    } else if (delta < 0 && validIds.length > 2) {
        saveHistorySnapshot();
        const remId = activeCarbonChain.atomIds.pop();
        doc.bonds = (doc.bonds || []).filter(b => b.a1 !== remId && b.a2 !== remId);
        doc.atoms = (doc.atoms || []).filter(a => a.id !== remId);
        window.lastActiveChemAtomId = activeCarbonChain.atomIds[activeCarbonChain.atomIds.length - 1] || null;
        updateChainFloatingBarPos(); persistLibrary(); renderAll();
    }
}

function getConnectedAtomComponent(startAtomId) {
    const doc = getDocState();
    const visited = new Set([startAtomId]);
    const queue = [startAtomId];
    while (queue.length) {
        const cur = queue.shift();
        (doc.bonds || []).forEach(b => {
            if (b.a1 === cur && !visited.has(b.a2)) { visited.add(b.a2); queue.push(b.a2); }
            else if (b.a2 === cur && !visited.has(b.a1)) { visited.add(b.a1); queue.push(b.a1); }
        });
    }
    return Array.from(visited);
}

function getRingConfig(type) {
    const map = {
        cyclopropane: { n: 3, dbl: [], hetero: {} },
        epoxide: { n: 3, dbl: [], hetero: { 0: 'O' } },
        aziridine: { n: 3, dbl: [], hetero: { 0: 'NH' } },
        thiirane: { n: 3, dbl: [], hetero: { 0: 'S' } },
        cyclobutane: { n: 4, dbl: [], hetero: {} },
        oxetane: { n: 4, dbl: [], hetero: { 0: 'O' } },
        azetidine: { n: 4, dbl: [], hetero: { 0: 'NH' } },
        cyclopentane: { n: 5, dbl: [], hetero: {} },
        cyclopentadiene: { n: 5, dbl: [1, 3], hetero: {} },
        pyrrole: { n: 5, dbl: [1, 3], hetero: { 0: 'NH' } },
        furan: { n: 5, dbl: [1, 3], hetero: { 0: 'O' } },
        thiophene: { n: 5, dbl: [1, 3], hetero: { 0: 'S' } },
        pyrrolidine: { n: 5, dbl: [], hetero: { 0: 'NH' } },
        thf: { n: 5, dbl: [], hetero: { 0: 'O' } },
        imidazole: { n: 5, dbl: [1, 3], hetero: { 0: 'NH', 2: 'N' } },
        pyrazole: { n: 5, dbl: [1, 3], hetero: { 0: 'NH', 1: 'N' } },
        oxazole: { n: 5, dbl: [1, 3], hetero: { 0: 'O', 2: 'N' } },
        isoxazole: { n: 5, dbl: [1, 3], hetero: { 0: 'O', 1: 'N' } },
        thiazole: { n: 5, dbl: [1, 3], hetero: { 0: 'S', 2: 'N' } },
        triazole: { n: 5, dbl: [1, 3], hetero: { 0: 'NH', 1: 'N', 2: 'N' } },
        tetrazole: { n: 5, dbl: [1, 3], hetero: { 0: 'NH', 1: 'N', 2: 'N', 3: 'N' } },
        cyclohexane: { n: 6, dbl: [], hetero: {} },
        benzene: { n: 6, dbl: [0, 2, 4], hetero: {} },
        pyridine: { n: 6, dbl: [0, 2, 4], hetero: { 3: 'N' } },
        pyrimidine: { n: 6, dbl: [0, 2, 4], hetero: { 1: 'N', 3: 'N' } },
        pyrazine: { n: 6, dbl: [0, 2, 4], hetero: { 0: 'N', 3: 'N' } },
        pyridazine: { n: 6, dbl: [0, 2, 4], hetero: { 0: 'N', 1: 'N' } },
        triazine: { n: 6, dbl: [0, 2, 4], hetero: { 0: 'N', 2: 'N', 4: 'N' } },
        piperidine: { n: 6, dbl: [], hetero: { 3: 'NH' } },
        piperazine: { n: 6, dbl: [], hetero: { 0: 'NH', 3: 'NH' } },
        morpholine: { n: 6, dbl: [], hetero: { 0: 'O', 3: 'NH' } },
        tetrahydropyran: { n: 6, dbl: [], hetero: { 0: 'O' } },
        cycloheptane: { n: 7, dbl: [], hetero: {} },
        cyclooctane: { n: 8, dbl: [], hetero: {} },
        cyclononane: { n: 9, dbl: [], hetero: {} }
    };
    return map[type] || { n: 6, dbl: [], hetero: {} };
}

const POLYCYCLIC_RING_TYPES = new Set([
    'naphthalene', 'anthracene', 'phenanthrene',
    'indole', 'benzofuran', 'benzothiophene', 'benzimidazole',
    'quinoline', 'isoquinoline', 'purine'
]);

function stampRingAt(cx, cy, type) {
    const doc = getDocState();
    saveHistorySnapshot();
    const R = BOND_LENGTH;
    const cfg = getRingConfig(type);
    const n = cfg.n;
    const rad = R / (2 * Math.sin(Math.PI / n));
    const newAtoms = [], newBonds = [];
    const isPoly = POLYCYCLIC_RING_TYPES.has(type);

    const hitAtom = findNearestAtom(cx, cy, 20);
    const hitBond = !hitAtom ? findNearestBond(cx, cy, 18) : null;

    if (hitBond && !isPoly) {
        const a1 = doc.atoms.find(a => a.id === hitBond.a1);
        const a2 = doc.atoms.find(a => a.id === hitBond.a2);
        if (a1 && a2) {
            if (!canAddBondOrder(a1, 1, doc) || !canAddBondOrder(a2, 1, doc)) {
                undoStack.pop();
                showGestureToast('Nguyên tử trên liên kết đã đạt tối đa hóa trị!');
                return;
            }
            const mx = (a1.x + a2.x) / 2, my = (a1.y + a2.y) / 2;
            const dx = a2.x - a1.x, dy = a2.y - a1.y;
            const edgeLen = Math.hypot(dx, dy) || R;
            const apothem = edgeLen / (2 * Math.tan(Math.PI / n));
            const rPoly = edgeLen / (2 * Math.sin(Math.PI / n));
            let nx = -dy / edgeLen, ny = dx / edgeLen;

            const adjAtoms = (doc.bonds || [])
                .filter(b => b.id !== hitBond.id && (b.a1 === a1.id || b.a2 === a1.id || b.a1 === a2.id || b.a2 === a2.id))
                .map(b => doc.atoms.find(a => a.id === (b.a1 === a1.id || b.a1 === a2.id ? b.a2 : b.a1)))
                .filter(Boolean);

            if (adjAtoms.length > 0) {
                const avgX = adjAtoms.reduce((s, a) => s + a.x, 0) / adjAtoms.length;
                const avgY = adjAtoms.reduce((s, a) => s + a.y, 0) / adjAtoms.length;
                if ((avgX - mx) * nx + (avgY - my) * ny > 0) { nx = -nx; ny = -ny; }
            } else if ((cx - mx) * nx + (cy - my) * ny < 0) {
                nx = -nx; ny = -ny;
            }

            const ringCx = mx + nx * apothem;
            const ringCy = my + ny * apothem;
            const ang1 = Math.atan2(a1.y - ringCy, a1.x - ringCx);
            const ang2 = Math.atan2(a2.y - ringCy, a2.x - ringCx);
            let step = ang2 - ang1;
            while (step <= -Math.PI) step += 2 * Math.PI;
            while (step > Math.PI) step -= 2 * Math.PI;
            const dTheta = (step >= 0 ? 1 : -1) * (2 * Math.PI / n);

            const ringVerts = [a1, a2];
            for (let k = 2; k < n; k++) {
                const ang = ang1 + k * dTheta;
                const lbl = cfg.hetero[k] || 'C';
                const posX = ringCx + rPoly * Math.cos(ang);
                const posY = ringCy + rPoly * Math.sin(ang);
                const existing = findNearestAtom(posX, posY, 12);
                if (existing && !ringVerts.includes(existing)) {
                    ringVerts.push(existing);
                } else {
                    const na = { id: genId('a'), x: posX, y: posY, label: lbl, color: penColor };
                    doc.atoms.push(na); ringVerts.push(na); newAtoms.push(na);
                }
            }
            for (let k = 1; k < n; k++) {
                const v1 = ringVerts[k], v2 = ringVerts[(k + 1) % n];
                let order = cfg.dbl.includes(k) ? 2 : 1;
                if ((type === 'benzene' || type === 'pyridine') && hitBond.order === 2) {
                    order = (k % 2 === 0) ? 2 : 1;
                }
                if (order === 2 && (!canAddBondOrder(v1, 2, doc) || !canAddBondOrder(v2, 2, doc))) {
                    order = 1;
                }
                if (!canAddBondOrder(v1, order, doc) || !canAddBondOrder(v2, order, doc)) continue;
                const nb = { id: genId('b'), a1: v1.id, a2: v2.id, order, color: penColor };
                doc.bonds.push(nb); newBonds.push(nb);
            }
            enforceAllValenceAndHydrogens(doc);
            ensureAutoNextPageIfNeeded(cy + rad);
            showGestureToast('Đã ghép vòng chung cạnh!');
            persistLibrary(); renderAll(); return;
        }
    }

    if (hitAtom && !isPoly) {
        if (!canAddBondOrder(hitAtom, 2, doc)) {
            undoStack.pop();
            showGestureToast(`${hitAtom.label} đã đạt giới hạn hóa trị!`);
            return;
        }
        const neighbors = (doc.bonds || [])
            .filter(b => b.a1 === hitAtom.id || b.a2 === hitAtom.id)
            .map(b => doc.atoms.find(a => a.id === (b.a1 === hitAtom.id ? b.a2 : b.a1)))
            .filter(Boolean);
        let outAngle = -Math.PI / 2;
        if (neighbors.length) {
            const avgX = neighbors.reduce((s, a) => s + a.x, 0) / neighbors.length;
            const avgY = neighbors.reduce((s, a) => s + a.y, 0) / neighbors.length;
            outAngle = Math.atan2(hitAtom.y - avgY, hitAtom.x - avgX);
        }
        const ringCx = hitAtom.x + rad * Math.cos(outAngle);
        const ringCy = hitAtom.y + rad * Math.sin(outAngle);
        const startAng = Math.atan2(hitAtom.y - ringCy, hitAtom.x - ringCx);
        const ringVerts = [hitAtom];
        for (let i = 1; i < n; i++) {
            const ang = startAng + (i * 2 * Math.PI) / n;
            const lbl = cfg.hetero[i] || 'C';
            const a = { id: genId('a'), x: ringCx + rad * Math.cos(ang), y: ringCy + rad * Math.sin(ang), label: lbl, color: penColor };
            doc.atoms.push(a); ringVerts.push(a); newAtoms.push(a);
        }
        for (let i = 0; i < n; i++) {
            const v1 = ringVerts[i], v2 = ringVerts[(i + 1) % n];
            let order = cfg.dbl.includes(i) ? 2 : 1;
            if (order === 2 && (!canAddBondOrder(v1, 2, doc) || !canAddBondOrder(v2, 2, doc))) order = 1;
            const b = { id: genId('b'), a1: v1.id, a2: v2.id, order, color: penColor };
            doc.bonds.push(b); newBonds.push(b);
        }
        enforceAllValenceAndHydrogens(doc);
        ensureAutoNextPageIfNeeded(ringCy + rad);
        persistLibrary(); renderAll(); return;
    }

    if (isPoly) {
        const r6 = R / (2 * Math.sin(Math.PI / 6));
        const dCenter = r6 * Math.cos(Math.PI / 6);

        const buildHexRing = (rcx, rcy, reuseMap = {}, dblIdx = [], heteroMap = {}) => {
            const verts = [];
            for (let i = 0; i < 6; i++) {
                if (reuseMap[i]) { verts.push(reuseMap[i]); continue; }
                const ang = -Math.PI / 2 + i * (Math.PI / 3);
                const a = {
                    id: genId('a'),
                    x: rcx + r6 * Math.cos(ang),
                    y: rcy + r6 * Math.sin(ang),
                    label: heteroMap[i] || 'C',
                    color: penColor
                };
                doc.atoms.push(a); verts.push(a); newAtoms.push(a);
            }
            for (let i = 0; i < 6; i++) {
                const a1 = verts[i], a2 = verts[(i + 1) % 6];
                if (reuseMap[i] && reuseMap[(i + 1) % 6]) continue;
                const b = { id: genId('b'), a1: a1.id, a2: a2.id, order: dblIdx.includes(i) ? 2 : 1, color: penColor };
                doc.bonds.push(b); newBonds.push(b);
            }
            return verts;
        };

        const attachFused5Ring = (a1, a2, hetero5 = {}, dbl5 = [3]) => {
            const mx = (a1.x + a2.x) / 2, my = (a1.y + a2.y) / 2;
            const edgeLen = Math.hypot(a2.x - a1.x, a2.y - a1.y) || R;
            const ap5 = edgeLen / (2 * Math.tan(Math.PI / 5));
            const r5 = edgeLen / (2 * Math.sin(Math.PI / 5));
            const rCx = mx + ap5, rCy = my;
            const ang1 = Math.atan2(a1.y - rCy, a1.x - rCx);
            const v5 = [a1, a2];
            for (let k = 2; k < 5; k++) {
                const ang = ang1 - k * (2 * Math.PI / 5);
                const na = { id: genId('a'), x: rCx + r5 * Math.cos(ang), y: rCy + r5 * Math.sin(ang), label: hetero5[k] || 'C', color: penColor };
                doc.atoms.push(na); v5.push(na); newAtoms.push(na);
            }
            for (let k = 1; k < 5; k++) {
                const b = { id: genId('b'), a1: v5[k].id, a2: v5[(k + 1) % 5].id, order: dbl5.includes(k) ? 2 : 1, color: penColor };
                doc.bonds.push(b); newBonds.push(b);
            }
        };

        if (type === 'naphthalene' || type === 'quinoline' || type === 'isoquinoline') {
            const leftA = buildHexRing(cx - dCenter, cy, {}, [1, 3, 5]);
            const rightHetero = type === 'quinoline' ? { 3: 'N' } : (type === 'isoquinoline' ? { 2: 'N' } : {});
            buildHexRing(cx + dCenter, cy, { 4: leftA[2], 5: leftA[1] }, [0, 2], rightHetero);
        } else if (type === 'anthracene') {
            const r1 = buildHexRing(cx - 2 * dCenter, cy, {}, [1, 3, 5]);
            const r2 = buildHexRing(cx, cy, { 4: r1[2], 5: r1[1] }, [0, 2]);
            buildHexRing(cx + 2 * dCenter, cy, { 4: r2[2], 5: r2[1] }, [0, 2]);
        } else if (type === 'phenanthrene') {
            const r1 = buildHexRing(cx - dCenter, cy + 0.75 * r6, {}, [1, 3, 5]);
            const r2 = buildHexRing(cx + dCenter, cy + 0.75 * r6, { 4: r1[2], 5: r1[1] }, [0, 2]);
            buildHexRing(cx + 2 * dCenter, cy - 0.75 * r6, { 3: r2[1], 4: r2[0] }, [1, 5]);
        } else {
            const leftHetero = type === 'purine' ? { 3: 'N', 5: 'N' } : {};
            const leftA = buildHexRing(cx - dCenter, cy, {}, [1, 3, 5], leftHetero);
            const fiveHeteroMap = {
                indole: { 2: 'NH' },
                benzofuran: { 2: 'O' },
                benzothiophene: { 2: 'S' },
                benzimidazole: { 2: 'NH', 4: 'N' },
                purine: { 2: 'NH', 4: 'N' }
            };
            attachFused5Ring(leftA[1], leftA[2], fiveHeteroMap[type] || { 2: 'NH' }, [3]);
        }
    } else {
        for (let i = 0; i < n; i++) {
            const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
            const lbl = cfg.hetero[i] || 'C';
            const a = { id: genId('a'), x: cx + rad * Math.cos(ang), y: cy + rad * Math.sin(ang), label: lbl, color: penColor };
            doc.atoms.push(a); newAtoms.push(a);
        }
        for (let i = 0; i < n; i++) {
            const order = cfg.dbl.includes(i) ? 2 : 1;
            const b = { id: genId('b'), a1: newAtoms[i].id, a2: newAtoms[(i + 1) % n].id, order, color: penColor };
            doc.bonds.push(b); newBonds.push(b);
        }
    }
    enforceAllValenceAndHydrogens(doc);
    ensureAutoNextPageIfNeeded(cy + rad);
    activateRingGizmoFor(newAtoms, newBonds);
    persistLibrary(); renderAll();
}

function stampConformerAt(cx, cy, type) {
    const doc = getDocState();
    saveHistorySnapshot();
    const L = BOND_LENGTH;
    const createdAtoms = [], createdBonds = [];

    const addPt = (dx, dy, lbl = 'C') => {
        const a = { id: genId('a'), x: cx + dx, y: cy + dy, label: lbl, color: penColor };
        doc.atoms.push(a); createdAtoms.push(a); return a;
    };
    const linkPts = (p1, p2, order = 1) => {
        const b = { id: genId('b'), a1: p1.id, a2: p2.id, order, color: penColor };
        doc.bonds.push(b); createdBonds.push(b);
    };

    if (type === 'chair_left' || type === 'chair_right') {
        const s = L / 44;
        const pts = type === 'chair_left'
            ? [[-55, 18], [-29, -16], [13, -5], [55, -18], [29, 16], [-13, 5]]
            : [[-55, -18], [-13, -5], [29, -16], [55, 18], [13, 5], [-29, 16]];
        const ringAtoms = pts.map(([dx, dy]) => addPt(dx * s, dy * s));
        ringAtoms.forEach((p, i, arr) => linkPts(p, arr[(i + 1) % 6]));
    } else if (type === 'boat_conf') {
        const s = L / 44;
        const p1 = addPt(-56 * s, -14 * s), p2 = addPt(-16 * s, -2 * s), p3 = addPt(16 * s, -2 * s);
        const p4 = addPt(56 * s, -14 * s), p5 = addPt(34 * s, 20 * s), p6 = addPt(-34 * s, 20 * s);
        [p1,p2,p3,p4,p5,p6].forEach((p, i, arr) => linkPts(p, arr[(i+1)%6]));
    } else if (type === 'sawhorse_stag' || type === 'sawhorse_eclip') {
        const c1 = addPt(-26, 16), c2 = addPt(26, -16);
        linkPts(c1, c2);
        linkPts(c1, addPt(-26, -24)); linkPts(c1, addPt(-58, 34)); linkPts(c1, addPt(6, 34));
        if (type === 'sawhorse_stag') {
            linkPts(c2, addPt(26, 24)); linkPts(c2, addPt(-6, -34)); linkPts(c2, addPt(58, -34));
        } else {
            linkPts(c2, addPt(26, -56)); linkPts(c2, addPt(-6, 2)); linkPts(c2, addPt(58, 2));
        }
    } else if (type === 'newman_stag' || type === 'newman_eclip') {
        if (!doc.chemSymbols) doc.chemSymbols = [];
        const R_out = 40;
        const backShift = type === 'newman_stag' ? Math.PI / 3 : 0.24;
        const frontAtomIds = [];
        const backAtomIds = [];
        for (let k = 0; k < 3; k++) {
            const aF = -Math.PI / 2 + k * (2 * Math.PI / 3);
            const fA = addPt(R_out * Math.cos(aF), R_out * Math.sin(aF));
            frontAtomIds.push(fA.id);
            const aB = -Math.PI / 2 + backShift + k * (2 * Math.PI / 3);
            const bA = addPt(R_out * Math.cos(aB), R_out * Math.sin(aB));
            backAtomIds.push(bA.id);
        }
        doc.chemSymbols.push({
            id: genId('sym'), x: cx, y: cy, type, angle: 0,
            backRotation: 0, frontAtomIds, backAtomIds, color: penColor
        });
    } else if (type.startsWith('fischer_')) {
        const numChiral = parseInt(type.split('_')[1] || '1', 10);
        const stepY = L * 0.78;
        const startY = -((numChiral - 1) * stepY) / 2;
        const topCap = addPt(0, startY - L * 0.85, 'CHO');
        const spineIds = [];
        let prevSpine = topCap;
        for (let i = 0; i < numChiral; i++) {
            const y = startY + i * stepY;
            const sp = addPt(0, y, 'C');
            spineIds.push(sp.id);
            linkPts(prevSpine, sp);
            linkPts(sp, addPt(-L * 0.85, y, i % 2 === 0 ? 'H' : 'OH'));
            linkPts(sp, addPt(L * 0.85, y, i % 2 === 0 ? 'OH' : 'H'));
            prevSpine = sp;
        }
        const bottomCap = addPt(0, startY + (numChiral - 1) * stepY + L * 0.85, 'CH2OH');
        linkPts(prevSpine, bottomCap);
        activeCarbonChain = {
            active: true, mode: 'fischer',
            atomIds: createdAtoms.map(a => a.id), fischerSpines: spineIds,
            topCapId: topCap.id, bottomCapId: bottomCap.id
        };
        updateChainFloatingBarPos();
    }

    if (createdBonds.length && !type.startsWith('fischer_')) {
        activateRingGizmoFor(createdAtoms, createdBonds);
        if (type === 'chair_left' || type === 'chair_right') {
            activeRingGizmo.ringAtomIds = createdAtoms.map(a => a.id);
            activeRingGizmo.chairType = type;
            updateRingTransformFloatingBarPos();
        }
    }
    persistLibrary(); renderAll();
}

function activateRingGizmoFor(atoms, bonds) {
    if (!atoms.length) return;
    const doc = getDocState();
    const cx = atoms.reduce((s, a) => s + a.x, 0) / atoms.length;
    const cy = atoms.reduce((s, a) => s + a.y, 0) / atoms.length;
    const maxR = Math.max(28, ...atoms.map(a => Math.hypot(a.x - cx, a.y - cy)));
    const attachedOrbitals = (doc.orbitals || []).filter(ob => atoms.some(a => Math.hypot(ob.x - a.x, ob.y - a.y) < 16));
    activeRingGizmo = {
        active: true,
        atomIds: atoms.map(a => a.id),
        bondIds: bonds.map(b => b.id),
        orbitalIds: attachedOrbitals.map(ob => ob.id),
        ringAtomIds: [],
        chairType: null,
        cx, cy, radius: maxR + 12,
        dragMode: null, dragStartMouse: null, dragStartAngle: 0, dragStartRadius: maxR + 12,
        initialAtomOffsets: atoms.map(a => ({ id: a.id, dx: a.x - cx, dy: a.y - cy })),
        initialOrbitalOffsets: attachedOrbitals.map(ob => ({ id: ob.id, dx: ob.x - cx, dy: ob.y - cy, angle: ob.angle || 0, scale: ob.scale || 36 }))
    };
    updateRingTransformFloatingBarPos();
}

function updateRingTransformFloatingBarPos() {
    const bar = document.getElementById('ringTransformFloatingBar');
    if (!bar || !activeRingGizmo.active) { bar?.classList.add('hidden'); return; }
    const isChair = !!(activeRingGizmo.chairType && activeRingGizmo.ringAtomIds && activeRingGizmo.ringAtomIds.length === 6);
    document.getElementById('btnChairFlip')?.classList.toggle('hidden', !isChair);
    document.getElementById('btnChairAxEq')?.classList.toggle('hidden', !isChair);
    const pageY = getPageYOffset(getActiveNotebook().activePageIndex || 0);
    const sx = panX + activeRingGizmo.cx * zoom;
    const sy = panY + (pageY + activeRingGizmo.cy - activeRingGizmo.radius) * zoom - 42;
    bar.style.left = `${Math.max(110, Math.min(cssWidth - 110, sx))}px`;
    bar.style.top = `${Math.max(8, Math.min(cssHeight - 50, sy))}px`;
    bar.classList.remove('hidden');
}

function getChairAxesAndVectors(ringAtoms) {
    const cx = ringAtoms.reduce((s, a) => s + a.x, 0) / ringAtoms.length;
    const cy = ringAtoms.reduce((s, a) => s + a.y, 0) / ringAtoms.length;
    const spanX = ringAtoms[3].x - ringAtoms[0].x;
    const spanY = ringAtoms[3].y - ringAtoms[0].y;
    const spanLen = Math.hypot(spanX, spanY) || 1;
    const midX = ringAtoms[2].x - ringAtoms[1].x;
    const midY = ringAtoms[2].y - ringAtoms[1].y;
    const midLen = Math.hypot(midX, midY) || 1;
    let ux = spanX / spanLen + midX / midLen;
    let uy = spanY / spanLen + midY / midLen;
    const uLen = Math.hypot(ux, uy) || 1;
    ux /= uLen; uy /= uLen;
    if (ux < 0) { ux = -ux; uy = -uy; }
    let nx = -uy, ny = ux;
    if (ny < 0) { nx = -nx; ny = -ny; }
    return { cx, cy, u: { x: ux, y: uy }, n: { x: nx, y: ny } };
}

function getSubtreeExcludingRing(startId, ringIdSet, doc) {
    const visited = new Set();
    const queue = [startId];
    visited.add(startId);
    while (queue.length) {
        const cur = queue.shift();
        (doc.bonds || []).forEach(b => {
            const nxt = b.a1 === cur ? b.a2 : (b.a2 === cur ? b.a1 : null);
            if (nxt && !ringIdSet.has(nxt) && !visited.has(nxt)) {
                visited.add(nxt);
                queue.push(nxt);
            }
        });
    }
    return Array.from(visited);
}

function flipActiveChairConformer() {
    if (!activeRingGizmo.active || !activeRingGizmo.chairType || (activeRingGizmo.ringAtomIds || []).length !== 6) return;
    const doc = getDocState();
    const ringAtoms = activeRingGizmo.ringAtomIds.map(id => doc.atoms.find(a => a.id === id)).filter(Boolean);
    if (ringAtoms.length !== 6) return;

    saveHistorySnapshot();
    const { cx, cy, u, n } = getChairAxesAndVectors(ringAtoms);
    const ringIdSet = new Set(activeRingGizmo.ringAtomIds);

    let avgEdge = 0;
    for (let i = 0; i < 6; i++) {
        const p = ringAtoms[i], nxt = ringAtoms[(i + 1) % 6];
        avgEdge += Math.hypot(nxt.x - p.x, nxt.y - p.y);
    }
    avgEdge = (avgEdge / 6) || BOND_LENGTH;

    const oldMeta = ringAtoms.map((p, i) => {
        const prev = ringAtoms[(i + 5) % 6], next = ringAtoms[(i + 1) % 6];
        const midX = (prev.x + next.x) / 2, midY = (prev.y + next.y) / 2;
        const dDot = (p.x - midX) * n.x + (p.y - midY) * n.y;
        const axSign = dDot >= 0 ? 1 : -1;
        const eq1x = ringAtoms[(i + 2) % 6].x - ringAtoms[(i + 1) % 6].x;
        const eq1y = ringAtoms[(i + 2) % 6].y - ringAtoms[(i + 1) % 6].y;
        const eq2x = ringAtoms[(i + 4) % 6].x - ringAtoms[(i + 5) % 6].x;
        const eq2y = ringAtoms[(i + 4) % 6].y - ringAtoms[(i + 5) % 6].y;
        let ex = eq1x + eq2x, ey = eq1y + eq2y;
        const outX = p.x - cx, outY = p.y - cy;
        if (ex * outX + ey * outY < 0) { ex = -ex; ey = -ey; }
        const eLen = Math.hypot(ex, ey) || 1;
        return { oldX: p.x, oldY: p.y, axSign, oldEq: { x: ex / eLen, y: ey / eLen } };
    });

    const shiftPerVertex = ringAtoms.map(p => {
        const dx = p.x - cx, dy = p.y - cy;
        const projU = dx * u.x + dy * u.y;
        const perpN = dx * n.x + dy * n.y;
        const newX = cx + projU * u.x - perpN * n.x;
        const newY = cy + projU * u.y - perpN * n.y;
        const shiftX = newX - p.x, shiftY = newY - p.y;
        p.x = newX; p.y = newY;
        return { shiftX, shiftY };
    });

    ringAtoms.forEach((p, i) => {
        const prev = ringAtoms[(i + 5) % 6], next = ringAtoms[(i + 1) % 6];
        const midX = (prev.x + next.x) / 2, midY = (prev.y + next.y) / 2;
        const newAxSign = ((p.x - midX) * n.x + (p.y - midY) * n.y) >= 0 ? 1 : -1;
        const newAxVec = { x: n.x * newAxSign, y: n.y * newAxSign };

        const eq1x = ringAtoms[(i + 2) % 6].x - ringAtoms[(i + 1) % 6].x;
        const eq1y = ringAtoms[(i + 2) % 6].y - ringAtoms[(i + 1) % 6].y;
        const eq2x = ringAtoms[(i + 4) % 6].x - ringAtoms[(i + 5) % 6].x;
        const eq2y = ringAtoms[(i + 4) % 6].y - ringAtoms[(i + 5) % 6].y;
        let ex = eq1x + eq2x, ey = eq1y + eq2y;
        const outX = p.x - cx, outY = p.y - cy;
        if (ex * outX + ey * outY < 0) { ex = -ex; ey = -ey; }
        const eLen = Math.hypot(ex, ey) || 1;
        const newEqVec = { x: ex / eLen, y: ey / eLen };

        const { oldX, oldY, axSign: oldAxSign, oldEq } = oldMeta[i];
        const { shiftX, shiftY } = shiftPerVertex[i];
        const directNbrs = (doc.bonds || [])
            .map(b => b.a1 === p.id ? b.a2 : (b.a2 === p.id ? b.a1 : null))
            .filter(nid => nid && !ringIdSet.has(nid));

        directNbrs.forEach(nid => {
            const subIds = getSubtreeExcludingRing(nid, ringIdSet, doc);
            const child = doc.atoms.find(a => a.id === nid);
            if (!child) return;
            const vx = child.x - oldX, vy = child.y - oldY;
            const bLen = Math.hypot(vx, vy) || 1;
            const uxv = vx / bLen, uyv = vy / bLen;
            const dotOldAx = uxv * (n.x * oldAxSign) + uyv * (n.y * oldAxSign);
            const dotOldEq = uxv * oldEq.x + uyv * oldEq.y;

            let targetDir = null;
            if (dotOldAx > 0.75) targetDir = newEqVec;
            else if (dotOldEq > 0.72) targetDir = newAxVec;

            if (targetDir) {
                const targetX = p.x + targetDir.x * bLen;
                const targetY = p.y + targetDir.y * bLen;
                const dChildX = targetX - child.x, dChildY = targetY - child.y;
                subIds.forEach(sid => {
                    const sa = doc.atoms.find(x => x.id === sid);
                    if (sa) { sa.x += dChildX; sa.y += dChildY; }
                });
            } else {
                subIds.forEach(sid => {
                    const sa = doc.atoms.find(x => x.id === sid);
                    if (sa) { sa.x += shiftX; sa.y += shiftY; }
                });
            }
        });
    });

    activeRingGizmo.chairType = activeRingGizmo.chairType === 'chair_left' ? 'chair_right' : 'chair_left';
    updateRingTransformFloatingBarPos();
    persistLibrary(); renderAll();
    showGestureToast('Đã lật vòng ghế ⇄');
}

function addAxialEquatorialToActiveChair() {
    if (!activeRingGizmo.active || !activeRingGizmo.chairType || (activeRingGizmo.ringAtomIds || []).length !== 6) return;
    const doc = getDocState();
    const ringAtoms = activeRingGizmo.ringAtomIds.map(id => doc.atoms.find(a => a.id === id)).filter(Boolean);
    if (ringAtoms.length !== 6) return;

    saveHistorySnapshot();
    const { cx, cy, n } = getChairAxesAndVectors(ringAtoms);
    const ringIdSet = new Set(activeRingGizmo.ringAtomIds);
    const aLen = BOND_LENGTH * 0.78;
    let addedCount = 0;

    ringAtoms.forEach((p, i) => {
        const prev = ringAtoms[(i + 5) % 6], next = ringAtoms[(i + 1) % 6];
        const midX = (prev.x + next.x) / 2, midY = (prev.y + next.y) / 2;
        const axSign = ((p.x - midX) * n.x + (p.y - midY) * n.y) >= 0 ? 1 : -1;
        const axDir = { x: n.x * axSign, y: n.y * axSign };

        const eq1x = ringAtoms[(i + 2) % 6].x - ringAtoms[(i + 1) % 6].x;
        const eq1y = ringAtoms[(i + 2) % 6].y - ringAtoms[(i + 1) % 6].y;
        const eq2x = ringAtoms[(i + 4) % 6].x - ringAtoms[(i + 5) % 6].x;
        const eq2y = ringAtoms[(i + 4) % 6].y - ringAtoms[(i + 5) % 6].y;
        let ex = eq1x + eq2x, ey = eq1y + eq2y;
        const outX = p.x - cx, outY = p.y - cy;
        if (ex * outX + ey * outY < 0) { ex = -ex; ey = -ey; }
        const eLen = Math.hypot(ex, ey) || 1;
        const eqDir = { x: ex / eLen, y: ey / eLen };

        const existingDirs = (doc.bonds || [])
            .map(b => b.a1 === p.id ? doc.atoms.find(a => a.id === b.a2) : (b.a2 === p.id ? doc.atoms.find(a => a.id === b.a1) : null))
            .filter(nb => nb && !ringIdSet.has(nb.id))
            .map(nb => {
                const dx = nb.x - p.x, dy = nb.y - p.y;
                const d = Math.hypot(dx, dy) || 1;
                return { x: dx / d, y: dy / d };
            });

        [axDir, eqDir].forEach(dir => {
            if (!canAddBondOrder(p, 1, doc)) return;
            const hasSimilar = existingDirs.some(ed => ed.x * dir.x + ed.y * dir.y > 0.72);
            if (hasSimilar) return;
            const ha = { id: genId('a'), x: p.x + dir.x * aLen, y: p.y + dir.y * aLen, label: 'H', color: penColor };
            const hb = { id: genId('b'), a1: p.id, a2: ha.id, order: 1, stereo: null, color: penColor };
            doc.atoms.push(ha);
            doc.bonds.push(hb);
            activeRingGizmo.atomIds.push(ha.id);
            activeRingGizmo.bondIds.push(hb.id);
            existingDirs.push(dir);
            addedCount++;
        });
    });

    if (addedCount > 0) {
        enforceAllValenceAndHydrogens(doc);
        const curAtoms = activeRingGizmo.atomIds.map(id => doc.atoms.find(a => a.id === id)).filter(Boolean);
        activeRingGizmo.cx = curAtoms.reduce((s, a) => s + a.x, 0) / curAtoms.length;
        activeRingGizmo.cy = curAtoms.reduce((s, a) => s + a.y, 0) / curAtoms.length;
        activeRingGizmo.radius = Math.max(28, ...curAtoms.map(a => Math.hypot(a.x - activeRingGizmo.cx, a.y - activeRingGizmo.cy))) + 12;
        updateRingTransformFloatingBarPos();
        persistLibrary(); renderAll();
        showGestureToast(`Đã thêm ${addedCount} liên kết Axial / Equatorial`);
    } else {
        showGestureToast('Vòng ghế đã đủ các liên kết Axial & Equatorial');
    }
}

function clearActiveRingGizmo(render = true) {
    activeRingGizmo.active = false;
    document.getElementById('ringTransformFloatingBar')?.classList.add('hidden');
    if (render && typeof renderAll === 'function') renderAll();
}

function rotateActiveRingBy(deg) {
    if (!activeRingGizmo.active) return;
    saveHistorySnapshot();
    const rad = (deg * Math.PI) / 180;
    const doc = getDocState();
    const cos = Math.cos(rad), sin = Math.sin(rad);
    activeRingGizmo.atomIds.forEach(id => {
        const a = doc.atoms.find(x => x.id === id);
        if (!a) return;
        const dx = a.x - activeRingGizmo.cx, dy = a.y - activeRingGizmo.cy;
        a.x = activeRingGizmo.cx + dx * cos - dy * sin;
        a.y = activeRingGizmo.cy + dx * sin + dy * cos;
    });
    (activeRingGizmo.orbitalIds || []).forEach(id => {
        const ob = (doc.orbitals || []).find(x => x.id === id);
        if (!ob) return;
        const dx = ob.x - activeRingGizmo.cx, dy = ob.y - activeRingGizmo.cy;
        ob.x = activeRingGizmo.cx + dx * cos - dy * sin;
        ob.y = activeRingGizmo.cy + dx * sin + dy * cos;
        ob.angle = (ob.angle || 0) + rad;
    });
    persistLibrary(); renderAll();
}

function scaleActiveRingBy(factor) {
    if (!activeRingGizmo.active) return;
    saveHistorySnapshot();
    const doc = getDocState();
    activeRingGizmo.atomIds.forEach(id => {
        const a = doc.atoms.find(x => x.id === id);
        if (!a) return;
        a.x = activeRingGizmo.cx + (a.x - activeRingGizmo.cx) * factor;
        a.y = activeRingGizmo.cy + (a.y - activeRingGizmo.cy) * factor;
    });
    (activeRingGizmo.orbitalIds || []).forEach(id => {
        const ob = (doc.orbitals || []).find(x => x.id === id);
        if (!ob) return;
        ob.x = activeRingGizmo.cx + (ob.x - activeRingGizmo.cx) * factor;
        ob.y = activeRingGizmo.cy + (ob.y - activeRingGizmo.cy) * factor;
        ob.scale = Math.max(14, Math.min(140, (ob.scale || 36) * factor));
    });
    activeRingGizmo.radius = Math.max(24, activeRingGizmo.radius * factor);
    updateRingTransformFloatingBarPos();
    persistLibrary(); renderAll();
}

function deleteActiveRing() {
    if (!activeRingGizmo.active) return;
    saveHistorySnapshot();
    const doc = getDocState();
    const aSet = new Set(activeRingGizmo.atomIds);
    const obSet = new Set(activeRingGizmo.orbitalIds || []);
    doc.bonds = (doc.bonds || []).filter(b => !aSet.has(b.a1) && !aSet.has(b.a2));
    doc.atoms = (doc.atoms || []).filter(a => !aSet.has(a.id));
    if (obSet.size) doc.orbitals = (doc.orbitals || []).filter(ob => !obSet.has(ob.id));
    enforceAllValenceAndHydrogens(doc);
    clearActiveRingGizmo(true); persistLibrary();
}

/* LASSO */
function isPointInPolygon(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
            (pt.x < ((xj - xi) * (pt.y - yi)) / ((yj - yi) || 1e-9) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function isSelectedInLasso(pt, poly, margin = 0) {
    if (!poly || poly.length < 3 || !pt) return false;
    if (isPointInPolygon(pt, poly)) return true;
    if (margin > 0) {
        return poly.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) <= margin);
    }
    return false;
}

function isStrokeInsideLassoPolygon(st, poly) {
    const pts = (st && st.points) || [];
    if (!pts.length || !poly || poly.length < 3) return false;
    if (pts.length === 1) return isPointInPolygon(pts[0], poly);
    let totalSamples = 0;
    let insideSamples = 0;
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(1, Math.min(24, Math.ceil(segLen / 6)));
        for (let k = (i === 1 ? 0 : 1); k <= steps; k++) {
            const t = k / steps;
            const sx = a.x + (b.x - a.x) * t;
            const sy = a.y + (b.y - a.y) * t;
            totalSamples++;
            if (isPointInPolygon({ x: sx, y: sy }, poly)) insideSamples++;
        }
    }
    return insideSamples >= 1 && (insideSamples / Math.max(1, totalSamples)) >= 0.55;
}

function recomputeLassoBounds() {
    const poly = lassoSelection.polygon || [];
    if (!poly.length) { lassoSelection.bounds = null; return; }
    const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
    lassoSelection.bounds = {
        minX: Math.min(...xs) - 10,
        maxX: Math.max(...xs) + 10,
        minY: Math.min(...ys) - 10,
        maxY: Math.max(...ys) + 10
    };
}

const ATOMIC_WEIGHTS_MAP = {
    H: 1.008, C: 12.011, N: 14.007, O: 15.999, F: 18.998,
    P: 30.974, S: 32.06, Cl: 35.45, Br: 79.904, I: 126.904,
    B: 10.81, Si: 28.085, Na: 22.990, K: 39.098, Li: 6.94, Mg: 24.305
};

const FORMULA_ALIAS_EXPANSIONS = {
    tBu: { C: 4, H: 9 },
    iPr: { C: 3, H: 7 },
    Boc: { C: 5, H: 9, O: 2 },
    Me: { C: 1, H: 3 },
    Et: { C: 2, H: 5 },
    Pr: { C: 3, H: 7 },
    Bu: { C: 4, H: 9 },
    Ac: { C: 2, H: 3, O: 1 },
    Ph: { C: 6, H: 5 },
    Bn: { C: 7, H: 7 },
    Bz: { C: 7, H: 5, O: 1 },
    Ts: { C: 7, H: 7, O: 2, S: 1 },
    Tf: { C: 1, F: 3, O: 2, S: 1 }
};

function parseAtomLabelComposition(rawLabel) {
    const clean = String(rawLabel || 'C').replace(/[+\-−·•\s]/g, '');
    const counts = {};
    if (!clean) return counts;
    const tokenRe = /(tBu|iPr|Boc|Me|Et|Pr|Bu|Ac|Ph|Bn|Bz|Ts|Tf|Cl|Br|Si|Na|Mg|Li|C|H|N|O|S|P|F|I|B|K)(\d*)/g;
    let m;
    while ((m = tokenRe.exec(clean)) !== null) {
        const tok = m[1];
        const mul = m[2] ? parseInt(m[2], 10) : 1;
        if (FORMULA_ALIAS_EXPANSIONS[tok]) {
            Object.entries(FORMULA_ALIAS_EXPANSIONS[tok]).forEach(([el, k]) => {
                counts[el] = (counts[el] || 0) + k * mul;
            });
        } else {
            counts[tok] = (counts[tok] || 0) + mul;
        }
    }
    return counts;
}

function computeLassoFormulaAndMass() {
    const badge = document.getElementById('lassoFormulaBadge');
    if (!badge) return null;
    if (!lassoSelection.active || !lassoSelection.selectedAtomIds.length) {
        badge.classList.add('hidden');
        badge.innerHTML = '';
        delete badge.dataset.copyText;
        return null;
    }
    const doc = getDocState();
    const selSet = new Set(lassoSelection.selectedAtomIds);
    const totalCounts = {};
    const addComp = (el, n) => {
        if (!n) return;
        totalCounts[el] = (totalCounts[el] || 0) + n;
    };
    const bareBackboneMaxVal = { C: 4, N: 3, O: 2, S: 2, P: 3, B: 3, Si: 4 };

    (doc.atoms || []).forEach(a => {
        if (!selSet.has(a.id)) return;
        const lbl = (a.label || 'C').trim();
        const comp = parseAtomLabelComposition(lbl);
        Object.entries(comp).forEach(([el, n]) => addComp(el, n));
        if (bareBackboneMaxVal[lbl] !== undefined) {
            const bSum = getAtomBondOrderSum(a.id, doc);
            const implH = Math.max(0, bareBackboneMaxVal[lbl] - bSum);
            addComp('H', implH);
        }
    });

    const elementsOrder = [];
    if (totalCounts.C) {
        elementsOrder.push('C');
        if (totalCounts.H) elementsOrder.push('H');
    } else if (totalCounts.H) {
        elementsOrder.push('H');
    }
    Object.keys(totalCounts)
        .filter(el => el !== 'C' && el !== 'H' && totalCounts[el] > 0)
        .sort()
        .forEach(el => elementsOrder.push(el));

    if (!elementsOrder.length) {
        badge.classList.add('hidden');
        return null;
    }

    let mw = 0;
    elementsOrder.forEach(el => {
        mw += (ATOMIC_WEIGHTS_MAP[el] || 0) * totalCounts[el];
    });

    const cCnt = (totalCounts.C || 0) + (totalCounts.Si || 0);
    const hCnt = totalCounts.H || 0;
    const nCnt = (totalCounts.N || 0) + (totalCounts.P || 0);
    const xCnt = (totalCounts.F || 0) + (totalCounts.Cl || 0) + (totalCounts.Br || 0) + (totalCounts.I || 0);
    const dbeRaw = (2 * cCnt + 2 + nCnt - hCnt - xCnt) / 2;
    const dbeRounded = Math.round(dbeRaw * 2) / 2;
    const dbeStr = Number.isInteger(dbeRounded) ? String(dbeRounded) : dbeRounded.toFixed(1);

    const htmlFormula = elementsOrder.map(el => totalCounts[el] > 1 ? `${el}<sub>${totalCounts[el]}</sub>` : el).join('');
    const plainFormula = elementsOrder.map(el => totalCounts[el] > 1 ? `${el}${totalCounts[el]}` : el).join('');
    const mwStr = mw.toFixed(2);

    badge.innerHTML = `${htmlFormula} <span class="opacity-60">•</span> M=${mwStr} <span class="opacity-60">•</span> Δ=${dbeStr}`;
    badge.dataset.copyText = `${plainFormula} | M = ${mwStr} g/mol | DBE (Δ) = ${dbeStr}`;
    badge.classList.remove('hidden');
    return { plainFormula, mw: mwStr, dbe: dbeStr, counts: totalCounts };
}

function copyLassoFormulaInfo() {
    const badge = document.getElementById('lassoFormulaBadge');
    const txt = badge?.dataset?.copyText || badge?.textContent?.trim();
    if (!txt) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => {
            showGestureToast('Đã chép: ' + txt);
        }).catch(() => {
            showGestureToast(txt);
        });
    } else {
        showGestureToast(txt);
    }
}

function getLassoTightSelectionBox(doc) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const expand = (x, y, px = 14, py = 14) => {
        if (x - px < minX) minX = x - px;
        if (x + px > maxX) maxX = x + px;
        if (y - py < minY) minY = y - py;
        if (y + py > maxY) maxY = y + py;
    };
    const aSet = new Set(lassoSelection.selectedAtomIds);
    const obSet = new Set(lassoSelection.selectedOrbitalIds);
    const smSet = new Set(lassoSelection.selectedSymbolIds);
    const txSet = new Set(lassoSelection.selectedTextIds);
    const arSet = new Set(lassoSelection.selectedArrowIds);
    const maSet = new Set(lassoSelection.selectedMechArrowIds);
    (doc.atoms || []).forEach(a => { if (aSet.has(a.id)) expand(a.x, a.y, a.label && a.label !== 'C' ? 18 : 12, 14); });
    (doc.orbitals || []).forEach(ob => { if (obSet.has(ob.id)) { const r = (ob.scale || 36) * 0.75; expand(ob.x, ob.y, r, r); } });
    (doc.chemSymbols || []).forEach(sm => { if (smSet.has(sm.id)) expand(sm.x, sm.y, 18, 18); });
    (doc.texts || []).forEach(tx => { if (txSet.has(tx.id)) expand(tx.x, tx.y, 26, 14); });
    (doc.arrows || []).forEach(ar => { if (arSet.has(ar.id)) { expand(ar.x1, ar.y1, 8, 8); expand(ar.x2, ar.y2, 8, 8); } });
    (doc.mechArrows || []).forEach(ma => { if (maSet.has(ma.id)) { expand(ma.x1, ma.y1, 10, 10); expand(ma.x2, ma.y2, 10, 10); } });
    lassoSelection.selectedInkIndices.forEach(idx => {
        (doc.inkStrokes?.[idx]?.points || []).forEach(p => expand(p.x, p.y, 6, 6));
    });
    if (!isFinite(minX) && lassoSelection.bounds) {
        return { ...lassoSelection.bounds };
    }
    return { minX: minX - 6, minY: minY - 6, maxX: maxX + 6, maxY: maxY + 6 };
}

function createBracketAroundLasso() {
    if (!lassoSelection.active) return;
    const doc = getDocState();
    const box = getLassoTightSelectionBox(doc);
    if (!box || !isFinite(box.minX)) return;
    openCustomDialog({
        title: 'Ngoặc vuông trạng thái chuyển tiếp [ ... ]',
        defaultValue: '‡',
        onConfirm: (raw) => {
            saveHistorySnapshot();
            if (!doc.brackets) doc.brackets = [];
            const x = box.minX, y = box.minY;
            const w = Math.max(36, box.maxX - box.minX);
            const h = Math.max(36, box.maxY - box.minY);
            doc.brackets.push({
                id: genId('br'), x, y, w, h,
                sup: (raw || '').trim(),
                color: penColor
            });
            clearLassoSelection();
            ensureAutoNextPageIfNeeded(y + h);
            persistLibrary(); renderAll();
            showGestureToast('Đã đóng ngoặc trạng thái chuyển tiếp');
        }
    });
}

function saveLassoAsCustomSnippet() {
    if (!lassoSelection.active || !lassoSelection.selectedAtomIds.length) {
        showGestureToast('Hãy khoanh chọn ít nhất 1 cấu trúc phân tử để lưu!');
        return;
    }
    const doc = getDocState();
    const selSet = new Set(lassoSelection.selectedAtomIds);
    const selAtoms = (doc.atoms || []).filter(a => selSet.has(a.id));
    if (!selAtoms.length) return;

    openCustomDialog({
        title: 'Đặt tên Mẫu cấu trúc của tôi',
        defaultValue: `Mẫu ${(appLibrary.customSnippets?.length || 0) + 1}`,
        onConfirm: (raw) => {
            const title = (raw || '').trim();
            if (!title) return;
            const cx = selAtoms.reduce((s, a) => s + a.x, 0) / selAtoms.length;
            const cy = selAtoms.reduce((s, a) => s + a.y, 0) / selAtoms.length;
            const idToIdx = {};
            const atomsData = selAtoms.map((a, idx) => {
                idToIdx[a.id] = idx;
                return { dx: Number((a.x - cx).toFixed(2)), dy: Number((a.y - cy).toFixed(2)), label: a.label || 'C', color: a.color || penColor };
            });
            const bondsData = [];
            (doc.bonds || []).forEach(b => {
                if (idToIdx[b.a1] !== undefined && idToIdx[b.a2] !== undefined) {
                    bondsData.push({
                        i1: idToIdx[b.a1], i2: idToIdx[b.a2],
                        order: b.order || 1, stereo: b.stereo || null
                    });
                }
            });
            if (!Array.isArray(appLibrary.customSnippets)) appLibrary.customSnippets = [];
            const snippet = { id: genId('snp'), title, atoms: atomsData, bonds: bondsData };
            appLibrary.customSnippets.unshift(snippet);
            persistLibrary();
            if (typeof renderCustomSnippetsGrid === 'function') renderCustomSnippetsGrid();
            showGestureToast(`Đã lưu mẫu "${title}" vào Thư viện Vòng`);
        }
    });
}

function stampCustomSnippetAt(cx, cy, snippetId) {
    const snippet = (appLibrary.customSnippets || []).find(s => s.id === snippetId);
    if (!snippet || !(snippet.atoms || []).length) return;
    saveHistorySnapshot();
    const doc = getDocState();
    if (!doc.atoms) doc.atoms = [];
    if (!doc.bonds) doc.bonds = [];
    const createdAtoms = snippet.atoms.map(sa => {
        const na = { id: genId('a'), x: cx + sa.dx, y: cy + sa.dy, label: sa.label || 'C', color: sa.color || penColor };
        doc.atoms.push(na);
        return na;
    });
    const createdBonds = [];
    (snippet.bonds || []).forEach(sb => {
        const a1 = createdAtoms[sb.i1], a2 = createdAtoms[sb.i2];
        if (!a1 || !a2) return;
        const nb = { id: genId('b'), a1: a1.id, a2: a2.id, order: sb.order || 1, stereo: sb.stereo || null, color: penColor };
        doc.bonds.push(nb);
        createdBonds.push(nb);
    });
    enforceAllValenceAndHydrogens(doc);
    if (createdBonds.length) activateRingGizmoFor(createdAtoms, createdBonds);
    ensureAutoNextPageIfNeeded(cy + 40);
    persistLibrary(); renderAll();
}

function updateLassoFloatingBarPos() {
    const bar = document.getElementById('lassoFloatingBar');
    if (!bar || !lassoSelection.active || !lassoSelection.bounds) {
        bar?.classList.add('hidden');
        document.getElementById('lassoFormulaBadge')?.classList.add('hidden');
        return;
    }
    computeLassoFormulaAndMass();
    bar.classList.remove('hidden');

    const { minX, maxX, minY, maxY } = lassoSelection.bounds;
    const pageY = getPageYOffset(getActiveNotebook().activePageIndex || 0);
    const barW = Math.max(250, bar.offsetWidth || 310);
    const barH = Math.max(40, bar.offsetHeight || 48);
    const halfW = barW * 0.5 + 10;

    const selCenterX = panX + ((minX + maxX) * 0.5) * zoom;
    const selTopY = panY + (pageY + minY) * zoom;
    const selBottomY = panY + (pageY + maxY) * zoom;

    const sx = Math.max(halfW, Math.min(cssWidth - halfW, selCenterX));
    const candAboveY = selTopY - barH - 14;
    const candBelowY = selBottomY + 14;

    const doc = getDocState();
    const selAtomSet = new Set(lassoSelection.selectedAtomIds || []);
    const selInkSet = new Set(lassoSelection.selectedInkIndices || []);

    const pillEl = document.getElementById('penPillBar') || document.getElementById('penPillWidget');
    const cRect = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : { left: 0, top: 0 };
    let pillBox = null;
    if (pillEl && typeof pillEl.getBoundingClientRect === 'function') {
        const pr = pillEl.getBoundingClientRect();
        if (pr && pr.width > 0 && pr.height > 0) {
            pillBox = {
                left: pr.left - (cRect.left || 0),
                right: pr.right - (cRect.left || 0),
                top: pr.top - (cRect.top || 0),
                bottom: pr.bottom - (cRect.top || 0)
            };
        }
    }

    const scoreCandidate = (topY) => {
        let penalty = 0;
        const bottomY = topY + barH;
        const leftX = sx - barW * 0.5;
        const rightX = sx + barW * 0.5;

        if (topY < 62) penalty += (62 - topY) * 18 + 500;
        if (bottomY > cssHeight - 54) penalty += (bottomY - (cssHeight - 54)) * 18 + 500;
        if (bottomY > selTopY - 4 && topY < selBottomY + 4) penalty += 900;

        if (pillBox && rightX > pillBox.left - 8 && leftX < pillBox.right + 8 && bottomY > pillBox.top - 8 && topY < pillBox.bottom + 8) {
            penalty += 700;
        }

        const z = Math.max(0.25, zoom || 1);
        const wLeft = (leftX - panX) / z;
        const wRight = (rightX - panX) / z;
        const wTop = (topY - panY) / z - pageY;
        const wBottom = (bottomY - panY) / z - pageY;

        const atoms = doc?.atoms || [];
        for (let i = 0; i < atoms.length; i++) {
            const a = atoms[i];
            if (selAtomSet.has(a.id)) continue;
            if (a.x >= wLeft - 8 && a.x <= wRight + 8 && a.y >= wTop - 8 && a.y <= wBottom + 8) {
                penalty += 35;
            }
        }
        const strokes = doc?.inkStrokes || [];
        for (let i = 0; i < strokes.length; i++) {
            if (selInkSet.has(i)) continue;
            const pts = strokes[i]?.points || [];
            for (let k = 0; k < pts.length; k += 3) {
                const p = pts[k];
                if (p.x >= wLeft && p.x <= wRight && p.y >= wTop && p.y <= wBottom) {
                    penalty += 8;
                }
            }
        }
        return penalty;
    };

    const scoreAbove = scoreCandidate(candAboveY);
    const scoreBelow = scoreCandidate(candBelowY) + 4;
    let chosenY = scoreBelow < scoreAbove ? candBelowY : candAboveY;

    if (chosenY < 10 || chosenY + barH > cssHeight - 10) {
        const clampedAbove = Math.max(64, Math.min(cssHeight - barH - 56, candAboveY));
        const clampedBelow = Math.max(64, Math.min(cssHeight - barH - 56, candBelowY));
        chosenY = scoreCandidate(clampedBelow) < scoreCandidate(clampedAbove) ? clampedBelow : clampedAbove;
    }

    bar.style.left = Math.round(sx) + 'px';
    bar.style.top = Math.round(Math.max(10, Math.min(cssHeight - barH - 10, chosenY))) + 'px';
}

function getLassoSelectionCenter(doc) {
    const pts = [];
    const aSet = new Set(lassoSelection.selectedAtomIds);
    const obSet = new Set(lassoSelection.selectedOrbitalIds);
    const smSet = new Set(lassoSelection.selectedSymbolIds);
    const txSet = new Set(lassoSelection.selectedTextIds);
    const arSet = new Set(lassoSelection.selectedArrowIds);
    const maSet = new Set(lassoSelection.selectedMechArrowIds);
    const brSet = new Set(lassoSelection.selectedBracketIds || []);
    const imSet = new Set(lassoSelection.selectedImageIds || []);
    (doc.atoms || []).forEach(a => { if (aSet.has(a.id)) pts.push({ x: a.x, y: a.y }); });
    (doc.orbitals || []).forEach(ob => { if (obSet.has(ob.id)) pts.push({ x: ob.x, y: ob.y }); });
    (doc.chemSymbols || []).forEach(sm => { if (smSet.has(sm.id)) pts.push({ x: sm.x, y: sm.y }); });
    (doc.texts || []).forEach(tx => { if (txSet.has(tx.id)) pts.push({ x: tx.x, y: tx.y }); });
    (doc.arrows || []).forEach(ar => { if (arSet.has(ar.id)) pts.push({ x: (ar.x1 + ar.x2) / 2, y: (ar.y1 + ar.y2) / 2 }); });
    (doc.mechArrows || []).forEach(ma => { if (maSet.has(ma.id)) pts.push({ x: (ma.x1 + ma.x2) / 2, y: (ma.y1 + ma.y2) / 2 }); });
    (doc.brackets || []).forEach(br => { if (brSet.has(br.id)) pts.push({ x: br.x + br.w / 2, y: br.y + br.h / 2 }); });
    (doc.images || []).forEach(im => { if (!im.locked && imSet.has(im.id)) pts.push({ x: im.x + im.w / 2, y: im.y + im.h / 2 }); });
    lassoSelection.selectedInkIndices.forEach(idx => {
        (doc.inkStrokes?.[idx]?.points || []).forEach(p => pts.push(p));
    });
    if (!pts.length && lassoSelection.bounds) {
        const b = lassoSelection.bounds;
        return { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2 };
    }
    if (!pts.length) return { cx: 0, cy: 0 };
    return {
        cx: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        cy: pts.reduce((s, p) => s + p.y, 0) / pts.length
    };
}

function clearLassoSelection() {
    lassoSelection = {
        active: false, dragging: false, polygon: [], bounds: null,
        selectedInkIndices: [], selectedAtomIds: [],
        selectedOrbitalIds: [], selectedSymbolIds: [], selectedTextIds: [],
        selectedArrowIds: [], selectedMechArrowIds: [], selectedBracketIds: [],
        selectedImageIds: [],
        lastDragPos: null
    };
    document.getElementById('lassoFloatingBar')?.classList.add('hidden');
    document.getElementById('lassoFormulaBadge')?.classList.add('hidden');
}

function rotateLassoSelectionBy(deg) {
    if (!lassoSelection.active) return;
    saveHistorySnapshot();
    const doc = getDocState();
    const { cx, cy } = getLassoSelectionCenter(doc);
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rotPt = (pt) => {
        const dx = pt.x - cx, dy = pt.y - cy;
        pt.x = cx + dx * cos - dy * sin;
        pt.y = cy + dx * sin + dy * cos;
    };
    const aSet = new Set(lassoSelection.selectedAtomIds);
    const obSet = new Set(lassoSelection.selectedOrbitalIds);
    const smSet = new Set(lassoSelection.selectedSymbolIds);
    const txSet = new Set(lassoSelection.selectedTextIds);
    const arSet = new Set(lassoSelection.selectedArrowIds);
    const maSet = new Set(lassoSelection.selectedMechArrowIds);

    (doc.atoms || []).forEach(a => { if (aSet.has(a.id)) rotPt(a); });
    (doc.orbitals || []).forEach(ob => {
        if (obSet.has(ob.id)) { rotPt(ob); ob.angle = (ob.angle || 0) + rad; }
    });
    (doc.chemSymbols || []).forEach(sm => {
        if (smSet.has(sm.id)) { rotPt(sm); sm.angle = (sm.angle || 0) + rad; }
    });
    (doc.texts || []).forEach(tx => { if (txSet.has(tx.id)) rotPt(tx); });
    (doc.arrows || []).forEach(ar => {
        if (arSet.has(ar.id)) {
            const p1 = { x: ar.x1, y: ar.y1 }, p2 = { x: ar.x2, y: ar.y2 };
            rotPt(p1); rotPt(p2);
            ar.x1 = p1.x; ar.y1 = p1.y; ar.x2 = p2.x; ar.y2 = p2.y;
        }
    });
    (doc.mechArrows || []).forEach(ma => {
        if (maSet.has(ma.id)) {
            const p1 = { x: ma.x1, y: ma.y1 }, p2 = { x: ma.x2, y: ma.y2 };
            rotPt(p1); rotPt(p2);
            ma.x1 = p1.x; ma.y1 = p1.y; ma.x2 = p2.x; ma.y2 = p2.y;
            if (typeof ma.cpx === 'number' && typeof ma.cpy === 'number') {
                const cp = { x: ma.cpx, y: ma.cpy };
                rotPt(cp);
                ma.cpx = cp.x; ma.cpy = cp.y;
            }
        }
    });
    const brSetRot = new Set(lassoSelection.selectedBracketIds || []);
    (doc.brackets || []).forEach(br => {
        if (brSetRot.has(br.id)) {
            const pc = { x: br.x + br.w / 2, y: br.y + br.h / 2 };
            rotPt(pc);
            br.x = pc.x - br.w / 2; br.y = pc.y - br.h / 2;
        }
    });
    lassoSelection.selectedInkIndices.forEach(idx => {
        (doc.inkStrokes?.[idx]?.points || []).forEach(rotPt);
    });
    lassoSelection.polygon.forEach(rotPt);
    recomputeLassoBounds();
    updateLassoFloatingBarPos();
    persistLibrary(); renderAll();
}

function scaleLassoSelectionBy(factor) {
    if (!lassoSelection.active) return;
    saveHistorySnapshot();
    const doc = getDocState();
    const { cx, cy } = getLassoSelectionCenter(doc);
    const scalePt = (pt) => {
        pt.x = cx + (pt.x - cx) * factor;
        pt.y = cy + (pt.y - cy) * factor;
    };
    const aSet = new Set(lassoSelection.selectedAtomIds);
    const obSet = new Set(lassoSelection.selectedOrbitalIds);
    const smSet = new Set(lassoSelection.selectedSymbolIds);
    const txSet = new Set(lassoSelection.selectedTextIds);
    const arSet = new Set(lassoSelection.selectedArrowIds);
    const maSet = new Set(lassoSelection.selectedMechArrowIds);

    (doc.atoms || []).forEach(a => { if (aSet.has(a.id)) scalePt(a); });
    (doc.orbitals || []).forEach(ob => {
        if (obSet.has(ob.id)) {
            scalePt(ob);
            ob.scale = Math.max(14, Math.min(140, (ob.scale || 36) * factor));
        }
    });
    (doc.chemSymbols || []).forEach(sm => { if (smSet.has(sm.id)) scalePt(sm); });
    (doc.texts || []).forEach(tx => {
        if (txSet.has(tx.id)) {
            scalePt(tx);
            tx.size = Math.max(9, Math.min(36, Math.round((tx.size || 14) * factor)));
        }
    });
    (doc.arrows || []).forEach(ar => {
        if (arSet.has(ar.id)) {
            const p1 = { x: ar.x1, y: ar.y1 }, p2 = { x: ar.x2, y: ar.y2 };
            scalePt(p1); scalePt(p2);
            ar.x1 = p1.x; ar.y1 = p1.y; ar.x2 = p2.x; ar.y2 = p2.y;
        }
    });
    (doc.mechArrows || []).forEach(ma => {
        if (maSet.has(ma.id)) {
            const p1 = { x: ma.x1, y: ma.y1 }, p2 = { x: ma.x2, y: ma.y2 };
            scalePt(p1); scalePt(p2);
            ma.x1 = p1.x; ma.y1 = p1.y; ma.x2 = p2.x; ma.y2 = p2.y;
            if (typeof ma.cpx === 'number' && typeof ma.cpy === 'number') {
                const cp = { x: ma.cpx, y: ma.cpy };
                scalePt(cp);
                ma.cpx = cp.x; ma.cpy = cp.y;
            }
        }
    });
    const brSetScale = new Set(lassoSelection.selectedBracketIds || []);
    (doc.brackets || []).forEach(br => {
        if (brSetScale.has(br.id)) {
            const p1 = { x: br.x, y: br.y }, p2 = { x: br.x + br.w, y: br.y + br.h };
            scalePt(p1); scalePt(p2);
            br.x = p1.x; br.y = p1.y;
            br.w = Math.max(24, p2.x - p1.x); br.h = Math.max(24, p2.y - p1.y);
        }
    });
    const imSetScale = new Set(lassoSelection.selectedImageIds || []);
    (doc.images || []).forEach(im => {
        if (!im.locked && imSetScale.has(im.id)) {
            const p1 = { x: im.x, y: im.y };
            scalePt(p1);
            im.x = p1.x; im.y = p1.y;
            im.w = Math.max(40, im.w * factor);
            im.h = Math.max(30, im.h * factor);
        }
    });
    lassoSelection.selectedInkIndices.forEach(idx => {
        const st = doc.inkStrokes?.[idx];
        if (st) {
            (st.points || []).forEach(scalePt);
            st.width = Math.max(1, Math.min(24, (st.width || 2.8) * factor));
        }
    });
    lassoSelection.polygon.forEach(scalePt);
    recomputeLassoBounds();
    updateLassoFloatingBarPos();
    persistLibrary(); renderAll();
}

function duplicateLassoSelection() {
    if (!lassoSelection.active) return;
    saveHistorySnapshot();
    const doc = getDocState();
    const mapIds = {};
    const newAtomIds = [];
    lassoSelection.selectedAtomIds.forEach(id => {
        const a = doc.atoms.find(x => x.id === id);
        if (a) {
            const na = { ...a, id: genId('a'), x: a.x + 24, y: a.y + 24 };
            doc.atoms.push(na); mapIds[id] = na.id; newAtomIds.push(na.id);
        }
    });
    (doc.bonds || []).slice().forEach(b => {
        if (mapIds[b.a1] && mapIds[b.a2]) {
            doc.bonds.push({ ...b, id: genId('b'), a1: mapIds[b.a1], a2: mapIds[b.a2] });
        }
    });
    const newInkIndices = [];
    lassoSelection.selectedInkIndices.forEach(idx => {
        const st = doc.inkStrokes?.[idx];
        if (st) {
            const copySt = { ...st, points: (st.points || []).map(p => ({ x: p.x + 24, y: p.y + 24 })) };
            doc.inkStrokes.push(copySt);
            newInkIndices.push(doc.inkStrokes.length - 1);
        }
    });
    const dupPointArr = (arr, selIds, prefix) => {
        const setIds = new Set(selIds);
        const created = [];
        (arr || []).slice().forEach(it => {
            if (setIds.has(it.id)) {
                const copy = { ...it, id: genId(prefix), x: it.x + 24, y: it.y + 24 };
                arr.push(copy); created.push(copy.id);
            }
        });
        return created;
    };
    const dupSegArr = (arr, selIds, prefix) => {
        const setIds = new Set(selIds);
        const created = [];
        (arr || []).slice().forEach(it => {
            if (setIds.has(it.id)) {
                const copy = { ...it, id: genId(prefix), x1: it.x1 + 24, y1: it.y1 + 24, x2: it.x2 + 24, y2: it.y2 + 24 };
                if (typeof it.cpx === 'number' && typeof it.cpy === 'number') {
                    copy.cpx = it.cpx + 24; copy.cpy = it.cpy + 24;
                }
                arr.push(copy); created.push(copy.id);
            }
        });
        return created;
    };
    const dupBracketArr = (arr, selIds) => {
        const setIds = new Set(selIds || []);
        const created = [];
        (arr || []).slice().forEach(br => {
            if (setIds.has(br.id)) {
                const copy = { ...br, id: genId('br'), x: br.x + 24, y: br.y + 24 };
                arr.push(copy); created.push(copy.id);
            }
        });
        return created;
    };
    lassoSelection.selectedAtomIds = newAtomIds;
    lassoSelection.selectedInkIndices = newInkIndices;
    lassoSelection.selectedOrbitalIds = dupPointArr(doc.orbitals || [], lassoSelection.selectedOrbitalIds, 'ob');
    lassoSelection.selectedSymbolIds = dupPointArr(doc.chemSymbols || [], lassoSelection.selectedSymbolIds, 'sym');
    lassoSelection.selectedTextIds = dupPointArr(doc.texts || [], lassoSelection.selectedTextIds, 'txt');
    lassoSelection.selectedArrowIds = dupSegArr(doc.arrows || [], lassoSelection.selectedArrowIds, 'ar');
    lassoSelection.selectedMechArrowIds = dupSegArr(doc.mechArrows || [], lassoSelection.selectedMechArrowIds, 'ma');
    lassoSelection.selectedBracketIds = dupBracketArr(doc.brackets || [], lassoSelection.selectedBracketIds);
    const imSetDup = new Set(lassoSelection.selectedImageIds || []);
    const newImgIds = [];
    (doc.images || []).slice().forEach(im => {
        if (!im.locked && imSetDup.has(im.id)) {
            const copy = { ...im, id: genId('img'), x: im.x + 24, y: im.y + 24 };
            doc.images.push(copy);
            newImgIds.push(copy.id);
        }
    });
    lassoSelection.selectedImageIds = newImgIds;
    lassoSelection.polygon.forEach(p => { p.x += 24; p.y += 24; });
    recomputeLassoBounds();
    updateLassoFloatingBarPos();
    persistLibrary(); renderAll();
}

function recolorLassoSelection(targetCol = null) {
    if (!lassoSelection.active) return;
    saveHistorySnapshot();
    const doc = getDocState();
    const useCol = (typeof targetCol === 'string' && targetCol) ? targetCol : penColor;
    const aSet = new Set(lassoSelection.selectedAtomIds);
    const obSet = new Set(lassoSelection.selectedOrbitalIds);
    const smSet = new Set(lassoSelection.selectedSymbolIds);
    const txSet = new Set(lassoSelection.selectedTextIds);
    const arSet = new Set(lassoSelection.selectedArrowIds);
    const maSet = new Set(lassoSelection.selectedMechArrowIds);
    const brSet = new Set(lassoSelection.selectedBracketIds || []);
    (doc.atoms || []).forEach(a => { if (aSet.has(a.id)) a.color = useCol; });
    (doc.bonds || []).forEach(b => { if (aSet.has(b.a1) && aSet.has(b.a2)) b.color = useCol; });
    (doc.orbitals || []).forEach(ob => { if (obSet.has(ob.id)) ob.color = useCol; });
    (doc.chemSymbols || []).forEach(sm => { if (smSet.has(sm.id)) sm.color = useCol; });
    (doc.texts || []).forEach(tx => { if (txSet.has(tx.id)) tx.color = useCol; });
    (doc.arrows || []).forEach(ar => { if (arSet.has(ar.id)) ar.color = useCol; });
    (doc.mechArrows || []).forEach(ma => { if (maSet.has(ma.id)) ma.color = useCol; });
    (doc.brackets || []).forEach(br => { if (brSet.has(br.id)) br.color = useCol; });
    lassoSelection.selectedInkIndices.forEach(idx => { if (doc.inkStrokes[idx]) doc.inkStrokes[idx].color = useCol; });
    persistLibrary(); renderAll();
}

function deleteLassoSelection() {
    if (!lassoSelection.active) return;
    saveHistorySnapshot();
    const doc = getDocState();
    const aSet = new Set(lassoSelection.selectedAtomIds);
    const obSet = new Set(lassoSelection.selectedOrbitalIds);
    const smSet = new Set(lassoSelection.selectedSymbolIds);
    const txSet = new Set(lassoSelection.selectedTextIds);
    const arSet = new Set(lassoSelection.selectedArrowIds);
    const maSet = new Set(lassoSelection.selectedMechArrowIds);
    const brSet = new Set(lassoSelection.selectedBracketIds || []);
    doc.bonds = (doc.bonds || []).filter(b => !aSet.has(b.a1) && !aSet.has(b.a2));
    doc.atoms = (doc.atoms || []).filter(a => !aSet.has(a.id));
    doc.orbitals = (doc.orbitals || []).filter(ob => !obSet.has(ob.id));
    doc.chemSymbols = (doc.chemSymbols || []).filter(sm => !smSet.has(sm.id));
    doc.texts = (doc.texts || []).filter(tx => !txSet.has(tx.id));
    doc.arrows = (doc.arrows || []).filter(ar => !arSet.has(ar.id));
    doc.mechArrows = (doc.mechArrows || []).filter(ma => !maSet.has(ma.id));
    doc.brackets = (doc.brackets || []).filter(br => !brSet.has(br.id));
    const imSetDel = new Set(lassoSelection.selectedImageIds || []);
    if (imSetDel.size) {
        doc.images = (doc.images || []).filter(im => im.locked || !imSetDel.has(im.id));
    }
    const iSet = new Set(lassoSelection.selectedInkIndices);
    doc.inkStrokes = (doc.inkStrokes || []).filter((_, i) => !iSet.has(i));
    enforceAllValenceAndHydrogens(doc);
    clearLassoSelection(); persistLibrary(); renderAll();
}

/* SỰ KIỆN CHUỘT & CẢM ỨNG TRÊN BÀN VẼ */
function cancelAtomHoldTimer(clearState = true) {
    if (atomHoldTimer) {
        clearTimeout(atomHoldTimer);
        atomHoldTimer = null;
    }
    if (clearState) atomHoldState = null;
}

function activateAtomHoldMove() {
    if (!atomHoldState || atomHoldState.active) return;
    const st = atomHoldState;
    st.active = true;
    isDrawing = true;
    dragStartAtom = null;
    dragStartPos = null;
    previewChainPoints = [];
    if (!st.snapshotTaken) {
        saveHistorySnapshot();
        st.snapshotTaken = true;
    }
    if (st.shiftKey) {
        const compIds = getConnectedAtomComponent(st.atom.id);
        activeMoveTarget = { type: 'molecule', atomIds: compIds, lastPos: { ...st.startW } };
        showGestureToast('Đang di chuyển cả phân tử');
    } else {
        activeMoveTarget = { type: 'atom', item: st.atom };
        showGestureToast('Đang di chuyển nguyên tử (Giữ Shift: cả phân tử)');
    }
    renderAll();
}

const ATOM_HOLD_MOVE_DELAY_MS = 560;

function startAtomHoldCheck(atom, localW, e, opts = {}) {
    cancelAtomHoldTimer(true);
    const delayMs = ATOM_HOLD_MOVE_DELAY_MS;
    atomHoldState = {
        atom,
        startW: { x: localW.x, y: localW.y },
        startScreen: { x: e.clientX, y: e.clientY },
        startedAt: Date.now(),
        delayMs,
        shiftKey: !!e.shiftKey,
        tool: window.unifiedTool,
        pendingAction: opts.pendingAction || null,
        snapshotTaken: !!opts.snapshotTaken,
        active: false
    };
    const tickAnim = () => {
        if (!atomHoldState || atomHoldState.active) return;
        renderAll();
        if (Date.now() - atomHoldState.startedAt < delayMs && typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(tickAnim);
        }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tickAnim);
    atomHoldTimer = setTimeout(() => {
        atomHoldTimer = null;
        activateAtomHoldMove();
    }, delayMs);
    renderAll();
}

function smartAttachOrReplaceGroupOnAtom(atom, rawLabel, doc, preferredAng = null) {
    if (!atom || !doc || !rawLabel) return null;
    if (!doc.atoms) doc.atoms = [];
    if (!doc.bonds) doc.bonds = [];

    const trimmed = String(rawLabel).trim();
    const isCarbonyl = (trimmed === '=O' || trimmed === 'O=');
    const cleanLabel = isCarbonyl ? 'O' : trimmed;

    if (cleanLabel === 'C' && !isCarbonyl) {
        if (atom.label === 'C') return { ok: false, reason: 'already_c' };
        saveHistorySnapshot();
        atom.label = 'C';
        atom.color = penColor;
        enforceAllValenceAndHydrogens(doc);
        return { ok: true, mode: 'reset', label: 'C', maxY: atom.y };
    }

    const nbs = getAtomNeighbors(atom.id, doc);
    const curSum = getAtomBondOrderSum(atom.id, doc);

    if (isCarbonyl) {
        // Nếu chạm vào nguyên tử đầu mút đang nối đơn với Carbon và người dùng không kéo hướng mới -> nâng liên kết đó thành =O
        if (preferredAng === null && nbs.length === 1 && curSum === 1 && (!atom.label || atom.label === 'C' || atom.label === 'O')) {
            const parent = nbs[0];
            const b = (doc.bonds || []).find(bd => (bd.a1 === atom.id && bd.a2 === parent.id) || (bd.a2 === atom.id && bd.a1 === parent.id));
            if (b && b.order === 1 && canAddBondOrder(parent, 1, doc)) {
                saveHistorySnapshot();
                b.order = 2;
                b.stereo = null;
                atom.label = 'O';
                atom.color = penColor;
                enforceAllValenceAndHydrogens(doc);
                return { ok: true, mode: 'carbonyl_upgrade', label: '=O', maxY: atom.y };
            }
        }
        if (!canAddBondOrder(atom, 2, doc)) {
            if (typeof showGestureToast === 'function') showGestureToast('Nguyên tử này không đủ 2 hóa trị trống để gắn =O!');
            return { ok: false, reason: 'valence' };
        }
        saveHistorySnapshot();
        const ang = getSmartHorizontalZigZagAngle(atom, doc, preferredAng);
        const tx = atom.x + BOND_LENGTH * Math.cos(ang);
        const ty = atom.y + BOND_LENGTH * Math.sin(ang);
        const newO = { id: genId('a'), x: tx, y: ty, label: 'O', color: penColor };
        doc.atoms.push(newO);
        doc.bonds.push({ id: genId('b'), a1: atom.id, a2: newO.id, order: 2, stereo: null, color: penColor });
        enforceAllValenceAndHydrogens(doc);
        return { ok: true, mode: 'sprout', label: '=O', maxY: Math.max(atom.y, ty) };
    }

    const EXPLICIT_MONOVALENT_GROUPS = new Set(['OH', 'HO', 'NH2', 'H2N', 'SH', 'HS', 'PH2']);
    const maxV = EXPLICIT_MONOVALENT_GROUPS.has(cleanLabel) ? 1 : getMaxValenceForAtom({ label: cleanLabel });

    // Nếu người dùng chủ động kéo ra ngoài HOẶC nguyên tử hiện tại (như đỉnh vòng Benzene / mạch C giữa) có số liên kết > maxV của nhóm thế:
    // Tự động mọc nhánh mới mang nhóm thế đó chỉ với 1 chạm!
    if (preferredAng !== null || curSum > maxV) {
        if (!canAddBondOrder(atom, 1, doc)) {
            if (typeof showGestureToast === 'function') showGestureToast((atom.label || 'C') + ' đã đạt tối đa hóa trị!');
            return { ok: false, reason: 'valence' };
        }
        saveHistorySnapshot();
        const ang = getSmartHorizontalZigZagAngle(atom, doc, preferredAng);
        const tx = atom.x + BOND_LENGTH * Math.cos(ang);
        const ty = atom.y + BOND_LENGTH * Math.sin(ang);
        const newGrp = { id: genId('a'), x: tx, y: ty, label: cleanLabel, color: penColor };
        doc.atoms.push(newGrp);
        doc.bonds.push({ id: genId('b'), a1: atom.id, a2: newGrp.id, order: 1, stereo: null, color: penColor });
        enforceAllValenceAndHydrogens(doc);
        return { ok: true, mode: 'sprout', label: cleanLabel, maxY: Math.max(atom.y, ty) };
    }

    saveHistorySnapshot();
    atom.label = cleanLabel;
    atom.color = penColor;
    enforceAllValenceAndHydrogens(doc);
    return { ok: true, mode: 'replace', label: cleanLabel, maxY: atom.y };
}

function applySubstituentActionToAtom(nearA, localW, doc, preferredAng = null) {
    if (!nearA) return;
    const res = smartAttachOrReplaceGroupOnAtom(nearA, activeGroupLabel, doc, preferredAng);
    if (!res || !res.ok) return;
    ensureAutoNextPageIfNeeded(res.maxY);
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    persistLibrary();
    renderAll();
    if (typeof showGestureToast === 'function') {
        if (res.mode === 'reset') showGestureToast('Đã gỡ nhóm thế → C');
        else if (res.mode === 'sprout') showGestureToast('✨ Đã gắn nhánh -' + res.label);
        else showGestureToast('✨ Đã gắn nhóm -' + res.label);
    }
}

function findHitNewmanSymbol(doc, pt, rad = 24) {
    return (doc.chemSymbols || []).find(sm =>
        (sm.type === 'newman_stag' || sm.type === 'newman_eclip') &&
        Math.hypot(pt.x - sm.x, pt.y - sm.y) <= rad
    ) || null;
}

function rotateNewmanBackBy(sm, doc, stepRad) {
    if (!sm || !doc) return;
    saveHistorySnapshot();
    sm.backRotation = (sm.backRotation || 0) + stepRad;
    const frontSet = new Set(sm.frontAtomIds || []);
    const seedIds = new Set(sm.backAtomIds || []);
    if (!seedIds.size) {
        const L = 40;
        const backShift = sm.type === 'newman_stag' ? Math.PI / 3 : 0.24;
        for (let k = 0; k < 3; k++) {
            const ang = -Math.PI / 2 + backShift + (sm.backRotation - stepRad) + k * (2 * Math.PI / 3);
            const tx = sm.x + L * Math.cos(ang), ty = sm.y + L * Math.sin(ang);
            const found = (doc.atoms || []).find(a => Math.hypot(a.x - tx, a.y - ty) < 16);
            if (found) seedIds.add(found.id);
        }
    }
    const rotSet = new Set();
    const queue = Array.from(seedIds);
    queue.forEach(id => rotSet.add(id));
    while (queue.length) {
        const cur = queue.shift();
        (doc.bonds || []).forEach(b => {
            const nxt = b.a1 === cur ? b.a2 : (b.a2 === cur ? b.a1 : null);
            if (!nxt || frontSet.has(nxt) || rotSet.has(nxt)) return;
            const na = (doc.atoms || []).find(a => a.id === nxt);
            if (na && Math.hypot(na.x - sm.x, na.y - sm.y) < 16) return;
            rotSet.add(nxt);
            queue.push(nxt);
        });
    }
    const cos = Math.cos(stepRad), sin = Math.sin(stepRad);
    (doc.atoms || []).forEach(a => {
        if (!rotSet.has(a.id)) return;
        const dx = a.x - sm.x, dy = a.y - sm.y;
        a.x = sm.x + dx * cos - dy * sin;
        a.y = sm.y + dx * sin + dy * cos;
    });
    const deg = Math.round((((sm.backRotation * 180) / Math.PI) % 360 + 360) % 360);
    persistLibrary(); renderAll();
    showGestureToast(`Xoay Newman: ${deg}°`);
}

function findHitMechArrowCtrl(doc, pt, tol = 14) {
    return (doc.mechArrows || []).find(ma => {
        const ctrl = typeof getMechArrowControlPoint === 'function'
            ? getMechArrowControlPoint(ma)
            : { x: (ma.x1 + ma.x2) / 2, y: (ma.y1 + ma.y2) / 2 };
        const bx = 0.25 * ma.x1 + 0.5 * ctrl.x + 0.25 * ma.x2;
        const by = 0.25 * ma.y1 + 0.5 * ctrl.y + 0.25 * ma.y2;
        return Math.hypot(pt.x - bx, pt.y - by) <= tol;
    }) || null;
}

function distToBracketEdges(br, pt) {
    const x = br.x, y = br.y, w = br.w, h = br.h;
    const arm = Math.max(8, Math.min(18, Math.min(w, h) * 0.16));
    return Math.min(
        distToSegment(pt, { x, y }, { x, y: y + h }),
        distToSegment(pt, { x, y }, { x: x + arm, y }),
        distToSegment(pt, { x, y: y + h }, { x: x + arm, y: y + h }),
        distToSegment(pt, { x: x + w, y }, { x: x + w, y: y + h }),
        distToSegment(pt, { x: x + w - arm, y }, { x: x + w, y }),
        distToSegment(pt, { x: x + w - arm, y: y + h }, { x: x + w, y: y + h })
    );
}

function executeConfiguredIpadAction(actionId, sourceLabel = '') {
    if (!actionId || actionId === 'off') return false;
    const prefix = sourceLabel ? `${sourceLabel}: ` : '';
    if (actionId === 'eraser') {
        if (typeof toggleDoubleTapEraser === 'function') toggleDoubleTapEraser();
        return true;
    }
    if (actionId === 'undo') {
        const hadUndo = typeof undoStack !== 'undefined' && undoStack.length > 0;
        undoAction();
        if (hadUndo && typeof showGestureToast === 'function') showGestureToast(`${prefix}Hoàn tác (Undo)`);
        return true;
    }
    if (actionId === 'redo') {
        const hadRedo = typeof redoStack !== 'undefined' && redoStack.length > 0;
        redoAction();
        if (hadRedo && typeof showGestureToast === 'function') showGestureToast(`${prefix}Làm lại (Redo)`);
        return true;
    }
    if (actionId === 'fit_page') {
        if (typeof fitA4ToScreen === 'function') fitA4ToScreen('page');
        if (typeof showGestureToast === 'function') showGestureToast(`${prefix}Căn vừa trọn trang`);
        return true;
    }
    if (actionId === 'clear_selection') {
        if (typeof clearLassoSelection === 'function') clearLassoSelection();
        if (typeof clearActiveRingGizmo === 'function') clearActiveRingGizmo(false);
        if (typeof clearActiveImageSelection === 'function') clearActiveImageSelection(false);
        if (typeof clearActiveCarbonChain === 'function') clearActiveCarbonChain(false);
        renderAll();
        if (typeof showGestureToast === 'function') showGestureToast(`${prefix}Đã bỏ chọn`);
        return true;
    }
    if (actionId === 'presentation') {
        if (typeof togglePresentationMode === 'function') togglePresentationMode();
        return true;
    }
    return false;
}

let activePenPointerId = null;
let activeStrokePointerId = null;
let lastPenActivityAt = 0;
let lastPenHoverAt = -10000;
let lastAnyInputEventAt = 0;
let allTouchesReleasedAt = 0;
let lastNativeTouchCount = 0;
let lastNativeTouchAt = 0;
let touchPalmBuffer = { dx: 0, dy: 0, at: 0 };
const ignoredPalmPointerIds = new Map();
const pendingFinishTouchIds = new Set();
let touchEndSweepTimer = null;
let nativePinchState = {
    active: false,
    startDist: 0,
    startZoom: 1,
    startMidX: 0,
    startMidY: 0,
    startPanX: 0,
    startPanY: 0,
    zoomChanged: false,
    lastMoveAt: 0
};
let nativeSinglePanState = {
    active: false,
    touchId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startPanX: 0,
    startPanY: 0,
    startTime: 0,
    lastMoveTime: 0,
    velX: 0,
    velY: 0,
    panActivated: false,
    isEdgeSwipe: false,
    fromPinchRelease: false
};
const handledEndEvents = typeof WeakSet === 'function' ? new WeakSet() : null;
const handledNativeEndEvents = typeof WeakSet === 'function' ? new WeakSet() : null;
let inkRenderRafId = null;
let panInertiaRafId = null;
let panInertiaVx = 0;
let panInertiaVy = 0;

function stopPanInertia() {
    if (panInertiaRafId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(panInertiaRafId);
    }
    panInertiaRafId = null;
    panInertiaVx = 0;
    panInertiaVy = 0;
}

function startPanInertia(vx, vy) {
    stopPanInertia();
    if (typeof requestAnimationFrame !== 'function') return;
    const maxSpeed = 52;
    const spd = Math.hypot(vx, vy);
    if (spd < 1.1) return;
    const scale = spd > maxSpeed ? (maxSpeed / spd) : 1;
    panInertiaVx = vx * scale;
    panInertiaVy = vy * scale;
    let lastTickTs = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
    const tick = (rafNow) => {
        const nowTs = (typeof rafNow === 'number' && rafNow > 0)
            ? rafNow
            : ((typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now());
        if (typeof isBatterySaverActive === 'function' && isBatterySaverActive() && (nowTs - lastTickTs) < 15.5) {
            panInertiaRafId = requestAnimationFrame(tick);
            return;
        }
        const dtMs = Math.max(4, Math.min(42, nowTs - lastTickTs));
        lastTickTs = nowTs;
        const dtFactor = dtMs / 16.6667;
        const decay = Math.pow(0.922, dtFactor);
        panInertiaVx *= decay;
        panInertiaVy *= decay;
        if (Math.hypot(panInertiaVx, panInertiaVy) < 0.25) {
            panInertiaRafId = null;
            panInertiaVx = 0;
            panInertiaVy = 0;
            if (typeof renderAll === 'function') renderAll();
            return;
        }
        panX += panInertiaVx * dtFactor;
        panY += panInertiaVy * dtFactor;
        clampViewportPanAndZoom();
        if (typeof isReadMode === 'undefined' || !isReadMode) {
            const rectPan = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : canvas.getBoundingClientRect();
            autoDetectPageFromScreenY(rectPan.top + rectPan.height * 0.45);
        }
        if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
        updateRingTransformFloatingBarPos(); updateImageFloatingBarPos(); updateChainFloatingBarPos(); updateLassoFloatingBarPos();
        renderAll();
        panInertiaRafId = requestAnimationFrame(tick);
    };
    panInertiaRafId = requestAnimationFrame(tick);
}

function forceFinalizeOrClearActiveInkStroke() {
    cancelScheduledInkRender();
    cancelInkHoldTimer();
    if (currentInkStroke) {
        try {
            const pts = currentInkStroke.points || [];
            if (pts.length >= 2) {
                const dPrev = getDocState();
                if (!dPrev.inkStrokes) dPrev.inkStrokes = [];
                stripTransientInkFields(currentInkStroke);
                dPrev.inkStrokes.push(currentInkStroke);
                if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
                if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(600);
            }
        } catch (_) {}
        currentInkStroke = null;
    }
    activeStrokePointerId = null;
    isDrawing = false;
    document.body?.classList?.remove('is-drawing-canvas');
}

function reconcileActiveTouchPointers(nowMs) {
    for (const [pid, ts] of Array.from(ignoredPalmPointerIds.entries())) {
        if ((nowMs - (ts || 0)) > 1500) {
            ignoredPalmPointerIds.delete(pid);
        }
    }
    if (nativePinchState.active && (nowMs - (nativePinchState.lastMoveAt || 0)) > 450) {
        nativePinchState.active = false;
        nativePinchState.zoomChanged = false;
    }
    if (nativeSinglePanState.active && (nowMs - (nativeSinglePanState.lastMoveTime || nativeSinglePanState.startTime || 0)) > 700) {
        nativeSinglePanState.active = false;
        nativeSinglePanState.isEdgeSwipe = false;
        nativeSinglePanState.fromPinchRelease = false;
    }
    if (lastNativeTouchCount > 0 && (nowMs - (lastNativeTouchAt || 0)) > 900 && activePointers.size === 0) {
        lastNativeTouchCount = 0;
    }
    for (const [pid, pt] of Array.from(activePointers.entries())) {
        const idle = nowMs - (pt.lastTime || 0);
        const ttl = (pt.type === 'pen' || pt.isFineStylus) ? 2000 : 1500;
        const releasedBefore = allTouchesReleasedAt > 0 && (pt.startTime || 0) < allTouchesReleasedAt && pt.type !== 'pen' && pt.type !== 'mouse';
        if (idle > ttl || releasedBefore) {
            activePointers.delete(pid);
            ignoredPalmPointerIds.delete(pid);
        }
    }
}

function scheduleTouchEndZombieSweep(e) {
    if (touchEndSweepTimer) {
        clearTimeout(touchEndSweepTimer);
        touchEndSweepTimer = null;
    }
    if (typeof setTimeout !== 'function') return;
    const seqSnap = lastCanvasTouchSeq;
    touchEndSweepTimer = setTimeout(() => {
        touchEndSweepTimer = null;
        if (lastCanvasTouchSeq !== seqSnap) return;
        const nowSw = performance.now();
        if (lastNativeTouchCount > 0 && (nowSw - (lastNativeTouchAt || 0)) < 400) return;
        lastNativeTouchCount = 0;
        let clearedAny = false;
        for (const [pid, pt] of Array.from(activePointers.entries())) {
            if (pt.type !== 'pen' && pt.type !== 'mouse') {
                activePointers.delete(pid);
                clearedAny = true;
            }
        }
        if (activePointers.size === 0) {
            if (nativePinchState.active) { nativePinchState.active = false; clearedAny = true; }
            if (nativeSinglePanState.active) { nativeSinglePanState.active = false; nativeSinglePanState.isEdgeSwipe = false; nativeSinglePanState.fromPinchRelease = false; clearedAny = true; }
            if (singleFingerPanState.active) { singleFingerPanState.active = false; singleFingerPanState.isEdgeSwipe = false; clearedAny = true; }
            if (multiTouchTapState.active) { multiTouchTapState.active = false; multiTouchTapState.startPoints?.clear?.(); clearedAny = true; }
            lastPinchDist = null; lastPanMid = null; pinchStartZoom = null; pinchStartMid = null; pinchStartPan = null;
            ignoredPalmPointerIds.clear();
            pendingFinishTouchIds.clear();
            if (clearedAny && typeof renderAll === 'function') renderAll();
        }
    }, 130);
}

// Bộ tự phục hồi cảm ứng thông minh Zero-Idle-CPU (CHỈ hẹn giờ 1 lần khi đang có chạm/vẽ -> 0 lần đánh thức CPU khi rảnh đọc bài!)
let touchStuckWatchdogTimer = null;
function runTouchStuckWatchdogCheck() {
    touchStuckWatchdogTimer = null;
    const hasAnyLock = activePointers.size > 0 || activePenPointerId !== null || activeStrokePointerId !== null ||
        nativePinchState.active || nativeSinglePanState.active || singleFingerPanState.active || multiTouchTapState.active || isDrawing || !!currentInkStroke;
    if (!hasAnyLock) return false;
    const nowW = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
    const idleMs = nowW - (lastAnyInputEventAt || 0);
    const limitMs = (isDrawing || currentInkStroke) ? 2400 : 1400;
    if (idleMs > limitMs) {
        forceFinalizeOrClearActiveInkStroke();
        resetStuckTouchStates();
        if (typeof renderAll === 'function') renderAll();
        return true;
    }
    armTouchStuckWatchdog();
    return false;
}
function armTouchStuckWatchdog() {
    if (touchStuckWatchdogTimer !== null || typeof setTimeout !== 'function') return;
    touchStuckWatchdogTimer = setTimeout(runTouchStuckWatchdogCheck, 1500);
}

function getRawPointerPressure(ev, fallbackP = 0.36) {
    if (!ev) return fallbackP;
    if (ev.pointerType === 'pen' && typeof ev.pressure === 'number' && ev.pressure > 0 && ev.pressure <= 1) {
        return ev.pressure;
    }
    return fallbackP;
}

function stripTransientInkFields(st) {
    if (!st) return;
    delete st.liveTip;
    delete st.snappedShape;
    delete st._liveState;
}

function snapStrokeHookNeighbor(anchor, pt, nextAnchor) {
    const ax = nextAnchor.x - anchor.x, ay = nextAnchor.y - anchor.y;
    const aLen = Math.hypot(ax, ay);
    const pDist = Math.hypot(pt.x - anchor.x, pt.y - anchor.y);
    if (aLen < 3 || pDist > 3.2) return;
    const vx = pt.x - anchor.x, vy = pt.y - anchor.y;
    const dot = (vx * ax + vy * ay) / aLen;
    const cross = Math.abs(vx * ay - vy * ax) / aLen;
    if (dot < -0.15 || cross > 1.35) {
        const u = Math.max(0.18, Math.min(0.62, dot / aLen));
        pt.x = anchor.x + ax * u;
        pt.y = anchor.y + ay * u;
    }
}

function detectTremorSafeCorners(work) {
    const n = work.length;
    const isCorner = new Array(n).fill(false);
    isCorner[0] = true;
    isCorner[n - 1] = true;
    const turnCross = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
        const ax = work[i].x - work[i - 1].x, ay = work[i].y - work[i - 1].y;
        const bx = work[i + 1].x - work[i].x, by = work[i + 1].y - work[i].y;
        turnCross[i] = ax * by - ay * bx;
    }
    for (let i = 1; i < n - 1; i++) {
        let backIdx = i - 1;
        while (backIdx > 0 && Math.hypot(work[i].x - work[backIdx].x, work[i].y - work[backIdx].y) < 7.5 && (i - backIdx) < 4) {
            backIdx--;
        }
        let fwdIdx = i + 1;
        while (fwdIdx < n - 1 && Math.hypot(work[fwdIdx].x - work[i].x, work[fwdIdx].y - work[i].y) < 7.5 && (fwdIdx - i) < 4) {
            fwdIdx++;
        }
        const vbx = work[i].x - work[backIdx].x, vby = work[i].y - work[backIdx].y;
        const vfx = work[fwdIdx].x - work[i].x, vfy = work[fwdIdx].y - work[i].y;
        const lb = Math.hypot(vbx, vby), lf = Math.hypot(vfx, vfy);
        if (lb < 1.2 || lf < 1.2) continue;
        const macroCos = Math.max(-1, Math.min(1, (vbx * vfx + vby * vfy) / (lb * lf)));
        if (macroCos >= -0.10) continue;
        const cCur = turnCross[i];
        const prevOsc = i > 1 && (turnCross[i - 1] * cCur < 0);
        const nxtOsc = i < n - 2 && (turnCross[i + 1] * cCur < 0);
        const dev = Math.hypot(
            work[i].x - (work[backIdx].x + work[fwdIdx].x) * 0.5,
            work[i].y - (work[backIdx].y + work[fwdIdx].y) * 0.5
        );
        if ((prevOsc && nxtOsc && dev < 11.5) || (((i === 1 && nxtOsc) || (i === n - 2 && prevOsc)) && dev < 11.5)) {
            continue;
        }
        isCorner[i] = true;
    }
    return isCorner;
}

function alignStraightStemSubspans(work, isCorner, blendStrength) {
    const n = work.length;
    let startIdx = 0;
    while (startIdx < n - 1) {
        let endIdx = startIdx + 1;
        while (endIdx < n - 1 && !isCorner[endIdx]) endIdx++;
        if (endIdx - startIdx >= 3) {
            const pS = work[startIdx], pE = work[endIdx];
            const dx = pE.x - pS.x, dy = pE.y - pS.y;
            const spanLen = Math.hypot(dx, dy);
            if (spanLen >= 14) {
                const ux = dx / spanLen, uy = dy / spanLen;
                let maxDev = 0;
                for (let k = startIdx + 1; k < endIdx; k++) {
                    const dev = Math.abs((work[k].x - pS.x) * uy - (work[k].y - pS.y) * ux);
                    if (dev > maxDev) maxDev = dev;
                }
                if (maxDev > 0.05 && maxDev <= 3.2 && (maxDev / spanLen) <= 0.068) {
                    for (let k = startIdx + 1; k < endIdx; k++) {
                        const projT = (work[k].x - pS.x) * ux + (work[k].y - pS.y) * uy;
                        const px = pS.x + ux * projT;
                        const py = pS.y + uy * projT;
                        work[k].x += (px - work[k].x) * blendStrength;
                        work[k].y += (py - work[k].y) * blendStrength;
                    }
                }
            }
        }
        startIdx = endIdx;
    }
}

function beautifyInkStrokePoints(pts, options = {}) {
    if (!Array.isArray(pts) || pts.length < 3) return pts;

    const clean = [{ ...pts[0] }];
    for (let i = 1; i < pts.length - 1; i++) {
        const prev = clean[clean.length - 1];
        if (Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y) >= 0.95) {
            clean.push({ ...pts[i] });
        }
    }
    clean.push({ ...pts[pts.length - 1] });
    if (clean.length < 4) return clean;

    const autoRefine = options.autoRefine !== false && (typeof appLibrary === 'undefined' || appLibrary.penAutoRefine !== false);
    const smoothVal = typeof options.smoothing === 'number'
        ? Math.max(0, Math.min(0.95, options.smoothing))
        : (typeof penSmoothing === 'number' ? Math.max(0, Math.min(0.95, penSmoothing)) : 0.50);
    if (!autoRefine || smoothVal <= 0.01) return clean;

    const work = clean.map(p => ({ ...p }));
    const n = work.length;
    if (n >= 4) {
        snapStrokeHookNeighbor(work[0], work[1], work[2]);
        snapStrokeHookNeighbor(work[n - 1], work[n - 2], work[n - 3]);
    }

    const isCorner = detectTremorSafeCorners(work);
    const eff = Math.max(0.08, smoothVal);
    // Hậu xử lý nhẹ tay tinh tế kiểu Notewise: khử rung tay vi mô mà giữ 99% dáng chữ tự nhiên (không nhảy chữ khi nhấc bút)
    const lam = Math.min(0.52, 0.16 + eff * 0.34);
    const mu = -lam * 0.58;
    const passes = [lam, mu, lam * 0.48];

    // Taubin pull-push theo chiều dài cung: triệt tiêu răng cưa lởm chởm mà giữ nguyên bụng chữ tròn
    for (let p = 0; p < passes.length; p++) {
        const factor = passes[p];
        const snap = work.map(pt => ({ x: pt.x, y: pt.y }));
        for (let i = 1; i < n - 1; i++) {
            if (isCorner[i]) continue;
            const prev = snap[i - 1], cur = snap[i], nxt = snap[i + 1];
            const la = Math.hypot(cur.x - prev.x, cur.y - prev.y);
            const lb = Math.hypot(nxt.x - cur.x, nxt.y - cur.y);
            const lSum = la + lb;
            if (lSum < 0.05) continue;
            const targetX = (prev.x * lb + nxt.x * la) / lSum;
            const targetY = (prev.y * lb + nxt.y * la) / lSum;
            work[i].x = cur.x + (targetX - cur.x) * factor;
            work[i].y = cur.y + (targetY - cur.y) * factor;
        }
    }

    alignStraightStemSubspans(work, isCorner, Math.min(0.45, 0.18 + eff * 0.26));

    for (let i = 1; i < n - 1; i++) {
        if (typeof work[i].p === 'number' && typeof work[i - 1].p === 'number' && typeof work[i + 1].p === 'number') {
            work[i].p = work[i].p * 0.50 + (work[i - 1].p + work[i + 1].p) * 0.25;
        }
    }
    return work;
}

function beautifyHighlighterStrokePoints(pts, width = 14) {
    if (!Array.isArray(pts) || pts.length < 2) return pts;
    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];
    const dx = pEnd.x - pStart.x;
    const dy = pEnd.y - pStart.y;
    const chordLen = Math.hypot(dx, dy);

    let totalLen = 0;
    let maxDev = 0;
    let sumX = pStart.x;
    let sumY = pStart.y;
    for (let i = 1; i < pts.length; i++) {
        totalLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        sumX += pts[i].x;
        sumY += pts[i].y;
        if (i < pts.length - 1 && chordLen > 1) {
            const dev = Math.abs((pts[i].x - pStart.x) * dy - (pts[i].y - pStart.y) * dx) / chordLen;
            if (dev > maxDev) maxDev = dev;
        }
    }

    // 1. Nét tô dạ quang kéo ngang/dọc/chéo qua dòng chữ (Chuẩn Notewise / Goodnotes 6):
    // Tự nắn thành thanh Pill phẳng mượt tuyệt đối, không bị lượn sóng hay răng cưa!
    const straightTol = Math.max(8.5, Math.min((width || 14) * 0.68, chordLen * 0.095));
    if (chordLen >= 18 && totalLen <= chordLen * 1.15 && maxDev <= straightTol) {
        const ang = Math.atan2(dy, dx);
        const absAng = Math.abs(ang);
        const avgX = sumX / pts.length;
        const avgY = sumY / pts.length;
        // Tự cân phẳng ngang nếu góc lệch trong khoảng ±6.8° so với phương ngang
        if (absAng <= 0.118 || Math.abs(absAng - Math.PI) <= 0.118) {
            return [
                { x: pStart.x, y: Number(avgY.toFixed(2)) },
                { x: pEnd.x, y: Number(avgY.toFixed(2)) }
            ];
        }
        // Tự cân thẳng đứng nếu góc lệch trong khoảng ±6.8° so với phương dọc
        if (Math.abs(absAng - Math.PI * 0.5) <= 0.118) {
            return [
                { x: Number(avgX.toFixed(2)), y: pStart.y },
                { x: Number(avgX.toFixed(2)), y: pEnd.y }
            ];
        }
        return [
            { x: pStart.x, y: pStart.y },
            { x: pEnd.x, y: pEnd.y }
        ];
    }

    // 2. Nét tô dạ quang lượn cong hoặc khoanh vùng:
    // Lọc bỏ mọi điểm vi mô quá sát (< 0.24 * width) gây gấp khúc CoreGraphics & làm mượt trục tâm 3 lượt
    const minDist = Math.max(2.6, Math.min(7.5, (width || 14) * 0.24));
    const clean = [{ x: pStart.x, y: pStart.y }];
    for (let i = 1; i < pts.length - 1; i++) {
        const prev = clean[clean.length - 1];
        if (Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y) >= minDist) {
            clean.push({ x: pts[i].x, y: pts[i].y });
        }
    }
    const lastPrev = clean[clean.length - 1];
    if (clean.length >= 2 && Math.hypot(pEnd.x - lastPrev.x, pEnd.y - lastPrev.y) < minDist * 0.55) {
        clean[clean.length - 1] = { x: pEnd.x, y: pEnd.y };
    } else if (Math.hypot(pEnd.x - lastPrev.x, pEnd.y - lastPrev.y) >= 0.2) {
        clean.push({ x: pEnd.x, y: pEnd.y });
    }
    if (clean.length <= 2) return clean;

    const passes = [0.38, -0.18, 0.28];
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

let lastEcoInkRenderTs = 0;
let lastEcoViewportRenderTs = 0;

function scheduleInkRender() {
    if (typeof requestAnimationFrame !== 'function') {
        renderAll();
        return;
    }
    if (inkRenderRafId !== null) return;
    inkRenderRafId = requestAnimationFrame((rafTs) => {
        inkRenderRafId = null;
        if (typeof isBatterySaverActive === 'function' && isBatterySaverActive()) {
            const nowT = typeof rafTs === 'number' && rafTs > 0 ? rafTs : performance.now();
            if ((nowT - lastEcoInkRenderTs) < 15.5) {
                scheduleInkRender();
                return;
            }
            lastEcoInkRenderTs = nowT;
        }
        renderAll();
    });
}

let viewportRenderRafId = null;
function scheduleViewportRender() {
    if (typeof requestAnimationFrame !== 'function') {
        if (typeof isReadMode === 'undefined' || !isReadMode) {
            const rectPan = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : canvas.getBoundingClientRect();
            autoDetectPageFromScreenY(rectPan.top + rectPan.height * 0.45);
        }
        if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
        updateRingTransformFloatingBarPos(); updateImageFloatingBarPos(); updateChainFloatingBarPos(); updateLassoFloatingBarPos();
        renderAll();
        return;
    }
    if (viewportRenderRafId !== null) return;
    viewportRenderRafId = requestAnimationFrame((rafTs) => {
        viewportRenderRafId = null;
        if (typeof isBatterySaverActive === 'function' && isBatterySaverActive()) {
            const nowT = typeof rafTs === 'number' && rafTs > 0 ? rafTs : performance.now();
            if ((nowT - lastEcoViewportRenderTs) < 15.5) {
                scheduleViewportRender();
                return;
            }
            lastEcoViewportRenderTs = nowT;
        }
        if (typeof isReadMode === 'undefined' || !isReadMode) {
            const rectPan = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : canvas.getBoundingClientRect();
            autoDetectPageFromScreenY(rectPan.top + rectPan.height * 0.45);
        }
        if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
        updateRingTransformFloatingBarPos(); updateImageFloatingBarPos(); updateChainFloatingBarPos(); updateLassoFloatingBarPos();
        renderAll();
    });
}

function cancelScheduledInkRender() {
    if (inkRenderRafId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(inkRenderRafId);
    }
    inkRenderRafId = null;
}

let isCursorOutsidePaper = false;

function getActivePageBoundsSize() {
    const pg = typeof getActivePage === 'function' ? getActivePage() : null;
    const cfg = (pg && typeof getPagePaperConfig === 'function') ? getPagePaperConfig(pg) : null;
    return {
        w: (cfg && cfg.width) || (typeof A4_WIDTH === 'number' ? A4_WIDTH : 794),
        h: (cfg && cfg.height) || (typeof A4_HEIGHT === 'number' ? A4_HEIGHT : 1123)
    };
}

function isWorldPointOnPaper(pt) {
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return false;
    const sz = getActivePageBoundsSize();
    return pt.x >= 0 && pt.x <= sz.w && pt.y >= 0 && pt.y <= sz.h;
}

function clampWorldPointToPaper(pt, pad = 1) {
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return pt;
    const sz = getActivePageBoundsSize();
    const p = Math.max(0, pad);
    return {
        ...pt,
        x: Math.max(p, Math.min(sz.w - p, pt.x)),
        y: Math.max(p, Math.min(sz.h - p, pt.y))
    };
}

function updateCanvasCursor() {
    if (!canvas || !canvas.classList) return;
    const dragging = !!(
        (typeof mousePanState !== 'undefined' && mousePanState.active) ||
        (typeof readPanState !== 'undefined' && readPanState.active)
    );
    const canGrab = !dragging && (
        (typeof spacePanPressed !== 'undefined' && spacePanPressed) ||
        window.unifiedTool === 'pen_pan' ||
        (typeof isReadMode !== 'undefined' && isReadMode)
    );
    canvas.classList.toggle('cursor-grabbing', dragging);
    canvas.classList.toggle('cursor-grab', canGrab);
    if (canvas.style) {
        canvas.style.cursor = (!dragging && !canGrab && isCursorOutsidePaper) ? 'default' : '';
    }
}

let rxnArrowHoldTimer = null;
let rxnArrowHoldPos = null;
let rxnArrowHoldSnapped = false;

function cancelRxnArrowHoldTimer() {
    if (rxnArrowHoldTimer) {
        clearTimeout(rxnArrowHoldTimer);
        rxnArrowHoldTimer = null;
    }
}

function resetStuckTouchStates() {
    cancelRxnArrowHoldTimer();
    cancelAtomHoldTimer(true);
    cancelInkHoldTimer();
    cancelScheduledInkRender();
    rxnArrowHoldPos = null;
    rxnArrowHoldSnapped = false;
    stopPanInertia();
    activePointers.clear();
    ignoredPalmPointerIds.clear();
    pendingFinishTouchIds.clear();
    nativePinchState.active = false;
    nativePinchState.zoomChanged = false;
    nativeSinglePanState.active = false;
    nativeSinglePanState.isEdgeSwipe = false;
    nativeSinglePanState.fromPinchRelease = false;
    lastNativeTouchCount = 0;
    touchPalmBuffer = { dx: 0, dy: 0, at: 0 };
    if (touchEndSweepTimer) {
        clearTimeout(touchEndSweepTimer);
        touchEndSweepTimer = null;
    }
    activePenPointerId = null;
    activeStrokePointerId = null;
    isDrawing = false;
    currentInkStroke = null;
    currentLaserStroke = null;
    activeMoveTarget = null;
    activeExtraDragItem = null;
    dragStartAtom = null;
    dragStartPos = null;
    previewChainPoints = [];
    lassoSelection.dragging = false;
    activeRingGizmo.dragMode = null;
    activeImageSelection.dragMode = null;
    document.body?.classList?.remove('is-drawing-canvas');
    singleFingerPanState.active = false;
    singleFingerPanState.isEdgeSwipe = false;
    readPanState.active = false;
    if (typeof mousePanState !== 'undefined') {
        mousePanState.active = false;
        mousePanState.pointerId = null;
        mousePanState.button = -1;
    }
    multiTouchTapState.active = false;
    multiTouchTapState.maxPointers = 0;
    multiTouchTapState.movedFar = false;
    multiTouchTapState.zoomChanged = false;
    multiTouchTapState.startPoints?.clear?.();
    lastPinchDist = null;
    lastPanMid = null;
    pinchStartZoom = null;
    pinchStartMid = null;
    pinchStartPan = null;
    updateCanvasCursor();
}

let pointerDownAtomHitId = null;
let pointerDownBondHitId = null;
let pointerDownCreatedAtomId = null;
let pointerDownIsStylusTap = false;
let lastCanvasTouchSeq = 0;
let bondTapHandledInDown = false;

function rollbackTapSnapshot(preSnap, preSeq, preRedo) {
    if (!preSnap) return;
    getActivePage().content = typeof restorePageContentSnapshot === 'function'
        ? restorePageContentSnapshot(preSnap)
        : JSON.parse(preSnap);
    const toPop = Math.min(undoStack.length, Math.max(0, undoPushSeq - (preSeq || 0)));
    for (let i = 0; i < toPop; i++) undoStack.pop();
    if (Array.isArray(preRedo)) redoStack = preRedo.slice();
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
}

function tryHandleBondDoubleTap(bondId, nowMs, clientX, clientY, preSnap = null, preSeq = 0, preRedo = null) {
    if (!bondId) return null;
    lastCanvasTapInfo.time = 0;
    const isDouble = lastBondTapInfo.bondId === bondId &&
        (nowMs - (lastBondTapInfo.time || 0)) < 480 &&
        Math.hypot(clientX - (lastBondTapInfo.clientX || 0), clientY - (lastBondTapInfo.clientY || 0)) < 32;
    if (isDouble) {
        const snap = lastBondTapInfo.preTapSnapshot;
        const seq = lastBondTapInfo.preTapPushSeq;
        const redoSnap = lastBondTapInfo.preTapRedoSnapshot;
        lastBondTapInfo = { bondId: null, time: 0, clientX: 0, clientY: 0, preTapSnapshot: null, preTapPushSeq: 0, preTapRedoSnapshot: null };
        if (snap) rollbackTapSnapshot(snap, seq, redoSnap);
        const docNow = getDocState();
        const bondNow = (docNow.bonds || []).find(b => b.id === bondId);
        if (bondNow) promoteBondOnDoubleTap(bondNow, docNow);
        return 'double';
    }
    lastBondTapInfo = {
        bondId, time: nowMs, clientX, clientY,
        preTapSnapshot: preSnap, preTapPushSeq: preSeq, preTapRedoSnapshot: preRedo
    };
    selectedBondId = bondId;
    if (typeof renderAll === 'function') renderAll();
    return 'single';
}

function tryHandleAtomDoubleTap(atomId, nowMs, clientX, clientY, preSnap = null, preSeq = 0, preRedo = null) {
    if (!atomId) return null;
    lastCanvasTapInfo.time = 0;
    const isDouble = lastAtomTapInfo.atomId === atomId &&
        (nowMs - (lastAtomTapInfo.time || 0)) < 480 &&
        Math.hypot(clientX - (lastAtomTapInfo.clientX || 0), clientY - (lastAtomTapInfo.clientY || 0)) < 38;
    if (isDouble) {
        const snap = lastAtomTapInfo.preTapSnapshot;
        const seq = lastAtomTapInfo.preTapPushSeq;
        const redoSnap = lastAtomTapInfo.preTapRedoSnapshot;
        lastAtomTapInfo = { atomId: null, x: 0, y: 0, time: 0, clientX: 0, clientY: 0, preTapSnapshot: null, preTapPushSeq: 0, preTapRedoSnapshot: null };
        lastBondTapInfo.bondId = null;
        selectedBondId = null;
        isDrawing = false;
        currentInkStroke = null;
        dragStartAtom = null; dragStartPos = null; previewChainPoints = [];
        activeMoveTarget = null;
        cancelAtomHoldTimer(true);
        if (snap) rollbackTapSnapshot(snap, seq, redoSnap);
        const docNow = getDocState();
        const atomNow = (docNow.atoms || []).find(a => a.id === atomId);
        if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(300); else persistLibrary();
        renderAll();
        if (atomNow && typeof openAtomHandwritingBox === 'function') {
            openAtomHandwritingBox(atomNow);
        }
        return 'double';
    }
    lastAtomTapInfo = {
        atomId, x: 0, y: 0, time: nowMs, clientX, clientY,
        preTapSnapshot: preSnap, preTapPushSeq: preSeq, preTapRedoSnapshot: preRedo
    };
    return 'single';
}

canvas.addEventListener('pointerdown', e => {
    lastCanvasTouchSeq++;
    stopPanInertia();
    closeAllPopovers();
    if (typeof getFastCanvasRect === 'function') getFastCanvasRect(true);
    else if (typeof refreshCanvasRect === 'function') refreshCanvasRect();
    const nowMs = performance.now();
    lastAnyInputEventAt = nowMs;
    armTouchStuckWatchdog();
    const rawW = e.width || 0, rawH = e.height || 0;
    const ipadCfg = (typeof appLibrary !== 'undefined' && appLibrary?.ipadConfig) ? appLibrary.ipadConfig : {};
    const hasCustomPressure = typeof e.pressure === 'number' && e.pressure > 0 && e.pressure !== 0.5;
    // Trên iPadOS Safari, ngón tay thật báo e.width=1, e.height=1 -> tuyệt đối KHÔNG nhận nhầm ngón tay 1px là bút stylus!
    const isFineChinaStylus = !!(
        e.pointerType === 'touch' &&
        ipadCfg.stylusFineTipAutoDraw !== false &&
        window.unifiedTool !== 'pen_pan' &&
        hasCustomPressure &&
        rawW <= 12 && rawH <= 12
    );

    // QUAN TRỌNG: Một pointerdown mới LUÔN là lần chạm mới (WebKit tái sử dụng pointerId sau ~50-80 nét!).
    // Tuyệt đối không dùng blacklist cũ để chặn pointerdown mới!
    ignoredPalmPointerIds.delete(e.pointerId);
    pendingFinishTouchIds.delete(e.pointerId);

    pointerDownAtomHitId = null;
    pointerDownBondHitId = null;
    pointerDownCreatedAtomId = null;
    pointerDownIsStylusTap = false;
    bondTapHandledInDown = false;

    reconcileActiveTouchPointers(nowMs);
    if (activePenPointerId !== null && (
        !activePointers.has(activePenPointerId) ||
        (nowMs - lastPenActivityAt) > 650 ||
        (e.pointerType === 'touch' && !isDrawing && !activeMoveTarget && !activeExtraDragItem && !dragStartAtom && (nowMs - lastPenActivityAt) > 180)
    )) {
        if (isDrawing || currentInkStroke) forceFinalizeOrClearActiveInkStroke();
        activePointers.delete(activePenPointerId);
        activePenPointerId = null;
    }
    if (activePointers.size === 0 && (multiTouchTapState.active || singleFingerPanState.active || readPanState.active || nativePinchState.active || isDrawing || currentInkStroke)) {
        if (isDrawing || currentInkStroke) forceFinalizeOrClearActiveInkStroke();
        multiTouchTapState.active = false;
        multiTouchTapState.startPoints?.clear?.();
        singleFingerPanState.active = false;
        singleFingerPanState.isEdgeSwipe = false;
        readPanState.active = false;
        if (!lastNativeTouchCount || (nowMs - lastNativeTouchAt) > 350) nativePinchState.active = false;
        if (typeof mousePanState !== 'undefined') {
            mousePanState.active = false;
            mousePanState.pointerId = null;
        }
    }

    const isMouseInput = !e.pointerType || e.pointerType === 'mouse';
    const isMousePanTrigger = isMouseInput && (
        e.button === 1 ||
        e.button === 2 ||
        (e.button === 0 && (spacePanPressed || window.unifiedTool === 'pen_pan'))
    );
    if (isMousePanTrigger) {
        if (e.button === 2 && typeof e.preventDefault === 'function') e.preventDefault();
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, w: rawW, h: rawH, type: e.pointerType || 'mouse', isFineStylus: false, startTime: nowMs, lastTime: nowMs });
        mousePanState = {
            active: true,
            pointerId: e.pointerId,
            button: e.button,
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            startTime: nowMs,
            moved: false
        };
        updateCanvasCursor();
        return;
    }

    if (e.pointerType === 'pen') {
        if (nativeSinglePanState.active && typeof nativeSinglePanState.startPanX === 'number' &&
            (nowMs - (nativeSinglePanState.startTime || 0)) < 280 &&
            Math.hypot(panX - nativeSinglePanState.startPanX, panY - nativeSinglePanState.startPanY) < 48) {
            panX = nativeSinglePanState.startPanX;
            panY = nativeSinglePanState.startPanY;
            clampViewportPanAndZoom();
        } else if (singleFingerPanState.active && typeof singleFingerPanState.startPanX === 'number' &&
            (nowMs - (singleFingerPanState.startTime || 0)) < 280 &&
            Math.hypot(panX - singleFingerPanState.startPanX, panY - singleFingerPanState.startPanY) < 48) {
            panX = singleFingerPanState.startPanX;
            panY = singleFingerPanState.startPanY;
            clampViewportPanAndZoom();
        } else if (touchPalmBuffer.at && (nowMs - touchPalmBuffer.at) < 280 && Math.hypot(touchPalmBuffer.dx, touchPalmBuffer.dy) < 42) {
            panX -= touchPalmBuffer.dx;
            panY -= touchPalmBuffer.dy;
            clampViewportPanAndZoom();
        }
        touchPalmBuffer = { dx: 0, dy: 0, at: 0 };
        nativeSinglePanState.active = false;
        nativeSinglePanState.isEdgeSwipe = false;
        nativeSinglePanState.fromPinchRelease = false;
        // Apple Pencil luôn ưu tiên tuyệt đối: kết thúc dứt khoát mọi trạng thái cũ để không bao giờ bị đơ
        if (isDrawing || currentInkStroke) {
            forceFinalizeOrClearActiveInkStroke();
        }
        activeMoveTarget = null;
        activeExtraDragItem = null;
        dragStartAtom = null;
        dragStartPos = null;
        previewChainPoints = [];
        lastPenActivityAt = nowMs;
        lastPenHoverAt = nowMs;
        activePenPointerId = e.pointerId;
        nativePinchState.active = false;
        nativePinchState.zoomChanged = false;
        lastNativeTouchCount = 0;
        for (const [pid, pt] of Array.from(activePointers.entries())) {
            if (pid !== e.pointerId) {
                if (pt.type === 'touch' && !pt.isFineStylus) ignoredPalmPointerIds.set(pid, nowMs);
                activePointers.delete(pid);
            }
        }
        singleFingerPanState.active = false;
        singleFingerPanState.isEdgeSwipe = false;
        readPanState.active = false;
        if (typeof mousePanState !== 'undefined') mousePanState.active = false;
        multiTouchTapState.active = false;
        multiTouchTapState.startPoints?.clear?.();
    } else if (e.pointerType === 'touch') {
        // Đồng bộ phần cứng iOS: nếu phần cứng báo đúng 1 ngón trên kính thì mọi touch ID cũ trong activePointers đều là zombie!
        if (lastNativeTouchCount === 1 && (nowMs - lastNativeTouchAt) < 150) {
            nativePinchState.active = false;
            for (const [pid, pt] of Array.from(activePointers.entries())) {
                if (pid !== e.pointerId && pt.type === 'touch') {
                    activePointers.delete(pid);
                }
            }
        }
        if (isFineChinaStylus) {
            // Một người chỉ cầm 1 bút đầu nhỏ: dọn mọi zombie fine-stylus cũ để không kích hoạt nhầm 2 ngón
            for (const [pid, pt] of Array.from(activePointers.entries())) {
                if (pid !== e.pointerId && pt.isFineStylus) {
                    activePointers.delete(pid);
                }
            }
            if (isDrawing || currentInkStroke) {
                forceFinalizeOrClearActiveInkStroke();
            }
            lastPenActivityAt = nowMs;
            nativePinchState.active = false;
        }
        if (activePenPointerId !== null) {
            ignoredPalmPointerIds.set(e.pointerId, nowMs);
            return;
        }
        const palmRejectOn = ipadCfg.palmRejection !== false;
        const activeFineStylus = Array.from(activePointers.values()).some(pt => pt.isFineStylus === true);
        const hasActiveStylusDraw = isDrawing && currentInkStroke && (activePenPointerId !== null || activeFineStylus);
        const strokeElapsedMs = nowMs - (pointerDownTime || nowMs);
        const strokeCommittedMove = pointerMaxMoveDist > 16 || (strokeElapsedMs > 260 && pointerMaxMoveDist > 6);
        const incomingLooksPalm = rawW > 28 || rawH > 28;

        if (palmRejectOn && hasActiveStylusDraw && !isFineChinaStylus && (
            (activePenPointerId !== null && (incomingLooksPalm || rawW === 0)) ||
            (activeFineStylus && (strokeCommittedMove || (strokeElapsedMs > 60 && incomingLooksPalm) || rawW > 48 || rawH > 48))
        )) {
            ignoredPalmPointerIds.set(e.pointerId, nowMs);
            return;
        }
        if ((nowMs - lastPenActivityAt) < 55 && lastNativeTouchCount < 2 && !isFineChinaStylus && (rawW > 36 || rawH > 36)) {
            ignoredPalmPointerIds.set(e.pointerId, nowMs);
            return;
        }
        const pinchCandidate = (!isDrawing || (strokeElapsedMs < 70 && pointerMaxMoveDist < 14)) && (lastNativeTouchCount >= 2 || activePointers.size >= 1);
        if (palmRejectOn && !isFineChinaStylus) {
            if (!pinchCandidate && ((nowMs - lastPenHoverAt) < 1200 || (nowMs - lastPenActivityAt) < 1200) && (rawW > 72 || rawH > 72)) {
                ignoredPalmPointerIds.set(e.pointerId, nowMs);
                return;
            }
            const maxPalmLimit = pinchCandidate ? 120 : 78;
            if (rawW > maxPalmLimit || rawH > maxPalmLimit) {
                ignoredPalmPointerIds.set(e.pointerId, nowMs);
                return;
            }
        }
        if (palmRejectOn && isFineChinaStylus && activePointers.size >= 1) {
            for (const [pid, pt] of Array.from(activePointers.entries())) {
                const isStationaryZero = (pt.w || 0) === 0 && (nowMs - (pt.startTime || nowMs)) > 120 && Math.hypot((pt.x || 0) - (pt.startX || 0), (pt.y || 0) - (pt.startY || 0)) < 6;
                const looksLikePalm = pt.type === 'touch' && !pt.isFineStylus && ((pt.w || 0) > 36 || (pt.h || 0) > 36 || isStationaryZero);
                if (looksLikePalm) {
                    ignoredPalmPointerIds.set(pid, nowMs);
                    activePointers.delete(pid);
                }
            }
        }
    }

    activePointers.set(e.pointerId, {
        x: e.clientX, y: e.clientY,
        startX: e.clientX, startY: e.clientY,
        w: rawW, h: rawH,
        type: e.pointerType || '',
        isFineStylus: isFineChinaStylus,
        startTime: nowMs, lastTime: nowMs
    });
    if (activePointers.size >= 2) {
        cancelScheduledInkRender();
        cancelAtomHoldTimer(true);
        cancelInkHoldTimer();
        if (typeof cancelRxnArrowHoldTimer === 'function') cancelRxnArrowHoldTimer();
        document.body?.classList?.remove('is-drawing-canvas');
        singleFingerPanState.active = false;
        if (typeof mousePanState !== 'undefined') {
            mousePanState.active = false;
            mousePanState.pointerId = null;
        }
        if (typeof updateCanvasCursor === 'function') updateCanvasCursor();
        isDrawing = false; currentInkStroke = null; activeStrokePointerId = null; currentLaserStroke = null;
        dragStartAtom = null; dragStartPos = null; previewChainPoints = [];
        activeMoveTarget = null; activeExtraDragItem = null;
        pointerDownEligibleForDoubleTap = false;
        lastCanvasTapInfo.time = 0;

        if (!multiTouchTapState.active) {
            multiTouchTapState.active = true;
            multiTouchTapState.maxPointers = activePointers.size;
            multiTouchTapState.startTime = pointerDownTime || performance.now();
            multiTouchTapState.movedFar = pointerMaxMoveDist > 14;
            multiTouchTapState.zoomChanged = false;
            multiTouchTapState.startPoints = new Map();
            const ptrArr = Array.from(activePointers.values());
            multiTouchTapState.startMid = ptrArr.length >= 2
                ? { x: (ptrArr[0].x + ptrArr[1].x) / 2, y: (ptrArr[0].y + ptrArr[1].y) / 2 }
                : null;
            multiTouchTapState.endMid = multiTouchTapState.startMid ? { ...multiTouchTapState.startMid } : null;
            for (const [pid, pt] of activePointers.entries()) {
                multiTouchTapState.startPoints.set(pid, { x: pt.x, y: pt.y });
            }
            if (pointerDownSnapshot && (performance.now() - (pointerDownTime || 0)) < 170 && pointerMaxMoveDist < 12) {
                getActivePage().content = typeof restorePageContentSnapshot === 'function'
                    ? restorePageContentSnapshot(pointerDownSnapshot)
                    : JSON.parse(pointerDownSnapshot);
                const toPop = Math.min(undoStack.length, Math.max(0, undoPushSeq - pointerDownPushSeq));
                for (let pIdx = 0; pIdx < toPop; pIdx++) undoStack.pop();
                if (pointerDownRedoSnapshot) {
                    redoStack = pointerDownRedoSnapshot.slice();
                }
                pointerDownSnapshot = null;
                pointerDownRedoSnapshot = null;
                if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
                if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(400); else persistLibrary();
                renderAll();
            }
        } else {
            multiTouchTapState.maxPointers = Math.max(multiTouchTapState.maxPointers, activePointers.size);
            multiTouchTapState.startPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (activePointers.size === 2) {
            const pts = Array.from(activePointers.values());
            lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            lastPanMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
            pinchStartZoom = zoom;
            pinchStartMid = { x: lastPanMid.x, y: lastPanMid.y };
            pinchStartPan = { x: panX, y: panY };
        } else {
            lastPinchDist = null;
            lastPanMid = null;
            pinchStartZoom = null;
            pinchStartMid = null;
            pinchStartPan = null;
        }
        if (typeof isReadMode !== 'undefined' && isReadMode) {
            multiTouchTapState.movedFar = true;
            readPanState.active = false;
        }
        return;
    }

    if (typeof isReadMode !== 'undefined' && isReadMode) {
        if (activePointers.size === 1) {
            readPanState = { active: true, pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
        }
        return;
    }

    if (activePointers.size === 1 && e.pointerType === 'touch' && !isFineChinaStylus) {
        const rectEdge = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : canvas.getBoundingClientRect();
        const canvasW = rectEdge.width || cssWidth || 800;
        const localTouchX = e.clientX - (rectEdge.left || 0);
        const isLeftHanded = ipadCfg.handedness === 'left';
        const nearDrawerEdge = ipadCfg.edgeSwipeExamDrawer !== false && (
            (!isLeftHanded && localTouchX >= canvasW - 28) ||
            (isLeftHanded && localTouchX <= 28)
        );
        if (nearDrawerEdge) {
            singleFingerPanState = {
                active: true, pointerId: e.pointerId,
                startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY,
                startTime: performance.now(), isEdgeSwipe: true
            };
            return;
        }
        const sfMode = window.unifiedTool === 'pen_pan'
            ? 'pan'
            : (ipadCfg.singleFingerMode || 'pan');
        if (sfMode === 'ignore') {
            pointerDownTime = performance.now();
            pointerMaxMoveDist = 0;
            pointerDownSnapshot = null;
            return;
        }
        if (sfMode === 'pan') {
            const touchW = screenToWorld(e.clientX, e.clientY);
            const curSelImg = getSelectedImageObj();
            const hitsSelImg = !!(curSelImg && !curSelImg.locked && (
                Math.hypot(touchW.x - (curSelImg.x + curSelImg.w), touchW.y - (curSelImg.y + curSelImg.h)) < 24 ||
                (touchW.x >= curSelImg.x && touchW.x <= curSelImg.x + curSelImg.w && touchW.y >= curSelImg.y && touchW.y <= curSelImg.y + curSelImg.h)
            ));
            const hitsRingGizmo = !!(activeRingGizmo.active && (
                Math.hypot(touchW.x - (activeRingGizmo.cx + activeRingGizmo.radius), touchW.y - activeRingGizmo.cy) < 24 ||
                Math.hypot(touchW.x - activeRingGizmo.cx, touchW.y - activeRingGizmo.cy) < activeRingGizmo.radius
            ));
            const hitsLassoBox = !!(lassoSelection.active && lassoSelection.bounds &&
                touchW.x >= lassoSelection.bounds.minX && touchW.x <= lassoSelection.bounds.maxX &&
                touchW.y >= lassoSelection.bounds.minY && touchW.y <= lassoSelection.bounds.maxY);

            if (!hitsSelImg && !hitsRingGizmo && !hitsLassoBox) {
                pointerDownTime = performance.now();
                pointerMaxMoveDist = 0;
                pointerDownSnapshot = null;
                singleFingerPanState = {
                    active: true, pointerId: e.pointerId,
                    startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY,
                    startPanX: panX, startPanY: panY,
                    startWorld: touchW,
                    startTime: performance.now(), lastMoveTime: performance.now(), velX: 0, velY: 0,
                    panActivated: false, isEdgeSwipe: false
                };
                return;
            }
            // If finger hits an active selection, ensure Lasso drag works regardless of current tool
            if (hitsLassoBox && !hitsSelImg && !hitsRingGizmo) {
                saveHistorySnapshot();
                lassoSelection.dragging = true;
                lassoSelection.lastDragPos = touchW;
                return;
            }
        }
    }

    autoDetectPageFromScreenY(e.clientY);

    const localW = screenToWorld(e.clientX, e.clientY);
    const doc = getDocState();
    if (typeof atomHwPinned !== 'undefined' && atomHwPinned && typeof atomHwState !== 'undefined' && atomHwState.open) {
        const pinAtom = findNearestAtom(localW.x, localW.y, 26);
        if (pinAtom) {
            atomHwState.atomId = pinAtom.id;
            atomHwState.stampWorldPos = null;
            window.lastActiveChemAtomId = pinAtom.id;
            const bEl = document.getElementById('atomHwTargetBadge');
            if (bEl) bEl.textContent = pinAtom.label || 'C';
        }
    }
    const selImg = getSelectedImageObj();

    if (activePointers.size === 1 && e.pointerType === 'touch' && ipadCfg.singleFingerMode === 'laser') {
        isDrawing = true;
        document.body?.classList?.add('is-drawing-canvas');
        currentLaserStroke = { points: [localW], createdAt: performance.now() };
        startLaserLoop();
        return;
    }

    if (activePointers.size === 1) {
        const curTool = window.unifiedTool;
        const preHitBond = findHitBondInterior(localW.x, localW.y, 16);
        const preHitAtom = !preHitBond ? findNearestAtom(localW.x, localW.y, 20) : null;
        pointerDownBondHitId = preHitBond ? preHitBond.id : null;
        pointerDownAtomHitId = preHitAtom ? preHitAtom.id : null;
        const sfEffectiveMode = ipadCfg.singleFingerMode || 'pan';
        pointerDownIsStylusTap = !!(
            e.pointerType === 'pen' ||
            isMouseInput ||
            (e.pointerType === 'touch' && sfEffectiveMode === 'draw')
        );
        const isContinuingEmptyDoubleTap = !!(
            lastCanvasTapInfo.time &&
            (performance.now() - lastCanvasTapInfo.time) < 380 &&
            Math.hypot(e.clientX - lastCanvasTapInfo.clientX, e.clientY - lastCanvasTapInfo.clientY) < (pointerDownIsStylusTap ? 14 : 28)
        );
        const noActiveOverlay = !selImg && !lassoSelection.active && (!activeRingGizmo.active || isContinuingEmptyDoubleTap);
        const primaryBtn = (e.pointerType && e.pointerType !== 'mouse') || e.button === 0;
        const dblEnabled = (ipadCfg.doubleTapAction || 'eraser') !== 'off';
        pointerDownClientPos = { x: e.clientX, y: e.clientY };
        pointerDownTime = performance.now();
        pointerMaxMoveDist = 0;
        pointerDownSnapshot = typeof clonePageContentSnapshot === 'function'
            ? clonePageContentSnapshot(doc, false)
            : JSON.stringify(doc);
        pointerDownPushSeq = undoPushSeq;
        pointerDownRedoSnapshot = redoStack.slice();
        const isPenInkTool = e.pointerType === 'pen' && (curTool === 'pen_ballpoint' || curTool === 'pen_highlighter');
        const isStylusSubTriggerTool = pointerDownIsStylusTap && ['chem_bond', 'chem_wedge', 'chem_dash', 'chem_group', 'chem_move', 'chem_ring'].includes(curTool);
        pointerDownEligibleForDoubleTap = !!(
            primaryBtn && !isPenInkTool && noActiveOverlay &&
            !pointerDownBondHitId && !pointerDownAtomHitId &&
            curTool !== 'chem_text' && curTool !== 'pen_image' &&
            (isStylusSubTriggerTool || (dblEnabled && (curTool.startsWith('pen_') || isEmptyCanvasAt(localW, doc) || isContinuingEmptyDoubleTap)))
        );
    }

    if (selImg) {
        if (!selImg.locked && Math.hypot(localW.x - (selImg.x + selImg.w), localW.y - (selImg.y + selImg.h)) < 20) {
            saveHistorySnapshot();
            activeImageSelection.dragMode = 'resize';
            activeImageSelection.startMouse = localW;
            activeImageSelection.origW = selImg.w;
            activeImageSelection.origH = selImg.h;
            return;
        }
        if (localW.x >= selImg.x && localW.x <= selImg.x + selImg.w && localW.y >= selImg.y && localW.y <= selImg.y + selImg.h) {
            if (selImg.locked) {
                activeImageSelection.dragMode = null;
                if (window.unifiedTool === 'pen_image') {
                    if (typeof showGestureToast === 'function') showGestureToast('🔒 Ảnh đang cố định — bấm 🔓 Mở khóa trên thanh nổi nếu muốn sửa');
                    return;
                }
            } else {
                saveHistorySnapshot();
                activeImageSelection.dragMode = 'move';
                activeImageSelection.startMouse = localW;
                activeImageSelection.origX = selImg.x;
                activeImageSelection.origY = selImg.y;
                return;
            }
        }
        clearActiveImageSelection(true);
    }

    if (window.unifiedTool === 'pen_image') {
        const imgs = doc.images || [];
        for (let i = imgs.length - 1; i >= 0; i--) {
            const im = imgs[i];
            if (localW.x >= im.x && localW.x <= im.x + im.w && localW.y >= im.y && localW.y <= im.y + im.h) {
                if (im.locked) {
                    activeImageSelection = { id: im.id, dragMode: null, startMouse: localW, origX: im.x, origY: im.y, origW: im.w, origH: im.h };
                    updateImageFloatingBarPos(); renderAll(); return;
                }
                saveHistorySnapshot();
                activeImageSelection = { id: im.id, dragMode: 'move', startMouse: localW, origX: im.x, origY: im.y, origW: im.w, origH: im.h };
                updateImageFloatingBarPos(); renderAll(); return;
            }
        }
        triggerInsertImagePicker();
        return;
    }

    if (activeRingGizmo.active) {
        const dHandle = Math.hypot(localW.x - (activeRingGizmo.cx + activeRingGizmo.radius), localW.y - activeRingGizmo.cy);
        const dCenter = Math.hypot(localW.x - activeRingGizmo.cx, localW.y - activeRingGizmo.cy);
        if (dHandle < 18) {
            saveHistorySnapshot();
            activeRingGizmo.dragMode = 'rotate_scale';
            activeRingGizmo.dragStartAngle = Math.atan2(localW.y - activeRingGizmo.cy, localW.x - activeRingGizmo.cx);
            activeRingGizmo.dragStartRadius = Math.max(18, dCenter);
            activeRingGizmo.initialAtomOffsets = activeRingGizmo.atomIds.map(id => {
                const a = doc.atoms.find(x => x.id === id);
                return a ? { id, dx: a.x - activeRingGizmo.cx, dy: a.y - activeRingGizmo.cy } : null;
            }).filter(Boolean);
            activeRingGizmo.initialOrbitalOffsets = (activeRingGizmo.orbitalIds || []).map(id => {
                const ob = (doc.orbitals || []).find(x => x.id === id);
                return ob ? { id, dx: ob.x - activeRingGizmo.cx, dy: ob.y - activeRingGizmo.cy, angle: ob.angle || 0, scale: ob.scale || 36 } : null;
            }).filter(Boolean);
            return;
        }
        if (dCenter < activeRingGizmo.radius) {
            saveHistorySnapshot();
            activeRingGizmo.dragMode = 'move';
            activeRingGizmo.dragStartMouse = localW;
            activeRingGizmo.initialAtomOffsets = activeRingGizmo.atomIds.map(id => {
                const a = doc.atoms.find(x => x.id === id);
                return a ? { id, x: a.x, y: a.y } : null;
            }).filter(Boolean);
            activeRingGizmo.initialOrbitalOffsets = (activeRingGizmo.orbitalIds || []).map(id => {
                const ob = (doc.orbitals || []).find(x => x.id === id);
                return ob ? { id, x: ob.x, y: ob.y } : null;
            }).filter(Boolean);
            return;
        }
        clearActiveRingGizmo(true);
    }

    const t = window.unifiedTool;
    if (t === 'pen_laser') {
        isDrawing = true;
        document.body?.classList?.add('is-drawing-canvas');
        currentLaserStroke = { points: [localW], createdAt: performance.now() };
        startLaserLoop();
        return;
    }
    if (t === 'pen_ballpoint' || t === 'pen_highlighter') {
        if (pointerDownSnapshot && typeof undoStack !== 'undefined') {
            undoStack.push(pointerDownSnapshot);
            if (undoStack.length > 50) undoStack.shift();
            redoStack = [];
            undoPushSeq++;
        } else {
            saveHistorySnapshot(false, true);
        }
        cancelInkHoldTimer();
        isDrawing = true;
        activeStrokePointerId = e.pointerId;
        document.body?.classList?.add('is-drawing-canvas');
        const rawP = getRawPointerPressure(e, 0.24);
        const fallNow = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
        const startTs = (typeof e.timeStamp === 'number' && e.timeStamp > 0) ? e.timeStamp : fallNow;
        const hlW = (typeof highlighterWidth === 'number' && highlighterWidth > 0) ? highlighterWidth : 14;
        const hlAlpha = (typeof appLibrary === 'object' && appLibrary?.highlighterConfig && typeof appLibrary.highlighterConfig.opacity === 'number')
            ? appLibrary.highlighterConfig.opacity
            : 0.50;
        const hlCol = (typeof highlighterColor === 'string' && highlighterColor) ? highlighterColor : '#fef08a';
        currentInkStroke = {
            mode: t === 'pen_highlighter' ? 'highlighter' : 'ink',
            penStyle: activePenStyle,
            nibAngle: (appLibrary.fountainNibAngle === 35 ? 35 : 90),
            color: t === 'pen_highlighter' ? hlCol : penColor,
            width: t === 'pen_highlighter' ? hlW : strokeWidth,
            hlAlpha: t === 'pen_highlighter' ? hlAlpha : undefined,
            opacity: penOpacity,
            smoothing: penSmoothing,
            hasPressure: e.pointerType === 'pen' && typeof e.pressure === 'number' && e.pressure > 0 && e.pressure < 1,
            points: [{ x: localW.x, y: localW.y, p: rawP, t: 0 }],
            liveTip: null,
            snappedShape: null,
            _liveState: { filtX: localW.x, filtY: localW.y, lastRawX: localW.x, lastRawY: localW.y, lastTs: startTs, startTs: startTs, vel: 0 }
        };
        scheduleInkRender();
        return;
    }
    if (t === 'pen_eraser') {
        saveHistorySnapshot(false);
        isDrawing = true;
        document.body?.classList?.add('is-drawing-canvas');
        lastEraserPoint = localW;
        eraseAtPoint(localW.x, localW.y);
        return;
    }
    if (t === 'pen_line') {
        saveHistorySnapshot(false);
        isDrawing = true;
        document.body?.classList?.add('is-drawing-canvas');
        dragStartPos = localW; currentWorldPos = localW;
        return;
    }
    if (t === 'pen_lasso') {
        if (lassoSelection.active && lassoSelection.bounds && localW.x >= lassoSelection.bounds.minX && localW.x <= lassoSelection.bounds.maxX && localW.y >= lassoSelection.bounds.minY && localW.y <= lassoSelection.bounds.maxY) {
            saveHistorySnapshot();
            lassoSelection.dragging = true;
            lassoSelection.lastDragPos = localW;
            return;
        }
        clearLassoSelection();
        isDrawing = true;
        document.body?.classList?.add('is-drawing-canvas');
        lassoSelection.polygon = [localW];
        return;
    }

    if (t === 'chem_ring') {
        const nearRingA = findNearestAtom(localW.x, localW.y, 20);
        if (nearRingA) {
            startAtomHoldCheck(nearRingA, localW, e, { pendingAction: 'stamp_ring', snapshotTaken: false });
            return;
        }
        stampRingAt(localW.x, localW.y, activeRingType); return;
    }
    if (t === 'chem_snippet' && activeSnippetId) {
        stampCustomSnippetAt(localW.x, localW.y, activeSnippetId);
        return;
    }
    if (t === 'chem_conformer') {
        const hitNewman = findHitNewmanSymbol(doc, localW, 24);
        if (hitNewman) {
            rotateNewmanBackBy(hitNewman, doc, Math.PI / 6);
            return;
        }
        stampConformerAt(localW.x, localW.y, activeConformerType);
        ensureAutoNextPageIfNeeded(localW.y + 40);
        return;
    }
    if (t === 'chem_group') {
        const nearA = findNearestAtom(localW.x, localW.y, 26);
        if (nearA) {
            window.lastActiveChemAtomId = nearA.id;
            dragStartAtom = nearA;
            window.lastActiveChemAtomId = nearA.id;
            dragStartPos = { x: nearA.x, y: nearA.y };
            currentWorldPos = dragStartPos;
            previewChainPoints = [];
            isDrawing = true;
            startAtomHoldCheck(nearA, localW, e, { pendingAction: 'apply_group', snapshotTaken: false });
            return;
        }
        if (activeGroupLabel === 'C') return;
        saveHistorySnapshot();
        if (!doc.atoms) doc.atoms = [];
        const cleanSt = (activeGroupLabel === '=O' || activeGroupLabel === 'O=') ? 'O' : activeGroupLabel;
        const na = { id: genId('a'), x: localW.x, y: localW.y, label: cleanSt, color: penColor };
        doc.atoms.push(na);
        window.lastActiveChemAtomId = na.id;
        ensureAutoNextPageIfNeeded(localW.y);
        persistLibrary(); renderAll(); return;
    }
    if (t === 'chem_orbital') {
        saveHistorySnapshot();
        const hitOb = (doc.orbitals || []).find(ob => Math.hypot(ob.x - localW.x, ob.y - localW.y) < 18);
        if (hitOb) {
            activeExtraDragItem = hitOb;
            return;
        }
        const nearA = findNearestAtom(localW.x, localW.y, 26);
        const ob = { id: genId('ob'), x: nearA ? nearA.x : localW.x, y: nearA ? nearA.y : localW.y, type: activeOrbitalType, angle: 0, scale: 36, color: penColor };
        if (!doc.orbitals) doc.orbitals = [];
        doc.orbitals.push(ob);
        activeExtraDragItem = ob;
        ensureAutoNextPageIfNeeded(ob.y);
        persistLibrary(); renderAll(); return;
    }
    if (t === 'chem_symbol') {
        const hitNewman = findHitNewmanSymbol(doc, localW, 24);
        if (hitNewman) {
            rotateNewmanBackBy(hitNewman, doc, Math.PI / 6);
            return;
        }
        saveHistorySnapshot();
        const nearA = findNearestAtom(localW.x, localW.y, 26);
        const sm = { id: genId('sym'), x: nearA ? nearA.x : localW.x, y: nearA ? nearA.y : localW.y, type: activeChemSymTool, angle: 0, color: penColor };
        if (!doc.chemSymbols) doc.chemSymbols = [];
        doc.chemSymbols.push(sm);
        activeExtraDragItem = sm;
        ensureAutoNextPageIfNeeded(sm.y);
        persistLibrary(); renderAll(); return;
    }
    if (t === 'chem_lab') {
        saveHistorySnapshot();
        const hitLab = (doc.labItems || []).find(lb => Math.hypot(lb.x - localW.x, lb.y - localW.y) < 28);
        if (hitLab) {
            activeExtraDragItem = hitLab;
            return;
        }
        const lb = {
            id: genId('lab'),
            x: localW.x,
            y: localW.y,
            type: typeof activeLabItemType !== 'undefined' ? activeLabItemType : 'erlenmeyer',
            scale: 46,
            angle: 0,
            color: penColor,
            liquidColor: typeof activeLabLiquidColor !== 'undefined' ? activeLabLiquidColor : '#38bdf8'
        };
        if (!doc.labItems) doc.labItems = [];
        doc.labItems.push(lb);
        activeExtraDragItem = lb;
        ensureAutoNextPageIfNeeded(lb.y);
        persistLibrary(); renderAll(); return;
    }
    if (t === 'chem_text') {
        openCustomDialog({
            title: 'Điều kiện phản ứng / Ghi chú',
            defaultValue: 'H2SO4, t0',
            onConfirm: (raw) => {
                if (!raw || !raw.trim()) return;
                saveHistorySnapshot();
                const formatted = raw.trim().replace(/\bt0\b|\bto\b/g, 't°').replace(/\/\\|\bDelta\b/g, 'Δ');
                if (!doc.texts) doc.texts = [];
                doc.texts.push({ id: genId('txt'), x: localW.x, y: localW.y, text: formatted, color: penColor, size: 14 });
                ensureAutoNextPageIfNeeded(localW.y);
                persistLibrary(); renderAll();
            }
        });
        return;
    }

    if (t === 'chem_move') {
        const hitMaCtrl = findHitMechArrowCtrl(doc, localW, 14);
        if (hitMaCtrl) {
            saveHistorySnapshot();
            activeMoveTarget = { type: 'mech_ctrl', item: hitMaCtrl };
            dragStartPos = null;
            isDrawing = true;
            return;
        }
        for (const ma of (doc.mechArrows || [])) {
            if (Math.hypot(localW.x - ma.x1, localW.y - ma.y1) <= 14) {
                saveHistorySnapshot();
                activeMoveTarget = { type: 'seg_p1', item: ma };
                dragStartPos = null; isDrawing = true; return;
            }
            if (Math.hypot(localW.x - ma.x2, localW.y - ma.y2) <= 14) {
                saveHistorySnapshot();
                activeMoveTarget = { type: 'seg_p2', item: ma };
                dragStartPos = null; isDrawing = true; return;
            }
        }
        for (const ar of (doc.arrows || [])) {
            if (Math.hypot(localW.x - ar.x1, localW.y - ar.y1) <= 14) {
                saveHistorySnapshot();
                activeMoveTarget = { type: 'seg_p1', item: ar };
                dragStartPos = null; isDrawing = true; return;
            }
            if (Math.hypot(localW.x - ar.x2, localW.y - ar.y2) <= 14) {
                saveHistorySnapshot();
                activeMoveTarget = { type: 'seg_p2', item: ar };
                dragStartPos = null; isDrawing = true; return;
            }
        }
        const nearA = findNearestAtom(localW.x, localW.y, 24);
        if (nearA) {
            saveHistorySnapshot();
            if (e.shiftKey) {
                const compIds = getConnectedAtomComponent(nearA.id);
                activeMoveTarget = { type: 'molecule', atomIds: compIds, lastPos: localW };
            } else {
                activeMoveTarget = { type: 'atom', item: nearA };
            }
            isDrawing = true;
            return;
        }
        const hitBr = (doc.brackets || []).find(br => distToBracketEdges(br, localW) < 16);
        if (hitBr) {
            saveHistorySnapshot();
            activeMoveTarget = { type: 'bracket', item: hitBr, lastPos: localW };
            dragStartPos = null; isDrawing = true; return;
        }
        const hitTxt = (doc.texts || []).find(tx => Math.hypot(tx.x - localW.x, tx.y - localW.y) < 32);
        if (hitTxt) {
            saveHistorySnapshot();
            activeMoveTarget = { type: 'point_item', item: hitTxt };
            isDrawing = true; return;
        }
        const hitOrb = (doc.orbitals || []).find(ob => Math.hypot(ob.x - localW.x, ob.y - localW.y) < 34);
        if (hitOrb) {
            saveHistorySnapshot();
            if (e.shiftKey) {
                activeExtraDragItem = hitOrb;
            } else {
                activeMoveTarget = { type: 'point_item', item: hitOrb };
                isDrawing = true;
            }
            return;
        }
        const hitSym = (doc.chemSymbols || []).find(sm => Math.hypot(sm.x - localW.x, sm.y - localW.y) < 26);
        if (hitSym) {
            saveHistorySnapshot();
            activeMoveTarget = { type: 'point_item', item: hitSym };
            isDrawing = true; return;
        }
        const hitLab = (doc.labItems || []).find(lb => Math.hypot(lb.x - localW.x, lb.y - localW.y) < 34);
        if (hitLab) {
            saveHistorySnapshot();
            activeMoveTarget = { type: 'point_item', item: hitLab };
            isDrawing = true; return;
        }
        const hitAr = (doc.arrows || []).find(ar => distToSegment(localW, {x:ar.x1,y:ar.y1}, {x:ar.x2,y:ar.y2}) < 18);
        if (hitAr) {
            saveHistorySnapshot();
            activeMoveTarget = { type: 'segment_item', item: hitAr, lastPos: localW };
            isDrawing = true; return;
        }
        const hitMa = (doc.mechArrows || []).find(ma => distToSegment(localW, {x:ma.x1,y:ma.y1}, {x:ma.x2,y:ma.y2}) < 22);
        if (hitMa) {
            saveHistorySnapshot();
            activeMoveTarget = { type: 'segment_item', item: hitMa, lastPos: localW };
            isDrawing = true; return;
        }
        return;
    }

    if (t === 'chem_bond' || t === 'chem_wedge' || t === 'chem_dash') {
        const hitBond = findHitBondInterior(localW.x, localW.y, 16);
        if (hitBond) {
            if (t === 'chem_wedge') {
                saveHistorySnapshot();
                hitBond.stereo = hitBond.stereo === 'wedge' ? null : 'wedge';
                hitBond.order = 1;
                selectedBondId = null;
                enforceAllValenceAndHydrogens(doc);
                persistLibrary(); renderAll(); return;
            } else if (t === 'chem_dash') {
                saveHistorySnapshot();
                hitBond.stereo = hitBond.stereo === 'dash' ? null : 'dash';
                hitBond.order = 1;
                selectedBondId = null;
                enforceAllValenceAndHydrogens(doc);
                persistLibrary(); renderAll(); return;
            } else {
                // 1 chạm trực tiếp vào thân liên kết ở chế độ Mạch C → đổi tức thì Đơn — → Đôi = → Ba ≡ (không cần gõ đúp mỏi tay!)
                bondTapHandledInDown = true;
                promoteBondOnDoubleTap(hitBond, doc);
                return;
            }
        }
        selectedBondId = null;
        const nearA = findNearestAtom(localW.x, localW.y, 22);
        if (nearA && !canAddBondOrder(nearA, 1, doc)) {
            startAtomHoldCheck(nearA, localW, e, { pendingAction: 'saturated_warn', snapshotTaken: false });
            return;
        }
        saveHistorySnapshot();
        if (nearA) {
            dragStartAtom = nearA;
            dragStartPos = { x: nearA.x, y: nearA.y };
            startAtomHoldCheck(nearA, localW, e, { snapshotTaken: true });
        } else {
            const na = { id: genId('a'), x: localW.x, y: localW.y, label: 'C', color: penColor };
            doc.atoms.push(na);
            dragStartAtom = na;
            window.lastActiveChemAtomId = na.id;
            dragStartPos = { x: na.x, y: na.y };
            pointerDownCreatedAtomId = na.id;
        }
        currentWorldPos = dragStartPos;
        if (t === 'chem_bond') {
            previewChainPoints = buildHorizontalZigZagPreview(dragStartAtom, dragStartPos, currentWorldPos, doc);
        } else {
            previewChainPoints = [];
        }
        isDrawing = true;
        document.body?.classList?.add('is-drawing-canvas');
        renderAll();
        return;
    }

    if (t === 'chem_rxn_arrow' || t === 'chem_mech_arrow') {
        if (t === 'chem_mech_arrow') {
            const hitCtrl = findHitMechArrowCtrl(doc, localW, 14);
            if (hitCtrl) {
                saveHistorySnapshot();
                activeMoveTarget = { type: 'mech_ctrl', item: hitCtrl };
                dragStartPos = null;
                isDrawing = true;
                return;
            }
            mechArrowDragPoints = [localW];
        }
        saveHistorySnapshot();
        dragStartPos = localW; currentWorldPos = localW;
        previewChainPoints = [];
        isDrawing = true;
        document.body?.classList?.add('is-drawing-canvas');
    }
});

const handleCanvasPointerMove = e => {
    lastCanvasTouchSeq++;
    const nowMove = performance.now();
    lastAnyInputEventAt = nowMove;
    if (ignoredPalmPointerIds.has(e.pointerId)) {
        const ignTs = ignoredPalmPointerIds.get(e.pointerId) || 0;
        if ((nowMove - ignTs) > 1500) ignoredPalmPointerIds.delete(e.pointerId);
        else return;
    }
    if (nativePinchState.active && (nowMove - (nativePinchState.lastMoveAt || 0)) > 450) {
        nativePinchState.active = false;
        nativePinchState.zoomChanged = false;
    }
    if (nativePinchState.active && e.pointerType === 'touch') return;
    if (nativeSinglePanState.active && nativeSinglePanState.movedByTouch && e.pointerType === 'touch') return;
    if (e.pointerType === 'mouse' && typeof e.buttons === 'number' && e.buttons === 0 && (isDrawing || mousePanState.active || activeMoveTarget || activeExtraDragItem)) {
        finishPointer(e);
        return;
    }
    if (e.pointerType === 'touch' && activePenPointerId !== null && e.pointerId !== activePenPointerId) {
        const staleIdlePen = !isDrawing && !activeMoveTarget && !activeExtraDragItem && !dragStartAtom && (nowMove - lastPenActivityAt) > 180;
        const lostPenUp = (nowMove - lastPenActivityAt) > 650;
        if (staleIdlePen || lostPenUp) {
            if (lostPenUp) {
                forceFinalizeOrClearActiveInkStroke();
                activePointers.delete(activePenPointerId);
                activeMoveTarget = null;
                dragStartAtom = null;
            }
            activePenPointerId = null;
        } else {
            return;
        }
    }
    if (e.pointerType === 'pen') {
        lastPenHoverAt = nowMove;
        if (typeof e.buttons === 'number' && e.buttons === 0) {
            if (activePenPointerId !== null && (e.pointerId === activePenPointerId || (nowMove - lastPenActivityAt) > 120)) {
                if (isDrawing || activeMoveTarget || activeExtraDragItem || dragStartAtom) {
                    finishPointer({
                        type: 'pointerup',
                        pointerId: activePenPointerId,
                        pointerType: 'pen',
                        clientX: e.clientX,
                        clientY: e.clientY,
                        pressure: 0,
                        timeStamp: e.timeStamp
                    });
                } else {
                    activePointers.delete(activePenPointerId);
                    activePenPointerId = null;
                }
            }
            return;
        }
        if (e.pointerId === activePenPointerId && (typeof e.buttons !== 'number' || e.buttons !== 0)) {
            lastPenActivityAt = nowMove;
        }
    } else if (activePointers.get(e.pointerId)?.isFineStylus) {
        lastPenActivityAt = nowMove;
    }
    if (activePointers.has(e.pointerId)) {
        const prevRec = activePointers.get(e.pointerId);
        activePointers.set(e.pointerId, {
            ...prevRec,
            x: e.clientX, y: e.clientY,
            type: e.pointerType || prevRec.type || '',
            lastTime: nowMove
        });
    }
    if (multiTouchTapState.active && multiTouchTapState.startPoints.has(e.pointerId)) {
        const sp = multiTouchTapState.startPoints.get(e.pointerId);
        if (Math.hypot(e.clientX - sp.x, e.clientY - sp.y) > 14) {
            multiTouchTapState.movedFar = true;
        }
    }
    if (activePointers.size >= 2) {
        if (activePointers.size === 2) {
            const pts = Array.from(activePointers.values());
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
            if (multiTouchTapState.active) {
                multiTouchTapState.endMid = { x: mid.x, y: mid.y };
            }
            if (!lastPinchDist || !pinchStartZoom || !pinchStartMid || !pinchStartPan) {
                lastPinchDist = dist;
                pinchStartZoom = zoom;
                pinchStartMid = { x: mid.x, y: mid.y };
                pinchStartPan = { x: panX, y: panY };
            }
            const dy = lastPanMid ? (mid.y - lastPanMid.y) : 0;
            lastPanMid = mid;
            let targetZoom = pinchStartZoom;
            if (lastPinchDist > 10 && dist > 10 && Math.abs(dist - lastPinchDist) > 2.2) {
                const rawRatio = dist / lastPinchDist;
                targetZoom = Math.max(getMinFullScreenZoom(), Math.min(3.5, pinchStartZoom * rawRatio));
            }
            if (multiTouchTapState.active) {
                multiTouchTapState.zoomChanged = Math.abs(targetZoom - pinchStartZoom) > 0.04;
            }
            const rect = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : canvas.getBoundingClientRect();
            const lx = mid.x - rect.left, ly = mid.y - rect.top;
            const lx0 = pinchStartMid.x - rect.left, ly0 = pinchStartMid.y - rect.top;
            zoom = targetZoom;
            panX = lx - (lx0 - pinchStartPan.x) * (targetZoom / pinchStartZoom);
            panY = ly - (ly0 - pinchStartPan.y) * (targetZoom / pinchStartZoom);
            if (dy < -8 && (typeof isReadMode === 'undefined' || !isReadMode) && appLibrary.autoAddPage !== false) {
                const nb = getActiveNotebook();
                const totalH = nb.pages.length * (A4_HEIGHT + PAGE_GAP) * zoom;
                const minPanY = Math.min(0, cssHeight - totalH);
                if (panY <= minPanY + 18) appendAutoPageToNotebook(nb);
            }
            clampViewportPanAndZoom();
            scheduleViewportRender();
        }
        return;
    }

    if (mousePanState.active && e.pointerId === mousePanState.pointerId && activePointers.size <= 1) {
        const panDx = e.clientX - mousePanState.lastX;
        const panDy = e.clientY - mousePanState.lastY;
        if (!mousePanState.moved && Math.hypot(e.clientX - mousePanState.startX, e.clientY - mousePanState.startY) >= 2) {
            mousePanState.moved = true;
        }
        panX += panDx;
        panY += panDy;
        mousePanState.lastX = e.clientX;
        mousePanState.lastY = e.clientY;
        if (panDy < -8 && (typeof isReadMode === 'undefined' || !isReadMode) && appLibrary.autoAddPage !== false) {
            const nb = getActiveNotebook();
            const totalH = nb.pages.length * (A4_HEIGHT + PAGE_GAP) * zoom;
            const minPanY = Math.min(0, cssHeight - totalH);
            if (panY <= minPanY + 18) appendAutoPageToNotebook(nb);
        }
        clampViewportPanAndZoom();
        if (typeof isReadMode === 'undefined' || !isReadMode) {
            const rectPan = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : canvas.getBoundingClientRect();
            autoDetectPageFromScreenY(rectPan.top + rectPan.height * 0.45);
        }
        if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
        updateRingTransformFloatingBarPos(); updateImageFloatingBarPos(); updateChainFloatingBarPos(); updateLassoFloatingBarPos();
        scheduleViewportRender();
        return;
    }

    if (typeof isReadMode !== 'undefined' && isReadMode) {
        if (activePointers.size === 1 && readPanState.active && e.pointerId === readPanState.pointerId) {
            panX += e.clientX - readPanState.lastX;
            panY += e.clientY - readPanState.lastY;
            readPanState.lastX = e.clientX;
            readPanState.lastY = e.clientY;
            clampViewportPanAndZoom();
            scheduleViewportRender();
        }
        return;
    }

    if (activePointers.size === 1 && singleFingerPanState.active && e.pointerId === singleFingerPanState.pointerId) {
        if (singleFingerPanState.isEdgeSwipe) {
            const dx = e.clientX - singleFingerPanState.startX;
            const dy = e.clientY - singleFingerPanState.startY;
            const isLeftHanded = appLibrary?.ipadConfig?.handedness === 'left';
            const inward = isLeftHanded ? (dx >= 42) : (dx <= -42);
            if (inward && Math.abs(dy) < 90) {
                singleFingerPanState.active = false;
                if (typeof toggleExamDrawer === 'function') toggleExamDrawer(true);
                if (typeof showGestureToast === 'function') showGestureToast('Vuốt cạnh: Đã mở Ngăn Đề Bài');
            } else if (Math.abs(dy) > 16 && Math.abs(dx) < 14) {
                // Convert vertical scroll near edge smoothly to pan instead of locking edge gesture
                singleFingerPanState.isEdgeSwipe = false;
                singleFingerPanState.panActivated = true;
            } else {
                singleFingerPanState.lastX = e.clientX;
                singleFingerPanState.lastY = e.clientY;
            }
            return;
        }
        if (!singleFingerPanState.panActivated) {
            if (Math.hypot(e.clientX - singleFingerPanState.startX, e.clientY - singleFingerPanState.startY) < 2.0) {
                return;
            }
            singleFingerPanState.panActivated = true;
        }
        const panDx = e.clientX - singleFingerPanState.lastX;
        const panDy = e.clientY - singleFingerPanState.lastY;
        const dtPan = Math.max(4, nowMove - (singleFingerPanState.lastMoveTime || nowMove));
        const instVx = (panDx / dtPan) * 16.67;
        const instVy = (panDy / dtPan) * 16.67;
        singleFingerPanState.velX = (singleFingerPanState.velX || 0) * 0.48 + instVx * 0.52;
        singleFingerPanState.velY = (singleFingerPanState.velY || 0) * 0.48 + instVy * 0.52;
        singleFingerPanState.lastMoveTime = nowMove;
        panX += panDx;
        panY += panDy;
        if (!singleFingerPanState.fromPinchRelease && (nowMove - (singleFingerPanState.startTime || nowMove)) < 280) {
            touchPalmBuffer = {
                dx: panX - (typeof singleFingerPanState.startPanX === 'number' ? singleFingerPanState.startPanX : panX),
                dy: panY - (typeof singleFingerPanState.startPanY === 'number' ? singleFingerPanState.startPanY : panY),
                at: nowMove
            };
        }
        singleFingerPanState.lastX = e.clientX;
        singleFingerPanState.lastY = e.clientY;
        if (panDy < -8 && appLibrary.autoAddPage !== false) {
            const nb = getActiveNotebook();
            const totalH = nb.pages.length * (A4_HEIGHT + PAGE_GAP) * zoom;
            const minPanY = Math.min(0, cssHeight - totalH);
            if (panY <= minPanY + 18) appendAutoPageToNotebook(nb);
        }
        clampViewportPanAndZoom();
        scheduleViewportRender();
        return;
    }

    const localW = screenToWorld(e.clientX, e.clientY);
    const onPaperNow = isWorldPointOnPaper(localW);
    currentWorldPos = localW;
    if (pointerDownClientPos) {
        pointerMaxMoveDist = Math.max(pointerMaxMoveDist, Math.hypot(e.clientX - pointerDownClientPos.x, e.clientY - pointerDownClientPos.y));
    }

    if (atomHoldState && !atomHoldState.active) {
        const moveDist = Math.hypot(e.clientX - atomHoldState.startScreen.x, e.clientY - atomHoldState.startScreen.y);
        const holdThresh = atomHoldState.pendingAction === 'apply_group'
            ? 24
            : (atomHoldState.pendingAction === 'stamp_ring' ? 16 : 8);
        if (moveDist > holdThresh) {
            const st = atomHoldState;
            cancelAtomHoldTimer(true);
            if (st.pendingAction === 'saturated_warn') {
                showGestureToast(`${st.atom.label} đã đạt tối đa ${getMaxValenceForAtom(st.atom)} liên kết!`);
            }
            renderAll();
        }
    }

    if (!isDrawing && onPaperNow && e.pointerType !== 'touch' && ['chem_bond', 'chem_wedge', 'chem_dash', 'chem_group', 'chem_ring', 'chem_move'].includes(window.unifiedTool)) {
        const nearBondHover = findHitBondInterior(localW.x, localW.y, 16);
        const nearHover = !nearBondHover ? findNearestAtom(localW.x, localW.y, 22) : null;
        if (nearHover !== hoveredAtom || nearBondHover !== hoveredBond) {
            hoveredAtom = nearHover;
            hoveredBond = nearBondHover;
            renderAll();
        }
    } else if (hoveredAtom || hoveredBond) {
        hoveredAtom = null;
        hoveredBond = null;
    }

    if (activeImageSelection.id && activeImageSelection.dragMode) {
        const im = getSelectedImageObj();
        if (im && !im.locked) {
            const dx = localW.x - activeImageSelection.startMouse.x;
            const dy = localW.y - activeImageSelection.startMouse.y;
            if (activeImageSelection.dragMode === 'move') {
                im.x = activeImageSelection.origX + dx; im.y = activeImageSelection.origY + dy;
            } else if (activeImageSelection.dragMode === 'resize') {
                const ratio = activeImageSelection.origH / (activeImageSelection.origW || 1);
                im.w = Math.max(50, activeImageSelection.origW + dx);
                im.h = Math.max(40, im.w * ratio);
            }
            updateImageFloatingBarPos(); renderAll();
        }
        return;
    }

    if (activeRingGizmo.active && activeRingGizmo.dragMode) {
        const doc = getDocState();
        if (activeRingGizmo.dragMode === 'move') {
            const dx = localW.x - activeRingGizmo.dragStartMouse.x;
            const dy = localW.y - activeRingGizmo.dragStartMouse.y;
            activeRingGizmo.initialAtomOffsets.forEach(it => {
                const a = doc.atoms.find(x => x.id === it.id);
                if (a) { a.x = it.x + dx; a.y = it.y + dy; }
            });
            (activeRingGizmo.initialOrbitalOffsets || []).forEach(it => {
                const ob = (doc.orbitals || []).find(x => x.id === it.id);
                if (ob) { ob.x = it.x + dx; ob.y = it.y + dy; }
            });
            const first = activeRingGizmo.initialAtomOffsets;
            if (first.length) {
                activeRingGizmo.cx = first.reduce((s, it) => s + it.x + dx, 0) / first.length;
                activeRingGizmo.cy = first.reduce((s, it) => s + it.y + dy, 0) / first.length;
            }
        } else if (activeRingGizmo.dragMode === 'rotate_scale') {
            const ang = Math.atan2(localW.y - activeRingGizmo.cy, localW.x - activeRingGizmo.cx);
            const dAngle = ang - activeRingGizmo.dragStartAngle;
            const curR = Math.max(20, Math.hypot(localW.x - activeRingGizmo.cx, localW.y - activeRingGizmo.cy));
            const scale = curR / activeRingGizmo.dragStartRadius;
            const cos = Math.cos(dAngle), sin = Math.sin(dAngle);
            activeRingGizmo.initialAtomOffsets.forEach(it => {
                const a = doc.atoms.find(x => x.id === it.id);
                if (a) {
                    const rx = it.dx * cos - it.dy * sin;
                    const ry = it.dx * sin + it.dy * cos;
                    a.x = activeRingGizmo.cx + rx * scale;
                    a.y = activeRingGizmo.cy + ry * scale;
                }
            });
            (activeRingGizmo.initialOrbitalOffsets || []).forEach(it => {
                const ob = (doc.orbitals || []).find(x => x.id === it.id);
                if (ob) {
                    const rx = it.dx * cos - it.dy * sin;
                    const ry = it.dx * sin + it.dy * cos;
                    ob.x = activeRingGizmo.cx + rx * scale;
                    ob.y = activeRingGizmo.cy + ry * scale;
                    ob.angle = it.angle + dAngle;
                    ob.scale = Math.max(14, Math.min(140, it.scale * scale));
                }
            });
            activeRingGizmo.radius = curR;
        }
        updateRingTransformFloatingBarPos(); renderAll();
        return;
    }

    if (activeExtraDragItem) {
        const d = Math.hypot(localW.x - activeExtraDragItem.x, localW.y - activeExtraDragItem.y);
        if (d > 8) {
            const raw = Math.atan2(localW.y - activeExtraDragItem.y, localW.x - activeExtraDragItem.x) + Math.PI / 2;
            const step = Math.PI / 12;
            activeExtraDragItem.angle = Math.round(raw / step) * step;
            if (typeof activeExtraDragItem.scale === 'number') {
                activeExtraDragItem.scale = Math.round(Math.max(22, Math.min(95, d * 1.15)));
            }
            renderAll();
        }
        return;
    }

    if (lassoSelection.dragging && lassoSelection.lastDragPos) {
        const dx = localW.x - lassoSelection.lastDragPos.x, dy = localW.y - lassoSelection.lastDragPos.y;
        lassoSelection.lastDragPos = localW;
        const doc = getDocState();
        const aSet = new Set(lassoSelection.selectedAtomIds);
        const obSet = new Set(lassoSelection.selectedOrbitalIds);
        const smSet = new Set(lassoSelection.selectedSymbolIds);
        const txSet = new Set(lassoSelection.selectedTextIds);
        const arSet = new Set(lassoSelection.selectedArrowIds);
        const maSet = new Set(lassoSelection.selectedMechArrowIds);
        const brSet = new Set(lassoSelection.selectedBracketIds || []);
        (doc.atoms || []).forEach(a => { if (aSet.has(a.id)) { a.x += dx; a.y += dy; } });
        (doc.orbitals || []).forEach(ob => { if (obSet.has(ob.id)) { ob.x += dx; ob.y += dy; } });
        (doc.chemSymbols || []).forEach(sm => { if (smSet.has(sm.id)) { sm.x += dx; sm.y += dy; } });
        (doc.texts || []).forEach(tx => { if (txSet.has(tx.id)) { tx.x += dx; tx.y += dy; } });
        (doc.arrows || []).forEach(ar => { if (arSet.has(ar.id)) { ar.x1 += dx; ar.y1 += dy; ar.x2 += dx; ar.y2 += dy; } });
        (doc.mechArrows || []).forEach(ma => {
            if (maSet.has(ma.id)) {
                ma.x1 += dx; ma.y1 += dy; ma.x2 += dx; ma.y2 += dy;
                if (typeof ma.cpx === 'number' && typeof ma.cpy === 'number') { ma.cpx += dx; ma.cpy += dy; }
            }
        });
        (doc.brackets || []).forEach(br => { if (brSet.has(br.id)) { br.x += dx; br.y += dy; } });
        const imSetDrag = new Set(lassoSelection.selectedImageIds || []);
        (doc.images || []).forEach(im => { if (!im.locked && imSetDrag.has(im.id)) { im.x += dx; im.y += dy; } });
        lassoSelection.selectedInkIndices.forEach(idx => {
            const mvSt = doc.inkStrokes[idx];
            if (mvSt && Array.isArray(mvSt.points)) {
                mvSt.points.forEach(p => { p.x += dx; p.y += dy; });
                if (typeof invalidateStrokeRibbonCache === 'function') invalidateStrokeRibbonCache(mvSt);
            }
        });
        if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
        lassoSelection.polygon.forEach(p => { p.x += dx; p.y += dy; });
        if (lassoSelection.bounds) {
            lassoSelection.bounds.minX += dx; lassoSelection.bounds.maxX += dx;
            lassoSelection.bounds.minY += dy; lassoSelection.bounds.maxY += dy;
        }
        updateLassoFloatingBarPos();
        renderAll(); return;
    }

    if (!isDrawing) {
        const prevOutside = isCursorOutsidePaper;
        isCursorOutsidePaper = !onPaperNow;
        if (prevOutside !== isCursorOutsidePaper && typeof updateCanvasCursor === 'function') {
            updateCanvasCursor();
        }
        if (window.unifiedTool === 'pen_eraser' && onPaperNow) scheduleInkRender();
        return;
    }
    const t = window.unifiedTool;
    if (currentLaserStroke) {
        currentLaserStroke.points.push(localW);
        currentLaserStroke.createdAt = performance.now();
        if (typeof startLaserLoop === 'function') startLaserLoop();
        else renderAll();
        return;
    }
    if (currentInkStroke) {
        if (activeStrokePointerId !== null && e.pointerId !== activeStrokePointerId) return;
        if (currentInkStroke.snappedShape) {
            const sh = currentInkStroke.snappedShape;
            if (sh.type === 'line') {
                sh.pEnd = snapLineEndpoint(sh.pStart, localW);
                currentInkStroke.points = [{ ...sh.pStart }, { ...sh.pEnd }];
                renderAll();
            } else if (sh.type === 'arc') {
                sh.pEnd = { ...localW };
                currentInkStroke.points = sampleQuadraticArc(sh.pStart, sh.pEnd, sh.archRatio, 24);
                renderAll();
            }
            return;
        }

        const rawEvents = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : null;
        const evList = (rawEvents && rawEvents.length) ? rawEvents : [e];
        const pts = currentInkStroke.points;
        const smoothFactor = typeof currentInkStroke.smoothing === 'number'
            ? currentInkStroke.smoothing
            : (typeof penSmoothing === 'number' ? penSmoothing : 0.50);
        const refineOn = typeof appLibrary === 'undefined' || appLibrary.penAutoRefine !== false;
        const useSmooth = refineOn && smoothFactor > 0.01;
        const ls = currentInkStroke._liveState;
        const isPenPtr = e.pointerType === 'pen';
        const isHlStroke = currentInkStroke.mode === 'highlighter';
        const baseStartTs = (ls && typeof ls.startTs === 'number') ? ls.startTs : nowMove;
        const hlStepBase = Math.max(2.6, Math.min(7.2, (currentInkStroke.width || 14) * 0.24));
        const minStepW = isHlStroke
            ? (hlStepBase / Math.max(0.5, zoom))
            : (useSmooth
                ? Math.max(isPenPtr ? 0.55 : 0.80, (0.68 + smoothFactor * 0.78) / Math.max(0.5, zoom))
                : Math.max(0.5, 0.9 / Math.max(0.5, zoom)));

        for (let i = 0; i < evList.length; i++) {
            const ce = evList[i];
            if (ce.pointerType === 'pen' && typeof ce.pressure === 'number' && ce.pressure > 0 && ce.pressure < 1) {
                currentInkStroke.hasPressure = true;
            }
            const ptW = ce === e ? localW : screenToWorld(ce.clientX, ce.clientY);
            const prev0 = pts[pts.length - 1];
            const prevP0 = (prev0 && typeof prev0.p === 'number' && prev0.p > 0) ? prev0.p : 0.36;
            const ceP = getRawPointerPressure(ce, prevP0);
            const ceTs = (typeof ce.timeStamp === 'number' && ce.timeStamp > 0) ? ce.timeStamp : nowMove;

            let outX = ptW.x;
            let outY = ptW.y;
            if ((useSmooth || isHlStroke) && ls) {
                const rawDist = Math.hypot(ptW.x - ls.lastRawX, ptW.y - ls.lastRawY);
                if (rawDist < (isHlStroke ? 0.45 : 0.22) && i < evList.length - 1) continue;
                let alpha;
                if (isHlStroke) {
                    const dtSample = Math.max(2, Math.min(40, ceTs - (ls.lastTs || baseStartTs)));
                    const instSpd = rawDist / dtSample;
                    ls.vel = (ls.vel || 0) * 0.55 + instSpd * 0.45;
                    const velRamp = Math.min(1, ls.vel / 0.55);
                    alpha = Math.max(0.36, Math.min(0.74, 0.42 + velRamp * 0.30));
                } else {
                    const speedBoost = Math.min(1, rawDist / 10) * 0.42;
                    const minA = isPenPtr ? 0.40 : 0.26;
                    const baseAlpha = Math.max(minA, (isPenPtr ? 0.78 : 0.70) - smoothFactor * (isPenPtr ? 0.40 : 0.46));
                    alpha = Math.max(minA, Math.min(0.96, baseAlpha + speedBoost));
                }
                ls.filtX += (ptW.x - ls.filtX) * alpha;
                ls.filtY += (ptW.y - ls.filtY) * alpha;
                ls.lastRawX = ptW.x;
                ls.lastRawY = ptW.y;
                ls.lastTs = ceTs;
                outX = ls.filtX;
                outY = ls.filtY;
            }

            const prev = pts[pts.length - 1];
            const distW = prev ? Math.hypot(outX - prev.x, outY - prev.y) : 999;

            if (!prev || distW >= minStepW) {
                const prevP = (prev && typeof prev.p === 'number') ? prev.p : 0.36;
                const prevT = (prev && typeof prev.t === 'number') ? prev.t : 0;
                const relT = Math.max(prevT + 0.5, Number((ceTs - baseStartTs).toFixed(2)));
                pts.push({
                    x: outX,
                    y: outY,
                    p: useSmooth ? (prevP * 0.48 + ceP * 0.52) : ceP,
                    t: relT
                });
            }
        }

        const tipTs = (typeof e.timeStamp === 'number' && e.timeStamp > 0) ? e.timeStamp : nowMove;
        const lastPrevPt = pts.length ? pts[pts.length - 1] : null;
        const lastPrevT = (lastPrevPt && typeof lastPrevPt.t === 'number') ? lastPrevPt.t : 0;
        const lastPrevP = (lastPrevPt && typeof lastPrevPt.p === 'number') ? lastPrevPt.p : 0.36;
        const tipRelT = Math.max(lastPrevT + 0.5, Number((tipTs - baseStartTs).toFixed(2)));
        const rawTipP = getRawPointerPressure(e, lastPrevP);
        const smoothTipP = lastPrevP * 0.72 + rawTipP * 0.28;
        if ((useSmooth || isHlStroke) && ls) {
            const tipFollow = isHlStroke
                ? 0.58
                : Math.max(isPenPtr ? 0.65 : 0.40, (isPenPtr ? 0.93 : 0.86) - smoothFactor * 0.32);
            currentInkStroke.liveTip = {
                x: ls.filtX + (localW.x - ls.filtX) * tipFollow,
                y: ls.filtY + (localW.y - ls.filtY) * tipFollow,
                p: smoothTipP,
                t: tipRelT
            };
        } else {
            currentInkStroke.liveTip = { x: localW.x, y: localW.y, p: smoothTipP, t: tipRelT };
        }
        if (appLibrary.holdToShapeEnabled !== false) {
            scheduleInkHoldSnapCheck(localW);
        }
        scheduleInkRender();
        return;
    }
    if (t === 'pen_eraser') {
        eraseBetweenPoints(lastEraserPoint || localW, localW);
        lastEraserPoint = localW;
        return;
    }
    if (t === 'pen_lasso') { lassoSelection.polygon.push(localW); renderAll(); return; }
    if (activeMoveTarget) {
        if (activeMoveTarget.type === 'atom' || activeMoveTarget.type === 'point_item') {
            activeMoveTarget.item.x = localW.x;
            activeMoveTarget.item.y = localW.y;
        } else if (activeMoveTarget.type === 'mech_ctrl') {
            const ma = activeMoveTarget.item;
            ma.cpx = 2 * localW.x - 0.5 * (ma.x1 + ma.x2);
            ma.cpy = 2 * localW.y - 0.5 * (ma.y1 + ma.y2);
            ma.manualCtrl = true;
        } else if (activeMoveTarget.type === 'seg_p1') {
            activeMoveTarget.item.x1 = localW.x;
            activeMoveTarget.item.y1 = localW.y;
        } else if (activeMoveTarget.type === 'seg_p2') {
            activeMoveTarget.item.x2 = localW.x;
            activeMoveTarget.item.y2 = localW.y;
        } else if (activeMoveTarget.type === 'bracket') {
            const dx = localW.x - activeMoveTarget.lastPos.x;
            const dy = localW.y - activeMoveTarget.lastPos.y;
            activeMoveTarget.lastPos = localW;
            activeMoveTarget.item.x += dx;
            activeMoveTarget.item.y += dy;
        } else if (activeMoveTarget.type === 'molecule') {
            const dx = localW.x - activeMoveTarget.lastPos.x;
            const dy = localW.y - activeMoveTarget.lastPos.y;
            activeMoveTarget.lastPos = localW;
            const doc = getDocState();
            const setIds = new Set(activeMoveTarget.atomIds);
            doc.atoms.forEach(a => { if (setIds.has(a.id)) { a.x += dx; a.y += dy; } });
        } else if (activeMoveTarget.type === 'segment_item') {
            const dx = localW.x - activeMoveTarget.lastPos.x;
            const dy = localW.y - activeMoveTarget.lastPos.y;
            activeMoveTarget.lastPos = localW;
            activeMoveTarget.item.x1 += dx; activeMoveTarget.item.y1 += dy;
            activeMoveTarget.item.x2 += dx; activeMoveTarget.item.y2 += dy;
            if (typeof activeMoveTarget.item.cpx === 'number' && typeof activeMoveTarget.item.cpy === 'number') {
                activeMoveTarget.item.cpx += dx; activeMoveTarget.item.cpy += dy;
            }
        }
        updateChainFloatingBarPos();
        renderAll();
        return;
    }
    if (t === 'chem_group' && dragStartAtom && dragStartPos) {
        const distG = Math.hypot(localW.x - dragStartPos.x, localW.y - dragStartPos.y);
        if (distG >= 14) {
            cancelAtomHoldTimer(true);
            const doc = getDocState();
            const rawAng = Math.atan2(localW.y - dragStartPos.y, localW.x - dragStartPos.x);
            const snapAng = getSmartHorizontalZigZagAngle(dragStartAtom, doc, rawAng);
            currentWorldPos = {
                x: dragStartPos.x + BOND_LENGTH * Math.cos(snapAng),
                y: dragStartPos.y + BOND_LENGTH * Math.sin(snapAng)
            };
        } else {
            currentWorldPos = dragStartPos;
        }
        renderAll(); return;
    }
    if ((t === 'chem_bond' || t === 'chem_wedge' || t === 'chem_dash') && dragStartPos) {
        const doc = getDocState();
        if (t === 'chem_bond') {
            previewChainPoints = buildHorizontalZigZagPreview(dragStartAtom, dragStartPos, localW, doc);
            if (previewChainPoints.length > 1) {
                currentWorldPos = previewChainPoints[previewChainPoints.length - 1];
            }
        } else {
            previewChainPoints = [];
            const nearA = findNearestAtom(localW.x, localW.y, 18);
            if (nearA && nearA !== dragStartAtom) currentWorldPos = { x: nearA.x, y: nearA.y };
            else {
                const ang = Math.atan2(localW.y - dragStartPos.y, localW.x - dragStartPos.x);
                const snap = Math.round(ang / (Math.PI / 6)) * (Math.PI / 6);
                currentWorldPos = { x: dragStartPos.x + BOND_LENGTH * Math.cos(snap), y: dragStartPos.y + BOND_LENGTH * Math.sin(snap) };
            }
        }
        renderAll(); return;
    }
    if (t === 'chem_rxn_arrow' && dragStartPos) {
        if (rxnArrowHoldSnapped) {
            currentWorldPos = snapLineEndpoint(dragStartPos, localW);
        } else {
            const movedSinceHold = !rxnArrowHoldPos || Math.hypot(localW.x - rxnArrowHoldPos.x, localW.y - rxnArrowHoldPos.y) >= 4.5;
            if (movedSinceHold) {
                cancelRxnArrowHoldTimer();
                rxnArrowHoldPos = { x: localW.x, y: localW.y };
                const delayMs = Math.max(250, Math.min(1000, Number(appLibrary?.ipadConfig?.holdToShapeDelayMs) || 420));
                rxnArrowHoldTimer = setTimeout(() => {
                    rxnArrowHoldTimer = null;
                    if (!isDrawing || window.unifiedTool !== 'chem_rxn_arrow' || !dragStartPos || !currentWorldPos) return;
                    if (Math.hypot(currentWorldPos.x - dragStartPos.x, currentWorldPos.y - dragStartPos.y) <= 14) return;
                    rxnArrowHoldSnapped = true;
                    currentWorldPos = snapLineEndpoint(dragStartPos, currentWorldPos);
                    if (typeof showGestureToast === 'function') showGestureToast('✨ Đã căn thẳng mũi tên phản ứng');
                    renderAll();
                }, delayMs);
            }
        }
    }
    if (t === 'chem_mech_arrow' && dragStartPos) {
        const lastDragP = mechArrowDragPoints[mechArrowDragPoints.length - 1];
        if (!lastDragP || Math.hypot(localW.x - lastDragP.x, localW.y - lastDragP.y) >= 4) {
            mechArrowDragPoints.push({ x: localW.x, y: localW.y });
        }
    }
    renderAll();
};
canvas.addEventListener('pointermove', handleCanvasPointerMove);

function finishPointer(e) {
    if (!e) return;
    lastAnyInputEventAt = performance.now();
    if (ignoredPalmPointerIds.has(e.pointerId)) {
        ignoredPalmPointerIds.delete(e.pointerId);
        activePointers.delete(e.pointerId);
        pendingFinishTouchIds.delete(e.pointerId);
        return;
    }
    const wasPendingTouch = pendingFinishTouchIds.delete(e.pointerId);
    const pidKnown = wasPendingTouch ||
        activePointers.has(e.pointerId) ||
        (activePenPointerId !== null && e.pointerId === activePenPointerId) ||
        (singleFingerPanState.active && e.pointerId === singleFingerPanState.pointerId) ||
        (readPanState.active && e.pointerId === readPanState.pointerId) ||
        (mousePanState.active && e.pointerId === mousePanState.pointerId);
    if (!pidKnown) return;
    if (typeof e === 'object' && handledEndEvents) {
        if (handledEndEvents.has(e)) return;
        handledEndEvents.add(e);
    }
    if (e.pointerType === 'pen' || e.pointerId === activePenPointerId) {
        activePenPointerId = null;
        lastPenActivityAt = performance.now();
    }
    activePointers.delete(e.pointerId);
    cancelScheduledInkRender();
    cancelInkHoldTimer();
    cancelRxnArrowHoldTimer();
    if (activePointers.size === 0) {
        document.body?.classList?.remove('is-drawing-canvas');
        if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
            isCursorOutsidePaper = !isWorldPointOnPaper(screenToWorld(e.clientX, e.clientY));
            if (typeof updateCanvasCursor === 'function') updateCanvasCursor();
        }
    }
    if (activePointers.size !== 2) {
        lastPinchDist = null;
        lastPanMid = null;
        pinchStartZoom = null;
        pinchStartMid = null;
        pinchStartPan = null;
    }
    lastEraserPoint = null;

    if (mousePanState.active && (mousePanState.pointerId === e.pointerId || activePointers.size === 0)) {
        mousePanState.active = false;
        mousePanState.pointerId = null;
        mousePanState.button = -1;
        updateCanvasCursor();
        clampViewportPanAndZoom();
        if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
        updateRingTransformFloatingBarPos(); updateImageFloatingBarPos(); updateChainFloatingBarPos(); updateLassoFloatingBarPos();
        renderAll();
        return;
    }

    if (typeof isReadMode !== 'undefined' && isReadMode) {
        if (readPanState.pointerId === e.pointerId || activePointers.size === 0) {
            readPanState.active = false;
        }
        if (!multiTouchTapState.active || activePointers.size === 0) {
            multiTouchTapState.active = false;
            multiTouchTapState.maxPointers = 0;
            multiTouchTapState.movedFar = false;
            multiTouchTapState.zoomChanged = false;
            multiTouchTapState.startMid = null;
            multiTouchTapState.endMid = null;
            multiTouchTapState.startPoints.clear();
        }
        return;
    }

    if (singleFingerPanState.active && (singleFingerPanState.pointerId === e.pointerId || activePointers.size === 0)) {
        const wasEdge = !!singleFingerPanState.isEdgeSwipe;
        const wasPanActivated = !!singleFingerPanState.panActivated;
        const wasFromPinch = !!singleFingerPanState.fromPinchRelease;
        const dx = e.clientX - singleFingerPanState.startX;
        const dy = e.clientY - singleFingerPanState.startY;
        const nowEnd = performance.now();
        const dt = nowEnd - (singleFingerPanState.startTime || 0);
        const vx = singleFingerPanState.velX || 0;
        const vy = singleFingerPanState.velY || 0;
        const sinceMove = nowEnd - (singleFingerPanState.lastMoveTime || nowEnd);
        singleFingerPanState.active = false;
        singleFingerPanState.isEdgeSwipe = false;
        singleFingerPanState.fromPinchRelease = false;
        if (wasFromPinch) {
            multiTouchTapState.active = false;
            multiTouchTapState.startPoints?.clear?.();
        }

        if (!wasEdge && !wasPanActivated && !wasFromPinch && dt < 250 && Math.hypot(dx, dy) < 8) {
            const tapW = screenToWorld(e.clientX, e.clientY);
            const docTap = getDocState();
            const hitBond = findHitBondInterior(tapW.x, tapW.y, 16);
            if (hitBond) {
                tryHandleBondDoubleTap(hitBond.id, nowEnd, e.clientX, e.clientY);
                return;
            }
            const hitAtom = findNearestAtom(tapW.x, tapW.y, 22);
            if (hitAtom) {
                const preSnap = typeof clonePageContentSnapshot === 'function' ? clonePageContentSnapshot(docTap, false) : JSON.stringify(docTap);
                const preSeq = undoPushSeq;
                const preRedo = redoStack.slice();
                const atomTapRes = tryHandleAtomDoubleTap(hitAtom.id, nowEnd, e.clientX, e.clientY, preSnap, preSeq, preRedo);
                if (atomTapRes === 'double') return;
                if (window.unifiedTool === 'chem_group') {
                    applySubstituentActionToAtom(hitAtom, tapW, docTap);
                }
                return;
            }
            if (window.unifiedTool === 'chem_mech_arrow' || window.unifiedTool === 'chem_move') {
                const hitMa = (docTap.mechArrows || []).find(ma => distToSegment(tapW, { x: ma.x1, y: ma.y1 }, { x: ma.x2, y: ma.y2 }) < 18);
                if (hitMa && lastCanvasTapInfo.mechArrowId === hitMa.id && (nowEnd - (lastCanvasTapInfo.mechArrowTime || 0)) < 480) {
                    lastCanvasTapInfo.mechArrowId = null;
                    flipMechArrowCurve(hitMa, docTap);
                    return;
                }
                if (hitMa) {
                    lastCanvasTapInfo.mechArrowId = hitMa.id;
                    lastCanvasTapInfo.mechArrowTime = nowEnd;
                    return;
                }
            }
            if (selectedBondId) { selectedBondId = null; renderAll(); }
        }

        if (!wasEdge && sinceMove < 95 && Math.hypot(vx, vy) >= 1.2) {
            startPanInertia(vx, vy);
        } else if (wasPanActivated && typeof renderAll === 'function') {
            renderAll();
        }
        return;
    }

    if (multiTouchTapState.active) {
        if (multiTouchTapState.startPoints.has(e.pointerId)) {
            const sp = multiTouchTapState.startPoints.get(e.pointerId);
            if (Math.hypot(e.clientX - sp.x, e.clientY - sp.y) > 14) {
                multiTouchTapState.movedFar = true;
            }
        }
        pointerDownEligibleForDoubleTap = false;
        pointerDownClientPos = null;
        lastCanvasTapInfo.time = 0;
        if (activePointers.size > 0) return;

        const elapsed = performance.now() - multiTouchTapState.startTime;
        const maxPtrs = multiTouchTapState.maxPointers;
        const maxTW = multiTouchTapState.maxTouchW || 0;
        const ipadCfg = (typeof appLibrary !== 'undefined' && appLibrary?.ipadConfig) ? appLibrary.ipadConfig : {};
        const looksLikePalmMulti = ipadCfg.palmRejection !== false && maxTW > 56;
        const zoomChanged = !!multiTouchTapState.zoomChanged;
        const shouldFire = !multiTouchTapState.movedFar && !zoomChanged && !looksLikePalmMulti && elapsed < 320;
        const swStartMid = multiTouchTapState.startMid;
        const swEndMid = multiTouchTapState.endMid;
        multiTouchTapState.active = false;
        multiTouchTapState.maxPointers = 0;
        multiTouchTapState.maxTouchW = 0;
        multiTouchTapState.movedFar = false;
        multiTouchTapState.zoomChanged = false;
        multiTouchTapState.startMid = null;
        multiTouchTapState.endMid = null;
        multiTouchTapState.startPoints.clear();
        if (shouldFire) {
            if (maxPtrs === 2) {
                executeConfiguredIpadAction(ipadCfg.twoFingerTapAction || 'undo', 'Chạm 2 ngón');
            } else if (maxPtrs >= 3) {
                executeConfiguredIpadAction(ipadCfg.threeFingerTapAction || 'redo', 'Chạm 3 ngón');
            }
        } else if (maxPtrs === 2 && ipadCfg.twoFingerSwipePage !== false && !zoomChanged && swStartMid && swEndMid && elapsed < 380) {
            const dx = swEndMid.x - swStartMid.x;
            const dy = swEndMid.y - swStartMid.y;
            if (Math.abs(dx) >= 95 && Math.abs(dy) <= 55) {
                if (typeof stepActivePage === 'function') {
                    stepActivePage(dx < 0 ? 1 : -1);
                    if (typeof showGestureToast === 'function') {
                        showGestureToast(dx < 0 ? 'Vuốt 2 ngón: Trang sau' : 'Vuốt 2 ngón: Trang trước');
                    }
                }
            }
        }
        if (zoomChanged && typeof renderAll === 'function') {
            renderAll();
        }
        return;
    }

    const nowTap = performance.now();
    const tapLocalW = screenToWorld(e.clientX, e.clientY);
    const tapDuration = pointerDownTime ? (nowTap - pointerDownTime) : 9999;
    const isQuickObjTap = activePointers.size === 0 && tapDuration < 340 && pointerMaxMoveDist < 18;
    const curToolTap = window.unifiedTool;
    if (!bondTapHandledInDown && isQuickObjTap) {
        if (pointerDownBondHitId && curToolTap === 'chem_move') {
            const bRes = tryHandleBondDoubleTap(pointerDownBondHitId, nowTap, e.clientX, e.clientY, pointerDownSnapshot, pointerDownPushSeq, pointerDownRedoSnapshot);
            if (bRes === 'double') {
                pointerDownEligibleForDoubleTap = false;
                pointerDownClientPos = null;
                isDrawing = false;
                currentInkStroke = null;
                dragStartAtom = null; dragStartPos = null; previewChainPoints = [];
                cancelAtomHoldTimer(true);
                return;
            }
        }
        if (pointerDownAtomHitId && ['chem_bond', 'chem_wedge', 'chem_dash', 'chem_group', 'chem_move', 'chem_ring'].includes(curToolTap)) {
            if (curToolTap === 'chem_bond' && lastCanvasTapInfo.createdAtomId && lastCanvasTapInfo.createdAtomId === pointerDownAtomHitId && (nowTap - (lastCanvasTapInfo.time || 0)) < 420) {
                const preEmptySnap = lastCanvasTapInfo.preTapSnapshot;
                const preEmptySeq = lastCanvasTapInfo.preTapPushSeq;
                lastCanvasTapInfo = { time: 0, x: 0, y: 0, clientX: 0, clientY: 0, preTapSnapshot: null, preTapPushSeq: 0, createdAtomId: null };
                pointerDownEligibleForDoubleTap = false;
                pointerDownClientPos = null;
                isDrawing = false;
                currentInkStroke = null;
                dragStartAtom = null; dragStartPos = null; previewChainPoints = [];
                cancelAtomHoldTimer(true);
                if (preEmptySnap) rollbackTapSnapshot(preEmptySnap, preEmptySeq, null);
                renderAll();
                if (typeof openAtomHandwritingBox === 'function') {
                    openAtomHandwritingBox(null, tapLocalW, { x: e.clientX, y: e.clientY });
                }
                return;
            }
            const aRes = tryHandleAtomDoubleTap(pointerDownAtomHitId, nowTap, e.clientX, e.clientY, pointerDownSnapshot, pointerDownPushSeq, pointerDownRedoSnapshot);
            if (aRes === 'double') {
                pointerDownEligibleForDoubleTap = false;
                pointerDownClientPos = null;
                return;
            }
        }
    }
    const maxTapMoveAllowed = (curToolTap === 'pen_ballpoint' && pointerDownIsStylusTap) ? 5.5 : 8;
    const isQuickTap = pointerDownEligibleForDoubleTap && activePointers.size === 0 && tapDuration < 250 && pointerMaxMoveDist < maxTapMoveAllowed;
    const dblAction = (typeof appLibrary !== 'undefined' && appLibrary?.ipadConfig?.doubleTapAction) || 'eraser';
    const stylusSubDblTools = ['chem_bond', 'chem_wedge', 'chem_dash', 'chem_group', 'chem_move', 'chem_ring'];
    const isStylusSubTrigger = pointerDownIsStylusTap && stylusSubDblTools.includes(curToolTap);
    const tapPairDist = lastCanvasTapInfo.time ? Math.hypot(e.clientX - lastCanvasTapInfo.clientX, e.clientY - lastCanvasTapInfo.clientY) : 9999;
    const stylusEmptyDistLim = curToolTap === 'pen_ballpoint' ? 8.5 : 18;
    if (isQuickTap && lastCanvasTapInfo.time && (nowTap - lastCanvasTapInfo.time) < 380) {
        if (isStylusSubTrigger && tapPairDist < stylusEmptyDistLim) {
            const preSnap = lastCanvasTapInfo.preTapSnapshot;
            const preSeq = lastCanvasTapInfo.preTapPushSeq;
            lastCanvasTapInfo = { time: 0, x: 0, y: 0, clientX: 0, clientY: 0, preTapSnapshot: null, preTapPushSeq: 0, createdAtomId: null };
            pointerDownEligibleForDoubleTap = false;
            pointerDownClientPos = null;
            isDrawing = false;
            currentInkStroke = null;
            currentLaserStroke = null;
            dragStartAtom = null; dragStartPos = null; previewChainPoints = [];
            activeMoveTarget = null; activeExtraDragItem = null;
            cancelAtomHoldTimer(true);
            if (preSnap) rollbackTapSnapshot(preSnap, preSeq, null);
            renderAll();
            if (typeof openAtomHandwritingBox === 'function') {
                openAtomHandwritingBox(null, tapLocalW, { x: e.clientX, y: e.clientY });
            }
            return;
        }
        if (!pointerDownIsStylusTap && dblAction !== 'off' && tapPairDist < 28) {
            const preSnap = lastCanvasTapInfo.preTapSnapshot;
            const preSeq = lastCanvasTapInfo.preTapPushSeq;
            lastCanvasTapInfo = { time: 0, x: 0, y: 0, clientX: 0, clientY: 0, preTapSnapshot: null, preTapPushSeq: 0, createdAtomId: null };
            pointerDownEligibleForDoubleTap = false;
            pointerDownClientPos = null;
            isDrawing = false;
            currentInkStroke = null;
            currentLaserStroke = null;
            dragStartAtom = null; dragStartPos = null; previewChainPoints = [];
            activeMoveTarget = null; activeExtraDragItem = null;
            cancelAtomHoldTimer(true);
            if (preSnap) rollbackTapSnapshot(preSnap, preSeq, null);
            executeConfiguredIpadAction(dblAction, 'Chạm 2 lần');
            if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
            if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(400); else persistLibrary();
            renderAll();
            return;
        }
    }
    if (isQuickTap) {
        lastCanvasTapInfo = {
            time: nowTap,
            x: tapLocalW.x, y: tapLocalW.y,
            clientX: e.clientX, clientY: e.clientY,
            preTapSnapshot: pointerDownSnapshot,
            preTapPushSeq: pointerDownPushSeq,
            createdAtomId: pointerDownCreatedAtomId
        };
    } else if (pointerMaxMoveDist >= 10 || tapDuration >= 250) {
        lastCanvasTapInfo.time = 0;
    }
    pointerDownEligibleForDoubleTap = false;
    pointerDownClientPos = null;

    if (atomHoldState && !atomHoldState.active) {
        const st = atomHoldState;
        cancelAtomHoldTimer(true);
        if (st.pendingAction === 'stamp_ring') {
            stampRingAt(st.startW.x, st.startW.y, activeRingType);
            return;
        }
        if (st.pendingAction === 'apply_group') {
            isDrawing = false;
            dragStartAtom = null; dragStartPos = null; previewChainPoints = [];
            applySubstituentActionToAtom(st.atom, st.startW, getDocState(), null);
            return;
        }
        if (st.pendingAction === 'saturated_warn') {
            showGestureToast(`${st.atom.label} đã đạt tối đa ${getMaxValenceForAtom(st.atom)} liên kết!`);
            renderAll();
            return;
        }
    }
    if (activeImageSelection.id && activeImageSelection.dragMode) {
        const im = getSelectedImageObj();
        activeImageSelection.dragMode = null;
        if (im) ensureAutoNextPageIfNeeded((im.y || 0) + (im.h || 0));
        updateImageFloatingBarPos(); persistLibrary(); renderAll(); return;
    }
    if (activeRingGizmo.active && activeRingGizmo.dragMode) {
        activeRingGizmo.dragMode = null;
        const maxAtomY = (getDocState().atoms || [])
            .filter(a => activeRingGizmo.atomIds.includes(a.id))
            .reduce((m, a) => Math.max(m, a.y), 0);
        if (maxAtomY > 0) ensureAutoNextPageIfNeeded(maxAtomY);
        updateRingTransformFloatingBarPos(); persistLibrary(); renderAll(); return;
    }
    if (activeExtraDragItem) { activeExtraDragItem = null; persistLibrary(); renderAll(); return; }
    if (lassoSelection.dragging) {
        lassoSelection.dragging = false;
        if (lassoSelection.bounds) ensureAutoNextPageIfNeeded(lassoSelection.bounds.maxY);
        persistLibrary(); renderAll(); return;
    }
    if (!isDrawing) return;
    if (currentInkStroke && activeStrokePointerId !== null && e.pointerId !== activeStrokePointerId && activePointers.size > 0) {
        return;
    }
    isDrawing = false;

    const doc = getDocState();
    const t = window.unifiedTool;

    if (currentLaserStroke) {
        currentLaserStroke.createdAt = performance.now();
        laserStrokes.push(currentLaserStroke);
        currentLaserStroke = null;
        startLaserLoop();
        return;
    }
    if (activeMoveTarget) {
        let movedY = currentWorldPos ? currentWorldPos.y : null;
        if (activeMoveTarget.type === 'atom' && activeMoveTarget.item) movedY = activeMoveTarget.item.y;
        activeMoveTarget = null;
        atomHoldState = null;
        if (movedY !== null) ensureAutoNextPageIfNeeded(movedY);
        persistLibrary(); renderAll(); return;
    }
    if (currentInkStroke) {
        activeStrokePointerId = null;
        if (!doc.inkStrokes) doc.inkStrokes = [];
        delete currentInkStroke.liveTip;
        const inkPts = currentInkStroke.points || [];
        if (e && (e.type === 'pointercancel' || e.type === 'lostpointercapture')) {
            let cancelLen = 0;
            for (let k = 1; k < inkPts.length; k++) {
                cancelLen += Math.hypot(inkPts[k].x - inkPts[k - 1].x, inkPts[k].y - inkPts[k - 1].y);
            }
            if (inkPts.length <= 2 && cancelLen < 4.5) {
                currentInkStroke = null;
                renderAll();
                return;
            }
        }
        if (currentInkStroke.snappedShape && e && e.type !== 'lostpointercapture' && e.type !== 'pointercancel' && Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
            const sh = currentInkStroke.snappedShape;
            const endW = clampWorldPointToPaper(screenToWorld(e.clientX, e.clientY), 0.5);
            if (sh.type === 'line') {
                sh.pEnd = snapLineEndpoint(sh.pStart, endW);
                currentInkStroke.points = [{ ...sh.pStart }, { ...sh.pEnd }];
            } else if (sh.type === 'arc') {
                sh.pEnd = { ...endW };
                currentInkStroke.points = sampleQuadraticArc(sh.pStart, sh.pEnd, sh.archRatio, 24);
            }
        } else if (!currentInkStroke.snappedShape && e && e.type !== 'lostpointercapture' && e.type !== 'pointercancel' && Number.isFinite(e.clientX) && Number.isFinite(e.clientY) && inkPts.length >= 1) {
            const endW = clampWorldPointToPaper(screenToWorld(e.clientX, e.clientY), 0.5);
            const lastPt = inkPts[inkPts.length - 1];
            const tailDist = Math.hypot(endW.x - lastPt.x, endW.y - lastPt.y);
            const minTail = currentInkStroke.mode === 'highlighter'
                ? Math.max(2.2, (currentInkStroke.width || 14) * 0.18)
                : (currentInkStroke.penStyle === 'ballpoint' ? 0.5 : 1.15);
            let isReverseHook = false;
            if (inkPts.length >= 2 && tailDist > 0.1) {
                const prev2 = inkPts[inkPts.length - 2];
                const d1x = lastPt.x - prev2.x, d1y = lastPt.y - prev2.y;
                const d2x = endW.x - lastPt.x, d2y = endW.y - lastPt.y;
                const l1 = Math.hypot(d1x, d1y);
                if (l1 > 0.5 && ((d1x * d2x + d1y * d2y) / (l1 * tailDist)) < -0.25 && tailDist < 6.0) {
                    isReverseHook = true;
                }
            }
            if (!isReverseHook && tailDist > minTail && tailDist < 400) {
                const lastP = (typeof lastPt?.p === 'number' && lastPt.p > 0) ? lastPt.p : 0.36;
                const tailP = (e.pointerType === 'pen' && typeof e.pressure === 'number' && e.pressure > 0 && e.pressure <= 1)
                    ? Math.min(lastP, e.pressure)
                    : (lastP * 0.45);
                const sTs = currentInkStroke._liveState?.startTs;
                const endTs = (typeof e.timeStamp === 'number' && e.timeStamp > 0) ? e.timeStamp : performance.now();
                const tailT = typeof sTs === 'number' ? Math.max((lastPt?.t || 0) + 0.5, Number((endTs - sTs).toFixed(2))) : undefined;
                inkPts.push(typeof tailT === 'number'
                    ? { x: endW.x, y: endW.y, p: tailP, t: tailT }
                    : { x: endW.x, y: endW.y, p: tailP });
            }
        }
        const snappedKind = currentInkStroke.snappedShape?.type || null;
        if (snappedKind === 'carbon_ring') {
            const sr = currentInkStroke.snappedShape;
            const rCount = commitRegularCarbonRing(doc, sr.cx, sr.cy, sr.n, sr.startAng, currentInkStroke.color);
            currentInkStroke = null;
            if (rCount >= 3 && typeof showGestureToast === 'function') {
                showGestureToast('✨ Tự căn đẹp Vòng ' + rCount + 'C!');
            }
            if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
            if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(900); else persistLibrary();
            renderAll(); return;
        }
        if (snappedKind === 'carbon_chain') {
            const cCount = commitCarbonChainFromVertices(currentInkStroke.snappedShape.vertices, doc, currentInkStroke.color);
            currentInkStroke = null;
            if (cCount >= 2 && typeof showGestureToast === 'function') {
                showGestureToast('✨ Đã tạo Mạch Carbon (' + cCount + 'C)');
            }
            if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
            if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(900); else persistLibrary();
            renderAll(); return;
        }
        if (!currentInkStroke.snappedShape) {
            try {
                const minRev = 3;
                if (currentInkStroke.mode !== 'highlighter' && appLibrary.scribbleEraseEnabled !== false && isScribbleEraseGesture(inkPts, minRev)) {
                    const erasedCount = applyScribbleErase(inkPts, doc);
                    if (erasedCount > 0) {
                        currentInkStroke = null;
                        if (typeof showGestureToast === 'function') {
                            showGestureToast('Đã xoá ' + erasedCount + ' đối tượng bằng nét gạch (Goodnotes Scribble)');
                        }
                        if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
                        if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(900); else persistLibrary();
                        renderAll(); return;
                    }
                }
                if (currentInkStroke.mode === 'ink' && appLibrary.autoZigZagToCarbon !== false) {
                    const freeRing = detectFreehandCarbonRing(inkPts, true);
                    if (freeRing) {
                        const rCount = commitRegularCarbonRing(doc, freeRing.cx, freeRing.cy, freeRing.n, freeRing.startAng, currentInkStroke.color);
                        if (rCount >= 5) {
                            currentInkStroke = null;
                            if (typeof showGestureToast === 'function') {
                                showGestureToast('✨ Tự căn đẹp Vòng ' + rCount + 'C!');
                            }
                            if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
                            if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(900); else persistLibrary();
                            renderAll(); return;
                        }
                    }
                    const zzVerts = isUnambiguousZigZagCarbonStroke(inkPts, doc);
                    if (zzVerts) {
                        const cCount = commitCarbonChainFromVertices(zzVerts, doc, currentInkStroke.color);
                        if (cCount >= 3) {
                            currentInkStroke = null;
                            if (typeof showGestureToast === 'function') {
                                showGestureToast('✨ Mạch Carbon (' + cCount + 'C)');
                            }
                            if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
                            if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(900); else persistLibrary();
                            renderAll(); return;
                        }
                    }
                }
            } catch (_) {}
        }
        stripTransientInkFields(currentInkStroke);
        const finalInkPts = currentInkStroke.points || [];
        if (!snappedKind && currentInkStroke.mode === 'highlighter' && finalInkPts.length >= 2) {
            try {
                currentInkStroke.points = beautifyHighlighterStrokePoints(finalInkPts, currentInkStroke.width || 14);
                currentInkStroke._preSmoothed = true;
            } catch (_) {}
        } else if (!snappedKind && currentInkStroke.mode !== 'highlighter' && finalInkPts.length >= 4) {
            try {
                currentInkStroke.points = beautifyInkStrokePoints(finalInkPts, {
                    smoothing: currentInkStroke.smoothing,
                    autoRefine: typeof appLibrary === 'undefined' || appLibrary.penAutoRefine !== false
                });
            } catch (_) {}
        }
        const committedStroke = currentInkStroke;
        let maxInkY = null;
        committedStroke.points.forEach(p => { if (maxInkY === null || p.y > maxInkY) maxInkY = p.y; });
        doc.inkStrokes.push(committedStroke);
        currentInkStroke = null;
        const pageAppended = ensureAutoNextPageIfNeeded(maxInkY);
        if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(2200); else persistLibrary();
        const actIdx = getActiveNotebook().activePageIndex || 0;
        try {
            if (!pageAppended && typeof commitStrokeToInkBaseLayerCache === 'function' &&
                commitStrokeToInkBaseLayerCache(committedStroke, actIdx, doc.inkStrokes.length)) {
                return;
            }
        } catch (_) {}
        if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
        renderAll(); return;
    }
    if (t === 'pen_line' && dragStartPos && currentWorldPos) {
        if (!doc.inkStrokes) doc.inkStrokes = [];
        doc.inkStrokes.push({ mode: 'ink', penStyle: activePenStyle, color: penColor, width: strokeWidth, opacity: penOpacity, points: [dragStartPos, currentWorldPos] });
        ensureAutoNextPageIfNeeded(Math.max(dragStartPos.y, currentWorldPos.y));
        dragStartPos = null;
        if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
        if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(900); else persistLibrary();
        renderAll(); return;
    }
    if (t === 'pen_lasso' && lassoSelection.polygon.length > 2) {
        const poly = lassoSelection.polygon;
        lassoSelection.selectedAtomIds = (doc.atoms || []).filter(a => isPointInPolygon(a, poly)).map(a => a.id);
        lassoSelection.selectedOrbitalIds = (doc.orbitals || []).filter(ob => isPointInPolygon(ob, poly)).map(ob => ob.id);
        lassoSelection.selectedSymbolIds = (doc.chemSymbols || []).filter(sm => isPointInPolygon(sm, poly)).map(sm => sm.id);
        lassoSelection.selectedTextIds = (doc.texts || []).filter(tx => isPointInPolygon(tx, poly)).map(tx => tx.id);
        lassoSelection.selectedArrowIds = (doc.arrows || []).filter(ar =>
            isPointInPolygon({ x: (ar.x1 + ar.x2) / 2, y: (ar.y1 + ar.y2) / 2 }, poly) ||
            (isPointInPolygon({ x: ar.x1, y: ar.y1 }, poly) && isPointInPolygon({ x: ar.x2, y: ar.y2 }, poly))
        ).map(ar => ar.id);
        lassoSelection.selectedMechArrowIds = (doc.mechArrows || []).filter(ma =>
            isPointInPolygon({ x: (ma.x1 + ma.x2) / 2, y: (ma.y1 + ma.y2) / 2 }, poly) ||
            (isPointInPolygon({ x: ma.x1, y: ma.y1 }, poly) && isPointInPolygon({ x: ma.x2, y: ma.y2 }, poly))
        ).map(ma => ma.id);
        lassoSelection.selectedBracketIds = (doc.brackets || []).filter(br =>
            isPointInPolygon({ x: br.x + br.w / 2, y: br.y + br.h / 2 }, poly)
        ).map(br => br.id);
        lassoSelection.selectedInkIndices = [];
        (doc.inkStrokes || []).forEach((st, idx) => {
            if (isStrokeInsideLassoPolygon(st, poly)) lassoSelection.selectedInkIndices.push(idx);
        });
        // Ảnh đã cố định (im.locked === true, VD phần cắt từ Đề bài) luôn miễn nhiễm hoàn toàn với khoanh Lasso
        lassoSelection.selectedImageIds = (doc.images || []).filter(im => {
            if (im.locked) return false;
            return isPointInPolygon({ x: im.x + im.w * 0.5, y: im.y + im.h * 0.5 }, poly);
        }).map(im => im.id);
        const totalSelected = lassoSelection.selectedAtomIds.length + lassoSelection.selectedOrbitalIds.length +
            lassoSelection.selectedSymbolIds.length + lassoSelection.selectedTextIds.length +
            lassoSelection.selectedArrowIds.length + lassoSelection.selectedMechArrowIds.length +
            lassoSelection.selectedBracketIds.length + lassoSelection.selectedInkIndices.length +
            lassoSelection.selectedImageIds.length;
        if (!totalSelected) {
            clearLassoSelection(); renderAll(); return;
        }
        recomputeLassoBounds();
        lassoSelection.active = true;
        updateLassoFloatingBarPos();
        renderAll(); return;
    }
    if (t === 'chem_group' && dragStartAtom && dragStartPos && currentWorldPos) {
        const distG = Math.hypot(currentWorldPos.x - dragStartPos.x, currentWorldPos.y - dragStartPos.y);
        const targetAtom = dragStartAtom;
        const endPos = currentWorldPos;
        const startP = dragStartPos;
        dragStartAtom = null; dragStartPos = null; previewChainPoints = [];
        if (distG >= 14) {
            const dragAng = Math.atan2(endPos.y - startP.y, endPos.x - startP.x);
            applySubstituentActionToAtom(targetAtom, endPos, doc, dragAng);
        } else {
            applySubstituentActionToAtom(targetAtom, endPos, doc, null);
        }
        return;
    }
    if ((t === 'chem_bond' || t === 'chem_wedge' || t === 'chem_dash') && dragStartAtom && currentWorldPos) {
        if (t === 'chem_bond' && previewChainPoints && previewChainPoints.length >= 2) {
            let prevAtom = dragStartAtom;
            let maxY = prevAtom.y;
            const builtIds = [prevAtom.id];
            for (let i = 1; i < previewChainPoints.length; i++) {
                const pt = previewChainPoints[i];
                let nextAtom = pt.existingAtom || findNearestAtom(pt.x, pt.y, 14);
                const isReuse = !!(nextAtom && nextAtom !== prevAtom);
                const existsBond = isReuse && (doc.bonds || []).some(b =>
                    (b.a1 === prevAtom.id && b.a2 === nextAtom.id) ||
                    (b.a1 === nextAtom.id && b.a2 === prevAtom.id)
                );
                if (!existsBond) {
                    if (!canAddBondOrder(prevAtom, 1, doc)) {
                        showGestureToast('Đạt giới hạn hóa trị của ' + getAtomBaseElement(prevAtom));
                        break;
                    }
                    if (isReuse && !canAddBondOrder(nextAtom, 1, doc)) {
                        showGestureToast('Đạt giới hạn hóa trị của ' + getAtomBaseElement(nextAtom));
                        break;
                    }
                    if (!isReuse) {
                        nextAtom = { id: genId('a'), x: pt.x, y: pt.y, label: 'C', color: penColor };
                        doc.atoms.push(nextAtom);
                    }
                    const newBondObj = { id: genId('b'), a1: prevAtom.id, a2: nextAtom.id, order: 1, stereo: null, color: penColor };
                    doc.bonds.push(newBondObj);
                    if (isReuse && typeof beautifyClosedRingInDoc === 'function') {
                        const ringSz = beautifyClosedRingInDoc(doc, prevAtom, nextAtom, newBondObj.id);
                        if (ringSz >= 3 && typeof showGestureToast === 'function') {
                            showGestureToast('✨ Tự căn đẹp vòng ' + ringSz + ' cạnh!');
                        }
                    }
                }
                maxY = Math.max(maxY, nextAtom.y);
                prevAtom = nextAtom;
                builtIds.push(nextAtom.id);
                window.lastActiveChemAtomId = nextAtom.id;
            }
            enforceAllValenceAndHydrogens(doc);
            if (builtIds.length >= 2) {
                activeCarbonChain = {
                    active: true,
                    mode: 'zigzag',
                    atomIds: builtIds,
                    dirX: (prevAtom.x >= dragStartAtom.x) ? 1 : -1,
                    fischerSpines: []
                };
                updateChainFloatingBarPos();
            }
            ensureAutoNextPageIfNeeded(maxY);
            previewChainPoints = [];
            dragStartAtom = null; dragStartPos = null;
            persistLibrary(); renderAll(); return;
        }

        let targetA = findNearestAtom(currentWorldPos.x, currentWorldPos.y, 18);
        let maxY = dragStartAtom.y;
        let createdNewAtom = false;
        if (!targetA || targetA === dragStartAtom) {
            const ang = getSmartHorizontalZigZagAngle(dragStartAtom, doc);
            const isClick = Math.hypot(currentWorldPos.x - dragStartAtom.x, currentWorldPos.y - dragStartAtom.y) < 10;
            const tx = isClick ? dragStartAtom.x + BOND_LENGTH * Math.cos(ang) : currentWorldPos.x;
            const ty = isClick ? dragStartAtom.y + BOND_LENGTH * Math.sin(ang) : currentWorldPos.y;
            targetA = findNearestAtom(tx, ty, 18);
            if (!targetA || targetA === dragStartAtom) {
                if (!canAddBondOrder(dragStartAtom, 1, doc)) {
                    showGestureToast('Đạt giới hạn hóa trị của ' + getAtomBaseElement(dragStartAtom));
                    previewChainPoints = [];
                    dragStartAtom = null; dragStartPos = null;
                    renderAll(); return;
                }
                targetA = { id: genId('a'), x: tx, y: ty, label: 'C', color: penColor };
                doc.atoms.push(targetA);
                createdNewAtom = true;
            }
        }
        if (targetA && targetA !== dragStartAtom) {
            const existingBond = (doc.bonds || []).find(b =>
                (b.a1 === dragStartAtom.id && b.a2 === targetA.id) ||
                (b.a1 === targetA.id && b.a2 === dragStartAtom.id)
            );
            if (existingBond) {
                if (existingBond.order < 3 && canAddBondOrder(dragStartAtom, 1, doc) && canAddBondOrder(targetA, 1, doc)) {
                    existingBond.order += 1;
                    alignLinearSpChemistry(doc);
                } else {
                    showGestureToast('Đạt giới hạn hóa trị!');
                }
            } else if (canAddBondOrder(dragStartAtom, 1, doc) && (createdNewAtom || canAddBondOrder(targetA, 1, doc))) {
                const stereo = t === 'chem_wedge' ? 'wedge' : (t === 'chem_dash' ? 'dash' : null);
                const newBondObj = { id: genId('b'), a1: dragStartAtom.id, a2: targetA.id, order: 1, stereo, color: penColor };
                doc.bonds.push(newBondObj);
                if (!createdNewAtom && !stereo && typeof beautifyClosedRingInDoc === 'function') {
                    const ringSz = beautifyClosedRingInDoc(doc, dragStartAtom, targetA, newBondObj.id);
                    if (ringSz >= 3 && typeof showGestureToast === 'function') {
                        showGestureToast('✨ Tự căn đẹp vòng ' + ringSz + ' cạnh!');
                    }
                }
            } else {
                if (createdNewAtom) doc.atoms = doc.atoms.filter(a => a !== targetA);
                showGestureToast('Đạt giới hạn hóa trị!');
            }
            maxY = Math.max(maxY, targetA.y);
            window.lastActiveChemAtomId = targetA.id;
        }
        enforceAllValenceAndHydrogens(doc);
        ensureAutoNextPageIfNeeded(maxY);
        previewChainPoints = [];
        dragStartAtom = null; dragStartPos = null;
        persistLibrary(); renderAll(); return;
    }
    if (t === 'chem_rxn_arrow' && dragStartPos && currentWorldPos) {
        if (Math.hypot(currentWorldPos.x - dragStartPos.x, currentWorldPos.y - dragStartPos.y) > 14) {
            doc.arrows.push({ id: genId('ar'), x1: dragStartPos.x, y1: dragStartPos.y, x2: currentWorldPos.x, y2: currentWorldPos.y, type: activeRxnArrowType, color: penColor });
            ensureAutoNextPageIfNeeded(Math.max(dragStartPos.y, currentWorldPos.y));
        }
        rxnArrowHoldSnapped = false;
        rxnArrowHoldPos = null;
        dragStartPos = null; persistLibrary(); renderAll(); return;
    }
    if (t === 'chem_mech_arrow' && dragStartPos && currentWorldPos) {
        const dragDist = Math.hypot(currentWorldPos.x - dragStartPos.x, currentWorldPos.y - dragStartPos.y);
        if (dragDist > 14) {
            const dragBias = getActiveMechArrowDragBias(dragStartPos, currentWorldPos, mechArrowDragPoints);
            const newMa = {
                id: genId('ma'),
                x1: dragStartPos.x, y1: dragStartPos.y,
                x2: currentWorldPos.x, y2: currentWorldPos.y,
                type: activeMechArrowType,
                color: '#e11d48',
                dragBias
            };
            if (typeof computeSmartMechArrowControlPoint === 'function') {
                const smartCtrl = computeSmartMechArrowControlPoint(newMa, doc, dragBias);
                newMa.cpx = smartCtrl.x;
                newMa.cpy = smartCtrl.y;
            }
            doc.mechArrows.push(newMa);
            ensureAutoNextPageIfNeeded(Math.max(dragStartPos.y, currentWorldPos.y));
        } else {
            const hitMa = (doc.mechArrows || []).find(ma => distToSegment(currentWorldPos, { x: ma.x1, y: ma.y1 }, { x: ma.x2, y: ma.y2 }) < 18);
            if (hitMa && lastCanvasTapInfo.mechArrowId === hitMa.id && (nowTap - (lastCanvasTapInfo.mechArrowTime || 0)) < 480) {
                lastCanvasTapInfo.mechArrowId = null;
                flipMechArrowCurve(hitMa, doc);
            } else if (hitMa) {
                lastCanvasTapInfo.mechArrowId = hitMa.id;
                lastCanvasTapInfo.mechArrowTime = nowTap;
            }
        }
        mechArrowDragPoints = [];
        dragStartPos = null; persistLibrary(); renderAll(); return;
    }
    dragStartAtom = null; dragStartPos = null;
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(900); else persistLibrary();
    renderAll();
}

canvas.addEventListener('pointerup', finishPointer);
canvas.addEventListener('pointercancel', finishPointer);
canvas.addEventListener('lostpointercapture', finishPointer);
canvas.addEventListener('pointerleave', () => {
    if (!isDrawing && window.unifiedTool === 'pen_eraser') {
        currentWorldPos = null;
        scheduleInkRender();
    }
});
canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
});
canvas.addEventListener('selectstart', e => {
    e.preventDefault();
});
canvas.addEventListener('dragstart', e => {
    e.preventDefault();
});
const isStylusTouchEvent = (te) => {
    if (!te) return false;
    const lists = [te.changedTouches, te.touches];
    for (let k = 0; k < lists.length; k++) {
        const list = lists[k];
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
            if (list[i] && list[i].touchType === 'stylus') return true;
        }
    }
    return false;
};
function getTrueFingerTouches(touchList) {
    const arr = [];
    if (!touchList) return arr;
    for (let i = 0; i < touchList.length; i++) {
        const t = touchList[i];
        if (!t || t.touchType === 'stylus') continue;
        const rx = t.radiusX || 0, ry = t.radiusY || 0;
        const force = typeof t.force === 'number' ? t.force : 0;
        if (force > 0.01 && rx > 0 && rx <= 5 && ry > 0 && ry <= 5) continue;
        if (rx > 62 || ry > 62) continue;
        arr.push(t);
    }
    return arr;
}

function beginNativePinchFromFingers(f0, f1, nowT) {
    if (!f0 || !f1) return false;
    if (!Number.isFinite(f0.clientX) || !Number.isFinite(f0.clientY) || !Number.isFinite(f1.clientX) || !Number.isFinite(f1.clientY)) return false;
    const dist = Math.hypot(f0.clientX - f1.clientX, f0.clientY - f1.clientY);
    if (dist < 14) return false;
    stopPanInertia();
    nativePinchState.active = true;
    nativePinchState.startDist = dist;
    nativePinchState.startZoom = zoom;
    nativePinchState.startMidX = (f0.clientX + f1.clientX) / 2;
    nativePinchState.startMidY = (f0.clientY + f1.clientY) / 2;
    nativePinchState.startPanX = panX;
    nativePinchState.startPanY = panY;
    nativePinchState.zoomChanged = false;
    nativePinchState.lastMoveAt = nowT;
    lastPinchDist = dist;
    if (isDrawing && currentInkStroke) {
        cancelScheduledInkRender();
        cancelInkHoldTimer();
        document.body?.classList?.remove('is-drawing-canvas');
        isDrawing = false;
        currentInkStroke = null;
        activeStrokePointerId = null;
        if (pointerDownSnapshot && (nowT - (pointerDownTime || 0)) < 300) {
            rollbackTapSnapshot(pointerDownSnapshot, pointerDownPushSeq, pointerDownRedoSnapshot);
            pointerDownSnapshot = null;
            pointerDownRedoSnapshot = null;
        }
    }
    singleFingerPanState.active = false;
    singleFingerPanState.isEdgeSwipe = false;
    nativeSinglePanState.active = false;
    nativeSinglePanState.isEdgeSwipe = false;
    nativeSinglePanState.fromPinchRelease = false;
    readPanState.active = false;
    return true;
}

function beginNativeSinglePanFromFinger(f0, nowT, fromPinchRelease = false) {
    if (!f0 || !Number.isFinite(f0.clientX) || !Number.isFinite(f0.clientY)) return false;
    const ipadCfg = (typeof appLibrary !== 'undefined' && appLibrary?.ipadConfig) ? appLibrary.ipadConfig : {};
    const readOnly = typeof isReadMode !== 'undefined' && isReadMode;
    const sfMode = readOnly
        ? 'pan'
        : (window.unifiedTool === 'pen_pan' ? 'pan' : (ipadCfg.singleFingerMode || 'pan'));
    if (sfMode !== 'pan') return false;

    const rectEdge = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : canvas.getBoundingClientRect();
    const canvasW = rectEdge.width || cssWidth || 800;
    const localTouchX = f0.clientX - (rectEdge.left || 0);
    const isLeftHanded = ipadCfg.handedness === 'left';
    const nearDrawerEdge = !fromPinchRelease && !readOnly && ipadCfg.edgeSwipeExamDrawer !== false && (
        (!isLeftHanded && localTouchX >= canvasW - 28) ||
        (isLeftHanded && localTouchX <= 28)
    );

    if (!fromPinchRelease && !nearDrawerEdge && !readOnly) {
        const touchW = screenToWorld(f0.clientX, f0.clientY);
        const curSelImg = getSelectedImageObj();
        const hitsSelImg = !!(curSelImg && !curSelImg.locked && (
            Math.hypot(touchW.x - (curSelImg.x + curSelImg.w), touchW.y - (curSelImg.y + curSelImg.h)) < 24 ||
            (touchW.x >= curSelImg.x && touchW.x <= curSelImg.x + curSelImg.w && touchW.y >= curSelImg.y && touchW.y <= curSelImg.y + curSelImg.h)
        ));
        const hitsRingGizmo = !!(activeRingGizmo.active && (
            Math.hypot(touchW.x - (activeRingGizmo.cx + activeRingGizmo.radius), touchW.y - activeRingGizmo.cy) < 24 ||
            Math.hypot(touchW.x - activeRingGizmo.cx, touchW.y - activeRingGizmo.cy) < activeRingGizmo.radius
        ));
        const hitsLassoBox = !!(lassoSelection.active && lassoSelection.bounds &&
            touchW.x >= lassoSelection.bounds.minX && touchW.x <= lassoSelection.bounds.maxX &&
            touchW.y >= lassoSelection.bounds.minY && touchW.y <= lassoSelection.bounds.maxY);
        if (hitsSelImg || hitsRingGizmo || hitsLassoBox) return false;
    }

    stopPanInertia();
    nativeSinglePanState = {
        active: true,
        touchId: typeof f0.identifier === 'number' ? f0.identifier : null,
        startX: f0.clientX,
        startY: f0.clientY,
        lastX: f0.clientX,
        lastY: f0.clientY,
        startPanX: panX,
        startPanY: panY,
        startTime: nowT,
        lastMoveTime: nowT,
        velX: 0,
        velY: 0,
        panActivated: !!fromPinchRelease,
        isEdgeSwipe: !!nearDrawerEdge,
        fromPinchRelease: !!fromPinchRelease,
        movedByTouch: false
    };
    return true;
}

canvas.addEventListener('touchstart', e => {
    lastCanvasTouchSeq++;
    const nowT = performance.now();
    lastAnyInputEventAt = nowT;
    armTouchStuckWatchdog();
    lastNativeTouchCount = (e && e.touches) ? e.touches.length : 1;
    lastNativeTouchAt = nowT;
    // Chặn tuyệt đối cử chỉ native zoom/scroll của iPadOS Safari để vuốt 1 ngón & zoom 2 ngón luôn mượt 120fps
    if (e && e.cancelable) e.preventDefault();

    if (lastNativeTouchCount === 1) {
        nativePinchState.active = false;
        nativePinchState.zoomChanged = false;
        // Chỉ dọn zombie pointer cũ (> 80ms), tuyệt đối không xóa ngón vừa chạm từ pointerdown 0.1ms trước!
        for (const [pid, pt] of Array.from(activePointers.entries())) {
            if (pt.type === 'touch' && !pt.isFineStylus && (nowT - (pt.startTime || 0)) > 80) {
                activePointers.delete(pid);
            }
        }
    }

    const hasConfirmedStroke = isDrawing && currentInkStroke &&
        ((nowT - (pointerDownTime || 0)) > 80 || (typeof pointerMaxMoveDist === 'number' && pointerMaxMoveDist > 16));
    const penActiveNow = (activePenPointerId !== null && (nowT - lastPenActivityAt) < 650) || ((nowT - lastPenActivityAt) < 50 && lastNativeTouchCount < 2) || hasConfirmedStroke;

    if (!penActiveNow && e && e.touches) {
        const fingers = getTrueFingerTouches(e.touches);
        if (fingers.length >= 2) {
            beginNativePinchFromFingers(fingers[0], fingers[1], nowT);
        } else if (fingers.length === 1 && !isStylusTouchEvent(e)) {
            beginNativeSinglePanFromFinger(fingers[0], nowT, false);
        }
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    lastCanvasTouchSeq++;
    const nowT = performance.now();
    lastAnyInputEventAt = nowT;
    armTouchStuckWatchdog();
    lastNativeTouchCount = (e && e.touches) ? e.touches.length : lastNativeTouchCount;
    lastNativeTouchAt = nowT;
    if (e && e.cancelable) e.preventDefault();

    if (e && e.touches && e.touches.length >= 2) {
        const fingers = getTrueFingerTouches(e.touches);
        if (fingers.length >= 2) {
            const t0 = fingers[0], t1 = fingers[1];
            if (!nativePinchState.active) {
                const hasConfirmedStroke = isDrawing && currentInkStroke &&
                    ((nowT - (pointerDownTime || 0)) > 80 || (typeof pointerMaxMoveDist === 'number' && pointerMaxMoveDist > 16));
                if ((activePenPointerId === null || (nowT - lastPenActivityAt) > 650) && !hasConfirmedStroke) {
                    beginNativePinchFromFingers(t0, t1, nowT);
                }
            }
            if (nativePinchState.active && Number.isFinite(t0.clientX) && Number.isFinite(t0.clientY) && Number.isFinite(t1.clientX) && Number.isFinite(t1.clientY)) {
                nativePinchState.lastMoveAt = nowT;
                const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
                const midX = (t0.clientX + t1.clientX) / 2;
                const midY = (t0.clientY + t1.clientY) / 2;
                if (multiTouchTapState.active) {
                    multiTouchTapState.endMid = { x: midX, y: midY };
                    if (Math.hypot(midX - nativePinchState.startMidX, midY - nativePinchState.startMidY) > 12) {
                        multiTouchTapState.movedFar = true;
                    }
                }
                if (nativePinchState.startDist > 10 && dist > 10) {
                    lastPinchDist = dist;
                    let targetZoom = nativePinchState.startZoom;
                    if (Math.abs(dist - nativePinchState.startDist) > 3.0) {
                        const rawRatio = dist / nativePinchState.startDist;
                        const minZ = typeof getMinFullScreenZoom === 'function' ? getMinFullScreenZoom() : 0.22;
                        targetZoom = Math.max(minZ, Math.min(3.5, nativePinchState.startZoom * rawRatio));
                    }
                    if (Math.abs(targetZoom - nativePinchState.startZoom) > 0.035) {
                        nativePinchState.zoomChanged = true;
                        if (multiTouchTapState.active) {
                            multiTouchTapState.zoomChanged = true;
                            multiTouchTapState.movedFar = true;
                        }
                    }
                    const rect = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : canvas.getBoundingClientRect();
                    const lx = midX - rect.left, ly = midY - rect.top;
                    const lx0 = nativePinchState.startMidX - rect.left, ly0 = nativePinchState.startMidY - rect.top;
                    zoom = targetZoom;
                    panX = lx - (lx0 - nativePinchState.startPanX) * (targetZoom / nativePinchState.startZoom);
                    panY = ly - (ly0 - nativePinchState.startPanY) * (targetZoom / nativePinchState.startZoom);
                    clampViewportPanAndZoom();
                    scheduleViewportRender();
                }
                return;
            }
        }
    }

    // Cử chỉ 1 ngón Native Touch (sang ngang, lên xuống, chéo 360° siêu mượt 120fps trên iPadOS)
    if (e && e.touches && e.touches.length === 1 && !nativePinchState.active && !isStylusTouchEvent(e)) {
        const fingers1 = getTrueFingerTouches(e.touches);
        if (fingers1.length === 1) {
            const f0 = fingers1[0];
            if (!nativeSinglePanState.active) {
                const penStillActive = (activePenPointerId !== null && (nowT - lastPenActivityAt) < 650) || (isDrawing && currentInkStroke);
                if (!penStillActive) {
                    beginNativeSinglePanFromFinger(f0, nowT, false);
                }
            }
            if (nativeSinglePanState.active && Number.isFinite(f0.clientX) && Number.isFinite(f0.clientY)) {
                nativeSinglePanState.movedByTouch = true;
                singleFingerPanState.active = false;
                if (nativeSinglePanState.isEdgeSwipe) {
                    const dxE = f0.clientX - nativeSinglePanState.startX;
                    const dyE = f0.clientY - nativeSinglePanState.startY;
                    const isLeftHanded = appLibrary?.ipadConfig?.handedness === 'left';
                    const inward = isLeftHanded ? (dxE >= 42) : (dxE <= -42);
                    if (inward && Math.abs(dyE) < 90) {
                        nativeSinglePanState.active = false;
                        if (typeof toggleExamDrawer === 'function') toggleExamDrawer(true);
                        if (typeof showGestureToast === 'function') showGestureToast('Vuốt cạnh: Đã mở Ngăn Đề Bài');
                        return;
                    } else if (Math.abs(dyE) > 14 && Math.abs(dxE) < 16) {
                        nativeSinglePanState.isEdgeSwipe = false;
                        nativeSinglePanState.panActivated = true;
                    } else {
                        nativeSinglePanState.lastX = f0.clientX;
                        nativeSinglePanState.lastY = f0.clientY;
                        return;
                    }
                }
                if (!nativeSinglePanState.panActivated) {
                    if (Math.hypot(f0.clientX - nativeSinglePanState.startX, f0.clientY - nativeSinglePanState.startY) < 2.0) {
                        return;
                    }
                    nativeSinglePanState.panActivated = true;
                }
                const panDx = f0.clientX - nativeSinglePanState.lastX;
                const panDy = f0.clientY - nativeSinglePanState.lastY;
                const dtPan = Math.max(4, nowT - (nativeSinglePanState.lastMoveTime || nowT));
                const instVx = (panDx / dtPan) * 16.67;
                const instVy = (panDy / dtPan) * 16.67;
                nativeSinglePanState.velX = (nativeSinglePanState.velX || 0) * 0.48 + instVx * 0.52;
                nativeSinglePanState.velY = (nativeSinglePanState.velY || 0) * 0.48 + instVy * 0.52;
                nativeSinglePanState.lastMoveTime = nowT;
                panX += panDx;
                panY += panDy;
                if (!nativeSinglePanState.fromPinchRelease && (nowT - (nativeSinglePanState.startTime || nowT)) < 280) {
                    touchPalmBuffer = {
                        dx: panX - nativeSinglePanState.startPanX,
                        dy: panY - nativeSinglePanState.startPanY,
                        at: nowT
                    };
                }
                nativeSinglePanState.lastX = f0.clientX;
                nativeSinglePanState.lastY = f0.clientY;
                if (panDy < -8 && (typeof isReadMode === 'undefined' || !isReadMode) && appLibrary.autoAddPage !== false) {
                    const nb = getActiveNotebook();
                    const totalH = nb.pages.length * (A4_HEIGHT + PAGE_GAP) * zoom;
                    const minPanY = Math.min(0, cssHeight - totalH);
                    if (panY <= minPanY + 18) appendAutoPageToNotebook(nb);
                }
                clampViewportPanAndZoom();
                scheduleViewportRender();
                return;
            }
        }
    }
}, { passive: false });

function handleNativeTouchEndOrCancel(e) {
    if (e && typeof e === 'object' && handledNativeEndEvents) {
        if (handledNativeEndEvents.has(e)) return;
        handledNativeEndEvents.add(e);
    }
    lastCanvasTouchSeq++;
    const nowT = performance.now();
    lastAnyInputEventAt = nowT;
    armTouchStuckWatchdog();
    const totalTouches = (e && e.touches) ? e.touches.length : 0;
    lastNativeTouchCount = totalTouches;
    lastNativeTouchAt = nowT;
    const fingers = getTrueFingerTouches(e?.touches);

    if (fingers.length < 2 && nativePinchState.active) {
        nativePinchState.active = false;
        nativePinchState.zoomChanged = false;
        lastPinchDist = null;
        lastPanMid = null;
        pinchStartZoom = null;
        pinchStartMid = null;
        pinchStartPan = null;
        // Chuyển tiếp cực êm khi nhấc 1 trong 2 ngón: không nhảy khung hình, trượt tiếp sang ngang/lên xuống bằng ngón còn lại
        if (fingers.length === 1) {
            const f0 = fingers[0];
            beginNativeSinglePanFromFinger(f0, nowT, true);
            if (typeof isReadMode === 'undefined' || !isReadMode) {
                const ipadCfg = (typeof appLibrary !== 'undefined' && appLibrary?.ipadConfig) ? appLibrary.ipadConfig : {};
                const sfMode = window.unifiedTool === 'pen_pan' ? 'pan' : (ipadCfg.singleFingerMode || 'pan');
                if (sfMode === 'pan') {
                    let remainPid = null;
                    let bestD = Infinity;
                    for (const [pid, pt] of activePointers.entries()) {
                        if (pt.type === 'touch' && !pt.isFineStylus) {
                            const d = Math.hypot((pt.x || 0) - f0.clientX, (pt.y || 0) - f0.clientY);
                            if (d < bestD) { bestD = d; remainPid = pid; }
                        }
                    }
                    if (remainPid !== null) {
                        for (const [pid, pt] of Array.from(activePointers.entries())) {
                            if (pid !== remainPid && pt.type === 'touch' && !pt.isFineStylus) {
                                pendingFinishTouchIds.add(pid);
                                activePointers.delete(pid);
                            }
                        }
                        multiTouchTapState.active = false;
                        multiTouchTapState.startPoints?.clear?.();
                        singleFingerPanState = {
                            active: true, pointerId: remainPid,
                            startX: f0.clientX, startY: f0.clientY, lastX: f0.clientX, lastY: f0.clientY,
                            startPanX: panX, startPanY: panY,
                            startWorld: screenToWorld(f0.clientX, f0.clientY),
                            startTime: nowT, lastMoveTime: nowT, velX: 0, velY: 0,
                            panActivated: true, isEdgeSwipe: false, fromPinchRelease: true
                        };
                    }
                }
            }
        }
        if (typeof scheduleViewportRender === 'function') scheduleViewportRender();
    }

    if (totalTouches === 0) {
        let launchInertia = null;
        if (nativeSinglePanState.active) {
            const wasMoved = !!nativeSinglePanState.movedByTouch;
            const wasEdge = !!nativeSinglePanState.isEdgeSwipe;
            const wasPanAct = !!nativeSinglePanState.panActivated;
            const sinceMoveN = nowT - (nativeSinglePanState.lastMoveTime || nowT);
            const vxN = nativeSinglePanState.velX || 0;
            const vyN = nativeSinglePanState.velY || 0;
            nativeSinglePanState.active = false;
            nativeSinglePanState.isEdgeSwipe = false;
            nativeSinglePanState.fromPinchRelease = false;
            nativeSinglePanState.movedByTouch = false;
            if (wasMoved) {
                singleFingerPanState.active = false;
                if (!wasEdge && wasPanAct && sinceMoveN < 95 && Math.hypot(vxN, vyN) >= 1.2) {
                    launchInertia = { vx: vxN, vy: vyN };
                }
            }
        }
        allTouchesReleasedAt = nowT;
        lastNativeTouchCount = 0;
        nativePinchState.active = false;
        nativePinchState.zoomChanged = false;
        lastPinchDist = null;
        lastPanMid = null;
        pinchStartZoom = null;
        pinchStartMid = null;
        pinchStartPan = null;
        for (const [pid, pt] of Array.from(activePointers.entries())) {
            if (pt.type !== 'pen' && pt.type !== 'mouse') {
                pendingFinishTouchIds.add(pid);
                activePointers.delete(pid);
            }
        }
        ignoredPalmPointerIds.clear();
        if (launchInertia) {
            startPanInertia(launchInertia.vx, launchInertia.vy);
        } else if (typeof renderAll === 'function') {
            renderAll();
        }
    }
    scheduleTouchEndZombieSweep(e);
}

canvas.addEventListener('touchend', handleNativeTouchEndOrCancel, { passive: true });
canvas.addEventListener('touchcancel', handleNativeTouchEndOrCancel, { passive: true });
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('touchend', handleNativeTouchEndOrCancel, { passive: true, capture: true });
    window.addEventListener('touchcancel', handleNativeTouchEndOrCancel, { passive: true, capture: true });
}
// Safari macOS: chụm 2 ngón trên Trackpad bắn GestureEvent (scale) thay vì wheel+ctrlKey.
// Trước đây chỉ preventDefault nên Safari Mac không thể zoom. iPad vẫn để Pointer Events xử lý pinch.
let safariGestureState = null;
function handleSafariGestureEvent(e) {
    if (!e) return;
    if (e.cancelable) e.preventDefault();
    if (e.__chemGestureHandled) return;
    e.__chemGestureHandled = true;
    const isTouchDevice = typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints) > 1;
    const hasTouchPointers = Array.from(activePointers.values()).some(p => p.type === 'touch' || p.type === 'pen');
    if (isTouchDevice || hasTouchPointers) {
        safariGestureState = null;
        return;
    }
    const nowG = performance.now();
    if (e.type === 'gesturestart') {
        stopPanInertia();
        safariGestureState = { active: true, startZoom: zoom || 1, lastAt: nowG };
        return;
    }
    if (e.type === 'gesturechange') {
        if (!safariGestureState) safariGestureState = { active: true, startZoom: zoom || 1, lastAt: nowG };
        const scale = Number(e.scale);
        if (!Number.isFinite(scale) || scale <= 0) return;
        const rect = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : canvas.getBoundingClientRect();
        const cx = (Number.isFinite(e.clientX) ? e.clientX : rect.left + rect.width / 2) - rect.left;
        const cy = (Number.isFinite(e.clientY) ? e.clientY : rect.top + rect.height / 2) - rect.top;
        const oldZoom = zoom || 1;
        const nextZoom = Math.max(getMinFullScreenZoom(), Math.min(3.0, safariGestureState.startZoom * scale));
        panX = cx - ((cx - panX) / oldZoom) * nextZoom;
        panY = cy - ((cy - panY) / oldZoom) * nextZoom;
        zoom = nextZoom;
        safariGestureState.lastAt = nowG;
        clampViewportPanAndZoom();
        if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
        updateRingTransformFloatingBarPos(); updateImageFloatingBarPos(); updateChainFloatingBarPos(); updateLassoFloatingBarPos();
        renderAll();
        return;
    }
    if (e.type === 'gestureend' && safariGestureState) {
        safariGestureState.active = false;
        safariGestureState.lastAt = nowG;
        renderAll();
    }
}
['gesturestart', 'gesturechange', 'gestureend'].forEach(evName => {
    canvas.addEventListener(evName, handleSafariGestureEvent, { passive: false });
    const dvEl = typeof document !== 'undefined' ? document.getElementById('deskViewport') : null;
    if (dvEl && dvEl !== canvas && typeof dvEl.addEventListener === 'function') {
        dvEl.addEventListener(evName, handleSafariGestureEvent, { passive: false });
    }
});
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const handleWindowPointerMove = e => {
        if (!e || e.target === canvas) return;
        if (activePointers.has(e.pointerId) ||
            (activePenPointerId !== null && e.pointerId === activePenPointerId) ||
            (singleFingerPanState.active && e.pointerId === singleFingerPanState.pointerId) ||
            (readPanState.active && e.pointerId === readPanState.pointerId) ||
            (mousePanState.active && e.pointerId === mousePanState.pointerId)) {
            handleCanvasPointerMove(e);
        }
    };
    const handleWindowPointerEnd = e => {
        if (ignoredPalmPointerIds.has(e.pointerId)) {
            ignoredPalmPointerIds.delete(e.pointerId);
            activePointers.delete(e.pointerId);
            pendingFinishTouchIds.delete(e.pointerId);
            return;
        }
        if (activePointers.has(e.pointerId) ||
            (activePenPointerId !== null && e.pointerId === activePenPointerId) ||
            (singleFingerPanState.active && e.pointerId === singleFingerPanState.pointerId) ||
            (readPanState.active && e.pointerId === readPanState.pointerId) ||
            (mousePanState.active && e.pointerId === mousePanState.pointerId)) {
            finishPointer(e);
        }
    };
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') resetStuckTouchStates();
        });
    }
    window.addEventListener('blur', () => {
        resetStuckTouchStates();
        if (isDrawing) {
            isDrawing = false;
            document.body?.classList?.remove('is-drawing-canvas');
            if (currentInkStroke) {
                const docBlur = getDocState();
                if (!docBlur.inkStrokes) docBlur.inkStrokes = [];
                stripTransientInkFields(currentInkStroke);
                if (currentInkStroke.points && currentInkStroke.points.length) {
                    docBlur.inkStrokes.push(currentInkStroke);
                }
                currentInkStroke = null;
                activeStrokePointerId = null;
                if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
                if (typeof schedulePersistLibrary === 'function') schedulePersistLibrary(300); else persistLibrary();
                renderAll();
            }
        }
    });
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) resetStuckTouchStates();
    });
}

function handleDeskWheelEvent(e) {
    if (!e || e.__chemWheelHandled) return;
    const tgt = e.target;
    if (tgt && typeof tgt.closest === 'function') {
        const scrollableAncestor = tgt.closest('.exam-drawer-panel, .gn-popover-card, .help-modal-card, #libraryHubModal, #pageGridModal, #atomHandwritingPopover, #feedbackHubModal, #versionUpdateHubModal, #supportCommunityModal, #periodicHubModal, select, textarea, input');
        if (scrollableAncestor) return;
    }
    e.__chemWheelHandled = true;

    stopPanInertia();
    if (e.cancelable) e.preventDefault();

    // Safari đang xử lý pinch qua GestureEvent → bỏ wheel+ctrl trùng lặp để không zoom gấp đôi
    if (e.ctrlKey && safariGestureState && (safariGestureState.active || (performance.now() - safariGestureState.lastAt) < 160)) {
        return;
    }

    let normX = Number.isFinite(e.deltaX) ? e.deltaX : 0;
    let normY = Number.isFinite(e.deltaY) ? e.deltaY : 0;
    if (e.deltaMode === 1) {
        normX *= 32;
        normY *= 32;
    } else if (e.deltaMode === 2) {
        normX *= 320;
        normY *= 320;
    }

    const ipadCfg = (typeof appLibrary !== 'undefined' && appLibrary?.ipadConfig) ? appLibrary.ipadConfig : {};
    const wheelDefaultZoom = ipadCfg.mouseWheelMode === 'zoom';
    const modZoom = !!(e.ctrlKey || e.metaKey || e.altKey);
    const forceScroll = !!(e.shiftKey && !modZoom);
    const shouldZoom = modZoom || (wheelDefaultZoom && !forceScroll);

    if (shouldZoom) {
        const rect = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : canvas.getBoundingClientRect();
        const cx = (Number.isFinite(e.clientX) ? e.clientX : rect.left + rect.width / 2) - rect.left;
        const cy = (Number.isFinite(e.clientY) ? e.clientY : rect.top + rect.height / 2) - rect.top;
        const oldZoom = zoom || 1;
        const minZ = getMinFullScreenZoom();
        const speedCoef = (e.ctrlKey || e.metaKey) ? 0.0028 : 0.0018;
        const zoomFactor = Math.max(0.74, Math.min(1.35, Math.exp(-normY * speedCoef)));
        let nextZoom = Math.max(minZ, Math.min(3.0, oldZoom * zoomFactor));
        if (typeof applyZoomSnapDetents === 'function') {
            nextZoom = applyZoomSnapDetents(nextZoom, oldZoom);
        }
        panX = cx - ((cx - panX) / oldZoom) * nextZoom;
        panY = cy - ((cy - panY) / oldZoom) * nextZoom;
        zoom = nextZoom;
    } else {
        const nb = getActiveNotebook();
        const totalPages = (nb && nb.pages && nb.pages.length) ? nb.pages.length : 1;
        const twoCol = typeof isReadMode !== 'undefined' && isReadMode && typeof readTwoPageMode !== 'undefined' && readTwoPageMode && totalPages > 1;
        const numRows = twoCol ? Math.ceil(totalPages / 2) : totalPages;
        const totalH = numRows * (A4_HEIGHT + PAGE_GAP) - PAGE_GAP;
        const viewH = canvas.clientHeight || window.innerHeight;
        const minPanY = Math.min(0, viewH - totalH * zoom);
        const effDx = (e.shiftKey && Math.abs(normX) < 1) ? 0 : normX;
        const effDy = normY;
        panX -= effDx;
        panY -= effDy;
        if ((typeof isReadMode === 'undefined' || !isReadMode) && effDy > 0 && panY <= minPanY + 28 && appLibrary.autoAddPage !== false) {
            const lastPg = nb.pages[nb.pages.length - 1];
            if (lastPg && !isPageContentEmpty(lastPg.content)) {
                appendAutoPageToNotebook(nb);
                wheelOverscrollY = 0;
            } else {
                wheelOverscrollY += effDy;
                if (wheelOverscrollY >= 120) {
                    appendAutoPageToNotebook(nb, true);
                    wheelOverscrollY = 0;
                }
            }
        } else if (effDy < 0) {
            wheelOverscrollY = 0;
        }
    }
    clampViewportPanAndZoom();
    if (typeof isReadMode === 'undefined' || !isReadMode) {
        const rectW = typeof getFastCanvasRect === 'function' ? getFastCanvasRect() : canvas.getBoundingClientRect();
        autoDetectPageFromScreenY(rectW.top + rectW.height * 0.45);
    }
    if (typeof syncPageQuickNavUI === 'function') syncPageQuickNavUI();
    updateRingTransformFloatingBarPos(); updateImageFloatingBarPos(); updateChainFloatingBarPos(); updateLassoFloatingBarPos(); renderAll();
}

canvas.addEventListener('wheel', handleDeskWheelEvent, { passive: false });
if (typeof document !== 'undefined') {
    const dvCtxEl = document.getElementById('deskViewport');
    if (dvCtxEl && dvCtxEl !== canvas && typeof dvCtxEl.addEventListener === 'function') {
        dvCtxEl.addEventListener('wheel', handleDeskWheelEvent, { passive: false });
    }
    if (dvCtxEl && typeof dvCtxEl.addEventListener === 'function') {
        dvCtxEl.addEventListener('contextmenu', e => {
            const tgt = e.target;
            if (tgt && typeof tgt.closest === 'function' && tgt.closest('input, textarea, select, [contenteditable]')) return;
            e.preventDefault();
        });
    }
    const presZoneEl = document.getElementById('presentationHoverZone');
    if (presZoneEl && typeof presZoneEl.addEventListener === 'function') {
        presZoneEl.addEventListener('pointerdown', e => {
            if (e.pointerType === 'touch' && !presZoneEl.classList.contains('dock-pinned')) {
                presZoneEl.classList.add('dock-pinned');
            }
        });
    }
}

function isEmptyCanvasAt(localW, doc) {
    if (!doc) return true;
    if (findNearestAtom(localW.x, localW.y, 24)) return false;
    if (findNearestBond(localW.x, localW.y, 18)) return false;
    if ((doc.orbitals || []).some(ob => Math.hypot(ob.x - localW.x, ob.y - localW.y) < 30)) return false;
    if ((doc.chemSymbols || []).some(sm => Math.hypot(sm.x - localW.x, sm.y - localW.y) < 24)) return false;
    if ((doc.texts || []).some(tx => Math.hypot(tx.x - localW.x, tx.y - localW.y) < 30)) return false;
    if ((doc.arrows || []).some(ar => distToSegment(localW, { x: ar.x1, y: ar.y1 }, { x: ar.x2, y: ar.y2 }) < 18)) return false;
    if ((doc.mechArrows || []).some(ma => distToSegment(localW, { x: ma.x1, y: ma.y1 }, { x: ma.x2, y: ma.y2 }) < 22)) return false;
    if ((doc.brackets || []).some(br => distToBracketEdges(br, localW) < 18)) return false;
    if ((doc.images || []).some(im => localW.x >= im.x && localW.x <= im.x + im.w && localW.y >= im.y && localW.y <= im.y + im.h)) return false;
    return true;
}

function densifyEraserPoints(points, maxStep = 10) {
    if (!points || !points.length) return [];
    const out = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist > maxStep) {
            const steps = Math.ceil(dist / maxStep);
            for (let k = 1; k < steps; k++) {
                const t = k / steps;
                out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            }
        }
        out.push(b);
    }
    return out;
}

const strokeBoundsCache = new WeakMap();

function getStrokeBounds(st) {
    const pts = st && st.points;
    if (!pts || !pts.length) return null;
    const len = pts.length;
    const p0 = pts[0];
    const pLast = pts[len - 1];
    const cached = strokeBoundsCache.get(st);
    if (cached && cached.len === len && cached.fx === p0.x && cached.fy === p0.y && cached.lx === pLast.x && cached.ly === pLast.y) {
        return cached;
    }
    let minX = p0.x, maxX = p0.x, minY = p0.y, maxY = p0.y;
    for (let i = 1; i < len; i++) {
        const px = pts[i].x, py = pts[i].y;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
    }
    const bounds = { len, fx: p0.x, fy: p0.y, lx: pLast.x, ly: pLast.y, minX, minY, maxX, maxY };
    strokeBoundsCache.set(st, bounds);
    return bounds;
}

function computeConvexHull2D(points) {
    if (!points || points.length < 3) return points ? points.slice() : [];
    const sorted = points.map(p => ({ x: p.x, y: p.y })).sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (let i = 0; i < sorted.length; i++) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) lower.pop();
        lower.push(sorted[i]);
    }
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) upper.pop();
        upper.push(sorted[i]);
    }
    lower.pop();
    upper.pop();
    const hull = lower.concat(upper);
    return hull.length >= 3 ? hull : sorted;
}

function pointInHullWithPad(pt, hull, pad = 2.5) {
    if (!hull || !hull.length || !pt) return false;
    if (hull.length === 1) return Math.hypot(pt.x - hull[0].x, pt.y - hull[0].y) <= pad;
    if (hull.length === 2) return distToSegment(pt, hull[0], hull[1]) <= pad;
    if (isPointInPolygon(pt, hull)) return true;
    if (pad <= 0) return false;
    for (let i = 0; i < hull.length; i++) {
        const a = hull[i], b = hull[(i + 1) % hull.length];
        if (distToSegment(pt, a, b) <= pad) return true;
    }
    return false;
}

function closestPointOnSegment(pt, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    if (len2 <= 1e-9) return { x: a.x, y: a.y };
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * vx + (pt.y - a.y) * vy) / len2));
    return { x: a.x + vx * t, y: a.y + vy * t };
}

function countGroupsHittingStroke(st, legGroups, r, hull = null, hullPad = 2.5) {
    const pts = st.points || [];
    if (!pts.length) return 0;
    const bounds = getStrokeBounds(st);
    if (!bounds) return 0;
    const effR = hull ? (r + Math.min(2.2, (st.width || 2) * 0.28)) : (r + (st.width || 2) * 0.45);
    const bMinX = bounds.minX - effR, bMaxX = bounds.maxX + effR;
    const bMinY = bounds.minY - effR, bMaxY = bounds.maxY + effR;
    let hits = 0;
    for (let g = 0; g < legGroups.length; g++) {
        const samples = legGroups[g];
        let anyInBounds = false;
        for (let sIdx = 0; sIdx < samples.length; sIdx++) {
            const s = samples[sIdx];
            if (s.x >= bMinX && s.x <= bMaxX && s.y >= bMinY && s.y <= bMaxY) {
                anyInBounds = true;
                break;
            }
        }
        if (!anyInBounds) continue;
        let hitGroup = false;
        if (pts.length === 1) {
            if (!hull || pointInHullWithPad(pts[0], hull, hullPad)) {
                hitGroup = samples.some(s => Math.hypot(pts[0].x - s.x, pts[0].y - s.y) < effR);
            }
        } else {
            for (let i = 1; i < pts.length && !hitGroup; i++) {
                const p1 = pts[i - 1], p2 = pts[i];
                for (let j = 0; j < samples.length; j++) {
                    const s = samples[j];
                    if (distToSegment(s, p1, p2) < effR) {
                        if (!hull || pointInHullWithPad(closestPointOnSegment(s, p1, p2), hull, hullPad)) {
                            hitGroup = true;
                            break;
                        }
                    }
                }
            }
        }
        if (hitGroup) hits++;
    }
    return hits;
}

function countGroupsHittingPoint(pt, legGroups, r, hull = null, hullPad = 3) {
    if (hull && !pointInHullWithPad(pt, hull, hullPad)) return 0;
    let hits = 0;
    for (let g = 0; g < legGroups.length; g++) {
        if (legGroups[g].some(s => Math.hypot(pt.x - s.x, pt.y - s.y) <= r)) hits++;
    }
    return hits;
}

function countGroupsHittingSegment(p1, p2, legGroups, r, hull = null, hullPad = 2.5) {
    let hits = 0;
    for (let g = 0; g < legGroups.length; g++) {
        if (legGroups[g].some(s => distToSegment(s, p1, p2) <= r && (!hull || pointInHullWithPad(closestPointOnSegment(s, p1, p2), hull, hullPad)))) hits++;
    }
    return hits;
}

function removeObjectsHitBySamples(doc, samples, r, legGroups = null, minHits = 1, hull = null, hullPad = 2.5) {
    if (!doc) return 0;
    const groups = Array.isArray(legGroups) && legGroups.length ? legGroups : (samples && samples.length ? [samples] : []);
    if (!groups.length) return 0;
    const reqHits = Math.max(1, Math.min(groups.length, minHits));
    const ptExtra = hull ? 2 : 8;
    const txExtra = hull ? 3 : 10;
    const labExtra = hull ? 4 : 14;
    let erased = 0;

    const beforeStrokes = (doc.inkStrokes || []).length;
    doc.inkStrokes = (doc.inkStrokes || []).filter(st => countGroupsHittingStroke(st, groups, r, hull, hullPad) < reqHits);
    erased += beforeStrokes - doc.inkStrokes.length;

    const hitBondSet = new Set();
    const atomById = new Map((doc.atoms || []).map(a => [a.id, a]));
    (doc.bonds || []).forEach(b => {
        const a1 = atomById.get(b.a1);
        const a2 = atomById.get(b.a2);
        if (!a1 || !a2) return;
        if (countGroupsHittingSegment(a1, a2, groups, r, hull, hullPad) >= reqHits) hitBondSet.add(b.id);
    });
    if (hitBondSet.size) {
        doc.bonds = (doc.bonds || []).filter(b => !hitBondSet.has(b.id));
        erased += hitBondSet.size;
    }

    const hitAtomIds = new Set();
    (doc.atoms || []).forEach(a => {
        if (countGroupsHittingPoint(a, groups, r, hull, hullPad + 1) >= reqHits) hitAtomIds.add(a.id);
    });
    if (hitAtomIds.size) {
        doc.bonds = (doc.bonds || []).filter(b => !hitAtomIds.has(b.a1) && !hitAtomIds.has(b.a2));
        doc.atoms = (doc.atoms || []).filter(a => !hitAtomIds.has(a.id));
        erased += hitAtomIds.size;
    }
    if (hitBondSet.size || hitAtomIds.size) {
        enforceAllValenceAndHydrogens(doc);
    }

    const beforeAr = (doc.arrows || []).length;
    doc.arrows = (doc.arrows || []).filter(ar => countGroupsHittingSegment({ x: ar.x1, y: ar.y1 }, { x: ar.x2, y: ar.y2 }, groups, r, hull, hullPad) < reqHits);
    erased += beforeAr - doc.arrows.length;

    const beforeMa = (doc.mechArrows || []).length;
    doc.mechArrows = (doc.mechArrows || []).filter(ma => countGroupsHittingSegment({ x: ma.x1, y: ma.y1 }, { x: ma.x2, y: ma.y2 }, groups, r, hull, hullPad) < reqHits);
    erased += beforeMa - doc.mechArrows.length;

    const beforeOb = (doc.orbitals || []).length;
    doc.orbitals = (doc.orbitals || []).filter(ob => countGroupsHittingPoint(ob, groups, r + ptExtra, hull, hullPad + 2) < reqHits);
    erased += beforeOb - doc.orbitals.length;

    const beforeSm = (doc.chemSymbols || []).length;
    doc.chemSymbols = (doc.chemSymbols || []).filter(sm => countGroupsHittingPoint(sm, groups, r + ptExtra, hull, hullPad + 2) < reqHits);
    erased += beforeSm - doc.chemSymbols.length;

    const beforeLab = (doc.labItems || []).length;
    doc.labItems = (doc.labItems || []).filter(lb => countGroupsHittingPoint(lb, groups, r + labExtra, hull, hullPad + 3) < reqHits);
    erased += beforeLab - doc.labItems.length;

    const beforeTx = (doc.texts || []).length;
    doc.texts = (doc.texts || []).filter(tx => countGroupsHittingPoint(tx, groups, r + txExtra, hull, hullPad + 2) < reqHits);
    erased += beforeTx - doc.texts.length;

    const beforeBr = (doc.brackets || []).length;
    doc.brackets = (doc.brackets || []).filter(br => {
        if (hull && !pointInHullWithPad({ x: br.x + br.w * 0.5, y: br.y + br.h * 0.5 }, hull, hullPad + 4)) return true;
        let hits = 0;
        for (let g = 0; g < groups.length; g++) {
            if (groups[g].some(s => distToBracketEdges(br, s) <= r)) hits++;
        }
        return hits < reqHits;
    });
    erased += beforeBr - doc.brackets.length;

    return erased;
}

function simplifyPathByMinStep(points, minStep = 5) {
    if (!points || points.length < 2) return points || [];
    const res = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const last = res[res.length - 1];
        if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= minStep) {
            res.push(points[i]);
        }
    }
    const endPt = points[points.length - 1];
    const lastRes = res[res.length - 1];
    if (Math.hypot(endPt.x - lastRes.x, endPt.y - lastRes.y) >= 2.5) {
        res.push(endPt);
    }
    return res;
}

function extractScribbleLegs(points) {
    const simp = simplifyPathByMinStep(points, 4.5);
    if (simp.length < 3) return [];
    const legs = [];
    let legStartIdx = 0;
    const minLegSpan = 11;

    const pushLeg = (startIdx, endIdx) => {
        if (endIdx <= startIdx) return;
        const pStart = simp[startIdx], pEnd = simp[endIdx];
        const span = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
        if (span >= minLegSpan) {
            legs.push({
                p1: pStart,
                p2: pEnd,
                len: span,
                midX: (pStart.x + pEnd.x) * 0.5,
                midY: (pStart.y + pEnd.y) * 0.5,
                pts: simp.slice(startIdx, endIdx + 1)
            });
        }
    };

    for (let i = 1; i < simp.length; i++) {
        const pStart = simp[legStartIdx];
        const pPrev = simp[i - 1];
        const curSpan = Math.hypot(pPrev.x - pStart.x, pPrev.y - pStart.y);
        if (curSpan < minLegSpan) continue;

        const stepDx = simp[i].x - pPrev.x;
        const stepDy = simp[i].y - pPrev.y;
        const stepLen = Math.hypot(stepDx, stepDy);
        if (stepLen < 3.5) continue;

        const legVx = (pPrev.x - pStart.x) / curSpan;
        const legVy = (pPrev.y - pStart.y) / curSpan;
        const dot = legVx * (stepDx / stepLen) + legVy * (stepDy / stepLen);
        if (dot <= -0.56) {
            pushLeg(legStartIdx, i - 1);
            legStartIdx = i - 1;
        }
    }
    pushLeg(legStartIdx, simp.length - 1);
    return legs;
}

function scribbleLegsCross(a, b) {
    if (!a || !b) return false;
    const x1 = a.p1.x, y1 = a.p1.y, x2 = a.p2.x, y2 = a.p2.y;
    const x3 = b.p1.x, y3 = b.p1.y, x4 = b.p2.x, y4 = b.p2.y;
    const d1 = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
    const d2 = (x4 - x3) * (y2 - y3) - (y4 - y3) * (x2 - x3);
    const d3 = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
    const d4 = (x2 - x1) * (y4 - y1) - (y2 - y1) * (x4 - x1);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function isScribbleEraseGesture(points, minReversals = 3) {
    if (!points || points.length < 4) return false;
    let totalLen = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
        if (i > 0) totalLen += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    }
    const diag = Math.hypot(maxX - minX, maxY - minY);
    if (totalLen < 68 || diag < 12) return false;
    const pathRatio = totalLen / Math.max(12, diag);
    if (pathRatio < 2.50) return false;

    const legs = extractScribbleLegs(points);
    if (legs.length < minReversals + 1) return false;

    let overlapPairs = 0;
    for (let i = 1; i < legs.length; i++) {
        const a = legs[i - 1], b = legs[i];
        const midDist = Math.hypot(b.midX - a.midX, b.midY - a.midY);
        if (midDist < 0.42 * Math.max(a.len, b.len)) {
            overlapPairs++;
        }
    }
    let revisitPairs = 0;
    let crossPairs = 0;
    for (let i = 0; i < legs.length; i++) {
        for (let j = i + 2; j < legs.length; j++) {
            const a = legs[i], b = legs[j];
            const midDist = Math.hypot(b.midX - a.midX, b.midY - a.midY);
            if (midDist < 0.42 * Math.max(a.len, b.len)) {
                revisitPairs++;
            }
            if (scribbleLegsCross(a, b)) {
                crossPairs++;
            }
        }
    }

    if (legs.length >= 4) {
        return overlapPairs >= 2 && (revisitPairs >= 1 || crossPairs >= 1);
    }
    // Chế độ 3 đoạn gập cực sát đè lên chính nó (tránh nhầm chữ viết thường)
    return overlapPairs >= 2 && (revisitPairs >= 1 || crossPairs >= 1) && pathRatio >= 2.55;
}

function applyScribbleErase(points, doc) {
    if (!doc || !points || points.length < 2) return 0;
    const legs = extractScribbleLegs(points);
    if (legs.length < 2) return 0;
    const hull = computeConvexHull2D(points);
    const legGroups = legs.map(leg => densifyEraserPoints(leg.pts, 4.5));
    return removeObjectsHitBySamples(doc, null, 4.5, legGroups, 2, hull, 2.5);
}

function eraseBetweenPoints(p1, p2, customR) {
    const doc = getDocState();
    const r = Math.max(6, customR || (typeof eraserRadius === 'number' ? eraserRadius : 24));
    const samples = densifyEraserPoints([p1, p2], Math.max(5, r * 0.45));
    removeObjectsHitBySamples(doc, samples, r);
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    renderAll();
}

function eraseAtPoint(x, y, customR) {
    const doc = getDocState();
    const r = Math.max(6, customR || (typeof eraserRadius === 'number' ? eraserRadius : 24));
    removeObjectsHitBySamples(doc, [{ x, y }], r);
    if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
    renderAll();
}

/* ============================================================================
 * TỰ ĐỘNG THÀNH HÌNH (GOODNOTES HOLD-TO-SHAPE) & CHUYỂN NÉT -> MẠCH CARBON
 * ============================================================================ */

const SNAP_LINE_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180, -30, -45, -60, -90, -120, -135, -150, -180]
    .map(deg => (deg * Math.PI) / 180);

function cancelInkHoldTimer() {
    if (inkHoldTimer) {
        clearTimeout(inkHoldTimer);
        inkHoldTimer = null;
    }
    inkHoldState = null;
}

function rdpSimplifyPointsWithMeta(points, eps = 8) {
    if (!points || points.length <= 2) {
        return (points || []).map((p, idx) => ({ x: p.x, y: p.y, srcIdx: idx }));
    }
    const n = points.length;
    const keep = new Array(n).fill(false);
    keep[0] = true;
    keep[n - 1] = true;
    const stack = [[0, n - 1]];
    while (stack.length) {
        const [s, e] = stack.pop();
        if (e <= s + 1) continue;
        const a = points[s], b = points[e];
        let maxD = -1, maxIdx = -1;
        for (let i = s + 1; i < e; i++) {
            const d = distToSegment(points[i], a, b);
            if (d > maxD) { maxD = d; maxIdx = i; }
        }
        if (maxD > eps && maxIdx !== -1) {
            keep[maxIdx] = true;
            stack.push([s, maxIdx], [maxIdx, e]);
        }
    }
    let simp = [];
    for (let i = 0; i < n; i++) {
        if (keep[i]) simp.push({ x: points[i].x, y: points[i].y, srcIdx: i });
    }
    if (points.length >= 6 && simp.length >= 4 && Math.hypot(simp[1].x - simp[0].x, simp[1].y - simp[0].y) < 8) {
        simp.shift();
    }
    if (points.length >= 6 && simp.length >= 4 && Math.hypot(simp[simp.length - 1].x - simp[simp.length - 2].x, simp[simp.length - 1].y - simp[simp.length - 2].y) < 8) {
        simp.pop();
    }
    if (simp.length >= 3) {
        const filtered = [simp[0]];
        for (let i = 1; i < simp.length - 1; i++) {
            const prev = filtered[filtered.length - 1];
            if (Math.hypot(simp[i].x - prev.x, simp[i].y - prev.y) >= 14) {
                filtered.push(simp[i]);
            }
        }
        const lastPt = simp[simp.length - 1];
        if (Math.hypot(lastPt.x - filtered[filtered.length - 1].x, lastPt.y - filtered[filtered.length - 1].y) >= 14 || filtered.length === 1) {
            filtered.push(lastPt);
        } else if (filtered.length >= 2) {
            filtered[filtered.length - 1] = lastPt;
        }
        simp = filtered;
    }
    let merged = true;
    while (merged && simp.length >= 3) {
        merged = false;
        const next = [simp[0]];
        for (let i = 1; i < simp.length - 1; i++) {
            const a = next[next.length - 1], b = simp[i], c = simp[i + 1];
            const ang1 = Math.atan2(b.y - a.y, b.x - a.x);
            const ang2 = Math.atan2(c.y - b.y, c.x - b.x);
            const diff = Math.abs(Math.atan2(Math.sin(ang2 - ang1), Math.cos(ang2 - ang1)));
            if (diff < 0.26) {
                merged = true;
                continue;
            }
            next.push(b);
        }
        next.push(simp[simp.length - 1]);
        simp = next;
    }
    return simp;
}

function rdpSimplifyPoints(points, eps = 8) {
    return rdpSimplifyPointsWithMeta(points, eps).map(p => ({ x: p.x, y: p.y }));
}

function densifyPolygonCorners(corners, step = 18) {
    if (!corners || corners.length < 2) return corners || [];
    const out = [];
    for (let i = 0; i < corners.length - 1; i++) {
        const a = corners[i], b = corners[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        out.push({ x: a.x, y: a.y });
        if (len > 10) {
            const ux = dx / len, uy = dy / len;
            const lead = Math.min(3, len * 0.15);
            out.push({ x: a.x + ux * lead, y: a.y + uy * lead });
            const nSteps = Math.floor((len - lead * 2) / step);
            for (let k = 1; k <= nSteps; k++) {
                const t = (lead + k * ((len - lead * 2) / (nSteps + 1)));
                out.push({ x: a.x + ux * t, y: a.y + uy * t });
            }
            out.push({ x: b.x - ux * lead, y: b.y - uy * lead });
        }
    }
    const last = corners[corners.length - 1];
    out.push({ x: last.x, y: last.y });
    return out;
}

function snapLineEndpoint(pStart, pEnd) {
    const dx = pEnd.x - pStart.x;
    const dy = pEnd.y - pStart.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return { x: pEnd.x, y: pEnd.y };
    let ang = Math.atan2(dy, dx);
    let bestSa = ang, bestDiff = Infinity;
    for (let i = 0; i < SNAP_LINE_ANGLES.length; i++) {
        const sa = SNAP_LINE_ANGLES[i];
        const diff = Math.abs(Math.atan2(Math.sin(ang - sa), Math.cos(ang - sa)));
        if (diff < bestDiff) { bestDiff = diff; bestSa = sa; }
    }
    const degAbs = Math.abs((bestSa * 180) / Math.PI);
    const isOrtho = degAbs < 1 || Math.abs(degAbs - 90) < 1 || Math.abs(degAbs - 180) < 1;
    const snapTol = isOrtho ? 0.095 : 0.055;
    if (bestDiff <= snapTol) ang = bestSa;
    return { x: pStart.x + len * Math.cos(ang), y: pStart.y + len * Math.sin(ang) };
}

function sampleQuadraticArc(pStart, pEnd, archRatio, numSamples = 24) {
    const dx = pEnd.x - pStart.x;
    const dy = pEnd.y - pStart.y;
    const chordLen = Math.hypot(dx, dy) || 1;
    const mx = (pStart.x + pEnd.x) * 0.5;
    const my = (pStart.y + pEnd.y) * 0.5;
    const nx = -dy / chordLen;
    const ny = dx / chordLen;
    const px = mx + nx * chordLen * archRatio;
    const py = my + ny * chordLen * archRatio;
    const cx = 2 * px - 0.5 * (pStart.x + pEnd.x);
    const cy = 2 * py - 0.5 * (pStart.y + pEnd.y);
    const out = [];
    for (let i = 0; i <= numSamples; i++) {
        const t = i / numSamples;
        const omt = 1 - t;
        out.push({
            x: omt * omt * pStart.x + 2 * omt * t * cx + t * t * pEnd.x,
            y: omt * omt * pStart.y + 2 * omt * t * cy + t * t * pEnd.y
        });
    }
    return out;
}

function computePolylineFitRms(rawPoints, polyPts) {
    if (!rawPoints || !rawPoints.length || !polyPts || polyPts.length < 2) return Infinity;
    let sumSq = 0;
    for (let i = 0; i < rawPoints.length; i++) {
        const p = rawPoints[i];
        let minD = Infinity;
        for (let j = 1; j < polyPts.length; j++) {
            const d = distToSegment(p, polyPts[j - 1], polyPts[j]);
            if (d < minD) minD = d;
        }
        sumSq += minD * minD;
    }
    return Math.sqrt(sumSq / rawPoints.length);
}

function cleanZigZagCornerVertices(rawVerts) {
    if (!rawVerts || rawVerts.length <= 2) return rawVerts ? rawVerts.slice() : [];
    const cleaned = [rawVerts[0]];
    for (let i = 1; i < rawVerts.length - 1; i++) {
        const a = cleaned[cleaned.length - 1];
        const b = rawVerts[i];
        const c = rawVerts[i + 1];
        const v1x = b.x - a.x, v1y = b.y - a.y;
        const v2x = c.x - b.x, v2y = c.y - b.y;
        const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
        if (l1 < 8 || l2 < 8) continue;
        const turn = Math.atan2(Math.abs(v1x * v2y - v1y * v2x), v1x * v2x + v1y * v2y);
        // Lọc bỏ đỉnh gãy nhẹ do rung tay (< 22°) để không sinh liên kết 180° thẳng hàng
        if (turn < 0.38) continue;
        cleaned.push(b);
    }
    cleaned.push(rawVerts[rawVerts.length - 1]);
    return cleaned;
}

function buildCleanCarbonChainVertices(verts, doc) {
    if (!verts || verts.length < 2) return [];
    const cleanVerts = cleanZigZagCornerVertices(verts);
    if (cleanVerts.length < 2) return [];

    const startAtom = doc ? findNearestAtom(cleanVerts[0].x, cleanVerts[0].y, 26) : null;
    let curX = startAtom ? startAtom.x : cleanVerts[0].x;
    let curY = startAtom ? startAtom.y : cleanVerts[0].y;
    const out = [{ x: curX, y: curY, existingAtom: startAtom || null }];

    const spanX = cleanVerts[cleanVerts.length - 1].x - cleanVerts[0].x;
    const spanY = cleanVerts[cleanVerts.length - 1].y - cleanVerts[0].y;
    const isOverallHorizontal = Math.abs(spanX) > Math.abs(spanY) * 1.30 && Math.abs(spanX) >= 36;

    let prevSnapAng = null;
    for (let i = 1; i < cleanVerts.length; i++) {
        const dx = cleanVerts[i].x - cleanVerts[i - 1].x;
        const dy = cleanVerts[i].y - cleanVerts[i - 1].y;
        const rawAng = Math.atan2(dy, dx);
        let snapAng;

        if (i === 1) {
            if (startAtom && doc) {
                snapAng = getSmartHorizontalZigZagAngle(startAtom, doc, rawAng);
            } else if (isOverallHorizontal) {
                // Mạch ngang viết tay: luôn căn góc chuẩn hóa học ±30° / ±150° (tránh dựng đứng 90° khi vẽ hơi dốc tay)
                if (spanX >= 0) {
                    snapAng = dy <= 0 ? (-Math.PI / 6) : (Math.PI / 6);
                } else {
                    snapAng = dy <= 0 ? (-5 * Math.PI / 6) : (5 * Math.PI / 6);
                }
            } else {
                snapAng = snapHexLatticeAngle(rawAng);
            }
        } else {
            // Tại mọi đỉnh tiếp theo: CHỈ cho phép rẽ đúng ±60° so với liên kết trước (góc nội 120° tuyệt đối, không bao giờ ra 180° hay 150°)
            const candPlus = normalizeBondAngle(prevSnapAng + Math.PI / 3);
            const candMinus = normalizeBondAngle(prevSnapAng - Math.PI / 3);
            const dPlus = Math.abs(bondAngleDiff(rawAng, candPlus));
            const dMinus = Math.abs(bondAngleDiff(rawAng, candMinus));

            // Tránh gấp ngược trùng lên nguyên tử i-2 trước đó nếu không cố tình khép vòng
            const prev2 = out.length >= 2 ? out[out.length - 2] : null;
            const pPlusX = curX + BOND_LENGTH * Math.cos(candPlus);
            const pPlusY = curY + BOND_LENGTH * Math.sin(candPlus);
            const pMinusX = curX + BOND_LENGTH * Math.cos(candMinus);
            const pMinusY = curY + BOND_LENGTH * Math.sin(candMinus);
            const backPlus = prev2 && Math.hypot(pPlusX - prev2.x, pPlusY - prev2.y) < 12;
            const backMinus = prev2 && Math.hypot(pMinusX - prev2.x, pMinusY - prev2.y) < 12;

            if (backPlus && !backMinus) {
                snapAng = candMinus;
            } else if (backMinus && !backPlus) {
                snapAng = candPlus;
            } else if (Math.abs(dPlus - dMinus) > 0.16) {
                snapAng = dPlus <= dMinus ? candPlus : candMinus;
            } else {
                const pdx = cleanVerts[i - 1].x - cleanVerts[i - 2].x;
                const pdy = cleanVerts[i - 1].y - cleanVerts[i - 2].y;
                const turnSign = (pdx * dy - pdy * dx) >= 0 ? 1 : -1;
                snapAng = turnSign > 0 ? candPlus : candMinus;
            }
        }
        prevSnapAng = snapAng;

        curX += BOND_LENGTH * Math.cos(snapAng);
        curY += BOND_LENGTH * Math.sin(snapAng);
        const prevExisting = out[out.length - 1].existingAtom;
        const hitA = doc ? findNearestAtom(curX, curY, 12) : null;
        const usedHit = (hitA && hitA !== prevExisting) ? hitA : null;
        if (usedHit) {
            curX = usedHit.x;
            curY = usedHit.y;
        }
        out.push({ x: curX, y: curY, existingAtom: usedHit });
    }
    return out;
}

function commitCarbonChainFromVertices(verts, doc, strokeColor) {
    if (!doc || !verts || verts.length < 2) return 0;
    if (!doc.atoms) doc.atoms = [];
    if (!doc.bonds) doc.bonds = [];
    const chainPts = buildCleanCarbonChainVertices(verts, doc);
    if (chainPts.length < 2) return 0;

    const col = strokeColor || penColor || '#0f172a';
    let prevAtom = chainPts[0].existingAtom;
    if (!prevAtom) {
        prevAtom = { id: genId('a'), x: chainPts[0].x, y: chainPts[0].y, label: 'C', color: col };
        doc.atoms.push(prevAtom);
    }
    const chainAtomIds = [prevAtom.id];
    let maxY = prevAtom.y;

    for (let i = 1; i < chainPts.length; i++) {
        const pt = chainPts[i];
        let nextAtom = pt.existingAtom || findNearestAtom(pt.x, pt.y, 14);
        const isReuse = !!(nextAtom && nextAtom !== prevAtom);
        const existsBond = isReuse && doc.bonds.some(b =>
            (b.a1 === prevAtom.id && b.a2 === nextAtom.id) ||
            (b.a1 === nextAtom.id && b.a2 === prevAtom.id)
        );
        if (!existsBond) {
            if (!canAddBondOrder(prevAtom, 1, doc)) break;
            if (isReuse && !canAddBondOrder(nextAtom, 1, doc)) break;
            if (!isReuse) {
                nextAtom = { id: genId('a'), x: pt.x, y: pt.y, label: 'C', color: col };
                doc.atoms.push(nextAtom);
            }
            const newBondObj = { id: genId('b'), a1: prevAtom.id, a2: nextAtom.id, order: 1, stereo: null, color: col };
            doc.bonds.push(newBondObj);
            if (isReuse && typeof beautifyClosedRingInDoc === 'function') {
                beautifyClosedRingInDoc(doc, prevAtom, nextAtom, newBondObj.id);
            }
        }
        chainAtomIds.push(nextAtom.id);
        maxY = Math.max(maxY, nextAtom.y);
        prevAtom = nextAtom;
    }
    enforceAllValenceAndHydrogens(doc);
    window.lastActiveChemAtomId = chainAtomIds[chainAtomIds.length - 1] || null;
    activeCarbonChain = {
        active: chainAtomIds.length >= 2,
        mode: 'zigzag',
        atomIds: chainAtomIds,
        dirX: chainPts[chainPts.length - 1].x >= chainPts[0].x ? 1 : -1,
        fischerSpines: []
    };
    updateChainFloatingBarPos();
    ensureAutoNextPageIfNeeded(maxY);
    return chainAtomIds.length;
}

function recognizeInkShape(rawPoints, mode = 'ink') {
    if (!rawPoints || rawPoints.length < 2) return null;
    if (typeof isScribbleEraseGesture === 'function' && isScribbleEraseGesture(rawPoints, 2)) return null;

    let totalLen = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < rawPoints.length; i++) {
        const p = rawPoints[i];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
        if (i > 0) totalLen += Math.hypot(p.x - rawPoints[i - 1].x, p.y - rawPoints[i - 1].y);
    }
    const diag = Math.hypot(maxX - minX, maxY - minY);
    if (totalLen < 14 || diag < 12) return null;

    const pStart = rawPoints[0];
    const pEnd = rawPoints[rawPoints.length - 1];
    const chordLen = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);

    let maxDev = 0, signedPeak = 0;
    if (chordLen >= 1) {
        const ux = (pEnd.x - pStart.x) / chordLen;
        const uy = (pEnd.y - pStart.y) / chordLen;
        const nx = -uy, ny = ux;
        for (let i = 0; i < rawPoints.length; i++) {
            const p = rawPoints[i];
            const sd = (p.x - pStart.x) * nx + (p.y - pStart.y) * ny;
            const ad = Math.abs(sd);
            if (ad > maxDev) {
                maxDev = ad;
                signedPeak = sd;
            }
        }
    }

    // 1. Đường thẳng 100% (cho phép hơi cong tay 11.5% khi kéo nhanh, tự nắn thẳng chuẩn)
    if (chordLen >= 14 && maxDev <= Math.max(10, chordLen * 0.115) && totalLen / Math.max(1, chordLen) <= 1.24) {
        const snappedEnd = snapLineEndpoint(pStart, pEnd);
        return {
            type: 'line',
            label: 'Đường thẳng 100%',
            pStart: { x: pStart.x, y: pStart.y },
            pEnd: snappedEnd,
            points: [{ x: pStart.x, y: pStart.y }, snappedEnd]
        };
    }

    // 2. Hình khép kín (Vòng Carbon 5/6/7 cạnh đều đẹp, Tam giác, Tứ giác, Tròn / Elip)
    if (totalLen >= 65 && diag >= 22 && chordLen <= Math.max(36, Math.min(diag * 0.45, totalLen * 0.25))) {
        if (mode !== 'highlighter' && typeof detectFreehandCarbonRing === 'function') {
            const holdRing = detectFreehandCarbonRing(rawPoints, false);
            if (holdRing) {
                const rPreview = (typeof BOND_LENGTH === 'number' && BOND_LENGTH > 0 ? BOND_LENGTH : 44) / (2 * Math.sin(Math.PI / holdRing.n));
                const ringPts = [];
                for (let k = 0; k <= holdRing.n; k++) {
                    const a = holdRing.startAng + (k * Math.PI * 2) / holdRing.n;
                    ringPts.push({ x: holdRing.cx + rPreview * Math.cos(a), y: holdRing.cy + rPreview * Math.sin(a) });
                }
                return {
                    type: 'carbon_ring',
                    label: 'Vòng ' + holdRing.n + 'C chuẩn đẹp',
                    n: holdRing.n,
                    cx: holdRing.cx,
                    cy: holdRing.cy,
                    startAng: holdRing.startAng,
                    points: ringPts
                };
            }
        }
        const loopVerts = rdpSimplifyPointsWithMeta(rawPoints, Math.max(8, diag * 0.075));
        const ringVerts = loopVerts.map(v => ({ x: v.x, y: v.y }));
        if (ringVerts.length >= 4 && Math.hypot(ringVerts[ringVerts.length - 1].x - ringVerts[0].x, ringVerts[ringVerts.length - 1].y - ringVerts[0].y) < Math.max(32, diag * 0.35)) {
            ringVerts.pop();
        }
        const cx = (minX + maxX) * 0.5;
        const cy = (minY + maxY) * 0.5;
        const rx = Math.max(10, (maxX - minX) * 0.5);
        const ry = Math.max(10, (maxY - minY) * 0.5);
        let sumSqErr = 0;
        for (let i = 0; i < rawPoints.length; i++) {
            const normR = Math.hypot((rawPoints[i].x - cx) / rx, (rawPoints[i].y - cy) / ry);
            sumSqErr += (normR - 1) * (normR - 1);
        }
        const rmsErr = Math.sqrt(sumSqErr / rawPoints.length);
        const cornerCount = ringVerts.length;

        if (cornerCount === 3 && rmsErr > 0.14) {
            const triCorners = [...ringVerts, { x: ringVerts[0].x, y: ringVerts[0].y }];
            return {
                type: 'triangle',
                label: 'Tam giác chuẩn',
                points: densifyPolygonCorners(triCorners, 16)
            };
        }
        if (cornerCount === 4 && rmsErr > 0.16) {
            const quadCorners = [...ringVerts, { x: ringVerts[0].x, y: ringVerts[0].y }];
            return {
                type: 'rectangle',
                label: 'Tứ giác chuẩn',
                points: densifyPolygonCorners(quadCorners, 16)
            };
        }
        const isCircle = Math.abs(rx - ry) / Math.max(rx, ry) <= 0.22;
        const radX = isCircle ? (rx + ry) * 0.5 : rx;
        const radY = isCircle ? (rx + ry) * 0.5 : ry;
        const ovalPts = [];
        for (let i = 0; i <= 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            ovalPts.push({ x: cx + radX * Math.cos(a), y: cy + radY * Math.sin(a) });
        }
        return {
            type: isCircle ? 'circle' : 'ellipse',
            label: isCircle ? 'Hình tròn chuẩn' : 'Hình elip chuẩn',
            cx, cy, rx: radX, ry: radY,
            points: ovalPts
        };
    }

    // 3. Mạch gấp khúc / Mạch Carbon hoặc Hình góc cạnh khi giữ cuối nét
    if (mode !== 'highlighter') {
        const vertsMeta = rdpSimplifyPointsWithMeta(rawPoints, Math.max(7, Math.min(15, diag * 0.065)));
        if (vertsMeta.length >= 3 && vertsMeta.length <= 24) {
            let minLeg = Infinity, maxLeg = 0, sumLeg = 0, maxLegErr = 0;
            for (let i = 1; i < vertsMeta.length; i++) {
                const a = vertsMeta[i - 1], b = vertsMeta[i];
                const len = Math.hypot(b.x - a.x, b.y - a.y);
                if (len < minLeg) minLeg = len;
                if (len > maxLeg) maxLeg = len;
                sumLeg += len;
                for (let idx = a.srcIdx; idx <= b.srcIdx; idx++) {
                    const d = distToSegment(rawPoints[idx], a, b);
                    if (d > maxLegErr) maxLegErr = d;
                }
            }
            const avgLegLen = sumLeg / (vertsMeta.length - 1);
            if (minLeg >= 16 && maxLegErr <= Math.max(11, avgLegLen * 0.25)) {
                const verts = vertsMeta.map(v => ({ x: v.x, y: v.y }));
                let prefersCurve = false;
                const turnSigns = [];
                for (let i = 1; i < verts.length - 1; i++) {
                    const v1x = verts[i].x - verts[i - 1].x, v1y = verts[i].y - verts[i - 1].y;
                    const v2x = verts[i + 1].x - verts[i].x, v2y = verts[i + 1].y - verts[i].y;
                    turnSigns.push((v1x * v2y - v1y * v2x) >= 0 ? 1 : -1);
                }
                const hasAlternation = turnSigns.some((s, idx) => idx > 0 && s * turnSigns[idx - 1] < 0);

                if (chordLen >= 24 && totalLen / chordLen <= 2.3) {
                    const archRatio = Math.max(-0.65, Math.min(0.65, signedPeak / chordLen));
                    const arcSample = sampleQuadraticArc(pStart, pEnd, archRatio, 24);
                    const arcRms = computePolylineFitRms(rawPoints, arcSample);
                    const polyRms = computePolylineFitRms(rawPoints, verts);
                    if (verts.length === 3) {
                        const v1x = verts[1].x - verts[0].x, v1y = verts[1].y - verts[0].y;
                        const v2x = verts[2].x - verts[1].x, v2y = verts[2].y - verts[1].y;
                        const turnAng = Math.atan2(Math.abs(v1x * v2y - v1y * v2x), v1x * v2x + v1y * v2y);
                        if (polyRms >= arcRms * 0.85 || turnAng < 0.45) prefersCurve = true;
                    } else if (!hasAlternation && polyRms >= arcRms * 0.85) {
                        prefersCurve = true;
                    }
                }
                if (!prefersCurve) {
                    const maxCarbonLeg = Math.max(145, (typeof BOND_LENGTH === 'number' ? BOND_LENGTH : 44) * 3.3);
                    const maxAvgCarbonLeg = Math.max(120, (typeof BOND_LENGTH === 'number' ? BOND_LENGTH : 44) * 2.75);
                    const isCarbonSized = maxLeg <= maxCarbonLeg && avgLegLen <= maxAvgCarbonLeg && (verts.length === 3 || hasAlternation);
                    if (isCarbonSized) {
                        const previewPts = buildCleanCarbonChainVertices(verts, getDocState());
                        return {
                            type: 'carbon_chain',
                            label: 'Mạch Carbon (' + previewPts.length + 'C)',
                            vertices: verts,
                            points: previewPts.map(p => ({ x: p.x, y: p.y }))
                        };
                    }
                    return {
                        type: 'polyline',
                        label: 'Hình có góc chuẩn',
                        points: verts
                    };
                }
            }
        }
    }

    // 4. Đường cong đơn mượt (Cung cong / Parabol)
    if (chordLen >= 24 && maxDev > Math.max(8, chordLen * 0.085) && totalLen / chordLen <= 2.3) {
        const archRatio = Math.max(-0.65, Math.min(0.65, signedPeak / chordLen));
        const arcPts = sampleQuadraticArc(pStart, pEnd, archRatio, 24);
        return {
            type: 'arc',
            label: 'Đường cong mượt',
            pStart: { x: pStart.x, y: pStart.y },
            pEnd: { x: pEnd.x, y: pEnd.y },
            archRatio,
            points: arcPts
        };
    }

    return null;
}

function tryValidateZigZagCandidate(rawPoints, eps, diag, boxW, boxH, anchoredStart) {
    let vm = rdpSimplifyPointsWithMeta(rawPoints, eps);
    if (!vm || vm.length < 3) return null;

    // 1. Cắt bỏ mẩu đuôi đặt/nhấc bút rất ngắn ở 2 đầu (< 14px & < 36% cạnh kế) để không làm trượt nét gấp khúc đẹp
    if (vm.length >= 4) {
        const lFirst = Math.hypot(vm[1].x - vm[0].x, vm[1].y - vm[0].y);
        const lSecond = Math.hypot(vm[2].x - vm[1].x, vm[2].y - vm[1].y);
        if (lFirst < 14 && lFirst < lSecond * 0.36) vm = vm.slice(1);
    }
    if (vm.length >= 4) {
        const nL = vm.length;
        const lLast = Math.hypot(vm[nL - 1].x - vm[nL - 2].x, vm[nL - 1].y - vm[nL - 2].y);
        const lPrev = Math.hypot(vm[nL - 2].x - vm[nL - 3].x, vm[nL - 2].y - vm[nL - 3].y);
        if (lLast < 14 && lLast < lPrev * 0.36) vm = vm.slice(0, nL - 1);
    }

    // 2. Gộp các đỉnh gãy giả do rung tay (< 23°) hoặc khựng góc < 11px dọc theo cùng một cạnh
    let merged = true;
    let guard = 0;
    while (merged && vm.length >= 4 && guard++ < 8) {
        merged = false;
        const nextVm = [vm[0]];
        for (let i = 1; i < vm.length - 1; i++) {
            const a = nextVm[nextVm.length - 1];
            const b = vm[i];
            const c = vm[i + 1];
            const v1x = b.x - a.x, v1y = b.y - a.y;
            const v2x = c.x - b.x, v2y = c.y - b.y;
            const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
            if (l1 < 11 || l2 < 11) { merged = true; continue; }
            const turn = Math.atan2(Math.abs(v1x * v2y - v1y * v2x), v1x * v2x + v1y * v2y);
            if (turn < 0.40) { merged = true; continue; }
            nextVm.push(b);
        }
        nextVm.push(vm[vm.length - 1]);
        vm = nextVm;
    }

    const minVerts = anchoredStart ? 3 : 4;
    if (vm.length < minVerts || vm.length > 24) return null;

    const p0 = vm[0], pEnd = vm[vm.length - 1];
    const openDist = Math.hypot(pEnd.x - p0.x, pEnd.y - p0.y);
    if (openDist < Math.max(28, diag * 0.28)) return null;

    const bondLen = (typeof BOND_LENGTH === 'number' && BOND_LENGTH > 0) ? BOND_LENGTH : 44;
    const maxCarbonLeg = Math.max(145, bondLen * 3.3);
    const maxAvgCarbonLeg = Math.max(120, bondLen * 2.75);
    let sumLeg = 0, minLeg = Infinity, maxLeg = 0;
    const legVecs = [];

    for (let i = 1; i < vm.length; i++) {
        const a = vm[i - 1], b = vm[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const legLen = Math.hypot(dx, dy);
        if (legLen < (anchoredStart && vm.length === 3 ? 17 : 13) || legLen > maxCarbonLeg) return null;
        sumLeg += legLen;
        if (legLen < minLeg) minLeg = legLen;
        if (legLen > maxLeg) maxLeg = legLen;
        legVecs.push({ dx, dy, len: legLen });

        // Kiểm tra độ thẳng từng cạnh bằng cả Max & RMS (nhận siêu nhạy nét vẽ tay nhanh, nhưng vẫn loại chữ tròn m/n/u/w/S)
        const maxAllowedDev = Math.max(13.5, legLen * 0.28);
        const maxAllowedRms = Math.max(7.0, legLen * 0.145);
        let sumSq = 0, cnt = 0;
        for (let k = a.srcIdx; k <= b.srcIdx; k++) {
            const d = distToSegment(rawPoints[k], a, b);
            if (d > maxAllowedDev) return null;
            sumSq += d * d;
            cnt++;
        }
        if (cnt > 2 && Math.sqrt(sumSq / cnt) > maxAllowedRms) return null;
    }

    const avgLeg = sumLeg / (vm.length - 1);
    if (avgLeg < 15 || avgLeg > maxAvgCarbonLeg) return null;
    if (maxLeg / Math.max(1, minLeg) > 4.2) return null;
    if (openDist < sumLeg * 0.34) return null;

    // Kiểm tra góc rẽ zíc-zắc (mở rộng 24°..153° để khớp tay vẽ tự nhiên trên iPad)
    const turnSigns = [];
    let sumTurn = 0;
    for (let i = 1; i < vm.length - 1; i++) {
        const lA = legVecs[i - 1], lB = legVecs[i];
        const cross = lA.dx * lB.dy - lA.dy * lB.dx;
        const dot = lA.dx * lB.dx + lA.dy * lB.dy;
        const turnAng = Math.atan2(Math.abs(cross), dot);
        if (turnAng < 0.42 || turnAng > 2.68) return null;
        sumTurn += turnAng;
        turnSigns.push(cross >= 0 ? 1 : -1);
    }

    if (vm.length === 3) {
        // Chỉ cho phép 3C (2 cạnh ^ / V) khi neo trực tiếp lên nguyên tử C có sẵn và góc sắc rõ
        if (!anchoredStart || sumTurn < 0.55 || sumTurn > 2.30) return null;
        return vm.map(v => ({ x: v.x, y: v.y }));
    }

    let altCount = 0;
    for (let i = 1; i < turnSigns.length; i++) {
        if (turnSigns[i] * turnSigns[i - 1] < 0) altCount++;
    }
    if (vm.length === 4 && altCount < 1) return null;
    if (vm.length >= 5 && altCount < Math.max(1, Math.ceil((turnSigns.length - 1) * 0.60))) return null;

    // Lọc chống nhận nhầm chữ cái viết tay (Z, N, M, W và chữ thường m/w/n/u kích thước nhỏ nét tròn/gấp sát)
    const avgTurn = sumTurn / Math.max(1, turnSigns.length);
    if (avgLeg < 26 && diag < 76 && avgTurn > 1.75) return null;
    if (vm.length === 4) {
        const l0 = legVecs[0], l1 = legVecs[1], l2 = legVecs[2];
        const isLetterZ = Math.abs(l0.dy) < l0.len * 0.28 && Math.abs(l2.dy) < l2.len * 0.28 && (l1.dx * l0.dx) < -0.25 * l0.len * l1.len;
        const isLetterN = Math.abs(l0.dx) < l0.len * 0.28 && Math.abs(l2.dx) < l2.len * 0.28 && (l1.dy * l0.dy) < -0.25 * l0.len * l1.len;
        if (isLetterZ || isLetterN) return null;
    } else if (vm.length === 5) {
        const isCompactMW = Math.max(boxW, boxH) < 72 && boxW < boxH * 1.45 && avgTurn > 2.15;
        if (isCompactMW) return null;
    }

    return vm.map(v => ({ x: v.x, y: v.y }));
}

function isUnambiguousZigZagCarbonStroke(rawPoints, doc = null) {
    if (!rawPoints || rawPoints.length < 5) return null;
    if (typeof isScribbleEraseGesture === 'function' && isScribbleEraseGesture(rawPoints, 4)) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < rawPoints.length; i++) {
        const p = rawPoints[i];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    const boxW = maxX - minX, boxH = maxY - minY;
    const diag = Math.hypot(boxW, boxH);
    if (diag < 34) return null;

    const useDoc = doc || (typeof getDocState === 'function' ? getDocState() : null);
    const anchoredStart = !!(useDoc && typeof findNearestAtom === 'function' && findNearestAtom(rawPoints[0].x, rawPoints[0].y, 26));

    // Thử đa tỷ lệ RDP (tự thích nghi từ mạch C nhỏ gọn đến mạch C vẽ phóng khoáng rộng trên iPad!)
    const epsCandidates = [
        Math.max(5.5, Math.min(16, diag * 0.055)),
        Math.max(4.5, Math.min(13, diag * 0.038)),
        Math.max(7.5, Math.min(20, diag * 0.085))
    ];
    for (let eIdx = 0; eIdx < epsCandidates.length; eIdx++) {
        const found = tryValidateZigZagCandidate(rawPoints, epsCandidates[eIdx], diag, boxW, boxH, anchoredStart);
        if (found) return found;
    }
    return null;
}

/* ============================================================================
 * TỰ ĐỘNG CĂN CHỈNH VÒNG CARBON ĐỀU ĐẸP (v15.7)
 * 1. Khi khép vòng bằng Mạch C (3–8 cạnh, vòng đơn hoặc vòng ghép chung cạnh)
 * 2. Khi phác tay hình ngũ giác/lục giác (nhấc bút ngay hoặc giữ cuối nét)
 * ============================================================================ */
function snapRingOrientationAngle(rawTheta, n) {
    let snapInc = Math.PI / Math.max(3, n);
    if (n === 6) snapInc = Math.PI / 6;        // 30° -> đỉnh nhọn (-90°) hoặc đỉnh ngang (0°) chuẩn ChemDraw
    else if (n === 5) snapInc = Math.PI / 10;  // 18° -> ngũ giác đứng cân đối
    else if (n === 4) snapInc = Math.PI / 4;   // 45° -> hình vuông ngay ngắn hoặc hình thoi
    else if (n === 3) snapInc = Math.PI / 6;   // 30° -> tam giác đều cân đối
    return normalizeBondAngle(Math.round(rawTheta / snapInc) * snapInc);
}

function findShortestCycleBetween(doc, startId, endId, excludeBondId = null, maxVertices = 8) {
    if (!doc || !startId || !endId || startId === endId) return null;
    const adj = new Map();
    (doc.bonds || []).forEach(b => {
        if (excludeBondId && b.id === excludeBondId) return;
        if (!adj.has(b.a1)) adj.set(b.a1, []);
        if (!adj.has(b.a2)) adj.set(b.a2, []);
        adj.get(b.a1).push(b.a2);
        adj.get(b.a2).push(b.a1);
    });
    const queue = [[startId]];
    const visited = new Set([startId]);
    while (queue.length) {
        const path = queue.shift();
        if (path.length >= maxVertices) continue;
        const last = path[path.length - 1];
        const nbs = adj.get(last) || [];
        for (let i = 0; i < nbs.length; i++) {
            const nb = nbs[i];
            if (nb === endId) {
                const full = [...path, nb];
                if (full.length >= 3 && full.length <= maxVertices) return full;
                continue;
            }
            if (!visited.has(nb)) {
                visited.add(nb);
                queue.push([...path, nb]);
            }
        }
    }
    return null;
}

function beautifyClosedRingInDoc(doc, atomA, atomB, closingBondId = null) {
    if (!doc || !atomA || !atomB || !Array.isArray(doc.atoms) || !Array.isArray(doc.bonds)) return 0;
    const cycleIds = findShortestCycleBetween(doc, atomA.id, atomB.id, closingBondId, 8);
    if (!cycleIds || cycleIds.length < 3 || cycleIds.length > 8) return 0;

    const atomById = new Map();
    doc.atoms.forEach(a => atomById.set(a.id, a));
    const ringAtoms = cycleIds.map(id => atomById.get(id)).filter(Boolean);
    const n = ringAtoms.length;
    if (n !== cycleIds.length) return 0;

    const ringSet = new Set(cycleIds);
    const ringEdgeKeys = new Set();
    for (let i = 0; i < n; i++) {
        const id1 = cycleIds[i], id2 = cycleIds[(i + 1) % n];
        ringEdgeKeys.add(id1 < id2 ? (id1 + '|' + id2) : (id2 + '|' + id1));
    }

    // Dựng đồ thị các liên kết nằm NGOÀI vòng mới khép để xác định đỉnh ghép chung vòng (fused) & nhóm thế gắn kèm
    const extAdj = new Map();
    doc.bonds.forEach(b => {
        const ek = b.a1 < b.a2 ? (b.a1 + '|' + b.a2) : (b.a2 + '|' + b.a1);
        if (ringEdgeKeys.has(ek)) return;
        if (!extAdj.has(b.a1)) extAdj.set(b.a1, []);
        if (!extAdj.has(b.a2)) extAdj.set(b.a2, []);
        extAdj.get(b.a1).push(b.a2);
        extAdj.get(b.a2).push(b.a1);
    });

    // Tìm xem mỗi đỉnh vòng có nối ra ngoài hay nối thông qua vòng khác tới đỉnh vòng khác không
    const extSubtrees = new Array(n).fill(null);
    const fusedIdxSet = new Set();
    for (let i = 0; i < n; i++) {
        const rootId = cycleIds[i];
        const firstNbs = extAdj.get(rootId) || [];
        if (!firstNbs.length) { extSubtrees[i] = []; continue; }
        const seen = new Set([rootId]);
        const q = [...firstNbs];
        firstNbs.forEach(id => seen.add(id));
        let touchesOtherRingVertex = false;
        const subIds = [];
        while (q.length) {
            const cur = q.shift();
            if (ringSet.has(cur) && cur !== rootId) {
                touchesOtherRingVertex = true;
                fusedIdxSet.add(i);
                continue;
            }
            subIds.push(cur);
            const nbs = extAdj.get(cur) || [];
            for (let k = 0; k < nbs.length; k++) {
                if (!seen.has(nbs[k])) {
                    seen.add(nbs[k]);
                    q.push(nbs[k]);
                }
            }
        }
        extSubtrees[i] = touchesOtherRingVertex ? null : subIds;
    }

    // Bỏ qua nếu là hệ đa vòng cầu nối phức tạp (>= 3 đỉnh dính sang vòng khác) để không làm bẹp cấu trúc 3D
    if (fusedIdxSet.size >= 3) return 0;

    let cx0 = 0, cy0 = 0;
    for (let i = 0; i < n; i++) { cx0 += ringAtoms[i].x; cy0 += ringAtoms[i].y; }
    cx0 /= n; cy0 /= n;

    const bondLen = (typeof BOND_LENGTH === 'number' && BOND_LENGTH > 0) ? BOND_LENGTH : 44;
    const oldPos = ringAtoms.map(a => ({ x: a.x, y: a.y }));
    const newPos = new Array(n);

    if (fusedIdxSet.size === 2) {
        const fArr = Array.from(fusedIdxSet);
        const iA = fArr[0], iB = fArr[1];
        let uIdx = -1, vIdx = -1;
        if ((iA + 1) % n === iB) { uIdx = iA; vIdx = iB; }
        else if ((iB + 1) % n === iA) { uIdx = iB; vIdx = iA; }
        else return 0; // 2 đỉnh không kề nhau (hệ cầu nối) -> giữ nguyên

        const u = ringAtoms[uIdx], v = ringAtoms[vIdx];
        const edgeLen = Math.hypot(v.x - u.x, v.y - u.y) || bondLen;
        const ap = edgeLen / (2 * Math.tan(Math.PI / n));
        const rPoly = edgeLen / (2 * Math.sin(Math.PI / n));
        const mx = (u.x + v.x) * 0.5, my = (u.y + v.y) * 0.5;
        let nx = -(v.y - u.y) / edgeLen, ny = (v.x - u.x) / edgeLen;
        if ((cx0 - mx) * nx + (cy0 - my) * ny < 0) { nx = -nx; ny = -ny; }
        const ringCx = mx + nx * ap, ringCy = my + ny * ap;
        const angU = Math.atan2(u.y - ringCy, u.x - ringCx);
        const angV = Math.atan2(v.y - ringCy, v.x - ringCx);
        const dUV = bondAngleDiff(angV, angU);
        const dTheta = (dUV >= 0 ? 1 : -1) * ((Math.PI * 2) / n);

        newPos[uIdx] = { x: u.x, y: u.y };
        newPos[vIdx] = { x: v.x, y: v.y };
        for (let off = 2; off < n; off++) {
            const idx = (uIdx + off) % n;
            const ang = angU + off * dTheta;
            newPos[idx] = { x: ringCx + rPoly * Math.cos(ang), y: ringCy + rPoly * Math.sin(ang) };
        }
    } else {
        // Vòng đơn tự do hoặc vòng gắn 1 đỉnh vào mạch có sẵn
        let area2 = 0;
        for (let i = 0; i < n; i++) {
            const p1 = ringAtoms[i], p2 = ringAtoms[(i + 1) % n];
            area2 += p1.x * p2.y - p2.x * p1.y;
        }
        const winding = area2 >= 0 ? 1 : -1;
        const step = (Math.PI * 2) / n;
        const rPoly = bondLen / (2 * Math.sin(Math.PI / n));

        let sumCos = 0, sumSin = 0;
        for (let i = 0; i < n; i++) {
            const a = Math.atan2(ringAtoms[i].y - cy0, ringAtoms[i].x - cx0) - winding * i * step;
            sumCos += Math.cos(a);
            sumSin += Math.sin(a);
        }
        const rawTheta0 = Math.atan2(sumSin, sumCos);
        const theta0 = snapRingOrientationAngle(rawTheta0, n);

        for (let i = 0; i < n; i++) {
            const ang = theta0 + winding * i * step;
            newPos[i] = { x: cx0 + rPoly * Math.cos(ang), y: cy0 + rPoly * Math.sin(ang) };
        }

        // Nếu có đúng 1 đỉnh đang neo vào mạch chính lớn (>= 2 nguyên tử ngoài vòng), giữ cố định đỉnh neo đó để phân tử cũ không bị dịch chuyển
        let pinIdx = -1, pinMaxSize = 1;
        for (let i = 0; i < n; i++) {
            const sz = Array.isArray(extSubtrees[i]) ? extSubtrees[i].length : 0;
            if (sz > pinMaxSize) { pinMaxSize = sz; pinIdx = i; }
        }
        if (pinIdx >= 0) {
            const shiftX = oldPos[pinIdx].x - newPos[pinIdx].x;
            const shiftY = oldPos[pinIdx].y - newPos[pinIdx].y;
            for (let i = 0; i < n; i++) {
                newPos[i].x += shiftX;
                newPos[i].y += shiftY;
            }
            // Không dịch nhánh chính của đỉnh pin (vì đỉnh pin đứng yên!)
            extSubtrees[pinIdx] = [];
        }
    }

    // Áp dụng tọa độ chuẩn đều & trượt mượt các nhóm thế gắn kèm theo từng đỉnh vòng
    for (let i = 0; i < n; i++) {
        const dx = newPos[i].x - oldPos[i].x;
        const dy = newPos[i].y - oldPos[i].y;
        ringAtoms[i].x = newPos[i].x;
        ringAtoms[i].y = newPos[i].y;
        const sub = extSubtrees[i];
        if (Array.isArray(sub) && sub.length && (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05)) {
            for (let k = 0; k < sub.length; k++) {
                const sa = atomById.get(sub[k]);
                if (sa) { sa.x += dx; sa.y += dy; }
            }
        }
    }
    return n;
}

function detectFreehandCarbonRing(rawPoints, strictQuickLift = false) {
    if (!rawPoints || rawPoints.length < 10) return null;
    if (typeof isScribbleEraseGesture === 'function' && isScribbleEraseGesture(rawPoints, 3)) return null;

    let totalLen = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < rawPoints.length; i++) {
        const p = rawPoints[i];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
        if (i > 0) totalLen += Math.hypot(p.x - rawPoints[i - 1].x, p.y - rawPoints[i - 1].y);
    }
    const boxW = maxX - minX, boxH = maxY - minY;
    const diag = Math.hypot(boxW, boxH);
    if (totalLen < 95 || diag < (strictQuickLift ? 44 : 34) || diag > 260) return null;
    if (Math.min(boxW, boxH) / Math.max(1, Math.max(boxW, boxH)) < (strictQuickLift ? 0.56 : 0.48)) return null;

    const p0 = rawPoints[0], pLast = rawPoints[rawPoints.length - 1];
    const openDist = Math.hypot(pLast.x - p0.x, pLast.y - p0.y);
    if (openDist > Math.max(30, diag * 0.36)) return null;

    const cx = (minX + maxX) * 0.5, cy = (minY + maxY) * 0.5;
    const rx = Math.max(10, boxW * 0.5), ry = Math.max(10, boxH * 0.5);
    let ellSq = 0;
    for (let i = 0; i < rawPoints.length; i++) {
        const nr = Math.hypot((rawPoints[i].x - cx) / rx, (rawPoints[i].y - cy) / ry);
        ellSq += (nr - 1) * (nr - 1);
    }
    const ellipseRms = Math.sqrt(ellSq / rawPoints.length);
    const ellipsePxRms = ellipseRms * (rx + ry) * 0.5;

    const epsList = [
        Math.max(4.5, Math.min(13, diag * 0.055)),
        Math.max(3.8, Math.min(11, diag * 0.042)),
        Math.max(5.5, Math.min(15, diag * 0.072))
    ];
    for (let eIdx = 0; eIdx < epsList.length; eIdx++) {
        const rawV = rdpSimplifyPointsWithMeta(rawPoints, epsList[eIdx]);
        if (!rawV || rawV.length < 5) continue;
        let verts = rawV.map(v => ({ x: v.x, y: v.y }));
        if (verts.length >= 4 && Math.hypot(verts[verts.length - 1].x - verts[0].x, verts[verts.length - 1].y - verts[0].y) < Math.max(28, diag * 0.34)) {
            verts.pop();
        }
        // Gộp đỉnh rung tay nhẹ (< 22°) theo vòng khép kín
        let merged = true, guard = 0;
        while (merged && verts.length >= 5 && guard++ < 6) {
            merged = false;
            const nV = verts.length;
            const keep = [];
            for (let i = 0; i < nV; i++) {
                const a = verts[(i - 1 + nV) % nV];
                const b = verts[i];
                const c = verts[(i + 1) % nV];
                const v1x = b.x - a.x, v1y = b.y - a.y;
                const v2x = c.x - b.x, v2y = c.y - b.y;
                const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
                const turn = Math.atan2(Math.abs(v1x * v2y - v1y * v2x), v1x * v2x + v1y * v2y);
                if (l1 < 10 || l2 < 10 || turn < 0.36) {
                    merged = true;
                } else {
                    keep.push(b);
                }
            }
            if (keep.length >= 3) verts = keep; else break;
        }

        const n = verts.length;
        const validN = strictQuickLift ? (n === 5 || n === 6) : (n === 5 || n === 6 || n === 7);
        if (!validN) continue;

        // Kiểm tra đa giác lồi khép kín (cùng chiều xoay, các cạnh tương đối đều)
        let minEdge = Infinity, maxEdge = 0, firstSign = 0, convexOk = true;
        for (let i = 0; i < n; i++) {
            const a = verts[i], b = verts[(i + 1) % n], c = verts[(i + 2) % n];
            const e1x = b.x - a.x, e1y = b.y - a.y;
            const e2x = c.x - b.x, e2y = c.y - b.y;
            const l1 = Math.hypot(e1x, e1y);
            if (l1 < 14) { convexOk = false; break; }
            if (l1 < minEdge) minEdge = l1;
            if (l1 > maxEdge) maxEdge = l1;
            const cr = e1x * e2y - e1y * e2x;
            const dt = e1x * e2x + e1y * e2y;
            const turn = Math.atan2(Math.abs(cr), dt);
            if (turn < 0.35 || turn > 2.35) { convexOk = false; break; }
            const sgn = cr >= 0 ? 1 : -1;
            if (!firstSign) firstSign = sgn;
            else if (sgn !== firstSign) { convexOk = false; break; }
        }
        if (!convexOk) continue;
        if (maxEdge / Math.max(1, minEdge) > (strictQuickLift ? 2.6 : 3.0)) continue;

        // So khớp đa giác vs hình tròn/elip -> phân biệt cực chuẩn giữa Vòng Benzen ⬡/⬠ với chữ O/0/hình tròn!
        const closedLoop = [...verts, verts[0]];
        const polyRms = computePolylineFitRms(rawPoints, closedLoop);
        const maxPolyAllow = Math.max(5.5, diag * 0.068);
        if (polyRms > maxPolyAllow) continue;
        if (strictQuickLift) {
            if (ellipseRms < 0.036 || polyRms >= ellipsePxRms * 0.88) continue;
        } else {
            if (ellipseRms < 0.030 || polyRms >= ellipsePxRms * 0.96) continue;
        }

        // Tính hướng vòng khớp nhất và làm tròn góc chuẩn hóa học
        let sumCos = 0, sumSin = 0;
        const step = (Math.PI * 2) / n;
        for (let i = 0; i < n; i++) {
            const ang = Math.atan2(verts[i].y - cy, verts[i].x - cx) - firstSign * i * step;
            sumCos += Math.cos(ang);
            sumSin += Math.sin(ang);
        }
        const startAng = snapRingOrientationAngle(Math.atan2(sumSin, sumCos), n);
        return { n, cx, cy, startAng };
    }
    return null;
}

function commitRegularCarbonRing(doc, cx, cy, n, startAng, strokeColor) {
    if (!doc || n < 3 || n > 8) return 0;
    if (!doc.atoms) doc.atoms = [];
    if (!doc.bonds) doc.bonds = [];
    const col = strokeColor || penColor || '#0f172a';
    const bondLen = (typeof BOND_LENGTH === 'number' && BOND_LENGTH > 0) ? BOND_LENGTH : 44;
    const rad = bondLen / (2 * Math.sin(Math.PI / n));
    const step = (Math.PI * 2) / n;

    // Kiểm tra xem có cạnh liên kết sẵn gần tâm vòng để ghép vòng chung cạnh tự động không
    const hitBond = typeof findNearestBond === 'function' ? findNearestBond(cx, cy, rad * 1.15) : null;
    if (hitBond) {
        const a1 = doc.atoms.find(a => a.id === hitBond.a1);
        const a2 = doc.atoms.find(a => a.id === hitBond.a2);
        if (a1 && a2) {
            const mx = (a1.x + a2.x) * 0.5, my = (a1.y + a2.y) * 0.5;
            const dCenter = Math.hypot(cx - mx, cy - my);
            const ap = bondLen / (2 * Math.tan(Math.PI / n));
            if (Math.abs(dCenter - ap) < 22) {
                const edgeLen = Math.hypot(a2.x - a1.x, a2.y - a1.y) || bondLen;
                const apF = edgeLen / (2 * Math.tan(Math.PI / n));
                const rPoly = edgeLen / (2 * Math.sin(Math.PI / n));
                let nx = -(a2.y - a1.y) / edgeLen, ny = (a2.x - a1.x) / edgeLen;
                if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; }
                const rCx = mx + nx * apF, rCy = my + ny * apF;
                const ang1 = Math.atan2(a1.y - rCy, a1.x - rCx);
                const ang2 = Math.atan2(a2.y - rCy, a2.x - rCx);
                const dTheta = (bondAngleDiff(ang2, ang1) >= 0 ? 1 : -1) * step;
                const ringVerts = [a1, a2];
                for (let k = 2; k < n; k++) {
                    const ang = ang1 + k * dTheta;
                    const px = rCx + rPoly * Math.cos(ang), py = rCy + rPoly * Math.sin(ang);
                    const ex = findNearestAtom(px, py, 14);
                    if (ex && !ringVerts.includes(ex)) ringVerts.push(ex);
                    else {
                        const na = { id: genId('a'), x: px, y: py, label: 'C', color: col };
                        doc.atoms.push(na); ringVerts.push(na);
                    }
                }
                for (let k = 1; k < n; k++) {
                    const v1 = ringVerts[k], v2 = ringVerts[(k + 1) % n];
                    const exists = doc.bonds.some(b => (b.a1 === v1.id && b.a2 === v2.id) || (b.a1 === v2.id && b.a2 === v1.id));
                    if (!exists && canAddBondOrder(v1, 1, doc) && canAddBondOrder(v2, 1, doc)) {
                        doc.bonds.push({ id: genId('b'), a1: v1.id, a2: v2.id, order: 1, stereo: null, color: col });
                    }
                }
                enforceAllValenceAndHydrogens(doc);
                ensureAutoNextPageIfNeeded(rCy + rPoly);
                return n;
            }
        }
    }

    const verts = [];
    let maxY = cy;
    for (let i = 0; i < n; i++) {
        const ang = startAng + i * step;
        const px = cx + rad * Math.cos(ang);
        const py = cy + rad * Math.sin(ang);
        const ex = findNearestAtom(px, py, 16);
        if (ex && !verts.includes(ex)) {
            verts.push(ex);
        } else {
            const na = { id: genId('a'), x: px, y: py, label: 'C', color: col };
            doc.atoms.push(na);
            verts.push(na);
        }
        maxY = Math.max(maxY, py);
    }
    for (let i = 0; i < n; i++) {
        const v1 = verts[i], v2 = verts[(i + 1) % n];
        const exists = doc.bonds.some(b => (b.a1 === v1.id && b.a2 === v2.id) || (b.a1 === v2.id && b.a2 === v1.id));
        if (!exists && canAddBondOrder(v1, 1, doc) && canAddBondOrder(v2, 1, doc)) {
            doc.bonds.push({ id: genId('b'), a1: v1.id, a2: v2.id, order: 1, stereo: null, color: col });
        }
    }
    enforceAllValenceAndHydrogens(doc);
    ensureAutoNextPageIfNeeded(maxY);
    window.lastActiveChemAtomId = verts[verts.length - 1]?.id || null;
    return n;
}

function triggerInkHoldSnap() {
    inkHoldTimer = null;
    if (!currentInkStroke || currentInkStroke.snappedShape) return;
    if (appLibrary.holdToShapeEnabled === false) return;
    const shape = recognizeInkShape(currentInkStroke.points, currentInkStroke.mode);
    if (!shape) return;
    currentInkStroke.snappedShape = shape;
    currentInkStroke.points = shape.points.map(p => ({ x: p.x, y: p.y }));
    if (typeof showGestureToast === 'function') {
        showGestureToast(`✨ ${shape.label}`);
    }
    renderAll();
}

function scheduleInkHoldSnapCheck(ptW) {
    if (appLibrary.holdToShapeEnabled === false || !currentInkStroke || currentInkStroke.snappedShape) return;
    const holdTol = Math.max(4.5, 6.5 / Math.max(0.5, typeof zoom === 'number' ? zoom : 1));
    if (inkHoldState && Math.hypot(ptW.x - inkHoldState.x, ptW.y - inkHoldState.y) < holdTol) {
        return;
    }
    if (inkHoldTimer) {
        clearTimeout(inkHoldTimer);
        inkHoldTimer = null;
    }
    inkHoldState = { x: ptW.x, y: ptW.y };
    const delayMs = Math.max(250, Math.min(1200, Number(appLibrary?.ipadConfig?.holdToShapeDelayMs) || 480));
    inkHoldTimer = setTimeout(triggerInkHoldSnap, delayMs);
}

function convertLassoInkToCarbonChain() {
    const doc = getDocState();
    const indices = (lassoSelection.selectedInkIndices || []).filter(i => doc.inkStrokes && doc.inkStrokes[i]);
    if (!indices.length) {
        if (typeof showGestureToast === 'function') {
            showGestureToast('Hãy khoanh Lasso vào ít nhất 1 nét vẽ tay để chuyển thành Mạch C');
        }
        return;
    }
    saveHistorySnapshot();
    const convertedSet = new Set();
    let lastCount = 0;
    indices.forEach(idx => {
        const st = doc.inkStrokes[idx];
        const verts = rdpSimplifyPoints(st?.points || [], 8);
        if (verts.length >= 2) {
            const cnt = commitCarbonChainFromVertices(verts, doc, st.color);
            if (cnt >= 2) {
                convertedSet.add(idx);
                lastCount = cnt;
            }
        }
    });
    if (!convertedSet.size) {
        if (typeof showGestureToast === 'function') {
            showGestureToast('Nét đã chọn quá ngắn để tạo Mạch Carbon');
        }
        return;
    }
    doc.inkStrokes = (doc.inkStrokes || []).filter((_, i) => !convertedSet.has(i));
    clearLassoSelection();
    persistLibrary();
    renderAll();
    if (typeof showGestureToast === 'function') {
        showGestureToast(`✨ Đã chuyển ${convertedSet.size} nét thành Mạch Carbon (${lastCount}C)`);
    }
}

function bootApp() {
    initLibraryData();
    if (typeof hydrateLibraryFromIndexedDB === 'function') {
        hydrateLibraryFromIndexedDB(() => {
            if (typeof syncActivePaperDimensions === 'function') syncActivePaperDimensions();
            if (typeof renderOpenTabsBar === 'function') renderOpenTabsBar();
            if (typeof applyIpadAccessibilityConfig === 'function') applyIpadAccessibilityConfig();
            if (typeof applyPenPillLayout === 'function') applyPenPillLayout();
            if (typeof renderFavoriteColorWells === 'function') renderFavoriteColorWells();
            if (typeof applyAppTheme === 'function') applyAppTheme(appLibrary.appTheme);
            if (typeof invalidateInkBaseLayerCache === 'function') invalidateInkBaseLayerCache();
            if (typeof resizeCanvas === 'function') resizeCanvas();
            if (typeof fitA4ToScreen === 'function') fitA4ToScreen();
            if (typeof renderAll === 'function') renderAll();
        });
    }
    initAllPopoverGrids();
    renderOpenTabsBar();
    resizeCanvas();
    fitA4ToScreen();
    updateToolButtonsUI();
    if (typeof applyIpadAccessibilityConfig === 'function') applyIpadAccessibilityConfig();
    if (typeof applyPenPillLayout === 'function') applyPenPillLayout();
    if (typeof initExamDrawerEvents === 'function') initExamDrawerEvents();
    if (typeof renderFavoriteColorWells === 'function') renderFavoriteColorWells();
    if (typeof attachGlobalToolLongPressInfo === 'function') attachGlobalToolLongPressInfo();
    if (typeof renderVersionUpdateHubContent === 'function') renderVersionUpdateHubContent();
    if (typeof checkForAppUpdate === 'function') {
        setTimeout(() => checkForAppUpdate(true), 750);
    }
    if (typeof bindAutoUpdateWakeListeners === 'function') {
        bindAutoUpdateWakeListeners();
    }
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', bootApp);
else bootApp();