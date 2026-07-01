import React, { useLayoutEffect, useEffect, useRef, useState, memo } from "react";
import { gsap }          from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useNavigate }   from "react-router-dom";
import { useAuth }       from "../context/AuthContext";
import {
  Shield, Code, GitBranch, BarChart3, Workflow,
  Users, Server, Cpu, Lock, Zap, Globe, ArrowRight,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const CheckmarkOneSection = () => {
  const [activeCard, setActiveCard] = useState(null);
  const navigate    = useNavigate();
  const { isAuthenticated } = useAuth();

  const sectionRef  = useRef(null);
  const headerRef   = useRef(null);
  const badgeRef    = useRef(null);
  const titleRef    = useRef(null);
  const gridRef     = useRef(null);
  const ctaRef      = useRef(null);
  const cardRefs    = useRef([]);

  const handleStartTrial = () =>
    isAuthenticated ? navigate("/ai") : navigate("/auth");

  const featureGroups = [
    {
      id: 1, title: "User Enablement", icon: <Users size={18} />,
      items: [
        { label: "Target Users",      value: "Developers",  icon: <Users     size={14} /> },
        { label: "CI-CD Integration", value: "Pipeline",    icon: <GitBranch size={14} /> },
        { label: "Languages",         value: "Multi-Stack", icon: <Code      size={14} /> },
        { label: "AI Models",         value: "Transformer", icon: <Cpu       size={14} /> },
      ],
    },
    {
      id: 2, title: "Unified Scanning", icon: <BarChart3 size={18} />,
      items: [
        { label: "Classification",   value: "CWE/OWASP", icon: <BarChart3 size={14} /> },
        { label: "SAST Analysis",    value: "Neural",    icon: <Shield    size={14} /> },
        { label: "Input Validation", value: "Checkers",  icon: <Lock      size={14} /> },
        { label: "Repair Logic",     value: "Auto-Fix",  icon: <Zap       size={14} /> },
      ],
    },
    {
      id: 3, title: "Compliance Layer", icon: <Globe size={18} />,
      items: [
        { label: "Standards",  value: "OWASP Top 10",  icon: <Globe     size={14} /> },
        { label: "Validation", value: "Human-In-Loop", icon: <Users     size={14} /> },
        { label: "Isolation",  value: "Pi Proxy",      icon: <Shield    size={14} /> },
        { label: "Reporting",  value: "Detailed",      icon: <BarChart3 size={14} /> },
      ],
    },
    {
      id: 4, title: "Core Remediation", icon: <Zap size={18} />,
      items: [
        { label: "Code Review",    value: "Interactive",  icon: <Code      size={14} /> },
        { label: "Fix Generation", value: "Automated",    icon: <Server    size={14} /> },
        { label: "CI/CD Friendly", value: "v1.0 Ready",   icon: <GitBranch size={14} /> },
        { label: "Control",        value: "Full Dev-SOP", icon: <Shield    size={14} /> },
      ],
    },
  ];

  /* ─────────────────────────────────────────────────────────────
   * FIX #3 – Cards weren't showing because ScrollTrigger had
   * calculated positions while the page-transition panel was
   * covering the screen (so element offsets were wrong / trigger
   * never fired).
   *
   * Solution:
   *  1. Set the "invisible" initial state with gsap.set() in
   *     useLayoutEffect so elements are hidden from the start
   *     (no flash).
   *  2. Register ScrollTriggers normally.
   *  3. When "pageTransitionComplete" fires, call
   *     ScrollTrigger.refresh() so every trigger re-measures
   *     using the final, visible layout.
   * ─────────────────────────────────────────────────────────────*/

  /* Step 1 – hide everything immediately (before first paint) */
  useLayoutEffect(() => {
    gsap.set([badgeRef.current, titleRef.current], { opacity: 0, y: 50 });
    gsap.set(cardRefs.current.filter(Boolean),     { opacity: 0, y: 60, scale: 0.94 });
    gsap.set(ctaRef.current,                       { opacity: 0, y: 50, scale: 0.96 });
  }, []);

  /* Step 2 – register animations (ScrollTrigger handles "when") */
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {

      /* Header elements stagger in */
      gsap.to([badgeRef.current, titleRef.current], {
        opacity:  1,
        y:        0,
        stagger:  0.15,
        duration: 1.4,
        ease:     "expo.out",
        scrollTrigger: {
          trigger: headerRef.current,
          start:   "top 85%",
          once:    true,
        },
      });

      /* Bento cards */
      gsap.to(cardRefs.current.filter(Boolean), {
        opacity:  1,
        y:        0,
        scale:    1,
        stagger:  0.1,
        duration: 1.3,
        ease:     "expo.out",
        scrollTrigger: {
          trigger: gridRef.current,
          start:   "top 88%",
          once:    true,
        },
      });

      /* CTA card */
      gsap.to(ctaRef.current, {
        opacity:  1,
        y:        0,
        scale:    1,
        duration: 1.4,
        ease:     "expo.out",
        scrollTrigger: {
          trigger: ctaRef.current,
          start:   "top 88%",
          once:    true,
        },
      });

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  /* Step 3 – refresh ScrollTrigger after page transition ends */
  useEffect(() => {
    const onTransitionDone = () => {
      /*
       * Small rAF delay makes sure the DOM has fully painted
       * before ScrollTrigger re-measures all trigger positions.
       */
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });
    };

    window.addEventListener("pageTransitionComplete", onTransitionDone, { once: true });

    return () => {
      window.removeEventListener("pageTransitionComplete", onTransitionDone);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-32 bg-[#000] [[data-theme=light]_&]:bg-[#f3f4f6] text-white [[data-theme=light]_&]:text-black overflow-hidden border-t border-white/[0.03] [[data-theme=light]_&]:border-black/[0.06]"
    >
      {/* Background mesh — hidden in light mode to avoid dark smear on white */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#1a1a1a,transparent_70%)] opacity-50 [[data-theme=light]_&]:opacity-0" />

      <div className="relative max-w-7xl mx-auto px-6">

        {/* ── Header ─────────────────────────────────────────── */}
        <div ref={headerRef} className="text-center mb-24">

          {/* Badge */}
          <div
            ref={badgeRef}
            className="inline-block px-3 py-1 rounded-full border border-white/5 [[data-theme=light]_&]:border-black/[0.2] bg-white/5 [[data-theme=light]_&]:bg-black/[1] mb-6"
          >
            <span className="text-[10px] uppercase tracking-[0.5em] text-zinc-500 [[data-theme=light]_&]:text-zinc-100 font-bold">
              Platform Overview
            </span>
          </div>

          {/* Title */}
          <h2 ref={titleRef} className="text-5xl md:text-7xl font-bold font-space tracking-tight mb-4">
            NEXT-GEN SECURITY <br />
            <span className="text-zinc-600 [[data-theme=light]_&]:text-zinc-400">INFRASTRUCTURE.</span>
          </h2>
        </div>

        {/* ── Bento Grid ─────────────────────────────────────── */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {featureGroups.map((group, i) => (
            <div
              key={group.id}
              ref={(el) => (cardRefs.current[i] = el)}
              onMouseEnter={() => setActiveCard(group.id)}
              onMouseLeave={() => setActiveCard(null)}
              className={`
                group relative h-full
                bg-zinc-950/50 [[data-theme=light]_&]:bg-white/50
                [[data-theme=light]_&]:backdrop-blur-2xl
                [[data-theme=light]_&]:shadow-[0_12px_40px_rgba(0,0,0,0.06)]
                border border-white/[0.05] [[data-theme=light]_&]:border-black/[0.06]
                rounded-2xl p-6
                transition-all duration-500
                hover:bg-zinc-900/40 [[data-theme=light]_&]:hover:bg-white/80
                hover:border-white/[0.15] [[data-theme=light]_&]:hover:border-black/[0.12]
                hover:-translate-y-2 hover:scale-[1.01]
                hover:shadow-[0_20px_50px_rgba(147,51,234,0.18)]
                [[data-theme=light]_&]:hover:shadow-[0_20px_50px_rgba(147,51,234,0.12)]
              `}
            >
              {/* Card header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-lg bg-white/5 [[data-theme=light]_&]:bg-black/[0.04] text-zinc-400 [[data-theme=light]_&]:text-zinc-600 group-hover:text-purple-400 [[data-theme=light]_&]:group-hover:text-purple-600 group-hover:bg-purple-500/10 [[data-theme=light]_&]:group-hover:bg-purple-500/10 transition-colors">
                  {group.icon}
                </div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200 [[data-theme=light]_&]:text-zinc-800">
                  {group.title}
                </h3>
              </div>

              {/* Feature rows */}
              <div className="space-y-4">
                {group.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between group/item">
                    <div className="flex items-center gap-2">
                      {/* Row icon */}
                      <span className="text-zinc-600 [[data-theme=light]_&]:text-zinc-500 group-hover:text-zinc-400 [[data-theme=light]_&]:group-hover:text-zinc-600 group-hover/item:text-purple-500 [[data-theme=light]_&]:group-hover/item:text-purple-600 transition-colors">
                        {item.icon}
                      </span>
                      {/* Row label */}
                      <span className="text-[11px] text-zinc-500 [[data-theme=light]_&]:text-zinc-600 font-inter">
                        {item.label}
                      </span>
                    </div>
                    {/* Value badge */}
                    <span className="text-[10px] font-mono text-zinc-300 [[data-theme=light]_&]:text-zinc-700 bg-white/5 [[data-theme=light]_&]:bg-black/[0.04] px-2 py-0.5 rounded border border-white/[0.03] [[data-theme=light]_&]:border-black/[0.06]">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Glow */}
              <div
                className={`absolute inset-0 bg-purple-500/[0.02] blur-3xl rounded-full transition-opacity duration-700 pointer-events-none ${
                  activeCard === group.id ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          ))}
        </div>

        {/* ── CTA Card (Anchor Console - Stays Dark) ───────────────────────── */}
        <div
          ref={ctaRef}
          className="mt-28 md:mt-36 relative rounded-3xl p-1 md:p-[1px] bg-gradient-to-r from-zinc-800 via-white/20 to-zinc-800 overflow-hidden"
        >
          <div className="relative bg-[#000] rounded-[23px] px-8 py-16 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-2xl">
              <img 
              src="/assets/icon-7.svg" 
              alt="icon" 
              className="w-12 h-12 object-contain" 
            />
            </div>

            <h3 className="text-3xl md:text-5xl font-bold font-space text-white mb-6 tracking-tight">
              READY TO SECURE <br /> YOUR SYSTEM?
            </h3>

            <p className="text-zinc-500 text-lg font-inter font-light max-w-xl mb-10 leading-relaxed">
              Join the future of autonomous security. Deploy{" "}
              <span className="text-white">VulnSneak AI</span> to your pipeline and master the shadows.
            </p>

            <button
              onClick={handleStartTrial}
              className="h-14 px-12 rounded-full bg-white text-black font-bold hover:bg-zinc-200 transition-all flex items-center gap-3 group active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
            >
              Launch Engine
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>

            {/* تم تحديد لون النصوص هنا إلى text-zinc-500 */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 opacity-30">
              <span className="text-[8px] font-mono text-zinc-100 uppercase tracking-[0.3em]">Build: Stable-2.0</span>
              <span className="text-[8px] font-mono text-zinc-100 uppercase tracking-[0.3em]">Latency: 120ms</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
      `}</style>
    </section>
  );
};

export default memo(CheckmarkOneSection);