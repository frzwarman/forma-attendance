import assert from "node:assert/strict";
import { it } from "node:test";
import { labelSize, parseWheelFile, segmentAt, segmentColor, spinTo, WHEEL_COLORS, wheelLabel } from "./wheel";

it("reads names and Kesan & Pesan from the sheet's rows: trimmed, blank rows skipped, numbers as text", () => {
  const rows = [
    ["Nama", "Kesan & Pesan"],
    [" Budi Santoso ", "Acaranya seru, lanjutkan!"],
    ["", ""],
    ["Siti Rahma", undefined],
    [1234, " Terima kasih panitia "],
    [],
  ];
  assert.deepEqual(parseWheelFile(rows), {
    entries: [
      { name: "Budi Santoso", note: "Acaranya seru, lanjutkan!" },
      { name: "Siti Rahma", note: "" },
      { name: "1234", note: "Terima kasih panitia" },
    ],
    withNotes: true,
  });
});

it("finds the columns by header ignoring case: NAMA alone, Kesan dan Pesan or Pesan for the note", () => {
  assert.deepEqual(parseWheelFile([["NAMA"], ["Dewi Lestari"], ["Rudi Hartono"]]), {
    entries: [
      { name: "Dewi Lestari", note: "" },
      { name: "Rudi Hartono", note: "" },
    ],
    withNotes: false,
  });
  assert.deepEqual(parseWheelFile([["Kesan dan Pesan", " nama "], ["Hebat", "Budi"]]), { entries: [{ name: "Budi", note: "Hebat" }], withNotes: true });
  assert.deepEqual(parseWheelFile([["Nama", "Pesan"], ["Budi", "Hebat"]]), { entries: [{ name: "Budi", note: "Hebat" }], withNotes: true });
  // A note column with nothing in it still counts as one.
  assert.equal(parseWheelFile([["Nama", "Pesan"], ["Budi", ""]]).withNotes, true);
});

it("refuses a header that is missing, repeated or unknown", () => {
  assert.throws(() => parseWheelFile([["Peserta"], ["Budi"]]), { message: 'Kolom "Nama" tidak ditemukan di baris pertama file.' });
  assert.throws(() => parseWheelFile([]), { message: 'Kolom "Nama" tidak ditemukan di baris pertama file.' });
  assert.throws(() => parseWheelFile([["Nama", "nama"], ["Budi", "Budi"]]), { message: 'Kolom "nama" muncul dua kali.' });
  assert.throws(() => parseWheelFile([["Nama", "Kesan", "Pesan"], ["Budi", "a", "b"]]), { message: 'Kolom "Pesan" muncul dua kali.' });
  assert.throws(() => parseWheelFile([["Nama", "Telepon"], ["Budi", "0812"]]), {
    message: 'File hanya boleh berisi kolom Nama dan Kesan & Pesan; kolom "Telepon" tidak dikenal.',
  });
});

it("refuses a row with data outside the two columns, naming the file row", () => {
  // A 2-column file whose header row has an empty third cell.
  assert.throws(() => parseWheelFile([["Nama", "Kesan & Pesan", ""], ["Budi", "Hebat", ""], ["Siti", "", "extra"]]), {
    message: "Baris 3 berisi kolom tambahan; file hanya boleh berisi kolom Nama dan Kesan & Pesan.",
  });
  // A data row longer than the header.
  assert.throws(() => parseWheelFile([["Nama"], ["Budi", "0812"]]), {
    message: "Baris 2 berisi kolom tambahan; file hanya boleh berisi kolom Nama dan Kesan & Pesan.",
  });
});

it("refuses an empty name next to a note and texts past the limits, naming the file row", () => {
  assert.throws(() => parseWheelFile([["Nama", "Pesan"], ["Budi", "Hebat"], ["  ", "Hebat"]]), { message: "Nama di baris 3 kosong." });
  assert.throws(() => parseWheelFile([["Nama"], ["x".repeat(121)]]), { message: "Nama di baris 2 terlalu panjang (maksimal 120 karakter)." });
  assert.equal(parseWheelFile([["Nama"], ["x".repeat(120)]]).entries[0].name.length, 120);
  assert.throws(() => parseWheelFile([["Nama", "Pesan"], ["Budi", "x".repeat(2001)]]), {
    message: "Kesan & pesan di baris 2 terlalu panjang (maksimal 2000 karakter).",
  });
  assert.equal(parseWheelFile([["Nama", "Pesan"], ["Budi", "x".repeat(2000)]]).entries[0].note.length, 2000);
});

