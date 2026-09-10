export const colors = {
  background: '#1a1a2e',
  card: '#16213e',
  cardAlt: '#2a2a4a',
  primary: '#e94560',
  text: '#ffffff',
  textMuted: '#a0a0b8',
  textSubtle: '#7a7a96',
  success: '#4caf50',
  warning: '#ffd166',
  info: '#e0e0f0',
  graph: '#201d38',
  border: '#222244',
  scrim: 'rgba(0,0,0,0.5)',
  scrimStrong: 'rgba(0,0,0,0.6)',
  primarySoft: 'rgba(233,69,96,0.12)',
  primarySofter: 'rgba(233,69,96,0.10)',
  successSoft: 'rgba(76,175,80,0.12)',
  warningSoft: 'rgba(255, 209, 102, 0.1)',
} as const;

export type AppColors = typeof colors;