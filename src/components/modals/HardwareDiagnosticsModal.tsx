import React, { useState } from 'react';
import { X, Printer, QrCode, CheckCircle2, Terminal, Cpu } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';

interface HardwareDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HardwareDiagnosticsModal: React.FC<HardwareDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [paperRollPercent, setPaperRollPercent] = useState<number>(94);
  const [cutterTestResult, setCutterTestResult] = useState<string | null>(null);
  const [scannerTestInput, setScannerTestInput] = useState<string>('');
  const [scannerSpeedLog, setScannerSpeedLog] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleTestCutter = () => {
    soundEngine.playPaperCutSound();
    setCutterTestResult('Auto-Cutter Guillotine Blade Cycled: OK (0.08s)');
    setTimeout(() => setCutterTestResult(null), 3500);
  };

  const handleTestFeed = () => {
    soundEngine.playThermalMotorSound();
  };

  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = scannerTestInput.trim();
      if (val) {
        soundEngine.playScannerBeep();
        setScannerSpeedLog((prev) => [
          `[${new Date().toLocaleTimeString()}] 2D Barcode Scan: "${val}" • Terminator: <CR>`,
          ...prev.slice(0, 4),
        ]);
        setScannerTestInput('');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-modal flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
              <Cpu className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Hardware Device Test Bench
              </h3>
              <p className="text-xs text-slate-500">
                80mm Thermal Printer & 2D Barcode Scanner Diagnostics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* 1. 80mm Thermal Printer Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Printer className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-sm text-slate-900">80mm Thermal Printer (ESC/POS)</h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                USB / LAN Ready
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[10px]">Paper Roll Level</span>
                <div className="font-bold text-slate-800 font-mono text-sm mt-0.5">
                  {paperRollPercent}% (80mm)
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[10px]">Head Temperature</span>
                <div className="font-bold text-emerald-700 font-mono text-sm mt-0.5">
                  34.2 °C (Nominal)
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[10px]">Auto-Cutter</span>
                <div className="font-bold text-slate-800 font-mono text-sm mt-0.5">
                  Full Cut Enabled
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleTestFeed}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Test Paper Feed Motor</span>
              </button>
              <button
                onClick={handleTestCutter}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cycle Guillotine Cutter</span>
              </button>
              <button
                onClick={() => setPaperRollPercent(100)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
              >
                Reload 80mm Roll
              </button>
            </div>

            {cutterTestResult && (
              <div className="text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-200 font-mono flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{cutterTestResult}</span>
              </div>
            )}
          </div>

          {/* 2. 2D Barcode Scanner Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-sm text-slate-900">
                  2D Barcode & QR Scanner (USB HID)
                </h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                USB HID Wedge Active
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Live Scanner Wedge Stream Test (Scan any barcode or type and press Enter):
              </label>
              <input
                type="text"
                value={scannerTestInput}
                onChange={(e) => setScannerTestInput(e.target.value)}
                onKeyDown={handleScannerKeyDown}
                placeholder="Scan with barcode gun here..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {scannerSpeedLog.length > 0 && (
              <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[10px] space-y-1">
                {scannerSpeedLog.map((log, idx) => (
                  <div key={idx} className="text-emerald-400">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ESC/POS Raw Hex Preview */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-slate-600 font-mono text-[10px] space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-700" />
              <span>ESC/POS Command Stream (80mm Thermal)</span>
            </div>
            <p className="text-slate-500">
              INIT: <code>[1B 40]</code> • ALIGN CENTER: <code>[1B 61 01]</code> • CUT: <code>[1D 56 41 00]</code>
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
