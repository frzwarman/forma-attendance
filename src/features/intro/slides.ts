import { Asset } from "expo-asset";

// The opening popup: INTRO (an animation), then the picture slides before and after the speakers; the
// page after check-in shows the first picture. To change one, replace its file in assets/event/ (WebP; the first loads on
// every first visit, so keep it near 1000 px wide) and update its size and the description read
// out by screen readers.
export type SlidePicture = { src: () => string; width: number; height: number; alt: string };
const picture = (module: number, width: number, height: number, alt: string): SlidePicture => ({ src: () => Asset.fromModule(module).uri, width, height, alt });

// The first slide: the Bawaslu logo reveal, made from a 29 MB GIF (1760 x 1040, 5 s, 25 fps) as 960 px
// video, about 250 KB, of which a phone downloads one: AV1 in WebM (Chrome, Android, Firefox) and
// H.264 in MP4 (Safari). The poster is its first frame (4.5 KB), shown until the video plays; end is
// its last frame (the logos, 32 KB), shown instead of the video with reduced motion or where it cannot
// play. To replace it, encode the new animation the same way:
//   ffmpeg -i in.gif -vf "hqdn3d=3:3:4:4,scale=960:-2:flags=lanczos,format=yuv420p" -c:v libsvtav1 -preset 4 -crf 46 -an intro.webm
//   ffmpeg -i in.gif -vf "(same)" -c:v libx264 -preset veryslow -crf 32 -profile:v high -level:v 4.0 -movflags +faststart -an intro.mp4
export const INTRO = {
  webm: () => Asset.fromModule(require("../../../assets/event/intro.webm")).uri,
  mp4: () => Asset.fromModule(require("../../../assets/event/intro.mp4")).uri,
  poster: () => Asset.fromModule(require("../../../assets/event/intro-poster.webp")).uri,
  end: () => Asset.fromModule(require("../../../assets/event/intro-end.webp")).uri,
  label: "Animasi pembuka: lambang Garuda Pancasila, lalu logo Bawaslu",
};

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
