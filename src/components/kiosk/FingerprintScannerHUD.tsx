import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Employee, FingerprintRecord } from '../../types';
import { mantraService, type MantraDeviceInfo } from '../../services/mantraService';
import { soundEngine } from '../../services/soundEngine';
import {
  Fingerprint as FingerprintIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Usb,
  ShieldCheck,
  User,
  X,
  Search,
} from 'lucide-react';

interface FingerprintScannerHUDProps {
  employees: Employee[];
  fingerprints: FingerprintRecord[];
  onUserIdentified: (employee: Employee, fingerName: string) => void;
  onError?: (message: string) => void;
}

export const FingerprintScannerHUD: React.FC<FingerprintScannerHUDProps> = ({
  employees,
  fingerprints,
  onUserIdentified,
  onError,
}) => {
  const [deviceInfo, setDeviceInfo] = useState<MantraDeviceInfo>({
    isConnected: false,
    make: 'Mantra',
    model: 'MFS110',
    serialNo: '',
    width: 300,
    height: 400,
  });

  const [scanState, setScanState] = useState<'IDLE' | 'SCANNING' | 'MATCHING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('Place your registered finger on the Mantra sensor');
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [isAutoScanning] = useState<boolean>(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const isBusyRef = useRef<boolean>(false);
  const autoScanTimerRef = useRef<any>(null);

  // Enrolled employees list with active biometrics
  const enrolledEmployees = useMemo(() => {
    return employees.filter((emp) =>
      fingerprints.some(
        (fp) =>
          String(fp.employeeId).trim().toUpperCase() === String(emp.id).trim().toUpperCase() &&
          fp.isActive !== false
      )
    );
  }, [employees, fingerprints]);

  const filteredEmployees = useMemo(() => {
    if (!filterQuery.trim()) return enrolledEmployees;
    const q = filterQuery.toLowerCase().trim();
    return enrolledEmployees.filter(
      (emp) => emp.name.toLowerCase().includes(q) || emp.id.toLowerCase().includes(q)
    );
  }, [enrolledEmployees, filterQuery]);

  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return (
      employees.find(
        (e) => String(e.id).trim().toUpperCase() === String(selectedEmployeeId).trim().toUpperCase()
      ) || null
    );
  }, [employees, selectedEmployeeId]);

  // 1. Check device status periodically
  const checkDeviceStatus = useCallback(async () => {
    try {
      const info = await mantraService.checkDevice();
      setDeviceInfo(info);
      if (!info.isConnected && !mantraService.getMockMode()) {
        setStatusMessage('Mantra scanner disconnected. Connect USB device or enable Simulator.');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkDeviceStatus();
    const interval = setInterval(checkDeviceStatus, 6000);
    return () => clearInterval(interval);
  }, [checkDeviceStatus]);

  // 2. Perform Single Fingerprint Scan & Match
  const triggerScan = useCallback(async () => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setScanState('SCANNING');
    setStatusMessage('Scanning... Keep finger steady on the red optical glass');
    soundEngine.playScannerBeep();

    try {
      // Capture fingerprint with 60% quality threshold and 6s timeout
      const captureResult = await mantraService.captureFingerprint(60, 6);

      if (!captureResult.success || !captureResult.isoTemplate) {
        setScanState('ERROR');
        soundEngine.playWarningBuzzer();
        const err = captureResult.errorDescription || 'Fingerprint not captured. Please try again.';
        setStatusMessage(err);
        if (onError) onError(err);

        setTimeout(() => {
          setScanState('IDLE');
          setStatusMessage('Place your registered finger on the Mantra sensor');
          isBusyRef.current = false;
        }, 2200);
        return;
      }

      setQualityScore(captureResult.quality);
      if (captureResult.bitmapData) {
        setScannedImage(captureResult.bitmapData);
      }

      setScanState('MATCHING');
      setStatusMessage(`Analyzing fingerprint (Quality: ${captureResult.quality}%)...`);

      // Biometric Matching across enrolled employees (with optional 1:1 selected employee confirmation)
      const matchResult = await mantraService.identifyEmployee(
        captureResult.isoTemplate,
        fingerprints,
        selectedEmployeeId
      );

      if (matchResult.matchedRecord) {
        // Find matching employee by ID
        const matchedEmp = employees.find(
          (e) => String(e.id).trim().toUpperCase() === String(matchResult.matchedRecord?.employeeId).trim().toUpperCase()
        );

        if (matchedEmp) {
          setScanState('SUCCESS');
          soundEngine.playVerificationChime();
          const fingerLabel = matchResult.matchedFinger || 'Fingerprint';
          setStatusMessage(`Verified: ${matchedEmp.name} (${matchedEmp.id}) via ${fingerLabel}!`);

          setTimeout(() => {
            onUserIdentified(matchedEmp, fingerLabel);
            setScanState('IDLE');
            setScannedImage(null);
            setQualityScore(null);
            setSelectedEmployeeId(null);
            isBusyRef.current = false;
          }, 600);
          return;
        }
      }

      // No match found in database
      setScanState('ERROR');
      soundEngine.playWarningBuzzer();
      const failMsg = selectedEmployee
        ? `Biometric Verification Failed: Finger did not match selected profile ${selectedEmployee.name} (${selectedEmployee.id}).`
        : 'Biometric Verification Failed: Fingerprint not recognized. Tap your name below to verify.';
      setStatusMessage(failMsg);
      if (onError) onError(failMsg);

      setTimeout(() => {
        setScanState('IDLE');
        setStatusMessage(
          selectedEmployee
            ? `Place finger on sensor to confirm ${selectedEmployee.name} (${selectedEmployee.id})`
            : 'Place your registered finger on the Mantra sensor'
        );
        setScannedImage(null);
        setQualityScore(null);
        isBusyRef.current = false;
      }, 2500);
    } catch (err: any) {
      setScanState('ERROR');
      soundEngine.playWarningBuzzer();
      const msg = err.message || 'Mantra communication error. Please check USB cable.';
      setStatusMessage(msg);
      if (onError) onError(msg);

      setTimeout(() => {
        setScanState('IDLE');
        setStatusMessage('Place your registered finger on the Mantra sensor');
        isBusyRef.current = false;
      }, 2500);
    }
  }, [employees, fingerprints, onUserIdentified, onError, selectedEmployeeId, selectedEmployee]);

  // 3. Auto-polling loop when device is connected
  useEffect(() => {
    if (!isAutoScanning) return;

    const poll = async () => {
      if (!isBusyRef.current && scanState === 'IDLE' && (deviceInfo.isConnected || mantraService.getMockMode())) {
        // Auto trigger capture when idle
        // Only run if not already busy
      }
    };

    autoScanTimerRef.current = setInterval(poll, 2500);
    return () => {
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
    };
  }, [isAutoScanning, scanState, deviceInfo.isConnected]);

  // Handle Simulator Toggle
  const toggleSimulator = () => {
    const next = !mantraService.getMockMode();
    mantraService.setMockMode(next);
    checkDeviceStatus();
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-3 sm:p-5 select-none">
      
      {/* Device Header Status Pill */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur border border-slate-200 shadow-2xs mb-4">
        <Usb className={`w-4 h-4 ${deviceInfo.isConnected ? 'text-emerald-600 animate-pulse' : 'text-amber-500'}`} />
        <span className="text-xs font-semibold text-slate-700">
          {deviceInfo.isConnected ? (
            <>
              <span className="text-emerald-700 font-bold">{deviceInfo.make} {deviceInfo.model}</span>
              <span className="text-slate-400 mx-1">•</span>
              <span className="text-[11px] font-mono text-slate-500">{deviceInfo.serialNo || 'Ready'}</span>
            </>
          ) : (
            <span className="text-amber-700 font-medium">Mantra Scanner: Waiting for USB connection...</span>
          )}
        </span>
        <button
          type="button"
          onClick={checkDeviceStatus}
          title="Refresh device connection"
          className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Main Biometric Scanner Graphic Dock */}
      <div className="relative flex flex-col items-center justify-center my-2 sm:my-4">
        
        {/* Outer Glowing Rings */}
        <div
          className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-full flex items-center justify-center transition-all duration-300 ${
            scanState === 'SCANNING'
              ? 'ring-8 ring-emerald-400/40 bg-emerald-50 shadow-xl shadow-emerald-500/20'
              : scanState === 'MATCHING'
              ? 'ring-8 ring-blue-400/40 bg-blue-50 shadow-xl shadow-blue-500/20'
              : scanState === 'SUCCESS'
              ? 'ring-8 ring-emerald-500 bg-emerald-100 shadow-2xl shadow-emerald-500/30 scale-105'
              : scanState === 'ERROR'
              ? 'ring-8 ring-rose-400/40 bg-rose-50 shadow-xl shadow-rose-500/20 animate-shake'
              : 'ring-4 ring-slate-200/80 bg-gradient-to-b from-white to-slate-100 shadow-lg'
          }`}
        >
          {/* Animated Scan Line Overlay */}
          {scanState === 'SCANNING' && (
            <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-scanline" />
            </div>
          )}

          {/* Central Fingerprint Icon or Scanned Thumbnail */}
          {scannedImage && scanState !== 'ERROR' ? (
            <div className="w-28 h-36 rounded-2xl overflow-hidden border-2 border-emerald-500/50 shadow-inner bg-slate-900 flex items-center justify-center">
              <img src={scannedImage} alt="Fingerprint preview" className="w-full h-full object-cover filter contrast-125" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              {scanState === 'SUCCESS' ? (
                <CheckCircle2 className="w-20 h-20 text-emerald-600 animate-in zoom-in-75 duration-200" />
              ) : scanState === 'ERROR' ? (
                <AlertCircle className="w-20 h-20 text-rose-500 animate-in zoom-in-75 duration-200" />
              ) : (
                <FingerprintIcon
                  className={`w-24 h-24 sm:w-28 sm:h-28 transition-transform duration-300 ${
                    scanState === 'SCANNING'
                      ? 'text-emerald-600 scale-105 animate-pulse'
                      : scanState === 'MATCHING'
                      ? 'text-blue-600 animate-pulse'
                      : 'text-slate-400 hover:text-emerald-600'
                  }`}
                />
              )}
            </div>
          )}
        </div>

        {/* Quality Score Badge */}
        {qualityScore !== null && (
          <div className="absolute -bottom-2 bg-white px-3 py-1 rounded-full border border-slate-300 shadow-sm flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Quality: {qualityScore}%</span>
          </div>
        )}
      </div>

      {/* Dynamic Status Feedback */}
      <div className="mt-4 text-center max-w-md">
        <h3
          className={`text-base sm:text-lg font-bold transition-colors ${
            scanState === 'SUCCESS'
              ? 'text-emerald-700'
              : scanState === 'ERROR'
              ? 'text-rose-600'
              : scanState === 'SCANNING'
              ? 'text-emerald-600 animate-pulse'
              : scanState === 'MATCHING'
              ? 'text-blue-600'
              : 'text-slate-800'
          }`}
        >
          {statusMessage}
        </h3>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Registered employees: <span className="font-bold text-slate-700">{fingerprints.length}</span> with active biometrics
        </p>
      </div>

      {/* Selected Personnel Banner (1:1 Targeted Verification) */}
      {selectedEmployee && (
        <div className="w-full max-w-md my-2 bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-3 flex items-center justify-between shadow-sm animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {selectedEmployee.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 text-sm">{selectedEmployee.name}</span>
                <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-800">
                  {selectedEmployee.id}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">({selectedEmployee.dept})</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">
                Targeted: Place registered finger on Mantra sensor to confirm
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedEmployeeId(null);
              setStatusMessage('Place your registered finger on the Mantra sensor');
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
            title="Deselect person"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Manual Trigger / Simulation Action Button */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={triggerScan}
          disabled={scanState === 'SCANNING' || scanState === 'MATCHING'}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer"
        >
          <FingerprintIcon className="w-4 h-4" />
          <span>
            {scanState === 'SCANNING'
              ? 'Scanning on Mantra...'
              : selectedEmployee
              ? `Confirm & Verify ${selectedEmployee.name}`
              : 'Press Sensor / Tap to Scan'}
          </span>
        </button>

        {/* Demo Simulator Mode Toggle */}
        <button
          type="button"
          onClick={toggleSimulator}
          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
            mantraService.getMockMode()
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
          }`}
          title="Toggle simulator mode for testing without physical USB hardware"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>{mantraService.getMockMode() ? 'Simulator ON' : 'Test Mode'}</span>
        </button>
      </div>

      {/* Quick Personnel Selection Chips (Direct 1:1 or 1:N) */}
      {enrolledEmployees.length > 0 && (
        <div className="w-full max-w-lg mt-5 pt-3 border-t border-slate-200/80 flex flex-col items-center gap-2">
          <div className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 px-1">
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-500 font-mono">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tap your name (or scan finger directly):</span>
            </span>
            {enrolledEmployees.length > 3 && (
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter name or ID..."
                  className="pl-6 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 w-full max-h-32 overflow-y-auto p-1">
            {filteredEmployees.map((emp) => {
              const isSelected = selectedEmployeeId === emp.id;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    const nextId = isSelected ? null : emp.id;
                    setSelectedEmployeeId(nextId);
                    soundEngine.playSelectSound();
                    setStatusMessage(
                      nextId
                        ? `Place finger on sensor to confirm ${emp.name} (${emp.id})`
                        : 'Place your registered finger on the Mantra sensor'
                    );
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-105 ring-2 ring-emerald-400'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}
                  />
                  <span>{emp.name}</span>
                  <span
                    className={`text-[10px] font-mono ${
                      isSelected ? 'text-emerald-100' : 'text-slate-400'
                    }`}
                  >
                    ({emp.id})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

export default FingerprintScannerHUD;
