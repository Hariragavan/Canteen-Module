import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Employee, FingerprintRecord } from '../../types';
import { mantraService } from '../../services/mantraService';
import { soundEngine } from '../../services/soundEngine';
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

type HUDScanState = 'OFF' | 'IDLE' | 'DETECTING' | 'TRY_AGAIN' | 'SUCCESS';

export const FingerprintScannerHUD: React.FC<FingerprintScannerHUDProps> = ({
  employees,
  fingerprints,
  onUserIdentified,
  onError,
}) => {
  // Scanning is active for 20 seconds when opened, then turns OFF
  const [isScanningActive, setIsScanningActive] = useState<boolean>(true);
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [scanState, setScanState] = useState<HUDScanState>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('Place your finger');
  const [qualityScore, setQualityScore] = useState<number | null>(null);

  const isBusyRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const activeTimerRef = useRef<any>(null);

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
        if (prev <= 1) {
          // 20 seconds elapsed: turn off scanning
          setIsScanningActive(false);
          setScanState('OFF');
          setStatusMessage('Turn on scanning');
          setQualityScore(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (activeTimerRef.current) clearInterval(activeTimerRef.current);
    };
  }, [isScanningActive]);

  // 2. Hardware Capture & Identification Routine
  const runCaptureCycle = useCallback(async () => {
    if (isBusyRef.current || !isMountedRef.current) return;
    isBusyRef.current = true;

    setScanState('DETECTING');
    setStatusMessage('Stay steady');
    soundEngine.playScannerBeep();

    try {
      // 10-second capture window on Mantra scanner (minimum quality 30%)
      const captureResult = await mantraService.captureFingerprint(30, 10);

      if (!isMountedRef.current) return;

      const q = captureResult.quality || 0;
      setQualityScore(q);

      // Condition 1: Low quality (< 30%) -> "Try again"
      if (q > 0 && q < 30) {
        setScanState('TRY_AGAIN');
        setStatusMessage('Try again');
        soundEngine.playWarningBuzzer();
        if (onError) onError('Quality too low (< 30%). Try again.');

        setTimeout(() => {
          if (!isMountedRef.current) return;
          isBusyRef.current = false;
          setTimeLeft((current) => {
            if (current > 0) {
              setScanState('IDLE');
              setStatusMessage('Place your finger');
              runCaptureCycle();
            } else {
              setIsScanningActive(false);
              setScanState('OFF');
              setStatusMessage('Turn on scanning');
            }
            return current;
          });
        }, 1800);
        return;
      }

      // Condition 2: Capture failed or timed out
      if (!captureResult.success || !captureResult.isoTemplate) {
        setScanState('TRY_AGAIN');
        setStatusMessage('Try again');
        soundEngine.playWarningBuzzer();
        if (onError) onError('Try again');

        setTimeout(() => {
          if (!isMountedRef.current) return;
          isBusyRef.current = false;
          setTimeLeft((current) => {
            if (current > 0) {
              setScanState('IDLE');
              setStatusMessage('Place your finger');
              runCaptureCycle();
            } else {
              setIsScanningActive(false);
              setScanState('OFF');
              setStatusMessage('Turn on scanning');
            }
            return current;
          });
        }, 1800);
        return;
      }

      // Condition 3: Match captured fingerprint against enrolled employees
      const matchResult = await mantraService.identifyEmployee(
        captureResult.isoTemplate,
        fingerprints
      );

      if (matchResult.matchedRecord) {
        const matchedEmp = employees.find(
          (e) =>
            String(e.id).trim().toUpperCase() ===
            String(matchResult.matchedRecord?.employeeId).trim().toUpperCase()
        );

        if (matchedEmp) {
          setScanState('SUCCESS');
          soundEngine.playVerificationChime();
          const fingerLabel = matchResult.matchedFinger || 'Touch ID';
          setStatusMessage(`Verified: ${matchedEmp.name}`);

          setTimeout(() => {
            if (isMountedRef.current) {
              onUserIdentified(matchedEmp, fingerLabel);
              isBusyRef.current = false;
            }
          }, 650);
          return;
        }
      }

      // Condition 4: Fingerprint not matched -> "Try again"
      setScanState('TRY_AGAIN');
      setStatusMessage('Try again');
      soundEngine.playWarningBuzzer();
      if (onError) onError('Try again');

      setTimeout(() => {
        if (!isMountedRef.current) return;
        isBusyRef.current = false;
        setTimeLeft((current) => {
          if (current > 0) {
            setScanState('IDLE');
            setStatusMessage('Place your finger');
            runCaptureCycle();
          } else {
            setIsScanningActive(false);
            setScanState('OFF');
            setStatusMessage('Turn on scanning');
          }
          return current;
        });
      }, 1800);
    } catch {
      if (!isMountedRef.current) return;
      setScanState('TRY_AGAIN');
      setStatusMessage('Try again');
      soundEngine.playWarningBuzzer();

      setTimeout(() => {
        if (!isMountedRef.current) return;
        isBusyRef.current = false;
        setTimeLeft((current) => {
          if (current > 0) {
            setScanState('IDLE');
            setStatusMessage('Place your finger');
            runCaptureCycle();
          } else {
            setIsScanningActive(false);
            setScanState('OFF');
            setStatusMessage('Turn on scanning');
          }
          return current;
        });
      }, 1800);
    }
  }, [employees, fingerprints, onUserIdentified, onError]);

  // 3. Start scanning on initial mount
  useEffect(() => {
    const initTimer = setTimeout(() => {
      runCaptureCycle();
    }, 400);

    return () => clearTimeout(initTimer);
  }, [runCaptureCycle]);

  // 4. Tap the whole scanning area to activate scanning
  const handleTapScanning = () => {
    setTimeLeft(20);
    setIsScanningActive(true);
    setQualityScore(null);
    setScanState('IDLE');
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
              : scanState === 'DETECTING'
              ? 'ring-8 ring-emerald-400/50 bg-emerald-50 shadow-emerald-500/20 shadow-xl'
              : scanState === 'TRY_AGAIN'
              ? 'ring-8 ring-rose-400/50 bg-rose-50 shadow-rose-500/20 shadow-xl animate-shake'
              : scanState === 'SUCCESS'
              ? 'ring-8 ring-emerald-500 bg-emerald-100 shadow-emerald-500/30 shadow-2xl scale-105'
              : 'ring-6 ring-emerald-400/40 bg-gradient-to-b from-white to-slate-50 group-hover:scale-102'
          }`}
        >
          {/* Animated Scan Line (when detecting) */}
          {scanState === 'DETECTING' && (
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
                className={`w-24 h-24 sm:w-28 sm:h-28 transition-transform duration-300 ${
                  scanState === 'DETECTING'
                    ? 'text-emerald-600 scale-105 animate-pulse'
                    : 'text-emerald-600 group-hover:scale-105'
                }`}
              />
            )}
          </div>
        </div>

        {/* Live Quality Percent Badge */}
        {qualityScore !== null && scanState !== 'OFF' && (
          <div
            className={`absolute -bottom-3 px-3 py-1 rounded-full border shadow-sm flex items-center gap-1.5 text-xs font-mono font-bold transition-all ${
              qualityScore < 30
                ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                : 'bg-white text-slate-800 border-slate-300'
            }`}
          >
            <ShieldCheck
              className={`w-3.5 h-3.5 ${
                qualityScore < 30 ? 'text-rose-600' : 'text-emerald-600'
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
              : scanState === 'DETECTING'
              ? 'text-emerald-600 animate-pulse'
              : 'text-slate-800'
          }`}
        >
          {statusMessage}
        </h3>

        {/* Subtle Tap Hint when OFF */}
        {scanState === 'OFF' && (
          <p className="text-xs text-slate-400 mt-1 font-medium group-hover:text-emerald-600 transition-colors">
            Tap anywhere to start scanning
          </p>
        )}

        {/* Active 20-second window indicator when ON */}
        {isScanningActive && scanState !== 'OFF' && scanState !== 'SUCCESS' && (
          <p className="text-[11px] text-slate-400 mt-1 font-mono font-medium">
            Active: {timeLeft}s
          </p>
        )}
      </div>
    </div>
  );
};

export default FingerprintScannerHUD;
