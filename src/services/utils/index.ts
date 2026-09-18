export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Devuelve la fecha (YYYY-MM-DD) del LUNES de la semana en la que cae `date`.
// Se usa para etiquetar la planificación semanal de la rutina
// (day_exercises.week_of): al cambiar de semana o terminar el día, los planes
// anteriores quedan ocultos (reset visual) sin borrarse de la BD.
export function getCurrentWeekMonday(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jsDay = d.getDay(); // 0 = domingo .. 6 = sábado
  const daysSinceMonday = jsDay === 0 ? 6 : jsDay - 1;
  d.setDate(d.getDate() - daysSinceMonday);
  return formatDate(d);
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Validación defensiva: garantiza que un identificador interpolado en SQL
// (nombre de tabla/columna) solo contenga caracteres seguros. Evita que una
// variable inesperada se convierta en vector de inyección.
export function assertSafeIdentifier(name: string): void {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Identificador SQL no permitido: ${name}`);
  }
}

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export type BMICategory = 'Bajo peso' | 'Normal' | 'Sobrepeso' | 'Obesidad';

export function classifyBMI(bmi: number): BMICategory | null {
  if (!isFinite(bmi) || bmi <= 0) return null;
  if (bmi < 18.5) return 'Bajo peso';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidad';
}

export function formatPlanDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  const dt = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return `${dayNames[dt.getDay()]} ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
}
