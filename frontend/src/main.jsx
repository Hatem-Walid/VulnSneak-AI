import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import ToastProvider from "./components/ToastProvider";
import { BrowserRouter as Router } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";

// 👇 1. استيراد البروفايدر اللي عملناه
import { AuthProvider } from "./context/AuthContext"; 

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <Router>
        {/* 👇 2. تغليف التطبيق بالـ AuthProvider عشان كل الصفحات تشوف اليوزر */}
        <AuthProvider>
          <App />
          <SpeedInsights/>
        </AuthProvider>
      </Router>
    </ToastProvider>
  </React.StrictMode>
);