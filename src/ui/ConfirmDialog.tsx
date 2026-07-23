import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmTone?: 'danger' | 'primary';
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDialog = ({
  title,
  message,
  cancelLabel,
  confirmLabel,
  confirmTone = 'danger',
  disabled = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) => (
  <div className="modal-backdrop modal-backdrop--confirm" role="presentation">
    <section
      className="confirm-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div className="confirm-modal__icon" aria-hidden="true">
        <AlertTriangle size={28} />
      </div>
      <div className="confirm-modal__copy">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-message">{message}</p>
      </div>
      <div className="confirm-modal__actions">
        <button type="button" className="text-button confirm-modal__cancel" disabled={disabled} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`${confirmTone === 'danger' ? 'danger-button' : 'primary-button'} confirm-modal__confirm`}
          disabled={disabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </section>
  </div>
);
