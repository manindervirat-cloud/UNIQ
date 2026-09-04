"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { cn } from "@/lib/utils";

export interface TestSpec {
  min: number;
  max: number;
  step: number;
  hint: string;
  extra?: string; // e.g. "for: MBA / Business Master's"
}

/**
 * TestListEditor — shared add/edit/delete editor for English and aptitude
 * tests. Students pick a test from a searchable select, enter a score
 * validated against the official range, and can stack multiple tests
 * (IELTS 7.5 + PTE 74 + Duolingo 135). The engine uses the strongest
 * valid score automatically.
 */
export function TestListEditor({
  label,
  specs,
  value,
  onChange,
  addLabel,
}: {
  label: string;
  specs: Record<string, TestSpec>;
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  addLabel: string;
}) {
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [score, setScore] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");

  const taken = Object.keys(value);
  const available = Object.keys(specs).filter((t) => !taken.includes(t) || t === editing);
  const spec = pick ? specs[pick] : null;

  // AUTO-COMMIT: a typed valid draft must never be lost just because the
  // student didn't press "Add test" before continuing. As soon as both a
  // test and an in-range score are present, save them into the profile.
  const draftRef = useRef({ pick, score, editing });
  draftRef.current = { pick, score, editing };
  useEffect(() => {
    if (!pick || !spec || !score) return;
    const n = Number(score);
    if (Number.isNaN(n) || n < spec.min || n > spec.max) return;
    const t = setTimeout(() => {
      const next = { ...value };
      if (editing && editing !== pick) delete next[editing];
      next[pick] = n;
      onChange(next);
    }, 400); // debounce while typing
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, score, editing]);

  // Rows shown in the saved list — hide the one currently open in the
  // editor (auto-commit would otherwise render it twice).
  const listed = taken.filter((name) => !(adding && name === pick));

  const commit = () => {
    if (!pick || !spec) return setError("Pick a test first.");
    const n = Number(score);
    if (!score || Number.isNaN(n)) return setError("Enter a score.");
    if (n < spec.min || n > spec.max)
      return setError(`${pick} scores run ${spec.min}–${spec.max}.`);
    const next = { ...value };
    if (editing && editing !== pick) delete next[editing];
    next[pick] = n;
    onChange(next);
    setAdding(false);
    setEditing(null);
    setPick("");
    setScore("");
    setError("");
  };

  const startEdit = (name: string) => {
    setEditing(name);
    setPick(name);
    setScore(String(value[name]));
    setAdding(true);
    setError("");
  };

  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink-soft">{label}</p>

      {listed.length > 0 && (
        <ul className="mb-2.5 space-y-1.5">
          {listed.map((name) => (
            <li
              key={name}
              className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.04] px-3.5 py-2"
            >
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{name}</span>
                <span className="ml-2 font-serif text-base font-bold text-blue-deep">
                  {value[name]}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Edit ${name}`}
                className="text-ink-faint transition-colors hover:text-blue-deep"
                onClick={() => startEdit(name)}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                className="text-ink-faint transition-colors hover:text-red"
                onClick={() => {
                  const next = { ...value };
                  delete next[name];
                  onChange(next);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="animate-rise relative z-30 space-y-2.5 rounded-xl border border-blue/30 p-3.5"
             style={{ background: "rgba(91,108,255,0.08)" }}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <SearchSelect
              value={pick}
              onChange={(v) => {
                setPick(v);
                setError("");
              }}
              options={available}
              placeholder="Which test?"
              ariaLabel="Which test?"
            />
            <input
              type="number"
              className={inputClass}
              min={spec?.min}
              max={spec?.max}
              step={spec?.step}
              placeholder={spec ? spec.hint : "Score"}
              value={score}
              onChange={(e) => {
                setScore(e.target.value);
                setError("");
              }}
              aria-label="Score"
            />
          </div>
          {spec?.extra && <p className="text-xs text-ink-faint">{spec.extra}</p>}
          {error && <p className="text-xs font-medium text-amber">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="primary" className="min-h-[38px] flex-1 py-1.5" onClick={commit}>
              {editing ? "Save change" : "Add test"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="min-h-[38px] py-1.5"
              onClick={() => {
                setAdding(false);
                setEditing(null);
                setPick("");
                setScore("");
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn("w-full border-dashed", taken.length === 0 && "text-ink-faint")}
          onClick={() => setAdding(true)}
          disabled={available.length === 0}
        >
          <Plus className="h-4 w-4" /> {taken.length ? "Add another test" : addLabel}
        </Button>
      )}
    </div>
  );
}
