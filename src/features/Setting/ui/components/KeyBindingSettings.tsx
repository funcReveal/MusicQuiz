import React, { useMemo } from "react";
import type { KeyBindings } from "./useKeyBindings";

interface KeyBindingSettingsProps {
  keyBindings: KeyBindings;
  onChange: (next: KeyBindings) => void;
}

const KeyBindingSettings: React.FC<KeyBindingSettingsProps> = ({
  keyBindings,
  onChange,
}) => {
  const labels = useMemo(() => ["??", "??", "??", "??"], []);

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-200 sm:grid-cols-4">
      {labels.map((label, idx) => (
        <div
          key={label}
          className="flex items-center gap-1 rounded border border-slate-800/70 bg-slate-950/50 px-2 py-1"
        >
          <span className="text-[11px] text-slate-400">{label}</span>
          <input
            aria-label={`${label} ??`}
            value={(keyBindings[idx] ?? "").toUpperCase()}
            maxLength={1}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              onChange({ ...keyBindings, [idx]: val || keyBindings[idx] || "" });
            }}
            className="w-10 rounded border border-slate-700 bg-slate-900 px-1 text-center text-sm text-slate-100"
          />
        </div>
      ))}
    </div>
  );
};

export default KeyBindingSettings;
