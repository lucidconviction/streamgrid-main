import React from 'react';
import { CheckCircle2, AlertCircle, Info, X, Radio, Play, LayoutGrid } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'live-alert';
  text: string;
  title?: string;
  streamId?: string;
  streamPoster?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm sm:max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const isLiveAlert = toast.type === 'live-alert';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 border ${
              isLiveAlert
                ? 'bg-[#121522] border-blue-500/80 shadow-blue-950/40 p-3.5'
                : 'bg-[#161a26] border-slate-700/80 p-3'
            }`}
          >
            {isLiveAlert ? (
              /* Rich Live Transition Toast */
              <div className="flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-600 text-white shrink-0 shadow-sm shadow-blue-600/40">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                    </span>
                    <div>
                      <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-blue-400">
                        Watchlist Stream Went Live!
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                        {toast.title || toast.text}
                      </h4>
                    </div>
                  </div>
                  <button
                    onClick={() => onDismiss(toast.id)}
                    className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
                    aria-label="Dismiss alert"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {toast.streamPoster && (
                  <div className="relative aspect-video w-full max-h-32 rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                    <img
                      src={toast.streamPoster}
                      alt={toast.title || 'Stream preview'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <span className="absolute bottom-1.5 left-2 text-[10px] font-mono text-blue-300 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                      BROADCASTING NOW
                    </span>
                  </div>
                )}

                {toast.title && <p className="text-xs text-slate-300 line-clamp-2">{toast.text}</p>}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  {toast.onAction && (
                    <button
                      onClick={() => {
                        toast.onAction?.();
                        onDismiss(toast.id);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>{toast.actionLabel || 'Watch Live'}</span>
                    </button>
                  )}

                  {toast.onSecondaryAction && (
                    <button
                      onClick={() => {
                        toast.onSecondaryAction?.();
                        onDismiss(toast.id);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                      <span>{toast.secondaryActionLabel || '+ Multiview'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Standard Notification */
              <div className="flex items-center justify-between gap-3 text-slate-100 text-sm">
                <div className="flex items-center gap-2.5">
                  {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {toast.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                  {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
                  <span className="font-medium text-xs sm:text-sm">{toast.text}</span>
                </div>
                <button
                  onClick={() => onDismiss(toast.id)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
