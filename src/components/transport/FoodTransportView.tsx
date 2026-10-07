import React, { useState, useEffect, useMemo } from 'react';
import type {
  FoodTransportRecord,
  MealSlotName,
  TransportItem,
  TransportUnit,
} from '../../types';
import { canteenService } from '../../services/canteenService';
import { supabaseManager } from '../../services/supabase';
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
} from 'lucide-react';

export const FoodTransportView: React.FC = () => {
  // Transport Records & Units State
  const [records, setRecords] = useState<FoodTransportRecord[]>([]);
  const [units, setUnits] = useState<TransportUnit[]>([]);

  // Dispatch Form State
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedMeal, setSelectedMeal] = useState<MealSlotName>('Lunch');
  const [menuItemsText, setMenuItemsText] = useState<string>('');
  const [personCount, setPersonCount] = useState<number>(50);
  const [primaryQuantity, setPrimaryQuantity] = useState<number>(25);
  const [primaryUnit, setPrimaryUnit] = useState<'kg' | 'count'>('kg');
  const [dispatchDate, setDispatchDate] = useState<string>(new Date().toISOString().slice(0, 10));
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

  // Success Toast & Delete Confirm
  const [dispatchSuccessToast, setDispatchSuccessToast] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
    const unsub = supabaseManager.onRealtimeChange((event) => {
      if (
        event.table === 'canteen_food_transport' ||
        event.table === 'canteen_transport_units'
      ) {
        refreshData();
      }
    });
    return () => unsub();
  }, []);

  // When meal slot changes, auto-populate menuItemsText from active meal slots
  useEffect(() => {
    const slots = canteenService.getMealSlots();
    const match = slots.find((s) => s.name === selectedMeal);
    if (match && match.description) {
      setMenuItemsText(match.description);
    } else {
      // Default suggestions if slot description is empty
      if (selectedMeal === 'Tiffin') {
        setMenuItemsText('இட்லி, சாம்பார், சட்னி, மெதுவடை (Idli, Sambar, Chutney, Vada)');
        setPrimaryUnit('count');
      } else if (selectedMeal === 'Lunch') {
        setMenuItemsText('சாம்பார் சாதம், பொரியல், கூட்டு, அப்பளம் (Sambar Rice, Poriyal, Appalam)');
        setPrimaryUnit('kg');
      } else {
        setMenuItemsText('ஸ்பெஷல் டீ & வெங்காய பக்கோடா (Special Tea & Pakoda)');
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
      const isLiquidOrRice = lower.includes('rice') || lower.includes('சாதம்') || lower.includes('sambar') || lower.includes('சாம்பார்') || lower.includes('curry') || lower.includes('கூட்டு');
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
      dispatchTime: dispatchTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
    <div className="w-full flex flex-col gap-6 select-none animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Food Transport & Sector Dispatches
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                மற்ற பிரிவுகள் மற்றும் ஆலைகளுக்கான உணவு போக்குவரத்து பதிவு & ஆய்வு
              </p>
            </div>
          </div>
        </div>

        {/* Header Action: Add New Unit & Refresh */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsAddUnitModalOpen(true)}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
            title="Register a new factory sector or branch unit"
          >
            <Plus className="w-4 h-4 text-emerald-700" />
            <span>+ Add New Unit / Sector</span>
          </button>

          <button
            type="button"
            onClick={refreshData}
            className="p-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
            title="Refresh transport records"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 1: FOOD TRANSPORT DISPATCH ENTRY FORM                     */}
      {/* ================================================================= */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col gap-5">
        
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              New Food Transport Entry (போக்குவரத்து பதிவு)
            </h3>
          </div>
          
          {dispatchSuccessToast && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Food dispatch successfully recorded!</span>
            </span>
          )}
        </div>

        <form onSubmit={handleSubmitDispatch} className="flex flex-col gap-4">
          
          {/* Row 1: Select Unit Dropdown + Add Unit Button */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            
            <div className="md:col-span-8 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>1. Select Destination Unit / Sector (பிரிவு தேர்வு):</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {units.length} registered units
                </span>
              </label>

              <div className="flex items-center space-x-2">
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white cursor-pointer"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.location ? `(${u.location})` : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsAddUnitModalOpen(true)}
                  className="shrink-0 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold border border-slate-200 flex items-center space-x-1 cursor-pointer transition-all"
                  title="Add new destination unit"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
              </div>
            </div>

            {/* Date & Time of Dispatch */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>Date:</span>
              </label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Time:</span>
              </label>
              <input
                type="text"
                value={dispatchTime}
                onChange={(e) => setDispatchTime(e.target.value)}
                placeholder="e.g. 12:30 PM"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

          </div>

          {/* Row 2: Particular / Food Type Selector */}
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-tight block mb-1.5">
              2. Select Food Particular / Type (உணவு வகை):
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'Tiffin' as MealSlotName, label: 'Tiffin', tamil: 'காலை உணவு', emoji: '🥞', defaultUnit: 'count' },
                { id: 'Lunch' as MealSlotName, label: 'Lunch', tamil: 'மதிய உணவு', emoji: '🍛', defaultUnit: 'kg' },
                { id: 'Tea/Snacks' as MealSlotName, label: 'Tea/Snacks', tamil: 'தேநீர் & ஸ்நாக்ஸ்', emoji: '☕', defaultUnit: 'count' },
              ].map((slot) => {
                const isSelected = selectedMeal === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playSelectSound();
                      setSelectedMeal(slot.id);
                      setPrimaryUnit(slot.defaultUnit as 'kg' | 'count');
                    }}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-center space-x-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs scale-[1.01]'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="text-xl">{slot.emoji}</span>
                    <div className="text-left">
                      <div className="text-xs font-bold leading-tight">{slot.label}</div>
                      <div className="text-[10px] text-slate-500 font-sans">{slot.tamil}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Menu Items Box (Auto-filled + Editable) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>3. Menu Items (உணவு பட்டியல் - திருத்தக்கூடியது):</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateBreakdownFromMenu}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center space-x-1 cursor-pointer transition-all"
                title="Create separate dish rows with individual quantities & units"
              >
                <Layers className="w-3 h-3" />
                <span>Auto-generate Dish Rows</span>
              </button>
            </div>
            
            <textarea
              rows={2}
              value={menuItemsText}
              onChange={(e) => setMenuItemsText(e.target.value)}
              placeholder="e.g. Rice, Sambar, Vegetable Poriyal, Rasam, Curd, Appalam..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none leading-relaxed font-medium"
            />
          </div>

          {/* Row 4: Person Count & Primary Quantity Management (Count vs Kg) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            
            {/* Person Count (Headcount) */}
            <div className="sm:col-span-5 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>4. Person Count / Headcount (ஆட்கள் எண்ணிக்கை):</span>
              </label>

              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  value={personCount}
                  onChange={(e) => setPersonCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              {/* Quick Headcount pills */}
              <div className="flex items-center gap-1 pt-0.5">
                {[25, 50, 100, 150, 200].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPersonCount(num)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      personCount === num
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity and Measurement Mode (Count vs Kg) */}
            <div className="sm:col-span-7 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-emerald-600" />
                  <span>5. Dispatch Quantity & Unit (அளவு மற்றும் வகை):</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Select Kg for rice/meals, Count for chapatti/idli
                </span>
              </label>

              <div className="grid grid-cols-12 gap-2">
                {/* Quantity Input */}
                <div className="col-span-6">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={primaryQuantity}
                    onChange={(e) => setPrimaryQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                {/* Unit Switcher: Kg vs Count */}
                <div className="col-span-6 grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playSelectSound();
                      setPrimaryUnit('kg');
                    }}
                    className={`flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                    className={`flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <span>
                  Dispatched as: <strong className="text-slate-800">{primaryQuantity} {primaryUnit === 'kg' ? 'Kilograms (Kg)' : 'Pieces / Count'}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => setShowItemBreakdown(!showItemBreakdown)}
                  className="text-emerald-700 font-bold hover:underline flex items-center space-x-0.5 cursor-pointer"
                >
                  <span>{showItemBreakdown ? 'Hide Dish Breakdown' : '+ Add Item Breakdown'}</span>
                </button>
              </div>
            </div>

          </div>

          {/* Optional Itemized Dish Breakdown Table */}
          {showItemBreakdown && (
            <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex flex-col gap-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Itemized Dish Quantities (தனித்தனி உணவு பட்டியல் அளவுகள்)</span>
                </span>
                <button
                  type="button"
                  onClick={handleAddBreakdownRow}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300 transition-all cursor-pointer flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Row</span>
                </button>
              </div>

              {breakdownItems.length === 0 ? (
                <div className="text-xs text-slate-500 py-2 text-center">
                  No breakdown items added yet. Click &quot;Auto-generate Dish Rows&quot; above or &quot;Add Row&quot; to specify dishes in both Kg and Count.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {breakdownItems.map((item, idx) => (
                    <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-emerald-100">
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateBreakdownItem(idx, 'name', e.target.value)}
                          placeholder="Dish Name (e.g. Rice, Chapatti)"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => handleUpdateBreakdownItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="col-span-3">
                        <select
                          value={item.unit}
                          onChange={(e) => handleUpdateBreakdownItem(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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

          {/* Row 5: Optional Vehicle / Driver and Dispatch Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">
                Vehicle No. / Driver Name (வாகனம் / ஓட்டுநர் - விருப்பத்தேர்வு):
              </label>
              <input
                type="text"
                value={vehicleOrDriver}
                onChange={(e) => setVehicleOrDriver(e.target.value)}
                placeholder="e.g. TN-38-BX-4412 / Murugesan"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">
                Dispatch Remarks / Notes (குறிப்புகள் - விருப்பத்தேர்வு):
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Packed in hot insulated containers"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.99] cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>Dispatch Food Transport (போக்குவரத்து பதிவு செய்)</span>
            </button>
          </div>

        </form>

      </div>

      {/* ================================================================= */}
      {/* SECTION 2: TRANSPORT ANALYSIS & DATE-WISE SUMMARY                 */}
      {/* ================================================================= */}
      <div className="flex flex-col gap-4">
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Food Transport Analysis & Date-wise Ledger
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              தேதி வாரியாக அனுப்பப்பட்ட உணவு மற்றும் அளவுகளின் முழு விபரம்
            </p>
          </div>

          {/* Report Export Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => exportTransportToCSV(filteredRecords, fromDate, toDate)}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
              title="Download CSV Report"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => exportTransportToExcel(filteredRecords, fromDate, toDate)}
              className="px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
              title="Download Styled Excel Report"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={() => exportTransportToPDF(filteredRecords, fromDate, toDate)}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-700/20 flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
              title="Download PDF Report"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Report</span>
            </button>
          </div>
        </div>

        {/* Date Filters & Presets Toolbar (Like in Kitchen Analysis) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          
          {/* Left: Date Range Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 text-xs text-slate-600">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span className="font-bold">Date Range:</span>
            </div>

            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title="From Date"
            />
            <span className="text-xs text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title="To Date"
            />

            {/* Quick Date Presets */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => handleSetQuickDate('today')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  fromDate === todayStr && toDate === todayStr
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate('yesterday')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate('week')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate('all')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                All Records
              </button>
            </div>
          </div>

          {/* Right: Search & Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search unit, menu, vehicle..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Unit Filter */}
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Units / Sectors</option>
              {units.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>

            {/* Food Type Filter */}
            <select
              value={filterMeal}
              onChange={(e) => setFilterMeal(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Food Types</option>
              <option value="Tiffin">🥞 Tiffin</option>
              <option value="Lunch">🍛 Lunch</option>
              <option value="Tea/Snacks">☕ Tea/Snacks</option>
            </select>

          </div>

        </div>

        {/* Analytics KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          
          {/* Card 1: Total Dispatches */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                Total Dispatches
              </span>
              <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                {totalDispatches}
              </span>
              <span className="text-xs text-slate-400 ml-1.5 font-medium">Trips</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              Food delivery runs
            </span>
          </div>

          {/* Card 2: Total Headcount / Persons Fed */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                Persons Fed / Headcount
              </span>
              <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                {totalHeadcount}
              </span>
              <span className="text-xs text-slate-400 ml-1.5 font-medium">Employees</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              Dispatched headcount
            </span>
          </div>

          {/* Card 3: Dispatched in Kg */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                Dispatched in Kg
              </span>
              <div className="p-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-700 font-mono">
                {totalKg.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 ml-1.5 font-medium">Kg</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              Rice, Sambar, Gravy & Meals
            </span>
          </div>

          {/* Card 4: Dispatched in Count */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                Dispatched in Count
              </span>
              <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Hash className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
                {totalCount}
              </span>
              <span className="text-xs text-slate-400 ml-1.5 font-medium">Pieces / Nos</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              Chapatti, Idli, Vada, Snacks
            </span>
          </div>

        </div>

        {/* Transport Ledger Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          
          <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              Transport Dispatches Ledger ({filteredRecords.length} records)
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Auto-saved to SQL database
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3.5 py-3 text-center">Date & Time</th>
                  <th className="px-3.5 py-3">Sector / Unit</th>
                  <th className="px-3.5 py-3 text-center">Food Type</th>
                  <th className="px-3.5 py-3">Menu Items Dispatched</th>
                  <th className="px-3.5 py-3 text-right">Headcount</th>
                  <th className="px-3.5 py-3 text-right">Quantity</th>
                  <th className="px-3.5 py-3">Vehicle / Driver</th>
                  <th className="px-3.5 py-3 text-center">Status</th>
                  <th className="px-3.5 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Truck className="w-8 h-8 text-slate-300" />
                        <span className="text-xs font-bold text-slate-500">No transport records found</span>
                        <span className="text-[11px] text-slate-400">
                          Try adjusting the date filter or register a new transport dispatch above.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const hasBreakdown = r.items && r.items.length > 0;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        
                        {/* Date & Time */}
                        <td className="px-3.5 py-3 text-center font-mono whitespace-nowrap">
                          <div className="font-bold text-slate-900">{r.dispatchDate}</div>
                          <div className="text-[10px] text-slate-400">{r.dispatchTime}</div>
                        </td>

                        {/* Sector / Unit */}
                        <td className="px-3.5 py-3">
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

                        {/* Food Type */}
                        <td className="px-3.5 py-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            r.mealType === 'Tiffin'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : r.mealType === 'Lunch'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}>
                            {r.mealType}
                          </span>
                        </td>

                        {/* Menu Items */}
                        <td className="px-3.5 py-3">
                          <div className="font-medium text-slate-800 max-w-xs line-clamp-2">
                            {r.menuItems}
                          </div>
                          {hasBreakdown && (
                            <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                              ↳ {r.items!.map((it) => `${it.name}: ${it.quantity} ${it.unit}`).join(', ')}
                            </div>
                          )}
                        </td>

                        {/* Headcount */}
                        <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {r.personCount}
                        </td>

                        {/* Quantity */}
                        <td className="px-3.5 py-3 text-right whitespace-nowrap">
                          <div className="font-mono font-black text-slate-900">
                            {r.primaryQuantity} <span className="text-[10px] uppercase font-bold text-slate-500">{r.primaryUnit}</span>
                          </div>
                        </td>

                        {/* Vehicle / Driver */}
                        <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">
                          {r.vehicleOrDriver || '-'}
                        </td>

                        {/* Status */}
                        <td className="px-3.5 py-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ {r.status}
                          </span>
                        </td>

                        {/* Delete Action */}
                        <td className="px-3.5 py-3 text-center whitespace-nowrap">
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
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                              title="Delete record"
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

      {/* ================================================================= */}
      {/* MODAL: ADD NEW UNIT / SECTOR                                      */}
      {/* ================================================================= */}
      {isAddUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-emerald-600 text-white">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Add New Unit / Sector</h4>
                  <p className="text-[11px] text-slate-500">புதிய ஆலை அல்லது கிளை பிரிவை சேர்க்கவும்</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUnitModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewUnit} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-800">
                  Unit / Sector Name (பிரிவு பெயர்) *
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

              <div className="flex flex-col gap-1">
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

              <div className="flex flex-col gap-1">
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
