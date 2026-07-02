import { NextResponse } from 'next/server';
import { getCurrentPrincipal } from '@/server/auth/session';
import { withOrgTx } from '@/server/db/tenant';
import { canReadAsset, getObject, presignGet, useS3 } from '@/server/storage/media';

/** Serve a media asset after authorize-then-(serve|sign). Never public. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await getCurrentPrincipal();
  if (!principal) return new NextResponse('Unauthorized', { status: 401 });

  // deletedAt filter: a soft-deleted asset must stop being servable immediately.
  const asset = await withOrgTx(principal.organizationId, (tx) => tx.mediaAsset.findFirst({ where: { id, deletedAt: null } }));
  if (!asset || !canReadAsset(principal, asset)) return new NextResponse('Not found', { status: 404 });

  if (useS3) {
    return NextResponse.redirect(await presignGet(principal, asset));
  }
  const bytes = await getObject(asset.s3Key);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
