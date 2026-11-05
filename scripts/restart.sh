#!/bin/bash
#meant to be executed on kubernetes cluster
set -e

NAMESPACE="jamsa"

echo "Restarting frontend..."
microk8s kubectl rollout restart deployment/frontend -n "$NAMESPACE"

echo "Restarting backend..."
microk8s kubectl rollout restart deployment/backend -n "$NAMESPACE"

echo ""
echo "Waiting for frontend..."
microk8s kubectl rollout status deployment/frontend -n "$NAMESPACE"

echo ""
echo "Waiting for backend..."
microk8s kubectl rollout status deployment/backend -n "$NAMESPACE"

echo ""
echo "Both deployments restarted successfully!"

microk8s kubectl get pods -n "$NAMESPACE"