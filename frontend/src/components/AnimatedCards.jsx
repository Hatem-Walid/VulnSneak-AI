import React, {
  useEffect, useLayoutEffect, useRef, useState, memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap }          from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ChevronLeft, ChevronRight,
  Fingerprint, Cpu, ShieldCheck, Activity,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const AUTOPLAY_MS = 6000;

const features = [
  {
    id:      1,
    name:    "Neural Detection Engine",
    role:    "Static Analysis",
    company: "XSS, SQLi, CSRF",
    quote:   "Uses fine-tuned Transformer-based models to perform deep semantic analysis, detecting security vulnerabilities with higher precision than rule-based systems.",
    icon:    <Fingerprint size={18} />,
  },
  {
    id:      2,
    name:    "Context-Aware Repair",
    role:    "Remediation",
    company: "Seq2Seq Learning",
    quote:   "Generates secure code patches using context-aware sequence learning, ensuring syntactic correctness while preserving original application logic.",
    icon:    <ShieldCheck size={18} />,
  },
  {
    id:      3,
    name:    "Semantic Understanding",
    role:    "Core Logic",
    company: "Language Models",
    quote:   "Goes beyond pattern matching by understanding the structural representation of source code using industry-leading pretrained language models.",
    icon:    <Activity size={18} />,
  },
  {
    id:      4,
    name:    "Raspberry Pi Isolation",
    role:    "Hardware Layer",
    company: "Secure Proxy",
    quote:   "Implements a dedicated hardware isolation layer to enforce privilege separation and secure communication between the UI and AI services.",
    icon:    <Cpu size={18} />,
  },
];

