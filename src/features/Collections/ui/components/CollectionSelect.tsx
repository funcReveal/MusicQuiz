import React from "react";

type CollectionOption = {
  id: string;
  title: string;
};

type CollectionSelectProps = {
  label: string;
  newLabel: string;
  value: string;
  collections: CollectionOption[];
  onChange: (nextId: string) => void;
};

const CollectionSelect: React.FC<CollectionSelectProps> = ({
  label,
  newLabel,
  value,
  collections,
  onChange,
}) => {
  return (
    <>
      <label className="text-xs text-slate-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
      >
        <option value="">{newLabel}</option>
        {collections.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title || item.id}
          </option>
        ))}
      </select>
    </>
  );
};

export default CollectionSelect;
