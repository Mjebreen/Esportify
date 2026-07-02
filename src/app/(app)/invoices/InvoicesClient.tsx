'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Badge, statusTone } from '@/components/Badge';
import { approveInvoice, payInvoice, rejectInvoice, submitInvoice } from '@/modules/invoices/workflow';
import type { InvoiceRow } from '@/modules/invoices/queries';

interface Props {
  invoices: InvoiceRow[];
  canSubmit: boolean;
  canApprove: boolean;
  canPay: boolean;
}

const EMPTY = { number: '', amount: '', currency: 'SAR', dueAt: '', notes: '' };

export function InvoicesClient({ invoices, canSubmit, canApprove, canPay }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    startTransition(async () => {
      const res = await fn();
      setMessage(res.ok ? ok ?? null : res.error ?? 'Error');
      if (res.ok) router.refresh();
    });

  function upload() {
    if (!form.number || !form.amount) return;
    run(
      () =>
        submitInvoice({
          number: form.number,
          amount: Number(form.amount),
          currency: form.currency || undefined,
          dueAt: form.dueAt ? new Date(form.dueAt) : null,
          notes: form.notes || null,
        }).then((r) => {
          if (r.ok) {
            setForm({ ...EMPTY });
            setOpen(false);
          }
          return r;
        }),
      'Invoice submitted for approval',
    );
  }

  function reject(id: string) {
    const reason = prompt('Reason for rejection (optional):');
    if (reason === null) return; // Cancel pressed — do NOT reject
    run(() => rejectInvoice({ id, reason: reason || undefined }), 'Invoice rejected');
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Invoices</h1>
          <p className="mt-0.5 text-sm text-muted">Player uploads → manager approves → finance pays</p>
        </div>
        {canSubmit && (
          <button onClick={() => setOpen(!open)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Upload invoice
          </button>
        )}
      </div>

      {message && <p className="mt-4 rounded-lg border bg-surface px-3 py-2 text-sm text-fg">{message}</p>}

      {open && (
        <div className="card mt-4 grid gap-3 p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Invoice number</span>
            <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className="field" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Amount</span>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="field" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Currency</span>
            <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="field" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Due date</span>
            <input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} className="field" />
          </label>
          <label className="col-span-full flex flex-col gap-1 text-sm">
            <span className="text-muted">Notes</span>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="field min-h-16" />
          </label>
          <div className="col-span-full">
            <button onClick={upload} disabled={pending || !form.number || !form.amount} className="btn-primary">
              Submit for approval
            </button>
          </div>
        </div>
      )}

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">Invoice #</th>
              <th className="px-4 py-2.5 text-start font-medium">Player</th>
              <th className="px-4 py-2.5 text-start font-medium">Amount</th>
              <th className="px-4 py-2.5 text-start font-medium">Status</th>
              <th className="px-4 py-2.5 text-start font-medium">Issued</th>
              <th className="px-4 py-2.5 text-end font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  No invoices visible to your role yet.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b transition-colors last:border-0 hover:bg-surface-2/60">
                <td className="px-4 py-2.5 font-medium">{inv.number}</td>
                <td className="px-4 py-2.5 text-muted">{inv.player}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {Number(inv.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })} {inv.currency}
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={statusTone(inv.status)}>{inv.status.replace('_', ' ')}</Badge>
                </td>
                <td className="px-4 py-2.5 text-muted">{inv.issuedAt}</td>
                <td className="px-4 py-2.5 text-end">
                  <div className="flex justify-end gap-3 text-sm font-medium">
                    {canApprove && inv.status === 'SUBMITTED' && (
                      <>
                        <button onClick={() => run(() => approveInvoice({ id: inv.id }), 'Approved')} disabled={pending} className="text-green-600 hover:text-green-700 dark:text-green-400">
                          Approve
                        </button>
                        <button onClick={() => reject(inv.id)} disabled={pending} className="text-red-500 hover:text-red-600">
                          Reject
                        </button>
                      </>
                    )}
                    {canPay && inv.status === 'MANAGER_APPROVED' && (
                      <button onClick={() => run(() => payInvoice({ id: inv.id }), 'Marked paid')} disabled={pending} className="text-accent hover:underline">
                        Mark paid
                      </button>
                    )}
                    {inv.status === 'REJECTED' && <span className="text-xs text-muted">—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
