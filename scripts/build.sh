#!/bin/bash

# Intelligent Finder - Build Script
# Handles local and CI builds with proper error handling

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BUILD_MODE="${1:-production}"
PLATFORM="${2:-current}"

# Print functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi

    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        print_error "Node.js version 20 or higher is required"
        exit 1
    fi

    print_info "Node.js version: $(node --version)"
    print_info "NPM version: $(npm --version)"
}

# Clean build directories
clean_build() {
    print_info "Cleaning build directories..."
    rm -rf dist
    rm -rf coverage
    rm -rf .nyc_output
    print_info "Build directories cleaned"
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies..."

    if [ -f "package-lock.json" ]; then
        npm ci --prefer-offline --no-audit
    else
        npm install
    fi

    print_info "Dependencies installed"
}

# Run linting
run_lint() {
    print_info "Running linter..."
    npm run lint
    print_info "Linting passed"
}

# Run type checking
run_typecheck() {
    print_info "Running type checker..."
    npm run typecheck
    print_info "Type checking passed"
}

# Run tests
run_tests() {
    if [ "$BUILD_MODE" == "development" ]; then
        print_warn "Skipping tests in development mode"
        return
    fi

    print_info "Running tests..."
    npm run test:unit
    print_info "Tests passed"
}

# Build application
build_app() {
    print_info "Building application for $BUILD_MODE mode..."

    if [ "$BUILD_MODE" == "production" ]; then
        NODE_ENV=production npm run build
    else
        npm run build
    fi

    print_info "Application built successfully"
}

# Build Electron packages
build_electron() {
    if [ "$PLATFORM" == "current" ]; then
        print_info "Building Electron package for current platform..."
        npm run build:release
    else
        print_info "Building Electron package for $PLATFORM..."
        case $PLATFORM in
            mac)
                npm run build:release -- --mac
                ;;
            win)
                npm run build:release -- --win
                ;;
            linux)
                npm run build:release -- --linux
                ;;
            all)
                npm run build:release -- --mac --win --linux
                ;;
            *)
                print_error "Unknown platform: $PLATFORM"
                exit 1
                ;;
        esac
    fi

    print_info "Electron package built successfully"
}

# Generate build report
generate_report() {
    print_info "Generating build report..."

    BUILD_REPORT="build-report.txt"
    {
        echo "Intelligent Finder - Build Report"
        echo "=================================="
        echo ""
        echo "Build Date: $(date)"
        echo "Build Mode: $BUILD_MODE"
        echo "Platform: $PLATFORM"
        echo "Node Version: $(node --version)"
        echo "NPM Version: $(npm --version)"
        echo ""
        echo "Build Output:"
        ls -lh dist/ || echo "No dist directory found"
    } > "$BUILD_REPORT"

    print_info "Build report generated: $BUILD_REPORT"
}

# Main execution
main() {
    print_info "Starting Intelligent Finder build process"
    print_info "Build mode: $BUILD_MODE"
    print_info "Platform: $PLATFORM"

    check_prerequisites
    clean_build
    install_dependencies
    run_lint
    run_typecheck
    run_tests
    build_app

    if [ "$BUILD_MODE" == "production" ]; then
        build_electron
    fi

    generate_report

    print_info "Build completed successfully! 🎉"
}

# Handle errors
trap 'print_error "Build failed at line $LINENO"' ERR

# Run main
main

exit 0
