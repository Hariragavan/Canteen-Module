import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import type { ActiveTab } from './components/Navbar';
import { TabletKioskView } from './components/kiosk/TabletKioskView';
import { StaffScannerView } from './components/staff/StaffScannerView';
import { KitchenAnalyticsView } from './components/analytics/KitchenAnalyticsView';
import { HardwareDiagnosticsModal } from './components/modals/HardwareDiagnosticsModal';
import { SupabaseSettingsModal } from './components/modals/SupabaseSettingsModal';
import { AdminPortalModal } from './components/modals/AdminPortalModal';
import { AdminLoginModal } from './components/modals/AdminLoginModal';
import { MenuTimingModal } from './components/modals/MenuTimingModal';
import { canteenService } from './services/canteenService';
import { supabaseManager } from './services/supabase';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('kiosk');
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState<boolean>(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState<boolean>(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState<boolean>(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [initialTokenToScan, setInitialTokenToScan] = useState<string | null>(null);
  const [unclaimedCount, setUnclaimedCount] = useState<number>(0);

  // Protected Admin Portal Gatekeeper (admin / admin@123)
  const handleOpenAdminPortal = useCallback(() => {
    if (isAdminAuthenticated) {
      setActiveTab('admin');
    } else {
      setIsAdminLoginModalOpen(true);
    }
  }, [isAdminAuthenticated]);

  const handleAdminLoginSuccess = useCallback(() => {
    setIsAdminAuthenticated(true);
    setIsAdminLoginModalOpen(false);
    setActiveTab('admin');
  }, []);

  const handleAdminLogout = useCallback(() => {
    setIsAdminAuthenticated(false);
    setActiveTab('kiosk');
  }, []);

  // Sync count of unclaimed printed tokens
  const syncUnclaimedCount = useCallback(() => {
    const orders = canteenService.getOrders();
    const count = orders.filter((o) => o.status === 'PRINTED').length;
    setUnclaimedCount(count);
  }, []);

  useEffect(() => {
    syncUnclaimedCount();
    const unsub = supabaseManager.onRealtimeChange(() => {
      syncUnclaimedCount();
    });
    return () => unsub();
  }, [syncUnclaimedCount]);

  // Navigate from Kiosk slip to Counter scanner
  const handleNavigateToStaffScanner = (orderUuid: string) => {
    setInitialTokenToScan(orderUuid);
    setActiveTab('staff');
  };

  return (
    <div className={`flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900 ${
      activeTab === 'kiosk' || activeTab === 'admin' ? 'h-screen max-h-[100dvh] overflow-hidden' : 'min-h-screen'
    }`}>
      
      {/* Top Application Header - Rendered on Staff Scanner and Analytics; Kiosk and Admin use dedicated full-page layouts */}
      {activeTab !== 'kiosk' && activeTab !== 'admin' && (
        <Navbar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenHardwareModal={() => setIsHardwareModalOpen(true)}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onOpenAdminModal={handleOpenAdminPortal}
          onOpenMenuModal={() => setIsMenuModalOpen(true)}
          unclaimedCount={unclaimedCount}
        />
      )}

      {/* Main Content Area */}
      <main className={
        activeTab === 'kiosk'
          ? 'flex-1 w-full max-w-5xl lg:max-w-6xl mx-auto px-2 py-2 sm:px-4 sm:py-2.5 flex flex-col min-h-0 overflow-y-auto md:overflow-hidden'
          : activeTab === 'admin'
          ? 'flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col p-0 m-0'
          : 'flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-start'
      }>
        {activeTab === 'kiosk' && (
          <TabletKioskView
            onNavigateToStaffScanner={handleNavigateToStaffScanner}
            onOpenAdminModal={handleOpenAdminPortal}
          />
        )}

        {activeTab === 'staff' && (
          <StaffScannerView
            initialTokenToScan={initialTokenToScan}
            onClearInitialToken={() => setInitialTokenToScan(null)}
          />
        )}

        {activeTab === 'analytics' && (
          <KitchenAnalyticsView />
        )}

        {activeTab === 'admin' && (
          <AdminPortalModal
            isOpen={true}
            onClose={() => setActiveTab('kiosk')}
            onLogout={handleAdminLogout}
            onNavigateToKiosk={() => setActiveTab('kiosk')}
            onNavigateToStaffScanner={() => setActiveTab('staff')}
            onRosterUpdated={() => {
              syncUnclaimedCount();
            }}
          />
        )}
      </main>

      {/* Admin Gatekeeper Login Modal (ID: admin, Password: admin@123) */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />


      {/* Hardware Diagnostics Modal */}
      <HardwareDiagnosticsModal
        isOpen={isHardwareModalOpen}
        onClose={() => setIsHardwareModalOpen(false)}
      />

      {/* Supabase Settings Modal */}
      <SupabaseSettingsModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigChanged={syncUnclaimedCount}
      />

      {/* Menu & Serving Timings Update Modal */}
      <MenuTimingModal
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
      />

      {/* Footer - Only shown for desktop/staff/analytics tabs, hidden in kiosk and admin modes */}
      {activeTab !== 'kiosk' && activeTab !== 'admin' && (
        <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-400 print:hidden select-none">
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
            <span>Esstee Exports India Private Limited • Smart Canteen System</span>
            <span className="font-mono text-[11px] text-slate-400">Lenovo K11 Gen 2 Tablet Optimized</span>
          </div>
        </footer>
      )}

    </div>
  );
};

export default App;
