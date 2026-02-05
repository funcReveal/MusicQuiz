type AnswerPanelProps = {
  title: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  maxLength?: number;
};

const AnswerPanel = ({
  title,
  value,
  placeholder,
  onChange,
  disabled,
  hint,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  maxLength,
}: AnswerPanelProps) => {
  const lengthHint =
    typeof maxLength === "number" ? `${value.length}/${maxLength}` : null;
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-2.5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.8)] space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
          {title}
        </div>
        <div className="flex items-center gap-1.5">
          {secondaryActionLabel && onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              disabled={disabled}
              className="rounded-full border border-slate-700/80 px-2 py-0.5 text-[9px] text-slate-300 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {secondaryActionLabel}
            </button>
          ) : null}
          {primaryActionLabel && onPrimaryAction ? (
            <button
              type="button"
              onClick={onPrimaryAction}
              disabled={disabled}
              className="rounded-full border border-sky-500/60 bg-sky-500/10 px-2 py-0.5 text-[9px] text-sky-200 hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {primaryActionLabel}
            </button>
          ) : null}
        </div>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>{hint}</span>
        {lengthHint ? <span>{lengthHint}</span> : null}
      </div>
    </div>
  );
};

export default AnswerPanel;
