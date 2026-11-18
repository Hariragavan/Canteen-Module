import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Employee, FingerprintRecord } from '../../types';
import { mantraService } from '../../services/mantraService';
import { soundEngine } from '../../services/soundEngine';
import { canteenService } from '../../services/canteenService';
import {
  Fingerprint as FingerprintIcon,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Power,
} from 'lucide-react';

interface FingerprintScannerHUDProps {
  employees: Employee[];
  fingerprints: FingerprintRecord[];
  onUserIdentified: (employee: Employee, fingerName: string) => void;
  onError?: (message: string) => void;
}

type HUDScanState = 'OFF' | 'READY' | 'TRY_AGAIN' | 'SUCCESS';

export const FingerprintScannerHUD: React.FC<FingerprintScannerHUDProps> = ({
  employees,
  fingerprints,
  onUserIdentified,
  onError,
}) => {
  // Scanning is active for 20 seconds when opened, then turns OFF
  const [isScanningActive, setIsScanningActive] = useState<boolean>(true);
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [scanState, setScanState] = useState<HUDScanState>('READY');
  const [statusMessage, setStatusMessage] = useState<string>('Place your finger');
  const [qualityScore, setQualityScore] = useState<number | null>(null);

  const isBusyRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const activeTimerRef = useRef<any>(null);
  const isScanningActiveRef = useRef<boolean>(true);
  const timeLeftRef = useRef<number>(20);

  const employeesRef = useRef(employees);
  employeesRef.current = employees;
  const fingerprintsRef = useRef(fingerprints);
  fingerprintsRef.current = fingerprints;

  const onUserIdentifiedRef = useRef(onUserIdentified);
  onUserIdentifiedRef.current = onUserIdentified;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // 1. 20-second active window countdown
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isScanningActive) {
      if (activeTimerRef.current) clearInterval(activeTimerRef.current);
      return;
    }

    activeTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        timeLeftRef.current = next;
        if (next <= 0) {
          // 20 seconds elapsed: turn off scanning smoothly
          setIsScanningActive(false);
          isScanningActiveRef.current = false;
          setScanState('OFF');
          setStatusMessage('Turn on scanning');
          setQualityScore(null);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (activeTimerRef.current) clearInterval(activeTimerRef.current);
    };
  }, [isScanningActive]);

  // 2. Hardware Capture & Identification Routine (Steady - Zero Flickering)
  const runCaptureCycle = useCallback(async () => {
    if (isBusyRef.current || !isMountedRef.current || !isScanningActiveRef.current) return;
    isBusyRef.current = true;

    try {
      // Capture window on scanner (timeout dynamic up to 8s, minimum quality 30%)
      const captureTimeout = Math.min(8, Math.max(3, timeLeftRef.current));
      const captureResult = await mantraService.captureFingerprint(30, captureTimeout);

      if (!isMountedRef.current) return;

      // Condition: No finger touched / timed out / cancelled
      // KEEP UI STEADY - DO NOT FLICKER OR CHANGE STATE WHILE WAITING FOR FINGER!
      if (!captureResult.success || !captureResult.isoTemplate) {
        isBusyRef.current = false;

        // If the 20-second window elapsed, turn off
        if (timeLeftRef.current <= 1 || !isScanningActiveRef.current) {
          setIsScanningActive(false);
          isScanningActiveRef.current = false;
          setScanState('OFF');
          setStatusMessage('Turn on scanning');
          setQualityScore(null);
          return;
        }

        // Window still running: silently loop for next touch without flickering the UI
        setTimeout(() => {
          if (isMountedRef.current && isScanningActiveRef.current && timeLeftRef.current > 1) {
            runCaptureCycle();
          }
        }, 200);
        return;
      }

      // Hardware physically received a touch!
      const q = captureResult.quality || 0;
      setQualityScore(q);

      // Condition 1: Low quality (< 30%) on physical touch -> Show "Try again"
      if (q > 0 && q < 30) {
        setScanState('TRY_AGAIN');
        setStatusMessage('Try again');
        setQualityScore(q);
        soundEngine.playWarningBuzzer();
        if (onErrorRef.current) onErrorRef.current('Quality too low (< 30%). Try again.');
        isBusyRef.current = false;
        return;
      }

      // Condition 2: Biometric match against enrolled employees
      const currentFingerprints =
        fingerprintsRef.current && fingerprintsRef.current.length > 0
          ? fingerprintsRef.current
          : canteenService.getFingerprints();
      const currentEmployees =
        employeesRef.current && employeesRef.current.length > 0
          ? employeesRef.current
          : canteenService.getEmployees();

      const matchResult = await mantraService.identifyEmployee(
        captureResult.isoTemplate,
        currentFingerprints
      );

      if (matchResult.matchedRecord) {
        const matchedEmp = currentEmployees.find(
          (e) =>
            String(e.id).trim().toUpperCase() ===
            String(matchResult.matchedRecord?.employeeId).trim().toUpperCase()
        );

        if (matchedEmp) {
          setScanState('SUCCESS');
          soundEngine.playVerificationChime();
          const fingerLabel = matchResult.matchedFinger || 'Touch ID';
          setStatusMessage(`Verified: ${matchedEmp.name}`);
          setQualityScore(q);

          setTimeout(() => {
            if (isMountedRef.current) {
              onUserIdentifiedRef.current(matchedEmp, fingerLabel);
              isBusyRef.current = false;
            }
          }, 650);
          return;
        }
      }

      // Condition 3: Success received from hardware, but touch is NOT matched to any enrolled person
      setScanState('TRY_AGAIN');
      setStatusMessage('Try again');
      setQualityScore(q);
      soundEngine.playWarningBuzzer();
      if (onErrorRef.current) onErrorRef.current('Try again');
      isBusyRef.current = false;
    } catch {
      if (!isMountedRef.current) return;
      isBusyRef.current = false;

      if (timeLeftRef.current <= 1 || !isScanningActiveRef.current) {
        setIsScanningActive(false);
        isScanningActiveRef.current = false;
        setScanState('OFF');
        setStatusMessage('Turn on scanning');
        setQualityScore(null);
        return;
      }

      setTimeout(() => {
        if (isMountedRef.current && isScanningActiveRef.current && timeLeftRef.current > 1) {
          runCaptureCycle();
        }
      }, 200);
    }
  }, []);

  // 3. Start scanning on initial mount only once
  useEffect(() => {
    const initTimer = setTimeout(() => {
      runCaptureCycle();
    }, 300);

    return () => clearTimeout(initTimer);
  }, [runCaptureCycle]);

  // 4. Tap the whole scanning area to activate scanning
  const handleTapScanning = () => {
    setTimeLeft(20);
    timeLeftRef.current = 20;
    setIsScanningActive(true);
    isScanningActiveRef.current = true;
    setQualityScore(null);
    setScanState('READY');
    setStatusMessage('Place your finger');
    soundEngine.playSelectSound();
    isBusyRef.current = false;
    runCaptureCycle();
  };

  return (
    <div
      onClick={handleTapScanning}
      role="button"
      tabIndex={0}
      title="Tap to activate scanning"
      className="w-full flex flex-col items-center justify-center p-4 sm:p-6 select-none cursor-pointer group transition-all duration-200 focus:outline-none"
    >
      {/* Central Circular Biometric Dock */}
      <div className="relative flex flex-col items-center justify-center my-3">
        <div
          className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
            scanState === 'OFF'
              ? 'ring-4 ring-slate-300 bg-slate-100/90 text-slate-400 group-hover:ring-emerald-400/60 group-hover:scale-102'
              : scanState === 'TRY_AGAIN'
              ? 'ring-8 ring-rose-400/50 bg-rose-50 shadow-rose-500/20 shadow-xl animate-shake'
              : scanState === 'SUCCESS'
              ? 'ring-8 ring-emerald-500 bg-emerald-100 shadow-emerald-500/30 shadow-2xl scale-105'
              : 'ring-6 ring-emerald-400/40 bg-gradient-to-b from-white to-slate-50 group-hover:scale-102 shadow-emerald-500/10'
          }`}
        >
          {/* Animated Scan Line (when ready and waiting for touch) */}
          {scanState === 'READY' && (
            <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-scanline" />
            </div>
          )}

          {/* Central Icon */}
          <div className="flex flex-col items-center justify-center">
            {scanState === 'OFF' ? (
              <div className="flex flex-col items-center gap-1.5 text-slate-400 group-hover:text-emerald-600 transition-colors">
                <Power className="w-16 h-16 sm:w-20 sm:h-20 animate-pulse" />
              </div>
            ) : scanState === 'SUCCESS' ? (
              <CheckCircle2 className="w-20 h-20 text-emerald-600 animate-in zoom-in-75 duration-200" />
            ) : scanState === 'TRY_AGAIN' ? (
              <AlertCircle className="w-20 h-20 text-rose-500 animate-in zoom-in-75 duration-200" />
            ) : (
              <FingerprintIcon
                className="w-24 h-24 sm:w-28 sm:h-28 text-emerald-600 transition-transform duration-300 group-hover:scale-105"
              />
            )}
          </div>
        </div>

        {/* Quality Percent Badge - Only show when a scan finishes */}
        {qualityScore !== null && (scanState === 'SUCCESS' || scanState === 'TRY_AGAIN') && (
          <div
            className={`absolute -bottom-3 px-3 py-1 rounded-full border shadow-sm flex items-center gap-1.5 text-xs font-mono font-bold transition-all ${
              scanState === 'SUCCESS'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : qualityScore < 30
                ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            <ShieldCheck
              className={`w-3.5 h-3.5 ${
                scanState === 'SUCCESS'
                  ? 'text-emerald-600'
                  : qualityScore < 30
                  ? 'text-rose-600'
                  : 'text-amber-600'
              }`}
            />
            <span>Quality: {qualityScore}%</span>
          </div>
        )}
      </div>

      {/* Dynamic Status Feedback */}
      <div className="mt-5 text-center">
        <h3
          className={`text-lg sm:text-xl font-bold transition-colors ${
            scanState === 'OFF'
              ? 'text-slate-600 group-hover:text-emerald-700'
              : scanState === 'SUCCESS'
              ? 'text-emerald-700 font-extrabold'
              : scanState === 'TRY_AGAIN'
              ? 'text-rose-600'
              : 'text-slate-800'
          }`}
        >
          {statusMessage}
        </h3>

        {/* Feedback Subtitle */}
        {scanState === 'OFF' ? (
          <p className="text-xs text-slate-400 mt-1 font-medium group-hover:text-emerald-600 transition-colors">
            Tap anywhere to start scanning
          </p>
        ) : scanState === 'TRY_AGAIN' ? (
          <p className="text-xs text-rose-500 mt-1 font-medium group-hover:text-emerald-600 transition-colors">
            Tap anywhere to scan again
          </p>
        ) : isScanningActive && scanState !== 'SUCCESS' ? (
          <p className="text-[11px] text-slate-400 mt-1 font-mono font-medium">
            Active: {timeLeft}s
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default FingerprintScannerHUD;
