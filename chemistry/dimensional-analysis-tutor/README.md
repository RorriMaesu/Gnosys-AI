# Metric Mind — Gnosys AI integration

Metric Mind is a no-build, browser-based tutor for metric-unit conversions and scientific notation. It teaches dimensional analysis one decision at a time, gives targeted hints, generates new problems, and stores progress only in the learner's browser.

This copy is embedded by `chemistry/index.html` inside the existing Dimensional Analysis section. Keep these files together so the relative stylesheet and JavaScript module paths continue to work.

The Gnosys AI GitHub Pages workflow publishes this folder with the rest of the repository. It must remain nested here rather than replacing the repository's root `index.html`.

## Run it locally

Use the normal Gnosys AI local server from the repository root. The site uses browser modules, so opening `index.html` directly from disk is not supported.

For example:

```bash
npm start
```

Then visit `http://127.0.0.1:8020/chemistry/index.html`, open **Dimensional Analysis**, and choose **Guided Tutor**.
