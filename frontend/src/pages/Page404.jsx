import React, { useState, useEffect, useRef } from 'react';

const Page404 = () => {
  // حالة لتخزين إحداثيات التحريك الحالية للصورة
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // نستخدم refs لتخزين القيم المستهدفة (target) دون التسبب في إعادة render مستمر
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const requestRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // حساب المسافة من منتصف الشاشة
      const mouseX = Math.max(-100, Math.min(100, windowWidth / 2 - e.clientX));
      const mouseY = Math.max(-100, Math.min(100, windowHeight / 2 - e.clientY));

      // المعادلة الأصلية: (20 * lMouseX) / 100
      targetRef.current = {
        x: (20 * mouseX) / 100,
        y: (10 * mouseY) / 100
      };
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    // دالة التحريك (Animation Loop) لمحاكاة الاحتكاك (Friction)
    const animate = () => {
      const friction = 1 / 30;
      const target = targetRef.current;
      const current = currentRef.current;

      // تطبيق معادلة الحركة الناعمة
      current.x += (target.x - current.x) * friction;
      current.y += (target.y - current.y) * friction;

      // تحديث الحالة لتحريك الصورة
      setOffset({ ...current });

      requestRef.current = requestAnimationFrame(animate);
    };

    // بدء الحركة
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div className="h-screen w-full bg-linear-to-t from-[#202239] to-[#8595AC] flex items-center justify-center font-roboto selection:bg-[#CDD4DE] overflow-hidden">
      
      {/* الكارت الرئيسي */}
      <div className="relative w-[800px] h-[600px] bg-[#0D0C1E] rounded-[10px] overflow-hidden shadow-[0_5px_15px_rgba(0,0,0,0.3)] z-10 group">
        
        {/* الهيدر */}
        <header className="flex justify-between items-center p-[30px] relative z-20">
          
          {/* أيقونة القائمة (Hamburger) */}
          <div className="w-[18px] h-[18px] cursor-pointer relative">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-[#565c73] rounded-xs shadow-[0_5px_0_#565c73,0_10px_0_#565c73]"></div>
          </div>

          {/* الشعار - تم وضعه بشكل مطلق ليكون في المنتصف تماماً */}
          <div className="absolute left-1/2 transform -translate-x-1/2 top-[30px] text-center">
            <svg viewBox="0 0 61 14" className="w-[61px] h-3.5">
              <path fillRule="evenodd" clipRule="evenodd" fill="#525C7C" d="M29.117,0.98h-1.846l-2.407,11.551h6.045l0.334-1.62h-4.198 L29.117,0.98z M40.132,0.98l-3.365,5.285l-1.2-5.285h-1.885l1.854,7.182l-0.926,4.369h1.854l0.889-4.337l4.853-7.214H40.132z M8.529,2.125C7.771,1.362,6.688,0.98,5.282,0.98H2.407L0,12.531h3.124c1.339,0,2.505-0.286,3.497-0.861 c0.992-0.573,1.748-1.392,2.267-2.457c0.52-1.063,0.779-2.309,0.779-3.737C9.667,4.006,9.288,2.889,8.529,2.125z M7.201,8.351 c-0.366,0.821-0.892,1.46-1.577,1.913c-0.686,0.452-1.488,0.679-2.407,0.679H2.166L3.934,2.56h1.137 c0.873,0,1.537,0.254,1.994,0.762S7.751,4.57,7.751,5.539C7.751,6.592,7.567,7.53,7.201,8.351z M20.128,12.531h1.831L24.382,0.98 H22.55L20.128,12.531z M15.314,0.964l-6.1,11.567h1.979l1.627-3.208H16.6l0.319,3.208h1.823L17.448,0.964H15.314z M13.632,7.68 l1.339-2.655c0.452-0.885,0.821-1.693,1.106-2.425c0,0.274,0.015,0.642,0.043,1.102c0.029,0.461,0.147,1.787,0.354,3.979H13.632z M44.33,0l-2.662,14h16.67L61,0H44.33z M52.584,8.584c-0.265,1.279-0.755,2.229-1.473,2.849c-0.719,0.62-1.67,0.931-2.854,0.931 c-1.025,0-1.816-0.254-2.376-0.762c-0.561-0.508-0.839-1.236-0.839-2.19c0-0.397,0.047-0.805,0.141-1.222l1.367-6.473h1.679 l-1.359,6.501c-0.1,0.422-0.149,0.801-0.149,1.136c0,0.488,0.141,0.867,0.422,1.139c0.28,0.271,0.707,0.405,1.277,0.405 c0.685,0,1.229-0.192,1.63-0.577c0.401-0.386,0.694-1.013,0.879-1.88l1.408-6.724h1.68L52.584,8.584z M56.034,12.221h-1.665 l2.203-10.504h1.664L56.034,12.221z"/>
            </svg>
          </div>

          {/* البحث */}
          <div className="cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-4 h-4">
               <path fillRule="evenodd" clipRule="evenodd" fill="#4F5269" d="M14.769,14.769c-0.342,0.342-0.896,0.342-1.237,0l-3.756-3.756 c-2.399,1.793-5.801,1.623-7.981-0.557c-2.392-2.392-2.392-6.271,0-8.663s6.271-2.392,8.662,0c2.18,2.181,2.35,5.583,0.557,7.981 l3.756,3.756C15.11,13.873,15.11,14.427,14.769,14.769z M9.219,3.032c-1.709-1.709-4.479-1.709-6.188,0 c-1.708,1.708-1.708,4.479,0,6.188c1.709,1.708,4.479,1.708,6.188,0C10.927,7.51,10.927,4.74,9.219,3.032z"/>
            </svg>
          </div>
        </header>

        {/* المحتوى */}
        <div className="text-center pt-[100px] text-[#CDD4DE] relative z-20">
          <h1 className="font-black text-[165px] leading-none -mb-2.5 opacity-60">404</h1>
          <h2 className="font-bold text-[34px] mb-1.5 opacity-90">Page not found</h2>
          <p className="font-light text-[14px] opacity-70 mb-[140px]">I tried to catch some fog, but i mist</p>
          <a className="inline-block font-light text-[12px] uppercase border border-[#CDD4DE] px-3.5 py-2 rounded-sm opacity-40 hover:opacity-100 transition-opacity cursor-pointer tracking-wider">
            back to home
          </a>
        </div>

        {/* صورة الخلفية المتحركة */}
        {/* ملاحظة: الصورة الأصلية من الكود قد لا تعمل لأنها http، لذا استبدلتها بصورة من unsplash تناسب الجو العام */}
        <img 
          src="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=2072&auto=format&fit=crop"
          alt="background"
          className="absolute top-0 left-0 w-full h-full object-cover z-0 pointer-events-none"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(1.1)`,
            transition: 'transform 0.1s linear' // إضافة نعومة بسيطة
          }}
        />
        
        {/* تدرج لوني فوق الصورة لجعل النص مقروءاً (اختياري لتحسين التصميم) */}
        <div className="absolute top-0 left-0 w-full h-full bg-[#0D0C1E]/20 z-1 pointer-events-none"></div>

      </div>
    </div>
  );
};

export default Page404;