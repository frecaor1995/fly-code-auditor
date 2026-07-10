/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true
  },
  // Asegura que Vercel empaquete data/*.json y storage/ en las funciones
  // serverless de /api. Sin esto, el file tracing automatico puede omitir
  // archivos leidos con rutas construidas dinamicamente (path.join(cwd, ...)),
  // causando fallos de lectura en produccion que no ocurren en local.
  // En Next 14 esta opcion vive bajo "experimental" (se vuelve top-level en Next 15).
  experimental: {
    outputFileTracingIncludes: {
      "/api/**/*": ["./data/**/*", "./storage/**/*"]
    }
  }
};

module.exports = nextConfig;
