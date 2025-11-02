#!/bin/bash

# Intelligent Finder - Release Script
# Automates versioning, building, and publishing releases

set -e
set -u

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
RELEASE_TYPE="${1:-patch}"  # major, minor, patch
DRY_RUN="${2:-false}"

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if on main branch
check_branch() {
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
        print_error "Releases must be done from main/master branch"
        print_error "Current branch: $CURRENT_BRANCH"
        exit 1
    fi
    print_info "On correct branch: $CURRENT_BRANCH"
}

# Check for uncommitted changes
check_git_status() {
    if [ -n "$(git status --porcelain)" ]; then
        print_error "You have uncommitted changes"
        git status --short
        exit 1
    fi
    print_info "Git working directory is clean"
}

# Pull latest changes
pull_latest() {
    print_info "Pulling latest changes..."
    git pull origin "$(git branch --show-current)"
}

# Run all tests
run_tests() {
    print_step "Running test suite..."
    npm run test
    npm run test:e2e
    print_info "All tests passed"
}

# Bump version
bump_version() {
    print_step "Bumping version ($RELEASE_TYPE)..."

    CURRENT_VERSION=$(node -p "require('./package.json').version")
    print_info "Current version: $CURRENT_VERSION"

    if [ "$DRY_RUN" != "true" ]; then
        npm version "$RELEASE_TYPE" --no-git-tag-version
    fi

    NEW_VERSION=$(node -p "require('./package.json').version")
    print_info "New version: $NEW_VERSION"
}

# Generate changelog
generate_changelog() {
    print_step "Generating changelog..."

    LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

    if [ -n "$LAST_TAG" ]; then
        print_info "Changes since $LAST_TAG:"
        git log "$LAST_TAG"..HEAD --pretty=format:"* %s (%h)" > CHANGELOG_TEMP.md
    else
        print_info "First release - no previous tags"
        echo "* Initial release" > CHANGELOG_TEMP.md
    fi

    cat CHANGELOG_TEMP.md
    rm CHANGELOG_TEMP.md
}

# Build release
build_release() {
    print_step "Building release packages..."

    if [ "$DRY_RUN" != "true" ]; then
        npm run build:release -- --mac --win --linux
        print_info "Release packages built"
    else
        print_warn "Dry run - skipping actual build"
    fi
}

# Create git tag
create_tag() {
    VERSION=$(node -p "require('./package.json').version")
    TAG="v$VERSION"

    print_step "Creating git tag: $TAG"

    if [ "$DRY_RUN" != "true" ]; then
        git add package.json package-lock.json
        git commit -m "chore: bump version to $VERSION"
        git tag -a "$TAG" -m "Release $TAG"
        print_info "Tag created: $TAG"
    else
        print_warn "Dry run - skipping tag creation"
    fi
}

# Push changes
push_changes() {
    print_step "Pushing changes to remote..."

    if [ "$DRY_RUN" != "true" ]; then
        git push origin "$(git branch --show-current)"
        git push origin --tags
        print_info "Changes pushed to remote"
    else
        print_warn "Dry run - skipping push"
    fi
}

# Create GitHub release
create_github_release() {
    VERSION=$(node -p "require('./package.json').version")
    TAG="v$VERSION"

    print_step "Creating GitHub release..."

    if [ "$DRY_RUN" != "true" ]; then
        if command -v gh &> /dev/null; then
            gh release create "$TAG" \
                --title "Intelligent Finder $TAG" \
                --notes-file CHANGELOG_TEMP.md \
                --draft
            print_info "GitHub release created (draft)"
        else
            print_warn "GitHub CLI not found - create release manually"
        fi
    else
        print_warn "Dry run - skipping GitHub release"
    fi
}

# Notify team
notify_team() {
    VERSION=$(node -p "require('./package.json').version")

    print_info "================================================"
    print_info "Release v$VERSION completed successfully! 🎉"
    print_info "================================================"

    if [ "$DRY_RUN" == "true" ]; then
        print_warn "This was a DRY RUN - no changes were made"
    fi
}

# Main execution
main() {
    print_info "Starting release process"
    print_info "Release type: $RELEASE_TYPE"

    if [ "$DRY_RUN" == "true" ]; then
        print_warn "DRY RUN MODE - No changes will be made"
    fi

    check_branch
    check_git_status
    pull_latest
    run_tests
    bump_version
    generate_changelog
    build_release
    create_tag
    push_changes
    create_github_release
    notify_team
}

# Handle errors
trap 'print_error "Release failed at line $LINENO"' ERR

# Confirm before running
if [ "$DRY_RUN" != "true" ]; then
    echo -e "${YELLOW}This will create a $RELEASE_TYPE release. Continue? (y/N)${NC}"
    read -r CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        print_info "Release cancelled"
        exit 0
    fi
fi

# Run main
main

exit 0
