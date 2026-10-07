import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { FoodTransportRecord } from '../types';

export const TRANSPORT_REPORT_HEADERS = [
  'Date',
  'Time',
  'Sector / Factory',
  'Particulars',
  'Menu Items Dispatched',
  'Persons',
  'Quantity',
  'Unit',
  'Item Breakdown',
  'Vehicle / Driver',
  'Status',
];

export function formatTransportReportData(records: FoodTransportRecord[]) {
  return records.map((r) => {
    const breakdownText =
      r.items && r.items.length > 0
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
 * 1. Export Food Transport Report to CSV (With UTF-8 BOM for Tamil Unicode support)
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
    'SECTOR / FACTORY',
    'PARTICULARS',
    'MENU ITEMS DISPATCHED',
    'PERSON COUNT',
    'QUANTITY',
    'UNIT',
    'ITEM BREAKDOWN',
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

  // Summary Row at bottom
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

  // Prepend \uFEFF (UTF-8 Byte Order Mark) so Microsoft Excel opens Tamil Unicode text properly without corruption
  const BOM = '\uFEFF';
  const csvContent =
    BOM +
    [CSV_HEADERS.join(','), ...rows.map((r) => r.join(',')), totalRow.join(',')].join('\r\n');

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
 * - Styled Emerald headers
 * - Supports Tamil letters through Nirmala UI / Segoe UI Unicode fonts
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
        font: { name: 'Nirmala UI, Segoe UI, Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
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

  // 2. Format Data Rows with Nirmala UI (Windows native Tamil Indic font)
  dataRows.forEach((_, rowIdx) => {
    const excelRow = rowIdx + 2;
    colLetters.forEach((col) => {
      const cellRef = `${col}${excelRow}`;
      if (worksheet[cellRef]) {
        const isPersonsCol = col === 'F';
        const isQtyCol = col === 'G';
        worksheet[cellRef].s = {
          font: { name: 'Nirmala UI, Segoe UI, Calibri', sz: 10, bold: isPersonsCol || isQtyCol },
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
        name: 'Nirmala UI, Segoe UI, Calibri',
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
    { wch: 28 }, // Sector / Unit
    { wch: 14 }, // Particulars
    { wch: 38 }, // Menu Items
    { wch: 10 }, // Persons
    { wch: 10 }, // Quantity
    { wch: 8 },  // Unit
    { wch: 35 }, // Breakdown
    { wch: 20 }, // Vehicle / Driver
    { wch: 14 }, // Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Food Transport');
  XLSX.writeFile(workbook, `${getFileNameBase(fromDate, toDate)}.xlsx`);
}

/**
 * 3. Export Food Transport Report to PDF with 100% Native Tamil Font Support
 * Uses html2canvas to render full native Tamil typography (vowels, matras, pulli, ligatures) into a crystal clear 2x DPI PDF document.
 */
export async function exportTransportToPDF(
  records: FoodTransportRecord[],
  fromDate?: string,
  toDate?: string
): Promise<void> {
  if (records.length === 0) {
    alert('No transport records available to export.');
    return;
  }

  const formatted = formatTransportReportData(records);
  const totalPersons = formatted.reduce((sum, item) => sum + item.personCount, 0);
  const totalKg = records
    .filter((r) => r.primaryUnit === 'kg')
    .reduce((sum, r) => sum + (r.primaryQuantity || 0), 0);
  const totalCount = records
    .filter((r) => r.primaryUnit === 'count')
    .reduce((sum, r) => sum + (r.primaryQuantity || 0), 0);

  const dateRangeStr =
    fromDate && toDate
      ? `${fromDate} to ${toDate}`
      : fromDate
      ? `${fromDate}`
      : `All Recorded Dates`;

  // Create an offscreen DOM container styled specifically for PDF printing
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1120px';
  container.style.backgroundColor = '#ffffff';
  container.style.fontFamily = "'Inter', 'Noto Sans Tamil', 'Nirmala UI', system-ui, -apple-system, sans-serif";
  container.style.padding = '32px';
  container.style.color = '#0f172a';
  container.style.boxSizing = 'border-box';

  container.innerHTML = `
    <div style="border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div style="font-size: 24px; font-weight: 900; color: #047857; letter-spacing: -0.5px;">Esstee Exports India Private Limited</div>
        <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 4px;">Food Transport & Sector Dispatch Report / உணவு போக்குவரத்து அறிக்கை</div>
      </div>
      <div style="text-align: right;">
        <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 11px; font-weight: 700; padding: 4px 10px; rounded: 8px; border-radius: 6px;">
          Date Range: ${dateRangeStr}
        </div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Generated: ${new Date().toLocaleString()}</div>
      </div>
    </div>

    <!-- KPI Metric Cards Bar -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Dispatches</div>
        <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 4px;">${records.length} <span style="font-size: 11px; font-weight: 600; color: #64748b;">Trips</span></div>
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Persons Fed / Headcount</div>
        <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 4px;">${totalPersons} <span style="font-size: 11px; font-weight: 600; color: #64748b;">Employees</span></div>
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Dispatched in Kg</div>
        <div style="font-size: 20px; font-weight: 900; color: #047857; margin-top: 4px;">${totalKg.toFixed(1)} <span style="font-size: 11px; font-weight: 600; color: #64748b;">Kg</span></div>
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Dispatched in Count</div>
        <div style="font-size: 20px; font-weight: 900; color: #047857; margin-top: 4px;">${totalCount} <span style="font-size: 11px; font-weight: 600; color: #64748b;">Pieces</span></div>
      </div>
    </div>

    <!-- Data Table with Full Native Tamil Typography -->
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background-color: #059669; color: #ffffff;">
          <th style="padding: 10px 8px; border: 1px solid #047857; text-align: center; font-weight: 800; font-size: 10px; text-transform: uppercase;">Date & Time</th>
          <th style="padding: 10px 8px; border: 1px solid #047857; text-align: left; font-weight: 800; font-size: 10px; text-transform: uppercase;">Sector / Factory</th>
          <th style="padding: 10px 8px; border: 1px solid #047857; text-align: center; font-weight: 800; font-size: 10px; text-transform: uppercase;">Particulars</th>
          <th style="padding: 10px 8px; border: 1px solid #047857; text-align: left; font-weight: 800; font-size: 10px; text-transform: uppercase;">Menu Items Dispatched (உணவு பட்டியல்)</th>
          <th style="padding: 10px 8px; border: 1px solid #047857; text-align: right; font-weight: 800; font-size: 10px; text-transform: uppercase;">Headcount</th>
          <th style="padding: 10px 8px; border: 1px solid #047857; text-align: right; font-weight: 800; font-size: 10px; text-transform: uppercase;">Quantity</th>
          <th style="padding: 10px 8px; border: 1px solid #047857; text-align: left; font-weight: 800; font-size: 10px; text-transform: uppercase;">Vehicle / Driver</th>
          <th style="padding: 10px 8px; border: 1px solid #047857; text-align: center; font-weight: 800; font-size: 10px; text-transform: uppercase;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${formatted
          .map((item, idx) => {
            const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            return `
              <tr style="background-color: ${rowBg};">
                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap;">
                  <div style="font-weight: 700;">${item.date}</div>
                  <div style="font-size: 9px; color: #64748b;">${item.time}</div>
                </td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">${item.unitName}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">
                  <span style="display: inline-block; padding: 2px 8px; font-weight: 700; font-size: 10px; border-radius: 9999px; background-color: ${
                    item.mealType === 'Tiffin' ? '#fef3c7; color: #92400e;' : item.mealType === 'Lunch' ? '#d1fae5; color: #065f46;' : '#dbeafe; color: #1e40af;'
                  }">
                    ${item.mealType}
                  </span>
                </td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; color: #1e293b; max-width: 320px; line-height: 1.4;">
                  <div style="font-size: 11px;">${item.menuItems}</div>
                  ${
                    item.breakdown !== '-'
                      ? `<div style="font-size: 9px; color: #047857; margin-top: 3px; font-weight: 600;">↳ ${item.breakdown}</div>`
                      : ''
                  }
                </td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: 800; font-family: monospace;">${item.personCount}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: 800; font-family: monospace;">
                  ${item.quantity} <span style="font-size: 9px; color: #64748b; font-weight: 600;">${item.unit}</span>
                </td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; color: #334155;">${item.vehicle}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">
                  <span style="color: #047857; font-weight: 700; font-size: 10px;">✓ ${item.status}</span>
                </td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
      <tfoot>
        <tr style="background-color: #ecfdf5; font-weight: 800; color: #065f46;">
          <td colspan="4" style="padding: 10px 8px; border: 1px solid #059669; text-align: left; font-size: 11px;">
            TOTAL SUMMARY (${records.length} Dispatches)
          </td>
          <td style="padding: 10px 8px; border: 1px solid #059669; text-align: right; font-size: 12px; font-family: monospace;">
            ${totalPersons}
          </td>
          <td colspan="3" style="padding: 10px 8px; border: 1px solid #059669; text-align: left; font-size: 10px;">
            ${totalKg > 0 ? `Total Kg: ${totalKg.toFixed(1)} Kg` : ''} ${totalCount > 0 ? ` • Total Count: ${totalCount} Pieces` : ''}
          </td>
        </tr>
      </tfoot>
    </table>

    <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
      <span>Esstee Exports Smart Canteen System  •  Food Transport Audit Report</span>
      <span>Confidential - For Internal Factory Administration</span>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2, // 2x DPI for crystal clear vector-like typography
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pdfWidth - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    if (imgHeight <= pdfHeight - margin * 2) {
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, imgHeight);
    } else {
      // Split across multiple pages if table exceeds single landscape sheet
      let heightLeft = imgHeight;
      let position = margin;
      const pageHeight = pdfHeight - margin * 2;

      pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }

    pdf.save(`${getFileNameBase(fromDate, toDate)}.pdf`);
  } catch (err) {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    console.error('PDF generation error:', err);
    alert('Failed to generate PDF. Please try again.');
  }
}
