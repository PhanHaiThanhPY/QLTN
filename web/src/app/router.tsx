import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingState } from '@/components/common/States';
import { IS_API_MODE } from '@/config/data-source';
import { ApiUnavailablePage } from './ApiUnavailablePage';
import { HomeRedirect } from './HomeRedirect';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorPage } from './RouteErrorPage';

const LoginPage = lazy(() => import('@/features/auth'));
const DashboardPage = lazy(() => import('@/features/dashboard'));
const TasksPage = lazy(() => import('@/features/tasks'));
const RecordsPage = lazy(() => import('@/features/records'));
const RepairSchedulePage = lazy(() => import('@/features/records/RepairSchedulePage'));
const RecordDetailPage = lazy(() => import('@/features/records/RecordDetailPage'));
const RecordFormPage = lazy(() => import('@/features/records/RecordFormPage'));
const SchedulePage = lazy(() => import('@/features/maintenance/SchedulePage'));
const PlansPage = lazy(() => import('@/features/maintenance/PlansPage'));
const PlanDetailPage = lazy(() => import('@/features/maintenance/PlanDetailPage'));
const PlanFormPage = lazy(() => import('@/features/maintenance/PlanFormPage'));
const ItemsPage = lazy(() => import('@/features/maintenance/ItemsPage'));
const ItemDetailPage = lazy(() => import('@/features/maintenance/ItemDetailPage'));
const OccurrenceDetailPage = lazy(() => import('@/features/maintenance/OccurrenceDetailPage'));
const ReportsPage = lazy(() => import('@/features/reports'));
const AuditLogPage = lazy(() => import('@/features/audit'));
const NotificationsPage = lazy(() => import('@/features/notifications'));
const AdminEmployeesPage = lazy(() => import('@/features/admin/EmployeesPage'));
const AdminDepartmentsPage = lazy(() => import('@/features/admin/DepartmentsPage'));
const AdminRolesPage = lazy(() => import('@/features/admin/RolesPage'));
const BuildingSettingsPage = lazy(() => import('@/features/buildings'));
const LocationsPage = lazy(() => import('@/features/buildings/LocationsPage'));
const WorkflowRulesPage = lazy(() => import('@/features/workflow'));
const AssistantPage = lazy(() => import('@/features/assistant'));
const SpacePage = lazy(() => import('@/features/space'));

const page = (node: ReactNode) => <Suspense fallback={<LoadingState />}>{node}</Suspense>;

/** api mode (plan decision D2): modules still on IndexedDB show "chưa nối API" instead of failing on UUIDs. */
const connected = (element: ReactNode): ReactNode => (IS_API_MODE ? <ApiUnavailablePage /> : element);

/** Routes whose screens already read/write api-qltn (T1: create, draft edit and detail). */
const apiConnected = (element: ReactNode): ReactNode => (IS_API_MODE ? element : <ApiUnavailablePage />);

export const router = createBrowserRouter([
  { path: '/login', element: page(<LoginPage />), errorElement: <RouteErrorPage /> },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: IS_API_MODE ? <HomeRedirect /> : page(<DashboardPage />) },
      { path: 'tasks', element: connected(page(<TasksPage />)) },
      { path: 'records', element: apiConnected(page(<RecordsPage />)) },
      { path: 'records/schedule', element: connected(page(<RepairSchedulePage />)) },
      { path: 'records/new', element: apiConnected(page(<RecordFormPage />)) },
      { path: 'records/:recordId', element: apiConnected(page(<RecordDetailPage />)) },
      { path: 'records/:recordId/edit', element: apiConnected(page(<RecordFormPage />)) },
      { path: 'maintenance/schedule', element: connected(page(<SchedulePage />)) },
      { path: 'maintenance/plans', element: connected(page(<PlansPage />)) },
      { path: 'maintenance/plans/new', element: connected(page(<PlanFormPage />)) },
      { path: 'maintenance/plans/:planId', element: connected(page(<PlanDetailPage />)) },
      { path: 'maintenance/plans/:planId/edit', element: connected(page(<PlanFormPage />)) },
      { path: 'maintenance/items', element: connected(page(<ItemsPage />)) },
      { path: 'maintenance/items/:itemId', element: connected(page(<ItemDetailPage />)) },
      { path: 'maintenance/occurrences/:occurrenceId', element: connected(page(<OccurrenceDetailPage />)) },
      { path: 'reports', element: connected(page(<ReportsPage />)) },
      { path: 'audit', element: apiConnected(page(<AuditLogPage />)) },
      { path: 'notifications', element: page(<NotificationsPage />) },
      { path: 'admin', element: <Navigate to="/admin/employees" replace /> },
      { path: 'admin/employees', element: page(<AdminEmployeesPage />) },
      { path: 'admin/departments', element: page(<AdminDepartmentsPage />) },
      { path: 'admin/roles', element: page(<AdminRolesPage />) },
      { path: 'settings/buildings', element: page(<BuildingSettingsPage />) },
      { path: 'settings/workflow', element: page(<WorkflowRulesPage />) },
      { path: 'settings/locations', element: page(<LocationsPage />) },
      { path: 'assistant', element: connected(page(<AssistantPage />)) },
      { path: 'space', element: connected(page(<SpacePage />)) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
