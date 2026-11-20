import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X, WifiOff } from 'lucide-react';
import { canPromptInstall, isIos, isStandalone, promptInstall, subscribePwa } from '../../lib/adminPwa.ts';

interface Props {
  lang: string;
  variant?: 'login' | 'header';
}

/** "Ku dejiso App-ka" — shown only when the admin app can be installed and isn't already. */
export const AdminInstallButton: React.FC<Props> = ({ lang, variant = 'header' }) => {
  const so = lang === 'so';
  const [, force] = useState(0);
  const [standalone, setStandalone] = useState(isStandalone());
  const [iosHelp, setIosHelp] = useState(false);
  const ios = isIos();

  useEffect(() => {
    const unsub = subscribePwa(() => force((n) => n + 1));
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const onChange = () => setStandalone(isStandalone());
    mq?.addEventListener?.('change', onChange);
    window.addEventListener('appinstalled', onChange);
    return () => {
      unsub();
      mq?.removeEventListener?.('change', onChange);
      window.removeEventListener('appinstalled', onChange);
    };
  }, []);

  if (standalone) return null;
  if (!ios && !canPromptInstall()) return null;

  const label = so ? 'Ku dejiso App-ka' : 'Install app';
  const onClick = async () => {
    if (ios) {
      setIosHelp(true);
      return;
    }
    await promptInstall();
    setStandalone(isStandalone());
  };

  return (
    <>
      {variant === 'login' ? (
        <button type="button" onClick={onClick} className="erp-btn erp-btn-ghost w-full justify-center py-3 mt-4">
          <Download className="w-4 h-4" /> {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={onClick}
          title={label}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-[13px] font-semibold text-[#0151B9] bg-[#0151B9]/10 hover:bg-[#0151B9]/15 cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      )}

      {iosHelp && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setIosHelp(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl text-[#0B1F3A]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src="/admin-icons/icon-192.png" alt="SOORAR" className="w-12 h-12 rounded-xl border border-slate-200" />
                <div>
                  <div className="font-bold">{label}</div>
                  <div className="text-xs text-slate-500">iPhone / iPad (Safari)</div>
                </div>
              </div>
              <button type="button" onClick={() => setIosHelp(false)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#0151B9] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                <span>{so ? 'Ku fur bogga Safari, kadibna taabo' : 'Open this page in Safari and tap'} <Share className="inline w-4 h-4 text-[#0151B9] -mt-0.5" /> <b>{so ? 'Share (La wadaag)' : 'Share'}</b></span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#0151B9] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <span>{so ? 'Dooro' : 'Choose'} <PlusSquare className="inline w-4 h-4 text-[#0151B9] -mt-0.5" /> <b>Add to Home Screen</b></span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#0151B9] text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                <span>{so ? 'Taabo "Add" — SOORAR ayaa ka soo muuqan doona shaashadda.' : 'Tap "Add" — SOORAR appears on your home screen.'}</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
};

/** Small banner shown in the admin app while the device is offline. */
export const AdminOfflineNotice: React.FC<{ lang: string }> = ({ lang }) => {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="no-print fixed bottom-3 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B1F3A] text-white text-sm font-medium shadow-lg">
      <WifiOff className="w-4 h-4 text-[#F1980A]" />
      {lang === 'so' ? 'Internet ma jiro — xogta cusub lama soo dejin karo.' : 'You are offline — live data cannot load.'}
    </div>
  );
};
