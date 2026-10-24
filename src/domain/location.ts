import type { Coordinates } from "../types";
export interface ForegroundLocationProvider {
  requestPermission(): Promise<boolean>;
  getPosition(): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
  }>;
}
export async function acquireForegroundLocation(
  provider: ForegroundLocationProvider,
  timeoutMs = 15000,
): Promise<Coordinates> {
  if (!(await provider.requestPermission()))
    throw new Error(
      "Location permission was denied. Allow location in your device settings, then try again.",
    );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      provider.getPosition(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Location is taking longer than expected. Move near a window and try again.",
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
    return { ...result, accuracy: result.accuracy ?? 999, simulated: false };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("longer than expected")
    )
      throw error;
    throw new Error(
      "Location is unavailable. Enable location services, move near a window, and try again.",
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
