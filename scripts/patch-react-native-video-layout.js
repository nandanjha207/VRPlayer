/**
 * RN 0.85: absoluteFillObject on the native Video layer can cause a black picture
 * while audio still plays. Align with react-native-video 6.19.2 fix.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'node_modules', 'react-native-video');

const patches = [
  {
    file: path.join(root, 'src', 'Video.tsx'),
    from: `      const baseStyle: StyleProp<ImageStyle> = {
        ...StyleSheet.absoluteFillObject,
        resizeMode: _posterResizeMode,
      };`,
    to: `      const baseStyle: StyleProp<ImageStyle> = [
        StyleSheet.absoluteFill,
        {resizeMode: _posterResizeMode},
      ];`,
  },
  {
    file: path.join(root, 'src', 'Video.tsx'),
    from: `    const _style: StyleProp<ViewStyle> = useMemo(
      () => ({
        ...StyleSheet.absoluteFillObject,
      }),
      [],
    );`,
    to: `    const _style: StyleProp<ViewStyle> = useMemo(
      () => StyleSheet.absoluteFill,
      [],
    );`,
  },
  {
    file: path.join(root, 'lib', 'Video.js'),
    from: `        const baseStyle = {
            ...react_native_1.StyleSheet.absoluteFillObject,
            resizeMode: _posterResizeMode,
        };`,
    to: `        const baseStyle = [
            react_native_1.StyleSheet.absoluteFill,
            { resizeMode: _posterResizeMode },
        ];`,
  },
  {
    file: path.join(root, 'lib', 'Video.js'),
    from: `    const _style = (0, react_1.useMemo)(() => ({
        ...react_native_1.StyleSheet.absoluteFillObject,
    }), []);`,
    to: `    const _style = (0, react_1.useMemo)(() => react_native_1.StyleSheet.absoluteFill, []);`,
  },
];

let applied = 0;

for (const {file, from, to} of patches) {
  if (!fs.existsSync(file)) {
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes(to)) {
    continue;
  }
  if (!content.includes(from)) {
    console.warn(
      `[patch-react-native-video-layout] Pattern not found in ${path.relative(process.cwd(), file)}`,
    );
    continue;
  }
  fs.writeFileSync(file, content.replace(from, to), 'utf8');
  applied += 1;
}

if (applied > 0) {
  console.log(
    `[patch-react-native-video-layout] Applied ${applied} layout patch(es).`,
  );
}
