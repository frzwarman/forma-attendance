import assert from "node:assert/strict";
import { it } from "node:test";
import { acquireForegroundLocation } from "./location";
it("permission denial prevents location acquisition", async () => {
  let accessed = false;
  await assert.rejects(
    acquireForegroundLocation({
      requestPermission: async () => false,
      getPosition: async () => {
        accessed = true;
        return { latitude: 0, longitude: 0, accuracy: 5 };
      },
    }),
    /permission was denied/,
  );
  assert.equal(accessed, false);
});
it("unknown accuracy remains uncertain rather than verified", async () => {
  const result = await acquireForegroundLocation({
    requestPermission: async () => true,
    getPosition: async () => ({ latitude: 0, longitude: 0, accuracy: null }),
  });
  assert.equal(result.accuracy, 999);
  assert.equal(result.simulated, false);
});
it("slow acquisition returns a recoverable timeout", async () => {
  await assert.rejects(
    acquireForegroundLocation(
      {
        requestPermission: async () => true,
        getPosition: () => new Promise(() => {}),
      },
      5,
    ),
    /longer than expected/,
  );
});
it("unavailable GPS provides a useful error", async () => {
  await assert.rejects(
    acquireForegroundLocation({
      requestPermission: async () => true,
      getPosition: async () => {
        throw new Error("unavailable");
      },
    }),
    /Location is unavailable/,
  );
});
