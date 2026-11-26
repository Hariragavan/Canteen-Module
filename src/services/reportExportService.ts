import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order, PersonSpendingRow } from '../types';

export const REPORT_HEADERS = [
  'Date',
  'Emp ID',
  'Name',
  'Dept',
  'Particular',
  'Price',
  'Status',
  'Issued Time',
  'Served Time',
  'Token Number',
];

export const PERSON_SPENDING_HEADERS = [
  'S.No',
  'Token No / Emp ID',
  'Name',
  'Dept',
  'Tiffin (Rs.)',
  'Lunch (Rs.)',
  'Snacks (Rs.)',
  'Dinner (Rs.)',
  'Total Amount (Rs.)',
];

export function computePersonSpendingRows(orders: Order[]): PersonSpendingRow[] {
  const map = new Map<
    string,
    {
      empId: string;
      name: string;
      dept: string;
      tiffinAmount: number;
      lunchAmount: number;
      snacksAmount: number;
      dinnerAmount: number;
      tiffinCount: number;
      lunchCount: number;
      snacksCount: number;
      dinnerCount: number;
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
        empId: o.userId || '-',
        name: o.name || 'Unnamed',
        dept: o.dept || 'General',
        tiffinAmount: 0,
        lunchAmount: 0,
        snacksAmount: 0,
        dinnerAmount: 0,
        tiffinCount: 0,
        lunchCount: 0,
        snacksCount: 0,
        dinnerCount: 0,
        totalOrders: 0,
      });
    }

    const rec = map.get(key)!;
    rec.totalOrders += 1;

    if (meal.includes('tiffin') || meal.includes('breakfast')) {
      rec.tiffinAmount += price;
      rec.tiffinCount += 1;
    } else if (meal.includes('lunch')) {
      rec.lunchAmount += price;
      rec.lunchCount += 1;
    } else if (meal.includes('tea') || meal.includes('snack') || meal.includes('coffee')) {
      rec.snacksAmount += price;
      rec.snacksCount += 1;
    } else if (meal.includes('dinner') || meal.includes('night')) {
      rec.dinnerAmount += price;
      rec.dinnerCount += 1;
    } else {
      rec.snacksAmount += price;
      rec.snacksCount += 1;
    }
  });

  return Array.from(map.values())
    .map((r, idx) => ({
      sNo: idx + 1,
      empId: r.empId,
      name: r.name,
      dept: r.dept,
      tiffinAmount: r.tiffinAmount,
      lunchAmount: r.lunchAmount,
      snacksAmount: r.snacksAmount,
      dinnerAmount: r.dinnerAmount,
      totalAmount: r.tiffinAmount + r.lunchAmount + r.snacksAmount + r.dinnerAmount,
      tiffinCount: r.tiffinCount,
      lunchCount: r.lunchCount,
      snacksCount: r.snacksCount,
      dinnerCount: r.dinnerCount,
      totalOrders: r.totalOrders,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, sNo: i + 1 }));
}

