import React, { useState, useEffect, useMemo } from 'react';
import type {
  FoodTransportRecord,
  MealSlotName,
  TransportItem,
  TransportUnit,
} from '../../types';
import { canteenService } from '../../services/canteenService';
import { apiClient } from '../../services/apiClient';
import { soundEngine } from '../../services/soundEngine';
import {
  exportTransportToCSV,
  exportTransportToExcel,
  exportTransportToPDF,
} from '../../services/foodTransportExportService';
import {
  Truck,
  Plus,
  Calendar,
  Clock,
  Users,
  Scale,
  Hash,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  Trash2,
  CheckCircle2,
  X,
  Edit3,
  Building2,
  RefreshCw,
  UtensilsCrossed,
  Layers,
  Moon,
  Coffee,
  Sun,
  Sunrise,
  Sparkles,
  ClipboardList,
  Filter,
} from 'lucide-react';

interface MealOption {
  id: MealSlotName;
  label: string;
  tamil: string;
  emoji: string;
  defaultUnit: 'kg' | 'count';
  timeWindow: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MEAL_OPTIONS: MealOption[] = [
  {
    id: 'Tiffin',
    label: 'Tiffin',
    tamil: 'காலை உணவு',
    emoji: '🥞',
    defaultUnit: 'count',
    timeWindow: '07:30 - 11:00 AM',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: Sunrise,
  },
  {
    id: 'Lunch',
    label: 'Lunch',
    tamil: 'மதிய உணவு',
    emoji: '🍛',
    defaultUnit: 'kg',
    timeWindow: '12:00 - 03:30 PM',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: Sun,
  },
  {
    id: 'Tea/Snacks',
    label: 'Tea & Snacks',
    tamil: 'தேநீர் & சிற்றுண்டி',
    emoji: '☕',
    defaultUnit: 'count',
    timeWindow: '03:30 - 06:30 PM',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    icon: Coffee,
  },
  {
    id: 'Dinner',
    label: 'Dinner',
    tamil: 'இரவு உணவு',
    emoji: '🌙',
    defaultUnit: 'count',
    timeWindow: '07:30 - 10:30 PM',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    icon: Moon,
  },
];

export const FoodTransportView: React.FC = () => {
  // Transport Records & Units State
  const [records, setRecords] = useState<FoodTransportRecord[]>([]);
  const [units, setUnits] = useState<TransportUnit[]>([]);

  // Navigation tab: 'dispatch' form vs 'ledger' history
  const [activeTab, setActiveTab] = useState<'dispatch' | 'ledger'>('dispatch');

  // Dispatch Form State
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedMeal, setSelectedMeal] = useState<MealSlotName>('Lunch');
  const [menuItemsText, setMenuItemsText] = useState<string>('');
  const [personCount, setPersonCount] = useState<number>(50);
  const [primaryQuantity, setPrimaryQuantity] = useState<number>(25);
  const [primaryUnit, setPrimaryUnit] = useState<'kg' | 'count'>('kg');
  const [dispatchDate, setDispatchDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [dispatchTime, setDispatchTime] = useState<string>(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  const [vehicleOrDriver, setVehicleOrDriver] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Itemized breakdown (optional for multiple dishes in same transport)
  const [showItemBreakdown, setShowItemBreakdown] = useState<boolean>(false);
  const [breakdownItems, setBreakdownItems] = useState<TransportItem[]>([]);

  // Add New Unit Modal State
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState<boolean>(false);
  const [newUnitName, setNewUnitName] = useState<string>('');
  const [newUnitLocation, setNewUnitLocation] = useState<string>('');
  const [newUnitContact, setNewUnitContact] = useState<string>('');

  // Analysis / Filter State
  const todayStr = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterUnit, setFilterUnit] = useState<string>('ALL');
  const [filterMeal, setFilterMeal] = useState<string>('ALL');

  // Feedback Toasts & States
  const [dispatchSuccessToast, setDispatchSuccessToast] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load Initial Data
  const refreshData = () => {
    const loadedUnits = canteenService.getTransportUnits();
    setUnits(loadedUnits);
    if (!selectedUnitId && loadedUnits.length > 0) {
      setSelectedUnitId(loadedUnits[0].id);
    }
    setRecords(canteenService.getFoodTransports());
  };

  useEffect(() => {
    refreshData();
    const unsub = apiClient.subscribe(() => {
      refreshData();
    });
    return () => unsub();
  }, []);

  // When meal slot changes, auto-populate menuItemsText from active meal slots or delicious defaults
  useEffect(() => {
    const slots = canteenService.getMealSlots();
    const match = slots.find((s) => s.name === selectedMeal);
    if (match && match.description && match.description.trim()) {
      setMenuItemsText(match.description);
    } else {
      // Default suggestions if slot description is empty
      if (selectedMeal === 'Tiffin') {
        setMenuItemsText('இட்லி, சாம்பார், சட்னி, மெதுவடை (Idli, Sambar, Chutney, Vada)');
        setPrimaryUnit('count');
      } else if (selectedMeal === 'Lunch') {
        setMenuItemsText('சாம்பார் சாதம், பொரியல், கூட்டு, அப்பளம் (Sambar Rice, Poriyal, Appalam)');
        setPrimaryUnit('kg');
      } else if (selectedMeal === 'Tea/Snacks') {
        setMenuItemsText('ஸ்பெஷல் டீ & வெங்காய பக்கோடா (Special Tea & Pakoda)');
        setPrimaryUnit('count');
      } else if (selectedMeal === 'Dinner') {
        setMenuItemsText('சப்பாத்தி, தால் குருமா, தோசை, சாம்பார், சட்னி (Chappathi, Dal Kurma, Dosa, Chutney)');
        setPrimaryUnit('count');
      }
    }
  }, [selectedMeal]);

  // Handle Add New Unit Submission
  const handleSaveNewUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;

    const saved = await canteenService.addTransportUnit({
      name: newUnitName.trim(),
      location: newUnitLocation.trim() || undefined,
      contactPerson: newUnitContact.trim() || undefined,
    });

    soundEngine.playVerificationChime();
    setUnits(canteenService.getTransportUnits());
    setSelectedUnitId(saved.id);
    setNewUnitName('');
    setNewUnitLocation('');
    setNewUnitContact('');
    setIsAddUnitModalOpen(false);
  };

