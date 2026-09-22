import React, { useState, useRef, useEffect } from 'react';
import type { Employee } from '../../types';
import { canteenService } from '../../services/canteenService';
import { soundEngine } from '../../services/soundEngine';
import { KitchenAnalyticsView } from '../analytics/KitchenAnalyticsView';
import {
  X,
  UserPlus,
  Users,
  Camera,
  CameraOff,
  SwitchCamera,
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
  Flame,
} from 'lucide-react';
import type { MealSlotConfig, MealSlotName } from '../../types';

import {
  faceMatcherService,
  findBestMatch,
  startCameraWithFacingMode,
} from '../../services/faceMatcherService';

interface AdminPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRosterUpdated?: () => void;
  onNavigateToStaffScanner?: () => void;
  onLogout?: () => void;
}

const DEPARTMENTS = ['Staff', 'Employee'];

export const AdminPortalModal: React.FC<AdminPortalModalProps> = ({
  isOpen,
  onClose,
  onRosterUpdated,
  onNavigateToStaffScanner,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'registered' | 'new' | 'analytics' | 'menu'>('registered');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'Employee' | 'Staff'>('ALL');

  // Menu and Serving Timings state
  const [adminMealSlots, setAdminMealSlots] = useState<MealSlotConfig[]>([]);
  const [activeAdminSlot, setActiveAdminSlot] = useState<MealSlotName>('Breakfast');
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

  // Camera capture state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isExtractingBiometric, setIsExtractingBiometric] = useState<boolean>(false);
  const [biometricStatus, setBiometricStatus] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEmployees = async () => {
    try {
      await canteenService.syncFromSupabase();
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

  // Start webcam with selected facing mode (front or rear tablet camera)
  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    try {
      setCameraError(null);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      // Wait 300ms for device hardware release
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (!videoRef.current) return;
      const result = await startCameraWithFacingMode(videoRef.current, mode);
      mediaStreamRef.current = result.stream;
      setIsCameraActive(true);
      setFacingMode(result.actualFacingMode);

      if (mode === 'environment' && result.actualFacingMode === 'user') {
        setCameraError('No rear camera detected on this device. Using front camera.');
      }
    } catch (err) {
      console.warn('Admin camera preview error:', err);
      setCameraError('Camera access denied or unavailable. You can use fallback photo or upload.');
      setIsCameraActive(false);
    }
  };

  const toggleFacingMode = async () => {
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      if (isCameraActive) {
        await startCamera(nextMode);
      } else {
        setFacingMode(nextMode);
      }
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Sync stream to video element whenever camera becomes active or mounts
  useEffect(() => {
    if (isCameraActive && videoRef.current && mediaStreamRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        videoRef.current.play().catch((e) => console.warn('Video play sync error:', e));
      }
    }
  }, [isCameraActive]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'new' || formData.photo) {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, activeTab, formData.photo]);



  // Take photo snapshot from video stream and compute 128D biometric descriptor
  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setBiometricStatus('⚠️ Camera is still loading. Please wait a moment and try again.');
      return;
    }

    setIsCapturing(true);
    soundEngine.playScannerBeep();

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw centered square crop with bias toward natural head height
      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const minDim = Math.min(vW, vH);
      const startX = Math.max(0, (vW - minDim) / 2);
      const startY = Math.max(0, (vH - minDim) / 3);
      ctx.save();
      // Only mirror crop when using front camera
      if (facingMode === 'user') {
        ctx.translate(400, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, 400, 400);
      ctx.restore();
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

      setIsExtractingBiometric(true);
      setBiometricStatus('Analyzing face & generating 128D embedding vector...');

      try {
        // First try extracting from the cropped avatar
        let descriptor = await faceMatcherService.extractDescriptorArray(canvas);

        // If not found in the crop (e.g. tablet aspect ratio), extract from full raw video directly
        if (!descriptor || descriptor.length !== 128) {
          descriptor = await faceMatcherService.extractDescriptorArray(video);
        }

        if (descriptor && descriptor.length === 128) {
          // Strict duplicate face check (threshold 0.44 catches same person with/without specs, avoids different people)
          const existingMatch = findBestMatch(descriptor, employees, 0.44);
          if (existingMatch) {
            setFormData((prev) => ({ ...prev, photo: '', face_descriptor: null }));
            const msg = `⚠️ Face Already Registered: Matches "${existingMatch.employee.name}" (${existingMatch.employee.id}) with ${existingMatch.accuracy}% match accuracy! Only one face for one ID is allowed.`;
            setBiometricStatus(msg);
            setErrorMessage(`Duplicate Face Error: This person is already registered as ${existingMatch.employee.name} (${existingMatch.employee.id}) with ${existingMatch.accuracy}% match accuracy!`);
            soundEngine.playWarningBuzzer();
            return;
          }

          setFormData((prev) => ({ ...prev, photo: dataUrl, face_descriptor: descriptor }));
          setBiometricStatus('✓ 128D Biometric Vector Enrolled (Unique Face Verified)');
          setErrorMessage(null);
        } else {
          setFormData((prev) => ({ ...prev, photo: '', face_descriptor: null }));
          setBiometricStatus('⚠️ No human face detected in photo. Please ensure face is centered and well lit.');
        }
      } catch (e) {
        console.warn('Biometric extraction error:', e);
        setFormData((prev) => ({ ...prev, photo: '', face_descriptor: null }));
        setBiometricStatus('⚠️ Could not extract face embedding.');
      } finally {
        setIsExtractingBiometric(false);
        stopCamera();
      }
    }
    setTimeout(() => setIsCapturing(false), 300);
  };

  // Generate random avatar fallback
  const handleUseSamplePhoto = async () => {
    const randomSeed = Math.floor(Math.random() * 1000);
    const photoUrl = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&sig=${randomSeed}`;
    setFormData((prev) => ({ ...prev, photo: photoUrl }));
    stopCamera();

    setIsExtractingBiometric(true);
    setBiometricStatus('Extracting facial embedding from sample photo...');
    try {
      const desc = await faceMatcherService.extractDescriptorArray(photoUrl);
      if (desc && desc.length === 128) {
        const existingMatch = findBestMatch(desc, employees, 0.44);
        if (existingMatch) {
          setFormData((prev) => ({ ...prev, photo: '', face_descriptor: null }));
          setBiometricStatus(`⚠️ Sample face already registered under "${existingMatch.employee.name}" (${existingMatch.accuracy}% accuracy).`);
          setErrorMessage(`Duplicate Face: Already registered under ${existingMatch.employee.name} with ${existingMatch.accuracy}% accuracy.`);
          soundEngine.playWarningBuzzer();
          return;
        }
        setFormData((prev) => ({ ...prev, face_descriptor: desc }));
        setBiometricStatus('✓ 128D Biometric Vector Enrolled');
        setErrorMessage(null);
      } else {
        setBiometricStatus('⚠️ Could not detect face in sample photo');
      }
    } catch {
      setBiometricStatus(null);
    } finally {
      setIsExtractingBiometric(false);
    }
  };

  // Helper to scale & compress uploaded images to max 400x400 JPEG (~30KB)
  const compressImage = (dataUrl: string, maxDim = 400): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // File Upload fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const rawDataUrl = String(event.target.result);
          const dataUrl = await compressImage(rawDataUrl);
          setFormData((prev) => ({ ...prev, photo: dataUrl, face_descriptor: null }));
          stopCamera();

          setIsExtractingBiometric(true);
          setBiometricStatus('Analyzing face & generating 128D embedding vector...');
          setErrorMessage(null);

          try {
            const desc = await faceMatcherService.extractDescriptorArray(dataUrl);
            if (desc && desc.length === 128) {
              // Check for duplicate face against already registered employees (threshold 0.44)
              const existingMatch = findBestMatch(desc, employees, 0.44);
              if (existingMatch) {
                setFormData((prev) => ({ ...prev, photo: '', face_descriptor: null }));
                const msg = `⚠️ Face Already Registered: Uploaded photo matches "${existingMatch.employee.name}" (${existingMatch.employee.id}) with ${existingMatch.accuracy}% match accuracy! Only one face for one ID is allowed.`;
                setBiometricStatus(msg);
                setErrorMessage(`Duplicate Face Error: This person is already registered as ${existingMatch.employee.name} (${existingMatch.employee.id}) with ${existingMatch.accuracy}% match accuracy!`);
                soundEngine.playWarningBuzzer();
                return;
              }

              setFormData((prev) => ({ ...prev, photo: dataUrl, face_descriptor: desc }));
              setBiometricStatus('✓ 128D Biometric Vector Enrolled (Unique Face Verified)');
              setErrorMessage(null);
            } else {
              setFormData((prev) => ({ ...prev, photo: '', face_descriptor: null }));
              setBiometricStatus('⚠️ No human face detected in uploaded file.');
              setErrorMessage('No human face detected. Please upload a clear, front-facing portrait.');
              soundEngine.playWarningBuzzer();
            }
          } catch {
            setBiometricStatus('⚠️ Biometric extraction failed');
          } finally {
            setIsExtractingBiometric(false);
          }
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset file input so re-uploading the same file still triggers onChange
    e.target.value = '';
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

  // Submit New Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!formData.name.trim()) {
      setErrorMessage('Please enter Full Name.');
      return;
    }
    if (!formData.id.trim()) {
      setErrorMessage('Please enter an Employee/Staff ID.');
      return;
    }
    if (!formData.photo) {
      setErrorMessage('Please capture or upload a photo for biometric face recognition.');
      return;
    }

    // Safety Check 1: Prevent duplicate ID
    const existingIdMatch = employees.find(
      (emp) => emp.id.toUpperCase() === formData.id.trim().toUpperCase()
    );
    if (existingIdMatch) {
      soundEngine.playWarningBuzzer();
      setErrorMessage(`ID Conflict: Employee ID "${formData.id.trim().toUpperCase()}" is already registered to ${existingIdMatch.name}.`);
      return;
    }

    // Safety Check 2: Require valid biometric descriptor & prevent duplicate face
    if (!formData.face_descriptor || formData.face_descriptor.length !== 128) {
      soundEngine.playWarningBuzzer();
      setErrorMessage('Biometric Requirement: A valid human face must be detected before registration. Please capture or upload a clear photo.');
      return;
    }

    const duplicateFaceMatch = findBestMatch(formData.face_descriptor, employees, 0.44);
    if (duplicateFaceMatch) {
      soundEngine.playWarningBuzzer();
      setErrorMessage(`Duplicate Face Error: This face is already registered under "${duplicateFaceMatch.employee.name}" (${duplicateFaceMatch.employee.id}) with ${duplicateFaceMatch.accuracy}% match accuracy! Only one face for one ID is allowed.`);
      return;
    }

    try {
      const role: 'Staff' | 'Employee' = formData.dept.toLowerCase().includes('staff') ? 'Staff' : 'Employee';

      const newEmployee: Employee = {
        id: formData.id.trim().toUpperCase(),
        name: formData.name.trim(),
        dept: formData.dept,
        photo: formData.photo,
        confidence: 0.985,
        subsidyRate: 1.0,
        role,
        face_descriptor: formData.face_descriptor,
        embedding: formData.face_descriptor,
      };

      await canteenService.addEmployee(newEmployee);
      soundEngine.playVerificationChime();
      setSuccessMessage(`Successfully registered ${newEmployee.name} (${newEmployee.id})! Redirecting to camera scan...`);
      loadEmployees();
      if (onRosterUpdated) onRosterUpdated();

      // Reset form
      setFormData({
        id: '',
        name: '',
        dept: 'Employee',
        photo: '',
        face_descriptor: null,
      });
      setBiometricStatus(null);

      // Redirect immediately to the camera scanning page!
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: unknown) {
      soundEngine.playWarningBuzzer();
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setErrorMessage(msg);
    }
  };

  // Delete Employee
  const handleDeleteEmployee = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name} (${id}) from the biometric roster?`)) {
      try {
        await canteenService.deleteEmployee(id);
        soundEngine.playWarningBuzzer();
        loadEmployees();
        if (onRosterUpdated) onRosterUpdated();
      } catch (err) {
        console.error('Delete employee error:', err);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-modal flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm shadow-emerald-600/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Canteen Administration Portal
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                  Biometric Manager
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage registered cafeteria personnel or enroll new staff and employees.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-2xs active:scale-95"
                title="Lock Admin Portal and Logout"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock & Logout</span>
              </button>
            )}

            {onNavigateToStaffScanner && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToStaffScanner();
                }}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-xs font-bold transition-all shadow-2xs active:scale-95"
                title="Switch to Counter Scanner Station"
              >
                <Scan className="w-3.5 h-3.5 text-emerald-600" />
                <span>Counter Station</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-slate-100 bg-white">
          <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => {
                setActiveTab('registered');
                stopCamera();
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'registered'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Registered Users ({employees.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('new');
                loadEmployees();
                if (!formData.id) {
                  setFormData((prev) => ({
                    ...prev,
                    id: `EMP-${1000 + employees.length + 1}`,
                  }));
                }
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'new'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>New Registration</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('analytics');
                stopCamera();
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Kitchen Analytics</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('menu');
                stopCamera();
                setAdminMealSlots(canteenService.getMealSlots());
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'menu'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Menu & Timings</span>
            </button>
          </div>

          <div className="hidden sm:block text-xs text-slate-400 font-medium">
            Active Roster Sync • Central Terminal Link
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* ============================================================= */}
          {/* TAB 1: REGISTERED USERS                                       */}
          {/* ============================================================= */}
          {activeTab === 'registered' && (
            <div className="space-y-4">
              
              {/* Search & Filter Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Name, Employee ID, or Department..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
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
                      Your Supabase database and canteen roster are clean with zero dummy data. Click below to register your first user with 128D AI facial biometrics!
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('new')}
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
                          <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                            Face Match Confidence: {(emp.confidence * 100).toFixed(1)}%
                          </p>
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
          {/* TAB 2: NEW REGISTRATION (WITH LIVE IMAGE CAPTURE)             */}
          {/* ============================================================= */}
          {activeTab === 'new' && (
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

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* LEFT: Camera Face Image Capture (5 cols) */}
                <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-3 text-center">
                  <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <span>Biometric Face Capture</span>
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      isCameraActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                      {isCameraActive ? 'Live Stream Active' : 'Camera Standby'}
                    </span>
                  </div>

                  {/* Video Viewport or Captured Snapshot Preview */}
                  <div className="relative w-56 h-56 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-slate-700 bg-slate-900">
                    {/* Always keep video element mounted in DOM to guarantee ref attachment */}
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
                      onCanPlay={() => videoRef.current?.play().catch(() => {})}
                      className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${
                        facingMode === 'user' ? 'mirror' : ''
                      } ${isCameraActive && !formData.photo ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}
                    />

                    {formData.photo ? (
                      <img
                        src={formData.photo}
                        alt="Captured face"
                        className="w-full h-full object-cover z-10"
                      />
                    ) : !isCameraActive ? (
                      /* Camera Closed Placeholder with Open Camera button */
                      <div className="flex flex-col items-center justify-center p-3 text-center z-10">
                        <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-1.5 shadow-inner">
                          <CameraOff className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-200">Camera is Closed</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 mb-2.5 font-sans">
                          Current mode: <span className="font-semibold text-emerald-400">{facingMode === 'user' ? 'Front Camera' : 'Back Camera'}</span>
                        </p>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => startCamera(facingMode)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold shadow-md shadow-emerald-600/30 flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Open Camera</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = facingMode === 'user' ? 'environment' : 'user';
                              setFacingMode(next);
                            }}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-medium border border-slate-700 flex items-center space-x-1 transition-all cursor-pointer"
                            title="Switch camera mode before opening"
                          >
                            <SwitchCamera className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{facingMode === 'user' ? 'Use Back Cam' : 'Use Front Cam'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Top-Left Corner: Button to Switch between Front and Rear Camera */}
                        <div className="absolute top-2 left-2 z-30 flex items-center space-x-1.5">
                          <button
                            type="button"
                            disabled={isSwitchingCamera}
                            onClick={toggleFacingMode}
                            title={facingMode === 'user' ? 'Switch to Rear/Back Camera' : 'Switch to Front Camera'}
                            className="px-2.5 py-1 bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold shadow-md flex items-center space-x-1 border border-slate-600 backdrop-blur-xs transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                          >
                            <SwitchCamera className={`w-3 h-3 text-emerald-400 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
                            <span>{isSwitchingCamera ? 'Switching...' : facingMode === 'user' ? 'Back Cam' : 'Front Cam'}</span>
                          </button>
                        </div>

                        {/* Static framing guideline circle (no auto-scanning) */}
                        <div className="absolute inset-4 rounded-full border-2 border-dashed border-white/45 pointer-events-none z-20 flex items-end justify-center pb-2.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] font-medium text-white/90">
                            Position face in circle
                          </span>
                        </div>
                      </>
                    )}

                    {/* Shutter flash animation */}
                    {isCapturing && (
                      <div className="absolute inset-0 bg-white animate-out fade-out duration-300"></div>
                    )}
                  </div>

                  {/* Camera Actions */}
                  <div className="w-full flex flex-col gap-2">
                    {formData.photo ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, photo: '', face_descriptor: null }));
                          startCamera(facingMode);
                        }}
                        className="w-full py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                        <span>Retake / Clear Photo</span>
                      </button>
                    ) : isCameraActive ? (
                      <>
                        {/* Capture Photo Button */}
                        <button
                          type="button"
                          onClick={capturePhoto}
                          disabled={isCapturing || isExtractingBiometric}
                          className="w-full py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-2 transition-transform active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer disabled:opacity-60"
                          title="Capture face photo"
                        >
                          <Camera className="w-4 h-4" />
                          <span>
                            {isCapturing || isExtractingBiometric ? 'Capturing Biometrics...' : 'Capture Photo'}
                          </span>
                        </button>

                        {/* Down of Capture button: Turn Off Camera Button */}
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
                          title="Turn off camera"
                        >
                          <CameraOff className="w-3.5 h-3.5" />
                          <span>Turn Off Camera</span>
                        </button>
                      </>
                    ) : (
                      /* Open Camera Button when camera is off */
                      <button
                        type="button"
                        onClick={() => startCamera(facingMode)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Open Camera</span>
                      </button>
                    )}

                    {/* Prominent Upload & Detect Face Button */}
                    <label
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95"
                      title="Upload photo from device to detect face and enroll 128D biometrics"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Upload & Detect Face</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-500 pt-0.5">
                      <button
                        type="button"
                        onClick={handleUseSamplePhoto}
                        className="hover:text-emerald-700 underline cursor-pointer"
                      >
                        Sample Face
                      </button>
                    </div>

                    {isExtractingBiometric && (
                      <div className="w-full py-1.5 px-3 bg-blue-50 border border-blue-200 rounded-xl text-[10px] font-semibold text-blue-700 flex items-center justify-center gap-1.5 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                        <span>Extracting 128D facial embeddings...</span>
                      </div>
                    )}

                    {biometricStatus && !isExtractingBiometric && (
                      <div
                        className={`w-full py-1 px-2.5 rounded-xl text-[10px] font-semibold text-center border ${
                          biometricStatus.startsWith('✓')
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-amber-50 border-amber-300 text-amber-800'
                        }`}
                      >
                        {biometricStatus}
                      </div>
                    )}

                    {cameraError && (
                      <p className="text-[10px] text-amber-600 leading-tight">
                        {cameraError}
                      </p>
                    )}
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
                      <span>Register & Enroll Biometrics</span>
                    </button>
                  </div>

                </div>

              </div>

            </form>
          )}

          {/* ============================================================= */}
          {/* TAB 3: KITCHEN ANALYTICS & OPERATIONS                         */}
          {/* ============================================================= */}
          {activeTab === 'analytics' && (
            <div className="py-1">
              <KitchenAnalyticsView />
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

                const handleSaveMenu = () => {
                  canteenService.updateMealSlots(adminMealSlots);
                  soundEngine.playVerificationChime();
                  setIsMenuSavedToast(true);
                  setTimeout(() => setIsMenuSavedToast(false), 3000);
                };

                const quickTamilDishes: Record<string, string[]> = {
                  Breakfast: ['இட்லி, சாம்பார், சட்னி', 'மெதுவடை', 'பொங்கல்', 'மசால் தோசை', 'ஃபில்டர் காபி'],
                  Lunch: ['சாம்பார் சாதம்', 'காய்கறி கூட்டு, பொரியல்', 'ரசம், மோர்', 'சப்பாத்தி குருமா', 'பாயாசம்'],
                  'Tea or Coffee': ['ஸ்பெஷல் மசாலா டீ', 'ஃபில்டர் காபி', 'சுக்கு காபி', 'பிஸ்கட்'],
                  Snacks: ['வெங்காய பக்கோடா', 'சூடான சமோசா', 'மெது பஜ்ஜி', 'புதினா சட்னி', 'கார மிக்சர்'],
                  Dinner: ['சப்பாத்தி, தட்கா தால்', 'வெஜ் பிரியாணி', 'தோசை, குருமா', 'ஜீரா ரைஸ்', 'தயிர் சாதம்'],
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

                    {/* Calories & Save Button */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center space-x-2 text-xs font-bold text-slate-600">
                        <Flame className="w-4 h-4 text-amber-500" />
                        <span>Approx. Nutrition:</span>
                        <input
                          type="number"
                          value={currentSlot.calories || 400}
                          onChange={(e) => updateCurrent('calories', parseInt(e.target.value, 10) || 0)}
                          className="w-18 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 text-right"
                        />
                        <span className="font-mono text-[11px]">kcal</span>
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

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Smart Canteen OS • Central Management & Operations</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
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
                    <span>Biometric Face Photo</span>
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
                      ✓ 128D Biometrics Enrolled
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
