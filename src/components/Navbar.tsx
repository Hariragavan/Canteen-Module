import React, { useState, useEffect } from 'react';
import { soundEngine } from '../services/soundEngine';
import { canteenService } from '../services/canteenService';
import { apiClient } from '../services/apiClient';
import {
  Tablet,
  Scan,
  BarChart3,
  Volume2,
  VolumeX,
  Database,
  Cpu,
  Maximize,
  Minimize,
  Shield,
  UtensilsCrossed,
} from 'lucide-react';

export type ActiveTab = 'kiosk' | 'staff' | 'analytics' | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenHardwareModal: () => void;
  onOpenDatabaseModal: () => void;
  onOpenAdminModal: () => void;
  onOpenMenuModal?: () => void;
  unclaimedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenHardwareModal,
  onOpenDatabaseModal,
  onOpenAdminModal,
  onOpenMenuModal,
  unclaimedCount,
}) => {
  const [isAudioOn, setIsAudioOn] = useState<boolean>(soundEngine.isAudioEnabled());
  const [timeStr, setTimeStr] = useState<string>('');
  const [activeMealName, setActiveMealName] = useState<string>('Lunch');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setActiveMealName(canteenService.getActiveMealSlot());
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check MongoDB connection status
  useEffect(() => {
    const checkDb = async () => {
      const status = await apiClient.getDbStatus();
      setIsDbConnected(status.isConnected);
    };
    checkDb();
    const unsub = apiClient.subscribe(checkDb);
    return () => unsub();
  }, []);

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleAudio = () => {
    const active = soundEngine.toggleMute();
    setIsAudioOn(active);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        
        {/* Brand & App Name */}
        <div 
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => onSelectTab('kiosk')}
          title="SmartCanteen OS • Production Kiosk & Verification Counter"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-black text-base shadow-sm shadow-emerald-600/30 shrink-0 group-hover:scale-105 transition-transform">
            SC
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg leading-none">
                SmartCanteen OS
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                Production Kiosk &amp; Verification Counter
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-semibold tracking-normal mt-0.5 block">
              Esstee Exports India Private Limited
            </span>
          </div>
        </div>

        {/* Navigation Tabs: All 4 Main Pages */}
        <nav className="flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs gap-0.5">
          {/* Page 1: Tablet Kiosk */}
          <button
            id="tabKioskBtn"
            onClick={() => onSelectTab('kiosk')}
            className={`flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === 'kiosk'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Tablet className="w-4 h-4" />
            <span>Tablet Kiosk</span>
          </button>

          {/* Page 2: Staff Counter */}
          <button
            id="tabStaffBtn"
            onClick={() => onSelectTab('staff')}
            className={`flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Scan className="w-4 h-4" />
            <span>Staff Counter</span>
            {unclaimedCount > 0 && (
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'staff' ? 'bg-white text-emerald-800' : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {unclaimedCount}
              </span>
            )}
          </button>

          {/* Page 3: Kitchen Analytics */}
          <button
            id="tabAnalyticsBtn"
            onClick={() => onSelectTab('analytics')}
            className={`flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Kitchen Analytics</span>
          </button>

          {/* Page 4: Admin Dashboard */}
          <button
            id="tabAdminBtn"
            onClick={() => {
              if (onOpenAdminModal) {
                onOpenAdminModal();
              } else {
                onSelectTab('admin');
              }
            }}
            className={`flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin Dashboard</span>
          </button>
        </nav>

        {/* Action Controls & Clock */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          
          {/* Fullscreen Icon Button for Tablet Kiosk */}
          <button
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Tablet Fullscreen Mode"}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Menu & Timings Icon Button */}
          {onOpenMenuModal && (
            <button
              onClick={onOpenMenuModal}
              title="Daily Menu & Serving Timings Update (தமிழ் / English)"
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
            >
              <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Menu Update</span>
            </button>
          )}

          {/* Hardware Diagnostic Trigger */}
          <button
            onClick={onOpenHardwareModal}
            title="Hardware Device Test Bench (80mm Printer & Barcode Scanner)"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors hidden sm:block cursor-pointer"
          >
            <Cpu className="w-4 h-4" />
          </button>

          {/* MongoDB Database Console Trigger */}
          <button
            onClick={onOpenDatabaseModal}
            title="MongoDB Database Console & Collections"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors relative hidden sm:block cursor-pointer"
          >
            <Database className="w-4 h-4" />
            {isDbConnected && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          {/* Web Audio API Synthesizer Toggle */}
          <button
            onClick={handleToggleAudio}
            title={isAudioOn ? "Audio Feedback Active (Click to Mute)" : "Audio Feedback Muted (Click to Enable)"}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isAudioOn
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {isAudioOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Live Clock & Active Session Badge */}
          <div className="text-right hidden md:block pl-2 border-l border-slate-200">
            <div className="font-mono text-xs font-bold text-slate-800">
              {timeStr}
            </div>
            <div className="text-[11px] font-semibold text-emerald-700">
              {activeMealName} Active
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};
