#!/bin/bash
# Sandock Python Docker Image Build Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="seey/sandock-python"
VERSION="1.0.0"
PLATFORMS="linux/amd64,linux/arm64"

# Functions
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    print_success "Docker is installed"
}

# Check if logged in to Docker Hub
check_docker_login() {
    if ! docker info | grep -q "Username"; then
        print_warning "Not logged in to Docker Hub"
        print_info "Please run: docker login"
        exit 1
    fi
    print_success "Logged in to Docker Hub"
}

# Build local image
build_local() {
    print_header "Building Local Image"
    print_info "Building ${IMAGE_NAME}:latest..."
    
    docker build -t ${IMAGE_NAME}:latest .
    
    print_success "Local build completed"
    print_info "Test with: docker run --rm ${IMAGE_NAME}:latest python --version"
}

# Build and push multi-platform image
build_and_push() {
    print_header "Building and Pushing Multi-Platform Image"
    
    # Check if buildx is available
    if ! docker buildx version &> /dev/null; then
        print_error "docker buildx is not available"
        exit 1
    fi
    
    # Create builder if it doesn't exist
    if ! docker buildx inspect sandock-builder &> /dev/null; then
        print_info "Creating buildx builder..."
        docker buildx create --use --name sandock-builder
    else
        print_info "Using existing buildx builder..."
        docker buildx use sandock-builder
    fi
    
    # Bootstrap builder
    print_info "Bootstrapping builder..."
    docker buildx inspect --bootstrap
    
    # Build and push
    print_info "Building for platforms: ${PLATFORMS}"
    print_info "Tags: latest, ${VERSION}"
    
    docker buildx build \
        --platform ${PLATFORMS} \
        -t ${IMAGE_NAME}:latest \
        -t ${IMAGE_NAME}:${VERSION} \
        -t ${IMAGE_NAME}:$(echo ${VERSION} | cut -d. -f1,2) \
        -t ${IMAGE_NAME}:$(echo ${VERSION} | cut -d. -f1) \
        --push \
        .
    
    print_success "Build and push completed"
    print_info "Image available at: ${IMAGE_NAME}:latest"
    print_info "Version tags: ${VERSION}, $(echo ${VERSION} | cut -d. -f1,2), $(echo ${VERSION} | cut -d. -f1)"
}

# Test image
test_image() {
    print_header "Testing Image"
    
    print_info "Testing Python version..."
    docker run --rm ${IMAGE_NAME}:latest python --version
    
    print_info "Testing pip..."
    docker run --rm ${IMAGE_NAME}:latest pip --version
    
    print_info "Testing numpy..."
    docker run --rm ${IMAGE_NAME}:latest python -c "import numpy; print(f'numpy {numpy.__version__}')"
    
    print_info "Testing pandas..."
    docker run --rm ${IMAGE_NAME}:latest python -c "import pandas; print(f'pandas {pandas.__version__}')"
    
    print_info "Testing requests..."
    docker run --rm ${IMAGE_NAME}:latest python -c "import requests; print(f'requests {requests.__version__}')"
    
    print_success "All tests passed"
}

# Show usage
usage() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  local       Build local image only (fast, single platform)"
    echo "  push        Build and push multi-platform image to Docker Hub"
    echo "  test        Test the image"
    echo "  all         Build local, push, and test"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 local    # Quick local build for testing"
    echo "  $0 push     # Build and push to Docker Hub"
    echo "  $0 all      # Complete workflow"
}

# Main script
main() {
    print_header "Sandock Python Docker Image Builder"
    
    check_docker
    
    case "${1:-help}" in
        local)
            build_local
            ;;
        push)
            check_docker_login
            build_and_push
            ;;
        test)
            test_image
            ;;
        all)
            check_docker_login
            build_local
            build_and_push
            test_image
            print_success "All operations completed successfully!"
            ;;
        help|*)
            usage
            ;;
    esac
}

main "$@"

