# AskMyPDF AI Frontend

React + TypeScript + Vite frontend for AskMyPDF AI.

The frontend follows the same simple structure style as the VeriText AI frontend while keeping AskMyPDF's PDF upload, PDF chat, session history, file management, and PDF download features.

## Structure

```text
frontend/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── App.tsx
│   ├── AppRouter.tsx
│   ├── api.ts
│   ├── App.css
│   ├── index.css
│   └── main.tsx
├── .env.example
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

No authentication or database is used by the frontend.
