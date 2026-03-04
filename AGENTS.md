# Repo Agent Rules

## Deploy
- `main` is production branch.
- `git add` + `git commit` + `git push origin main` is sufficient to deploy.
- Cloudflare Worker build/deploy runs automatically on push to `main`.
- Do not run manual production deploy commands unless explicitly requested.
