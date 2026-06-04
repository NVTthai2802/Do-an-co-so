"use client";

const digits = Array.from({ length: 10 }, (_, index) => index);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hasValidUnit(base, min, max) {
  return digits.some((unit) => base + unit >= min && base + unit <= max);
}

export default function CompactNumberPicker({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
  formatValue = (number) => number,
  className = "",
}) {
  const baseOptions = Array.from({ length: Math.floor(max / 10) + 1 }, (_, index) => index * 10);
  const currentBase = Math.floor(value / 10) * 10;
  const currentUnit = value % 10;

  function chooseBase(base) {
    const nextValue = clamp(base + currentUnit, min, max);
    onChange(nextValue);
  }

  function chooseUnit(unit) {
    const nextValue = clamp(currentBase + unit, min, max);
    onChange(nextValue);
  }

  return (
    <div className={`compact-number-picker ${className}`}>
      <div className="compact-number-head">
        <span>{label}</span>
        <strong>{formatValue(value)}</strong>
      </div>

      <div className="compact-number-group">
        <span>Chục</span>
        <div className="compact-number-buttons">
          {baseOptions.map((base) => (
            <button
              key={base}
              type="button"
              className={`compact-number-button ${currentBase === base ? "active" : ""}`}
              disabled={!hasValidUnit(base, min, max)}
              onClick={() => chooseBase(base)}
            >
              {base}
            </button>
          ))}
        </div>
      </div>

      <div className="compact-number-group">
        <span>Đơn vị</span>
        <div className="compact-number-buttons">
          {digits.map((unit) => {
            const candidate = currentBase + unit;
            const disabled = candidate < min || candidate > max;
            return (
              <button
                key={unit}
                type="button"
                className={`compact-number-button ${currentUnit === unit ? "active" : ""}`}
                disabled={disabled}
                onClick={() => chooseUnit(unit)}
              >
                {unit}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
