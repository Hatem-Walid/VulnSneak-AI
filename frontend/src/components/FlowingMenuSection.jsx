import { lazy, Suspense, useState, useEffect } from "react";

const FlowingMenu = lazy(() => import("./FlowingMenu"));

const menuItems = [
  {
    link: "/ai",
    text: "Vulnerability Detection",
    image: "https://images.unsplash.com/photo-1763568258533-d0597f86ce62?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    link: "/doc",
    text: "Easy Vibe Coding",
    image: "https://images.unsplash.com/photo-1771942202908-6ce86ef73701?q=80&w=1415&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    link: "/blog",
    text: "Modern Website",
    image: "https://plus.unsplash.com/premium_photo-1683288662019-c92caea8276d?q=80&w=1374&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    link: "/about",
    text: "Secure Proxy",
    // تم إضافة الرابط هنا
    image: "https://images.unsplash.com/photo-1631553127988-36343ac5bb0c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cmFzcGJlcnJ5JTIwcGl8ZW58MHx8MHx8fDA%3D",
  },
];

const FlowingMenuSection = () => {
  // ── مراقب ذكي لمزامنة ألوان الـ Props مع زر التبديل تلقائياً ──
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // مراقبة تفعيل الوضع الفاتح على عنصر الـ html الرئيسي
    const observer = new MutationObserver(() => {
      const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
      setIsLight(isLightMode);
    });

    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['data-theme'] 
    });

    // تحقق أولي عند تحميل الصفحة
    setIsLight(document.documentElement.getAttribute('data-theme') === 'light');

    return () => observer.disconnect();
  }, []);
  // ─────────────────────────────────────────────────────────────

  // تحديد ألوان المكون بناءً على حالة الوضع الفاتح أو الغامق
  const textColor = isLight ? "#121212" : "#ffffff";
  const bgColor = isLight ? "#ffffff" : "#000000";
  const marqueeBgColor = isLight ? "#121212" : "#ffffff";
  const marqueeTextColor = isLight ? "#ffffff" : "#000000";
  const borderColor = isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255,255,255,0.08)";

  return (
    // السكشن الخارجي يتحول للأبيض السادة والحدود لرمادي ناعم في الوضع الفاتح
    <section className="relative bg-black light:bg-white border-y border-white/3 light:border-black/6 overflow-hidden transition-colors duration-500">

      <div style={{ height: "600px", position: "relative" }}>
        <Suspense fallback={null}>
          <FlowingMenu
            items={menuItems}
            speed={15}
            textColor={textColor}
            bgColor={bgColor}
            marqueeBgColor={marqueeBgColor}
            marqueeTextColor={marqueeTextColor}
            borderColor={borderColor}
          />
        </Suspense>
      </div>
    </section>
  );
};

export default FlowingMenuSection;