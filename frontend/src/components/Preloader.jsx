import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const Preloader = ({ finishLoading }) => {
  const loaderRef   = useRef(null);
  const textRef     = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline();

    tl
      /* 1. Text fades + slides up */
      .to(textRef.current, {
        opacity:  1,
        duration: 1,
        y:        0,
        ease:     "power4.out",
      })

      /* 2. Progress bar fills */
      .to(progressRef.current, {
        width:    "100%",
        duration: 2,
        ease:     "power2.inOut",
      })

      /* 3. Short hold so it feels intentional */
      .to({}, { duration: 0.3 })

      /* 4. Curtain exits upward */
      .to(loaderRef.current, {
        y:        "-100%",
        duration: 1.2,
        ease:     "expo.inOut",
        onComplete() {
          /* 
           * تفعيل العلم وإرسال الحدث للهيرو 
           */
          window.__vsTransitionDone = true;
          window.dispatchEvent(new CustomEvent("pageTransitionComplete"));
          
          // تأخير بسيط جداً قبل حذف البريلودر لضمان وصول الحدث
          setTimeout(() => finishLoading(), 50);
        },
      });

    /* Safety net: if something goes wrong, always finish */
    const safetyTimer = setTimeout(() => {
      window.__vsTransitionDone = true;
      window.dispatchEvent(new CustomEvent("pageTransitionComplete"));
      finishLoading();
    }, 6000);

    return () => {
      clearTimeout(safetyTimer);
      tl.kill();
    };
  }, [finishLoading]);

  return (
    <div
      ref={loaderRef}
      className="fixed inset-0 flex flex-col items-center justify-center bg-black"
      style={{ zIndex: 100000 }}
    >
      {/* Site name */}
      <div className="overflow-hidden mb-4">
        <h1
          ref={textRef}
          className="text-2xl md:text-4xl font-bold tracking-[0.4em] text-white opacity-0 translate-y-10"
        >
          VULN<span className="text-zinc-600">SNEAK</span>
        </h1>
      </div>

      {/* Thin progress bar */}
      <div className="w-48 h-[2px] bg-zinc-800 rounded-full overflow-hidden">
        <div
          ref={progressRef}
          className="w-0 h-full bg-purple-600 shadow-[0_0_15px_#9333ea]"
        />
      </div>

      <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-zinc-500 animate-pulse">
        Initializing Security Core...
      </p>
    </div>
  );
};

export default Preloader;