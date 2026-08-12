// Imports the owner's category tree (source of truth: the owner Excel sheet
// "الشجرة.xlsx", parsed 2026-07-16) plus two categories kept from the
// eg.toothpick.com reference taxonomy (Pedodontics, Oral Care System).
//
// The Excel encodes hierarchy in typecodes: main categories are 1..12 and a
// child's code is prefixed by its parent's code (e.g. 104 Cements -> 1041
// G.I. Cement). This script preserves that tree (up to 3 levels), in sheet
// order, with these documented adjustments:
//   - names are trimmed, inner spaces collapsed, and "&" spaced as " & ";
//   - "Prosthatics" and "Orthdontics" reuse the existing "Prosthodontics" and
//     "Orthodontics" categories (owner spelling treated as typos);
//   - duplicate rows are skipped: 6082 "XRay film&Material" (same name as its
//     parent 608), 6101 "Student case" (duplicate of 61002), 747 "Instruments"
//     (same name as its main category);
//   - 60900 "Saliva Ejector" is imported as a direct Consumables subcategory
//     (its code accidentally prefixes 6090 "Disposable Pouch");
//   - 131 "Suture Needle" has no main category "13" in the sheet; it is
//     attached under "Perio & Surgery" pending owner confirmation.
//
// Existing flat categories are reused/reconnected instead of duplicated
// (matched by slug/name, or via ALIASES below). Old flat categories that were
// replaced by the tree are set INACTIVE, never deleted.
//
// Safe and repeatable: upserts by slug/name, fixes parentId/displayOrder on
// every run, and never creates duplicates. Run with:
//   node --env-file=.env src/scripts/importCategoryTree.js
import { prisma } from "../config/db.js";

