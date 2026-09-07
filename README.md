# Enduragent Prototypes

A standalone React and TypeScript application for trying fictional flows with the versioned `@enduragent/ui` package. The experiments cover day review, Chat, Training, Plan presentation, and the complete Plan-in-Chat catalogue. No experiment connects to a service.

Use Node 24 and the pnpm version in `packageManager`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open an experiment:

- `/experiments/day-review`: select a day, open its review, and cancel or confirm discard.
- `/experiments/chat`: answer a sample question, send or queue a message, stop a response, and inspect attachment and retry states.
- `/experiments/training`: inspect a weekly summary, accessible trend data, and a ride review.
- `/experiments/plan-presentation`: inspect shared question, draft, stale, activation, and recovery presentations.
- `/experiments/plan-in-chat/`: exercise the original 55-entry Plan-in-Chat catalogue and its variations.

Each experiment owns independent fictional state. Scenario controls and reset make states repeatable. The appearance control switches between light and dark. Reloading resets the small presentation experiments; the Plan-in-Chat catalogue restores its matching fictional draft. These are presentation experiments; they do not execute real coaching, attachment processing, or plan activation.

```sh
pnpm check
pnpm build
pnpm test:e2e
pnpm check:ui-parity /path/to/app/renderer
```

The browser gate runs the built application at wide and compact sizes in both appearances. It checks selection, dialog focus, discard recovery, reset, local fonts, theme switching, source identity, storage isolation, and unexpected requests. Screenshots and traces are retained under the ignored Playwright output directories.

For shared React experiments, the UI package owns controls, reusable patterns, tokens, fonts, and palette application. This application owns fictional data, state transitions, review controls, routing, and viewport layout. Consumer CSS imports the public UI stylesheet and compiles Tailwind utilities once. Never import sibling source, copy control implementations, or connect experiments to credentials, application storage, native bridges, or services.

The Plan-in-Chat catalogue uses typed state transitions, React components, Tailwind styles, and shared Plan patterns from `@enduragent/ui`. It uses the isolated fictional storage key `enduragent-fictional-plan-catalogue-v1` to restore matching scenario drafts after reload. Reset this fixture restores its seed. Source checks prohibit HTML injection, legacy runtime adapters, application storage, and native APIs. The original catalogue remains the frozen visual reference.

Shared experiment review details show the installed UI version and source revision. A production build emits `review-source.json` with schema version, repository, revision, dirty state, installed UI version, UI content digest, lockfile digest, and each output's SHA-256 digest. Uncommitted builds are explicitly marked.

Both consumers must pin the same GitHub release asset in `dependencies["@enduragent/ui"]`: `https://github.com/yerzhansa/enduragent-ui/releases/download/v<version>/enduragent-ui-<version>.tgz`. The tag, filename, installed package, and lockfile package version must match the same stable SemVer version, starting with `0.1.0`. Versions use `major.minor.patch`, such as `0.1.1` and `0.2.0`, without leading zeros, prerelease labels, or build metadata. `0.0.0` is reserved for unpublished local proof. The package is distributed through GitHub releases.

Install the exact asset with pnpm 11 to retain its SHA512 integrity in the lockfile. Commit both the dependency URL and lockfile, and use `pnpm install --frozen-lockfile` thereafter. `check:ui-parity` validates each consumer's release URL, importer, resolved tarball, package version, SHA512 integrity, and snapshot. It also compares installed versions and package bytes. Mutable release URLs, registry versions, ranges, Git dependencies, and file links fail the default check.

Before the first release asset exists, use a disposable checkout with a packed UI tarball and keep the temporary dependency and lockfile changes uncommitted. Run `check:ui-parity <other-consumer> --allow-local` only for this local proof. The flag skips release URL and lockfile validation while still requiring identical installed versions and package bytes.

This experiment is a development aid. It is not an approved training feature and does not modify a training plan.

The frozen screenshot driver is `tools/plan-parity/capture-v4.mjs`. Its `all-cases.json` covers 111 selectable states and 52 interaction journeys in wide and compact layouts, each in light and dark, for 652 comparisons. It requires the same browser and operating-system environment, verifies source and evidence hashes, and rejects even one changed pixel. Baselines and results remain local.

```sh
node tools/plan-parity/capture-v4.mjs capture --reference /path/to/original --baseline /path/to/new-baseline --cases tools/plan-parity/all-cases.json
node tools/plan-parity/capture-v4.mjs compare --baseline /path/to/sealed-baseline --cases tools/plan-parity/all-cases.json --target http://127.0.0.1:5173/experiments/plan-in-chat/ --output /path/to/new-results
```

Capture accepts only the recorded original source. Comparison checks the sealed driver, cases, screenshots, and visible UI evidence before reporting parity. Never overwrite a sealed baseline or change its driver.
