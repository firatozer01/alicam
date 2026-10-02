import type { NextConfig } from "next";

const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8091";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        // "Kontör" adi "kredi" oldu ve sayfanin adresi de degisti. Eski
        // adres yer imlerinde, e-postalarda ve disaridan verilmis
        // baglantilarda duruyor; kalici yonlendirme biraksin diye burada.
        source: "/kontor-yukle",
        destination: "/kredi-yukle",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
      {
        source: "/sanctum/:path*",
        destination: `${apiProxyTarget}/sanctum/:path*`,
      },
    ];
  },
};

export default nextConfig;
