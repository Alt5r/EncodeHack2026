"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

// Grid constants - larger geographic area
export const GRID_WIDTH = 60
export const GRID_HEIGHT = 40
export const TILE_SIZE = 16

// Types
type TileType = "forest" | "fire" | "burned" | "firebreak" | "water" | "village" | "road" | "valley" | "lake" | "river"

interface Tile {
  type: TileType
  elevation: number
  fireIntensity: number
}

interface Agent {
  id: string
  type: "watchtower" | "helicopter" | "ground-crew"
  name: string
  x: number
  y: number
  targetX?: number
  targetY?: number
  status: "idle" | "moving" | "acting"
  waterLevel?: number
}

interface RadioMessage {
  id: string
  timestamp: Date
  speaker: string
  role: "command" | "helicopter" | "ground"
  message: string
}

interface Wind {
  direction: number // degrees
  speed: number // mph
}

interface GameState {
  grid: Tile[][]
  agents: Agent[]
  messages: RadioMessage[]
  wind: Wind
  gameStatus: "running" | "won" | "lost"
  tick: number
}

interface GameContextType extends GameState {
  addMessage: (speaker: string, role: RadioMessage["role"], message: string) => void
}

const GameContext = createContext<GameContextType | null>(null)

export function useGame() {
  const context = useContext(GameContext)
  if (!context) throw new Error("useGame must be used within GameProvider")
  return context
}

// Simple noise function for terrain generation
function noise2D(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453
  return n - Math.floor(n)
}

function smoothNoise(x: number, y: number, scale: number, seed: number = 0): number {
  const sx = x / scale
  const sy = y / scale
  const x0 = Math.floor(sx)
  const y0 = Math.floor(sy)
  const fx = sx - x0
  const fy = sy - y0
  
  const n00 = noise2D(x0, y0, seed)
  const n10 = noise2D(x0 + 1, y0, seed)
  const n01 = noise2D(x0, y0 + 1, seed)
  const n11 = noise2D(x0 + 1, y0 + 1, seed)
  
  const nx0 = n00 * (1 - fx) + n10 * fx
  const nx1 = n01 * (1 - fx) + n11 * fx
  return nx0 * (1 - fy) + nx1 * fy
}

// Initialize grid with terrain features
function createInitialGrid(): Tile[][] {
  const grid: Tile[][] = []
  
  // Generate elevation map with multiple octaves
  // Quantize to 20 discrete levels to avoid floating point precision issues
  const elevationMap: number[][] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    elevationMap[y] = []
    for (let x = 0; x < GRID_WIDTH; x++) {
      let elevation = 0
      elevation += smoothNoise(x, y, 15, 1) * 0.5
      elevation += smoothNoise(x, y, 8, 2) * 0.3
      elevation += smoothNoise(x, y, 4, 3) * 0.2
      // Quantize to 20 levels (0.05 increments)
      elevationMap[y][x] = Math.round(elevation * 20) / 20
    }
  }
  
  // Define terrain features
  // Lakes - low elevation basins
  const lakes: Array<{cx: number, cy: number, rx: number, ry: number}> = [
    { cx: 12, cy: 8, rx: 4, ry: 3 },
    { cx: 45, cy: 25, rx: 5, ry: 4 },
    { cx: 25, cy: 30, rx: 3, ry: 2 },
  ]
  
  // River - flows from northwest to southeast
  const riverPath: Array<{x: number, y: number}> = []
  let rx = 5, ry = 0
  while (ry < GRID_HEIGHT) {
    riverPath.push({ x: Math.round(rx), y: ry })
    riverPath.push({ x: Math.round(rx) + 1, y: ry })
    rx += 0.3 + Math.sin(ry * 0.2) * 0.5
    ry += 1
  }
  
  // Valley - a low-elevation corridor
  const isValley = (x: number, y: number) => {
    const valleyCenter = 30 + Math.sin(y * 0.15) * 5
    const dist = Math.abs(x - valleyCenter)
    return dist < 4
  }
  
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row: Tile[] = []
    for (let x = 0; x < GRID_WIDTH; x++) {
      let elevation = elevationMap[y][x]
      
      // Check if in lake
      const inLake = lakes.some(lake => {
        const dx = (x - lake.cx) / lake.rx
        const dy = (y - lake.cy) / lake.ry
        return dx * dx + dy * dy < 1
      })
      
      // Check if in river
      const inRiver = riverPath.some(p => p.x === x && p.y === y)
      
      // Check if in valley - lower elevation
      const inValley = isValley(x, y)
      if (inValley) elevation *= 0.5
      
      // Village area in bottom-right
      const isVillageArea = x >= GRID_WIDTH - 8 && x <= GRID_WIDTH - 3 && 
                           y >= GRID_HEIGHT - 8 && y <= GRID_HEIGHT - 3
      
      // Roads
      const isRoadH = y === GRID_HEIGHT - 6 && x >= GRID_WIDTH - 15 && x <= GRID_WIDTH - 8
      const isRoadV = x === GRID_WIDTH - 6 && y >= GRID_HEIGHT - 15 && y <= GRID_HEIGHT - 8
      
      let type: TileType = "forest"
      if (inLake) {
        type = "lake"
        elevation = 0.1
      } else if (inRiver) {
        type = "river"
        elevation = 0.15
      } else if (isVillageArea) {
        type = "village"
      } else if (isRoadH || isRoadV) {
        type = "road"
      } else if (inValley) {
        type = "valley"
      }
      
      row.push({
        type,
        elevation,
        fireIntensity: 0,
      })
    }
    grid.push(row)
  }
  
  // Start fire at random point in upper-left quadrant
  const fireX = 15 + Math.floor(Math.random() * 10)
  const fireY = 5 + Math.floor(Math.random() * 8)
  if (grid[fireY][fireX].type === "forest" || grid[fireY][fireX].type === "valley") {
    grid[fireY][fireX] = { ...grid[fireY][fireX], type: "fire", fireIntensity: 1 }
  }
  
  return grid
}

