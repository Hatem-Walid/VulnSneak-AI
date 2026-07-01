import React, { memo, useRef, useEffect } from 'react';
import CardSwap, { Card } from './CardSwap'; 
import { TrendingUp, Globe, MessageSquare, LayoutDashboard, Cpu } from 'lucide-react';
import { gsap } from 'gsap';

const HighlightsSwap = () => {
  const innerContainerRef = useRef(null);

  useEffect(() => {
    const element = innerContainerRef.current;
    if (!element) return;

    const anim = gsap.fromTo(element, 
      { 
        scale: 0.25, 
        opacity: 1 
      },
      { 
        scale: 1, 
        opacity: 1, 
        ease: "power2.out",
        scrollTrigger: {
          trigger: element,
          start: "top 102%",
          end: "top 45%",
          scrub: 1,
        }
      }
    );

    return () => {
      anim.scrollTrigger?.kill();
      anim.kill();
    };
  }, []);

  const swapCards = [
    {
      title: "VulnSneak AI",
      subtitle: "Effortless scanning with a modern interface.",
      desc: "VulnSneak is an AI-powered platform for system security and architecture. It helps you brainstorm, visualize, and fix software vulnerabilities using natural language.",
      image: "/assets/slide2.png",
      icon: <MessageSquare className="h-8 w-8 text-white" />
    },
    {
      title: "Neural Pipeline",
      subtitle: "Flexible templates for every security workflow.",
      desc: "Load pre-built security patterns and customize them either by dragging directly into the dashboard or by answering follow-up questions for guided editing.",
      image: "/assets/slide1.png",
      icon: <LayoutDashboard className="h-8 w-8 text-white" />
    },
    {
      title: "Secure Remediation",
      subtitle: "Real-time patching keep your code safe.",
      desc: "Use the engine to design secure software architecture just by dragging components and also you can use the code editor to sync fixes with your repository.",
      image: "/assets/slide3.png",
      icon: <Cpu className="h-8 w-8 text-white" />
    }
  ];

  return (
    // السكشن الخارجي فقط (المحدد بالأزرق) يتحول للأبيض الصافي السادة في الوضع الفاتح
    <section className="w-full min-h-screen bg-[#000] light:bg-[#ffffff] flex items-center justify-center p-6 md:p-12 overflow-hidden transition-colors duration-500">
      
      {/* التعديل السحري هنا: جعلنا الخلفية معتمة بالكامل bg-[#080808] لتمنع تسرب اللون الأبيض وتظل مظلمة بالكامل (المحددة بالأخضر) */}
      <div 
        ref={innerContainerRef}
        className="max-w-6xl w-full flex flex-col items-center justify-center border border-white/10 rounded-[32px] overflow-hidden relative isolate bg-[#080808] shadow-2xl"
      >
        
        {/* الـ SVG Glow الخلفي مقتبس من السورس كود */}
        <svg viewBox="0 0 1024 1024" aria-hidden="true" className="absolute top-1/2 left-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 mask-[radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0 pointer-events-none">
          <circle r="512" cx="512" cy="512" fill="url(#primary-glow)" fillOpacity="0.3"></circle>
          <defs>
            <radialGradient id="primary-glow">
              <stop stopColor="#8b5cf6"></stop>
              <stop offset="1" stopColor="#000"></stop>
            </radialGradient>
          </defs>
        </svg>

        <div className="w-full flex flex-col md:flex-row items-center justify-between overflow-hidden py-16 md:py-0">
          
          {/* الجانب الأيسر: المحتوى */}
          <div className="max-w-2xl w-full px-10 flex flex-col items-center md:items-start space-y-10 overflow-hidden text-center md:text-left">
            
            <div className="flex border border-white/10 p-1 pl-3 pr-2 rounded-full bg-white/5 gap-2 items-center text-xs uppercase tracking-widest font-mono group overflow-hidden">
              <TrendingUp className="h-3 w-3 text-zinc-500" />
              
              <span className="relative inline-block">
                <span className="text-zinc-600 font-bold">Trusted by security experts worldwide</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent bg-[length:200%_100%] animate-shimmer-fast bg-clip-text text-transparent font-bold">
                  Trusted by security experts worldwide
                </span>
              </span>

              <Globe className="h-3 w-3 text-zinc-500" />

              <style>{`
                @keyframes shimmer-fast {
                  0% { background-position: 200% 0; }
                  100% { background-position: -200% 0; }
                }
                .animate-shimmer-fast {
                  animation: shimmer-fast 2.5s linear infinite;
                }
              `}</style>
            </div>

            {/* Counter Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-center md:justify-start space-x-3">
                <span className="text-5xl md:text-7xl font-bold font-space text-white tracking-tighter">1,360</span>
                <span className="text-4xl md:text-6xl font-light text-purple-500">+</span>
              </div>
              <p className="text-sm md:text-base max-w-sm text-zinc-500 font-inter">
                Critical system vulnerabilities identified and patched with AI-driven precision.
              </p>
            </div>

            {/* Logo / Brand */}
            <div className="flex items-center gap-0 group">
              <div className="relative pt-1">
                <img 
                  src="/assets/icon1.svg" 
                  alt="VulnSneak Logo" 
                  className="h-16 md:h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_25px_rgba(139,92,246,0.5)]"
                />
                <div className="absolute inset-0 bg-purple-500/10 blur-3xl rounded-full scale-150 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              </div>
               <h3 className="text-4xl md:text-6xl font-bold font-space text-white tracking-tighter uppercase">
                  VULN<span className="text-zinc-800 transition-colors group-hover:text-zinc-600 italic">SNEAK</span>
               </h3>
              </div>
          </div>

          {/* الجانب الأيمن: Card Swap */}
          <div className="w-full md:flex-1 flex justify-center md:justify-end mt-12 md:mt-0 select-none px-4">
            <div className="md:h-[600px] h-[350px] relative w-full flex items-center justify-end">
              <CardSwap
                width={550}
                height={430}
                cardDistance={40}
                verticalDistance={45}
                delay={5000}
                skewAmount={6}
              >
                {swapCards.map((card, idx) => (
                  <Card key={idx} className="p-0 border-white/10 shadow-2xl overflow-hidden bg-[#080808]">
                    {/* Header مقتبس من السورس */}
                    <div className="p-4 bg-zinc-900/50 border-b border-white/5 flex flex-row items-center gap-4">
                       <div className="p-2 rounded-lg bg-white/5">
                        {card.icon}
                       </div>
                       <div>
                          <h4 className="text-white font-bold text-sm uppercase tracking-tight">{card.title}</h4>
                          <p className="text-[10px] text-zinc-500 font-inter leading-tight">{card.subtitle}</p>
                       </div>
                    </div>
                    {/* Image Area */}
                    <div className="relative h-[200px] bg-zinc-950 overflow-hidden">
                       <img alt="" className="w-full h-full object-cover opacity-50 grayscale group-hover:grayscale-0 transition-all duration-700" src={card.image} />
                       <div className="absolute inset-0 bg-gradient-to-t from-[#080808] to-transparent" />
                    </div>
                    {/* Text Footer Area */}
                    <div className="p-5 text-xs text-zinc-400 leading-relaxed font-light">
                       {card.desc}
                    </div>
                  </Card>
                ))}
              </CardSwap>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default memo(HighlightsSwap);