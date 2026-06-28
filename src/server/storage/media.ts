import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MediaAsset } from '@prisma/client';
import { env } from '../env';
import { holdsGrant } from '../authz/gate';
import type { Principal } from '../authz/types';

const s3 = new S3Client({ region: env.AWS_REGION });

/** Use real S3 only when credentials are present; otherwise fall back to local disk
 * so media is fully functional in dev without AWS. The authorization checks are
 * identical in both modes — only the bytes' destination differs. */
export const useS3 = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
const LOCAL_ROOT = join(process.cwd(), '.media');

/** Store bytes at `key` (S3 object or local file). */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (useS3) {
    await s3.send(new PutObjectCommand({ Bucket: env.S3_MEDIA_BUCKET, Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const path = join(LOCAL_ROOT, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

/** Read bytes at `key`. */
export async function getObject(key: string): Promise<Buffer> {
  if (useS3) {
    const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_MEDIA_BUCKET, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  return readFile(join(LOCAL_ROOT, key));
}

/** Key convention encodes the org so a presign can validate prefix-vs-asset. */
export function buildMediaKey(orgId: string, ownerType: string, ownerId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `org/${orgId}/${ownerType.toLowerCase()}/${ownerId}/${safe}`;
}

/**
 * Authorize-then-sign for READ. A resource-level `media:read` grant is NOT enough:
 * we also enforce MediaVisibility against the caller (A: closes the finding that
 * any in-org user could mint a URL for a RESTRICTED contract scan).
 */
export function canReadAsset(principal: Principal, asset: MediaAsset): boolean {
  if (asset.status !== 'READY') return false;
  if (asset.organizationId !== principal.organizationId) return false;
  if (!asset.s3Key.startsWith(`org/${principal.organizationId}/`)) return false;

  // The owner (the player the asset is about, or the uploader) may always see it,
  // except RESTRICTED (IDs/contracts) which stays organization-scope only.
  const isOwner =
    (asset.ownerType === 'PLAYER' && asset.ownerId === principal.playerId) ||
    asset.uploadedById === principal.userId;
  if (isOwner && asset.visibility !== 'RESTRICTED') return true;

  switch (asset.visibility) {
    case 'ORG_INTERNAL':
      return holdsGrant(principal, 'mediaAsset', 'read', 'organization');
    case 'RESTRICTED':
      // Sensitive (IDs/contracts): organization-scope readers only (Leadership/IT/Super Admin).
      return holdsGrant(principal, 'mediaAsset', 'read', 'organization');
    case 'ROSTER':
      return (
        holdsGrant(principal, 'mediaAsset', 'read', 'organization') ||
        (asset.rosterId !== null && principal.managedRosterIds.includes(asset.rosterId))
      );
    case 'PRIVATE':
    default:
      return (
        holdsGrant(principal, 'mediaAsset', 'read', 'organization') ||
        asset.uploadedById === principal.userId ||
        (asset.ownerType === 'PLAYER' && asset.ownerId === principal.playerId)
      );
  }
}

/** Exposed for unit tests of the visibility policy. */
export const __testing = { canReadAsset };

/** Mint a short-lived GET URL after the visibility check. Throws if not permitted. */
export async function presignGet(principal: Principal, asset: MediaAsset): Promise<string> {
  if (!canReadAsset(principal, asset)) {
    throw new Error('Forbidden: media read denied by visibility policy');
  }
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_MEDIA_BUCKET, Key: asset.s3Key }), {
    expiresIn: env.S3_PRESIGN_EXPIRY_SECONDS,
  });
}

/**
 * Mint a short-lived PUT URL with a locked content-type. The created asset stays
 * PENDING (not servable) until the post-upload validation Lambda flips it READY.
 */
export async function presignPut(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: env.S3_MEDIA_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: env.S3_PRESIGN_EXPIRY_SECONDS },
  );
}
