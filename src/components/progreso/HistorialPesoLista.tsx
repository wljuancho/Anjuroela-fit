import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WeightLog } from '../../types/progress';
import { formatNumber } from '../../services/utils';

interface HistorialPesoListaProps {
  logs: WeightLog[];
  onDelete: (id: number) => void;
  onEdit: (log: WeightLog) => void;
}

function formatDateLabel(date: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function HistorialPesoLista({ logs, onDelete, onEdit }: HistorialPesoListaProps) {
  if (logs.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="scale-outline" size={40} color="#2a2a4a" />
        <Text style={styles.emptyText}>Sin registros todavía</Text>
        <Text style={styles.emptySubtext}>Registra tu primer peso para empezar a seguir tu evolución</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {logs.map((log) => (
        <View key={log.id} style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.date}>{formatDateLabel(log.date)}</Text>
            {log.notes ? <Text style={styles.notes} numberOfLines={1}>{log.notes}</Text> : null}
          </View>
          <Text style={styles.weight}>{formatNumber(log.weight_kg, 1)} kg</Text>
          <TouchableOpacity style={styles.action} onPress={() => onEdit(log)}>
            <Ionicons name="create-outline" size={20} color="#a0a0b8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => onDelete(log.id)}>
            <Ionicons name="trash-outline" size={20} color="#e94560" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  info: {
    flex: 1,
  },
  date: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  notes: {
    color: '#a0a0b8',
    fontSize: 12,
    marginTop: 2,
  },
  weight: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: '700',
  },
  action: {
    padding: 4,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#a0a0b8',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  emptySubtext: {
    color: '#7a7a96',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});