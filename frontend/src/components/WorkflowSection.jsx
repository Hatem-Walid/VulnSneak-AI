import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, X } from 'lucide-react';

// استبدل هذا المسار بمسار الصورة الحقيقي عندك
import flowchartImg from '../../public/assets/flow2.jpg'; 


const FlowchartSection = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="relative py-20 px-4 md:px-8 bg-[#05020D] overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 text-center">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-linear-to-r from-cyan-400 via-blue-500 to-purple-500 mb-4">
            System Architecture
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            A visual overview of how VulnSneak processes, analyzes, and repairs your code.
          </p>
        </motion.div>

        {/* --- Image Container --- */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative group cursor-pointer max-w-5xl mx-auto"
          onClick={() => setIsOpen(true)}
        >
          {/* 1. The Glowing Backlight Effect */}
          <div className="absolute -inset-1 bg-linear-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl opacity-30 group-hover:opacity-60 blur-lg transition duration-500"></div>

          {/* 2. The Glass Frame */}
          <div className="relative rounded-2xl bg-[#0D0716]/80 backdrop-blur-xl border border-white/10 p-2 md:p-4 shadow-2xl">
            
            {/* The Image */}
            <img 
              src={flowchartImg} 
              alt="System Workflow Diagram" 
              className="w-full h-auto rounded-xl shadow-lg border border-white/5"
            />

            {/* Hover Overlay (Zoom Hint) */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl flex items-center justify-center backdrop-blur-[2px]">
               <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-full flex items-center gap-2 text-white font-medium transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                 <Maximize2 size={20} />
                 Click to Expand
               </div>
            </div>

          </div>
        </motion.div>

      </div>

      {/* --- Lightbox / Modal for Full View --- */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-100 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Close Button */}
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 p-2 rounded-full transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <X size={32} />
          </button>

          {/* Full Image */}
          <motion.img 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            src={flowchartImg} 
            alt="Full Workflow"
            className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
          />
        </div>
      )}

    </section>
  );
};

export default FlowchartSection;