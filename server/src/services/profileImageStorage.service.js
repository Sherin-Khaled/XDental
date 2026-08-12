import {
  deleteManagedImage,
  storeImage,
} from "./imageStorage.service.js";

export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES = {
  "image/jpeg": {
    extension: "jpg",
    matches(buffer) {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    },
  },
  "image/png": {
    extension: "png",
    matches(buffer) {
      const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      return (
        buffer.length >= signature.length &&
        signature.every((byte, index) => buffer[index] === byte)
      );
    },
  },
  "image/webp": {
    extension: "webp",
    matches(buffer) {
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    },
  },
};

export function validateProfileImage(buffer, contentType) {
  const imageType = IMAGE_TYPES[contentType];
  if (!imageType) {
    return {
      error: {
        status: 415,
        message: "Choose a JPEG, PNG, or WebP image.",
      },
    };
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      error: {
        status: 400,
        message: "Choose an image to upload.",
      },
    };
  }

  if (buffer.length > PROFILE_IMAGE_MAX_BYTES) {
    return {
      error: {
        status: 413,
        message: "Profile images must be 5 MB or smaller.",
      },
    };
  }

  if (!imageType.matches(buffer)) {
    return {
      error: {
        status: 400,
        message: "The selected file does not contain a valid image.",
      },
    };
  }

  return { extension: imageType.extension };
}

export async function storeProfileImage(buffer, extension) {
  return storeImage("profile", buffer, extension);
}

export async function deleteManagedProfileImage(publicUrl) {
  return deleteManagedImage("profile", publicUrl);
}
