import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingState } from '@/components/common/States';
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
const NotificationsPage = lazy(() => import('@/features/notifications'));
const AdminEmployeesPage = lazy(() => import('@/features/admin/EmployeesPage'));
const AdminDepartmentsPage = lazy(() => import('@/features/admin/DepartmentsPage'));
const AdminRolesPage = lazy(() => import('@/features/admin/RolesPage'));
const BuildingSettingsPage = lazy(() => import('@/features/buildings'));
const LocationsPage = lazy(() => import('@/features/buildings/LocationsPage'));
const WorkflowRulesPage = lazy(() => import('@/features/workflow'));
const AssistantPage = lazy(() => import('@/features/assistant'));

const page = (node: ReactNode) => <Suspense fallback={<LoadingState />}>{node}</Suspense>;

export const router = createBrowserRouter([
  { path: '/login', element: page(<LoginPage />), errorElement: <RouteErrorPage /> },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: page(<DashboardPage />) },
      { path: 'tasks', element: page(<TasksPage />) },
      { path: 'records', element: page(<RecordsPage />) },
      { path: 'records/schedule', element: page(<RepairSchedulePage />) },
      { path: 'records/new', element: page(<RecordFormPage />) },
      { path: 'records/:recordId', element: page(<RecordDetailPage />) },
      { path: 'records/:recordId/edit', element: page(<RecordFormPage />) },
      { path: 'maintenance/schedule', element: page(<SchedulePage />) },
      { path: 'maintenance/plans', element: page(<PlansPage />) },
      { path: 'maintenance/plans/new', element: page(<PlanFormPage />) },
      { path: 'maintenance/plans/:planId', element: page(<PlanDetailPage />) },
      { path: 'maintenance/plans/:planId/edit', element: page(<PlanFormPage />) },
      { path: 'maintenance/items', element: page(<ItemsPage />) },
      { path: 'maintenance/items/:itemId', element: page(<ItemDetailPage />) },
      { path: 'maintenance/occurrences/:occurrenceId', element: page(<OccurrenceDetailPage />) },
      { path: 'reports', element: page(<ReportsPage />) },
      { path: 'notifications', element: page(<NotificationsPage />) },
      { path: 'admin', element: <Navigate to="/admin/employees" replace /> },
      { path: 'admin/employees', element: page(<AdminEmployeesPage />) },
      { path: 'admin/departments', element: page(<AdminDepartmentsPage />) },
      { path: 'admin/roles', element: page(<AdminRolesPage />) },
      { path: 'settings/buildings', element: page(<BuildingSettingsPage />) },
      { path: 'settings/workflow', element: page(<WorkflowRulesPage />) },
      { path: 'settings/locations', element: page(<LocationsPage />) },
      { path: 'assistant', element: page(<AssistantPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
