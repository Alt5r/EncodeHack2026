import { WatchtowerScene } from "@/components/watchtower-scene"
import { AmbientAudio } from "@/components/ambient-audio"

export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#1a1520]">
      <WatchtowerScene />
      <AmbientAudio />
    </main>
  )
}
