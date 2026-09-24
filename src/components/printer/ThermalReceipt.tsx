import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { Order } from '../../types';
import { canteenService } from '../../services/canteenService';
import { Printer, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ThermalReceiptProps {
  order?: Order;
  orders?: Order[];
  onSendToScanner?: (orderUuid: string) => void;
  onPrint?: () => void;
}

// Single slip layout matching user reference specifications
const ThermalSlipContent: React.FC<{
  ord: Order;
  rateVal: number;
  formattedDate: string;
  formattedTime: string;
  tamilMealName: string;
}> = ({ ord, rateVal, formattedDate, formattedTime, tamilMealName }) => {
  return (
    <div className="tvs-slip-page w-[275px] max-w-[280px] bg-white text-black font-sans p-2 select-none border-0 shadow-none outline-none">
      {/* Main 2-Column Side-by-Side Content */}
      <div className="flex items-stretch justify-between gap-2">
        {/* Left Column: Campus Canteen, QR Code, ORD UUID, Token, Name, ID */}
        <div className="w-[124px] shrink-0 flex flex-col items-start text-left">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="font-bold text-black text-[13.5px] tracking-tight whitespace-nowrap">
              Campus Canteen
            </span>
          </div>

          <div className="p-0.5 bg-white border border-black rounded-none flex items-center justify-center">
            <QRCodeSVG
              value={ord.orderUuid}
              size={106}
              level="M"
              includeMargin={false}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>

          <div className="text-[9px] font-mono font-medium text-black tracking-tighter mt-1 select-all break-all leading-tight">
            {ord.orderUuid}
          </div>

          {/* Token # */}
          <div className="text-[15px] font-black text-black mt-1 leading-tight tracking-tight">
            Token # {ord.token}
          </div>

          {/* Name */}
          <div className="text-xs font-semibold text-black mt-0.5 leading-tight truncate max-w-[122px]">
            Name: {ord.name}
          </div>

          {/* ID */}
          <div className="text-xs font-semibold text-black mt-0.5 leading-tight truncate max-w-[122px]">
            ID: {ord.userId}
          </div>
        </div>

        {/* Right Column: Rate Box, QTY, Food Type Box (Tamil & English), Time & Date */}
        <div className="flex-1 min-w-0 flex flex-col justify-between pl-1 text-left">
          {/* Top Right: Big Amount Box [ RS: 40 ] - Number centered even for single digit */}
          <div className="border-2 border-black py-1 px-1.5 flex items-center justify-center relative min-h-[66px] w-full">
            <span className="absolute top-1 left-1.5 text-xs sm:text-sm font-black text-black font-sans leading-none tracking-tight">
              RS:
            </span>
            <span className="text-[52px] sm:text-[58px] font-black text-black leading-none tracking-tight text-center">
              {rateVal}
            </span>
          </div>

          {/* QTY Box: only number, no (Slip 1 of 3) */}
          <div className="border-2 border-black text-center py-0.5 px-1 font-black text-xs sm:text-sm text-black my-1">
            QTY: 1
          </div>

          {/* Food Type Box: Bold Tamil & English stacked together */}
          <div className="border-2 border-black text-center py-0.5 px-1 flex flex-col justify-center">
            <div className="font-black text-[13px] sm:text-sm text-black leading-tight">
              {tamilMealName}
            </div>
            <div className="border-t border-black font-black text-sm sm:text-base text-black leading-tight pt-0.5 mt-0.5">
              {ord.meal}
            </div>
          </div>

          {/* Time & Date: to bottom directly above the dashed line */}
          <div className="mt-auto pt-1.5 text-[9.5px] sm:text-[10px] text-black font-sans font-bold leading-tight whitespace-nowrap">
            {formattedTime} | {formattedDate}
          </div>
        </div>
      </div>

      {/* Bottom Dashed Separator Line */}
      <div className="w-full border-t border-dashed border-black my-1.5" />

      {/* Footer Notice: User requirement: 'in token in botom mention only present the slip aat canteen counter' */}
      <div className="w-full text-center text-[10px] font-sans font-bold text-black tracking-tight">
        Present the slip at canteen counter
      </div>
    </div>
  );
};

export interface ThermalReceiptHandle {
  printAll: () => Promise<void>;
  printSlip: (ord: Order) => Promise<void>;
}

interface ThermalReceiptProps {
  order?: Order;
  orders?: Order[];
  onSendToScanner?: (orderUuid: string) => void;
  onPrint?: () => void;
  onPrintingStateChange?: (isPrinting: boolean) => void;
}

export const ThermalReceipt = React.forwardRef<ThermalReceiptHandle, ThermalReceiptProps>((
  {
    order,
    orders,
    onSendToScanner,
    onPrint,
    onPrintingStateChange,
  },
  ref
) => {
  const ordersList: Order[] = orders && orders.length > 0 
    ? orders 
    : (order ? [order] : []);

  const [activePrintOrder, setActivePrintOrder] = React.useState<Order | null>(null);
  const [isPrintingBatch, setIsPrintingBatch] = React.useState<boolean>(false);
  const [printingIndex, setPrintingIndex] = React.useState<number>(0);

  // Hook body class for print isolation
  useEffect(() => {
    if (ordersList.length > 0 && typeof document !== 'undefined') {
      document.body.classList.add('has-receipt-print');
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('has-receipt-print');
      }
    };
  }, [ordersList.length]);

  // Print a single specific slip
  const printSingleSlip = async (ord: Order) => {
    setActivePrintOrder(ord);
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      window.print();
    } catch (e) {
      console.warn('Single slip print error:', e);
    }
    setTimeout(() => setActivePrintOrder(null), 1000);
  };

  // Sequential Printing: Prints each slip in its own individual print job one by one
  const printSequentially = async (listToPrint: Order[] = ordersList) => {
    if (!listToPrint || listToPrint.length === 0) return;
    setIsPrintingBatch(true);
    if (onPrintingStateChange) onPrintingStateChange(true);

    for (let i = 0; i < listToPrint.length; i++) {
      setPrintingIndex(i + 1);
      setActivePrintOrder(listToPrint[i]);
      // Give React 250ms to render this exact single slip into #canteen-print-portal
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        window.print();
      } catch (err) {
        console.warn(`Print error on slip ${i + 1}:`, err);
      }
      if (i < listToPrint.length - 1) {
        // Pause between print dialogs so the printer driver queue processes each ticket
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    setActivePrintOrder(null);
    setIsPrintingBatch(false);
    setPrintingIndex(0);
    if (onPrintingStateChange) onPrintingStateChange(false);
  };

  React.useImperativeHandle(ref, () => ({
    printAll: () => printSequentially(ordersList),
    printSlip: (ord: Order) => printSingleSlip(ord),
  }));

  if (ordersList.length === 0) return null;

  const handlePrintAll = () => {
    if (onPrint) {
      onPrint();
    } else {
      printSequentially(ordersList);
    }
  };

  // Helper to format Date to DD-MM-YYYY
  const getFormattedDate = (ord: Order) => {
    if (ord.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(ord.dateStr)) {
      const [y, m, d] = ord.dateStr.split('-');
      return `${d}-${m}-${y}`;
    }
    const d = ord.timestamp ? new Date(ord.timestamp) : new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${d.getFullYear()}`;
  };

  // Helper to format Time to 12hr hh:mm am/pm
  const getFormattedTime = (ord: Order) => {
    if (ord.issuedAt) {
      const match = ord.issuedAt.match(/^(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
      if (match) {
        return `${match[1]} ${(match[2] || '').toLowerCase()}`.trim();
      }
      return ord.issuedAt;
    }
    const d = ord.timestamp ? new Date(ord.timestamp) : new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
  };

  // Helper for pure Tamil Meal Name (no brackets, no English)
  const getTamilMealName = (meal: string) => {
    const slot = canteenService.getMealSlots().find((s) => s.name === meal);
    let name = slot?.tamilDisplayName;
    if (!name) {
      const lower = (meal || '').toLowerCase();
      if (lower.includes('tiffin') || lower.includes('breakfast')) name = 'காலை உணவு';
      else if (lower.includes('lunch')) name = 'மதிய உணவு';
      else if (lower.includes('tea') || lower.includes('snack')) name = 'தேநீர் & ஸ்நாக்ஸ்';
      else name = meal;
    }
    if (name === 'டிபன்') name = 'காலை உணவு';
    // Strictly remove any parentheses, brackets, or English alphabet characters
    return name.replace(/\(.*?\)/g, '').replace(/[a-zA-Z]/g, '').trim();
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* On-Screen Receipt Preview Container (Hidden during physical print) */}
      <div
        id="tvsSlipPrintArea"
        className="flex flex-col items-center gap-3 print:hidden max-h-[360px] overflow-y-auto p-1 w-full"
      >
        {ordersList.map((ord, idx) => (
          <div key={`preview-wrap-${ord.id || ord.orderUuid || idx}`} className="flex flex-col items-center gap-1.5 w-full">
            {ordersList.length > 1 && (
              <div className="flex items-center justify-between w-[270px] px-1 text-[11px] font-mono text-slate-500 font-bold">
                <span>Slip {idx + 1} of {ordersList.length}</span>
                <button
                  type="button"
                  onClick={() => printSingleSlip(ord)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-bold border border-slate-300 transition-all cursor-pointer"
                >
                  Print Slip #{ord.token}
                </button>
              </div>
            )}
            <ThermalSlipContent
              ord={ord}
              rateVal={ord.rate ?? 40}
              formattedDate={getFormattedDate(ord)}
              formattedTime={getFormattedTime(ord)}
              tamilMealName={getTamilMealName(ord.meal)}
            />
          </div>
        ))}
      </div>

      {/* Dedicated Portal Directly on document.body for Physical Printing */}
      {/* CRITICAL: ONLY 1 SLIP IS RENDERED PER PRINT JOB SO IT NEVER PRINTS SIDE-BY-SIDE */}
      {typeof document !== 'undefined' && createPortal(
        <div id="canteen-print-portal">
          {(() => {
            const ordToPrint = activePrintOrder || ordersList[0];
            if (!ordToPrint) return null;
            return (
              <ThermalSlipContent
                key={`portal-slip-${ordToPrint.id || ordToPrint.orderUuid}`}
                ord={ordToPrint}
                rateVal={ordToPrint.rate ?? 40}
                formattedDate={getFormattedDate(ordToPrint)}
                formattedTime={getFormattedTime(ordToPrint)}
                tamilMealName={getTamilMealName(ordToPrint.meal)}
              />
            );
          })()}
        </div>,
        document.body
      )}

      {/* Quick Action buttons (hidden on physical print) */}
      <div className="flex flex-wrap items-center justify-center gap-2 print:hidden">
        <button
          onClick={handlePrintAll}
          disabled={isPrintingBatch}
          className="px-4 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span>
            {isPrintingBatch
              ? `Printing Slip ${printingIndex} of ${ordersList.length}...`
              : ordersList.length > 1
              ? `Print All ${ordersList.length} Slips (One by One)`
              : 'Physical Print (80mm)'}
          </span>
        </button>

        {onSendToScanner && (
          <button
            onClick={() => onSendToScanner(ordersList[0].orderUuid)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <span>Scan at Counter</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center space-x-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 print:hidden font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>
          {ordersList.length > 1 
            ? `${ordersList.length} Individual Slips Generated (${ordersList.length} Unique QRs • Prints One-by-One)` 
            : 'Compact Thermal Slip Ready'}
        </span>
      </div>
    </div>
  );
});

ThermalReceipt.displayName = 'ThermalReceipt';
