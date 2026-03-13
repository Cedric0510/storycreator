# Load Battery (Preview + Long Navigation + Successive Imports)

This battery runs an end-to-end memory profile on the studio:
- imports large synthetic ZIP bundles,
- runs long preview navigation to the end,
- repeats import/preview cycles,
- writes a JSON memory report.

## 1) Install browser runtime (once)

```bash
npm run test:load:install
```

## 2) Run battery

```bash
npm run test:load
```

The report is attached in Playwright results and also saved under:
- `test-results/load/.../memory-load-report.json`

## Optional environment variables

- `LOAD_IMPORT_CYCLES` (default `6`)
- `LOAD_CINEMATIC_BLOCKS` (default `220`)
- `LOAD_CHAPTER_SIZE` (default `55`)
- `LOAD_ASSET_COUNT` (default `48`)
- `LOAD_DUPLICATE_STRIDE` (default `3`)
- `LOAD_PREVIEW_SAMPLE_EVERY` (default `25`)
- `LOAD_MAX_HEAP_GROWTH_MB` (default `180`)
- `LOAD_MAX_STORAGE_GROWTH_MB` (default `220`)

Server options:
- `LOAD_TEST_BASE_URL` to reuse an already-running app (otherwise the test starts Next on port `3101`)
- `LOAD_TEST_PORT` to change auto-start port (default `3101`)
- `LOAD_TEST_HEADED=1` to run headed
- `LOAD_TEST_TIMEOUT_MS` to override Playwright global timeout (default `900000` = 15 min)

Required login credentials (author/admin account):
- `LOAD_TEST_EMAIL`
- `LOAD_TEST_PASSWORD`
