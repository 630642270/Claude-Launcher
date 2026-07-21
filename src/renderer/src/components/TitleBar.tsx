interface TitleBarProps {
  title: string;
  showMinimize?: boolean;
  /** 提供时替代默认的关闭窗口行为（例如拦截未保存更改） */
  onClose?: () => void;
}

export function TitleBar({
  title,
  showMinimize = true,
  onClose,
}: TitleBarProps): React.JSX.Element {
  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <span className="titlebar-icon" aria-hidden="true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </span>
        <span className="titlebar-title">{title}</span>
      </div>
      <div className="titlebar-controls">
        {showMinimize && (
          <button
            type="button"
            className="titlebar-btn"
            aria-label="最小化"
            onClick={() => void window.launcher.minimizeWindow()}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="titlebar-btn titlebar-btn-close"
          aria-label="关闭"
          onClick={() =>
            onClose ? onClose() : void window.launcher.closeWindow()
          }
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
