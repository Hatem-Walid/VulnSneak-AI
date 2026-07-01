import { useState, useEffect, Suspense, lazy } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { login, register } from "../api/apiClient.js"; 
import { useAuth } from "../context/AuthContext";
import { ChevronRight, ShieldCheck } from "lucide-react";
import BackgroundEffects from "../components/BackgroundEffects.jsx";

export default function AuthPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { login: authLogin } = useAuth();
  
  const [tab, setTab] = useState("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // --- 1. تعريف بيانات النماذج (States) ---
  const [loginForm, setLoginForm] = useState({ 
    email: "", 
    password: "" 
  });
  
  const [registerForm, setRegisterForm] = useState({
    firstName: "", 
    lastName: "", 
    email: "", 
    password: "",
    age: "", 
    gender: "Male", 
    phone: "", 
    address: ""
  });

  // تحديد المسار الذي جاء منه المستخدم أو الذهاب للرئيسية
  const from = location.state?.from?.pathname || "/";

  // --- 2. منطق ظهور الصفحة التدرجي ---
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsReady(true);
    }, 1500);
    return () => clearTimeout(timeout);
  }, []);

  // --- 3. منطق تحريك الكارت 3D ---
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7deg", "7deg"]);

  const handleMouseMove = (e) => {
    if (!isReady) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width - 0.5;
    const yPct = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // --- 4. التعامل مع إرسال البيانات ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await login(loginForm);
      const data = response.data || response;
      authLogin(data.token, data.name || "Agent", data.email);
      showToast("Access Granted. Welcome back.");
      navigate(from, { replace: true });
    } catch (err) {
      showToast(err.response?.data?.message || "Invalid Credentials", "error");
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const payload = {
      Fname: registerForm.firstName,
      Lname: registerForm.lastName,
      Email: registerForm.email,
      Password: registerForm.password,
      Age: Number(registerForm.age),
      Gender: registerForm.gender === "Male",
      Phone: registerForm.phone,
      Address: registerForm.address,
    };
    
    try {
      await register(payload);
      showToast("Agent Registered Successfully.");
      setTab("login");
    } catch (err) {
      showToast(err.response?.data?.message || "Registration Failed", "error");
    } finally { 
      setIsSubmitting(false); 
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-black relative overflow-hidden font-inter [[data-theme=light]_&]:bg-[#f4f4f7]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;900&family=Space+Grotesk:wght@700&family=Space+Mono&display=swap');
        
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'Space Mono', monospace; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; }
        [data-theme=light] .custom-scrollbar::-webkit-scrollbar-thumb { background: #c4c4c9; }

        :root { 
          --grid-line-color: rgba(255, 255, 255, 0.03); 
          --grid-size: 40px 40px;
        }

        [data-theme=light] { 
          --grid-line-color: rgba(0, 0, 0, 0.06); 
        }

        [data-theme=light] .dynamic-veil-container {
          filter: invert(1) hue-rotate(180deg) brightness(1.25);
          opacity: 0.65;
        }
      `}</style>

      {/* ✅ الـ Background معزول في memo component */}
      <BackgroundEffects />

      {/* AUTH CARD */}
      <motion.div 
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={{ opacity: 0, y: 30 }}
        animate={isReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 1, ease: "circOut" }}
        className="relative z-10 w-full max-w-[540px]"
      >
        <div className="bg-[#050505] border border-white/[0.07] rounded-[40px] p-10 md:p-16 shadow-2xl relative overflow-hidden [[data-theme=light]_&]:bg-white/20 [[data-theme=light]_&]:border-white/40 [[data-theme=light]_&]:backdrop-blur-2xl [[data-theme=light]_&]:shadow-[0_30px_60px_rgba(0,0,0,0.1)]">
          
          <div className="mb-12 text-center">
             <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.05] mb-8 [[data-theme=light]_&]:bg-white/40 [[data-theme=light]_&]:border-white/50">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></div>
                <span className="text-[10px] font-mono tracking-[0.4em] text-zinc-500 [[data-theme=light]_&]:text-zinc-800 [[data-theme=light]_&]:font-bold uppercase">Secure_Gateway_v3</span>
             </div>
             <h2 className="text-6xl font-black text-white tracking-tighter font-space leading-none mb-4 uppercase [[data-theme=light]_&]:text-zinc-950">
                VULN<span className="text-zinc-800 [[data-theme=light]_&]:text-zinc-400">SNEAK</span>
             </h2>
          </div>

          {/* TABS */}
          <div className="grid grid-cols-2 gap-4 mb-10 p-1.5 bg-black/50 rounded-2xl border border-white/[0.03] [[data-theme=light]_&]:bg-white/30 [[data-theme=light]_&]:border-white/40">
             <button 
               onClick={() => setTab("login")} 
               className={`py-4 rounded-xl text-[10px] uppercase tracking-[0.3em] font-black transition-all ${
                 tab === "login" 
                   ? "bg-zinc-900 text-white [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:text-zinc-950 [[data-theme=light]_&]:shadow-sm" 
                   : "text-zinc-600 hover:text-zinc-400 [[data-theme=light]_&]:text-zinc-700 [[data-theme=light]_&]:hover:text-zinc-950"
               }`}
             >
               Access
             </button>
             <button 
               onClick={() => setTab("register")} 
               className={`py-4 rounded-xl text-[10px] uppercase tracking-[0.3em] font-black transition-all ${
                 tab === "register" 
                   ? "bg-zinc-900 text-white [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:text-zinc-950 [[data-theme=light]_&]:shadow-sm" 
                   : "text-zinc-600 hover:text-zinc-400 [[data-theme=light]_&]:text-zinc-700 [[data-theme=light]_&]:hover:text-zinc-950"
               }`}
             >
               Register
             </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={tab}
              onSubmit={tab === "login" ? handleLoginSubmit : handleRegisterSubmit}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="space-y-6"
            >
              <div className={`space-y-4 ${tab === "register" ? "max-h-[350px] overflow-y-auto pr-2 custom-scrollbar" : ""}`}>
                
                <VaultInput 
                  label="Agent_Credential" 
                  type="email" 
                  placeholder="IDENTIFICATION_MAIL"
                  autoComplete="email"
                  value={tab === "login" ? loginForm.email : registerForm.email}
                  onChange={(e) => tab === "login" 
                    ? setLoginForm({ ...loginForm, email: e.target.value }) 
                    : setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                />
                
                {tab === "register" && (
                  <div className="grid grid-cols-2 gap-4">
                    <VaultInput 
                      label="First_Name" 
                      placeholder="NAME" 
                      value={registerForm.firstName}
                      onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                    />
                    <VaultInput 
                      label="Last_Name" 
                      placeholder="SURNAME" 
                      value={registerForm.lastName}
                      onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                    />
                  </div>
                )}

                <VaultInput 
                  label="Neural_Key" 
                  type="password" 
                  placeholder="••••••••••••"
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  value={tab === "login" ? loginForm.password : registerForm.password}
                  onChange={(e) => tab === "login" 
                    ? setLoginForm({ ...loginForm, password: e.target.value }) 
                    : setRegisterForm({ ...registerForm, password: e.target.value })
                  }
                />

                {tab === "register" && (
                   <>
                      <div className="grid grid-cols-2 gap-4">
                         <VaultInput 
                           label="Age" 
                           type="number" 
                           placeholder="00" 
                           value={registerForm.age}
                           onChange={(e) => setRegisterForm({ ...registerForm, age: e.target.value })}
                         />
                         <div className="flex flex-col gap-2">
                            <label className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest [[data-theme=light]_&]:text-zinc-700 [[data-theme=light]_&]:font-extrabold">Gender</label>
                            <select 
                              value={registerForm.gender}
                              onChange={(e) => setRegisterForm({ ...registerForm, gender: e.target.value })}
                              className="bg-zinc-950 border border-white/[0.05] rounded-xl py-4 px-5 text-white text-[10px] outline-none appearance-none cursor-pointer [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:border-zinc-250 [[data-theme=light]_&]:text-zinc-900"
                            >
                               <option value="Male">MALE_ID</option>
                               <option value="Female">FEMALE_ID</option>
                            </select>
                         </div>
                      </div>
                      <VaultInput 
                        label="Node_Link" 
                        placeholder="PHONE" 
                        value={registerForm.phone}
                        onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      />
                      <VaultInput 
                        label="Location" 
                        placeholder="ADDRESS" 
                        value={registerForm.address}
                        onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                      />
                   </>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full h-16 mt-8 rounded-2xl overflow-hidden bg-white text-black font-black uppercase tracking-[0.4em] text-[11px] hover:scale-[1.02] transition-all disabled:opacity-50 [[data-theme=light]_&]:bg-zinc-950 [[data-theme=light]_&]:text-white [[data-theme=light]_&]:hover:bg-black [[data-theme=light]_&]:shadow-[0_10px_30px_rgba(0,0,0,0.15)]"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                   {isSubmitting ? "Processing..." : tab === "login" ? "Initialize_Entry" : "Register_Agent"}
                   {!isSubmitting && <ChevronRight size={14} />}
                </span>
              </button>
            </motion.form>
          </AnimatePresence>
        </div>
        
        <div className="mt-8 text-center">
           <button 
             onClick={() => navigate("/")} 
             className="text-[9px] font-mono text-zinc-700 hover:text-white transition-all tracking-[0.8em] uppercase font-bold [[data-theme=light]_&]:text-zinc-500 [[data-theme=light]_&]:hover:text-zinc-900"
           >
              [ TERMINATE_SESSION ]
           </button>
        </div>
      </motion.div>
    </div>
  );
}

// مكون حقل الإدخال ليدعم الزجاج التفاعلي بوضوح تام وبأعلى دقة تباين
function VaultInput({ label, value, onChange, ...props }) {
  return (
    <div className="flex flex-col gap-2 group">
      <label className="text-[8px] font-mono text-zinc-600 uppercase tracking-[0.25em] font-black group-focus-within:text-purple-500 transition-colors [[data-theme=light]_&]:text-zinc-700 [[data-theme=light]_&]:font-extrabold">
        {label}
      </label>
      <input 
        {...props}
        value={value}
        onChange={onChange}
        required
        className="w-full bg-zinc-950/50 border border-white/[0.05] rounded-xl py-4 px-5 text-white text-xs outline-none focus:bg-zinc-900 focus:border-purple-500/30 transition-all placeholder:text-zinc-800 [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:border-zinc-250 [[data-theme=light]_&]:text-zinc-950 [[data-theme=light]_&]:focus:bg-white [[data-theme=light]_&]:placeholder:text-zinc-500 [[data-theme=light]_&]:focus:border-purple-600"
      />
    </div>
  );
}