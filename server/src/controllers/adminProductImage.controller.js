import {
  storeProductImage,
  validateProductImage,
} from "../services/productImageStorage.service.js";

export async function uploadAdminProductImage(request, response) {
  const contentType =
    request.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  const validation = validateProductImage(request.body, contentType);

  if (validation.error) {
    return response
      .status(validation.error.status)
      .json({ message: validation.error.message, field: "imageUrl" });
  }

  const storedImage = await storeProductImage(
    request.body,
    validation.extension
  );
  return response.status(201).json({ imageUrl: storedImage.publicUrl });
}
