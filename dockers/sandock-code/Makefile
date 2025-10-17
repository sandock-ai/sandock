.PHONY: build push test clean

IMAGE_NAME ?= sandock-code
DOCKER_USERNAME ?= sandockai
TAG ?= latest
FULL_IMAGE_NAME = $(DOCKER_USERNAME)/$(IMAGE_NAME):$(TAG)

build:
	@echo "Building Docker image locally: $(FULL_IMAGE_NAME)"
	docker build -t $(FULL_IMAGE_NAME) .

push:
	@echo "Building and pushing multi-architecture image: $(FULL_IMAGE_NAME)"
	@echo "Platforms: linux/amd64, linux/arm64"
	docker buildx build --platform linux/amd64,linux/arm64 \
		-t $(FULL_IMAGE_NAME) \
		--push .

build-multiarch: push

test:
	@echo "Testing Docker image..."
	@docker run --rm $(FULL_IMAGE_NAME) node --version
	@docker run --rm $(FULL_IMAGE_NAME) pnpm --version
	@docker run --rm $(FULL_IMAGE_NAME) tsx --version
	@docker run --rm $(FULL_IMAGE_NAME) python --version
	@docker run --rm $(FULL_IMAGE_NAME) deno --version
	@docker run --rm $(FULL_IMAGE_NAME) code-server --version
	@echo "All tools verified!"

clean:
	@echo "Cleaning up local images..."
	docker rmi $(IMAGE_NAME):$(TAG) || true
	docker rmi $(FULL_IMAGE_NAME) || true

help:
	@echo "Available targets:"
	@echo "  build           - Build Docker image locally (current platform only)"
	@echo "  push            - Build and push multi-architecture image (amd64, arm64)"
	@echo "  build-multiarch - Alias for push command"
	@echo "  test            - Test the Docker image"
	@echo "  clean           - Remove local Docker images"
	@echo ""
	@echo "Variables:"
	@echo "  DOCKER_USERNAME - Docker Hub username (default: sandockai)"
	@echo "  IMAGE_NAME      - Image name (default: sandock-code)"
	@echo "  TAG             - Image tag (default: latest)"
	@echo ""
	@echo "Examples:"
	@echo "  make build"
	@echo "  make push"
	@echo "  make push DOCKER_USERNAME=myusername TAG=v1.0.0"
