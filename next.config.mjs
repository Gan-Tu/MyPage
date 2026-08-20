import nextMDX from '@next/mdx'

const photographyBucket =
  process.env.PHOTOGRAPHY_BUCKET ||
  process.env.NEXT_PUBLIC_PHOTOGRAPHY_BUCKET ||
  'tugan-photos'

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'mdx'],
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: `/${photographyBucket}/**`,
      },
    ],
    minimumCacheTTL: 2678400,
  },
  experimental: {
    // newNextLinkBehavior: true,
    scrollRestoration: true,
  },
}

const withMDX = nextMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: ['@mapbox/rehype-prism'],
  },
})

export default withMDX(nextConfig)
