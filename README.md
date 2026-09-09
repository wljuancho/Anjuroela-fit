<p align="center">
  <img src="assets/icon.png" alt="Anjuroela Fit Logo" width="180" />
</p>

<h1 align="center">Anjuroela Fit</h1>

<p align="center">
  App de fitness y nutricion personal construida con React Native y Expo.
</p>

<p align="center">
  <a href="#caracteristicas">Caracteristicas</a> &bull;
  <a href="#tecnologias">Tecnologias</a> &bull;
  <a href="#instalacion">Instalacion</a> &bull;
  <a href="#estructura-del-proyecto">Estructura</a> &bull;
  <a href="#licencia">Licencia</a>
</p>

---

## Caracteristicas

- **Rutinas de entrenamiento** — Calendario semanal con asignacion de grupos musculares por dia, registro de series/pesos y seguimiento de sesiones completadas.
- **Biblioteca de ejercicios** — Catalogo de ejercicios por grupo muscular con soporte para agregar ejercicios y categorias personalizadas.
- **Seguimiento de nutricion** — Registro de comidas diarias con estimacion de calorias/macros, recomendaciones contextualizadas y resumen caloricodiario.
- **Panel de progreso** — Historial de peso, graficos de fuerza por ejercicio y resumen de metas con validacion de ritmo saludable.
- **Autenticacion** — Login/registro local con hash SHA-256 y soporte para Google Sign-In.
- **Onboarding** — Flujo de configuracion inicial de perfil con validacion de objetivos de peso.

## Tecnologias

| Capa | Tecnologia |
|------|-----------|
| Framework | React Native 0.76 + Expo SDK 52 |
| Lenguaje | TypeScript 5.3 |
| Navegacion | React Navigation 7 (Native Stack + Bottom Tabs) |
| Base de datos | SQLite local (expo-sqlite) |
| Persistencia | AsyncStorage |
| Autenticacion | Expo Crypto (SHA-256) |
| Camara | Expo Image Picker |

## Instalacion

### Requisitos

- [Node.js](https://nodejs.org/) 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Expo Go (dispositivo) o emulador Android/iOS

### Pasos

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/anjuroela-fit.git
cd anjuroela-fit

# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo
npm start
```

Escanear el codigo QR con Expo Go (Android/iOS) o presionar `a` / `i` para abrir en un emulador.

## Estructura del proyecto

```
src/
├── components/
│   ├── comida/          # Tarjetas y modales de nutricion
│   ├── ejercicios/      # Tarjetas y modales de biblioteca
│   ├── progreso/        # Graficos y modales de progreso
│   ├── rutina/          # Tarjetas y modales de entrenamiento
│   ├── AppButton.tsx
│   ├── AppTextInput.tsx
│   └── PlaceholderScreen.tsx
├── context/
│   ├── AuthContext.tsx   # Estado de autenticacion y sesion
│   └── OnboardingContext.tsx
├── navigation/
│   ├── RootNavigator.tsx
│   ├── MainTabs.tsx
│   └── types.ts
├── screens/
│   ├── LoginScreen.tsx
│   ├── OnboardingScreen.tsx
│   ├── RutinaScreen.tsx
│   ├── EjerciciosScreen.tsx
│   ├── ComidaScreen.tsx
│   └── ProgresoScreen.tsx
├── services/
│   ├── database/         # Inicializacion y esquema SQLite
│   ├── authService.ts
│   ├── exerciseService.ts
│   ├── workoutService.ts
│   ├── mealService.ts
│   ├── progressService.ts
│   ├── nutritionVisionService.ts
│   └── utils/
└── types/                # Definiciones TypeScript
```

## Scripts

| Comando | Descripcion |
|---------|-------------|
| `npm start` | Iniciar Expo |
| `npm run android` | Abrir en Android |
| `npm run ios` | Abrir en iOS |
| `npm run web` | Abrir en navegador |
| `npm run lint` | Ejecutar linter |

## Licencia

Este es un proyecto privado. Todos los derechos reservados.
