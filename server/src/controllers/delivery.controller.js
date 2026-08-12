import { prisma } from "../config/db.js";
import {
  clinicLocationsInclude,
  getMatchingDeliveryOffers,
  replaceUserClinicLocations,
  serializeClinicLocation,
  serializeDeliveryZone,
  validateClinicLocationInput,
} from "../services/deliveryOffer.service.js";

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

export async function getMyMatchingDeliveryOffers(request, response) {
  return response.json(await getMatchingDeliveryOffers(request.user.id));
}
