import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// P2P loan requests (offers from would-be borrowers).
// status: open | funded | cancelled
export const loanRequestsTable = pgTable(
  "loan_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    borrowerType: text("borrower_type").notNull(),
    borrowerId: uuid("borrower_id").notNull(),
    amountLzt: integer("amount_lzt").notNull(),
    termDays: integer("term_days").notNull(),
    rateBps: integer("rate_bps").notNull().default(0),
    status: text("status").notNull().default("open"),
    fundedAmountLzt: integer("funded_amount_lzt").notNull().default(0),
    fundedLoanId: uuid("funded_loan_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("loan_requests_borrower_idx").on(t.borrowerType, t.borrowerId),
    index("loan_requests_status_idx").on(t.status),
  ],
);

// Active or historical loans.
// loanType: p2p | host_service
// status:  active | repaid | defaulted
// lenderPayoutMode: cash_on_close | balance_streaming
export const loansTable = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loanType: text("loan_type").notNull().default("p2p"),
    lenderType: text("lender_type").notNull(),
    lenderId: uuid("lender_id").notNull(),
    borrowerType: text("borrower_type").notNull(),
    borrowerId: uuid("borrower_id").notNull(),
    requestId: uuid("request_id"),
    principalLzt: integer("principal_lzt").notNull(),
    outstandingLzt: integer("outstanding_lzt").notNull(),
    repaidLzt: integer("repaid_lzt").notNull().default(0),
    escrowLzt: integer("escrow_lzt").notNull().default(0),
    platformFeeLzt: integer("platform_fee_lzt").notNull().default(0),
    rateBps: integer("rate_bps").notNull().default(0),
    lenderPayoutMode: text("lender_payout_mode")
      .notNull()
      .default("cash_on_close"),
    status: text("status").notNull().default("active"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    defaultedAt: timestamp("defaulted_at", { withTimezone: true }),
  },
  (t) => [
    index("loans_borrower_idx").on(t.borrowerType, t.borrowerId),
    index("loans_lender_idx").on(t.lenderType, t.lenderId),
    index("loans_status_idx").on(t.status),
  ],
);

export type Loan = typeof loansTable.$inferSelect;
export type LoanRequest = typeof loanRequestsTable.$inferSelect;
