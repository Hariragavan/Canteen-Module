import React, { useState, useEffect } from 'react';
import type { Employee } from '../../types';
import { canteenService } from '../../services/canteenService';
import { soundEngine } from '../../services/soundEngine';
import { KitchenAnalyticsView } from '../analytics/KitchenAnalyticsView';
import { FoodTransportView } from '../transport/FoodTransportView';
import { FeedbackReviewView } from '../feedback/FeedbackReviewView';
import {
  X,
  UserPlus,
  Users,
  Trash2,
  Edit2,
  Check,
  Search,
  CheckCircle2,
  BarChart3,
  Scan,
  Lock,
  UtensilsCrossed,
  Clock,
  Languages,
  Sparkles,
  Save,
  Tablet,
  Truck,
  MessageSquareHeart,
  Fingerprint as FingerprintIcon,
  Usb,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  User,
  Hash,
  RotateCcw,
} from 'lucide-react';
import type { MealSlotConfig, MealSlotName } from '../../types';
import { mantraService } from '../../services/mantraService';

interface AdminPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRosterUpdated?: () => void;
  onNavigateToStaffScanner?: () => void;
  onNavigateToKiosk?: () => void;
  onLogout?: () => void;
}

const DEPARTMENTS = ['Staff', 'Employee'];

export interface FingerSampleState {
  sampleIndex: number;
  isoTemplate: string;
  quality: number;
  bitmapData?: string;
  label?: string;
}

export interface EnrolledFingerState {
  fingerName: string;
  isoTemplate: string;
  bitmapData: string;
  quality: number;
  samples: FingerSampleState[];
}

const SAMPLE_LABELS = ['Flat Touch (Center)', 'Angle Touch (Tilt)', 'Firm Press (Tip)'];

interface MultiSampleFingerCardProps {
  cardTitle: string;
  finger: EnrolledFingerState;
  onNameChange: (name: string) => void;
  onScan: () => void;
  onReset: () => void;
  isScanning: boolean;
  themeColor?: 'emerald' | 'blue';
  fingerOptions: string[];
}

