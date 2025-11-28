import React from "react";

interface UsernameStepProps {
  usernameInput: string;
  onInputChange: (value: string) => void;
  onConfirm: () => void;
}

const UsernameStep: React.FC<UsernameStepProps> = ({
  usernameInput,
  onInputChange,
  onConfirm,
}) => (
  <div className="border border-slate-700 rounded-xl p-4 bg-slate-900/70 shadow-inner shadow-slate-900/80 mb-2">
    <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold">
        1
      </span>
      請先設定你的暱稱
    </h2>
    <div className="flex gap-2">
      <input
        className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-500/60"
        placeholder="例如：Hikari..."
        value={usernameInput}
        onChange={(e) => onInputChange(e.target.value)}
      />
      <button
        onClick={onConfirm}
        className="cursor-pointer px-4 py-2 text-sm rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium shadow-sm shadow-sky-900/60 transition-colors"
      >
        Confirm
      </button>
    </div>
    <p className="text-xs text-slate-400 mt-2">
      You need a username before creating or joining rooms.
    </p>
  </div>
);

export default UsernameStep;
