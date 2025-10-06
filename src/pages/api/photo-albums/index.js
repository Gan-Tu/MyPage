import { getPaginatedPhotoAlbums } from '@/lib/getPhotoAlbums'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { page, pageSize } = req.query

  try {
    const result = await getPaginatedPhotoAlbums({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })

    res.status(200).json(result)
  } catch (error) {
    res
      .status(500)
      .json({ error: error?.message || 'Unable to load photo albums. Please try again.' })
  }
}
