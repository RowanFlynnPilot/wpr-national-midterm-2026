/** The panel's step back: to the state from a race or county, to the overview from a state. */
export function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="back" onClick={onClick}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10 3L5 8l5 5" />
      </svg>
      {label}
    </button>
  );
}
