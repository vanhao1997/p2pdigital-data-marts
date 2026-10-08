import type { Page } from '@playwright/test';
import type { MemberWithScopeDto } from '../../src/features/contexts/types/context.types';
import type { CurrentUserResponse } from '../../src/features/idp/types/auth-api.types';
import type { ProjectRole, Projects } from '../../src/features/idp/types/projects.types';
import { test, expect } from '../fixtures/base';
import { TESTIDS } from '../selectors/testids';

/**
 * E2E coverage for the Membership Requests feature.
 *
 * The membership-request endpoints (GET /api/members/requests,
 * POST /api/members/requests/:id/approve, POST /api/members/requests/:id/decline)
 * are guarded by Strategy.INTROSPECT which validates the JWT audience against the
 * external OWOX IDP service. In the local e2e environment that validation fails
 * with a 401, causing the frontend to fire an auth:logout event and redirect to
 * sign-in. We therefore intercept these three routes with page.route() and return
 * canned mock responses — identical to what the IDP mock returns in the task
 * description — so the rest of the page loads and we can verify UI behaviour.
 *
 * Mock data:
 *   - alice@example.com — viewer, requestId: mock-req-alice
 *   - bob@example.com  — editor, requestId: mock-req-bob
 *
 * The mock is stateless: approve/decline always resolve 200/204. The frontend
 * applies optimistic removal so the row disappears immediately; reloading would
 * bring it back. Tests verify optimistic behaviour only.
 *
 * MR-04 additionally mocks the browser's current-user/project-role responses and
 * member data for viewer/editor roles. The harness still uses NullIdpProvider;
 * this verifies UI role gating, not backend authorization or tenant isolation.
 *
 * URL: /ui/0/project-settings/members
 */

const MEMBERS_URL = '/ui/0/project-settings/members';

const MOCK_REQUESTS = [
  {
    requestId: 'mock-req-alice',
    email: 'alice@example.com',
    fullName: 'Alice Example',
    avatar: null,
    userId: 'user-alice',
    requestedRole: 'viewer',
    createdAt: new Date().toISOString(),
  },
  {
    requestId: 'mock-req-bob',
    email: 'bob@example.com',
    fullName: 'Bob Example',
    avatar: null,
    userId: 'user-bob',
    requestedRole: 'editor',
    createdAt: new Date().toISOString(),
  },
];

/**
 * Register page.route() intercepts for the three membership-request endpoints.
 * Must be called before page.goto() so intercepts are in place before the page
 * fires its initial data-fetch.
 */
