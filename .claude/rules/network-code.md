---
paths: []
---

# Network Code Rules

> **Web-era note:** The game is single-player — there is no `src/networking/` directory
> and no networking layer. These rules are retained for reference in case a future
> milestone adds networked features. `paths: []` means this rule file will not match
> any files in the current repo.

- Server is AUTHORITATIVE for all gameplay-critical state — never trust the client
- All network messages must be versioned for forward/backward compatibility
- Client predicts locally, reconciles with server — implement rollback for mispredictions
- Handle disconnection, reconnection, and host migration gracefully
- Rate-limit all network logging to prevent log flooding
- All networked values must specify replication strategy: reliable/unreliable, frequency, interpolation
- Bandwidth budget: define and track per-message-type bandwidth usage
- Security: validate all incoming packet sizes and field ranges
