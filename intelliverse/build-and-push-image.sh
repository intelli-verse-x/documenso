#!/usr/bin/env bash
#
# Build the deeply-branded (Intelliverse + Toba Tech) Documenso image and push
# it to ECR. The deep branding lives in the app source (logos, theme, strings,
# hostname-aware shell), so we must build a custom image rather than use the
# upstream documenso/documenso image.
#
# This is the manual equivalent of the CI/CD pipeline
# (intelli-verse-kube-infra/.github/workflows/documenso-build.yml). Prefer the
# pipeline for normal deploys; use this for local/break-glass builds.
#
# Usage:
#   aws sso login   # or have AWS creds in the environment
#   ./intelliverse/build-and-push-image.sh [tag]
#
# Defaults the registry repo to the account ECR. Override with
# DOCKER_REPOSITORY=<registry>/<name>.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REGISTRY="${ECR_REGISTRY:-970547373533.dkr.ecr.us-east-1.amazonaws.com}"
export DOCKER_REPOSITORY="${DOCKER_REPOSITORY:-$ECR_REGISTRY/documenso}"
TAG="${1:-latest}"

echo "==> Building Intelliverse/Toba-branded Documenso image"
echo "    repository: $DOCKER_REPOSITORY"
echo "    tag:        $TAG"

# Log in to ECR (no-op friendly if already authenticated).
echo "==> Logging in to ECR ($ECR_REGISTRY)"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# Ensure the repository exists.
aws ecr describe-repositories --repository-names documenso --region "$AWS_REGION" >/dev/null 2>&1 || \
  aws ecr create-repository --repository-name documenso --region "$AWS_REGION" \
    --image-scanning-configuration scanOnPush=true --image-tag-mutability MUTABLE

# Reuse upstream build script: it tags $DOCKER_REPOSITORY:latest and :<git-sha>.
echo "==> Building image via docker/build.sh"
"$REPO_ROOT/docker/build.sh"

# If a non-latest tag was requested, add it.
if [[ "$TAG" != "latest" ]]; then
  docker tag "$DOCKER_REPOSITORY:latest" "$DOCKER_REPOSITORY:$TAG"
fi

echo "==> Pushing $DOCKER_REPOSITORY (all tags)"
docker push "$DOCKER_REPOSITORY" --all-tags

echo "==> Done. Roll out with:"
echo "    kubectl set image deployment/documenso documenso=$DOCKER_REPOSITORY:$TAG -n documenso"
