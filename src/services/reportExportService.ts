import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order, PersonSpendingRow } from '../types';

export const REPORT_HEADERS = [
  'Date',
  'Worker ID',
  'Name',
  'Dept',
  'Particular',
  'Price',
  'Status',
  'Issued Time',
  'Served Time',
  'Token Number',
];

export const WORKER_SPENDING_HEADERS = [
  'S.No',
  'Worker ID',
  'Name',
  'Dept',
  'Tiffin (Rs.)',
  'Lunch (Rs.)',
  'Snacks (Rs.)',
  'Total Amount (Rs.)',
];

/**
 * Format meal spending as:
 * - If 0: '0'
 * - If 1: '${amount}'
 * - If > 1: '(${count}) ${amount}'
 */
export function formatMealAmountWithCount(count: number, amount: number, prefix = ''): string {
  if (count === 0 || amount === 0) return '0';
  if (count === 1) return prefix ? `${prefix}${amount}` : `${amount}`;
  return prefix ? `(${count}) ${prefix}${amount}` : `(${count}) ${amount}`;
}

/**
 * Format timestamp as hh:mm (dd/mm)
 * e.g., "12:35:10 PM", dateStr "2026-11-26" -> "12:35 (26/11)"
 */
export function formatTimeWithDate(timeStr?: string | null, dateStr?: string): string {
  if (!timeStr || timeStr === '-' || timeStr.trim() === '') return '—';

  let timePart = timeStr.trim();
  const match = timePart.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    const ampm = match[3];
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    const hh = String(hours).padStart(2, '0');
    timePart = `${hh}:${mins}`;
  }

  let datePart = '';
  if (dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      datePart = `(${parts[2]}/${parts[1]})`;
    }
  }

  return datePart ? `${timePart} ${datePart}` : timePart;
}

export function computePersonSpendingRows(orders: Order[]): PersonSpendingRow[] {
  const map = new Map<
    string,
    {
      workerId: string;
      name: string;
      dept: string;
      tiffinAmount: number;
      lunchAmount: number;
      snacksAmount: number;
      tiffinCount: number;
      lunchCount: number;
      snacksCount: number;
      totalOrders: number;
    }
  >();

  orders.forEach((o) => {
    const rawId = (o.userId || o.name || 'UNKNOWN').trim();
    const key = rawId.toLowerCase();
    const price = (o.rate ?? 40) * (o.qty ?? 1);
    const meal = (o.meal || '').toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        workerId: o.userId || '-',
        name: o.name || 'Unnamed',
        dept: o.dept || 'General',
        tiffinAmount: 0,
        lunchAmount: 0,
        snacksAmount: 0,
        tiffinCount: 0,
        lunchCount: 0,
        snacksCount: 0,
        totalOrders: 0,
      });
    }

    const rec = map.get(key)!;
    rec.totalOrders += 1;

    // Regular canteen slots: Tiffin, Lunch, Snacks (Dinner is strictly transport)
    if (meal.includes('tiffin') || meal.includes('breakfast')) {
      rec.tiffinAmount += price;
      rec.tiffinCount += 1;
    } else if (meal.includes('lunch')) {
      rec.lunchAmount += price;
      rec.lunchCount += 1;
    } else {
      rec.snacksAmount += price;
      rec.snacksCount += 1;
    }
  });

  return Array.from(map.values())
    .map((r, idx) => ({
      sNo: idx + 1,
      workerId: r.workerId,
      empId: r.workerId,
      name: r.name,
      dept: r.dept,
      tiffinAmount: r.tiffinAmount,
      lunchAmount: r.lunchAmount,
      snacksAmount: r.snacksAmount,
      totalAmount: r.tiffinAmount + r.lunchAmount + r.snacksAmount,
      tiffinCount: r.tiffinCount,
      lunchCount: r.lunchCount,
      snacksCount: r.snacksCount,
      totalOrders: r.totalOrders,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, sNo: i + 1 }));
}

