import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Order } from '../../types';
import { canteenService } from '../../services/canteenService';
import { Printer, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ThermalReceiptProps {
  order: Order;
  onSendToScanner?: (orderUuid: string) => void;
  onPrint?: () => void;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  order,
  onSendToScanner,
  onPrint,
}) => {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  // Format Date to DD-MM-YYYY (e.g. 22-09-2026) matching reference photo
  const formattedDate = (() => {
    if (order.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(order.dateStr)) {
      const [y, m, d] = order.dateStr.split('-');
      return `${d}-${m}-${y}`;
    }
    const d = order.timestamp ? new Date(order.timestamp) : new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${d.getFullYear()}`;
  })();

  // Format Time to 12hr hh:mm AM/PM (e.g. 11:18 AM) matching reference photo
  const formattedTime = (() => {
    if (order.issuedAt) {
      const match = order.issuedAt.match(/^(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
      if (match) {
        return `${match[1]} ${match[2] || ''}`.trim();
      }
      return order.issuedAt;
    }
    const d = order.timestamp ? new Date(order.timestamp) : new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  })();

  // Get menu items text (Tamil / English)
  const menuText = (() => {
    if (Array.isArray(order.items) && order.items.length > 0) {
      return order.items
        .map((it) => (typeof it === 'string' ? it : it?.description || it?.name || ''))
        .filter(Boolean)
        .join(', ');
    }
    return (
      canteenService.getMealSlots().find((s) => s.name === order.meal)?.description ||
      'Standard Meal Serving'
    );
  })();

  const rateVal = order.rate ?? 40;
  const qtyVal = order.qty ?? 1;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 80mm ESC/POS Compact Thermal Slip matching reference photo */}
      <div
        id="tvsSlipPrintArea"
        className="w-[330px] sm:w-[350px] bg-white text-slate-950 font-sans p-3 sm:p-4 rounded shadow-md border border-slate-300 select-none"
      >
        {/* Main 2-Column Side-by-Side Content */}
        <div className="flex items-start justify-between gap-3">
          
          {/* Left Column: Campus Canteen + QR Code + Order UUID */}
          <div className="w-[125px] flex flex-col items-center justify-start shrink-0 text-center">
            <span className="font-bold text-slate-900 text-sm tracking-tight mb-1 whitespace-nowrap">
              Campus Canteen
            </span>

            <div className="p-1 bg-white border border-slate-900 rounded-xs flex items-center justify-center">
              <QRCodeSVG
                value={order.orderUuid}
                size={110}
                level="M"
                includeMargin={false}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>

            <div className="text-[9px] font-mono font-bold text-slate-900 tracking-tighter text-center mt-1 select-all break-all leading-tight">
              {order.orderUuid}
            </div>
          </div>

          {/* Right Column: Token, Rate, QTY, Name, ID/Dept, Boxed Meal, Menu, Time */}
          <div className="flex-1 min-w-0 flex flex-col justify-start text-left pl-1">
            {/* Token Number */}
            <div className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-none mb-1">
              Token # {order.token}
            </div>

            {/* Rate & QTY (Both numbers bold as requested) */}
            <div className="text-xs sm:text-sm text-slate-900 flex items-center gap-4 mb-1">
              <span>
                Rate: <strong className="font-black text-slate-950 text-sm sm:text-base">{rateVal}</strong>
              </span>
              <span>
                QTY: <strong className="font-black text-slate-950 text-sm sm:text-base">{qtyVal}</strong>
              </span>
            </div>

            {/* Employee Name */}
            <div className="text-xs text-slate-900 font-medium truncate leading-snug">
              Name: <span className="font-semibold text-slate-950">{order.name}</span>
            </div>

            {/* ID & Dept */}
            <div className="text-[11px] text-slate-800 font-medium truncate leading-snug">
              ID: {order.userId} | Dept: {order.dept}
            </div>

            {/* Framed Meal Slot Box */}
            <div className="border-2 border-slate-950 px-2 py-0.5 my-1 text-center font-black tracking-wider uppercase text-xs sm:text-sm text-slate-950">
              {order.meal}
            </div>

            {/* Menu Items */}
            <div className="text-[10px] text-slate-900 leading-tight line-clamp-2 mt-0.5">
              <span className="font-medium">Menu: </span>
              <span className="font-normal">{menuText}</span>
            </div>

            {/* Time & Date */}
            <div className="text-[10px] text-slate-900 font-mono font-medium mt-1 leading-none">
              Time: {formattedTime} | {formattedDate}
            </div>
          </div>

        </div>

        {/* Bottom Dashed Separator Line */}
        <div className="w-full border-t border-dashed border-slate-700 my-1.5" />

        {/* Footer Notice */}
        <div className="w-full text-right text-[10px] font-medium text-slate-800 tracking-tight">
          Present slip at food counter
        </div>
      </div>

      {/* Quick Action buttons (hidden on physical print) */}
      <div className="flex flex-wrap items-center justify-center gap-2 print:hidden">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span>Physical Print (80mm)</span>
        </button>

        {onSendToScanner && (
          <button
            onClick={() => onSendToScanner(order.orderUuid)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <span>Scan at Counter</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center space-x-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 print:hidden font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>Compact Thermal Slip Dispensed & Ready</span>
      </div>
    </div>
  );
};
