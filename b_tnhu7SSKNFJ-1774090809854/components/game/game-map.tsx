"use client"

import { useGame, GRID_WIDTH, GRID_HEIGHT, TILE_SIZE } from "./game-context"
import { useMemo } from "react"

export function GameMap() {
  const { grid, agents, wind } = useGame()

  // Generate random tree positions for each forest tile with varying density
  const treePositions = useMemo(() => {
    const positions: Record<string, Array<{ x: number; y: number; scale: number; variant: number }>> = {}
    
    // Create density map using noise-like function for organic clusters
    const getDensity = (x: number, y: number): number => {
      // Multiple overlapping patterns for organic feel
      const pattern1 = Math.sin(x * 0.4) * Math.cos(y * 0.3) * 0.5 + 0.5
      const pattern2 = Math.sin(x * 0.15 + y * 0.1) * 0.5 + 0.5
      const pattern3 = Math.cos((x + y) * 0.2) * 0.5 + 0.5
      
      // Combine patterns
      const combined = (pattern1 * 0.4 + pattern2 * 0.35 + pattern3 * 0.25)
      
      // Add some high-density clusters
      const clusterCenters = [
        { cx: 8, cy: 15, r: 8 },
        { cx: 35, cy: 10, r: 10 },
        { cx: 20, cy: 28, r: 7 },
        { cx: 48, cy: 18, r: 6 },
        { cx: 15, cy: 5, r: 5 },
        { cx: 40, cy: 35, r: 8 },
      ]
      
      let clusterBoost = 0
      for (const cluster of clusterCenters) {
        const dist = Math.sqrt((x - cluster.cx) ** 2 + (y - cluster.cy) ** 2)
        if (dist < cluster.r) {
          clusterBoost = Math.max(clusterBoost, 1 - dist / cluster.r)
        }
      }
      
      return Math.min(1, combined + clusterBoost * 0.5)
    }
    
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const key = `${x}-${y}`
        const density = getDensity(x, y)
        
        // Sparse: 1 tree, Medium: 2-3 trees, Dense: 4-6 trees
        let count: number
        if (density < 0.3) {
          count = 1
        } else if (density < 0.5) {
          count = 1 + Math.floor(Math.random() * 2) // 1-2
        } else if (density < 0.7) {
          count = 2 + Math.floor(Math.random() * 2) // 2-3
        } else if (density < 0.85) {
          count = 3 + Math.floor(Math.random() * 2) // 3-4
        } else {
          count = 4 + Math.floor(Math.random() * 3) // 4-6
        }
        
        positions[key] = Array.from({ length: count }, (_, i) => {
          // Spread trees more evenly in dense areas
          const spread = count > 3 ? 0.85 : 0.6
          const offset = count > 3 ? 0.075 : 0.2
          return {
            x: Math.random() * TILE_SIZE * spread + TILE_SIZE * offset,
            y: Math.random() * TILE_SIZE * spread + TILE_SIZE * offset,
            scale: 0.45 + Math.random() * 0.35, // Consistent size regardless of density
            variant: Math.floor(Math.random() * 3),
          }
        })
      }
    }
    return positions
  }, [])

  // Generate topography contour lines
  const contourLines = useMemo(() => {
    const lines: Array<{ points: string; level: number }> = []
    const levels = [0.25, 0.4, 0.55, 0.7, 0.85]
    
    for (const level of levels) {
      const segments: string[] = []
      
      for (let y = 0; y < GRID_HEIGHT - 1; y++) {
        for (let x = 0; x < GRID_WIDTH - 1; x++) {
          const e00 = grid[y][x].elevation
          const e10 = grid[y][x + 1].elevation
          const e01 = grid[y + 1][x].elevation
          const e11 = grid[y + 1][x + 1].elevation
          
          // Simple marching squares for contour
          const px = x * TILE_SIZE
          const py = y * TILE_SIZE
          
          const crossings: Array<{x: number, y: number}> = []
          
          // Check each edge
          if ((e00 < level) !== (e10 < level)) {
            const t = (level - e00) / (e10 - e00)
            crossings.push({ x: px + t * TILE_SIZE, y: py })
          }
          if ((e10 < level) !== (e11 < level)) {
            const t = (level - e10) / (e11 - e10)
            crossings.push({ x: px + TILE_SIZE, y: py + t * TILE_SIZE })
          }
          if ((e01 < level) !== (e11 < level)) {
            const t = (level - e01) / (e11 - e01)
            crossings.push({ x: px + t * TILE_SIZE, y: py + TILE_SIZE })
          }
          if ((e00 < level) !== (e01 < level)) {
            const t = (level - e00) / (e01 - e00)
            crossings.push({ x: px, y: py + t * TILE_SIZE })
          }
          
          if (crossings.length >= 2) {
            segments.push(`M${crossings[0].x},${crossings[0].y} L${crossings[1].x},${crossings[1].y}`)
          }
        }
      }
      
      if (segments.length > 0) {
        lines.push({ points: segments.join(' '), level })
      }
    }
    
    return lines
  }, [grid])

  const mapWidth = GRID_WIDTH * TILE_SIZE
  const mapHeight = GRID_HEIGHT * TILE_SIZE

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Warm amber sky background */}
      <div 
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #e8a86b 0%, #d4785c 20%, #8b5a5a 40%, #5c3d5e 60%, #2d1b3d 100%)"
        }}
      />

      {/* Map container with scroll */}
      <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4">
        <div 
          className="relative flex-shrink-0"
          style={{ 
            width: mapWidth, 
            height: mapHeight,
            boxShadow: "0 0 80px rgba(0,0,0,0.6)",
          }}
        >
          {/* Grid tiles */}
          <svg 
            width={mapWidth} 
            height={mapHeight}
            className="absolute inset-0"
          >
            <defs>
              {/* Tree shapes - smaller for denser forest */}
              <symbol id="tree-1" viewBox="0 0 10 12">
                <polygon points="5,0 1,10 9,10" fill="currentColor" />
                <rect x="4" y="9" width="2" height="3" fill="#2a1f2d" />
              </symbol>
              <symbol id="tree-2" viewBox="0 0 10 12">
                <polygon points="5,0 2,6 8,6" fill="currentColor" />
                <polygon points="5,3 1,10 9,10" fill="currentColor" />
                <rect x="4" y="9" width="2" height="3" fill="#2a1f2d" />
              </symbol>
              <symbol id="tree-3" viewBox="0 0 10 12">
                <ellipse cx="5" cy="6" rx="4" ry="5" fill="currentColor" />
                <rect x="4" y="9" width="2" height="3" fill="#2a1f2d" />
              </symbol>

              {/* Fire glow filter */}
              <filter id="fire-glow">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Water ripple pattern */}
              <pattern id="water-pattern" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M0,4 Q2,2 4,4 T8,4" fill="none" stroke="#3a5a7a" strokeWidth="0.5" opacity="0.4" />
              </pattern>

              {/* House shape */}
              <symbol id="house" viewBox="0 0 12 12">
                <polygon points="6,1 1,6 2,6 2,11 10,11 10,6 11,6" fill="#4a3f52" />
                <rect x="5" y="7" width="2" height="4" fill="#2a1f2d" />
                <rect x="3" y="7" width="1.5" height="1.5" fill="#e8a86b" opacity="0.7" />
                <rect x="7.5" y="7" width="1.5" height="1.5" fill="#e8a86b" opacity="0.7" />
              </symbol>
            </defs>

            {/* Base terrain layer */}
            {grid.map((row, y) =>
              row.map((tile, x) => {
                const baseX = x * TILE_SIZE
                const baseY = y * TILE_SIZE

                // Terrain colors - use solid hex colors to avoid floating point issues
                let fillColor: string
                switch (tile.type) {
                  case "lake":
                  case "river":
                    fillColor = "#2a4a5a"
                    break
                  case "valley":
                    fillColor = "#1e3d32"
                    break
                  case "fire":
                    fillColor = "#1a2a2a"
                    break
                  case "burned":
                    fillColor = "#2a1f1f"
                    break
                  case "firebreak":
                    fillColor = "#4a3f2f"
                    break
                  case "village":
                    fillColor = "#3d3545"
                    break
                  case "road":
                    fillColor = "#3a3040"
                    break
                  default:
                    // Quantize elevation to 5 distinct levels for stable colors
                    const level = Math.floor(tile.elevation * 5)
                    const forestColors = ["#142820", "#183028", "#1a3830", "#1e4038", "#224840"]
                    fillColor = forestColors[Math.min(level, 4)]
                }

                return (
                  <rect
                    key={`tile-${x}-${y}`}
                    x={baseX}
                    y={baseY}
                    width={TILE_SIZE}
                    height={TILE_SIZE}
                    fill={fillColor}
                  />
                )
              })
            )}

            {/* Water texture overlay */}
            {grid.map((row, y) =>
              row.map((tile, x) => {
                if (tile.type !== "lake" && tile.type !== "river") return null
                const baseX = x * TILE_SIZE
                const baseY = y * TILE_SIZE
                return (
                  <rect
                    key={`water-${x}-${y}`}
                    x={baseX}
                    y={baseY}
                    width={TILE_SIZE}
                    height={TILE_SIZE}
                    fill="url(#water-pattern)"
                  />
                )
              })
            )}

            {/* Topography contour lines */}
            {contourLines.map((contour, i) => {
              // Quantize to fixed opacity levels
              const opacityLevels = ["#e8a86b1e", "#e8a86b2a", "#e8a86b36", "#e8a86b42", "#e8a86b50"]
              const levelIndex = Math.min(Math.floor(contour.level * 5), 4)
              return (
                <path
                  key={`contour-${i}`}
                  d={contour.points}
                  fill="none"
                  stroke={opacityLevels[levelIndex]}
                  strokeWidth="0.75"
                />
              )
            })}

            {/* Forest trees */}
            {grid.map((row, y) =>
              row.map((tile, x) => {
                if (tile.type !== "forest" && tile.type !== "valley") return null
                const baseX = x * TILE_SIZE
                const baseY = y * TILE_SIZE
                // Quantize tree colors to avoid floating point issues
                const valleyColors = ["#1f3d32", "#234538", "#274d3e", "#2b5544", "#2f5d4a"]
                const forestColors = ["#1a4540", "#1e4d48", "#225550", "#265d58", "#2a6560"]
                const level = Math.min(Math.floor(tile.elevation * 5), 4)
                const treeColor = tile.type === "valley" 
                  ? valleyColors[level]
                  : forestColors[level]

                return treePositions[`${x}-${y}`]?.map((tree, i) => (
                  <use
                    key={`tree-${x}-${y}-${i}`}
                    href={`#tree-${(tree.variant % 3) + 1}`}
                    x={baseX + tree.x - 5 * tree.scale}
                    y={baseY + tree.y - 6 * tree.scale}
                    width={10 * tree.scale}
                    height={12 * tree.scale}
                    style={{ color: treeColor }}
                  />
                ))
              })
            )}

            {/* Fire effects */}
            {grid.map((row, y) =>
              row.map((tile, x) => {
                if (tile.type !== "fire") return null
                const baseX = x * TILE_SIZE
                const baseY = y * TILE_SIZE

                return (
                  <g key={`fire-${x}-${y}`}>
                    <rect
                      x={baseX + 2}
                      y={baseY + 2}
                      width={TILE_SIZE - 4}
                      height={TILE_SIZE - 4}
                      fill="#ff6b35"
                      filter="url(#fire-glow)"
                      opacity={0.5 + tile.fireIntensity * 0.5}
                    >
                      <animate
                        attributeName="opacity"
                        values={`${0.4 + tile.fireIntensity * 0.3};${0.7 + tile.fireIntensity * 0.3};${0.4 + tile.fireIntensity * 0.3}`}
                        dur="0.4s"
                        repeatCount="indefinite"
                      />
                    </rect>
                    {/* Burning trees */}
                    {treePositions[`${x}-${y}`]?.slice(0, 1).map((tree, i) => (
                      <use
                        key={i}
                        href={`#tree-${(tree.variant % 3) + 1}`}
                        x={baseX + tree.x - 5 * tree.scale}
                        y={baseY + tree.y - 6 * tree.scale}
                        width={10 * tree.scale}
                        height={12 * tree.scale}
                        style={{ color: "#cc4422" }}
                        opacity={1 - tile.fireIntensity * 0.6}
                      />
                    ))}
                  </g>
                )
              })
            )}

            {/* Village houses */}
            {grid.map((row, y) =>
              row.map((tile, x) => {
                if (tile.type !== "village") return null
                const baseX = x * TILE_SIZE
                const baseY = y * TILE_SIZE
                return (
                  <use
                    key={`house-${x}-${y}`}
                    href="#house"
                    x={baseX + 2}
                    y={baseY + 2}
                    width={12}
                    height={12}
                  />
                )
              })
            )}

            {/* Roads */}
            {grid.map((row, y) =>
              row.map((tile, x) => {
                if (tile.type !== "road") return null
                const baseX = x * TILE_SIZE
                const baseY = y * TILE_SIZE
                return (
                  <g key={`road-${x}-${y}`}>
                    <rect
                      x={baseX}
                      y={baseY + TILE_SIZE / 2 - 2}
                      width={TILE_SIZE}
                      height={4}
                      fill="#5a4f5f"
                    />
                    <line
                      x1={baseX}
                      y1={baseY + TILE_SIZE / 2}
                      x2={baseX + TILE_SIZE}
                      y2={baseY + TILE_SIZE / 2}
                      stroke="#7a6f7f"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  </g>
                )
              })
            )}

            {/* Agent route lines */}
            {agents.filter(a => a.targetX !== undefined).map(agent => (
              <line
                key={`route-${agent.id}`}
                x1={agent.x * TILE_SIZE + TILE_SIZE / 2}
                y1={agent.y * TILE_SIZE + TILE_SIZE / 2}
                x2={(agent.targetX ?? agent.x) * TILE_SIZE + TILE_SIZE / 2}
                y2={(agent.targetY ?? agent.y) * TILE_SIZE + TILE_SIZE / 2}
                stroke={agent.type === "helicopter" ? "#88ccff" : "#ffcc88"}
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.8"
              />
            ))}

            {/* Agents */}
            {agents.map(agent => {
              const ax = agent.x * TILE_SIZE + TILE_SIZE / 2
              const ay = agent.y * TILE_SIZE + TILE_SIZE / 2

              if (agent.type === "watchtower") {
                return (
                  <g key={agent.id}>
                    {/* Tower base */}
                    <polygon
                      points={`${ax},${ay - 10} ${ax - 5},${ay + 5} ${ax + 5},${ay + 5}`}
                      fill="#2a1f2d"
                      stroke="#e8a86b"
                      strokeWidth="1"
                    />
                    {/* Beacon */}
                    <circle cx={ax} cy={ay - 7} r="3" fill="#e8a86b">
                      <animate
                        attributeName="opacity"
                        values="0.5;1;0.5"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    {/* Scan range indicator */}
                    <circle cx={ax} cy={ay} r="40" fill="none" stroke="#e8a86b" strokeWidth="0.5" opacity="0.2" strokeDasharray="4 4" />
                  </g>
                )
              }

              if (agent.type === "helicopter") {
                return (
                  <g key={agent.id}>
                    {/* Helicopter shadow */}
                    <ellipse cx={ax + 2} cy={ay + 3} rx="6" ry="3" fill="rgba(0,0,0,0.3)" />
                    {/* Helicopter body */}
                    <ellipse cx={ax} cy={ay} rx="6" ry="4" fill="#4a6080" stroke="#88aacc" strokeWidth="0.5" />
                    {/* Rotor */}
                    <line x1={ax - 8} y1={ay - 2} x2={ax + 8} y2={ay - 2} stroke="#88aacc" strokeWidth="1.5">
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${ax} ${ay - 2}`}
                        to={`360 ${ax} ${ay - 2}`}
                        dur="0.2s"
                        repeatCount="indefinite"
                      />
                    </line>
                    {/* Label */}
                    <text x={ax} y={ay + 12} textAnchor="middle" fill="#88ccff" fontSize="7" fontFamily="monospace">
                      {agent.name}
                    </text>
                  </g>
                )
              }

              // Ground crew
              return (
                <g key={agent.id}>
                  <circle cx={ax} cy={ay} r="4" fill="#806040" stroke="#ccaa77" strokeWidth="0.5" />
                  <circle cx={ax} cy={ay - 1} r="2" fill="#ccaa77" />
                  <text x={ax} y={ay + 10} textAnchor="middle" fill="#ccaa77" fontSize="6" fontFamily="monospace">
                    {agent.name}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Subtle grid overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
              `,
              backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
            }}
          />
        </div>
      </div>

      {/* Wind indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-2 rounded border border-amber-100/20">
        <div className="text-amber-100/70 text-xs font-mono uppercase tracking-wider">Wind</div>
        <svg width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#e8a86b" strokeWidth="1" opacity="0.4" />
          <line
            x1="12"
            y1="12"
            x2={12 + Math.cos((wind.direction - 90) * Math.PI / 180) * 7}
            y2={12 + Math.sin((wind.direction - 90) * Math.PI / 180) * 7}
            stroke="#e8a86b"
            strokeWidth="2"
            markerEnd="url(#arrow)"
          />
          <defs>
            <marker id="arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
              <polygon points="0,0 4,2 0,4" fill="#e8a86b" />
            </marker>
          </defs>
        </svg>
        <div className="text-amber-100 text-xs font-mono">{wind.speed}mph NE</div>
      </div>

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-2 rounded border border-amber-100/20">
        <div className="text-amber-100/70 text-xs font-mono uppercase tracking-wider mb-2">Legend</div>
        <div className="flex flex-col gap-1 text-xs font-mono">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: "#1a3a30" }} />
            <span className="text-amber-100/80">Forest</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: "#24443a" }} />
            <span className="text-amber-100/80">Valley</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: "#2a4a5a" }} />
            <span className="text-amber-100/80">Water</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: "#ff6b35" }} />
            <span className="text-amber-100/80">Fire</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: "#3d3545" }} />
            <span className="text-amber-100/80">Village</span>
          </div>
        </div>
      </div>

      {/* Scale indicator */}
      <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-2 rounded border border-amber-100/20">
        <div className="text-amber-100/70 text-xs font-mono uppercase tracking-wider mb-1">Scale</div>
        <div className="flex items-center gap-1">
          <div className="w-16 h-1 bg-amber-100/60" />
          <span className="text-amber-100/80 text-xs font-mono">1 km</span>
        </div>
      </div>

      {/* Vignette */}
      <div 
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(26, 21, 32, 0.7) 100%)"
        }}
      />
    </div>
  )
}
