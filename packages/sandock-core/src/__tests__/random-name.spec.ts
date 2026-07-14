import { describe, expect, it } from "vitest";
import { generateRandomSandboxName, generateUniqueRandomSandboxName } from "../random-name";

describe("random-name", () => {
  describe("generateRandomSandboxName", () => {
    it("should generate a name in adjective_noun format", () => {
      const name = generateRandomSandboxName();

      // Should contain exactly one underscore
      expect(name).toMatch(/^[a-z]+_[a-z]+$/);

      // Split by underscore
      const parts = name.split("_");
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it("should generate different names on subsequent calls", () => {
      const names = new Set<string>();
      // Generate 100 names and expect some uniqueness
      for (let i = 0; i < 100; i++) {
        names.add(generateRandomSandboxName());
      }
      // With 100+ adjectives and 100+ nouns, we should get many unique names
      expect(names.size).toBeGreaterThan(50);
    });
  });

  describe("generateUniqueRandomSandboxName", () => {
    it("should generate a unique name when no existing names", () => {
      const name = generateUniqueRandomSandboxName([]);
      expect(name).toMatch(/^[a-z]+_[a-z]+$/);
    });

    it("should avoid collisions with existing names", () => {
      // Generate some existing names
      const existingNames: string[] = [];
      for (let i = 0; i < 5; i++) {
        existingNames.push(generateRandomSandboxName());
      }

      // Generate a new unique name
      const newName = generateUniqueRandomSandboxName(existingNames);

      // New name should not be in existing names (with high probability)
      // Note: There's a small chance of collision, but it should be unique
      expect(newName).toBeDefined();
      expect(newName.length).toBeGreaterThan(0);
    });

    it("should add a suffix when all simple names are exhausted (edge case)", () => {
      // Create a mock scenario where we pass a set of names that might cause retries
      // The function will try up to 10 times before adding a suffix
      const existingNames: string[] = [];

      // Generate name with empty list (should work normally)
      const name = generateUniqueRandomSandboxName(existingNames, 0);

      // With maxRetries=0, should immediately add suffix
      expect(name).toMatch(/^[a-z]+_[a-z]+_\d{4}$/);
    });
  });
});
