import * as faceapi from '@vladmandic/face-api';
import type { Employee } from '../types';

export interface FaceMatchResult {
  hasFace: boolean;
  isMatch: boolean;
  matchedEmployee: Employee | null;
  confidence: number;
  distance?: number;
  reason?: string;
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  ear?: {
    left: number;
    right: number;
  };
}

let modelsLoadedPromise: Promise<boolean> | null = null;

/**
 * Load TinyFaceDetector, Landmarks, and Face Recognition neural models
 * optimized for low-end mobile devices and tablets with immediate WebGL memory cleanup.
 */
export async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoadedPromise) {
    return modelsLoadedPromise;
  }

  modelsLoadedPromise = (async () => {
    const base = import.meta.env.BASE_URL || '/';
    const LOCAL_URL = `${base.replace(/\/+$/, '')}/models`;
    const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

    // 1. Optimize WebGL settings for low-end mobile/tablet devices
    try {
      if (faceapi.tf?.ENV) {
        // Half-precision 16-bit float textures cut VRAM usage in half on mobile GPUs
        faceapi.tf.ENV.set('WEBGL_FORCE_F16_TEXTURES', true);
        // Free GPU textures immediately instead of pooling to prevent browser tab crashes (OOM)
        faceapi.tf.ENV.set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
        faceapi.tf.ENV.set('WEBGL_PACK', true);
      }
    } catch {
      // ignore
    }

    try {
      // Prioritize lightweight real-time models for instant camera startup
      await faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_URL);
      try {
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(LOCAL_URL);
      } catch {
        // fallback
      }
      await faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_URL);

      // Load SSD MobileNet in background for admin photo uploads without freezing camera
      faceapi.nets.ssdMobilenetv1.loadFromUri(LOCAL_URL).catch(() => {});
      return true;
    } catch (localErr) {
      console.warn('Could not load models from /models, falling back to CDN:', localErr);
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL);
        return true;
      } catch (cdnErr) {
        console.error('Failed loading face recognition neural models from all sources:', cdnErr);
        modelsLoadedPromise = null;
        return false;
      }
    }
  })();

  return modelsLoadedPromise;
}

export interface CameraStreamResult {
  stream: MediaStream;
  actualFacingMode: 'user' | 'environment';
  label: string;
}

/**
 * Start camera with front ('user') or rear ('environment') facing mode.
 * Uses hardware device enumeration to locate and open the actual back/rear camera on tablets and phones.
 */
