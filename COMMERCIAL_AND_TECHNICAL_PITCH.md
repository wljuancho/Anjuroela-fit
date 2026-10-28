# ANJUROELA FIT

## Commercial & Technical Pitch — Guía de Ventas, Presentación Comercial y Manual Técnico

> **Documento ejecutivo elaborado a partir de una auditoría íntegra del código fuente.**
> Referencias verificadas: `src/services/healthService.ts`, `src/services/coachService.ts`,
> `src/services/nutritionService.ts`, `src/services/syncService.ts`, `supabase_schema.sql`
> (y servicios de apoyo: `workoutService.ts`, `progressService.ts`, `versionService.ts`,
> `authService.ts`, `configService.ts`).

---

## Índice

1. [Propuesta de Valor y Pitch Comercial](#1-propuesta-de-valor-y-pitch-comercial)
2. [Arquitectura de Conexiones e Integraciones Externas (Ecosistema Wearable)](#2-arquitectura-de-conexiones-e-integraciones-externas-ecosistema-wearable)
3. [Motor de Cálculos y Algoritmos Internos (El Corazón Fisiológico)](#3-motor-de-cálculos-y-algoritmos-internos-el-corazón-fisiológico)
4. [Inteligencia Artificial Contextual (Coach Anjuroela)](#4-inteligencia-artificial-contextual-coach-anjuroela)
5. [Seguridad, Privacidad y Escalabilidad](#5-seguridad-privacidad-y-escalabilidad)

---

# 1. Propuesta de Valor y Pitch Comercial

## Resumen Ejecutivo

**Anjuroela Fit** es una aplicación de fitness y salud digital **offline-first, privada, con IA conversacional contextualizada y compatibilidad universal con dispositivos de salud**, lista para producción.

Resuelve el problema central del mercado del fitness digital: hoy las apps o son **dependientes de la nube** (inutilizables sin señal), o **desconectadas** (islas de datos sin sincronización), o **instrumentadas sin contexto real del cuerpo del usuario**. Anjuroela Fit ataca las tres debilidades a la vez:

| Problema de mercado | Cómo lo resuelve Anjuroela Fit |
|---|---|
| Apps inutilizables sin internet | **Offline-first:** SQLite local como fuente de verdad; Supabase solo replica en segundo plano. La app entrena, cuenta calorías y asesora sin señal. |
| Datos de salud en silos por fabricante | **Conexión abierta con el sistema operativo** (Health Connect en Android / HealthKit en iOS): un solo permiso lee Samsung Health, Mi Fitness, Garmin, Fitbit, Apple Watch, Huawei, Oura Ring, etc. Sin Bluetooth directo por fabricante. |
| Coaches que "hablan en genérico" | **IA contextual que conoce los datos reales del usuario en cada mensaje** (perfil, tendencia de peso, alimentación, rutina y wearables), con respaldo dual de proveedores (Gemini / OpenAI). |
| Fuga de datos de salud | **Privacidad por diseño:** aislamiento estricto por usuario vía `user_id` + Row Level Security en Supabase, y purga quirúrgica de datos al cerrar sesión. |
| Obsolescencia silenciosa | **Control remoto de versiones (OTA)** mediante la tabla remota `app_versions`, con actualización casi obligatoria desde la app. |

### Por qué es una solución Production-Ready

- **Motor fisiológico real y documentado:** Mifflin-St Jeor (BMR), Keytel por ritmo cardíaco y MET por zona muscular (calorías en sesión), y NEAT por pasos diarios.
- **Sincronización híbrida defensiva:** cola de subida con orden de dependencias FK, buffer de borrados offline, reintento automático, 15 tablas replicadas y restauración silenciosa al iniciar sesión.
- **Aislamiento multiusuario de doble capa** (local + remota) y flujo de revocación de cuenta automatizado.
- **Stack moderno:** Expo SDK ~57, React Native 0.86, React 19.2, TypeScript ~6.0, Supabase (PostgreSQL) — verificado con `tsc --noEmit` en 0 errores.

## Diferenciadores Clave

### 1. Enfoque Offline-First
El dispositivo (SQLite vía `expo-sqlite`) es la **fuente de verdad**. `syncService.ts` replica en segundo plano y con throttle, de modo que entrenar a 10.000 m de altura o en un sótano sin cobertura produce **cero fricción** para el usuario. El historial se conserva y se sincroniza en cuanto hay red (`requestFullSync` al volver a primer plano; reintento cada 30 s offline).

### 2. Privacidad Garantizada (Aislamiento Estricto de Datos)
- Cada fila de datos personales lleva `user_id` (o su dueño registrado en `user_row_owners`).
- En la nube, **Row Level Security (RLS)** de PostgreSQL restringe todo acceso a la cabecera `x-app-user` de la petición (`supabase_schema.sql:575-615`).
- Al cerrar sesión, `purgeUserData()` elimina quirúrgicamente cada registro de la cuenta en el dispositivo **sin tocar el historial en la nube** (`syncService.ts:1158`).

### 3. IA Conversacional Contextualizada
El Coach **"Anjuroela"** no responde en frío: cada mensaje se envía al proveedor con un *system prompt* que incluye **5 dimensiones de contexto en tiempo real** construidas desde la base local (`buildContext`, `coachService.ts:233`). La IA "recuerda" el peso, la estrategia calórica, las últimas sesiones, los pasos de hoy y las horas de sueño de anoche **sin que el usuario tenga que escribirlo**.

### 4. Compatibilidad Universal con Dispositivos de Salud
Anjuroela Fit **no se integra fabricante por fabricante**. Conversa directamente con la capa de salud del sistema operativo:

- **Android → Health Connect (Google).** Vía `react-native-health-connect`. Lee los datos que cualquier app (Samsung Health, Xiaomi/Mi Fitness, Garmin Connect, Fitbit, Huawei, Oura…) ya escribió en el almacén central del sistema.
- **iOS → Salud / HealthKit.** Vía `react-native-health`. Lee el repositorio donde Apple consolidan los datos de Apple Watch y de las apps que el usuario autorice (incluidas las del listado anterior).

Eso convierte a Anjuroela Fit en la **capa inteligente** que interpreta el cuerpo del usuario independientemente de la marca de su reloj, pulsera o anillo.

---

# 2. Arquitectura de Conexiones e Integraciones Externas (Ecosistema Wearable)

## Conexión Abierta con Salud (Health Connect en Android & HealthKit en iOS)

Anjuroela Fit usa el **modelo de "concentrador de salud" del sistema operativo**: un único diálogo de permisos por plataforma y lectura uniforme de datos, sin Bluetooth directo ni SDK privados de cada fabricante.

### Android — Google Health Connect
- Librería: `react-native-health-connect` (`healthService.ts:3-11`).
- Verificación de disponibilidad del SDK con `getSdkStatus()`; si la app de Health Connect no está instalada o desactualizada se detectan los estados `not-installed` / `update-required` (`healthService.ts:96-108`) y se ofrece abrir su ficha en Google Play (`openHealthConnectPlayStore`, `healthService.ts:112`).
- **Permisos solicitados** (`ANDROID_READ_REQUESTS`, `healthService.ts:210-215`): `HeartRate`, `ActiveCaloriesBurned`, `Steps` y `SleepSession`.
- El wearable se considera **autorizado** cuando hay lectura concedida de `HeartRate` + `ActiveCaloriesBurned` (`androidRequestPermissions`, `healthService.ts:217-229`); pasos y sueño se amplían después sin romper el flujo existente (`requestExtendedHealthPermissions`, `healthService.ts:553`).
- La revocación usa `revokeAllPermissions()` (efectiva al reiniciar la app, limitación documentada de Health Connect) (`healthService.ts:292-317`).

### iOS — Salud / HealthKit
- Librería: `react-native-health` (`healthService.ts:17-26`).
- Permisos de lectura (`IOS_PERMISSIONS_CONFIG`, `healthService.ts:160-176`): `HeartRate` (bpm), `ActiveEnergyBurned`, y extendidos `StepCount` + `SleepAnalysis`.
- Autorización comprobada contra el estado nativo `SharingAuthorized` (`HEALTHKIT_SHARING_AUTHORIZED`, `healthService.ts:193-204`).
- HealthKit no permite revocar permisos por API; la app deja de sincronizar y orienta al usuario a "Ajustes > Salud > Apps" (`healthService.ts:296-301`).

## Compatibilidad Universal de Dispositivos

Por diseñar sobre los concentradores del OS, Anjuroela Fit es compatible con todo dispositivo que publique datos en ellos:

| Plataforma | Ecosistemas que consolida automáticamente |
|---|---|
| **Android (Health Connect)** | Samsung Health (Galaxy Watch), Xiaomi/Mi Fitness & Mi Band, Garmin Connect (con Garmin Connect + Health Connect), Fitbit, Huawei Health, Oura Ring, Wear OS, pulseras genéricas que exporten a Health Connect |
| **iOS (HealthKit)** | Apple Watch, iPhone, y las apps de Samsung, Garmin, Fitbit, Huawei, Oura, Withings, etc., siempre que el usuario la autorice a escribir en Salud |

El procesamiento de esas fuentes es **uniforme**: los registros ya llegan normalizados como `HeartRate`, `ActiveCaloriesBurned`, `Steps` y `SleepSession`; la app agrega promedios y totales sin depender de la marca de origen.

## Métricas Extraídas en Tiempo Real y Sesión

### Ritmo Cardíaco (FC) — promedio y máximo
- **Lectura por ventana temporal** de la sesión (`estimateSessionWindow`, `healthService.ts:697`), desde el `created_at` de la sesión hasta "ahora".
- Android: agrega las muestras `beatsPerMinute` de los registros `HeartRate`; iOS: `getHeartRateSamples`. Ambos devuelven **FC promedio, FC máxima y número de muestras** (`WearableHeartRateReading`, `healthService.ts:323-381`).
- La FC promedio se guarda redondeada a 0,1 en `workout_sessions.heart_rate_avg` y alimenta el contexto de la IA y el módulo de Progreso.

### Pasos Diarios (NEAT)
- `readTodaySteps()` (`healthService.ts:516`) suma los pasos desde la medianoche local (Android: registros `Steps`; iOS: `getStepCount`).
- Cuando el wearable está autorizado, calcula el **gasto kcal aproximado por desplazamiento**: `kcal ≈ pasos × (peso_kg / 1400)` (`healthService.ts:527`). El peso de referencia se resuelve en tiempo real desde el perfil o el último registro de peso. Esto es **energía de termogénesis no-ejercicio (NEAT)** y se expone en Progreso y en el contexto del coach.

### Periodos Nocturnos de Sueño
- `readLastNightSleepHours()` (`healthService.ts:537`) recupera el sueño de las **últimas 24 horas**.
- Android: suma la duración de los registros `SleepSession` (cada sesión trae su ventana completa).
- iOS: suma las fases de sueño **excluyendo la ventana "acostado" (`INBED`)** para no contabilizar las horas despierto en la cama (`healthService.ts:485-503`).
- Se formatea para la IA como "X h Y min" (`formatSleepHours`, `coachService.ts:136`).

## Sincronización Remota Segura (Arquitectura Híbrida)

**SQLite (local) + Supabase / PostgreSQL (remoto)** con **Row Level Security por cabecera `x-app-user`**.

```
┌────────── EXPONENTE (dispositivo) ──────────┐      ┌────────── SUPABASE (PostgreSQL) ──────────┐
│                                             │      │                                            │
│  SQLite = fuente de verdad (offline-first) │      │  users, user_profiles, nutrition_profile,   │
│  15 tablas replicables                      │      │  weekly_schedule, day_muscles, day_exercises│
│  Exp. expo-sqlite                           │      │  workout_sessions, workout_sets,            │
│                                             │      │  workout_circuits, weight_logs,             │
│  Sync API (dentro de la app)                │      │  daily_calories, meal_logs, weekly_meal_plan│
│  · subida: syncLocalToRemote()              │──────▶│  + auxiliares: user_row_owners,            │
│  · bajada: syncRemoteToLocal()              │      │    pending_deletions, app_versions          │
│  · borrados: queueLocalDeletion()           │      │                                            │
│                                             │      │  RLS: app_user_email() ==                   │
│  Cabecera global: x-app-user (email)        │──────▶│       request.headers['x-app-user']        │
│  setSupabaseAppUser()  (supabaseClient.ts)  │      │                                            │
│                                             │      │  Análisis: clave ANON pública (@supabase/supabase-js)  │
└─────────────────────────────────────────────┘      └────────────────────────────────────────────┘
```

Detalles de ingeniería verificados en `syncService.ts`:

- **Cola de subida con orden por dependencias FK** (`PARENT_DEPENDENCIES`, `syncService.ts:43`): se suben primero los padres para que los inserts hijos no violen claves foráneas en Supabase.
- **Upserts por claves de negocio UNIQUE** (`UPSERT_ON_CONFLICT`, `syncService.ts:64`): `users` por `email`, `user_profiles`/`nutrition_profile` por `user_id`, `daily_calories` por `(user_id, date)`, etc.
- **Upsert idempotente y multi-dispositivo:** los ids locales de sesiones y series se traducen a los ids remotos vía identidad estable (`mapWorkoutSetsToRemoteSessions`, `syncService.ts:862`).
- **Buffer de borrados offline** (`pending_deletions`): un DELETE sin conexión queda en cola y se propaga **antes** de cualquier upsert o restauración, garantizando que lo eliminado **no resucita** (`flushPendingDeletions` + `reapplyPendingDeletionsLocal`, `syncService.ts:342` y `471`).
- **Throttle de 10 s y reintento offline cada 30 s** (`SYNC_THROTTLE_MS`, `FLUSH_RETRY_OFFLINE_MS`, `syncService.ts:169-174`).
- **Restauración al iniciar sesión** (`syncRemoteToLocal`, `syncService.ts:1031`): baja catálogo global, filas por `user_id`, filas propias vía `user_row_owners` y propaga borrados pendientes.
- **Verificación de existencia remota de la cuenta:** si el usuario fue eliminado en Supabase, la app detecta `absent`, revoca la sesión local y bloquea resubidas accidentales (`enforceRemoteUserExistence`, `syncService.ts:247`).

**Row Level Security (RLS) basado en `x-app-user`** (`supabase_schema.sql:570-615`):

- Función `app_user_email()`: lee `current_setting('request.headers', true)::json->>'x-app-user'` (patrón oficial de Supabase).
- La app inyecta la cabecera al reconstruir el cliente para cada identidad: `setSupabaseAppUser(email)` (`supabaseClient.ts:37-55`).
- Políticas: tablas con columna `user_id` → `USING (user_id = app_user_email())`; tablas sin `user_id` pero personales → `USING` verificado contra `user_row_owners`.
- Tablas de catálogo global (`body_parts`, `exercises_v2`, `app_meta`) permanecen abiertas por no contener datos personales (`supabase_schema.sql:818-832`).

---

# 3. Motor de Cálculos y Algoritmos Internos (El Corazón Fisiológico)

## Tasa Metabólica Basal (BMR) — Fórmula de Mifflin-St Jeor

`nutritionService.calculateTDEE` (`nutritionService.ts:50-60`):

```
BMR = (10 × peso_kg) + (6.25 × altura_cm) − (5 × edad) + término_sexo
```

| Variable | Origen en la app | Notas de implementación |
|---|---|---|
| **Peso (kg)** | `user_profiles.current_weight` (o último `weight_logs`) | Requerido; sin peso no se calcula |
| **Altura (cm)** | `user_profiles.height` | Requerida junto al peso |
| **Edad** | `user_profiles.age` | Opcional: si es NULL se usa 30 años para no bloquear el cálculo |
| **Sexo biológico** | `nutrition_profile.sex_for_calorie_formula` → `user_profiles.sex_for_calorie_formula` → `user_profiles.gender` ("hombre"/"mujer") | Resolución en cascada (`resolveSexForFormula`, `nutritionService.ts:99`) |

**Términos de sexo** (`MIFFLIN_SEX_TERM`, `nutritionService.ts:44-48`): mujer **−161** kcal, hombre **+5** kcal, no especificado **−78** (el promedio de ambos, comportamiento conservador y documentado).

**TDEE y estrategia calórica:**

```
TDEE   = BMR × factor_actividad        (sedentario 1.2 / ligero 1.375 / moderado 1.55 / activo 1.725)
Meta   = TDEE + ajuste_objetivo        (perder −500 / ganar +300 / mantener 0 / libre 0)
Meta   = clamp(Meta, 1.200 ... 3.500)  kcal/día, redondeada
```

El resultado alimenta `nutrition_profile.daily_calories_goal` y el contexto del coach, y es la base del déficit/superávit "vivo" del día.

## Gasto Calórico en Entrenamiento

### Con Wearable: Fórmula de Keytel (basada en ritmo cardíaco)

`healthService.computeWearableCalories` (`healthService.ts:735-752`) y `keytelCaloriesPerMinute` (`healthService.ts:585-596`). Estimación metabólica por minuto a partir de **FC promedio, peso, edad y sexo**:

```
Hombre: kcal/min = (−55,0969 + 0,6309·FC + 0,1988·peso + 0,2017·edad) / 4,184
Mujer:  kcal/min = (−20,4022 + 0,4472·FC − 0,1263·peso + 0,074·edad) / 4,184
Sexo no especificado: promedio de ambas
```

Cálculo final de la sesión **combinando latidos + la estructura registrada** (series, repeticiones, rondas y descansos):

```
kcal_trabajo = kcal/min(Keytel) × segundos_trabajo / 60
kcal_descanso = MET_1,5 × peso_kg × segundos_descanso / 3600
kcal_blend = kcal_trabajo + kcal_descanso
kcal_sesión = MAX( kcal_blend , kcal_activas_reportadas_por_el_dispositivo )
```

Detalles verificados:
- **Segundos de trabajo** desde las series registradas: `reps × 2 s` por repetición o `time_seconds` en series por tiempo; si el día es de circuitos, se usa la estructura del circuito (`work_seconds × rounds`, `rest_seconds × rounds`) (`getSessionStructure`, `healthService.ts:641-695`).
- **Descanso** con MET de reposo 1,5 (`REST_MET`, `healthService.ts:581`).
- **No se subestima:** si el dispositivo reporta kcal activas, se usa el mayor entre ellas y el cálculo por latidos (`healthService.ts:751`).
- El resultado se persiste con `calories_source='wearable'` y la FC media en `workout_sessions` (`healthService.ts:794-805`).

### Sin Wearable: Estimación Metabólica por MET

`workoutService.recalculateSessionCalories` (`workoutService.ts:402-420`), usada para las sesiones sin datos del dispositivo:

```
MET FUERZA/ROTINA  = 5,0   (entrenamiento de resistencia moderado-vigoroso, Compendio de Actividades)
MET DESCANSO       = 1,5   (reposo entre series)
kcal = (MET_5,0 × peso_kg × seg_trabajo)/3600
     + (MET_1,5 × peso_kg × seg_descanso)/3600
```

- `seg_trabajo`: `reps × 2 s` o `time_seconds` por serie/circuito.
- El peso se toma del último `weight_logs` o `user_profiles.current_weight`, con respaldo de 70 kg (`workoutService.ts:382-400`).
- Estas sesiones quedan marcadas con `calories_source='estimate'`, distinguiéndolas de las medidas con wearable en el módulo de Progreso (`progressService.ts:271`).

## Balance Calórico por Actividad Diaria (NEAT + ajuste dinámico)

El día se modela en `daily_calories` como **consumido / quemado / meta**:

1. **Gasto de entrenamiento del día:** al completar una sesión, `syncDailyCaloriesBurnedForDate` recalcula `daily_calories.calories_burned` sumando las kcal de todas las sesiones completadas del día (suma idempotente y unificada con Progreso) (`progressService.ts:323-353`).
2. **Gasto NEAT por pasos:** el wearable reporta pasos desde medianoche y la app deriva sus kcal de desplazamiento (`steps × peso/1400`). Se muestra en Progreso y se inyecta al coach como gasto vivo del día.
3. **Ajuste dinámico del objetivo:** la meta diaria se ajusta al recomputar TDEE con el **factor de actividad** (sedentarismo ↔ actividad intensa) y al cambiar `goal_type` (`perder −500` / `ganar +300` / `mantener` / `libre`). El balance resultante es `remaining = meta − consumido`, visualizado como porcentaje (tope 100 %) en el día (`getNutritionDayData`, `nutritionService.ts:505-526`).
4. **Visibilidad semanal/mensual:** promedios de consumo 7 y 30 días y resúmenes por semana/mes para retroalimentar tanto al usuario (`daily_calories`) como a la IA (`coachService.ts:327-358`).

> Precisión documentada: las kcal NEAT de pasos se calculan y exponen en tiempo real (Progreso y contexto de IA); el **ajuste del déficit/superávit diario** ocurre en el motor de TDEE vía factor de actividad y objetivo, no sobreescribiendo datos del wearable.

---

# 4. Inteligencia Artificial Contextual (Coach Anjuroela)

## Pipeline de Inyección de Contexto en Tiempo Real (`buildContext`)

Sin que el usuario escriba un solo dato, cada mensaje al LLM viaja con su **estado fisiológico y de progreso completo**, leído en vivo desde SQLite (`coachService.ts:748`):

```
sendCoachMessage(userId, texto, historial)
      │
      ├── buildContext(userId)  ──►  [PERFIL] [TENDENCIA DE PESO] [ENERGÍA Y NUTRICIÓN]
      │                                [WEARABLES Y EJERCICIO] [RUTINA Y FUERZA]
      │
      ├── SYSTEM_PROMPT ("Anjuroela", reglas + formato de acciones JSON)
      │
      ├── Proveedor detectado automáticamente (detectAiProvider):
      │     · OpenAI  → gpt-4o-mini  (chat/completions)
      │     · Gemini  → gemini-3.6-flash (generateContent)
      │
      └── temperature = 0.7 · timeout de 60 s con abort
```

El contexto se construye **en cada turno**, por lo que la recomendación siempre refleja el último peso, la última sesión y los pasos/sueño de esta mañana. La respuesta puede incluir bloques estructurados `<<<ACCIONES>>>` / `<<<COMIDAS>>>` que la app **parsea, valida y ejecuta sobre la base de datos** (crear músculos, ejercicios, circuitos por rondas, o un plan semanal de comidas escalado por porciones y con fecha de expiración).

**Guardarragas de seguridad de la IA** (`SYSTEM_PROMPT`, `coachService.ts:158-231`): responde solo en español, **solo sobre fitness/salud** (declina otros temas), **no diagnostica ni trata** enfermedades (recomienda un profesional), respeta la estrategia calórica vigente (sin déficits agresivos si el usuario está en mantenimiento/libre) y nunca inventa datos que falten.

## Desglose de Contexto Enviado (las 5 dimensiones que analiza la IA)

La documentación oficial del producto agrupa las 5 dimensiones como **[PERFIL]**, **[TENDENCIA DE PESO]**, **[RUTINA Y EJERCICIO]**, **[ALIMENTACIÓN]** y **[WEARABLES Y SALUD]**. Corresponde exactamente con los 5 bloques reales que la app emite:

| Dimensión conceptual | Bloque real de `buildContext` | Contenido verificable (aparece en el prompt) |
|---|---|---|
| **1. PERFIL** | `[PERFIL]` + dirección de la meta | Edad, sexo (biológico), peso actual, peso objetivo, altura + **IMC calculado y clasificado** (Bajo peso/Normal/Sobrepeso/Obesidad), meta en N semanas, estado de la meta, dirección (perder/ganar/mantener) |
| **2. TENDENCIA DE PESO** | `[TENDENCIA DE PESO (7, 14 Y 30 DÍAS)]` | Último peso registrado, promedios de 7/14/30 días y tendencia vs. período previo con **umbral de estancamiento ±0,3 kg** bajar/aumentar/estancado |
| **3. ALIMENTACIÓN** | `[ENERGÍA Y NUTRICIÓN]` | **BMR** (Mifflin-St Jeor) y **TDEE** con nivel de actividad, meta diaria, **estrategia calórica** (déficit activo / mantenimiento sin déficit / superávit / libre), consumo promedio 7 y 30 días, calorías de hoy vs. meta, quemadas promedio 7 días |
| **4. WEARABLES Y SALUD** | `[WEARABLES Y EJERCICIO]` | Disponibilidad del dispositivo, últimas 10 sesiones con kcal y FC media, calorías totales recientes, **pasos de hoy + kcal NEAT por desplazamiento** y **horas de sueño del último periodo nocturno** |
| **5. RUTINA Y EJERCICIO** | `[RUTINA Y FUERZA]` | Fuerza registrada (máx. kg por ejercicio, hasta 12), músculos/ejercicios configurados con equipo, y rutina semanal (qué músculo toca cada día) |

Al incluir conversación, la app mantiene las últimas **10 interacciones** como contexto (`history.slice(-10)`), y la IA está instruida para **no repetir preguntas** sobre datos ya dados en la misma conversación (`coachService.ts:229`).

---

# 5. Seguridad, Privacidad y Escalabilidad

## Aislamiento Multi-Usuario (no contaminación cruzada de datos)

La garantía se aplica en **ambas capas** de la arquitectura:

**Capa local (SQLite):**
- Tablas personales con `user_id` se filtran o borran estrictamente por el usuario activo (`syncService.ts:101-108`).
- Tablas de rutina/sesión sin columna propia se aislan por el registro de propiedad `user_row_owners` (espejo local mantenido en cada sync).
- `getProfile`, `getWeightHistory`, `getMealLogsByDate`, etc., consultan siempre por `user_id` (o filas legacy `user_id IS NULL` toleradas como historial de instalaciones antiguas).

**Capa remota (Supabase/PostgreSQL):**
- **RLS por cabecera `x-app-user`** (email del usuario activo) en cada tabla personal: `users`, `user_profiles`, `nutrition_profile`, `user_row_owners` se aíslan por columna de identidad; `weekly_schedule`, `day_muscles`, `day_exercises`, `workout_sessions`, `workout_sets`, `workout_circuits`, `weight_logs`, `daily_calories`, `meal_logs` y `weekly_meal_plan` por su registro de propietario (`supabase_schema.sql:570-816`).
- **Borrado en cascada por cuenta** con disparador `SECURITY DEFINER` (`cascade_delete_user_data`, `supabase_schema.sql:849-873`): al eliminar una cuenta en `users`, se limpian automáticamente todas sus tablas personales, incluso las que no tienen FK directa.

## Purga Quirúrgica de Datos (`purgeUserData`)

Al cerrar sesión, la app elimina **con precisión quirúrgica y transaccional** todos los datos del usuario en el dispositivo (`syncService.ts:1158-1227`):

1. `DELETE` por `user_id` en `workout_sessions`, `daily_calories`, `weight_logs`, `meal_logs`, `user_profiles`, `nutrition_profile`.
2. Series huérfanas: `workout_sets` borradas por los `session_id` de las sesiones del usuario (sin borrado masivo por tabla).
3. **Borrado cruzado** del resto de tablas vía `user_row_owners` (rutinas, circuitos, plan semanal…), también para filas legacy con `user_id NULL`.
4. Limpieza del espejo de propiedad.
5. Purga del **historial de chat** de la cuenta en AsyncStorage (`clearStoredChat`).

La operación **nunca borra el catálogo global de ejercicios** ni la fila de la cuenta; y, al ejecutarse en el dispositivo, el **historial en la nube se conserva intacto** para restaurarse al volver a iniciar sesión. La purga está blindada: un fallo de borrado no rompe la sesión, y la re-sincronización aísla igualmente (garantía reforzada en el siguiente pull).

## Control Remoto de Versiones (OTA Control)

Sistema **anti-obsolescencia** apalancado en la tabla remota `app_versions` (Supabase):

| Componente | Detalle verificado |
|---|---|
| Tabla `app_versions` | `is_active`, `latest_version_code`, `latest_version_name`, `download_url`, `message`, `created_at` (`supabase_schema.sql:487-495`) |
| Acceso anónimo de solo lectura | `grant select ... to anon` + RLS habilitada y política `anon_select_app_versions` (`supabase_schema.sql:497-503`) |
| Registro semilla | Se inserta la Versión inicial de forma **idempotente** (no duplica si ya existe) (`supabase_schema.sql:506-516`) |
| Verificación en la app | `versionService.checkForRemoteUpdate` consulta el registro **activo** más reciente y lo compara con el `versionCode` local; solo avisa si el remoto es superior (`versionService.ts:38-66`) |
| UX de actualización forzada | `RemoteUpdateManager` muestra un **modal casi inbloqueable** ("Actualizar ahora") — el botón atrás no lo cierra (`onRequestClose={() => {}}`, `RemoteUpdateManager.tsx:62`) — y abre el `download_url` |
| Reanálisis continuo | Se re-verifica al volver a primer plano (`AppState 'active'`) y al abrir la app (`RemoteUpdateManager.tsx:37-47`) |
| Segundo canal opcional | `updateService` soporta descarga del APK al almacenamiento interno y apertura con el instalador de Android (`content://` seguro, permiso "Instalar apps desconocidas" gestionado) (`updateService.ts:90-123`) |

> **Nota de despliegue (transparencia de la auditoría):** el *framework* OTA está completo y funcional. Para producción hay dos valores a configurar desde el panel de Supabase / la config de la app: (a) la URL del registro activo en `app_versions` (la semilla del script usa un marcador `https://drive.google.com/tu-enlace-de-drive`), y (b) el manifiesto JSON de `APP_UPDATE_CONFIG.MANIFEST_URL` (actualmente placeholder `https://example.com/...`, `config.ts:11-16`).
>
> **Versión local de la build:** `app.json` y `android/app/build.gradle` quedan sincronizados en **versionCode 14 · versionName "1.0.14"** con `minSdkVersion 26`. Para que esa build detecte la actualización, el registro **activo** de `app_versions` en Supabase debe publicar un `latest_version_code > 14` con su `download_url` real.

---

## Verificación Final

| Ítem | Resultado |
|---|---|
| Archivo generado | `COMMERCIAL_AND_TECHNICAL_PITCH.md` (raíz del proyecto) — OK |
| Auditoría de código | `healthService.ts` · `coachService.ts` · `nutritionService.ts` · `syncService.ts` · `supabase_schema.sql` · servicios de apoyo (workout, progress, version, auth, config, supabaseClient) — OK |
| Compilación TypeScript | `tsc --noEmit` → **0 errores** — OK |

*Documento ejecutivo · Anjuroela Fit · Preparado para ventas, inversión y equipos técnicos.*
