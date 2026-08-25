import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Automated tests must never consume a developer's real OpenAI quota.
delete process.env.OPENAI_API_KEY;

afterEach(() => {
  cleanup();
});
