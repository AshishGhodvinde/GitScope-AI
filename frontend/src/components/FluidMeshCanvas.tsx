import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function FluidMeshCanvas() {
  const [mounted, setMounted] = useState(false);
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/repository/');

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-0 overflow-hidden pointer-events-none select-none transition-opacity duration-1000 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        background: 'var(--canvas-bg)',
        transition: 'background-color 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      aria-hidden="true"
    >
      {/* Subtle grid mesh overlay */}
      <div className="absolute inset-0 bg-grid opacity-[0.15] dark:opacity-[0.07] mix-blend-overlay pointer-events-none" />

      {/* Hide shifting mesh gradients entirely inside a workspace to keep panels solid and performant */}
      {!isWorkspace && (
        <>
          {/* Layer 1: Sapphire Indigo / Whisper Sky Blue */}
          <div
            className="absolute rounded-full filter blur-[120px] opacity-[0.45] dark:opacity-[0.38] mix-blend-normal dark:mix-blend-screen"
            style={{
              width: '55vw',
              height: '55vw',
              top: '-10%',
              left: '-10%',
              background: 'var(--mesh-color-1)',
              animation: 'meshDrift1 36s ease-in-out infinite alternate',
              transform: 'translate3d(0, 0, 0)',
              willChange: 'transform',
            }}
          />

          {/* Layer 2: Sunset Coral / Soft Milk Cream */}
          <div
            className="absolute rounded-full filter blur-[130px] opacity-[0.35] dark:opacity-[0.22] mix-blend-normal dark:mix-blend-screen"
            style={{
              width: '48vw',
              height: '48vw',
              bottom: '-12%',
              right: '-5%',
              background: 'var(--mesh-color-2)',
              animation: 'meshDrift2 42s ease-in-out infinite alternate',
              transform: 'translate3d(0, 0, 0)',
              willChange: 'transform',
            }}
          />

          {/* Layer 3: Aurora Teal / Rose Pastel */}
          <div
            className="absolute rounded-full filter blur-[110px] opacity-[0.38] dark:opacity-[0.25] mix-blend-normal dark:mix-blend-screen"
            style={{
              width: '45vw',
              height: '45vw',
              top: '30%',
              left: '35%',
              background: 'var(--mesh-color-3)',
              animation: 'meshDrift3 48s ease-in-out infinite alternate',
              transform: 'translate3d(0, 0, 0)',
              willChange: 'transform',
            }}
          />

          {/* Layer 4: Soft helper gradient for background depth */}
          <div
            className="absolute rounded-full filter blur-[140px] opacity-[0.25] dark:opacity-[0.18] mix-blend-normal dark:mix-blend-screen"
            style={{
              width: '60vw',
              height: '60vw',
              bottom: '25%',
              left: '-15%',
              background: 'var(--mesh-color-4)',
              animation: 'meshDrift4 54s ease-in-out infinite alternate',
              transform: 'translate3d(0, 0, 0)',
              willChange: 'transform',
            }}
          />
        </>
      )}
    </div>
  );
}
