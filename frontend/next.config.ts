import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Docker needs standalone; Vercel sets VERCEL=1 during builds and must not use it
    ...(process.env.VERCEL ? {} : { output: 'standalone' }),

    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: process.env.NEXT_PUBLIC_API_URL + '/:path*',
            },
        ];
    },
};

export default nextConfig;