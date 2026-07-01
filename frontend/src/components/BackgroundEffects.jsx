import { memo, Suspense, lazy } from "react";

const DarkVeil = lazy(() => import("../components/DarkVeil"));

const BackgroundEffects = memo(() => {
  return (
    <>
      {/* Grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, var(--grid-line-color) 1.5px, transparent 0)`,
          backgroundSize: "var(--grid-size)",
        }}
      />
      {/* DarkVeil */}
      <Suspense fallback={null}>
        <div className="fixed inset-0 z-0 opacity-45 dynamic-veil-container">
          <DarkVeil />
        </div>
      </Suspense>
    </>
  );
});

BackgroundEffects.displayName = "BackgroundEffects";
export default BackgroundEffects;