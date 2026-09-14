# Test Automation Architecture (Playwright)

Welcome to the End-to-End (E2E) testing framework for `schoolManagment___PROJECT`.

## Setup Instructions
1. Install dependencies:
   ```bash
   npm install -D @playwright/test @seontechnologies/playwright-utils @faker-js/faker
   ```
2. Install browsers:
   ```bash
   npx playwright install --with-deps
   ```
3. Copy `.env.example` to `.env` and fill the variables.

## Unit tests (règles pures, sans navigateur)
```bash
npm run test:unit
```
Couvre `app/api/lib/schoolScopeRules.js` (cloisonnement multi-tenant), `tenantCache.js`, `utils/themeSanitizer.js` et `schoolGeneratorRules.js`. Lanceur `node --test`, fichiers `tests/unit/*.unit.mjs` (hors motif Playwright).

## Running Tests
- **Headless mode** (CI/CD default):
  ```bash
  npm run test:e2e
  ```
- **UI mode** (Debugging and writing tests):
  ```bash
  npx playwright test --ui
  ```

## Architecture Overview
This framework uses the [Playwright Utils composition pattern](https://github.com/seontechnologies/playwright-utils):
- **`tests/support/merged-fixtures.ts`**: Single import entry point combining all specific fixtures.
- **`tests/support/factories/`**: Dynamic data generators (`@faker-js/faker`) representing entities (Users, Classes). API-First data seeding prevents brittle state logic.
- **`tests/e2e/`**: Contains the E2E specifications grouped by features.

## Best Practices
- **Never rely on the UI for test setup**: Use API calls or direct DB seeding to prepare the data state (Factories + API Request fixture).
- **Isolation**: Each test runs with a clean profile, mitigating side-effects.
- **Resilient Locators**: Always use `data-testid` (e.g. `page.getByTestId(...)`) where possible to decouple tests from styling changes.

## CI Integration
Tests are configured to run fully parallel (`fullyParallel: true`). Traces and videos are retained only on failures to conserve storage. Ensure `.nvmrc` is respected (Node 24).
