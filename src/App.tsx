import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import type { ActiveTab } from './components/Navbar';
import { TabletKioskView } from './components/kiosk/TabletKioskView';
import { StaffScannerView } from './components/staff/StaffScannerView';
import { KitchenAnalyticsView } from './components/analytics/KitchenAnalyticsView';
import { HardwareDiagnosticsModal } from './components/modals/HardwareDiagnosticsModal';
import { MongoDbSettingsModal } from './components/modals/MongoDbSettingsModal';
import { AdminPortalModal } from './components/modals/AdminPortalModal';
import { AdminLoginModal } from './components/modals/AdminLoginModal';
import { MenuTimingModal } from './components/modals/MenuTimingModal';
import { VirtualKeyboard } from './components/keyboard/VirtualKeyboard';
import { canteenService } from './services/canteenService';
import { apiClient } from './services/apiClient';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';

export const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTabState] = useState<ActiveTab>('kiosk');
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState<boolean>(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState<boolean>(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState<boolean>(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [initialTokenToScan, setInitialTokenToScan] = useState<string | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState<{ code: string; timestamp: number } | null>(null);
  const [unclaimedCount, setUnclaimedCount] = useState<number>(0);

  // Synchronize browser URL path with active tab
  useEffect(() => {
    const rawPath = decodeURIComponent(location.pathname || '').toLowerCase();
    
    if (rawPath.includes('admin')) {
      setActiveTabState('admin');
      document.title = 'SmartCanteen OS • Production Kiosk & Verification Counter';
    } else if (rawPath.includes('kitchen') || rawPath.includes('analysis') || rawPath.includes('analytics')) {
      setActiveTabState('analytics');
      document.title = 'SmartCanteen OS • Kitchen Analytics';
    } else if (rawPath.includes('staff') || rawPath.includes('counter')) {
      setActiveTabState('staff');
      document.title = 'SmartCanteen OS • Staff Verification Counter';
    } else {
      setActiveTabState('kiosk');
      document.title = 'SmartCanteen OS • Production Kiosk & Verification Counter';
    }
  }, [location.pathname]);

  // Tab switch handler that keeps URL cleanly in sync with base prefix (e.g. /canteen-module)
  const switchTab = useCallback((tab: ActiveTab) => {
    setActiveTabState(tab);
    const hasCanteenModulePrefix = location.pathname.toLowerCase().startsWith('/canteen-module');
    const basePrefix = hasCanteenModulePrefix ? '/canteen-module' : '';
    
    if (tab === 'analytics') {
      navigate(`${basePrefix}/kitchen-analysis`);
    } else if (tab === 'staff') {
      navigate(`${basePrefix}/staff-counter`);
    } else if (tab === 'admin') {
      navigate(`${basePrefix}/admin`);
    } else {
      navigate(`${basePrefix}/kiosk`);
    }
  }, [location.pathname, navigate]);

  // Protected Admin Portal Gatekeeper (admin / admin@123)
  const handleOpenAdminPortal = useCallback(() => {
    if (isAdminAuthenticated) {
      switchTab('admin');
    } else {
      setIsAdminLoginModalOpen(true);
    }
  }, [isAdminAuthenticated, switchTab]);

  const handleAdminLoginSuccess = useCallback(() => {
    setIsAdminAuthenticated(true);
    setIsAdminLoginModalOpen(false);
    switchTab('admin');
  }, [switchTab]);

  const handleAdminLogout = useCallback(() => {
    setIsAdminAuthenticated(false);
    switchTab('kiosk');
  }, [switchTab]);

  const handleBackToAdmin = useCallback(() => {
    setIsAdminAuthenticated(true);
    switchTab('admin');
  }, [switchTab]);

  // Global Hardware 2D Barcode Gun Listener
  // When a QR/barcode is scanned anywhere in the app, automatically switch to Staff Counter & verify
  const handleGlobalBarcodeScan = useCallback((scannedText: string) => {
    const code = scannedText.trim();
    if (!code) return;
    switchTab('staff');
    setScannedBarcode({ code, timestamp: Date.now() });
  }, [switchTab]);

  const { diagnostic: scannerDiagnostic } = useBarcodeScanner({
    onScan: handleGlobalBarcodeScan,
    maxIntervalMs: 65,
    minLength: 3,
    enabled: true,
  });

  // Sync count of unclaimed printed tokens
  const syncUnclaimedCount = useCallback(() => {
    const orders = canteenService.getOrders();
    const count = orders.filter((o) => o.status === 'PRINTED').length;
    setUnclaimedCount(count);
  }, []);

  useEffect(() => {
    syncUnclaimedCount();
    const unsub = apiClient.subscribe(() => {
      syncUnclaimedCount();
    });
    return () => unsub();
  }, [syncUnclaimedCount]);

  // Navigate from Kiosk slip to Counter scanner
  const handleNavigateToStaffScanner = (orderUuid: string) => {
    switchTab('staff');
    setScannedBarcode({ code: orderUuid, timestamp: Date.now() });
  };

  return (
    <div className={`flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900 ${
      activeTab === 'kiosk' || activeTab === 'admin' ? 'h-screen max-h-[100dvh] overflow-hidden' : 'min-h-screen'
    }`}>
      
      {/* Top Application Header - Rendered across all views to show App Name & all page tabs */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={switchTab}
        onOpenHardwareModal={() => setIsHardwareModalOpen(true)}
        onOpenDatabaseModal={() => setIsDbModalOpen(true)}
        onOpenAdminModal={handleOpenAdminPortal}
        onOpenMenuModal={() => setIsMenuModalOpen(true)}
        unclaimedCount={unclaimedCount}
      />

      {/* Main Content Area */}
      <main className={
        activeTab === 'kiosk'
          ? 'flex-1 w-full max-w-5xl lg:max-w-6xl mx-auto px-2 py-2 sm:px-4 sm:py-2.5 flex flex-col min-h-0 overflow-y-auto md:overflow-hidden'
          : activeTab === 'admin'
          ? 'flex-1 w-full h-[calc(100dvh-64px)] min-h-0 overflow-hidden flex flex-col p-0 m-0'
          : activeTab === 'staff'
          ? 'flex-1 w-full flex flex-col min-h-0 bg-slate-50 p-0 m-0 overflow-y-auto'
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
            scannedBarcode={scannedBarcode}
            onClearInitialToken={() => {
              setInitialTokenToScan(null);
              setScannedBarcode(null);
            }}
            onBackToAdmin={handleBackToAdmin}
            scannerDiagnostic={scannerDiagnostic}
          />
        )}

        {activeTab === 'analytics' && (
          <KitchenAnalyticsView />
        )}

        {activeTab === 'admin' && (
          <AdminPortalModal
            isOpen={true}
            onClose={() => switchTab('kiosk')}
            onLogout={handleAdminLogout}
            onNavigateToKiosk={() => switchTab('kiosk')}
            onNavigateToStaffScanner={() => switchTab('staff')}
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

      {/* MongoDB Backend Settings Modal */}
      <MongoDbSettingsModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onConfigChanged={syncUnclaimedCount}
      />

      {/* Menu & Serving Timings Update Modal */}
      <MenuTimingModal
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
      />

      {/* Footer - Only shown for analytics tab, hidden in kiosk, admin, and staff counter modes */}
      {activeTab !== 'kiosk' && activeTab !== 'admin' && activeTab !== 'staff' && (
        <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-400 print:hidden select-none">
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
            <span>Esstee Exports India Private Limited • Smart Canteen System</span>
            <span className="font-mono text-[11px] text-slate-400">Lenovo K11 Gen 2 Tablet Optimized</span>
          </div>
        </footer>
      )}

      {/* On-Screen Virtual Keyboard Dock with Left-Corner Toggle Button */}
      <VirtualKeyboard />

    </div>
  );
};

export default App;
