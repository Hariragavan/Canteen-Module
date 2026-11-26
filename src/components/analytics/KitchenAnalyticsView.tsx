import React, { useState, useEffect, useMemo } from 'react';
import type { Order, PersonSpendingRow } from '../../types';
import { canteenService } from '../../services/canteenService';
import { apiClient } from '../../services/apiClient';
import { computePersonSpendingRows } from '../../services/reportExportService';
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
  FileSpreadsheet,
  FileText,
  X,
  Users,
  ListOrdered,
  Building2,
  Sparkles,
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

  // Tab View Mode: 'operations' (Real-time feed & ledger) vs 'personSpending' (Person-Wise Spending Analysis)
  const [activeTab, setActiveTab] = useState<'operations' | 'personSpending'>('operations');

  // Filters for Operations Ledger
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedMeal, setSelectedMeal] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Filters for Person-Wise Spending View
  const [personSearchQuery, setPersonSearchQuery] = useState<string>('');
  const [personDeptFilter, setPersonDeptFilter] = useState<string>('ALL');

  // Export Selection Modal State (Download Selected vs Download All)
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'CSV' | 'Excel' | 'PDF'>('Excel');

  const refreshData = () => {
    setOrders(canteenService.getOrders());
  };

  useEffect(() => {
    refreshData();
    const unsub = apiClient.subscribe(() => {
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

  // Meal counts for Donut Chart (including Dinner)
  const mealCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Tiffin: 0,
      Lunch: 0,
      'Tea/Snacks': 0,
      Dinner: 0,
    };
    dateOrders.forEach((o) => {
      const lower = (o.meal || '').toLowerCase();
      if (lower.includes('tiffin') || lower.includes('breakfast')) {
        counts.Tiffin = (counts.Tiffin || 0) + 1;
      } else if (lower.includes('lunch')) {
        counts.Lunch = (counts.Lunch || 0) + 1;
      } else if (lower.includes('dinner') || lower.includes('night')) {
        counts.Dinner = (counts.Dinner || 0) + 1;
      } else {
        counts['Tea/Snacks'] = (counts['Tea/Snacks'] || 0) + 1;
      }
    });
    return counts;
  }, [dateOrders]);

  // Donut Chart Data & Options
  const doughnutData = {
    labels: ['Tiffin', 'Lunch', 'Tea/Snacks', 'Dinner'],
    datasets: [
      {
        data: [
          mealCounts.Tiffin || 0,
          mealCounts.Lunch || 0,
          mealCounts['Tea/Snacks'] || 0,
          mealCounts.Dinner || 0,
        ],
        backgroundColor: ['#f59e0b', '#059669', '#0284c7', '#9333ea'],
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
    const hours = [
      '07:00',
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
      '19:00',
      '20:00',
      '21:00',
    ];
    const counts = new Array(hours.length).fill(0);

    dateOrders.forEach((o) => {
      if (o.issuedAt) {
        const parts = o.issuedAt.split(':');
        const h = parseInt(parts[0], 10);
        let hour24 = h;
        if (o.issuedAt.toLowerCase().includes('pm') && h < 12) hour24 += 12;
        if (o.issuedAt.toLowerCase().includes('am') && h === 12) hour24 = 0;

        const idx = hours.findIndex((slot) => parseInt(slot.split(':')[0], 10) === hour24);
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

  // Filtered orders table (Operations Ledger)
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
        (selectedMeal === 'Dinner' && o.meal === 'Dinner') ||
        (selectedMeal === 'Tea/Snacks' &&
          (o.meal === 'Tea/Snacks' ||
            (o.meal as string) === 'Tea' ||
            o.meal === 'Snacks' ||
            o.meal === 'Tea or Coffee'));
      const matchStatus = selectedStatus === 'ALL' || o.status === selectedStatus;

      return matchQuery && matchDept && matchMeal && matchStatus;
    });
  }, [dateOrders, searchQuery, selectedDept, selectedMeal, selectedStatus]);

  // Compute Person-Wise Spending Rows for the selected date range
  const allPersonRows = useMemo(() => {
    return computePersonSpendingRows(dateOrders);
  }, [dateOrders]);

  // Filter Person Rows by search query and department
  const filteredPersonRows: PersonSpendingRow[] = useMemo(() => {
    const q = personSearchQuery.toLowerCase().trim();
    return allPersonRows.filter((r) => {
      const matchQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.empId.toLowerCase().includes(q) ||
        r.dept.toLowerCase().includes(q);
      const matchDept =
        personDeptFilter === 'ALL' || r.dept.toLowerCase() === personDeptFilter.toLowerCase();
      return matchQ && matchDept;
    });
  }, [allPersonRows, personSearchQuery, personDeptFilter]);

  // Distinct departments for filter dropdown
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    dateOrders.forEach((o) => {
      if (o.dept && o.dept.trim()) set.add(o.dept.trim());
    });
    return Array.from(set).sort();
  }, [dateOrders]);

  // Person-wise Spending Grand Totals
  const totalTiffinAmount = filteredPersonRows.reduce((s, r) => s + r.tiffinAmount, 0);
  const totalLunchAmount = filteredPersonRows.reduce((s, r) => s + r.lunchAmount, 0);
  const totalSnacksAmount = filteredPersonRows.reduce((s, r) => s + r.snacksAmount, 0);
  const totalDinnerAmount = filteredPersonRows.reduce((s, r) => s + r.dinnerAmount, 0);
  const totalOverallAmount = filteredPersonRows.reduce((s, r) => s + r.totalAmount, 0);

  // Quick Date Presets: Including 1-Month, Last Month, Week, etc.
  const handleSetQuickDate = (
    preset: 'today' | 'yesterday' | 'week' | 'thisMonth' | 'lastMonth' | 'all'
  ) => {
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
    } else if (preset === 'thisMonth') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setFromDate(firstDay);
      setToDate(todayStr);
    } else if (preset === 'lastMonth') {
      const now = new Date();
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .slice(0, 10);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .slice(0, 10);
      setFromDate(firstDayLastMonth);
      setToDate(lastDayLastMonth);
    } else if (preset === 'all') {
      setFromDate('');
      setToDate(todayStr);
    }
  };

  // Open the Export Popup Dialog
  const handleOpenExportPopup = (format: 'CSV' | 'Excel' | 'PDF') => {
    setExportFormat(format);
    setIsExportModalOpen(true);
  };

  // Execute Export based on popup selection: 'selected' (regular form) vs 'all' (person-wise spending report)
  const handleExecuteExport = (mode: 'selected' | 'all') => {
    setIsExportModalOpen(false);

    if (mode === 'selected') {
      // Option A: Download Selected (Regular token-by-token transaction audit log)
      if (exportFormat === 'CSV') {
        canteenService.exportAuditCSV(fromDate, toDate, filteredOrders);
      } else if (exportFormat === 'Excel') {
        canteenService.exportAuditExcel(fromDate, toDate, filteredOrders);
      } else {
        canteenService.exportAuditPDF(fromDate, toDate, filteredOrders);
      }
    } else {
      // Option B: Download All (Person-wise spending summary with S.No, Token No/Emp ID, Name, Dept, Tiffin, Lunch, Snacks, Dinner, Total Amount)
      if (exportFormat === 'CSV') {
        canteenService.exportPersonSpendingCSV(fromDate, toDate, dateOrders);
      } else if (exportFormat === 'Excel') {
        canteenService.exportPersonSpendingExcel(fromDate, toDate, dateOrders);
      } else {
        canteenService.exportPersonSpendingPDF(fromDate, toDate, dateOrders);
      }
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 select-none animate-in fade-in duration-200">
      {/* =================================================================== */}
      {/* 1. TOP HEADER & FAST ACTION TOOLBAR                                 */}
      {/* =================================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/30">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Esstee Exports India Private Limited
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Canteen Operations, Consumption Telemetry & Personnel Spending Audit
                </p>
              </div>
            </div>
          </div>

          {/* Export Action Buttons with Popup Prompt */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline">Export:</span>

            <button
              type="button"
              onClick={() => handleOpenExportPopup('CSV')}
              title="Download Report in CSV format"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300/80 transition-all shadow-2xs flex items-center space-x-1.5 active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenExportPopup('Excel')}
              title="Download Report in Excel (.xlsx) format"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-emerald-600/30 flex items-center space-x-1.5 active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenExportPopup('PDF')}
              title="Download Report in PDF (.pdf) format"
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-rose-600/30 flex items-center space-x-1.5 active:scale-95 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-rose-100" />
              <span>PDF Report</span>
            </button>
          </div>
        </div>

        {/* Date Presets and Date Pickers Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>Period:</span>
            </span>

            <button
              type="button"
              onClick={() => handleSetQuickDate('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                fromDate === todayStr && toDate === todayStr
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => handleSetQuickDate('yesterday')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              Yesterday
            </button>

            <button
              type="button"
              onClick={() => handleSetQuickDate('week')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              7 Days
            </button>

            <button
              type="button"
              onClick={() => handleSetQuickDate('thisMonth')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer"
              title="1st of this month to today"
            >
              This Month (1 Mo.)
            </button>

            <button
              type="button"
              onClick={() => handleSetQuickDate('lastMonth')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              title="Full previous calendar month"
            >
              Last Month
            </button>

            <button
              type="button"
              onClick={() => handleSetQuickDate('all')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              All Records
            </button>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 shadow-2xs">
            <span className="text-xs font-bold text-slate-600">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* View Switcher: Operations vs Person-Wise Spending */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab('operations')}
            className={`py-2.5 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'operations'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Operations & Token Ledger ({filteredOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('personSpending')}
            className={`py-2.5 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'personSpending'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Person-Wise Spending Report ({filteredPersonRows.length} Persons)</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. 4 KPI SUMMARY CARDS                                              */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tokens Issued */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Tokens Issued
            </p>
            <h3 className="text-3xl font-black text-slate-900 mt-1 font-mono">{totalIssued}</h3>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{fromDate === toDate ? fromDate : `${fromDate || 'Start'} → ${toDate}`}</span>
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Served */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Particulars Served
            </p>
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
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active In Queue
            </p>
            <h3 className="text-3xl font-black text-amber-600 mt-1 font-mono">{inQueue}</h3>
            <p className="text-[11px] text-amber-700 font-medium mt-1">Waiting at pickup counter</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4: Total Value / Rate (₹) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Canteen Spend
            </p>
            <h3 className="text-3xl font-black text-emerald-800 mt-1 font-mono">
              ₹{totalRevenue.toLocaleString()}
            </h3>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1">
              Gross billing for selected range
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-2xl border border-emerald-300 font-black text-xl flex items-center justify-center">
            ₹
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. TAB A: REAL-TIME OPERATIONS & TOKEN LEDGER                       */}
      {/* =================================================================== */}
      {activeTab === 'operations' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          {/* Interactive Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Donut Chart: 4 Slots including Dinner */}
            <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Meal Share Breakdown</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tiffin, Lunch, Tea/Snacks, and Dinner distribution
                </p>
              </div>
              <div className="h-64 relative flex items-center justify-center my-2">
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
              <div className="text-[11px] text-slate-500 text-center font-mono pt-2 border-t border-slate-100">
                Multi-slot daily intake proportion
              </div>
            </div>

            {/* Line Chart: Hourly Traffic Velocity Curve */}
            <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Hourly Consumption Velocity</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Token issuance telemetry across operational hours
                </p>
              </div>
              <div className="h-64 my-2">
                <Line data={hourlyData} options={lineOptions} />
              </div>
              <div className="text-[11px] text-slate-500 text-center font-mono pt-2 border-t border-slate-100 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live token timestamps</span>
              </div>
            </div>
          </div>

          {/* Audit Clearance Ledger Table */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-base">Audit Clearance Ledger</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed transaction records with rate, quantity, and served verification.
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
                  {departmentOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedMeal}
                  onChange={(e) => setSelectedMeal(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">All Particulars</option>
                  <option value="Tiffin">🥞 Tiffin</option>
                  <option value="Lunch">🍛 Lunch</option>
                  <option value="Tea/Snacks">☕ Tea/Snacks</option>
                  <option value="Dinner">🌙 Dinner</option>
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

            {/* Ledger Table */}
            <div className="border border-slate-200 rounded-2xl overflow-y-auto overflow-x-auto max-h-[460px] shadow-2xs bg-white">
              <table className="w-full text-left text-xs text-slate-700 relative">
                <thead className="sticky top-0 z-10 text-slate-800 uppercase bg-slate-100 font-mono text-[10px] border-b border-slate-200 shadow-2xs">
                  <tr>
                    <th className="p-3 bg-slate-100 text-center">Date</th>
                    <th className="p-3 bg-slate-100 text-center">Emp ID</th>
                    <th className="p-3 bg-slate-100">Name</th>
                    <th className="p-3 bg-slate-100">Dept</th>
                    <th className="p-3 bg-slate-100 text-center">Particular</th>
                    <th className="p-3 bg-slate-100 text-right">Price</th>
                    <th className="p-3 bg-slate-100 text-center">Status</th>
                    <th className="p-3 bg-slate-100 text-center">Issued Time</th>
                    <th className="p-3 bg-slate-100 text-center">Served Time</th>
                    <th className="p-3 bg-slate-100 text-center">Token #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-xs text-slate-400 italic">
                        No orders recorded for the selected date range matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => {
                      const isServed = o.status === 'SERVED' || Boolean(o.servedAt);
                      const priceVal = (o.rate ?? 40) * (o.qty ?? 1);
                      return (
                        <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono text-slate-600 text-center whitespace-nowrap">
                            {o.dateStr}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800 text-center whitespace-nowrap">
                            {o.userId}
                          </td>
                          <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{o.name}</td>
                          <td className="p-3 text-slate-600 whitespace-nowrap">{o.dept}</td>
                          <td className="p-3 font-semibold text-slate-900 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                o.meal === 'Tiffin'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : o.meal === 'Lunch'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : o.meal === 'Dinner'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : 'bg-sky-50 text-sky-800 border-sky-200'
                              }`}
                            >
                              {o.meal}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900 text-right whitespace-nowrap">
                            ₹{priceVal}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            {isServed ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Served
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                In Queue
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-500 text-center whitespace-nowrap">
                            {o.issuedAt || '—'}
                          </td>
                          <td className="p-3 font-mono text-slate-500 text-center whitespace-nowrap">
                            {o.servedAt || '—'}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900 text-center whitespace-nowrap">
                            #{o.token}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {filteredOrders.length > 0 && (
                  <tfoot className="bg-slate-100/90 font-bold border-t border-slate-200">
                    <tr>
                      <td
                        colSpan={5}
                        className="p-3 text-slate-800 text-right uppercase tracking-wider text-xs"
                      >
                        Total Amount:
                      </td>
                      <td className="p-3 font-mono font-black text-emerald-800 text-right text-sm whitespace-nowrap">
                        ₹
                        {filteredOrders
                          .reduce((sum, o) => sum + (o.rate ?? 40) * (o.qty ?? 1), 0)
                          .toLocaleString()}
                      </td>
                      <td colSpan={4} className="p-3 text-slate-500 text-xs font-mono text-center">
                        ({filteredOrders.length} tokens recorded)
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. TAB B: PERSON-WISE SPENDING REPORT (PRINT ALL SECTION)           */}
      {/* =================================================================== */}
      {activeTab === 'personSpending' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col gap-4 animate-in fade-in duration-150">
          {/* Top Info Banner with Company Name & Date Range */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Person-Wise Canteen Spending Summary Report</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Company: <strong className="text-slate-800">Esstee Exports India Private Limited</strong> | Date Range: <strong className="text-emerald-800">{fromDate || 'Beginning'} to {toDate}</strong>
              </p>
            </div>

            {/* Quick stats badge */}
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                Personnel: <strong className="text-emerald-700">{filteredPersonRows.length}</strong>
              </span>
              <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
                Gross Spend: <strong>₹{totalOverallAmount.toLocaleString()}</strong>
              </span>
            </div>
          </div>

          {/* Table Filters: Search & Department Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={personSearchQuery}
                  onChange={(e) => setPersonSearchQuery(e.target.value)}
                  placeholder="Search Employee Name, ID, or Dept..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
                {personSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPersonSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={personDeptFilter}
                onChange={(e) => setPersonDeptFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-400">
              Showing {filteredPersonRows.length} of {allPersonRows.length} total active employees
            </span>
          </div>

          {/* Person-Wise Spending Summary Table */}
          <div className="border border-slate-200 rounded-2xl overflow-y-auto overflow-x-auto max-h-[500px] shadow-2xs bg-white">
            <table className="w-full text-left text-xs text-slate-700 relative">
              <thead className="sticky top-0 z-10 text-slate-800 uppercase bg-slate-100 font-mono text-[10px] border-b border-slate-200 shadow-2xs">
                <tr>
                  <th className="p-3 bg-slate-100 text-center w-12">S.No</th>
                  <th className="p-3 bg-slate-100 text-center w-28">Token No / Emp ID</th>
                  <th className="p-3 bg-slate-100">Name</th>
                  <th className="p-3 bg-slate-100">Dept</th>
                  <th className="p-3 bg-slate-100 text-right">Tiffin (₹)</th>
                  <th className="p-3 bg-slate-100 text-right">Lunch (₹)</th>
                  <th className="p-3 bg-slate-100 text-right">Snacks (₹)</th>
                  <th className="p-3 bg-slate-100 text-right">Dinner (₹)</th>
                  <th className="p-3 bg-slate-100 text-right font-black text-emerald-800">
                    Total Amount (₹)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredPersonRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-xs text-slate-400 italic">
                      No personnel records found for the selected date range.
                    </td>
                  </tr>
                ) : (
                  filteredPersonRows.map((r) => (
                    <tr key={r.empId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono text-slate-400 text-center whitespace-nowrap">
                        {r.sNo}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800 text-center whitespace-nowrap">
                        {r.empId}
                      </td>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{r.name}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{r.dept}</td>
                      <td className="p-3 font-mono text-slate-700 text-right whitespace-nowrap">
                        {r.tiffinAmount > 0 ? `₹${r.tiffinAmount.toLocaleString()}` : '—'}
                      </td>
                      <td className="p-3 font-mono text-slate-700 text-right whitespace-nowrap">
                        {r.lunchAmount > 0 ? `₹${r.lunchAmount.toLocaleString()}` : '—'}
                      </td>
                      <td className="p-3 font-mono text-slate-700 text-right whitespace-nowrap">
                        {r.snacksAmount > 0 ? `₹${r.snacksAmount.toLocaleString()}` : '—'}
                      </td>
                      <td className="p-3 font-mono text-slate-700 text-right whitespace-nowrap">
                        {r.dinnerAmount > 0 ? `₹${r.dinnerAmount.toLocaleString()}` : '—'}
                      </td>
                      <td className="p-3 font-mono font-black text-emerald-800 text-right whitespace-nowrap bg-emerald-50/30">
                        ₹{r.totalAmount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredPersonRows.length > 0 && (
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <tr>
                    <td
                      colSpan={4}
                      className="p-3 text-slate-900 text-right uppercase tracking-wider text-xs"
                    >
                      Total Amount:
                    </td>
                    <td className="p-3 font-mono font-black text-slate-900 text-right whitespace-nowrap">
                      ₹{totalTiffinAmount.toLocaleString()}
                    </td>
                    <td className="p-3 font-mono font-black text-slate-900 text-right whitespace-nowrap">
                      ₹{totalLunchAmount.toLocaleString()}
                    </td>
                    <td className="p-3 font-mono font-black text-slate-900 text-right whitespace-nowrap">
                      ₹{totalSnacksAmount.toLocaleString()}
                    </td>
                    <td className="p-3 font-mono font-black text-slate-900 text-right whitespace-nowrap">
                      ₹{totalDinnerAmount.toLocaleString()}
                    </td>
                    <td className="p-3 font-mono font-black text-emerald-800 text-right text-sm whitespace-nowrap bg-emerald-100/60">
                      ₹{totalOverallAmount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. EXPORT MODAL POPUP: DOWNLOAD SELECTED VS DOWNLOAD ALL             */}
      {/* =================================================================== */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`p-2.5 rounded-xl text-white ${
                    exportFormat === 'Excel'
                      ? 'bg-emerald-600'
                      : exportFormat === 'PDF'
                      ? 'bg-rose-600'
                      : 'bg-slate-700'
                  }`}
                >
                  {exportFormat === 'Excel' ? (
                    <FileSpreadsheet className="w-5 h-5" />
                  ) : exportFormat === 'PDF' ? (
                    <FileText className="w-5 h-5" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Export Report ({exportFormat})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Date Range: <strong className="text-slate-800">{fromDate || 'Start'} to {toDate}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Options */}
            <div className="p-6 flex flex-col gap-4">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Please select which report format you would like to download:
              </p>

              {/* Option 1: Download Selected */}
              <button
                type="button"
                onClick={() => handleExecuteExport('selected')}
                className="p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 text-left transition-all cursor-pointer group flex items-start space-x-3.5"
              >
                <div className="p-2.5 rounded-xl bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-700 transition-colors shrink-0">
                  <ListOrdered className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-black text-slate-900 group-hover:text-emerald-900">
                      Download Selected
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Regular Audit Log
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Downloads the regular token-by-token transaction ledger with Date, Emp ID, Name, Dept, Particular, Price, Status, Time, and Token Number ({filteredOrders.length} records matching current filters).
                  </p>
                </div>
              </button>

              {/* Option 2: Download All (Person-Wise Spending Report) */}
              <button
                type="button"
                onClick={() => handleExecuteExport('all')}
                className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50 text-left transition-all cursor-pointer group flex items-start space-x-3.5 shadow-sm"
              >
                <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-black text-emerald-950">
                      Download All (Person-Wise Report)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                      Print All Section
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Downloads the consolidated person-wise spending summary with Company Name, Date Range, S.No, Token No / Emp ID, Name, Dept, Tiffin (Amount), Lunch, Snacks, Dinner, and Total Amount ({allPersonRows.length} total employees).
                  </p>
                </div>
              </button>

              {/* Footer */}
              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