export function formatOrderReportData(orders: Order[]) {
  return orders.map((o) => {
    const isServed = o.status === 'SERVED' || Boolean(o.servedAt);
    const statusText = isServed ? 'Printed / Served' : 'Printed';
    const priceVal = (o.rate ?? 40) * (o.qty ?? 1);

    return {
      date: (o.dateStr || '').trim().replace(/^[^\w\d-]+/, ''),
      workerId: o.userId || '',
      empId: o.userId || '',
      name: o.name || '',
      dept: o.dept || '',
      meal: o.meal || '',
      price: priceVal,
      status: statusText,
      issuedTime: formatTimeWithDate(o.issuedAt, o.dateStr),
      servedTime: formatTimeWithDate(o.servedAt, o.dateStr),
      tokenNumber: o.token,
    };
  });
}

function getFileNameBase(fromDate?: string, toDate?: string): string {
  if (fromDate && toDate) {
    return `Canteen_Audit_${fromDate}_to_${toDate}`;
  }
  if (fromDate) {
    return `Canteen_Audit_${fromDate}`;
  }
  return `Canteen_Audit_All_${new Date().toISOString().slice(0, 10)}`;
}

function getWorkerReportFileName(fromDate?: string, toDate?: string, ext = ''): string {
  const base =
    fromDate && toDate
      ? `Worker_Spending_Report_${fromDate}_to_${toDate}`
      : fromDate
      ? `Worker_Spending_Report_${fromDate}`
      : `Worker_Spending_Report_${new Date().toISOString().slice(0, 10)}`;
  return ext ? `${base}.${ext}` : base;
}

/**
 * 1. Export as Regular Detailed CSV File
 */
export function exportOrdersToCSV(
  orders: Order[],
  fromDate?: string,
  toDate?: string
): void {
  if (orders.length === 0) {
    alert('No order records available to export.');
    return;
  }

  const formatted = formatOrderReportData(orders);
  const totalAmount = formatted.reduce((sum, item) => sum + item.price, 0);

  const CSV_HEADERS = [
    'DATE',
    'WORKER ID',
    'NAME',
    'DEPT',
    'PARTICULAR',
    'PRICE',
    'STATUS',
    'ISSUED TIME (PRINTED)',
    'SERVED TIME',
    'TOKEN NUMBER',
  ];

  const rows = formatted.map((item) => [
    `"${item.date}"`,
    `"${item.workerId}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.dept.replace(/"/g, '""')}"`,
    `"${item.meal.replace(/"/g, '""')}"`,
    item.price,
    `"${item.status}"`,
    `"${item.issuedTime}"`,
    `"${item.servedTime}"`,
    item.tokenNumber,
  ]);

  const totalRow = [
    `"TOTAL AMOUNT"`,
    `""`,
    `""`,
    `""`,
    `""`,
    totalAmount,
    `""`,
    `""`,
    `""`,
    `""`,
  ];

  const BOM = '\uFEFF';
  const csvContent =
    BOM + [CSV_HEADERS.join(','), ...rows.map((r) => r.join(',')), totalRow.join(',')].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${getFileNameBase(fromDate, toDate)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 2. Export as Regular Detailed Excel (.xlsx) File
 */
export function exportOrdersToExcel(
  orders: Order[],
  fromDate?: string,
  toDate?: string
): void {
  if (orders.length === 0) {
    alert('No order records available to export.');
    return;
  }

  const formatted = formatOrderReportData(orders);
  const totalAmount = formatted.reduce((sum, item) => sum + item.price, 0);

  const dataRows = formatted.map((item) => [
    item.date,
    item.workerId,
    item.name,
    item.dept,
    item.meal,
    item.price,
    item.status,
    item.issuedTime,
    item.servedTime,
    item.tokenNumber,
  ]);

  const totalRow = [
    'TOTAL AMOUNT',
    '',
    '',
    '',
    '',
    totalAmount,
    '',
    '',
    '',
    '',
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([REPORT_HEADERS, ...dataRows, totalRow]);
  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  // Headings
  colLetters.forEach((col) => {
    const cellRef = `${col}1`;
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = {
        fill: { fgColor: { rgb: '059669' } },
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '047857' } },
          bottom: { style: 'medium', color: { rgb: '047857' } },
          left: { style: 'thin', color: { rgb: '047857' } },
          right: { style: 'thin', color: { rgb: '047857' } },
        },
      };
    }
  });

  // Data rows
  dataRows.forEach((_, rowIdx) => {
    const excelRow = rowIdx + 2;
    colLetters.forEach((col) => {
      const cellRef = `${col}${excelRow}`;
      if (worksheet[cellRef]) {
        const isPriceCol = col === 'F';
        const isTokenCol = col === 'J';
        worksheet[cellRef].s = {
          font: { name: 'Calibri', sz: 10, bold: isPriceCol || isTokenCol },
          alignment: {
            horizontal: isPriceCol ? 'right' : isTokenCol ? 'center' : 'left',
            vertical: 'center',
          },
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } },
          },
        };
      }
    });
  });

  // Total Row
  const totalRowIdx = dataRows.length + 2;
  colLetters.forEach((col) => {
    const cellRef = `${col}${totalRowIdx}`;
    if (!worksheet[cellRef]) {
      worksheet[cellRef] = { t: 's', v: '' };
    }
    const isPriceCol = col === 'F';
    const isLabelCol = col === 'A';
    worksheet[cellRef].s = {
      fill: { fgColor: { rgb: 'ECFDF5' } },
      font: {
        name: 'Calibri',
        sz: isPriceCol ? 12 : 11,
        bold: true,
        color: { rgb: '065F46' },
      },
      alignment: {
        horizontal: isPriceCol ? 'right' : isLabelCol ? 'left' : 'center',
        vertical: 'center',
      },
      border: {
        top: { style: 'medium', color: { rgb: '059669' } },
        bottom: { style: 'double', color: { rgb: '059669' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } },
      },
    };
  });

  worksheet['!autofilter'] = { ref: `A1:J${dataRows.length + 1}` };
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 14 }, // Worker ID
    { wch: 22 }, // Name
    { wch: 16 }, // Dept
    { wch: 14 }, // Meal
    { wch: 14 }, // Price
    { wch: 18 }, // Status
    { wch: 18 }, // Issued Time
    { wch: 18 }, // Served Time
    { wch: 16 }, // Token Number
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Report');
  XLSX.writeFile(workbook, `${getFileNameBase(fromDate, toDate)}.xlsx`);
}

