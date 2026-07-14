#!/usr/bin/env bash
# Backfills existing BYOC bindings into the usage_tracker's canister_to_namespace
# map. Only needed for bindings that were registered before the registry
# started calling register_canister_namespace automatically. Idempotent — safe
# to re-run.
#
# Usage: ./scripts/backfill-byoc-usage-tracker.sh [ic|local]

set -euo pipefail

NETWORK="${1:-ic}"

echo "Listing external bindings from mcp_registry on network: $NETWORK"
RAW="$(dfx canister --network "$NETWORK" call mcp_registry list_external_bindings)"

# Parse Candid output. Each binding record contains:
#   canister_id = principal "..."
#   namespace   = "..."
# We walk the records in order and pair the canister_id with the next namespace
# that follows it (they always appear together within one record).
python3 - <<PY
import re, subprocess, sys

raw = """$RAW"""
network = "$NETWORK"

# Split into record blocks and pull out principal + namespace per block.
# Candid field order inside a record isn't guaranteed textually, so parse each
# record independently.
records = re.findall(r"record\s*\{([^}]*)\}", raw, flags=re.DOTALL)
pairs = []
for body in records:
    cid_match = re.search(r'canister_id\s*=\s*principal\s+"([^"]+)"', body)
    ns_match  = re.search(r'namespace\s*=\s*"([^"]+)"', body)
    if cid_match and ns_match:
        pairs.append((cid_match.group(1), ns_match.group(1)))

if not pairs:
    print("No external bindings found — nothing to backfill.")
    sys.exit(0)

print(f"Found {len(pairs)} binding(s). Registering each with usage_tracker...")
failures = []
for cid, ns in pairs:
    print(f"  -> {ns}  ({cid})")
    try:
        out = subprocess.run(
            ["dfx", "canister", "--network", network, "call",
             "usage_tracker", "register_canister_namespace",
             f'(principal "{cid}", "{ns}")'],
            check=True, capture_output=True, text=True,
        )
        result = out.stdout.strip()
        if "err" in result:
            print(f"     ! {result}")
            failures.append((ns, cid, result))
        else:
            print(f"     ok")
    except subprocess.CalledProcessError as e:
        print(f"     ! call failed: {e.stderr.strip()}")
        failures.append((ns, cid, e.stderr.strip()))

print()
if failures:
    print(f"{len(failures)} failure(s):")
    for ns, cid, msg in failures:
        print(f"  {ns}  {cid}  -> {msg}")
    sys.exit(1)
else:
    print(f"Backfill complete. {len(pairs)} binding(s) registered.")
PY
