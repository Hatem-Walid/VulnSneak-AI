import React, { useState, memo, useRef, useEffect } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import { Mic, MicOff, Shield, Activity } from 'lucide-react';

const retellWebClient = new RetellWebClient();

const RetellAgent = () => {
  const [isCalling, setIsCalling] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const dragInfo = useRef({ startX: 0, startY: 0, hasMoved: false });
// old voice agent
  // const AGENT_ID = "agent_9b47b3e56823c52808c6519818";
  // const API_KEY = "key_b7f5ec9e816de552dd7a0892e3bd"; 
  
  const AGENT_ID = "agent_535374580496295b507146ea72";
  const API_KEY = "key_4a8d90aad831d6b3f30fd7d5499a"; 

  const toggleCall = async () => {
    if (isCalling) {
      retellWebClient.stopCall();
      setIsCalling(false);
      return;
    }
    try {
      const response = await fetch("https://api.retellai.com/v2/create-web-call", {
        method: "POST",
        headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: AGENT_ID }),
      });
      const data = await response.json();
      await retellWebClient.startCall({ accessToken: data.access_token });
      setIsCalling(true);
      retellWebClient.on("call_ended", () => setIsCalling(false));
    } catch (e) { console.error(e); }
  };

  const onPointerDown = (e) => {
    dragInfo.current.startX = e.clientX - position.x;
    dragInfo.current.startY = e.clientY - position.y;
    dragInfo.current.hasMoved = false;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (isDragging) {
      const newX = e.clientX - dragInfo.current.startX;
      const newY = e.clientY - dragInfo.current.startY;
      if (Math.abs(newX - position.x) > 5) dragInfo.current.hasMoved = true;
      setPosition({ x: newX, y: newY });
    }
    // Track mouse for the magnetic glow effect
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div 
      className={`interface-container ${isCalling ? 'calling' : ''}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => {
        setIsDragging(false);
        if (!dragInfo.current.hasMoved) toggleCall();
      }}
    >
      <style>{cssStyles}</style>

      {/* Background Data Stream (Visual Only) */}
      {/* <div className="data-stream">
        <span>0x71...</span><span>AI_LINK</span><span>ACTIVE</span>
      </div> */}

      {/* The Main Interface Button */}
      <div className="neural-pill" style={{ '--mx': `${mousePos.x}px`, '--my': `${mousePos.y}px` }}>
        <div className="glass-inner">
        <div className="icon-orbit">
          {isCalling ? (
            <Activity className="pulse-icon" />
          ) : (
            <img 
              src="/assets/icon-7.svg" 
              alt="icon" 
              className="w-12 h-12 object-contain" 
            />
          )}
        </div>
          
          <div className="label-stack">
            <span className="tiny-meta">SECURE_VOICE_LINE</span>
            <span className="main-text">{isCalling ? "ENCRYPTED LINK" : "Jarvis Ready for you"}</span>
          </div>

          <div className="visualizer-mini">
            <div className={`v-dot ${isCalling ? 'v-active' : ''}`}></div>
            <div className={`v-dot ${isCalling ? 'v-active' : ''}`}></div>
            <div className={`v-dot ${isCalling ? 'v-active' : ''}`}></div>
          </div>
        </div>

        {/* Floating Scanner Line */}
        <div className="scanner-line"></div>
        
        {/* Perimeter Light Trace */}
        <div className="perimeter-glow"></div>
      </div>
      
      {/* System Status Label */}
      {/* <div className="status-tag">
        <span className="dot"></span>
        {isCalling ? "CONNECTION_STABLE" : "READY_FOR_UPLINK"}
      </div> */}
    </div>
  );
};

const cssStyles = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;900&display=swap');

.interface-container {
  position: fixed;
  bottom: 50px;
  right: 50px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  touch-action: none;
}

.neural-pill {
  position: relative;
  width: 280px;
  height: 64px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1), background 0.4s ease, border-color 0.4s ease;
}

/* ── ألوان الوضع الفاتح لـ الـ Pill ── */
html[data-theme='light'] .neural-pill {
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.04);
}

.glass-inner {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 15px;
}

/* Perimeter light orbit effect */
.perimeter-glow {
  position: absolute;
  inset: -1px;
  border-radius: 16px;
  padding: 1px;
  background: conic-gradient(from var(--angle), transparent 70%, #fff 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  animation: rotate 4s linear infinite;
  transition: background 0.4s ease;
}

/* ── تعديل توهج المدار للون الداكن في الوضع الفاتح ── */
html[data-theme='light'] .perimeter-glow {
  background: conic-gradient(from var(--angle), transparent 70%, #000 100%);
}

@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes rotate {
  to { --angle: 360deg; }
}

.icon-orbit {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.4s ease;
}

/* ── الأيقونة الدائرية في الوضع الفاتح ── */
html[data-theme='light'] .icon-orbit {
  background: rgba(0, 0, 0, 0.04);
  color: #121212;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.label-stack {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.tiny-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.4s ease;
}

/* ── النصوص الفوقية في الفاتح ── */
html[data-theme='light'] .tiny-meta {
  color: rgba(0, 0, 0, 0.5);
}

.main-text {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 1px;
  color: #fff;
  transition: color 0.4s ease;
}

/* ── النص الأساسي في الفاتح ── */
html[data-theme='light'] .main-text {
  color: #121212;
}

.scanner-line {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.05), transparent);
  transform: translateY(-100%);
  animation: scan 3s linear infinite;
  transition: background 0.4s ease;
}

/* ── خط المسح العمودي في الفاتح ── */
html[data-theme='light'] .scanner-line {
  background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.03), transparent);
}

@keyframes scan {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

.visualizer-mini {
  display: flex;
  gap: 4px;
}

.v-dot {
  width: 3px; height: 3px;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  transition: background 0.4s ease;
}

/* ── نقاط الـ Visualizer في الفاتح ── */
html[data-theme='light'] .v-dot {
  background: rgba(0,0,0,0.15);
}

.v-active {
  background: #fff;
  animation: pulse 0.6s infinite alternate;
}

html[data-theme='light'] .v-active {
  background: #000;
}

.v-active:nth-child(2) { animation-delay: 0.2s; }
.v-active:nth-child(3) { animation-delay: 0.4s; }

.status-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 10px;
}

.dot {
  width: 5px; height: 5px;
  background: #00ff88;
  border-radius: 50%;
  box-shadow: 0 0 10px #00ff88;
}

.data-stream {
  position: absolute;
  top: -20px;
  right: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 10px;
}

.calling .neural-pill {
  background: rgba(255, 255, 255, 0.1);
  border-color: #fff;
}

/* ── تلوين الـ Pill في الوضع الفاتح أثناء الاتصال ── */
html[data-theme='light'] .calling .neural-pill {
  background: rgba(0, 0, 0, 0.08);
  border-color: #000;
}

.pulse-icon {
  animation: icon-pulse 1.5s infinite ease-in-out;
}

@keyframes icon-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.7; }
}

@keyframes pulse {
  from { opacity: 0.2; }
  to { opacity: 1; }
}

/* =========================================
   تجاوب الموبايل (Responsive)
   يقلص الحجم قليلاً ويقربه للزاوية لسهولة الاستخدام
   ========================================= */
@media screen and (max-width: 768px) {
  .interface-container {
    bottom: 20px;
    right: 20px;
  }
  .neural-pill {
    width: 240px;
    height: 56px;
    border-radius: 12px;
  }
  .glass-inner {
    padding: 0 15px;
    gap: 10px;
  }
  .icon-orbit {
    width: 32px;
    height: 32px;
  }
  .main-text {
    font-size: 11px;
  }
}
`;

export default memo(RetellAgent);