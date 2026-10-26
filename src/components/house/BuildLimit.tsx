/** "Build limit [|||||     ] 5/54 (9%)": how full the room or yard is. */
export function BuildLimit({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <span className={`build-limit${pct >= 100 ? " is-full" : pct >= 80 ? " is-near" : ""}`} title={`${used} of ${max} pieces placed`}>
      <span className="build-limit-label">{label}</span>
      <span className="build-limit-bar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={used} aria-label={label}>
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="build-limit-count">
        {used}/{max} ({pct}%)
      </span>
    </span>
  );
}
