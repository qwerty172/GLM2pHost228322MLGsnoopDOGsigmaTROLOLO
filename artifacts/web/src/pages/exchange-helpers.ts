export const MIN_TERM_DAYS = 60;

export function formatLzt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.trunc(n));
}

export function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2);
}

export function serverErrorToRu(msg: string): string {
  if (/pledger limit/i.test(msg)) return "Pledger-лимит равен нулю — сначала сделай хотя бы один депозит или вывод";
  if (/amountLzt exceeds/i.test(msg)) return "Сумма превышает твой Pledger-лимит";
  if (/termDays must be/i.test(msg)) return `Срок должен быть не менее ${MIN_TERM_DAYS} дней`;
  if (/not open/i.test(msg)) return "Заявка уже не в открытом статусе";
  if (/own request/i.test(msg)) return "Нельзя финансировать собственную заявку";
  if (/insufficient lender/i.test(msg)) return "Недостаточно баланса для финансирования";
  if (/insufficient/i.test(msg)) return "Недостаточно баланса";
  if (/not your loan/i.test(msg)) return "Это не твой займ";
  if (/not repayable/i.test(msg)) return "Займ нельзя погасить (возможно, уже закрыт)";
  return msg;
}

export function loanRequestStatusRu(status: string): string {
  const labels: Record<string, string> = {
    open: "Открыта",
    funded: "Собрана",
    cancelled: "Отменена",
    active: "Активна",
  };
  return labels[status] ?? status;
}

export function loanStatusRu(status: string): string {
  const labels: Record<string, string> = {
    active: "Активен",
    repaid: "Погашен",
    defaulted: "Просрочен",
    open: "Открыта",
    funded: "Собрана",
    cancelled: "Отменена",
  };
  return labels[status] ?? status;
}

export function fundedPercent(amountLzt: number, fundedAmountLzt: number): number {
  return amountLzt > 0 ? Math.round((fundedAmountLzt / amountLzt) * 100) : 0;
}
