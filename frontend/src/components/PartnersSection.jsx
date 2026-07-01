import { useLayoutEffect, useRef, useState, memo } from "react";
import { motion }        from "framer-motion";
import { gsap }          from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const logos = [
  "/logos/cs3.png",
  "/logos/cs.png",
  "/logos/cs2.png",
  "/logos/cs3.png",
  "/logos/cs.png",
  "/logos/cs2.png",
  "/logos/cs3.png",
  "/logos/cs.png",
  "/logos/cs2.png",
];

function PartnersSection() {
  const [activeLogo, setActiveLogo] = useState(null);
  const sectionRef  = useRef(null);
  const labelRef    = useRef(null);
  const lineRef     = useRef(null);
  const trackRef    = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {

      /* ── Label + divider line slide in ──────────────────── */
      gsap.from(labelRef.current, {
        opacity: 0,
        y:       30,
        duration: 1.2,
        ease:    "expo.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start:   "top 85%",
        },
      });

      gsap.from(lineRef.current, {
        scaleY:  0,
        opacity: 0,
        duration: 1,
        ease:    "expo.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start:   "top 80%",
        },
      });

      /* ── Logo track fades up as a whole ─────────────────── */
      gsap.from(trackRef.current, {
        opacity: 0,
        y:       20,
        duration: 1.4,
        ease:    "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start:   "top 75%",
        },
      });

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-12 md:py-16 bg-[#000] [[data-theme=light]_&]:bg-[#ffffff] overflow-hidden border-y border-white/[0.03] [[data-theme=light]_&]:border-black/[0.08]"
    >
      {/* ── Top label ──────────────────────────────────────── */}
      <div ref={labelRef} className="flex flex-col items-center mb-10 opacity-40 [[data-theme=light]_&]:opacity-100">
        <span className="text-[10px] uppercase tracking-[0.5em] text-zinc-400 [[data-theme=light]_&]:text-black font-semibold">
          Integrated with Industry Leaders
        </span>
        <div
          ref={lineRef}
          className="w-px h-8 bg-gradient-to-b from-transparent via-zinc-800 [[data-theme=light]_&]:via-black to-transparent mt-4"
          style={{ transformOrigin: "top" }}
        />
      </div>

      {/* ── Marquee ────────────────────────────────────────── */}
      <div ref={trackRef} className="relative w-full">
        {/* Edge masks */}
        <div className="absolute inset-y-0 left-0 w-32 z-20 pointer-events-none bg-gradient-to-r from-black [[data-theme=light]_&]:from-white to-transparent [[data-theme=light]_&]:hidden" />
        <div className="absolute inset-y-0 right-0 w-32 z-20 pointer-events-none bg-gradient-to-l from-black [[data-theme=light]_&]:from-white to-transparent [[data-theme=light]_&]:hidden" />

        <motion.div
          className="flex items-center gap-16 md:gap-24 lg:gap-32 w-max"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, duration: 35, ease: "linear" }}
          style={{ willChange: "transform" }}
        >
          {[...logos, ...logos].map((logo, i) => (
            <div
              key={i}
              className="relative shrink-0 flex items-center justify-center group"
              onMouseEnter={() => setActiveLogo(i)}
              onMouseLeave={() => setActiveLogo(null)}
            >
              <img
                src={logo}
                alt="Partner"
                className={`h-7 md:h-9 lg:h-11 w-auto object-contain transition-all duration-700 ${
                  activeLogo === i
                    ? "brightness-150 grayscale-0 scale-110 [[data-theme=light]_&]:brightness-100 [[data-theme=light]_&]:grayscale-0 [[data-theme=light]_&]:opacity-100"
                    : "brightness-50 grayscale opacity-40 [[data-theme=light]_&]:brightness-100 [[data-theme=light]_&]:grayscale-0 [[data-theme=light]_&]:opacity-70"
                }`}
              />
              <div
                className={`absolute inset-0 blur-[30px] bg-purple-500/10 rounded-full scale-150 transition-opacity duration-700 pointer-events-none ${
                  activeLogo === i ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── Bottom reflection ──────────────────────────────── */}
      <div className="mt-12 flex justify-center opacity-10 [[data-theme=light]_&]:opacity-20">
        <div className="w-2/3 h-px bg-gradient-to-r from-transparent via-white [[data-theme=light]_&]:via-black to-transparent" />
      </div>
    </section>
  );
}

export default memo(PartnersSection);