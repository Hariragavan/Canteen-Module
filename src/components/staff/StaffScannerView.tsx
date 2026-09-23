import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Order, VerificationResult } from '../../types';
import { canteenService } from '../../services/canteenService';
import { supabaseManager } from '../../services/supabase';
import { soundEngine } from '../../services/soundEngine';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { startCameraWithFacingMode } from '../../services/faceMatcherService';
import jsQR from 'jsqr';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  Scan,
  ArrowRight,
  Clock,
  Utensils,
  Camera,
  CameraOff,
  SwitchCamera,
} from 'lucide-react';

interface StaffScannerViewProps {
  initialTokenToScan?: string | null;
  onClearInitialToken?: () => void;
}

export const StaffScannerView: React.FC<StaffScannerViewProps> = ({
  initialTokenToScan,
  onClearInitialToken,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [verificationResult, setVerificationResult] = useState<VerificationResult>({
    type: 'IDLE',
  });
  const [manualInput, setManualInput] = useState<string>('');

  // Camera QR Scanner states
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [lastScannedQr, setLastScannedQr] = useState<string | null>(null);
  const [isCapturingFrame, setIsCapturingFrame] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const lastScanTimestampRef = useRef<number>(0);
  const lastVerifiedTimeRef = useRef<number>(0);

  // Load orders and subscribe to real-time events
  const loadOrders = useCallback(() => {
    setOrders(canteenService.getOrders());
  }, []);

  useEffect(() => {
    loadOrders();
    const unsubscribe = supabaseManager.onRealtimeChange(() => {
      loadOrders();
    });
    return () => unsubscribe();
  }, [loadOrders]);

  // Execute verification core logic
  const handleVerify = useCallback(async (query: string) => {
    const result = await canteenService.verifyAndServe(query);
    setVerificationResult(result);

    if (result.type === 'SUCCESS') {
      soundEngine.playVerificationChime();
      // Confetti celebration burst
      try {
        confetti({
          particleCount: 65,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#059669', '#10b981', '#34d399', '#f59e0b'],
        });
      } catch (e) {
        console.warn('Confetti unavailable:', e);
      }
    } else if (result.type === 'DUPLICATE_CLAIM' || result.type === 'INVALID_TOKEN') {
      soundEngine.playWarningBuzzer();
    }

    loadOrders();
  }, [loadOrders]);

  // Start webcam with selected facing mode (front or rear camera)
  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
      if (!videoRef.current) return;

      const result = await startCameraWithFacingMode(videoRef.current, mode);
      mediaStreamRef.current = result.stream;
      setIsCameraActive(true);
      setFacingMode(result.actualFacingMode);
    } catch (err) {
      console.warn('QR camera start error:', err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isCameraActive) {
      await startCamera(nextMode);
    }
  };

  // Sync stream to video element
  useEffect(() => {
    if (isCameraActive && videoRef.current && mediaStreamRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isCameraActive]);

  // Start camera on mount for immediate testing on phone
  useEffect(() => {
    startCamera(facingMode);
    return () => stopCamera();
  }, []);

  // Continuous real-time frame scan with jsQR
  useEffect(() => {
    let animId: number;
    let isActive = true;

    const scanFrame = () => {
      if (!isActive) return;

      const video = videoRef.current;
      if (
        isCameraActive &&
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const now = Date.now();
        // Scan every 110ms for fast QR recognition
        if (now - lastScanTimestampRef.current > 110) {
          lastScanTimestampRef.current = now;

          const canvas = canvasRef.current || document.createElement('canvas');
          const width = 360;
          const height = Math.round((video.videoHeight / video.videoWidth) * 360);
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (qrCode && qrCode.data) {
              const scannedText = qrCode.data.trim();
              if (scannedText) {
                const timeSinceLastVerify = now - lastVerifiedTimeRef.current;
                if (scannedText !== lastScannedQr || timeSinceLastVerify > 2500) {
                  lastVerifiedTimeRef.current = now;
                  setLastScannedQr(scannedText);
                  soundEngine.playScannerBeep();
                  handleVerify(scannedText);
                }
              }
            }
          }
        }
      }

      animId = requestAnimationFrame(scanFrame);
    };

    if (isCameraActive) {
      animId = requestAnimationFrame(scanFrame);
    }

    return () => {
      isActive = false;
      cancelAnimationFrame(animId);
    };
  }, [isCameraActive, handleVerify, lastScannedQr]);

  // Manual snap & scan button
  const handleManualCaptureScan = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    setIsCapturingFrame(true);

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
      if (qrCode && qrCode.data) {
        soundEngine.playScannerBeep();
        setLastScannedQr(qrCode.data);
        handleVerify(qrCode.data);
      } else {
        soundEngine.playWarningBuzzer();
      }
    }
    setTimeout(() => setIsCapturingFrame(false), 250);
  };

  // Global Hardware Wedge Hook for Fingers 2D QuickScan W9
  const { diagnostic } = useBarcodeScanner({
    onScan: (scannedText) => {
      handleVerify(scannedText);
    },
    maxIntervalMs: 55,
    minLength: 3,
    enabled: true,
  });

  // If navigated from Kiosk with a token to scan immediately
  useEffect(() => {
    if (initialTokenToScan) {
      handleVerify(initialTokenToScan);
      if (onClearInitialToken) {
        onClearInitialToken();
      }
    }
  }, [initialTokenToScan, handleVerify, onClearInitialToken]);

  // Manual Form Submission fallback
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleVerify(manualInput.trim());
    setManualInput('');
  };

  const unclaimedOrders = orders.filter((o) => o.status === 'PRINTED');
  const recentDispensed = orders.slice(0, 8);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Food Counter Station Header */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
            <Scan className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Food Counter Verification Station (Counter #03)
              </h2>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                Staff Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Scan student/staff QR slips via <strong>Live Camera</strong> or <strong>2D Barcode Scanner</strong> hardware.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-mono font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Camera + Barcode Scanner Active
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Live Camera QR Scanner + Hardware Wedge (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col gap-3.5">
          
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center space-x-2 text-slate-800">
              <Camera className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Live Camera QR Scanner</h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                isCameraActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {isCameraActive ? '● Live Scanning' : 'Camera Off'}
              </span>
            </div>
          </div>

          {/* Camera Viewfinder Box with Viewfinder Grid & Target Frame */}
          <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-inner flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isCameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
              } ${facingMode === 'user' ? 'mirror' : ''}`}
            />

            {!isCameraActive ? (
              <div className="flex flex-col items-center justify-center p-4 text-center z-10">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 mb-2">
                  <CameraOff className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-200">Camera is Turned Off</p>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-3 font-sans">
                  Click below to activate camera for instant QR scanning
                </p>
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center space-x-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera Scanner</span>
                </button>
              </div>
            ) : (
              <>
                {/* Viewfinder Target Framing Box */}
                <div className="absolute inset-8 border-2 border-dashed border-emerald-400/60 rounded-2xl pointer-events-none z-20 flex flex-col justify-between items-center p-2">
                  <div className="w-full flex justify-between">
                    <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                    <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                  </div>
                  {/* Laser Scan Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                  <div className="w-full flex justify-between">
                    <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                    <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                  </div>
                </div>

                {/* Top Corner controls inside video: Switch Camera & Close */}
                <div className="absolute top-2.5 right-2.5 z-30 flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 backdrop-blur-xs text-[10px] font-bold shadow flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                    title="Flip between Front and Rear Camera"
                  >
                    <SwitchCamera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{facingMode === 'user' ? 'Back Cam' : 'Front Cam'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-rose-900/80 text-rose-300 border border-slate-700 backdrop-blur-xs text-[10px] font-bold shadow flex items-center cursor-pointer transition-all active:scale-95"
                    title="Turn Off Camera"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
                  <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-mono text-emerald-400 font-bold">
                    Target QR inside frame
                  </span>
                  {lastScannedQr && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-mono font-bold truncate max-w-[150px]">
                      {lastScannedQr}
                    </span>
                  )}
                </div>
              </>
            )}

            {isCapturingFrame && (
              <div className="absolute inset-0 bg-white animate-out fade-out duration-200 z-30" />
            )}
          </div>

          {/* Quick Camera Action Toolbar */}
          <div className="flex items-center gap-2">
            {isCameraActive ? (
              <button
                type="button"
                onClick={handleManualCaptureScan}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Snap & Scan QR</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Open Camera Scanner</span>
              </button>
            )}
            
            <button
              type="button"
              onClick={toggleFacingMode}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 cursor-pointer"
              title="Flip between Front and Rear Camera"
            >
              <SwitchCamera className="w-3.5 h-3.5 text-slate-700" />
              <span>{facingMode === 'user' ? 'Back' : 'Front'}</span>
            </button>
          </div>

          {/* Scanner Telemetry & Hardware Wedge Monitor */}
          <div className="bg-slate-900 text-slate-200 p-2.5 rounded-xl font-mono text-[10px] space-y-1 shadow-inner">
            <div className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>HARDWARE WEDGE + CAMERA:</span>
              </span>
              <span className="text-emerald-400 font-bold">
                {diagnostic.lastScanLatencyMs > 0 ? `${diagnostic.lastScanLatencyMs} ms (HID Gun)` : isCameraActive ? 'Camera Live' : 'HID Ready'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>LAST SCANNED PAYLOAD:</span>
              <span className="text-slate-100 font-bold truncate max-w-[170px]">
                {lastScannedQr || diagnostic.lastScannedPayload || 'None'}
              </span>
            </div>
          </div>

          {/* Manual Input Fallback */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Manual Token / Barcode Input Fallback
            </label>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Scan or type token (e.g. 149 or ORD-...)"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
              >
                Verify
              </button>
            </form>
          </div>

          {/* Unclaimed Printed Slips List (Simulate Scan on Click) */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Unclaimed Printed Slips ({unclaimedOrders.length})</span>
              </label>
              <span className="text-[11px] text-slate-400">Click to emulate scan</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {unclaimedOrders.length === 0 ? (
                <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  All issued slips have been verified & served!
                </div>
              ) : (
                unclaimedOrders.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => handleVerify(o.orderUuid)}
                    className="p-3 bg-white hover:bg-emerald-50/50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer flex items-center justify-between shadow-2xs group"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        #{o.token}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                          {o.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {o.meal} • Issued {o.issuedAt}
                        </div>
                      </div>
                    </div>

                    <button className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <span>Scan</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Verification Banner & Live Feed (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Instant Large Visual Verification Status Banner */}
          {verificationResult.type === 'IDLE' && (
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-7 shadow-sm flex flex-col items-center justify-center text-center min-h-[270px] transition-all">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
                <Scan className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Awaiting Slip Scan</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Aim the 2D Barcode Scanner at the paper slip QR code, or click one from the unclaimed list on the left.
              </p>
            </div>
          )}

          {/* GREEN: Valid Order Verified & Dispensed */}
          {verificationResult.type === 'SUCCESS' && verificationResult.order && (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center min-h-[270px] transition-all">
              <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="text-xs font-mono font-black px-3 py-1 rounded-full bg-emerald-200 text-emerald-900 uppercase tracking-wide">
                ORDER VERIFIED & DISPENSED
              </span>
              <h3 className="text-3xl font-black text-slate-900 mt-2 font-mono">
                TOKEN #{verificationResult.order.token}
              </h3>
              <p className="text-base font-bold text-slate-800 mt-0.5">
                {verificationResult.order.name}{' '}
                <span className="text-xs text-slate-500 font-mono">
                  ({verificationResult.order.userId})
                </span>
              </p>
              <p className="text-xs text-slate-600">{verificationResult.order.dept}</p>

              <div className="mt-3.5 inline-flex items-center space-x-3 text-xs font-mono bg-white text-slate-800 px-4 py-2 rounded-xl border border-slate-200 shadow-2xs">
                <span>
                  Meal: <strong className="text-emerald-800">{verificationResult.order.meal}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  Served At: <strong className="text-emerald-800">{verificationResult.order.servedAt}</strong>
                </span>
              </div>
            </div>
          )}

          {/* RED: Security Alert - Duplicate Claim Blocked */}
          {verificationResult.type === 'DUPLICATE_CLAIM' && verificationResult.order && (
            <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center min-h-[270px] animate-shake">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <span className="text-xs font-mono font-black px-3 py-1 rounded-full bg-rose-200 text-rose-900 uppercase tracking-wide">
                SECURITY ALERT: MEAL ALREADY CLAIMED
              </span>
              <h3 className="text-3xl font-black text-rose-950 mt-2 font-mono">
                TOKEN #{verificationResult.order.token}
              </h3>
              <p className="text-sm font-bold text-rose-800 mt-0.5">
                {verificationResult.order.name} • {verificationResult.order.dept}
              </p>

              <div className="mt-3.5 text-xs bg-rose-100/80 text-rose-900 px-4 py-2.5 rounded-xl border border-rose-200 max-w-md">
                Meal ({verificationResult.order.meal}) was <strong>ALREADY SERVED</strong> at{' '}
                <span className="font-mono font-bold">{verificationResult.previousServedTime}</span>.
                <br />
                <span className="font-semibold text-rose-800">
                  Reject duplicate attempt to stop double-dipping!
                </span>
              </div>
            </div>
          )}

          {/* AMBER: Invalid Token */}
          {verificationResult.type === 'INVALID_TOKEN' && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center min-h-[270px] animate-shake">
              <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <HelpCircle className="w-8 h-8" />
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded bg-amber-200 text-amber-900 uppercase">
                INVALID / UNRECOGNIZED TOKEN
              </span>
              <h3 className="text-xl font-bold text-amber-950 mt-2">Unrecognized Paper Slip</h3>
              <p className="text-xs text-amber-800 mt-1 max-w-sm">
                {verificationResult.message || 'No matching order found in the Supabase ledger.'}
              </p>
            </div>
          )}

          {/* Kitchen Live Feed Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Utensils className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">Today's Dispense Feed</h4>
              </div>
              <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Live Sync
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 mt-2">
                <thead className="text-slate-500 uppercase bg-slate-50 font-mono text-[10px]">
                  <tr>
                    <th className="p-2.5 rounded-l">Token</th>
                    <th className="p-2.5">User</th>
                    <th className="p-2.5">Meal</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 rounded-r">Served Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {recentDispensed.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-slate-900">
                        #{o.token}
                      </td>
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{o.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{o.userId}</div>
                      </td>
                      <td className="p-2.5 font-semibold text-slate-800">{o.meal}</td>
                      <td className="p-2.5">
                        {o.status === 'SERVED' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            SERVED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            PRINTED
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-slate-600">
                        {o.servedAt || <span className="text-amber-600 italic">In Queue</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
