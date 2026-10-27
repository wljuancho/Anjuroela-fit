# Anjuroela Fit

Aplicación de fitness y nutrición construida con React Native, Expo y TypeScript. Incluye rutinas, biblioteca de ejercicios, registro de comidas, objetivos y seguimiento del progreso. SQLite en el dispositivo es la fuente principal: las funciones de registro y seguimiento no dependen de Supabase y los cambios se conservan sin conexión. Supabase es una copia de seguridad opcional para sincronizar y recuperar datos al iniciar sesión en otro dispositivo con conexión.

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

Configura `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` en `.env` para activar la copia de seguridad. Sin estas variables, la app utiliza SQLite localmente; la copia/restauración entre dispositivos no estará disponible. El análisis de fotos y los servicios de IA sí requieren conexión y su proveedor configurado. Revisa la política de privacidad antes de enviar fotos o información de salud a servicios externos.

## Base de datos

`supabase_schema.sql` contiene el esquema Supabase utilizado para sincronizar. Revísalo y respalda los datos de la base antes de aplicarlo a una instalación existente: el archivo incluye instrucciones `DROP TABLE ... CASCADE` para tablas legacy.

`supabase_reset.sql` es un script de reinicio y puede borrar datos. No lo ejecutes como parte de una instalación normal.

## Calidad

```bash
npm run lint
npm test
npx tsc --noEmit
```

Las pruebas automatizadas cubren límites de calorías manuales (incluido el rechazo de 500 kcal), validación de metas de peso y ritmo semanal, edad adulta y procedencia de estimaciones de comida. Ejecuta `npm test`, `npm run lint` y `npx tsc --noEmit` antes de publicar.

El escaneo de comida puede usar un proveedor de IA o una estimación local de respaldo. La confianza es cualitativa y no está calibrada como porcentaje de acierto. La app guarda y muestra el origen, los alimentos que la IA dice haber identificado y su explicación cuando esos datos están disponibles. Las imágenes no permiten confirmar con exactitud ingredientes, aceites ni cantidades; revisa los valores antes de guardarlos. Los datos explicativos se guardan en SQLite y se sincronizan con las nuevas columnas `nutrition_observed` y `nutrition_estimate_notes` de `meal_logs`.

La validación se ejecuta en la interfaz y en los servicios que guardan metas; mantener ambas capas evita que un formulario alternativo o una llamada directa omita los límites preventivos. La suite actual cubre reglas de dominio, pero no automatiza todavía los recorridos integrados de SQLite, sincronización offline/online ni navegación de pantallas.

## Estructura

- `src/screens`: pantallas principales.
- `src/components`: componentes y formularios.
- `src/services`: lógica de datos, sincronización, nutrición y entrenamiento.
- `src/context`: sesión y perfil de usuario.
- `src/types`: contratos TypeScript.
- `tests`: pruebas automatizadas de reglas de dominio.
