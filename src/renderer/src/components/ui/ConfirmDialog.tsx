import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 主题化确认弹窗。打开时焦点落在取消按钮上（危险操作的安全默认值），
 * Esc 取消，Enter/Space 触发当前焦点按钮。
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element | null {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    cancelRef.current?.focus();

    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          {danger && (
            <span className="modal-icon modal-icon-danger" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
          )}
          <h3 className="modal-title" id={titleId}>
            {title}
          </h3>
        </div>
        <div className="modal-message">{message}</div>
        <div className="modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}