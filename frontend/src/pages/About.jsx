import { useRef, useEffect, useState, memo, Suspense, lazy } from 'react';
import { gsap } from 'gsap';
import { motion } from 'framer-motion';
import { Github, Linkedin, Terminal, Shield, Cpu, Lock, Globe } from 'lucide-react';
import Footer from "../components/Footer";

const DarkVeil = lazy(() => import("../components/DarkVeil"));

const About = ({ items, radius = 250, damping = 0.5, fadeOut = 0.6 }) => {
  const rootRef = useRef(null);
  const fadeRef = useRef(null);
  const setX = useRef(null);
  const setY = useRef(null);
  const pos = useRef({ x: 0, y: 0 });

  // --- منطق المزامنة والانتظار ---
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let timeout;
    const triggerStart = () => {
      timeout = setTimeout(() => {
        setIsReady(true);
      }, 2000);
    };

    if (window.__vsTransitionDone) {
      triggerStart();
    } else {
      window.addEventListener("pageTransitionComplete", triggerStart, { once: true });
    }

    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener("pageTransitionComplete", triggerStart);
    };
  }, []);

  const team = [
    {
      id: "00",
      image: '/assets/team_pics/osama.png',
      name: 'Osama Sheta',
      role: 'Project Supervisor',
      rank: 'CHIEF_ADMIN',
      github: '#',
      linkedin: 'https://www.linkedin.com/in/osama-sheta-bb086484/'
    },
    {
      id: "01",
      image: '/assets/team_pics/Tom.jpeg',
      name: 'Hatem Waleed',
      role: 'UI Architect',
      rank: 'INTERFACE_EXPERT',
      github: 'https://github.com/Hatem-Walid',
      linkedin: 'https://www.linkedin.com/in/hatem-waleed-a256a1320/'
    },
    {
      id: "02",
      image: '/assets/team_pics/S7S.jpg',
      name: 'Mohamed Hussien',
      role: 'Cybersecurity Dev',
      rank: 'SR_AGENT',
      github: 'https://github.com/',
      linkedin: '#'
    },
    {
      id: "03",
      image: '/assets/team_pics/ibrahem.png',
      name: 'Ibrahim Mahmoud',
      role: 'Cybersecurity Dev',
      rank: 'SR_AGENT',
      github: '#',
      linkedin: 'https://www.linkedin.com/in/ibrahim-mahmoud-80b1a5358'
    },
    {
      id: "04",
      image: '/assets/team_pics/khaled.jpg',
      name: 'Mohamed Khaled',
      role: 'ML Engineer',
      rank: 'NEURAL_SPECIALIST',
      github: '#',
      linkedin: 'https://www.linkedin.com/in/mohamed-khalid-mk/'
    },
    {
      id: "05",
      image: '/assets/team_pics/joo.jpg',
      name: 'Youssef Amr',
      role: 'Cyber Security',
      rank: 'AGENT_FIELD',
      github: '#',
      linkedin: 'https://www.linkedin.com/in/youssif-amr-312a64284/'
    },
    {
      id: "06",
      image: '/assets/team_pics/zoz.png',
      name: 'Ziad Awad',
      role: 'Backend Developer',
      rank: 'CORE_ENGINEER',
      github: '#',
      linkedin: 'https://www.linkedin.com/in/ziad-awad-2450a4318'
    },
    {
      id: "07",
      image: '/assets/team_pics/mnss.png',
      name: 'Mohamed Mansour',
      role: 'Backend Developer',
      rank: 'CORE_ENGINEER',
      github: '#',
      linkedin: 'https://www.linkedin.com/in/mohamed-masnour/'
    },
    {
      id: "08",
      image: '/assets/team_pics/saber.jpg',
      name: 'Mahmoud Saber',
      role: 'Cyber Security',
      rank: 'AGENT_FIELD',
      github: '#',
      linkedin: 'https://www.linkedin.com/in/mahmoud-saber-013b54315'
    }
  ];

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setX.current = gsap.quickSetter(el, '--x', 'px');
    setY.current = gsap.quickSetter(el, '--y', 'px');
  }, []);

  const handleMove = e => {
    const r = rootRef.current.getBoundingClientRect();
    gsap.to(pos.current, {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      duration: damping,
      onUpdate: () => {
        setX.current?.(pos.current.x);
        setY.current?.(pos.current.y);
      }
    });
    gsap.to(fadeRef.current, { opacity: 0, duration: 0.3 });
  };

  return (
    <div 
      ref={rootRef}
      onPointerMove={handleMove}
      onPointerLeave={() => gsap.to(fadeRef.current, { opacity: 1, duration: fadeOut })}
      className="relative w-full min-h-screen bg-black overflow-hidden font-inter selection:bg-purple-500/30 in-data-[theme=light]:bg-[#f4f4f7]"
      style={{ '--r': `${radius}px`, '--x': '50%', '--y': '50%' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700&family=Space+Grotesk:wght@700&family=Space+Mono&display=swap');
        
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'Space Mono', monospace; }
        
        .agent-card {
          position: relative;
          background: rgba(10, 10, 10, 0.6);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          overflow: hidden;
          transition: all 0.5s;
        }

        /* كروت زجاجية تسمح بمرور الخلفية السائلة التفاعلية في وضع النهار */
        [data-theme=light] .agent-card {
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 15px 45px rgba(0,0,0,0.06);
        }

        [data-theme=light] .agent-card:hover {
          box-shadow: 0 25px 60px rgba(0,0,0,0.12);
          border-color: #c084fc;
        }

        .beam-border::before {
          content: "";
          position: absolute;
          inset: -1px;
          background: conic-gradient(from var(--angle), transparent 70%, #8b5cf6, #fff, #8b5cf6);
          border-radius: inherit;
          z-index: -1;
          animation: rotateBeam 3s linear infinite;
          opacity: 0;
          transition: opacity 0.4s;
        }

        .group:hover.beam-border::before { 
          opacity: 1; 
        }

        [data-theme=light] .beam-border::before { 
          display: none !important; 
        }

        @property --angle { 
          syntax: "<angle>"; 
          initial-value: 0deg; 
          inherits: false; 
        }

        @keyframes rotateBeam { 
          to { --angle: 360deg; } 
        }

        .corner-bracket {
          position: absolute; 
          width: 10px; 
          height: 10px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          z-index: 10;
        }

        [data-theme=light] .corner-bracket {
          border-color: rgba(0, 0, 0, 0.15);
        }

        .cb-tl { top: 12px; left: 12px; border-right: 0; border-bottom: 0; }
        .cb-tr { top: 12px; right: 12px; border-left: 0; border-bottom: 0; }
        .cb-bl { bottom: 12px; left: 12px; border-right: 0; border-top: 0; }
        .cb-br { bottom: 12px; right: 12px; border-left: 0; border-top: 0; }

        /* فلتر انعكاس الخلفية السائلة في وضع النهار */
        [data-theme=light] .dynamic-veil-container {
          filter: invert(1) hue-rotate(180deg) brightness(1.25);
          opacity: 0.65;
        }

        /* جزيئات خلفية الدارك واللايت الهندسية */
        :root { 
          --grid-line-color: rgba(255, 255, 255, 0.03); 
          --grid-size: 40px 40px;
        }

        [data-theme=light] { 
          --grid-line-color: rgba(0, 0, 0, 0.06); 
        }
      `}</style>

      {/* Grid Particles */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-100 z-0" 
        style={{ 
          backgroundImage: `radial-gradient(circle at 2px 2px, var(--grid-line-color) 1.5px, transparent 0)`, 
          backgroundSize: 'var(--grid-size)' 
        }} 
      />

      {/* 1. Background Layers (Dynamic Veil with Inversion Container) */}
      <Suspense fallback={null}>
        <div className="absolute inset-0 z-0 opacity-45 dynamic-veil-container">
          <DarkVeil />
        </div>
      </Suspense>

      {/* 2. Main Content Wrapper */}
      <motion.div
        className="relative z-40 w-full"
        initial={{ opacity: 0, y: 30 }}
        animate={isReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header Section */}
        <div className="pt-44 pb-20 flex flex-col items-center text-center px-6">
          <div className="flex items-center gap-3 mb-6 animate-pulse">
             <Shield size={14} className="text-purple-500 [[data-theme=light]_&]:text-purple-600" />
             <span className="text-[10px] font-mono tracking-[0.4em] text-zinc-500 [[data-theme=light]_&]:text-zinc-650 uppercase">Classified Personnel Roster</span>
          </div>
          <h2 className="text-5xl md:text-8xl font-bold font-space tracking-tighter text-white uppercase leading-[0.8] [[data-theme=light]_&]:text-zinc-950">
            THE <span className="text-zinc-800 italic [[data-theme=light]_&]:text-zinc-400">AGENTS.</span>
          </h2>
        </div>
        
        {/* The 4-Column Grid */}
        <div className="max-w-7xl mx-auto px-6 pb-44 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {team.map((c, i) => (
            <article
              key={i}
              className="group agent-card beam-border relative flex flex-col rounded-[24px] p-5 transition-all duration-500"
            >
              {/* Image Section */}
              <div className="relative aspect-square rounded-[18px] overflow-hidden mb-6 bg-zinc-900 [[data-theme=light]_&]:bg-zinc-100">
                 <div className="corner-bracket cb-tl"></div><div className="corner-bracket cb-tr"></div>
                 <div className="corner-bracket cb-bl"></div><div className="corner-bracket cb-br"></div>
                 
                 <img 
                   src={c.image} 
                   className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 [[data-theme=light]_&]:grayscale-0 [[data-theme=light]_&]:opacity-100 transition-all duration-1000" 
                   alt={c.name}
                 />
                 
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity [[data-theme=light]_&]:hidden"></div>
                 
                 {/* Socials Hover */}
                 <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                    <a href={c.github} target="_blank" rel="noreferrer" className="p-3 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full hover:bg-purple-500 hover:text-white transition-all [[data-theme=light]_&]:bg-black/10 [[data-theme=light]_&]:border-black/5 [[data-theme=light]_&]:text-zinc-900 [[data-theme=light]_&]:hover:text-white">
                      <Github size={18} />
                    </a>
                    <a href={c.linkedin} target="_blank" rel="noreferrer" className="p-3 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full hover:bg-blue-600 hover:text-white transition-all [[data-theme=light]_&]:bg-black/10 [[data-theme=light]_&]:border-black/5 [[data-theme=light]_&]:text-zinc-900 [[data-theme=light]_&]:hover:text-white">
                      <Linkedin size={18} />
                    </a>
                 </div>
              </div>

              {/* Content Section */}
              <div className="flex flex-col gap-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold font-space text-white leading-tight mb-1 [[data-theme=light]_&]:text-zinc-900">{c.name}</h3>
                    <p className="text-[10px] font-mono text-zinc-500 tracking-wider uppercase [[data-theme=light]_&]:text-zinc-750">{c.role}</p>
                  </div>
                  <div className="h-6 w-6 rounded-lg border border-white/5 bg-white/5 flex items-center justify-center text-zinc-700 font-mono text-[8px] [[data-theme=light]_&]:border-zinc-300 [[data-theme=light]_&]:bg-zinc-100 [[data-theme=light]_&]:text-zinc-850">
                     {c.id}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-y border-white/[0.03] py-4 [[data-theme=light]_&]:border-zinc-200">
                   <div className="flex flex-col gap-1">
                      <span className="text-[7px] font-mono text-zinc-600 uppercase tracking-widest [[data-theme=light]_&]:text-zinc-400">Clearance</span>
                      <span className="text-[9px] font-mono text-purple-400 [[data-theme=light]_&]:text-purple-700 font-bold">{c.rank}</span>
                   </div>
                   <div className="flex flex-col gap-1 text-right">
                      <span className="text-[7px] font-mono text-zinc-600 uppercase tracking-widest [[data-theme=light]_&]:text-zinc-400">Node_Status</span>
                      <div className="flex items-center justify-end gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                         <span className="text-[9px] font-mono text-zinc-300 [[data-theme=light]_&]:text-zinc-800 font-semibold">SECURE</span>
                      </div>
                   </div>
                </div>

                <div className="flex items-center justify-between opacity-10 group-hover:opacity-40 transition-opacity [[data-theme=light]_&]:opacity-30 [[data-theme=light]_&]:group-hover:opacity-60">
                   <div className="flex gap-3"><Cpu size={12} /><Lock size={12} /><Globe size={12} /></div>
                   <Terminal size={12} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </motion.div>

      {/* 3. Footer Section */}
      <div className="relative z-40 border-t border-white/[0.03] bg-black [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:border-t-zinc-200">
        <Footer />
      </div>

      {/* 4. Mouse Masking Layers (With opacity control for Light Mode) */}
      <div
        className="absolute inset-0 pointer-events-none z-30 [[data-theme=light]_&]:opacity-40"
        style={{
          backdropFilter: 'grayscale(1) brightness(0.8)',
          maskImage: `radial-gradient(circle var(--r) at var(--x) var(--y), transparent 0%, transparent 20%, rgba(0,0,0,0.4) 50%, black 100%)`,
          WebkitMaskImage: `radial-gradient(circle var(--r) at var(--x) var(--y), transparent 0%, transparent 20%, rgba(0,0,0,0.4) 50%, black 100%)`
        }}
      />
      <div ref={fadeRef} className="absolute inset-0 pointer-events-none z-50 bg-black/60 opacity-0" />
    </div>
  );
};

export default memo(About);