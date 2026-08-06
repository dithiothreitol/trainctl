import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    // Część testów pisze realne pliki (eksport całego planu to ~90 plików FIT)
    // albo uruchamia prawdziwe binarki przez execFileSync. Domyślne 5 s wystarcza
    // na bezczynnej maszynie, ale pod obciążeniem daje fałszywe czerwone.
    testTimeout: 30_000,
  },
})
