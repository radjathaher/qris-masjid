# Repo Agent Rules

## Deploy

- `main` is production branch.
- `git add` + `git commit` + `git push origin main` updates source control only.
- Production deploy is currently manual: run `bun run deploy`.
- Do not assume Cloudflare auto-deploy is wired unless it has been re-verified.
