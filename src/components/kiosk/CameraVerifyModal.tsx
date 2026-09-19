import React, { useState, useRef, useEffect } from 'react';
import type { Employee, MealSlotName, Order } from '../../types';
import { canteenService, MEAL_SLOTS } from '../../services/canteenService';
import { soundEngine } from '../../services/soundEngine';
import { ThermalReceipt } from '../printer/ThermalReceipt';
import {
  X,
  BadgeCheck,
  Building,
  User,
  Calendar,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Printer,
  AlertTriangle,
  Flame,
  Camera,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface CameraVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  capturedSnapshot: string | null;
  onNavigateToStaffScanner?: (orderUuid: string) => void;
}

export const CameraVerifyModal: React.FC<CameraVerifyModalProps> = ({
  isOpen,
  onClose,
  employee,
  capturedSnapshot,
  onNavigateToStaffScanner,
}) => {
  const [selectedMealSlot, setSelectedMealSlot] = useState<MealSlotName>('Lunch');
  const [duplicateOrder, setDuplicateOrder] = useState<Order | null>(null);
  const [lastPrintedOrder, setLastPrintedOrder] = useState<Order | null>(null);
  const [isDispensing, setIsDispensing] = useState<boolean>(false);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [activeSlotName, setActiveSlotName] = useState<MealSlotName>('Lunch');
  const sliderRef = useRef<HTMLDivElement | null>(null);

  // Sync date/time
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

  // Initialize selected slot to active slot on modal open
  useEffect(() => {
    if (isOpen) {
      const active = canteenService.getActiveMealSlot();
      setSelectedMealSlot(active);
      setLastPrintedOrder(null);
    }
  }, [isOpen]);

  // Check duplicate booking
  useEffect(() => {
    if (!employee || !isOpen) return;
    const existing = canteenService.checkDuplicateBooking(employee.id, selectedMealSlot);
    setDuplicateOrder(existing || null);
  }, [employee, selectedMealSlot, isOpen]);

  // Scroll active card into view
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const card = document.getElementById(`modal-slide-meal-${selectedMealSlot}`);
        if (card && sliderRef.current) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedMealSlot]);

  if (!isOpen || !employee) return null;

  const handleSlideLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -260, behavior: 'smooth' });
    }
  };

  const handleSlideRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: 260, behavior: 'smooth' });
    }
  };

  const handleConfirmAndPrint = async () => {
    if (!employee) return;

    const existing = canteenService.checkDuplicateBooking(employee.id, selectedMealSlot);
    if (existing) {
      soundEngine.playWarningBuzzer();
      setDuplicateOrder(existing);
      return;
    }

    try {
      setIsDispensing(true);
      soundEngine.playThermalMotorSound();

      const order = await canteenService.createOrder(employee, selectedMealSlot);

      setTimeout(() => {
        setLastPrintedOrder(order);
        setIsDispensing(false);
        soundEngine.playVerificationChime();
        const existingAfter = canteenService.checkDuplicateBooking(employee.id, selectedMealSlot);
        setDuplicateOrder(existingAfter || null);

        const drawer = document.getElementById('modalReceiptDrawer');
        if (drawer) {
          drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 650);
    } catch (err) {
      console.error('Order creation error:', err);
      soundEngine.playWarningBuzzer();
      setIsDispensing(false);
    }
  };

  const displayPhoto = capturedSnapshot || employee.photo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white border-2 border-emerald-500/50 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Camera Biometric Verification
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold tracking-wide">
                  MATCH VERIFIED (99.4%)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Identity verified by facial recognition model.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all active:scale-95"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex flex-col gap-5 max-h-[calc(92vh-80px)]">
          
          {/* ============================================================= */}
          {/* 1. EMPLOYEE DETAILS & CAPTURED FACE SNAPSHOT                   */}
          {/* ============================================================= */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-5">
            
            <div className="flex items-center space-x-4 w-full md:w-auto">
              {/* Captured Photo Container */}
              <div className="relative shrink-0">
                <img
                  src={displayPhoto}
                  alt={employee.name}
                  className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover border-3 border-emerald-500 shadow-md"
                />
                <span className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-emerald-600 text-white rounded-full shadow-md">
                  <BadgeCheck className="w-4 h-4" />
                </span>
                <span className="absolute top-1 left-1 bg-slate-900/80 text-emerald-300 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded backdrop-blur">
                  LIVE
                </span>
              </div>

              {/* Employee text info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2 flex-wrap">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">
                    {employee.name}
                  </h3>
                  <span
                    className={`text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full font-bold border ${
                      employee.role === 'Staff'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {employee.role || 'Employee'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 mt-2">
                  <div className="flex items-center space-x-1.5 font-mono font-bold text-slate-800">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>ID: {employee.id}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{employee.dept}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold sm:col-span-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Free Canteen Subsidy Benefit Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Date and Time readout */}
            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl w-full md:w-auto shrink-0 flex flex-row md:flex-col justify-between items-center md:items-end gap-1 shadow-2xs font-mono">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentDateStr}</span>
              </div>
              <div className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>{currentTimeStr}</span>
              </div>
            </div>

          </div>

          {/* ============================================================= */}
          {/* 2. HORIZONTAL SLIDE: SELECT FOOD TYPE                          */}
          {/* Breakfast, Lunch, Tea, Snacks, Dinner                          */}
          {/* ============================================================= */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Select Food Type (Horizontal Slide)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Slide horizontally to select your meal session.
                </p>
              </div>

              {/* Slider Controls */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSlideLeft}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all active:scale-95 shadow-2xs"
                  title="Slide Left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSlideRight}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all active:scale-95 shadow-2xs"
                  title="Slide Right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Duplicate Order Warning */}
            {duplicateOrder && (
              <div className="text-xs bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-2xl flex items-center space-x-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Duplicate Order Lock:</strong> {duplicateOrder.meal} already booked today at{' '}
                  <span className="font-mono font-bold">{duplicateOrder.issuedAt}</span>!
                </span>
              </div>
            )}

            {/* Horizontal Food Slide Carousel */}
            <div
              ref={sliderRef}
              className="flex gap-3.5 overflow-x-auto pb-3 pt-1 snap-x snap-mandatory scroll-smooth no-scrollbar"
              style={{ scrollbarWidth: 'thin' }}
            >
              {MEAL_SLOTS.map((slot) => {
                const isSelected = selectedMealSlot === slot.name;
                const isCurrentTimeSlot = activeSlotName === slot.name;
                const isAlreadyBooked = Boolean(
                  canteenService.checkDuplicateBooking(employee.id, slot.name)
                );

                return (
                  <div
                    key={slot.name}
                    id={`modal-slide-meal-${slot.name}`}
                    onClick={() => {
                      soundEngine.playScannerBeep();
                      setSelectedMealSlot(slot.name);
                    }}
                    className={`cursor-pointer min-w-[240px] sm:min-w-[270px] flex-shrink-0 p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 snap-center select-none shadow-2xs ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-md transform scale-[1.02]'
                        : 'border-slate-200 bg-white hover:border-emerald-300'
                    } ${isAlreadyBooked ? 'opacity-75' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-2xl p-1.5 bg-slate-50 rounded-xl border border-slate-100">
                          {slot.emoji}
                        </span>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <h5 className="font-bold text-slate-900 text-sm">{slot.name}</h5>
                            {isAlreadyBooked && (
                              <span className="text-[8px] font-bold uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                                Booked
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-[10px] ${
                              isCurrentTimeSlot ? 'text-emerald-700 font-bold' : 'text-slate-500'
                            }`}
                          >
                            {slot.startTime} - {slot.endTime}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          isCurrentTimeSlot
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isCurrentTimeSlot ? 'Active' : slot.category}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-tight">
                      {slot.description}
                    </p>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 font-medium">
                      <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                        <Flame className="w-3 h-3 text-amber-500" />
                        <span>{slot.calories} kcal</span>
                      </span>
                      <span className="text-emerald-700 font-bold text-[11px]">100% Subsidized</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination dots */}
            <div className="flex items-center justify-center space-x-1.5">
              {MEAL_SLOTS.map((slot) => (
                <button
                  key={slot.name}
                  onClick={() => {
                    setSelectedMealSlot(slot.name);
                    const card = document.getElementById(`modal-slide-meal-${slot.name}`);
                    if (card) card.scrollIntoView({ behavior: 'smooth', inline: 'center' });
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    selectedMealSlot === slot.name ? 'w-5 bg-emerald-600' : 'w-1.5 bg-slate-300'
                  }`}
                  title={`Select ${slot.name}`}
                />
              ))}
            </div>
          </div>

          {/* ============================================================= */}
          {/* 3. ORDER CONFIRMATION & 80MM THERMAL SLIP PRINT               */}
          {/* ============================================================= */}
          <div className="bg-slate-100/90 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                Selected Meal Session:
              </span>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-base font-bold text-slate-900">
                  {selectedMealSlot}
                </span>
                <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                  80mm Slip
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 sm:w-auto px-4 py-3 rounded-xl border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Scan Another</span>
              </button>

              <button
                id="btnModalConfirmPrint"
                type="button"
                onClick={handleConfirmAndPrint}
                disabled={Boolean(duplicateOrder) || isDispensing}
                className={`w-1/2 sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2 ${
                  duplicateOrder || isDispensing
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>{isDispensing ? 'Dispensing Slip...' : 'Confirm & Print Slip'}</span>
              </button>
            </div>
          </div>

          {/* Ejected Thermal Receipt Simulation */}
          {lastPrintedOrder && (
            <div
              id="modalReceiptDrawer"
              className="p-5 bg-white border border-slate-300 rounded-2xl flex flex-col md:flex-row items-center justify-center gap-5 shadow-sm animate-in fade-in zoom-in-95 duration-200"
            >
              <ThermalReceipt
                order={lastPrintedOrder}
                onSendToScanner={onNavigateToStaffScanner}
                onPrint={() => window.print()}
              />

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Done (Return to Camera) ➔
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
