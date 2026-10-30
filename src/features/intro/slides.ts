import { Asset } from "expo-asset";

// The picture slides before the speakers in the opening popup; the page after check-in shows the
// first one. To change one, replace its file in assets/event/ (WebP, about 1000 px wide; the first
// loads on every first visit) and update its size and the description read out by screen readers.
export type SlidePicture = { src: () => string; width: number; height: number; alt: string };
const picture = (module: number, width: number, height: number, alt: string): SlidePicture => ({ src: () => Asset.fromModule(module).uri, width, height, alt });

// From the 488 x 310 cm banner PDF, rendered large and scaled to 960 px so the first visit stays light.
export const OPENING: SlidePicture[] = [
  picture(
    require("../../../assets/event/kv-bawaslu.webp"),
    960,
    611,
    "Penguatan Tata Kelola Perencanaan dan Kelembagaan Pengawasan Pemilu melalui Pengembangan Kapasitas dan Transformasi Digital menuju Pemilu 2029. Jakarta, 1 - 6 November 2026. Bersama rakyat awasi pemilu, bersama Bawaslu tegakkan keadilan pemilu",
  ),
];
