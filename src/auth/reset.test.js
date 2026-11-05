import assert from "node:assert/strict";
import test from "node:test";
import {
  RESET_OPEN_FROM_EMAIL,
  RESET_SENT,
  RESET_UNCONFIGURED,
  applyLocalPassword,
  openRecovery,
  requestPasswordReset,
  resetErrorMessage,
  resetRedirect,
  validateNewPassword,
} from "./reset.js";

test("reset redirect points at /reset on the site origin", () => {
  assert.equal(resetRedirect("https://course.example"), "https://course.example/reset");
});

test("new password stays case-sensitive and must be confirmed", () => {
  assert.equal(validateNewPassword("Abcd1234", "abcd1234"), "兩次輸入的密碼不相同。");
  assert.equal(validateNewPassword("short", "short"), "密碼至少 8 位。");
  assert.equal(validateNewPassword("Abcd1234", "Abcd1234"), "");
});

test("local password update matches email case and keeps the stored name", () => {
  const users = [
    { id: "u-locked01", name: "locked01", email: "locked01@tp-trading.local", password: "locked123" },
  ];
  const result = applyLocalPassword(users, "LOCKED01@tp-trading.local", "NewPass99");
  assert.equal(result.updated, true);
  assert.equal(result.users[0].password, "NewPass99");
  assert.equal(result.users[0].name, "locked01");
  assert.equal(result.users[0].email, "locked01@tp-trading.local");
  assert.equal(users[0].password, "locked123");
});

test("requestPasswordReset refuses when Supabase is not configured", async () => {
  const result = await requestPasswordReset(null, "a@b.com", "https://course.example");
  assert.equal(result.ok, false);
  assert.equal(result.message, RESET_UNCONFIGURED);
});

test("requestPasswordReset calls resetPasswordForEmail with the redirect", async () => {
  const calls = [];
  const client = {
    auth: {
      resetPasswordForEmail(email, options) {
        calls.push({ email, options });
        return Promise.resolve({ data: {}, error: null });
      },
    },
  };
  const result = await requestPasswordReset(client, " Student@Example.com ", "https://course.example");
  assert.equal(result.ok, true);
  assert.equal(result.message, RESET_SENT);
  assert.equal(calls[0].email, "Student@Example.com");
  assert.equal(calls[0].options.redirectTo, "https://course.example/reset");
});

test("reset errors stay in Traditional Chinese", () => {
  assert.match(resetErrorMessage({ code: "over_request_rate_limit" }), /稍後再試/);
  assert.match(resetErrorMessage({ message: "redirect URL not allowed" }), /未獲允許/);
  assert.match(resetErrorMessage({ message: "something else" }), /未能寄出/);
});

test("openRecovery verifies a token_hash link and reads the email", async () => {
  const client = {
    auth: {
      verifyOtp(args) {
        assert.equal(args.type, "recovery");
        assert.equal(args.token_hash, "hash-1");
        return Promise.resolve({ data: { user: { email: "locked01@tp-trading.local" } }, error: null });
      },
    },
  };
  const result = await openRecovery(
    client,
    "https://course.example/reset?token_hash=hash-1&type=recovery",
  );
  assert.equal(result.ok, true);
  assert.equal(result.email, "locked01@tp-trading.local");
});

test("openRecovery without a recovery link asks the student to use the email", async () => {
  const result = await openRecovery({ auth: {} }, "https://course.example/reset");
  assert.equal(result.ok, false);
  assert.equal(result.message, RESET_OPEN_FROM_EMAIL);
});
