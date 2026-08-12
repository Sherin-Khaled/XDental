import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { readUploadStorageConfiguration } from "../config/uploadStorage.js";
import {
  HERO_IMAGE_DIRECTORY,
  HERO_IMAGE_PUBLIC_PREFIX,
  PRODUCT_IMAGE_DIRECTORY,
  PRODUCT_IMAGE_PUBLIC_PREFIX,
  PROFILE_IMAGE_DIRECTORY,
  PROFILE_IMAGE_PUBLIC_PREFIX,
} from "../config/uploads.js";

const IMAGE_KINDS = {
  hero: {
    directory: HERO_IMAGE_DIRECTORY,
    objectDirectory: "hero-slides",
    publicPrefix: HERO_IMAGE_PUBLIC_PREFIX,
    filenamePrefix: "hero",
  },
  product: {
    directory: PRODUCT_IMAGE_DIRECTORY,
    objectDirectory: "product-images",
    publicPrefix: PRODUCT_IMAGE_PUBLIC_PREFIX,
    filenamePrefix: "product",
  },
  profile: {
    directory: PROFILE_IMAGE_DIRECTORY,
    objectDirectory: "profile-images",
    publicPrefix: PROFILE_IMAGE_PUBLIC_PREFIX,
    filenamePrefix: "profile",
  },
};

const CONTENT_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

let s3Client = null;
let s3ClientSignature = "";

function imageKind(kind) {
  const configuration = IMAGE_KINDS[kind];
  if (!configuration) throw new Error(`Unsupported image storage kind: ${kind}`);
  return configuration;
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function managedFilenamePattern(kind) {
  const { filenamePrefix } = imageKind(kind);
  return new RegExp(
    `^${escapeRegularExpression(
      filenamePrefix
    )}-[a-f0-9-]+\\.(?:jpg|png|webp)$`
  );
}

function localFilename(kind, publicUrl) {
  if (typeof publicUrl !== "string") return null;
  const { publicPrefix } = imageKind(kind);
  const escapedPrefix = escapeRegularExpression(publicPrefix);
  const match = publicUrl.match(
    new RegExp(
      `^${escapedPrefix}/(${escapeRegularExpression(
        imageKind(kind).filenamePrefix
      )}-[a-f0-9-]+\\.(?:jpg|png|webp))$`
    )
  );
  return match?.[1] ?? null;
}

function getS3Client(configuration) {
  const signature = JSON.stringify({
    endpoint: configuration.endpoint,
    region: configuration.region,
    accessKeyId: configuration.accessKeyId,
    forcePathStyle: configuration.forcePathStyle,
  });
  if (s3Client && s3ClientSignature === signature) return s3Client;

  s3Client = new S3Client({
    endpoint: configuration.endpoint,
    region: configuration.region,
    forcePathStyle: configuration.forcePathStyle,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
  s3ClientSignature = signature;
  return s3Client;
}

export function getManagedObjectKey(
  kind,
  publicUrl,
  configuration = readUploadStorageConfiguration()
) {
  if (configuration.driver !== "s3" || typeof publicUrl !== "string") {
    return null;
  }

  let publicBase;
  let candidate;
  try {
    publicBase = new URL(`${configuration.publicBaseUrl}/`);
    candidate = new URL(publicUrl);
  } catch {
    return null;
  }

  if (
    candidate.origin !== publicBase.origin ||
    candidate.search ||
    candidate.hash
  ) {
    return null;
  }

  const basePath = publicBase.pathname.replace(/\/+$/, "");
  const expectedPrefix = `${basePath}/${imageKind(kind).objectDirectory}/`;
  if (!candidate.pathname.startsWith(expectedPrefix)) return null;

  const filename = candidate.pathname.slice(expectedPrefix.length);
  if (!managedFilenamePattern(kind).test(filename)) return null;
  return `${imageKind(kind).objectDirectory}/${filename}`;
}

export function isManagedImageUrl(kind, publicUrl) {
  if (localFilename(kind, publicUrl)) return true;
  return Boolean(getManagedObjectKey(kind, publicUrl));
}

export async function storeImage(kind, buffer, extension) {
  const kindConfiguration = imageKind(kind);
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) throw new Error("Unsupported image extension.");

  const filename = `${kindConfiguration.filenamePrefix}-${randomUUID()}.${extension}`;
  const configuration = readUploadStorageConfiguration();

  if (configuration.driver === "local") {
    await mkdir(kindConfiguration.directory, { recursive: true });
    const filePath = path.join(kindConfiguration.directory, filename);
    await writeFile(filePath, buffer, { flag: "wx" });
    return {
      filePath,
      publicUrl: `${kindConfiguration.publicPrefix}/${filename}`,
    };
  }

  const objectKey = `${kindConfiguration.objectDirectory}/${filename}`;
  await getS3Client(configuration).send(
    new PutObjectCommand({
      Bucket: configuration.bucket,
      Key: objectKey,
      Body: buffer,
      ContentLength: buffer.length,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return {
    objectKey,
    publicUrl: `${configuration.publicBaseUrl}/${objectKey}`,
  };
}

export async function deleteManagedImage(kind, publicUrl) {
  const kindConfiguration = imageKind(kind);
  const filename = localFilename(kind, publicUrl);
  if (filename) {
    try {
      await unlink(path.join(kindConfiguration.directory, filename));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    return;
  }

  const configuration = readUploadStorageConfiguration();
  const objectKey = getManagedObjectKey(kind, publicUrl, configuration);
  if (!objectKey) return;

  await getS3Client(configuration).send(
    new DeleteObjectCommand({
      Bucket: configuration.bucket,
      Key: objectKey,
    })
  );
}
