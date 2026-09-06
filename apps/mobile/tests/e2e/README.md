# E2E tests

Reserved for real end-to-end tests driven by a device/simulator-level framework
(e.g. Detox, Maestro, Appium) that exercises the compiled app rather than
rendering screens in Jest.

No such framework is configured in this project yet, so this directory is
currently empty. The suites previously named `e2e/__tests__/*` were actually
Jest + React Native Testing Library tests that mount several screens in
sequence to verify a user journey (e.g. signup → doctor search → checkout).
Those are integration tests, not true E2E tests, and live in
`tests/integration/journeys/`.

When a real E2E framework is added, its specs belong here.
