import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'standalone',

    // Add API rewrites for better CORS handling
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