// [typecode, rawName] in exact sheet order. Mains are "1".."12".
const SHEET_ROWS = [
  ["1", "Restorative"],
  ["101", "Composite"],
  ["102", "Amalgam"],
  ["103", "Etch&Bond"],
  ["104", "Cements"],
  ["1041", "G.I. Cement"],
  ["1042", "Polycarboxylate Cement"],
  ["1043", "Zinc Phosphate Cement"],
  ["105", "Compomer"],
  ["106", "Base liner"],
  ["107", "Finishing&Polishing Rest"],
  ["108", "Caries detectors"],
  ["109", "Temporary Filling"],
  ["110", "Crown Form"],
  ["111", "Glass ionomer Rest."],
  ["112", "fissure sealent"],
  ["2", "Endodontics"],
  ["201", "Root Canal Sealer"],
  ["202", "Files&Reamers"],
  ["20201", "K. FILL"],
  ["20202", "H.FILL"],
  ["20203", "Reamer"],
  ["20204", "File Protaper"],
  ["203", "Nerve Broach"],
  ["204", "Paper Point&Gutta Percha"],
  ["205", "Rotary Files"],
  ["206", "Gates Glidden&Pesso Drills"],
  ["207", "Spearders&Pluggers"],
  ["208", "Endo Accessories"],
  ["209", "Vitality Testers"],
  ["210", "Medications&Irrigations"],
  ["211", "MTAs"],
  ["212", "Calcium Hydroxide"],
  ["213", "Zinc Oxide Restoration"],
  ["214", "Rubber dam"],
  ["3", "Prosthatics"],
  ["301", "Impression Material"],
  ["303", "Stainless Steel Crowns"],
  ["304", "Temporary Crown"],
  ["30401", "Polycarbonate Crown"],
  ["305", "Core Material"],
  ["306", "Posts"],
  ["3061", "Fiber Posts"],
  ["3062", "Metallic Posts"],
  ["307", "Soft liners"],
  ["4", "Perio&Surgery"],
  ["401", "Haemostatics"],
  ["402", "Perio Packs"],
  ["403", "Soft Tissue Graft"],
  ["404", "Bone Graft"],
  ["405", "Scaling&Polishing"],
  ["406", "Surgical Medication"],
  ["131", "Suture Needle"],
  ["5", "Orthdontics"],
  ["6", "Consumables"],
  ["601", "Protective Wear"],
  ["60101", "Gloves"],
  ["60102", "Mask"],
  ["60103", "Lab Coat"],
  ["60104", "Gown"],
  ["60105", "Scrubs"],
  ["60106", "Protective Glasses"],
  ["602", "Matrix&Wedges"],
  ["603", "Isolation"],
  ["604", "Retraction"],
  ["605", "Occlusal Adjustment"],
  ["606", "Anesthesia"],
  ["607", "Disinfection&Steralization"],
  ["608", "XRay film&Material"],
  ["6081", "XRay film"],
  ["6083", "Protective Glass"],
  ["6090", "Disposable Pouch"],
  ["60900", "Saliva Ejector"],
  ["6091", "Cotton Roll"],
  ["6092", "Diagnostic Set"],
  ["6093", "Tooth Picks"],
  ["6094", "Barrier Film"],
  ["6095", "Plastic Instrument Tray"],
  ["6096", "Dental Needle"],
  ["6097", "Fluoride Tray"],
  ["60981", "Disposable Syringe"],
  ["60982", "Chemicals"],
  ["60983", "Towels"],
  ["6099", "Disposable Cups"],
  ["610", "General items"],
  ["61001", "Accessories"],
  ["61002", "Student case"],
  ["7", "Instruments"],
  ["701", "Filling instruments"],
  ["702", "Extraction Forceps"],
  ["703", "Elevators"],
  ["704", "Soft Tissue Instruments"],
  ["705", "Retractors"],
  ["706", "Impression Accessories"],
  ["70601", "Aluminium Tray"],
  ["70602", "Plastic Impression Tray"],
  ["70603", "Stainless Steel Tray"],
  ["707", "Crown Remover&Caliber"],
  ["708", "Shade Guide"],
  ["709", "Articulation Adjustment"],
  ["710", "Mixing Guns"],
  ["711", "Scalers&Curettes"],
  ["712", "Condenser"],
  ["713", "Cotton Plier"],
  ["714", "Plier"],
  ["715", "Excavator"],
  ["716", "Explorer"],
  ["717", "Probe"],
  ["718", "Retainer"],
  ["719", "Scissors"],
  ["720", "Dispenser"],
  ["721", "Syring"],
  ["722", "Amalgam Carrier"],
  ["723", "Bone File"],
  ["724", "Bone Rongeur"],
  ["725", "Burnisher"],
  ["726", "Carver"],
  ["727", "Bone Curette"],
  ["728", "Bur Holder"],
  ["729", "Bur Brush"],
  ["730", "Surgical Blades & Blade Handles"],
  ["7301", "Hand of Blade"],
  ["731", "Napkin Holder"],
  ["732", "Needle Holder"],
  ["733", "Periodontal File"],
  ["734", "Periosteal Elevator"],
  ["735", "Wax Knife"],
  ["736", "Wax Carver"],
  ["737", "Dappen Dish"],
  ["738", "mirror"],
  ["739", "hand mirror"],
  ["740", "Puncture"],
  ["741", "Rubber Dam Clamp Forceps"],
  ["742", "Metal frame"],
  ["743", "Rubber Dam Clamp"],
  ["744", "Hand Plugger"],
  ["745", "Hand Spreader"],
  ["746", "Spatula Cement"],
  ["8", "Equipments"],
  ["801", "Dental Unit"],
  ["802", "Dental Unit Parts&Accessories"],
  ["803", "Light Cure"],
  ["804", "Endomotor"],
  ["805", "Apex Locator"],
  ["806", "Handpieces"],
  ["8061", "Straight Handpiece"],
  ["8062", "Low Speed Handpiece"],
  ["8063", "Air motor"],
  ["8064", "Air motor Kit"],
  ["8065", "High-Speed Handpiece"],
  ["807", "Micromotor"],
  ["808", "Amalgamator"],
  ["809", "Compressor"],
  ["810", "Autoclav"],
  ["811", "Obturation Systems"],
  ["812", "GuttaPercha Cutter"],
  ["813", "CAD/CAM"],
  ["814", "Water Distiller"],
  ["815", "Ultrasonic Cleaner"],
  ["816", "Ultrasonic Scaler"],
  ["817", "Sealing Machine"],
  ["818", "Xray unit"],
  ["819", "XRay Sensor"],
  ["820", "Intraoral Camera"],
  ["821", "XRay Viewer"],
  ["822", "Loups"],
  ["823", "Soft Tissue Laser"],
  ["824", "Hand pressing"],
  ["825", "Prophy Jet"],
  ["826", "Cartidge"],
  ["9", "Implant"],
  ["10", "Dental lab"],
  ["1001", "Acrylic"],
  ["1002", "Porcelain metal"],
  ["11", "Bleaching"],
  ["12", "Burs&Stones"],
  ["121", "Diamond"],
  ["1211", "Diamond Low Speed"],
  ["1212", "Diamond High Speed"],
  ["122", "Carbid"],
  ["1221", "Carbid Low Speed"],
  ["1222", "Carbid High Speed"],
  ["123", "Surgical Burs"],
  ["124", "Endo Burs"],
];

// Codes whose Excel typecode would attach them to the wrong parent.
const PARENT_OVERRIDES = {
  60900: "6", // Saliva Ejector: direct Consumables sub, not under Disposable Pouch
  131: "4", // Suture Needle: main category "13" is missing from the sheet
};

