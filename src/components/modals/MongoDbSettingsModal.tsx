import React, { useState, useEffect } from 'react';
import { X, Database, RefreshCw, CheckCircle2, AlertCircle, HardDrive, Server, Layers } from 'lucide-react';
import { apiClient, type DbStatusInfo } from '../../services/apiClient';

interface MongoDbSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

export const MongoDbSettingsModal: React.FC<MongoDbSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [status, setStatus] = useState<DbStatusInfo>({
    isConnected: false,
    readyState: 0,
    host: '127.0.0.1',
    name: 'canteen_db',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const s = await apiClient.getDbStatus();
      setStatus(s);
      if (onConfigChanged) onConfigChanged();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-modal overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-2xl text-white shadow-sm ${
              status.isConnected ? 'bg-emerald-600 shadow-emerald-600/30' : 'bg-rose-600 shadow-rose-600/30'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-base">
                  MongoDB Database Console
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  status.isConnected
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}>
                  {status.isConnected ? '● Connected' : '○ Offline / Local Cache'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                MongoDB Document Collections & Connection Telemetry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Status Alert Banner */}
          {status.isConnected ? (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-xs text-emerald-950">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block">MongoDB Connected & Synchronized</span>
                <span className="text-emerald-700 font-mono text-[11px]">
                  Database: <strong>{status.name}</strong> • Host: {status.host}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-start space-x-3 text-xs text-amber-950">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Running in Offline-First Local Cache Mode</span>
                <span className="text-amber-800 text-[11px] block mt-0.5">
                  Start the MongoDB server with <code>npm run server</code> or run <code>mongod</code>. All canteen data is safely cached in localStorage and will synchronize upon reconnection.
                </span>
              </div>
            </div>
          )}

          {/* MongoDB Connection Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-600" />
              <span>Connection Parameters</span>
            </span>

            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[10px] block font-sans">Database Name</span>
                <span className="font-bold text-slate-800">{status.name || 'canteen_db'}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[10px] block font-sans">Database Host</span>
                <span className="font-bold text-slate-800">{status.host || '127.0.0.1:27017'}</span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-[11px]">
              <span className="text-slate-400 text-[10px] block font-sans">Active Connection URI</span>
              <span className="text-slate-700 font-bold break-all">
                {status.uri || 'mongodb://127.0.0.1:27017/canteen_db'}
              </span>
            </div>
          </div>

          {/* Collection Counts */}
          {status.counts && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>MongoDB Collections Record Count</span>
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">employees</span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {status.counts.employees ?? 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">orders</span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {status.counts.orders ?? 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">mealslots</span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {status.counts.mealSlots ?? 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">foodtransports</span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {status.counts.foodTransports ?? 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">feedbacks</span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {status.counts.feedbacks ?? 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick CLI Import Tip */}
          <div className="p-3 bg-slate-100 rounded-2xl text-[11px] text-slate-700 space-y-1">
            <span className="font-bold flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-emerald-600" />
              <span>How to Import Biometric Faces into MongoDB:</span>
            </span>
            <p className="font-mono text-[10px] text-emerald-800 bg-white p-2 rounded-lg border border-slate-200 select-all">
              npm run db:import
            </p>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={fetchStatus}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-all shadow-2xs flex items-center space-x-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Checking...' : 'Check Connection'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
