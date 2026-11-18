import React, { useState, useRef, useEffect } from 'react';
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
  Camera,
  RefreshCw,
  Trash2,
  Edit2,
  Check,
  Search,
  CheckCircle2,
  Upload,
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

import { faceMatcherService } from '../../services/faceMatcherService';

interface AdminPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRosterUpdated?: () => void;
  onNavigateToStaffScanner?: () => void;
  onNavigateToKiosk?: () => void;
  onLogout?: () => void;
}

const DEPARTMENTS = ['Staff', 'Employee'];

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
  const [isEditCameraActive, setIsEditCameraActive] = useState<boolean>(false);
  const editVideoRef = useRef<HTMLVideoElement | null>(null);

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

  const [finger1, setFinger1] = useState<{
    fingerName: string;
    isoTemplate: string;
    bitmapData: string;
    quality: number;
  }>({
    fingerName: 'Primary Touch',
    isoTemplate: '',
    bitmapData: '',
    quality: 0,
  });

  const [finger2, setFinger2] = useState<{
    fingerName: string;
    isoTemplate: string;
    bitmapData: string;
    quality: number;
  }>({
    fingerName: 'Backup Touch',
    isoTemplate: '',
    bitmapData: '',
    quality: 0,
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
      const t1 = rec.finger1?.isoTemplate || '';
      const t2 = rec.finger2?.isoTemplate || '';

      const isMatch1 = t1 && (probeIso === t1 || Math.abs(probeIso.length - t1.length) <= 30);
      const isMatch2 = t2 && (probeIso === t2 || Math.abs(probeIso.length - t2.length) <= 30);

      if (isMatch1 || isMatch2) {
        return {
          isDuplicate: true,
          matchedName: rec.employeeName || rec.employeeId,
          matchedId: rec.employeeId,
        };
      }
    }
    return { isDuplicate: false };
  };

  const handleScanFinger1 = async () => {
    setIsScanningFp1(true);
    setErrorMessage(null);
    soundEngine.playScannerBeep();
    try {
      const res = await mantraService.captureFingerprint(60, 8);
      if (res.success && res.isoTemplate) {
        // 1. Check duplicate with already registered personnel
        const dup = checkDuplicateFinger(res.isoTemplate, formData.id);
        if (dup.isDuplicate) {
          soundEngine.playWarningBuzzer();
          setErrorMessage(`This touch is already registered to ${dup.matchedName} (${dup.matchedId})! Duplicate registration is not allowed.`);
          return;
        }

        // 2. Check duplicate with Finger 2
        if (
          finger2.isoTemplate &&
          (res.isoTemplate === finger2.isoTemplate ||
            Math.abs(res.isoTemplate.length - finger2.isoTemplate.length) <= 25)
        ) {
          soundEngine.playWarningBuzzer();
          setErrorMessage('Primary and Backup Touch cannot be the same. Please scan two different touches.');
          return;
        }

        soundEngine.playVerificationChime();
        setFinger1((prev) => ({
          ...prev,
          isoTemplate: res.isoTemplate,
          bitmapData: res.bitmapData,
          quality: res.quality,
        }));
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

  const handleScanFinger2 = async () => {
    setIsScanningFp2(true);
    setErrorMessage(null);
    soundEngine.playScannerBeep();
    try {
      const res = await mantraService.captureFingerprint(60, 8);
      if (res.success && res.isoTemplate) {
        // 1. Check duplicate with Finger 1
        if (
          finger1.isoTemplate &&
          (res.isoTemplate === finger1.isoTemplate ||
            Math.abs(res.isoTemplate.length - finger1.isoTemplate.length) <= 25)
        ) {
          soundEngine.playWarningBuzzer();
          setErrorMessage('Backup Touch cannot be the same as Primary Touch. Please scan a different touch.');
          return;
        }

        // 2. Check duplicate with already registered personnel
        const dup = checkDuplicateFinger(res.isoTemplate, formData.id);
        if (dup.isDuplicate) {
          soundEngine.playWarningBuzzer();
          setErrorMessage(`This touch is already registered to ${dup.matchedName} (${dup.matchedId})! Duplicate registration is not allowed.`);
          return;
        }

        soundEngine.playVerificationChime();
        setFinger2((prev) => ({
          ...prev,
          isoTemplate: res.isoTemplate,
          bitmapData: res.bitmapData,
          quality: res.quality,
        }));
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

    // TWO-TOUCH ENROLLMENT
    if (!finger1.isoTemplate) {
      soundEngine.playWarningBuzzer();
      setErrorMessage('Please scan Primary Touch on sensor.');
      return;
    }
    if (!finger2.isoTemplate) {
      soundEngine.playWarningBuzzer();
      setErrorMessage('Please scan Backup Touch on sensor.');
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

      // 2. Save Two-Touch data to dedicated store
      await canteenService.saveFingerprint({
        employeeId: cleanId,
        employeeName: cleanName,
        dept: formData.dept,
        finger1: {
          fingerName: finger1.fingerName,
          isoTemplate: finger1.isoTemplate,
          bitmapData: finger1.bitmapData,
          quality: finger1.quality,
        },
        finger2: {
          fingerName: finger2.fingerName,
          isoTemplate: finger2.isoTemplate,
          bitmapData: finger2.bitmapData,
          quality: finger2.quality,
        },
      });

      soundEngine.playVerificationChime();
      setSuccessMessage(`✓ Successfully registered ${cleanName} (${cleanId})! Ready for next personnel.`);
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
        fingerName: 'Right Thumb',
        isoTemplate: '',
        bitmapData: '',
        quality: 0,
      });

      setFinger1({
        fingerName: 'Primary Touch',
        isoTemplate: '',
        bitmapData: '',
        quality: 0,
      });

      setFinger2({
        fingerName: 'Backup Touch',
        isoTemplate: '',
        bitmapData: '',
        quality: 0,
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

  // Edit Mode Camera Controls
  const startEditCamera = async () => {
    try {
      setIsEditCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
      });
      if (editVideoRef.current) {
        editVideoRef.current.srcObject = stream;
        editVideoRef.current.play();
      }
    } catch (err) {
      console.warn('Edit camera access error:', err);
      alert('Camera access denied or unavailable. Please use file upload.');
      setIsEditCameraActive(false);
    }
  };

  const stopEditCamera = () => {
    if (editVideoRef.current && editVideoRef.current.srcObject) {
      const stream = editVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      editVideoRef.current.srcObject = null;
    }
    setIsEditCameraActive(false);
  };

  const captureEditPhoto = async () => {
    if (!editVideoRef.current || !editingEmployee) return;
    soundEngine.playScannerBeep();
    const video = editVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const minDim = Math.min(video.videoWidth, video.videoHeight);
      const startX = (video.videoWidth - minDim) / 2;
      const startY = (video.videoHeight - minDim) / 2;
      ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, 400, 400);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

      let desc: number[] | null = null;
      try {
        desc = await faceMatcherService.extractDescriptorArray(canvas);
      } catch (e) {
        console.warn('Edit biometric extraction error:', e);
      }

      setEditingEmployee({
        ...editingEmployee,
        photo: dataUrl,
        face_descriptor: desc,
        embedding: desc,
      });
      stopEditCamera();
    }
  };

  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingEmployee) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const dataUrl = String(event.target.result);
          let desc: number[] | null = null;
          try {
            desc = await faceMatcherService.extractDescriptorArray(dataUrl);
          } catch (e) {
            console.warn('Edit file biometric error:', e);
          }

          setEditingEmployee({
            ...editingEmployee,
            photo: dataUrl,
            face_descriptor: desc,
            embedding: desc,
          });
          stopEditCamera();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditUseSamplePhoto = async () => {
    if (!editingEmployee) return;
    const randomSeed = Math.floor(Math.random() * 1000);
    const photoUrl = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&sig=${randomSeed}`;
    let desc: number[] | null = null;
    try {
      desc = await faceMatcherService.extractDescriptorArray(photoUrl);
    } catch {
      // ignore
    }
    setEditingEmployee({
      ...editingEmployee,
      photo: photoUrl,
      face_descriptor: desc,
      embedding: desc,
    });
    stopEditCamera();
  };

  const handleStartEdit = (emp: Employee) => {
    setEditingOriginalId(emp.id);
    setEditingEmployee({ ...emp });
    setIsEditCameraActive(false);
  };

  const handleCancelEdit = () => {
    stopEditCamera();
    setEditingEmployee(null);
    setEditingOriginalId(null);
    setIsEditCameraActive(false);
  };

  // Save Edit Employee
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !editingOriginalId) return;

    try {
      const role: 'Staff' | 'Employee' = editingEmployee.dept.toLowerCase().includes('staff') ? 'Staff' : 'Employee';
      await canteenService.updateEmployee(editingOriginalId, {
        id: editingEmployee.id.trim().toUpperCase(),
        name: editingEmployee.name.trim(),
        dept: editingEmployee.dept,
        role,
        photo: editingEmployee.photo,
        face_descriptor: editingEmployee.face_descriptor || editingEmployee.embedding || null,
        embedding: editingEmployee.face_descriptor || editingEmployee.embedding || null,
      });
      soundEngine.playVerificationChime();
      handleCancelEdit();
      loadEmployees();
      if (onRosterUpdated) onRosterUpdated();
    } catch (err: unknown) {
      console.error('Update employee error:', err);
      soundEngine.playWarningBuzzer();
      alert(err instanceof Error ? err.message : 'Update failed');
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
    stopEditCamera();
    if (onNavigateToKiosk) {
      onNavigateToKiosk();
    } else {
      onClose();
    }
  };

  const handleLockLogout = () => {
    stopCamera();
    stopEditCamera();
    if (onLogout) {
      onLogout();
    } else {
      onClose();
    }
  };

  const handleGoToCounter = () => {
    stopCamera();
    stopEditCamera();
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
                  
                  {/* Primary Touch Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-2xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FingerprintIcon className="w-4 h-4 text-emerald-600" />
                        <span>Primary Touch *</span>
                      </span>
                      {finger1.isoTemplate && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Quality: {finger1.quality}%</span>
                        </span>
                      )}
                    </div>

                    {/* Name Selector */}
                    <select
                      value={finger1.fingerName}
                      onChange={(e) => setFinger1({ ...finger1, fingerName: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                    >
                      {FINGER_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>

                    {/* Primary Touch Preview */}
                    <div className="h-32 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center relative">
                      {finger1.bitmapData ? (
                        <img
                          src={finger1.bitmapData}
                          alt="Primary touch scan"
                          className="h-full object-contain filter contrast-125"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
                          <FingerprintIcon className="w-10 h-10 text-slate-600" />
                          <span className="text-[10px] font-mono">Not Enrolled Yet</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleScanFinger1}
                      disabled={isScanningFp1}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 cursor-pointer"
                    >
                      <FingerprintIcon className="w-4 h-4" />
                      <span>{isScanningFp1 ? 'Scanning on sensor...' : finger1.isoTemplate ? 'Rescan Primary Touch' : 'Scan Primary Touch'}</span>
                    </button>
                  </div>

                  {/* Backup Touch Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-2xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FingerprintIcon className="w-4 h-4 text-blue-600" />
                        <span>Backup Touch *</span>
                      </span>
                      {finger2.isoTemplate && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-300 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-blue-600" />
                          <span>Quality: {finger2.quality}%</span>
                        </span>
                      )}
                    </div>

                    {/* Name Selector */}
                    <select
                      value={finger2.fingerName}
                      onChange={(e) => setFinger2({ ...finger2, fingerName: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                    >
                      {FINGER_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>

                    {/* Backup Touch Preview */}
                    <div className="h-32 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center relative">
                      {finger2.bitmapData ? (
                        <img
                          src={finger2.bitmapData}
                          alt="Backup touch scan"
                          className="h-full object-contain filter contrast-125"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
                          <FingerprintIcon className="w-10 h-10 text-slate-600" />
                          <span className="text-[10px] font-mono">Not Enrolled Yet</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleScanFinger2}
                      disabled={isScanningFp2}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 cursor-pointer"
                    >
                      <FingerprintIcon className="w-4 h-4" />
                      <span>{isScanningFp2 ? 'Scanning on sensor...' : finger2.isoTemplate ? 'Rescan Backup Touch' : 'Scan Backup Touch'}</span>
                    </button>
                  </div>

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
              
              {/* Photo Retake & Preview Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-3">
                <div className="w-full flex items-center justify-between pb-1.5 border-b border-slate-200 text-slate-700">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>Personnel Photo</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {isEditCameraActive ? 'Camera Active' : 'Enrolled Photo'}
                  </span>
                </div>

                <div className="relative w-40 h-40 bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-slate-700">
                  {isEditCameraActive ? (
                    <>
                      <video
                        ref={editVideoRef}
                        playsInline
                        muted
                        autoPlay
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-4 border-2 border-dashed border-emerald-400 rounded-full pointer-events-none opacity-80 animate-pulse"></div>
                    </>
                  ) : (
                    <img
                      src={editingEmployee.photo}
                      alt={editingEmployee.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Retake Camera Controls */}
                <div className="w-full flex flex-col gap-2">
                  {isEditCameraActive ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={captureEditPhoto}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs flex items-center justify-center space-x-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Capture Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopEditCamera}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditCamera}
                      className="w-full py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl font-bold shadow-2xs flex items-center justify-center space-x-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                      <span>Retake Photo</span>
                    </button>
                  )}

                  <div className="flex items-center justify-center space-x-3 text-[11px] text-slate-500 pt-0.5">
                    <label className="cursor-pointer hover:text-emerald-700 underline flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEditFileUpload}
                        className="hidden"
                      />
                    </label>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleEditUseSamplePhoto}
                      className="hover:text-emerald-700 underline"
                    >
                      Sample Face
                    </button>
                  </div>

                  {editingEmployee.face_descriptor || editingEmployee.embedding ? (
                    <div className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5 text-center font-medium">
                      ✓ Personnel Enrolled
                    </div>
                  ) : (
                    <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 text-center font-medium">
                      Retake photo to generate 128D facial embeddings
                    </div>
                  )}
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
