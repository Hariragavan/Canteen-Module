import * as XLSX from 'xlsx-js-style';
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
    'MEAL',
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

  const csvContent =
    '\uFEFF' +
    [CSV_HEADERS.join(','), ...rows.map((r) => r.join(',')), totalRow.join(',')].join('\n');

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