/**
 * 3. Export as Regular Detailed PDF Document
 */
export function exportOrdersToPDF(
  orders: Order[],
  fromDate?: string,
  toDate?: string
): void {
  if (orders.length === 0) {
    alert('No order records available to export.');
    return;
  }

  const formatted = formatOrderReportData(orders);
  const totalAmount = formatted.reduce((sum, item) => sum + item.price, 0);
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

  // Document Title Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text('Esstee Exports India Private Limited', 14, 13);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Smart Canteen - Token Clearance & Detailed Audit Report', 14, 19);

  const rangeInfo =
    fromDate && toDate
      ? `Date Range: ${fromDate} to ${toDate}`
      : fromDate
      ? `Date: ${fromDate}`
      : 'All Recorded Dates';

  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.6);
  doc.roundedRect(14, 22, doc.internal.pageSize.width - 28, 10, 2, 2, 'FD');

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text(`TOTAL AMOUNT: Rs. ${totalAmount.toLocaleString()}`, 18, 29);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const metaInfo = `Total Tokens: ${formatted.length}  •  ${rangeInfo}  •  Generated: ${new Date().toLocaleDateString()}`;
  doc.text(metaInfo, doc.internal.pageSize.width - 18, 29, { align: 'right' });

  const tableRows = formatted.map((item) => [
    item.date,
    item.workerId,
    item.name,
    item.dept,
    item.meal,
    `Rs. ${item.price}`,
    item.status,
    item.issuedTime,
    item.servedTime,
    String(item.tokenNumber),
  ]);

  const tableFoot = [
    [
      'TOTAL AMOUNT',
      '',
      '',
      '',
      '',
      `Rs. ${totalAmount.toLocaleString()}`,
      '',
      '',
      '',
      `${formatted.length} Tokens`,
    ],
  ];

  autoTable(doc, {
    head: [REPORT_HEADERS],
    body: tableRows,
    foot: tableFoot,
    startY: 36,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: [236, 253, 245],
      textColor: [4, 120, 87],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    columnStyles: {
      1: { halign: 'center' }, // Worker ID
      5: { halign: 'right', fontStyle: 'bold' }, // Price column aligned right
      7: { halign: 'center' }, // Issued Time
      8: { halign: 'center' }, // Served Time
      9: { halign: 'center', fontStyle: 'bold' }, // Token Number
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const pageStr = `Page ${doc.getNumberOfPages()}`;
      doc.text(pageStr, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 8);
    },
  });

  doc.save(`${getFileNameBase(fromDate, toDate)}.pdf`);
}

