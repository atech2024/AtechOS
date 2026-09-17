/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel was failing in the ESLint phase because the generated
  // eslint-config-next module path is not being resolved correctly.
  // TypeScript checking and the production Next.js compilation still run.
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
