# InstaCheers icon

Created with the built-in Imagegen tool. The selected generated PNG is preserved as `instacheers-source.png`; the original output also remains in the local generated-image library.

The camera/follow mark is used by the extension manager, toolbar, and popup. Transparent PNG exports are provided at 16, 32, 48, and 128 pixels, following the [Chrome manifest icon format](https://developer.chrome.com/docs/extensions/reference/manifest/icons).

## Generation prompt

```text
Use case: logo-brand. Asset type: finished square Chrome extension app icon for InstaCheers, a tool for finding Instagram accounts and following them. Create a bold, highly legible independent camera mark with a small circular plus/follow badge. White camera outline and a single simple lens, thick strokes that stay readable at 16 pixels. Rounded-square deep indigo tile with a restrained violet-to-coral warm gradient, compatible with a dark violet UI. Large centered symbol, balanced padding, clean flat vector-like raster artwork, no tiny decorative details. The plus badge is clearly distinct from the lens. Transparent outside the rounded-square tile; crisp clean alpha edges. No text, no letters, no watermark, no presentation mockup, just one finished icon.
```

## Exporting sizes

The checked-in icons were resized from the source with macOS `sips`, preserving transparency. No icon-generation dependencies are required to install or use the extension.

```sh
for size in 16 32 48 128; do
  sips -z "$size" "$size" icons/instacheers-source.png --out "icons/icon${size}.png"
done
```
