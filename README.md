# Motion Trail Sculptor

Motion Trail Sculptor introduces frame differencing as a visual idea. A moving brightness centroid drives layered trails in sample mode or from a local camera, with controls for sensitivity and trail length.

## What this demonstrates

- Comparing current and previous frame signals
- Mapping movement into generative geometry
- Controlling trail persistence
- Avoiding uploads and hidden permissions
- Respecting reduced-motion preferences

## Run it

Open `index.html` in a modern browser. For camera mode, serve the folder from `localhost` or HTTPS, then choose **Start camera**. The project does not need npm, a bundler, or a build step.

## Browser notes

Camera permission is requested only after an explicit button action, video-only constraints are used, and media tracks are stopped when the page is left. The project processes the low-resolution signal in the browser and never uploads frames. If permission is denied, the pointer and sample modes remain usable.

This package intentionally uses a transparent Canvas 2D signal baseline instead of hiding a model download. To study a landmark upgrade, replace `analyzeFrame()` with a landmark provider and preserve the same permission, fallback, cleanup, and reduced-motion contracts.

## How to study this

Start with `index.html`, then read `resize()`, `analyzeFrame()`, and `render()` in `app.js`. Change one mapping at a time: input position, signal energy, trail length, or color range. Keep the interaction understandable before adding a dependency.

## License

Released under the MIT License. See [LICENSE](LICENSE).
