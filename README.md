# 👞 PasoFirme — Sistema de Gestión de Calzado

Aplicación web full-stack para la gestión de una fábrica/tienda de zapatos y botas.
CRUD de productos de calzado con dashboard, reportes y registro de accesos.

Proyecto académico que cumple los **13 requisitos** solicitados.

## ✅ Requisitos cumplidos

| # | Requisito | Implementación |
|---|-----------|----------------|
| 1 | Objetivo definido | Sistema de gestión de productos de calzado para fábrica/zapatería |
| 2 | Menú | Navbar editorial con: Resumen, Catálogo, Reporte, Usuarios (admin), Registro (admin) |
| 3 | CRUD con eliminación lógica | Tabla `products` con campo `is_active` — soft delete + restore |
| 4 | Frontend React | React 18 + Vite + React Router 6 + Chart.js + lucide-react |
| 5 | Backend Node.js | Express + SQLite nativo (`node:sqlite`) |
| 6 | Validaciones | `express-validator` en backend + validación en formularios React |
| 7 | Reporte PDF | jsPDF + jspdf-autotable (catálogo de productos con filtros, resumen, multipágina) |
| 8 | Gráfico estadístico | Chart.js — **donut** distribución por tipo + **bar** stock por material |
| 9 | Login + permisos + CAPTCHA | JWT + roles `admin`/`user` + svg-captcha (server-side) |
| 10 | Fortaleza de contraseña + encriptado | Medidor débil/intermedio/fuerte + bcryptjs |
| 11 | Log de accesos | Tabla `access_logs` con `username, ip, evento, browser, fecha/hora` |
| 12 | GitHub | Repositorio del grupo (cargar este código) |
| 13 | Deploy (opcional) | Compatible con Render (back) + Vercel/Netlify (front) |

## 🎨 Dirección de diseño "Editorial Craft"

Sistema visual inspirado en catálogos editoriales artesanales (John Lobb, Aesop, The Gentlewoman). No es otro dashboard SaaS genérico:

- **Tipografía**: Fraunces (display serif variable) + Geist + Geist Mono
- **Paleta**: pergamino + tinta cálida + acentos cuero/cognac/brass
- **Iconos**: lucide-react con stroke-width 1.5
- **Layouts**: split editorial en auth, tabla densa con serif para modelos, drawer lateral en lugar de modal, hairlines 1px en lugar de sombras
- **Detalles**: noise overlay 3%, números enormes en serif italic, eyebrow mono uppercase con tracking, stagger animation en entrada de páginas

## 🛠️ Stack

**Backend** — Node.js + Express + SQLite + bcryptjs + jsonwebtoken + svg-captcha + express-validator

**Frontend** — React 18 + Vite + React Router + Axios + Chart.js + jsPDF + lucide-react

## 📦 Requisitos previos

- **Node.js 22 o superior** (para soporte de `node:sqlite` nativo)
- npm 10+

## 🚀 Ejecución rápida (recomendada)

Un solo comando levanta **todo** (instala dependencias si faltan, libera puertos, arranca backend + frontend y abre el navegador automáticamente):

```bash
python iniciar.py
```

Requiere Python 3.10+ y Node.js 22+. **No necesita instalar nada de Python** (solo stdlib).

Para detener todo: presioná **Ctrl+C** en la terminal.

## 🚀 Ejecución manual (alternativa)

Si preferís correr cada servidor por separado:

```bash
# Terminal 1 — Backend
cd backend
npm install
npm start                    # http://localhost:4000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

Vite tiene un proxy configurado para enviar `/api/*` al backend.

**Cuentas demo (sembradas automáticamente):**
- `admin` / `Admin123!` (rol admin — ve todo)
- `usuario` / `User1234!` (rol user — ve catálogo y reporte)

Al iniciar por primera vez se crea `backend/data/pasofirme.db` con 10 productos de ejemplo (Oxford, Botas, Mocasines, etc.) en distintos tipos, materiales, colores y tallas.

## 🗂️ Estructura

```
proyectou/
├── backend/
│   ├── src/
│   │   ├── config/db.js              SQLite + tablas + seed
│   │   ├── middleware/
│   │   │   ├── auth.js               verifyToken (JWT)
│   │   │   └── role.js               requireAdmin
│   │   ├── routes/
│   │   │   ├── auth.js               /captcha /register /login /logout /me
│   │   │   ├── products.js           CRUD + soft delete + restore + meta
│   │   │   ├── users.js              admin
│   │   │   ├── logs.js               admin
│   │   │   └── stats.js              datos para gráficos
│   │   ├── utils/
│   │   │   ├── password.js           Evaluador de fortaleza
│   │   │   └── logger.js             logAccess
│   │   └── server.js
│   ├── data/                          pasofirme.db (autogen)
│   ├── .env
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/client.js             Axios + interceptor JWT
    │   ├── context/AuthContext.jsx
    │   ├── components/
    │   │   ├── Navbar.jsx            Editorial masthead
    │   │   ├── ProtectedRoute.jsx
    │   │   ├── PasswordStrength.jsx
    │   │   └── Captcha.jsx
    │   ├── pages/
    │   │   ├── Login.jsx             Split editorial con quote
    │   │   ├── Register.jsx          Split editorial + strength meter
    │   │   ├── Dashboard.jsx         Fraunces gigante + Chart.js
    │   │   ├── Products.jsx          Tabla densa + drawer lateral
    │   │   ├── Users.jsx
    │   │   ├── Logs.jsx
    │   │   └── Report.jsx            PDF con resumen
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── styles.css                ~700 líneas — sistema editorial completo
    ├── index.html                    Carga Fraunces + Geist + Geist Mono
    └── vite.config.js
```

## 📚 Endpoints principales

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/api/auth/captcha` | Genera CAPTCHA SVG + token |
| `POST` | `/api/auth/register` | Crea cuenta (rol `user`) |
| `POST` | `/api/auth/login` | Login con CAPTCHA — devuelve JWT |
| `POST` | `/api/auth/logout` | Cierra sesión y registra log |
| `GET`  | `/api/auth/me` | Usuario actual |
| `POST` | `/api/auth/password-strength` | Evalúa fortaleza |

### Products (CRUD + soft delete)
| Método | Ruta | Acceso |
|--------|------|--------|
| `GET`    | `/api/products` | autenticado |
| `GET`    | `/api/products/:id` | autenticado |
| `GET`    | `/api/products/meta/options` | autenticado (tipos+materiales) |
| `POST`   | `/api/products` | autenticado |
| `PUT`    | `/api/products/:id` | autenticado |
| `DELETE` | `/api/products/:id` | autenticado (soft delete) |
| `POST`   | `/api/products/:id/restore` | admin |

### Admin
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`   | `/api/users` | Listar usuarios |
| `PATCH` | `/api/users/:id/toggle` | Activar/desactivar |
| `PATCH` | `/api/users/:id/role` | Cambiar rol |
| `GET`   | `/api/logs` | Logs de acceso |
| `GET`   | `/api/stats/overview` | Datos para gráficos |

## 👥 Nómina del grupo

> _Completar antes de subir a GitHub_

- Integrante 1: _________________________
- Integrante 2: _________________________
- Integrante 3: _________________________

## 📝 Licencia

Proyecto académico — uso educativo.
