import { Asset } from "expo-asset";

// The picture slides of the opening popup, before and after the speakers; the page after check-in
// shows the first one. To change one, replace its file in assets/event/ (WebP; the first loads on
// every first visit, so keep it near 1000 px wide) and update its size and the description read
// out by screen readers.
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

// The list of materials and their speakers (KV Bawaslu-02). 1400 px wide so its small text stays
// sharp when zoomed; it loads only once the attendee nears the end. The description is the text on it.
export const CLOSING = picture(
  require("../../../assets/event/materi.webp"),
  1400,
  781,
  [
    "Materi.",
    "Sentinel 1: Sistem Data Posisi Seluler (SDPS), Mr Siim Esko.",
    "Sentinel 2: Sistem Kecerdasan Sosial (SKS), Karen Grace Sutoto & Team.",
    "Sentinel 3: Sistem Kecerdasan Neuro-Sosial (SKNS), Verdyka & Indra Hardianto.",
    "Sentinel 4S: Sistem E-Rekap Berbasis Blockchain (SEBB), I Gede Putu Rahman Desyanta (Anta).",
    "Sentinel 5: Sistem Analitik dan Pelaporan Kecerdasan Hukum (SAPKH), Agus Canny & Muhammad Juan Al Qausar.",
    "Sentinel 6: Sistem Kecerdasan Prosiding Persidangan Konstitusi (SKPPK), Muhammad Juan Al Qausar & I Gede Putu Rahman Desyanta (Anta).",
    "Sentinel 7: Sistem Elektoral & Kecerdasan Hukum (SKEKH), Agus Canny & Muhammad Juan Al Qausar.",
    "Sentinel 8: Sistem Administrasi & Verifikasi Partai Politik (SAVPP), Agus Canny & Muhammad Juan Al Qausar.",
    "Sentinel 9S: Sistem Program Integritas Data Pemilu Bawaslu (SPIDPB), Agus Canny & Muhammad Juan Al Qausar.",
  ].join(" "),
);
