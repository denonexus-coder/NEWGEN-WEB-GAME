import React, { useState } from 'react';
import { Smartphone, CheckCircle2, ShieldCheck, X, Download } from 'lucide-react';

interface ApkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkExportModal: React.FC<ApkExportModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const manifestDetails = {
    package: 'org.newgen.egoists',
    appName: 'NEWGEN NEWS EGOISTS',
    version: '1.0.0',
    targetSdk: 'Android 35',
    architectures: 'ARM64, ARMv7',
    artifactName: 'build/NEWGEN-NEWS-EGOISTS-unsigned.apk',
  };

  const handleCopyConfig = () => {
    navigator.clipboard?.writeText(JSON.stringify(manifestDetails, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Smartphone className="w-5 h-5" />
            <h2 className="text-lg font-black tracking-wider text-white">ANDROID APK & MOBILE BUILD</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>
            Fully optimized for mobile touchscreens with virtual 360° joystick, action buttons diamond, and adaptive landscape ratio.
          </span>
        </div>

        {/* APK Spec Sheet */}
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between py-1.5 border-b border-slate-800">
            <span className="text-slate-400">Package Name</span>
            <span className="font-mono text-cyan-300 font-bold">{manifestDetails.package}</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-800">
            <span className="text-slate-400">App Name</span>
            <span className="font-bold text-slate-200">{manifestDetails.appName}</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-800">
            <span className="text-slate-400">Target SDK</span>
            <span className="text-slate-200">{manifestDetails.targetSdk}</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-800">
            <span className="text-slate-400">ABIs Supported</span>
            <span className="text-slate-200">{manifestDetails.architectures}</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-800">
            <span className="text-slate-400">Target APK Artifact</span>
            <span className="font-mono text-emerald-300 font-bold">{manifestDetails.artifactName}</span>
          </div>
        </div>

        {/* Mobile Installation Methods */}
        <div className="mt-5 p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
          <span className="font-bold text-white block uppercase tracking-wider text-[11px]">
            Direct Play on Android:
          </span>
          <p>
            1. Open Chrome on your Android phone and load the app URL.
          </p>
          <p>
            2. Tap <strong>⋮ (Menu) &rarr; &ldquo;Add to Home screen&rdquo; / &ldquo;Install app&rdquo;</strong> to launch in true full-screen native standalone mode with zero browser bars.
          </p>
          <p>
            3. Enjoy full 60 FPS hardware-accelerated 3D football with low-latency touch controls!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleCopyConfig}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4 text-cyan-400" />}
            {copied ? 'COPIED CONFIG' : 'COPY APK METADATA'}
          </button>
          <button
            onClick={onClose}
            className="py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs tracking-wider shadow-lg shadow-emerald-900/50"
          >
            PLAY NOW
          </button>
        </div>
      </div>
    </div>
  );
};
