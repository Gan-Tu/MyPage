# MyPage

Latest attempt at making a personal website

## Media optimization

Run the helper script to shrink originals and generate thumbnails for a folder of images:

```bash
node scripts/optimize-media.mjs --concurrency 6 <path-to-your-media> 
```

Key defaults:

- Originals stay in-place, capped at ~20 MB while keeping the shortest side >= 1024 px.
- Thumbnails are written next to each image using the `_thumbnail` suffix, no bigger than 1024x768 and roughly 2 MB.
- Use `--dry-run` to preview work, or `--force` to re-generate thumbnails.

Install dependencies first if `sharp` is missing: `npm install`.
