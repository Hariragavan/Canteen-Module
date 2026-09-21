import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Camera, CameraOff, Check } from 'lucide-react';
import type { Employee } from '../../types';
import {
  loadFaceApiModels,
  startTabletCamera,
  findBestMatch,
  extractFaceDetection,
} from '../../services/faceMatcherService';

export interface FaceScannerHUDHandle {
  captureSnapshot: () => string;
}

interface FaceScannerHUDProps {
  currentEmployee?: Employee | null;
  knownEmployees?: Employee[];
  isScanning?: boolean;
  isCapturing?: boolean;
  isVerified?: boolean;
  onUserIdentified?: (employee: Employee) => void;
  onFaceNotRegistered?: (reason: string) => void;
  onAutoScan?: () => void;
}

export const FaceScannerHUD = forwardRef<FaceScannerHUDHandle, FaceScannerHUDProps>(
  (
    {
      knownEmployees = [],
      isScanning = false,
      isCapturing = false,
      isVerified = false,
      onUserIdentified,
      onFaceNotRegistered,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [modelLoaded, setModelLoaded] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('Camera is closed. Click Open Camera to start.');
    // App opens with camera CLOSED by default as requested
    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const [hasFaceInFrame, setHasFaceInFrame] = useState<boolean>(false);
    const [locallyVerified, setLocallyVerified] = useState<boolean>(false);
    const isMatching = useRef<boolean>(false);
    const lastFaceSeenRef = useRef<number>(Date.now());
    const cameraOpenedAtRef = useRef<number>(Date.now());
    const hasDetectedFaceOnceRef = useRef<boolean>(false);

    // 1. Initialize FaceAPI Neural Models from /models (with CDN fallback)
    useEffect(() => {
      let isMounted = true;
      async function initModels() {
        try {
          const success = await loadFaceApiModels();
          if (isMounted) {
            if (success) {
              setModelLoaded(true);
            } else {
              setStatusMessage('Model loading failed. Check network or /models.');
            }
          }
        } catch (err) {
          if (isMounted) {
            console.error('Error loading face-api models:', err);
            setStatusMessage('Failed to initialize biometric models');
          }
        }
      }
      initModels();
      return () => {
        isMounted = false;
      };
    }, []);

    // 2. Camera Controls: Start and Stop
    const stopCamera = useCallback((message?: string) => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
      setHasFaceInFrame(false);
      hasDetectedFaceOnceRef.current = false;
      isMatching.current = false;
      setStatusMessage(message || 'Camera is closed. Click Open Camera to start.');
    }, []);

    const initCamera = useCallback(async () => {
      if (!videoRef.current) return;
      try {
        await startTabletCamera(videoRef.current);
        setIsCameraActive(true);
        setHasFaceInFrame(false);
        hasDetectedFaceOnceRef.current = false;
        cameraOpenedAtRef.current = Date.now();
        lastFaceSeenRef.current = Date.now();
        setStatusMessage('Align your face within the circle');
      } catch (err) {
        console.warn('Physical camera access error:', err);
        setIsCameraActive(false);
        setStatusMessage('Camera access denied or unavailable');
      }
    }, []);

    // Clean up media tracks on unmount
    useEffect(() => {
      return () => {
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
          videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
      };
    }, []);

    // 3. Periodic Face Tracking Loop:
    // - Shows strictly "Align your face within the circle" during scanning
    // - Uses tablet-optimized dual detector with offscreen canvas conversion
    // - Turns OFF camera after 5 seconds if face leaves frame (with 15s setup grace when opened)
    useEffect(() => {
      if (!modelLoaded || isVerified || locallyVerified || !isCameraActive) return;

      lastFaceSeenRef.current = Date.now();
      cameraOpenedAtRef.current = Date.now();
      hasDetectedFaceOnceRef.current = false;

      const checkInterval = setInterval(async () => {
        if (!isCameraActive || isVerified || locallyVerified) return;

        const videoEl = videoRef.current;
        if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return;

        try {
          // Use tablet-compatible dual detector
          const detection = await extractFaceDetection(videoEl);

          if (!detection) {
            setHasFaceInFrame(false);
            const now = Date.now();
            const elapsedSinceOpen = now - cameraOpenedAtRef.current;
            const elapsedSinceFaceSeen = now - lastFaceSeenRef.current;

            // Auto-off logic:
            // 1. If a face was previously in frame and has now been absent for 5s -> TURN OFF CAMERA!
            // 2. If camera was just opened, give 15 seconds initial grace window to step in front
            const shouldAutoOff =
              (hasDetectedFaceOnceRef.current && elapsedSinceFaceSeen >= 5000) ||
              (!hasDetectedFaceOnceRef.current && elapsedSinceOpen >= 15000);

            if (shouldAutoOff) {
              console.log('No face detected in camera. Automatically turning off camera.');
              stopCamera('Camera turned off (no face detected). Click Open Camera to start.');
              return;
            }

            // Strictly show "Align your face within the circle" while scanning
            if (!isMatching.current) {
              setStatusMessage('Align your face within the circle');
            }
            return;
          }

          // Human face detected in frame!
          setHasFaceInFrame(true);
          hasDetectedFaceOnceRef.current = true;
          lastFaceSeenRef.current = Date.now(); // Reset 5-second inactivity timer

          // Perform matching against registered roster
          if (!isMatching.current && !isScanning) {
            isMatching.current = true;
            const best = findBestMatch(detection.descriptor, knownEmployees, 0.58);

            if (best) {
              setStatusMessage(`✓ Verified: ${best.employee.name} (${best.accuracy}% match)`);
              setLocallyVerified(true);
              if (onUserIdentified) {
                onUserIdentified(best.employee);
              }
            } else {
              setStatusMessage('⚠️ Face not registered in system');
              if (onFaceNotRegistered) {
                onFaceNotRegistered('Face not found in biometric database');
              }
              setTimeout(() => {
                isMatching.current = false;
                setStatusMessage('Align your face within the circle');
              }, 3000);
            }
          }
        } catch (err) {
          console.warn('Face detection error:', err);
          isMatching.current = false;
        }
      }, 1000);

      return () => {
        clearInterval(checkInterval);
      };
    }, [
      modelLoaded,
      isVerified,
      locallyVerified,
      isCameraActive,
      knownEmployees,
      isScanning,
      onUserIdentified,
      onFaceNotRegistered,
      stopCamera,
    ]);

    // Expose captureSnapshot for thermal ticket printing & manual capture
    useImperativeHandle(ref, () => ({
      captureSnapshot: () => {
        if (videoRef.current && isCameraActive) {
          try {
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = videoRef.current.videoWidth || 640;
            offscreenCanvas.height = videoRef.current.videoHeight || 480;
            const ctx = offscreenCanvas.getContext('2d');
            if (ctx) {
              // Draw video with mirror transform
              ctx.save();
              ctx.translate(offscreenCanvas.width, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(videoRef.current, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
              ctx.restore();
              return offscreenCanvas.toDataURL('image/jpeg', 0.88);
            }
          } catch (e) {
            console.warn('Could not grab video frame:', e);
          }
        }
        return '';
      },
    }));

    const verifiedActive = isVerified || locallyVerified;

    return (
      <div className="flex flex-col items-center gap-2 w-full">
        {/* Main Viewfinder Frame - Turns Glowing Green when face verified */}
        <div
          className={`relative w-full max-w-lg aspect-4/3 sm:aspect-16/10 h-[240px] sm:h-[270px] md:h-[290px] bg-slate-950 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center mx-auto transition-all duration-300 ${
            verifiedActive
              ? 'border-4 border-emerald-500 ring-4 ring-emerald-400/50 shadow-[0_0_35px_rgba(16,185,129,0.6)]'
              : 'border-2 border-slate-300'
          }`}
        >
          {/* Live Tablet Camera Feed with mirror styling */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover mirror transition-opacity duration-300 ${
              isCameraActive ? 'opacity-95' : 'opacity-0 pointer-events-none'
            }`}
          />

          {/* Top-Right Corner: Dedicated button to Turn OFF / Turn ON camera */}
          <div className="absolute top-3 right-3 z-30 flex items-center space-x-1.5">
            {isCameraActive ? (
              <button
                type="button"
                onClick={() => stopCamera()}
                title="Click to turn off camera"
                className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-lg backdrop-blur flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer border border-rose-500"
              >
                <CameraOff className="w-3.5 h-3.5" />
                <span>Off Camera</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={initCamera}
                title="Click to open camera"
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-lg backdrop-blur flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer border border-emerald-500"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Open Camera</span>
              </button>
            )}
          </div>

          {/* Camera Closed Viewfinder Placeholder */}
          {!isCameraActive && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-950/95 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-2 shadow-inner">
                <CameraOff className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-100 tracking-tight">Camera is Closed</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-0.5 mb-3 font-sans">
                Camera is off. Click below or the top-right button to start live biometric scanning.
              </p>
              <button
                type="button"
                onClick={initCamera}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Open Camera</span>
              </button>
            </div>
          )}

          {/* Target Reticle Circle for Face Alignment (Pulsing Emerald) - only when camera is active */}
          {isCameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
              <div
                className={`w-44 h-44 sm:w-52 sm:h-52 aspect-square border-2 rounded-full border-dashed transition-all duration-300 flex items-center justify-center ${
                  verifiedActive
                    ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_25px_rgba(16,185,129,0.6)]'
                    : hasFaceInFrame
                    ? 'border-emerald-400/90 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse'
                    : 'border-emerald-400/70 opacity-80 animate-pulse'
                }`}
              >
                {verifiedActive && (
                  <div className="p-3 bg-emerald-500 text-white rounded-full shadow-lg animate-in zoom-in-75 duration-200">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Status Message Pill: Strictly shows "Align your face within the circle" during scanning */}
              <p
                className={`mt-4 px-4 py-1.5 backdrop-blur-md text-xs font-semibold rounded-full transition-all duration-200 shadow-md ${
                  verifiedActive
                    ? 'bg-emerald-600/90 text-white border border-emerald-400'
                    : statusMessage.includes('not registered')
                    ? 'bg-rose-600/90 text-white border border-rose-400 animate-shake'
                    : 'bg-black/75 text-white border border-slate-600'
                }`}
              >
                {statusMessage}
              </p>
            </div>
          )}

          {/* Flash Effect on capture */}
          {isCapturing && (
            <div className="absolute inset-0 bg-white animate-out fade-out duration-300 pointer-events-none z-30"></div>
          )}

          <style>{`.mirror { transform: scaleX(-1); }`}</style>
        </div>

        <p className="text-[11px] text-slate-500 text-center font-sans">
          Corporate Punching Machine AI Face Detection • Automatic Real-Time Recognition
        </p>
      </div>
    );
  }
);

FaceScannerHUD.displayName = 'FaceScannerHUD';
