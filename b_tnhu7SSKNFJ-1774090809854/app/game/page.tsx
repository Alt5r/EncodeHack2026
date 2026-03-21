import { GameMap } from "@/components/game/game-map"
import { RadioPanel } from "@/components/game/radio-panel"
import { GameProvider } from "@/components/game/game-context"

export default function GamePage() {
  return (
    <GameProvider>
      <main className="relative flex h-screen w-full overflow-hidden bg-[#1a1520]">
        <div className="flex-1 relative">
          <GameMap />
        </div>
        <RadioPanel />
      </main>
    </GameProvider>
  )
}
