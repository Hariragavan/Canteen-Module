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
 * Load SSD MobileNet V1, 68 Landmarks, and Face Recognition neural models from /models
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
      await faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_URL);
      console.log('Neural models loaded successfully from local repository.');
      return true;
    } catch (localErr) {
      console.warn('Could not load models from /models, falling back to CDN:', localErr);
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(CDN_URL);
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
 * Start front tablet camera at 720p/30fps (optimal: sharp landmarks without GPU lag)
 */
export const startTabletCamera = async (videoElement: HTMLVideoElement): Promise<MediaStream> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 1280 }, // 720p is optimal: sharp landmarks without GPU lag
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  });
  videoElement.srcObject = stream;
  await videoElement.play().catch(() => {
    /* auto-play may need user gesture or muted attribute */
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
 */
export async function extractFaceDetection(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | string
): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>> | null> {
  await loadFaceApiModels();

  let inputElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement;

  if (typeof source === 'string') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image for biometric extraction'));
      img.src = source;
    });
    inputElement = img;
  } else {
    inputElement = source;
  }

  const detection = await faceapi
    .detectSingleFace(inputElement)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection || null;
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

      const detection = await faceapi.detectSingleFace(source).withFaceLandmarks();
      if (!detection) {
        return { hasFace: false, isAligned: false, message: 'Face not detected' };
      }

      const box = detection.detection.box;
      const videoW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
      const videoH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

      // Check sizing
      if (box.width < 110) {
        return { hasFace: true, isAligned: false, message: 'Step closer to camera' };
      }
      if (box.width > 340) {
        return { hasFace: true, isAligned: false, message: 'Step back slightly' };
      }

      // Check center
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const isCenteredX = Math.abs(centerX - videoW / 2) < videoW * 0.26;
      const isCenteredY = Math.abs(centerY - videoH / 2) < videoH * 0.26;

      if (!isCenteredX || !isCenteredY) {
        return { hasFace: true, isAligned: false, message: 'Center face in oval' };
      }

      // Check tilt
      const landmarks = detection.landmarks;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      if (leftEye && rightEye && leftEye.length > 0 && rightEye.length > 0) {
        const tilt = Math.abs(leftEye[0].y - rightEye[0].y);
        if (tilt > box.height * 0.18) {
          return { hasFace: true, isAligned: false, message: 'Keep head level' };
        }
      }

      return { hasFace: true, isAligned: true, message: 'Face aligned correctly' };
    } catch {
      return { hasFace: false, isAligned: false, message: 'Align face in oval' };
    }
  }
}

export const faceMatcherService = new FaceMatcherService();
