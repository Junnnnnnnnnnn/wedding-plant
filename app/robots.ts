import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // 배포 후 실제 도메인으로 변경해주세요
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://wedding-plant.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 검색엔진에 노출하고 싶지 않은 개인정보/설정 페이지는 여기에 추가합니다.
      // disallow: ["/private/", "/admin/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
