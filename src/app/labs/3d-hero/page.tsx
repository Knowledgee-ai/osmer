import { Graph3D } from '@/components/memory-map/graph-3d';

/**
 * Internal smoke page for the 3D hero — uses the public sample
 * endpoint so it works without auth. Used to validate visuals.
 */
export default function Hero3DLabsPage() {
  return (
    <div className="fixed inset-0 bg-stone-900">
      <Graph3D src="/api/memory/map/sample" background="rgba(15,15,15,1)" />
    </div>
  );
}
