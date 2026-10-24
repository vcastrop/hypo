# Hypo Frontend – Resilience & Chaos Platform

Interfaz gráfica de la plataforma de ingeniería del caos **Hypo**. Permite observar la topología del clúster de Kubernetes, descubrir servicios/cargas de trabajo, configurar hipótesis de resiliencia e inyectar caos controlado mediante Chaos Mesh.

---

## 🛠️ Requisitos Previos

- **Node.js**: Versión `v20+` o `v22+` (recomendado LTS).
- **npm**: Versión `10+`.
- *(Opcional)* Backend de Hypo corriendo en `http://localhost:8000` (FastAPI). Si el backend no está encendido, el frontend cuenta con datos de muestra automáticos para el clúster `mybookstore`.

---

## 🚀 Cómo Correr el Frontend Localmente

### 1. Clonar e ingresar a la carpeta
```bash
cd frontend
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar el servidor de desarrollo

#### En Windows (PowerShell / CMD):
Si PowerShell tiene restringida la ejecución de scripts (`.ps1`), ejecuta:
```powershell
npm.cmd run dev
```
O habilita la política una sola vez:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
npm run dev
```

#### En Linux / macOS / WSL:
```bash
npm run dev
```

El servidor iniciará en:
👉 **`http://localhost:3000`**

---

## 🏗️ Construcción para Producción

Para compilar y validar los tipos de TypeScript:
```bash
npm run build
```
Los archivos estáticos listos para producción se generarán en la carpeta `dist/`.

Para previsualizar el build de producción localmente:
```bash
npm run preview
```

---

## 🌐 Configuración de Proxy con el Backend

El frontend viene preconfigurado con Vite para redirigir automáticamente todas las peticiones `/api/*` al backend de Hypo:
- **Proxy target:** `http://localhost:8000`
- **Endpoints consumidos:**
  - `GET /api/v1/discovery/namespaces`
  - `GET /api/v1/discovery/namespaces/:namespace/services`
  - `GET /api/v1/discovery/namespaces/:namespace/workloads`
  - `POST /api/v1/experiments/definitions`
  - `POST /api/v1/experiments/runs`

---

## 🎨 Identidad Visual y Estilo

- **Paleta base:** Gris oscuro mate (`#121212` y `#1e1e1e`).
- **Color de marca (Caos / Inyección):** Rojo carmesí (`#DC2626`).
- **Estados de salud:** Esmeralda (`#10B981`) para pods saludables.
- **Tipografía y UI:** Diseño minimalista inspirado en interfaces de alta densidad de datos (Datadog, Claude, AWS FIS).
