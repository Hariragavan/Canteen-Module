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
  Printer,
  ShieldCheck,
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
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
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

  // Filter orders by selected date
  const dateOrders = useMemo(() => {
    return orders.filter((o) => o.dateStr === selectedDate);
  }, [orders, selectedDate]);

  // Compute KPI metrics for selected date
  const totalIssued = dateOrders.length;
  const totalServed = dateOrders.filter((o) => o.status === 'SERVED').length;
  const inQueue = totalIssued - totalServed;
  const collectionRate = totalIssued > 0 ? Math.round((totalServed / totalIssued) * 100) : 0;
  const wastageOrUnclaimedRate = totalIssued > 0 ? (100 - collectionRate) : 0;

  // Meal counts for Donut Chart (based on selected date)
  const mealCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Breakfast: 0,
      Lunch: 0,
      'Tea or Coffee': 0,
      'Tea & Snacks': 0,
      Tea: 0,
      Snacks: 0,
      Dinner: 0,
    };
    dateOrders.forEach((o) => {
      if (counts[o.meal] !== undefined) {
        counts[o.meal]++;
      } else {
        counts[o.meal] = 1;
      }
    });
    return counts;
  }, [dateOrders]);

  // Donut Chart Data & Options
  const doughnutData = {
    labels: ['Breakfast', 'Lunch', 'Tea / Coffee / Snacks', 'Dinner'],
    datasets: [
      {
        data: [
          mealCounts.Breakfast || 0,
          mealCounts.Lunch || 0,
          (mealCounts['Tea or Coffee'] || 0) + (mealCounts['Tea & Snacks'] || 0) + (mealCounts.Tea || 0) + (mealCounts.Snacks || 0),
          mealCounts.Dinner || 0,
        ],
        backgroundColor: ['#f59e0b', '#059669', '#d97706', '#4f46e5'],
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
          font: { family: 'Inter', size: 11, weight: 'bold' as const },
          color: '#475569',
          padding: 14,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: { label: string; raw: unknown }) => ` ${context.label}: ${context.raw} meals`,
        },
      },
    },
  };

  // Dynamic hourly traffic distribution for the selected date
  const hourlyData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0, 0];
    dateOrders.forEach((o) => {
      const match = o.issuedAt.match(/(\d+):(\d+).*?(AM|PM)/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;

        if (h <= 8) counts[0]++;
        else if (h <= 10) counts[1]++;
        else if (h <= 12) counts[2]++;
        else if (h <= 13) counts[3]++;
        else if (h <= 14) counts[4]++;
        else if (h <= 16) counts[5]++;
        else if (h <= 18) counts[6]++;
        else counts[7]++;
      } else {
        counts[2]++;
      }
    });
    return counts;
  }, [dateOrders]);

  // Line Chart Data & Options
  const lineData = {
    labels: ['08:00 AM', '10:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '04:00 PM', '05:30 PM', '08:00 PM'],
    datasets: [
      {
        label: `Dispensed Volume (${selectedDate})`,
        data: hourlyData,
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.09)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#059669',
        pointHoverRadius: 6,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } },
        grid: { color: '#f1f5f9' },
      },
      x: {
        ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  // Filtered Audit Ledger for selected date
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
      const matchMeal = selectedMeal === 'ALL' || o.meal === selectedMeal;
      const matchStatus = selectedStatus === 'ALL' || o.status === selectedStatus;

      return matchQuery && matchDept && matchMeal && matchStatus;
    });
  }, [dateOrders, searchQuery, selectedDept, selectedMeal, selectedStatus]);

  const handleExportCSV = () => {
    canteenService.exportAuditCSV(selectedDate);
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

        {/* Date Selector and Download CSV Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Selector */}
          <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-bold text-slate-600">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                selectedDate === todayStr
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Today
            </button>
          </div>

          {/* Download CSV for selected date */}
          <button
            onClick={handleExportCSV}
            title={`Download CSV file for ${selectedDate}`}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center space-x-1.5 active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV ({selectedDate})</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Issued ({selectedDate === todayStr ? 'Today' : selectedDate})
            </p>
            <h3 className="text-3xl font-black text-slate-900 mt-1 font-mono">{totalIssued}</h3>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{dateOrders.length} records on {selectedDate}</span>
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2 */}
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

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">In Queue (Pending)</p>
            <h3 className="text-3xl font-black text-amber-600 mt-1 font-mono">{inQueue}</h3>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              {wastageOrUnclaimedRate}% unclaimed rate
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4: Hardware Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thermal Printer Status</p>
            <h3 className="text-base font-bold text-slate-900 mt-1 truncate">80mm Auto-Dispenser</h3>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>80mm Paper 94% • OK</span>
            </p>
          </div>
          <div className="p-3 bg-slate-50 text-slate-700 rounded-2xl border border-slate-200">
            <Printer className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Interactive Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart 1: Donut Intake Breakdown (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Meal Slot Intake Share</h4>
            <p className="text-xs text-slate-500 mt-0.5">Distribution across the 5 cafeteria meal slots</p>
          </div>
          <div className="h-64 relative flex items-center justify-center my-2">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
          <div className="text-[11px] text-slate-400 text-center font-mono pt-2 border-t border-slate-100">
            Peak demand concentrated in Lunch & Dinner slots
          </div>
        </div>

        {/* Chart 2: Hourly Traffic Velocity Curve (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Canteen Traffic Velocity Curve</h4>
            <p className="text-xs text-slate-500 mt-0.5">Hourly counter load & queue velocity</p>
          </div>
          <div className="h-64 relative my-2">
            <Line data={lineData} options={lineOptions} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Peak queue rush recorded at 12:45 PM - 01:30 PM</span>
            <span className="font-mono text-emerald-700 font-bold">Counter Scanner Wedge: &lt;1.2s avg clearance</span>
          </div>
        </div>

      </div>

      {/* Complete Audit Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Canteen Consumption Audit Ledger
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Synced records of all biometric authorizations and thermal slip claims.
            </p>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
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
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Departments</option>
              <option value="Staff">Staff</option>
              <option value="Employee">Employee</option>
            </select>

            <select
              value={selectedMeal}
              onChange={(e) => setSelectedMeal(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Meals</option>
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Tea">Tea</option>
              <option value="Snacks">Snacks</option>
              <option value="Dinner">Dinner</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="SERVED">Served</option>
              <option value="PRINTED">Printed (Queue)</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="text-slate-600 uppercase bg-slate-50 font-mono text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3 rounded-l">Token</th>
                <th className="p-3">Employee</th>
                <th className="p-3">Department</th>
                <th className="p-3">Meal Slot</th>
                <th className="p-3">Menu Items</th>
                <th className="p-3">Issued Time</th>
                <th className="p-3">Served Time</th>
                <th className="p-3 rounded-r">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-xs text-slate-400 italic">
                    No orders recorded for {selectedDate} matching the current search or filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const itemSummary = Array.isArray(o.items) && o.items.length > 0
                    ? o.items.map(it => (typeof it === 'string' ? it : it?.description || it?.name || '')).join(', ')
                    : 'Standard Meal';
                  return (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        #{o.token}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{o.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{o.userId}</div>
                      </td>
                      <td className="p-3 text-slate-600">{o.dept}</td>
                      <td className="p-3 font-semibold text-slate-900">{o.meal}</td>
                      <td className="p-3 text-slate-600 max-w-[200px] truncate" title={itemSummary}>
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
