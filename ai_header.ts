/**
 * AI Provider Abstraction Layer
 *
 * Admin panel (AI Config page) mein provider/model change karo →
 * yahan se automatically naye provider ko call kiya jaayega.
 *
 * Supported providers: nvidia (AI-powered) | google | anthropic | openai | placeholder
 * Cache: 5-minute in-memory (no Redis needed)
 */

import { db, aiConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
