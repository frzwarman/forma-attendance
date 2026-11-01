import { Asset } from "expo-asset";

// The opening popup: two animations (INTRO, BANNER), then the speakers, then the CLOSING picture; the
// page after check-in shows the banner as a still picture (OPENING). To change a picture, replace its file in
// assets/event/ (WebP, near 1000 px wide) and update its size and the description read out by screen readers.
export type SlidePicture = { src: () => string; width: number; height: number; alt: string };
const picture = (module: number, width: number, height: number, alt: string): SlidePicture => ({ src: () => Asset.fromModule(module).uri, width, height, alt });

// An animation played as a looping video. end is a still of it, shown instead with reduced motion or
// where the video cannot play.
export type SlideVideo = { webm: () => string; mp4: () => string; poster: () => string; end: () => string; label: string };

// The first slide: the Bawaslu logo reveal, made from a 29 MB GIF (1760 x 1040, 5 s, 25 fps) as 960 px
// video, about 250 KB, of which a phone downloads one: AV1 in WebM (Chrome, Android, Firefox) and
// H.264 in MP4 (Safari). The poster is its first frame (4.5 KB), shown until the video plays; end is
// its last frame (the logos, 32 KB), shown instead of the video with reduced motion or where it cannot
// play. To replace it, encode the new animation the same way:
//   ffmpeg -i in.gif -vf "hqdn3d=3:3:4:4,scale=960:-2:flags=lanczos,format=yuv420p" -c:v libsvtav1 -preset 4 -crf 46 -an intro.webm
//   ffmpeg -i in.gif -vf "(same)" -c:v libx264 -preset veryslow -crf 32 -profile:v high -level:v 4.0 -movflags +faststart -an intro.mp4
export const INTRO: SlideVideo = {
  webm: () => Asset.fromModule(require("../../../assets/event/intro.webm")).uri,
  mp4: () => Asset.fromModule(require("../../../assets/event/intro.mp4")).uri,
  poster: () => Asset.fromModule(require("../../../assets/event/intro-poster.webp")).uri,
  end: () => Asset.fromModule(require("../../../assets/event/intro-end.webp")).uri,
  label: "Animasi pembuka: lambang Garuda Pancasila, lalu logo Bawaslu",
};

// The second slide: the event banner animated, from a 7 s, 5040 x 2160 phone video (18 MB, HEVC),
// encoded like INTRO at 1280 px so its small text stays readable: 225 KB AV1 (-crf 54) and 216 KB H.264,
// sound dropped. The poster is its first frame (7 KB); end is the full banner at 4 s (94 KB), since the
// video's last frame is the bare background.
export const BANNER: SlideVideo = {
  webm: () => Asset.fromModule(require("../../../assets/event/kv-bawaslu.webm")).uri,
  mp4: () => Asset.fromModule(require("../../../assets/event/kv-bawaslu.mp4")).uri,
  poster: () => Asset.fromModule(require("../../../assets/event/kv-bawaslu-poster.webp")).uri,
  end: () => Asset.fromModule(require("../../../assets/event/kv-bawaslu-end.webp")).uri,
  label:
    "Animasi spanduk acara: Penguatan Tata Kelola Perencanaan dan Kelembagaan Pengawasan Pemilu melalui Pengembangan Kapasitas dan Transformasi Digital menuju Pemilu 2029. Jakarta, 1 - 6 November 2026. Bersama rakyat awasi pemilu, bersama Bawaslu tegakkan keadilan pemilu",
};

// The banner as a picture, for the page after check-in. From the 488 x 310 cm banner PDF, rendered large and scaled to 960 px so the first visit stays light.
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
