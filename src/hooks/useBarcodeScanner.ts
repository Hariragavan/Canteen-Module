import { useEffect, useRef, useState, useCallback } from 'react';
import { soundEngine } from '../services/soundEngine';

interface UseBarcodeScannerOptions {
  onScan: (scannedText: string) => void;
  maxIntervalMs?: number; // Barcode scanner sends keystrokes typically at <30-45ms
  minLength?: number;     // Minimum character length for valid token barcode
  enabled?: boolean;
}

export interface ScannerDiagnosticInfo {
  lastScannedPayload: string;
  lastScanLatencyMs: number;
  lastScanTimestamp: number | null;
  bufferSize: number;
  isReceivingStream: boolean;
}

export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 55,
  minLength = 3,
  enabled = true,
}: UseBarcodeScannerOptions) {
  const [diagnostic, setDiagnostic] = useState<ScannerDiagnosticInfo>({
    lastScannedPayload: '',
    lastScanLatencyMs: 0,
    lastScanTimestamp: null,
    bufferSize: 0,
    isReceivingStream: false,
  });

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const streamStartRef = useRef<number>(0);
  const isStreamingRef = useRef<boolean>(false);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    isStreamingRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys like Shift, Control, Alt, Meta
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
        return;
      }

      const now = performance.now();
      const diff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // When 'Enter' arrives, evaluate the stream
      if (e.key === 'Enter') {
        const buffered = bufferRef.current.trim();
        if (buffered.length >= minLength) {
          // Valid barcode gun payload
          e.preventDefault();
          const totalDuration = now - streamStartRef.current;
          const avgPerChar = buffered.length > 0 ? Math.round(totalDuration / buffered.length) : 0;

          setDiagnostic({
            lastScannedPayload: buffered,
            lastScanLatencyMs: avgPerChar,
            lastScanTimestamp: Date.now(),
            bufferSize: buffered.length,
            isReceivingStream: false,
          });

          // Play crisp scanner decode chirp
          soundEngine.playScannerBeep();

          // Invoke callback
          onScan(buffered);
        }

        resetBuffer();
        return;
      }

      // If elapsed time since previous key exceeds hardware threshold,
      // it is considered human typing rather than rapid scanner burst.
      if (diff > maxIntervalMs) {
        bufferRef.current = '';
        streamStartRef.current = now;
        isStreamingRef.current = false;
      } else {
        isStreamingRef.current = true;
      }

      // Append standard printable characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, maxIntervalMs, minLength, onScan, resetBuffer]);

  return {
    diagnostic,
    resetBuffer,
  };
}
