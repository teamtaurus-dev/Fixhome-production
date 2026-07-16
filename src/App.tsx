import React, { useState } from "react";
import { Database } from "lucide-react";
import CustomerPortal from "./components/CustomerPortal.tsx";
import AdminPortal from "./components/AdminPortal.tsx";

export default function App() {
  // Mobile/Tablet responsive view selector
  const [activeTab, setActiveTab] = useState<"customer" | "admin" >("customer");

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex h-full w-full overflow-x-hidden">
      
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex w-72 border-r border-slate-200 bg-slate-50 flex-col p-6 shrink-0 justify-between">
        <div className="space-y-6">
          {/* Brand Logo & Title */}
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B] flex items-center gap-2 font-display">
              <span className="w-8 h-8 bg-[#65A30D] rounded flex items-center justify-center text-white text-lg font-bold">F</span> Fix home
            </h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold font-mono">Portal Manager</p>
          </div>

          {/* Interactive Environment Navigation Switching */}
          <nav className="space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-2 tracking-wider">Select Portal</div>
            
            <button
              onClick={() => setActiveTab("customer")}
              className={`w-full flex items-center gap-3 p-3 border rounded-lg text-sm font-semibold shadow-2xs transition-all ${
                activeTab === "customer"
                  ? "bg-white border-slate-200 text-[#1E293B] font-bold"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${activeTab === "customer" ? "bg-[#65A30D]" : "bg-slate-300"}`}></div>
              Customer Portal
            </button>

            <button
              onClick={() => setActiveTab("admin")}
              className={`w-full flex items-center gap-3 p-3 border rounded-lg text-sm font-semibold shadow-2xs transition-all ${
                activeTab === "admin"
                  ? "bg-white border-slate-200 text-[#1E293B] font-bold"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${activeTab === "admin" ? "bg-[#65A30D]" : "bg-slate-300"}`}></div>
              Admin Gateway
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 leading-relaxed font-mono">
          Fix home • Portal Panel
        </div>
      </aside>

      {/* RIGHT CONTENT WORKSPACE AREA */}
      <main className="flex-1 flex flex-col bg-white overflow-y-auto">
        
        {/* TOP STATUS HEADER BAR */}
        <header className="h-16 border-b border-slate-100 flex items-center justify-between px-6 lg:px-8 bg-white/80 backdrop-blur-md z-30 sticky top-0">
          <div className="flex items-center gap-4">
            <div className="text-xs lg:text-sm font-medium text-slate-500">
              Directory / <span className="text-slate-900 font-semibold">{activeTab === "customer" ? "Customer Portal" : "Admin Gateway"}</span>
            </div>
          </div>
          
          {/* Header Actions */}
          <div className="flex gap-2">
          </div>
        </header>

        {/* MOBILE WORKSPACE CONTROL HEADER FOR PORTABLE SCREENS */}
        <div className="lg:hidden p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="text-left w-full sm:w-auto">
            <h2 className="text-base font-bold text-slate-900">Fix home</h2>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider font-mono">Portal Navigator</p>
          </div>
          
          <div className="flex items-center bg-slate-200/80 rounded-xl p-1 border border-slate-300 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("customer")}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === "customer"
                  ? "bg-[#65A30D] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📱 Customer App
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === "admin"
                  ? "bg-[#65A30D] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🔒 Admin Dashboard
            </button>
          </div>
        </div>

        {/* RESPONSIVE LAYOUT WORKSPACE */}
        <div className="flex-1 p-6 lg:p-8 flex flex-col gap-8 items-center justify-start w-full max-w-6xl mx-auto">
          
          {/* Tab Selection Header on top of frame */}
          <div className="flex items-center justify-between w-full px-2">
            <span className="bg-[#E2F1E7] text-[#65A30D] text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-100 shadow-2xs">
              {activeTab === "customer" ? "Customer Portal App" : "Admin Gateway Console"}
            </span>
          </div>

          {/* ACTIVE PORTAL WINDOW */}
          <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden flex flex-col min-h-[600px] animate-fade-in">
            {activeTab === "customer" ? (
              <CustomerPortal />
            ) : (
              <AdminPortal />
            )}
          </div>
        </div>

      </main>

    </div>
  );
}
