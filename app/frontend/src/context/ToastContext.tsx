import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Snackbar, Alert, Button, type AlertColor } from '@mui/material';

/** Optional inline action rendered in the toast (e.g. Undo). */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastContextType {
  success: (message: string, action?: ToastAction) => void;
  /** Used for destructive/removed actions (red), matching the surveys pattern. */
  error: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('success');
  const [action, setAction] = useState<ToastAction | null>(null);

  const show = useCallback((msg: string, sev: AlertColor, act?: ToastAction) => {
    setMessage(msg);
    setSeverity(sev);
    setAction(act ?? null);
    setOpen(true);
  }, []);

  const success = useCallback((msg: string, act?: ToastAction) => show(msg, 'success', act), [show]);
  const error = useCallback((msg: string, act?: ToastAction) => show(msg, 'error', act), [show]);

  // Stable identity: consumers list `toast` in effect deps, so a fresh object
  // per render would retrigger their fetches on every toast open/close.
  const value = useMemo(() => ({ success, error }), [success, error]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        // Toasts carrying an action (Undo) stay up longer so it can be hit.
        autoHideDuration={action ? 6000 : 4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {/* role="status" (polite live region) — success toasts confirm the
            user's own action; role="alert" would interrupt screen readers. */}
        <Alert
          onClose={() => setOpen(false)}
          severity={severity}
          variant="filled"
          role={severity === 'error' ? 'alert' : 'status'}
          sx={{ width: '100%', alignItems: 'center' }}
          action={
            action ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                sx={{ fontWeight: 700, textTransform: 'none' }}
              >
                {action.label}
              </Button>
            ) : undefined
          }
        >
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
