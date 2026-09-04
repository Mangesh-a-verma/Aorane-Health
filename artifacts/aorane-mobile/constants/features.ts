/**
 * Feature flags that gate work which is built but not ready to ship.
 *
 * These are compile-time constants, not remote config — flipping one needs a
 * new build. That is deliberate: they gate UI that would be broken or
 * misleading if a user reached it, so it should not be switchable at runtime.
 */

/**
 * Multi-language support.
 *
 * OFF because the translation work is real but only about a sixth wired up:
 * roughly 190 `t()` calls against ~1,000 hardcoded English strings, and
 * almost half of those calls are on the dashboard alone. Picking Hindi
 * translated the dashboard and left every other screen in English, which
 * reads as a broken app rather than a partly-translated one.
 *
 * Nothing has been deleted. lib/translations.ts still holds all ten
 * languages, LanguageContext still resolves keys, and every `t()` call site
 * keeps working — they just all resolve to English while this is false.
 *
 * To turn it back on: set this to true. Before doing that, the screens need
 * their hardcoded strings moved into translations.ts, or the same partial
 * experience comes straight back.
 */
export const MULTI_LANGUAGE_ENABLED = false;
