/**
 * ═══════════════════════════════════════════════════════════════
 * ROLE PERMISSIONS — Single Source of Truth
 * ═══════════════════════════════════════════════════════════════
 *
 * Every component and page MUST import from this file when
 * checking what a user can see or do. Never hardcode
 * role === 'director' checks scattered through components.
 *
 * Default assumption: LEAST PRIVILEGE — if in doubt, hide it.
 *
 * When building any new feature, first ask: which roles need
 * this? Then use usePermissions() to gate it.
 * ═══════════════════════════════════════════════════════════════
 */

import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

// ─── Feature permission map per role ────────────────────────────

export const rolePermissions: Record<string, Record<string, boolean>> = {
  // ═══════════════════════════════════════
  // CUSTOMER
  // ═══════════════════════════════════════
  customer: {
    viewHomepage: true,
    viewBookingFlow: true,
    viewOwnBookings: true,
    viewOwnPets: true,
    viewOwnPhotos: true,
    viewOwnAdvice: true,
    viewOwnMigratedHistory: true,
    viewOwnPaymentStatus: true,
    // everything else is false by default
  },

  // ═══════════════════════════════════════
  // GROOMER
  // ═══════════════════════════════════════
  groomer: {
    // Inherited customer-like
    viewHomepage: true,
    viewBookingFlow: true,

    // Appointments & Calendar
    viewOwnAppointments: true,
    viewCalendar: true, // other groomers show as "Booked" blocks only
    editOwnAppointments: true,
    markAppointmentComplete: true,
    markAppointmentNoShow: true,

    // Customer access (own customers only)
    searchCustomers: true,
    viewOwnCustomerProfiles: true,
    viewOwnCustomerNotes: true,
    addCustomerNotes: true,
    viewCustomerBookingNotes: true,

    // Booking actions
    bookForAnyCustomer: true, // but assigned to themselves
    sendDepositRequest: true,
    sendPaymentLink: true,

    // Messaging (own customers only)
    sendSmsOwnCustomers: true,
    sendEmailOwnCustomers: true,

    // Finance (own only)
    viewOwnCommission: true,
    viewOwnEarnings: true,

    // Portal
    viewGroomerPortal: true,
  },

  // ═══════════════════════════════════════
  // MANAGER
  // ═══════════════════════════════════════
  manager: {
    // Everything groomers can do
    viewHomepage: true,
    viewBookingFlow: true,
    viewOwnAppointments: true,
    viewCalendar: true,
    editOwnAppointments: true,
    markAppointmentComplete: true,
    markAppointmentNoShow: true,
    searchCustomers: true,
    viewOwnCustomerProfiles: true,
    viewOwnCustomerNotes: true,
    addCustomerNotes: true,
    viewCustomerBookingNotes: true,
    bookForAnyCustomer: true,
    sendDepositRequest: true,
    sendPaymentLink: true,
    sendSmsOwnCustomers: true,
    sendEmailOwnCustomers: true,
    viewOwnCommission: true,
    viewOwnEarnings: true,
    viewGroomerPortal: true,

    // Manager-level access
    viewAllBookings: true,
    viewAllCustomerProfiles: true,
    viewAllCustomerNotes: true,
    viewAllMessages: true,
    editAnyBooking: true,
    issueRefunds: true,
    issueCancellations: true,
    applyCoupons: true,
    applyDiscounts: true,
    viewExportReports: true,
    manageAddOns: true,
    manageBreeds: true,
    manageServices: true,
    sendBulkMessages: true,
    viewOtherGroomersDetails: true,
    viewCustomerPaymentDetails: true,

    // Finance
    viewFinancePage: true,
    viewRevenueBreakdown: true,
    viewCommissionBreakdown: true,

    // Staff
    viewStaffSchedules: true,
    viewStaffWorkHours: true,

    // Compliance
    viewIncidentReports: true,
    viewRiskAssessments: true,

    // Migration
    viewMigrationPage: true,

    // Error reports
    viewErrorReports: true,
  },

  // ═══════════════════════════════════════
  // DIRECTOR
  // ═══════════════════════════════════════
  director: {
    // Everything manager can do (duplicated for explicitness)
    viewHomepage: true,
    viewBookingFlow: true,
    viewOwnAppointments: true,
    viewCalendar: true,
    editOwnAppointments: true,
    markAppointmentComplete: true,
    markAppointmentNoShow: true,
    searchCustomers: true,
    viewOwnCustomerProfiles: true,
    viewOwnCustomerNotes: true,
    addCustomerNotes: true,
    viewCustomerBookingNotes: true,
    bookForAnyCustomer: true,
    sendDepositRequest: true,
    sendPaymentLink: true,
    sendSmsOwnCustomers: true,
    sendEmailOwnCustomers: true,
    viewOwnCommission: true,
    viewOwnEarnings: true,
    viewGroomerPortal: true,
    viewAllBookings: true,
    viewAllCustomerProfiles: true,
    viewAllCustomerNotes: true,
    viewAllMessages: true,
    editAnyBooking: true,
    issueRefunds: true,
    issueCancellations: true,
    applyCoupons: true,
    applyDiscounts: true,
    viewExportReports: true,
    manageAddOns: true,
    manageBreeds: true,
    manageServices: true,
    sendBulkMessages: true,
    viewOtherGroomersDetails: true,
    viewCustomerPaymentDetails: true,
    viewFinancePage: true,
    viewRevenueBreakdown: true,
    viewCommissionBreakdown: true,
    viewStaffSchedules: true,
    viewStaffWorkHours: true,
    viewIncidentReports: true,
    viewRiskAssessments: true,
    viewMigrationPage: true,
    viewErrorReports: true,

    // Director-only
    viewStaffContracts: true,
    viewSalaryDetails: true,
    manageStaffAccounts: true,
    deleteStaffAccounts: true,
    changeStaffRoles: true,
    manageUserRoles: true,
    viewSystemHealth: true,
    viewTestRunner: true,
    viewAuditLogs: true,
    viewAllFinancialData: true,
    viewGroomerEarnings: true,
    viewStripeRecords: true,
    accessSystemConfig: true,
  },
};

