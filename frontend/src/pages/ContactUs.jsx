import React, { useState, useEffect, memo } from "react";
import { motion } from "framer-motion";
import { Mail, Send, Loader2, Github, Twitter, Linkedin, ShieldCheck, Terminal } from "lucide-react";

const ContactUs = () => {
  // --- التحكم في الظهور والمزامنة ---
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let timeout;
    const triggerPageStart = () => {
      timeout = setTimeout(() => {
        setIsReady(true);
      }, 1500);
    };

    if (window.__vsTransitionDone) {
      triggerPageStart();
    } else {
      window.addEventListener("pageTransitionComplete", triggerPageStart, { once: true });
    }

    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener("pageTransitionComplete", triggerPageStart);
    };
  }, []);

  // --- منطق الفورم وإرسال البريد الإلكتروني ---
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // ضع هنا الـ Access Key الذي وصلك مجاناً على إيميلك من موقع Web3Forms
    const ACCESS_KEY = "978bed24-32aa-46fc-801d-658b625e0487"; 

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          name: formData.name,
          email: formData.email,
          message: formData.message,
          subject: "New Vulnerability Dossier - VulnSneak Portal"
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert("Transmission Successful. Our agents will contact you shortly.");
        setFormData({ name: "", email: "", message: "" });
      } else {
        throw new Error(result.message || "Failed to process transmission.");
      }
    } catch (error) {
      alert("Transmission Failed. Please ensure your ACCESS_KEY is configured correctly.");
      console.error("Transmission Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="main-theme-wrapper min-h-screen transition-colors duration-500 bg-[var(--bg)] text-[var(--text-main)] pt-32 pb-20 px-6 relative overflow-hidden font-inter selection:bg-purple-500/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Space+Grotesk:wght@700&family=Space+Mono&display=swap');
        
        :root {
          --bg: #000000;
          --text-main: #ffffff;
          --text-muted: #71717a;
          --grid-color: rgba(255, 255, 255, 0.03);
          --accent: #a855f7;
          
          /* الكارت أبيض في الـ Dark Mode */
          --card-bg: #ffffff; 
          --card-border: rgba(0, 0, 0, 0.1);
          --card-text-main: #09090b;
          --card-text-muted: #52525b;
          --card-input-border: rgba(0, 0, 0, 0.15);
          --card-placeholder: #a1a1aa;
          --card-btn-bg: #09090b;
          --card-btn-text: #ffffff;

          /* أزرار السوشيال ميديا في الـ Dark Mode */
          --btn-social-bg: rgba(255, 255, 255, 0.03);
          --btn-social-border: rgba(255, 255, 255, 0.08);
          --btn-social-text: #a1a1aa;
          --btn-social-hover-bg: #a855f7;
          --btn-social-hover-text: #ffffff;
          --btn-social-hover-border: #a855f7;
        }

        [data-theme='light'] {
          --bg: #f9fafb;
          --text-main: #09090b;
          --text-muted: #52525b;
          --grid-color: rgba(0, 0, 0, 0.04);
          --accent: #7e22ce;
          
          /* الكارت أسود في الـ Light Mode */
          --card-bg: #09090b; 
          --card-border: rgba(255, 255, 255, 0.1);
          --card-text-main: #ffffff;
          --card-text-muted: #a1a1aa;
          --card-input-border: rgba(255, 255, 255, 0.2);
          --card-placeholder: #52525b;
          --card-btn-bg: #ffffff;
          --card-btn-text: #09090b;

          /* أزرار السوشيال ميديا في الـ Light Mode */
          --btn-social-bg: rgba(0, 0, 0, 0.03);
          --btn-social-border: rgba(0, 0, 0, 0.08);
          --btn-social-text: #52525b;
          --btn-social-hover-bg: #7e22ce;
          --btn-social-hover-text: #ffffff;
          --btn-social-hover-border: #7e22ce;
        }

        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'Space Mono', monospace; }
        
        input::placeholder, textarea::placeholder { 
          color: var(--card-placeholder) !important; 
          font-size: 12px; 
          text-transform: uppercase; 
          letter-spacing: 1px; 
        }

        .input-glow:focus {
          border-bottom-color: var(--accent);
          box-shadow: 0 4px 12px -4px rgba(168, 85, 247, 0.2);
        }
      `}</style>
      
      {/* Background Elements */}
      <div 
        className="fixed inset-0 pointer-events-none z-0" 
        style={{ 
          backgroundImage: `radial-gradient(circle at 2px 2px, var(--grid-color) 1.5px, transparent 0)`, 
          backgroundSize: '40px 40px' 
        }} 
      />
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-purple-900/10 blur-[150px] rounded-full pointer-events-none" />

      <motion.div 
        className="max-w-7xl mx-auto relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={isReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Cinematic Header */}
        <div className="flex flex-col items-center text-center mb-24">
          <div className="px-4 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--card-text-main)] mb-6 backdrop-blur-md shadow-sm transition-all">
            <span className="text-[10px] uppercase tracking-[0.5em] text-[var(--accent)] font-bold font-mono">Secure Communication</span>
          </div>
          <h1 className="text-5xl md:text-8xl font-bold font-space tracking-tighter mb-6 leading-none text-[var(--text-main)]">
            GET IN <span className="text-[var(--text-muted)]">TOUCH.</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg max-w-xl font-light">
            Direct access to the VulnSneak Intelligence team. Secure your infrastructure today.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-20 items-start">
          
          {/* LEFT SIDE: Technical Info Nodes */}
          <div className="space-y-12">
            <div className="space-y-8">
              <div className="group cursor-default">
                <div className="flex items-center gap-4 mb-4">
                  <Terminal size={18} className="text-[var(--accent)]" />
                  <h3 className="text-[10px] font-bold tracking-[0.3em] text-[var(--text-muted)] uppercase">Headquarters</h3>
                </div>
                <p className="text-xl font-space text-[var(--text-main)]">127 Qaomia St, ZAG City, Egypt</p>
              </div>

              <div className="group cursor-default">
                <div className="flex items-center gap-4 mb-4">
                  <ShieldCheck size={18} className="text-[var(--accent)]" />
                  <h3 className="text-[10px] font-bold tracking-[0.3em] text-[var(--text-muted)] uppercase">Direct Link</h3>
                </div>
                <p className="text-xl font-space text-[var(--text-main)]">+20 127 929 3585</p>
              </div>

              <div className="group cursor-default">
                <div className="flex items-center gap-4 mb-4">
                  <Mail size={18} className="text-[var(--accent)]" />
                  <h3 className="text-[10px] font-bold tracking-[0.3em] text-[var(--text-muted)] uppercase">Encrypted Email</h3>
                </div>
                <p className="text-xl font-space text-[var(--text-main)]">intel@vulnsneak.ai</p>
              </div>
            </div>

            {/* Social Matrix */}
            <div className="pt-12 border-t border-[var(--card-border)] flex gap-4">
              {[Github, Twitter, Linkedin].map((Icon, i) => (
                <a 
                  key={i} 
                  href="#" 
                  className="w-12 h-12 rounded-full border border-[var(--btn-social-border)] bg-[var(--btn-social-bg)] flex items-center justify-center text-[var(--btn-social-text)] hover:bg-[var(--btn-social-hover-bg)] hover:text-[var(--btn-social-hover-text)] hover:border-[var(--btn-social-hover-border)] shadow-sm hover:shadow-[0_10px_25px_-5px_rgba(168,85,247,0.3)] [[data-theme=light]_&]:hover:shadow-[0_10px_25px_-5px_rgba(126,34,206,0.2)] transition-all duration-300"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* RIGHT SIDE: Neural Submission Form */}
          <form 
            onSubmit={handleSubmit} 
            className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[32px] p-10 md:p-16 relative overflow-hidden shadow-[0_45px_100px_rgba(0,0,0,0.6)] [[data-theme=light]_&]:shadow-[0_45px_100px_rgba(0,0,0,0.35)] transition-all duration-500"
          >
            <div className="absolute top-8 right-8 flex items-center gap-2 opacity-90">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-[8px] font-mono tracking-widest uppercase text-purple-500 font-bold">Encryption: GCM-256</span>
            </div>

            <div className="space-y-10">
              <div className="grid md:grid-cols-2 gap-10">
                <div className="group relative">
                  <label className="text-[10px] uppercase tracking-widest text-[var(--card-text-muted)] mb-4 block group-focus-within:text-[var(--accent)] transition-colors font-bold">
                    Identification
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="FULL NAME"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full bg-transparent border-b border-[var(--card-input-border)] py-3 text-[var(--card-text-main)] focus:outline-none transition-all font-light input-glow"
                  />
                </div>
                
                <div className="group relative">
                  <label className="text-[10px] uppercase tracking-widest text-[var(--card-text-muted)] mb-4 block group-focus-within:text-[var(--accent)] transition-colors font-bold">
                    Communication Link
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="EMAIL ADDRESS"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full bg-transparent border-b border-[var(--card-input-border)] py-3 text-[var(--card-text-main)] focus:outline-none transition-all font-light input-glow"
                  />
                </div>
              </div>

              <div className="group relative">
                <label className="text-[10px] uppercase tracking-widest text-[var(--card-text-muted)] mb-4 block group-focus-within:text-[var(--accent)] transition-colors font-bold">
                  Message Parameters
                </label>
                <textarea
                  name="message"
                  placeholder="DESCRIBE YOUR INQUIRY..."
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows="4"
                  className="w-full bg-transparent border-b border-[var(--card-input-border)] py-3 text-[var(--card-text-main)] focus:outline-none transition-all resize-none font-light input-glow"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 bg-[var(--card-btn-bg)] text-[var(--card-btn-text)] font-bold uppercase tracking-widest text-xs rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] shadow-lg"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Launch Transmission
                    <Send size={14} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>

      {/* Footer Bottom */}
      <div className="mt-32 flex justify-center opacity-10">
         <div className="w-1/3 h-px bg-gradient-to-r from-transparent via-[var(--text-main)] to-transparent"></div>
      </div>
    </div>
  );
};

export default memo(ContactUs);