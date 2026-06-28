'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { deleteMedia, uploadPlayerMedia } from '@/modules/media/server/actions';
import type { MediaItem } from '@/modules/media/server/queries';

export function PlayerGallery({
  playerId,
  media,
  canUpload,
  canDelete,
}: {
  playerId: string;
  media: MediaItem[];
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setMessage('Image too large (max 2MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const base64 = result.includes(',') ? result.split(',')[1]! : result;
      startTransition(async () => {
        const res = await uploadPlayerMedia({ playerId, fileName: file.name, contentType: file.type, dataBase64: base64 });
        setMessage(res.ok ? 'Uploaded' : res.error);
        if (inputRef.current) inputRef.current.value = '';
        if (res.ok) router.refresh();
      });
    };
    reader.readAsDataURL(file);
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteMedia({ id, playerId });
      if (res.ok) router.refresh();
      else setMessage(res.error);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Photos</h2>
        {canUpload && (
          <label className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm text-white">
            Upload photo
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} disabled={pending} />
          </label>
        )}
      </div>

      {message && <p className="mt-3 rounded-md border bg-surface px-3 py-2 text-sm">{message}</p>}

      {media.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No photos yet.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-lg border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/${m.id}`} alt="player" className="h-32 w-full object-cover" />
              {canDelete && (
                <button
                  onClick={() => remove(m.id)}
                  disabled={pending}
                  className="absolute end-1 top-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
