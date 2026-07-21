interface SpinnerProps {
  label?: string;
  large?: boolean;
}

export function Spinner({ label, large = false }: SpinnerProps): React.JSX.Element {
  return (
    <div className="spinner-block" role="status" aria-live="polite">
      <span
        className={`spinner ${large ? "spinner-lg" : ""}`}
        aria-hidden="true"
      />
      {label && <span className="spinner-label">{label}</span>}
    </div>
  );
}