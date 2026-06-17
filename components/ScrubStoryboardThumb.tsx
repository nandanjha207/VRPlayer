import React, {useEffect, useRef, useState} from 'react';
import {Image, Platform, StyleSheet, View} from 'react-native';
import type {StoryboardRegion} from './thumbnailStoryboardVtt';

type ScrubStoryboardThumbProps = {
  imageUri: string;
  region: StoryboardRegion | null;
  boxWidth: number;
  boxHeight: number;
  /** If set, image bytes are loaded via fetch() then shown as a data: URI (RN Image often ignores headers on http(s) URLs). */
  imageRequestHeaders?: Record<string, string>;
  /**
   * Full sprite pixel size from the VTT (union of #xywh rects). Avoids Image.getSize for http(s)
   * when combined with auth headers.
   */
  spriteBounds?: {w: number; h: number} | null;
  onLoadError?: () => void;
};

function hasHeaders(h?: Record<string, string>): boolean {
  return Boolean(h && Object.keys(h).length > 0);
}

/** Safe for multi‑MB JPEGs (no spread-arg limits). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return (globalThis as unknown as {btoa: (data: string) => string}).btoa(
    binary,
  );
}

async function fetchImageAsDataUri(
  uri: string,
  headers: Record<string, string>,
): Promise<string> {
  const res = await fetch(uri, {headers});
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const rawCt = res.headers.get('content-type');
  const ct = rawCt?.split(';')[0]?.trim() || 'image/jpeg';
  const buf = await res.arrayBuffer();
  return `data:${ct};base64,${arrayBufferToBase64(buf)}`;
}

/** iOS / Metal often fails or draws blank when Image layout pixels exceed ~2048–4096 per edge. */
const MAX_SPRITE_LAYOUT_EDGE = Platform.OS === 'ios' ? 2048 : 4096;

/**
 * Shows one storyboard cell: full-URL frame or #xywh crop from a sprite sheet.
 * Custom request headers are applied via fetch → data URI so Image does not need header support.
 */
export function ScrubStoryboardThumb({
  imageUri,
  region,
  boxWidth,
  boxHeight,
  imageRequestHeaders,
  spriteBounds,
  onLoadError,
}: ScrubStoryboardThumbProps) {
  const needsHeaderFetch = hasHeaders(imageRequestHeaders);
  const [resolvedUri, setResolvedUri] = useState<string | null>(() =>
    needsHeaderFetch ? null : imageUri,
  );
  const [resolvePhase, setResolvePhase] = useState<'loading' | 'ready' | 'error'>(() =>
    needsHeaderFetch ? 'loading' : 'ready',
  );
  const [measuredSize, setMeasuredSize] = useState<{w: number; h: number} | null>(
    null,
  );
  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;

  const hasVttSpriteBounds = Boolean(
    region &&
      spriteBounds &&
      spriteBounds.w > 0 &&
      spriteBounds.h > 0,
  );

  const naturalSize = hasVttSpriteBounds ? spriteBounds! : measuredSize;

  useEffect(() => {
    let cancelled = false;
    setMeasuredSize(null);

    if (!hasHeaders(imageRequestHeaders)) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[storyboard] thumb direct URI (no fetch)', imageUri);
      }
      setResolvedUri(imageUri);
      setResolvePhase('ready');
      return () => {
        cancelled = true;
      };
    }

    setResolvedUri(null);
    setResolvePhase('loading');

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        '[storyboard] thumb fetch start (headers)',
        imageUri,
        'headerKeys:',
        Object.keys(imageRequestHeaders!),
      );
    }

    (async () => {
      try {
        const dataUri = await fetchImageAsDataUri(
          imageUri,
          imageRequestHeaders!,
        );
        if (!cancelled) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.log(
              '[storyboard] thumb fetch OK',
              imageUri,
              'dataUri length:',
              dataUri.length,
            );
          }
          setResolvedUri(dataUri);
          setResolvePhase('ready');
        }
      } catch (e) {
        if (!cancelled) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[storyboard] thumb fetch FAILED', imageUri, e);
          }
          setResolvePhase('error');
          onLoadErrorRef.current?.();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUri, imageRequestHeaders]);

  useEffect(() => {
    if (!region || hasVttSpriteBounds || !resolvedUri || resolvePhase !== 'ready') {
      return;
    }
    let cancelled = false;
    Image.getSize(
      resolvedUri,
      (w, h) => {
        if (!cancelled) {
          setMeasuredSize({w, h});
        }
      },
      () => {
        if (!cancelled) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[storyboard] Image.getSize failed', resolvedUri?.slice(0, 48));
          }
          onLoadErrorRef.current?.();
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [region, hasVttSpriteBounds, resolvedUri, resolvePhase]);

  if (resolvePhase === 'loading' || !resolvedUri) {
    return (
      <View
        style={[
          styles.placeholder,
          {width: boxWidth, height: boxHeight},
        ]}
      />
    );
  }

  if (resolvePhase === 'error') {
    return (
      <View
        style={[
          styles.placeholder,
          {width: boxWidth, height: boxHeight},
        ]}
      />
    );
  }

  const source = {uri: resolvedUri};

  if (!region) {
    return (
      <Image
        source={source}
        style={{width: boxWidth, height: boxHeight}}
        resizeMode="cover"
        onError={e => {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn(
              '[storyboard] Image onError (full frame)',
              imageUri,
              e.nativeEvent,
            );
          }
          onLoadError?.();
        }}
      />
    );
  }

  if (!naturalSize) {
    return (
      <View
        style={[
          styles.placeholder,
          {width: boxWidth, height: boxHeight},
        ]}
      />
    );
  }

  const scale = Math.min(boxWidth / region.w, boxHeight / region.h);
  let imgW = naturalSize.w * scale;
  let imgH = naturalSize.h * scale;
  let drawScale = scale;
  if (imgW > MAX_SPRITE_LAYOUT_EDGE || imgH > MAX_SPRITE_LAYOUT_EDGE) {
    const shrink = Math.min(
      MAX_SPRITE_LAYOUT_EDGE / imgW,
      MAX_SPRITE_LAYOUT_EDGE / imgH,
    );
    drawScale *= shrink;
    imgW = naturalSize.w * drawScale;
    imgH = naturalSize.h * drawScale;
  }
  const offX = (boxWidth - region.w * drawScale) / 2;
  const offY = (boxHeight - region.h * drawScale) / 2;

  return (
    <View style={[styles.clip, {width: boxWidth, height: boxHeight}]}>
      <Image
        source={source}
        style={{
          width: imgW,
          height: imgH,
          transform: [
            {translateX: offX - region.x * drawScale},
            {translateY: offY - region.y * drawScale},
          ],
        }}
        resizeMode="stretch"
        onError={e => {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn(
              '[storyboard] Image onError (sprite crop)',
              imageUri,
              'region',
              region,
              'natural',
              naturalSize,
              e.nativeEvent,
            );
          }
          onLoadError?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  placeholder: {
    backgroundColor: '#1e293b',
  },
});
