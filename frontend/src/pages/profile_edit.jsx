import React, { useState, useEffect, memo } from "react";
import { 
  Home, User, Settings, Pencil, ChevronLeft, 
  CheckCircle2, Loader2, Lock, KeyRound, Trash2, 
  AlertTriangle, X, Shield, Terminal, Fingerprint 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/apiClient";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

const ProfileEdit = () => {
  const { user, setUser, logout } = useAuth(); 
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [formData, setFormData] = useState({
    fname: "", lname: "", email: "", address: "", phone: "", age: "", gender: "-select-",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "", newPassword: "", confirmPassword: ""
  });

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setInitialLoading(true);
        // تم استخدام Promise.all لضمان بقاء اللودر لمدة ثانيتين على الأقل حتى لو كانت البيانات سريعة جداً
        const [response] = await Promise.all([
          apiClient.get("api/v1/User"),
          new Promise((resolve) => setTimeout(resolve, 5000)) 
        ]);
        
        const data = response.data;
        setFormData({
          fname: data.fname || "",
          lname: data.lname || "",
          email: data?.email || data?.Email || "SECURE_NODE@LINK", 
          address: data.address || "",
          phone: data.phone || "",
          age: data.age || "",
          gender: data.gender === true ? "Male" : data.gender === false ? "Female" : "-select-",
        });
        if (typeof setUser === "function") setUser(prev => ({ ...prev, ...data }));
      } catch (error) {
        toast.error("Failed to sync neural records.");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchUserData();
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const tId = toast.loading("Syncing Identity...");
    setLoading(true);
    let gValue = formData.gender === "Male" ? true : formData.gender === "Female" ? false : null;

    try {
      // ننتظر الطلب ونضيف تأخير بسيط 1 ثانية لجعل الانتقال ناعماً
      await Promise.all([
        apiClient.put("api/v1/User", {
          fname: formData.fname, lname: formData.lname, address: formData.address,
          phone: formData.phone, age: formData.age ? parseInt(formData.age) : null, gender: gValue,
        }),
        new Promise((resolve) => setTimeout(resolve, 1000))
      ]);
      toast.success("Identity Records Updated.", { id: tId });
    } catch (error) {
      toast.error("Update Blocked. Check Security Clearance.", { id: tId });
    } finally { 
      setLoading(false); 
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Parity Error: Passwords Mismatch.");
      return;
    }
    const tId = toast.loading("Recalibrating Authentication...");
    try {
      await Promise.all([
        apiClient.put("api/v1/User/change-password", passwordData),
        new Promise((resolve) => setTimeout(resolve, 1000))
      ]);
      toast.success("Auth Protocols Hardened.", { id: tId });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast.error(error.response?.data?.message || "Encryption Error.", { id: tId });
    }
  };

  const confirmDeleteAccount = async () => {
    const tId = toast.loading("Purging Records...");
    try {
      await Promise.all([
        apiClient.delete("api/v1/User"),
        new Promise((resolve) => setTimeout(resolve, 1500))
      ]);
      toast.success("Identity Purged Successfully.");
      setShowDeleteModal(false);
      logout();
      navigate("/auth");
    } catch (error) {
      toast.error("Purge Failed. Target is Locked.", { id: tId });
    }
  };


  if (initialLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black gap-6">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-16 h-16 rounded-full border-t-2 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
        />
        <span className="font-mono text-[10px] tracking-[0.5em] text-zinc-600 uppercase">Neural_Link_Establishing...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#000] text-zinc-400 font-inter relative overflow-hidden">
      <Toaster toastOptions={{ style: { background: '#111', color: '#fff', border: '1px solid #333' } }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Space+Grotesk:wght@700&family=Space+Mono&display=swap');
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'Space Mono', monospace; }
        input, select { transition: all 0.3s ease; }
        input:focus { border-color: #8b5cf6 !important; box-shadow: 0 10px 20px -10px rgba(139, 92, 246, 0.2); }
      `}</style>

      {/* --- ELITE DELETE MODAL --- */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-zinc-950 w-full max-w-md rounded-[32px] p-10 border border-red-900/30 overflow-hidden shadow-2xl">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
                  <AlertTriangle size={32} />
                </div>
                <h2 className="text-2xl font-bold font-space text-white mb-4 tracking-tight uppercase">Permanent Purge?</h2>
                <p className="text-zinc-500 text-sm leading-relaxed mb-10">This action will permanently erase your agent profile and neural history from our core database. This cannot be reversed.</p>
                <div className="flex w-full gap-4">
                  <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-4 rounded-xl bg-zinc-900 text-zinc-400 font-bold hover:bg-zinc-800 transition-all uppercase text-xs tracking-widest">Abort</button>
                  <button onClick={confirmDeleteAccount} className="flex-1 py-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all uppercase text-xs tracking-widest shadow-lg shadow-red-600/20">Confirm Purge</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- NAVIGATION RAIL --- */}
      <div className="w-20 bg-zinc-950 border-r border-white/[0.03] flex flex-col items-center py-10 justify-between shrink-0 z-50">
        <div className="flex flex-col items-center gap-12">
          <Shield className="text-white hover:text-purple-500 transition-colors cursor-pointer" size={24} onClick={() => navigate("/")} />
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-zinc-800 to-transparent"></div>
          <button onClick={() => navigate("/")} className="text-zinc-600  hover:text-white transition-all"><Home size={22} /></button>
          <button className="text-purple-500 bg-purple-500/5 p-2 rounded-2xl border border-purple-500/20"><User size={22} /></button>
        </div>
        <button onClick={() => navigate("/ai")} className="w-12 h-12 rounded-2xl border border-white/5 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all"><Terminal size={20}/></button>
      </div>

      {/* --- DASHBOARD HEADER & CONTENT --- */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#000] relative">
        
        {/* Subtle Background Grid */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)`, backgroundSize: '32px 32px' }} />

        <header className="h-24 border-b border-white/[0.03] flex items-center justify-between px-12 z-10 backdrop-blur-md">
           <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-zinc-900 text-zinc-600 hover:text-white transition-all"><ChevronLeft size={20}/></button>
              <h1 className="font-space text-xl font-bold text-white tracking-tight uppercase">Agent_ID: <span className="text-zinc-500">{formData.fname || "N/A"}</span></h1>
           </div>
           <div className="flex items-center gap-3 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
              <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></div>
              Node_Active
           </div>
        </header>

        <main className="flex-1 overflow-y-auto p-12 z-10">
          <div className="max-w-4xl mx-auto">
            
            <div className="mb-16">
               <h2 className="text-4xl md:text-6xl font-bold font-space text-white tracking-tighter mb-4 uppercase">Profile Control.</h2>
               <p className="text-zinc-500 font-stretch-125% text-md">Modify identity parameters and neural access protocols.</p>
            </div>

            <div className="grid lg:grid-cols-[1fr_300px] gap-16">
              <div className="space-y-20">
                
                {/* SECTION 01: IDENTITY RECORDS */}
                <form onSubmit={handleSaveProfile} className="space-y-10">
                  <div className="flex items-center gap-3 mb-8">
                     <span className="text-[10px] font-mono text-purple-500 tracking-[0.4em] uppercase font-bold">01_Identity_Records</span>
                     <div className="flex-1 h-px bg-purple-900"></div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8">
                    <div className="group flex flex-col gap-3">
                      <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">First_Name</label>
                      <input type="text" name="fname" value={formData.fname} onChange={handleFormChange} className="bg-transparent border-b border-white/10 py-3 text-white outline-none font-light" />
                    </div>
                    <div className="group flex flex-col gap-3">
                      <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Last_Name</label>
                      <input type="text" name="lname" value={formData.lname} onChange={handleFormChange} className="bg-transparent border-b border-white/10 py-3 text-white outline-none font-light" />
                    </div>
                  </div>

                  <div className="group flex flex-col gap-3">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Encrypted_Email (Static)</label>
                    <div className="relative">
                      <input type="email" value={formData.email} disabled className="w-full bg-transparent border-b border-white/5 py-3 text-zinc-600 outline-none font-mono text-sm" />
                      <Lock className="absolute right-0 top-3 text-zinc-800" size={14} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="group flex flex-col gap-3">
                      <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Comms_Phone</label>
                      <input type="text" name="phone" value={formData.phone} onChange={handleFormChange} className="bg-transparent border-b border-white/10 py-3 text-white outline-none font-light" />
                    </div>
                    <div className="group flex flex-col gap-3">
                      <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Physical_Node</label>
                      <input type="text" name="address" value={formData.address} onChange={handleFormChange} className="bg-transparent border-b border-white/10 py-3 text-white outline-none font-light" />
                    </div>
                  </div>

                  <button type="submit" className="h-12 px-10 rounded-xl bg-white text-black font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.05)]">Synchronize Records</button>
                </form>

                {/* SECTION 02: AUTHENTICATION PROTOCOLS */}
                <form onSubmit={handleUpdatePassword} className="space-y-10">
                  <div className="flex items-center gap-3 mb-8">
                     <span className="text-[10px] font-mono text-purple-500 tracking-[0.4em] uppercase font-bold">02_Auth_Protocols</span>
                     <div className="flex-1 h-px bg-purple-900"></div>
                  </div>

                  <div className="group flex flex-col gap-3">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Current_Passkey</label>
                    <input 
                      type="password" 
                      name="currentPassword" 
                      value={passwordData.currentPassword} 
                      onChange={handlePasswordChange} 
                      required 
                      className="bg-transparent border-b border-white/10 py-3 text-white outline-none font-light" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="group flex flex-col gap-3">
                      <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">New_Passkey</label>
                      <input type="password" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} required className="bg-transparent border-b border-white/10 py-3 text-white outline-none font-light" />
                    </div>
                    <div className="group flex flex-col gap-3">
                      <label className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Confirm_Passkey</label>
                      <input type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} required className="bg-transparent border-b border-white/10 py-3 text-white outline-none font-light" />
                    </div>
                  </div>

                  <button type="submit" className="h-12 px-10 rounded-xl border border-white/10 bg-white/5 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all">Update Encryption</button>
                </form>

              </div>

              {/* SIDEBAR WIDGETS */}
              <aside className="space-y-8">
                 <div className="p-8 rounded-[32px] bg-zinc-950 border border-white/[0.03] space-y-6">
                    <div className="flex items-center gap-3 text-zinc-500">
                       <Fingerprint size={18}/>
                       <span className="text-[10px] uppercase tracking-widest font-bold">Status Matrix</span>
                    </div>
                    <div className="space-y-4 pt-4 border-t border-white/5">
                       <div className="flex justify-between"><span className="text-[10px] uppercase tracking-tighter text-zinc-600">Access Level</span><span className="text-purple-500 text-xs font-mono">Agent_L2</span></div>
                       <div className="flex justify-between"><span className="text-[10px] uppercase tracking-tighter text-zinc-600">Encryption</span><span className="text-green-400 text-xs font-mono">GCM-256</span></div>
                    </div>
                 </div>

                 <div className="p-8 rounded-[32px] border border-red-900/10 bg-red-950/5 group">
                    <h4 className="text-[11px] font-bold tracking-[0.3em] text-red-600 uppercase mb-4 flex items-center gap-2">
                       <AlertTriangle size={14}/> Danger Zone
                    </h4>
                    <p className="text-[11px] font-bold text-zinc-400 leading-relaxed mb-6">Initiate permanent purge of identity records. This bypasses all safety protocols.</p>
                    <button type="button" onClick={() => setShowDeleteModal(true)} className="w-full py-4 rounded-xl border border-red-900/20 bg-red-600/5 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all transition-all">Terminate Clearance</button>
                 </div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default memo(ProfileEdit);