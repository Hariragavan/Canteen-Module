import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order } from '../types';

export const REPORT_HEADERS = [
  'Date',
  'Emp ID',
  'Name',
  'Dept',
  'Meal',
  'Price',
  'Status',
  'Issued Time',
  'Served Time',
  'Token Number',
];

export function formatOrderReportData(orders: Order[]) {
  return orders.map((o) => {
    const isServed = o.status === 'SERVED' || Boolean(o.servedAt);
    const statusText = isServed ? 'Printed / Served' : 'Printed';
    const priceVal = o.rate ?? 40;

    return {
      date: o.dateStr || '',
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

  const csvContent =
    '\uFEFF' + [REPORT_HEADERS.join(','), ...rows.map((r) => r.join(','))].join('\n');
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

  const worksheet = XLSX.utils.aoa_to_sheet([REPORT_HEADERS, ...dataRows]);

  // Set friendly column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 14 }, // Emp ID
    { wch: 22 }, // Name
    { wch: 16 }, // Dept
    { wch: 14 }, // Meal
    { wch: 12 }, // Price
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
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

  // Document Title Header
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('Smart Canteen - Token Clearance & Audit Report', 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  const rangeInfo =
    fromDate && toDate
      ? `Date Range: ${fromDate} to ${toDate}`
      : fromDate
      ? `Date: ${fromDate}`
      : 'All Recorded Dates';
  const totalAmount = formatted.reduce((sum, item) => sum + item.price, 0);
  doc.text(
    `${rangeInfo}  •  Total Tokens: ${formatted.length}  •  Total Value: ₹${totalAmount.toLocaleString()}  •  Generated: ${new Date().toLocaleString()}`,
    14,
    21
  );

  const tableRows = formatted.map((item) => [
    item.date,
    item.empId,
    item.name,
    item.dept,
    item.meal,
    `₹${item.price}`,
    item.status,
    item.issuedTime,
    item.servedTime,
    String(item.tokenNumber),
  ]);

  autoTable(doc, {
    head: [REPORT_HEADERS],
    body: tableRows,
    startY: 25,
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
    columnStyles: {
      5: { halign: 'right' }, // Price
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
