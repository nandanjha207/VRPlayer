/**
 * SpoTV / custom fork exposes `isContentPlaying` on native Video; upstream typings omit it.
 */
import React, {type ComponentProps} from 'react';
import Video from 'react-native-video';

export type VideoForkProps = ComponentProps<typeof Video> & {
  isContentPlaying?: boolean;
};

export const VideoPlayer = Video as unknown as React.ComponentType<VideoForkProps>;

export default VideoPlayer;
