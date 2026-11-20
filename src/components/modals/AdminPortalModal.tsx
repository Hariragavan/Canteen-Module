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
  ArrowLeft,
  Truck,
  MessageSquareHeart,
  Fingerprint as FingerprintIcon,
  Usb,
  ShieldCheck,
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
  const iconColor = isEmerald ? 'text-emerald-600' : 'text-blue-600';
  const badgeClass = isEmerald
    ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
    : 'border-blue-300 bg-blue-100 text-blue-800';
  const btnBg = isEmerald
    ? 'bg-emerald-600 hover:bg-emerald-700'
    : 'bg-blue-600 hover:bg-blue-700';

  const samplesCount = finger.samples?.length || 0;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <FingerprintIcon className={`w-4 h-4 ${iconColor}`} />
          <span>{cardTitle} *</span>
        </span>
        {samplesCount > 0 && (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${badgeClass}`}>
            <ShieldCheck className={`w-3 h-3 ${iconColor}`} />
            <span>Best: {finger.quality}%</span>
          </span>
        )}
      </div>

      {/* Name Selector */}
      <select
        value={finger.fingerName}
        onChange={(e) => onNameChange(e.target.value)}
        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      >
        {fingerOptions.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      {/* 3-Tap Progress Tracker (Aadhaar / Smartphone Style) */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { idx: 1, label: '1. Flat' },
          { idx: 2, label: '2. Tilt' },
          { idx: 3, label: '3. Firm' },
        ].map(({ idx, label }) => {
          const sample = (finger.samples || []).find((s) => s.sampleIndex === idx);
          const isDone = Boolean(sample);
          const isCurrent = samplesCount + 1 === idx;
          return (
            <div
              key={idx}
              className={`p-1.5 rounded-xl border text-center transition-all ${
                isDone
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : isCurrent
                  ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold animate-pulse'
                  : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              <div className="text-[10px] font-bold">{label}</div>
              <div className="text-[9px] font-mono">
                {isDone ? `✓ ${sample?.quality}%` : isCurrent ? 'Next Tap' : 'Pending'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Step Guidance */}
      <div className="px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-700 flex items-center justify-between">
        <span className="font-medium truncate">
          {samplesCount === 0 && 'Step 1: Place finger flat on the sensor.'}
          {samplesCount === 1 && 'Step 2: Lift & place at a slight angle.'}
          {samplesCount === 2 && 'Step 3: Lift & press firmly on sensor.'}
          {samplesCount >= 3 && '✓ All 3 scans captured (Enrolled)!'}
        </span>
        {samplesCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer ml-1.5 shrink-0"
          >
            Reset
          </button>
        )}
      </div>

      {/* Touch Preview Box */}
      <div className="h-28 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center relative">
        {finger.bitmapData ? (
          <img
            src={finger.bitmapData}
            alt="Fingerprint preview"
            className="h-full object-contain filter invert contrast-125"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
            <FingerprintIcon className="w-8 h-8 text-slate-600 stroke-1" />
            <span className="text-[10px] font-mono">No touch scanned yet</span>
          </div>
        )}
        {samplesCount > 0 && (
          <span className="absolute bottom-1 right-2 text-[10px] bg-slate-950/80 text-emerald-400 font-mono px-1.5 py-0.5 rounded">
            {samplesCount}/3 Scans Saved
          </span>
        )}
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={onScan}
        disabled={isScanning || samplesCount >= 3}
        className={`w-full py-2 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
          isScanning
            ? 'bg-amber-500 text-white animate-pulse'
            : samplesCount >= 3
            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 opacity-90 cursor-default'
            : `${btnBg} text-white active:scale-95`
        }`}
      >
        <FingerprintIcon className="w-4 h-4" />
        <span>
          {isScanning
            ? 'Scanning on sensor...'
            : samplesCount === 0
            ? 'Start Scan (1 of 3: Flat Touch)'
            : samplesCount === 1
            ? 'Next Scan (2 of 3: Angle Touch)'
            : samplesCount === 2
            ? 'Final Scan (3 of 3: Firm Press)'
            : '✓ Touch Enrolled (3 of 3 Completed)'}
        </span>
      </button>
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
        if (t && (probeIso === t || Math.abs(probeIso.length - t.length) <= 30)) {
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
        setErrorMessage('All 3 scans are already captured. Click "Reset" if you wish to re-enroll.');
        return;
      }

      const res = await mantraService.captureFingerprint(60, 8);
      if (res.success && res.isoTemplate) {
        // 1. Minimum 60% quality threshold
        if (res.quality < 60) {
          soundEngine.playWarningBuzzer();
          setErrorMessage(`Touch quality was ${res.quality}%. Minimum 60% quality is required. Please press firmly and scan again.`);
          return;
        }

        // 2. Check duplicate with already registered personnel
        const dup = checkDuplicateFinger(res.isoTemplate, formData.id);
        if (dup.isDuplicate) {
          soundEngine.playWarningBuzzer();
          setErrorMessage(`This touch is already registered to ${dup.matchedName} (${dup.matchedId})! Duplicate registration is not allowed.`);
          return;
        }

        // 3. Check duplicate with Finger 2
        const f2AllTemplates = [
          finger2.isoTemplate,
          ...(finger2.samples || []).map((s) => s.isoTemplate),
        ].filter(Boolean);

        for (const f2t of f2AllTemplates) {
          if (res.isoTemplate === f2t || Math.abs(res.isoTemplate.length - f2t.length) <= 25) {
            soundEngine.playWarningBuzzer();
            setErrorMessage('Primary and Backup Touch cannot be the same finger. Please scan two different fingers.');
            return;
          }
        }

        // 4. Verify consistency with Tap 1
        if (currentSamples.length > 0) {
          const tap1Iso = currentSamples[0].isoTemplate;
          if (Math.abs(res.isoTemplate.length - tap1Iso.length) > 55) {
            soundEngine.playWarningBuzzer();
            setErrorMessage('Different finger detected! Please use the same finger for all 3 scans of this touch.');
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
        setFinger1({
          fingerName: finger1.fingerName,
          isoTemplate: bestSample.isoTemplate,
          bitmapData: bestSample.bitmapData || '',
          quality: bestSample.quality,
          samples: updatedSamples,
        });

        if (updatedSamples.length >= 3) {
          setSuccessMessage(`✓ Primary Touch: All 3 scans captured (Best Quality: ${bestSample.quality}%)!`);
        }
      } else {
        soundEngine.playWarningBuzzer();
        setErrorMessage(res.errorDescription || 'Scan timed out or failed. Please try again.');
      }
    } catch (e: any) {
      soundEngine.playWarningBuzzer();
      setErrorMessage(e.message || 'Sensor communication error.');
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
        setErrorMessage('All 3 scans are already captured. Click "Reset" if you wish to re-enroll.');
        return;
      }

      const res = await mantraService.captureFingerprint(60, 8);
      if (res.success && res.isoTemplate) {
        // 1. Minimum 60% quality threshold
        if (res.quality < 60) {
          soundEngine.playWarningBuzzer();
          setErrorMessage(`Touch quality was ${res.quality}%. Minimum 60% quality is required. Please press firmly and scan again.`);
          return;
        }

        // 2. Check collision with Finger 1
        const f1AllTemplates = [
          finger1.isoTemplate,
          ...(finger1.samples || []).map((s) => s.isoTemplate),
        ].filter(Boolean);

        for (const f1t of f1AllTemplates) {
          if (res.isoTemplate === f1t || Math.abs(res.isoTemplate.length - f1t.length) <= 25) {
            soundEngine.playWarningBuzzer();
            setErrorMessage('Backup Touch cannot be the same as Primary Touch. Please scan a different finger.');
            return;
          }
        }

        // 3. Check duplicate with already registered personnel
        const dup = checkDuplicateFinger(res.isoTemplate, formData.id);
        if (dup.isDuplicate) {
          soundEngine.playWarningBuzzer();
          setErrorMessage(`This touch is already registered to ${dup.matchedName} (${dup.matchedId})! Duplicate registration is not allowed.`);
          return;
        }

        // 4. Verify consistency with Tap 1
        if (currentSamples.length > 0) {
          const tap1Iso = currentSamples[0].isoTemplate;
          if (Math.abs(res.isoTemplate.length - tap1Iso.length) > 55) {
            soundEngine.playWarningBuzzer();
            setErrorMessage('Different finger detected! Please use the same finger for all 3 scans of this touch.');
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
        setFinger2({
          fingerName: finger2.fingerName,
          isoTemplate: bestSample.isoTemplate,
          bitmapData: bestSample.bitmapData || '',
          quality: bestSample.quality,
          samples: updatedSamples,
        });

        if (updatedSamples.length >= 3) {
          setSuccessMessage(`✓ Backup Touch: All 3 scans captured (Best Quality: ${bestSample.quality}%)!`);
        }
      } else {
        soundEngine.playWarningBuzzer();
        setErrorMessage(res.errorDescription || 'Scan timed out or failed. Please try again.');
      }
    } catch (e: any) {
      soundEngine.playWarningBuzzer();
      setErrorMessage(e.message || 'Sensor communication error.');
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
      setErrorMessage('Please enter Full Name.');
      return;
    }
    if (!cleanId) {
      setErrorMessage('Please enter an Employee/Staff ID.');
      return;
    }

    // Safety Check 1: Prevent duplicate ID
    const existingIdMatch = employees.find(
      (emp) => emp.id.toUpperCase() === cleanId
    );
    if (existingIdMatch) {
      soundEngine.playWarningBuzzer();
      setErrorMessage(`ID Conflict: Personnel ID "${cleanId}" is already registered to ${existingIdMatch.name}.`);
      return;
    }

    const role: 'Staff' | 'Employee' = formData.dept.toLowerCase().includes('staff') ? 'Staff' : 'Employee';

    // TWO-TOUCH ENROLLMENT (3 Samples per touch required)
    if (!finger1.isoTemplate || (finger1.samples && finger1.samples.length < 3)) {
      soundEngine.playWarningBuzzer();
      setErrorMessage(`Please complete all 3 scans for Primary Touch (${finger1.samples?.length || 0}/3 completed).`);
      return;
    }
    if (!finger2.isoTemplate || (finger2.samples && finger2.samples.length < 3)) {
      soundEngine.playWarningBuzzer();
      setErrorMessage(`Please complete all 3 scans for Backup Touch (${finger2.samples?.length || 0}/3 completed).`);
      return;
    }

    // Check duplicate between Primary and Backup
    if (
      finger1.isoTemplate === finger2.isoTemplate ||
      Math.abs(finger1.isoTemplate.length - finger2.isoTemplate.length) <= 25
    ) {
      soundEngine.playWarningBuzzer();
      setErrorMessage('Primary and Backup Touch cannot be the same. Please scan two different touches.');
      return;
    }

    // Check duplicate with all already registered personnel
    const dup1 = checkDuplicateFinger(finger1.isoTemplate, cleanId);
    if (dup1.isDuplicate) {
      soundEngine.playWarningBuzzer();
      setErrorMessage(`Primary Touch is already registered to ${dup1.matchedName} (${dup1.matchedId})! Duplicate registration is not allowed.`);
      return;
    }

    const dup2 = checkDuplicateFinger(finger2.isoTemplate, cleanId);
    if (dup2.isDuplicate) {
      soundEngine.playWarningBuzzer();
      setErrorMessage(`Backup Touch is already registered to ${dup2.matchedName} (${dup2.matchedId})! Duplicate registration is not allowed.`);
      return;
    }

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
      setSuccessMessage(`✓ Successfully registered ${cleanName} (${cleanId}) with 3-sample multi-touch enrollment! Ready for next personnel.`);
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
        setEditErrorMessage('All 3 scans are already captured. Click "Reset" if you wish to re-enroll.');
        return;
      }

      const res = await mantraService.captureFingerprint(60, 8);
      if (res.success && res.isoTemplate) {
        // 1. Minimum 60% quality
        if (res.quality < 60) {
          soundEngine.playWarningBuzzer();
          setEditErrorMessage(`Touch quality was ${res.quality}%. Minimum 60% quality is required. Please press firmly and scan again.`);
          return;
        }

        // 2. Check duplicate with other registered personnel
        const dup = checkDuplicateFinger(res.isoTemplate, editingOriginalId || undefined);
        if (dup.isDuplicate) {
          soundEngine.playWarningBuzzer();
          setEditErrorMessage(`This touch is already registered to ${dup.matchedName} (${dup.matchedId})! Duplicate registration is not allowed.`);
          return;
        }

        // 3. Check collision with editFinger2
        const f2AllTemplates = [
          editFinger2.isoTemplate,
          ...(editFinger2.samples || []).map((s) => s.isoTemplate),
        ].filter(Boolean);

        for (const f2t of f2AllTemplates) {
          if (res.isoTemplate === f2t || Math.abs(res.isoTemplate.length - f2t.length) <= 25) {
            soundEngine.playWarningBuzzer();
            setEditErrorMessage('Primary and Backup Touch cannot be the same. Please scan two different touches.');
            return;
          }
        }

        // 4. Verify consistency with Tap 1
        if (currentSamples.length > 0) {
          const tap1Iso = currentSamples[0].isoTemplate;
          if (Math.abs(res.isoTemplate.length - tap1Iso.length) > 55) {
            soundEngine.playWarningBuzzer();
            setEditErrorMessage('Different finger detected! Please use the same finger for all 3 scans of this touch.');
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
      } else {
        soundEngine.playWarningBuzzer();
        setEditErrorMessage(res.errorDescription || 'Scan timed out or failed. Please try again.');
      }
    } catch (e: any) {
      soundEngine.playWarningBuzzer();
      setEditErrorMessage(e.message || 'Sensor communication error.');
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
        setEditErrorMessage('All 3 scans are already captured. Click "Reset" if you wish to re-enroll.');
        return;
      }

      const res = await mantraService.captureFingerprint(60, 8);
      if (res.success && res.isoTemplate) {
        // 1. Minimum 60% quality
        if (res.quality < 60) {
          soundEngine.playWarningBuzzer();
          setEditErrorMessage(`Touch quality was ${res.quality}%. Minimum 60% quality is required. Please press firmly and scan again.`);
          return;
        }

        // 2. Check collision with editFinger1
        const f1AllTemplates = [
          editFinger1.isoTemplate,
          ...(editFinger1.samples || []).map((s) => s.isoTemplate),
        ].filter(Boolean);

        for (const f1t of f1AllTemplates) {
          if (res.isoTemplate === f1t || Math.abs(res.isoTemplate.length - f1t.length) <= 25) {
            soundEngine.playWarningBuzzer();
            setEditErrorMessage('Backup Touch cannot be the same as Primary Touch. Please scan a different touch.');
            return;
          }
        }

        // 3. Check duplicate with other registered personnel
        const dup = checkDuplicateFinger(res.isoTemplate, editingOriginalId || undefined);
        if (dup.isDuplicate) {
          soundEngine.playWarningBuzzer();
          setEditErrorMessage(`This touch is already registered to ${dup.matchedName} (${dup.matchedId})! Duplicate registration is not allowed.`);
          return;
        }

        // 4. Verify consistency with Tap 1
        if (currentSamples.length > 0) {
          const tap1Iso = currentSamples[0].isoTemplate;
          if (Math.abs(res.isoTemplate.length - tap1Iso.length) > 55) {
            soundEngine.playWarningBuzzer();
            setEditErrorMessage('Different finger detected! Please use the same finger for all 3 scans of this touch.');
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
        setEditFinger2({
          fingerName: editFinger2.fingerName,
          isoTemplate: bestSample.isoTemplate,
          bitmapData: bestSample.bitmapData || '',
          quality: bestSample.quality,
          samples: updatedSamples,
        });
      } else {
        soundEngine.playWarningBuzzer();
        setEditErrorMessage(res.errorDescription || 'Scan timed out or failed. Please try again.');
      }
    } catch (e: any) {
      soundEngine.playWarningBuzzer();
      setEditErrorMessage(e.message || 'Sensor communication error.');
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
      handleCancelEdit();
      loadEmployees();
      if (onRosterUpdated) onRosterUpdated();
    } catch (err: unknown) {
      console.error('Update employee error:', err);
      soundEngine.playWarningBuzzer();
      setEditErrorMessage(err instanceof Error ? err.message : 'Update failed');
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
                ? isRegisteringNew
                  ? 'New Personnel Registration'
                  : 'Registered Cafeteria Personnel'
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
                ? isRegisteringNew
                  ? 'Capture face photo, verify unique vector embedding, and enroll personnel.'
                  : 'Search, review, edit, or remove registered cafeteria employees and staff.'
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
          {/* TAB 1: REGISTERED USERS LIST (WHEN NOT REGISTERING NEW)       */}
          {/* ============================================================= */}
          {activeTab === 'registered' && !isRegisteringNew && (
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
                  title="Enroll a new staff or employee with facial recognition"
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
          {/* TAB 1 SUBVIEW: NEW REGISTRATION (WITH LIVE IMAGE CAPTURE)     */}
          {/* ============================================================= */}
          {activeTab === 'registered' && isRegisteringNew && (
            <div className="space-y-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisteringNew(false);
                    stopCamera();
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>← Back to Registered Users</span>
                </button>
                <span className="text-xs font-bold text-slate-500 font-mono">
                  Sequential Auto ID: {formData.id}
                </span>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-6">
              
              {successMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2 text-xs font-bold text-rose-800">
                  <X className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Header: Touch ID Registration */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <FingerprintIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-emerald-950">Touch ID Registration</h4>
                    <p className="text-[11px] text-emerald-700 font-medium">Dual Touch Enrollment (Primary + Backup)</p>
                  </div>
                </div>

                {/* Live Device Connection Badge */}
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-slate-800 font-mono text-[11px] shadow-2xs">
                    <Usb className={`w-3.5 h-3.5 ${mantraInfo.isConnected ? 'text-emerald-600 animate-pulse' : 'text-amber-500'}`} />
                    <span className="font-bold">{mantraInfo.isConnected ? 'Sensor Connected' : 'Sensor Disconnected'}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* ========================================================= */}
                {/* 1. DUAL TOUCH ENROLLMENT (5 cols)                         */}
                {/* ========================================================= */}
                <div className="md:col-span-5 flex flex-col gap-3.5">
                  {/* Primary Touch Card with 3-Tap Multi-Sampling */}
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

                  {/* Backup Touch Card with 3-Tap Multi-Sampling */}
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

                {/* RIGHT: User Information Form (7 cols) - Strictly: Name, ID, Dept */}
                <div className="md:col-span-7 space-y-4">
                  
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Ananya Roy"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      required
                    />
                  </div>

                  {/* Employee ID */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Personnel ID (e.g. EMP-1011 or STF-2005) *
                    </label>
                    <input
                      type="text"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                      placeholder="e.g. EMP-1011"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      required
                    />
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Department (Staff / Employee / Division) *
                    </label>
                    <select
                      value={formData.dept}
                      onChange={(e) => handleDeptChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-medium"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/25 flex items-center justify-center space-x-2 transition-all transform active:scale-95"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Register Personnel</span>
                    </button>
                  </div>

                </div>

              </div>

            </form>
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
      {/* EDIT USER DRAWER / MODAL OVERLAY                              */}
      {/* ============================================================= */}
      {editingEmployee && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-modal p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-base">
                  Edit User: {editingEmployee.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              
              {/* Fingerprint / Touch Rescanning Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center space-x-2">
                    <FingerprintIcon className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs text-slate-800">
                      Touch Enrolment (Rescan & Update)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    Mantra RD Service
                  </span>
                </div>

                {editErrorMessage && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2 animate-shake">
                    <span className="text-rose-500 font-bold shrink-0">⚠️</span>
                    <span>{editErrorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Touch 1 (Primary) with 3-Tap Multi-Sampling */}
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

                  {/* Touch 2 (Backup) with 3-Tap Multi-Sampling */}
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

              {/* Full Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editingEmployee.name}
                  onChange={(e) =>
                    setEditingEmployee({ ...editingEmployee, name: e.target.value })
                  }
                  placeholder="e.g. Ananya Roy"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  required
                />
              </div>

              {/* Personnel ID */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Personnel ID (Staff / Employee ID) *
                </label>
                <input
                  type="text"
                  value={editingEmployee.id}
                  onChange={(e) =>
                    setEditingEmployee({ ...editingEmployee, id: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. EMP-1011 or STF-2001"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase font-bold"
                  required
                />
              </div>

              {/* Department (Strictly Staff / Employee) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Department (Staff / Employee) *
                </label>
                <select
                  value={editingEmployee.dept}
                  onChange={(e) =>
                    setEditingEmployee({ ...editingEmployee, dept: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="Staff">Staff</option>
                  <option value="Employee">Employee</option>
                </select>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