  // Auto-generate breakdown dish rows from menu text
  const handleGenerateBreakdownFromMenu = () => {
    if (!menuItemsText.trim()) return;
    const parts = menuItemsText
      .split(/[,|\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const generated: TransportItem[] = parts.map((name, i) => {
      const lower = name.toLowerCase();
      const isLiquidOrRice =
        lower.includes('rice') ||
        lower.includes('சாதம்') ||
        lower.includes('sambar') ||
        lower.includes('சாம்பார்') ||
        lower.includes('curry') ||
        lower.includes('குருமா') ||
        lower.includes('கூட்டு');

      return {
        id: `item-${Date.now()}-${i}`,
        name,
        quantity: isLiquidOrRice ? Math.round(personCount * 0.3) : Math.round(personCount * 2),
        unit: isLiquidOrRice ? 'kg' : 'count',
      };
    });

    setBreakdownItems(generated);
    setShowItemBreakdown(true);
  };

  const handleUpdateBreakdownItem = (
    index: number,
    field: keyof TransportItem,
    val: unknown
  ) => {
    setBreakdownItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, [field]: val } : it))
    );
  };

  const handleRemoveBreakdownItem = (index: number) => {
    setBreakdownItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddBreakdownRow = () => {
    setBreakdownItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        name: '',
        quantity: 10,
        unit: primaryUnit,
      },
    ]);
  };

  // Submit Food Transport Dispatch Entry
  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();

    const unitObj = units.find((u) => u.id === selectedUnitId);
    const unitName = unitObj ? unitObj.name : selectedUnitId || 'External Unit';

    if (!unitName) {
      alert('Please select or add a destination unit.');
      return;
    }

    if (!menuItemsText.trim()) {
      alert('Please enter the menu items being dispatched.');
      return;
    }

    if (personCount <= 0) {
      alert('Please enter a valid person count.');
      return;
    }

    if (primaryQuantity <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      soundEngine.playVerificationChime();

      await canteenService.addFoodTransport({
        unitName,
        mealType: selectedMeal,
        menuItems: menuItemsText.trim(),
        personCount: Number(personCount),
        primaryQuantity: Number(primaryQuantity),
        primaryUnit,
        items: showItemBreakdown && breakdownItems.length > 0 ? breakdownItems : undefined,
        dispatchDate: dispatchDate || todayStr,
        dispatchTime:
          dispatchTime ||
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        vehicleOrDriver: vehicleOrDriver.trim() || undefined,
        status: 'DISPATCHED',
        notes: notes.trim() || undefined,
      });

      setRecords(canteenService.getFoodTransports());
      setDispatchSuccessToast(true);
      setTimeout(() => setDispatchSuccessToast(false), 3500);

      // Reset optional notes & vehicle
      setVehicleOrDriver('');
      setNotes('');
      setShowItemBreakdown(false);
      setBreakdownItems([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    await canteenService.deleteFoodTransport(id);
    setDeleteConfirmId(null);
    setRecords(canteenService.getFoodTransports());
  };

  // Filtered transport records for Ledger & Analytics
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return records.filter((r) => {
      if (fromDate && r.dispatchDate < fromDate) return false;
      if (toDate && r.dispatchDate > toDate) return false;
      if (filterUnit !== 'ALL' && r.unitName !== filterUnit) return false;
      if (filterMeal !== 'ALL' && r.mealType !== filterMeal) return false;

      if (q) {
        const matchUnit = (r.unitName || '').toLowerCase().includes(q);
        const matchMenu = (r.menuItems || '').toLowerCase().includes(q);
        const matchVehicle = (r.vehicleOrDriver || '').toLowerCase().includes(q);
        const matchNotes = (r.notes || '').toLowerCase().includes(q);
        if (!matchUnit && !matchMenu && !matchVehicle && !matchNotes) return false;
      }

      return true;
    });
  }, [records, fromDate, toDate, filterUnit, filterMeal, searchQuery]);

  // Analytics KPI Summary
  const totalDispatches = filteredRecords.length;
  const totalHeadcount = filteredRecords.reduce((sum, r) => sum + (r.personCount || 0), 0);
  const totalKg = filteredRecords
    .filter((r) => r.primaryUnit === 'kg')
    .reduce((sum, r) => sum + (r.primaryQuantity || 0), 0);
  const totalCount = filteredRecords
    .filter((r) => r.primaryUnit === 'count')
    .reduce((sum, r) => sum + (r.primaryQuantity || 0), 0);

  // Quick Date presets
  const handleSetQuickDate = (preset: 'today' | 'yesterday' | 'week' | 'all') => {
    if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yStr = d.toISOString().slice(0, 10);
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setFromDate(d.toISOString().slice(0, 10));
      setToDate(todayStr);
    } else if (preset === 'all') {
      setFromDate('');
      setToDate(todayStr);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 select-none animate-in fade-in duration-200 p-2 sm:p-4">
      {/* =================================================================== */}
      {/* 1. TOP HEADER & KPI METRICS BAR                                     */}
      {/* =================================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25 shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Food Transport & Branch Dispatches
                </h1>
                <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Logistics
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                மற்ற பிரிவுகள், கிளைகள் மற்றும் ஆலைகளுக்கான உணவு போக்குவரத்து பதிவு & நேரடி கணக்கு
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsAddUnitModalOpen(true)}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/30 flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Unit</span>
            </button>

            <button
              type="button"
              onClick={refreshData}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* 4 Responsive KPI Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                Dispatches
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {totalDispatches} <span className="text-xs font-medium text-slate-400">Trips</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                Headcount
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {totalHeadcount} <span className="text-xs font-medium text-slate-400">Persons</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                Total Weight (Kg)
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-800 font-mono">
                {totalKg.toFixed(1)} <span className="text-xs font-medium text-slate-400">Kg</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                Total Count (Nos)
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-800 font-mono">
                {totalCount} <span className="text-xs font-medium text-slate-400">Pieces</span>
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs: Dispatch vs Ledger */}
        <div className="flex items-center space-x-2 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab('dispatch')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'dispatch'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>New Dispatch Entry (புதிய பதிவு)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Dispatches Ledger & Reports ({records.length})</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. TAB A: NEW DISPATCH ENTRY FORM                                   */}
      {/* =================================================================== */}
      {activeTab === 'dispatch' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-xs flex flex-col gap-6 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                <span>Record Food Transport Dispatch</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Fill in the destination unit, meal slot, portions and menu to log transport
              </p>
            </div>

            {dispatchSuccessToast && (
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Food transport dispatched and saved successfully!</span>
              </span>
            )}
          </div>

          <form onSubmit={handleSubmitDispatch} className="flex flex-col gap-6">
            {/* STEP 1: DESTINATION & TIMING */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Step 1: Destination Unit & Logistics</span>
              </span>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                {/* Unit Selector */}
                <div className="md:col-span-6 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Target Sector / Factory (பிரிவு தேர்வு) *</span>
                    <button
                      type="button"
                      onClick={() => setIsAddUnitModalOpen(true)}
                      className="text-emerald-700 font-bold hover:underline text-[11px] flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add New Unit</span>
                    </button>
                  </label>

                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white cursor-pointer"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.location ? `— ${u.location}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dispatch Date */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Dispatch Date</span>
                  </label>
                  <input
                    type="date"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Dispatch Time */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Dispatch Time</span>
                  </label>
                  <input
                    type="text"
                    value={dispatchTime}
                    onChange={(e) => setDispatchTime(e.target.value)}
                    placeholder="e.g. 12:30 PM"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* STEP 2: MEAL CATEGORY WITH DINNER SECTION */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600" />
                <span>Step 2: Meal Particulars (உணவு வகை - காலை, மதியம், மாலை, இரவு)</span>
              </span>

              {/* 4 Balanced Cards: Tiffin, Lunch, Tea/Snacks, Dinner */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {MEAL_OPTIONS.map((slot) => {
                  const isSelected = selectedMeal === slot.id;
                  const IconComp = slot.icon;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playSelectSound();
                        setSelectedMeal(slot.id);
                        setPrimaryUnit(slot.defaultUnit);
                      }}
                      className={`relative p-3.5 rounded-2xl border-2 text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{slot.emoji}</span>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-black text-slate-900 leading-tight">
                          {slot.label}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">{slot.tamil}</div>
                      </div>

                      <div className="pt-1 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{slot.timeWindow}</span>
                        {isSelected && (
                          <span className="text-emerald-700 font-bold">Active</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 3: HEADCOUNT, DISPATCH QUANTITY & MEASUREMENT */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                <span>Step 3: Headcount & Quantity Measurement</span>
              </span>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 sm:p-5 bg-slate-50/80 border border-slate-200/90 rounded-2xl">
                {/* Person Count */}
                <div className="md:col-span-5 flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Headcount / Person Count (ஆட்கள் எண்ணிக்கை):</span>
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={personCount}
                    onChange={(e) =>
                      setPersonCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />

                  {/* Quick Preset Pills */}
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {[25, 50, 75, 100, 150, 200, 250].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPersonCount(num)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          personCount === num
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Quantity & Unit Switcher */}
                <div className="md:col-span-7 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Primary Dispatch Quantity & Unit:</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Use Kg for meals/rice, Count for tiffin/dinner
                    </span>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={primaryQuantity}
                        onChange={(e) =>
                          setPrimaryQuantity(Math.max(0, parseFloat(e.target.value) || 0))
                        }
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div className="col-span-6 grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playSelectSound();
                          setPrimaryUnit('kg');
                        }}
                        className={`flex items-center justify-center space-x-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          primaryUnit === 'kg'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Scale className="w-3 h-3" />
                        <span>Kg (கிலோ)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playSelectSound();
                          setPrimaryUnit('count');
                        }}
                        className={`flex items-center justify-center space-x-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          primaryUnit === 'count'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Hash className="w-3 h-3" />
                        <span>Count (எண்)</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 pt-0.5">
                    <span>
                      Dispatched: <strong className="text-slate-900">{primaryQuantity} {primaryUnit === 'kg' ? 'Kg' : 'Pieces'}</strong> for <strong className="text-slate-900">{personCount} persons</strong>
                    </span>

                    <button
                      type="button"
                      onClick={() => setShowItemBreakdown(!showItemBreakdown)}
                      className="text-emerald-700 font-bold hover:underline flex items-center space-x-1 text-xs cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{showItemBreakdown ? 'Hide Dish Breakdown' : '+ Add Itemized Dish Rows'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 4: MENU ITEMS & OPTIONAL DISH BREAKDOWN */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Step 4: Menu Items Dispatched (உணவு பட்டியல்)</span>
                </span>

                <button
                  type="button"
                  onClick={handleGenerateBreakdownFromMenu}
                  className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 cursor-pointer transition-all"
                  title="Auto calculate individual dish rows from text"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Auto-generate Dish Rows</span>
                </button>
              </div>

              <textarea
                rows={2}
                value={menuItemsText}
                onChange={(e) => setMenuItemsText(e.target.value)}
                placeholder="e.g. Chappathi, Dal Kurma, Dosa, Sambar, Chutney..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none leading-relaxed font-medium"
              />

              {/* Optional Itemized Dish Breakdown Drawer */}
              {showItemBreakdown && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200/90 rounded-2xl flex flex-col gap-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Itemized Dish Quantities (தனித்தனி உணவுகள் மற்றும் அளவுகள்)</span>
                    </span>

                    <button
                      type="button"
                      onClick={handleAddBreakdownRow}
                      className="px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300 transition-all cursor-pointer flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Dish Row</span>
                    </button>
                  </div>

                  {breakdownItems.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3 text-center bg-white/70 rounded-xl border border-dashed border-emerald-200">
                      No dish rows yet. Click &quot;Auto-generate Dish Rows&quot; above or &quot;Add Dish Row&quot; to specify individual dishes.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {breakdownItems.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-emerald-100 shadow-2xs"
                        >
                          <div className="col-span-5">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) =>
                                handleUpdateBreakdownItem(idx, 'name', e.target.value)
                              }
                              placeholder="Dish Name (e.g. Chappathi)"
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>

                          <div className="col-span-3">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateBreakdownItem(
                                  idx,
                                  'quantity',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>

                          <div className="col-span-3">
                            <select
                              value={item.unit}
                              onChange={(e) =>
                                handleUpdateBreakdownItem(
                                  idx,
                                  'unit',
                                  e.target.value as TransportItem['unit']
                                )
                              }
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                              <option value="kg">kg (கிலோ)</option>
                              <option value="count">count (எண்)</option>
                              <option value="litres">litres (லிட்டர்)</option>
                              <option value="packets">packets (பொட்டலம்)</option>
                            </select>
                          </div>

                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveBreakdownItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* STEP 5: VEHICLE & REMARKS + SUBMIT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Vehicle No. / Driver Name (வாகனம் / ஓட்டுநர் - விருப்பத்தேர்வு):
                </label>
                <input
                  type="text"
                  value={vehicleOrDriver}
                  onChange={(e) => setVehicleOrDriver(e.target.value)}
                  placeholder="e.g. TN-38-BX-4412 / Murugesan"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Dispatch Remarks / Notes (குறிப்புகள் - விருப்பத்தேர்வு):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Packed in hot insulated thermal carriers"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Submit Dispatch Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-2xl font-black text-sm sm:text-base shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2.5 transition-all transform active:scale-[0.99] cursor-pointer"
              >
                <Truck className="w-5 h-5" />
                <span>Dispatch Food Transport (போக்குவரத்து பதிவு செய்)</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. TAB B: DISPATCHES LEDGER, ADVANCED FILTERS & EXPORTS             */}
      {/* =================================================================== */}
      {activeTab === 'ledger' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-150">
          {/* Filter & Export Toolbar */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Filter & Search Transport Dispatches
                </h3>
              </div>

              {/* One-click Export Action Bar */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => exportTransportToCSV(filteredRecords, fromDate, toDate)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Download CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportTransportToExcel(filteredRecords, fromDate, toDate)}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Download Styled Excel Report"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingPDF}
                  onClick={async () => {
                    setIsGeneratingPDF(true);
                    try {
                      await exportTransportToPDF(filteredRecords, fromDate, toDate);
                    } finally {
                      setIsGeneratingPDF(false);
                    }
                  }}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-700/20 flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Download Native Tamil PDF Report"
                >
                  <FileText className={`w-3.5 h-3.5 ${isGeneratingPDF ? 'animate-pulse' : ''}`} />
                  <span>{isGeneratingPDF ? 'Generating...' : 'PDF Report'}</span>
                </button>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Date Presets & Range */}
              <div className="md:col-span-6 flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1 text-xs text-slate-600 font-bold shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Dates:</span>
                </div>

                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-400 font-bold">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate('today')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      fromDate === todayStr && toDate === todayStr
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate('yesterday')}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate('week')}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate('all')}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    All
                  </button>
                </div>
              </div>

              {/* Unit Dropdown */}
              <div className="md:col-span-3">
                <select
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">All Sectors & Units</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Meal Filter Dropdown with Dinner */}
              <div className="md:col-span-3">
                <select
                  value={filterMeal}
                  onChange={(e) => setFilterMeal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">All Meal Particulars</option>
                  <option value="Tiffin">🥞 Tiffin (காலை)</option>
                  <option value="Lunch">🍛 Lunch (மதியம்)</option>
                  <option value="Tea/Snacks">☕ Tea & Snacks (மாலை)</option>
                  <option value="Dinner">🌙 Dinner (இரவு உணவு)</option>
                </select>
              </div>
            </div>

            {/* Live Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by sector, dish name, vehicle or remarks..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Transport Ledger Table */}
          <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-slate-900 uppercase tracking-tight">
                  Dispatches Ledger
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {filteredRecords.length} records
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Persistent database sync
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-center">Date & Time</th>
                    <th className="px-4 py-3">Sector / Unit</th>
                    <th className="px-4 py-3 text-center">Particulars</th>
                    <th className="px-4 py-3">Menu Items Dispatched</th>
                    <th className="px-4 py-3 text-right">Headcount</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3">Vehicle / Driver</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-14 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Truck className="w-10 h-10 text-slate-300" />
                          <span className="text-sm font-bold text-slate-600">
                            No transport dispatches match criteria
                          </span>
                          <span className="text-xs text-slate-400">
                            Adjust your date range or filters, or switch to the New Dispatch tab above.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => {
                      const hasBreakdown = r.items && r.items.length > 0;
                      const mealBadgeClass =
                        r.mealType === 'Tiffin'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : r.mealType === 'Lunch'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : r.mealType === 'Dinner'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : 'bg-sky-50 text-sky-800 border-sky-200';

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Date & Time */}
                          <td className="px-4 py-3 text-center font-mono whitespace-nowrap">
                            <div className="font-bold text-slate-900">{r.dispatchDate}</div>
                            <div className="text-[10px] text-slate-400">{r.dispatchTime}</div>
                          </td>

                          {/* Sector / Unit */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                              <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{r.unitName}</span>
                            </div>
                            {r.notes && (
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">
                                {r.notes}
                              </div>
                            )}
                          </td>

                          {/* Particulars (Meal Slot) */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${mealBadgeClass}`}
                            >
                              {r.mealType === 'Dinner' ? '🌙 Dinner' : r.mealType}
                            </span>
                          </td>

                          {/* Menu Items */}
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800 max-w-xs line-clamp-2">
                              {r.menuItems}
                            </div>
                            {hasBreakdown && (
                              <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                                ↳{' '}
                                {r.items!
                                  .map((it) => `${it.name}: ${it.quantity} ${it.unit}`)
                                  .join(', ')}
                              </div>
                            )}
                          </td>

                          {/* Headcount */}
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {r.personCount}
                          </td>

                          {/* Quantity */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="font-mono font-black text-slate-900">
                              {r.primaryQuantity}{' '}
                              <span className="text-[10px] uppercase font-bold text-slate-500">
                                {r.primaryUnit}
                              </span>
                            </div>
                          </td>

                          {/* Vehicle / Driver */}
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {r.vehicleOrDriver || '—'}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ {r.status}
                            </span>
                          </td>

                          {/* Delete Action */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {deleteConfirmId === r.id ? (
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRecord(r.id)}
                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(r.id)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Delete dispatch entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. MODAL: REGISTER NEW DESTINATION UNIT / SECTOR                    */}
      {/* =================================================================== */}
      {isAddUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-600 text-white">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Add New Destination Unit</h4>
                  <p className="text-[11px] text-slate-500">
                    புதிய ஆலை அல்லது கிளை பிரிவை சேர்க்கவும்
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUnitModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewUnit} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Unit / Factory Name (பிரிவு பெயர்) *
                </label>
                <input
                  type="text"
                  required
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="e.g. Unit 5 - Garments Processing"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Sector Location / Address (இடம்)
                </label>
                <input
                  type="text"
                  value={newUnitLocation}
                  onChange={(e) => setNewUnitLocation(e.target.value)}
                  placeholder="e.g. Gate 3, South Wing"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Contact Person / Phone (தொடர்பு அலுவலர்)
                </label>
                <input
                  type="text"
                  value={newUnitContact}
                  onChange={(e) => setNewUnitContact(e.target.value)}
                  placeholder="e.g. Anand Supervisor / 9876543210"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddUnitModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  Save & Add Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
