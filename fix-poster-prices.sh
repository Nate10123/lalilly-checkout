#!/usr/bin/env bash
# Fixes the "Lillys Poster" retail prices on Printful to match what
# lalilly-checkout actually charges (see store.js / functions/_shared/products.js).
#
# Usage:
#   export PRINTFUL_API_KEY="your_real_key_here"
#   ./fix-poster-prices.sh
#
# Optional, only if your Printful token spans multiple stores:
#   export PRINTFUL_STORE_ID="your_store_id"

set -euo pipefail

if [[ -z "${PRINTFUL_API_KEY:-}" ]]; then
  echo "Set PRINTFUL_API_KEY first (export PRINTFUL_API_KEY=...)." >&2
  exit 1
fi

# sync_variant_id -> correct retail price (matches sizePricingCents in products.js)
declare -A PRICES=(
  [5442339744]="14.00"  # 21x30 cm
  [5442339745]="18.50"  # 30x40 cm
  [5442339743]="19.50"  # A2 (42x59.4 cm)
  [5442339746]="23.50"  # 50x70 cm
  [5442339742]="27.00"  # A1 (59.4x84.1 cm)
  [5442339747]="32.00"  # 70x100 cm
)

HEADERS=(-H "Authorization: Bearer ${PRINTFUL_API_KEY}" -H "Content-Type: application/json")
if [[ -n "${PRINTFUL_STORE_ID:-}" ]]; then
  HEADERS+=(-H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}")
fi

for variant_id in "${!PRICES[@]}"; do
  price="${PRICES[$variant_id]}"
  echo "Updating sync variant $variant_id -> \$${price}..."
  response=$(curl -s -X PUT "https://api.printful.com/store/variants/${variant_id}" \
    "${HEADERS[@]}" \
    -d "{\"retail_price\": \"${price}\"}")
  echo "$response"
  echo "---"
done

echo "Done. Re-check the 'Edit retail prices' page or re-fetch the sync product to confirm."
