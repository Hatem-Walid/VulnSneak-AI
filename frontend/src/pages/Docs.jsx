import React, { useState, useEffect, memo } from "react";
import { Link } from "react-router-dom";
import { Search, HelpCircle, Menu, X, Shield, Terminal } from "lucide-react";
import { motion } from "framer-motion";

const docs = [
  {
    id: "getting-started",
    category: "01 / GETTING STARTED",
    title: "Getting Started",
    topics: [
      {
        title: "Introduction",
        content: `VulnSneak is an AI-driven application security platform designed to assist developers in identifying and repairing security vulnerabilities directly at the source code level.
The system focuses on static analysis enhanced with machine learning, allowing it to understand the semantic behavior of code rather than relying solely on predefined rules.
VulnSneak is developed as an academic research project, aiming to bridge the gap between modern AI techniques and practical software security needs.`
      },
      {
        title: "System Overview",
        content: `At a high level, VulnSneak operates as an intelligent security agent that:
• Accepts frontend and backend source code as input  
• Analyzes the code using AI-based models  
• Detects potential security vulnerabilities  
• Generates secure repair suggestions  
• Provides structured security reports  
• Keeps the developer in full control of final decisions  
The system is designed to integrate naturally into existing development workflows.`
      },
      {
        title: "Installation & Setup",
        content: `VulnSneak can be deployed in a local or development environment.
The setup includes:
• Backend service for handling code uploads and processing  
• AI models for vulnerability detection and repair  
• Secure communication layer for external AI services  
Configuration typically involves defining environment variables, enabling or disabling specific analysis features, and preparing the system for local or CI/CD usage.`
      }
    ]
  },
  {
    id: "core-concepts",
    category: "02 / CORE CONCEPTS",
    title: "Core Concepts",
    topics: [
      {
        title: "AI-Based Static Code Analysis",
        content: `Unlike traditional static analysis tools, VulnSneak treats source code as a structured language.
Using Transformer-based models, the system analyzes both syntax and semantics to identify insecure behavior patterns.
This approach allows VulnSneak to:
• Detect vulnerabilities even when code structure varies  
• Reduce dependence on hardcoded rules  
• Adapt more easily to new coding styles`
      },
      {
        title: "Vulnerability Detection Model",
        content: `The detection model is trained to classify code snippets into vulnerable or secure categories.
It focuses on vulnerabilities commonly found in web applications, including:
• SQL Injection  
• Cross-Site Scripting (XSS)  
• Improper input validation  
• Authentication and authorization weaknesses  
The model produces both a classification result and contextual metadata used in reporting.`
      },
      {
        title: "Automated Repair Model",
        content: `Once a vulnerability is identified, the repair model generates a secure alternative for the affected code segment.
This model uses sequence-to-sequence learning to map vulnerable code to a corrected version.
Key goals of the repair model:
• Preserve original functionality  
• Improve security posture  
• Maintain readability and maintainability  
Fixes are presented as recommendations, not automatic enforcement.`
      },
      {
        title: "Dual-Model Design Rationale",
        content: `Separating vulnerability detection and repair into two independent AI models allows:
• Independent training and evaluation  
• Better control over error propagation  
• Easier experimentation and future improvements  
This design choice is explicitly intended to support research flexibility.`
      }
    ]
  },
  {
    id: "system-architecture",
    category: "03 / SYSTEM ARCHITECTURE",
    title: "System Architecture",
    topics: [
      {
        title: "Architectural Overview",
        content: `VulnSneak follows a modular architecture composed of:
• Frontend interface  
• Backend processing layer  
• AI detection and repair models  
• Secure proxy layer  
• Reporting and validation components  
Each component is isolated to minimize risk and simplify maintenance.`
      },
      {
        title: "Raspberry Pi Security Proxy",
        content: `A Raspberry Pi device is used as a security proxy between the backend and external AI services.
This proxy:
• Stores sensitive API credentials securely  
• Prevents direct exposure of AI services  
• Enforces privilege isolation  
• Adds an additional security boundary suitable for academic environments  
This design reflects real-world secure deployment principles.`
      },
      {
        title: "Processing Flow",
        content: `The system operates through the following steps:
1. Source code is uploaded by the developer  
2. Code is preprocessed and normalized  
3. Requests are routed through the secure proxy  
4. AI detection model scans the code  
5. Repair model is triggered if vulnerabilities are found  
6. Generated fixes pass through a validation phase  
7. Results are packaged into a security report`
      }
    ]
  },
  {
    id: "dataset-training",
    category: "04 / DATASET & TRAINING",
    title: "Dataset & Model Training",
    topics: [
      {
        title: "Dataset Collection",
        content: `The dataset used to train VulnSneak is composed of:
• Public vulnerability datasets  
• Open-source code examples  
• Manually reviewed vulnerable and fixed snippets  
Each sample includes:
• Vulnerable code  
• Vulnerability label  
• Secure version of the code`
      },
      {
        title: "Labeling & Standards",
        content: `Dataset labeling is guided by established security standards:
• OWASP Top 10  
• CWE classifications  
This ensures that training focuses on vulnerabilities with real-world relevance.`
      },
      {
        title: "Data Preprocessing",
        content: `Before training, code samples undergo:
• Normalization  
• Noise removal  
• Consistent formatting  
• Tokenization suitable for Transformer models  
These steps improve training quality and model generalization.`
      }
    ]
  },
  {
    id: "features",
    category: "05 / FEATURES",
    title: "Features",
    topics: [
      {
        title: "Frontend & Backend Coverage",
        content: `VulnSneak analyzes both client-side and server-side code, reflecting realistic web application attack surfaces.`
      },
      {
        title: "Security Reporting",
        content: `Generated reports include:
• Vulnerability type  
• Code location  
• Risk explanation  
• Suggested secure fix  
Reports are designed for clarity and educational value.`
      },
      {
        title: "Developer Control",
        content: `Developers review and approve fixes before applying them, supporting a human-in-the-loop security workflow.`
      }
    ]
  },
  {
    id: "use-cases",
    category: "06 / USE CASES",
    title: "Use Cases",
    topics: [
      {
        title: "Secure Development Lifecycle",
        content: `VulnSneak helps detect vulnerabilities early, reducing security debt during later development stages.`
      },
      {
        title: "Academic & Educational Use",
        content: `The system serves as a teaching aid for:
• Secure coding practices  
• AI in cybersecurity  
• Static analysis techniques`
      },
      {
        title: "Continuous Integration",
        content: `VulnSneak can be connected to CI/CD pipelines to provide automated security feedback during code changes.`
      }
    ]
  },
  {
    id: "limitations-future",
    category: "07 / LIMITATIONS",
    title: "Limitations & Future Work",
    topics: [
      {
        title: "Limitations",
        content: `• Focused on static analysis  
• Limited vulnerability categories  
• Requires human validation for fixes  
• Does not replace expert security audits`
      },
      {
        title: "Future Work",
        content: `Planned enhancements include:
• Expanding vulnerability coverage  
• Improving automated fix validation  
• Supporting additional programming languages  
• Integrating runtime and hybrid analysis  
• Enhancing CI/CD automation and reporting`
      }
    ]
  }
];

