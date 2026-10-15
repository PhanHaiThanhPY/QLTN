import AdminSectionPage from './AdminSectionPage';

/** Backward-compatible entry point; the sidebar now links to the separated menus. */
const AdminPage = () => <AdminSectionPage section="employees" />;

export default AdminPage;
