import React, { useState, useEffect } from 'react';
import type { MealSlotConfig, MealSlotName } from '../../types';
import { canteenService } from '../../services/canteenService';
import { soundEngine } from '../../services/soundEngine';
import {
  X,
  UtensilsCrossed,
  Clock,
  Languages,
  Sparkles,
  Save,
  CheckCircle2,
} from 'lucide-react';

interface MenuTimingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMenuUpdated?: () => void;
}

// Quick Tamil dishes suggestion chips for 3 meal slots
const TAMIL_DISH_SUGGESTIONS: Record<string, string[]> = {
  Tiffin: ['இட்லி, சாம்பார், சட்னி', 'மெதுவடை', 'வெண் பொங்கல்', 'பூரி மசாலா', 'மசால் தோசை', 'ஃபில்டர் காபி'],
  Lunch: ['சாம்பார் சாதம்', 'காய்கறி கூட்டு, பொரியல்', 'ரசம், மோர்', 'அப்பளம்', 'சப்பாத்தி குருமா', 'பாயாசம்'],
  'Tea/Snacks': ['ஸ்பெஷல் மசாலா டீ', 'ஃபில்டர் காபி', 'வெங்காய பக்கோடா', 'சூடான சமோசா', 'மெது பஜ்ஜி', 'புதினா சட்னி'],
};

export const MenuTimingModal: React.FC<MenuTimingModalProps> = ({
  isOpen,
  onClose,
  onMenuUpdated,
}) => {
  const [slots, setSlots] = useState<MealSlotConfig[]>([]);
  const [activeTab, setActiveTab] = useState<MealSlotName>('Tiffin');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSlots(canteenService.getMealSlots());
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentSlot = slots.find((s) => s.name === activeTab) || slots[0];

  const handleUpdateSlot = (name: MealSlotName, field: keyof MealSlotConfig, value: unknown) => {
    setSlots((prev) =>
      prev.map((s) => (s.name === name ? { ...s, [field]: value } : s))
    );
    setIsSaved(false);
  };

  const handleAppendTamilDish = (dish: string) => {
    if (!currentSlot) return;
    const existing = currentSlot.description.trim();
    const updated = existing ? `${existing}, ${dish}` : dish;
    handleUpdateSlot(currentSlot.name, 'description', updated);
  };

  const handleSaveAll = () => {
    canteenService.updateMealSlots(slots);
    soundEngine.playVerificationChime();
    setIsSaved(true);
    if (onMenuUpdated) {
      onMenuUpdated();
    }
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl shadow-modal flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm shadow-emerald-600/30">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Daily Menu & Serving Timings Update
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                  Tamil & English
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                உணவு பட்டியல் & பரிமாறும் நேரம் மாற்றுதல் (Updates reflect live on Kiosk & Receipts).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meal Slot Horizontal Tabs */}
        <div className="flex items-center space-x-2 px-6 pt-3 pb-2 border-b border-slate-100 bg-white overflow-x-auto">
          {slots.map((s) => {
            const isSelected = s.name === activeTab;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => setActiveTab(s.name)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{s.emoji}</span>
                <span>{s.name}</span>
                {s.tamilDisplayName && (
                  <span className={`text-[10px] font-normal ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                    ({s.tamilDisplayName})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Body: Active Slot Editor */}
        {currentSlot && (
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
            
            {/* Slot Header Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shadow-2xs">
                  {currentSlot.emoji}
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    {currentSlot.name}
                    {currentSlot.tamilDisplayName && (
                      <span className="text-slate-500 font-bold text-sm ml-2">
                        / {currentSlot.tamilDisplayName}
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Configure daily menu items and serving window for {currentSlot.name}.
                  </p>
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center space-x-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={currentSlot.isActive !== false}
                  onChange={(e) => handleUpdateSlot(currentSlot.name, 'isActive', e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Active Slot</span>
              </label>
            </div>

            {/* Serving Timing (From - To) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Serving Start Time (From)</span>
                </label>
                <input
                  type="time"
                  value={currentSlot.startTime}
                  onChange={(e) => handleUpdateSlot(currentSlot.name, 'startTime', e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400">Example: 07:30 (Morning)</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Serving End Time (To)</span>
                </label>
                <input
                  type="time"
                  value={currentSlot.endTime}
                  onChange={(e) => handleUpdateSlot(currentSlot.name, 'endTime', e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400">Example: 10:30 (Morning)</span>
              </div>
            </div>

            {/* Tamil / English Food Menu Editor */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <Languages className="w-4 h-4 text-emerald-600" />
                  <span>Food Menu Items (தமிழ் அல்லது English-ல் டைப் செய்யவும்)</span>
                </label>
                <span className="text-[11px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Bilingual UTF-8 Ready
                </span>
              </div>

              <textarea
                rows={3}
                value={currentSlot.description}
                onChange={(e) => handleUpdateSlot(currentSlot.name, 'description', e.target.value)}
                placeholder="எ.கா: இட்லி, வடை, சாம்பார், காபி / Idli, Vada, Sambar, Filter Coffee"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white leading-relaxed font-sans"
              />

              {/* Quick Tamil Suggestion Tags */}
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Quick Tamil Dish Chips (Add with 1-click):</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(TAMIL_DISH_SUGGESTIONS[currentSlot.name] || TAMIL_DISH_SUGGESTIONS.Breakfast).map((dish) => (
                    <button
                      key={dish}
                      type="button"
                      onClick={() => handleAppendTamilDish(dish)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs font-medium border border-slate-200 transition-colors active:scale-95 cursor-pointer"
                    >
                      + {dish}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Meal Cost / Rate */}
            <div className="flex items-center space-x-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-2xs font-mono">
                ₹
              </div>
              <div className="flex-1 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-bold text-slate-900 block">Meal Cost / Rate (விலை):</span>
                  <span className="text-xs text-emerald-800 font-medium">Price printed on thermal receipt slip</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-base font-bold text-slate-700 font-mono">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={currentSlot.rate ?? currentSlot.cost ?? 40}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      handleUpdateSlot(currentSlot.name, 'rate', val);
                      handleUpdateSlot(currentSlot.name, 'cost', val);
                    }}
                    className="w-28 bg-white border border-emerald-300 rounded-xl px-3 py-2 text-base font-mono font-black text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50">
          <div>
            {isSaved && (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Saved & updated live on Kiosk!</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save & Update Kiosk Menu</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
