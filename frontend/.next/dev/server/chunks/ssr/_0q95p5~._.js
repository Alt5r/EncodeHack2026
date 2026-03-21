module.exports = [
"[project]/lib/api.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createSession",
    ()=>createSession,
    "createWebSocket",
    ()=>createWebSocket,
    "getLeaderboard",
    ()=>getLeaderboard
]);
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000') + '/api/v1';
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
}),
"[project]/app/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>LandingPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
const DEFAULT_DOCTRINE = 'Prioritize protecting the village at all costs. ' + 'Deploy helicopters to suppress the fire leading edge ahead of the wind. ' + 'Ground crews establish firebreaks between fire and village — cut a defensive line 3 cells wide. ' + 'Helicopter Alpha leads suppression; Bravo covers flanks. ' + 'If fire reaches within 4 cells of the village, redirect all units to direct defense. ' + 'Report status every action.';
const BOOT_LINES = [
    'Initialising orchestrator...',
    'Fetching wind conditions from OpenWeather...',
    'Spawning sub-agents... [2x HELICOPTER] [3x GROUND CREW]',
    'Fire ignition point set.',
    'Stand by.'
];
function sleep(ms) {
    return new Promise((r)=>setTimeout(r, ms));
}
function LandingPage() {
    const [phase, setPhase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('landing');
    const [doctrine, setDoctrine] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [title, setTitle] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [bootLines, setBootLines] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    async function deploy(doctrineText, doctrineTitle) {
        setPhase('deploying');
        setBootLines([]);
        setError(null);
        for(let i = 0; i < BOOT_LINES.length; i++){
            await sleep(320 + Math.random() * 280);
            setBootLines((prev)=>[
                    ...prev,
                    BOOT_LINES[i]
                ]);
        }
        try {
            const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createSession"])(doctrineText, doctrineTitle);
            await sleep(500);
            router.push(`/play/${session.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect to server.');
            setPhase('terminal');
            setBootLines([]);
        }
    }
    function handleDeploy() {
        const text = doctrine.trim();
        if (!text) {
            setError('Doctrine cannot be empty.');
            return;
        }
        setError(null);
        deploy(text, title.trim() || undefined);
    }
    if (phase === 'landing') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(LandingScreen, {
            onDefault: ()=>deploy(DEFAULT_DOCTRINE, 'DEFAULT PROTOCOL'),
            onWrite: ()=>setPhase('terminal')
        }, void 0, false, {
            fileName: "[project]/app/page.tsx",
            lineNumber: 64,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(TerminalScreen, {
        phase: phase,
        doctrine: doctrine,
        title: title,
        error: error,
        bootLines: bootLines,
        onDoctrineChange: setDoctrine,
        onTitleChange: setTitle,
        onDeploy: handleDeploy,
        onBack: ()=>{
            setPhase('landing');
            setError(null);
        }
    }, void 0, false, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 68,
        columnNumber: 5
    }, this);
}
/* ------------------------------------------------------------------ */ /* Landing Screen                                                       */ /* ------------------------------------------------------------------ */ const EMBER_CONFIG = [
    {
        left: '8%',
        delay: '0s',
        dur: '4s',
        size: 3
    },
    {
        left: '15%',
        delay: '0.7s',
        dur: '3.2s',
        size: 2
    },
    {
        left: '22%',
        delay: '1.4s',
        dur: '5s',
        size: 4
    },
    {
        left: '31%',
        delay: '0.3s',
        dur: '3.8s',
        size: 2
    },
    {
        left: '39%',
        delay: '2s',
        dur: '4.2s',
        size: 3
    },
    {
        left: '47%',
        delay: '0.9s',
        dur: '3.5s',
        size: 5
    },
    {
        left: '54%',
        delay: '1.8s',
        dur: '4.8s',
        size: 2
    },
    {
        left: '62%',
        delay: '0.4s',
        dur: '3.9s',
        size: 3
    },
    {
        left: '70%',
        delay: '1.2s',
        dur: '4.4s',
        size: 4
    },
    {
        left: '77%',
        delay: '2.5s',
        dur: '3.3s',
        size: 2
    },
    {
        left: '84%',
        delay: '0.6s',
        dur: '5.2s',
        size: 3
    },
    {
        left: '91%',
        delay: '1.6s',
        dur: '4s',
        size: 2
    }
];
function LandingScreen({ onDefault, onWrite }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex flex-col items-center justify-center relative overflow-hidden",
        style: {
            background: 'linear-gradient(to bottom, #100800 0%, #0d1a0e 50%, #061008 100%)'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 pointer-events-none overflow-hidden",
                children: EMBER_CONFIG.map((e, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            position: 'absolute',
                            bottom: '28%',
                            left: e.left,
                            width: `${e.size}px`,
                            height: `${e.size}px`,
                            borderRadius: '50%',
                            background: '#ff6600',
                            boxShadow: `0 0 ${e.size * 2}px #ff4400, 0 0 ${e.size}px #ffaa00`,
                            animation: `ember-rise ${e.dur} ${e.delay} infinite ease-out`
                        }
                    }, i, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 110,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 108,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                viewBox: "0 0 1440 220",
                className: "absolute bottom-0 left-0 right-0 w-full",
                preserveAspectRatio: "none",
                style: {
                    height: '220px'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                        d: "M0,220 L0,140 L30,100 L60,135 L90,90 L130,120 L165,75 L200,110 L235,68 L275,100 L310,72 L350,105 L385,60 L420,95 L460,55 L500,88 L535,50 L575,82 L610,48 L650,80 L690,52 L730,88 L768,55 L805,90 L845,58 L882,92 L920,62 L958,95 L995,65 L1035,100 L1072,70 L1110,105 L1148,72 L1185,108 L1222,78 L1260,112 L1300,80 L1340,115 L1380,88 L1440,120 L1440,220 Z",
                        fill: "#071510"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 134,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                        d: "M0,220 L0,160 L45,125 L85,158 L125,130 L165,162 L210,135 L250,165 L290,138 L335,168 L375,140 L415,170 L460,142 L500,168 L540,140 L582,165 L622,142 L665,168 L705,140 L748,166 L790,140 L830,168 L875,142 L915,170 L958,142 L1000,168 L1042,140 L1085,166 L1128,140 L1170,165 L1212,140 L1255,165 L1298,140 L1340,162 L1390,142 L1440,158 L1440,220 Z",
                        fill: "#0a1e0d"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 138,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("defs", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("linearGradient", {
                            id: "fadeup",
                            x1: "0",
                            y1: "0",
                            x2: "0",
                            y2: "1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                    offset: "0%",
                                    stopColor: "#0a1e0d",
                                    stopOpacity: "0"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 145,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                    offset: "100%",
                                    stopColor: "#061008",
                                    stopOpacity: "1"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 146,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 144,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 143,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                        x: "0",
                        y: "140",
                        width: "1440",
                        height: "80",
                        fill: "url(#fadeup)"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 149,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 128,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute pointer-events-none",
                style: {
                    bottom: '26%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '600px',
                    height: '80px',
                    background: 'radial-gradient(ellipse at center bottom, rgba(255,90,0,0.25) 0%, transparent 70%)',
                    animation: 'pulse-glow 3s ease-in-out infinite'
                }
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 153,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-5 select-none animate-fade-in-slow",
                style: {
                    fontSize: '56px',
                    filter: 'drop-shadow(0 0 24px rgba(255,160,50,0.5))'
                },
                children: "🗼"
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 167,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                className: "glow-amber font-bold tracking-widest select-none animate-fade-in-slow",
                style: {
                    color: '#ffb347',
                    fontFamily: 'Courier New, monospace',
                    fontSize: 'clamp(2.5rem, 8vw, 5.5rem)',
                    letterSpacing: '0.35em',
                    animationDelay: '0.2s'
                },
                children: "WATCHTOWER"
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 175,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "my-4 animate-fade-in-slow",
                style: {
                    width: '320px',
                    height: '1px',
                    background: 'linear-gradient(to right, transparent, #6a4020, transparent)',
                    animationDelay: '0.4s'
                }
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 189,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs tracking-widest mb-12 animate-fade-in-slow",
                style: {
                    color: '#a07040',
                    letterSpacing: '0.3em',
                    animationDelay: '0.5s'
                },
                children: "MULTI-AGENT WILDFIRE COMMAND SIMULATION"
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 199,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col sm:flex-row gap-3 animate-fade-in-slow",
                style: {
                    animationDelay: '0.7s'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(LandingButton, {
                        onClick: onDefault,
                        dim: true,
                        children: "DEPLOY DEFAULT AGENT"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 208,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(LandingButton, {
                        onClick: onWrite,
                        primary: true,
                        children: "WRITE YOUR DOCTRINE"
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 211,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 207,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-12 text-xs tracking-widest animate-fade-in-slow",
                style: {
                    color: '#4a3520',
                    letterSpacing: '0.2em',
                    animationDelay: '1s'
                },
                children: "ONCE DEPLOYED, THE AGENT ACTS ALONE"
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 216,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 103,
        columnNumber: 5
    }, this);
}
function LandingButton({ onClick, children, primary, dim }) {
    const base = {
        fontFamily: 'Courier New, monospace',
        letterSpacing: '0.15em',
        padding: '12px 28px',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: 'transparent',
        display: 'inline-block'
    };
    const style = primary ? {
        ...base,
        border: '1px solid #ffb347',
        color: '#ffb347',
        boxShadow: '0 0 16px rgba(255,179,71,0.2), inset 0 0 16px rgba(255,179,71,0.03)'
    } : {
        ...base,
        border: '1px solid #3a2818',
        color: '#7a5838'
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        onClick: onClick,
        style: style,
        onMouseEnter: (e)=>{
            if (primary) {
                e.currentTarget.style.background = 'rgba(255,179,71,0.08)';
                e.currentTarget.style.boxShadow = '0 0 24px rgba(255,179,71,0.35), inset 0 0 20px rgba(255,179,71,0.05)';
            } else {
                e.currentTarget.style.borderColor = '#6a4828';
                e.currentTarget.style.color = '#c8a060';
            }
        },
        onMouseLeave: (e)=>{
            if (primary) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.boxShadow = '0 0 16px rgba(255,179,71,0.2), inset 0 0 16px rgba(255,179,71,0.03)';
            } else {
                e.currentTarget.style.borderColor = '#3a2818';
                e.currentTarget.style.color = '#7a5838';
            }
        },
        children: [
            "[ ",
            children,
            " ]"
        ]
    }, void 0, true, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 262,
        columnNumber: 5
    }, this);
}
function TerminalScreen({ phase, doctrine, title, error, bootLines, onDoctrineChange, onTitleChange, onDeploy, onBack }) {
    const deploying = phase === 'deploying';
    const textareaRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!deploying) textareaRef.current?.focus();
    }, [
        deploying
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex items-start justify-center p-6 pt-10 scanlines",
        style: {
            background: '#080600'
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "w-full max-w-2xl animate-fade-in",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between mb-8 pb-3",
                    style: {
                        borderBottom: '1px solid #2a1a08'
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    style: {
                                        color: '#ff4500',
                                        fontSize: '10px'
                                    },
                                    children: "■"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 328,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    style: {
                                        color: '#ff8c00',
                                        fontSize: '10px'
                                    },
                                    children: "■"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 329,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    style: {
                                        color: '#4caf50',
                                        fontSize: '10px'
                                    },
                                    children: "■"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 330,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xs tracking-widest ml-2",
                                    style: {
                                        color: '#5a4020'
                                    },
                                    children: "WATCHTOWER COMMAND SYSTEM v1.0"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 331,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 327,
                            columnNumber: 11
                        }, this),
                        !deploying && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onBack,
                            className: "text-xs transition-opacity hover:opacity-80",
                            style: {
                                color: '#5a4020',
                                fontFamily: 'Courier New, monospace',
                                letterSpacing: '0.1em'
                            },
                            children: "← BACK"
                        }, void 0, false, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 336,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 323,
                    columnNumber: 9
                }, this),
                !deploying ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mb-6",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs mb-1",
                                    style: {
                                        color: '#5a4020'
                                    },
                                    children: "> ENTER FIREFIGHTING DOCTRINE"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 349,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs mb-5 leading-relaxed",
                                    style: {
                                        color: '#3a2810',
                                        lineHeight: '1.8'
                                    },
                                    children: [
                                        "Your strategy will be injected into the orchestrator agent.",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 351,
                                            columnNumber: 76
                                        }, this),
                                        "The agent acts alone. You will not intervene."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 350,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 348,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mb-5",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-xs mb-2 tracking-widest",
                                    style: {
                                        color: '#6a4820'
                                    },
                                    children: "DOCTRINE"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 357,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                    ref: textareaRef,
                                    value: doctrine,
                                    onChange: (e)=>onDoctrineChange(e.target.value),
                                    rows: 9,
                                    placeholder: "Protect the village. Deploy helicopters to the fire front. Ground crews establish firebreaks...",
                                    className: "w-full p-4 text-sm resize-y outline-none",
                                    style: {
                                        background: '#050400',
                                        border: '1px solid #2a1a08',
                                        color: '#ffb347',
                                        fontFamily: 'Courier New, monospace',
                                        lineHeight: '1.7',
                                        borderRadius: 0,
                                        transition: 'border-color 0.2s'
                                    },
                                    onFocus: (e)=>e.target.style.borderColor = '#6a4020',
                                    onBlur: (e)=>e.target.style.borderColor = '#2a1a08'
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 360,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 356,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mb-7",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-xs mb-2 tracking-widest",
                                    style: {
                                        color: '#6a4820'
                                    },
                                    children: [
                                        "DOCTRINE TITLE ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            style: {
                                                color: '#3a2810'
                                            },
                                            children: "(optional)"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 383,
                                            columnNumber: 32
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 382,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    value: title,
                                    onChange: (e)=>onTitleChange(e.target.value),
                                    placeholder: "e.g. SIERRA-PROTOCOL",
                                    className: "w-full p-3 text-sm outline-none",
                                    style: {
                                        background: '#050400',
                                        border: '1px solid #2a1a08',
                                        color: '#ffb347',
                                        fontFamily: 'Courier New, monospace',
                                        borderRadius: 0,
                                        transition: 'border-color 0.2s'
                                    },
                                    onFocus: (e)=>e.target.style.borderColor = '#6a4020',
                                    onBlur: (e)=>e.target.style.borderColor = '#2a1a08',
                                    maxLength: 100
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 385,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 381,
                            columnNumber: 13
                        }, this),
                        error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-xs mb-4 animate-fade-in",
                            style: {
                                color: '#ff4500',
                                letterSpacing: '0.05em'
                            },
                            children: [
                                "> ERROR: ",
                                error
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 405,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onDeploy,
                            className: "px-12 py-3 text-sm tracking-widest transition-all duration-200",
                            style: {
                                border: '1px solid #ffb347',
                                color: '#ffb347',
                                background: 'transparent',
                                fontFamily: 'Courier New, monospace',
                                letterSpacing: '0.25em',
                                boxShadow: '0 0 20px rgba(255,179,71,0.15)',
                                borderRadius: 0
                            },
                            onMouseEnter: (e)=>{
                                e.currentTarget.style.background = 'rgba(255,179,71,0.08)';
                                e.currentTarget.style.boxShadow = '0 0 30px rgba(255,179,71,0.3)';
                            },
                            onMouseLeave: (e)=>{
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.boxShadow = '0 0 20px rgba(255,179,71,0.15)';
                            },
                            children: "> DEPLOY"
                        }, void 0, false, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 410,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(BootSequence, {
                    lines: bootLines
                }, void 0, false, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 435,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/page.tsx",
            lineNumber: 321,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 317,
        columnNumber: 5
    }, this);
}
function BootSequence({ lines }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs mb-6",
                style: {
                    color: '#3a2810'
                },
                children: "> DEPLOYING AGENT..."
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 445,
                columnNumber: 7
            }, this),
            lines.map((line, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "animate-fade-in flex items-start gap-3",
                    style: {
                        animationDelay: '0s'
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            style: {
                                color: '#4a8a4a',
                                fontSize: '10px',
                                marginTop: '2px'
                            },
                            children: "▶"
                        }, void 0, false, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 450,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm",
                            style: {
                                color: '#ffb347',
                                fontFamily: 'Courier New, monospace',
                                lineHeight: '1.5'
                            },
                            children: line
                        }, void 0, false, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 451,
                            columnNumber: 11
                        }, this)
                    ]
                }, i, true, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 449,
                    columnNumber: 9
                }, this)),
            lines.length < BOOT_LINES.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2 mt-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "animate-blink inline-block",
                    style: {
                        width: '8px',
                        height: '16px',
                        background: '#ffb347'
                    }
                }, void 0, false, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 458,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 457,
                columnNumber: 9
            }, this),
            lines.length === BOOT_LINES.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs mt-6 animate-fade-in",
                style: {
                    color: '#4caf50'
                },
                children: "> Launching..."
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 465,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 444,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=_0q95p5~._.js.map