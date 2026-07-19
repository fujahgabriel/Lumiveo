import { useId } from "react";

interface SwitchProps {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function Switch({ checked, onToggle, disabled, children }: SwitchProps) {
  const id = useId();
  return (
    <label className={`native-switch${disabled ? " disabled" : ""}`} htmlFor={id}>
      <span className="native-switch-label">{children}</span>
      <span className="native-switch-track">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={disabled ? undefined : onToggle}
          className="native-switch-input"
        />
        <span className="native-switch-thumb" />
      </span>
    </label>
  );
}