// Excel main -> existing category slug to reuse (reconnect, never duplicate).
const REUSE_EXISTING = {
  1: { slug: "restorative" },
  2: { slug: "endodontics" },
  3: { slug: "prosthodontics", keepExistingName: true }, // Excel "Prosthatics" (typo)
  5: { slug: "orthodontics", keepExistingName: true }, // Excel "Orthdontics" (typo)
  6: { slug: "disposable-material" }, // becomes "Consumables"
  8: { slug: "machines" }, // becomes "Equipments"
  9: { slug: "implantology" }, // becomes "Implant"
  10: { slug: "laboratories" }, // becomes "Dental lab"
  12: { slug: "burs" }, // becomes "Burs & Stones"
};

// Kept from the eg.toothpick.com reference taxonomy (not in the owner Excel).
const TOOTHPICK_EXTRA_MAINS = [
  { slug: "pedodontics", name: "Pedodontics", displayOrder: 13 },
  { slug: "oral-care-system", name: "Oral Care System", displayOrder: 14 },
];

// Subcategories verified on eg.toothpick.com for main categories the owner
// Excel leaves empty. Source: archived copies of the live category pages
// (web.archive.org; direct fetches are blocked by Cloudflare):
//   /en/categories/orthodontics       snapshot 2026-05-17
//   /categories/pedodontics           snapshot 2025-04-25
//   /categories/oral__care__system    snapshot 2025-04-25
//   /categories/restorative           snapshot 2025-04-25 (Whitening Material)
// Each page embeds a facetDistribution.subcategories payload; only real
// product-taxonomy entries were kept (no offers/brands/cross-category noise).
// Toothpick "Instruments"/"Accessories" under Orthodontics are stored with an
// "Orthodontic" prefix because category names are globally unique and products
// link to categories by name. Toothpick parents "Whitening Material" under
// Restorative; the owner's dedicated "Bleaching" main is its home here.
// Implantology was checked too: Toothpick lists only brand names beneath it,
// so Implant intentionally keeps zero subcategories.
const TOOTHPICK_SUBCATEGORIES = {
  orthodontics: [
    "Wires",
    "Orthodontic Instruments",
    "Elastic O-Tie & Ligature",
    "Orthodontic Accessories",
    "Brackets",
    "Spring / Coils & Hooks",
    "Buccal Tubes",
    "Cheek Retractors",
    "Bands",
    "Screws",
    "Adhesive",
    "Photography",
    "Intra Oral & Extra Oral",
  ],
  pedodontics: [
    "Pediatric Crown & Band",
    "Pulpotomy & Pulpectomy",
    "Medication & Fluoride",
  ],
  "oral-care-system": [
    "Interdental Cleaning",
    "Mouthwash",
    "Toothbrush",
  ],
  bleaching: [
    "Whitening Material",
  ],
};

// Replaced by the tree; deactivated (kept for history, hidden from the site).
const DEACTIVATE_SLUGS = [
  "periodontics", // merged into Perio & Surgery
  "surgery", // merged into Perio & Surgery
  "sterilization-material", // replaced by Disinfection & Steralization sub
  "machine-inquiries",
  "radiology", // covered by XRay subcategories
  "online-courses",
  "others",
  "books",
];

function cleanName(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*&\s*/g, " & ");
}

