# Anjuroela Fit

Aplicación de fitness y nutrición construida con React Native, Expo y TypeScript. Incluye rutinas, biblioteca de ejercicios, registro de comidas, objetivos y seguimiento del progreso. Los datos se guardan localmente en SQLite y pueden sincronizarse con Supabase.

## Funciones

- Rutinas y sesiones de entrenamiento con registro de ejercicios, series y progreso.
- Historial de peso, actividad y metas personales.
- Registro de comidas manual, desde el catálogo o mediante una estimación por foto con IA.
- Estimación de calorías con Mifflin-St Jeor y registro de macronutrientes.
- El registro de comida muestra su procedencia. Los valores de catálogo y foto son aproximados; una estimación visual no puede confirmar ingredientes ni porciones exactas.
- La IA de entrenamiento puede usar información del perfil y de la actividad registrada para dar respuestas con contexto.

## Tecnologías

| Área | Tecnología |
|---|---|
| Aplicación | Expo SDK 57, React Native 0.86, TypeScript 6 |
| Navegación | React Navigation 7 |
| Datos locales | SQLite (`expo-sqlite`) y AsyncStorage |
| Sincronización | Supabase |
| Cámara y galería | Expo Image Picker |

## Requisitos

- Node.js compatible con Expo SDK 57. `npm test` requiere Node.js con soporte para eliminar tipos de TypeScript (`--experimental-strip-types`).
- npm
- Android Studio o Xcode para ejecutar las compilaciones nativas. Este proyecto usa módulos nativos de salud, por lo que el flujo habitual es un development build; Expo Go puede no incluirlos.

## Instalación y ejecución

```bash
npm install
npm start
```

Para compilar y abrir en un dispositivo/emulador:

```bash
npm run android
# o
npm run ios
```

Configura `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` en `.env` para sincronización. Las claves de proveedores de IA se configuran en la app. Revisa la política de privacidad antes de enviar fotos o información de salud a servicios externos.

## Base de datos

`supabase_schema.sql` contiene el esquema Supabase utilizado para sincronizar. Revísalo y respalda los datos de la base antes de aplicarlo a una instalación existente: el archivo incluye instrucciones `DROP TABLE ... CASCADE` para tablas legacy.

`supabase_reset.sql` es un script de reinicio y puede borrar datos. No lo ejecutes como parte de una instalación normal.

## Calidad

```bash
npm run lint
npm test
npx tsc --noEmit
```

Las pruebas actuales cubren las reglas puras de seguridad de objetivos de peso y calorías. Todavía falta una suite de integración con SQLite, sincronización y pantallas.

## Estructura

- `src/screens`: pantallas principales.
- `src/components`: componentes y formularios.
- `src/services`: lógica de datos, sincronización, nutrición y entrenamiento.
- `src/context`: sesión y perfil de usuario.
- `src/types`: contratos TypeScript.
- `tests`: pruebas automatizadas de reglas de dominio.
