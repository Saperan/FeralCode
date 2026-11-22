# Publishing @feralcode/contract

The release is automated by `.github/workflows/release.yml` on a `v*` tag push. Publishing uses the `NPM_TOKEN` repository secret (a granular npm access token with publish rights on the `@feralcode` scope).

## One-time setup

1. Create the `feralcode` organization on npmjs.com (free public plan). The org name is the scope `@feralcode`.
2. On npmjs.com, go to your profile → **Access Tokens** → **Generate New Token** → **Granular Access Token**:
   - Token name: `feralcode-publish`
   - Check **Bypass two-factor authentication (2FA)**
   - Packages and scopes → **Read and write (publish and stage)** → **All packages**
   - Organizations → **Read and write** for `feralcode`
   - Expiration: 90 days or more
3. Add the token as a GitHub Actions repository secret named `NPM_TOKEN` (Settings → Secrets and variables → Actions → New repository secret).

## Release

```sh
# 1. Bump version in packages/contract/package.json, commit, push to main.
# 2. Tag and push:
git tag v0.2.1
git push origin v0.2.1
```

The workflow runs the tests, checks that the tag matches `package.json`, and publishes with `npm publish --access public`. A tag whose version does not match the package fails the job.

## Local dry run

```sh
cd packages/contract
npm pack --dry-run
```