/**
 * 4. Export Worker-Wise Spending Report to CSV
 * Columns: S.No, Worker ID, Name, Dept, Tiffin, Lunch, Snacks, Total Amount
 * Meal cells format: e.g. 0, 40, (2) 80
 */
export function exportPersonSpendingCSV(
  orders: Order[],
  fromDate?: string,
  toDate?: string
): void {
  const rows = computePersonSpendingRows(orders);
  if (rows.length === 0) {
    alert('No order records available for worker spending export.');
    return;
  }

  const rangeInfo =
    fromDate && toDate
      ? `${fromDate} to ${toDate}`
      : fromDate
      ? `${fromDate}`
      : 'All Recorded Dates';

  const sumTiffin = rows.reduce((s, r) => s + r.tiffinAmount, 0);
  const sumLunch = rows.reduce((s, r) => s + r.lunchAmount, 0);
  const sumSnacks = rows.reduce((s, r) => s + r.snacksAmount, 0);
  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);

  const lines = [
    `"Esstee Exports India Private Limited"`,
    `"Worker-Wise Canteen Spending Summary Report / கேண்டீன் நபர்வாரி செலவு அறிக்கை"`,
    `"Date Range: ${rangeInfo}","Generated: ${new Date().toLocaleDateString()}"`,
    `""`,
    `"S.NO","WORKER ID","NAME","DEPT","TIFFIN","LUNCH","SNACKS","TOTAL AMOUNT"`,
    ...rows.map(
      (r) =>
        `${r.sNo},"${r.workerId}","${r.name.replace(/"/g, '""')}","${r.dept.replace(/"/g, '""')}","${formatMealAmountWithCount(r.tiffinCount, r.tiffinAmount)}","${formatMealAmountWithCount(r.lunchCount, r.lunchAmount)}","${formatMealAmountWithCount(r.snacksCount, r.snacksAmount)}",${r.totalAmount}`
    ),
    `"TOTAL AMOUNT","","","",${sumTiffin},${sumLunch},${sumSnacks},${grandTotal}`,
  ];

  const BOM = '\uFEFF';
  const csvContent = BOM + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', getWorkerReportFileName(fromDate, toDate, 'csv'));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 5. Export Worker-Wise Spending Report to Excel (.xlsx)
 * - Single file containing:
 *   Sheet 1: Worker_Spending_Summary (with company name, date range, token count + amount, and totals)
 *   Sheet 2: Detailed_Orders_Audit (full itemized token transactions for the period)
 */