// ─── Feature check helper ───────────────────────────────────────

/**
 * Check if a role has access to a specific feature.
 * Returns false for unknown roles or features (least privilege).
 */
export const canAccess = (role: string | null | undefined, feature: string): boolean => {
  if (!role) return false;
  const permissions = rolePermissions[role];
  if (!permissions) return false;
  return permissions[feature] === true;
};

// ─── Permissions hook ───────────────────────────────────────────

/**
 * Central permissions hook. Use this in every component/page
 * instead of hardcoding role checks.
 *
 * Usage:
 *   const { canSeeFinance, canEditAnyBooking, isGroomer } = usePermissions();
 */
export function usePermissions() {
  const { user } = useAuth();
  const { role, loading } = useUserRole(user?.id);

  const r = role as string | null;

  return {
    role: r as AppRole | null,
    loading,

    // ── Identity checks ──
    isCustomer: r === "customer",
    isGroomer: r === "groomer",
    isManager: r === "manager",
    isDirector: r === "director",
    isStaff: r === "groomer" || r === "manager" || r === "director",
    isManagement: r === "manager" || r === "director",

    // ── Booking visibility ──
    canSeeAllBookings: r === "director" || r === "manager",
    canSeeOwnBookingsOnly: r === "groomer",
    canEditAnyBooking: r === "director" || r === "manager",

    // ── Customer visibility ──
    canSeeOtherGroomersDetails: r === "director" || r === "manager",
    canSeeCustomerPaymentDetails: r === "director" || r === "manager",
    canSearchCustomers: r === "director" || r === "manager" || r === "groomer",

    // ── Finance ──
    canSeeFinance: r === "director" || r === "manager",
    canSeeAllFinancialData: r === "director",

    // ── Staff management ──
    canManageStaff: r === "director",
    canChangeRoles: r === "director",
    canViewStaffContracts: r === "director",

    // ── System ──
    canSeeSystemHealth: r === "director",
    canRunTests: r === "director",
    canSeeAuditLogs: r === "director",

    // ── Messaging ──
    canBulkMessage: r === "director" || r === "manager",

    // ── Migration ──
    canSeeMigration: r === "director" || r === "manager",

    // ── Compliance ──
    canSeeIncidentReports: r === "director" || r === "manager",
    canSeeRiskAssessments: r === "director" || r === "manager",

    // ── Error reports ──
    canSeeErrorReports: r === "director" || r === "manager",

    // ── Generic feature check ──
    can: (feature: string) => canAccess(r, feature),
  };
}
