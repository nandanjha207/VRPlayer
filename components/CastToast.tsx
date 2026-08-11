import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

/** Non-blocking toast for Cast disconnect / validation messages. */
export function CastToast({message, onDismiss, durationMs = 4500}: Props) {
  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  if (!message) {
    return null;
  }

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    zIndex: 30,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    maxWidth: 420,
  },
  text: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
