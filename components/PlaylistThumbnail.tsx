import React, {useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import type {CatalogStreamItem} from './exoListParser';

function buildPosterSource(
  item: CatalogStreamItem,
):
  | {uri: string; headers: Record<string, string>}
  | {uri: string}
  | undefined {
  if (!item.thumbnailUri) {
    return undefined;
  }
  if (item.headers && Object.keys(item.headers).length > 0) {
    return {uri: item.thumbnailUri, headers: item.headers};
  }
  return {uri: item.thumbnailUri};
}

function formatLabel(item: CatalogStreamItem): string {
  const lower = item.uri.toLowerCase();
  if (item.tags.includes('live')) {
    return 'LIVE';
  }
  if (item.drmScheme) {
    return 'DRM';
  }
  if (lower.includes('.m3u8')) {
    return 'HLS';
  }
  if (lower.includes('.mpd')) {
    return 'DASH';
  }
  if (lower.includes('.mp4')) {
    return 'MP4';
  }
  return 'VOD';
}

function placeholderColors(item: CatalogStreamItem): {
  backgroundColor: string;
  borderColor: string;
} {
  if (item.tags.includes('live')) {
    return {backgroundColor: '#7f1d1d', borderColor: '#ef4444'};
  }
  if (item.tags.includes('drm')) {
    return {backgroundColor: '#4c1d95', borderColor: '#a78bfa'};
  }
  if (item.uri.toLowerCase().includes('.mpd')) {
    return {backgroundColor: '#1e3a5f', borderColor: '#38bdf8'};
  }
  if (item.uri.toLowerCase().includes('.m3u8')) {
    return {backgroundColor: '#14532d', borderColor: '#4ade80'};
  }
  return {backgroundColor: '#334155', borderColor: '#94a3b8'};
}

type PlaylistThumbnailProps = {
  item: CatalogStreamItem;
};

export function PlaylistThumbnail({item}: PlaylistThumbnailProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(item.thumbnailUri) && !imageFailed;
  const colors = placeholderColors(item);
  const label = formatLabel(item);

  return (
    <View style={styles.wrap}>
      {showImage ? (
        <Image
          source={buildPosterSource(item)!}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              backgroundColor: colors.backgroundColor,
              borderColor: colors.borderColor,
            },
          ]}>
          <Text style={styles.placeholderLabel}>{label}</Text>
        </View>
      )}
      {item.tags.includes('live') && (
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>● LIVE</Text>
        </View>
      )}
      {item.tags.includes('drm') && !item.tags.includes('live') && (
        <View style={styles.drmBadge}>
          <Text style={styles.drmBadgeText}>DRM</Text>
        </View>
      )}
    </View>
  );
}

const THUMB_WIDTH = 88;
const THUMB_HEIGHT = 50;

const styles = StyleSheet.create({
  wrap: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#1e293b',
  },
  image: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  placeholder: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  placeholderLabel: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: 'rgba(220,38,38,0.92)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  drmBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(76,29,149,0.9)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  drmBadgeText: {
    color: '#ede9fe',
    fontSize: 8,
    fontWeight: '800',
  },
});
