#!/usr/bin/env node

/**
 * Simple test script to verify the SDK works
 * Run with: node test-manual.js
 */

import { createSandockClient } from "./dist/index.js";

const client = createSandockClient({
  baseUrl: "http://localhost:3030",
});

async function test() {
  console.log("🧪 Testing sandock-js SDK...\n");

  // Test 1: Get meta
  console.log("1️⃣  Testing GET /api/meta");
  try {
    const { data, error } = await client.GET("/api/meta", {});
    if (error) {
      console.error("❌ Failed:", error);
    } else {
      console.log("✅ Success:", data.data);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  }

  console.log("\n2️⃣  Testing GET /api/user/{id}");
  try {
    const { data, error } = await client.GET("/api/user/{id}", {
      params: { path: { id: "u_12345" } },
    });
    if (error) {
      console.error("❌ Failed:", error);
    } else {
      console.log("✅ Success:", data.data);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  }

  console.log("\n✨ Test complete!");
}

test();
