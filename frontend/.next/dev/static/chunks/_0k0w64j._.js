(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createSession",
    ()=>createSession,
    "createWebSocket",
    ()=>createWebSocket,
    "getLeaderboard",
    ()=>getLeaderboard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
const BASE = (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000') + '/api/v1';
async function createSession(doctrineText, doctrineTitle) {
    const res = await fetch(`${BASE}/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            doctrine_text: doctrineText,
            ...doctrineTitle ? {
                doctrine_title: doctrineTitle
            } : {}
        })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
async function getLeaderboard() {
    const res = await fetch(`${BASE}/leaderboard`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
function createWebSocket(sessionId) {
    const wsBase = BASE.replace(/^https/, 'wss').replace(/^http/, 'ws');
    return new WebSocket(`${wsBase}/sessions/${sessionId}/ws`);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/GameMap.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>GameMap
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
function GameMap({ snapshot }) {
    _s();
    const canvasRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const containerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const snapshotRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(snapshot);
    const frameRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    // Keep snapshot ref current
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "GameMap.useEffect": ()=>{
            snapshotRef.current = snapshot;
        }
    }["GameMap.useEffect"], [
        snapshot
    ]);
    // RAF loop — redraws every frame for animated fire
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "GameMap.useEffect": ()=>{
            const canvas = canvasRef.current;
            if (!canvas) return;
            let active = true;
            function loop() {
                if (!active || !canvas) return;
                drawMap(canvas, snapshotRef.current, performance.now());
                frameRef.current = requestAnimationFrame(loop);
            }
            loop();
            return ({
                "GameMap.useEffect": ()=>{
                    active = false;
                    cancelAnimationFrame(frameRef.current);
                }
            })["GameMap.useEffect"];
        }
    }["GameMap.useEffect"], []);
    // Resize observer — update canvas dimensions when container resizes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "GameMap.useEffect": ()=>{
            const container = containerRef.current;
            const canvas = canvasRef.current;
            if (!container || !canvas) return;
            function resize() {
                if (!container || !canvas) return;
                const size = Math.min(container.clientWidth, container.clientHeight) - 8;
                if (size > 0) {
                    canvas.width = size;
                    canvas.height = size;
                }
            }
            resize();
            const ro = new ResizeObserver(resize);
            ro.observe(container);
            return ({
                "GameMap.useEffect": ()=>ro.disconnect()
            })["GameMap.useEffect"];
        }
    }["GameMap.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: containerRef,
        className: "w-full h-full flex items-center justify-center",
        style: {
            padding: '4px'
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("canvas", {
            ref: canvasRef,
            style: {
                display: 'block',
                maxWidth: '100%',
                maxHeight: '100%',
                imageRendering: 'pixelated',
                border: '1px solid #1a2a1a',
                boxShadow: '0 0 40px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,0.4)'
            }
        }, void 0, false, {
            fileName: "[project]/components/GameMap.tsx",
            lineNumber: 64,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/GameMap.tsx",
        lineNumber: 59,
        columnNumber: 5
    }, this);
}
_s(GameMap, "v6X6ol4jsiWypdUtmpUqaCxPtVM=");
_c = GameMap;
/* ------------------------------------------------------------------ */ /* Main draw function                                                   */ /* ------------------------------------------------------------------ */ function drawMap(canvas, snap, time) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { grid_size, fire_cells, burned_cells, suppressed_cells, firebreak_cells, village, units } = snap;
    const W = canvas.width;
    if (W === 0) return;
    const cs = W / grid_size;
    // ---- Build lookup sets ----
    const fireSet = new Set(fire_cells.map(([r, c])=>k(r, c)));
    const burnedSet = new Set(burned_cells.map(([r, c])=>k(r, c)));
    const suppressSet = new Set(suppressed_cells.map(([r, c])=>k(r, c)));
    const breakSet = new Set(firebreak_cells.map(([r, c])=>k(r, c)));
    const [vr, vc] = village.top_left;
    const villageSet = new Set();
    for(let r = vr; r < vr + village.size; r++)for(let c = vc; c < vc + village.size; c++)villageSet.add(k(r, c));
    // ---- PASS 1: Base cell colors ----
    for(let row = 0; row < grid_size; row++){
        for(let col = 0; col < grid_size; col++){
            const key = k(row, col);
            const x = col * cs;
            const y = row * cs;
            const w = cs + 0.5;
            if (fireSet.has(key)) {
                ctx.fillStyle = fireBaseColor(row, col, time);
            } else if (burnedSet.has(key)) {
                ctx.fillStyle = burnedColor(row, col);
            } else if (suppressSet.has(key)) {
                ctx.fillStyle = suppressedColor(row, col);
            } else if (breakSet.has(key)) {
                ctx.fillStyle = firebreakColor(row, col);
            } else if (villageSet.has(key)) {
                ctx.fillStyle = village.is_intact ? '#a85e30' : '#6a2010';
            } else {
                ctx.fillStyle = forestFloor(row, col);
            }
            ctx.fillRect(x, y, w, w);
        }
    }
    // ---- PASS 2: Tree canopies (forest only, if cells are big enough) ----
    if (cs >= 5) {
        ctx.save();
        for(let row = 0; row < grid_size; row++){
            for(let col = 0; col < grid_size; col++){
                const key = k(row, col);
                if (fireSet.has(key) || burnedSet.has(key) || villageSet.has(key) || breakSet.has(key)) continue;
                const h = hash(row, col);
                const x = col * cs;
                const y = row * cs;
                const cx = x + cs * 0.5 + ((h >> 2 & 7) - 3) * cs * 0.08;
                const cy = y + cs * 0.48 + ((h >> 5 & 7) - 3) * cs * 0.08;
                const r = cs * (0.32 + (h & 7) * 0.02);
                const g = 52 + (h & 31) - 16;
                const b = 22 + (h >> 3 & 15) - 7;
                ctx.fillStyle = suppressSet.has(key) ? `rgb(${15 + (h & 5)}, ${g - 8}, ${b + 8})` : `rgb(${10 + (h & 5)}, ${g}, ${b})`;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
                // Second canopy for larger cells
                if (cs >= 10 && (h & 3) !== 0) {
                    const cx2 = x + cs * 0.5 + ((h >> 8 & 7) - 3) * cs * 0.14;
                    const cy2 = y + cs * 0.48 + ((h >> 11 & 7) - 3) * cs * 0.14;
                    const r2 = r * 0.72;
                    const g2 = g + 8;
                    ctx.fillStyle = `rgb(${8 + (h & 3)}, ${g2}, ${b - 2})`;
                    ctx.beginPath();
                    ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();
    }
    // ---- PASS 3: Village detail ----
    if (cs >= 8) {
        const vCx = (vc + village.size / 2) * cs;
        const vCy = (vr + village.size / 2) * cs;
        ctx.save();
        ctx.font = `${Math.max(cs * village.size * 0.38, 14)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = village.is_intact ? 'rgba(255,200,100,0.4)' : 'rgba(255,50,0,0.5)';
        ctx.shadowBlur = 8;
        ctx.fillText(village.is_intact ? '\u{1F3D8}' : '\u{1F525}', vCx, vCy);
        ctx.restore();
    }
    // ---- PASS 4: Fire glow ----
    if (fire_cells.length > 0 && cs >= 4) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.18 + Math.sin(time / 200) * 0.06;
        for (const [row, col] of fire_cells){
            const x = col * cs + cs * 0.5;
            const y = row * cs + cs * 0.5;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, cs * 1.6);
            grad.addColorStop(0, '#ff8800');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(col * cs - cs, row * cs - cs, cs * 3, cs * 3);
        }
        ctx.restore();
    }
    // ---- PASS 5: Unit target lines ----
    ctx.save();
    ctx.setLineDash([
        Math.max(2, cs * 0.2),
        Math.max(3, cs * 0.3)
    ]);
    ctx.lineWidth = Math.max(1, cs * 0.12);
    for (const unit of units){
        if (!unit.target) continue;
        const [sr, sc] = unit.position;
        const [tr, tc] = unit.target;
        ctx.strokeStyle = unit.unit_type === 'helicopter' ? 'rgba(79,195,247,0.45)' : unit.unit_type === 'ground_crew' ? 'rgba(100,200,100,0.45)' : 'rgba(255,179,71,0.35)';
        ctx.beginPath();
        ctx.moveTo((sc + 0.5) * cs, (sr + 0.5) * cs);
        ctx.lineTo((tc + 0.5) * cs, (tr + 0.5) * cs);
        ctx.stroke();
    }
    ctx.restore();
    // ---- PASS 6: Units ----
    for (const unit of units){
        drawUnit(ctx, unit, cs, time);
    }
}
/* ------------------------------------------------------------------ */ /* Unit drawing                                                         */ /* ------------------------------------------------------------------ */ function drawUnit(ctx, unit, cs, time) {
    const [row, col] = unit.position;
    const cx = (col + 0.5) * cs;
    const cy = (row + 0.5) * cs;
    const r = Math.max(cs * 1.5, 8);
    ctx.save();
    if (unit.unit_type === 'orchestrator') {
        // Watchtower — amber pulsing diamond
        const pulse = 0.92 + Math.sin(time / 800) * 0.08;
        const rp = r * pulse;
        ctx.shadowColor = '#ffb347';
        ctx.shadowBlur = 10 + Math.sin(time / 600) * 4;
        ctx.fillStyle = '#c87820';
        ctx.beginPath();
        ctx.moveTo(cx, cy - rp);
        ctx.lineTo(cx + rp * 0.65, cy);
        ctx.lineTo(cx, cy + rp);
        ctx.lineTo(cx - rp * 0.65, cy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Inner dot
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffdd88';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
    } else if (unit.unit_type === 'helicopter') {
        // Helicopter — blue circle, H label
        ctx.shadowColor = '#4fc3f7';
        ctx.shadowBlur = 8;
        const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
        grad.addColorStop(0, '#2a8ab8');
        grad.addColorStop(1, '#0d4060');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#d0f0ff';
        ctx.font = `bold ${Math.max(r * 0.95, 8)}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', cx, cy + 0.5);
    } else {
        // Ground crew — green circle, G label
        ctx.shadowColor = '#4caf50';
        ctx.shadowBlur = 8;
        const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
        grad.addColorStop(0, '#2a7a30');
        grad.addColorStop(1, '#0d3a10');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#c0f0c0';
        ctx.font = `bold ${Math.max(r * 0.95, 8)}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('G', cx, cy + 0.5);
    }
    // Label below (only if cells large enough)
    if (cs >= 12) {
        ctx.shadowBlur = 0;
        const label = unit.label.toUpperCase();
        ctx.font = `${Math.max(cs * 0.52, 7)}px 'Courier New', monospace`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(5,10,5,0.8)';
        ctx.fillRect(cx - tw / 2 - 3, cy + r + 2, tw + 6, cs * 0.6);
        ctx.fillStyle = '#a0c890';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, cx, cy + r + 3);
    }
    ctx.restore();
}
/* ------------------------------------------------------------------ */ /* Color helpers                                                        */ /* ------------------------------------------------------------------ */ function k(r, c) {
    return `${r},${c}`;
}
function hash(r, c) {
    return r * 2531011 + c * 214013 >>> 0 & 0xffff;
}
function forestFloor(row, col) {
    const h = hash(row, col);
    const g = 28 + (h & 15) - 7;
    const b = 14 + (h >> 4 & 7) - 3;
    return `rgb(${10 + (h & 5)}, ${g}, ${b})`;
}
function fireBaseColor(row, col, time) {
    const h = hash(row, col);
    const t = time / 90;
    const phase = ((h & 0xff) + t) % 256;
    const flicker = Math.sin(phase * 0.08) * 0.5 + 0.5;
    const r = Math.floor(190 + flicker * 65);
    const g = Math.floor(15 + flicker * 75);
    return `rgb(${r}, ${g}, 0)`;
}
function burnedColor(row, col) {
    const h = hash(row, col) & 0x1f;
    return `rgb(${12 + h}, ${6 + (h >> 1)}, ${4 + (h >> 2)})`;
}
function suppressedColor(row, col) {
    const h = hash(row, col) & 0x1f;
    return `rgb(${10 + (h >> 2)}, ${28 + h}, ${20 + (h >> 1)})`;
}
function firebreakColor(row, col) {
    const h = hash(row, col) & 0x1f;
    return `rgb(${38 + h}, ${22 + (h >> 1)}, ${8 + (h >> 2)})`;
}
var _c;
__turbopack_context__.k.register(_c, "GameMap");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/RadioPanel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>RadioPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
const VOICE_CONFIG = {
    command: {
        color: '#ffb347',
        dimColor: '#5a4020',
        tag: 'CMD',
        label: 'Command'
    },
    helicopter: {
        color: '#4fc3f7',
        dimColor: '#1a4060',
        tag: 'HLI',
        label: 'Helicopter'
    },
    ground_crew: {
        color: '#4caf50',
        dimColor: '#1a4020',
        tag: 'GND',
        label: 'Ground'
    }
};
function voiceConfig(key) {
    return VOICE_CONFIG[key] ?? {
        color: '#8a9080',
        dimColor: '#2a3025',
        tag: '???',
        label: key
    };
}
const WAVEFORM_HEIGHTS = [
    3,
    8,
    5,
    12,
    4,
    10,
    7,
    3,
    11,
    6,
    4,
    9,
    5,
    13,
    4,
    7,
    3,
    10,
    6,
    4
];
const WAVEFORM_ANIMS = [
    'wave-a',
    'wave-b',
    'wave-c',
    'wave-d',
    'wave-b',
    'wave-a',
    'wave-c',
    'wave-d',
    'wave-a',
    'wave-c',
    'wave-b',
    'wave-d',
    'wave-a',
    'wave-b',
    'wave-c',
    'wave-a',
    'wave-d',
    'wave-b',
    'wave-c',
    'wave-a'
];
function RadioPanel({ messages }) {
    _s();
    const bottomRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [waveActive, setWaveActive] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const waveTimerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Activate waveform on new message, deactivate after 3s
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RadioPanel.useEffect": ()=>{
            if (messages.length === 0) return;
            setWaveActive(true);
            if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
            waveTimerRef.current = setTimeout({
                "RadioPanel.useEffect": ()=>setWaveActive(false)
            }["RadioPanel.useEffect"], 3000);
        }
    }["RadioPanel.useEffect"], [
        messages.length
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RadioPanel.useEffect": ()=>{
            bottomRef.current?.scrollIntoView({
                behavior: 'smooth'
            });
        }
    }["RadioPanel.useEffect"], [
        messages
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col shrink-0",
        style: {
            width: '290px',
            background: '#050d06',
            borderLeft: '1px solid #162016',
            fontFamily: 'Courier New, monospace'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2.5 shrink-0 flex items-center justify-between",
                style: {
                    borderBottom: '1px solid #162016',
                    background: '#040b05'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2.5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Waveform, {
                                active: waveActive
                            }, void 0, false, {
                                fileName: "[project]/components/RadioPanel.tsx",
                                lineNumber: 56,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs font-bold tracking-widest",
                                style: {
                                    color: '#4a6040',
                                    letterSpacing: '0.2em'
                                },
                                children: "RADIO"
                            }, void 0, false, {
                                fileName: "[project]/components/RadioPanel.tsx",
                                lineNumber: 57,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/RadioPanel.tsx",
                        lineNumber: 55,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-1.5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "inline-block w-1 h-1 rounded-full",
                                style: {
                                    background: waveActive ? '#ff4500' : '#2a2a20',
                                    boxShadow: waveActive ? '0 0 4px #ff4500' : 'none',
                                    transition: 'all 0.3s'
                                }
                            }, void 0, false, {
                                fileName: "[project]/components/RadioPanel.tsx",
                                lineNumber: 62,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs",
                                style: {
                                    color: '#2a3a20',
                                    fontSize: '10px'
                                },
                                children: waveActive ? 'LIVE' : 'STANDBY'
                            }, void 0, false, {
                                fileName: "[project]/components/RadioPanel.tsx",
                                lineNumber: 70,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/RadioPanel.tsx",
                        lineNumber: 61,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/RadioPanel.tsx",
                lineNumber: 51,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 overflow-y-auto px-2 py-2 space-y-2",
                children: [
                    messages.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col items-center justify-center h-24 gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-xs tracking-widest",
                                style: {
                                    color: '#1e2e1a',
                                    letterSpacing: '0.2em',
                                    fontSize: '10px'
                                },
                                children: "STANDING BY"
                            }, void 0, false, {
                                fileName: "[project]/components/RadioPanel.tsx",
                                lineNumber: 80,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex gap-1",
                                children: [
                                    0.4,
                                    0.7,
                                    1.0
                                ].map((o, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            width: '2px',
                                            height: '8px',
                                            background: `rgba(50,80,40,${o})`
                                        }
                                    }, i, false, {
                                        fileName: "[project]/components/RadioPanel.tsx",
                                        lineNumber: 85,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/components/RadioPanel.tsx",
                                lineNumber: 83,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/RadioPanel.tsx",
                        lineNumber: 79,
                        columnNumber: 11
                    }, this) : messages.map((msg, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RadioEntry, {
                            msg: msg
                        }, msg.message_id ?? i, false, {
                            fileName: "[project]/components/RadioPanel.tsx",
                            lineNumber: 91,
                            columnNumber: 13
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        ref: bottomRef
                    }, void 0, false, {
                        fileName: "[project]/components/RadioPanel.tsx",
                        lineNumber: 94,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/RadioPanel.tsx",
                lineNumber: 77,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2 shrink-0 flex items-center justify-between",
                style: {
                    borderTop: '1px solid #0e1a0e'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs",
                        style: {
                            color: '#1e2e1a',
                            fontSize: '10px'
                        },
                        children: [
                            messages.length,
                            " transmissions"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/RadioPanel.tsx",
                        lineNumber: 102,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-0.5",
                        children: [
                            1,
                            2,
                            3,
                            4,
                            5
                        ].map((i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    width: '3px',
                                    height: `${i * 2 + 2}px`,
                                    background: i <= Math.min(Math.ceil(messages.length / 5), 5) ? '#2a4a28' : '#141e12'
                                }
                            }, i, false, {
                                fileName: "[project]/components/RadioPanel.tsx",
                                lineNumber: 107,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/components/RadioPanel.tsx",
                        lineNumber: 105,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/RadioPanel.tsx",
                lineNumber: 98,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/RadioPanel.tsx",
        lineNumber: 41,
        columnNumber: 5
    }, this);
}
_s(RadioPanel, "OrnasZv4bMhiJw80ajWJVTJImsA=");
_c = RadioPanel;
/* ------------------------------------------------------------------ */ /* Individual message entry                                             */ /* ------------------------------------------------------------------ */ function RadioEntry({ msg }) {
    const cfg = voiceConfig(msg.voice_key);
    const time = new Date(msg.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "animate-fade-in rounded-sm overflow-hidden",
        style: {
            border: `1px solid ${cfg.dimColor}`,
            background: `${cfg.dimColor}30`
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between px-2 py-1",
                style: {
                    borderBottom: `1px solid ${cfg.dimColor}`,
                    background: `${cfg.dimColor}50`
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-1.5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs font-bold",
                                style: {
                                    color: cfg.color,
                                    fontSize: '9px',
                                    letterSpacing: '0.1em',
                                    padding: '1px 4px',
                                    border: `1px solid ${cfg.color}50`,
                                    background: `${cfg.color}15`
                                },
                                children: cfg.tag
                            }, void 0, false, {
                                fileName: "[project]/components/RadioPanel.tsx",
                                lineNumber: 143,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs font-bold",
                                style: {
                                    color: cfg.color,
                                    fontSize: '11px'
                                },
                                children: msg.speaker
                            }, void 0, false, {
                                fileName: "[project]/components/RadioPanel.tsx",
                                lineNumber: 156,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/RadioPanel.tsx",
                        lineNumber: 142,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        style: {
                            color: cfg.dimColor,
                            fontSize: '9px'
                        },
                        children: time
                    }, void 0, false, {
                        fileName: "[project]/components/RadioPanel.tsx",
                        lineNumber: 160,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/RadioPanel.tsx",
                lineNumber: 138,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "px-2 py-1.5 text-xs leading-relaxed",
                style: {
                    color: '#b0c8a0',
                    fontSize: '11px',
                    lineHeight: '1.6'
                },
                children: msg.text
            }, void 0, false, {
                fileName: "[project]/components/RadioPanel.tsx",
                lineNumber: 164,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/RadioPanel.tsx",
        lineNumber: 133,
        columnNumber: 5
    }, this);
}
_c1 = RadioEntry;
/* ------------------------------------------------------------------ */ /* Animated waveform                                                    */ /* ------------------------------------------------------------------ */ function Waveform({ active }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-px",
        style: {
            height: '20px'
        },
        children: WAVEFORM_HEIGHTS.map((h, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    width: '2px',
                    height: active ? `${h}px` : '2px',
                    background: active ? `rgba(74, 180, 74, ${0.4 + i % 4 * 0.15})` : '#1a2a18',
                    animation: active ? `${WAVEFORM_ANIMS[i]} ${0.6 + i % 4 * 0.15}s ease-in-out infinite alternate ${i * 0.03}s` : 'none',
                    transition: 'height 0.3s, background 0.3s'
                }
            }, i, false, {
                fileName: "[project]/components/RadioPanel.tsx",
                lineNumber: 182,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/components/RadioPanel.tsx",
        lineNumber: 180,
        columnNumber: 5
    }, this);
}
_c2 = Waveform;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "RadioPanel");
__turbopack_context__.k.register(_c1, "RadioEntry");
__turbopack_context__.k.register(_c2, "Waveform");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/Leaderboard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Leaderboard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
const OUTCOME_COLOR = {
    won: '#ffb347',
    lost: '#ff4500',
    terminated: '#888'
};
function Leaderboard({ onClose }) {
    _s();
    const [entries, setEntries] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Leaderboard.useEffect": ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getLeaderboard"])().then(setEntries).catch({
                "Leaderboard.useEffect": (err)=>setError(err instanceof Error ? err.message : 'Failed to load.')
            }["Leaderboard.useEffect"]).finally({
                "Leaderboard.useEffect": ()=>setLoading(false)
            }["Leaderboard.useEffect"]);
        }
    }["Leaderboard.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "absolute inset-0 flex items-center justify-center z-50",
        style: {
            background: 'rgba(5, 10, 6, 0.88)',
            backdropFilter: 'blur(4px)'
        },
        onClick: onClose,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "border p-6 max-w-2xl w-full mx-4 animate-fade-in max-h-[80vh] flex flex-col",
            style: {
                borderColor: '#3a5030',
                background: '#0a1208',
                fontFamily: 'Courier New, monospace',
                boxShadow: '0 0 40px rgba(255,179,71,0.1)'
            },
            onClick: (e)=>e.stopPropagation(),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between mb-4 shrink-0",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-lg font-bold tracking-widest",
                            style: {
                                color: '#ffb347'
                            },
                            children: "LEADERBOARD"
                        }, void 0, false, {
                            fileName: "[project]/components/Leaderboard.tsx",
                            lineNumber: 47,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onClose,
                            className: "text-xs opacity-50 hover:opacity-80 transition-opacity",
                            style: {
                                color: '#e8d5b0'
                            },
                            children: "[CLOSE]"
                        }, void 0, false, {
                            fileName: "[project]/components/Leaderboard.tsx",
                            lineNumber: 50,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/Leaderboard.tsx",
                    lineNumber: 46,
                    columnNumber: 9
                }, this),
                !loading && !error && entries.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid text-xs mb-2 pb-2 border-b shrink-0",
                    style: {
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                        borderColor: '#2a3020',
                        color: '#6a8060',
                        letterSpacing: '0.1em'
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: "DOCTRINE"
                        }, void 0, false, {
                            fileName: "[project]/components/Leaderboard.tsx",
                            lineNumber: 70,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-center",
                            children: "OUTCOME"
                        }, void 0, false, {
                            fileName: "[project]/components/Leaderboard.tsx",
                            lineNumber: 71,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-center",
                            children: "TIME"
                        }, void 0, false, {
                            fileName: "[project]/components/Leaderboard.tsx",
                            lineNumber: 72,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-center",
                            children: "BURNED"
                        }, void 0, false, {
                            fileName: "[project]/components/Leaderboard.tsx",
                            lineNumber: 73,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-center",
                            children: "SUPPRESSED"
                        }, void 0, false, {
                            fileName: "[project]/components/Leaderboard.tsx",
                            lineNumber: 74,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/Leaderboard.tsx",
                    lineNumber: 61,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "overflow-y-auto flex-1",
                    children: [
                        loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-xs text-center py-8 opacity-40",
                            style: {
                                color: '#a0b890'
                            },
                            children: "Loading..."
                        }, void 0, false, {
                            fileName: "[project]/components/Leaderboard.tsx",
                            lineNumber: 81,
                            columnNumber: 13
                        }, this),
                        error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-xs text-center py-8",
                            style: {
                                color: '#ff4500'
                            },
                            children: error
                        }, void 0, false, {
                            fileName: "[project]/components/Leaderboard.tsx",
                            lineNumber: 86,
                            columnNumber: 13
                        }, this),
                        !loading && !error && entries.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-xs text-center py-8 opacity-40",
                            style: {
                                color: '#a0b890'
                            },
                            children: "No entries yet. Be the first."
                        }, void 0, false, {
                            fileName: "[project]/components/Leaderboard.tsx",
                            lineNumber: 91,
                            columnNumber: 13
                        }, this),
                        !loading && !error && entries.map((entry, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LeaderboardRow, {
                                entry: entry,
                                rank: i + 1
                            }, entry.session_id, false, {
                                fileName: "[project]/components/Leaderboard.tsx",
                                lineNumber: 98,
                                columnNumber: 15
                            }, this))
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/Leaderboard.tsx",
                    lineNumber: 79,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/Leaderboard.tsx",
            lineNumber: 35,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/Leaderboard.tsx",
        lineNumber: 30,
        columnNumber: 5
    }, this);
}
_s(Leaderboard, "VXxnBTQjStzwAeJpYl63scOGlic=");
_c = Leaderboard;
function LeaderboardRow({ entry, rank }) {
    const outcomeColor = OUTCOME_COLOR[entry.outcome] ?? '#888';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid text-xs py-2 border-b items-start",
        style: {
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            borderColor: '#1a2018',
            color: '#a0b890'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "opacity-40 mr-2",
                        children: [
                            "#",
                            rank
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/Leaderboard.tsx",
                        lineNumber: 118,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        style: {
                            color: '#e8d5b0'
                        },
                        children: entry.doctrine_title
                    }, void 0, false, {
                        fileName: "[project]/components/Leaderboard.tsx",
                        lineNumber: 119,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "opacity-40 mt-0.5 text-xs leading-relaxed",
                        style: {
                            fontSize: '10px'
                        },
                        children: entry.doctrine_snippet
                    }, void 0, false, {
                        fileName: "[project]/components/Leaderboard.tsx",
                        lineNumber: 120,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/Leaderboard.tsx",
                lineNumber: 117,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-center font-bold",
                style: {
                    color: outcomeColor
                },
                children: entry.outcome.toUpperCase()
            }, void 0, false, {
                fileName: "[project]/components/Leaderboard.tsx",
                lineNumber: 124,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-center",
                children: [
                    entry.time_elapsed_seconds,
                    "s"
                ]
            }, void 0, true, {
                fileName: "[project]/components/Leaderboard.tsx",
                lineNumber: 127,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-center",
                children: entry.burned_cells
            }, void 0, false, {
                fileName: "[project]/components/Leaderboard.tsx",
                lineNumber: 128,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-center",
                children: entry.suppressed_cells
            }, void 0, false, {
                fileName: "[project]/components/Leaderboard.tsx",
                lineNumber: 129,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/Leaderboard.tsx",
        lineNumber: 109,
        columnNumber: 5
    }, this);
}
_c1 = LeaderboardRow;
var _c, _c1;
__turbopack_context__.k.register(_c, "Leaderboard");
__turbopack_context__.k.register(_c1, "LeaderboardRow");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/play/[id]/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PlayPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$GameMap$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/GameMap.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$RadioPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/RadioPanel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$Leaderboard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/Leaderboard.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
function PlayPage() {
    _s();
    const params = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"])();
    const id = params.id;
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [snapshot, setSnapshot] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [radioLog, setRadioLog] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [connected, setConnected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [wsError, setWsError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [showLeaderboard, setShowLeaderboard] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PlayPage.useEffect": ()=>{
            if (!id) return;
            const ws = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createWebSocket"])(id);
            ws.onopen = ({
                "PlayPage.useEffect": ()=>{
                    setConnected(true);
                    setWsError(null);
                }
            })["PlayPage.useEffect"];
            ws.onmessage = ({
                "PlayPage.useEffect": (e)=>{
                    try {
                        const envelope = JSON.parse(e.data);
                        if (envelope.kind === 'snapshot' && envelope.snapshot) {
                            setSnapshot(envelope.snapshot);
                        } else if (envelope.kind === 'event' && envelope.event?.type === 'radio.message') {
                            const msg = envelope.event.payload;
                            setRadioLog({
                                "PlayPage.useEffect": (prev)=>[
                                        ...prev.slice(-99),
                                        msg
                                    ]
                            }["PlayPage.useEffect"]);
                        }
                    } catch  {}
                }
            })["PlayPage.useEffect"];
            ws.onerror = ({
                "PlayPage.useEffect": ()=>{
                    setWsError('Connection lost. The session may have ended.');
                    setConnected(false);
                }
            })["PlayPage.useEffect"];
            ws.onclose = ({
                "PlayPage.useEffect": ()=>setConnected(false)
            })["PlayPage.useEffect"];
            return ({
                "PlayPage.useEffect": ()=>ws.close()
            })["PlayPage.useEffect"];
        }
    }["PlayPage.useEffect"], [
        id
    ]);
    const status = snapshot?.status;
    const isTerminal = status === 'won' || status === 'lost' || status === 'terminated';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-screen flex flex-col overflow-hidden",
        style: {
            background: '#080e08'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatusBar, {
                snapshot: snapshot,
                connected: connected,
                onLeaderboard: ()=>setShowLeaderboard(true)
            }, void 0, false, {
                fileName: "[project]/app/play/[id]/page.tsx",
                lineNumber: 47,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-1 overflow-hidden",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1 flex items-center justify-center relative overflow-hidden",
                        style: {
                            background: 'radial-gradient(ellipse at center, #0d1a0e 0%, #060e07 100%)'
                        },
                        children: snapshot ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$GameMap$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            snapshot: snapshot
                        }, void 0, false, {
                            fileName: "[project]/app/play/[id]/page.tsx",
                            lineNumber: 56,
                            columnNumber: 13
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WaitingScreen, {
                            error: wsError
                        }, void 0, false, {
                            fileName: "[project]/app/play/[id]/page.tsx",
                            lineNumber: 58,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/play/[id]/page.tsx",
                        lineNumber: 51,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$RadioPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        messages: radioLog
                    }, void 0, false, {
                        fileName: "[project]/app/play/[id]/page.tsx",
                        lineNumber: 62,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/play/[id]/page.tsx",
                lineNumber: 49,
                columnNumber: 7
            }, this),
            isTerminal && snapshot && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EndOverlay, {
                snapshot: snapshot,
                onReplay: ()=>router.push('/'),
                onLeaderboard: ()=>setShowLeaderboard(true)
            }, void 0, false, {
                fileName: "[project]/app/play/[id]/page.tsx",
                lineNumber: 66,
                columnNumber: 9
            }, this),
            showLeaderboard && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$Leaderboard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                onClose: ()=>setShowLeaderboard(false)
            }, void 0, false, {
                fileName: "[project]/app/play/[id]/page.tsx",
                lineNumber: 73,
                columnNumber: 27
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/play/[id]/page.tsx",
        lineNumber: 46,
        columnNumber: 5
    }, this);
}
_s(PlayPage, "rGRvORTd27YTaDE44RWqgof+Bls=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = PlayPage;
/* ------------------------------------------------------------------ */ /* Status Bar                                                           */ /* ------------------------------------------------------------------ */ function StatusBar({ snapshot, connected, onLeaderboard }) {
    const status = snapshot?.status ?? 'pending';
    const statusMeta = {
        pending: {
            color: '#6a8060',
            label: 'PENDING'
        },
        running: {
            color: '#4caf50',
            label: 'RUNNING'
        },
        won: {
            color: '#ffb347',
            label: 'CONTAINED'
        },
        lost: {
            color: '#ff4500',
            label: 'LOST'
        },
        terminated: {
            color: '#888',
            label: 'TERMINATED'
        }
    };
    const { color, label } = statusMeta[status] ?? statusMeta.pending;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center justify-between px-4 shrink-0",
        style: {
            height: '42px',
            background: '#050a05',
            borderBottom: '1px solid #162016',
            fontFamily: 'Courier New, monospace'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-bold tracking-widest text-xs",
                        style: {
                            color: '#ffb347',
                            letterSpacing: '0.25em'
                        },
                        children: "WATCHTOWER"
                    }, void 0, false, {
                        fileName: "[project]/app/play/[id]/page.tsx",
                        lineNumber: 113,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-1.5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "inline-block w-1.5 h-1.5 rounded-full",
                                style: {
                                    background: color,
                                    boxShadow: `0 0 6px ${color}`
                                }
                            }, void 0, false, {
                                fileName: "[project]/app/play/[id]/page.tsx",
                                lineNumber: 118,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs tracking-wider",
                                style: {
                                    color
                                },
                                children: label
                            }, void 0, false, {
                                fileName: "[project]/app/play/[id]/page.tsx",
                                lineNumber: 122,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/play/[id]/page.tsx",
                        lineNumber: 117,
                        columnNumber: 9
                    }, this),
                    snapshot && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs",
                                style: {
                                    color: '#3a5030'
                                },
                                children: "|"
                            }, void 0, false, {
                                fileName: "[project]/app/play/[id]/page.tsx",
                                lineNumber: 129,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs",
                                style: {
                                    color: '#4a6040'
                                },
                                children: [
                                    "TICK ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        style: {
                                            color: '#7a9060'
                                        },
                                        children: snapshot.tick
                                    }, void 0, false, {
                                        fileName: "[project]/app/play/[id]/page.tsx",
                                        lineNumber: 131,
                                        columnNumber: 20
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/play/[id]/page.tsx",
                                lineNumber: 130,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs",
                                style: {
                                    color: '#3a5030'
                                },
                                children: "|"
                            }, void 0, false, {
                                fileName: "[project]/app/play/[id]/page.tsx",
                                lineNumber: 133,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs",
                                style: {
                                    color: '#4a6040'
                                },
                                children: [
                                    "WIND ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        style: {
                                            color: '#7a9060'
                                        },
                                        children: [
                                            snapshot.wind.speed_mph.toFixed(0),
                                            " mph ",
                                            snapshot.wind.direction
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/play/[id]/page.tsx",
                                        lineNumber: 136,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/play/[id]/page.tsx",
                                lineNumber: 134,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs",
                                style: {
                                    color: '#3a5030'
                                },
                                children: "|"
                            }, void 0, false, {
                                fileName: "[project]/app/play/[id]/page.tsx",
                                lineNumber: 140,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs",
                                style: {
                                    color: '#4a6040'
                                },
                                children: [
                                    "FIRE ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        style: {
                                            color: snapshot.fire_cells.length > 0 ? '#ff6030' : '#4caf50'
                                        },
                                        children: [
                                            snapshot.fire_cells.length,
                                            " cells"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/play/[id]/page.tsx",
                                        lineNumber: 143,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/play/[id]/page.tsx",
                                lineNumber: 141,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true)
                ]
            }, void 0, true, {
                fileName: "[project]/app/play/[id]/page.tsx",
                lineNumber: 112,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-4",
                children: [
                    snapshot && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs max-w-[180px] truncate",
                        style: {
                            color: '#4a6040'
                        },
                        children: snapshot.doctrine.title
                    }, void 0, false, {
                        fileName: "[project]/app/play/[id]/page.tsx",
                        lineNumber: 154,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: onLeaderboard,
                        className: "text-xs tracking-widest transition-all duration-150 hover:opacity-80",
                        style: {
                            color: '#7a6030',
                            letterSpacing: '0.1em',
                            fontFamily: 'Courier New, monospace'
                        },
                        children: "[SCORES]"
                    }, void 0, false, {
                        fileName: "[project]/app/play/[id]/page.tsx",
                        lineNumber: 158,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-1.5",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "inline-block w-1.5 h-1.5 rounded-full",
                            style: {
                                background: connected ? '#4caf50' : '#3a3030',
                                boxShadow: connected ? '0 0 5px #4caf50' : 'none',
                                transition: 'all 0.3s'
                            }
                        }, void 0, false, {
                            fileName: "[project]/app/play/[id]/page.tsx",
                            lineNumber: 167,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/play/[id]/page.tsx",
                        lineNumber: 166,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/play/[id]/page.tsx",
                lineNumber: 152,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/play/[id]/page.tsx",
        lineNumber: 102,
        columnNumber: 5
    }, this);
}
_c1 = StatusBar;
/* ------------------------------------------------------------------ */ /* Waiting screen                                                       */ /* ------------------------------------------------------------------ */ function WaitingScreen({ error }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col items-center justify-center gap-3",
        style: {
            fontFamily: 'Courier New, monospace'
        },
        children: error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
            className: "text-xs animate-fade-in",
            style: {
                color: '#ff4500'
            },
            children: error
        }, void 0, false, {
            fileName: "[project]/app/play/[id]/page.tsx",
            lineNumber: 192,
            columnNumber: 9
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex gap-1",
                    children: [
                        0,
                        1,
                        2
                    ].map((i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "inline-block w-1.5 h-1.5 rounded-full animate-blink",
                            style: {
                                background: '#4caf50',
                                animationDelay: `${i * 0.3}s`
                            }
                        }, i, false, {
                            fileName: "[project]/app/play/[id]/page.tsx",
                            lineNumber: 197,
                            columnNumber: 15
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/app/play/[id]/page.tsx",
                    lineNumber: 195,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-xs tracking-widest",
                    style: {
                        color: '#3a5030',
                        letterSpacing: '0.2em'
                    },
                    children: "CONNECTING"
                }, void 0, false, {
                    fileName: "[project]/app/play/[id]/page.tsx",
                    lineNumber: 204,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true)
    }, void 0, false, {
        fileName: "[project]/app/play/[id]/page.tsx",
        lineNumber: 187,
        columnNumber: 5
    }, this);
}
_c2 = WaitingScreen;
/* ------------------------------------------------------------------ */ /* End Overlay                                                          */ /* ------------------------------------------------------------------ */ function EndOverlay({ snapshot, onReplay, onLeaderboard }) {
    const won = snapshot.status === 'won';
    const accentColor = won ? '#ffb347' : '#ff4500';
    const bgGlow = won ? 'rgba(255,179,71,0.12)' : 'rgba(255,69,0,0.12)';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "absolute inset-0 flex items-center justify-center z-50",
        style: {
            background: 'rgba(3, 6, 3, 0.92)',
            backdropFilter: 'blur(6px)'
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "w-full max-w-sm mx-4 animate-fade-in",
            style: {
                border: `1px solid ${accentColor}40`,
                background: '#070d07',
                boxShadow: `0 0 60px ${bgGlow}, 0 0 120px ${bgGlow}`,
                fontFamily: 'Courier New, monospace'
            },
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "px-6 py-4",
                    style: {
                        borderBottom: `1px solid ${accentColor}25`,
                        background: `${accentColor}08`
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-xs tracking-widest mb-1",
                            style: {
                                color: `${accentColor}80`
                            },
                            children: won ? 'MISSION COMPLETE' : 'MISSION FAILED'
                        }, void 0, false, {
                            fileName: "[project]/app/play/[id]/page.tsx",
                            lineNumber: 249,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-xl font-bold tracking-widest",
                            style: {
                                color: accentColor,
                                letterSpacing: '0.2em'
                            },
                            children: won ? 'FIRE CONTAINED' : 'VILLAGE LOST'
                        }, void 0, false, {
                            fileName: "[project]/app/play/[id]/page.tsx",
                            lineNumber: 252,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/play/[id]/page.tsx",
                    lineNumber: 245,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "px-6 py-4",
                    style: {
                        borderBottom: `1px solid #162016`
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs leading-relaxed",
                        style: {
                            color: '#4a6040',
                            fontStyle: 'italic'
                        },
                        children: won ? '"All units, stand down. Village is secure. Fire contained. Good work."' : '"It\'s at the perimeter — we can\'t hold it. All units fall back."'
                    }, void 0, false, {
                        fileName: "[project]/app/play/[id]/page.tsx",
                        lineNumber: 262,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/play/[id]/page.tsx",
                    lineNumber: 261,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "px-6 py-4",
                    style: {
                        borderBottom: `1px solid #162016`
                    },
                    children: [
                        [
                            'TIME ELAPSED',
                            `${snapshot.score.time_elapsed_seconds}s`
                        ],
                        [
                            'CELLS BURNED',
                            String(snapshot.score.burned_cells)
                        ],
                        [
                            'SUPPRESSED',
                            String(snapshot.score.suppressed_cells)
                        ],
                        [
                            'FIREBREAKS',
                            String(snapshot.score.firebreak_cells)
                        ],
                        [
                            'VILLAGE DAMAGE',
                            `${snapshot.score.village_damage} cells`
                        ]
                    ].map(([k, v])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex justify-between items-center py-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xs",
                                    style: {
                                        color: '#3a5030'
                                    },
                                    children: k
                                }, void 0, false, {
                                    fileName: "[project]/app/play/[id]/page.tsx",
                                    lineNumber: 279,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xs font-bold",
                                    style: {
                                        color: k === 'VILLAGE DAMAGE' ? snapshot.score.village_damage > 0 ? '#ff4500' : '#4caf50' : '#8aaa70'
                                    },
                                    children: v
                                }, void 0, false, {
                                    fileName: "[project]/app/play/[id]/page.tsx",
                                    lineNumber: 280,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, k, true, {
                            fileName: "[project]/app/play/[id]/page.tsx",
                            lineNumber: 278,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/app/play/[id]/page.tsx",
                    lineNumber: 270,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EndButton, {
                            onClick: onReplay,
                            color: "#4a6040",
                            children: "REDEPLOY"
                        }, void 0, false, {
                            fileName: "[project]/app/play/[id]/page.tsx",
                            lineNumber: 296,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EndButton, {
                            onClick: onLeaderboard,
                            color: accentColor,
                            primary: true,
                            children: "LEADERBOARD"
                        }, void 0, false, {
                            fileName: "[project]/app/play/[id]/page.tsx",
                            lineNumber: 299,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/play/[id]/page.tsx",
                    lineNumber: 295,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/play/[id]/page.tsx",
            lineNumber: 235,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/play/[id]/page.tsx",
        lineNumber: 231,
        columnNumber: 5
    }, this);
}
_c3 = EndOverlay;
function EndButton({ onClick, children, color, primary }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        onClick: onClick,
        className: "flex-1 py-3 text-xs tracking-widest transition-all duration-200",
        style: {
            borderTop: `1px solid ${color}30`,
            borderRight: primary ? 'none' : `1px solid ${color}20`,
            color,
            background: 'transparent',
            fontFamily: 'Courier New, monospace',
            letterSpacing: '0.15em'
        },
        onMouseEnter: (e)=>e.currentTarget.style.background = `${color}10`,
        onMouseLeave: (e)=>e.currentTarget.style.background = 'transparent',
        children: [
            "[ ",
            children,
            " ]"
        ]
    }, void 0, true, {
        fileName: "[project]/app/play/[id]/page.tsx",
        lineNumber: 320,
        columnNumber: 5
    }, this);
}
_c4 = EndButton;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "PlayPage");
__turbopack_context__.k.register(_c1, "StatusBar");
__turbopack_context__.k.register(_c2, "WaitingScreen");
__turbopack_context__.k.register(_c3, "EndOverlay");
__turbopack_context__.k.register(_c4, "EndButton");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
/**
 * @license React
 * react-jsx-dev-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ "use strict";
"production" !== ("TURBOPACK compile-time value", "development") && function() {
    function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch(type){
            case REACT_FRAGMENT_TYPE:
                return "Fragment";
            case REACT_PROFILER_TYPE:
                return "Profiler";
            case REACT_STRICT_MODE_TYPE:
                return "StrictMode";
            case REACT_SUSPENSE_TYPE:
                return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
            case REACT_ACTIVITY_TYPE:
                return "Activity";
            case REACT_VIEW_TRANSITION_TYPE:
                return "ViewTransition";
        }
        if ("object" === typeof type) switch("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof){
            case REACT_PORTAL_TYPE:
                return "Portal";
            case REACT_CONTEXT_TYPE:
                return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
                return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
                var innerType = type.render;
                type = type.displayName;
                type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                return type;
            case REACT_MEMO_TYPE:
                return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
                innerType = type._payload;
                type = type._init;
                try {
                    return getComponentNameFromType(type(innerType));
                } catch (x) {}
        }
        return null;
    }
    function testStringCoercion(value) {
        return "" + value;
    }
    function checkKeyStringCoercion(value) {
        try {
            testStringCoercion(value);
            var JSCompiler_inline_result = !1;
        } catch (e) {
            JSCompiler_inline_result = !0;
        }
        if (JSCompiler_inline_result) {
            JSCompiler_inline_result = console;
            var JSCompiler_temp_const = JSCompiler_inline_result.error;
            var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
            return testStringCoercion(value);
        }
    }
    function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
        try {
            var name = getComponentNameFromType(type);
            return name ? "<" + name + ">" : "<...>";
        } catch (x) {
            return "<...>";
        }
    }
    function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
        return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
            var getter = Object.getOwnPropertyDescriptor(config, "key").get;
            if (getter && getter.isReactWarning) return !1;
        }
        return void 0 !== config.key;
    }
    function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
            specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
        }
        warnAboutAccessingKey.isReactWarning = !0;
        Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: !0
        });
    }
    function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
            $$typeof: REACT_ELEMENT_TYPE,
            type: type,
            key: key,
            props: props,
            _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
            enumerable: !1,
            get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", {
            enumerable: !1,
            value: null
        });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: null
        });
        Object.defineProperty(type, "_debugStack", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
    }
    function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
        var children = config.children;
        if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
            for(isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)validateChildKeys(children[isStaticChildren]);
            Object.freeze && Object.freeze(children);
        } else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
        else validateChildKeys(children);
        if (hasOwnProperty.call(config, "key")) {
            children = getComponentNameFromType(type);
            var keys = Object.keys(config).filter(function(k) {
                return "key" !== k;
            });
            isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
            didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error('A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />', isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
        }
        children = null;
        void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
        hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
        if ("key" in config) {
            maybeKey = {};
            for(var propName in config)"key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
        return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
    }
    function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    var React = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
        return null;
    };
    React = {
        react_stack_bottom_frame: function(callStackForError) {
            return callStackForError();
        }
    };
    var specialPropKeyWarningShown;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutKeySpread = {};
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsxDEV = function(type, config, maybeKey, isStaticChildren) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        if (trackActualOwner) {
            var previousStackTraceLimit = Error.stackTraceLimit;
            Error.stackTraceLimit = 10;
            var debugStackDEV = Error("react-stack-top-frame");
            Error.stackTraceLimit = previousStackTraceLimit;
        } else debugStackDEV = unknownOwnerDebugStack;
        return jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStackDEV, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
}();
}),
"[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
else {
    module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)");
}
}),
"[project]/node_modules/next/navigation.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/client/components/navigation.js [app-client] (ecmascript)");
}),
]);

//# sourceMappingURL=_0k0w64j._.js.map