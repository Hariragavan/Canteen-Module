/**
 * ==============================================================================
 * MANTRA MFS100 FINGERPRINT SCANNER SERVICE
 * ==============================================================================
 * Communicates with the official Mantra MFS100 Client Service running locally
 * at http://127.0.0.1:8032/mfs100/... (or https://127.0.0.1:8032)
 *
 * Supported Operations:
 *  - checkDevice(): Query MFS100 device information & connection status
 *  - captureFingerprint(): Triggers red optical sensor to scan finger and extract ISO-19794-2 template
 *  - matchISO(): 1:1 Biometric matching between two ISO templates
 *  - identifyEmployee(): 1:N Biometric matching across all registered employees' fingers
 *  - simulateCapture(): Developer demo mock mode when hardware is not plugged in
 */

import type { FingerprintRecord } from '../types';

export interface MantraDeviceInfo {
  isConnected: boolean;
  make: string;
  model: string;
  serialNo: string;
  width: number;
  height: number;
  error?: string;
  raw?: any;
}

export interface MantraCaptureResult {
  success: boolean;
  errorCode: number;
  errorDescription: string;
  bitmapData: string;    // Base64 image for visual preview
  isoTemplate: string;   // Base64 ISO-19794-2 template for biometric matching
  ansiTemplate?: string;
  quality: number;       // Score 0 - 100
  nfiq?: number;         // 1 (Best) to 5 (Poor)
}

export interface MantraMatchResult {
  isMatch: boolean;
  score: number;
  matchingPercentage: number;
  error?: string;
}

class MantraService {
  // Mantra MFS100 Client Service runs locally on port 8032 (HTTP) or 8033/8034
  private primaryUrl = 'http://127.0.0.1:8032/mfs100';
  private secondaryUrl = 'https://127.0.0.1:8032/mfs100';
  private activeBaseUrl = 'http://127.0.0.1:8032/mfs100';

  private isMockMode = false;
  private cachedDeviceInfo: MantraDeviceInfo | null = null;
  private lastCheckTime = 0;

  constructor() {
    // Check if user previously enabled mock mode in localStorage
    if (typeof window !== 'undefined') {
      this.isMockMode = localStorage.getItem('mantra_mock_mode') === 'true';
    }
  }

