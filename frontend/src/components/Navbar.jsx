import { useLayoutEffect, useRef, useState, useEffect, memo } from 'react';
import { gsap } from 'gsap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Settings, LogOut, ChevronRight, Sun, Moon } from 'lucide-react';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsLight(true);
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'dark');
      setIsLight(false);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
      setIsLight(true);
    }
  };

  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef   = useRef(null);
  const cardsRef = useRef([]);
  const tlRef    = useRef(null);

  const items = [
    {
      label: "PLATFORM",
      links: [
        { label: "Intelligence Home", href: "/" },
        { label: "Neural Assistant",  href: "/ai" },
      ],
    },
    {
      label: "RESOURCES",
      links: [
        { label: "Security Blog",  href: "/blog" },
        { label: "Documentation",  href: "/doc"  },
        { label: "System FAQ",     href: "/faq"  },
      ],
    },
    {
      label: "COMPANY",
      links: [
        { label: "Team Members",    href: "/About"   },
        { label: "Contact Secure",  href: "/contact" },
      ],
    },
  ];

  const ease = "expo.out";

  const handleLinkClick = (e, href) => {
    toggleMenu();
    if (href === '/ai' && !isAuthenticated) {
      e.preventDefault();
      navigate('/auth');
    }
  };

  const calculateHeight = () =>
    window.matchMedia('(max-width: 768px)').matches ? (window.innerHeight - 100) : 300;

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;
    gsap.set(navEl, { height: 64, overflow: 'hidden' });
    gsap.set(cardsRef.current, { y: 30, opacity: 0 });
    const tl = gsap.timeline({ paused: true });
    tl.to(navEl, { height: calculateHeight(), duration: 0.6, ease });
    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.5, ease, stagger: 0.1 }, '-=0.3');
    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    return () => { tl?.kill(); tlRef.current = null; };
  }, []);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const lineBase = [
    'w-full h-[1.5px] transition-all duration-500',
    isLight ? 'bg-zinc-800' : 'bg-white',
  ].join(' ');

  const iconBtn = isLight
    ? 'border-black/[0.05] bg-black/[0.03] text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.06]'
    : 'border-white/[0.08] bg-white/[0.05] text-zinc-400 hover:text-white hover:bg-white/[0.10]';

  return (
    <div className="navbar-container absolute left-1/2 -translate-x-1/2 w-[92%] max-w-[1000px] z-[999] top-4 sm:top-6 font-inter">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@700&display=swap');
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
      `}</style>

      <nav
        ref={navRef}
        className={`navbar block h-[64px] rounded-2xl shadow-xl relative overflow-hidden border ${
          isLight ? 'border-black/[0.06]' : 'border-white/[0.08]'
        }`}
        style={{
          backgroundColor: isLight ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
          backdropFilter:       'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* ── Top bar ── */}
        <div className="navbar-top absolute inset-x-0 top-0 h-[64px] flex items-center justify-between px-4 z-[2]">

          {/* Hamburger */}
          <div
            className="group flex items-center gap-3 cursor-pointer"
            onClick={toggleMenu}
          >
            <div className="relative w-6 h-5 flex flex-col justify-between">
              <span className={`${lineBase} ${isHamburgerOpen ? 'rotate-45 translate-y-[9px]' : ''}`} />
              <span className={`${lineBase} ${isHamburgerOpen ? 'opacity-0' : ''}`} />
              <span className={`${lineBase} ${isHamburgerOpen ? '-rotate-45 -translate-y-[9px]' : ''}`} />
            </div>
            <span className={`text-[10px] uppercase tracking-[0.3em] font-bold hidden sm:block ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              {isExpanded ? 'Close' : 'Menu'}
            </span>
          </div>

          {/* Centered logo */}
          <Link to="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 group">
            <img
              src={isLight ? "/assets/Gemini.svg" : "/assets/icon1.svg"}
              alt="VULNSNEAK Logo"
              className="h-15 w-auto transition-opacity group-hover:opacity-80"
            />
          </Link>

          {/* Right section */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
              className={`p-2 rounded-full border transition-all ${iconBtn}`}
            >
              {isLight ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <Link
                  to="/info"
                  className={`p-2 rounded-full border transition-all ${iconBtn}`}
                >
                  <Settings size={16} />
                </Link>

                <div className="hidden sm:flex flex-col items-end">
                  <span className={`text-[10px] uppercase tracking-widest font-bold ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Active Agent
                  </span>
                  <span className={`text-xs font-medium ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                    {user?.name || "User"}
                  </span>
                </div>

                <button
                  onClick={logout}
                  className="p-2 rounded-full border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className={`h-10 px-4 sm:px-6 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center whitespace-nowrap ${
                  isLight
                    ? 'bg-zinc-900 text-white hover:bg-zinc-700 shadow-[0_4px_20px_rgba(0,0,0,0.06)]'
                    : 'bg-white text-black hover:bg-zinc-200 shadow-[0_4px_20px_rgba(255,255,255,0.10)]'
                }`}
              >
                Login
              </Link>
            )}
          </div>
        </div>

        {/* ── Expanded bento cards ── */}
        <div
          className={`nav-content absolute inset-x-0 top-[64px] bottom-0 p-2 md:p-3 flex flex-col md:flex-row gap-2 md:gap-3 overflow-y-auto md:overflow-hidden items-stretch ${
            isExpanded ? 'visible' : 'invisible'
          }`}
        >
          {items.map((item, idx) => (
            <div
              key={idx}
              ref={el => { if (el) cardsRef.current[idx] = el; }}
              className={`flex-1 self-stretch rounded-xl p-4 md:p-6 flex flex-col transition-all backdrop-blur-md group/card ${
                isLight
                  ? 'bg-white/40 border border-black/[0.04] hover:border-black/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.01)]'
                  : 'bg-zinc-950/80 border border-white/[0.03] hover:border-white/10'
              }`}
            >
              <h3 className={`text-[10px] uppercase tracking-[0.4em] font-bold mb-4 group-hover/card:text-purple-500 transition-colors ${
                isLight ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                {item.label}
              </h3>

              <div className="flex flex-col gap-3 md:gap-4">
                {item.links.map((lnk, i) => (
                  <Link
                    key={i}
                    to={lnk.href}
                    onClick={(e) => handleLinkClick(e, lnk.href)}
                    className={`flex items-center justify-between transition-all group/link ${
                      isLight ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="text-sm md:text-base font-light font-inter">{lnk.label}</span>
                    <ChevronRight
                      size={14}
                      className="opacity-0 group-hover/link:opacity-100 group-hover/link:translate-x-1 transition-all"
                    />
                  </Link>
                ))}
              </div>

              <div className={`mt-auto pt-3 border-t flex justify-between items-center ${
                isLight ? 'border-black/[0.04]' : 'border-white/[0.02]'
              }`}>
                <span className="text-[8px] font-mono tracking-widest">LAYER_0{idx + 1}</span>
                <div className="w-1 h-1 rounded-full bg-green-400" />
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default memo(Navbar);