// Initialize agents - spread across larger map
function createInitialAgents(): Agent[] {
  return [
    { id: "tower", type: "watchtower", name: "Command", x: 30, y: 20, status: "idle" },
    { id: "heli-1", type: "helicopter", name: "Alpha", x: 35, y: 8, status: "idle", waterLevel: 100 },
    { id: "heli-2", type: "helicopter", name: "Bravo", x: 42, y: 12, status: "idle", waterLevel: 100 },
    { id: "heli-3", type: "helicopter", name: "Charlie", x: 20, y: 15, status: "idle", waterLevel: 100 },
    { id: "ground-1", type: "ground-crew", name: "Team 1", x: 48, y: 30, status: "idle" },
    { id: "ground-2", type: "ground-crew", name: "Team 2", x: 50, y: 32, status: "idle" },
    { id: "ground-3", type: "ground-crew", name: "Team 3", x: 46, y: 34, status: "idle" },
    { id: "ground-4", type: "ground-crew", name: "Team 4", x: 52, y: 28, status: "idle" },
  ]
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [grid, setGrid] = useState<Tile[][]>(() => createInitialGrid())
  const [agents, setAgents] = useState<Agent[]>(() => createInitialAgents())
  const [messages, setMessages] = useState<RadioMessage[]>([])
  const [wind] = useState<Wind>({ direction: 45, speed: 12 })
  const [gameStatus, setGameStatus] = useState<"running" | "won" | "lost">("running")
  const [tick, setTick] = useState(0)

  const addMessage = useCallback((speaker: string, role: RadioMessage["role"], message: string) => {
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      timestamp: new Date(),
      speaker,
      role,
      message,
    }])
  }, [])

  // Initial radio message
  useEffect(() => {
    const timer = setTimeout(() => {
      addMessage("Command", "command", "All units, this is Command. Fire detected in sector northwest. Wind tracking northeast at 12 miles per hour. Alpha helicopter, move to intercept the leading edge. Bravo, hold position at the ridge. Ground teams, prepare firebreak south of the village perimeter.")
    }, 1500)
    return () => clearTimeout(timer)
  }, [addMessage])

  // Game loop - fire spread
  useEffect(() => {
    if (gameStatus !== "running") return

    const interval = setInterval(() => {
      setTick(t => t + 1)
      
      setGrid(currentGrid => {
        const newGrid = currentGrid.map(row => row.map(tile => ({ ...tile })))
        
        // Spread fire based on wind
        const windRad = (wind.direction * Math.PI) / 180
        const spreadX = Math.round(Math.cos(windRad))
        const spreadY = Math.round(Math.sin(windRad))
        
        for (let y = 0; y < GRID_HEIGHT; y++) {
          for (let x = 0; x < GRID_WIDTH; x++) {
            if (currentGrid[y][x].type === "fire") {
              // Spread to adjacent cells with wind bias
              const neighbors = [
                { dx: spreadX, dy: spreadY, prob: 0.35 },
                { dx: 1, dy: 0, prob: 0.12 },
                { dx: -1, dy: 0, prob: 0.08 },
                { dx: 0, dy: 1, prob: 0.12 },
                { dx: 0, dy: -1, prob: 0.08 },
                { dx: spreadX + 1, dy: spreadY, prob: 0.15 },
                { dx: spreadX, dy: spreadY + 1, prob: 0.15 },
              ]
              
              for (const { dx, dy, prob } of neighbors) {
                const nx = x + dx
                const ny = y + dy
                if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
                  const neighbor = newGrid[ny][nx]
                  // Fire can spread to forest and valleys, not water
                  const canBurn = neighbor.type === "forest" || neighbor.type === "valley"
                  if (canBurn && Math.random() < prob) {
                    newGrid[ny][nx] = { ...neighbor, type: "fire", fireIntensity: 0.5 }
                  } else if (neighbor.type === "village") {
                    setGameStatus("lost")
                  }
                }
              }
              
              // Burn out after a while
              if (currentGrid[y][x].fireIntensity > 0) {
                newGrid[y][x].fireIntensity = Math.min(1, currentGrid[y][x].fireIntensity + 0.1)
                if (newGrid[y][x].fireIntensity >= 1 && Math.random() < 0.1) {
                  newGrid[y][x] = { ...newGrid[y][x], type: "burned", fireIntensity: 0 }
                }
              }
            }
          }
        }
        
        return newGrid
      })
      
      // Move agents towards targets
      setAgents(currentAgents => 
        currentAgents.map(agent => {
          if (agent.targetX !== undefined && agent.targetY !== undefined) {
            const dx = agent.targetX - agent.x
            const dy = agent.targetY - agent.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            
            if (dist < 0.5) {
              return { ...agent, x: agent.targetX, y: agent.targetY, targetX: undefined, targetY: undefined, status: "idle" }
            }
            
            const speed = agent.type === "helicopter" ? 0.5 : 0.2
            return {
              ...agent,
              x: agent.x + (dx / dist) * speed,
              y: agent.y + (dy / dist) * speed,
              status: "moving" as const,
            }
          }
          return agent
        })
      )
    }, 800)

    return () => clearInterval(interval)
  }, [gameStatus, wind])

  // Simulated agent responses
  useEffect(() => {
    if (tick === 5) {
      addMessage("Alpha", "helicopter", "Alpha copies. Moving to grid northwest, ETA thirty seconds.")
    }
    if (tick === 10) {
      addMessage("Ground 1", "ground", "Ground Team 1 in position. Beginning firebreak at south treeline.")
    }
    if (tick === 15) {
      addMessage("Alpha", "helicopter", "Alpha, water drop complete. Suppression at sixty percent. Moving to secondary target.")
    }
    if (tick === 20) {
      addMessage("Bravo", "helicopter", "Bravo repositioning to cover north flank. Fire is spreading fast.")
    }
    if (tick === 25) {
      addMessage("Ground 2", "ground", "Ground Team 2, firebreak established. Fire is close. Requesting priority support.")
    }
    if (tick === 30) {
      addMessage("Command", "command", "Copy that, Ground 2. Bravo helicopter, redirect to south perimeter. Ground Team 1, reinforce the line.")
    }
  }, [tick, addMessage])

  return (
    <GameContext.Provider value={{ grid, agents, messages, wind, gameStatus, tick, addMessage }}>
      {children}
    </GameContext.Provider>
  )
}
