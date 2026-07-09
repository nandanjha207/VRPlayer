/**
 * Sample-app-only wrapper for iOS AVRoutePickerView (AirPlay route picker).
 * Android renders nothing — AirPlay is iOS-only.
 */
import React from 'react';
import {
  Platform,
  requireNativeComponent,
  StyleProp,
  ViewStyle,
} from 'react-native';

type NativeProps = {
  style?: StyleProp<ViewStyle>;
};

const NativeAirPlayRoutePicker =
  Platform.OS === 'ios'
    ? requireNativeComponent<NativeProps>('AirPlayRoutePickerView')
    : null;

type Props = {
  style?: StyleProp<ViewStyle>;
};

/** Matches overlay iconGlyph (~18pt) inside iconHit (8pt padding). */
const DEFAULT_SIZE = 34;

export function AirPlayRoutePickerButton({style}: Props) {
  if (!NativeAirPlayRoutePicker) {
    return null;
  }

  return (
    <NativeAirPlayRoutePicker
      style={[{width: DEFAULT_SIZE, height: DEFAULT_SIZE}, style]}
      accessibilityLabel="AirPlay"
    />
  );
}
