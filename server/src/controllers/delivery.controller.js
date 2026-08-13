import { prisma } from "../config/db.js";
import {
  clinicLocationsInclude,
  getMatchingDeliveryOffers,
  replaceUserClinicLocations,
  serializeClinicLocation,
  serializeDeliveryZone,
  validateClinicLocationInput,
  validateSavedClinicLocationInput,
} from "../services/deliveryOffer.service.js";
import { isValidId } from "../utils/records.js";

export async function getActiveDeliveryZones(_request, response) {
  const zones = await prisma.deliveryZone.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { nameEn: "asc" }],
  });
  return response.json({ deliveryZones: zones.map(serializeDeliveryZone) });
}

export async function getMyClinicLocations(request, response) {
  const clinicLocations = await prisma.userClinicLocation.findMany({
    where: { userId: request.user.id },
    ...clinicLocationsInclude,
  });
  return response.json({
    clinicLocations: clinicLocations.map(serializeClinicLocation),
  });
}

export async function updateMyClinicLocations(request, response) {
  const parsed = await validateClinicLocationInput(request.body?.clinicLocations);
  if (parsed.error) return response.status(400).json(parsed.error);

  const clinicLocations = await prisma.$transaction(async (transaction) => {
    await replaceUserClinicLocations(transaction, request.user.id, parsed.value);
    return transaction.userClinicLocation.findMany({
      where: { userId: request.user.id },
      ...clinicLocationsInclude,
    });
  });

  return response.json({
    clinicLocations: clinicLocations.map(serializeClinicLocation),
  });
}

function locationConflict(response, error) {
  if (error?.code !== "P2002") return false;
  response.status(409).json({ message: "A saved location already uses this delivery area." });
  return true;
}

export async function createMyClinicLocation(request, response) {
  const parsed = await validateSavedClinicLocationInput(request.body);
  if (parsed.error) return response.status(400).json(parsed.error);
  try {
    const location = await prisma.$transaction(async (transaction) => {
      const count = await transaction.userClinicLocation.count({ where: { userId: request.user.id } });
      if (count >= 20) return null;
      const makeDefault = parsed.value.isDefault === true || count === 0;
      if (makeDefault) {
        await transaction.userClinicLocation.updateMany({
          where: { userId: request.user.id },
          data: { isDefault: false },
        });
      }
      return transaction.userClinicLocation.create({
        data: { userId: request.user.id, ...parsed.value, isDefault: makeDefault },
        include: { deliveryZone: true },
      });
    });
    if (!location) return response.status(409).json({ message: "No more than 20 clinic locations can be saved." });
    return response.status(201).json({ clinicLocation: serializeClinicLocation(location) });
  } catch (error) {
    if (locationConflict(response, error)) return;
    throw error;
  }
}

export async function updateMyClinicLocation(request, response) {
  if (!isValidId(request.params.locationId)) {
    return response.status(404).json({ message: "Clinic location not found." });
  }
  const parsed = await validateSavedClinicLocationInput(request.body);
  if (parsed.error) return response.status(400).json(parsed.error);
  const existing = await prisma.userClinicLocation.findFirst({
    where: { id: request.params.locationId, userId: request.user.id },
    select: { id: true, isDefault: true },
  });
  if (!existing) return response.status(404).json({ message: "Clinic location not found." });
  try {
    const location = await prisma.$transaction(async (transaction) => {
      if (parsed.value.isDefault === true) {
        await transaction.userClinicLocation.updateMany({
          where: { userId: request.user.id },
          data: { isDefault: false },
        });
      }
      return transaction.userClinicLocation.update({
        where: { id: existing.id },
        data: {
          ...parsed.value,
          isDefault: parsed.value.isDefault === true || existing.isDefault,
        },
        include: { deliveryZone: true },
      });
    });
    return response.json({ clinicLocation: serializeClinicLocation(location) });
  } catch (error) {
    if (locationConflict(response, error)) return;
    throw error;
  }
}

export async function deleteMyClinicLocation(request, response) {
  if (!isValidId(request.params.locationId)) {
    return response.status(404).json({ message: "Clinic location not found." });
  }
  const existing = await prisma.userClinicLocation.findFirst({
    where: { id: request.params.locationId, userId: request.user.id },
    select: { id: true, isDefault: true },
  });
  if (!existing) return response.status(404).json({ message: "Clinic location not found." });
  await prisma.$transaction(async (transaction) => {
    await transaction.userClinicLocation.delete({ where: { id: existing.id } });
    if (existing.isDefault) {
      const next = await transaction.userClinicLocation.findFirst({
        where: { userId: request.user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (next) await transaction.userClinicLocation.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  return response.status(204).send();
}

export async function getMyMatchingDeliveryOffers(request, response) {
  return response.json(await getMatchingDeliveryOffers(request.user.id));
}
