/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }], // report images/audio served from S3/R2 domains
  },
};
module.exports = nextConfig;
