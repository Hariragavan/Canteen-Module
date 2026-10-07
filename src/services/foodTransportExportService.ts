import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FoodTransportRecord } from '../types';

export const TRANSPORT_REPORT_HEADERS = [
  'Date',
  'Time',
  'Sector / Unit',
  'Food Type',
  'Menu Items',
  'Persons',
  'Quantity',
  'Unit',
  'Breakdown',
  'Vehicle / Driver',
  'Status',
];

export function formatTransportReportData(records: FoodTransportRecord[]) {
  return records.map((r) => {
    const breakdownText = (r.items && r.items.length > 0)
      ? r.items.map((it) => `${it.name}: ${it.quantity} ${it.unit}`).join(', ')
      : '-';

    return {
      date: (r.dispatchDate || '').trim(),
      time: (r.dispatchTime || '').trim(),
      unitName: r.unitName || '',
      mealType: r.mealType || '',
      menuItems: r.menuItems || '',
      personCount: r.personCount || 0,
      quantity: r.primaryQuantity || 0,
      unit: (r.primaryUnit || 'kg').toUpperCase(),
      breakdown: breakdownText,
      vehicle: r.vehicleOrDriver || '-',
      status: r.status || 'DISPATCHED',
    };
  });
}

function getFileNameBase(fromDate?: string, toDate?: string): string {
  if (fromDate && toDate) {
    return `Food_Transport_Report_${fromDate}_to_${toDate}`;
  }
  if (fromDate) {
    return `Food_Transport_Report_${fromDate}`;
  }
  return `Food_Transport_Report_${new Date().toISOString().slice(0, 10)}`;
}

/**
 * 1. Export Food Transport Report to CSV
 */
