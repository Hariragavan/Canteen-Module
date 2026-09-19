import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, Check, Upload, X } from 'lucide-react';
import type { Employee } from '../../types';
import {
  loadFaceApiModels,
  startTabletCamera,
  getEyeAspectRatio,
  findBestMatch,
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
    const [statusMessage, setStatusMessage] = useState<string>('Loading Neural Models...');
    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const [testPhoto, setTestPhoto] = useState<string | null>(null);
    const [hasFaceInFrame, setHasFaceInFrame] = useState<boolean>(false);
    const [locallyVerified, setLocallyVerified] = useState<boolean>(false);
    const isMatching = useRef<boolean>(false);

    // 1. Initialize FaceAPI Neural Models from /models (with CDN fallback)
    useEffect(() => {
      let isMounted = true;
      async function initModels() {
        try {
          const success = await loadFaceApiModels();
          if (isMounted) {
            if (success) {
              setModelLoaded(true);
              setStatusMessage('Align your face within the frame');
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

    // 2. Start Front Camera (720p/30fps optimized)
    const initCamera = useCallback(async () => {
      if (!videoRef.current) return;
      try {
        await startTabletCamera(videoRef.current);
        setIsCameraActive(true);
      } catch (err) {
        console.warn('Physical camera access error:', err);
        setIsCameraActive(false);
        setStatusMessage('Camera access denied or unavailable');
      }
    }, []);

    useEffect(() => {
      if (!modelLoaded) return;
      initCamera();

      return () => {
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
          videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
      };
    }, [modelLoaded, initCamera]);

    // 3. Continuous Face Tracking Loop (Every 400ms: Punching Machine Face Detection)
    useEffect(() => {
      if (!modelLoaded || isVerified || locallyVerified) return;

      const interval = setInterval(async () => {
        if (isMatching.current || isScanning) return;

        const videoEl = videoRef.current;
        let detectionTarget: HTMLVideoElement | HTMLImageElement | null = null;

        if (isCameraActive && videoEl && videoEl.readyState >= 2) {
          detectionTarget = videoEl;
        } else if (testPhoto) {
          const img = new Image();
          img.src = testPhoto;
          detectionTarget = img;
        }

        if (!detectionTarget) return;

        try {
          // Real deep learning detection: SSD MobileNet V1 + Landmarks + 128D descriptor
          const detection = await faceapi
            .detectSingleFace(detectionTarget)
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) {
            setHasFaceInFrame(false);
            setStatusMessage('Align your face within the frame');
            return;
          }

          setHasFaceInFrame(true);

          // Check face alignment: bounding box must be reasonably sized/centered
          const box = detection.detection.box;
          if (box.width < 140) {
            setStatusMessage('Step closer to the camera');
            return;
          }

          // Anti-Spoofing: calculate eye aspect ratio from landmarks 36-47
          const landmarks = detection.landmarks;
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();
          const earLeft = getEyeAspectRatio(leftEye);
          const earRight = getEyeAspectRatio(rightEye);

          // If eyes are too compressed or unnatural, continue monitoring
          if (earLeft < 0.12 && earRight < 0.12) {
            setStatusMessage('Please open your eyes and face the camera');
            return;
          }

          // Match extracted 128D descriptor against enrolled roster
          isMatching.current = true;
          setStatusMessage('Identifying...');

          const matchResult = findBestMatch(detection.descriptor, knownEmployees, 0.52);

          if (matchResult && matchResult.employee) {
            const emp = matchResult.employee;
            setStatusMessage(`Recognized: ${emp.name}`);
            setLocallyVerified(true);

            if (onUserIdentified) {
              onUserIdentified(emp);
            }

            // Release matching lock after 2 seconds
            setTimeout(() => {
              isMatching.current = false;
              setLocallyVerified(false);
            }, 2000);
          } else {
            setStatusMessage('Face not registered');
            if (onFaceNotRegistered) {
              onFaceNotRegistered(
                'Biometric Verification Failed: Person is NOT registered in the canteen roster. Access Denied.'
              );
            }
            // Cooldown period before scanning again
            setTimeout(() => {
              isMatching.current = false;
            }, 1500);
          }
        } catch (err) {
          console.warn('Continuous face tracking error:', err);
          isMatching.current = false;
        }
      }, 400); // 2.5 times per second (smooth and prevents tablet overheating)

      return () => clearInterval(interval);
    }, [
      modelLoaded,
      isCameraActive,
      testPhoto,
      knownEmployees,
      isScanning,
      isVerified,
      locallyVerified,
      onUserIdentified,
      onFaceNotRegistered,
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
        if (testPhoto) {
          return testPhoto;
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

          {/* Test photo preview when physical camera is offline */}
          {testPhoto && !isCameraActive && (
            <img
              src={testPhoto}
              alt="Test Biometric Face"
              className="absolute inset-0 w-full h-full object-cover mirror"
            />
          )}

          {/* Target Reticle Oval for Face Alignment (Pulsing Emerald) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div
              className={`w-44 h-56 sm:w-48 sm:h-60 border-2 rounded-[50%] border-dashed transition-all duration-300 flex items-center justify-center ${
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

            {/* Status Message Pill */}
            <p
              className={`mt-4 px-4 py-1.5 backdrop-blur-md text-xs font-semibold rounded-full transition-all duration-200 shadow-md ${
                verifiedActive
                  ? 'bg-emerald-600/90 text-white border border-emerald-400'
                  : statusMessage.includes('not registered')
                  ? 'bg-rose-600/90 text-white border border-rose-400 animate-shake'
                  : statusMessage.includes('closer') || statusMessage.includes('Align')
                  ? 'bg-black/70 text-slate-200 border border-slate-600'
                  : 'bg-black/75 text-emerald-300 border border-emerald-500/50'
              }`}
            >
              {statusMessage}
            </p>
          </div>

          {/* Flash Effect on capture */}
          {isCapturing && (
            <div className="absolute inset-0 bg-white animate-out fade-out duration-300 pointer-events-none z-30"></div>
          )}

          {/* Floating Controls in bottom right corner (Camera Switch / Test Image) */}
          <div className="absolute bottom-3 right-3 flex items-center space-x-1.5 z-20">
            {!isCameraActive && (
              <>
                {testPhoto ? (
                  <button
                    type="button"
                    onClick={() => setTestPhoto(null)}
                    title="Clear Test Photo"
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs border border-rose-200 shadow-md backdrop-blur transition-all active:scale-95"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <label
                    title="Upload test face photo for biometric match"
                    className="p-2 rounded-xl bg-white/90 hover:bg-white text-slate-800 text-xs border border-slate-200 shadow-md backdrop-blur transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-700" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            if (ev.target?.result) {
                              setTestPhoto(String(ev.target.result));
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                if (isCameraActive) {
                  if (videoRef.current && videoRef.current.srcObject) {
                    const stream = videoRef.current.srcObject as MediaStream;
                    stream.getTracks().forEach((track) => track.stop());
                    videoRef.current.srcObject = null;
                  }
                  setIsCameraActive(false);
                } else {
                  initCamera();
                }
              }}
              title={isCameraActive ? 'Switch to Test Mode' : 'Open Front Tablet Camera'}
              className="p-2 rounded-xl bg-white/90 hover:bg-white text-slate-800 text-xs border border-slate-200 shadow-md backdrop-blur transition-all active:scale-95"
            >
              <Camera className="w-3.5 h-3.5 text-slate-700" />
            </button>
          </div>

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
