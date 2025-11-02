# GitHub Actions Workflows - Intelligent Finder

This directory contains all CI/CD workflows for automated testing, building, and releasing Intelligent Finder.

---

## 📋 Workflows Overview

### 1. CI Pipeline (`ci.yml`)
**Trigger:** Push to main/develop, Pull Requests

**What it does:**
- Installs dependencies with caching
- Runs ESLint and Prettier checks
- Runs TypeScript type checking
- Executes security scans
- Runs unit tests on Ubuntu, macOS, Windows
- Runs integration tests
- Runs E2E tests on all platforms
- Builds application for verification

**Duration:** ~12-15 minutes
**Required for:** All PRs must pass

### 2. Release Pipeline (`release.yml`)
**Trigger:** Git tags matching `v*.*.*` (e.g., v1.0.0)

**What it does:**
- Creates GitHub release
- Builds installers for all platforms:
  - macOS: DMG + ZIP (Intel + Apple Silicon)
  - Windows: NSIS installer + Portable (x64)
  - Linux: AppImage + DEB + RPM (x64)
- Signs code (macOS with notarization, Windows)
- Uploads release assets
- Publishes release

**Duration:** ~35-45 minutes
**Required for:** Releases only

### 3. Security Scanning (`security-scan.yml`)
**Trigger:** Push, PR, Daily schedule (2 AM UTC)

**What it does:**
- NPM audit for vulnerable dependencies
- CodeQL security analysis
- Snyk vulnerability scanning
- Trivy filesystem scanning
- TruffleHog secret detection
- Dependency review on PRs

**Duration:** ~5-10 minutes
**Required for:** Security compliance

### 4. Performance Monitoring (`performance.yml`)
**Trigger:** Push to main/develop

**What it does:**
- Lighthouse CI performance testing
- Bundle size analysis
- Memory leak detection
- Performance regression detection

**Duration:** ~8-12 minutes
**Required for:** Performance tracking

---

## 🚀 Quick Start for Developers

### First Time Setup
```bash
# 1. Clone repository
git clone https://github.com/your-org/intelligent-finder.git

# 2. Install dependencies
cd intelligent-finder
npm install

# 3. Setup git hooks
npm run prepare

# 4. Start development
npm run dev
```

### Daily Workflow
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and test locally
npm run lint:fix
npm run typecheck
npm run test

# Commit (git hooks run automatically)
git commit -m "feat: add my feature"

# Push and create PR
git push origin feature/my-feature
```

### CI Checks
When you create a PR, these checks run automatically:
- ✅ Linting & formatting
- ✅ Type checking
- ✅ Security scanning
- ✅ Unit tests (3 platforms)
- ✅ Integration tests
- ✅ E2E tests (3 platforms)
- ✅ Build verification

All must pass before merging!

---

## 🔧 Local Commands

### Quality Checks
```bash
npm run lint          # Check linting
npm run lint:fix      # Fix linting issues
npm run format        # Format code
npm run format:check  # Check formatting
npm run typecheck     # Check types
```

### Testing
```bash
npm run test              # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:e2e          # E2E tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage
```

### Building
```bash
npm run build           # Build application
npm run build:release   # Build packages
npm run clean          # Clean build artifacts
```

---

## 🔐 Required Secrets (DevOps Only)

For releases to work, configure these GitHub secrets:

### Code Signing
- `MACOS_CERTIFICATE` - Base64 P12 certificate
- `MACOS_CERTIFICATE_PASSWORD` - Certificate password
- `APPLE_ID` - Apple Developer ID
- `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Apple Team ID
- `WINDOWS_CERTIFICATE` - Base64 PFX certificate
- `WINDOWS_CERTIFICATE_PASSWORD` - Certificate password

### Optional Services
- `SNYK_TOKEN` - Snyk API token
- `CODECOV_TOKEN` - Code coverage token
- `SENTRY_AUTH_TOKEN` - Error monitoring
- `SENTRY_DSN` - Sentry DSN

See [docs/deployment/CI-CD-GUIDE.md](../docs/deployment/CI-CD-GUIDE.md) for details.

---

## 📊 Workflow Status

Check workflow status:
- Actions tab in GitHub
- Status badges in README
- PR status checks

View workflow runs:
- Click on workflow in Actions tab
- See detailed logs for each step
- Download artifacts if needed

---

## 🐛 Troubleshooting

### CI Failing but Works Locally?
```bash
# Ensure clean environment
npm run clean
npm ci  # Not npm install!
npm run test
```

### Need to Re-run Workflow?
- Go to Actions tab
- Click on failed run
- Click "Re-run jobs"

### Workflow Taking Too Long?
- Check for slow tests
- Review GitHub Actions logs
- Contact DevOps team

---

## 📚 Documentation

**Quick Start:**
[docs/deployment/QUICK-START.md](../docs/deployment/QUICK-START.md)

**Complete Guide:**
[docs/deployment/CI-CD-GUIDE.md](../docs/deployment/CI-CD-GUIDE.md)

**Code Signing:**
[docs/deployment/CODE-SIGNING.md](../docs/deployment/CODE-SIGNING.md)

---

## 🤝 Getting Help

1. Check workflow logs in GitHub Actions
2. Review documentation in [docs/deployment/](../docs/deployment/)
3. Ask in team chat
4. Create issue in repository

---

**Workflows Version:** 1.0
**Maintained by:** DevOps Team
**Last Updated:** November 1, 2025