  public setMockMode(enabled: boolean): void {
    this.isMockMode = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('mantra_mock_mode', String(enabled));
    }
  }

  public getMockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Helper to perform requests to Mantra local client service with timeout
   */
  private async requestMantra(endpoint: string, method = 'GET', body: any = null, timeoutMs = 12000): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const tryFetch = async (baseUrl: string) => {
      const res = await fetch(`${baseUrl}/${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return await res.json();
    };

    try {
      try {
        const data = await tryFetch(this.activeBaseUrl);
        clearTimeout(timer);
        return data;
      } catch (err) {
        // Fallback between http and https if needed
        const alternateUrl = this.activeBaseUrl === this.primaryUrl ? this.secondaryUrl : this.primaryUrl;
        const data = await tryFetch(alternateUrl);
        this.activeBaseUrl = alternateUrl;
        clearTimeout(timer);
        return data;
      }
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * 1. Check if Mantra MFS100 device is connected and service is running
   */
  public async checkDevice(force = false): Promise<MantraDeviceInfo> {
    if (this.isMockMode) {
      return {
        isConnected: true,
        make: 'Mantra (Demo Simulator)',
        model: 'MFS100',
        serialNo: 'SIM-998877',
        width: 300,
        height: 400,
      };
    }

    const now = Date.now();
    if (!force && this.cachedDeviceInfo && now - this.lastCheckTime < 5000) {
      return this.cachedDeviceInfo;
    }

    try {
      const data = await this.requestMantra('info', 'GET', null, 3000);
      const isSuccess = data?.ErrorCode === 0 || data?.HttpStatusCode === 200 || data?.Method === 'INFO';
      const info: MantraDeviceInfo = {
        isConnected: Boolean(isSuccess && (data?.DeviceInfo || data?.SerialNo || data?.Make)),
        make: data?.DeviceInfo?.Make || data?.Make || 'Mantra',
        model: data?.DeviceInfo?.Model || data?.Model || 'MFS100',
        serialNo: data?.DeviceInfo?.SerialNo || data?.SerialNo || 'Connected',
        width: data?.DeviceInfo?.Width || 300,
        height: data?.DeviceInfo?.Height || 400,
        raw: data,
      };
      this.cachedDeviceInfo = info;
      this.lastCheckTime = now;
      return info;
    } catch {
      const offlineInfo: MantraDeviceInfo = {
        isConnected: false,
        make: 'Mantra',
        model: 'MFS100',
        serialNo: 'Disconnected',
        width: 300,
        height: 400,
        error: 'Mantra MFS100 Client Service not responding on http://127.0.0.1:8032. Ensure driver and service are installed and running.',
      };
      this.cachedDeviceInfo = offlineInfo;
      this.lastCheckTime = now;
      return offlineInfo;
    }
  }

  /**
   * 2. Capture a live fingerprint from the Mantra MFS100 scanner
   * @param quality Minimum acceptable quality (default 60%)
   * @param timeout Capture timeout in seconds (default 10s)
   */
  public async captureFingerprint(quality = 60, timeout = 10): Promise<MantraCaptureResult> {
    if (this.isMockMode) {
      return this.simulateCapture(quality);
    }

    try {
      const payload = {
        Quality: quality,
        TimeOut: timeout,
      };

      const res = await this.requestMantra('capture', 'POST', payload, (timeout + 2) * 1000);

      if (res && res.ErrorCode === 0) {
        // Mantra returns raw base64 or prefixed base64 image
        let bmp = res.BitmapData || '';
        if (bmp && !bmp.startsWith('data:image')) {
          bmp = `data:image/bmp;base64,${bmp}`;
        }

        return {
          success: true,
          errorCode: 0,
          errorDescription: 'Capture successful',
          bitmapData: bmp,
          isoTemplate: res.IsoTemplate || '',
          ansiTemplate: res.AnsiTemplate || '',
          quality: Number(res.Quality || 0),
          nfiq: Number(res.Nfiq || 1),
        };
      } else {
        return {
          success: false,
          errorCode: res?.ErrorCode ?? -1,
          errorDescription: res?.ErrorDescription || 'Fingerprint capture cancelled or timed out.',
          bitmapData: '',
          isoTemplate: '',
          quality: 0,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        errorCode: -999,
        errorDescription:
          err?.name === 'AbortError'
            ? 'Fingerprint capture timed out. Please place finger firmly on sensor.'
            : 'Mantra Client Service is not responding. Please check USB cable and service.',
        bitmapData: '',
        isoTemplate: '',
        quality: 0,
      };
    }
  }

  /**
   * 3. 1:1 Matching between two ISO-19794-2 templates via Mantra local service
   */
  public async matchISO(isoProbe: string, isoCandidate: string): Promise<MantraMatchResult> {
    if (!isoProbe || !isoCandidate) {
      return { isMatch: false, score: 0, matchingPercentage: 0, error: 'Templates are required' };
    }

    if (this.isMockMode) {
      // In mock mode, if templates match or share mock signature
      const isSame = isoProbe === isoCandidate || isoProbe.slice(0, 32) === isoCandidate.slice(0, 32);
      return {
        isMatch: isSame,
        score: isSame ? 15000 : 2000,
        matchingPercentage: isSame ? 90 : 10,
      };
    }

    try {
      const payload = {
        IsoTemplate1: isoProbe,
        IsoTemplate2: isoCandidate,
      };

      const res = await this.requestMantra('matchISO', 'POST', payload, 5000);

      // Mantra MFS100: Score >= 14000 or MatchingPercentage >= 60 is a reliable match
      const score = Number(res?.Score || 0);
      const matchingPercentage = Number(res?.MatchingPercentage || 0);
      const isMatch = res?.ErrorCode === 0 && (score >= 14000 || matchingPercentage >= 60);

      return {
        isMatch,
        score,
        matchingPercentage,
      };
    } catch (err: any) {
      return {
        isMatch: false,
        score: 0,
        matchingPercentage: 0,
        error: err.message,
      };
    }
  }

  /**
   * 4. 1:N Identification: Compare a live scanned finger against all enrolled employees
   */
  public async identifyEmployee(
    probeIso: string,
    enrolledList: FingerprintRecord[]
  ): Promise<{ matchedRecord: FingerprintRecord | null; matchedFinger: string | null; score: number }> {
    if (!probeIso || !Array.isArray(enrolledList) || enrolledList.length === 0) {
      return { matchedRecord: null, matchedFinger: null, score: 0 };
    }

    let highestScore = 0;
    let bestMatch: FingerprintRecord | null = null;
    let matchedFingerName: string | null = null;

    for (const record of enrolledList) {
      if (!record.isActive) continue;

      // Check Finger 1
      if (record.finger1?.isoTemplate) {
        const match1 = await this.matchISO(probeIso, record.finger1.isoTemplate);
        if (match1.isMatch && match1.score > highestScore) {
          highestScore = match1.score;
          bestMatch = record;
          matchedFingerName = record.finger1.fingerName || 'Finger 1';
          // Early exit if match is exceptionally high confidence
          if (match1.score >= 16000) break;
        }
      }

      // Check Finger 2 (Backup)
      if (record.finger2?.isoTemplate) {
        const match2 = await this.matchISO(probeIso, record.finger2.isoTemplate);
        if (match2.isMatch && match2.score > highestScore) {
          highestScore = match2.score;
          bestMatch = record;
          matchedFingerName = record.finger2.fingerName || 'Finger 2';
          if (match2.score >= 16000) break;
        }
      }
    }

    return {
      matchedRecord: bestMatch,
      matchedFinger: matchedFingerName,
      score: highestScore,
    };
  }

  /**
   * Mock capture generator for development & demonstration
   */
  private simulateCapture(targetQuality: number): MantraCaptureResult {
    const mockQuality = Math.floor(Math.random() * 20) + Math.max(70, targetQuality);
    const mockHash = Math.random().toString(36).substring(2, 15);
    const mockIso = btoa(`MFS100_ISO_${mockHash}_${Date.now()}`);

    // Stylized SVG fingerprint preview in base64
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" fill="#0f172a">
        <rect width="100%" height="100%" fill="#0f172a"/>
        <g stroke="#10b981" stroke-width="4" stroke-linecap="round" fill="none">
          <ellipse cx="150" cy="200" rx="40" ry="60" stroke-dasharray="8 6"/>
          <ellipse cx="150" cy="200" rx="65" ry="90"/>
          <ellipse cx="150" cy="200" rx="90" ry="120" stroke-dasharray="14 8"/>
          <path d="M 110,130 C 130,90 170,90 190,130"/>
          <path d="M 90,170 C 110,110 190,110 210,170"/>
          <path d="M 80,240 C 90,320 210,320 220,240"/>
        </g>
        <text x="150" y="360" fill="#10b981" font-size="14" font-family="monospace" text-anchor="middle" font-weight="bold">
          MANTRA SIMULATED (Q: ${mockQuality}%)
        </text>
      </svg>
    `.trim();

    const dataUri = `data:image/svg+xml;base64,${btoa(svg)}`;

    return {
      success: true,
      errorCode: 0,
      errorDescription: 'Simulated Capture Successful',
      bitmapData: dataUri,
      isoTemplate: mockIso,
      quality: mockQuality,
      nfiq: 1,
    };
  }
}

export const mantraService = new MantraService();
