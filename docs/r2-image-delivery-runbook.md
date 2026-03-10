R2 Image Delivery Runbook

Last updated: 2026-03-10

Purpose

- Make QRIS image delivery production-safe.
- Give one canonical setup + verification path.
- Reduce ambiguity around `R2_PUBLIC_BASE_URL`.

Production stance

- Preferred production path: R2 custom domain.
- Allowed for dev/testing only: `*.r2.dev`.
- Invalid for this app:
  - malformed URL values
  - non-HTTP(S) URL values

Why

- `r2.dev` is intended for non-production traffic and is rate limited.
- custom domains unlock the production path and better control/caching.
- this app already classifies delivery mode as:
  - `unconfigured`
  - `invalid`
  - `public-r2-dev`
  - `public-custom-domain`

Target state

```text
R2 bucket
  -> custom domain connected in Cloudflare
  -> optional r2.dev disabled
  -> R2_PUBLIC_BASE_URL=https://<your-custom-domain>
  -> /admin shows:
       Status: Production Ready
       Mode: public-custom-domain
```

Setup

1. Prepare a hostname in Cloudflare

- Use a hostname you control in the same Cloudflare account/zone as the R2 bucket.
- Example:
  - `assets.example.com`
  - `cdn.example.com`

2. Connect the custom domain to the R2 bucket

- Cloudflare Dashboard
  - R2
  - bucket
  - Settings
  - Public access
  - Custom Domains
  - Connect Domain
- Wait until status becomes `Active`.

3. Decide whether to keep `r2.dev`

- For production:
  - recommended: disable public `r2.dev` access after custom domain works
- Reason:
  - otherwise the bucket can still remain public through the dev URL

4. Set app config

- Update `R2_PUBLIC_BASE_URL` to the exact custom-domain origin:

```text
R2_PUBLIC_BASE_URL=https://cdn.example.com
```

- Do not add trailing slash.
- Do not point this at `r2.dev` in production.

5. Optional cache/CORS follow-up

- If QR images are consumed cross-origin, configure bucket CORS on the custom domain path.
- If you change CORS after traffic exists, purge cache for the custom domain.

Verification

1. Verify bucket/domain at Cloudflare

- R2 bucket settings show custom domain `Active`.
- If keeping `r2.dev`, understand it should still be treated as non-production only.

2. Verify app config in admin

- Open `/admin`
- Check `Config Health`
- Expected production values:
  - `Status: Production Ready`
  - `Mode: public-custom-domain`
  - `Base URL: https://<your-custom-domain>`

3. Verify QRIS detail link generation

- Open a masjid with stored QRIS image
- Expected:
  - `Buka gambar QR` link exists
  - link hostname matches your custom domain

4. Verify direct object fetch

- Open the generated image URL in browser or curl it:

```bash
curl -I https://cdn.example.com/qris/<masjid-id>/<filename>.png
```

- Expected:
  - successful HTTP response
  - no accidental `r2.dev` hostname in generated links

5. Verify failure states remain useful

- If `R2_PUBLIC_BASE_URL` is blank:
  - `/admin` should show `Not Configured`
- If malformed:
  - `/admin` should show `Invalid Config`
- If `*.r2.dev`:
  - `/admin` should show `Dev Only`

Rollback / failure handling

- If custom domain setup fails:
  - leave `R2_PUBLIC_BASE_URL` unset rather than pointing to a broken hostname
  - app will fail closed and show explicit config-health warnings
- If you temporarily use `r2.dev`:
  - treat it as short-lived only
  - do not call production ready until custom domain is active

Repo signals already in place

- `/api/masjids/:id/qris`
  - exposes `imageDeliveryConfigured`
  - exposes `imageDeliveryMode`
- `/api/admin/config-health`
  - exposes delivery state for operators
- `/admin`
  - translates delivery state into actionable guidance

References

- Cloudflare R2 Public Buckets:
  - https://developers.cloudflare.com/r2/buckets/public-buckets/
- Cloudflare Cache with R2:
  - https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
- Cloudflare R2 CORS:
  - https://developers.cloudflare.com/r2/buckets/cors/
- Cloudflare R2 Presigned URLs:
  - https://developers.cloudflare.com/r2/api/s3/presigned-urls/