export function exportTransportToCSV(
  records: FoodTransportRecord[],
  fromDate?: string,
  toDate?: string
): void {
  if (records.length === 0) {
    alert('No transport records available to export.');
    return;
  }

  const formatted = formatTransportReportData(records);
  const totalPersons = formatted.reduce((sum, item) => sum + item.personCount, 0);

  const CSV_HEADERS = [
    'DATE',
    'TIME',
    'SECTOR / UNIT',
    'FOOD TYPE',
    'MENU ITEMS',
    'PERSON COUNT',
    'QUANTITY',
    'UNIT',
    'BREAKDOWN',
    'VEHICLE / DRIVER',
    'STATUS',
  ];

  const rows = formatted.map((item) => [
    `"${item.date}"`,
    `"${item.time}"`,
    `"${item.unitName.replace(/"/g, '""')}"`,
    `"${item.mealType.replace(/"/g, '""')}"`,
    `"${item.menuItems.replace(/"/g, '""')}"`,
    item.personCount,
    item.quantity,
    `"${item.unit}"`,
    `"${item.breakdown.replace(/"/g, '""')}"`,
    `"${item.vehicle.replace(/"/g, '""')}"`,
    `"${item.status}"`,
  ]);

  // Last Total Row
  const totalRow = [
    `"TOTAL / SUMMARY"`,
    `""`,
    `"Total Dispatches: ${records.length}"`,
    `""`,
    `""`,
    totalPersons,
    `""`,
    `""`,
    `""`,
    `""`,
    `""`,
  ];

  const csvContent = [CSV_HEADERS.join(','), ...rows.map((r) => r.join(',')), totalRow.join(',')].join('\n');

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
 * 2. Export Food Transport Report to Excel (.xlsx)
 */
export function exportTransportToExcel(
  records: FoodTransportRecord[],
  fromDate?: string,
  toDate?: string
): void {
  if (records.length === 0) {
    alert('No transport records available to export.');
    return;
  }

  const formatted = formatTransportReportData(records);
  const totalPersons = formatted.reduce((sum, item) => sum + item.personCount, 0);

  const dataRows = formatted.map((item) => [
    item.date,
    item.time,
    item.unitName,
    item.mealType,
    item.menuItems,
    item.personCount,
    item.quantity,
    item.unit,
    item.breakdown,
    item.vehicle,
    item.status,
  ]);

  // Total Summary row
  const totalRow = [
    'TOTAL / SUMMARY',
    '',
    `Total Dispatches: ${records.length}`,
    '',
    '',
    totalPersons,
    '',
    '',
    '',
    '',
    '',
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([TRANSPORT_REPORT_HEADERS, ...dataRows, totalRow]);
  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

  // 1. Highlight Headings: Rich Emerald fill, bold white text
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

  // 2. Format Data Rows
  dataRows.forEach((_, rowIdx) => {
    const excelRow = rowIdx + 2;
    colLetters.forEach((col) => {
      const cellRef = `${col}${excelRow}`;
      if (worksheet[cellRef]) {
        const isPersonsCol = col === 'F';
        const isQtyCol = col === 'G';
        worksheet[cellRef].s = {
          font: { name: 'Calibri', sz: 10, bold: isPersonsCol || isQtyCol },
          alignment: {
            horizontal: isPersonsCol || isQtyCol ? 'right' : 'left',
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

  // 3. Highlight Total Row
  const totalRowIdx = dataRows.length + 2;
  colLetters.forEach((col) => {
    const cellRef = `${col}${totalRowIdx}`;
    if (!worksheet[cellRef]) {
      worksheet[cellRef] = { t: 's', v: '' };
    }
    const isPersonsCol = col === 'F';
    worksheet[cellRef].s = {
      fill: { fgColor: { rgb: 'ECFDF5' } },
      font: {
        name: 'Calibri',
        sz: isPersonsCol ? 12 : 11,
        bold: true,
        color: { rgb: '065F46' },
      },
      alignment: {
        horizontal: isPersonsCol ? 'right' : 'left',
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

  // Enable Auto-filter
  worksheet['!autofilter'] = { ref: `A1:K${dataRows.length + 1}` };

  worksheet['!cols'] = [
    { wch: 12 }, // Date
    { wch: 10 }, // Time
    { wch: 26 }, // Sector / Unit
    { wch: 14 }, // Food Type
    { wch: 32 }, // Menu Items
    { wch: 10 }, // Persons
    { wch: 10 }, // Quantity
    { wch: 8 },  // Unit
    { wch: 30 }, // Breakdown
    { wch: 20 }, // Vehicle / Driver
    { wch: 14 }, // Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Food Transport');

  XLSX.writeFile(workbook, `${getFileNameBase(fromDate, toDate)}.xlsx`);
}

/**
 * 3. Export Food Transport Report to PDF
 */
export function exportTransportToPDF(
  records: FoodTransportRecord[],
  fromDate?: string,
  toDate?: string
): void {
  if (records.length === 0) {
    alert('No transport records available to export.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const formatted = formatTransportReportData(records);
  const totalPersons = formatted.reduce((sum, item) => sum + item.personCount, 0);
  const totalKg = records
    .filter((r) => r.primaryUnit === 'kg')
    .reduce((sum, r) => sum + (r.primaryQuantity || 0), 0);
  const totalCount = records
    .filter((r) => r.primaryUnit === 'count')
    .reduce((sum, r) => sum + (r.primaryQuantity || 0), 0);

  // Header Banner
  doc.setFillColor(5, 150, 105); // Emerald 600
  doc.rect(0, 0, 842, 60, 'F');

  // Company Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Esstee Exports India Private Limited', 40, 26);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Food Transport & Sector Dispatch Ledger', 40, 44);

  // Date Range on right
  const dateRangeStr =
    fromDate && toDate
      ? `Date Range: ${fromDate} to ${toDate}`
      : fromDate
      ? `Date: ${fromDate}`
      : `Generated: ${new Date().toLocaleDateString()}`;
  doc.setFontSize(9);
  doc.text(dateRangeStr, 802, 36, { align: 'right' });

  // Summary Metrics Bar
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(1);
  doc.roundedRect(40, 72, 762, 34, 4, 4, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Total Dispatches: ${records.length}`, 60, 93);
  doc.text(`Total Headcount / Persons Fed: ${totalPersons}`, 240, 93);
  doc.text(`Dispatched in Kg: ${totalKg.toFixed(1)} Kg`, 480, 93);
  doc.text(`Dispatched in Count: ${totalCount} Nos`, 660, 93);

  // AutoTable data
  const tableData = formatted.map((item) => [
    item.date,
    item.time,
    item.unitName,
    item.mealType,
    item.menuItems,
    String(item.personCount),
    `${item.quantity} ${item.unit}`,
    item.breakdown,
    item.vehicle,
    item.status,
  ]);

  autoTable(doc, {
    startY: 118,
    margin: { left: 40, right: 40 },
    head: [[
      'Date',
      'Time',
      'Sector / Unit',
      'Particular',
      'Menu Items',
      'Headcount',
      'Quantity',
      'Item Breakdown',
      'Vehicle / Driver',
      'Status',
    ]],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 55, halign: 'center' },
      1: { cellWidth: 45, halign: 'center' },
      2: { cellWidth: 105 },
      3: { cellWidth: 65, halign: 'center' },
      4: { cellWidth: 140 },
      5: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 60, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 115 },
      8: { cellWidth: 70 },
      9: { cellWidth: 52, halign: 'center' },
    },
    didDrawPage: () => {
      const pageStr = `Page ${doc.internal.pages.length - 1}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Esstee Exports Canteen System  |  ${pageStr}`,
        421,
        doc.internal.pageSize.height - 15,
        { align: 'center' }
      );
    },
  });

  doc.save(`${getFileNameBase(fromDate, toDate)}.pdf`);
}
