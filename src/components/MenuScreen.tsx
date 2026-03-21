'use client';

import { useEffect, useState } from 'react';

interface MenuScreenProps {
  onDeployDefault: () => void;
  onWriteDoctrine: () => void;
}

export default function MenuScreen({ onDeployDefault, onWriteDoctrine }: MenuScreenProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%', overflow: 'hidden' }}>
      {/* Full Firewatch-style illustrated scene */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox="0 0 1280 720"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Sky gradient — hazy warm blue fading to cream at horizon */}
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7fafc4" />
            <stop offset="35%" stopColor="#a8c8d8" />
            <stop offset="60%" stopColor="#c8d8d0" />
            <stop offset="80%" stopColor="#ddd8c0" />
            <stop offset="100%" stopColor="#d8cca8" />
          </linearGradient>

          {/* Grass gradient — golden hillside */}
          <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b8a040" />
            <stop offset="40%" stopColor="#c4a838" />
            <stop offset="100%" stopColor="#a89030" />
          </linearGradient>

          {/* Sun haze glow */}
          <radialGradient id="sunHaze" cx="0.55" cy="0.25" r="0.4">
            <stop offset="0%" stopColor="rgba(255,248,220,0.5)" />
            <stop offset="50%" stopColor="rgba(255,240,200,0.15)" />
            <stop offset="100%" stopColor="rgba(255,240,200,0)" />
          </radialGradient>

          {/* Tree gradient for depth */}
          <linearGradient id="treeGradFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a5a48" />
            <stop offset="100%" stopColor="#2d4a3a" />
          </linearGradient>
          <linearGradient id="treeGradNear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a4a38" />
            <stop offset="100%" stopColor="#1e3a2c" />
          </linearGradient>
        </defs>

        {/* Sky */}
        <rect x="0" y="0" width="1280" height="720" fill="url(#skyGrad)" />

        {/* Sun haze */}
        <rect x="0" y="0" width="1280" height="720" fill="url(#sunHaze)" />

        {/* Clouds — big billowy shapes */}
        <g opacity="0.9">
          {/* Main cloud mass — center-left, big and dramatic */}
          <ellipse cx="420" cy="160" rx="220" ry="90" fill="#eae6dc" />
          <ellipse cx="350" cy="140" rx="160" ry="80" fill="#f0ece4" />
          <ellipse cx="500" cy="150" rx="180" ry="70" fill="#e8e4d8" />
          <ellipse cx="380" cy="180" rx="200" ry="60" fill="#ece8e0" />
          <ellipse cx="300" cy="170" rx="120" ry="55" fill="#f2eee6" />
          <ellipse cx="460" cy="130" rx="140" ry="65" fill="#f4f0e8" />

          {/* Smaller cloud — right side */}
          <ellipse cx="950" cy="120" rx="100" ry="45" fill="#e8e4dc" />
          <ellipse cx="1000" cy="130" rx="80" ry="35" fill="#ece8e0" />

          {/* Wispy cloud — upper left */}
          <ellipse cx="150" cy="100" rx="120" ry="30" fill="#e4e0d8" opacity="0.6" />
        </g>

        {/* Distant tree line — far background, subtle */}
        <g fill="#5a7a68" opacity="0.5">
          <polygon points="0,380 30,340 50,360 80,320 110,350 140,310 170,345 200,300 230,340 260,315 290,350 320,290 350,330 380,310 410,340 440,295 470,335 500,305 530,345 560,290 590,330 620,310 650,345 680,300 710,340 740,315 760,380" />
          <polygon points="520,380 550,330 580,350 610,310 640,345 670,300 700,335 730,295 760,330 790,305 820,340 850,295 880,325 910,300 940,335 970,290 1000,320 1030,310 1060,340 1090,295 1120,330 1150,305 1180,340 1210,300 1240,330 1280,310 1280,380" />
        </g>

        {/* Mid tree line — left side, darker pines */}
        <g fill="url(#treeGradFar)">
          {/* Left tree cluster */}
          <polygon points="0,420 0,340 20,350 35,280 50,340 65,290 80,350 95,260 115,340 130,300 145,350 160,270 180,340 195,310 210,350 225,280 245,350 260,320 275,360 290,300 310,360 330,330 350,370 370,340 390,380 410,360 430,390 440,420" />
          {/* Right tree cluster */}
          <polygon points="840,420 860,360 880,380 900,310 920,370 935,280 955,350 970,300 990,360 1010,270 1030,340 1050,290 1070,350 1085,260 1105,330 1120,280 1140,340 1160,300 1180,350 1200,280 1220,340 1240,310 1260,350 1280,290 1280,420" />
        </g>

        {/* Near tree line — flanking darker, frame the tower */}
        <g fill="url(#treeGradNear)">
          {/* Left trees — tall, close */}
          <polygon points="0,520 0,300 15,320 30,240 45,310 55,200 70,290 85,230 100,300 110,180 130,280 145,220 160,290 170,240 185,310 200,260 215,320 230,280 245,340 260,310 280,360 300,340 320,380 340,360 360,400 380,380 400,420 420,400 440,440 450,520" />
          {/* Right trees — tall, close, with canopy overlap at top */}
          <polygon points="830,520 850,400 870,420 890,350 910,400 925,300 940,380 955,320 970,370 985,260 1005,340 1020,280 1040,330 1060,240 1080,310 1095,250 1110,300 1130,220 1150,290 1170,240 1190,300 1210,260 1230,310 1250,230 1270,290 1280,250 1280,520" />

          {/* Overhanging branch top-right (like the photo) */}
          <path d="M1280,0 L1280,120 Q1220,100 1180,130 Q1150,80 1120,110 Q1100,60 1080,90 Q1060,40 1050,70 Q1040,20 1060,0 Z" fill="#2a4a38" opacity="0.7" />
        </g>

        {/* WATCHTOWER — center, prominent structure */}
        <g>
          {/* Tower legs — wooden scaffold, golden-brown */}
          {/* Left leg */}
          <polygon points="580,560 595,340 605,340 590,560" fill="#9a7830" />
          {/* Right leg */}
          <polygon points="700,560 685,340 675,340 690,560" fill="#9a7830" />
          {/* Inner left leg */}
          <polygon points="610,560 615,340 622,340 617,560" fill="#8a6c28" />
          {/* Inner right leg */}
          <polygon points="670,560 665,340 658,340 663,560" fill="#8a6c28" />

          {/* Cross braces */}
          <line x1="588" y1="480" x2="693" y2="480" stroke="#a08030" strokeWidth="3" />
          <line x1="592" y1="430" x2="688" y2="430" stroke="#a08030" strokeWidth="3" />
          <line x1="596" y1="380" x2="684" y2="380" stroke="#a08030" strokeWidth="2.5" />

          {/* Diagonal braces */}
          <line x1="588" y1="520" x2="688" y2="430" stroke="#907028" strokeWidth="2" />
          <line x1="692" y1="520" x2="592" y2="430" stroke="#907028" strokeWidth="2" />
          <line x1="592" y1="430" x2="684" y2="380" stroke="#907028" strokeWidth="1.8" />
          <line x1="688" y1="430" x2="596" y2="380" stroke="#907028" strokeWidth="1.8" />

          {/* Stairs — zigzag up the middle */}
          <line x1="610" y1="555" x2="660" y2="500" stroke="#b89040" strokeWidth="2.5" />
          <line x1="660" y1="500" x2="615" y2="450" stroke="#b89040" strokeWidth="2.5" />
          <line x1="615" y1="450" x2="660" y2="400" stroke="#b89040" strokeWidth="2.5" />
          <line x1="660" y1="400" x2="625" y2="355" stroke="#b89040" strokeWidth="2" />

          {/* Stair railings */}
          <line x1="606" y1="555" x2="656" y2="500" stroke="#a08030" strokeWidth="1" />
          <line x1="656" y1="500" x2="611" y2="450" stroke="#a08030" strokeWidth="1" />

          {/* Platform / deck */}
          <rect x="565" y="330" width="150" height="6" fill="#5a5a58" />
          <rect x="570" y="336" width="140" height="3" fill="#4a4a48" />

          {/* Cabin */}
          <rect x="575" y="275" width="130" height="55" fill="#505050" />
          {/* Cabin roof — slight overhang */}
          <polygon points="565,275 640,250 715,275" fill="#484848" />
          <rect x="560" y="272" width="160" height="5" fill="#404040" />

          {/* Cabin railing / deck edge */}
          <line x1="565" y1="330" x2="565" y2="315" stroke="#5a5a58" strokeWidth="2" />
          <line x1="715" y1="330" x2="715" y2="315" stroke="#5a5a58" strokeWidth="2" />
          <line x1="565" y1="317" x2="715" y2="317" stroke="#5a5a58" strokeWidth="1.5" />

          {/* Cabin windows — warm amber glow */}
          <rect x="590" y="288" width="22" height="16" fill="#d4a040" opacity="0.7" />
          <rect x="620" y="288" width="22" height="16" fill="#d4a040" opacity="0.7" />
          <rect x="650" y="288" width="22" height="16" fill="#d4a040" opacity="0.6" />

          {/* Window glow pulse */}
          <rect x="590" y="288" width="22" height="16" fill="#e8c060" opacity="0.3">
            <animate attributeName="opacity" values="0.2;0.4;0.2" dur="4s" repeatCount="indefinite" />
          </rect>
          <rect x="620" y="288" width="22" height="16" fill="#e8c060" opacity="0.3">
            <animate attributeName="opacity" values="0.3;0.5;0.3" dur="3.5s" repeatCount="indefinite" />
          </rect>
        </g>

        {/* Foreground hillside — golden grass rising from bottom, extends high behind trees */}
        <path
          d="M0,720 L0,440 Q100,430 200,445 Q350,420 500,450 Q580,460 640,470 Q700,460 780,450 Q900,425 1050,435 Q1180,445 1280,430 L1280,720 Z"
          fill="url(#grassGrad)"
        />

        {/* Grass texture — wispy lines across the hillside */}
        <g stroke="#a89030" strokeWidth="0.8" opacity="0.4">
          <line x1="50" y1="600" x2="65" y2="585" />
          <line x1="80" y1="610" x2="95" y2="592" />
          <line x1="120" y1="595" x2="138" y2="578" />
          <line x1="160" y1="605" x2="175" y2="590" />
          <line x1="220" y1="590" x2="235" y2="572" />
          <line x1="270" y1="600" x2="288" y2="583" />
          <line x1="350" y1="585" x2="365" y2="568" />
          <line x1="420" y1="595" x2="435" y2="580" />
          <line x1="850" y1="590" x2="865" y2="572" />
          <line x1="920" y1="580" x2="935" y2="564" />
          <line x1="980" y1="590" x2="998" y2="573" />
          <line x1="1050" y1="585" x2="1065" y2="568" />
          <line x1="1120" y1="590" x2="1138" y2="575" />
          <line x1="1200" y1="580" x2="1215" y2="565" />
        </g>

        {/* Foreground rocks — warm brown boulders */}
        <g>
          {/* Large rock — center-left */}
          <path d="M440,600 Q430,560 460,540 Q490,520 520,535 Q545,545 550,570 Q555,600 530,620 Q500,635 470,625 Q445,615 440,600 Z" fill="#7a6040" />
          <path d="M445,595 Q440,565 465,548 Q485,535 510,542 Q530,548 535,565 Q538,585 520,598 Q500,608 475,605 Q450,602 445,595 Z" fill="#8a7050" />

          {/* Medium rock — right */}
          <path d="M780,580 Q775,555 800,540 Q825,528 845,540 Q860,555 855,575 Q850,595 830,605 Q805,610 790,598 Q780,590 780,580 Z" fill="#6a5535" />
          <path d="M785,575 Q782,558 802,546 Q820,538 835,548 Q845,558 842,572 Q838,588 822,595 Q804,600 792,590 Q785,583 785,575 Z" fill="#7a6545" />

          {/* Small rock — far left */}
          <path d="M150,620 Q148,600 165,590 Q180,582 195,592 Q205,605 198,618 Q188,628 170,628 Q155,626 150,620 Z" fill="#7a6040" />

          {/* Small rock — center */}
          <path d="M560,610 Q555,595 570,585 Q585,578 598,588 Q608,600 600,612 Q590,622 575,620 Q562,618 560,610 Z" fill="#6a5535" />
        </g>

        {/* Tiny wildflowers in the grass */}
        <g fill="#e8d870" opacity="0.5">
          <circle cx="300" cy="608" r="1.5" />
          <circle cx="310" cy="612" r="1" />
          <circle cx="380" cy="600" r="1.5" />
          <circle cx="395" cy="605" r="1" />
          <circle cx="750" cy="595" r="1.5" />
          <circle cx="760" cy="600" r="1" />
          <circle cx="1100" cy="595" r="1.5" />
          <circle cx="1110" cy="590" r="1" />
        </g>

        {/* Atmospheric haze layer — warm overlay */}
        <rect x="0" y="0" width="1280" height="720" fill="rgba(210,190,150,0.08)" />

        {/* Bottom vignette to anchor the scene */}
        <rect x="0" y="500" width="1280" height="220" fill="url(#bottomVig)" opacity="0.3" />
        <defs>
          <linearGradient id="bottomVig" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(30,25,15,1)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Content overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '80px 60px 60px',
          animation: 'wtMenuFadeIn 1.5s ease-out forwards',
          opacity: 0,
          zIndex: 2,
        }}
      >
        {/* Title block — upper area */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 11,
              letterSpacing: '0.3em',
              color: 'rgba(255,252,240,0.8)',
              textTransform: 'uppercase',
              textShadow: '0 1px 6px rgba(0,0,0,0.5)',
            }}
          >
            Encode Forest Service
          </div>

          <h1
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 56,
              fontWeight: 'bold',
              letterSpacing: '0.35em',
              color: '#fffcf0',
              textShadow: '0 2px 30px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.6)',
              margin: 0,
            }}
          >
            WATCHTOWER
          </h1>

          <div
            style={{
              width: 220,
              height: 1,
              backgroundColor: 'rgba(255,252,240,0.45)',
              margin: '4px 0',
            }}
          />

          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 12,
              letterSpacing: '0.25em',
              color: 'rgba(255,252,240,0.75)',
              textTransform: 'uppercase',
              textShadow: '0 1px 6px rgba(0,0,0,0.5)',
            }}
          >
            Wildfire Command Simulation
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Buttons — bottom, over the grass */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <button
            onClick={onDeployDefault}
            style={{
              padding: '10px 40px',
              fontSize: 14,
              fontWeight: 400,
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: 'rgba(255,252,240,0.9)',
              backgroundColor: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,252,240,0.3)',
              backdropFilter: 'blur(4px)',
              cursor: 'pointer',
              fontFamily: 'Georgia, serif',
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.4)';
              e.currentTarget.style.borderColor = 'rgba(255,252,240,0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.25)';
              e.currentTarget.style.borderColor = 'rgba(255,252,240,0.3)';
            }}
          >
            Deploy Default Agent
          </button>

          <button
            onClick={onWriteDoctrine}
            style={{
              padding: '10px 40px',
              fontSize: 14,
              fontWeight: 400,
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: 'rgba(255,252,240,0.7)',
              backgroundColor: 'rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,252,240,0.2)',
              backdropFilter: 'blur(4px)',
              cursor: 'pointer',
              fontFamily: 'Georgia, serif',
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(255,252,240,0.9)';
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.35)';
              e.currentTarget.style.borderColor = 'rgba(255,252,240,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,252,240,0.7)';
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.15)';
              e.currentTarget.style.borderColor = 'rgba(255,252,240,0.2)';
            }}
          >
            Write Your Doctrine
          </button>
        </div>
      </div>

      {/* Top vignette for title readability */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '30%',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      <style>{`
        @keyframes wtMenuFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
