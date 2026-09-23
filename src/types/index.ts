export type MealSlotName = 'Tiffin' | 'Lunch' | 'Tea/Snacks' | 'Breakfast' | 'Tea or Coffee' | 'Snacks' | 'Dinner';

export type UserRole = 'Employee' | 'Staff';

export interface Employee {
  id: string;          // e.g. EMP-1001 or STF-2001
  name: string;
  dept: string;
  photo: string;
  confidence: number;
  subsidyRate: number; // 1.0 = 100% covered
  role: UserRole;
  face_descriptor?: number[] | null; // 128-dimensional biometric embedding vector
  embedding?: number[] | null;       // Alias for face_descriptor
}

export interface MealSlotConfig {
  name: MealSlotName;
  startTime: string;   // '07:30'
  endTime: string;     // '11:00'
  displayName: string;
  tamilDisplayName?: string;
  emoji: string;
  category: 'Morning' | 'Active Now' | 'Afternoon' | 'Evening' | 'Night Slot';
  description: string;
  calories?: number;
  rate?: number;       // Meal cost / rate e.g. 40
  cost?: number;       // Alias for rate
  isEligible: boolean;
  isActive?: boolean;
}

export type OrderStatus = 'PRINTED' | 'SERVED' | 'CANCELLED';

export interface Order {
  id: string;               // UUID or token UUID
  token: number;            // Sequential number e.g. 150
  orderUuid: string;        // ORD-2026-X812
  userId: string;           // EMP-1001
  name: string;
  dept: string;
  meal: MealSlotName;
  items?: any[];            // Selected dishes / vertical menu items
  rate?: number;            // Rate / price e.g. 40
  qty?: number;             // Quantity of servings e.g. 1
  status: OrderStatus;
  issuedAt: string;         // '12:35:10 PM'
  servedAt: string | null;  // '12:38:05 PM'
  timestamp: number;        // Epoch ms
  dateStr: string;          // YYYY-MM-DD
}

export interface VerificationResult {
  type: 'SUCCESS' | 'DUPLICATE_CLAIM' | 'INVALID_TOKEN' | 'IDLE';
  order?: Order;
  message?: string;
  scanTime?: string;
  previousServedTime?: string;
}

export interface PrinterStatus {
  online: boolean;
  model: string;
  paperWidth: string;       // '80mm'
  paperLevelPercent: number;
  headTemperatureC: number;
  cutterStatus: 'OK' | 'WARNING';
}

export interface ScannerStatus {
  connected: boolean;
  model: string;
  mode: 'USB HID Keyboard Wedge';
  lastScanLatencyMs: number;
  lastRawPayload: string;
}
