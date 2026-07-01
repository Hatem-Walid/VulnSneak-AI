import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  Layout, Server, FileCode, Cpu, 
  BrainCircuit, Wrench, MonitorPlay, ChevronRight 
} from 'lucide-react';

const steps = [
  { id: 1, title: "Frontend Interface", layer: "Web Layer", icon: <Layout size={20} />, description: "User uploads code via the React UI with real-time validation." },
  { id: 2, title: "Secure API Gateway", layer: "API Layer", icon: <Server size={20} />, description: "Backend handles authentication and routes request to the secure tunnel." },
  { id: 3, title: "Code Normalization", layer: "Processing", icon: <FileCode size={20} />, description: "Preprocessing script cleans and formats code for the AI model." },
  { id: 4, title: "Hardware Proxy", layer: "Hardware Layer", icon: <Cpu size={20} />, description: "Isolated Raspberry Pi layer creates a secure tunnel for inference." },
  { id: 5, title: "Neural Analysis", layer: "AI Engine", icon: <BrainCircuit size={20} />, description: "Transformer models scan for semantic and logic security flaws." },
  { id: 6, title: "Auto-Remediation", layer: "Fix Layer", icon: <Wrench size={20} />, description: "Generates secure, human-readable patches for identified bugs." },
  { id: 7, title: "Interactive Dashboard", layer: "Final Export", icon: <MonitorPlay size={20} />, description: "Visualizes results, shows diffs, and allows one-click fixes." }
];

const AIWorkflow = () => {
  return (
    // تعديل القسم ليدعم التحول لـ الأبيض السادة في الوضع الفاتح مع الحفاظ على الأسود الأصلي
    <section className="w-full py-32 bg-blacklight:bg-[#ffffff] text-white light:text-[#121212] overflow-hidden border-t border-white/3 light:border-black/6 transition-colors duration-500">
      <div className="max-w-5xl mx-auto px-6 relative">
        
        {/* 1. Section Header */}
        <div className="flex flex-col items-center text-center mb-32">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            // البادج يقرأ ألوان الحدود والخلفية في الوضع الفاتح بدقة
            className="mb-4 px-3 py-1 rounded-full border border-white/10 light:border-black/45 bg-white/5 light:bg-black/90  transition-colors"
          >
            <span className="text-[11px] uppercase tracking-[0.4em] text-zinc-500 light:text-zinc-200 font-medium transition-colors">Inside the engine</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold tracking-[-0.04em] mb-6 font-space"
          >
            THE SECURITY <span className="text-zinc-600 light:text-zinc-400 transition-colors">PIPELINE</span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-500 light:text-zinc-700 text-lg max-w-xl font-inter font-light transition-colors"
          >
            A high-integrity data flow from the web interface to hardware-isolated AI inference.
          </motion.p>
        </div>

        {/* 2. The Architecture Timeline */}
        <div className="relative">
          
          {/* الخط العمودي يغمق في الوضع الفاتح ليصبح مرئياً بوضوح */}
          <div className="absolute left-[27px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-px bg-white/5 light:bg-black/8 transition-colors" />

          {/* الخط البنفسجي المضيء */}
          <motion.div 
            className="absolute left-[27px] md:left-1/2 md:-translate-x-1/2 top-0 w-px bg-linear-to-b from-transparent via-purple-500 to-transparent z-10"
            initial={{ height: 0, top: 0 }}
            whileInView={{ height: '100%' }}
            viewport={{ once: true }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
          />

          <div className="space-y-24">
            {steps.map((step, index) => (
              <motion.div 
                key={step.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: index * 0.1, duration: 0.8 }}
                className={`relative flex flex-col md:flex-row items-center gap-8 ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                
                {/* Content Side */}
                <div className={`flex-1 w-full ${index % 2 === 0 ? 'md:text-right' : 'md:text-left'}`}>
                  <div className="group cursor-default">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-purple-500/70 light:text-purple-700 font-semibold mb-2 block transition-colors">
                      {step.layer}
                    </span>
                    <h3 className="text-xl md:text-2xl font-semibold mb-3 text-white light:text-[#121212] font-space tracking-tight group-hover:text-purple-400 light:group-hover:text-purple-600 transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-zinc-500 light:text-zinc-700 text-sm md:text-base font-inter font-light leading-relaxed max-w-md ml-auto mr-auto md:ml-unset md:mr-unset transition-colors">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* The Node (Central Circle) */}
                <div className="relative z-20 flex items-center justify-center">
                  {/* الدائرة المركزية والظل والحدود تتحول بدقة متناهية للأبيض في الوضع الفاتح */}
                  <div className="w-14 h-14 rounded-full bg-black light:bg-white border border-white/10 light:border-black/10 flex items-center justify-center backdrop-blur-xl group-hover:border-purple-500/50 light:group-hover:border-purple-500/30 transition-all duration-500 shadow-[0_0_20px_rgba(0,0,0,1)] light:shadow-[0_4px_24px_rgba(0,0,0,0.7)]">
                    <div className="text-zinc-400 light:text-purple-900 group-hover:text-white light:group-hover:text-black transition-colors duration-500">
                      {step.icon}
                    </div>
                  </div>
                  {/* Subtle Glow behind node */}
                  <div className="absolute inset-0 bg-purple-500/5 blur-2xl rounded-full -z-10" />
                </div>

                {/* Empty side for balance */}
                <div className="flex-1 hidden md:block" />
                
              </motion.div>
            ))}
          </div>
        </div>

        {/* 3. Bottom CTA */}
        <div className="mt-32 flex flex-col items-center">
           <div className="w-px h-16 bg-linear-to-b from-zinc-800 light:from-zinc-300 to-transparent transition-colors"></div>
           <motion.div 
            whileHover={{ scale: 1.05 }}
            className="mt-8 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-zinc-500 light:text-zinc-600 cursor-pointer hover:text-white light:hover:text-black transition-colors"
           >
             Continue to features <ChevronRight size={14} />
           </motion.div>
        </div>

      </div>

      <style>{`
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
      `}</style>
    </section>
  );
};

export default memo(AIWorkflow);