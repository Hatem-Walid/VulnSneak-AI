import { Link } from "react-router-dom";
import { motion, memo } from "framer-motion";
import { 
  Target, BrainCircuit, Layers, Sparkles, Database, 
  Wrench, CheckCircle2, GitFork, Cpu, RefreshCw, 
  FileText, UserCheck, AlertTriangle, Rocket, ExternalLink, Terminal
} from "lucide-react";

const faqs = [
  { icon: Target, question: "What problem does VulnSneak aim to solve?", answer: "VulnSneak addresses the lack of intelligent, automated solutions that can both detect and repair security vulnerabilities in web application source code. It bridges the gap for small teams and academic environments." },
  { icon: BrainCircuit, question: "How is it different from traditional SAST?", answer: "Unlike rule-based tools, VulnSneak uses Transformer-based AI models to analyze semantic meaning, detecting behavior patterns rather than fixed signatures." },
  { icon: Layers, question: "Does it analyze both frontend and backend?", answer: "Yes. VulnSneak provides full-stack coverage, reflecting real-world architectures where vulnerabilities exist across multiple layers." },
  { icon: Sparkles, question: "What role does machine learning play?", answer: "Machine learning is the core engine. We use fine-tuned Transformer models trained on labeled security datasets for classification and repair." },
  { icon: Database, question: "How is the training dataset constructed?", answer: "Curated from public sources like Hugging Face, enriched with manual reviews, and aligned with OWASP Top 10 and CWE standards." },
  { icon: Wrench, question: "How does it generate secure code fixes?", answer: "A secondary AI model uses sequence-to-sequence learning to produce syntactically valid patches that preserve original functionality." },
  { icon: CheckCircle2, question: "How is functionality preserved?", answer: "A human-in-the-loop validation stage allows developers to review and test fixes before they are applied to the codebase." },
  { icon: GitFork, question: "Why a dual-model architecture?", answer: "Separating detection and repair improves modularity and allows independent optimization for each specialized task." },
  { icon: Cpu, question: "What is the purpose of the Raspberry Pi?", answer: "The Pi acts as a secure hardware proxy, isolating AI services and protecting sensitive API keys from the main backend." },
  { icon: RefreshCw, question: "Is it suitable for CI/CD integration?", answer: "Yes. Designed to integrate into local workflows and pipelines for continuous security feedback during development." },
  { icon: FileText, question: "How are vulnerabilities reported?", answer: "Via detailed technical reports including risk type, code location, and neural repair suggestions." },
  { icon: UserCheck, question: "Is it intended to replace security experts?", answer: "No. It is an assistant designed to empower developers with intelligent recommendations while keeping them in control." },
  { icon: AlertTriangle, question: "What are the current limitations?", answer: "As research-oriented, it focuses on common web vulnerabilities. Complex logic flaws may still require manual expert review." },
  { icon: Rocket, question: "What future improvements are planned?", answer: "Expanding vulnerability categories, supporting more languages, and enhancing automated fix validation layers." },
];

