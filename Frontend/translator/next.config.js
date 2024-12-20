/*@type {import('next').NextConfig} */

/* const nextConfig = {
  env: {
    backendUrl: process.env.API_URL,
    variant: process.env.VARIANT,
  },
};

module.exports = nextConfig; */
module.exports = {
  async redirects() {
    return[{
      source: '/',
      destination: '/about',
      permanent: true
    }]
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};