import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const CustomCursor = () => {
  const dotRef  = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const dot  = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    /* ── hide native cursor everywhere ─────────────────────── */
    document.documentElement.style.cursor = "none";

    /* ── initial position (centre of screen) ───────────────── */
    let mx = window.innerWidth  / 2;
    let my = window.innerHeight / 2;
    let rx = mx, ry = my;

    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: mx, y: my });

    /* ── quick setters for dot (instant) ───────────────────── */
    const xDot = gsap.quickTo(dot, "x", { duration: 0.08, ease: "none" });
    const yDot = gsap.quickTo(dot, "y", { duration: 0.08, ease: "none" });

    /* ── mouse move ─────────────────────────────────────────── */
    const onMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
      xDot(mx);
      yDot(my);
    };

    /* ── ring lag via RAF ticker ────────────────────────────── */
    const LAG = 0.095;
    const tick = () => {
      rx += (mx - rx) * LAG;
      ry += (my - ry) * LAG;
      gsap.set(ring, { x: rx, y: ry });
    };
    gsap.ticker.add(tick);

    /* ── click ripple ───────────────────────────────────────── */
    const onClick = () => {
      gsap.timeline()
        .to(ring, { scale: 0.75, duration: 0.12, ease: "power3.out" })
        .to(ring, { scale: 1,    duration: 0.5,  ease: "elastic.out(1, 0.45)" });
      gsap.timeline()
        .to(dot,  { scale: 2,    duration: 0.1,  ease: "power2.out" })
        .to(dot,  { scale: 1,    duration: 0.4,  ease: "elastic.out(1, 0.4)" });
    };

    /* ── hover states ───────────────────────────────────────── */
    const onEnter = (e) => {
      const el    = e.currentTarget;
      const tag   = el.tagName.toLowerCase();
      const isBtn = tag === "button" || el.getAttribute("role") === "button";

      /*
       * FIX #2 – Ring was growing way too large on hover.
       * Reduced from (btn: 2.8 / link: 1.8) → (btn: 1.5 / link: 1.25)
       * so it feels like a subtle enlargement, not a ballooning circle.
       */
      gsap.to(ring, {
        scale:           isBtn ? 1.5 : 1.25,
        borderColor:     "rgba(168,85,247,1)",
        backgroundColor: isBtn ? "rgba(168,85,247,0.08)" : "transparent",
        duration: 0.35,
        ease:     "power2.out",
      });
      gsap.to(dot, {
        scale:           isBtn ? 0   : 0.5,
        backgroundColor: "rgba(168,85,247,1)",
        duration: 0.25,
      });
    };

    const onLeave = () => {
      gsap.to(ring, {
        scale:           1,
        borderColor:     "rgba(255,255,255,0.45)",
        backgroundColor: "transparent",
        duration: 0.35,
        ease:     "power2.out",
      });
      gsap.to(dot, {
        scale:           1,
        backgroundColor: "#ffffff",
        duration: 0.25,
      });
    };

    /* ── visibility on window leave / enter ─────────────────── */
    const hide = () => gsap.to([dot, ring], { opacity: 0, duration: 0.3 });
    const show = () => gsap.to([dot, ring], { opacity: 1, duration: 0.3 });

    /* ── apply hover listeners (with MutationObserver) ──────── */
    const applyHovers = () => {
      document
        .querySelectorAll("a, button, [data-cursor-hover], input, textarea, select, label")
        .forEach((el) => {
          el.removeEventListener("mouseenter", onEnter);
          el.removeEventListener("mouseleave", onLeave);
          el.addEventListener("mouseenter",    onEnter);
          el.addEventListener("mouseleave",    onLeave);
        });
    };

    applyHovers();
    const mo = new MutationObserver(applyHovers);
    mo.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("mousemove", onMove);
    window.addEventListener("click",     onClick);
    document.documentElement.addEventListener("mouseleave", hide);
    document.documentElement.addEventListener("mouseenter", show);

    return () => {
      document.documentElement.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click",     onClick);
      document.documentElement.removeEventListener("mouseleave", hide);
      document.documentElement.removeEventListener("mouseenter", show);
      gsap.ticker.remove(tick);
      mo.disconnect();
    };
  }, []);

  return (
    <>
      <style>{`
        *, *::before, *::after { cursor: none !important; }

        .vs-cursor-dot {
          position: fixed;
          top: 0; left: 0;
          width: 7px; height: 7px;
          background: #ffffff;
          border-radius: 50%;
          pointer-events: none;
          z-index: 999999;
          will-change: transform;
          mix-blend-mode: difference;
        }

        .vs-cursor-ring {
          position: fixed;
          top: 0; left: 0;
          width: 40px; height: 40px;
          border: 1.5px solid rgba(255,255,255,0.45);
          border-radius: 50%;
          pointer-events: none;
          z-index: 999998;
          will-change: transform;
          transition: background-color 0.3s;
        }

        /* Restore cursor on touch devices */
        @media (hover: none) and (pointer: coarse) {
          .vs-cursor-dot,
          .vs-cursor-ring { display: none !important; }
          *, *::before, *::after { cursor: auto !important; }
        }
      `}</style>

      <div ref={dotRef}  className="vs-cursor-dot"  />
      <div ref={ringRef} className="vs-cursor-ring" />
    </>
  );
};

export default CustomCursor;
