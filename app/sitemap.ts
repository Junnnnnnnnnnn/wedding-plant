import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // 배포 후 실제 도메인으로 변경해주세요 (예: https://my-wedding.com)
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://wedding-plant.vercel.app";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    // 추가적인 페이지가 있다면 여기에 배열 형태로 추가할 수 있습니다.
    // 예: { url: `${baseUrl}/budget-detail`, lastModified: new Date(), priority: 0.8 }
  ];
}