export async function startCameraWithFacingMode(
  videoElement: HTMLVideoElement,
  facingMode: 'user' | 'environment' = 'user'
): Promise<CameraStreamResult> {
  // 1. Fully release previous stream and wait for OS hardware lock release (essential on Android/iOS)
  if (videoElement.srcObject) {
    try {
      const oldStream = videoElement.srcObject as MediaStream;
      oldStream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
    } catch {
      // ignore
    }
    videoElement.srcObject = null;
    // Allow Android HAL / iOS AVFoundation 300ms to cleanly release the camera hardware
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  let stream: MediaStream | null = null;
  let detectedFacingMode: 'user' | 'environment' = facingMode;

  // Clean helper matchers for device labels
  const isBackLabel = (l: string) =>
    /back|rear|environment|world/i.test(l) && !/front|user|selfie/i.test(l);
  const isFrontLabel = (l: string) =>
    /front|user|selfie/i.test(l) && !/back|rear|environment/i.test(l);

  // Strategy 1: Prioritize Hardware Device Enumeration
  // On Android/Chrome, facingMode: 'environment' often silently defaults to camera1 (front).
  // Directly targeting the physical rear deviceId forces Chrome to open the actual back camera!
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === 'videoinput');

    if (videoInputs.length > 0) {
      let targetDevice: MediaDeviceInfo | undefined;

      if (facingMode === 'environment') {
        // Priority 1a: Label explicitly mentions back/rear/environment
        targetDevice = videoInputs.find((d) => isBackLabel(d.label));

        // Priority 1b: Label does NOT mention front (e.g. camera0 while camera1 is front)
        if (!targetDevice && videoInputs.length > 1) {
          targetDevice = videoInputs.find((d) => !isFrontLabel(d.label) && d.label.length > 0);
        }

        // Priority 1c: By Android convention, camera0 is back, camera1 is front
        if (!targetDevice && videoInputs.length > 1) {
          targetDevice = videoInputs.find((d) => /camera\s*0|camera0/i.test(d.label)) || videoInputs[0];
        }
      } else {
        // Priority 1d: Front camera
        targetDevice = videoInputs.find((d) => isFrontLabel(d.label));
        if (!targetDevice && videoInputs.length > 1) {
          targetDevice = videoInputs.find((d) => /camera\s*1|camera1/i.test(d.label)) || videoInputs[1];
        }
      }

      // Standard 480p/720p constraints prevent high-res 1080p/4K sensors from crashing mobile browser VRAM
      const baseConstraints: MediaTrackConstraints = {
        width: { ideal: 640, max: 960 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 24, max: 30 },
      };

      if (targetDevice && targetDevice.deviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: targetDevice.deviceId }, ...baseConstraints },
            audio: false,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: targetDevice.deviceId, ...baseConstraints },
              audio: false,
            });
          } catch {
            // fall through to facingMode constraints
          }
        }
      }
    }
  } catch (err) {
    console.warn('Hardware device enumeration lookup warning:', err);
  }

  const baseConstraints: MediaTrackConstraints = {
    width: { ideal: 640, max: 960 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 24, max: 30 },
  };

  // Strategy 2: Exact facingMode constraint
  if (!stream) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: facingMode }, ...baseConstraints },
        audio: false,
      });
    } catch {
      // Exact constraint failed, proceed to ideal
    }
  }

  // Strategy 3: Soft facingMode with strict rear/front verification
  if (!stream) {
    try {
      const candidate = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, ...baseConstraints },
        audio: false,
      });

      const candTrack = candidate.getVideoTracks()[0];
      const candLabel = candTrack?.label || '';
      const candSettings = candTrack?.getSettings?.() || {};

      // If we asked for environment (rear), but the browser gave us the front camera:
      if (facingMode === 'environment' && (isFrontLabel(candLabel) || candSettings.facingMode === 'user')) {
        // Stop candidate track to unlock hardware
        candTrack.stop();

        // Enumerate devices freshly now that permission is active
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const allVideos = allDevices.filter((d) => d.kind === 'videoinput');
        const alternateDevice = allVideos.find(
          (d) => !isFrontLabel(d.label) && d.deviceId !== candSettings.deviceId
        );

        if (alternateDevice) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: alternateDevice.deviceId }, ...baseConstraints },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: alternateDevice.deviceId, ...baseConstraints },
              audio: false,
            });
          }
        }
      } else {
        stream = candidate;
      }
    } catch {
      // Fall through to ultimate fallback
    }
  }

  // Strategy 4: Ultimate Fallback (any available camera with 480p cap)
  if (!stream) {
    stream = await navigator.mediaDevices.getUserMedia({
      video: baseConstraints,
      audio: false,
    });
  }

  // 4. Verify what camera actually opened from active track settings
  const track = stream.getVideoTracks()[0];
  const trackLabel = track?.label || '';
  const settings = track?.getSettings?.() || {};

  if (settings.facingMode === 'environment' || isBackLabel(trackLabel)) {
    detectedFacingMode = 'environment';
  } else if (settings.facingMode === 'user' || isFrontLabel(trackLabel)) {
    detectedFacingMode = 'user';
  } else {
    detectedFacingMode = facingMode;
  }

  videoElement.srcObject = stream;
  videoElement.setAttribute('playsinline', 'true');
  videoElement.setAttribute('autoplay', 'true');
  videoElement.muted = true;

  // Ensure video element plays and doesn't remain blank
  try {
    await videoElement.play();
  } catch (err) {
    console.warn('Camera video play warning:', err);
  }

  return {
    stream,
    actualFacingMode: detectedFacingMode,
    label: trackLabel || (detectedFacingMode === 'environment' ? 'Back Camera' : 'Front Camera'),
  };
}

/**
 * Start front tablet camera with robust fallbacks for all tablet/phone hardware
 */
export const startTabletCamera = async (videoElement: HTMLVideoElement): Promise<MediaStream> => {
  const res = await startCameraWithFacingMode(videoElement, 'user');
  return res.stream;
};

/**
 * Eye Aspect Ratio (EAR) calculation for liveness / anti-spoofing
 * Landmarks 36-41 for left eye, 42-47 for right eye
 */
export function getEyeAspectRatio(eye: faceapi.Point[]): number {
  if (!eye || eye.length < 6) return 0;
  const d1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const d2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  const d3 = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
  if (d3 === 0) return 0;
  return (d1 + d2) / (2.0 * d3);
}

export interface FaceMatchDetail {
  employee: Employee;
  distance: number;
  accuracy: number;
}

/**
 * Calculates exact biometric accuracy percentage from Euclidean distance.
 * distance 0.00 -> 100.0%
 * distance 0.20 -> 88.0%
 * distance 0.35 -> 79.0%
 * distance 0.44 -> 73.6% (duplicate boundary)
 */
