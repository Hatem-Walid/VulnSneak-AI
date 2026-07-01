import React, { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  ArrowLeft, 
  Heart, 
  Share2,
  ShieldAlert,
  Hash,
  Terminal,
  ChevronRight
} from "lucide-react";

const BlogPage = () => {
  // --- منطق الانتظار والمزامنة ---
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let timeout;
    const triggerPageStart = () => {
      timeout = setTimeout(() => {
        setIsReady(true);
      }, 2000);
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

  // --- البيانات الأصلية ---
  const [posts, setPosts] = useState([
    {
      id: 1,
      title: "SQL INJECTION: DATABASE PENETRATION",
      excerpt: "Exploiting unsanitized input to manipulate backend queries and bypass authentication protocols.",
      content: `
        <div class="space-y-8 font-inter leading-loose content-text">
          <p>SQL Injection (SQLi) is a critical security flaw where an attacker interferes with the queries that an application makes to its database. This vulnerability typically allows an attacker to view, modify, or delete data they are not authorized to access.</p>
          <h3 class="font-space text-2xl font-bold tracking-tight mt-10">01. TECHNICAL VECTORS</h3>
          <p>Occurs when user-supplied data is concatenated directly into a SQL command instead of using parameterized queries. Attackers use special characters like <code class="px-2.5 py-1 rounded font-bold">' OR 1=1 --</code> to manipulate logic.</p>
          <h3 class="font-space text-2xl font-bold tracking-tight mt-10">02. MITIGATION STRATEGIES</h3>
          <ul class="space-y-4 list-none font-medium content-list">
            <li class="flex items-start gap-3"><span>/</span> Use Prepared Statements (Parameterized Queries).</li>
            <li class="flex items-start gap-3"><span>/</span> Implement strict allow-list input validation.</li>
            <li class="flex items-start gap-3"><span>/</span> Enforce Principle of Least Privilege on database accounts.</li>
          </ul>
        </div>
      `,
      date: "DEC 17, 2025",
      tags: ["OWASP-01", "SQLI", "DATABASE"],
      image: "https://plus.unsplash.com/premium_photo-1664297989345-f4ff2063b212?q=80&w=798&auto=format&fit=crop",
      likes: 245,
      featured: true
    },
    {
      id: 2,
      title: "XSS: CLIENT-SIDE SCRIPT INJECTION",
      excerpt: "Injecting malicious scripts into trusted websites to compromise user sessions and steal sensitive tokens.",
      content: `
        <div class="space-y-8 font-inter leading-loose content-text">
          <p>Cross-Site Scripting (XSS) occurs when an attacker uses a web application to send malicious code, generally in the form of a browser-side script, to a different end user.</p>
          <h3 class="font-space text-2xl font-bold tracking-tight mt-10">01. THE IMPACT</h3>
          <p>Flaws that allow these attacks are widespread and occur anywhere a web application uses input from a user within the output it generates without validating or encoding it.</p>
          <h3 class="font-space text-2xl font-bold tracking-tight mt-10">02. DEFENSE MECHANISMS</h3>
          <p>The primary defense is <strong>Output Encoding</strong> and a strong <strong>Content Security Policy (CSP)</strong> to restrict script sources.</p>
        </div>
      `,
      date: "DEC 16, 2025",
      tags: ["XSS", "JS", "CLIENT-SIDE"],
      image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop",
      likes: 189,
      featured: false
    },
    {
      id: 3,
      title: "OS COMMAND INJECTION: ARBITRARY EXECUTION",
      excerpt: "Executing arbitrary commands on the host operating system via vulnerable application inputs.",
      content: `
        <div class="space-y-8 font-inter leading-loose content-text">
          <p>OS Command Injection is a vulnerability that allows an attacker to execute arbitrary operating system (OS) commands on the server that is running an application.</p>
          <h3 class="font-space text-2xl font-bold tracking-tight mt-10">01. THE RISK</h3>
          <p>This typically leads to full compromise of the application and its data. Attackers can leverage this to pivot to other internal systems.</p>
        </div>
      `,
      date: "DEC 15, 2025",
      tags: ["RCE", "SHELL", "SYSTEM"],
      image: "https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=2074&auto=format&fit=crop",
      likes: 134,
      featured: false
    },
    {
      id: 4,
      title: "INSUFFICIENT CRYPTOGRAPHY: WEAK PROTOCOLS",
      excerpt: "Failures in protecting sensitive data through the use of outdated or broken cryptographic algorithms.",
      content: `
        <div class="space-y-8 font-inter leading-loose content-text">
          <p>Insufficient cryptography involves using algorithms that are known to be weak (like MD5 or SHA1) or improper key management.</p>
          <h3 class="font-space text-2xl font-bold tracking-tight mt-10">01. SECURITY DEBT</h3>
          <p>Using custom crypto instead of standard, audited libraries is a primary cause of failure in modern applications.</p>
        </div>
      `,
      date: "DEC 14, 2025",
      tags: ["CRYPTO", "ENCRYPTION", "AES"],
      image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2070&auto=format&fit=crop",
      likes: 98,
      featured: false
    },
    {
      id: 5,
      title: "XXE: XML EXTERNAL ENTITY PROCESSING",
      excerpt: "Abusing XML parsers to disclose internal files and conduct server-side request forgery (SSRF).",
      content: `
        <div class="space-y-8 font-inter leading-loose content-text">
          <p>XXE is a vulnerability where an application processes XML input containing a reference to an external entity.</p>
          <h3 class="font-space text-2xl font-bold tracking-tight mt-10">01. PREVENTION</h3>
          <p>Disable DTDs (External Entities) completely in your XML parser configuration to neutralize this threat.</p>
        </div>
      `,
      date: "DEC 12, 2025",
      tags: ["XML", "XXE", "PARSER"],
      image: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?q=80&w=2128&auto=format&fit=crop",
      likes: 76,
      featured: false
    },
    {
      id: 6,
      title: "PATH TRAVERSAL: FILE SYSTEM EXPOSURE",
      excerpt: "Manipulating file paths to access restricted directories outside the web server root.",
      content: `
        <div class="space-y-8 font-inter leading-loose content-text">
          <p>Also known as directory traversal, this allows attackers to read arbitrary files on the server running an application.</p>
          <code class="block p-4 rounded text-xs font-mono">GET /image?name=../../../etc/passwd</code>
        </div>
      `,
      date: "DEC 10, 2025",
      tags: ["LFI", "FILESYSTEM", "LINUX"],
      image: "https://images.unsplash.com/photo-1590494165264-1ebe3602eb80?q=80&w=2070&auto=format&fit=crop",
      likes: 112,
      featured: false
    },
    {
      id: 7,
      title: "CSRF: UNAUTHORIZED REQUEST FORGERY",
      excerpt: "Tricking victims into performing actions they did not intend to do on a different web application.",
      content: `
        <div class="space-y-8 font-inter leading-loose content-text">
          <p>CSRF forces an authenticated user to execute unwanted actions on a web application in which they are currently authenticated.</p>
          <h3 class="font-space text-2xl font-bold tracking-tight mt-10">01. ANTI-CSRF</h3>
          <p>Implement unique Anti-CSRF tokens and use SameSite cookie attributes to mitigate this risk.</p>
        </div>
      `,
      date: "DEC 08, 2025",
      tags: ["CSRF", "AUTH", "SESSIONS"],
      image: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?q=80&w=870&auto=format&fit=crop",
      likes: 88,
      featured: false
    },
    {
      id: 12,
      title: "INSECURE DESERIALIZATION: RCE VECTORS",
      excerpt: "Exploiting object serialization logic to execute arbitrary code and manipulate application state.",
      content: `
        <div class="space-y-8 font-inter leading-loose content-text">
          <p>This occurs when untrusted data is used to abuse the logic of an application, leading to Remote Code Execution (RCE).</p>
        </div>
      `,
      date: "DEC 05, 2025",
      tags: ["JAVA", "PYTHON", "RCE"],
      image: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop",
      likes: 156,
      featured: false
    }
  ]);

  const [selectedPost, setSelectedPost] = useState(null);

  const handlePostClick = (post) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSelectedPost(post);
  };

  return (
    <div className="min-h-screen bg-black text-white pt-32 pb-20 px-6 font-inter selection:bg-purple-500/30 [[data-theme=light]_&]:bg-[#f3f4f6] [[data-theme=light]_&]:text-zinc-900 [[data-theme=light]_&]:selection:bg-purple-500/10">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Space+Grotesk:wght@700&family=Space+Mono&display=swap');
        
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'Space Mono', monospace; }
        
        /* ── تباين متناسق لنصوص المقالات الديناميكية ── */
        .report-content p { margin-bottom: 1.5rem; color: #a1a1aa; transition: color 0.3s; }
        [data-theme=light] .report-content p { color: #18181b; }

        .report-content h3 { color: #ffffff; transition: color 0.3s; }
        [data-theme=light] .report-content h3 { color: #09090b; }

        .report-content strong { color: #ffffff; font-weight: 600; transition: color 0.3s; }
        [data-theme=light] .report-content strong { color: #09090b; }

        .report-content code { background-color: rgba(255,255,255,0.05); color: #c084fc; border: 1px solid rgba(255,255,255,0.05); transition: all 0.3s; }
        [data-theme=light] .report-content code { background-color: #f4f4f5; color: #7e22ce; border: 1px solid #e4e4e7; }

        .report-content .content-list li { color: #a1a1aa; transition: color 0.3s; }
        [data-theme=light] .report-content .content-list li { color: #18181b; }
        
        .report-content .content-list span { color: #a855f7; }
        [data-theme=light] .report-content .content-list span { color: #7e22ce; }

        /* جزيئات الخلفية الهندسية الافتراضية والنهارية */
        :root { 
          --grid-line-color: rgba(255, 255, 255, 0.15); 
          --grid-size: 40px 40px;
        }
        
        [data-theme=light] { 
          --grid-line-color: rgba(0, 0, 0, 0.4); 
        }
      `}</style>

      {/* Grid Pattern Mask */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-100 z-0" 
        style={{ 
          backgroundImage: `radial-gradient(circle at 2px 2px, var(--grid-line-color) 1.5px, transparent 0)`, 
          backgroundSize: 'var(--grid-size)' 
        }} 
      />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* --- المزامنة --- */}
        <AnimatePresence mode="wait">
          {!isReady ? (
            <motion.div 
              key="loading-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              className="min-h-screen"
            />
          ) : !selectedPost ? (
            <motion.div 
              key="list" 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.8 }}
              exit={{ opacity: 0 }}
            >
              {/* Header */}
              <div className="flex flex-col items-center text-center mb-24">
                <div className="px-4 py-1.5 rounded-full border border-white/10 bg-white/5 mb-6 [[data-theme=light]_&]:border-zinc-300 [[data-theme=light]_&]:bg-white/50 [[data-theme=light]_&]:shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
                  <span className="text-[10px] uppercase tracking-[0.5em] text-zinc-500 font-bold [[data-theme=light]_&]:text-zinc-800 [[data-theme=light]_&]:font-extrabold">Academic Database</span>
                </div>
                <h1 className="text-5xl md:text-8xl font-bold font-space tracking-tighter mb-6 text-white [[data-theme=light]_&]:text-zinc-900">
                  SECURITY <span className="text-zinc-700 [[data-theme=light]_&]:text-zinc-500">INTELLIGENCE.</span>
                </h1>
                <p className="text-zinc-500 text-lg max-w-xl font-light [[data-theme=light]_&]:text-zinc-800 [[data-theme=light]_&]:font-normal">
                  A comprehensive knowledge base for next-generation vulnerability research.
                </p>
              </div>

              {/* Featured Cinematic Section */}
              <motion.div 
                onClick={() => handlePostClick(posts.find(p => p.featured))}
                className="mb-24 relative group cursor-pointer rounded-[40px] overflow-hidden border border-white/[0.08] bg-gradient-to-br from-[#0c0d0e] via-[#050505] to-[#121316] backdrop-blur-xl shadow-[0_35px_90px_-20px_rgba(0,0,0,0.85)] [[data-theme=light]_&]:border-white/80 [[data-theme=light]_&]:bg-gradient-to-br [[data-theme=light]_&]:from-white/45 [[data-theme=light]_&]:via-zinc-600/90 [[data-theme=light]_&]:to-zinc-200/95 [[data-theme=light]_&]:shadow-[0_35px_90px_-20px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-500"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 items-center">
                  <div className="relative h-[450px] lg:h-[650px] overflow-hidden bg-zinc-900 [[data-theme=light]_&]:bg-zinc-100">
                    <img 
                      src={posts.find(p => p.featured).image} 
                      className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 [[data-theme=light]_&]:grayscale-0 [[data-theme=light]_&]:opacity-100 transition-all duration-700 group-hover:scale-105" 
                      alt="Featured" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/20 to-transparent hidden lg:block [[data-theme=light]_&]:hidden" />
                  </div>
                  <div className="p-10 md:p-20">
                    <div className="flex items-center gap-4 mb-8">
                      <ShieldAlert className="text-purple-500 [[data-theme=light]_&]:text-purple-600" size={20} />
                      <span className="text-[10px] font-mono tracking-[0.3em] text-purple-500 [[data-theme=light]_&]:text-purple-600 font-bold [[data-theme=light]_&]:font-black">LEVEL: CRITICAL_INTEL</span>
                    </div>
                    <h2 className="text-4xl md:text-7xl font-bold font-space tracking-tighter mb-8 leading-[0.9] text-white [[data-theme=light]_&]:text-zinc-900">
                      {posts.find(p => p.featured).title}
                    </h2>
                    <p className="text-zinc-500 text-lg font-light mb-12 leading-relaxed [[data-theme=light]_&]:text-zinc-800 [[data-theme=light]_&]:font-normal">
                      {posts.find(p => p.featured).excerpt}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-purple-400 [[data-theme=light]_&]:text-purple-600 tracking-widest uppercase font-bold">
                       <span>{posts.find(p => p.featured).date}</span>
                       <ChevronRight size={14} className="group-hover:translate-x-2 transition-transform text-purple-400 [[data-theme=light]_&]:text-purple-600" />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Technical Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.filter(p => !p.featured).map((post, idx) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => handlePostClick(post)}
                    className="group rounded-[32px] p-8 border border-white/[0.08] bg-gradient-to-br from-[#0c0d0e] via-[#050505] to-[#121316] backdrop-blur-xl shadow-[0_35px_90px_-20px_rgba(0,0,0,0.85)] [[data-theme=light]_&]:border-white/80 [[data-theme=light]_&]:bg-gradient-to-br [[data-theme=light]_&]:from-white/45 [[data-theme=light]_&]:via-zinc-600/90 [[data-theme=light]_&]:to-zinc-200/95 [[data-theme=light]_&]:shadow-[0_35px_90px_-20px_rgba(0,0,0,0.12)] hover:border-purple-500/30 [[data-theme=light]_&]:hover:border-purple-600/30 hover:-translate-y-1 transition-all duration-500 cursor-pointer"
                  >
                    <div className="aspect-video rounded-2xl overflow-hidden mb-8 bg-zinc-900 [[data-theme=light]_&]:bg-zinc-100">
                      <img 
                        src={post.image} 
                        className="w-full h-full object-cover grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-90 [[data-theme=light]_&]:grayscale-0 [[data-theme=light]_&]:opacity-100 transition-all duration-700 group-hover:scale-105" 
                        alt={post.title} 
                      />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                       <span className="text-[9px] font-mono tracking-widest text-purple-400 uppercase font-bold [[data-theme=light]_&]:text-purple-600 [[data-theme=light]_&]:font-extrabold">{post.date}</span>
                       <Hash size={12} className="text-purple-500/50 [[data-theme=light]_&]:text-purple-600/50" />
                    </div>
                    <h3 className="text-xl font-bold font-space tracking-tight mb-4 text-white group-hover:text-purple-400 transition-colors [[data-theme=light]_&]:text-zinc-900 [[data-theme=light]_&]:group-hover:text-purple-600">
                      {post.title}
                    </h3>
                    <p className="text-zinc-600 text-sm font-light leading-relaxed mb-8 line-clamp-3 [[data-theme=light]_&]:text-zinc-800 [[data-theme=light]_&]:font-normal">
                      {post.excerpt}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {post.tags.slice(0, 2).map(tag => (
                        <span 
                          key={tag} 
                          className="text-[8px] font-mono px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-purple-400 [[data-theme=light]_&]:bg-purple-100/50 [[data-theme=light]_&]:border-purple-200 [[data-theme=light]_&]:text-purple-700 [[data-theme=light]_&]:font-bold"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            /* --- SINGLE REPORT VIEW --- */
            <motion.div 
              key="single" 
              initial={{ opacity: 0, y: 40 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 40 }} 
              className="max-w-4xl mx-auto"
            >
              {/* Back Button */}
              <button 
                onClick={() => setSelectedPost(null)} 
                className="flex items-center gap-3 text-purple-500 hover:text-purple-400 mb-8 group transition-all [[data-theme=light]_&]:text-purple-600 [[data-theme=light]_&]:hover:text-purple-800"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-[10px] font-mono uppercase tracking-[0.4em] font-bold [[data-theme=light]_&]:font-extrabold">Database / Exit</span>
              </button>

              {/* Glassmorphism Card Wrapper */}
              <div className="rounded-[40px] p-8 md:p-16 border border-white/[0.08] bg-gradient-to-br from-[#0c0d0e] via-[#050505] to-[#121316] backdrop-blur-xl shadow-[0_35px_90px_-20px_rgba(0,0,0,0.85)] [[data-theme=light]_&]:border-white/80 [[data-theme=light]_&]:bg-gradient-to-br [[data-theme=light]_&]:from-white/45 [[data-theme=light]_&]:via-zinc-600/90 [[data-theme=light]_&]:to-zinc-200/95 [[data-theme=light]_&]:shadow-[0_35px_90px_-20px_rgba(0,0,0,0.12)]">
                
                <header className="mb-20">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-px bg-purple-500"></div>
                    <span className="text-[10px] font-mono tracking-[0.4em] text-purple-500 [[data-theme=light]_&]:text-purple-600 font-extrabold">VULNERABILITY_DOSSIER</span>
                  </div>
                  <h1 className="text-4xl md:text-7xl font-bold font-space tracking-tighter mb-10 leading-none text-white [[data-theme=light]_&]:text-zinc-900">
                    {selectedPost.title}
                  </h1>
                  <div className="flex flex-wrap gap-10 text-[10px] font-mono text-purple-400 [[data-theme=light]_&]:text-purple-600 uppercase tracking-[0.3em] border-y border-white/5 py-8 [[data-theme=light]_&]:border-zinc-300 [[data-theme=light]_&]:font-black">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 [[data-theme=light]_&]:text-zinc-400 font-normal">CLNDR:</span> {selectedPost.date}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 [[data-theme=light]_&]:text-zinc-400 font-normal">INDEX:</span> {selectedPost.id}0X
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 [[data-theme=light]_&]:text-zinc-400 font-normal">LEVEL:</span> CRITICAL
                    </div>
                  </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-20">
                  <article className="report-content prose prose-zinc max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: selectedPost.content }} />
                  </article>

                  <aside className="space-y-12">
                     <div>
                       <h4 className="text-[10px] font-bold tracking-[0.4em] text-purple-500 uppercase mb-6 [[data-theme=light]_&]:text-purple-600">Interaction</h4>
                       <button 
                         onClick={() => setPosts(posts.map(p => p.id === selectedPost.id ? { ...p, likes: p.likes + 1 } : p))} 
                         className="flex items-center gap-3 text-pink-500 hover:text-pink-400 transition-colors font-bold"
                       >
                          <Heart size={18} /> 
                          <span className="font-mono text-xs font-black">{selectedPost.likes}</span>
                       </button>
                     </div>
                     <div>
                       <h4 className="text-[10px] font-bold tracking-[0.4em] text-purple-500 uppercase mb-6 [[data-theme=light]_&]:text-purple-600">Classification</h4>
                       <div className="flex flex-wrap gap-2">
                         {selectedPost.tags.map(tag => (
                           <span 
                             key={tag} 
                             className="text-[9px] font-mono bg-white/5 border border-white/5 px-2 py-1 rounded text-purple-400 [[data-theme=light]_&]:bg-zinc-100 [[data-theme=light]_&]:border-zinc-200 [[data-theme=light]_&]:text-purple-700 [[data-theme=light]_&]:font-black"
                           >
                             #{tag}
                           </span>
                         ))}
                       </div>
                     </div>
                  </aside>
                </div>
                
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default memo(BlogPage);