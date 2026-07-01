import { createContext, useContext, useState } from "react";

const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toasts Container */}
      <div className="fixed top-5 right-5 space-y-3 z-9999">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              max-w-sm w-full bg-white/10 backdrop-blur-xl border border-white/20
              shadow-2xl rounded-2xl px-6 py-4 text-white font-medium text-lg
              transition-all duration-500
              animate-toastFade
              ${t.type === "error" ? "bg-red-600/40 border-red-400/30" : "bg-green-600/40 border-green-400/30"}
            `}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
