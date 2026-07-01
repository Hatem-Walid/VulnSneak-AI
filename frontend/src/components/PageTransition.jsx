import { useRef, useLayoutEffect } from "react";
import { useLocation }             from "react-router-dom";
import { gsap }                    from "gsap";

/* ── Route label map ─────────────────────────────────────────── */
const LABELS = {
  "/":        "HOME",
  "/About":   "AGENTS.",
  "/ai":      "AI ENGINE",
  "/faq":     "FAQ",
  "/doc":     "DOCS",
  "/blog":    "BLOG",
  "/contact": "CONTACT",
  "/auth":    "ACCESS",
  "/info":    "PROFILE",
};

const PageTransition = ({ children }) => {
  const location  = useLocation();
  const panelRef  = useRef(null);
  const labelRef  = useRef(null);
  const subRef    = useRef(null);
  const firstRun  = useRef(true);

  /* ── On mount: hide panel (no transition on cold load) ──────── */
  useLayoutEffect(() => {
    gsap.set(panelRef.current, { scaleY: 0, transformOrigin: "bottom center" });
  }, []);

  /* ── Trigger on every route change (except first) ───────────── */
  useLayoutEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }

    const panel = panelRef.current;
    const label = labelRef.current;
    const sub   = subRef.current;

    /*
     * FIX #4 – Cover the screen IMMEDIATELY before the new page paints.
     * useLayoutEffect fires synchronously before the browser paints, so
     * setting scaleY:1 here means the overlay is already fully visible
     * on the very first frame the user sees.
     */
    gsap.set(panel, { scaleY: 1, transformOrigin: "top center" });
    gsap.set(label, { opacity: 0, y: 30 });
    gsap.set(sub,   { opacity: 0 });

    const tl = gsap.timeline({ defaults: { ease: "expo.inOut" } });

    tl
      /* 1. Label appears while panel is covering the screen */
      .to(label, { opacity: 1, y: 0,  duration: 0.45, ease: "power3.out" }, 0.1)
      .to(sub,   { opacity: 1,        duration: 0.35, ease: "power2.out" }, "-=0.2")

      /* 2. Breathe – hold so it feels relaxed, not rushed */
      .to({}, { duration: 0.55 })

      /* 3. Fade out text */
      .to([label, sub], { opacity: 0, duration: 0.3, ease: "power2.in" })

      /* 4. Panel wipes UP off screen – reveals the new page */
      .set(panel,  { transformOrigin: "top center" })
      .to(panel, {
        scaleY:   0,
        duration: 0.85,
        ease:     "expo.inOut",
        onComplete() {
          /*
           * FIX #1 / #3 – Signal that the transition is done.
           * HeroSection listens for this to start its animations,
           * Highlights listens to refresh ScrollTrigger.
           */
          window.dispatchEvent(new CustomEvent("pageTransitionComplete"));
        },
      });

    return () => tl.kill();
  }, [location.pathname]);

  const label = LABELS[location.pathname] ?? "···";

  return (
    <>
      {/* ── Overlay panel ──────────────────────────────────────── */}
      <div
        ref={panelRef}
        style={{
          position:       "fixed",
          inset:          0,
          zIndex:         99990,
          background:     "#000",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          pointerEvents:  "none",
          gap:            "12px",
        }}
      >
        {/* Big route name */}
        <div
          ref={labelRef}
          style={{
            color:         "rgba(255,255,255,0.07)",
            fontSize:      "clamp(4rem, 12vw, 10rem)",
            fontWeight:    900,
            letterSpacing: "-0.04em",
            fontFamily:    "'Space Grotesk', sans-serif",
            lineHeight:    1,
            userSelect:    "none",
          }}
        >
          {label}
        </div>

        {/* Thin progress bar */}
        <div
          ref={subRef}
          style={{
            width:      "120px",
            height:     "1px",
            background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.8), transparent)",
            boxShadow:  "0 0 20px rgba(168,85,247,0.5)",
          }}
        />
      </div>

      {children}
    </>
  );
};

export default PageTransition;