export function calculateAccuracyPercent(distance: number): number {
  if (distance <= 0) return 100.0;
  const rawScore = 100 - (distance / 0.55) * 33;
  const clamped = Math.max(50.0, Math.min(99.9, rawScore));
  return Math.round(clamped * 10) / 10;
}

/**
 * Cosine / Euclidean distance vector matcher for 128D embeddings.
 * Threshold 0.44 strictly detects true duplicates (same person with/without glasses)
 * while preventing false matches on different people.
 */
export function findBestMatch(
  currentDescriptor: Float32Array | number[] | null | undefined,
  employees: Employee[],
  maxDistance = 0.44
): FaceMatchDetail | null {
  if (!currentDescriptor) return null;

  const currentArr =
    currentDescriptor instanceof Float32Array
      ? currentDescriptor
      : new Float32Array(currentDescriptor);

  if (currentArr.length !== 128) return null;

  let bestMatch: Employee | null = null;
  let minDistance = maxDistance;

  for (const emp of employees) {
    const rawTarget = emp.face_descriptor || emp.embedding;
    if (!rawTarget) continue;

    let targetArr: Float32Array | null = null;
    if (rawTarget instanceof Float32Array) {
      targetArr = rawTarget.length === 128 ? rawTarget : null;
    } else if (Array.isArray(rawTarget)) {
      targetArr = rawTarget.length === 128 ? new Float32Array(rawTarget) : null;
    } else if (typeof rawTarget === 'string') {
      try {
        const p = JSON.parse(rawTarget);
        if (Array.isArray(p) && p.length === 128) {
          targetArr = new Float32Array(p);
        } else if (typeof p === 'object' && p !== null) {
          const vals = Object.values(p).map(Number);
          if (vals.length === 128) targetArr = new Float32Array(vals);
        }
      } catch {
        // ignore invalid JSON
      }
    } else if (typeof rawTarget === 'object' && rawTarget !== null) {
      const vals = Object.values(rawTarget).map(Number);
      if (vals.length === 128) targetArr = new Float32Array(vals);
    }

    if (!targetArr || targetArr.length !== 128) continue;

    const distance = faceapi.euclideanDistance(currentArr, targetArr);

    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = emp;
    }
  }

  if (bestMatch) {
    const accuracy = calculateAccuracyPercent(minDistance);
    return { employee: bestMatch, distance: minDistance, accuracy };
  }
  return null;
}

/**
 * Extract 128D face descriptor and landmarks from an HTMLVideoElement,
 * HTMLCanvasElement, HTMLImageElement, or data URL / URL string.
 * Uses high confidence threshold (0.50) to prevent detecting non-face objects.
 */
export async function extractFaceDetection(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | string,
  preferTiny = true
): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>> | null> {
  await loadFaceApiModels();

  let inputElement: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;

  if (typeof source === 'string') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image for biometric extraction'));
      img.src = source;
    });
    inputElement = img;
  } else if (source instanceof HTMLVideoElement) {
    if (source.readyState < 2 || !source.videoWidth || !source.videoHeight) {
      return null;
    }
    // Pass video element directly to faceapi - avoids creating canvas elements repeatedly in memory
    inputElement = source;
  } else {
    inputElement = source;
  }

  const isVideo = inputElement instanceof HTMLVideoElement;

  // 1. Primary mobile/low-end detector: TinyFaceDetector with inputSize: 224
  // 10x faster (15-25ms) and uses 80% less memory than SSD MobileNet
  if (isVideo || preferTiny) {
    try {
      const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 });
      let detection = null;
      try {
        detection = await faceapi
          .detectSingleFace(inputElement, tinyOptions)
          .withFaceLandmarks(true)
          .withFaceDescriptor();
      } catch {
        // Fallback to standard landmarks if tiny landmarks not loaded
        detection = await faceapi
          .detectSingleFace(inputElement, tinyOptions)
          .withFaceLandmarks(false)
          .withFaceDescriptor();
      }
      if (detection && detection.detection.score >= 0.45) return detection;
    } catch (err) {
      console.warn('TinyFaceDetector error:', err);
    }
  }

  // 2. High-accuracy fallback for admin photo uploads & static enrollment
  try {
    const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.50 });
    const detection = await faceapi
      .detectSingleFace(inputElement, ssdOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (detection && detection.detection.score >= 0.50) return detection;
  } catch (err) {
    // ignore
  }

  return null;
}

class FaceMatcherService {
  /**
   * Initialize models
   */
  public async initModels(): Promise<boolean> {
    return loadFaceApiModels();
  }

  /**
   * Fast real-time face presence check
   */
  public async detectFacePresence(
    source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | string
  ): Promise<boolean> {
    try {
      const detection = await extractFaceDetection(source);
      return detection !== null;
    } catch {
      return false;
    }
  }

