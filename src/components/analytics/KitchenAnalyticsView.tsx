import React, { useState, useEffect, useMemo } from 'react';
import type { Order, MealSlotName } from '../../types';
import { canteenService } from '../../services/canteenService';
import { supabaseManager } from '../../services/supabase';
import { soundEngine } from '../../services/soundEngine';
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
  RotateCcw,
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

  // Compute KPI metrics
  const totalIssued = orders.length;
  const totalServed = orders.filter((o) => o.status === 'SERVED').length;
  const inQueue = totalIssued - totalServed;
  const collectionRate = totalIssued > 0 ? Math.round((totalServed / totalIssued) * 100) : 0;
  const wastageOrUnclaimedRate = totalIssued > 0 ? (100 - collectionRate) : 0;

  // Meal counts for Donut Chart
  const mealCounts = useMemo(() => {
    const counts: Record<MealSlotName, number> = {
      Breakfast: 0,
      Lunch: 0,
      'Tea & Snacks': 0,
      Tea: 0,
      Snacks: 0,
      Dinner: 0,
    };
    orders.forEach((o) => {
      if (counts[o.meal] !== undefined) {
        counts[o.meal]++;
      }
    });
    return counts;
  }, [orders]);

  // Donut Chart Data & Options
  const doughnutData = {
    labels: ['Breakfast', 'Lunch', 'Tea & Snacks', 'Dinner'],
    datasets: [
      {
        data: [
          mealCounts.Breakfast,
          mealCounts.Lunch,
          mealCounts['Tea & Snacks'] + mealCounts.Tea + mealCounts.Snacks,
          mealCounts.Dinner,
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

  // Line Chart Data & Options
  const lineData = {
    labels: ['08:00 AM', '10:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '04:00 PM', '05:30 PM', '08:00 PM'],
    datasets: [
      {
        label: 'Dispensed Queue Volume',
        data: [18, 14, 68, 85, 42, 35, 28, 54],
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

  // Filtered Audit Ledger
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return orders.filter((o) => {
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
  }, [orders, searchQuery, selectedDept, selectedMeal, selectedStatus]);

  // Actions
  const handleResetData = () => {
    soundEngine.playWarningBuzzer();
    canteenService.resetAllData();
    refreshData();
  };

  const handleExportCSV = () => {
    canteenService.exportAuditCSV();
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

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs rounded-xl transition-colors shadow-2xs flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleResetData}
            title="Reset to initial seed records"
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Issued Today</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1 font-mono">{totalIssued}</h3>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>↑ 14% vs normal run rate</span>
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
                <th className="p-3">Issued Time</th>
                <th className="p-3">Served Time</th>
                <th className="p-3 rounded-r">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-xs text-slate-400 italic">
                    No orders match the current search or filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
