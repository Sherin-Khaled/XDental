# Catalog import contract v2

Phase 7A uses preview-first imports. A preview (`previewCatalogImport`) writes only `CatalogImportBatch` and `CatalogImportRow` audit records; it never changes catalog records. Apply (`applyCatalogImportBatch`) is the only step that ever writes Product/Brand/Category/Variant/Option/Image/stock data, and only for a previously-created, unmodified, error-free preview.

Supported entity sheets are: Products, Brands, Categories, ProductOptions, OptionValues, Variants, VariantOptionValues, Images, and Inventory. The executable canonical fields, accepted aliases, types, required flags, validation rules, and matching rules are in `server/src/services/catalogImport.contract.js`.

## Matching rules

- **Products**: sourceSystem+externalProductId, then normalized SKU, then legacy slug.
- **Brands**: sourceSystem+externalBrandId, then exact name.
- **Categories**: sourceSystem+externalCategoryId, then exact name.
- **Product options**: productId (resolved from `productExternalId`) + option `code`.
- **Option values**: the resolved option + value `code`. `productExternalId` is required on every OptionValues row so the right per-product option can be found — option codes are only unique within one product, not globally.
- **Variants**: sourceSystem+externalVariantId, then exact variant SKU, then exact barcode. A variant identifier that already belongs to a *different* product is rejected, never re-parented.
- **Variant option values**: the resolved variant's product's option + value codes.
- **Images**: `productExternalId` is required (and `externalVariantId` optional) so every image attaches to the right gallery. A URL that already exists in that exact product+variant gallery is skipped, never duplicated.
- **Inventory**: `externalVariantId` if present (variant stock), otherwise `productExternalId` (product stock).

Conflicting identifiers (two different identifiers matching two different existing records) always produce `CONFLICT` and are never silently merged onto either record.

## Apply ordering and atomicity

Apply always processes entity types in this fixed order — Brands, Categories, Products, ProductOptions, OptionValues, Variants, VariantOptionValues, Images, Inventory — inside a single database transaction, so a row that references another row created earlier in the *same* batch (e.g. a new Variant for a Product also being created in this batch) resolves correctly without a second import pass. Applying requires an admin-created preview batch ID, explicit confirmation, zero error/conflict rows, and an unchanged preview target (rows whose target changed since the preview was generated are rejected as stale). If any row fails, the whole transaction — every entity type in the batch — rolls back together. A batch can never be applied twice. `mark missing inactive` is not available through this contract.

## Rights protection

Images with `rightsConfirmed=false` still import (so nothing already-approved is blocked by one unreviewed row) but are stored as non-public review records with a rights note, and must never be returned by public catalog APIs.
