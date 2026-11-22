# Publishing @feralcode/contract

The release is automated by `.github/workflows/release.yml` on a `v*` tag push. Publishing uses npm OIDC trusted publishing (no long-lived token in the repo).

## One-time setup on npmjs.com

1. Sign in at <https://www.npmjs.com> as an account with publish rights to the `@feralcode` scope.
2. Go to the package page for `@feralcode/contract` → **Settings** → **Trusted publishing** → **Add trusted publisher**. If the package does not exist yet, use <https://www.npmjs.com/package/@feralcode/contract> and npm will prompt to create the trusted-publisher record.
3. Fill in:
   - Repository owner: `Saperan`
   - Repository name: `FeralCode`
   - Workflow file: `release.yml`
   - Environment: leave blank
4. Save.

## Release

The `NPM_TOKEN` secret is not used. The workflow requests `id-token: write` and publishes with `--provenance`.

```sh
# 1. Bump version in packages/contract/package.json, commit, push to main.
# 2. Tag and push:
git tag v0.2.0
git push origin v0.2.0
```

The workflow runs the tests, checks that the tag matches `package.json`, and publishes. A tag whose version does not match the package fails the job.

## Local dry run

```sh
cd packages/contract
npm pack --dry-run
```