function FeaturesSection() {
  const [index,     setIndex]     = useState(0);
  const autoplayRef  = useRef(null);
  const sectionRef   = useRef(null);
  const leftRef      = useRef(null);
  const rightRef     = useRef(null);
  const badgeRef     = useRef(null);
  const [isInView, setIsInView] = useState(true);

  const handleNext = () => setIndex((p) => (p + 1) % features.length);
  const handlePrev = () => setIndex((p) => (p - 1 + features.length) % features.length);

  /* ── Autoplay ───────────────────────────────────────────────── */
  useEffect(() => {
    if (isInView) {
      autoplayRef.current = setInterval(handleNext, AUTOPLAY_MS);
    } else {
      clearInterval(autoplayRef.current);
    }
    return () => clearInterval(autoplayRef.current);
  }, [isInView, index]);

  /* ── GSAP section entrance ───────────────────────────────────── */
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {

      /* Badge */
      gsap.from(badgeRef.current, {
        opacity:  0,
        y:        20,
        duration: 1.2,
        ease:     "expo.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start:   "top 82%",
        },
      });

      /* Left panel slides from left */
      gsap.from(leftRef.current, {
        opacity:   0,
        x:        -80,
        duration:  1.4,
        ease:      "expo.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start:   "top 78%",
        },
      });

      /* Right card scales + fades from right */
      gsap.from(rightRef.current, {
        opacity:   0,
        x:         80,
        scale:     0.94,
        duration:  1.5,
        ease:      "expo.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start:   "top 78%",
        },
      });

      /* In-view detection for autoplay */
      ScrollTrigger.create({
        trigger:  sectionRef.current,
        start:    "top bottom",
        end:      "bottom top",
        onToggle: (self) => setIsInView(self.isActive),
      });

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-screen flex items-center bg-[#000] [[data-theme=light]_&]:bg-[#ffffff] py-24 overflow-hidden border-t border-white/[0.03] [[data-theme=light]_&]:border-black/[0.05] transition-colors duration-500"
    >
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-purple-900/10 [[data-theme=light]_&]:bg-purple-500/5 blur-[150px] rounded-full pointer-events-none transition-colors" />

      {/* ── السهم الكروكل الملفوف المضيء والتفاعلي في منتصف الشاشة (يظهر فقط في الوضع الفاتح) ── */}
      <div className="absolute left-[44%] top-[45%] z-20 hidden lg:block pointer-events-none opacity-0 [[data-theme=light]_&]:opacity-100 transition-opacity duration-500">
        <motion.div
          animate={{ y: [0, -6, 0], rotate: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="relative flex flex-col items-center text-black"
        >
          <svg viewBox="0 0 160 80" className="w-46 h-28">
            <path 
              d="M10,80 Q40,15 75,45 T145,25" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeDasharray="6 4" 
            />
            <path 
              d="M142,15 L158,22 L148,38" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-purple-500 mt-2 font-bold bg-purple-50/80 px-2 py-0.5 rounded-full border border-purple-200/50 backdrop-blur-md">
            system features
          </span>
        </motion.div>
      </div>
      {/* ────────────────────────────────────────────────────────────────────────── */}

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

          {/* ── LEFT ────────────────────────────────────────── */}
          <div ref={leftRef} className="max-w-xl">
            <div ref={badgeRef} className="mb-6 flex items-center gap-3">
              <div className="w-8 h-px bg-purple-500" />
              <span className="text-[10px] uppercase tracking-[0.4em] text-purple-500 font-bold">Capabilities</span>
            </div>

            <h2 className="text-4xl md:text-6xl font-bold font-space tracking-tight text-white [[data-theme=light]_&]:text-black mb-8 leading-[1.1] transition-colors">
              INTELLIGENT <br />
              <span className="text-zinc-600 [[data-theme=light]_&]:text-transparent [[data-theme=light]_&]:bg-clip-text [[data-theme=light]_&]:bg-gradient-to-r [[data-theme=light]_&]:from-purple-600 [[data-theme=light]_&]:to-indigo-600 transition-all duration-500">
                DEFENSE SYSTEM.
              </span>
            </h2>

            <p className="text-zinc-500 [[data-theme=light]_&]:text-zinc-700 text-lg font-inter font-light leading-relaxed mb-12 transition-colors">
              Our dual-model architecture separates detection and repair to provide
              a high-fidelity security pipeline tailored for modern developers.
            </p>

            {/* Controls */}
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrev}
                  className="p-4 rounded-full border border-white/5 [[data-theme=light]_&]:border-black/[0.2] bg-white/5 [[data-theme=light]_&]:bg-black/[0.2] hover:bg-white/10 [[data-theme=light]_&]:hover:bg-black/[0.06] hover:border-white/20 [[data-theme=light]_&]:hover:border-black/20 transition-all active:scale-95 text-white [[data-theme=light]_&]:text-zinc-800"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={handleNext}
                  className="p-4 rounded-full border border-white/5 [[data-theme=light]_&]:border-black/[0.2] bg-white/5 [[data-theme=light]_&]:bg-black/[0.2] hover:bg-white/10 [[data-theme=light]_&]:hover:bg-black/[0.06] hover:border-white/20 [[data-theme=light]_&]:hover:border-black/20 transition-all active:scale-95 text-white [[data-theme=light]_&]:text-zinc-800"
                >
                  <ChevronRight size={20} />
                </button>

                <div className="flex-1 h-[2px] bg-white/10 [[data-theme=light]_&]:bg-black/[0.08] relative overflow-hidden transition-colors">
                  <motion.div
                    key={index}
                    initial={{ x: "-100%" }}
                    animate={{ x: "0%" }}
                    transition={{ duration: AUTOPLAY_MS / 1000, ease: "linear" }}
                    className="absolute inset-0 bg-purple-500"
                  />
                </div>
                <span className="font-mono text-[10px] text-zinc-600 [[data-theme=light]_&]:text-zinc-500 transition-colors">
                  0{index + 1} / 0{features.length}
                </span>
              </div>

              {/* Stats - كبسولات بيضاء ناصعة متباينة جداً بحدود رمادية ناعمة في الفاتح */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-white/[0.03] [[data-theme=light]_&]:border-black/[0.06] bg-zinc-950/50 [[data-theme=light]_&]:bg-[#fcfdfe] shadow-sm [[data-theme=light]_&]:shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-600 [[data-theme=light]_&]:text-zinc-500 block mb-1 transition-colors">Status</span>
                  <span className="text-xs text-zinc-300 [[data-theme=light]_&]:text-zinc-900 font-mono font-bold transition-colors">Neural Net Active</span>
                </div>
                <div className="p-4 rounded-2xl border border-white/[0.03] [[data-theme=light]_&]:border-black/[0.06] bg-zinc-950/50 [[data-theme=light]_&]:bg-[#fcfdfe] shadow-sm [[data-theme=light]_&]:shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-600 [[data-theme=light]_&]:text-zinc-500 block mb-1 transition-colors">Inference</span>
                  <span className="text-xs text-zinc-300 [[data-theme=light]_&]:text-zinc-900 font-mono font-bold transition-colors">240ms Avg Latency</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT (carousel card with Hover Parallax Glow) ── */}
          <div
            ref={rightRef}
            className="relative flex justify-center lg:justify-end h-[450px] items-center"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={features[index].id}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{    opacity: 0, scale: 1.05, y: -20 }}
                whileHover={{ 
                  y: -8, 
                  scale: 1.01,
                  boxShadow: "0 30px 60px rgba(139, 92, 246, 0.12)"
                }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-lg cursor-pointer"
              >
                {/* البطاقة الزجاجية المعتمة فائقة النقاوة والجمال في الوضع الفاتح (Real Glassmorphism) */}
                <div className="relative group overflow-hidden rounded-3xl border border-white/[0.08] [[data-theme=light]_&]:border-black/20 bg-zinc-900/20 [[data-theme=light]_&]:bg-white/10 backdrop-blur-3xl p-10 md:p-12 shadow-2xl transition-all duration-500">
                  
                  {/* طبقة الانعكاس الضوئي الزجاجي الفخمة في الوضع الفاتح (Glass Reflection Layer) */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 [[data-theme=light]_&]:opacity-100 transition-opacity pointer-events-none" />
                  
                  <div className="absolute top-0 left-1/4 right-1/4 h-px bg-linear-to-r from-transparent via-purple-500/50 to-transparent" />

                  {/* صندوق الأيقونة البنفسجي */}
                  <div className="mb-8 w-12 h-12 rounded-2xl bg-purple-500/10 in-data-[theme=light]:bg-purple-500/10 border border-purple-500/20 [[data-theme=light]_&]:border-purple-500/20 flex items-center justify-center text-purple-400 [[data-theme=light]_&]:text-purple-600 transition-colors duration-500">
                    {features[index].icon}
                  </div>

                  <h3 className="text-2xl md:text-3xl font-bold font-space text-white [[data-theme=light]_&]:text-black mb-4 tracking-tight transition-colors duration-500">
                    {features[index].name}
                  </h3>

                  {/* تباين الخط المقتبس أصبح حاداً ومريحاً جداً للعين وقابل للقراءة بلمحة واحدة */}
                  <blockquote className="text-zinc-400 [[data-theme=light]_&]:text-zinc-800 text-base md:text-lg font-inter font-stretch-75% leading-relaxed mb-8 transition-colors duration-500">
                    "{features[index].quote}"
                  </blockquote>

                  <div className="pt-8 border-t border-white/[0.05] [[data-theme=light]_&]:border-black/[0.4] flex items-center justify-between transition-colors duration-500">
                    <div>
                      <div className="text-[12px] uppercase tracking-[0.2em] text-zinc-600 [[data-theme=light]_&]:text-purple-500 mb-1 transition-colors">Architecture Layer</div>
                      <div className="text-xs font-semibold text-zinc-300 [[data-theme=light]_&]:text-zinc-800 tracking-wide transition-colors">
                        {features[index].role} — {features[index].company}
                      </div>
                    </div>
                    <div className="h-8 w-8 rounded-full border border-white/10 [[data-theme=light]_&]:border-black/10 flex items-center justify-center text-zinc-600 [[data-theme=light]_&]:text-zinc-500 text-[10px] font-mono transition-colors">
                      ID
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <style>{`
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
      `}</style>
    </section>
  );
}

export default memo(FeaturesSection);