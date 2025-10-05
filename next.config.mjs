import nextMDX from '@next/mdx'
import remarkGfm from 'remark-gfm'
import rehypePrism from '@mapbox/rehype-prism'

const photographyBucket =
  process.env.PHOTOGRAPHY_BUCKET ||
  process.env.NEXT_PUBLIC_PHOTOGRAPHY_BUCKET ||
  'tugan-photos'

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['jsx', 'mdx'],
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: `/${photographyBucket}/**`,
      },
    ],
  },
  experimental: {
    // newNextLinkBehavior: true,
    scrollRestoration: true,
  },
}

const withMDX = nextMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypePrism],
  },
})

export default withMDX(nextConfig)
