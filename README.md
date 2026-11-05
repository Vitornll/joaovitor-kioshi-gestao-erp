# Kioshi Gestão

Sistema de gestão (ERP) da **Kioshi Controle de Pragas** — agenda, clientes e
contratos, estoque de produtos químicos, frota, RH, conformidade, CRM,
financeiro, relatórios e um app de campo para os técnicos.

Um único código-fonte (`apps/web`) gera três produtos:

- **Web** — app comum, roda em qualquer navegador.
- **Windows** (`apps/desktop`, Electron) — instalador `.exe`.
- **Android** (`apps/mobile`, Capacitor) — `.apk` instalável (iOS/macOS no futuro, a partir da mesma base).

O backend é o Supabase (banco de dados, login de usuários e armazenamento de
arquivos na nuvem), então o app funciona igual no computador do escritório e
no celular dos técnicos, com os mesmos dados.

## Como os instaladores são gerados

Este repositório tem o GitHub Actions configurado (pasta `.github/workflows`)
para compilar automaticamente, a cada alteração enviada para `main`:

- `build-windows.yml` → gera o instalador Windows (`.exe`), disponível na aba
  **Actions** do repositório, dentro do artefato `kioshi-gestao-windows-installer`.
- `build-android.yml` → gera o `.apk` do Android, no artefato
  `kioshi-gestao-android-apk`.
- `ci.yml` → valida rapidamente que o app web compila sem erros.

Não é necessário instalar nada manualmente: basta abrir a aba **Actions** no
GitHub, aguardar a execução terminar e baixar o artefato.

## Desenvolvimento local

```bash
cd apps/web
npm install
npm run dev        # app web em http://localhost:5173

npm run build:web      # build para publicação na web
npm run build:desktop  # build para o Electron
npm run build:mobile   # build para o Capacitor
```

Para rodar o Android localmente com o Android Studio:

```bash
cd apps/mobile
npm install
rm -rf www && cp -r ../web/dist/mobile www
npx cap add android   # primeira vez
npx cap open android
```

## Estrutura

```
apps/
  web/       React + TypeScript + Vite + Supabase (código-fonte único)
  desktop/   Empacotamento Electron (Windows)
  mobile/    Empacotamento Capacitor (Android, depois iOS)
docs/
  schema.sql Esquema completo do banco de dados (Supabase/Postgres)
```
