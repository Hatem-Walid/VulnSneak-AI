import { lazy, Suspense } from "react";

const HeroSection      = lazy(() => import("../components/HeroSection"));
const Highlights       = lazy(() => import("../components/Highlights"));
const AnimatedCards    = lazy(() => import("../components/AnimatedCards"));
const HighlightsSwap   = lazy(() => import("../components/HighlightsSwap"));
const Footer           = lazy(() => import("../components/Footer"));
const PartnersSection  = lazy(() => import("../components/PartnersSection"));
const AIWorkflow       = lazy(() => import("../components/AIWorkflow"));
const FlowingMenuSection = lazy(() => import("../components/FlowingMenuSection")); // ✅

const Home = () => (
  <Suspense fallback={
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
    </div>
  }>
    <HeroSection />
    <section style={{ background: "transparent" }}>
      <AIWorkflow />
    </section>
    <HighlightsSwap />
    <FlowingMenuSection />   
    <AnimatedCards />
    <Highlights />
    <PartnersSection />
    <Footer />
  </Suspense>
);

export default Home;