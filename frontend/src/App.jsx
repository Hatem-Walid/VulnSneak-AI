import { useState, useEffect } from "react";
import { Routes, Route, useLocation, Outlet } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Components
import Navbar from "./components/Navbar";
import RetellAgent from "./components/RetellAgent";
import Preloader from "./components/Preloader";
import CustomCursor from "./components/CustomCursor";
import PageTransition from "./components/PageTransition";

// Pages
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import ProfileEdit from "./pages/profile_edit";
import About from "./pages/About";
import SplineChatPage from "./pages/SplineChatPage";
import FAQ from "./pages/FAQ";
import Docs from "./pages/Docs";
import Blog from "./pages/Blog";
import ContactUs from "./pages/ContactUs";
import Page404 from "./pages/Page404";

// Styles
import "./App.css";

// Register GSAP plugins once globally
gsap.registerPlugin(ScrollTrigger);

/* ==========================================================================
   MainLayout – Shared shell (Navbar + RetellAgent + Outlet)
   GSAP ScrollTrigger handles reveals per-component.
   ========================================================================== */
const MainLayout = ({ hideNavbarRoutes }) => {
  const location = useLocation();

  // Refresh ScrollTrigger when the route changes to register new triggers correctly.
  useEffect(() => {
    const id = setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => clearTimeout(id);
  }, [location.pathname]);

  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);

  return (
    <>
      {!shouldHideNavbar && <Navbar />}
      <RetellAgent />
      <PageTransition>
        <Outlet />
      </PageTransition>
    </>
  );
};

/* ==========================================================================
   App Component
   ========================================================================== */
function App() {
  const [loading, setLoading] = useState(true);

  // ربط لوجيك الزر بالـ App بأكمله لمنع الوميض (Flickering)
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, []);

  const hideNavbarRoutes = ["/auth", "/doc", "/info", "/ai"];

  return (
    <>
      {/* Global magnetic cursor (desktop only – hides on touch) */}
      <CustomCursor />

      {/* Preloader – animations fire after finishLoading() */}
      {loading && <Preloader finishLoading={() => setLoading(false)} />}

      <Routes>
        {/* Routes with shared Navbar / RetellAgent shell */}
        <Route element={<MainLayout hideNavbarRoutes={hideNavbarRoutes} />}>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/info" element={<ProfileEdit />} />
          <Route path="/about" element={<About />} />
          <Route path="/ai" element={<SplineChatPage />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/doc" element={<Docs />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/contact" element={<ContactUs />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Page404 />} />
      </Routes>
    </>
  );
}

export default App;