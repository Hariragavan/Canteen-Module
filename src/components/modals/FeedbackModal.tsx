import React, { useState, useEffect } from 'react';
import { X, Star, CheckCircle2, MessageSquareHeart } from 'lucide-react';
import type { MealSlotName } from '../../types';
import { canteenService } from '../../services/canteenService';
import { soundEngine } from '../../services/soundEngine';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSlot?: MealSlotName;
}

const FOOD_TYPES: { id: MealSlotName; label: string; tamil: string; emoji: string }[] = [
  { id: 'Tiffin', label: 'Tiffin', tamil: 'காலை உணவு', emoji: '🥞' },
  { id: 'Lunch', label: 'Lunch', tamil: 'மதிய உணவு', emoji: '🍛' },
  { id: 'Tea/Snacks', label: 'Tea/Snacks', tamil: 'தேநீர் & ஸ்நாக்ஸ்', emoji: '☕' },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  defaultSlot = 'Lunch',
}) => {
  const [selectedSlot, setSelectedSlot] = useState<MealSlotName>(defaultSlot);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(10);

  // 10-second auto-close timer when opened
  useEffect(() => {
    if (!isOpen) {
      setRemainingSeconds(10);
      return;
    }

    setRemainingSeconds(10);
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const effectiveRating = hoverRating || rating;

  // Star styling strictly as requested:
  // - Dark solid colors without shadows/shades
  // - 5th star: Dark Gold
  // - 3 or 4: Dark Green
  // - 1 or 2: Dark Red
  // - Blank: White fill with dark border
  const getStarClasses = (starIndex: number) => {
    const isFilled = starIndex <= effectiveRating;
    if (!isFilled) {
      return 'fill-white stroke-slate-400 stroke-[2] text-transparent hover:scale-105';
    }

    if (effectiveRating === 5) {
      // 5th star: Dark Gold (No drop-shadow / shades)
      return 'fill-amber-600 stroke-amber-700 text-amber-600';
    }
    if (effectiveRating === 3 || effectiveRating === 4) {
      // 3 or 4: Dark Green (No drop-shadow / shades)
      return 'fill-emerald-700 stroke-emerald-800 text-emerald-700';
    }
    // 1 or 2: Dark Red (No drop-shadow / shades)
    return 'fill-rose-700 stroke-rose-800 text-rose-700';
  };

  const getRatingLabel = () => {
    switch (effectiveRating) {
      case 5:
        return { text: 'Outstanding Quality & Taste! / அருமையான சுவை', color: 'text-amber-700 font-black' };
      case 4:
        return { text: 'Very Good & Fresh / மிக நன்று', color: 'text-emerald-800 font-bold' };
      case 3:
        return { text: 'Good & Satisfying / நன்று', color: 'text-emerald-700 font-bold' };
      case 2:
        return { text: 'Fair / சுமாரானது', color: 'text-rose-700 font-medium' };
      case 1:
        return { text: 'Needs Improvement / மேம்படுத்த வேண்டும்', color: 'text-rose-800 font-semibold' };
      default:
        return { text: 'Select rating stars / மதிப்பீட்டை தேர்வு செய்யவும்', color: 'text-slate-500 font-medium' };
    }
  };

  const handleSelectStar = (val: number) => {
    soundEngine.playSelectSound();
    setRating(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;

    soundEngine.playVerificationChime();
    setIsSubmitted(true);

    await canteenService.submitFeedback({
      mealSlot: selectedSlot,
      rating,
      comment: '',
      timestamp: Date.now(),
      dateStr: new Date().toISOString().slice(0, 10),
    });

    setTimeout(() => {
      setIsSubmitted(false);
      setRating(0);
      onClose();
    }, 1200);
  };

  const ratingLabel = getRatingLabel();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border-2 border-emerald-600/40 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-700 text-white shadow-xs">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Food Feedback & Review
              </h3>
              <p className="text-[11px] text-slate-500">
                உணவு கருத்துக்கணிப்பு மற்றும் மதிப்பீடு
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {remainingSeconds}s
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isSubmitted ? (
          <div className="p-8 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-lg font-black text-slate-900">
              Thank You for Your Feedback!
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs font-sans">
              உங்கள் கருத்து பதிவு செய்யப்பட்டது. தரத்தை மேம்படுத்த இது உதவும்.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            {/* Step 1: Food Type Selection */}
            <div>
              <label className="text-xs font-bold text-slate-800 uppercase tracking-tight block mb-2">
                1. Select Food Type / உணவு வகை:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FOOD_TYPES.map((ft) => {
                  const isSelected = selectedSlot === ft.id;
                  return (
                    <button
                      key={ft.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playSelectSound();
                        setSelectedSlot(ft.id);
                      }}
                      className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold shadow-xs scale-[1.02]'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span className="text-2xl mb-1">{ft.emoji}</span>
                      <span className="text-xs font-bold leading-tight">{ft.label}</span>
                      <span className="text-[10px] text-slate-500 font-sans mt-0.5">{ft.tamil}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: 5-Star Rating (Dark Solid Colors, No Shades) */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-tight mb-2">
                2. Rate Your Meal Experience:
              </label>

              {/* 5 Stars with solid dark colors and no drop-shadow */}
              <div className="flex items-center space-x-2 sm:space-x-3 my-2">
                {[1, 2, 3, 4, 5].map((starIndex) => (
                  <button
                    key={starIndex}
                    type="button"
                    onClick={() => handleSelectStar(starIndex)}
                    onMouseEnter={() => setHoverRating(starIndex)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform active:scale-95 cursor-pointer"
                    title={`${starIndex} Star`}
                  >
                    <Star className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${getStarClasses(starIndex)}`} />
                  </button>
                ))}
              </div>

              {/* Dynamic feedback text */}
              <p className={`text-xs mt-2 transition-all ${ratingLabel.color}`}>
                {ratingLabel.text}
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={rating === 0}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-800/20 transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
            >
              Submit Feedback (கருத்தை அனுப்பவும்)
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
