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

  // Format Date to DD-MM-YYYY (e.g. 23-09-2026) matching Image 1
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

  // Format Time to 12hr hh:mm am/pm (e.g. 11:21 am) matching Image 1
  const formattedTime = (() => {
    if (order.issuedAt) {
      const match = order.issuedAt.match(/^(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
      if (match) {
        return `${match[1]} ${(match[2] || '').toLowerCase()}`.trim();
      }
      return order.issuedAt;
    }
    const d = order.timestamp ? new Date(order.timestamp) : new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
  })();

  // Get Tamil Meal Name matching Image 1
  const tamilMealName = (() => {
    const slot = canteenService.getMealSlots().find((s) => s.name === order.meal);
    if (slot?.tamilDisplayName) {
      return slot.tamilDisplayName.split('/')[0].trim();
    }
    const lower = (order.meal || '').toLowerCase();
    if (lower.includes('breakfast')) return 'காலை உணவு';
    if (lower.includes('lunch')) return 'மதிய உணவு';
    if (lower.includes('tea') || lower.includes('coffee')) return 'தேநீர் / காபி';
    if (lower.includes('snack')) return 'மாலை சிற்றுண்டி';
    if (lower.includes('dinner')) return 'இரவு உணவு';
    return order.meal;
  })();

  const rateVal = order.rate ?? 40;
  const qtyVal = order.qty ?? 1;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 80mm/58mm ESC/POS Ultra-Compact Thermal Slip matching Image 1 */}
      <div
        id="tvsSlipPrintArea"
        className="w-[270px] max-w-[275px] bg-white text-black font-sans p-2.5 rounded shadow-sm border border-slate-300 select-none"
      >
        {/* Main 2-Column Side-by-Side Content */}
        <div className="flex items-start justify-between gap-2">
          
          {/* Left Column: Campus Canteen, QR Code, ORD UUID, Token, Name, ID */}
          <div className="w-[118px] shrink-0 flex flex-col items-start text-left">
            <span className="font-bold text-black text-[13px] tracking-tight mb-1 whitespace-nowrap">
              Campus Canteen
            </span>

            <div className="p-0.5 bg-white border border-black rounded-none flex items-center justify-center">
              <QRCodeSVG
                value={order.orderUuid}
                size={95}
                level="M"
                includeMargin={false}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>

            <div className="text-[9px] font-mono font-medium text-black tracking-tighter mt-1 select-all break-all leading-tight">
              {order.orderUuid}
            </div>

            {/* Token # 101 */}
            <div className="text-[15px] font-black text-black mt-1 leading-tight tracking-tight">
              Token # {order.token}
            </div>

            {/* Name: Hari */}
            <div className="text-xs font-semibold text-black mt-0.5 leading-tight truncate max-w-[115px]">
              Name: {order.name}
            </div>

            {/* ID: EMP-1004 */}
            <div className="text-xs font-semibold text-black mt-0.5 leading-tight truncate max-w-[115px]">
              ID: {order.userId}
            </div>
          </div>

          {/* Right Column: QTY, RS: [40], [Tamil Box], [English Box], Time */}
          <div className="flex-1 min-w-0 flex flex-col justify-start pl-1 text-left">
            
            {/* Top Right: Big Amount Box [ RS: 40 ] */}
            <div className="border-2 border-black px-2 py-1 flex items-baseline justify-between">
              <span className="text-lg sm:text-xl font-bold text-black font-sans leading-none">
                RS:
              </span>
              <span className="text-5xl sm:text-6xl font-black text-black leading-none tracking-tight">
                {rateVal}
              </span>
            </div>

            {/* QTY Box directly below */}
            <div className="border-2 border-black text-center py-0.5 px-1 font-bold text-xs sm:text-sm text-black mt-1 mb-1.5">
              QTY: {qtyVal}
            </div>

            {/* Tamil Meal Name Box */}
            <div className="border-2 border-black text-center py-0.5 px-1 font-bold text-xs text-black leading-tight">
              {tamilMealName}
            </div>

            {/* English Meal Name Box (Stacked directly below) */}
            <div className="border-2 border-t-0 border-black text-center py-0.5 px-1 font-black text-base text-black leading-tight">
              {order.meal}
            </div>

            {/* Time: 11:21 am | 23-09-2026 */}
            <div className="text-[9px] sm:text-[9.5px] text-black font-sans font-medium mt-1.5 leading-tight whitespace-nowrap">
              Time: {formattedTime} | {formattedDate}
            </div>

          </div>

        </div>

        {/* Bottom Dashed Separator Line */}
        <div className="w-full border-t border-dashed border-black my-1.5" />

        {/* Footer Notice (Centered matching Image 1) */}
        <div className="w-full text-center text-[10px] font-sans font-medium text-black tracking-tight">
          Present the slip at canteen counter
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
