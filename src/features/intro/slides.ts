// Placeholder event slides shown when the public page opens. The photos are free
// Unsplash images (see assets/event/README.md); replace text and photos with the
// real programme before the event.
export const EVENT = {
  title:
    "Penguatan Kapasitas Komunikasi, Informasi dan Edukasi Pengkajian, Pengembangan dan Pemanfaatan Teknologi Artificial Intelligence, dan Blockchain dalam Mendukung Transformasi Pengawasan Pemilu",
  when: "Jakarta, 2 - 6 November 2029",
};

export type PhotoSlide = { image: number; alt: string; title: string; body: string };

export const PHOTO_SLIDES: PhotoSlide[] = [
  {
    image: require("../../../assets/event/sesi.webp"),
    alt: "Peserta menyimak pemaparan di depan layar besar",
    title: "Lima hari sesi panel dan lokakarya",
    body: "Pemaparan, diskusi panel, dan studi kasus pemanfaatan kecerdasan buatan dan blockchain untuk pengawasan pemilu.",
  },
  {
    image: require("../../../assets/event/narasumber.webp"),
    alt: "Mikrofon di depan peserta acara",
    title: "Narasumber dan praktisi",
    body: "Akademisi, praktisi teknologi, dan jajaran pengawas pemilu berbagi pengalaman serta rekomendasi.",
  },
  {
    image: require("../../../assets/event/jakarta.webp"),
    alt: "Bundaran HI dan gedung-gedung di Jakarta",
    title: "Lokasi acara di Jakarta",
    body: "Tempat dan jadwal harian dibagikan panitia menjelang acara. Simpan nomor WhatsApp panitia untuk kabar terbaru.",
  },
  {
    image: require("../../../assets/event/aula.webp"),
    alt: "Aula konferensi dengan meja bundar dan layar",
    title: "Check-in kehadiran",
    body: "Isi formulir di halaman ini untuk mencatat kehadiran Anda. Prosesnya hanya butuh satu menit.",
  },
];
