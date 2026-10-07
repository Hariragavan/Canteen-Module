import React, { useState, useEffect, useMemo } from 'react';
import type { MealFeedback, MealSlotName } from '../../types';
import { canteenService } from '../../services/canteenService';
import { supabaseManager } from '../../services/supabase';
import {
  Star,
  MessageSquareHeart,
  Calendar,
  Download,
  Trash2,
  RefreshCw,
  Quote,
  MessageCircle,
  ThumbsUp,
} from 'lucide-react';

export const FeedbackReviewView: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<MealFeedback[]>([]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>(todayStr);
  const [selectedMeal, setSelectedMeal] = useState<string>('ALL');
  const [selectedRating, setSelectedRating] = useState<string>('ALL');
  const [onlyWithComments, setOnlyWithComments] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadFeedbacks = () => {
    setFeedbacks(canteenService.getFeedbacks());
  };

  useEffect(() => {
    loadFeedbacks();
    const unsub = supabaseManager.onRealtimeChange((event) => {
      if (event.table === 'canteen_feedback') {
        loadFeedbacks();
      }
    });
    return () => unsub();
  }, []);

  // Filtered feedbacks
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((fb) => {
      if (fromDate && fb.dateStr < fromDate) return false;
      if (toDate && fb.dateStr > toDate) return false;
      if (selectedMeal !== 'ALL' && fb.mealSlot !== selectedMeal) return false;
      if (selectedRating !== 'ALL') {
        const r = parseInt(selectedRating, 10);
        if (selectedRating === 'LOW' && (fb.rating > 2)) return false;
        if (selectedRating !== 'LOW' && fb.rating !== r) return false;
      }
      if (onlyWithComments && (!fb.comment || !fb.comment.trim())) return false;
      return true;
    });
  }, [feedbacks, fromDate, toDate, selectedMeal, selectedRating, onlyWithComments]);

  // Overall Statistics
  const totalCount = filteredFeedbacks.length;
  const avgRating = totalCount > 0
    ? (filteredFeedbacks.reduce((sum, f) => sum + f.rating, 0) / totalCount).toFixed(1)
    : '0.0';

  const positiveCount = filteredFeedbacks.filter((f) => f.rating >= 4).length;
  const positivePercentage = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0;

  const withCommentCount = filteredFeedbacks.filter((f) => f.comment && f.comment.trim().length > 0).length;

  // Star breakdown counts
  const starCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    filteredFeedbacks.forEach((f) => {
      const r = Math.min(Math.max(f.rating, 1), 5) as 1 | 2 | 3 | 4 | 5;
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [filteredFeedbacks]);

  // Star color helper
  const getStarClasses = (ratingVal: number, starIdx: number) => {
    const isFilled = starIdx <= ratingVal;
    if (!isFilled) {
      return 'fill-transparent stroke-slate-300 stroke-[2] text-slate-300';
    }
    if (ratingVal === 5) {
      return 'fill-amber-600 stroke-amber-700 text-amber-600';
    }
    if (ratingVal === 3 || ratingVal === 4) {
      return 'fill-emerald-700 stroke-emerald-800 text-emerald-700';
    }
    return 'fill-rose-700 stroke-rose-800 text-rose-700';
  };

  const getSlotEmoji = (slot: MealSlotName) => {
    switch (slot) {
      case 'Tiffin':
        return '🥞';
      case 'Lunch':
        return '🍛';
      case 'Tea/Snacks':
        return '☕';
      default:
        return '🍽️';
    }
  };

  const handleDeleteFeedback = async (id?: string) => {
    if (!id) return;
    await canteenService.deleteFeedback(id);
    setDeleteConfirmId(null);
    loadFeedbacks();
  };

  const handleExportCSV = () => {
    if (filteredFeedbacks.length === 0) {
      alert('No feedback records to export.');
      return;
    }

    const headers = ['DATE', 'TIME', 'PARTICULAR', 'RATING (STARS)', 'COMMENT'];
    const rows = filteredFeedbacks.map((f) => {
      const timeStr = new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return [
        `"${f.dateStr}"`,
        `"${timeStr}"`,
        `"${f.mealSlot}"`,
        f.rating,
        `"${(f.comment || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Canteen_Feedback_Reviews_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full flex flex-col gap-6 select-none animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Feedback Review & Rating Analysis
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                உணவு கருத்துக்கணிப்பு & ஊழியர்களின் விமர்சனங்கள் (Simple & Neat Overview)
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadFeedbacks}
            className="p-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
            title="Refresh Feedbacks"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-700/20 flex items-center space-x-2 transition-all active:scale-95 cursor-pointer"
            title="Export feedback review to CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        
        {/* 1. Average Rating */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
              Average Rating
            </span>
            <div className="p-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <Star className="w-4 h-4 fill-amber-500 stroke-amber-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {avgRating}
            </span>
            <span className="text-xs text-slate-400 font-medium">/ 5.0</span>
          </div>
          <div className="flex items-center space-x-1 mt-1 text-amber-600">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${
                  i <= Math.round(Number(avgRating))
                    ? 'fill-amber-500 stroke-amber-600'
                    : 'stroke-slate-300 fill-slate-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 2. Total Feedbacks */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
              Total Feedbacks
            </span>
            <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <MessageCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {totalCount}
            </span>
            <span className="text-xs text-slate-400 ml-1.5 font-medium">Entries</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 truncate">
            Based on current filters
          </span>
        </div>

        {/* 3. Positive Satisfaction % */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
              Positive Sentiment
            </span>
            <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ThumbsUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
              {positivePercentage}%
            </span>
            <span className="text-xs text-slate-400 ml-1.5 font-medium">Satisfied</span>
          </div>
          <span className="text-[11px] text-emerald-800 mt-1 font-medium">
            {positiveCount} of {totalCount} rated 4★ or 5★
          </span>
        </div>

        {/* 4. With Comments */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
              Written Comments
            </span>
            <div className="p-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
              <Quote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {withCommentCount}
            </span>
            <span className="text-xs text-slate-400 ml-1.5 font-medium">Suggestions</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">
            Employees with notes
          </span>
        </div>

      </div>

      {/* Ratings Distribution Progress Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
            Rating Distribution Breakdown (மதிப்பீட்டு விபரம்)
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Total {totalCount} Responses
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = starCounts[stars as keyof typeof starCounts];
            const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            const barBg =
              stars === 5
                ? 'bg-amber-500'
                : stars >= 3
                ? 'bg-emerald-600'
                : 'bg-rose-500';

            return (
              <div key={stars} className="flex flex-col gap-1 p-2 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <span>{stars}</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                  </span>
                  <span className="font-mono font-bold text-slate-600">{count} ({pct}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barBg} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Quick Date Presets & Date Pickers */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-600">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="font-bold">Date:</span>
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

          <button
            type="button"
            onClick={() => {
              setFromDate(todayStr);
              setToDate(todayStr);
            }}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              setFromDate('');
              setToDate(todayStr);
            }}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            All Time
          </button>
        </div>

        {/* Right: Dropdowns for Food Slot & Rating */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Meal Slot Filter */}
          <select
            value={selectedMeal}
            onChange={(e) => setSelectedMeal(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Food Types</option>
            <option value="Tiffin">🥞 Tiffin (காலை உணவு)</option>
            <option value="Lunch">🍛 Lunch (மதிய உணவு)</option>
            <option value="Tea/Snacks">☕ Tea/Snacks (தேநீர் & ஸ்நாக்ஸ்)</option>
          </select>

          {/* Rating Filter */}
          <select
            value={selectedRating}
            onChange={(e) => setSelectedRating(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Ratings</option>
            <option value="5">5 Stars (Outstanding)</option>
            <option value="4">4 Stars (Very Good)</option>
            <option value="3">3 Stars (Good)</option>
            <option value="LOW">1 & 2 Stars (Needs Improvement)</option>
          </select>

          {/* Only with comments checkbox */}
          <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={onlyWithComments}
              onChange={(e) => setOnlyWithComments(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>With Comments Only</span>
          </label>
        </div>

      </div>

      {/* Feedbacks Grid / List */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold text-slate-700">
            Reviews & Feedback Cards ({filteredFeedbacks.length} found)
          </span>
        </div>

        {filteredFeedbacks.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl py-14 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2.5">
              <MessageSquareHeart className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">No Feedback Records Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              No feedback entries match your date range or filters. Feedback submitted by employees at the kiosk will appear here live.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredFeedbacks.map((fb, idx) => {
              const formattedTime = new Date(fb.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const is5Star = fb.rating === 5;
              const isLowStar = fb.rating <= 2;

              return (
                <div
                  key={fb.id || idx}
                  className={`bg-white rounded-2xl border p-4 shadow-2xs flex flex-col justify-between transition-all hover:shadow-sm ${
                    is5Star
                      ? 'border-amber-200/80 bg-linear-to-b from-amber-50/20 to-white'
                      : isLowStar
                      ? 'border-rose-200/80 bg-linear-to-b from-rose-50/20 to-white'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top card bar: Meal badge & date/time */}
                  <div>
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">{getSlotEmoji(fb.mealSlot)}</span>
                        <span className="text-xs font-bold text-slate-900">
                          {fb.mealSlot}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-mono">
                        <span>{fb.dateStr}</span>
                        <span>•</span>
                        <span>{formattedTime}</span>
                      </div>
                    </div>

                    {/* Star Rating Display */}
                    <div className="flex items-center justify-between my-3">
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((starIdx) => (
                          <Star
                            key={starIdx}
                            className={`w-5 h-5 transition-colors ${getStarClasses(fb.rating, starIdx)}`}
                          />
                        ))}
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          is5Star
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : isLowStar
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {fb.rating} / 5 Stars
                      </span>
                    </div>

                    {/* Employee Written Comment */}
                    <div className="my-1">
                      {fb.comment && fb.comment.trim().length > 0 ? (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-800 leading-relaxed relative flex items-start space-x-2">
                          <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <p className="italic font-medium">{fb.comment}</p>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic py-1 px-1">
                          (No written comment provided)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom: Delete Action */}
                  <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-[10px]">
                      {fb.id ? `#${fb.id.slice(-6)}` : ''}
                    </span>

                    {deleteConfirmId === fb.id ? (
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteFeedback(fb.id)}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                        >
                          Confirm Delete
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
                        onClick={() => setDeleteConfirmId(fb.id || null)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                        title="Delete this feedback entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
