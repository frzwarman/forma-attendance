import { useState } from "react";
import { useWindowDimensions } from "react-native";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/ui";
import { storedCheckIns } from "../../services/checkout";
import { useEventContent } from "../../services/eventInfo";
import { EventSlides } from "./EventSlides";

// Shown once per browser session when the public page opens.
const SEEN_KEY = "guestbook.intro.seen";
function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage unavailable: the slideshow simply shows again next time */
  }
}

export function EventIntro() {
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  // Attendees returning to check out have seen the event information already.
  const [open, setOpen] = useState(() => !alreadySeen() && storedCheckIns().length === 0);
  const content = useEventContent();
  // Opens once the settings are in, with the speakers the admin saved.
  if (!open || !content) return null;
  function close() {
    rememberSeen();
    setOpen(false);
  }
  return (
    // No close button, Escape or backdrop: the way out is Mulai check-in on the last slide.
    <Modal label="Informasi acara" maxWidth={wide ? 780 : 440}>
      <EventSlides wide={wide} speakers={content.speakers} action={<Button large label="Mulai check-in" onPress={close} />} />
    </Modal>
  );
}