export function exportPersonSpendingExcel(
  orders: Order[],
  fromDate?: string,
  toDate?: string
): void {
  const rows = computePersonSpendingRows(orders);
  if (rows.length === 0) {
    alert('No order records available for worker spending export.');
    return;
  }

  const rangeInfo =
    fromDate && toDate
      ? `${fromDate} to ${toDate}`
      : fromDate
      ? `${fromDate}`
      : 'All Recorded Dates';

  const sumTiffin = rows.reduce((s, r) => s + r.tiffinAmount, 0);
  const sumLunch = rows.reduce((s, r) => s + r.lunchAmount, 0);
  const sumSnacks = rows.reduce((s, r) => s + r.snacksAmount, 0);
  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);

  // Sheet 1: Worker Spending Summary
  const sheet1Data: (string | number)[][] = [
    ['Esstee Exports India Private Limited', '', '', '', '', '', '', ''],
    ['Worker-Wise Canteen Spending Summary Report / கேண்டீன் நபர்வாரி செலவு அறிக்கை', '', '', '', '', '', '', ''],
    [`Date Range: ${rangeInfo}  |  Total Workers: ${rows.length}  |  Generated: ${new Date().toLocaleDateString()}`, '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['S.NO', 'WORKER ID', 'NAME', 'DEPT', 'TIFFIN (₹)', 'LUNCH (₹)', 'SNACKS (₹)', 'TOTAL AMOUNT (₹)'],
    ...rows.map((r) => [
      r.sNo,
      r.workerId,
      r.name,
      r.dept,
      formatMealAmountWithCount(r.tiffinCount, r.tiffinAmount),
      formatMealAmountWithCount(r.lunchCount, r.lunchAmount),
      formatMealAmountWithCount(r.snacksCount, r.snacksAmount),
      r.totalAmount,
    ]),
    ['TOTAL AMOUNT', '', '', '', sumTiffin, sumLunch, sumSnacks, grandTotal],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(sheet1Data);

  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    { s: { r: sheet1Data.length - 1, c: 0 }, e: { r: sheet1Data.length - 1, c: 3 } },
  ];

  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // Row 1: Company Header
  if (wsSummary['A1']) {
    wsSummary['A1'].s = {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '047857' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  // Row 2: Subtitle
  if (wsSummary['A2']) {
    wsSummary['A2'].s = {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '1E293B' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  // Row 3: Meta
  if (wsSummary['A3']) {
    wsSummary['A3'].s = {
      font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '64748B' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }

  // Row 5: Column Headers
  colLetters.forEach((col) => {
    const cellRef = `${col}5`;
    if (wsSummary[cellRef]) {
      wsSummary[cellRef].s = {
        fill: { fgColor: { rgb: '059669' } },
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: {
          horizontal: ['A', 'B'].includes(col) ? 'center' : ['C', 'D'].includes(col) ? 'left' : 'right',
          vertical: 'center',
        },
        border: {
          top: { style: 'thin', color: { rgb: '047857' } },
          bottom: { style: 'medium', color: { rgb: '047857' } },
          left: { style: 'thin', color: { rgb: '047857' } },
          right: { style: 'thin', color: { rgb: '047857' } },
        },
      };
    }
  });

  // Data rows
  rows.forEach((_, idx) => {
    const rIdx = idx + 6;
    colLetters.forEach((col) => {
      const cellRef = `${col}${rIdx}`;
      if (wsSummary[cellRef]) {
        const isTotal = col === 'H';
        wsSummary[cellRef].s = {
          font: {
            name: 'Calibri',
            sz: 10,
            bold: isTotal,
            color: isTotal ? { rgb: '047857' } : { rgb: '0F172A' },
          },
          alignment: {
            horizontal: ['A', 'B'].includes(col) ? 'center' : ['C', 'D'].includes(col) ? 'left' : 'right',
            vertical: 'center',
          },
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } },
          },
        };
      }
    });
  });

  // Summary Row at bottom
  const totalRowIdx = sheet1Data.length;
  colLetters.forEach((col) => {
    const cellRef = `${col}${totalRowIdx}`;
    if (!wsSummary[cellRef]) {
      wsSummary[cellRef] = { t: 's', v: '' };
    }
    const isMoney = ['E', 'F', 'G', 'H'].includes(col);
    wsSummary[cellRef].s = {
      fill: { fgColor: { rgb: 'ECFDF5' } },
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '065F46' } },
      alignment: {
        horizontal: isMoney ? 'right' : 'center',
        vertical: 'center',
      },
      border: {
        top: { style: 'medium', color: { rgb: '059669' } },
        bottom: { style: 'double', color: { rgb: '059669' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } },
      },
    };
  });

  wsSummary['!cols'] = [
    { wch: 8 },  // S.No
    { wch: 18 }, // Worker ID
    { wch: 24 }, // Name
    { wch: 18 }, // Dept
    { wch: 16 }, // Tiffin
    { wch: 16 }, // Lunch
    { wch: 16 }, // Snacks
    { wch: 18 }, // Total Amount
  ];

  // Sheet 2: Detailed Orders Audit
  const auditFormatted = formatOrderReportData(orders);
  const auditDataRows = auditFormatted.map((item) => [
    item.date,
    item.workerId,
    item.name,
    item.dept,
    item.meal,
    item.price,
    item.status,
    item.issuedTime,
    item.servedTime,
    item.tokenNumber,
  ]);
  const auditTotalRow = ['TOTAL AMOUNT', '', '', '', '', grandTotal, '', '', '', ''];
  const wsAudit = XLSX.utils.aoa_to_sheet([REPORT_HEADERS, ...auditDataRows, auditTotalRow]);

  wsAudit['!autofilter'] = { ref: `A1:J${auditDataRows.length + 1}` };
  wsAudit['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Worker Spending Summary');
  XLSX.utils.book_append_sheet(workbook, wsAudit, 'Itemized Orders Audit');

  XLSX.writeFile(workbook, getWorkerReportFileName(fromDate, toDate, 'xlsx'));
}

