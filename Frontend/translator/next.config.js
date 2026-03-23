/*@type {import('next').NextConfig} */

/* const nextConfig = {
  env: {
    backendUrl: process.env.API_URL,
    variant: process.env.VARIANT,
  },
};

module.exports = nextConfig; */

/** @type {import('next').NextConfig} */
module.exports = {
  async redirects() {
    return [{
      source: '/',
      destination: '/about',
      permanent: true
    }]
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  webpack: (config, { isServer }) => {
    // Prevent Webpack from trying to bundle the 'canvas' binary on the client side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
      };
    }

    // This rule ensures that if Webpack encounters a .node file, 
    // it doesn't try to parse it as JavaScript.
    config.module.rules.push({
      test: /\.node$/,
      use: 'raw-loader',
    });

    return config;
  },
};