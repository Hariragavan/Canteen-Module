import React, { useState, useEffect } from 'react';
import { soundEngine } from '../services/soundEngine';
import { supabaseManager } from '../services/supabase';
import { canteenService } from '../services/canteenService';
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

export type ActiveTab = 'kiosk' | 'staff' | 'analytics';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenHardwareModal: () => void;
  onOpenSupabaseModal: () => void;
  onOpenAdminModal: () => void;
  onOpenMenuModal?: () => void;
  unclaimedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenHardwareModal,
  onOpenSupabaseModal,
  onOpenAdminModal,
  onOpenMenuModal,
  unclaimedCount,
}) => {
  const [isAudioOn, setIsAudioOn] = useState<boolean>(soundEngine.isAudioEnabled());
  const [timeStr, setTimeStr] = useState<string>('');
  const [activeMealName, setActiveMealName] = useState<string>('Lunch');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const isSupabaseConnected = supabaseManager.getConfig().isConnected;

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
        
        {/* Brand & Hardware Labels */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-sm shadow-emerald-600/30">
            SC
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 tracking-tight text-lg">
                SmartCanteen OS
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                Light Edition
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              80mm Thermal Slip Printer • 2D Barcode Scanner Ready
            </p>
          </div>
        </div>

        {/* Navigation Tabs (3 Main Modules) */}
        <nav className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            id="tabKioskBtn"
            onClick={() => onSelectTab('kiosk')}
            className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'kiosk'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tablet className="w-4 h-4" />
            <span>Tablet Kiosk</span>
          </button>

          <button
            id="tabStaffBtn"
            onClick={() => onSelectTab('staff')}
            className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'staff'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scan className="w-4 h-4" />
            <span>Staff Counter</span>
            {unclaimedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono font-bold border border-amber-200">
                {unclaimedCount}
              </span>
            )}
          </button>

          <button
            id="tabAnalyticsBtn"
            onClick={() => onSelectTab('analytics')}
            className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'analytics'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Kitchen Analytics</span>
          </button>
        </nav>

        {/* Action Controls & Clock */}
        <div className="flex items-center space-x-2">
          
          {/* Fullscreen Icon Button for Tablet Kiosk */}
          <button
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Tablet Fullscreen Mode"}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Menu & Timings Icon Button */}
          {onOpenMenuModal && (
            <button
              onClick={onOpenMenuModal}
              title="Daily Menu & Serving Timings Update (தமிழ் / English)"
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
            >
              <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Menu Update</span>
            </button>
          )}

          {/* Admin Portal Icon Button */}
          <button
            id="btnOpenAdminPortal"
            onClick={onOpenAdminModal}
            title="Open Admin Portal (Registered Users, Edit & Delete, New Registration)"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition-all shadow-2xs active:scale-95"
          >
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Admin</span>
          </button>

          {/* Hardware Diagnostic Trigger */}
          <button
            onClick={onOpenHardwareModal}
            title="Hardware Device Test Bench (80mm Printer & Barcode Scanner)"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors hidden sm:block"
          >
            <Cpu className="w-4 h-4" />
          </button>

          {/* Supabase Config Trigger */}
          <button
            onClick={onOpenSupabaseModal}
            title="Supabase Database Configuration & SQL"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors relative hidden sm:block"
          >
            <Database className="w-4 h-4" />
            {isSupabaseConnected && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          {/* Web Audio API Synthesizer Toggle */}
          <button
            onClick={handleToggleAudio}
            title={isAudioOn ? "Audio Feedback Active (Click to Mute)" : "Audio Feedback Muted (Click to Enable)"}
            className={`p-2 rounded-xl border transition-colors ${
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