  /**
   * Extract 128D float array for employee registration
   */
  public async extractDescriptorArray(
    source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | string
  ): Promise<number[] | null> {
    try {
      const detection = await extractFaceDetection(source);
      if (!detection) return null;
      return Array.from(detection.descriptor);
    } catch (err) {
      console.warn('Error extracting face descriptor array:', err);
      return null;
    }
  }

  /**
   * Match live face image/snapshot against roster using deep 128D biometric vector matching
   */
  public async matchLiveFace(
    snapshotSource: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | string,
    employees: Employee[]
  ): Promise<FaceMatchResult> {
    try {
      await loadFaceApiModels();
      const detection = await extractFaceDetection(snapshotSource);

      if (!detection) {
        return {
          hasFace: false,
          isMatch: false,
          matchedEmployee: null,
          confidence: 0,
          reason: 'No face detected in the scan area. Please center your face inside the camera oval.',
        };
      }

      // Check alignment / size
      const box = detection.detection.box;
      if (box.width < 120) {
        return {
          hasFace: true,
          isMatch: false,
          matchedEmployee: null,
          confidence: Math.round(detection.detection.score * 100),
          reason: 'Step closer to the camera to align your face within the frame.',
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        };
      }

      // Liveness / Eye Aspect Ratio
      const landmarks = detection.landmarks;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const earLeft = getEyeAspectRatio(leftEye);
      const earRight = getEyeAspectRatio(rightEye);

      // Perform 128D Euclidean distance matching (threshold 0.48 accommodates glasses and lighting variations)
      const match = findBestMatch(detection.descriptor, employees, 0.48);

      if (match) {
        return {
          hasFace: true,
          isMatch: true,
          matchedEmployee: match.employee,
          confidence: Math.round(match.accuracy),
          distance: Number(match.distance.toFixed(4)),
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          ear: { left: Number(earLeft.toFixed(2)), right: Number(earRight.toFixed(2)) },
        };
      }

      // Face was detected, but not registered in roster
      return {
        hasFace: true,
        isMatch: false,
        matchedEmployee: null,
        confidence: Math.round(detection.detection.score * 100),
        reason:
          'Biometric Verification Failed: Person is NOT registered in the canteen roster. Access Denied.',
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        ear: { left: Number(earLeft.toFixed(2)), right: Number(earRight.toFixed(2)) },
      };
    } catch (err) {
      console.error('Error during biometric matchLiveFace:', err);
      return {
        hasFace: false,
        isMatch: false,
        matchedEmployee: null,
        confidence: 0,
        reason: 'Biometric neural processing error. Please try again.',
      };
    }
  }

  /**
   * Fast live face alignment check for camera preview:
   * Uses lightweight TinyFaceDetector (~15ms) without landmarks or 128D descriptors.
   * Keeps live camera feed running at smooth 30fps without UI lag.
   */
  public async checkAlignment(
    source: HTMLVideoElement | HTMLCanvasElement
  ): Promise<{ hasFace: boolean; isAligned: boolean; message: string }> {
    try {
      await loadFaceApiModels();
      if (source instanceof HTMLVideoElement && (source.readyState < 2 || !source.videoWidth)) {
        return { hasFace: false, isAligned: false, message: 'Starting camera...' };
      }

      // 1. Fast lightweight detector: TinyFaceDetector takes ~12ms
      const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.40 });
      let detection = await faceapi.detectSingleFace(source, tinyOptions);

      // 2. Fallback to SSD if TinyFaceDetector misses
      if (!detection) {
        const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.42 });
        detection = await faceapi.detectSingleFace(source, ssdOptions);
      }

      if (!detection) {
        return { hasFace: false, isAligned: false, message: 'Align face in circle' };
      }

      const box = detection.box;
      const videoW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
      const videoH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

      // Realistic sizing checks for tablets & phones
      if (box.width < 60) {
        return { hasFace: true, isAligned: false, message: 'Step closer to camera' };
      }
      if (box.width > videoW * 0.95) {
        return { hasFace: true, isAligned: false, message: 'Step back slightly' };
      }

      // Check center with realistic bounds
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const isCenteredX = Math.abs(centerX - videoW / 2) < videoW * 0.42;
      const isCenteredY = Math.abs(centerY - videoH / 2) < videoH * 0.42;

      if (!isCenteredX || !isCenteredY) {
        return { hasFace: true, isAligned: false, message: 'Center face in circle' };
      }

      return { hasFace: true, isAligned: true, message: 'Face aligned correctly' };
    } catch {
      return { hasFace: false, isAligned: false, message: 'Align face in circle' };
    }
  }
}

export const faceMatcherService = new FaceMatcherService();
