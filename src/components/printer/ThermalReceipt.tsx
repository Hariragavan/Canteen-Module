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

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 80mm ESC/POS Thermal Slip Representation */}
      <div
        id="tvsSlipPrintArea"
        className="w-72 bg-white text-slate-950 font-mono text-xs p-5 rounded-t-sm shadow-elevated border-t-8 border-slate-900 thermal-paper-edge animate-paper-feed select-none border-x border-slate-200"
      >
        {/* Header */}
        <div className="text-center pb-3 border-b-2 border-dashed border-slate-400">
          <div className="flex items-center justify-center space-x-1.5 text-slate-900 mb-0.5">
            <span className="font-black text-sm uppercase tracking-wider">CAMPUS CANTEEN</span>
          </div>
          <p className="text-[9px] text-slate-500 font-sans uppercase tracking-tight">80mm Thermal Auto-Dispenser</p>
          <div className="mt-2 text-2xl font-black text-slate-950 tracking-tight">
            TOKEN #{order.token}
          </div>
          <span className="inline-block px-2 py-0.5 mt-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
            SUBSIDIZED MEAL PASS
          </span>
        </div>

        {/* Metadata section */}
        <div className="py-3 space-y-1.5 border-b-2 border-dashed border-slate-400 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">DATE & TIME:</span>
            <span className="font-bold">{order.issuedAt}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">EMPLOYEE:</span>
            <span className="font-bold truncate max-w-[140px] text-right">{order.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">EMP ID:</span>
            <span className="font-bold">{order.userId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">DEPARTMENT:</span>
            <span className="font-bold truncate max-w-[140px] text-right">{order.dept}</span>
          </div>
          <div className="flex justify-between items-center pt-1.5 text-emerald-800 border-t border-slate-200">
            <span className="text-slate-600 font-semibold">MEAL SESSION:</span>
            <span className="font-black text-xs uppercase tracking-wide bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-900">
              {order.meal}
            </span>
          </div>

          {/* Menu Items (Tamil / English) */}
          <div className="pt-2 border-t border-slate-200 text-left">
            <span className="text-slate-500 font-bold block text-[9px] uppercase tracking-wider">
              MENU ITEMS / உணவு:
            </span>
            <p className="font-bold text-slate-900 text-xs mt-0.5 leading-snug font-sans">
              {(() => {
                if (Array.isArray(order.items) && order.items.length > 0) {
                  return order.items.map(it => typeof it === 'string' ? it : it?.description || it?.name || '').join(', ');
                }
                return canteenService.getMealSlots().find(s => s.name === order.meal)?.description || 'Standard Meal';
              })()}
            </p>
          </div>
        </div>

        {/* High-Density 2D QR Code optimized for thermal contrast & mentioning menu */}
        <div className="py-3 flex flex-col items-center justify-center">
          <div className="p-2 bg-white border border-slate-300 rounded shadow-2xs flex items-center justify-center">
            <QRCodeSVG
              value={order.orderUuid}
              size={135}
              level="M"
              includeMargin={false}
              fgColor="#090d16"
              bgColor="#ffffff"
            />
          </div>
          <div className="text-center mt-2">
            <div className="text-[10px] text-slate-700 font-mono font-bold tracking-tight">
              {order.orderUuid}
            </div>
            <div className="text-[9px] text-emerald-800 font-sans font-semibold mt-0.5 max-w-[220px] truncate">
              {order.meal} • {(() => {
                if (Array.isArray(order.items) && order.items.length > 0) {
                  return order.items.map(it => typeof it === 'string' ? it : it?.description || it?.name || '').join(', ');
                }
                return canteenService.getMealSlots().find(s => s.name === order.meal)?.description || 'Standard Meal';
              })()}
            </div>
          </div>
        </div>

        {/* Security verification notice */}
        <div className="text-center pt-2 border-t-2 border-dashed border-slate-400 text-[9px] text-slate-600 leading-tight space-y-1 font-sans">
          <p className="font-black text-rose-700 tracking-wider uppercase">
            * PRESENT SLIP AT FOOD COUNTER *
          </p>
          <p className="text-slate-500">
            Scan via Barcode Scanner • 1 Serving Claim
          </p>
          <div className="text-[8px] text-slate-400 font-mono pt-1">
            ESC/POS 80mm • Direct Thermal Roll
          </div>
        </div>
      </div>

      {/* Quick Action buttons (hidden on print) */}
      <div className="flex flex-wrap items-center justify-center gap-2 print:hidden">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs flex items-center space-x-1.5 transition-colors"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span>Physical Print (80mm)</span>
        </button>

        {onSendToScanner && (
          <button
            onClick={() => onSendToScanner(order.orderUuid)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <span>Scan at Counter</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center space-x-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 print:hidden font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>Thermal Slip Dispensed & Ready</span>
      </div>
    </div>
  );
};