export function formatOrderReportData(orders: Order[]) {
  return orders.map((o) => {
    const isServed = o.status === 'SERVED' || Boolean(o.servedAt);
    const statusText = isServed ? 'Printed / Served' : 'Printed';
    const priceVal = o.rate ?? 40;

    return {
      date: (o.dateStr || '').trim().replace(/^[^\w\d-]+/, ''),
      empId: o.userId || '',
      name: o.name || '',
      dept: o.dept || '',
      meal: o.meal || '',
      price: priceVal,
      status: statusText,
      issuedTime: o.issuedAt || '',
      servedTime: o.servedAt || '',
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

/**
 * 1. Export as CSV File
 * - Headings highlighted in uppercase
 * - Last row contains TOTAL AMOUNT in the Price column
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

  // Highlighted Uppercase Column Headers
  const CSV_HEADERS = [
    'DATE',
    'EMP ID',
    'NAME',
    'DEPT',
    'PARTICULAR',
    'PRICE',
    'STATUS',
    'ISSUED TIME',
    'SERVED TIME',
    'TOKEN NUMBER',
  ];

  const rows = formatted.map((item) => [
    `"${item.date}"`,
    `"${item.empId}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.dept.replace(/"/g, '""')}"`,
    `"${item.meal.replace(/"/g, '""')}"`,
    item.price,
    `"${item.status}"`,
    `"${item.issuedTime}"`,
    `"${item.servedTime}"`,
    item.tokenNumber,
  ]);

  // Last Total Amount Row for the Price column
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
 * 2. Export as Excel (.xlsx) File
 * - Highlighted Emerald Headings with bold white text
 * - Total Amount Row at the bottom with Price column highlighted
 * - Auto-filter and optimized column widths
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
    item.empId,
    item.name,
    item.dept,
    item.meal,
    item.price,
    item.status,
    item.issuedTime,
    item.servedTime,
    item.tokenNumber,
  ]);

  // Total row at bottom
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

  // 1. Highlight Headings (Row 1): Rich Emerald fill, bold white text, crisp borders
  colLetters.forEach((col) => {
    const cellRef = `${col}1`;
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = {
        fill: { fgColor: { rgb: '059669' } }, // Emerald 600
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

  // 2. Format Data Rows (Rows 2 to N+1)
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

  // 3. Highlight Last Total Row: Soft emerald highlight, double bottom border, total in Price column
  const totalRowIdx = dataRows.length + 2;
  colLetters.forEach((col) => {
    const cellRef = `${col}${totalRowIdx}`;
    if (!worksheet[cellRef]) {
      worksheet[cellRef] = { t: 's', v: '' };
    }
    const isPriceCol = col === 'F';
    const isLabelCol = col === 'A';
    worksheet[cellRef].s = {
      fill: { fgColor: { rgb: 'ECFDF5' } }, // Light emerald highlight
      font: {
        name: 'Calibri',
        sz: isPriceCol ? 12 : 11,
        bold: true,
        color: { rgb: '065F46' }, // Dark emerald
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

  // Enable Excel Auto-Filter on header row
  worksheet['!autofilter'] = { ref: `A1:J${dataRows.length + 1}` };

  // Set friendly column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 14 }, // Emp ID
    { wch: 22 }, // Name
    { wch: 16 }, // Dept
    { wch: 14 }, // Meal
    { wch: 14 }, // Price
    { wch: 20 }, // Status
    { wch: 16 }, // Issued Time
    { wch: 16 }, // Served Time
    { wch: 16 }, // Token Number
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Report');

  XLSX.writeFile(workbook, `${getFileNameBase(fromDate, toDate)}.xlsx`);
}

/**
 * 3. Export as PDF (.pdf) Document
 * - Prominent Total Amount banner displayed at the TOP
 * - Clean ASCII "Rs. XX" formatting to prevent multi-byte encoding separation / small 1 glitch
 * - Summary row at bottom of table showing Total Amount under Price column
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
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('Smart Canteen - Token Clearance & Audit Report', 14, 13);

  // Top Highlighted Total Amount Banner
  const rangeInfo =
    fromDate && toDate
      ? `Date Range: ${fromDate} to ${toDate}`
      : fromDate
      ? `Date: ${fromDate}`
      : 'All Recorded Dates';

  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(5, 150, 105); // emerald-600
  doc.setLineWidth(0.6);
  doc.roundedRect(14, 17, doc.internal.pageSize.width - 28, 11, 2, 2, 'FD');

  // Prominent Total Amount text inside the banner
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text(`TOTAL AMOUNT: Rs. ${totalAmount.toLocaleString()}`, 18, 24.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85); // slate-700
  const metaInfo = `Total Tokens: ${formatted.length}  •  ${rangeInfo}  •  Generated: ${new Date().toLocaleString()}`;
  doc.text(metaInfo, doc.internal.pageSize.width - 18, 24.5, { align: 'right' });

  // Table Body Rows:
  // Using "Rs. XX" instead of unicode Rupee symbol "₹" avoids font encoding corruption (which showed "small 1" / â‚¹)
  const tableRows = formatted.map((item) => [
    item.date,
    item.empId,
    item.name,
    item.dept,
    item.meal,
    `Rs. ${item.price}`,
    item.status,
    item.issuedTime,
    item.servedTime,
    String(item.tokenNumber),
  ]);

  // Last Total Amount row under the Price column in table footer
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
    startY: 32,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [5, 150, 105], // emerald-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: [236, 253, 245], // emerald-50
      textColor: [4, 120, 87], // emerald-700
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    columnStyles: {
      5: { halign: 'right', fontStyle: 'bold' }, // Price column aligned right
      9: { halign: 'center', fontStyle: 'bold' }, // Token Number
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
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
 * Helper to build person-wise file name
 */
function getPersonReportFileName(fromDate?: string, toDate?: string, ext = ''): string {
  const base =
    fromDate && toDate
      ? `Person_Spending_Report_${fromDate}_to_${toDate}`
      : fromDate
      ? `Person_Spending_Report_${fromDate}`
      : `Person_Spending_Report_${new Date().toISOString().slice(0, 10)}`;
  return ext ? `${base}.${ext}` : base;
}

/**
 * 4. Export Person-Wise Spending Report to CSV
 */
export function exportPersonSpendingCSV(
  orders: Order[],
  fromDate?: string,
  toDate?: string
): void {
  const rows = computePersonSpendingRows(orders);
  if (rows.length === 0) {
    alert('No order records available for person spending export.');
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
  const sumDinner = rows.reduce((s, r) => s + r.dinnerAmount, 0);
  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);

  const lines = [
    `"Esstee Exports India Private Limited"`,
    `"Person-Wise Canteen Spending Summary Report / கேண்டீன் நபர்வாரி செலவு அறிக்கை"`,
    `"Date Range: ${rangeInfo}","Generated: ${new Date().toLocaleString()}"`,
    `""`,
    `"S.NO","TOKEN NO / EMP ID","NAME","DEPT","TIFFIN (RS)","LUNCH (RS)","SNACKS (RS)","DINNER (RS)","TOTAL AMOUNT (RS)"`,
    ...rows.map(
      (r) =>
        `${r.sNo},"${r.empId}","${r.name.replace(/"/g, '""')}","${r.dept.replace(/"/g, '""')}",${r.tiffinAmount},${r.lunchAmount},${r.snacksAmount},${r.dinnerAmount},${r.totalAmount}`
    ),
    `"TOTAL / SUMMARY","","","",${sumTiffin},${sumLunch},${sumSnacks},${sumDinner},${grandTotal}`,
  ];

  const BOM = '\uFEFF';
  const csvContent = BOM + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', getPersonReportFileName(fromDate, toDate, 'csv'));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 5. Export Person-Wise Spending Report to Excel (.xlsx)
 * - Single file containing:
 *   Sheet 1: Person_Spending_Summary (with company name, date range, table and totals)
 *   Sheet 2: Detailed_Orders_Audit (full itemized token transactions for the period)
 */
export function exportPersonSpendingExcel(
  orders: Order[],
  fromDate?: string,
  toDate?: string
): void {
  const rows = computePersonSpendingRows(orders);
  if (rows.length === 0) {
    alert('No order records available for person spending export.');
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
  const sumDinner = rows.reduce((s, r) => s + r.dinnerAmount, 0);
  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);

  // Sheet 1: Person Spending Summary
  const sheet1Data: (string | number)[][] = [
    ['Esstee Exports India Private Limited', '', '', '', '', '', '', '', ''],
    ['Person-Wise Canteen Spending Summary Report / கேண்டீன் நபர்வாரி செலவு அறிக்கை', '', '', '', '', '', '', '', ''],
    [`Date Range: ${rangeInfo}  |  Total Personnel: ${rows.length}  |  Generated: ${new Date().toLocaleString()}`, '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['S.NO', 'TOKEN NO / EMP ID', 'NAME', 'DEPT', 'TIFFIN (₹)', 'LUNCH (₹)', 'SNACKS (₹)', 'DINNER (₹)', 'TOTAL AMOUNT (₹)'],
    ...rows.map((r) => [
      r.sNo,
      r.empId,
      r.name,
      r.dept,
      r.tiffinAmount,
      r.lunchAmount,
      r.snacksAmount,
      r.dinnerAmount,
      r.totalAmount,
    ]),
    ['TOTAL / SUMMARY', '', '', '', sumTiffin, sumLunch, sumSnacks, sumDinner, grandTotal],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(sheet1Data);

  // Merge headers on first 3 rows
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
    { s: { r: sheet1Data.length - 1, c: 0 }, e: { r: sheet1Data.length - 1, c: 3 } },
  ];

  // Styling
  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

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

  // Data rows (Row 6 to 6 + rows.length - 1)
  rows.forEach((_, idx) => {
    const rIdx = idx + 6;
    colLetters.forEach((col) => {
      const cellRef = `${col}${rIdx}`;
      if (wsSummary[cellRef]) {
        const isTotal = col === 'I';
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
    const isMoney = ['E', 'F', 'G', 'H', 'I'].includes(col);
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
    { wch: 18 }, // Emp ID / Token
    { wch: 24 }, // Name
    { wch: 18 }, // Dept
    { wch: 14 }, // Tiffin
    { wch: 14 }, // Lunch
    { wch: 14 }, // Snacks
    { wch: 14 }, // Dinner
    { wch: 18 }, // Total Amount
  ];

  // Sheet 2: Detailed Orders Audit (Supporting Data in same file)
  const auditFormatted = formatOrderReportData(orders);
  const auditDataRows = auditFormatted.map((item) => [
    item.date,
    item.empId,
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
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Person Spending Summary');
  XLSX.utils.book_append_sheet(workbook, wsAudit, 'Itemized Orders Audit');

  XLSX.writeFile(workbook, getPersonReportFileName(fromDate, toDate, 'xlsx'));
}

/**
 * 6. Export Person-Wise Spending Report to PDF
 * - Top Company Name & Date Range
 * - Table: S.No, Token No / Emp ID, Name, Dept, Tiffin, Lunch, Snacks, Dinner, Total Amount
 * - Summary footer row with Grand Total
 */
export function exportPersonSpendingPDF(
  orders: Order[],
  fromDate?: string,
  toDate?: string
): void {
  const rows = computePersonSpendingRows(orders);
  if (rows.length === 0) {
    alert('No order records available for person spending export.');
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
  const sumDinner = rows.reduce((s, r) => s + r.dinnerAmount, 0);
  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

  // 1. Top Company Name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text('Esstee Exports India Private Limited', 14, 13);

  // 2. Subtitle
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('Person-Wise Canteen Spending Summary Report / கேண்டீன் நபர்வாரி செலவு அறிக்கை', 14, 19);

  // 3. Highlighted Top Banner
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(5, 150, 105); // emerald-600
  doc.setLineWidth(0.6);
  doc.roundedRect(14, 23, doc.internal.pageSize.width - 28, 11, 2, 2, 'FD');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text(`TOTAL AMOUNT: Rs. ${grandTotal.toLocaleString()}`, 18, 30.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const metaInfo = `Date Range: ${rangeInfo}  •  Personnel: ${rows.length}  •  Generated: ${new Date().toLocaleString()}`;
  doc.text(metaInfo, doc.internal.pageSize.width - 18, 30.5, { align: 'right' });

  // 4. Data Rows
  const tableRows = rows.map((r) => [
    String(r.sNo),
    r.empId,
    r.name,
    r.dept,
    `Rs. ${r.tiffinAmount.toLocaleString()}`,
    `Rs. ${r.lunchAmount.toLocaleString()}`,
    `Rs. ${r.snacksAmount.toLocaleString()}`,
    `Rs. ${r.dinnerAmount.toLocaleString()}`,
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
      `Rs. ${sumDinner.toLocaleString()}`,
      `Rs. ${grandTotal.toLocaleString()}`,
    ],
  ];

  autoTable(doc, {
    head: [PERSON_SPENDING_HEADERS],
    body: tableRows,
    foot: tableFoot,
    startY: 38,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [5, 150, 105], // emerald-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    footStyles: {
      fillColor: [236, 253, 245], // emerald-50
      textColor: [4, 120, 87], // emerald-700
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 }, // S.No
      1: { halign: 'center', cellWidth: 32 }, // Token No / Emp ID
      2: { halign: 'left', fontStyle: 'bold' }, // Name
      3: { halign: 'left', cellWidth: 28 }, // Dept
      4: { halign: 'right', fontStyle: 'bold' }, // Tiffin
      5: { halign: 'right', fontStyle: 'bold' }, // Lunch
      6: { halign: 'right', fontStyle: 'bold' }, // Snacks
      7: { halign: 'right', fontStyle: 'bold' }, // Dinner
      8: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] }, // Total Amount
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const pageStr = `Page ${doc.getNumberOfPages()}`;
      doc.text(pageStr, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 8);
    },
  });

  doc.save(getPersonReportFileName(fromDate, toDate, 'pdf'));
}
