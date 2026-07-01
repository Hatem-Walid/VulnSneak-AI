import { useEffect, useRef, Suspense, lazy, memo } from "react";
import { gsap } from "gsap";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import { ArrowRight, ShieldCheck, Terminal, Globe } from "lucide-react";

const LiquidEther  = lazy(() => import("./DarkVeil"));
const Antigravity  = lazy(() => import("./Antigravity"));

function Hero() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const heroRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    let ctx;
    let didStart = false;

    const runHeroEntrance = () => {
      if (didStart) return;
      didStart = true;

      ctx = gsap.context(() => {
        const tl = gsap.timeline({ 
          delay: 1.5,
          defaults: { ease: "expo.out", duration: 2 } 
        });

        tl.from(".hero-line", { y: 120, opacity: 0, stagger: 0.15, skewY: 10 })
          .from(".hero-sub", { opacity: 0, y: 20 }, "-=1.5")
          .from(".hero-buttons", { opacity: 0, scale: 0.95 }, "-=1.2")
          .from(".scan-line", { scaleX: 0, opacity: 0, duration: 1.5 }, "-=1.8")
          .to(".floating-label", { opacity: 1, stagger: 0.2, duration: 1 }, "-=1");
      }, hero);
    };

    if (window.__vsTransitionDone) {
      runHeroEntrance();
    } else {
      window.addEventListener("pageTransitionComplete", runHeroEntrance, { once: true });
    }

    return () => {
      window.removeEventListener("pageTransitionComplete", runHeroEntrance);
      ctx?.revert();
    };
  }, []);

  return (
    <section 
      ref={heroRef} 
      className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#000] light:bg-[#f3f4f6] text-white light:text-[#121212] px-4 sm:px-6 overflow-hidden font-['Inter',sans-serif] transition-colors duration-500"
    >
      {/* 1. Background Layers */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#e5e7eb] via-[#f9fafb] to-[#f3f4f6] opacity-0 light:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="scan-line absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent shadow-[0_0_50px_rgba(168,85,247,0.5)]"></div>
        
        <Suspense fallback={null}>
          <div className="absolute inset-0 z-10 opacity-30 light:opacity-0 transition-opacity duration-500">
            <LiquidEther />
          </div>
        </Suspense>

        <div className="absolute inset-0 z-10 hidden light:block opacity-100 transition-opacity duration-500">
          <Suspense fallback={null}>
            <Antigravity
              count={300}
              magnetRadius={6}
              ringRadius={7}
              waveSpeed={0.4}
              waveAmplitude={1}
              particleSize={1.5}
              lerpSpeed={0.05}
              color="#5734ed"
              autoAnimate
              particleVariance={1}
              rotationSpeed={0}
              depthFactor={1}
              pulseSpeed={3}
              particleShape="capsule"
              fieldStrength={10}
            />
          </Suspense>
        </div>
      </div>

      {/* 2. Floating Technical Labels — already hidden below lg, no changes needed */}
      <div className="absolute top-12 left-12 hidden lg:flex flex-col gap-1 opacity-0 floating-label">
        <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 light:text-zinc-600 transition-colors">Core Engine</span>
        <span className="text-xs font-mono text-zinc-300 light:text-zinc-950 font-semibold transition-colors">v2.0.4-stable</span>
      </div>
      <div className="absolute top-12 right-12 hidden lg:flex flex-col items-end gap-1 opacity-0 floating-label">
        <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 light:text-zinc-600 transition-colors">Encryption</span>
        <span className="text-xs font-mono text-zinc-300 light:text-zinc-950 font-semibold transition-colors">AES-256-GCM</span>
      </div>

      {/* 3. Main Content */}
      {/* ROOT FIX: w-full here is what makes h1's w-full actually span the viewport.
          Without it the wrapper shrinks to content width, breaking text-center on the title. */}
      <div className="relative z-20 w-full flex flex-col items-center pointer-events-none">
        
        {/* Badge */}
        {/* FIX: tracking-[0.15em] on mobile so text fits one line; widens to 0.4em from sm+ */}
        <div className="hero-sub mb-2 px-3 py-1 rounded-full border border-white/10 light:border-black/15 bg-white/5 light:bg-black/[0.05] backdrop-blur-md overflow-hidden transition-colors">
          <p className="text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.4em] text-zinc-400 light:text-zinc-700 font-semibold transition-colors whitespace-nowrap">
            AI-Driven Security Architecture
          </p>
        </div>

        {/* Title */}
        {/* FIX: added text-center + w-full so each title line centers inside the flex column on narrow screens */}
        <h1 className="flex flex-col items-center text-center w-full mb-4 md:mb-6 xl:mb-10 overflow-hidden">
          <div className="hero-line w-full text-[13vw] sm:text-[12vw] md:text-[6.5rem] lg:text-[7.5rem] xl:text-[8.5rem] font-bold tracking-[-0.06em] leading-none">
            VULN<span className="text-zinc-600 light:text-zinc-400 transition-colors">SNEAK</span>
          </div>
          <div className="hero-line w-full text-[13vw] sm:text-[12vw] md:text-[6.5rem] lg:text-[7.5rem] xl:text-[8.5rem] font-bold tracking-[-0.06em] leading-[0.8] mt-[-10px]">
            INTELLIGENCE
          </div>
        </h1>

        {/* Tagline */}
        {/* FIX 4: mb-6 on md (short screens), scaling up only at xl */}
        <p className="hero-sub max-w-xl text-center text-zinc-500 light:text-zinc-700 text-base md:text-lg font-normal mb-6 md:mb-8 xl:mb-12 leading-relaxed transition-colors">
          The autonomous security platform that identifies critical vulnerabilities 
          in real-time. Built for <span className="text-zinc-200 light:text-zinc-950 transition-colors font-bold">modern dev teams</span> who prioritize safety.
        </p>
      </div>

       {/* Buttons — already responsive with flex-col sm:flex-row */}
      <div className="relative z-20 w-full flex flex-col items-center ">
        <div className="hero-buttons flex flex-col sm:flex-row items-center gap-4">
          <button 
            onClick={() => isAuthenticated ? navigate("/ai") : navigate("/auth")}
            className="h-12 px-8 rounded-full bg-white text-black light:bg-zinc-900 light:text-white text-sm font-semibold hover:bg-zinc-200 light:hover:bg-zinc-800 transition-colors flex items-center gap-2 group shadow-md"
          >
            Get Started
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button 
            onClick={() => navigate("/doc")}
            className="h-12 px-8 rounded-full border border-white/10 light:border-black/20 bg-white/5 light:bg-black/[0.03] backdrop-blur-md text-sm font-medium hover:bg-white/10 light:hover:bg-black/[0.08] text-white light:text-zinc-900 transition-colors shadow-sm"
          >
            Read Documentation
          </button>
        </div>
      </div>

      {/* 4. Bottom Grid */}
      {/* FIX 5: Changed md:flex → lg:flex — at md (1024px) the viewport can be short (600px Nest Hub)
               causing the absolute bar to overlap the buttons. Only show it at lg (1280px+) where
               there's reliably enough vertical room. */}
      <div className="absolute bottom-8 lg:bottom-12 left-6 lg:left-12 right-6 lg:right-12 z-20 hidden lg:flex justify-between items-end opacity-0 floating-label">
        <div className="flex gap-6 md:gap-8 lg:gap-10">
          <div className="flex flex-col gap-1">
            <ShieldCheck className="w-4 h-4 text-zinc-500 light:text-zinc-800 transition-colors" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 light:text-zinc-600 transition-colors">Security</span>
            <span className="text-xs text-zinc-300 light:text-zinc-950 font-bold transition-colors">Hardened</span>
          </div>
          <div className="flex flex-col gap-1">
            <Terminal className="w-4 h-4 text-zinc-500 light:text-zinc-800 transition-colors" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 light:text-zinc-600 transition-colors">Scanning</span>
            <span className="text-xs text-zinc-300 light:text-zinc-950 font-bold transition-colors">Neural-Net</span>
          </div>
          <div className="flex flex-col gap-1">
            <Globe className="w-4 h-4 text-zinc-500 light:text-zinc-800 transition-colors" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 light:text-zinc-600 transition-colors">Deployment</span>
            <span className="text-xs text-zinc-300 light:text-zinc-950 font-bold transition-colors">Global edge</span>
          </div>
        </div>
        
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 light:text-zinc-500 block mb-1 transition-colors">Status</span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs text-zinc-400 light:text-zinc-800 font-mono font-bold transition-colors">ALL SYSTEMS OPERATIONAL</span>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap');
      `}</style>
    </section>
  );
}

export default memo(Hero);