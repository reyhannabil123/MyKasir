import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Foto menu dan QRIS dikirim lewat server action sebagai teks base64 (sudah diperkecil di browser).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Pustaka ekspor dibaca langsung dari node_modules (pdfkit butuh file font bawaannya).
  serverExternalPackages: ["pdfkit", "exceljs"],
  outputFileTracingIncludes: { "/api/export": ["./node_modules/pdfkit/js/data/**/*"] },
};

export default nextConfig;