/**
 * 6. Export Worker-Wise Spending Report to PDF
 * - Top Company Name & Date Range
 * - Table: S.No, Worker ID, Name, Dept, Tiffin, Lunch, Snacks, Total Amount
 * - Clean Rs. formatting to prevent font encoding glitches
 * - Summary footer row with Grand Total
 */
export function exportPersonSpendingPDF(
  orders: Order[],
  fromDate?: string,
  toDate?: string
): void {
  const rows = computePersonSpendingRows(orders);
  if (rows.length === 0) {
    alert('No order records available for worker spending export.');
    return;
  }

  const rangeInfo =
    fromDate && toDate
      ? `${fromDate} to ${toDate}`
      : fromDate
      ? `${fromDate}`
      : 'All Recorded Dates';

  const sumTiffin = rows.reduce((s, r) => s + r.tiffinAmount, 0);
  const sumLunch = rows.reduce((s, r) => s + r.lunchAmount, 0);
  const sumSnacks = rows.reduce((s, r) => s + r.snacksAmount, 0);
  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

  // 1. Top Company Name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text('Esstee Exports India Private Limited', 14, 13);

  // 2. Subtitle
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Worker-Wise Canteen Spending Summary Report', 14, 19);

  // 3. Highlighted Top Banner
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.6);
  doc.roundedRect(14, 23, doc.internal.pageSize.width - 28, 10, 2, 2, 'FD');

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text(`TOTAL AMOUNT: Rs. ${grandTotal.toLocaleString()}`, 18, 29.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const metaInfo = `Date Range: ${rangeInfo}   |   Workers: ${rows.length}   |   Generated: ${new Date().toLocaleDateString()}`;
  doc.text(metaInfo, doc.internal.pageSize.width - 18, 29.5, { align: 'right' });

  // 4. Data Rows
  const tableRows = rows.map((r) => [
    String(r.sNo),
    r.workerId,
    r.name,
    r.dept,
    formatMealAmountWithCount(r.tiffinCount, r.tiffinAmount),
    formatMealAmountWithCount(r.lunchCount, r.lunchAmount),
    formatMealAmountWithCount(r.snacksCount, r.snacksAmount),
    `Rs. ${r.totalAmount.toLocaleString()}`,
  ]);

  const tableFoot = [
    [
      'TOTAL AMOUNT',
      '',
      '',
      '',
      `Rs. ${sumTiffin.toLocaleString()}`,
      `Rs. ${sumLunch.toLocaleString()}`,
      `Rs. ${sumSnacks.toLocaleString()}`,
      `Rs. ${grandTotal.toLocaleString()}`,
    ],
  ];

  autoTable(doc, {
    head: [WORKER_SPENDING_HEADERS],
    body: tableRows,
    foot: tableFoot,
    startY: 37,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    footStyles: {
      fillColor: [236, 253, 245],
      textColor: [4, 120, 87],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 }, // S.No
      1: { halign: 'center', cellWidth: 32 }, // Worker ID
      2: { halign: 'left', fontStyle: 'bold' }, // Name
      3: { halign: 'left', cellWidth: 32 }, // Dept
      4: { halign: 'right' }, // Tiffin
      5: { halign: 'right' }, // Lunch
      6: { halign: 'right' }, // Snacks
      7: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] }, // Total Amount
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const pageStr = `Page ${doc.getNumberOfPages()}`;
      doc.text(pageStr, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 8);
    },
  });

  doc.save(getWorkerReportFileName(fromDate, toDate, 'pdf'));
}
