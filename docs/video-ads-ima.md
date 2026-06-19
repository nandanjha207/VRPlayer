# Client-side video ads (Google IMA) with react-native-video

This app enables **native** Google IMA integration from `react-native-video`. If the Android/iOS flags below are off, **`source.ad` is ignored (Android) or IMA is not linked (iOS)** — JS-only configuration is not enough.

## Android — ExoPlayer IMA

In the **root** `android/build.gradle`, inside the `buildscript { ext { ... } }` block, set:

```gradle
useExoplayerIMA = true
```

The library also accepts the same flag prefixed with `RNVideo_` (e.g. `RNVideo_useExoplayerIMA`) for consistency with other RN Video `ext` keys.

After changing this, run a **clean rebuild** so `media3-exoplayer-ima` is pulled in and `USE_EXOPLAYER_IMA` is true in the video module, for example:

```sh
cd android && ./gradlew clean && cd .. && npx react-native run-android
```

## iOS — Google IMA SDK

In `ios/Podfile`, **before** the `target` / `use_native_modules!` resolution (we set it right after `prepare_react_native_project!`):

```ruby
$RNVideoUseGoogleIMA = true
```

Then install pods and rebuild:

```sh
cd ios && bundle exec pod install && cd .. && npx react-native run-ios
```

## Expo / config plugins

This repo is a **bare** React Native CLI app (`app.json` has no `expo` block). If you use **Expo prebuild**, add the upstream config plugin and enable ads, for example in `app.config.js`:

```js
[
  'react-native-video',
  {
    enableADSExtension: true,
    // other withRNVideo options as needed
  },
],
```

See `react-native-video`’s `app.plugin.js` → `withRNVideo` / `withAds` in the package.

## JavaScript — `source.ad`

Pass ads on the **source** object (not only legacy top-level `adTagUrl` props):

```tsx
<Video
  source={{
    uri: 'https://example.com/content.m3u8',
    ad: {
      adTagUrl: 'https://...your-https-ima-or-gam-tag...',
      adLanguage: 'en', // optional ISO 639-1
      gamRequestTimeoutMs: 15000, // optional VAST load timeout (ms)
    },
  }}
  onReceiveAdEvent={e => {
    console.log(e.event, e.data);
  }}
/>
```

Use **`onReceiveAdEvent`** for logging or UI (start, complete, errors, skippable flow, etc.). Event names align with `AdEvent` in `react-native-video`.

## iOS: use a format **AVPlayer** can play

`AVPlayer` does **not** support **Matroska (.mkv)** the way ExoPlayer does. If your `source.uri` is MKV, the item often never reaches a good **ready-for-display** state, the library may **never call `requestAds()`**, and you get a **black** view with **no** `onReceiveAdEvent` lines.

This app’s shared sample (`components/googleImaSampleConfig.ts`) uses the ExoPlayer MKV URL on **Android** and a short **MP4** on **iOS**. Keep production **HLS / MP4** (or other iOS-supported types) for real content + `source.ad`.

## SpoTV / custom fork: `isContentPlaying` + `paused` (Android)

This repo’s **react-native-video** fork changes `ReactExoplayerView.setPausedModifier` so that **`resumePlayback()` runs only when `paused === false` and `isContentPlaying === true`**. If you pass `paused={false}` without setting **`isContentPlaying`** (native prop from JS), Android will call **`pausePlayback()`** instead — preroll can load (`LOADED`, `CONTENT_PAUSE_REQUESTED`) but the pipeline stays **paused** (you may see a static IMA slate and a `PAUSED` ad event).

- **`components/ImaAdTestPlayer.tsx`** passes **`isContentPlaying`** for autoplay-style QA.
- **`components/MediaCatalogPlayer.tsx`** already sets **`isContentPlaying`** when the user taps **play** in the custom overlay (same pattern you need for catalog items with `adTagUri`).

## Catalog vs “IMA ads” tab

The **Catalog** list uses the **same** `<Video />` and the same `source.ad` wiring via `adTagUri` on a row (see **“MKV + Google sample linear preroll”** in `components/curatedPlaylist.ts`). The separate **IMA ads** tab is only a **small QA harness** with preset tags and an on-screen **ad event log** — not a technical requirement. You can remove the tab later if you prefer catalog-only testing.

## Rotating ad tags (staging vs production)

1. **Do not hardcode production GAM/IMA URLs** in app code for release builds. Prefer remote config, a small authenticated JSON endpoint from ad ops, or build-time env (e.g. CI injects `AD_TAG_URL` into a generated `adsConfig.ts`).
2. **Staging**: use Google’s sample tags or your GAM “test” line item URLs until preroll and VMAP behave correctly on device.
3. **Production**: swap to the live tag only after QA on both platforms; keep the same `source.uri` + `source.ad.adTagUrl` shape.
4. **Verification order**: confirm **linear preroll** → **skippable** → **VMAP** using the presets under the **IMA ads** tab in `App.tsx`, or use the **Catalog** row **“MKV + Google sample linear preroll”** (same URLs in `components/googleImaSampleConfig.ts`).

## Built-in QA presets

| # | Scenario        | Purpose                          |
|---|-----------------|----------------------------------|
| 1 | Linear preroll  | Baseline VAST before content     |
| 2 | Skippable       | Skip button + content resume     |
| 3 | VMAP pre/mid/post | Ad rules across the timeline  |

Sample content URI and tag URLs are in **`components/googleImaSampleConfig.ts`** (imported by `ImaAdTestPlayer.tsx` and the catalog IMA row).
