#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AppSwap — Deploy to Initia EVM rollup
# Usage: ./scripts/deploy.sh [local|testnet]
# ============================================================

NETWORK=${1:-local}

case "$NETWORK" in
  local)
    RPC_URL="http://127.0.0.1:8545"
    ;;
  testnet)
    RPC_URL="https://json-rpc.testnet.initia.xyz"
    ;;
  *)
    echo "Usage: $0 [local|testnet]"
    exit 1
    ;;
esac

# Require PRIVATE_KEY to be set
if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "ERROR: PRIVATE_KEY env variable not set"
  echo "Export your deployer private key: export PRIVATE_KEY=0x..."
  exit 1
fi

echo "Deploying AppSwap contracts to: $NETWORK ($RPC_URL)"
echo ""

forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --legacy \
  -vvv

echo ""
echo "Deployment complete. Check the output above for contract addresses."
echo "Copy addresses into frontend/.env (see frontend/.env.example for variable names)."
