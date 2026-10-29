import { Asset } from "expo-asset";

// The pictures of the opening popup: two before the speakers and one after them; after check-in the
// page shows the last one alone. To change one, replace its file in assets/event/ (WebP, about
// 1080 px wide; the first two load on every first visit) and update its size and the description
// read out by screen readers.
export type SlidePicture = { src: () => string; width: number; height: number; alt: string };
const picture = (module: number, width: number, height: number, alt: string): SlidePicture => ({ src: () => Asset.fromModule(module).uri, width, height, alt });

export const OPENING: SlidePicture[] = [
  picture(
    require("../../../assets/event/pembuka.webp"),
    1080,
    608,
    "Bawaslu di pusat jaringan sistem pengawasan: SDPS, SPDDB, SAWPP, SKEKH, SKP9K, SAPKH, SEBB, SKNS, dan SKS",
  ),
  picture(
    require("../../../assets/event/key-visual.webp"),
    1080,
    602,
    "Penguatan Tata Kelola Perencanaan dan Kelembagaan Pengawasan Pemilu melalui Pengembangan Kapasitas dan Transformasi Digital menuju Pemilu 2029. Grand Sahid Jaya Hotel, 1 - 6 November 2026",
  ),
];
// Cropped from the supplied photo without its black bars; the Project On rights notice stays.
export const CLOSING = picture(
    require("../../../assets/event/key-visual.webp"),
    1080,
    602,
    "Penguatan Tata Kelola Perencanaan dan Kelembagaan Pengawasan Pemilu melalui Pengembangan Kapasitas dan Transformasi Digital menuju Pemilu 2029. Grand Sahid Jaya Hotel, 1 - 6 November 2026",
  )
