
import LoginForm from './login-form'

export default function LoginPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
            <div className="w-full max-w-sm">
                <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">Sign In</h1>
                <LoginForm />
            </div>
        </div>
    )
}
