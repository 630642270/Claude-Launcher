interface FieldProps {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  hint,
  className,
  children,
}: FieldProps): React.JSX.Element {
  return (
    <label className={`field ${className ?? ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}