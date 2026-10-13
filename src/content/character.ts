/**
 * Copy for /character. The components under src/components/character hold no
 * strings of their own.
 *
 * The privacy line is worded to what the code does: the image goes to Claude
 * through Anthropic's API to make the character, and this site keeps nothing.
 * It does not claim more than that.
 */
export const characterPage = {
  slug: "character",
  label: "Character lab",
  title: "Bring a drawing to life",
  lede: "Upload a drawing or a photo of a character. Claude turns it into a 3D character you can spin around and make dance, flip, ride a bike and shoot hoops.",
  metaDescription: "Upload a drawing and Claude turns it into an interactive 3D character you can animate in your browser.",

  upload: {
    prompt: "Drop a drawing here, or tap to choose one",
    formats: "JPG, PNG or HEIC, up to 8 MB",
    replace: "Choose a different image",
    preparing: "Getting your image ready",
    notice: "Your image is sent to Claude to create the character and is not saved. Closing or refreshing this page discards everything.",
  },

  options: {
    name: { label: "Name", placeholder: "Optional, like Ace's tree" },
    style: {
      label: "Style",
      faithful: { label: "Faithful to the drawing", hint: "Flat colours and cartoon shapes, like the drawing come to life." },
      realistic: { label: "Realistic", hint: "Bark, fur and skin textures with real shadows." },
    },
    notes: { label: "Notes", placeholder: "Optional, like \"it's a tree with a smiley face\"" },
  },

  generate: "Make my character",

  progress: {
    title: "Making your character",
    stages: {
      looking: "Looking at your drawing",
      building: "Building the model",
      ready: "Getting it ready",
    },
    hint: "This usually takes under a minute.",
    cancel: "Cancel",
  },

  play: {
    help: "Drag to spin. Pinch or scroll to zoom.",
    stop: "Stop",
    spin: "Auto-spin",
    another: "Make another",
    compare: "Your drawing",
    compareClose: "Close",
    fallback:
      "We couldn't build this one from your drawing, so here is a stand-in in your drawing's colours. Every action still works. Try again for another go at the real thing.",
  },

  errors: {
    unsupported: "That file type isn't supported. Try a JPG, PNG or HEIC image.",
    too_large: "That image is over 8 MB. Try a smaller one, or a screenshot of it.",
    unreadable: "We couldn't open that image. Try saving it as a JPG first.",
    not_a_character: "That doesn't look like a character we can bring to life. Try a drawing, a toy or a creature.",
    rate_limited: "You've made a lot of characters this hour. Take a break and try again later.",
    busy: "Too many people are making characters right now. Try again in a minute.",
    generation_failed: "Something went wrong while building your character. Try again, or try a different image.",
    timeout: "That took too long. Try again, or try a simpler drawing.",
    offline: "We couldn't reach the server. Check your connection and try again.",
    not_configured: "Character making isn't switched on here yet.",
    dismiss: "OK",
  },
} as const;
