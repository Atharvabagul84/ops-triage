'use client';

import React, { useState } from 'react';
import { CopyIcon, CheckIcon } from '@/components/Icons';
import { CommandRisk } from '@/types/triage';

interface CommandBoxProps {
  cmd: string;
  purpose?: string;
  risk?: CommandRisk;
}

export function CommandBox({ cmd, purpose, risk }: CommandBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const getRiskColor = (r?: CommandRisk) => {
    if (r === 'Safe / Read-Only') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (r === 'State-Modifying') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  };

  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-3.5 my-2 backdrop-blur-sm transition-all hover:border-zinc-700">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400 font-medium">CLI Command</span>
          {risk && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium ${getRiskColor(risk)}`}>
              {risk}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors font-mono cursor-pointer"
        >
          {copied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <CopyIcon className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {purpose && (
        <p className="text-xs text-zinc-400 mb-2 font-sans">{purpose}</p>
      )}

      <div className="relative group overflow-x-auto rounded bg-zinc-900/90 p-2.5 border border-zinc-800">
        <pre className="font-mono text-xs text-emerald-300 leading-relaxed whitespace-pre-wrap break-all">
          <span className="text-zinc-500 select-none">$ </span>
          {cmd}
        </pre>
      </div>
    </div>
  );
}
