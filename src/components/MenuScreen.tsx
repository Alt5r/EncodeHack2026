'use client';

import AmbientAudioToggle from '@/components/AmbientAudioToggle';
import WatchtowerScene from '@/components/WatchtowerScene';

interface MenuScreenProps {
  onDeployDefault: () => void;
  onWriteDoctrine: () => void;
}

export default function MenuScreen({ onDeployDefault, onWriteDoctrine }: MenuScreenProps) {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#1a1520]">
      <WatchtowerScene
        onDeployDefault={onDeployDefault}
        onWriteDoctrine={onWriteDoctrine}
      />
      <AmbientAudioToggle />
    </main>
  );
}
