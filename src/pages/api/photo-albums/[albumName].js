import { addCacheTag } from '@vercel/functions'

import { getPhotoAlbumDetails } from '@/lib/getPhotoAlbums'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { albumName } = req.query
  const resolvedName = Array.isArray(albumName) ? albumName[0] : albumName

  // 1 month
  res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=2592000')

  if (!resolvedName) {
    res.status(400).json({ error: 'An album name must be provided.' })
    return
  }

  const normalizedTag =
    typeof resolvedName === 'string'
      ? resolvedName.replace(/[^a-zA-Z0-9-_]/g, '_')
      : 'unknown'
  addCacheTag('photo-albums', `photo-album-${normalizedTag}`)

  try {
    const album = await getPhotoAlbumDetails(resolvedName)

    if (!album) {
      res.status(404).json({ error: 'Album not found.' })
      return
    }

    res.status(200).json({ album })
  } catch (error) {
    res
      .status(500)
      .json({ error: error?.message || 'Unable to load the requested album. Please try again.' })
  }
}
