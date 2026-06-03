/**
 * Test app entry — hosts the simple video player for control testing.
 *
 * @format
 */

import React from 'react';
import {StatusBar, StyleSheet, useColorScheme} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {SimpleVideoPlayer} from './components/SimpleVideoPlayer';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'light-content'} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <SimpleVideoPlayer />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
});

export default App;
