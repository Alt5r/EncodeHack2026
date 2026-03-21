import MapCanvas from '@/components/MapCanvas';
import RadioViewer from '@/components/RadioViewer';
import { DEFAULT_PARAMS } from '@/lib/terrain';

export default function Home() {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <MapCanvas params={DEFAULT_PARAMS} />
      <RadioViewer />
    </div>
  );
}
