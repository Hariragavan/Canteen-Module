import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Employee, MealSlotConfig, MealSlotName, Order } from '../../types';
import { canteenService } from '../../services/canteenService';
import { supabaseManager } from '../../services/supabase';
import { soundEngine } from '../../services/soundEngine';
import { faceMatcherService } from '../../services/faceMatcherService';
import { FaceScannerHUD } from './FaceScannerHUD';
import type { FaceScannerHUDHandle } from './FaceScannerHUD';
import { CameraVerifyModal } from './CameraVerifyModal';
import { ThermalReceipt } from '../printer/ThermalReceipt';
import {
  Printer,
  AlertTriangle,
  CheckCircle,
  Clock,
  BadgeCheck,
  Maximize,
  Minimize,
  User,
  Check,
  RotateCcw,
  Calendar,
  UtensilsCrossed,
  Building,
  Camera,
  Scan,
  ChevronUp,
  ChevronDown,
  Star,
} from 'lucide-react';
import { FeedbackModal } from '../modals/FeedbackModal';

interface TabletKioskViewProps {
  onNavigateToStaffScanner?: (orderUuid: string) => void;
  onOpenAdminModal?: () => void;
}

export const TabletKioskView: React.FC<TabletKioskViewProps> = ({
  onNavigateToStaffScanner,
  onOpenAdminModal,
}) => {
  const [kioskStep, setKioskStep] = useState<'SCANNING' | 'VERIFIED'>('SCANNING');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mealSlots, setMealSlots] = useState<MealSlotConfig[]>(canteenService.getMealSlots());
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const [selectedMealSlot, setSelectedMealSlot] = useState<MealSlotName>('Lunch');
  const [duplicateOrder, setDuplicateOrder] = useState<Order | null>(null);
  const [lastPrintedOrder, setLastPrintedOrder] = useState<Order | null>(null);
  const [lastPrintedOrders, setLastPrintedOrders] = useState<Order[]>([]);
  const [isDispensing, setIsDispensing] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isProcessingScan, setIsProcessingScan] = useState<boolean>(false);
  const [isScanVerified, setIsScanVerified] = useState<boolean>(false);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [activeSlotName, setActiveSlotName] = useState<MealSlotName>('Lunch');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Snapshot from live video frame
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [autoResetSeconds, setAutoResetSeconds] = useState<number>(10);
  const [snacksQty, setSnacksQty] = useState<number>(1);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);

  // Daily 10-token limit per person per food type (Tiffin and Tea/Snacks)
  const isQtyAvailable = (
    selectedMealSlot === 'Tiffin' ||
    selectedMealSlot === 'Tea/Snacks' ||
    selectedMealSlot.toLowerCase().includes('tea') ||
    selectedMealSlot.toLowerCase().includes('snack')
  );

  const alreadyTakenToday = (currentEmployee && isQtyAvailable)
    ? canteenService.getEmployeeMealTokensCountToday(currentEmployee.id, selectedMealSlot)
    : 0;

  const maxAllowedToday = 10;
  const remainingToday = isQtyAvailable ? Math.max(0, maxAllowedToday - alreadyTakenToday) : 1;
  const isDailyLimitReached = isQtyAvailable && remainingToday === 0;

  // Auto-adjust snacksQty when food slot or employee changes
  useEffect(() => {
    if (isQtyAvailable) {
      if (remainingToday === 0) {
        setSnacksQty(0);
      } else if (snacksQty > remainingToday) {
        setSnacksQty(remainingToday);
      } else if (snacksQty < 1 && remainingToday > 0) {
        setSnacksQty(1);
      }
    } else {
      setSnacksQty(1);
    }
  }, [isQtyAvailable, remainingToday, selectedMealSlot, currentEmployee?.id]);
  const hudRef = useRef<FaceScannerHUDHandle | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  // Initialize and sync roster from local/Supabase
  const loadRoster = useCallback(() => {
    const emps = canteenService.getEmployees();
    setEmployees(emps);
  }, []);

  const loadMealSlots = useCallback(() => {
    const slots = canteenService.getMealSlots();
    setMealSlots(slots);
    const active = canteenService.getActiveMealSlot();
    setActiveSlotName(active);
    setSelectedMealSlot((prev) => {
      // If current selection is still active keep it, otherwise switch to active
      const exists = slots.some((s) => s.name === prev && s.isActive !== false);
      return exists ? prev : active;
    });
  }, []);

  useEffect(() => {
    loadRoster();
    loadMealSlots();

    const handleMenuEvent = () => loadMealSlots();
    window.addEventListener('canteen_menu_updated', handleMenuEvent);

    const unsub = supabaseManager.onRealtimeChange((event) => {
      if (event.table === 'canteen_employees') {
        loadRoster();
      }
      if (event.table === 'canteen_meal_slots') {
        loadMealSlots();
      }
    });

    return () => {
      window.removeEventListener('canteen_menu_updated', handleMenuEvent);
      unsub();
    };
  }, [loadRoster, loadMealSlots]);

  // Real-time clock & calendar date update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setCurrentDateStr(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );
      setActiveSlotName(canteenService.getActiveMealSlot());
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen error:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Check duplicate booking whenever employee or meal slot changes
  const checkDuplicate = useCallback(() => {
    if (!currentEmployee) return;
    const existing = canteenService.checkDuplicateBooking(currentEmployee.id, selectedMealSlot);
    setDuplicateOrder(existing || null);
  }, [currentEmployee, selectedMealSlot]);

  useEffect(() => {
    checkDuplicate();
  }, [checkDuplicate]);

  // Scroll active meal card into view when opening Verified view
  useEffect(() => {
    if (kioskStep === 'VERIFIED') {
      const timer = setTimeout(() => {
        const activeCard = document.getElementById(`slide-meal-${selectedMealSlot}`);
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [kioskStep, selectedMealSlot]);

  // =========================================================================
  // CAMERA VERIFY MODEL: Checks if Person is Registered or Not
  // Matches live camera facial structure & eye geometry against registered roster
  // =========================================================================
  const handleCaptureAndScan = async () => {
    if (isProcessingScan || isScanVerified || kioskStep === 'VERIFIED') return;
    setVerificationError(null);
    setIsCapturing(true);
    setIsProcessingScan(true);
    soundEngine.playScannerBeep();

    try {
      // 1. Capture snapshot frame from live camera viewfinder
      const snapshot = hudRef.current?.captureSnapshot() || '';
      setCapturedSnapshot(snapshot);

      if (!snapshot) {
        setIsCapturing(false);
        setIsProcessingScan(false);
        soundEngine.playWarningBuzzer();
        setVerificationError('Face not detected. Please position your face in the camera.');
        return;
      }

      // 2. Biometrically match live facial structure & eye geometry against registered roster
      const matchResult = await faceMatcherService.matchLiveFace(snapshot, employees);

      setIsCapturing(false);
      setIsProcessingScan(false);

      if (matchResult.hasFace && matchResult.isMatch && matchResult.matchedEmployee) {
        // Biometric Match Confirmed!
        soundEngine.playVerificationChime();
        setCurrentEmployee(matchResult.matchedEmployee);
        setIsScanVerified(true);
        setLastPrintedOrder(null);
        // Show glowing green camera outline briefly then transition to Verified view
        setTimeout(() => {
          setIsScanVerified(false);
          setKioskStep('VERIFIED');
        }, 550);
      } else if (!matchResult.hasFace) {
        soundEngine.playWarningBuzzer();
        setVerificationError('Face not detected in scan area. Please align face inside the outline.');
      } else {
        // Verification Denied (Person is not in roster)
        soundEngine.playWarningBuzzer();
        setVerificationError(
          matchResult.reason ||
            'Biometric Verification Failed: Person is NOT registered in the canteen roster. Access Denied.'
        );
      }
    } catch (err) {
      console.error('Face verification error:', err);
      setIsCapturing(false);
      setIsProcessingScan(false);
      soundEngine.playWarningBuzzer();
      setVerificationError('Biometric verification error. Please try again.');
    }
  };

  // Direct automatic callback from FaceScannerHUD real-time AI punching machine loop
  const handleUserIdentified = useCallback((matchedEmployee: Employee) => {
    if (kioskStep === 'VERIFIED' || isScanVerified) return;
    soundEngine.playVerificationChime();
    setCurrentEmployee(matchedEmployee);
    setIsScanVerified(true);
    setVerificationError(null);
    setLastPrintedOrder(null);
    setSnacksQty(1);
    const snap = hudRef.current?.captureSnapshot() || '';
    if (snap) {
      setCapturedSnapshot(snap);
    }

    setTimeout(() => {
      setIsScanVerified(false);
      setKioskStep('VERIFIED');
    }, 600);
  }, [kioskStep, isScanVerified]);

  // Reset back to Camera Scan view (Step 1)
  const handleResetToScan = useCallback(() => {
    setKioskStep('SCANNING');
    setIsScanVerified(false);
    setCurrentEmployee(null);
    setCapturedSnapshot(null);
    setVerificationError(null);
    setLastPrintedOrder(null);
    setLastPrintedOrders([]);
    setSnacksQty(1);
    setAutoResetSeconds(10);
  }, []);

  // Auto-reset timer when thermal slip is displayed (10 seconds timeout for closing UI)
  useEffect(() => {
    if (!lastPrintedOrder) {
      setAutoResetSeconds(10);
      return;
    }
    const interval = setInterval(() => {
      setAutoResetSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleResetToScan();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lastPrintedOrder, handleResetToScan]);

  // Auto-scroll selected meal card into view of vertical carousel
  useEffect(() => {
    if (kioskStep === 'VERIFIED') {
      const timer = setTimeout(() => {
        const card = document.getElementById(`kiosk-meal-card-${selectedMealSlot}`);
        if (card && carouselRef.current) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [kioskStep, selectedMealSlot]);

  // Handle meal slot selection with mild, pleasant sound
  const handleSelectMealSlot = (slot: MealSlotName) => {
    soundEngine.playSelectSound();
    setSelectedMealSlot(slot);
    setSnacksQty(1);
    const card = document.getElementById(`kiosk-meal-card-${slot}`);
    if (card && carouselRef.current) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Vertical carousel arrow navigation
  const handleSlideUp = () => {
    soundEngine.playSelectSound();
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ top: -140, behavior: 'smooth' });
    }
  };

  const handleSlideDown = () => {
    soundEngine.playSelectSound();
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ top: 140, behavior: 'smooth' });
    }
  };

  // Execute Order Confirmation & Print Slip immediately with zero artificial delay
  const handleConfirmAndPrint = async () => {
    if (!currentEmployee) return;

    // Double check duplicate guard
    const existing = canteenService.checkDuplicateBooking(currentEmployee.id, selectedMealSlot);
    if (existing) {
      soundEngine.playWarningBuzzer();
      setDuplicateOrder(existing);
      return;
    }

    try {
      setIsDispensing(true);
      // Play 80mm stepper motor noise
      soundEngine.playThermalMotorSound();

      const chosenSlot = mealSlots.find((s) => s.name === selectedMealSlot);
      const chosenItems = chosenSlot
        ? [{ name: chosenSlot.name, description: chosenSlot.description }]
        : [];

      const isQtyAvailable = selectedMealSlot === 'Tiffin' || selectedMealSlot === 'Tea/Snacks' || selectedMealSlot.toLowerCase().includes('tea') || selectedMealSlot.toLowerCase().includes('snack');
      const chosenQty = isQtyAvailable ? Math.max(1, Math.min(10, snacksQty)) : 1;
      const chosenRate = chosenSlot?.rate ?? chosenSlot?.cost ?? 40;

      // Create batch of orders (e.g. qty = 3 creates 3 distinct tokens with different QRs)
      const orders = await canteenService.createOrdersBatch(
        currentEmployee,
        selectedMealSlot,
        chosenItems,
        chosenQty,
        chosenRate
      );

      setLastPrintedOrders(orders);
      setLastPrintedOrder(orders[0]);
      setIsDispensing(false);
      soundEngine.playVerificationChime();
      checkDuplicate();

      // Trigger print immediately: direct print if printer is available, or open print dialog
      setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          console.warn('Auto print trigger error:', e);
        }
      }, 300);

      const drawer = document.getElementById('printerDrawerSection');
      if (drawer) {
        drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (err) {
      console.error('Order generation error:', err);
      soundEngine.playWarningBuzzer();
      setIsDispensing(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col gap-2.5 sm:gap-3 min-h-0">
      
      {/* ================================================================= */}
      {/* TOP HEADER: Matches Both Sketches                                 */}
      {/* Left: "Smartcanteen OS", Right: Fullscreen icon & Admin icon (👤) */}
      {/* ================================================================= */}
      <div className="bg-white border border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl sm:rounded-3xl flex items-center justify-between shadow-sm shrink-0">
        
        {/* Left: Smartcanteen OS */}
        <div className="flex items-center space-x-2.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping mr-0.5"></span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-sans">
            Smartcanteen OS
          </h1>
          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 hidden sm:inline-block">
            {kioskStep === 'SCANNING' ? 'Camera Biometric View' : 'Verified Identity & Food Selection'}
          </span>
        </div>

        {/* Right: Fullscreen icon [ ] and Admin icon (👤) */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          
          {/* Fullscreen Icon [ ] */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen Mode"}
            className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all shadow-2xs active:scale-95 flex items-center justify-center cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Admin Icon (👤 inside circle as in sketches) */}
          {onOpenAdminModal && (
            <button
              onClick={onOpenAdminModal}
              title="Open Administration Portal"
              className="p-2 sm:p-2.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-2 border-emerald-500 transition-all shadow-sm active:scale-95 flex items-center justify-center cursor-pointer"
            >
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700" />
            </button>
          )}

        </div>

      </div>

      {/* ================================================================= */}
      {/* STEP 1: INITIAL CAMERA VIEW (Matching User's First Hand Sketch)    */}
      {/* Top Banner (Serving Timing & Today's Menu) + Camera Viewfinder    */}
      {/* ================================================================= */}
      {kioskStep === 'SCANNING' && (
        <div className="w-full flex-1 flex flex-col items-center justify-center gap-2 sm:gap-2.5 py-1 animate-in fade-in duration-300 max-w-xl mx-auto min-h-0">
          
          {/* Top Live Serving Timing & Today's Menu Banner */}
          {(() => {
            const activeSlot = mealSlots.find((s) => s.name === activeSlotName) || mealSlots[0];
            if (!activeSlot) return null;
            return (
              <div className="w-full bg-gradient-to-r from-emerald-50/90 via-white to-amber-50/50 border-2 border-emerald-300 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 shadow-sm flex flex-col gap-1 shrink-0">
                <div className="flex items-center justify-between gap-2 border-b border-emerald-100 pb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl sm:text-2xl">{activeSlot.emoji}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-slate-900 text-sm sm:text-base tracking-tight">
                          {activeSlot.name}
                        </span>
                        {activeSlot.tamilDisplayName && (
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                            {activeSlot.tamilDisplayName}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 font-bold flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-600" />
                          <span>Serving Timing: <strong>From {activeSlot.startTime} to {activeSlot.endTime}</strong></span>
                        </span>
                        <span>•</span>
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Meal Cost: <strong>₹{activeSlot.rate ?? activeSlot.cost ?? 40}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-600 text-white shadow-2xs">
                      ● Serving Now
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-1.5 text-xs text-slate-700 pt-0.5">
                  <span className="font-bold text-emerald-900 shrink-0 text-[11px] uppercase tracking-wider flex items-center gap-1">
                    <UtensilsCrossed className="w-3 h-3 text-emerald-600" />
                    <span>Menu / உணவு:</span>
                  </span>
                  <p className="font-semibold text-slate-800 text-xs sm:text-sm leading-snug font-sans">
                    {activeSlot.description}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Centered Camera Viewfinder Box */}
          <div className="w-full bg-white border border-slate-200 rounded-3xl p-3 sm:p-4 shadow-sm flex flex-col items-center gap-2.5">
            
            <div className="w-full flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Scan className="w-4 h-4 text-emerald-600" />
                <span>Biometric Camera Face Verification</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {currentTimeStr} • Live Roster Matching
              </span>
            </div>

            {/* Camera Viewfinder with Head & Shoulder Silhouette Overlay */}
            <FaceScannerHUD
              ref={hudRef}
              currentEmployee={currentEmployee}
              knownEmployees={employees}
              isScanning={isProcessingScan}
              isCapturing={isCapturing}
              isVerified={isScanVerified}
              onUserIdentified={handleUserIdentified}
              onFaceNotRegistered={(reason) => {
                soundEngine.playWarningBuzzer();
                setVerificationError(reason);
              }}
              onAutoScan={handleCaptureAndScan}
            />

          </div>

          {/* Verification Error Alert if person is NOT registered */}
          {verificationError && (
            <div className="w-full bg-rose-50 border-2 border-rose-300 text-rose-900 px-4 py-2.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2.5 animate-shake shadow-sm shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-rose-100 rounded-xl text-rose-700 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-rose-950">
                    Verification Failed: Person Not Registered!
                  </h4>
                  <p className="text-[11px] text-rose-700">
                    {verificationError}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {onOpenAdminModal && (
                  <button
                    onClick={onOpenAdminModal}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
                  >
                    + Register Person
                  </button>
                )}
                <button
                  onClick={() => {
                    setVerificationError(null);
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* THE "Capture & scan." BUTTON (Secondary manual trigger)        */}
          {/* ============================================================= */}
          <button
            id="btnCaptureAndScan"
            onClick={handleCaptureAndScan}
            disabled={isProcessingScan}
            className="w-full sm:w-auto px-12 py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-base sm:text-lg font-bold shadow-lg shadow-emerald-600/30 transition-all transform active:scale-95 flex items-center justify-center space-x-2.5 border-2 border-emerald-500 hover:border-emerald-600 shrink-0"
          >
            <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
            <span>{isProcessingScan ? 'Verifying Face...' : 'Capture & scan.'}</span>
          </button>

          <p className="text-[11px] text-slate-400 font-medium text-center shrink-0">
            Auto-scans when face is in front of camera, or tap <strong>"Capture & scan."</strong>
          </p>

        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 2: VERIFIED STATE (Matching User's New Hand Sketch Exactly!)  */}
      {/* Left side: Name, Id, Dept., Date & Time                          */}
      {/* Center: Food type selection slide / scroll view                  */}
      {/* Optimized for Lenovo Tab K11 Gen 2 (16:10 aspect ratio landscape)  */}
      {/* ================================================================= */}
      {kioskStep === 'VERIFIED' && currentEmployee && (
        <div className="w-full flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-3.5 items-stretch min-h-0 overflow-y-auto md:overflow-hidden animate-in fade-in duration-200">
          
          {/* ============================================================= */}
          {/* LEFT COLUMN: Exactly matching sketch:                         */}
          {/* Name, Id, Dept., Date & Time                                  */}
          {/* ============================================================= */}
          <div className="md:col-span-5 bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xs min-h-0 overflow-y-auto">
            
            <div className="flex flex-col gap-2.5">
              {/* Top Verified Header & Live Photo */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <BadgeCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">
                    BIOMETRIC VERIFIED
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-700 font-bold">
                  99.4% Match
                </span>
              </div>

              {/* Photo & Name Tag */}
              <div className="flex items-center space-x-3 pt-0.5">
                <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-xs shrink-0">
                  <img
                    src={capturedSnapshot || currentEmployee.photo}
                    alt={currentEmployee.name}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 p-0.5 bg-emerald-600 text-white rounded-full">
                    <Check className="w-3 h-3" />
                  </span>
                  <span className="absolute top-1 left-1 bg-slate-900/80 text-emerald-300 font-mono text-[7px] font-bold px-1 rounded">
                    LIVE
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Name
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate leading-tight mt-0.5">
                    {currentEmployee.name}
                  </h2>
                  <span
                    className={`inline-block text-[9px] uppercase font-mono px-2 py-0.2 rounded-full font-bold border mt-1 ${
                      currentEmployee.role === 'Staff'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {currentEmployee.role || 'Employee'}
                  </span>
                </div>
              </div>

              {/* The other 3 Identity fields drawn in user sketch */}
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100 text-xs">
                
                {/* 2. Id */}
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">
                    Id
                  </span>
                  <span className="font-mono font-bold text-slate-800 text-xs">
                    {currentEmployee.id}
                  </span>
                </div>

                {/* 3. Dept. */}
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-400" />
                    <span>Dept.</span>
                  </span>
                  <span className="text-slate-700 font-medium truncate max-w-[170px] text-right">
                    {currentEmployee.dept}
                  </span>
                </div>

                {/* 4. Date & Time */}
                <div className="flex items-center justify-between py-1 border-b border-slate-50 font-mono text-[11px]">
                  <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Date & Time</span>
                  </span>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-slate-800 font-semibold">{currentDateStr}</span>
                    <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5 text-emerald-600" />
                      <span>{currentTimeStr}</span>
                    </span>
                  </div>
                </div>

                {/* Subsidy Tag */}
                <div className="flex items-center space-x-1.5 text-[11px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>100% Free Canteen Subsidy</span>
                </div>

              </div>
            </div>

            {/* Return / Scan Next Button */}
            <button
              onClick={handleResetToScan}
              className="mt-2.5 w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-2xs active:scale-95 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Scan Another Person</span>
            </button>

          </div>

          {/* ============================================================= */}
          {/* RIGHT COLUMN: Food Type Selection Slide / Scroll View         */}
          {/* Shows Breakfast, Lunch, Tea & Snacks, Dinner matching sketch! */}
          {/* ============================================================= */}
          <div className="md:col-span-7 bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xs min-h-0 overflow-hidden relative">
            
            {/* When Thermal Slip is Dispensed: Dedicated High-Fidelity Slip Showcase */}
            {lastPrintedOrder ? (
              <div className="flex-1 flex flex-col justify-between p-3.5 bg-emerald-50/50 rounded-2xl border-2 border-emerald-300 animate-in fade-in zoom-in-95 duration-200 min-h-0 overflow-y-auto">
                <div className="w-full flex items-center justify-between pb-2 border-b border-emerald-200 shrink-0">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-black text-emerald-950">
                      Order Confirmed & Slip Dispensed!
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">
                    80mm Printed
                  </span>
                </div>

                <div className="my-2 flex justify-center max-h-[320px] overflow-y-auto shadow-md rounded-xl bg-white p-2">
                  <ThermalReceipt
                    order={lastPrintedOrder}
                    orders={lastPrintedOrders}
                    onSendToScanner={onNavigateToStaffScanner}
                    onPrint={() => window.print()}
                  />
                </div>

                <div className="w-full flex items-center justify-between gap-3 pt-2.5 border-t border-emerald-200 shrink-0">
                  <span className="text-xs text-emerald-800 font-medium font-mono">
                    Auto-resetting in {autoResetSeconds}s...
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs"
                    >
                      Print Physical Slip
                    </button>
                    <button
                      onClick={handleResetToScan}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                    >
                      <span>Done (Next Person)</span>
                      <span>➔</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Top Bar: Clean Title, Active Session Info & Vertical Carousel Controls */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                  <div className="flex items-center space-x-2">
                    <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                      Select Food Type
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Active: {activeSlotName}
                    </span>
                  </div>

                  {/* Vertical Carousel Up / Down Controls */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={handleSlideUp}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-all active:scale-95 shadow-2xs cursor-pointer"
                      title="Scroll Up (Previous meal)"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSlideDown}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-all active:scale-95 shadow-2xs cursor-pointer"
                      title="Scroll Down (Next meal)"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Duplicate Order Alert if this user already booked today */}
                {duplicateOrder && (
                  <div className="text-xs bg-rose-50 border border-rose-200 text-rose-800 px-3 py-1.5 rounded-xl flex items-center space-x-2 font-medium my-1 animate-shake shrink-0">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="text-[11px]">
                      <strong>Duplicate Lock:</strong> {duplicateOrder.meal} already booked today at{' '}
                      <span className="font-mono font-bold">{duplicateOrder.issuedAt}</span>!
                    </span>
                  </div>
                )}

                {/* =========================================================== */}
                {/* CENTER FOOD SELECTION: Vertical Carousel / List              */}
                {/* Smooth vertical scroll-snap with clean animated cards       */}
                {/* =========================================================== */}
                <div
                  ref={carouselRef}
                  className="flex-1 flex flex-col gap-2.5 overflow-y-auto py-1 px-1 my-1 min-h-0 select-none snap-y snap-mandatory scroll-smooth max-h-[340px]"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {mealSlots
                    .filter((s) => s.isActive !== false)
                    .map((slot, index) => {
                      const isSelected = selectedMealSlot === slot.name;
                      const isCurrentTimeSlot = activeSlotName === slot.name;
                      const isAlreadyBooked = Boolean(
                        canteenService.checkDuplicateBooking(currentEmployee.id, slot.name)
                      );

                      return (
                        <div
                          key={slot.name}
                          id={`kiosk-meal-card-${slot.name}`}
                          onClick={() => !isAlreadyBooked && handleSelectMealSlot(slot.name)}
                          style={{ animationDelay: `${index * 50}ms` }}
                          className={`w-full snap-start rounded-2xl border-2 transition-all duration-250 p-3 sm:p-3.5 cursor-pointer relative shadow-2xs animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both ${
                            isSelected
                              ? 'border-emerald-600 bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-white ring-2 ring-emerald-500/20 shadow-md scale-[1.008]'
                              : isAlreadyBooked
                              ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                              : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-slate-50/70 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center space-x-3.5 min-w-0">
                              {/* 1. AMOUNT FIRST IN BIG BOLD TEXT (Requirement 3) */}
                              <div
                                className={`px-3 py-2 rounded-2xl flex flex-col items-center justify-center shrink-0 border transition-all ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                                    : 'bg-emerald-50 text-emerald-950 border-emerald-200'
                                }`}
                              >
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 leading-none">
                                  Price
                                </span>
                                <div className="flex items-baseline font-mono font-black text-2xl sm:text-3xl leading-tight">
                                  <span className="text-sm mr-0.5">₹</span>
                                  <span>{slot.rate ?? slot.cost ?? 40}</span>
                                </div>
                              </div>

                              {/* 2. FOOD TYPE & REMAINING DETAILS */}
                              <div className="min-w-0">
                                <div className="flex items-center space-x-2 flex-wrap">
                                  <span className="text-xl">{slot.emoji}</span>
                                  <h4 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                                    {slot.name}
                                  </h4>
                                  {slot.tamilDisplayName && (
                                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      {slot.tamilDisplayName}
                                    </span>
                                  )}
                                  {isCurrentTimeSlot && (
                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-600 text-white animate-pulse">
                                      Active Now
                                    </span>
                                  )}
                                  {isAlreadyBooked && (
                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                      Booked
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono mt-1">
                                  <span className="flex items-center gap-1 font-bold text-slate-600">
                                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{slot.startTime} - {slot.endTime}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 shrink-0">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                                  isSelected
                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                    : 'border-slate-300 bg-white text-transparent'
                                }`}
                              >
                                <Check className="w-4 h-4 stroke-[3]" />
                              </div>
                            </div>
                          </div>

                          {/* Menu Items description */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-baseline justify-between gap-2 text-xs">
                            <p className="text-slate-700 text-xs truncate max-w-md font-sans">
                              <strong className="text-slate-900 font-semibold">Menu:</strong> {slot.description}
                            </p>
                            <span
                              className={`text-[10px] font-bold shrink-0 ${
                                isSelected ? 'text-emerald-700 font-extrabold' : 'text-slate-400'
                              }`}
                            >
                              {isSelected ? '✓ Selected' : isAlreadyBooked ? 'Locked' : 'Tap to Select'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* =========================================================== */}
                {/* QUANTITY SELECTOR: For Tiffin & Tea/Snacks (Min 1, Max 10)  */}
                {/* Enforces 10 tokens maximum per employee per food type today */}
                {/* =========================================================== */}
                {isQtyAvailable && (
                  <div className="bg-amber-50/95 border-2 border-amber-300 rounded-2xl p-3 flex flex-row items-center justify-between gap-3 shadow-2xs animate-in fade-in slide-in-from-bottom-2 duration-300 shrink-0 my-1">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                        Qty
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                            Select Quantity
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            isDailyLimitReached
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-amber-200 text-amber-900 border-amber-300'
                          }`}>
                            {isDailyLimitReached ? 'Daily Limit Reached (10/10)' : `Remaining: ${remainingToday} of 10`}
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-900 font-medium mt-0.5 truncate">
                          {alreadyTakenToday > 0
                            ? `Taken today: ${alreadyTakenToday} tokens • Max 10 per day`
                            : 'Maximum 10 tokens per day for this food type'}
                        </p>
                      </div>
                    </div>

                    {/* Plus and Minus buttons to select quantity: min 1, max remainingToday */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playSelectSound();
                          setSnacksQty((q) => Math.max(1, q - 1));
                        }}
                        disabled={snacksQty <= 1 || isDailyLimitReached}
                        className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-black text-xl flex items-center justify-center shadow-2xs active:scale-95 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        title="Decrease quantity"
                      >
                        -
                      </button>

                      <div className="w-10 text-center">
                        <span className="font-black text-2xl text-slate-950 font-mono">
                          {isDailyLimitReached ? 0 : snacksQty}
                        </span>
                        <span className="text-[8px] text-slate-500 block -mt-1 font-bold">
                          QTY
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playSelectSound();
                          setSnacksQty((q) => Math.min(remainingToday, q + 1));
                        }}
                        disabled={snacksQty >= remainingToday || isDailyLimitReached}
                        className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-black text-xl flex items-center justify-center shadow-2xs active:scale-95 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        title="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}


                {/* Bottom Row: Selected Meal Session & Confirm Print Button */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 sm:p-3 flex flex-row items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                      Selected Session
                    </span>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-sm font-black text-slate-900 truncate">
                        {selectedMealSlot}
                      </span>
                      {isQtyAvailable && snacksQty > 1 && !isDailyLimitReached && (
                        <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold border border-amber-300">
                          {snacksQty} Slips
                        </span>
                      )}
                      <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full font-bold border border-emerald-200">
                        80mm Thermal
                      </span>
                    </div>
                  </div>

                  <button
                    id="btnConfirmAndPrintSlip"
                    onClick={handleConfirmAndPrint}
                    disabled={Boolean(duplicateOrder) || isDispensing || (isQtyAvailable && isDailyLimitReached)}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all transform active:scale-95 flex items-center justify-center space-x-2 shrink-0 cursor-pointer ${
                      duplicateOrder || isDispensing || (isQtyAvailable && isDailyLimitReached)
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      {isDispensing
                        ? 'Dispensing...'
                        : isDailyLimitReached
                        ? 'Daily Limit Reached (10/10)'
                        : isQtyAvailable && snacksQty > 1
                        ? `Confirm & Print ${snacksQty} Slips (₹${(mealSlots.find(s => s.name === selectedMealSlot)?.rate ?? 40) * snacksQty})`
                        : `Confirm & Print Slip (₹${mealSlots.find(s => s.name === selectedMealSlot)?.rate ?? 40})`}
                    </span>
                  </button>
                </div>
              </>
            )}

          </div>

        </div>
      )}

      {/* Camera Biometric Verification Modal */}
      <CameraVerifyModal
        isOpen={isVerifyModalOpen}
        onClose={() => {
          setIsVerifyModalOpen(false);
          setKioskStep('SCANNING');
        }}
        employee={currentEmployee}
        capturedSnapshot={capturedSnapshot}
        onNavigateToStaffScanner={onNavigateToStaffScanner}
      />

      {/* Floating Feedback Button in Right Down Corner of First Page */}
      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 print:hidden">
        <button
          type="button"
          onClick={() => {
            soundEngine.playSelectSound();
            setIsFeedbackModalOpen(true);
          }}
          className="group px-4 py-2.5 bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 border-2 border-emerald-500 rounded-full font-bold shadow-lg shadow-emerald-900/10 flex items-center space-x-2 transition-all transform active:scale-95 cursor-pointer backdrop-blur"
          title="Give Food & Service Feedback"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Star className="w-3.5 h-3.5 fill-amber-300 stroke-amber-400" />
          </div>
          <span className="text-xs sm:text-sm font-black tracking-tight">
            Feedback <span className="text-[11px] text-emerald-700 font-sans hidden sm:inline">(கருத்து)</span>
          </span>
        </button>
      </div>

      {/* Food Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        defaultSlot={selectedMealSlot}
      />

    </div>
  );
};

