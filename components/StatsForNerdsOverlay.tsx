import React, {memo} from 'react';
import {Platform, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {StatsRow, StatsSnapshot} from './useStatsForNerds';

type Props = {
  visible: boolean;
  stats: StatsSnapshot;
};

function StatLine({row}: {row: StatsRow}) {
  return (
    <Text style={styles.line}>
      <Text style={styles.label}>{row.label}: </Text>
      <Text style={styles.value}>{row.value}</Text>
      <Text style={styles.source}> [{row.source}]</Text>
    </Text>
  );
}

function _StatsForNerdsOverlay({visible, stats}: Props) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator>
        <Text style={styles.title}>Stats For Nerds</Text>
        <Text style={styles.rule}>{'='.repeat(49)}</Text>
        {stats.playbackRows.map(row => (
          <StatLine key={row.label} row={row} />
        ))}
        <Text style={styles.sectionHeader}>--- Device ---</Text>
        {stats.deviceRows.map(row => (
          <StatLine key={row.label} row={row} />
        ))}
      </ScrollView>
    </View>
  );
}

export const StatsForNerdsOverlay = memo(_StatsForNerdsOverlay);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    maxHeight: '70%',
    zIndex: 20,
  },
  scroll: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  title: {
    color: '#f8fafc',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  rule: {
    color: '#94a3b8',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 10,
    marginBottom: 6,
  },
  sectionHeader: {
    color: '#cbd5e1',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  line: {
    color: '#e2e8f0',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 2,
  },
  label: {
    color: '#cbd5e1',
  },
  value: {
    color: '#f1f5f9',
  },
  source: {
    color: '#64748b',
  },
});
