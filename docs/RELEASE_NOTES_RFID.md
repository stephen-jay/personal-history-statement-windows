# Release Notes - RFID UID Normalization

## Summary
The RFID card system has been updated to provide a more resilient and user-friendly experience when handling Card UIDs.

## Changes
- **Case-Insensitive Matching:** Card assignment, unassignment, and lookups now ignore character casing (e.g., `35A3E846` matches `35a3e846`).
- **Whitespace Resilience:** Leading and trailing spaces are now automatically trimmed from UID inputs before processing.
- **Improved Validation:**
  - Prevented duplicate card registrations with different casing (e.g., registering "abcd" will now fail if "ABCD" is already in the system).
  - Explicit error feedback: If an assignment is attempted for a non-existent card, the system now provides a clear "Card UID not found" error instead of failing silently.

## Verification
A regression test has been added at `scripts/db/test-uid-normalization.js`. This script can be run to verify that variant inputs (uppercase, lowercase, mixed-case, and padded) all resolve to the same database record.

```bash
# To run the verification test:
$env:DATABASE_URL = "your_database_url"
node scripts/db/test-uid-normalization.js
```
