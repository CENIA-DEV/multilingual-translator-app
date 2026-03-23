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
    // 1. Tell Webpack to ignore 'canvas' entirely when building the client-side bundle
    if (!isServer) {
      config.resolve.alias.canvas = false;
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
      };
    }

    // 2. Use Webpack 5's built-in asset system for .node binary files
    // This replaces 'raw-loader' so you don't have to install anything new.
    config.module.rules.push({
      test: /\.node$/,
      type: 'asset/resource',
    });

    return config;
  },
};