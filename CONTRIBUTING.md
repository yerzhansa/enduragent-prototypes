# Contributing

Keep experiments fictional and isolated. Reuse the public UI package for controls and styles. Keep each experiment's state local, deterministic, and resettable.

Run `pnpm check`, `pnpm build`, and `pnpm test:e2e` before review. Inspect captured states in both appearances and layouts. Review identity must match the built artifact being discussed.

Pin the exact GitHub release asset URL described in the README. Use stable SemVer starting at `0.1.0`. Match its tag and filename to the installed package version, and retain the pnpm lockfile with SHA512 integrity. Compare the installed package with the other consumer using `pnpm check:ui-parity /path/to/consumer`. Use `--allow-local` only for explicit disposable tarball proof and keep those dependency changes uncommitted.
