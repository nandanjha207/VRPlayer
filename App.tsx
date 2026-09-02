/**
 * Test app entry — hosts the simple video player for control testing.
 *
 * @format
 */

import React, {useState} from 'react';
import {Pressable, StatusBar, StyleSheet, Text, useColorScheme, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import DvrTestPlayer from './components/DvrTestPlayer';
import ImaAdTestPlayer from './components/ImaAdTestPlayer';
import MediaCatalogPlayer from './components/MediaCatalogPlayer';

type AppMode = 'catalog' | 'ima' | 'dvr';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [mode, setMode] = useState<AppMode>('catalog');

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'light-content'} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.modeBar}>
          <Pressable
            onPress={() => setMode('catalog')}
            style={[styles.modeTab, mode === 'catalog' && styles.modeTabActive]}>
            <Text
              style={[
                styles.modeTabLabel,
                mode === 'catalog' && styles.modeTabLabelActive,
              ]}>
              Catalog
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('ima')}
            style={[styles.modeTab, mode === 'ima' && styles.modeTabActive]}>
            <Text
              style={[
                styles.modeTabLabel,
                mode === 'ima' && styles.modeTabLabelActive,
              ]}>
              IMA ads
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('dvr')}
            style={[styles.modeTab, mode === 'dvr' && styles.modeTabActive]}>
            <Text
              style={[
                styles.modeTabLabel,
                mode === 'dvr' && styles.modeTabLabelActive,
              ]}>
              DVR
            </Text>
          </Pressable>
        </View>
        {mode === 'catalog' ? (
          <MediaCatalogPlayer />
        ) : mode === 'ima' ? (
          <ImaAdTestPlayer />
        ) : (
          <DvrTestPlayer />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  modeBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  modeTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  modeTabActive: {
    backgroundColor: '#0ea5e9',
  },
  modeTabLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  modeTabLabelActive: {
    color: '#f8fafc',
  },
});

export default App;
