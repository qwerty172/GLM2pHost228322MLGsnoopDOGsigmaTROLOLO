import { test } from "node:test";
import assert from "node:assert/strict";

const {
  MIN_TERM_DAYS,
  formatLzt,
  bpsToPercent,
  serverErrorToRu,
  loanRequestStatusRu,
  loanStatusRu,
  fundedPercent,
} = await import("../src/pages/exchange-helpers.ts");

test("MIN_TERM_DAYS is 60", () => {
  assert.equal(MIN_TERM_DAYS, 60);
});

test("formatLzt formats integers with ru-RU locale", () => {
  assert.equal(formatLzt(5000), "5\u00a0000");
  assert.equal(formatLzt(1234.9), "1\u00a0234");
});

test("bpsToPercent converts basis points to percent string", () => {
  assert.equal(bpsToPercent(500), "5.00");
  assert.equal(bpsToPercent(125), "1.25");
});

test("serverErrorToRu maps known API errors to Russian", () => {
  assert.match(serverErrorToRu("Pledger limit is zero"), /Pledger-лимит/);
  assert.equal(serverErrorToRu("amountLzt exceeds limit"), "Сумма превышает твой Pledger-лимит");
  assert.equal(serverErrorToRu("termDays must be at least 60"), `Срок должен быть не менее ${MIN_TERM_DAYS} дней`);
  assert.equal(serverErrorToRu("not open"), "Заявка уже не в открытом статусе");
  assert.equal(serverErrorToRu("own request"), "Нельзя финансировать собственную заявку");
  assert.equal(serverErrorToRu("insufficient lender balance"), "Недостаточно баланса для финансирования");
  assert.equal(serverErrorToRu("insufficient funds"), "Недостаточно баланса");
  assert.equal(serverErrorToRu("not your loan"), "Это не твой займ");
  assert.equal(serverErrorToRu("not repayable"), "Займ нельзя погасить (возможно, уже закрыт)");
  assert.equal(serverErrorToRu("custom error"), "custom error");
});

test("loanRequestStatusRu maps loan request statuses", () => {
  assert.equal(loanRequestStatusRu("open"), "Открыта");
  assert.equal(loanRequestStatusRu("funded"), "Собрана");
  assert.equal(loanRequestStatusRu("cancelled"), "Отменена");
  assert.equal(loanRequestStatusRu("active"), "Активна");
  assert.equal(loanRequestStatusRu("unknown"), "unknown");
});

test("loanStatusRu maps loan statuses for badges", () => {
  assert.equal(loanStatusRu("active"), "Активен");
  assert.equal(loanStatusRu("repaid"), "Погашен");
  assert.equal(loanStatusRu("defaulted"), "Просрочен");
  assert.equal(loanStatusRu("open"), "Открыта");
});

test("fundedPercent calculates funding progress", () => {
  assert.equal(fundedPercent(10_000, 2_500), 25);
  assert.equal(fundedPercent(10_000, 10_000), 100);
  assert.equal(fundedPercent(0, 100), 0);
});
