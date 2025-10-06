import { getPhotoAlbumDetails } from '@/lib/getPhotoAlbums'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { albumName } = req.query
  const resolvedName = Array.isArray(albumName) ? albumName[0] : albumName

  if (!resolvedName) {
    res.status(400).json({ error: 'An album name must be provided.' })
    return
  }

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
