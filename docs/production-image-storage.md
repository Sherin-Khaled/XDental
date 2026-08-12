# Production image storage

X Dental Store accepts product, customer profile, and Hero-slide images through
the backend. Local development stores those files under `server/uploads`.
Production on Hostinger Business or Cloud managed Node.js hosting must use
durable S3-compatible object storage so a redeployment cannot remove customer or
catalog media.

The backend does not hardcode a storage vendor. Cloudflare R2, Amazon S3, or
another S3-compatible provider can be used. Cloudflare R2 uses region `auto`.

## Production environment variables

Add these only to the backend application's environment settings in Hostinger:

```env
NODE_ENV=production
UPLOAD_STORAGE_DRIVER=s3
UPLOAD_S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
UPLOAD_S3_REGION=auto
UPLOAD_S3_BUCKET=xdental-store-production
UPLOAD_S3_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
UPLOAD_S3_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
UPLOAD_S3_PUBLIC_BASE_URL=https://media.example.com
UPLOAD_S3_FORCE_PATH_STYLE=false
```

`UPLOAD_S3_PUBLIC_BASE_URL` must be the HTTPS address that publicly serves the
bucket. For Cloudflare R2 production traffic, connect a custom media subdomain
such as `media.example.com` to the bucket. The rate-limited `r2.dev` address is
appropriate only for development or an initial connection test.

Never commit access keys to the repository or place them in frontend variables.
The bucket credential should have object read/write permission for this bucket
only. The public bucket does not need directory listing.

## Deployment sequence

1. Create one production bucket.
2. Connect its production HTTPS public domain.
3. Create a bucket-scoped read/write API token.
4. Add the environment variables to the Hostinger backend application.
5. Deploy or restart the backend.
6. Upload one temporary product image, profile image, and Hero image.
7. Confirm each image still loads after one backend redeployment.
8. Delete the temporary records or replace the test images through the normal
   application controls.

The backend fails startup when `NODE_ENV=production` selects local storage,
credentials are missing, or either storage URL is malformed, non-HTTPS, or
localhost. Development continues to use the existing local directories without
requiring production credentials.
