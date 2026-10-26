import assert from "node:assert/strict";
import { it } from "node:test";
import { maskPhone, phoneDigits, whatsappLink } from "./phone";

it("normalises Indonesian phone numbers to digits with a local prefix", () => {
  assert.equal(phoneDigits("+62 812-1111-2222"), "081211112222");
  assert.equal(phoneDigits("0812 1111 2222"), "081211112222");
});

it("masks everything but the first four and last two digits", () => {
  assert.equal(maskPhone("081211112222"), "0812******22");
  assert.equal(maskPhone("+62 812-1111-2222"), "0812******22");
  assert.equal(maskPhone("08123"), "08***");
});

it("builds WhatsApp links with the country code", () => {
  assert.equal(whatsappLink("0812-3456-7890"), "https://wa.me/6281234567890");
  assert.equal(whatsappLink("+62 812 3456 7890"), "https://wa.me/6281234567890");
});