function slugify(value) {
  return cleanName(value)
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function buildTree() {
  const nodes = [];
  let currentMain = null;
  let sectionSubs = [];
  const orderByParent = new Map();
  const nextOrder = (parentKey) => {
    const value = (orderByParent.get(parentKey) ?? 0) + 1;
    orderByParent.set(parentKey, value);
    return value;
  };

  for (const [code, rawName] of SHEET_ROWS) {
    const name = cleanName(rawName);
    const isMain = /^([1-9]|1[0-2])$/.test(code);

    if (isMain) {
      currentMain = { code, name, parentCode: null, displayOrder: nextOrder("root") };
      nodes.push(currentMain);
      sectionSubs = [];
      continue;
    }

    let parentCode = PARENT_OVERRIDES[code] ?? null;
    if (!parentCode) {
      for (let i = sectionSubs.length - 1; i >= 0; i -= 1) {
        const candidate = sectionSubs[i];
        if (code.length > candidate.code.length && code.startsWith(candidate.code)) {
          parentCode = candidate.code;
          break;
        }
      }
    }
    if (!parentCode) parentCode = currentMain.code;
    if (PARENT_OVERRIDES[code] && PARENT_OVERRIDES[code] !== currentMain.code) {
      // Override may point outside the current section (e.g. 131 -> main 4).
      parentCode = PARENT_OVERRIDES[code];
    }

    const parent = nodes.find((node) => node.code === parentCode);
    if (!parent) throw new Error(`No parent found for row ${code} (${name}).`);

    // Skip duplicates: same name as the parent, or as an existing sibling.
    if (parent.name.toLowerCase() === name.toLowerCase()) {
      console.log(`skipped ${code} "${name}": duplicates its parent name`);
      continue;
    }
    const sibling = nodes.find(
      (node) => node.parentCode === parentCode && node.name.toLowerCase() === name.toLowerCase()
    );
    if (sibling) {
      console.log(`skipped ${code} "${name}": duplicate of sibling ${sibling.code}`);
      continue;
    }

    const node = { code, name, parentCode, displayOrder: nextOrder(parentCode) };
    nodes.push(node);
    sectionSubs.push(node);
  }

  return nodes;
}

async function upsertNode(node, idByCode, stats) {
  const reuse = node.parentCode === null ? REUSE_EXISTING[node.code] : null;
  const slug = slugify(node.name);
  const parentId = node.parentCode ? idByCode.get(node.parentCode) : null;

  let existing = null;
  if (reuse) {
    existing = await prisma.category.findUnique({ where: { slug: reuse.slug } });
  }
  if (!existing) {
    existing = await prisma.category.findFirst({
      where: { OR: [{ slug }, { name: { equals: node.name, mode: "insensitive" } }] },
    });
  }

  const name = reuse?.keepExistingName && existing ? existing.name : node.name;
  const finalSlug = reuse?.keepExistingName && existing ? existing.slug : slug;
  const data = {
    name,
    slug: finalSlug,
    parentId,
    displayOrder: node.displayOrder,
    status: "ACTIVE",
  };

  if (existing) {
    const updated = await prisma.category.update({ where: { id: existing.id }, data });
    idByCode.set(node.code, updated.id);
    stats.updated += 1;
    return;
  }

  const created = await prisma.category.create({ data });
  idByCode.set(node.code, created.id);
  stats.created += 1;
}

async function importCategoryTree() {
  const nodes = buildTree();
  const idByCode = new Map();
  const stats = { created: 0, updated: 0 };

  // Parents before children: mains first, then by code length (2-level, 3-level).
  const ordered = [...nodes].sort((a, b) => {
    const depthA = a.parentCode === null ? 0 : a.code.length;
    const depthB = b.parentCode === null ? 0 : b.code.length;
    return depthA - depthB;
  });
  for (const node of ordered) {
    await upsertNode(node, idByCode, stats);
  }

  for (const extra of TOOTHPICK_EXTRA_MAINS) {
    const existing = await prisma.category.findFirst({
      where: { OR: [{ slug: extra.slug }, { name: { equals: extra.name, mode: "insensitive" } }] },
    });
    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { parentId: null, displayOrder: extra.displayOrder, status: "ACTIVE" },
      });
      stats.updated += 1;
    } else {
      await prisma.category.create({
        data: { name: extra.name, slug: extra.slug, parentId: null, displayOrder: extra.displayOrder, status: "ACTIVE" },
      });
      stats.created += 1;
    }
  }

  // Verified Toothpick subcategories for otherwise-empty main categories.
  // Never repositions a subcategory an admin already moved (parentId is only
  // set on creation or when the record has no parent yet).
  for (const [parentSlug, names] of Object.entries(TOOTHPICK_SUBCATEGORIES)) {
    const parent = await prisma.category.findUnique({ where: { slug: parentSlug } });
    if (!parent) {
      console.warn(`Toothpick subcategories: parent "${parentSlug}" not found; skipped.`);
      continue;
    }
    const existingChildren = await prisma.category.count({ where: { parentId: parent.id } });
    let order = existingChildren;
    for (const rawName of names) {
      const name = cleanName(rawName);
      const slug = slugify(name);
      order += 1;
      const existing = await prisma.category.findFirst({
        where: { OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }] },
      });
      if (existing) {
        await prisma.category.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            ...(existing.parentId ? {} : { parentId: parent.id, displayOrder: order }),
          },
        });
        stats.updated += 1;
      } else {
        await prisma.category.create({
          data: { name, slug, parentId: parent.id, displayOrder: order, status: "ACTIVE" },
        });
        stats.created += 1;
      }
    }
  }

  const deactivated = await prisma.category.updateMany({
    where: { slug: { in: DEACTIVATE_SLUGS }, status: "ACTIVE" },
    data: { status: "INACTIVE" },
  });

  const [total, mains, subs] = await Promise.all([
    prisma.category.count({ where: { status: "ACTIVE" } }),
    prisma.category.count({ where: { status: "ACTIVE", parentId: null } }),
    prisma.category.count({ where: { status: "ACTIVE", parentId: { not: null } } }),
  ]);

  console.log(`Category tree import finished: ${stats.created} created, ${stats.updated} updated, ${deactivated.count} deactivated.`);
  console.log(`Active categories: ${total} (${mains} main, ${subs} sub).`);
}

importCategoryTree()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
