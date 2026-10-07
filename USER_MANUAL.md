# Smart Farmer Administration Portal — User Manual & System Guide

**Version:** 3.0.0  
**Target System:** Smart Farmer Web Admin Portal (`smart-farmer-admin`)  
**Document Purpose:** Comprehensive operational manual for system administrators, content moderators, security officers, and support staff.

---

## Table of Contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [User Roles & Permissions Matrix](#2-user-roles--permissions-matrix)
3. [Access & Authentication](#3-access--authentication)
4. [Dashboard Overview](#4-dashboard-overview)
5. [User Management](#5-user-management)
   - [Admin Staff Management](#51-admin-staff-management)
   - [Mobile App User Management](#52-mobile-app-user-management)
6. [Content Moderation](#6-content-moderation)
7. [Barter System Management](#7-barter-system-management)
8. [Advertisement & Subscription Management](#8-advertisement--subscription-management)
9. [Analytics & Reports](#9-analytics--reports)
10. [Security & Audit Logging](#10-security--audit-logging)
11. [System Settings & Email Configuration](#11-system-settings--email-configuration)
12. [Troubleshooting & FAQs](#12-troubleshooting--faqs)

---

## 1. System Overview & Architecture

The **Smart Farmer Administration Portal** is a web application designed to manage the Smart Farmer ecosystem. It provides administrative controls over mobile application users (Farmers, Vendors), community post content, barter trading, ad campaigns, security threat management, and system settings.

### Key Capabilities
- **Real-Time Data Sync:** Live metrics via Supabase Realtime channels.
- **Multi-Role RBAC:** Role-Based Access Control ensuring staff only access authorized screens.
- **Content Moderation:** Inspection, approval, and rejection workflows for user posts and barter listings.
- **Security Guardrails:** Brute-force monitoring, automatic/manual IP blocking, activity logging, reCAPTCHA protection.
- **Media Resiliency:** Image URL resolution with multi-bucket fallback strategies for user uploaded media and base64 app payloads.

---

## 2. User Roles & Permissions Matrix

The system enforces strict permission boundaries based on administrative roles:

| Module / Feature | Super Administrator | Content Administrator | Security Administrator | Support Administrator |
| :--- | :---: | :---: | :---: | :---: |
| **System Dashboard** | Full Access | Full Access | Full Access | View Only |
| **Admin User Management** | Full Access | No Access | Read / Audit | No Access |
| **Mobile App Users** | Full Access | No Access | View / Ban | View / Verify |
| **Content Moderation** | Full Access | Full Access | View Only | View Only |
| **Barter System** | Full Access | View Only | No Access | View Only |
| **Advertisements** | Full Access | View Only | No Access | No Access |
| **Analytics & BI** | Full Access | Full Access | No Access | No Access |
| **Security & IP Block**| Full Access | No Access | Full Access | No Access |
| **System Settings** | Full Access | No Access | View Only | No Access |
| **Activity Logs** | Full Access | No Access | Full Access | View Only |

---

## 3. Access & Authentication

### 3.1 Portal Login (`/admin/login`)
1. Navigate to the admin login URL in your web browser.
2. Enter your registered **Email Address** and **Password**.
3. Complete the Google reCAPTCHA verification if enabled.
4. Click **Sign In**. Upon validation, an encrypted session is stored in browser session storage (`adminSession`).

### 3.2 Security Protections
- **Login Rate Limiting:** After multiple failed login attempts, the system temporarily locks out the IP address and registers a security alert.
- **Session Timeout:** Inactive sessions automatically expire after the configured duration (default: 30 minutes).
- **IP Tracking:** All login attempts capture client IP and device user agent strings.

### 3.3 Admin Profile Management (`/admin/profile`)
- Update personal profile details (Name, Email, Contact Info).
- Change account password (requires entering current password for verification).
- View personal activity log history.

---

## 4. Dashboard Overview (`/admin/dashboard`)

The Dashboard provides real-time oversight of system activity and key metrics.

### Key Performance Indicators (KPI Cards)
- **Total Users:** Aggregate registered mobile users with daily growth rate indicators.
- **Farmers:** Total count of users assigned the `FARMER` role.
- **Vendors:** Total count of users assigned the `VENDOR` role.
- **Active Barter Trades:** Count of currently active barter listings available for exchange.
- **Projected Growth (30d):** Predictive model based on current daily registration averages.
- **Verification Health:** Percentage ratio of verified vs total registered users.

### Real-time Features & Visualizations
- **Live User Heartbeat:** Shows currently online mobile app users with live status indicators.
- **User Growth Trend Chart:** Interactive 30-day registration trend line.
- **Platform Activity Chart:** Weekly post creation frequency bar chart.
- **Role Distribution Doughnut:** Visual breakdown of user roles (Farmer, Vendor, Admin, Pending).
- **Top Contributors Table:** Ranks users producing the highest community engagement.
- **Quick Action Bar:** Direct navigation buttons to core management modules.

---

## 5. User Management

### 5.1 Admin Staff Management (`/admin/users`)
Manage staff credentials and access rights.

#### Actions:
- **Create Admin User (`/admin/users/create`):**
  1. Click **+ Add Admin User**.
  2. Enter full name, email address, password, and select an Admin Role (`SUPER_ADMIN`, `CONTENT_ADMIN`, `SECURITY_ADMIN`, `SUPPORT_ADMIN`).
  3. Toggle **Super Admin** privilege if applicable.
  4. Submit form.
- **Edit Admin User (`/admin/users/[id]/edit`):** Update role, contact details, or active state (`Active` / `Disabled`).
- **Deactivate Account:** Toggle user status to `Disabled` to instantly revoke portal access without deleting historical logs.
- **View Activity Log:** Click on an admin user row to inspect their historical actions.

### 5.2 Mobile App User Management (`/admin/mobile-users`)
Manage registered app end-users (Farmers, Vendors, Suppliers).

#### Actions:
- **Filter & Search:** Filter by status (`Active`, `Banned`, `Pending`), role (`Farmer`, `Vendor`), or search by Name / Email / Phone.
- **User Verification:** Review user details and click **Verify User** to grant verified badge status.
- **Ban / Unban User:**
  1. Click **Ban User** on a targeted user card.
  2. Select or enter a mandatory **Ban Reason** (e.g., fraud, inappropriate content, policy violation).
  3. Confirm ban. Banned users are restricted from performing app transactions.
- **Inspect User Details:** View profile image, location, verification status, contact details, and registered timestamp.

---

## 6. Content Moderation (`/admin/posts`)

Review and moderate user-generated posts published on the Smart Farmer mobile app.

### Moderation Workflow
1. **Filter Posts:** Choose tab view — `ALL`, `PENDING`, `APPROVED`, `REJECTED`, or `HAS IMAGES`.
2. **Inspect Content:** Click a post card to open the **Details Modal**.
3. **Image Preview:** View post images in high resolution with the built-in fullscreen lightbox previewer.
4. **Approve Post:** Click **Approve**. The post becomes immediately visible to all app users.
5. **Reject Post:**
   1. Click **Reject**.
   2. Select a quick rejection reason (e.g., *Inappropriate content*, *Spam*, *False information*) or type a custom reason.
   3. Confirm rejection. The status updates and an notification log is recorded.

---

## 7. Barter System Management (`/admin/barter`)

Supervise product exchanges and barter listings between agricultural producers.

### Features
- **Listing Approval:** Review pending barter items prior to public listing.
- **Rejection Engine:** Choose pre-configured rejection templates (*Inappropriate item*, *Duplicate listing*, *Invalid quantity/unit*).
- **Trade Inspection:** View active trade proposals and barter requests associated with a listing.
- **Barter Analytics:** Inspect top bartered categories, active exchange volume, and completion statistics.

---

## 8. Advertisement & Subscription Management (`/admin/advertisements`)

Manage promotional banners, sponsored ads, and advertiser subscription packages.

### 8.1 Ad Campaign Management
- **Create New Ad:** Upload creative banner image, title, target URL/landing page, target audience (`FARMER`, `VENDOR`, `ALL`), and select active package.
- **Status Lifecycle:** `ACTIVE`, `PAUSED`, `EXPIRED`, `PENDING`.
- **Performance Metrics:** Monitor impressions, total clicks, Click-Through-Rate (CTR %), and projected revenue.

### 8.2 Subscription Packages
- **Package Configuration:** Define package title, duration in days (e.g., 30, 90, 365), price (LKR/USD), ad type (`STANDARD`, `FEATURED`, `BANNER`), and feature bullet points.
- **Active / Inactive Toggle:** Enable or disable packages for new advertiser subscriptions.

---

## 9. Analytics & Reports (`/admin/analytics`)

Deep-dive business intelligence tool for tracking platform health and growth.

### Available Visualizations
- **User Growth Line Chart:** Granular registration growth over customizable date ranges (7 Days, 30 Days, 1 Year, All Time).
- **User Retention & Conversion Funnel:** Tracks user journey: Registered -> Email Verified -> Active Contributor.
- **Peak Activity Heatmap:** Grid breakdown of peak activity hours across days of the week.
- **Popular Categories Bar Chart:** Highlights top traded produce items and post topics.

---

## 10. Security & Audit Logging

### 10.1 Security Dashboard (`/admin/security`)
- **Real-time Threat Feed:** Live stream of security triggers and anomalies.
- **Severity Classification:** High, Medium, Low severity scoring.
- **IP Blacklist & Whitelist Management:**
  - Manually block offending IP addresses with a reason statement.
  - Remove blocked IPs when security clearance is granted.
- **Failed Login Tracking:** Monitor brute force patterns per IP address.

### 10.2 Audit Activity Logs (`/admin/security/logs` & `/admin/notifications`)
- Complete audit trail capturing:
  - Admin Logins & Logouts
  - User creation, edit, and status modifications
  - Content approval and rejection actions
  - Security configuration changes
- Searchable by Admin Name, Action Type, IP Address, or Date Range.

---

## 11. System Settings & Email Configuration (`/admin/settings`)

Configure global site behavior and integrations.

### Configuration Categories
- **General Settings:** Site Title, Tagline, Support Email, Currency (`LKR`), Timezone (`Asia/Colombo`).
- **Security Settings:** Session timeout duration, Max allowed login attempts, 2FA enforcement, Google reCAPTCHA Site/Secret keys.
- **Email & SMTP Settings:** Host server, Port (`587` / `465`), Username, Password, Sender Name, Notification Triggers.
- **Maintenance Mode:** System-wide toggle to display maintenance overlay to non-superadmin users.

---

## 12. Troubleshooting & FAQs

### Q1: Images fail to display or show a placeholder box.
- **Cause:** Mobile clients may upload un-prefixed Base64 strings or store images across varying Supabase buckets.
- **Resolution:** The admin portal includes `resolveImageUrl()` with automated fallback across `post-images`, `barter-images`, `profile-images`, and `public`. Ensure Supabase storage bucket policies permit public read access.

### Q2: Row-Level Security (RLS) policy blocks an admin query.
- **Cause:** Supabase user session lacks required claims for specific tables.
- **Resolution:** Admin service calls automatically fall back to service-role access using `SUPABASE_SERVICE_ROLE_KEY` defined in environment variables.

### Q3: How do I recover access if locked out of an admin account?
- **Resolution:** A Super Administrator can log into `/admin/users` and reset the user's password or status, or use the Supabase dashboard to update the `admin_users` table directly.

---

*End of User Manual — Smart Farmer Administration Portal v3.0.0*
