import { useLayoutEffect, useRef, memo } from "react";
import { gsap }          from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Github, Linkedin, Twitter, Mail, Shield } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const Footer = () => {
  const footerRef  = useRef(null);
  const brandRef   = useRef(null);
  const colRefs    = useRef([]);
  const bottomRef  = useRef(null);

  const sections = {
    Platform:  [
      { name: "Intelligence",  href: "/ai"     },
      { name: "Neural Fix",    href: "/faq"     },
      { name: "Pi Proxy",      href: "/doc"     },
    ],
    Resources: [
      { name: "Documentation", href: "/doc"  },
      { name: "Security Blog", href: "/blog" },
      { name: "Research Paper",href: "/doc"  },
    ],
    Company:   [
      { name: "About Us",      href: "/about"   },
      { name: "Partners",      href: "/about"         },
      { name: "OSS Policy",    href: "/contact"         },
    ],
  };

  const socials = [
    { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
    { icon: Github,   href: "https://github.com",   label: "GitHub"   },
    { icon: Twitter,  href: "https://twitter.com",  label: "Twitter"  },
    { icon: Mail,     href: "mailto:info@vulnsneak.ai", label: "Email"},
  ];

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {

      /* ── Brand block slides up ───────────────────────────── */
      gsap.from(brandRef.current, {
        opacity:  0,
        y:        40,
        duration: 1.3,
        ease:     "expo.out",
        scrollTrigger: {
          trigger: footerRef.current,
          start:   "top 85%",
        },
      });

      /* ── Link columns stagger in ─────────────────────────── */
      gsap.from(colRefs.current, {
        opacity:  0,
        y:        30,
        stagger:  0.08,
        duration: 1.2,
        ease:     "expo.out",
        scrollTrigger: {
          trigger: footerRef.current,
          start:   "top 80%",
        },
      });

      /* ── Bottom bar slides up last ───────────────────────── */
      gsap.from(bottomRef.current, {
        opacity:  0,
        y:        20,
        duration: 1,
        ease:     "expo.out",
        scrollTrigger: {
          trigger:  bottomRef.current,
          start:    "top 95%",
        },
      });

    }, footerRef);

    return () => ctx.revert();
  }, []);

  return (
    <footer
      ref={footerRef}
      className="relative bg-black text-white pt-24 pb-12 overflow-hidden border-t border-white/3 font-inter"
    >
      {/* Subtle grid */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[40px_40px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-16 mb-20">

          {/* Brand */}
          <div ref={brandRef} className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6 group cursor-default">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white transition-colors group-hover:border-purple-500/50">
                <img 
                    src="/assets/icon1.svg" 
                    alt="icon" 
                    className="w-12 h-12 object-contain" 
                  />
              </div>
              <span className="text-2xl font-bold font-space tracking-tighter">VULNSNEAK</span>
            </div>

            <p className="text-zinc-500 text-sm font-light leading-relaxed max-w-xs mb-8">
              The autonomous AI security platform for modern intelligence. Built to master the shadows of source code.
            </p>

            <div className="flex items-center gap-4 text-[10px] font-mono tracking-widest text-zinc-600">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                SYSTEM: ACTIVE
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-purple-500" />
                INF: 2.0.4
              </div>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(sections).map(([title, links], i) => (
            <div
              key={title}
              ref={(el) => (colRefs.current[i] = el)}
              className="lg:col-span-1"
            >
              <h3 className="text-[11px] uppercase tracking-[0.3em] text-white font-bold mb-6">
                {title}
              </h3>
              <ul className="space-y-4">
                {links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm text-zinc-500 hover:text-white transition-colors duration-300 font-light"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Socials */}
          <div
            ref={(el) => (colRefs.current[3] = el)}
            className="lg:col-span-1"
          >
            <h3 className="text-[11px] uppercase tracking-[0.3em] text-white font-bold mb-6">
              Connect
            </h3>
            <div className="flex flex-wrap gap-4">
              {socials.map((s, i) => (
                <a
                  key={i}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-10 h-10 rounded-full border border-white/5 bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white hover:border-white/20 transition-all active:scale-90"
                >
                  <s.icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          ref={bottomRef}
          className="pt-8 border-t border-white/3 flex flex-col md:flex-row justify-between items-center gap-6"
        >
          <div className="text-[10px] text-zinc-600 tracking-[0.2em] font-mono">
            © {new Date().getFullYear()} VULNSNEAK INTELLIGENCE AGENTS.
          </div>
          <div className="flex items-center gap-8 text-[10px] text-zinc-600 tracking-[0.2em] font-mono">
            <a href="#" className="hover:text-white transition-colors">PRIVACY_PROTOCOL</a>
            <a href="#" className="hover:text-white transition-colors">SECURITY_SOP</a>
            <a href="#" className="hover:text-white transition-colors">STABILITY: 99.9%</a>
          </div>
        </div>
      </div>

      <style>{`
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
      `}</style>
    </footer>
  );
};

export default memo(Footer);
