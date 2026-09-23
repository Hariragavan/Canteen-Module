import React, { useState, useEffect, useMemo } from 'react';
import type { Order } from '../../types';
import { canteenService } from '../../services/canteenService';
import { supabaseManager } from '../../services/supabase';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Filler,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  TrendingUp,
  Download,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
} from 'lucide-react';

// Register ChartJS modules
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Filler
);

export const KitchenAnalyticsView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedMeal, setSelectedMeal] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const refreshData = () => {
    setOrders(canteenService.getOrders());
  };

  useEffect(() => {
    refreshData();
    const unsub = supabaseManager.onRealtimeChange(() => {
      refreshData();
    });
    return () => unsub();
  }, []);

  // Filter orders by date range: fromDate to toDate
  const dateOrders = useMemo(() => {
    return orders.filter((o) => {
      if (fromDate && o.dateStr < fromDate) return false;
      if (toDate && o.dateStr > toDate) return false;
      return true;
    });
  }, [orders, fromDate, toDate]);

  // Compute KPI metrics for selected date range
  const totalIssued = dateOrders.length;
  const totalServed = dateOrders.filter((o) => o.status === 'SERVED').length;
  const inQueue = totalIssued - totalServed;
  const collectionRate = totalIssued > 0 ? Math.round((totalServed / totalIssued) * 100) : 0;
  
  // Total Revenue / Token Amount
  const totalRevenue = useMemo(() => {
    return dateOrders.reduce((sum, o) => {
      const rate = o.rate ?? 40;
      const qty = o.qty ?? 1;
      return sum + rate * qty;
    }, 0);
  }, [dateOrders]);

  // Meal counts for Donut Chart (based on 3 slots: Tiffin, Lunch, Tea/Snacks)
  const mealCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Tiffin: 0,
      Lunch: 0,
      'Tea/Snacks': 0,
    };
    dateOrders.forEach((o) => {
      const lower = (o.meal || '').toLowerCase();
      if (lower.includes('tiffin') || lower.includes('breakfast')) {
        counts.Tiffin = (counts.Tiffin || 0) + 1;
      } else if (lower.includes('lunch')) {
        counts.Lunch = (counts.Lunch || 0) + 1;
      } else {
        counts['Tea/Snacks'] = (counts['Tea/Snacks'] || 0) + 1;
      }
    });
    return counts;
  }, [dateOrders]);

  // Donut Chart Data & Options
  const doughnutData = {
    labels: ['Tiffin', 'Lunch', 'Tea/Snacks'],
    datasets: [
      {
        data: [
          mealCounts.Tiffin || 0,
          mealCounts.Lunch || 0,
          mealCounts['Tea/Snacks'] || 0,
        ],
        backgroundColor: ['#f59e0b', '#059669', '#0284c7'],
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          font: { size: 11, weight: 'bold' as const },
        },
      },
    },
    cutout: '70%',
  };

  // Hourly Traffic distribution
  const hourlyData = useMemo(() => {
    const hours = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const counts = new Array(hours.length).fill(0);

    dateOrders.forEach((o) => {
      if (o.issuedAt) {
        const parts = o.issuedAt.split(':');
        const h = parseInt(parts[0], 10);
        let hour24 = h;
        if (o.issuedAt.toLowerCase().includes('pm') && h < 12) hour24 += 12;
        if (o.issuedAt.toLowerCase().includes('am') && h === 12) hour24 = 0;

        const idx = hours.findIndex(slot => parseInt(slot.split(':')[0], 10) === hour24);
        if (idx !== -1) counts[idx]++;
      }
    });

    return {
      labels: hours,
      datasets: [
        {
          label: 'Tokens Issued',
          data: counts,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#10b981',
        },
      ],
    };
  }, [dateOrders]);

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { stepSize: 1, font: { size: 10 } },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 } },
      },
    },
  };

  // Filtered orders table
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return dateOrders.filter((o) => {
      const matchQuery =
        !q ||
        o.name.toLowerCase().includes(q) ||
        o.userId.toLowerCase().includes(q) ||
        String(o.token).includes(q) ||
        o.orderUuid.toLowerCase().includes(q);

      const matchDept =
        selectedDept === 'ALL' ||
        (o.dept ? o.dept.trim().toLowerCase() === selectedDept.toLowerCase() : false);
      const matchMeal =
        selectedMeal === 'ALL' ||
        o.meal === selectedMeal ||
        (selectedMeal === 'Tiffin' && (o.meal === 'Tiffin' || o.meal === 'Breakfast')) ||
        (selectedMeal === 'Tea/Snacks' && (o.meal === 'Tea/Snacks' || (o.meal as string) === 'Tea' || o.meal === 'Snacks' || o.meal === 'Tea or Coffee'));
      const matchStatus = selectedStatus === 'ALL' || o.status === selectedStatus;

      return matchQuery && matchDept && matchMeal && matchStatus;
    });
  }, [dateOrders, searchQuery, selectedDept, selectedMeal, selectedStatus]);

  const handleExportCSV = () => {
    canteenService.exportAuditCSV(fromDate, toDate);
  };

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
    <div className="w-full flex flex-col gap-6">
      {/* Top Header & Fast Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Canteen Operations & Analytics
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Feed Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time meal consumption telemetry, queue velocity, and audit clearance ledger.
          </p>
        </div>

        {/* Date Range Selector and Download CSV Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* From - To Date Range */}
          <div className="flex flex-wrap items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-bold text-slate-600">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-600">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => handleSetQuickDate('today')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                fromDate === todayStr && toDate === todayStr
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleSetQuickDate('yesterday')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => handleSetQuickDate('week')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => handleSetQuickDate('all')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            >
              All
            </button>
          </div>

          {/* Download CSV for selected date range */}
          <button
            onClick={handleExportCSV}
            title="Download CSV for selected date range"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center space-x-1.5 active:scale-95 cursor-pointer ml-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Metrics: Includes Total Revenue / Token Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Issued */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Tokens Issued
            </p>
            <h3 className="text-3xl font-black text-slate-900 mt-1 font-mono">{totalIssued}</h3>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{fromDate === toDate ? fromDate : `${fromDate || 'Beginning'} → ${toDate}`}</span>
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Served */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Meals Served</p>
            <h3 className="text-3xl font-black text-emerald-700 mt-1 font-mono">{totalServed}</h3>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              <strong className="text-emerald-700 font-bold">{collectionRate}%</strong> collection rate
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: In Queue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">In Queue (Pending)</p>
            <h3 className="text-3xl font-black text-amber-600 mt-1 font-mono">{inQueue}</h3>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              Waiting for counter pickup
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4: Total Token Value / Amount (₹) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Value / Rate</p>
            <h3 className="text-3xl font-black text-emerald-800 mt-1 font-mono">
              ₹{totalRevenue.toLocaleString()}
            </h3>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <span>Gross token value for selected range</span>
            </p>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl border border-emerald-300 font-black text-lg">
            ₹
          </div>
        </div>
      </div>

      {/* Interactive Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Donut Intake Breakdown (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Meal Slot Share (3 Slots)</h4>
            <p className="text-xs text-slate-500 mt-0.5">Tiffin, Lunch, and Tea/Snacks distribution</p>
          </div>
          <div className="h-64 relative flex items-center justify-center my-2">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
          <div className="text-[11px] text-slate-500 text-center font-mono pt-2 border-t border-slate-100">
            Real-time multi-slot demand breakdown
          </div>
        </div>

        {/* Chart 2: Hourly Traffic Velocity Curve (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Hourly Consumption Velocity</h4>
            <p className="text-xs text-slate-500 mt-0.5">Token issuance activity across operational hours</p>
          </div>
          <div className="h-64 my-2">
            <Line data={hourlyData} options={lineOptions} />
          </div>
          <div className="text-[11px] text-slate-500 text-center font-mono pt-2 border-t border-slate-100 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Live token timestamps</span>
          </div>
        </div>
      </div>

      {/* Audit Clearance Ledger Table with Rate, Qty & Total Amount */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 text-base">Audit Clearance Ledger</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed records including Rate, Quantity, and Total Amount for each token.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, ID, or Token..."
                className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              <option value="Staff">Staff</option>
              <option value="Employee">Employee</option>
            </select>

            <select
              value={selectedMeal}
              onChange={(e) => setSelectedMeal(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Meals</option>
              <option value="Tiffin">Tiffin</option>
              <option value="Lunch">Lunch</option>
              <option value="Tea/Snacks">Tea/Snacks</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="SERVED">Served</option>
              <option value="PRINTED">Printed (Queue)</option>
            </select>
          </div>
        </div>

        {/* Ledger Table with Bordered Container and Internal Scroll */}
        <div className="border-2 border-slate-300 rounded-2xl overflow-y-auto overflow-x-auto max-h-[440px] shadow-inner bg-white">
          <table className="w-full text-left text-xs text-slate-700 relative">
            <thead className="sticky top-0 z-10 text-slate-800 uppercase bg-slate-100 font-mono text-[10px] border-b-2 border-slate-300 shadow-xs">
              <tr>
                <th className="p-3 bg-slate-100">Token</th>
                <th className="p-3 bg-slate-100">Date</th>
                <th className="p-3 bg-slate-100">Employee</th>
                <th className="p-3 bg-slate-100">Department</th>
                <th className="p-3 bg-slate-100">Meal Slot</th>
                <th className="p-3 bg-slate-100 text-right">Rate</th>
                <th className="p-3 bg-slate-100 text-center">Qty</th>
                <th className="p-3 bg-slate-100 text-right">Total</th>
                <th className="p-3 bg-slate-100">Menu Items</th>
                <th className="p-3 bg-slate-100">Issued Time</th>
                <th className="p-3 bg-slate-100">Served Time</th>
                <th className="p-3 bg-slate-100">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-xs text-slate-400 italic">
                    No orders recorded for the selected date range matching filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const itemSummary = Array.isArray(o.items) && o.items.length > 0
                    ? o.items.map(it => (typeof it === 'string' ? it : it?.description || it?.name || '')).join(', ')
                    : 'Standard Meal';
                  const rateVal = o.rate ?? 40;
                  const qtyVal = o.qty ?? 1;
                  const total = rateVal * qtyVal;
                  return (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        #{o.token}
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {o.dateStr}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{o.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{o.userId}</div>
                      </td>
                      <td className="p-3 text-slate-600">{o.dept}</td>
                      <td className="p-3 font-semibold text-slate-900">{o.meal}</td>
                      <td className="p-3 font-mono font-bold text-slate-900 text-right">
                        ₹{rateVal}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-700 text-center">
                        {qtyVal}
                      </td>
                      <td className="p-3 font-mono font-black text-emerald-800 text-right">
                        ₹{total}
                      </td>
                      <td className="p-3 text-slate-600 max-w-[180px] truncate" title={itemSummary}>
                        {itemSummary}
                      </td>
                      <td className="p-3 font-mono text-slate-500">{o.issuedAt}</td>
                      <td className="p-3 font-mono text-slate-500">
                        {o.servedAt || <span className="text-amber-600 italic">In Queue</span>}
                      </td>
                      <td className="p-3">
                        {o.status === 'SERVED' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            SERVED
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            PRINTED
                          </span>
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
  );
};