async function mockMembershipRequestRoutes(page: Page): Promise<void> {
  // GET /api/members/requests — list
  await page.route('**/api/members/requests', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REQUESTS),
      });
    }
    return route.continue();
  });

  // POST /api/members/requests/:requestId/approve
  await page.route('**/api/members/requests/*/approve', route => {
    const body = {
      userId: 'user-alice',
      email: 'alice@example.com',
      role: 'viewer',
      roleScope: 'entire_project',
      contextIds: [],
    };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  // POST /api/members/requests/:requestId/decline
  await page.route('**/api/members/requests/*/decline', route => {
    return route.fulfill({ status: 204, body: '' });
  });
}

async function openAdminMembersPage(page: Page): Promise<void> {
  await page.goto(MEMBERS_URL);
  // Wait for data to load before exercising admin controls.
  await expect(page.getByTestId(TESTIDS.pendingRequestsSection)).toBeVisible({
    timeout: 25_000,
  });
}

async function mockNonAdminRoutes(page: Page, role: Exclude<ProjectRole, 'admin'>): Promise<void> {
  const currentUser: CurrentUserResponse = {
    userId: `mock-${role}`,
    email: `${role}@example.com`,
    fullName: 'Project Member',
    projectId: '0',
    projectTitle: 'Test Project',
    roles: [role],
  };
  const projects: Projects = [{ id: '0', title: 'Test Project', roles: [role], status: 'active' }];
  const members: MemberWithScopeDto[] = [
    {
      userId: 'mock-existing-member',
      email: 'existing-member@example.com',
      displayName: 'Existing Member',
      avatarUrl: undefined,
      role: 'viewer',
      roleScope: 'entire_project',
      contextIds: [],
    },
  ];

  // Mirror AuthContext and ProjectsContext contracts. Keep the shared sign-in
  // fixture unchanged and register these overrides before the first navigation.
  await page.route('**/auth/api/user', route => route.fulfill({ json: currentUser }));
  await page.route('**/auth/api/projects', route => route.fulfill({ json: projects }));
  await page.route(/\/api\/members\/?$/, route => route.fulfill({ json: members }));
  await page.route(/\/api\/contexts\/?$/, route => route.fulfill({ json: [] }));
  await page.route('**/api/members/user-provisioning-settings', route =>
    route.fulfill({
      json: { isApplicable: false, isMainProject: false, organization: null, settings: null },
    })
  );

  // Fail closed if a UI regression sends an administrative action. These local
  // responses are safety guards; the request recorder below supplies the check.
  await page.route(/\/api\/members\/requests\/[^/]+\/(approve|decline)$/, route =>
    route.fulfill({ status: 403, json: { message: 'Forbidden' } })
  );
}

test.describe('Project Settings — Membership requests', () => {
  test.beforeEach(async ({ page }) => {
    await mockMembershipRequestRoutes(page);
  });

  // ---------------------------------------------------------------------------
  // MR-01: Admin sees the pending requests section with both mock entries
  // ---------------------------------------------------------------------------
  test('admin sees both pending requests (MR-01)', async ({ page }) => {
    await openAdminMembersPage(page);
    await expect(page.getByTestId(TESTIDS.pendingRequestsSection)).toBeVisible();
    // Trade-off: no count in the header — the row testids carry the cardinality
    // contract instead, surviving copy tweaks to the section title.
    await expect(page.getByText(/Access requests/i)).toBeVisible();
    await expect(page.getByText('alice@example.com')).toBeVisible();
    await expect(page.getByText('bob@example.com')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // MR-02: Approve flow — sheet opens, Approve button triggers toast + row gone
  // ---------------------------------------------------------------------------
  test('approve flow removes the row optimistically (MR-02)', async ({ page }) => {
    await openAdminMembersPage(page);
    // Click the alice row to open the sheet.
    await page.getByText('alice@example.com').click();

    const sheet = page.getByTestId(TESTIDS.membershipRequestSheet);
    await expect(sheet).toBeVisible();
    // Sheet title is generic now — identity-block email confirms the right request opened.
    await expect(sheet.getByRole('heading', { name: /Membership request/i })).toBeVisible();
    await expect(sheet.getByText('alice@example.com')).toBeVisible();

    // Click the Approve button inside the sheet.
    await sheet.getByRole('button', { name: /Approve request/i }).click();

    // Toast confirmation.
    await expect(page.getByText(/Approved request from alice@example\.com/i)).toBeVisible();

    // Row should be gone (optimistic removal).
    await expect(page.getByTestId('membershipRequestRow-mock-req-alice')).toBeHidden();
  });

  // ---------------------------------------------------------------------------
  // MR-03: Decline flow — confirmation dialog appears, confirm triggers toast +
  //         row gone
  // ---------------------------------------------------------------------------
  test('decline flow asks for confirmation then removes the row (MR-03)', async ({ page }) => {
    await openAdminMembersPage(page);
    // Click the bob row to open the sheet.
    await page.getByText('bob@example.com').click();

    const sheet = page.getByTestId(TESTIDS.membershipRequestSheet);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: /Membership request/i })).toBeVisible();
    await expect(sheet.getByText('bob@example.com')).toBeVisible();

    // Click "Decline request" — this opens the ConfirmationDialog, not the
    // final action yet.
    await sheet.getByRole('button', { name: /Decline request/i }).click();

    // Confirmation dialog heading.
    await expect(page.getByRole('heading', { name: /Decline membership request/i })).toBeVisible();

    // The dialog has a destructive "Decline" confirm button. It is the last
    // "Decline" button in the DOM (the sheet header button is behind the dialog).
    const declineButtons = page.getByRole('button', { name: /^Decline$/i });
    await declineButtons.last().click();

    // Toast confirmation.
    await expect(page.getByText(/Declined request from bob@example\.com/i)).toBeVisible();

    // Row should be gone (optimistic removal).
    await expect(page.getByTestId('membershipRequestRow-mock-req-bob')).toBeHidden();
  });

  // ---------------------------------------------------------------------------
  // MR-04: Non-admin users — normal members remain visible, admin actions absent
  // ---------------------------------------------------------------------------
  for (const role of ['viewer', 'editor'] as const) {
    test(`${role} cannot see or act on pending requests (MR-04)`, async ({ page }) => {
      const pendingRequestReads: string[] = [];
      const administrativeActions: string[] = [];
      page.on('request', request => {
        const pathname = new URL(request.url()).pathname;
        if (request.method() === 'GET' && pathname === '/api/members/requests') {
          pendingRequestReads.push(pathname);
        }
        if (
          request.method() === 'POST' &&
          /^\/api\/members\/requests\/[^/]+\/(approve|decline)$/.test(pathname)
        ) {
          administrativeActions.push(pathname);
        }
      });

      await mockNonAdminRoutes(page, role);
      await page.goto(MEMBERS_URL);

      // A loaded member row proves the page is usable. Negative assertions alone
      // could pass while the route is still loading or has redirected to login.
      const membersTable = page.getByRole('table', { name: 'Project members table' });
      const memberRow = membersTable.getByRole('row').filter({
        has: page.getByText('existing-member@example.com', { exact: true }),
      });
      await expect(memberRow).toBeVisible({ timeout: 25_000 });
      await expect(page).toHaveURL(new RegExp(`${MEMBERS_URL}$`));
      await expect(memberRow.getByText('Existing Member', { exact: true })).toBeVisible();
      await expect(page.getByTestId(TESTIDS.pendingRequestsSection)).toHaveCount(0);
      await expect(page.getByTestId(TESTIDS.membershipRequestSheet)).toHaveCount(0);
      await expect(page.getByTestId('membershipRequestRow-mock-req-alice')).toHaveCount(0);
      await expect(page.getByTestId('membershipRequestRow-mock-req-bob')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: /Approve request|Decline request/i })
      ).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Invite member/i })).toBeDisabled();

      // Clicking a normal member must not expose a request or editable member
      // sheet. Its menu remains accessible, with administrative items disabled.
      await memberRow.getByText('existing-member@example.com', { exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await memberRow.getByRole('button', { name: 'Open menu', exact: true }).click();
      await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeDisabled();
      await expect(
        page.getByRole('menuitem', { name: 'Remove from project', exact: true })
      ).toBeDisabled();
      await page.keyboard.press('Escape');

      expect(pendingRequestReads).toEqual([]);
      expect(administrativeActions).toEqual([]);
    });
  }
});
