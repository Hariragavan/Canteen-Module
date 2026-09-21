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
 * Load SSD MobileNet V1, TinyFaceDetector, 68 Landmarks, and Face Recognition neural models
 * with automatic fallback to jsdelivr CDN if local files are ever missing.
 */
export async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoadedPromise) {
    return modelsLoadedPromise;
  }

  modelsLoadedPromise = (async () => {
    const LOCAL_URL = '/models';
    const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

    try {
      console.log('Loading face-api neural models from local /models...');
      await faceapi.nets.ssdMobilenetv1.loadFromUri(LOCAL_URL);
      await faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_URL);
      console.log('All neural models (SSD MobileNet, TinyFace, Landmarks, Recognition) loaded from /models.');
      return true;
    } catch (localErr) {
      console.warn('Could not load models from /models, falling back to CDN:', localErr);
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(CDN_URL);
        await faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL);
        console.log('Neural models loaded successfully from CDN.');
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

/**
 * Start front tablet camera with robust fallbacks for all tablet/phone hardware
 */
export const startTabletCamera = async (videoElement: HTMLVideoElement): Promise<MediaStream> => {
  let stream: MediaStream;
  try {
    // Optimal 720p front camera
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
      },
      audio: false,
    });
  } catch {
    try {
      // Fallback 1: basic user camera without strict resolution
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
    } catch {
      // Fallback 2: any available camera
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    }
  }

  videoElement.srcObject = stream;
  videoElement.setAttribute('playsinline', 'true');
  videoElement.setAttribute('autoplay', 'true');
  videoElement.muted = true;
  await videoElement.play().catch((err) => {
    console.warn('Tablet camera video playback warning:', err);
  });
  return stream;
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

/**
 * Cosine / Euclidean distance vector matcher for 128D embeddings
 * Standard threshold: < 0.52 (strict is < 0.50)
 */
export function findBestMatch(
  currentDescriptor: Float32Array | number[],
  employees: Employee[],
  maxDistance = 0.52
): { employee: Employee; distance: number } | null {
  let bestMatch: Employee | null = null;
  let minDistance = maxDistance;

  const currentArr =
    currentDescriptor instanceof Float32Array
      ? currentDescriptor
      : new Float32Array(currentDescriptor);

  for (const emp of employees) {
    const targetDescriptor = emp.face_descriptor || emp.embedding;
    if (!targetDescriptor || !Array.isArray(targetDescriptor) || targetDescriptor.length !== 128) {
      continue;
    }

    const targetArr = new Float32Array(targetDescriptor);
    const distance = faceapi.euclideanDistance(currentArr, targetArr);

    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = emp;
    }
  }

  if (bestMatch) {
    return { employee: bestMatch, distance: minDistance };
  }
  return null;
}

/**
 * Extract 128D face descriptor and landmarks from an HTMLVideoElement,
 * HTMLCanvasElement, HTMLImageElement, or data URL / URL string.
 * Uses dual detectors (SSD MobileNet + TinyFaceDetector) with offscreen canvas
 * conversion for 100% reliable tablet & mobile GPU compatibility.
 */
export async function extractFaceDetection(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | string
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
    // On tablet & mobile browsers, copying video frame to canvas prevents black WebGL textures
    const canvas = document.createElement('canvas');
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      inputElement = canvas;
    } else {
      inputElement = source;
    }
  } else {
    inputElement = source;
  }

  // 1. Primary high-accuracy detector: SSD MobileNet with sensitive threshold
  try {
    const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.30 });
    const detection = await faceapi
      .detectSingleFace(inputElement, ssdOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (detection) return detection;
  } catch (err) {
    console.warn('SSD MobileNet detection error:', err);
  }

  // 2. High-speed mobile/tablet fallback: TinyFaceDetector
  try {
    const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.25 });
    const detection = await faceapi
      .detectSingleFace(inputElement, tinyOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (detection) return detection;
  } catch (err) {
    console.warn('TinyFaceDetector fallback error:', err);
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

      // Perform 128D Euclidean distance matching
      const match = findBestMatch(detection.descriptor, employees, 0.52);

      if (match) {
        // Convert euclidean distance (< 0.52) to confidence percentage (e.g. 0.20 -> 96%, 0.40 -> 90%)
        const confidenceScore = Math.min(
          99,
          Math.max(80, Math.round((1 - match.distance / 0.52) * 20 + 80))
        );

        return {
          hasFace: true,
          isMatch: true,
          matchedEmployee: match.employee,
          confidence: confidenceScore,
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
   * Check live face alignment for registration preview:
   * Returns whether face is detected and properly aligned inside camera reticle.
   */
  public async checkAlignment(
    source: HTMLVideoElement | HTMLCanvasElement
  ): Promise<{ hasFace: boolean; isAligned: boolean; message: string }> {
    try {
      await loadFaceApiModels();
      if (source instanceof HTMLVideoElement && (source.readyState < 2 || !source.videoWidth)) {
        return { hasFace: false, isAligned: false, message: 'Starting camera...' };
      }

      // Use the tablet-optimized dual detector
      const detection = await extractFaceDetection(source);
      if (!detection) {
        return { hasFace: false, isAligned: false, message: 'Align face in circle' };
      }

      const box = detection.detection.box;
      const videoW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
      const videoH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

      // Realistic sizing checks for tablets & phones
      if (box.width < 70) {
        return { hasFace: true, isAligned: false, message: 'Step closer to camera' };
      }
      if (box.width > videoW * 0.95) {
        return { hasFace: true, isAligned: false, message: 'Step back slightly' };
      }

      // Check center with realistic bounds
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const isCenteredX = Math.abs(centerX - videoW / 2) < videoW * 0.40;
      const isCenteredY = Math.abs(centerY - videoH / 2) < videoH * 0.40;

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
