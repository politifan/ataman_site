import { useEffect, useMemo, useRef, useState } from "react";

export default function AdminSelect({
  value,
  onChange,
  options,
  placeholder = "Выберите значение",
  disabled = false
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  const normalizedOptions = Array.isArray(options) ? options : [];
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((option) => String(option.value) === String(value)) || null;
  }, [normalizedOptions, value]);

  useEffect(() => {
    function onDocumentMouseDown(event) {
      if (!rootRef.current || rootRef.current.contains(event.target)) return;
      setOpen(false);
    }

    function onDocumentKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, []);

  function pick(nextValue) {
    onChange?.(nextValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`admin-select ${open ? "is-open" : ""} ${disabled ? "is-disabled" : ""}`}>
      <button
        type="button"
        className="admin-select-trigger"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <span className="admin-select-caret" aria-hidden="true">▾</span>
      </button>

      {open ? (
        <div className="admin-select-menu" role="listbox">
          {normalizedOptions.map((option) => {
            const isSelected = String(option.value) === String(value);
            return (
              <button
                key={`${option.value}`}
                type="button"
                className={`admin-select-option ${isSelected ? "is-selected" : ""}`}
                onClick={() => !option.disabled && pick(option.value)}
                disabled={Boolean(option.disabled)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
