'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { globalSearch, type SearchGroup } from '@/server/search';

/** Ctrl/Cmd+K command palette — searches players, rosters, requests, tasks,
 * tournaments through per-resource authz gates and navigates on select. */
export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  // Global shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setGroups([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Debounced search; sequence guard drops out-of-order responses.
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setGroups([]);
      return;
    }
    const mySeq = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await globalSearch(q).catch(() => []);
      if (seq.current === mySeq) {
        setGroups(res);
        setActive(0);
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const flat = groups.flatMap((g) => g.hits);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault();
      go(flat[active].href);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search (Ctrl+K)"
        className="flex items-center gap-2 rounded-lg border bg-surface-2/60 px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Search</span>
        <kbd className="hidden rounded border bg-surface px-1 text-[10px] md:inline">Ctrl K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-xl border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search players, requests, tasks, tournaments…"
                className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
              />
              {searching && <span className="text-xs text-muted">…</span>}
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {q.trim().length >= 2 && !searching && flat.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted">No matches.</p>
              )}
              {groups.map((g) => {
                let base = 0;
                for (const other of groups) {
                  if (other === g) break;
                  base += other.hits.length;
                }
                return (
                  <div key={g.kind}>
                    <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted/70">{g.kind}</div>
                    {g.hits.map((h, i) => {
                      const idx = base + i;
                      return (
                        <button
                          key={`${h.href}-${i}`}
                          onClick={() => go(h.href)}
                          onMouseEnter={() => setActive(idx)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm ${
                            idx === active ? 'bg-accent/10 text-accent' : 'text-fg hover:bg-surface-2'
                          }`}
                        >
                          <span className="truncate font-medium">{h.label}</span>
                          {h.sublabel && <span className="ms-2 shrink-0 text-xs text-muted">{h.sublabel}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
