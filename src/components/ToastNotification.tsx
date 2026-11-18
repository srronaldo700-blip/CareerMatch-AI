import React, { useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { RankedJobResult } from '../shared/types';

export interface JobToastItem {
  id: string;
  title: string;
  subtitle: string;
  relevanceScore?: number;
  rankedJob?: RankedJobResult;
}

interface ToastNotificationStackProps {
  toasts: JobToastItem[];
  onDismiss: (id: string) => void;
  onInspectJob?: (item: RankedJobResult) => void;
}

function SingleToast({
  toast,
  onDismiss,
  onInspectJob,
}: {
  toast: JobToastItem;
  onDismiss: (id: string) => void;
  onInspectJob?: (item: RankedJobResult) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 7500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-88 max-w-[calc(100vw-2rem)] bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl shadow-lg p-4 flex items-start gap-3 transition-all duration-200"
    >
      <div className="p-2 rounded-lg bg-[#EFF6FF] text-[#2563EB] shrink-0">
        <Bell className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[#2563EB]">New Matching Job Indexed</p>
          {typeof toast.relevanceScore === 'number' && (
            <span className="font-mono text-xs font-semibold text-[#0F172A] tabular-nums">
              {toast.relevanceScore}/100
            </span>
          )}
        </div>
        <p className="font-display text-sm font-semibold text-[#0F172A] mt-0.5 truncate">
          {toast.title}
        </p>
        <p className="text-xs text-[#64748B] mt-0.5 truncate">{toast.subtitle}</p>

        {toast.rankedJob && onInspectJob && (
          <button
            type="button"
            onClick={() => {
              onInspectJob(toast.rankedJob!);
              onDismiss(toast.id);
            }}
            className="mt-2 text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
          >
            Inspect Match Details
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="p-1 text-[#94A3B8] hover:text-[#0F172A] rounded transition-colors cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastNotificationStack({
  toasts,
  onDismiss,
  onInspectJob,
}: ToastNotificationStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 items-end">
      {toasts.map((toast) => (
        <SingleToast
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onInspectJob={onInspectJob}
        />
      ))}
    </div>
  );
}
