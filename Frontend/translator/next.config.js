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
  webpack: (config) => {
    // pdfjs-dist can pull Node-only canvas bindings in some bundles.
    // Disable canvas resolution for browser builds.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      canvas: false,
    };

    return config;
  },
};