

# Role-Based Access Control (RBAC) for Fluff & Scruff

## Overview

This plan adds three user roles -- **Manager**, **Groomer**, and **Customer** -- with distinct views and permissions. Customers can still book as guests without an account. Logged-in users see role-appropriate navigation and are redirected away from pages they shouldn't access.

---

## 1. Database Changes

### Authentication setup
- Enable Lovable Cloud authentication (email + password sign-up/login)
- Auto-confirm will NOT be enabled (users verify email first)

### New tables and types

**`app_role` enum**: `'manager'`, `'groomer'`, `'customer'`

**`user_roles` table**:
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | auto-generated |
| user_id | uuid | references auth.users, ON DELETE CASCADE |
| role | app_role | not null |
| unique(user_id, role) | | prevents duplicate roles |

**`profiles` table** (for storing display info):
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | references auth.users, ON DELETE CASCADE |
| full_name | text | nullable |
| avatar_url | text | nullable |
| created_at | timestamptz | default now() |

**`customer_pets` table** (for "My Pets" section):
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | auto-generated |
| user_id | uuid | references auth.users, ON DELETE CASCADE |
| pet_name | text | not null |
| breed_id | uuid | nullable, references breeds |
| notes | text | nullable |
| created_at | timestamptz | default now() |

### Link groomers to staff records
- Add `auth_user_id` column to the existing `staff` table (nullable uuid, references auth.users) so groomer accounts can be linked to their staff record

### Security-definer function
```text
has_role(user_id, role) -> boolean
```
Used in all RLS policies to avoid recursive lookups.

### RLS policies
- **user_roles**: Users can read their own roles only
- **profiles**: Users can read/update their own profile
- **customer_pets**: Users can CRUD their own pets
- **bookings**: Managers see all; groomers see only their assigned bookings; customers see bookings matching their email
- Existing tables (breeds, services, staff, etc.) remain publicly readable but only managers can write

### Auto-create profile + default role trigger
- On new user sign-up, a database trigger creates a `profiles` row and inserts a `customer` role into `user_roles`
- Managers will manually promote users to `groomer` or `manager` roles via the dashboard

---

## 2. New Pages and Components

### Authentication
- **`/auth` page**: Login and sign-up forms with email/password, plus a "Forgot Password" flow
- **`/reset-password` page**: For completing password resets
- **`useAuth` hook**: Manages session state via `onAuthStateChange`, exposes `user`, `role`, `signOut`
- **`useUserRole` hook**: Fetches the current user's role from `user_roles` table
- **`ProtectedRoute` component**: Wraps routes, checks role, redirects to `/` if unauthorized

### Manager Dashboard (existing `/admin` route, now protected)
- All current admin pages remain as-is but wrapped in role checks
- New "User Management" section under `/admin/users` to view all users and change their roles
- Sidebar shows all management links (Dashboard, Breeds, Services, Staff, Bookings, Users)

### Groomer Portal (`/portal`)
- **My Schedule page**: Shows only the logged-in groomer's bookings (filtered by `staff.auth_user_id`)
- Each booking has a "Mark as Finished" button that updates status to "Completed"
- No revenue figures, no other groomers' data visible
- Simplified sidebar: My Schedule only

### Customer View
- **Guest booking** continues to work exactly as today (no login required)
- Nav bar gets a "Sign In" button (top right)
- Logged-in customers see a "My Pets" link in the nav
- **`/my-pets` page**: Lists their pets and booking history (matched by email)
- Can add/edit pet profiles

---

## 3. Navigation Logic

### Customer-facing nav (top bar on `/`)
- Not logged in: Services, About, Contact, Book Now, **Sign In**
- Logged in as Customer: Services, About, Contact, Book Now, **My Pets**, profile avatar with sign-out
- Logged in as Manager: same + **Dashboard** link
- Logged in as Groomer: same + **My Schedule** link

### Admin sidebar (existing `AppSidebar`)
- Only renders for Manager role
- Adds "Users" link for user management

### Groomer sidebar (new `GroomerSidebar`)
- Minimal: logo + "My Schedule" + sign-out

---

## 4. Route Structure

```text
/                    Public homepage (all users)
/auth                Login / Sign-up
/reset-password      Password reset completion
/my-pets             Customer only (logged in)
/portal              Groomer only
/admin               Manager only
/admin/users         Manager only (new)
/breeds              Manager only
/services            Manager only
/staff               Manager only
/staff/:id           Manager only
/bookings            Manager only
/contract/sign/:id   Public (existing)
```

---

## 5. Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useAuth.ts` | Auth session + sign-out helper |
| `src/hooks/useUserRole.ts` | Fetch role from user_roles |
| `src/components/ProtectedRoute.tsx` | Role-gated route wrapper |
| `src/pages/AuthPage.tsx` | Login / sign-up forms |
| `src/pages/ResetPasswordPage.tsx` | Password reset form |
| `src/pages/MyPetsPage.tsx` | Customer pet profiles + booking history |
| `src/pages/GroomerPortalPage.tsx` | Groomer's schedule view |
| `src/pages/AdminUsersPage.tsx` | Manager user management |
| `src/components/GroomerLayout.tsx` | Layout with groomer sidebar |

## 6. Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add new routes, wrap admin routes with ProtectedRoute |
| `src/pages/CustomerHome.tsx` | Add Sign In button, conditional My Pets link |
| `src/components/AppSidebar.tsx` | Add Users nav item |
| `src/components/AppLayout.tsx` | No structural changes needed |
| `supabase/config.toml` | Add edge function configs if needed |
| DB migration | Create tables, enum, trigger, RLS policies, security-definer function |

---

## 7. Implementation Order

1. Database migration (enum, tables, trigger, RLS, security-definer function)
2. Auth hooks and ProtectedRoute component
3. Auth page (login/signup/forgot password) + reset password page
4. Update App.tsx routes and CustomerHome nav
5. Manager user management page
6. Groomer portal page with schedule + "Mark as Finished"
7. Customer "My Pets" page with booking history
8. Navigation updates (sidebar + top nav role-based rendering)