it("refuses a file with no names and one with more than 2000", () => {
  assert.throws(() => parseWheelFile([["Nama"], [""], []]), { message: "Tidak ada nama di file." });
  assert.throws(() => parseWheelFile([["Nama"]]), { message: "Tidak ada nama di file." });
  const names = (n: number) => [["Nama"], ...Array.from({ length: n }, (_, i) => [`Peserta ${i + 1}`])];
  assert.equal(parseWheelFile(names(2000)).entries.length, 2000);
  assert.throws(() => parseWheelFile(names(2001)), { message: "Maksimal 2.000 peserta." });
});

it("spins 5 to 6 turns on and lands inside the middle of the drawn segment, from any starting rotation", () => {
  for (const count of [1, 2, 3, 7, 50, 2000]) {
    const width = 360 / count;
    for (const index of [...new Set([0, Math.floor(count / 2), count - 1])]) {
      for (const random of [0, 0.5, 0.999]) {
        for (const rotation of [0, 2137.5]) {
          const result = spinTo(rotation, index, count, () => random);
          const label = `count ${count}, index ${index}, random ${random}, from ${rotation}`;
          assert.ok(result >= rotation + 1800 && result < rotation + 2160, `${label}: ${result}`);
          assert.equal(segmentAt(result, count), index, label);
          // The landing point, measured from the segment's leading edge, stays 20% of a segment from both edges.
          const landing = (((-result % 360) + 360) % 360) - index * width;
          assert.ok(landing >= 0.2 * width - 1e-9 && landing <= 0.8 * width + 1e-9, `${label}: landed at ${landing} of ${width}`);
        }
      }
    }
  }
  // Two spins in a row keep turning the same way.
  const first = spinTo(0, 2, 7);
  const second = spinTo(first, 5, 7);
  assert.ok(second >= first + 1800 && second < first + 2160);
  assert.equal(segmentAt(second, 7), 5);
});

it("names the segment under the pointer: the wheel turns clockwise, so the pointer walks backwards through the segments", () => {
  assert.equal(segmentAt(0, 4), 0);
  assert.equal(segmentAt(-90, 4), 1);
  assert.equal(segmentAt(90, 4), 3);
  assert.equal(segmentAt(360 + 90, 4), 3);
  assert.equal(segmentAt(1800, 4), 0);
  assert.equal(segmentAt(0, 1), 0);
  assert.equal(segmentAt(123.4, 1), 0);
});

it("colours neighbouring segments differently, the last against the first too", () => {
  for (const count of [2, 9, 17]) {
    const colors = Array.from({ length: count }, (_, i) => segmentColor(i, count));
    for (let i = 1; i < count; i++) assert.notEqual(colors[i], colors[i - 1], `count ${count}, segment ${i}`);
    assert.notEqual(colors[count - 1], colors[0], `count ${count}, last against first`);
    for (const color of colors) assert.ok(WHEEL_COLORS.includes(color));
  }
  assert.equal(segmentColor(0, 1), WHEEL_COLORS[0]);
  assert.equal(segmentColor(8, 9), WHEEL_COLORS[1]);
});

it("sizes the labels to the segment and the longest name, and hides them when they would not be readable", () => {
  assert.equal(labelSize(100, 5), 0);
  assert.equal(labelSize(81, 5), 0);
  assert.equal(labelSize(2, 4), 36);
  assert.ok(labelSize(2, 20) < 36);
  assert.ok(labelSize(60, 4) < labelSize(20, 4));
  assert.ok(labelSize(60, 4) >= 11);
  assert.equal(labelSize(2, 80), 0);
});

it("keeps a name that fits the label and cuts a longer one with an ellipsis", () => {
  // At 36 units 16 characters fit.
  assert.equal(wheelLabel("Budi Santoso", 36), "Budi Santoso");
  assert.equal(wheelLabel("x".repeat(16), 36), "x".repeat(16));
  assert.equal(wheelLabel("x".repeat(17), 36), "x".repeat(15) + "…");
  assert.equal(wheelLabel("Muhammad Rizky Ramadhan Putra", 36), "Muhammad Rizky …");
  for (const size of [11, 20, 36]) {
    const fit = Math.floor(326 / (0.56 * size));
    const label = wheelLabel("y".repeat(200), size);
    assert.ok(label.length <= fit, `size ${size}: ${label.length} > ${fit}`);
    assert.ok(label.endsWith("…"));
  }
});
