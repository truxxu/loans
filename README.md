# Préstamos PWA

Gestión de préstamos personales, 100% local (IndexedDB), instalable y offline.

**App:** https://truxxu.github.io/loans/

```bash
npm install
npm run dev
```

`npm test` corre los tests (motor de intereses y componentes). `npm run build` genera
`dist/` listo para cualquier hosting estático.

Cada push a `main` se publica en GitHub Pages con `.github/workflows/deploy.yml`
(tests + build + deploy). En el repositorio, Settings → Pages → Source debe ser
"GitHub Actions". El contexto del proyecto y las reglas de negocio están
en [CLAUDE.md](./CLAUDE.md).