const RealisticFingerprintSvg: React.FC<{
  isScanning: boolean;
  isComplete: boolean;
  isEmerald: boolean;
}> = ({ isScanning, isComplete, isEmerald }) => {
  const glowClass = isEmerald ? 'animate-fp-ridges-emerald' : 'animate-fp-ridges-blue';

  return (
    <svg
      viewBox="0 0 100 120"
      className={`w-full h-full max-w-[80px] max-h-[105px] transition-all duration-300 ${
        isComplete
          ? isEmerald
            ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.85)]'
            : 'text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.85)]'
          : isScanning
          ? `${glowClass}`
          : 'text-slate-600 group-hover:text-slate-500'
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Outer Whorl Arcs */}
      <path d="M 16 80 C 14 48, 24 22, 50 18 C 76 22, 86 48, 84 80" />
      <path d="M 22 88 C 20 58, 28 30, 50 26 C 72 30, 80 58, 78 88" />
      <path d="M 28 94 C 26 66, 33 38, 50 34 C 67 38, 74 66, 72 94" />

      {/* Mid Contours & Loops */}
      <path d="M 34 98 C 32 73, 38 46, 50 42 C 62 46, 68 73, 66 98" />
      <path d="M 40 100 C 38 80, 43 54, 50 50 C 57 54, 62 80, 60 100" />

      {/* Core Loop & Minutiae */}
      <path d="M 46 95 C 44 85, 46 62, 50 58 C 54 62, 56 85, 54 95" />
      <path d="M 50 66 L 50 86" strokeWidth="2.2" />

      {/* Delta Ridges / Lower Branching */}
      <path d="M 18 90 C 22 96, 28 104, 34 110" />
      <path d="M 82 90 C 78 96, 72 104, 66 110" />
      <path d="M 26 102 C 30 106, 36 111, 42 114" />
      <path d="M 74 102 C 70 106, 64 111, 58 114" />
    </svg>
  );
};

const MultiSampleFingerCard: React.FC<MultiSampleFingerCardProps> = ({
  cardTitle,
  finger,
  onNameChange,
  onScan,
  onReset,
  isScanning,
  themeColor = 'emerald',
  fingerOptions,
}) => {
  const isEmerald = themeColor === 'emerald';
  const samplesCount = finger.samples?.length || 0;
  const isComplete = samplesCount >= 3;

  const nextStepLabel =
    samplesCount === 0
      ? '1. Flat Touch (Center)'
      : samplesCount === 1
      ? '2. Angle Tilt (Edges)'
      : samplesCount === 2
      ? '3. Firm Press (Tip)'
      : '3/3 Captured (Enrolled)';

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 bg-white flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
        isComplete
          ? 'border-emerald-300 ring-1 ring-emerald-500/20'
          : samplesCount > 0
          ? isEmerald
            ? 'border-emerald-200'
            : 'border-blue-200'
          : 'border-slate-200'
      }`}
    >
      {/* Top Header */}
      <div className="p-3.5 pb-2.5 flex items-center justify-between border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-white shadow-2xs ${
              isEmerald ? 'bg-emerald-600' : 'bg-blue-600'
            }`}
          >
            <FingerprintIcon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-800 tracking-tight flex items-center gap-1">
              <span>{cardTitle}</span>
              <span className="text-rose-500">*</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-medium font-mono">
              {samplesCount}/3 Scans Enrolled
            </span>
          </div>
        </div>

        {/* Status Chip */}
        <div className="flex items-center space-x-1.5">
          {isComplete ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1 shrink-0" />
              <span>Best: {finger.quality}%</span>
            </span>
          ) : samplesCount > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 font-mono">
              <span>{samplesCount}/3 Saved</span>
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
              Not Enrolled
            </span>
          )}

          {samplesCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              title="Reset and re-scan this touch"
              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Card Body */}
      <div className="p-3.5 space-y-3">
        {/* Finger Name Selector Dropdown */}
        <div>
          <select
            value={finger.fingerName}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          >
            {fingerOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Modern Mobile Biometric Sensor Pod & Tracing HUD */}
        <div className="relative h-44 bg-gradient-to-b from-slate-950 via-slate-900 to-black rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden shadow-inner group">
          {/* Subtle Grid Matrix Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none" />

          {/* Corner Biometric Tech Brackets */}
          <div
            className={`absolute top-2.5 left-2.5 w-3.5 h-3.5 border-t-2 border-l-2 rounded-tl-sm pointer-events-none transition-colors ${
              isScanning
                ? isEmerald
                  ? 'border-emerald-400 animate-pulse'
                  : 'border-blue-400 animate-pulse'
                : 'border-slate-700'
            }`}
          />
          <div
            className={`absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t-2 border-r-2 rounded-tr-sm pointer-events-none transition-colors ${
              isScanning
                ? isEmerald
                  ? 'border-emerald-400 animate-pulse'
                  : 'border-blue-400 animate-pulse'
                : 'border-slate-700'
            }`}
          />
          <div
            className={`absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-b-2 border-l-2 rounded-bl-sm pointer-events-none transition-colors ${
              isScanning
                ? isEmerald
                  ? 'border-emerald-400 animate-pulse'
                  : 'border-blue-400 animate-pulse'
                : 'border-slate-700'
            }`}
          />
          <div
            className={`absolute bottom-2.5 right-2.5 w-3.5 h-3.5 border-b-2 border-r-2 rounded-br-sm pointer-events-none transition-colors ${
              isScanning
                ? isEmerald
                  ? 'border-emerald-400 animate-pulse'
                  : 'border-blue-400 animate-pulse'
                : 'border-slate-700'
            }`}
          />

          {/* Center Pod: Realistic Fingerprint + Phone Animations */}
          <div className="relative flex items-center justify-center w-32 h-32">
            {/* Circular 360 Progress Gauge (Enrolled Samples / 3) */}
            <svg className="w-32 h-32 transform -rotate-90 pointer-events-none absolute inset-0">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="3"
                className="text-slate-800/80"
                fill="transparent"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeDasharray={351.86}
                strokeDashoffset={351.86 - (351.86 * samplesCount) / 3}
                strokeLinecap="round"
                className={`transition-all duration-700 ${
                  isEmerald ? 'text-emerald-400' : 'text-blue-400'
                }`}
                fill="transparent"
              />
            </svg>

            {/* Ultrasonic Ripple Waves (Expanding when scanning like phone screen touch) */}
            {isScanning && (
              <>
                <div
                  className={`absolute w-20 h-20 rounded-full border pointer-events-none animate-fp-ripple-1 ${
                    isEmerald ? 'border-emerald-400/70' : 'border-blue-400/70'
                  }`}
                />
                <div
                  className={`absolute w-20 h-20 rounded-full border pointer-events-none animate-fp-ripple-2 ${
                    isEmerald ? 'border-emerald-400/50' : 'border-blue-400/50'
                  }`}
                />
                <div
                  className={`absolute w-20 h-20 rounded-full border pointer-events-none animate-fp-ripple-3 ${
                    isEmerald ? 'border-emerald-400/30' : 'border-blue-400/30'
                  }`}
                />
              </>
            )}

            {/* Central Graphic: Bitmap image if enrolled or Phone-style SVG */}
            {finger.bitmapData && !isScanning ? (
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center shadow-lg">
                <img
                  src={finger.bitmapData}
                  alt={`${cardTitle} scan`}
                  className="w-full h-full object-contain filter invert contrast-125 transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                <RealisticFingerprintSvg
                  isScanning={isScanning}
                  isComplete={isComplete}
                  isEmerald={isEmerald}
                />
                {isComplete && !isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-lg shadow-emerald-500/50 animate-in zoom-in-75">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Phone-Style Sweeping Tracing Laser Beam */}
            {isScanning && (
              <>
                <div
                  className={`absolute inset-x-1 h-0.5 pointer-events-none z-20 animate-fp-trace ${
                    isEmerald
                      ? 'bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_12px_rgba(52,211,153,1)]'
                      : 'bg-gradient-to-r from-transparent via-blue-300 to-transparent shadow-[0_0_12px_rgba(96,165,250,1)]'
                  }`}
                />
                <div
                  className={`absolute inset-x-0 h-4 blur-xs pointer-events-none z-10 animate-fp-trace ${
                    isEmerald
                      ? 'bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent'
                      : 'bg-gradient-to-r from-transparent via-blue-400/25 to-transparent'
                  }`}
                />
              </>
            )}
          </div>

          {/* Top-Right Badge: Live Quality Score */}
          <div className="absolute top-2 right-2.5 z-10">
            {finger.quality > 0 ? (
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shadow-xs ${
                  isEmerald
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
                    : 'bg-blue-950/90 text-blue-300 border-blue-500/40'
                }`}
              >
                Quality: {finger.quality}%
              </span>
            ) : isScanning ? (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-950/90 text-amber-300 border border-amber-500/40 animate-pulse">
                Tracing...
              </span>
            ) : null}
          </div>

          {/* Top-Left Badge: Touch step hint */}
          <div className="absolute top-2 left-2.5 z-10">
            <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-800">
              {samplesCount === 0
                ? 'Angle 1: Flat'
                : samplesCount === 1
                ? 'Angle 2: Tilt'
                : samplesCount === 2
                ? 'Angle 3: Firm'
                : 'Enrolled'}
            </span>
          </div>

          {/* Bottom Banner: Real-time Phone Scanning Guidance */}
          <div className="absolute bottom-1.5 inset-x-2 text-center pointer-events-none z-10">
            <span
              className={`text-[9.5px] font-medium font-mono px-2.5 py-0.5 rounded-md border shadow-2xs ${
                isScanning
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 animate-pulse'
                  : isComplete
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/30'
                  : 'bg-slate-950/85 text-slate-400 border-slate-800'
              }`}
            >
              {isScanning
                ? '⚡ Tracing biometric ridges on scanner...'
                : isComplete
                ? '✓ All 3 touch samples enrolled successfully'
                : samplesCount === 0
                ? 'Place flat center of finger on glass'
                : samplesCount === 1
                ? 'Tilt finger slightly to capture outer ridges'
                : 'Press tip firmly on scanner glass'}
            </span>
          </div>
        </div>

        {/* 3-Tap Progressive Steps (Flat, Tilt, Firm) */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { idx: 1, name: '1. Flat', desc: 'Center' },
            { idx: 2, name: '2. Tilt', desc: 'Edges' },
            { idx: 3, name: '3. Firm', desc: 'Tip' },
          ].map(({ idx, name, desc }) => {
            const sample = (finger.samples || []).find((s) => s.sampleIndex === idx);
            const isDone = Boolean(sample);
            const isCurrent = samplesCount + 1 === idx;

            return (
              <div
                key={idx}
                className={`p-1.5 rounded-xl border text-center transition-all ${
                  isDone
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 shadow-2xs'
                    : isCurrent
                    ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-400/30'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="text-[10px] font-bold">{name}</div>
                <div className="text-[9px] font-mono mt-0.5 font-semibold">
                  {isDone ? (
                    <span className="text-emerald-700">✓ {sample?.quality}%</span>
                  ) : isCurrent ? (
                    <span className="text-amber-700 font-bold animate-pulse">Next Tap</span>
                  ) : (
                    <span className="text-slate-400">{desc}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card Action Button Footer */}
      <div className="p-3.5 pt-0">
        <button
          type="button"
          onClick={onScan}
          disabled={isScanning || isComplete}
          className={`w-full py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isScanning
              ? 'bg-amber-500 text-white animate-pulse'
              : isComplete
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default font-extrabold'
              : isEmerald
              ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-emerald-600/25'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-blue-600/25'
          }`}
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Tracing Ridges on Sensor...</span>
            </>
          ) : isComplete ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>✓ Touch Enrolled (3/3 Complete)</span>
            </>
          ) : (
            <>
              <FingerprintIcon className="w-4 h-4" />
              <span>
                Capture Tap {samplesCount + 1}: {nextStepLabel}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export const AdminPortalModal: React.FC<AdminPortalModalProps> = ({
  isOpen,
  onClose,
  onRosterUpdated,
  onNavigateToStaffScanner,
  onNavigateToKiosk,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'registered' | 'analytics' | 'transport' | 'feedback' | 'menu'>('registered');
  const [isRegisteringNew, setIsRegisteringNew] = useState<boolean>(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'Employee' | 'Staff'>('ALL');

  // Menu and Serving Timings state
  const [adminMealSlots, setAdminMealSlots] = useState<MealSlotConfig[]>([]);
  const [activeAdminSlot, setActiveAdminSlot] = useState<MealSlotName>('Tiffin');
  const [isMenuSavedToast, setIsMenuSavedToast] = useState<boolean>(false);

  // Edit Mode state
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingOriginalId, setEditingOriginalId] = useState<string | null>(null);
  const [editFinger1, setEditFinger1] = useState<EnrolledFingerState>({
    fingerName: 'Primary Touch',
    isoTemplate: '',
    bitmapData: '',
    quality: 0,
    samples: [],
  });
  const [editFinger2, setEditFinger2] = useState<EnrolledFingerState>({
    fingerName: 'Backup Touch',
    isoTemplate: '',
    bitmapData: '',
    quality: 0,
    samples: [],
  });
  const [editIsScanningFp1, setEditIsScanningFp1] = useState<boolean>(false);
  const [editIsScanningFp2, setEditIsScanningFp2] = useState<boolean>(false);
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);

  // New Registration form state (strictly: photo, name, id, dept)
  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    dept: string;
    photo: string;
    face_descriptor: number[] | null;
  }>({
    id: '',
    name: '',
    dept: 'Employee',
    photo: '',
    face_descriptor: null,
  });

  const FINGER_OPTIONS = [
    'Primary Touch',
    'Backup Touch',
    'Right Hand Touch',
    'Left Hand Touch',
  ];

  const [finger1, setFinger1] = useState<EnrolledFingerState>({
    fingerName: 'Primary Touch',
    isoTemplate: '',
    bitmapData: '',
    quality: 0,
    samples: [],
  });

  const [finger2, setFinger2] = useState<EnrolledFingerState>({
    fingerName: 'Backup Touch',
    isoTemplate: '',
    bitmapData: '',
    quality: 0,
    samples: [],
  });

  const [isScanningFp1, setIsScanningFp1] = useState<boolean>(false);
  const [isScanningFp2, setIsScanningFp2] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Top-Right Notification Toast State
  const [notification, setNotification] = useState<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  } | null>(null);

  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    setNotification({ id: Date.now().toString(), type, title, message });
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const [mantraInfo, setMantraInfo] = useState<{ isConnected: boolean; model: string }>({
    isConnected: false,
    model: 'Scanner',
  });

  const checkMantraInAdmin = async () => {
    const info = await mantraService.checkDevice();
    setMantraInfo({ isConnected: info.isConnected, model: info.model });
  };

  useEffect(() => {
    if (isOpen && isRegisteringNew) {
      mantraService.setMockMode(false);
      checkMantraInAdmin();
    }
  }, [isOpen, isRegisteringNew]);

  // Check if a touch matches the primary touch (or its enrolled samples)
  const checkMatchesPrimary = (
    probeIso: string,
    primaryIso: string,
    primarySamples: FingerSampleState[] = []
  ): boolean => {
    if (!probeIso) return false;
    const allPrimary = [primaryIso, ...primarySamples.map((s) => s.isoTemplate)].filter(Boolean);
    for (const t of allPrimary) {
      if (
        probeIso === t ||
        (probeIso.length > 36 && t.length > 36 && probeIso.slice(0, 36) === t.slice(0, 36)) ||
        Math.abs(probeIso.length - t.length) <= 25
      ) {
        return true;
      }
    }
    return false;
  };

  // Check if a touch ID is already registered to any other personnel
  const checkDuplicateFinger = (probeIso: string, currentEmpId?: string) => {
    const existingList = canteenService.getFingerprints();
    const cleanCurrent = (currentEmpId || '').trim().toUpperCase();

    for (const rec of existingList) {
      if (cleanCurrent && String(rec.employeeId).trim().toUpperCase() === cleanCurrent) {
        continue;
      }
      const allCandidateTemplates: string[] = [];
      if (rec.finger1?.isoTemplate) allCandidateTemplates.push(rec.finger1.isoTemplate);
      if (Array.isArray(rec.finger1?.samples)) {
        rec.finger1.samples.forEach((s) => s.isoTemplate && allCandidateTemplates.push(s.isoTemplate));
      }
      if (rec.finger2?.isoTemplate) allCandidateTemplates.push(rec.finger2.isoTemplate);
      if (Array.isArray(rec.finger2?.samples)) {
        rec.finger2.samples.forEach((s) => s.isoTemplate && allCandidateTemplates.push(s.isoTemplate));
      }

      for (const t of allCandidateTemplates) {
        if (!t) continue;
        const isMatch =
          probeIso === t ||
          (probeIso.length > 36 && t.length > 36 && probeIso.slice(0, 36) === t.slice(0, 36)) ||
          Math.abs(probeIso.length - t.length) <= 25;
        if (isMatch) {
          return {
            isDuplicate: true,
            matchedName: rec.employeeName || rec.employeeId,
            matchedId: rec.employeeId,
          };
        }
      }
    }
    return { isDuplicate: false };
  };

  const handleScanFinger1 = async () => {
    setIsScanningFp1(true);
    setErrorMessage(null);
    soundEngine.playScannerBeep();
    try {
      const currentSamples = finger1.samples || [];
      if (currentSamples.length >= 3) {
        showNotification('info', 'Primary Touch', 'All 3 scans are already captured. Click "Reset" if you wish to re-enroll.');
        return;
      }

      const res = await mantraService.captureFingerprint(60, 8);
      if (res.success && res.isoTemplate) {
        // 1. Minimum 60% quality threshold
        if (res.quality < 60) {
          soundEngine.playWarningBuzzer();
          const qMsg = `Touch quality was ${res.quality}%. Minimum 60% quality is required. Please press firmly and scan again.`;
          setErrorMessage(qMsg);
          showNotification('warning', 'Low Quality Scan', qMsg);
          return;
        }

        // 2. Check duplicate with already registered personnel (any other user's touch)
        const dup = checkDuplicateFinger(res.isoTemplate, formData.id);
        if (dup.isDuplicate) {
          soundEngine.playWarningBuzzer();
          const dMsg = `This touch matches registered personnel: ${dup.matchedName} (${dup.matchedId})! Duplicate registration is not allowed.`;
          setErrorMessage(dMsg);
          showNotification('error', 'Duplicate Touch Detected', dMsg);
          return;
        }

        // 3. Check duplicate with Backup Touch (Finger 2)
        const f2AllTemplates = [
          finger2.isoTemplate,
          ...(finger2.samples || []).map((s) => s.isoTemplate),
        ].filter(Boolean);

        for (const f2t of f2AllTemplates) {
          if (
            res.isoTemplate === f2t ||
            (res.isoTemplate.length > 36 && f2t.length > 36 && res.isoTemplate.slice(0, 36) === f2t.slice(0, 36)) ||
            Math.abs(res.isoTemplate.length - f2t.length) <= 25
          ) {
            soundEngine.playWarningBuzzer();
            const cMsg = 'Primary Touch cannot match Backup Touch. Please scan two different fingers.';
            setErrorMessage(cMsg);
            showNotification('warning', 'Finger Conflict', cMsg);
            return;
          }
        }

        // Add progressive sample (no restriction on same-finger variance)
        const nextIndex = currentSamples.length + 1;
        const newSample = {
          sampleIndex: nextIndex,
          isoTemplate: res.isoTemplate,
          quality: res.quality,
          bitmapData: res.bitmapData,
          label: SAMPLE_LABELS[currentSamples.length] || `Scan ${nextIndex}`,
        };

        const updatedSamples = [...currentSamples, newSample];
        const bestSample = [...updatedSamples].sort((a, b) => b.quality - a.quality)[0];

        soundEngine.playVerificationChime();
        setFinger1({
          fingerName: finger1.fingerName,
          isoTemplate: bestSample.isoTemplate,
          bitmapData: bestSample.bitmapData || '',
          quality: bestSample.quality,
          samples: updatedSamples,
        });

        if (updatedSamples.length >= 3) {
          const sMsg = `✓ Primary Touch: All 3 scans captured (Best Quality: ${bestSample.quality}%)!`;
          setSuccessMessage(sMsg);
          showNotification('success', 'Primary Touch Enrolled', sMsg);
        } else {
          showNotification('info', `Primary Touch (Scan ${nextIndex}/3)`, `Scan ${nextIndex} captured with ${res.quality}% quality. Proceed with next tap.`);
        }
      } else {
        soundEngine.playWarningBuzzer();
        const eMsg = res.errorDescription || 'Scan timed out or failed. Please try again.';
        setErrorMessage(eMsg);
        showNotification('error', 'Sensor Alert', eMsg);
      }
    } catch (e: any) {
      soundEngine.playWarningBuzzer();
      const errM = e.message || 'Sensor communication error.';
      setErrorMessage(errM);
      showNotification('error', 'Sensor Error', errM);
    } finally {
      setIsScanningFp1(false);
    }
  };

  const handleResetFinger1 = () => {
    setFinger1({
      fingerName: finger1.fingerName,
      isoTemplate: '',
      bitmapData: '',
      quality: 0,
      samples: [],
    });
  };

  const handleScanFinger2 = async () => {
    setIsScanningFp2(true);
    setErrorMessage(null);
    soundEngine.playScannerBeep();
    try {
      const currentSamples = finger2.samples || [];
      if (currentSamples.length >= 3) {
        showNotification('info', 'Backup Touch', 'All 3 scans are already captured. Click "Reset" if you wish to re-enroll.');
        return;
      }

      const res = await mantraService.captureFingerprint(60, 8);
      if (res.success && res.isoTemplate) {
        // 1. Minimum 60% quality threshold
        if (res.quality < 60) {
          soundEngine.playWarningBuzzer();
          const qMsg = `Touch quality was ${res.quality}%. Minimum 60% quality is required. Please press firmly and scan again.`;
          setErrorMessage(qMsg);
          showNotification('warning', 'Low Quality Scan', qMsg);
          return;
        }

        // 2. Check collision with Primary Touch (Finger 1)
        if (checkMatchesPrimary(res.isoTemplate, finger1.isoTemplate, finger1.samples)) {
          soundEngine.playWarningBuzzer();
          const cMsg = 'Backup Touch cannot match Primary Touch. Please scan a different finger.';
          setErrorMessage(cMsg);
          showNotification('warning', 'Primary Touch Match', cMsg);
          return;
        }

        // 3. Check duplicate with already registered personnel (any other user's touch)
        const dup = checkDuplicateFinger(res.isoTemplate, formData.id);
        if (dup.isDuplicate) {
          soundEngine.playWarningBuzzer();
          const dMsg = `This touch matches registered personnel: ${dup.matchedName} (${dup.matchedId})! Duplicate registration is not allowed.`;
          setErrorMessage(dMsg);
          showNotification('error', 'Duplicate Touch Detected', dMsg);
          return;
        }

        // Add progressive sample (no restriction on same-finger variance)
        const nextIndex = currentSamples.length + 1;
        const newSample = {
          sampleIndex: nextIndex,
          isoTemplate: res.isoTemplate,
          quality: res.quality,
          bitmapData: res.bitmapData,
          label: SAMPLE_LABELS[currentSamples.length] || `Scan ${nextIndex}`,
        };

        const updatedSamples = [...currentSamples, newSample];
        const bestSample = [...updatedSamples].sort((a, b) => b.quality - a.quality)[0];

        soundEngine.playVerificationChime();
        setFinger2({
          fingerName: finger2.fingerName,
          isoTemplate: bestSample.isoTemplate,
          bitmapData: bestSample.bitmapData || '',
          quality: bestSample.quality,
          samples: updatedSamples,
        });

        if (updatedSamples.length >= 3) {
          const sMsg = `✓ Backup Touch: All 3 scans captured (Best Quality: ${bestSample.quality}%)!`;
          setSuccessMessage(sMsg);
          showNotification('success', 'Backup Touch Enrolled', sMsg);
        } else {
          showNotification('info', `Backup Touch (Scan ${nextIndex}/3)`, `Scan ${nextIndex} captured with ${res.quality}% quality. Proceed with next tap.`);
        }
      } else {
        soundEngine.playWarningBuzzer();
        const eMsg = res.errorDescription || 'Scan timed out or failed. Please try again.';
        setErrorMessage(eMsg);
        showNotification('error', 'Sensor Alert', eMsg);
      }
    } catch (e: any) {
      soundEngine.playWarningBuzzer();
      const errM = e.message || 'Sensor communication error.';
      setErrorMessage(errM);
      showNotification('error', 'Sensor Error', errM);
    } finally {
      setIsScanningFp2(false);
    }
  };

  const handleResetFinger2 = () => {
    setFinger2({
      fingerName: finger2.fingerName,
      isoTemplate: '',
      bitmapData: '',
      quality: 0,
      samples: [],
    });
  };

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEmployees = async () => {
    try {
      await canteenService.syncFromDatabase();
    } catch (e) {
      console.warn('Sync error in loadEmployees:', e);
    }
    setEmployees(canteenService.getEmployees());
  };

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
      setAdminMealSlots(canteenService.getMealSlots());
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Global Escape key listener to cleanly close active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRegisteringNew) {
          setIsRegisteringNew(false);
          setErrorMessage(null);
          setSuccessMessage(null);
        } else if (editingEmployee) {
          handleCancelEdit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRegisteringNew, editingEmployee]);

  const stopCamera = () => {
    // Pure fingerprint registration: no camera needed
  };

  // Switch department and auto-generate clean prefix if ID is blank
  const handleDeptChange = (dept: string) => {
    setFormData((prev) => {
      let newId = prev.id;
      if (!newId || newId.startsWith('EMP-') || newId.startsWith('STF-')) {
        const nextNum = 1000 + employees.length + 1;
        newId = dept.toLowerCase().includes('staff') ? `STF-${nextNum}` : `EMP-${nextNum}`;
      }
      return { ...prev, dept, id: newId };
    });
  };

  // Submit New Registration (Fingerprint or Backup Face)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = formData.name.trim();
    const cleanId = formData.id.trim().toUpperCase();

    if (!cleanName) {
      const msg = 'Please enter Full Name.';
      setErrorMessage(msg);
      showNotification('warning', 'Missing Information', msg);
      return;
    }
    if (!cleanId) {
      const msg = 'Please enter an Employee/Staff ID.';
      setErrorMessage(msg);
      showNotification('warning', 'Missing Information', msg);
      return;
    }

    // Safety Check 1: Prevent duplicate ID
    const existingIdMatch = employees.find(
      (emp) => emp.id.toUpperCase() === cleanId
    );
    if (existingIdMatch) {
      soundEngine.playWarningBuzzer();
      const msg = `ID Conflict: Personnel ID "${cleanId}" is already registered to ${existingIdMatch.name}.`;
      setErrorMessage(msg);
      showNotification('error', 'ID Conflict', msg);
      return;
    }

    const role: 'Staff' | 'Employee' = formData.dept.toLowerCase().includes('staff') ? 'Staff' : 'Employee';

    // TWO-TOUCH ENROLLMENT (3 Samples per touch required)
    if (!finger1.isoTemplate || (finger1.samples && finger1.samples.length < 3)) {
      soundEngine.playWarningBuzzer();
      const msg = `Please complete all 3 scans for Primary Touch (${finger1.samples?.length || 0}/3 completed).`;
      setErrorMessage(msg);
      showNotification('warning', 'Incomplete Primary Touch', msg);
      return;
    }
    if (!finger2.isoTemplate || (finger2.samples && finger2.samples.length < 3)) {
      soundEngine.playWarningBuzzer();
      const msg = `Please complete all 3 scans for Backup Touch (${finger2.samples?.length || 0}/3 completed).`;
      setErrorMessage(msg);
      showNotification('warning', 'Incomplete Backup Touch', msg);
      return;
    }

    // Check if Backup Touch matches Primary Touch
    if (checkMatchesPrimary(finger2.isoTemplate, finger1.isoTemplate, finger1.samples)) {
      soundEngine.playWarningBuzzer();
      const msg = 'Backup Touch cannot match Primary Touch. Please scan a different finger.';
      setErrorMessage(msg);
      showNotification('warning', 'Primary Touch Conflict', msg);
      return;
    }

    // Check duplicate with all already registered personnel (any other user's touch)
    const dup1 = checkDuplicateFinger(finger1.isoTemplate, cleanId);
    if (dup1.isDuplicate) {
      soundEngine.playWarningBuzzer();
      const msg = `Primary Touch matches registered personnel: ${dup1.matchedName} (${dup1.matchedId})! Duplicate registration is not allowed.`;
      setErrorMessage(msg);
      showNotification('error', 'Duplicate Touch Detected', msg);
      return;
    }

    const dup2 = checkDuplicateFinger(finger2.isoTemplate, cleanId);
    if (dup2.isDuplicate) {
      soundEngine.playWarningBuzzer();
      const msg = `Backup Touch matches registered personnel: ${dup2.matchedName} (${dup2.matchedId})! Duplicate registration is not allowed.`;
      setErrorMessage(msg);
      showNotification('error', 'Duplicate Touch Detected', msg);
      return;
    }

    setIsSubmitting(true);
    showNotification('info', 'Registering Personnel', `Enrolling biometrics for ${cleanName} (${cleanId})...`);

    try {
      const newEmployee: Employee = {
        id: cleanId,
        name: cleanName,
        dept: formData.dept,
        photo: finger1.bitmapData || '',
        confidence: 0.99,
        subsidyRate: 1.0,
        role,
        hasFingerprint: true,
      };

      // 1. Save to Employee store
      await canteenService.addEmployee(newEmployee);

      // 2. Save Two-Touch data to dedicated store (with multi-samples)
      await canteenService.saveFingerprint({
        employeeId: cleanId,
        employeeName: cleanName,
        dept: formData.dept,
        finger1: {
          fingerName: finger1.fingerName,
          isoTemplate: finger1.isoTemplate,
          bitmapData: finger1.bitmapData,
          quality: finger1.quality,
          samples: finger1.samples || [],
        },
        finger2: {
          fingerName: finger2.fingerName,
          isoTemplate: finger2.isoTemplate,
          bitmapData: finger2.bitmapData,
          quality: finger2.quality,
          samples: finger2.samples || [],
        },
      });

      soundEngine.playVerificationChime();
      const sMsg = `✓ Successfully registered ${cleanName} (${cleanId}) with 3-sample multi-touch enrollment! Ready for next personnel.`;
      setSuccessMessage(sMsg);
      showNotification('success', 'Registration Completed', sMsg);
      loadEmployees();
      if (onRosterUpdated) onRosterUpdated();

      // Reset form & fingerprints for next continuous registration
      const nextId = formData.dept.toLowerCase().includes('staff')
        ? `STF-${1000 + employees.length + 2}`
        : `EMP-${1000 + employees.length + 2}`;

      setFormData({
        id: nextId,
        name: '',
        dept: formData.dept,
        photo: '',
        face_descriptor: null,
      });

      setFinger1({
        fingerName: 'Primary Touch',
        isoTemplate: '',
        bitmapData: '',
        quality: 0,
        samples: [],
      });

      setFinger2({
        fingerName: 'Backup Touch',
        isoTemplate: '',
        bitmapData: '',
        quality: 0,
        samples: [],
      });
    } catch (err: unknown) {
      soundEngine.playWarningBuzzer();
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setErrorMessage(`Registration Error: ${msg}`);
      showNotification('error', 'Registration Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Employee
  const handleDeleteEmployee = async (id: string, name: string) => {
    let confirmed = true;
    try {
      confirmed = window.confirm(`Are you sure you want to permanently delete user ${name} (${id})?`);
    } catch {
      confirmed = true;
    }

    if (confirmed) {
      try {
        // Immediate UI removal for instant feedback
        setEmployees((prev) =>
          prev.filter(
            (e) =>
              e.id !== id &&
              String(e.id).trim().toLowerCase() !== String(id).trim().toLowerCase()
          )
        );
        await canteenService.deleteEmployee(id);
        soundEngine.playWarningBuzzer();
        setSuccessMessage(`User ${name} (${id}) and all registered details permanently deleted.`);
        setTimeout(() => setSuccessMessage(null), 3000);
        await loadEmployees();
        if (onRosterUpdated) onRosterUpdated();
      } catch (err) {
        console.error('Delete employee error:', err);
        setErrorMessage(
          'Failed to delete employee: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }
  };

  const handleStartEdit = (emp: Employee) => {
    setIsRegisteringNew(false);
    setEditingOriginalId(emp.id);
    setEditingEmployee({ ...emp });
    setEditErrorMessage(null);

    const existingFp = canteenService.getFingerprints().find(
      (f) => String(f.employeeId).trim().toUpperCase() === String(emp.id).trim().toUpperCase()
    ) || emp.fingerprints;

    if (existingFp) {
      const f1Samples: FingerSampleState[] = Array.isArray(existingFp.finger1?.samples) && existingFp.finger1.samples.length > 0
        ? existingFp.finger1.samples.map((s) => ({
            sampleIndex: s.sampleIndex,
            isoTemplate: s.isoTemplate,
            quality: s.quality,
            bitmapData: s.bitmapData || '',
            label: s.label || '',
          }))
        : existingFp.finger1?.isoTemplate
        ? [{
            sampleIndex: 1,
            isoTemplate: existingFp.finger1.isoTemplate,
            quality: existingFp.finger1.quality || 80,
            bitmapData: existingFp.finger1.bitmapData || '',
            label: 'Flat Touch',
          }]
        : [];

      const f2Samples: FingerSampleState[] = Array.isArray(existingFp.finger2?.samples) && existingFp.finger2.samples.length > 0
        ? existingFp.finger2.samples.map((s) => ({
            sampleIndex: s.sampleIndex,
            isoTemplate: s.isoTemplate,
            quality: s.quality,
            bitmapData: s.bitmapData || '',
            label: s.label || '',
          }))
        : existingFp.finger2?.isoTemplate
        ? [{
            sampleIndex: 1,
            isoTemplate: existingFp.finger2.isoTemplate,
            quality: existingFp.finger2.quality || 80,
            bitmapData: existingFp.finger2.bitmapData || '',
            label: 'Flat Touch',
          }]
        : [];

      setEditFinger1({
        fingerName: existingFp.finger1?.fingerName || 'Primary Touch',
        isoTemplate: existingFp.finger1?.isoTemplate || '',
        bitmapData: existingFp.finger1?.bitmapData || '',
        quality: existingFp.finger1?.quality || 0,
        samples: f1Samples,
      });
      setEditFinger2({
        fingerName: existingFp.finger2?.fingerName || 'Backup Touch',
        isoTemplate: existingFp.finger2?.isoTemplate || '',
        bitmapData: existingFp.finger2?.bitmapData || '',
        quality: existingFp.finger2?.quality || 0,
        samples: f2Samples,
      });
    } else {
      setEditFinger1({
        fingerName: 'Primary Touch',
        isoTemplate: '',
        bitmapData: '',
        quality: 0,
        samples: [],
      });
      setEditFinger2({
        fingerName: 'Backup Touch',
        isoTemplate: '',
        bitmapData: '',
        quality: 0,
        samples: [],
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    setEditingOriginalId(null);
    setEditErrorMessage(null);
    setEditFinger1({
      fingerName: 'Primary Touch',
      isoTemplate: '',
      bitmapData: '',
      quality: 0,
      samples: [],
    });
    setEditFinger2({
      fingerName: 'Backup Touch',
      isoTemplate: '',
      bitmapData: '',
      quality: 0,
      samples: [],
    });
  };

  const handleEditScanFinger1 = async () => {
    setEditIsScanningFp1(true);
    setEditErrorMessage(null);
    soundEngine.playScannerBeep();
    try {
      const currentSamples = editFinger1.samples || [];
      if (currentSamples.length >= 3) {
        showNotification('info', 'Primary Touch', 'All 3 scans are already captured. Click "Reset" if you wish to re-enroll.');
        return;
      }

      const res = await mantraService.captureFingerprint(60, 8);
      if (res.success && res.isoTemplate) {
        // 1. Minimum 60% quality
        if (res.quality < 60) {
          soundEngine.playWarningBuzzer();
          const qMsg = `Touch quality was ${res.quality}%. Minimum 60% quality is required. Please press firmly and scan again.`;
          setEditErrorMessage(qMsg);
          showNotification('warning', 'Low Quality Scan', qMsg);
          return;
        }

        // 2. Check duplicate with other registered personnel
        const dup = checkDuplicateFinger(res.isoTemplate, editingOriginalId || undefined);
        if (dup.isDuplicate) {
          soundEngine.playWarningBuzzer();
          const dMsg = `This touch matches registered personnel: ${dup.matchedName} (${dup.matchedId})! Duplicate registration is not allowed.`;
          setEditErrorMessage(dMsg);
          showNotification('error', 'Duplicate Touch Detected', dMsg);
          return;
        }

        // 3. Check collision with editFinger2
        const f2AllTemplates = [
          editFinger2.isoTemplate,
          ...(editFinger2.samples || []).map((s) => s.isoTemplate),
        ].filter(Boolean);

        for (const f2t of f2AllTemplates) {
          if (
            res.isoTemplate === f2t ||
            (res.isoTemplate.length > 36 && f2t.length > 36 && res.isoTemplate.slice(0, 36) === f2t.slice(0, 36)) ||
            Math.abs(res.isoTemplate.length - f2t.length) <= 25
          ) {
            soundEngine.playWarningBuzzer();
            const cMsg = 'Primary Touch cannot match Backup Touch. Please scan two different touches.';
            setEditErrorMessage(cMsg);
            showNotification('warning', 'Finger Conflict', cMsg);
            return;
          }
        }

        const nextIndex = currentSamples.length + 1;
        const newSample = {
          sampleIndex: nextIndex,
          isoTemplate: res.isoTemplate,
          quality: res.quality,
          bitmapData: res.bitmapData,
          label: SAMPLE_LABELS[currentSamples.length] || `Scan ${nextIndex}`,
        };

        const updatedSamples = [...currentSamples, newSample];
        const bestSample = [...updatedSamples].sort((a, b) => b.quality - a.quality)[0];

        soundEngine.playVerificationChime();
        setEditFinger1({
          fingerName: editFinger1.fingerName,
          isoTemplate: bestSample.isoTemplate,
          bitmapData: bestSample.bitmapData || '',
          quality: bestSample.quality,
          samples: updatedSamples,
        });

        if (updatedSamples.length >= 3) {
          showNotification('success', 'Primary Touch Enrolled', `✓ Primary Touch: All 3 scans captured (Best Quality: ${bestSample.quality}%)!`);
        } else {
          showNotification('info', `Primary Touch (Scan ${nextIndex}/3)`, `Scan ${nextIndex} captured with ${res.quality}% quality.`);
        }
      } else {
        soundEngine.playWarningBuzzer();
        const eMsg = res.errorDescription || 'Scan timed out or failed. Please try again.';
        setEditErrorMessage(eMsg);
        showNotification('error', 'Sensor Alert', eMsg);
      }
    } catch (e: any) {
      soundEngine.playWarningBuzzer();
      const errM = e.message || 'Sensor communication error.';
      setEditErrorMessage(errM);
      showNotification('error', 'Sensor Error', errM);
    } finally {
      setEditIsScanningFp1(false);
    }
  };

  const handleEditResetFinger1 = () => {
    setEditFinger1({
      fingerName: editFinger1.fingerName,
      isoTemplate: '',
      bitmapData: '',
      quality: 0,
      samples: [],
    });
  };

  const handleEditScanFinger2 = async () => {
    setEditIsScanningFp2(true);
    setEditErrorMessage(null);
    soundEngine.playScannerBeep();
    try {
      const currentSamples = editFinger2.samples || [];
      if (currentSamples.length >= 3) {
        showNotification('info', 'Backup Touch', 'All 3 scans are already captured. Click "Reset" if you wish to re-enroll.');
        return;
      }

      const res = await mantraService.captureFingerprint(60, 8);
      if (res.success && res.isoTemplate) {
        // 1. Minimum 60% quality
        if (res.quality < 60) {
          soundEngine.playWarningBuzzer();
          const qMsg = `Touch quality was ${res.quality}%. Minimum 60% quality is required. Please press firmly and scan again.`;
          setEditErrorMessage(qMsg);
          showNotification('warning', 'Low Quality Scan', qMsg);
          return;
        }

        // 2. Check collision with editFinger1 (Primary Touch)
        if (checkMatchesPrimary(res.isoTemplate, editFinger1.isoTemplate, editFinger1.samples)) {
          soundEngine.playWarningBuzzer();
          const cMsg = 'Backup Touch cannot match Primary Touch. Please scan a different touch.';
          setEditErrorMessage(cMsg);
          showNotification('warning', 'Primary Touch Conflict', cMsg);
          return;
        }

        // 3. Check duplicate with other registered personnel
        const dup = checkDuplicateFinger(res.isoTemplate, editingOriginalId || undefined);
        if (dup.isDuplicate) {
          soundEngine.playWarningBuzzer();
          const dMsg = `This touch matches registered personnel: ${dup.matchedName} (${dup.matchedId})! Duplicate registration is not allowed.`;
          setEditErrorMessage(dMsg);
          showNotification('error', 'Duplicate Touch Detected', dMsg);
          return;
        }

        const nextIndex = currentSamples.length + 1;
        const newSample = {
          sampleIndex: nextIndex,
          isoTemplate: res.isoTemplate,
          quality: res.quality,
          bitmapData: res.bitmapData,
          label: SAMPLE_LABELS[currentSamples.length] || `Scan ${nextIndex}`,
        };

        const updatedSamples = [...currentSamples, newSample];
        const bestSample = [...updatedSamples].sort((a, b) => b.quality - a.quality)[0];

        soundEngine.playVerificationChime();
        setEditFinger2({
          fingerName: editFinger2.fingerName,
          isoTemplate: bestSample.isoTemplate,
          bitmapData: bestSample.bitmapData || '',
          quality: bestSample.quality,
          samples: updatedSamples,
        });

        if (updatedSamples.length >= 3) {
          showNotification('success', 'Backup Touch Enrolled', `✓ Backup Touch: All 3 scans captured (Best Quality: ${bestSample.quality}%)!`);
        } else {
          showNotification('info', `Backup Touch (Scan ${nextIndex}/3)`, `Scan ${nextIndex} captured with ${res.quality}% quality.`);
        }
      } else {
        soundEngine.playWarningBuzzer();
        const eMsg = res.errorDescription || 'Scan timed out or failed. Please try again.';
        setEditErrorMessage(eMsg);
        showNotification('error', 'Sensor Alert', eMsg);
      }
    } catch (e: any) {
      soundEngine.playWarningBuzzer();
      const errM = e.message || 'Sensor communication error.';
      setEditErrorMessage(errM);
      showNotification('error', 'Sensor Error', errM);
    } finally {
      setEditIsScanningFp2(false);
    }
  };

  const handleEditResetFinger2 = () => {
    setEditFinger2({
      fingerName: editFinger2.fingerName,
      isoTemplate: '',
      bitmapData: '',
      quality: 0,
      samples: [],
    });
  };

  // Save Edit Employee
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !editingOriginalId) return;

    try {
      const cleanId = editingEmployee.id.trim().toUpperCase();
      const cleanName = editingEmployee.name.trim();
      const role: 'Staff' | 'Employee' = editingEmployee.dept.toLowerCase().includes('staff') ? 'Staff' : 'Employee';

      if (!cleanId) {
        setEditErrorMessage('Personnel ID cannot be empty.');
        return;
      }
      if (!cleanName) {
        setEditErrorMessage('Personnel Name cannot be empty.');
        return;
      }

      // Check ID conflict if changed
      if (cleanId !== editingOriginalId.toUpperCase()) {
        const idExists = employees.some(
          (emp) => emp.id.toUpperCase() === cleanId && emp.id.toUpperCase() !== editingOriginalId.toUpperCase()
        );
        if (idExists) {
          soundEngine.playWarningBuzzer();
          setEditErrorMessage(`Personnel ID "${cleanId}" is already taken by another employee.`);
          return;
        }
      }

      // Check collision between finger1 and finger2
      if (editFinger1.isoTemplate && editFinger2.isoTemplate) {
        if (
          editFinger1.isoTemplate === editFinger2.isoTemplate ||
          Math.abs(editFinger1.isoTemplate.length - editFinger2.isoTemplate.length) <= 25
        ) {
          soundEngine.playWarningBuzzer();
          setEditErrorMessage('Primary and Backup Touch cannot be the same. Please scan two different touches.');
          return;
        }
      }

      // Check duplicate touch across other employees
      if (editFinger1.isoTemplate) {
        const dup1 = checkDuplicateFinger(editFinger1.isoTemplate, editingOriginalId);
        if (dup1.isDuplicate) {
          soundEngine.playWarningBuzzer();
          setEditErrorMessage(`Primary Touch is already registered to ${dup1.matchedName} (${dup1.matchedId})!`);
          return;
        }
      }
      if (editFinger2.isoTemplate) {
        const dup2 = checkDuplicateFinger(editFinger2.isoTemplate, editingOriginalId);
        if (dup2.isDuplicate) {
          soundEngine.playWarningBuzzer();
          setEditErrorMessage(`Backup Touch is already registered to ${dup2.matchedName} (${dup2.matchedId})!`);
          return;
        }
      }

      const hasFp = Boolean(editFinger1.isoTemplate || editFinger2.isoTemplate);

      await canteenService.updateEmployee(editingOriginalId, {
        id: cleanId,
        name: cleanName,
        dept: editingEmployee.dept,
        role,
        photo: editFinger1.bitmapData || editingEmployee.photo || '',
        hasFingerprint: hasFp,
      });

      if (hasFp) {
        // If ID changed, delete old fingerprint record
        if (cleanId !== editingOriginalId.toUpperCase()) {
          try {
            await canteenService.deleteFingerprint(editingOriginalId);
          } catch (e) {
            console.warn('Old fingerprint cleanup warning:', e);
          }
        }

        await canteenService.saveFingerprint({
          employeeId: cleanId,
          employeeName: cleanName,
          dept: editingEmployee.dept,
          finger1: {
            fingerName: editFinger1.fingerName,
            isoTemplate: editFinger1.isoTemplate,
            bitmapData: editFinger1.bitmapData,
            quality: editFinger1.quality,
            samples: editFinger1.samples || [],
          },
          finger2: {
            fingerName: editFinger2.fingerName,
            isoTemplate: editFinger2.isoTemplate,
            bitmapData: editFinger2.bitmapData,
            quality: editFinger2.quality,
            samples: editFinger2.samples || [],
          },
        });
      }

      soundEngine.playVerificationChime();
      showNotification('success', 'User Updated', `✓ Successfully updated ${cleanName} (${cleanId})`);
      handleCancelEdit();
      loadEmployees();
      if (onRosterUpdated) onRosterUpdated();
    } catch (err: unknown) {
      console.error('Update employee error:', err);
      soundEngine.playWarningBuzzer();
      const errM = err instanceof Error ? err.message : 'Update failed';
      setEditErrorMessage(errM);
      showNotification('error', 'Update Failed', errM);
    }
  };

  // Filtered list
  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      emp.name.toLowerCase().includes(q) ||
      emp.id.toLowerCase().includes(q) ||
      emp.dept.toLowerCase().includes(q);
    const matchRole = roleFilter === 'ALL' || emp.role === roleFilter;
    return matchQuery && matchRole;
  });

  if (!isOpen) return null;

  const handleReturnToKiosk = () => {
    stopCamera();
    if (onNavigateToKiosk) {
      onNavigateToKiosk();
    } else {
      onClose();
    }
  };

  const handleLockLogout = () => {
    stopCamera();
    if (onLogout) {
      onLogout();
    } else {
      onClose();
    }
  };

  const handleGoToCounter = () => {
    stopCamera();
    if (onNavigateToStaffScanner) {
      onNavigateToStaffScanner();
    }
  };

  return (
    <div className="w-full h-screen min-h-screen flex flex-row overflow-hidden bg-slate-50 select-none">
      
      {/* ============================================================= */}
      {/* LEFT SIDEBAR NAVIGATION                                       */}
      {/* ============================================================= */}
      <aside className="w-64 sm:w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between h-full overflow-y-auto z-20 shadow-xs">
        <div className="flex flex-col">
          
          {/* 1. Brand & Portal Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-white">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-base shadow-sm shadow-emerald-600/30 shrink-0">
                EE
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-slate-900 text-sm tracking-tight truncate leading-tight">
                  Esstee Exports
                </h2>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-emerald-800">
                    Admin Portal
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Top Quick Actions: Tablet Kiosk, Lock & Logout, Counter View */}
          <div className="p-3 border-b border-slate-100 space-y-1.5 bg-white">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">
              Quick Actions
            </div>

            {/* Tablet Kiosk Button (Return to first page) */}
            <button
              type="button"
              onClick={handleReturnToKiosk}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-xs font-bold transition-all shadow-2xs active:scale-95 group cursor-pointer"
              title="Return to Tablet Kiosk (First Page)"
            >
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-100/80 text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                  <Tablet className="w-4 h-4" />
                </div>
                <span>Tablet Kiosk</span>
              </div>
              <span className="text-[10px] font-medium text-slate-400 group-hover:text-emerald-700">
                First Page
              </span>
            </button>

            {/* Lock & Logout Button */}
            {onLogout && (
              <button
                type="button"
                onClick={handleLockLogout}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 text-xs font-bold transition-all shadow-2xs active:scale-95 group cursor-pointer"
                title="Lock Admin Portal & Logout"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-rose-100/80 text-rose-700 group-hover:bg-rose-200 transition-colors">
                    <Lock className="w-4 h-4" />
                  </div>
                  <span>Lock & Logout</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-rose-600">
                  Exit
                </span>
              </button>
            )}

            {/* Counter View Button (When clicked, open that page) */}
            {onNavigateToStaffScanner && (
              <button
                type="button"
                onClick={handleGoToCounter}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 text-xs font-bold transition-all shadow-2xs active:scale-95 group cursor-pointer"
                title="Open Staff Counter Scanner Station"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-100/80 text-indigo-700 group-hover:bg-indigo-200 transition-colors">
                    <Scan className="w-4 h-4" />
                  </div>
                  <span>Counter View</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-indigo-600">
                  Open →
                </span>
              </button>
            )}
          </div>

          {/* 3. Left Sidebar Navigation Tabs */}
          <div className="p-3 space-y-1 bg-white">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-0.5">
              Admin Sections
            </div>

            {/* Registered Users Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('registered');
                setIsRegisteringNew(false);
                stopCamera();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'registered'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Users className={`w-4 h-4 ${activeTab === 'registered' ? 'text-white' : 'text-slate-500'}`} />
                <span>Registered Users</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'registered'
                  ? 'bg-emerald-700 text-emerald-100'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {employees.length}
              </span>
            </button>

            {/* Kitchen Analysis Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('analytics');
                setIsRegisteringNew(false);
                stopCamera();
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-white' : 'text-slate-500'}`} />
              <span>Kitchen Analysis</span>
            </button>

            {/* Food Transport Tab (Positioned right after Kitchen Analysis) */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('transport');
                setIsRegisteringNew(false);
                stopCamera();
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'transport'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Truck className={`w-4 h-4 ${activeTab === 'transport' ? 'text-white' : 'text-slate-500'}`} />
              <span>Food Transport</span>
            </button>

            {/* Feedback Review Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('feedback');
                setIsRegisteringNew(false);
                stopCamera();
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'feedback'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MessageSquareHeart className={`w-4 h-4 ${activeTab === 'feedback' ? 'text-white' : 'text-slate-500'}`} />
              <span>Feedback Review</span>
            </button>

            {/* Menu & Timings Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('menu');
                setIsRegisteringNew(false);
                stopCamera();
                setAdminMealSlots(canteenService.getMealSlots());
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'menu'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UtensilsCrossed className={`w-4 h-4 ${activeTab === 'menu' ? 'text-white' : 'text-slate-500'}`} />
              <span>Menu & Timings</span>
            </button>
          </div>

        </div>
      </aside>

      {/* ============================================================= */}
      {/* MAIN CONTENT AREA                                             */}
      {/* ============================================================= */}
      <div className="flex-1 h-full overflow-y-auto flex flex-col min-w-0 bg-slate-50">
        
        {/* Top Header of Main Content Area */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-2xs">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {activeTab === 'registered'
                ? 'Registered Cafeteria Personnel'
                : activeTab === 'analytics'
                ? 'Kitchen Analysis & Operations Telemetry'
                : activeTab === 'transport'
                ? 'Food Transport & Sector Dispatches'
                : activeTab === 'feedback'
                ? 'Feedback Review & Analysis'
                : 'Daily Menu & Serving Timings Management'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'registered'
                ? 'Search, review, edit, or enroll registered cafeteria employees and staff.'
                : activeTab === 'analytics'
                ? 'Real-time telemetry, consumption curve, and audit clearance ledger.'
                : activeTab === 'transport'
                ? 'Manage food transport dispatches to other units and track date-wise analytics.'
                : activeTab === 'feedback'
                ? 'Overview of employee satisfaction ratings, food quality feedback, and suggestions.'
                : 'Update daily food items in Tamil/English and configure operational timings.'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
              Central System Active
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          
          {/* ============================================================= */}
          {/* TAB 1: REGISTERED USERS LIST                                  */}
          {/* ============================================================= */}
          {activeTab === 'registered' && (
            <div className="space-y-4">
              
              {/* Top Bar in Registered Users: Title & NEW REGISTRATION BUTTON */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-slate-900 text-base">
                    Personnel Directory
                  </h3>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {employees.length} Users
                  </span>
                </div>

                {/* Prominent New Registration Button at the Top */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingEmployee(null);
                    setIsRegisteringNew(true);
                    loadEmployees();
                    if (!formData.id) {
                      setFormData((prev) => ({
                        ...prev,
                        id: `EMP-${1000 + employees.length + 1}`,
                      }));
                    }
                  }}
                  className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer ml-auto"
                  title="Enroll a new worker or staff with biometric touch recognition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ New Registration</span>
                </button>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Name, Employee ID, or Department..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setRoleFilter('ALL')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      roleFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    All Roles
                  </button>
                  <button
                    onClick={() => setRoleFilter('Employee')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      roleFilter === 'Employee' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    Employees
                  </button>
                  <button
                    onClick={() => setRoleFilter('Staff')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      roleFilter === 'Staff' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    Staff
                  </button>
                </div>
              </div>

              {/* User Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredEmployees.length === 0 ? (
                  <div className="col-span-2 text-center py-12 px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2.5">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">No Users Registered Yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Your database and canteen roster are ready. Click below to register personnel.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsRegisteringNew(true)}
                      className="mt-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
                    >
                      + Register First Employee
                    </button>
                  </div>
                ) : (
                  filteredEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      className="p-4 bg-white hover:bg-slate-50/60 rounded-2xl border border-slate-200 transition-all flex items-center justify-between gap-3 shadow-2xs group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <img
                          src={emp.photo}
                          alt={emp.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-emerald-600 shadow-xs shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold text-slate-900 text-sm truncate">
                              {emp.name}
                            </h4>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border font-mono ${
                                emp.role === 'Staff'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {emp.role || 'Employee'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">
                            <span className="font-semibold text-slate-700">{emp.id}</span> •{' '}
                            <span className="font-sans">{emp.dept}</span>
                          </p>
                          {typeof emp.confidence === 'number' && (
                            <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                              Face Match Confidence: {(emp.confidence * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons: Edit & Delete */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(emp)}
                          title="Edit User Details"
                          className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                          title="Delete User"
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 2: KITCHEN ANALYTICS & OPERATIONS                         */}
          {/* ============================================================= */}
          {activeTab === 'analytics' && (
            <div className="py-1">
              <KitchenAnalyticsView />
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 3: FOOD TRANSPORT & SECTOR DISPATCHES                     */}
          {/* ============================================================= */}
          {activeTab === 'transport' && (
            <div className="py-1">
              <FoodTransportView />
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 4: FEEDBACK REVIEW & SENTIMENT ANALYSIS                   */}
          {/* ============================================================= */}
          {activeTab === 'feedback' && (
            <div className="py-1">
              <FeedbackReviewView />
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 4: DAILY MENU & SERVING TIMINGS MANAGEMENT               */}
          {/* ============================================================= */}
          {activeTab === 'menu' && (
            <div className="flex flex-col gap-5 py-1">
              {/* Header Info */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
                    <span>Daily Menu & Serving Timings Configuration</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    உணவு பட்டியல் & பரிமாறும் நேரம் மாற்றுதல். Enter food items in Tamil or English.
                  </p>
                </div>

                {isMenuSavedToast && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Menu saved & live on Kiosk!</span>
                  </span>
                )}
              </div>

              {/* Slot Switcher Pills */}
              <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto">
                {adminMealSlots.map((s) => {
                  const isCurrent = s.name === activeAdminSlot;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setActiveAdminSlot(s.name)}
                      className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        isCurrent
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{s.emoji}</span>
                      <span>{s.name}</span>
                      {s.tamilDisplayName && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({s.tamilDisplayName})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Slot Editor Box */}
              {(() => {
                const currentSlot = adminMealSlots.find((s) => s.name === activeAdminSlot) || adminMealSlots[0];
                if (!currentSlot) return null;

                const updateCurrent = (field: keyof MealSlotConfig, val: unknown) => {
                  setAdminMealSlots((prev) =>
                    prev.map((s) => (s.name === currentSlot.name ? { ...s, [field]: val } : s))
                  );
                  setIsMenuSavedToast(false);
                };

                const appendDish = (dish: string) => {
                  const curr = currentSlot.description.trim();
                  updateCurrent('description', curr ? `${curr}, ${dish}` : dish);
                };

                const handleSaveMenu = async () => {
                  await canteenService.updateMealSlots(adminMealSlots);
                  soundEngine.playVerificationChime();
                  setIsMenuSavedToast(true);
                  setTimeout(() => setIsMenuSavedToast(false), 3000);
                };

                const quickTamilDishes: Record<string, string[]> = {
                  Tiffin: ['இட்லி, சாம்பார், சட்னி', 'மெதுவடை', 'வெண் பொங்கல்', 'பூரி மசாலா', 'மசால் தோசை', 'ஃபில்டர் காபி'],
                  Lunch: ['சாம்பார் சாதம்', 'காய்கறி கூட்டு, பொரியல்', 'ரசம், மோர்', 'அப்பளம்', 'சப்பாத்தி குருமா', 'பாயாசம்'],
                  'Tea/Snacks': ['ஸ்பெஷல் மசாலா டீ', 'ஃபில்டர் காபி', 'வெங்காய பக்கோடா', 'சூடான சமோசா', 'மெது பஜ்ஜி', 'புதினா சட்னி'],
                };

                return (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                    {/* Header with Active Toggle */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-2xl">{currentSlot.emoji}</span>
                        <div>
                          <h5 className="font-bold text-slate-900 text-sm">
                            {currentSlot.name}
                            {currentSlot.tamilDisplayName && ` (${currentSlot.tamilDisplayName})`}
                          </h5>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Category: {currentSlot.category}
                          </span>
                        </div>
                      </div>

                      <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={currentSlot.isActive !== false}
                          onChange={(e) => updateCurrent('isActive', e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Active Session</span>
                      </label>
                    </div>

                    {/* Serving Timing (From - To) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Serving Start Time (From)</span>
                        </label>
                        <input
                          type="time"
                          value={currentSlot.startTime}
                          onChange={(e) => updateCurrent('startTime', e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Serving End Time (To)</span>
                        </label>
                        <input
                          type="time"
                          value={currentSlot.endTime}
                          onChange={(e) => updateCurrent('endTime', e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Food Menu Items Textarea */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                          <Languages className="w-4 h-4 text-emerald-600" />
                          <span>Menu Items (Type in Tamil or English / தமிழ் அல்லது English)</span>
                        </label>
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          UTF-8 Unicode
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={currentSlot.description}
                        onChange={(e) => updateCurrent('description', e.target.value)}
                        placeholder="எ.கா: இட்லி, வடை, சாம்பார், காபி / Idli, Vada, Sambar, Coffee"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white leading-relaxed"
                      />

                      {/* Quick Tamil Dish Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>Add dish:</span>
                        </span>
                        {(quickTamilDishes[currentSlot.name] || quickTamilDishes.Breakfast).map((dish) => (
                          <button
                            key={dish}
                            type="button"
                            onClick={() => appendDish(dish)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
                          >
                            + {dish}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Meal Cost & Save Button */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      <div>
                        {/* Meal Cost / Rate */}
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 bg-emerald-50/70 border border-emerald-200 px-3 py-1.5 rounded-xl">
                          <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs font-mono">₹</span>
                          <span>Meal Cost (விலை):</span>
                          <span className="font-bold text-slate-700 font-mono">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={currentSlot.rate ?? currentSlot.cost ?? 40}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              updateCurrent('rate', val);
                              updateCurrent('cost', val);
                            }}
                            className="w-20 bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-mono font-black text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveMenu}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-2 active:scale-95 cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save & Broadcast Menu</span>
                      </button>
                    </div>

                  </div>
                );
              })()}

            </div>
          )}

        </div>
      </div>

      {/* ============================================================= */}
      {/* NEW WORKER REGISTRATION MODAL (REDESIGNED)                    */}
      {/* ============================================================= */}
      {isRegisteringNew && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden relative animate-in zoom-in-95 duration-200">
            
            {/* Registering Overlay Spinner Popup */}
            {isSubmitting && (
              <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-xs rounded-3xl flex flex-col items-center justify-center gap-3 animate-in fade-in">
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
                  <FingerprintIcon className="w-7 h-7 text-emerald-600 absolute animate-pulse" />
                </div>
                <div className="text-center">
                  <h4 className="text-base font-black text-slate-900 tracking-tight">
                    Registering Worker...
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Encrypting multi-angle touch templates & syncing central database...
                  </p>
                </div>
              </div>
            )}

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/30">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                    Worker Registration & Biometric Enrollment
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Dual-touch multi-angle enrolment (Primary + Backup) for instant cafeteria clearance.</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs font-bold shadow-2xs">
                  <Usb className={`w-3.5 h-3.5 ${mantraInfo.isConnected ? 'text-emerald-600 animate-pulse' : 'text-amber-500'}`} />
                  <span>{mantraInfo.isConnected ? 'Sensor Ready' : 'Sensor Offline'}</span>
                </span>
                <span className="text-xs font-mono font-black px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {formData.id}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisteringNew(false);
                    stopCamera();
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* In-Modal Alerts */}
            {successMessage && (
              <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-xs font-bold text-emerald-800 animate-in fade-in shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
            {errorMessage && (
              <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2 text-xs font-bold text-rose-800 animate-in fade-in shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Modal Body */}
            <form onSubmit={handleRegisterSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
                
                {/* 1. Worker Profile Information (Horizontal 3-Col Card) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Worker Information</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Full Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Full Name *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Ananya Roy"
                          className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-medium"
                          required
                        />
                      </div>
                    </div>

                    {/* Worker ID */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Worker ID *
                      </label>
                      <div className="relative">
                        <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={formData.id}
                          onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                          placeholder="e.g. EMP-1011"
                          className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-bold"
                          required
                        />
                      </div>
                    </div>

                    {/* Department / Role */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Department / Role *
                      </label>
                      <select
                        value={formData.dept}
                        onChange={(e) => handleDeptChange(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-bold"
                      >
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Side-By-Side Biometric Touch Enrollment */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                      <FingerprintIcon className="w-4 h-4 text-emerald-600" />
                      <span>Biometric Touch ID Enrollment (3 Progressive Angles Each)</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 font-mono">
                      {(finger1.samples?.length || 0) + (finger2.samples?.length || 0)}/6 Taps Recorded
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Primary Touch Card */}
                    <MultiSampleFingerCard
                      cardTitle="Primary Touch"
                      finger={finger1}
                      onNameChange={(name) => setFinger1({ ...finger1, fingerName: name })}
                      onScan={handleScanFinger1}
                      onReset={handleResetFinger1}
                      isScanning={isScanningFp1}
                      themeColor="emerald"
                      fingerOptions={FINGER_OPTIONS}
                    />

                    {/* Backup Touch Card */}
                    <MultiSampleFingerCard
                      cardTitle="Backup Touch"
                      finger={finger2}
                      onNameChange={(name) => setFinger2({ ...finger2, fingerName: name })}
                      onScan={handleScanFinger2}
                      onReset={handleResetFinger2}
                      isScanning={isScanningFp2}
                      themeColor="blue"
                      fingerOptions={FINGER_OPTIONS}
                    />
                  </div>
                </div>

              </div>

              {/* Modal Footer Bar */}
              <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
                {/* Left: Enrollment Checklist */}
                <div className="flex items-center space-x-3 text-xs">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                      (finger1.samples?.length || 0) >= 3
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span>Primary: {finger1.samples?.length || 0}/3</span>
                    {(finger1.samples?.length || 0) >= 3 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                      (finger2.samples?.length || 0) >= 3
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span>Backup: {finger2.samples?.length || 0}/3</span>
                    {(finger2.samples?.length || 0) >= 3 && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                  </span>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisteringNew(false);
                      stopCamera();
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/30 flex items-center space-x-2 transition-all transform active:scale-95 disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registering Worker...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Complete Registration</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* EDIT WORKER MODAL (REDESIGNED & HIGH-END BIOMETRIC RESCAN)    */}
      {/* ============================================================= */}
      {editingEmployee && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden relative animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/30">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                    Edit Worker: {editingEmployee.name}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Update worker details and re-enroll multi-angle biometric touches if required.</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs font-bold shadow-2xs">
                  <Usb className={`w-3.5 h-3.5 ${mantraInfo.isConnected ? 'text-emerald-600 animate-pulse' : 'text-amber-500'}`} />
                  <span>{mantraInfo.isConnected ? 'Sensor Ready' : 'Sensor Offline'}</span>
                </span>
                <span className="text-xs font-mono font-black px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200">
                  {editingEmployee.id}
                </span>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* In-Modal Alerts */}
            {editErrorMessage && (
              <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2 text-xs font-bold text-rose-800 animate-in fade-in shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editErrorMessage}</span>
              </div>
            )}

            {/* Modal Body */}
            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
                
                {/* 1. Worker Identity Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>Worker Identity & Role</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Full Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Full Name *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={editingEmployee.name}
                          onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                          placeholder="e.g. Ananya Roy"
                          className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
                          required
                        />
                      </div>
                    </div>

                    {/* Worker ID */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Worker ID *
                      </label>
                      <div className="relative">
                        <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={editingEmployee.id}
                          onChange={(e) => setEditingEmployee({ ...editingEmployee, id: e.target.value.toUpperCase() })}
                          placeholder="e.g. EMP-1011"
                          className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold"
                          required
                        />
                      </div>
                    </div>

                    {/* Department */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Department / Role *
                      </label>
                      <select
                        value={editingEmployee.dept}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, dept: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold"
                      >
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Biometric Touch ID Rescan Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                      <FingerprintIcon className="w-4 h-4 text-indigo-600" />
                      <span>Biometric Touch Rescan & Update (3 Progressive Angles Each)</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 font-mono">
                      {(editFinger1.samples?.length || 0) + (editFinger2.samples?.length || 0)}/6 Taps Recorded
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Primary Touch Card */}
                    <MultiSampleFingerCard
                      cardTitle="Primary Touch"
                      finger={editFinger1}
                      onNameChange={(name) => setEditFinger1({ ...editFinger1, fingerName: name })}
                      onScan={handleEditScanFinger1}
                      onReset={handleEditResetFinger1}
                      isScanning={editIsScanningFp1}
                      themeColor="emerald"
                      fingerOptions={FINGER_OPTIONS}
                    />

                    {/* Backup Touch Card */}
                    <MultiSampleFingerCard
                      cardTitle="Backup Touch"
                      finger={editFinger2}
                      onNameChange={(name) => setEditFinger2({ ...editFinger2, fingerName: name })}
                      onScan={handleEditScanFinger2}
                      onReset={handleEditResetFinger2}
                      isScanning={editIsScanningFp2}
                      themeColor="blue"
                      fingerOptions={FINGER_OPTIONS}
                    />
                  </div>
                </div>

              </div>

              {/* Modal Footer Bar */}
              <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center space-x-3 text-xs">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                      (editFinger1.samples?.length || 0) >= 3
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span>Primary: {editFinger1.samples?.length || 0}/3</span>
                    {(editFinger1.samples?.length || 0) >= 3 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                      (editFinger2.samples?.length || 0) >= 3
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span>Backup: {editFinger2.samples?.length || 0}/3</span>
                    {(editFinger2.samples?.length || 0) >= 3 && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                  </span>
                </div>

                <div className="flex items-center space-x-2 ml-auto">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/30 flex items-center space-x-2 transition-all transform active:scale-95 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TOP-RIGHT FLOATING NOTIFICATION POPUP (TOAST)                 */}
      {/* ============================================================= */}
      {notification && (
        <div className="fixed top-5 right-5 z-[100] max-w-sm sm:max-w-md w-full pointer-events-auto transition-all animate-in slide-in-from-top-4 fade-in duration-200">
          <div
            className={`p-4 rounded-2xl border shadow-2xl flex items-start gap-3 backdrop-blur-md ${
              notification.type === 'success'
                ? 'bg-emerald-950/95 text-white border-emerald-500/50 shadow-emerald-950/40'
                : notification.type === 'error'
                ? 'bg-rose-950/95 text-white border-rose-500/50 shadow-rose-950/40'
                : notification.type === 'warning'
                ? 'bg-amber-950/95 text-white border-amber-500/50 shadow-amber-950/40'
                : 'bg-slate-900/95 text-white border-blue-500/50 shadow-slate-950/40'
            }`}
          >
            {/* Status Icon */}
            <div className="shrink-0 mt-0.5">
              {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {notification.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
              {notification.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-400" />}
              {notification.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
            </div>

            {/* Notification Body */}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black tracking-wide uppercase text-slate-200 mb-0.5">
                {notification.title}
              </h4>
              <p className="text-xs font-medium text-slate-100 leading-relaxed break-words">
                {notification.message}
              </p>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => setNotification(null)}
              className="shrink-0 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
