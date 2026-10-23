import { IS_API_MODE } from '@/config/data-source';
import { DemoAccountLogin } from './DemoAccountLogin';
import { LoginShell } from './LoginShell';
import { PasswordLoginForm } from './PasswordLoginForm';

/** api mode signs in with username + password; mock mode keeps the demo account picker. */
const LoginPage = () => <LoginShell>{IS_API_MODE ? <PasswordLoginForm /> : <DemoAccountLogin />}</LoginShell>;

export default LoginPage;
