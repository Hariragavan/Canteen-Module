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

          // A detection was found. Validate that this detection is:
          // 1. Confident face score (>= 0.52)
          // 2. Properly sized for a person at the kiosk (box.width >= minDim * 0.20 && <= minDim * 0.85)
          // 3. Centered within the circle reticle (distance from frame center <= minDim * 0.28)
          const vW = videoEl.videoWidth;
          const vH = videoEl.videoHeight;
          const minDim = Math.min(vW, vH);
          const box = detection.detection.box;
          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;
          const distFromCenter = Math.hypot(faceCenterX - vW / 2, faceCenterY - vH / 2);

          const isScoreGood = (detection.detection.score || 0) >= 0.52;
          const isProperSize = box.width >= minDim * 0.20 && box.width <= minDim * 0.85;
          const isCenteredInCircle = distFromCenter <= minDim * 0.28;

          // If a confident face is anywhere in frame, keep camera active (reset 5s inactivity timer)
          if (isScoreGood) {
            hasDetectedFaceOnceRef.current = true;
            lastFaceSeenRef.current = Date.now();
          }

          // If NOT centered inside the circle reticle or wrong size:
          // DO NOT SCAN! DO NOT MATCH! DO NOT REPORT "NOT REGISTERED"!
          if (!isScoreGood || !isProperSize || !isCenteredInCircle) {
            setHasFaceInFrame(false);
            if (!isMatching.current) {
              setStatusMessage('Align your face within the circle');
            }
            return;
          }

          // Face is CONFIRMED centered inside the reticle circle!
          setHasFaceInFrame(true);

          // Perform matching against registered roster with strict threshold (0.50)
          if (!isMatching.current && !isScanning) {
            isMatching.current = true;
            const best = findBestMatch(detection.descriptor, knownEmployees, 0.50);

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
      }, 350);

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
        {/* Main Viewfinder Frame - Touch anywhere to turn on camera when closed */}
        <div
          onClick={() => {
            if (!isCameraActive) {
              initCamera();
            }
          }}
          className={`relative w-full max-w-lg aspect-4/3 sm:aspect-16/10 h-[240px] sm:h-[270px] md:h-[290px] bg-slate-950 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center mx-auto transition-all duration-300 ${
            !isCameraActive ? 'cursor-pointer group hover:border-emerald-500' : ''
          } ${
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
            onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
            onCanPlay={() => videoRef.current?.play().catch(() => {})}
            className={`w-full h-full object-cover mirror transition-opacity duration-300 ${
              isCameraActive ? 'opacity-95' : 'opacity-0 pointer-events-none'
            }`}
          />

          {/* Top-Right Corner: Button to Turn OFF camera ONLY when camera is open */}
          {isCameraActive && (
            <div className="absolute top-3 right-3 z-30 flex items-center space-x-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stopCamera('Camera turned off by user. Touch anywhere to turn on.');
                }}
                title="Click to turn off camera"
                className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xl backdrop-blur flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer border border-rose-400"
              >
                <CameraOff className="w-4 h-4" />
                <span>Turn Off Camera</span>
              </button>
            </div>
          )}

          {/* Camera Closed Viewfinder Placeholder: Touch anywhere to start */}
          {!isCameraActive && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-950/95 text-center transition-all group-hover:bg-slate-950/90">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 group-hover:border-emerald-500/50 group-hover:scale-105 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 mb-3 shadow-inner transition-all">
                <Camera className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-slate-100 tracking-tight">Touch Anywhere to Turn On Camera</h4>
              <p className="text-xs text-emerald-400 font-semibold max-w-xs mt-1 mb-3 font-sans">
                கேமராவை இயக்க எங்கு வேண்டுமானாலும் தொடவும்
              </p>
              <div className="px-5 py-2.5 bg-emerald-600 group-hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center space-x-2 transition-all">
                <Camera className="w-4 h-4" />
                <span>Turn On Camera (தொடவும்)</span>
              </div>
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