const FAQ = () => {
  return (
    <div className="min-h-screen bg-black text-white pt-44 pb-32 px-6 font-inter selection:bg-purple-500/30 [[data-theme=light]_&]:bg-[#f4f4f7] [[data-theme=light]_&]:text-zinc-900 [[data-theme=light]_&]:selection:bg-purple-500/10">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Space+Grotesk:wght@700&family=Space+Mono&display=swap');
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'Space Mono', monospace; }

        /* تباين جزيئات الخلفية التفاعلية */
        :root { 
          --grid-line-color: rgba(255, 255, 255, 0.15); 
          --grid-size: 40px 40px;
        }
        [data-theme=light] { 
          --grid-line-color: rgba(0, 0, 0, 0.15); 
        }
      `}</style>

      {/* Grid Pattern Mask */}
      <div className="fixed inset-0 pointer-events-none opacity-100 z-0" 
           style={{ backgroundImage: `radial-gradient(circle at 2px 2px, var(--grid-line-color) 1.5px, transparent 0)`, backgroundSize: 'var(--grid-size)' }} />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Cinematic Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-3 mb-6">
               <div className="w-8 h-px bg-purple-500 [[data-theme=light]_&]:bg-purple-600"></div>
               <span className="text-[10px] uppercase tracking-[0.5em] text-purple-500 font-bold [[data-theme=light]_&]:text-purple-600">Knowledge Base</span>
            </div>
            <h1 className="text-5xl md:text-8xl font-bold font-space tracking-tighter mb-6 leading-none text-white [[data-theme=light]_&]:text-zinc-950">
              VULNSNEAK <span className="text-zinc-700 [[data-theme=light]_&]:text-zinc-500">Q&A.</span>
            </h1>
            <p className="text-zinc-500 text-lg font-light leading-relaxed [[data-theme=light]_&]:text-zinc-700 [[data-theme=light]_&]:font-normal">
              Technical insights into the autonomous security platform. For in-depth research, consult our <Link to="/doc" className="text-white border-b border-white/20 hover:border-white transition-all [[data-theme=light]_&]:text-zinc-950 [[data-theme=light]_&]:border-zinc-400 [[data-theme=light]_&]:hover:border-zinc-950">full documentation</Link>.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <Link to="/doc" className="flex items-center gap-3 px-6 py-3 rounded-xl bg-zinc-900 border border-white/5 hover:bg-zinc-800 transition-all group [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:border-zinc-300 [[data-theme=light]_&]:hover:bg-zinc-50 [[data-theme=light]_&]:shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
              <span className="text-xs font-mono uppercase tracking-widest text-white [[data-theme=light]_&]:text-zinc-800">Open Docs</span>
              <ExternalLink size={14} className="text-zinc-500 group-hover:text-white transition-colors [[data-theme=light]_&]:text-zinc-500 [[data-theme=light]_&]:group-hover:text-zinc-900" />
            </Link>
          </motion.div>
        </div>

        {/* Technical Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group relative bg-zinc-950/40 border border-white/[0.05] rounded-2xl p-8 hover:bg-zinc-900/50 hover:border-white/10 transition-all duration-500 border-l-transparent [[data-theme=light]_&]:border-zinc-200 [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:shadow-[0_12px_35px_rgba(0,0,0,0.06)] [[data-theme=light]_&]:hover:shadow-[0_20px_45px_rgba(0,0,0,0.12)] [[data-theme=light]_&]:hover:bg-white [[data-theme=light]_&]:border-l-4 [[data-theme=light]_&]:border-l-zinc-300 [[data-theme=light]_&]:hover:border-l-purple-600"
            >
              <div className="flex gap-6 items-start">
                {/* Tech Node Icon */}
                <div className="shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-zinc-500 group-hover:text-purple-400 group-hover:border-purple-500/20 transition-all duration-500 [[data-theme=light]_&]:bg-zinc-100 [[data-theme=light]_&]:border-zinc-250 [[data-theme=light]_&]:text-zinc-600 [[data-theme=light]_&]:group-hover:text-purple-600 [[data-theme=light]_&]:group-hover:bg-purple-50/50 [[data-theme=light]_&]:group-hover:border-purple-300">
                  <faq.icon size={20} />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Terminal size={12} className="text-zinc-800 [[data-theme=light]_&]:text-zinc-400" />
                    <h3 className="text-lg font-bold font-space text-zinc-200 group-hover:text-white transition-colors [[data-theme=light]_&]:text-zinc-900 [[data-theme=light]_&]:group-hover:text-zinc-950">
                      {faq.question}
                    </h3>
                  </div>
                  <p className="text-zinc-500 font-inter font-light leading-relaxed text-sm md:text-base [[data-theme=light]_&]:text-zinc-700 [[data-theme=light]_&]:font-normal">
                    {faq.answer}
                  </p>
                </div>
              </div>

              {/* Decorative Corner Label */}
              <div className="absolute top-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                 <span className="text-[8px] font-mono text-zinc-700 tracking-widest uppercase [[data-theme=light]_&]:text-zinc-400">ID_REF: 0{index + 1}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA Terminal */}

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          className="mt-32 flex flex-col items-center p-16 rounded-[40px] border border-white/[0.03] bg-zinc-950/20 text-center [[data-theme=light]_&]:bg-[#09090b] [[data-theme=light]_&]:border-zinc-800/80 [[data-theme=light]_&]:shadow-[0_30px_70px_rgba(0,0,0,0.25)]"
        >
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 mb-8">
             <Rocket size={24} />
          </div>
          <h2 className="text-3xl md:text-5xl font-bold font-space tracking-tighter mb-6 text-white">STILL HAVE QUESTIONS?</h2>
          <p className="text-zinc-500 max-w-lg mb-10 font-light text-lg">Our intelligence team is standing by to provide deep-technical clarifications.</p>
          <Link
            to="/contact"
            className="px-12 py-4 rounded-full bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
          >
            Launch Transmission
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default memo(FAQ);