const Docs = () => {
  const [activeId, setActiveId] = useState("getting-started");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // --- التحكم في المزامنة والظهور ---
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let timeout;
    const triggerStart = () => {
      timeout = setTimeout(() => {
        setIsReady(true);
      }, 2500);
    };

    if (window.__vsTransitionDone) {
      triggerStart();
    } else {
      window.addEventListener("pageTransitionComplete", triggerStart, { once: true });
    }

    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener("pageTransitionComplete", triggerStart);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll("section[id]");
      sections.forEach((section) => {
        const top = section.offsetTop - 150;
        const height = section.offsetHeight;
        if (window.scrollY >= top && window.scrollY < top + height) {
          setActiveId(section.getAttribute("id"));
        }
      });
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#000] text-zinc-400 font-inter selection:bg-purple-500/30 [[data-theme=light]_&]:bg-[#f4f4f7] [[data-theme=light]_&]:text-zinc-850">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Space+Grotesk:wght@700&family=Space+Mono&display=swap');
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'Space Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        [data-theme=light] ::-webkit-scrollbar-thumb { background: #c4c4c9; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }

        /* تباين جزيئات الخلفية التفاعلية */
        :root { --grid-line-color: rgba(255,255,255,0.03); }
        [data-theme=light] { --grid-line-color: rgba(0,0,0,0.04); }
      `}</style>

      {/* Grid Pattern Mask */}
      <div className="fixed inset-0 pointer-events-none" 
           style={{ backgroundImage: `radial-gradient(circle at 2px 2px, var(--grid-line-color) 1px, transparent 0)`, backgroundSize: '40px 40px' }} />

      {/* --- ELITE HEADER --- */}
      <header className="fixed top-0 inset-x-0 h-16 bg-black/60 backdrop-blur-2xl border-b border-white/[0.05] z-[100] px-6 flex items-center justify-between [[data-theme=light]_&]:bg-white/95 [[data-theme=light]_&]:border-zinc-300 [[data-theme=light]_&]:shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
          <img 
              src="/assets/icon-7.svg" 
              alt="icon" 
              className="w-9 h-9 object-contain" 
            />
            <span className="font-space text-lg font-bold tracking-tighter text-white [[data-theme=light]_&]:text-zinc-900">VULNSNEAK</span>
          </Link>
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 [[data-theme=light]_&]:bg-zinc-100 [[data-theme=light]_&]:border-zinc-250">
             <span className="text-[9px] font-mono tracking-widest text-zinc-500 [[data-theme=light]_&]:text-purple-700">DOCS_V2.0.4</span>
          </div>
        </div>

        <div className="hidden md:flex items-center flex-1 max-w-md mx-12 relative group">
          <Search className="absolute left-3 w-3.5 h-3.5 text-zinc-600 [[data-theme=light]_&]:text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search Intelligence Database..." 
            className="w-full bg-zinc-950/50 border border-white/[0.05] rounded-lg py-1.5 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-purple-500/50 transition-all [[data-theme=light]_&]:bg-zinc-100 [[data-theme=light]_&]:border-zinc-300 [[data-theme=light]_&]:text-zinc-900"
          />
          <div className="absolute right-3 font-mono text-[9px] text-zinc-700">⌘K</div>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/contact" className="hidden sm:block text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-white transition-colors [[data-theme=light]_&]:text-zinc-600 [[data-theme=light]_&]:hover:text-black">
            Support
          </Link>
          <button className="md:hidden text-white [[data-theme=light]_&]:text-zinc-900" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Main Wrapper */}
      <motion.div 
        className="pt-16 max-w-7xl mx-auto flex"
        initial={{ opacity: 0 }}
        animate={isReady ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8 }}
      >
        
        {/* --- DYNAMIC SIDEBAR (Isolate Background for Clear contrast) --- */}
        <aside className={`fixed md:sticky top-16 left-0 w-72 h-[calc(100vh-4rem)] overflow-y-auto bg-black md:bg-transparent z-[90] transition-transform duration-500 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} border-r border-white/[0.03] pt-12 px-6 [[data-theme=light]_&]:border-zinc-300 [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}>
          <nav className="space-y-10 pb-20">
            {docs.map((section) => (
              <div key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={`block text-[10px] font-bold tracking-[0.3em] uppercase mb-4 transition-colors ${
                    activeId === section.id 
                      ? "text-purple-500 [[data-theme=light]_&]:text-purple-700" 
                      : "text-zinc-600 hover:text-zinc-400 [[data-theme=light]_&]:text-zinc-500 [[data-theme=light]_&]:hover:text-zinc-900"
                  }`}
                >
                  {section.category}
                </a>
                <ul className="space-y-2 border-l border-white/5 ml-1 pl-4 [[data-theme=light]_&]:border-zinc-250">
                  {section.topics.map((topic, tIdx) => (
                    <li key={tIdx}>
                      <a
                        href={`#${section.id}-${tIdx}`}
                        className="block text-xs text-zinc-500 hover:text-white transition-all duration-200 [[data-theme=light]_&]:text-zinc-600 [[data-theme=light]_&]:hover:text-purple-700 [[data-theme=light]_&]:hover:bg-purple-50/60 [[data-theme=light]_&]:px-2.5 [[data-theme=light]_&]:py-1.5 [[data-theme=light]_&]:rounded-lg"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {topic.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* --- MAIN DOCUMENTATION CONTENT --- */}
        <main className="flex-1 min-w-0 md:px-16 pt-12 pb-32">
          
          <header className="mb-20">
            <h1 className="text-5xl md:text-7xl font-bold font-space tracking-tighter text-white mb-6 [[data-theme=light]_&]:text-zinc-950">
               DOCUMENTATION<span className="text-zinc-800 [[data-theme=light]_&]:text-zinc-400">.</span>
            </h1>
            <p className="text-lg text-zinc-500 font-light max-w-2xl leading-relaxed [[data-theme=light]_&]:text-zinc-700 [[data-theme=light]_&]:font-normal">
              Academic research and technical implementation guide for the VulnSneak autonomous security ecosystem.
            </p>
          </header>

          <div className="space-y-32">
            {docs.map((doc) => (
              <section key={doc.id} id={doc.id} className="scroll-mt-32">
                <div className="flex items-center gap-4 mb-12">
                   <div className="w-12 h-px bg-purple-500/30 [[data-theme=light]_&]:bg-purple-600/60"></div>
                   <h2 className="text-3xl font-bold font-space tracking-tight text-white uppercase italic [[data-theme=light]_&]:text-zinc-950">
                    {doc.title}
                  </h2>
                </div>

                <div className="grid gap-12">
                  {doc.topics.map((topic, idx) => (
                    <div key={idx} id={`${doc.id}-${idx}`} className="scroll-mt-32 group">
                      <div className="flex items-center gap-3 mb-6">
                         <Terminal size={14} className="text-zinc-700 group-hover:text-purple-500 transition-colors [[data-theme=light]_&]:text-zinc-500 [[data-theme=light]_&]:group-hover:text-purple-600" />
                         <h3 className="text-xl font-semibold text-zinc-200 [[data-theme=light]_&]:text-zinc-950">
                          {topic.title}
                         </h3>
                      </div>
                      
                      {/* كروت التوثيق مع ظلال مميزة وخط تزيين جانبي تفاعلي في وضع النهار */}
                      <div className="relative overflow-hidden rounded-2xl border border-white/[0.03] bg-zinc-950/40 p-8 hover:bg-zinc-900/40 transition-all border-l-transparent [[data-theme=light]_&]:border-zinc-200 [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:shadow-[0_15px_45px_rgba(0,0,0,0.08)] [[data-theme=light]_&]:hover:shadow-[0_25px_60px_rgba(0,0,0,0.14)] [[data-theme=light]_&]:hover:bg-white [[data-theme=light]_&]:border-l-4 [[data-theme=light]_&]:border-l-zinc-300 [[data-theme=light]_&]:hover:border-l-purple-600">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/10 to-transparent"></div>
                        <p className="text-zinc-500 text-base leading-8 whitespace-pre-line font-light [[data-theme=light]_&]:text-zinc-800 [[data-theme=light]_&]:font-normal">
                          {topic.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="mb-10 pt-10 border-t border-white/5 flex items-center justify-between [[data-theme=light]_&]:border-zinc-300">
             <Link to="/" className="text-[10px] font-mono tracking-widest text-zinc-600 hover:text-white transition-colors uppercase [[data-theme=light]_&]:text-zinc-600 [[data-theme=light]_&]:hover:text-zinc-950">
               ← Terminal / Root
             </Link>
             <div className="text-[8px] font-mono text-zinc-800 tracking-widest uppercase [[data-theme=light]_&]:text-zinc-600">
               Last Update: Dec 2025 / Secure-Node
             </div>
          </footer>
        </main>

        <aside className="hidden xl:block w-64 pt-24 sticky top-0 h-screen pr-6">
           <div className="p-6 rounded-2xl border border-white/[0.03] bg-zinc-950/20 [[data-theme=light]_&]:border-zinc-200 [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
              <h4 className="text-[9px] font-bold tracking-[0.3em] text-zinc-700 uppercase mb-6 [[data-theme=light]_&]:text-zinc-400">In This Section</h4>
              <div className="flex items-center gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></div>
                 <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest [[data-theme=light]_&]:text-zinc-700">Reading: {activeId}</span>
              </div>
           </div>
        </aside>
        
      </motion.div>
    </div>
  );
};

export default memo(Docs);