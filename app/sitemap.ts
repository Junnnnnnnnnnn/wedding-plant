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
    {
      // 로그인 없이 볼 수 있는 문서. 스토어 등록 양식이 이 주소를 요구하고
      // 심사자와 크롤러가 여기로 들어온다.
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    // 추가적인 페이지가 있다면 여기에 배열 형태로 추가할 수 있습니다.
    // 예: { url: `${baseUrl}/budget-detail`, lastModified: new Date(), priority: 0.8 }
  ];
}
